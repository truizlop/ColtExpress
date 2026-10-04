"""Exact shared TypeScript simulator + batched PyTorch imitation/PPO training.
No remote inference, no hidden simulator fields enter the policy.
"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.distributions import Categorical

ROOT = Path(__file__).resolve().parents[1]
STATE_DIM, ACTION_DIM = 576, 64


class Policy(nn.Module):
    def __init__(self, width=64):
        super().__init__()
        self.state = nn.Linear(STATE_DIM, width)
        self.action = nn.Linear(ACTION_DIM, 24)
        self.joint = nn.Linear(width + 24, 32)
        self.policy = nn.Linear(32, 1)
        self.value = nn.Linear(width, 1)
        nn.init.orthogonal_(self.policy.weight, gain=0.01)
        nn.init.zeros_(self.policy.bias)

    def forward(self, states, actions, mask):
        h = torch.tanh(self.state(states))
        a = torch.tanh(self.action(actions))
        joint = torch.cat((h[:, None, :].expand(-1, a.shape[1], -1), a), -1)
        logits = self.policy(torch.tanh(self.joint(joint))).squeeze(-1)
        return logits.masked_fill(~mask, -1e9), self.value(h).squeeze(-1)

    def export(self, path, steps, name, metadata=None):
        layers = {
            k: {
                "weight": getattr(self, k).weight.detach().cpu().tolist(),
                "bias": getattr(self, k).bias.detach().cpu().tolist(),
            }
            for k in ["state", "action", "joint", "policy", "value"]
        }
        data = {
            "format": "colt-policy-v1",
            "featureVersion": 1,
            "stateDim": STATE_DIM,
            "actionDim": ACTION_DIM,
            "name": name,
            "steps": steps,
            "layers": layers,
            "metadata": metadata or {},
        }
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(data, separators=(",", ":")))
        temp.replace(path)


class Bridge:
    def __init__(self, node, script=None):
        self.proc = subprocess.Popen(
            [node, str(script or ROOT / "training/bridge.mjs")],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=ROOT,
        )

    def send(self, data):
        self.proc.stdin.write(json.dumps(data, separators=(",", ":")) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("Simulator process exited")
        result = json.loads(line)
        if "error" in result:
            raise RuntimeError(result["error"])
        return result

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.write('{"cmd":"close"}\n')
            self.proc.stdin.flush()
            self.proc.stdin.close()
            self.proc.wait(timeout=10)


def tensors(rows, device):
    size = max(len(r["actions"]) for r in rows)
    states = np.asarray([r["state"] for r in rows], dtype=np.float32)
    actions = np.zeros((len(rows), size, ACTION_DIM), dtype=np.float32)
    mask = np.zeros((len(rows), size), dtype=np.bool_)
    teachers = np.full((len(rows), size), -1e9, dtype=np.float32)
    for i, r in enumerate(rows):
        n = len(r["actions"])
        actions[i, :n] = r["actions"]
        mask[i, :n] = True
        teachers[i, :n] = r["teacher"]
    return tuple(
        torch.from_numpy(x).to(device) for x in [states, actions, mask, teachers]
    )


def collect(bridge, net, args, iteration, device):
    result = bridge.send(
        {
            "cmd": "start",
            "batch": args.batch,
            "seed": args.seed + iteration * 1000003,
            "mode": args.mode,
            "players": args.players,
            "league": args.league,
            "learnerFraction": args.learner_fraction,
        }
    )
    data = []
    terminals = []
    net.eval()
    while result["rows"]:
        rows = result["rows"]
        s, a, m, t = tensors(rows, device)
        with torch.no_grad():
            logits, values = net(s, a, m)
            if args.mode == "imitation":
                # Mixed temperatures visit alternatives, not only the teacher's path.
                behavior = torch.softmax(t / (0.35 if iteration % 4 else 1.8), dim=-1)
                choices = torch.multinomial(behavior, 1).squeeze(-1)
                logp = torch.log(
                    behavior.gather(1, choices[:, None]).squeeze(1).clamp_min(1e-9)
                )
            else:
                dist = Categorical(logits=logits)
                choices = dist.sample()
                logp = dist.log_prob(choices)
        cs = choices.cpu().tolist()
        vs = values.cpu().tolist()
        lp = logp.cpu().tolist()
        for i, row in enumerate(rows):
            data.append({"row": row, "choice": cs[i], "value": vs[i], "logp": lp[i]})
        result = bridge.send(
            {"cmd": "step", "choices": [[r["env"], cs[i]] for i, r in enumerate(rows)]}
        )
        terminals.extend(result["completed"])
    rewards = {}
    for t in terminals:
        for p in range(t["players"]):
            rewards[(t["episode"], p)] = (
                1 / len(t["winners"]) if p in t["winners"] else 0
            )
    groups = {}
    for i, x in enumerate(data):
        groups.setdefault((x["row"]["episode"], x["row"]["player"]), []).append(i)
    for key, idxs in groups.items():
        gae = 0.0
        next_value = 0.0
        for j, i in enumerate(reversed(idxs)):
            r = rewards[key] if j == 0 else 0.0
            delta = r + args.gamma * next_value - data[i]["value"]
            gae = delta + args.gamma * args.gae_lambda * gae
            data[i]["adv"] = gae
            data[i]["return"] = gae + data[i]["value"]
            next_value = data[i]["value"]
    return data, terminals


def train(args):
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    random.seed(args.seed)
    torch.set_num_threads(args.threads)
    device = torch.device(args.device)
    net = Policy(args.width).to(device)
    if args.resume:
        saved = torch.load(args.resume, map_location=device, weights_only=True)
        net.load_state_dict(saved["state_dict"])
    opt = torch.optim.Adam(net.parameters(), lr=args.lr)
    bridge = Bridge(args.node)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    (out / "config.json").write_text(json.dumps(vars(args), indent=2))
    steps = 0
    start = time.time()
    history = []
    anchors = list(args.anchor or [])
    pool = list(args.pool or [])
    if anchors or pool:
        bridge.send({"cmd": "pool", "paths": anchors + pool})
    try:
        for iteration in range(args.iterations):
            if args.lr_final is not None:
                for group in opt.param_groups:
                    group["lr"] = args.lr + (args.lr_final - args.lr) * iteration / max(
                        1, args.iterations - 1
                    )
            data, finished = collect(bridge, net, args, iteration, device)
            steps += len(data)
            net.train()
            adv = np.array([x["adv"] for x in data], dtype=np.float32)
            adv = (adv - adv.mean()) / (adv.std() + 1e-8)
            sums = []
            for epoch in range(args.epochs):
                order = np.random.permutation(len(data))
                for lo in range(0, len(data), args.minibatch):
                    indices = order[lo : lo + args.minibatch]
                    batch = [data[i] for i in indices]
                    s, a, m, t = tensors([x["row"] for x in batch], device)
                    logits, values = net(s, a, m)
                    returns = torch.tensor([x["return"] for x in batch], device=device)
                    if args.mode == "imitation":
                        target = torch.softmax(t / 0.5, dim=-1)
                        actor = (
                            -(target * torch.log_softmax(logits, dim=-1)).sum(-1).mean()
                        )
                        entropy = Categorical(logits=logits).entropy().mean()
                        loss = actor + 0.25 * (values - returns).square().mean()
                    else:
                        dist = Categorical(logits=logits)
                        choices = torch.tensor(
                            [x["choice"] for x in batch], device=device
                        )
                        newlog = dist.log_prob(choices)
                        oldlog = torch.tensor([x["logp"] for x in batch], device=device)
                        advantage = torch.from_numpy(adv[indices]).to(device)
                        ratio = (newlog - oldlog).exp()
                        actor = -torch.minimum(
                            ratio * advantage, ratio.clamp(0.8, 1.2) * advantage
                        ).mean()
                        entropy = dist.entropy().mean()
                        loss = (
                            actor
                            + 0.5 * (values - returns).square().mean()
                            - args.entropy * entropy
                        )
                    opt.zero_grad(set_to_none=True)
                    loss.backward()
                    nn.utils.clip_grad_norm_(net.parameters(), 0.5)
                    opt.step()
                    sums.append([float(loss.detach()), float(entropy.detach())])
            elapsed = time.time() - start
            means = np.mean(sums, axis=0)
            record = {
                "iteration": iteration + 1,
                "games": len(finished),
                "cumulative_games": (iteration + 1) * args.batch,
                "decisions": steps,
                "seconds": round(elapsed, 2),
                "decisions_per_second": round(steps / elapsed, 1),
                "loss": round(float(means[0]), 5),
                "entropy": round(float(means[1]), 4),
                "mode": args.mode,
            }
            history.append(record)
            print(json.dumps(record), flush=True)
            meta = {
                "algorithm": args.mode,
                "seed": args.seed,
                "width": args.width,
                "games": (iteration + 1) * args.batch,
                "device": args.device,
                "elapsed_seconds": elapsed,
                "rules": "2016 advanced base game",
                "human_evaluation": False,
            }
            if (
                iteration + 1
            ) % args.save_every == 0 or iteration == args.iterations - 1:
                checkpoint = out / f"{args.mode}-{iteration + 1:04d}"
                torch.save(
                    {
                        "state_dict": net.state_dict(),
                        "width": args.width,
                        "steps": steps,
                        "optimizer": opt.state_dict(),
                        "iteration": iteration + 1,
                        "torch_rng": torch.get_rng_state(),
                        "config": vars(args),
                    },
                    checkpoint.with_suffix(".pt"),
                )
                net.export(
                    checkpoint.with_suffix(".json"),
                    steps,
                    f"{args.mode}-{iteration + 1:04d}",
                    meta,
                )
                net.export(
                    out / "latest.json", steps, f"{args.mode}-{iteration + 1:04d}", meta
                )
                (out / "metrics.json").write_text(json.dumps(history, indent=2))
                if args.mode == "ppo":
                    pool.append(str(checkpoint.with_suffix(".json")))
                    pool = pool[-args.pool_size :]
                    bridge.send({"cmd": "pool", "paths": anchors + pool})
        # Cross-runtime inference parity is a release gate, not an assumption.
        probe = {
            "state": np.random.default_rng(7).normal(0, 0.2, STATE_DIM).tolist(),
            "actions": np.random.default_rng(8)
            .normal(0, 0.2, (7, ACTION_DIM))
            .tolist(),
        }
        result = bridge.send(
            {"cmd": "parity", "path": str((out / "latest.json").resolve()), **probe}
        )
        with torch.no_grad():
            logits, value = net(
                torch.tensor([probe["state"]], device=device, dtype=torch.float32),
                torch.tensor([probe["actions"]], device=device, dtype=torch.float32),
                torch.ones((1, 7), device=device, dtype=torch.bool),
            )
        error = max(
            float(np.max(np.abs(logits.cpu().numpy()[0] - result["logits"]))),
            abs(float(value) - result["value"]),
        )
        (out / "parity.json").write_text(
            json.dumps(
                {"maximum_absolute_error": error, "passed": error < 1e-4}, indent=2
            )
        )
        if error >= 1e-4:
            raise RuntimeError(f"Inference parity failed: {error}")
    finally:
        bridge.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["imitation", "ppo"], default="imitation")
    ap.add_argument("--iterations", type=int, default=40)
    ap.add_argument("--batch", type=int, default=48)
    ap.add_argument("--width", type=int, default=64)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--minibatch", type=int, default=512)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--lr-final", type=float)
    ap.add_argument("--pool", nargs="+")
    ap.add_argument("--anchor", nargs="+")
    ap.add_argument("--pool-size", type=int, default=4)
    ap.add_argument("--league", choices=["legacy", "stable"], default="legacy")
    ap.add_argument("--learner-fraction", type=float, default=0.5)
    ap.add_argument("--gae-lambda", type=float, default=0.95)
    ap.add_argument("--entropy", type=float, default=0.015)
    ap.add_argument("--gamma", type=float, default=0.995)
    ap.add_argument("--seed", type=int, default=1701)
    ap.add_argument("--device", choices=["cpu", "mps"], default="cpu")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--players", type=int)
    ap.add_argument("--save-every", type=int, default=10)
    ap.add_argument("--resume")
    ap.add_argument("--output", default=str(ROOT / "training/runs/initial"))
    ap.add_argument("--node", default="node")
    train(ap.parse_args())
