"""Amortize the stronger planner into a fast neural policy; validation remains separate."""

import argparse
import hashlib
import json
import shutil
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn
from train_v2 import PolicyV2, pack

p = argparse.ArgumentParser()
p.add_argument("--dataset", required=True)
p.add_argument("--resume", required=True)
p.add_argument("--output", required=True)
p.add_argument("--epochs", type=int, default=16)
p.add_argument("--batch", type=int, default=256)
p.add_argument("--lr", type=float, default=0.0001)
p.add_argument("--seed", type=int, default=1204791)
p.add_argument("--threads", type=int, default=2)
p.add_argument("--hard-weight", type=float, default=0.0)
p.add_argument("--value-target", choices=["terminal", "parent"], default="terminal")
a = p.parse_args()
torch.set_num_threads(a.threads)
torch.manual_seed(a.seed)
rng = np.random.default_rng(a.seed)
saved = torch.load(a.resume, map_location="cpu", weights_only=True)
net = PolicyV2(saved["width"])
net.load_state_dict(saved["state_dict"])
anchor = PolicyV2(saved["width"])
anchor.load_state_dict(saved["state_dict"])
anchor.eval()
for parameter in anchor.parameters():
    parameter.requires_grad_(False)
opt = torch.optim.Adam(net.parameters(), lr=a.lr, eps=1e-5)
rows = [json.loads(line) for line in Path(a.dataset).read_text().splitlines()]
for row in rows:
    row["teacher"] = [0] * len(row["actions"])
out = Path(a.output)
out.mkdir(parents=True, exist_ok=True)
(out / "config.json").write_text(json.dumps(vars(a), indent=2))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


(out / "provenance.json").write_text(
    json.dumps(
        {
            "dataset_sha256": sha(a.dataset),
            "parent_checkpoint_sha256": sha(a.resume),
            "trainer_sha256": sha(__file__),
            "torch": torch.__version__,
            "numpy": np.__version__,
        },
        indent=2,
    )
)
shutil.copy(__file__, out / "trainer-source.py")
if not rows or any(abs(sum(row["target"]) - 1) > 1e-5 for row in rows):
    raise ValueError("Invalid search targets")
history = []
start = time.time()
for epoch in range(a.epochs):
    net.train()
    losses = []
    for ix in np.array_split(
        rng.permutation(len(rows)), max(1, int(np.ceil(len(rows) / a.batch)))
    ):
        batch = [rows[i] for i in ix]
        s, actions, mask, _ = pack(batch, torch.device("cpu"))
        logits, value, q = net(s, actions, mask)
        target = torch.zeros_like(logits)
        for i, row in enumerate(batch):
            target[i, : len(row["target"])] = torch.tensor(row["target"])
        terminal = torch.tensor([row["value"] for row in batch], dtype=torch.float32)
        choices = torch.tensor([row["choice"] for row in batch])
        target *= 1 - a.hard_weight
        target.scatter_add_(
            1, choices[:, None], torch.full((len(batch), 1), a.hard_weight)
        )
        chosen_q = q.gather(1, choices[:, None]).squeeze(1)
        q_target = terminal
        if a.value_target == "parent":
            with torch.no_grad():
                _, terminal, anchor_q = anchor(s, actions, mask)
                q_target = anchor_q.gather(1, choices[:, None]).squeeze(1)
        policy_loss = -(target * torch.log_softmax(logits, dim=-1)).sum(-1).mean()
        loss = (
            policy_loss
            + 0.3 * (value - terminal).square().mean()
            + 0.15 * (chosen_q - q_target).square().mean()
        )
        opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(net.parameters(), 0.5)
        opt.step()
        losses.append(float(loss.detach()))
    record = {
        "epoch": epoch + 1,
        "loss": float(np.mean(losses)),
        "positions": len(rows),
        "seconds": time.time() - start,
    }
    history.append(record)
    print(json.dumps(record), flush=True)
    if (epoch + 1) % 4 == 0 or epoch + 1 == a.epochs:
        ck = out / f"search-distill-{epoch + 1:03d}"
        meta = {
            "algorithm": "search-policy-distillation",
            "seed": a.seed,
            "positions": len(rows),
            "epochs": epoch + 1,
            "scoreMix": 0.1,
            "human_evaluation": False,
        }
        net.export(
            ck.with_suffix(".json"),
            saved["steps"] + (epoch + 1) * len(rows),
            ck.name,
            meta,
        )
        torch.save(
            {
                "state_dict": net.state_dict(),
                "width": saved["width"],
                "steps": saved["steps"] + (epoch + 1) * len(rows),
                "optimizer": opt.state_dict(),
                "config": vars(a),
            },
            ck.with_suffix(".pt"),
        )
        (out / "metrics.json").write_text(json.dumps(history, indent=2))
