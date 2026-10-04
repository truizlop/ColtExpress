"""Render the independently held-out release evidence without rerunning games."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parents[1]
analysis = json.loads((root / "experiments/v2/final-analysis.json").read_text())
reports = analysis["reports"]
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)
fig, axes = plt.subplots(1, 3, figsize=(12, 4.6), width_ratios=[1.55, 1.55, 0.85])
fig.patch.set_facecolor("#faf7f0")
for ax, report, title in zip(
    axes,
    reports,
    ["Standard decks · 480 games", "Expert decks · 240 games", "Teams · 120 games"],
):
    ax.set_facecolor("#faf7f0")
    rows = report["byPlayers"]
    n = np.array([int(k) for k in rows])
    mean = np.array([v["mean"] * 100 for v in rows.values()])
    low = np.array([v["ci95"][0] * 100 for v in rows.values()])
    high = np.array([v["ci95"][1] * 100 for v in rows.values()])
    x = np.arange(len(n))
    ax.errorbar(
        x,
        mean,
        yerr=[mean - low, high - mean],
        fmt="o",
        color="#246451",
        capsize=5,
        markersize=8,
        linewidth=2,
        label="Express128 Legend",
    )
    ax.scatter(
        x,
        100 / n,
        marker="_",
        s=420,
        linewidths=2.5,
        color="#9a5934",
        label="Equal-strength reference",
    )
    for xx, m, upper in zip(x, mean, high):
        ax.annotate(
            f"{m:.1f}%",
            (xx, upper),
            xytext=(0, 7),
            textcoords="offset points",
            ha="center",
            weight="bold",
            color="#246451",
        )
    ax.set_title(title, loc="left", weight="bold", pad=15)
    ax.set_xticks(x, [str(i) for i in n])
    ax.set_xlabel("Players")
    ax.set_ylim(0, 100)
    ax.set_xlim(-0.5, len(n) - 0.5)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter())
    ax.grid(axis="y", alpha=0.15)
    ax.set_axisbelow(True)
    ax.spines["left"].set_alpha(0.25)
    ax.spines["bottom"].set_alpha(0.25)
axes[0].set_ylabel("Winning share")
handles, labels = axes[0].get_legend_handles_labels()
fig.legend(
    handles,
    labels,
    loc="lower left",
    bbox_to_anchor=(0.065, 0.065),
    ncol=2,
    frameon=False,
)
fig.suptitle(
    "New Legend against tables of the previous Legend",
    x=0.065,
    y=0.98,
    ha="left",
    weight="bold",
    fontsize=17,
)
fig.text(
    0.065,
    0.90,
    "840 fresh games. Frozen model and settings. Error bars: 95% bootstrap intervals.",
    fontsize=10,
    color="#4c4943",
)
fig.text(
    0.065,
    0.025,
    "Ties split winning credit. The reference is mathematical, not a measured opponent. No human trial.",
    fontsize=9,
    color="#4c4943",
)
fig.subplots_adjust(left=0.07, right=0.99, top=0.76, bottom=0.24, wspace=0.27)
fig.savefig(
    root / "experiments/v2/final-results.png", dpi=180, facecolor=fig.get_facecolor()
)
