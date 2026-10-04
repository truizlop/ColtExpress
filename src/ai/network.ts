import { encode, FEATURE_VERSION, STATE_DIM, ACTION_DIM } from './features';
import { encodeV2, STATE_DIM_V2, ACTION_DIM_V2 } from './features-v2';
import type { Observation } from '../game/types';
export interface Dense {
  weight: number[][];
  bias: number[];
}
export interface Model {
  format: 'colt-policy-v1' | 'colt-policy-v2';
  featureVersion: number;
  stateDim: number;
  actionDim: number;
  name: string;
  steps: number;
  layers: {
    state: Dense;
    action: Dense;
    joint: Dense;
    policy: Dense;
    value: Dense;
    state2?: Dense;
    joint2?: Dense;
    valueHidden?: Dense;
    q?: Dense;
  };
  metadata?: Record<string, unknown>;
}
function dense(layer: Dense, x: number[], activate = true) {
  return layer.weight.map((row, i) => {
    let t = layer.bias[i];
    for (let j = 0; j < row.length; j++) t += row[j] * x[j];
    return activate ? Math.tanh(t) : t;
  });
}
/** Feature vectors are mostly zero. Preserve nonzero accumulation order exactly. */
function featureDense(layer: Dense, x: number[]) {
  const indices: number[] = [];
  for (let j = 0; j < x.length; j++) if (x[j] !== 0) indices.push(j);
  if (indices.length > x.length * 0.6) return dense(layer, x);
  return layer.weight.map((row, i) => {
    let t = layer.bias[i];
    for (let k = 0; k < indices.length; k++) {
      const j = indices[k];
      t += row[j] * x[j];
    }
    return Math.tanh(t);
  });
}
export function validateModel(m: Model) {
  if (
    !m ||
    !['colt-policy-v1', 'colt-policy-v2'].includes(m.format) ||
    m.featureVersion !== (m.format === 'colt-policy-v2' ? 2 : FEATURE_VERSION) ||
    m.stateDim !== (m.featureVersion === 2 ? STATE_DIM_V2 : STATE_DIM) ||
    m.actionDim !== (m.featureVersion === 2 ? ACTION_DIM_V2 : ACTION_DIM) ||
    !m.layers
  )
    throw new Error('Unsupported AI model.');
  const check = (l: Dense, inputs: number, outputs?: number) => {
    if (
      !l ||
      !Array.isArray(l.weight) ||
      !Array.isArray(l.bias) ||
      !l.weight.length ||
      l.weight.length > 512 ||
      l.weight.length !== l.bias.length ||
      (outputs !== undefined && l.weight.length !== outputs) ||
      l.bias.some((v) => !Number.isFinite(v)) ||
      l.weight.some(
        (r) => !Array.isArray(r) || r.length !== inputs || r.some((v) => !Number.isFinite(v)),
      )
    )
      throw new Error('Invalid model weights.');
    return l.weight.length;
  };
  const state = check(m.layers.state, m.stateDim),
    state2 = m.featureVersion === 2 ? check(m.layers.state2!, state) : state,
    action = check(m.layers.action, m.actionDim),
    joint = check(m.layers.joint, state2 + action),
    joint2 = m.featureVersion === 2 ? check(m.layers.joint2!, joint) : joint,
    valueHidden = m.featureVersion === 2 ? check(m.layers.valueHidden!, state2) : state2;
  check(m.layers.policy, joint2, 1);
  check(m.layers.value, valueHidden, 1);
  if (m.featureVersion === 2) check(m.layers.q!, joint2, 1);
}
export function inferEncoded(m: Model, state: number[], actions: number[][]) {
  let h = featureDense(m.layers.state, state);
  if (m.featureVersion === 2) h = dense(m.layers.state2!, h);
  // The state contribution is identical for every legal action. Sum it once,
  // then continue with the action contribution in the original arithmetic order.
  const layer = m.layers.joint;
  const shared = layer.weight.map((row, i) => {
    let t = layer.bias[i];
    for (let j = 0; j < h.length; j++) t += row[j] * h[j];
    return t;
  });
  const joint = actions.map((a) => {
    const encoded = featureDense(m.layers.action, a);
    let j = layer.weight.map((row, i) => {
      let t = shared[i];
      for (let k = 0; k < encoded.length; k++) t += row[h.length + k] * encoded[k];
      return Math.tanh(t);
    });
    if (m.featureVersion === 2) j = dense(m.layers.joint2!, j);
    return j;
  });
  return {
    logits: joint.map((j) => dense(m.layers.policy, j, false)[0]),
    value: dense(
      m.layers.value,
      m.featureVersion === 2 ? dense(m.layers.valueHidden!, h) : h,
      false,
    )[0],
    ...(m.featureVersion === 2 ? { qs: joint.map((j) => dense(m.layers.q!, j, false)[0]) } : {}),
  };
}
export function infer(m: Model, o: Observation) {
  const f = m.featureVersion === 2 ? encodeV2(o) : encode(o);
  return inferEncoded(m, f.state, f.actions);
}
export function softmax(logits: number[], temperature = 1) {
  const max = Math.max(...logits),
    ex = logits.map((x) => Math.exp((x - max) / Math.max(0.01, temperature))),
    sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / sum);
}
export function sample(logits: number[], rng: () => number = Math.random, temperature = 1) {
  const probs = softmax(logits, temperature);
  let r = rng();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}
export function modelChoice(
  m: Model,
  o: Observation,
  rng: () => number = Math.random,
  temperature = 0.15,
) {
  if (o.legal.length < 2) return 0;
  return sample(infer(m, o).logits, rng, temperature);
}
