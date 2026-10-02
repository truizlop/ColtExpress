import { useState } from 'react';
import type { Character, GameConfig } from '../game/types';
import { CHARACTERS, CHARACTER_INFO } from '../game/data';
import type { Difficulty } from '../hooks/useGame';
import { Portrait } from './Portrait';
export const DIFFICULTIES: { id: Difficulty; name: string; description: string }[] = [
  {
    id: 'greenhorn',
    name: 'Greenhorn',
    description: 'A forgiving opponent with room to make mistakes.',
  },
  { id: 'bandit', name: 'Bandit', description: 'A trained opponent for a lively robbery.' },
  { id: 'outlaw', name: 'Outlaw', description: 'The trained policy at full concentration.' },
  {
    id: 'legend',
    name: 'Legend',
    description: 'The strongest available policy and extra planning.',
  },
];
export function Setup({
  onStart,
  status,
  onRetry,
}: {
  onStart: (c: GameConfig, d: Difficulty) => void;
  status: string;
  onRetry: () => void;
}) {
  const [character, setCharacter] = useState<Character>('cheyenne'),
    [partner, setPartner] = useState<Character>('tuco'),
    [opponents, setOpponents] = useState(3),
    [difficulty, setDifficulty] = useState<Difficulty>('bandit'),
    [expert, setExpert] = useState(false);
  const start = () => {
    const rest = CHARACTERS.filter((c) => c !== character && (opponents !== 1 || c !== partner));
    const chars =
      opponents === 1
        ? [character, partner, ...rest.slice(0, 2)]
        : [character, ...rest.slice(0, opponents)];
    onStart({ players: opponents + 1, characters: chars, expert }, difficulty);
  };
  return (
    <div className="setup-content">
      <p className="setup-intro">Five rounds. One train. The richest bandit wins.</p>
      <fieldset>
        <legend>Choose your bandit</legend>
        <div className="character-picker">
          {CHARACTERS.map((c) => (
            <button
              key={c}
              className={character === c ? 'chosen' : ''}
              aria-pressed={character === c}
              onClick={() => {
                setCharacter(c);
                if (c === partner) setPartner(CHARACTERS.find((x) => x !== c)!);
              }}
            >
              <Portrait character={c} />
              <span>{CHARACTER_INFO[c].name}</span>
            </button>
          ))}
        </div>
        <p className="character-power">
          <strong style={{ color: CHARACTER_INFO[character].color }}>
            {CHARACTER_INFO[character].name}
          </strong>{' '}
          · {CHARACTER_INFO[character].power}
        </p>
      </fieldset>
      <fieldset>
        <legend>AI opponents</legend>
        <div className="segmented">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-pressed={opponents === n}
              className={opponents === n ? 'chosen' : ''}
              onClick={() => setOpponents(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="field-note">
          {opponents === 1
            ? 'Duel: each player controls two bandits.'
            : `${opponents + 1} bandits aboard, each playing for themselves.`}
        </p>
      </fieldset>
      {opponents === 1 ? (
        <label className="field-row">
          Your partner
          <select value={partner} onChange={(e) => setPartner(e.target.value as Character)}>
            {CHARACTERS.filter((c) => c !== character).map((c) => (
              <option key={c} value={c}>
                {CHARACTER_INFO[c].name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <fieldset>
        <legend>Difficulty</legend>
        <div className="difficulty-picker">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={difficulty === d.id ? 'chosen' : ''}
              aria-pressed={difficulty === d.id}
              onClick={() => setDifficulty(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <p className="field-note">{DIFFICULTIES.find((d) => d.id === difficulty)!.description}</p>
      </fieldset>
      {opponents > 1 ? (
        <label className="checkbox-row">
          <input type="checkbox" checked={expert} onChange={(e) => setExpert(e.target.checked)} />
          <span>
            Expert deck rules<small>Keep cards between rounds and recycle your discard pile.</small>
          </span>
        </label>
      ) : null}
      {status === 'error' ? (
        <div role="alert" className="model-error">
          The trained AI could not load. <button onClick={onRetry}>Try again</button>
        </div>
      ) : null}
      <button className="primary board-button" onClick={start} disabled={status !== 'ready'}>
        {status === 'loading' ? 'Loading the trained bandits…' : 'Board the train'}
        <svg
          width="21"
          height="18"
          viewBox="0 0 24 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 10h18m-6-6 6 6-6 6" />
        </svg>
      </button>
      <p className="setup-footnote">Plays on your device. Your game saves automatically.</p>
    </div>
  );
}
