import { useCallback, useEffect, useRef, useState } from 'react';
import { assertInvariants, createGame, legalActions, observe, step } from '../game/engine';
import type { Action, GameConfig, GameState } from '../game/types';
import type { Difficulty } from '../ai/difficulty';
import { completedMatch, newMatchTrace, type MatchTrace } from '../matchRecord';
export type { Difficulty } from '../ai/difficulty';
export interface Settings {
  difficulty: Difficulty;
  speed: 'normal' | 'fast';
  sound: boolean;
}
const SAVE_KEY = 'colt-express-save-v1';
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      saved.game.version !== 1 ||
      !['greenhorn', 'bandit', 'outlaw', 'legend'].includes(saved.settings.difficulty) ||
      !['normal', 'fast'].includes(saved.settings.speed) ||
      typeof saved.settings.sound !== 'boolean'
    )
      throw new Error();
    assertInvariants(saved.game);
    if (
      !saved.trace ||
      !Array.isArray(saved.trace.moves) ||
      saved.trace.moves.length > 1500 ||
      saved.trace.initial?.version !== 1
    )
      saved.trace = newMatchTrace(saved.game, false);
    return saved as { version: 1; game: GameState; settings: Settings; trace: MatchTrace };
  } catch {
    return null;
  }
}
export function useGame() {
  const [initial] = useState(load);
  const [game, setGame] = useState<GameState | null>(initial?.game ?? null),
    [settings, setSettings] = useState<Settings>(
      initial?.settings ?? { difficulty: 'bandit', speed: 'normal', sound: false },
    );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'),
    [error, setError] = useState(''),
    [saveError, setSaveError] = useState(''),
    [thinking, setThinking] = useState(false),
    [modelName, setModelName] = useState('');
  const worker = useRef<Worker | null>(null),
    request = useRef(0),
    latest = useRef(game),
    audio = useRef<AudioContext | null>(null),
    trace = useRef<MatchTrace | null>(initial?.trace ?? null);
  latest.current = game;
  const sound = useCallback(() => {
    if (!settings.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const osc = audio.current.createOscillator(),
        gain = audio.current.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, audio.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, audio.current.currentTime + 0.06);
      gain.gain.setValueAtTime(0.055, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.current.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(audio.current.destination);
      osc.start();
      osc.stop(audio.current.currentTime + 0.1);
    } catch {}
  }, [settings.sound]);
  const act = useCallback(
    (action: Action) => {
      const current = latest.current;
      if (!current) return;
      try {
        const next = step(current, action);
        trace.current ??= newMatchTrace(current, false);
        trace.current.moves.push({
          actor: current.actor,
          action: structuredClone(action),
          difficulty: settings.difficulty,
          modelVersion: import.meta.env.VITE_MODEL_VERSION,
        });
        request.current++;
        latest.current = next;
        setGame(next);
        setThinking(false);
        sound();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That action is no longer available.');
      }
    },
    [sound, settings.difficulty],
  );
  const actRef = useRef(act);
  actRef.current = act;
  const initWorker = useCallback(() => {
    worker.current?.terminate();
    request.current++;
    setStatus('loading');
    setError('');
    setThinking(false);
    const w = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        setStatus('ready');
        setModelName(data.name);
      } else if (data.type === 'error') {
        if (data.id === undefined || data.id === request.current) {
          setStatus('error');
          setError(data.message);
          setThinking(false);
        }
      } else if (data.type === 'action' && data.id === request.current) {
        actRef.current(data.action);
      }
    };
    w.onerror = () => {
      setStatus('error');
      setError('The AI worker stopped. Reload it to continue this game.');
      setThinking(false);
    };
    const modelUrl = new URL('models/champion.json', document.baseURI);
    modelUrl.searchParams.set('v', import.meta.env.VITE_MODEL_VERSION);
    w.postMessage({ type: 'init', url: modelUrl.href });
  }, []);
  useEffect(() => {
    initWorker();
    return () => {
      worker.current?.terminate();
      void audio.current?.close();
    };
  }, [initWorker]);
  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ version: 1, game, settings, trace: trace.current }),
      );
      setSaveError('');
    } catch {
      setSaveError('Your browser could not save this game. Keep this tab open to continue.');
    }
  }, [game, settings]);
  useEffect(() => {
    if (!game || game.phase === 'finished' || game.phase === 'roundEnd') return;
    const legal = legalActions(game),
      forced = legal.length === 1 && game.phase !== 'retain';
    if (!forced && game.actor === 0) return;
    if (!forced && status !== 'ready') return;
    const id = ++request.current;
    setThinking(!forced && game.actor !== 0);
    const delay = settings.speed === 'fast' ? 80 : game.phase === 'execute' ? 780 : 440;
    const timer = window.setTimeout(() => {
      if (request.current !== id) return;
      if (forced) actRef.current(legal[0]);
      else
        worker.current?.postMessage({
          type: 'act',
          id,
          observation: observe(game, game.actor),
          difficulty: settings.difficulty,
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      if (request.current === id) request.current++;
    };
  }, [game, status, settings.difficulty, settings.speed]);
  const start = useCallback((config: GameConfig, difficulty: Difficulty) => {
    request.current++;
    const next = createGame(config);
    trace.current = newMatchTrace(next, true);
    latest.current = next;
    setGame(next);
    setThinking(false);
    setSettings((s) => ({ ...s, difficulty }));
    setError('');
  }, []);
  const saveMatch = () => {
    const current = latest.current;
    if (!current || !trace.current) return;
    try {
      const record = completedMatch(trace.current, current);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `colt-express-match-${current.seed}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This match could not be saved.');
    }
  };
  return {
    game,
    settings,
    setSettings,
    status,
    error,
    setError,
    saveError,
    thinking,
    modelName,
    act,
    start,
    saveMatch,
    retry: initWorker,
  };
}
