import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { infer, validateModel, softmax, type Model } from '../src/ai/network';
import { createGame, observe, applyAction, legalActions } from '../src/game/engine';
const model = JSON.parse(
  readFileSync(new URL('../public/models/champion.json', import.meta.url), 'utf8'),
) as Model;
describe('Shipped trained model', () => {
  it('validates every layer and returns finite legal-action probabilities through complete games', () => {
    validateModel(model);
    for (const players of [2, 3, 4, 5, 6]) {
      const s = createGame({ players, expert: players % 2 === 0, seed: 9876 + players });
      let steps = 0;
      while (s.phase !== 'finished' && steps++ < 1500) {
        const o = observe(s, s.actor),
          prediction = infer(model, o);
        expect(prediction.logits).toHaveLength(o.legal.length);
        expect(prediction.logits.every(Number.isFinite)).toBe(true);
        expect(Number.isFinite(prediction.value)).toBe(true);
        const p = softmax(prediction.logits, 0.1);
        expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        applyAction(s, legalActions(s)[prediction.logits.indexOf(Math.max(...prediction.logits))]);
      }
      expect(s.phase).toBe('finished');
    }
  }, 30000);
  it('rejects incompatible dimensions and non-finite biases before inference', () => {
    const bad = structuredClone(model);
    bad.layers.state.weight[0].pop();
    expect(() => validateModel(bad)).toThrow('Invalid model weights');
    const nan = structuredClone(model);
    nan.layers.policy.bias[0] = NaN;
    expect(() => validateModel(nan)).toThrow('Invalid model weights');
  });
});
