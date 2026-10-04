"""Canonical feature-v2 policy with stable league PPO and resumable checkpoints.

Actors, critics and teachers receive only the acting player's legal observation.
The optional action-value trace is an experiment, not a centralized VRPO replica.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.distributions import Categorical
from train import Bridge

STATE_DIM, ACTION_DIM = 1280, 192


class PolicyV2(nn.Module):
    def __init__(self, width=128):
        super().__init__()
        self.width = width
        self.state = nn.Linear(STATE_DIM, width)
        self.state2 = nn.Linear(width, width)
        self.action = nn.Linear(ACTION_DIM, 64)
        self.joint = nn.Linear(width + 64, width)
        self.joint2 = nn.Linear(width, 64)
        self.policy = nn.Linear(64, 1)
        self.valueHidden = nn.Linear(width, 64)
        self.value = nn.Linear(64, 1)
        self.q = nn.Linear(64, 1)
        for layer in self.children():
            nn.init.orthogonal_(layer.weight, gain=math.sqrt(2))
            nn.init.zeros_(layer.bias)
        nn.init.orthogonal_(self.policy.weight, gain=0.01)
        nn.init.orthogonal_(self.value.weight, gain=1)
        nn.init.orthogonal_(self.q.weight, gain=1)

    def forward(self, states, actions, mask):
        h = torch.tanh(self.state2(torch.tanh(self.state(states))))
        a = torch.tanh(self.action(actions))
        j = torch.cat((h[:, None, :].expand(-1, a.shape[1], -1), a), -1)
        j = torch.tanh(self.joint2(torch.tanh(self.joint(j))))
        logits = self.policy(j).squeeze(-1).masked_fill(~mask, -1e9)
        value = self.value(torch.tanh(self.valueHidden(h))).squeeze(-1)
        return logits, value, self.q(j).squeeze(-1)

    def export(self, path, steps, name, metadata):
        layers = {
            k: {
                "weight": v.weight.detach().cpu().tolist(),
                "bias": v.bias.detach().cpu().tolist(),
            }
            for k, v in self.named_children()
        }
        data = {
            "format": "colt-policy-v2",
            "featureVersion": 2,
            "stateDim": STATE_DIM,
            "actionDim": ACTION_DIM,
            "name": name,
            "steps": steps,
            "layers": layers,
            "metadata": metadata,
        }
        path = Path(path)
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(data, separators=(",", ":")))
        temp.replace(path)


def pack(rows, device):
    size = max(len(r["actions"]) for r in rows)
    states = np.asarray([r["state"] for r in rows], dtype=np.float32)
    actions = np.zeros((len(rows), size, ACTION_DIM), dtype=np.float32)
    mask = np.zeros((len(rows), size), dtype=np.bool_)
    teacher = np.full((len(rows), size), -1e9, dtype=np.float32)
    for i, r in enumerate(rows):
        n = len(r["actions"])
        actions[i, :n] = r["actions"]
        mask[i, :n] = True
        teacher[i, :n] = r["teacher"]
    return tuple(
        torch.from_numpy(x).to(device) for x in (states, actions, mask, teacher)
    )


def trajectory_targets(values, selected_q, expected_q, reward, lam, estimator="gae"):
    """Undiscounted terminal utility; transitions are successive own decisions."""
    targets = np.zeros(len(values), dtype=np.float32)
    advantages = np.zeros(len(values), dtype=np.float32)
    trace = 0.0
    next_v = 0.0
    for j in range(len(values) - 1, -1, -1):
        current = selected_q[j] if estimator == "qtrace" else values[j]
        delta = (reward if j == len(values) - 1 else 0.0) + next_v - current
        trace = delta + lam * trace
        targets[j] = current + trace
        advantages[j] = targets[j] - (
            expected_q[j] if estimator == "qtrace" else values[j]
        )
        next_v = expected_q[j] if estimator == "qtrace" else values[j]
    return advantages, targets


def collect(bridge, net, args, iteration, device):
    result = bridge.send(
        {
            "cmd": "start",
            "batch": args.batch,
            "seed": args.seed + iteration * 1000003,
            "mode": "imitation" if args.mode == "distill" else "ppo",
            "players": args.players,
            "league": "stable",
            "learnerFraction": args.learner_fraction,
            "strategistFraction": args.strategist_fraction,
            "plannerFraction": args.planner_fraction,
            "featureVersion": 2,
        }
    )
    data = []
    terminals = []
    net.eval()
    while result["rows"]:
        rows = result["rows"]
        s, a, m, t = pack(rows, device)
        with torch.no_grad():
            logits, values, qs = net(s, a, m)
            behavior = (
                t / (0.45 if iteration % 5 else 1.2)
                if args.mode == "distill"
                else logits / args.behavior_temperature
            )
            dist = Categorical(logits=behavior)
            choices = dist.sample()
            logp = dist.log_prob(choices)
            expected_q = (torch.softmax(logits, dim=-1) * qs).sum(-1)
            chosen_q = qs.gather(1, choices[:, None]).squeeze(1)
        choices = choices.cpu().tolist()
        vs, lps, cqs, eqs = (
            x.cpu().tolist() for x in (values, logp, chosen_q, expected_q)
        )
        for i, row in enumerate(rows):
            data.append(
                {
                    "row": row,
                    "choice": choices[i],
                    "value": vs[i],
                    "logp": lps[i],
                    "q": cqs[i],
                    "expected_q": eqs[i],
                }
            )
        result = bridge.send(
            {
                "cmd": "step",
                "choices": [[r["env"], choices[i]] for i, r in enumerate(rows)],
            }
        )
        terminals.extend(result["completed"])
    outcomes = {}
    for t in terminals:
        ss = np.asarray(t["scores"], dtype=float)
        probs = np.exp((ss - ss.max()) / 500)
        probs /= probs.sum()
        for p in range(t["players"]):
            win = 1 / len(t["winners"]) if p in t["winners"] else 0
            outcomes[(t["episode"], p)] = (
                1 - args.score_mix
            ) * win + args.score_mix * probs[p]
    groups = {}
    for i, x in enumerate(data):
        groups.setdefault((x["row"]["episode"], x["row"]["player"]), []).append(i)
    for key, idxs in groups.items():
        reward = outcomes[key]
        adv, returns = trajectory_targets(
            [data[i]["value"] for i in idxs],
            [data[i]["q"] for i in idxs],
            [data[i]["expected_q"] for i in idxs],
            reward,
            args.gae_lambda,
            args.estimator,
        )
        for j, i in enumerate(idxs):
            data[i].update(adv=float(adv[j]), target=float(returns[j]), terminal=reward)
    return data, terminals


def train(args):
    torch.set_num_threads(args.threads)
    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    device = torch.device(args.device)
    if args.behavior_temperature <= 0 or not math.isfinite(args.behavior_temperature):
        raise ValueError("Behavior temperature must be positive and finite")
    if args.value_only and args.mode != "ppo":
        raise ValueError("Value recalibration requires PPO-mode trajectories")
    net = PolicyV2(args.width).to(device)
    if args.value_only:
        for name, parameter in net.named_parameters():
            parameter.requires_grad_(name.startswith(("valueHidden.", "value.")))
    opt = torch.optim.Adam(net.parameters(), lr=args.lr, eps=1e-5)
    steps = games = first_iteration = 0
    history = []
    pool = list(args.pool or [])
    saved = None
    if args.resume:
        saved = torch.load(args.resume, map_location=device, weights_only=True)
        net.load_state_dict(saved["state_dict"])
    if args.restore:
        if saved is None:
            raise ValueError("--restore requires --resume")
        for key in [
            "seed",
            "batch",
            "mode",
            "width",
            "estimator",
            "score_mix",
            "gae_lambda",
            "epochs",
            "lr",
            "lr_final",
            "entropy",
            "iterations",
            "device",
            "learner_fraction",
            "strategist_fraction",
            "pool_size",
            "anchor",
        ]:
            if saved["config"][key] != getattr(args, key):
                raise ValueError(f"Resume config mismatch: {key}")
        for key, default in [
            ("planner_fraction", 0.0),
            ("planner_model", None),
            ("behavior_temperature", 1.0),
            ("value_only", False),
        ]:
            if saved["config"].get(key, default) != getattr(args, key):
                raise ValueError(f"Resume config mismatch: {key}")
        opt.load_state_dict(saved["optimizer"])
        torch.set_rng_state(saved["torch_rng"].cpu())
        if args.device == "mps":
            torch.mps.set_rng_state(saved["mps_rng"].cpu())
        rng.bit_generator.state = json.loads(saved["numpy_rng"])
        steps = saved["steps"]
        games = saved["games"]
        first_iteration = saved["iteration"]
        history = saved["history"]
        pool = saved["pool"]
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    (out / "config.json").write_text(json.dumps(vars(args), indent=2))
    source = Path(__file__).resolve()
    bridge_source = source.parent / "bridge.mjs"
    if not args.restore:
        shutil.copy(source, out / "trainer-source.py")
        shutil.copy(bridge_source, out / "bridge-source.mjs")
        (out / "provenance.json").write_text(
            json.dumps(
                {
                    "python": sys.version,
                    "torch": torch.__version__,
                    "numpy": np.__version__,
                    "trainer_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "bridge_sha256": hashlib.sha256(
                        bridge_source.read_bytes()
                    ).hexdigest(),
                },
                indent=2,
            )
        )
    bridge = Bridge(args.node, out / "bridge-source.mjs")
    anchors = list(args.anchor or [])
    if anchors or pool:
        bridge.send({"cmd": "pool", "paths": anchors + pool})
    if args.planner_fraction:
        if not args.planner_model:
            raise ValueError("--planner-fraction requires --planner-model")
        bridge.send({"cmd": "planner", "path": args.planner_model})
    if args.mode == "distill" and args.teacher:
        bridge.send({"cmd": "teacher", "path": args.teacher})
    elapsed_before = history[-1]["seconds"] if history else 0
    start = time.time()
    try:
        for iteration in range(first_iteration, args.iterations):
            progress = iteration / max(1, args.iterations - 1)
            lr = args.lr + (args.lr_final - args.lr) * progress
            for g in opt.param_groups:
                g["lr"] = lr
            data, finished = collect(bridge, net, args, iteration, device)
            steps += len(data)
            games += len(finished)
            net.train()
            advantage = np.array([x["adv"] for x in data], dtype=np.float32)
            # Balance the scale of two-player and larger-table gradients.
            counts = np.array([x["row"]["players"] for x in data])
            for n in np.unique(counts):
                ix = counts == n
                part = advantage[ix]
                advantage[ix] = (part - part.mean()) / (part.std() + 1e-8)
            sums = []
            stop = False
            updates = 0
            for epoch in range(args.epochs):
                for indices in np.array_split(
                    rng.permutation(len(data)),
                    max(1, math.ceil(len(data) / args.minibatch)),
                ):
                    batch = [data[i] for i in indices]
                    s, a, m, t = pack([x["row"] for x in batch], device)
                    logits, values, qs = net(s, a, m)
                    choices = torch.tensor([x["choice"] for x in batch], device=device)
                    target = torch.tensor(
                        [x["target"] for x in batch], device=device, dtype=torch.float32
                    )
                    terminal = torch.tensor(
                        [x["terminal"] for x in batch],
                        device=device,
                        dtype=torch.float32,
                    )
                    dist = Categorical(logits=logits / args.behavior_temperature)
                    entropy = dist.entropy().mean()
                    oldlog = torch.tensor([x["logp"] for x in batch], device=device)
                    logratio = dist.log_prob(choices) - oldlog
                    ratio = logratio.exp()
                    kl = ((ratio - 1) - logratio).mean()
                    clipfrac = ((ratio - 1).abs() > args.clip).float().mean()
                    if args.mode == "distill":
                        teacher = torch.softmax(t / args.teacher_temperature, dim=-1)
                        actor = (
                            -(teacher * torch.log_softmax(logits, dim=-1))
                            .sum(-1)
                            .mean()
                        )
                        target = terminal
                    elif args.value_only:
                        target = terminal
                        actor = torch.zeros((), device=device)
                    else:
                        if epoch > 0 and float(kl.detach()) > args.target_kl * 1.5:
                            stop = True
                            break
                        adv = torch.from_numpy(advantage[indices]).to(device)
                        actor = -torch.minimum(
                            ratio * adv, ratio.clamp(1 - args.clip, 1 + args.clip) * adv
                        ).mean()
                    qchosen = qs.gather(1, choices[:, None]).squeeze(1)
                    value_loss = (values - target).square().mean()
                    q_loss = (qchosen - target).square().mean()
                    # Monte Carlo auxiliary value stabilizes short-trace bootstrap drift.
                    mc_loss = (values - terminal).square().mean()
                    loss = (
                        actor
                        + 0.5 * value_loss
                        + 0.25 * q_loss
                        + 0.25 * mc_loss
                        - (args.entropy * entropy if args.mode == "ppo" else 0)
                    )
                    if args.value_only:
                        loss = mc_loss
                    opt.zero_grad(set_to_none=True)
                    loss.backward()
                    grad = nn.utils.clip_grad_norm_(net.parameters(), 0.5)
                    opt.step()
                    updates += 1
                    sums.append(
                        [
                            float(x.detach())
                            for x in [
                                loss,
                                entropy,
                                kl,
                                clipfrac,
                                value_loss,
                                q_loss,
                                grad,
                            ]
                        ]
                    )
                if stop:
                    break
            means = np.mean(sums, axis=0)
            vals = np.array([x["value"] for x in data])
            targets = np.array([x["terminal"] for x in data])
            metrics = {
                "iteration": iteration + 1,
                "cumulative_games": games,
                "decisions": steps,
                "seconds": round(elapsed_before + time.time() - start, 2),
                "lr": lr,
                "loss": float(means[0]),
                "entropy": float(means[1]),
                "kl": float(means[2]),
                "clip_fraction": float(means[3]),
                "value_loss": float(means[4]),
                "q_loss": float(means[5]),
                "gradient_norm": float(means[6]),
                "updates": updates,
                "kl_stopped": stop,
                "value_explained_variance": float(
                    1 - np.var(targets - vals) / max(1e-8, np.var(targets))
                ),
                "games_with_planning_opponent": sum(
                    "planner" in t["policies"] for t in finished
                ),
                "learner_winning_share": float(
                    np.mean(
                        [
                            sum(
                                1 / len(t["winners"])
                                for p in t["winners"]
                                if t["policies"][p] == "learner"
                            )
                            / sum(p == "learner" for p in t["policies"])
                            for t in finished
                        ]
                    )
                ),
            }
            history.append(metrics)
            print(json.dumps(metrics), flush=True)
            if (
                (iteration + 1) % args.save_every == 0
                or iteration + 1 == args.iterations
                or iteration + 1 == args.stop_after
            ):
                ck = out / f"{args.mode}-{iteration + 1:05d}"
                if args.mode == "ppo":
                    pool.append(str(ck.with_suffix(".json").resolve()))
                    pool = pool[-args.pool_size :]
                meta = {
                    "algorithm": f"stable-league-{args.mode}",
                    "estimator": args.estimator,
                    "seed": args.seed,
                    "width": args.width,
                    "games": games,
                    "scoreMix": args.score_mix,
                    "featureVersion": 2,
                    "valueOnly": args.value_only,
                    "behaviorTemperature": args.behavior_temperature,
                    "human_evaluation": False,
                }
                net.export(ck.with_suffix(".json"), steps, ck.name, meta)
                net.export(out / "latest.json", steps, ck.name, meta)
                torch.save(
                    {
                        "state_dict": net.state_dict(),
                        "width": args.width,
                        "steps": steps,
                        "games": games,
                        "optimizer": opt.state_dict(),
                        "iteration": iteration + 1,
                        "torch_rng": torch.get_rng_state(),
                        "mps_rng": torch.mps.get_rng_state()
                        if args.device == "mps"
                        else None,
                        "numpy_rng": json.dumps(rng.bit_generator.state),
                        "config": vars(args),
                        "history": history,
                        "pool": pool,
                    },
                    ck.with_suffix(".pt"),
                )
                (out / "metrics.json").write_text(json.dumps(history, indent=2))
                if args.mode == "ppo":
                    bridge.send({"cmd": "pool", "paths": anchors + pool})
            if args.stop_after is not None and iteration + 1 >= args.stop_after:
                break
        # A small automatic parity gate; the release verifier adds 100 probes.
        probe = np.random.default_rng(912)
        state = probe.normal(0, 0.2, STATE_DIM).astype(np.float32)
        actions = probe.normal(0, 0.2, (9, ACTION_DIM)).astype(np.float32)
        js = bridge.send(
            {
                "cmd": "parity",
                "path": str((out / "latest.json").resolve()),
                "state": state.tolist(),
                "actions": actions.tolist(),
            }
        )
        with torch.no_grad():
            logits, value, q = net(
                torch.from_numpy(state[None]).to(device),
                torch.from_numpy(actions[None]).to(device),
                torch.ones((1, 9), dtype=torch.bool, device=device),
            )
        error = max(
            float(np.max(np.abs(logits.cpu().numpy()[0] - js["logits"]))),
            abs(float(value) - js["value"]),
            float(np.max(np.abs(q.cpu().numpy()[0] - js["qs"]))),
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


def parser():
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["distill", "ppo"], default="ppo")
    p.add_argument("--iterations", type=int, default=4096)
    p.add_argument("--batch", type=int, default=96)
    p.add_argument("--width", type=int, default=128)
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--minibatch", type=int, default=512)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--lr-final", type=float, default=3e-5)
    p.add_argument("--entropy", type=float, default=0.025)
    p.add_argument("--clip", type=float, default=0.2)
    p.add_argument("--target-kl", type=float, default=0.025)
    p.add_argument("--gae-lambda", type=float, default=0.98)
    p.add_argument("--score-mix", type=float, default=0.1)
    p.add_argument("--estimator", choices=["gae", "qtrace"], default="gae")
    p.add_argument("--seed", type=int, default=704791)
    p.add_argument("--device", choices=["cpu", "mps"], default="cpu")
    p.add_argument("--threads", type=int, default=2)
    p.add_argument("--players", type=int)
    p.add_argument("--learner-fraction", type=float, default=0.5)
    p.add_argument("--strategist-fraction", type=float, default=0.15)
    p.add_argument("--planner-fraction", type=float, default=0.0)
    p.add_argument("--planner-model")
    p.add_argument("--behavior-temperature", type=float, default=1.0)
    p.add_argument("--value-only", action="store_true")
    p.add_argument("--pool-size", type=int, default=16)
    p.add_argument("--pool", nargs="+")
    p.add_argument("--anchor", nargs="+")
    p.add_argument("--teacher")
    p.add_argument("--teacher-temperature", type=float, default=0.7)
    p.add_argument("--save-every", type=int, default=128)
    p.add_argument("--resume")
    p.add_argument("--restore", action="store_true")
    p.add_argument(
        "--stop-after",
        type=int,
        help="Stop at this iteration after saving a resumable checkpoint",
    )
    p.add_argument("--output", default="training/runs/v2-main")
    p.add_argument("--node", default="node")
    return p


if __name__ == "__main__":
    train(parser().parse_args())
