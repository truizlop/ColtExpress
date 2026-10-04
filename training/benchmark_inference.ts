/** Compare the optimized inference with the original arithmetic on real observations. */
import fs from 'node:fs';
import { createGame, observe, applyAction, legalActions } from '../src/game/engine';
import { encodeV2 } from '../src/ai/features-v2';
import { encode } from '../src/ai/features';
import { baseline } from '../src/ai/tactics';
import { seeded } from '../src/game/random';
import { inferEncoded, validateModel, type Model, type Dense } from '../src/ai/network';
const model = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as Model;
validateModel(model);
function dense(layer: Dense, x: number[], activate = true) {
  return layer.weight.map((row, i) => {
    let t = layer.bias[i];
    for (let j = 0; j < row.length; j++) t += row[j] * x[j];
    return activate ? Math.tanh(t) : t;
  });
}
function reference(state: number[], actions: number[][]) {
  let h = dense(model.layers.state, state);
  if (model.layers.state2) h = dense(model.layers.state2, h);
  const joint = actions.map((a) => {
    let j = dense(model.layers.joint, [...h, ...dense(model.layers.action, a)]);
    if (model.layers.joint2) j = dense(model.layers.joint2, j);
    return j;
  });
  return {
    logits: joint.map((j) => dense(model.layers.policy, j, false)[0]),
    value: dense(
      model.layers.value,
      model.layers.valueHidden ? dense(model.layers.valueHidden, h) : h,
      false,
    )[0],
    ...(model.layers.q ? { qs: joint.map((j) => dense(model.layers.q!, j, false)[0]) } : {}),
  };
}
const probes: { state: number[]; actions: number[][] }[] = [];
const rng = seeded(71031);
for (let n = 2; n <= 6; n++) {
  const s = createGame({ players: n, seed: n * 523 + 94, expert: n % 2 === 0 });
  let step = 0;
  while (s.phase !== 'finished') {
    const o = observe(s, s.actor, false);
    if (step++ % 5 === 0) probes.push(model.featureVersion === 2 ? encodeV2(o) : encode(o));
    applyAction(s, legalActions(s)[baseline(o, 'tactical', rng)], false);
  }
}
let maxError = 0;
for (const p of probes) {
  const a = reference(p.state, p.actions),
    b = inferEncoded(model, p.state, p.actions);
  maxError = Math.max(
    maxError,
    Math.abs(a.value - b.value),
    ...a.logits.map((x, i) => Math.abs(x - b.logits[i])),
    ...(a.qs?.map((x, i) => Math.abs(x - b.qs![i])) ?? []),
  );
}
const measurements = { reference: [] as number[], optimized: [] as number[] };
for (let repetition = 0; repetition < 5; repetition++) {
  for (const key of repetition % 2
    ? (['optimized', 'reference'] as const)
    : (['reference', 'optimized'] as const)) {
    const start = performance.now();
    for (let i = 0; i < 5; i++)
      for (const p of probes) {
        if (key === 'reference') reference(p.state, p.actions);
        else inferEncoded(model, p.state, p.actions);
      }
    measurements[key].push((performance.now() - start) / (probes.length * 5));
  }
}
const median = (xs: number[]) => xs.sort((a, b) => a - b)[2];
const original = median(measurements.reference),
  optimized = median(measurements.optimized);
const report = {
  model: process.argv[2],
  probes: probes.length,
  maximumAbsoluteError: maxError,
  referenceMilliseconds: original,
  optimizedMilliseconds: optimized,
  speedup: original / optimized,
  measurements,
};
console.log(JSON.stringify(report, null, 2));
if (maxError > 1e-12) throw new Error('Inference arithmetic changed');
