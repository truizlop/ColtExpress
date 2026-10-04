import type { Observation } from '../game/types';
import { infer, sample, type Model } from './network';
import { search } from './search';
import { plan, type PlannerOptions } from './planner';
export type Difficulty = 'greenhorn' | 'bandit' | 'outlaw' | 'legend';
export const PLANNING_BUDGETS = {
  outlaw: { worlds: 4, warmup: 2, finalists: 3, opponents: 'mixed' },
  legend: { worlds: 12, warmup: 4, finalists: 4, opponents: 'mixed' },
} as const satisfies Record<'outlaw' | 'legend', PlannerOptions>;
/** Shared by browser and benchmark: difficulty does not change access to information. */
export function difficultyChoice(
  model: Model,
  o: Observation,
  difficulty: Difficulty,
  rng: () => number,
  banditMistakes = 0.15,
) {
  if (o.legal.length < 2) return 0;
  if (model.featureVersion === 2) {
    if (difficulty === 'legend' || difficulty === 'outlaw')
      return plan(model, o, Math.floor(rng() * 2 ** 32), PLANNING_BUDGETS[difficulty]).index;
    if (difficulty === 'greenhorn' && rng() < 0.3) return Math.floor(rng() * o.legal.length);
    return sample(infer(model, o).logits, rng, difficulty === 'greenhorn' ? 1.5 : 0.25);
  }
  // Preserve the frozen Express64 profiles for reproducible historical benchmarks.
  if (difficulty === 'legend')
    return search(model, o, Math.floor(rng() * 2 ** 32), {
      samples: 8,
      maxCandidates: 3,
      rollout: 'policy',
      horizon: 'round',
    }).index;
  if (difficulty === 'bandit' && banditMistakes > 0 && rng() < banditMistakes)
    return Math.floor(rng() * o.legal.length);
  if (difficulty === 'greenhorn' && rng() < 0.3) return Math.floor(rng() * o.legal.length);
  return sample(
    infer(model, o).logits,
    rng,
    difficulty === 'greenhorn' ? 1.5 : difficulty === 'bandit' ? 0.5 : 0.08,
  );
}
