import { validateModel, type Model } from './network';
import { difficultyChoice, type Difficulty } from './difficulty';
import type { Observation } from '../game/types';
let model: Model | null = null;
self.onmessage = async ({
  data,
}: {
  data: {
    type: string;
    url?: string;
    id?: number;
    observation?: Observation;
    difficulty?: Difficulty;
  };
}) => {
  try {
    if (data.type === 'init') {
      const response = await fetch(data.url!);
      if (!response.ok) throw new Error('The trained model could not be downloaded.');
      const loaded = (await response.json()) as Model;
      validateModel(loaded);
      model = loaded;
      self.postMessage({
        type: 'ready',
        name: model.name,
        steps: model.steps,
        metadata: model.metadata,
      });
    } else if (data.type === 'act') {
      if (!model) throw new Error('The trained model is not ready.');
      const o = data.observation!;
      const difficulty = data.difficulty ?? 'bandit';
      const index = difficultyChoice(model, o, difficulty, Math.random);
      self.postMessage({ type: 'action', id: data.id, action: o.legal[index] });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: data.id,
      message:
        data.type === 'init'
          ? 'The trained bandits could not load. Check your connection and try reloading the AI.'
          : error instanceof Error
            ? error.message
            : 'The AI could not choose a move.',
    });
  }
};
