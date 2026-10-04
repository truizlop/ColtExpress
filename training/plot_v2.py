"""Plot development evidence without mixing player counts or claiming human strength."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from analyze_v2 import bootstrap

root = Path(__file__).resolve().parents[1]
out = root / "experiments/v2"
out.mkdir(exist_ok=True)
rng = np.random.default_rng(36129)
plt.rcParams.update(
    {"font.size": 10, "axes.spines.top": False, "axes.spines.right": False}
)
fig, axes = plt.subplots(
    1, 2, figsize=(13, 5.6), gridspec_kw={"width_ratios": [1.12, 1]}
)
fig.patch.set_facecolor("#faf8f3")
for ax in axes:
    ax.set_facecolor("#faf8f3")
    ax.grid(axis="y", color="#d8d4c9", linewidth=0.7)
    ax.set_axisbelow(True)
points = {}
for path in sorted((root / "training/runs/v2-checkpoints").glob("*.json")):
    report = json.loads(path.read_text())
    if "records" not in report:
        continue
    model = Path(report["config"]["candidate"]["model"])
    run = model.parent.name
    iteration = int(model.stem.split("-")[-1])
    label = {
        "v2-main-fast": "Larger model",
        "v2-main": "Larger model",
        "v2-control": "Longer-training control",
        "v2-planning-league": "Planning-opponent league",
        "v2-qtrace": "Action-value trace",
    }.get(run)
    if not label:
        continue
    batch = json.loads((root / "training/runs" / run / "config.json").read_text())[
        "batch"
    ]
    points.setdefault(label, {})[iteration * batch] = bootstrap(
        report["records"], "win", rng
    )
colors = ["#27604b", "#a4542a", "#426c8b", "#805d7e"]
for (label, values), color in zip(points.items(), colors):
    xs = sorted(values)
    ys = np.array([values[x]["mean"] for x in xs]) * 100
    limits = np.array([values[x]["ci95"] for x in xs]).T * 100
    axes[0].errorbar(
        np.array(xs) / 1000,
        ys,
        yerr=np.vstack([ys - limits[0], limits[1] - ys]),
        color=color,
        label=label,
        marker="o",
        capsize=2,
        linewidth=1.6,
        elinewidth=0.8,
    )
axes[0].axhline(
    24.1666667,
    color="#68655d",
    linestyle="--",
    linewidth=1,
    label="Released fast policy",
)
axes[0].set(
    title="Fast policy checkpoints",
    xlabel="Thousands of games after each branch's initialization",
    ylabel="Winning share (%)",
    ylim=(0, 65),
)
axes[0].legend(loc="upper right", fontsize=8, frameon=False)
variants = [
    ("release-legend", "Released Legend"),
    ("release-wide", "Wider old search"),
    ("release-plan12", "V1 model · new planner"),
    ("main128-hybrid12", "V2 model · V1 rollouts"),
    ("main128-plan12", "V2 model · V2 rollouts"),
    ("release-full12", "Full-game horizon"),
]
bars = []
for name, label in variants:
    path = root / f"training/runs/v2-arena/{name}.json"
    if path.exists():
        report = json.loads(path.read_text())
        bars.append((label, bootstrap(report["records"], "win", rng)))
for i, (label, result) in enumerate(bars):
    value = result["mean"] * 100
    lo, hi = np.array(result["ci95"]) * 100
    axes[1].barh(
        i,
        value,
        color="#27604b" if "V2" in label or "new planner" in label else "#ae9474",
        height=0.6,
    )
    axes[1].errorbar(
        value,
        i,
        xerr=[[value - lo], [hi - value]],
        color="#242820",
        capsize=3,
        linewidth=1,
    )
    axes[1].text(hi + 1, i, f"{value:.1f}%", va="center", fontsize=9)
axes[1].set_yticks(range(len(bars)), [x[0] for x in bars])
axes[1].invert_yaxis()
axes[1].set(title="Planning experiments", xlabel="Winning share (%)", xlim=(0, 70))
axes[1].axvline(23.75, color="#68655d", linestyle="--", linewidth=1)
fig.suptitle(
    "Colt Express AI · development evidence",
    fontsize=17,
    fontweight="bold",
    x=0.04,
    ha="left",
)
fig.text(
    0.04,
    0.9,
    "Fixed mixed league · 120 games per point · 3–6 players · 95% stratified bootstrap intervals",
    fontsize=10,
)
fig.text(
    0.04,
    0.035,
    "Development results guide selection; intervals do not correct for model selection. Branches have different starting models.\nThese are engine-opponent benchmarks, not human-strength evidence. Independent final holdouts remain separate.",
    fontsize=8.5,
    color="#57564f",
)
fig.subplots_adjust(top=0.8, bottom=0.2, left=0.07, right=0.97, wspace=0.68)
fig.savefig(out / "development-progress.png", dpi=170)
(out / "development-progress.json").write_text(
    json.dumps(
        {
            "fastPolicyCurves": points,
            "planning": dict(bars),
            "status": "development only",
        },
        indent=2,
    )
)
print(out / "development-progress.png")
