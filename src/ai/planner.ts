import type { Observation, GameState } from '../game/types';
import { applyAction, legalActions, observe } from '../game/engine';
import { seeded } from '../game/random';
import { infer, sample, softmax, type Model } from './network';
import { sampleWorld } from './search';
import { baseline, wealth } from './tactics';

export interface PlannerOptions {
  worlds?: number;
  warmup?: number;
  finalists?: number;
  maxCandidates?: number;
  opponents?: 'policy' | 'mixed';
  heuristicWeight?: number;
  priorWeight?: number;
  horizon?: 'round' | 'game';
  maxMilliseconds?: number;
}
/** All legal candidates receive paired samples before successive halving.
 * Rollout opponents keep a coherent style within each sampled world.
 * Inputs are strictly observations; sampling never reads the real hidden state.
 */
export function plan(
  model: Model,
  o: Observation,
  seed: number,
  options: PlannerOptions = {},
  rolloutModel: Model = model,
) {
  const start = performance.now(),
    rng = seeded(seed),
    prediction = infer(model, o),
    priors = softmax(prediction.logits, 0.5);
  const ranked = o.legal.map((_, i) => i).sort((a, b) => priors[b] - priors[a]);
  if (o.legal.length < 2 || !['scheme', 'cover', 'execute'].includes(o.phase))
    return {
      index: ranked[0] ?? 0,
      simulations: 0,
      milliseconds: performance.now() - start,
      estimates: [],
    };
  const limit = options.maxCandidates ?? 16;
  // On large punch/loot choice sets retain both policy and action-value suggestions.
  const qrank = prediction.qs
    ? ranked.slice().sort((a, b) => prediction.qs![b] - prediction.qs![a])
    : ranked;
  const candidates = [
    ...new Set([
      ...ranked.slice(0, Math.ceil(limit * 0.75)),
      ...qrank.slice(0, Math.floor(limit * 0.25)),
      ...ranked,
    ]),
  ].slice(0, limit);
  const stats = new Map(
    candidates.map((index) => [
      index,
      { index, total: 0, square: 0, samples: 0, prior: priors[index] },
    ]),
  );
  let active = [...candidates],
    simulations = 0;
  const worlds = options.worlds ?? 24,
    warmup = Math.min(worlds, options.warmup ?? 4);
  for (let worldIndex = 0; worldIndex < worlds; worldIndex++) {
    if (worldIndex === warmup)
      active.sort((a, b) => estimate(b) - estimate(a)).splice(options.finalists ?? 4);
    if (
      worldIndex >= warmup &&
      options.maxMilliseconds &&
      performance.now() - start > options.maxMilliseconds
    )
      break;
    const world = sampleWorld(o, Math.floor(rng() * 2 ** 32)),
      rollSeed = Math.floor(rng() * 2 ** 32);
    const styles = world.players.map((p) =>
      p.id === o.viewer || options.opponents === 'policy'
        ? 'policy'
        : ['policy', 'policy', 'policy', 'tactical', 'aggressive'][Math.floor(rng() * 5)],
    );
    for (const index of active) {
      const s = JSON.parse(JSON.stringify(world)) as GameState,
        rr = seeded(rollSeed);
      applyAction(s, o.legal[index], false);
      let value: number | undefined,
        steps = 0;
      while (s.phase !== 'finished' && steps++ < 1300) {
        if (
          options.horizon !== 'game' &&
          s.round > o.round &&
          s.actor === o.viewer &&
          ['scheme', 'cover', 'execute'].includes(s.phase)
        ) {
          const ob = observe(s, o.viewer, false),
            weight = options.heuristicWeight ?? 0;
          value =
            (1 - weight) * Math.max(0, Math.min(1, infer(model, ob).value)) +
            weight * materialChance(ob);
          break;
        }
        const actions = legalActions(s);
        let pick = 0;
        if (actions.length > 1) {
          const ob = observe(s, s.actor, false),
            style = styles[s.actor];
          if (style === 'policy') {
            const logits = infer(rolloutModel, ob).logits;
            pick =
              s.actor === o.viewer ? logits.indexOf(Math.max(...logits)) : sample(logits, rr, 0.3);
          } else pick = baseline(ob, style as 'tactical' | 'aggressive', rr);
        }
        applyAction(s, actions[pick], false);
      }
      if (value === undefined) {
        if (s.phase !== 'finished') throw new Error('Planner rollout did not finish');
        const win = s.winners.includes(o.viewer) ? 1 / s.winners.length : 0;
        const cash = softmax(s.scores, 500),
          mix = Number(model.metadata?.scoreMix ?? 0.1);
        value = (1 - mix) * win + mix * cash[o.viewer];
      }
      const stat = stats.get(index)!;
      stat.total += value;
      stat.square += value * value;
      stat.samples++;
      simulations++;
    }
  }
  function estimate(index: number) {
    const s = stats.get(index)!;
    return s.total / Math.max(1, s.samples) + (options.priorWeight ?? 0.015) * s.prior;
  }
  const estimates = [...stats.values()]
    .map((s) => ({
      index: s.index,
      value: estimate(s.index),
      samples: s.samples,
      standardError: Math.sqrt(
        Math.max(0, s.square / s.samples - (s.total / s.samples) ** 2) / s.samples,
      ),
      prior: s.prior,
      finalist: active.includes(s.index),
    }))
    .sort((a, b) => b.value - a.value);
  const index = active.sort((a, b) => estimate(b) - estimate(a))[0];
  return { index, simulations, milliseconds: performance.now() - start, estimates };
}
function materialChance(o: Observation) {
  const cash = o.players.map((p) =>
    o.bandits.filter((b) => b.controller === p.id).reduce((t, b) => t + wealth(b), 0),
  );
  const shots = o.players.map((p) =>
    o.bandits
      .filter((b) => b.controller === p.id)
      .reduce((t, b) => t + (o.team ? b.creditedShots : b.shots), 0),
  );
  const gun = softmax(shots, Math.max(0.3, (4 - o.round) * 0.5));
  return softmax(
    cash.map((v, i) => v + 1000 * gun[i]),
    650,
  )[o.viewer];
}
