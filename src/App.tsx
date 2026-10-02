import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGame } from './hooks/useGame';
import { createGame, observe } from './game/engine';
import { CHARACTER_INFO, EVENT_INFO } from './game/data';
import { Modal } from './components/Modal';
import { Setup, DIFFICULTIES } from './components/Setup';
import { PlayerRail } from './components/PlayerRail';
import { ProgramQueue } from './components/ProgramQueue';
import { TurnControls } from './components/TurnControls';
import { Portrait } from './components/Portrait';
import { TrainManifest } from './components/TrainManifest';
import { Rules } from './components/Rules';
import type { GameConfig, Observation } from './game/types';
import type { Difficulty } from './hooks/useGame';
const TrainScene = lazy(() => import('./scene/TrainScene'));
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <h2>The 3D train could not start</h2>
        <p>
          You can still play using the action controls below. Try reloading if your browser supports
          WebGL.
        </p>
        <button onClick={() => this.setState({ failed: false })}>Retry 3D view</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const g = useGame();
  const preview = useMemo(
    () =>
      createGame({
        players: 4,
        characters: ['cheyenne', 'django', 'belle', 'tuco'],
        seed: 723,
        firstPlayer: 0,
        carProfiles: [5, 3, 1, 4],
      }),
    [],
  );
  const o = useMemo(() => observe(g.game ?? preview, 0), [g.game, preview]),
    [help, setHelp] = useState(false),
    [newGame, setNewGame] = useState(false),
    [showSetup, setShowSetup] = useState(false),
    [menu, setMenu] = useState(false),
    [history, setHistory] = useState(false),
    [roundInfo, setRoundInfo] = useState(false),
    [manifest, setManifest] = useState(false),
    [focus, setFocus] = useState(() =>
      window.innerWidth < 700 ? o.bandits.find((b) => b.controller === 0)!.car : -1,
    );
  useEffect(() => {
    const query = window.matchMedia('(max-width:700px)');
    const change = () =>
      setFocus(query.matches ? o.bandits.find((b) => b.controller === 0)!.car : -1);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, [o.bandits]);
  const setup = !g.game || showSetup;
  const start = (config: GameConfig, difficulty: Difficulty) => {
    g.start(config, difficulty);
    setShowSetup(false);
    setFocus(window.innerWidth < 700 ? (config.players === 2 ? 3 : config.players) : -1);
  };
  useEffect(() => {
    if (window.innerWidth >= 700) return;
    const q = o.queue[o.executionIndex];
    if (o.phase === 'execute' && q?.bandit !== null && q?.bandit !== undefined)
      setFocus(o.bandits[q.bandit].car);
  }, [o.phase, o.executionIndex, o.round]);
  const chooseSpace = (car: number, floor: 0 | 1) => {
    setFocus(car);
    if (o.actor !== 0 || o.phase !== 'execute') return;
    const bid = o.queue[o.executionIndex]?.bandit;
    if (bid === null || bid === undefined) return;
    const b = o.bandits[bid];
    const action = o.legal.find(
      (a) =>
        (a.kind === 'move' && a.to === car && b.floor === floor) ||
        (a.kind === 'marshal' && a.to === car && floor === 0),
    );
    if (action) g.act(action);
  };
  const slot = o.schedule[o.scheduleIndex],
    turn = slot ? o.roundCard.turns[slot.turn] : null;
  const event = EVENT_INFO[o.roundCard.event];
  return (
    <main className="game-shell">
      <header className="topbar">
        <a
          href="#"
          className="wordmark"
          onClick={(e) => e.preventDefault()}
          aria-label="Colt Express"
        >
          Colt Express
          <span className="wordmark-track" />
        </a>
        <nav aria-label="Game menu">
          <button onClick={() => setNewGame(true)}>New game</button>
          <button onClick={() => setHelp(true)}>How to play</button>
          <button
            className="sound-button"
            aria-label={g.settings.sound ? 'Sound off' : 'Sound on'}
            aria-pressed={g.settings.sound}
            onClick={() => g.setSettings((s) => ({ ...s, sound: !s.sound }))}
          >
            <SoundIcon on={g.settings.sound} />
          </button>
          <button className="mobile-menu" aria-label="Open game menu" onClick={() => setMenu(true)}>
            <svg
              width="23"
              height="20"
              viewBox="0 0 24 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M2 3h20M2 10h20M2 17h20" />
            </svg>
          </button>
        </nav>
      </header>
      <PlayerRail o={o} />
      <div className="round-strip">
        <button
          className="round-title"
          aria-label="Round details"
          onClick={() => setRoundInfo(true)}
        >
          <span>
            Round <b>{o.round + 1}</b> / 5
          </span>
          <strong>
            {o.phase === 'scheme' ||
            o.phase === 'cover' ||
            o.phase === 'choose' ||
            o.phase === 'retain'
              ? 'Schemin’'
              : o.phase === 'finished'
                ? 'End of the line'
                : 'Stealin’'}
          </strong>
        </button>
        <div className="round-turns" aria-label="This round’s turns">
          {o.roundCard.turns.map((t, i) => (
            <span
              key={i}
              className={
                'turn-symbol ' +
                (i === slot?.turn && (o.phase === 'scheme' || o.phase === 'cover')
                  ? 'active '
                  : '') +
                (t === 'tunnel' ? 'tunnel' : '')
              }
              title={
                t === 'double'
                  ? 'Speeding up: two turns'
                  : t === 'reverse'
                    ? 'Switching: reverse order'
                    : t === 'tunnel'
                      ? 'Tunnel: face down'
                      : 'Standard: face up'
              }
              aria-label={t}
            >
              <TurnSymbol type={t} />
              <small>{i + 1}</small>
            </span>
          ))}
        </div>
        <div className="round-event">
          <span>At round’s end</span>
          <strong>{event.name}</strong>
        </div>
        <button
          className="log-button"
          aria-label="Open game history"
          onClick={() => setHistory(true)}
        >
          <svg
            width="18"
            height="19"
            viewBox="0 0 20 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3 2h14v18H3zM6 6h8M6 10h8M6 14h5" />
          </svg>
          <span>History</span>
        </button>
      </div>
      {g.error ? (
        <div className="error-banner" role="alert">
          <span>{g.error}</span>
          <button onClick={g.retry}>Reload AI</button>
          <button aria-label="Dismiss error" onClick={() => g.setError('')}>
            ×
          </button>
        </div>
      ) : null}
      {g.saveError ? (
        <div className="error-banner" role="status">
          {g.saveError}
        </div>
      ) : null}
      <div className="play-surface">
        <SceneBoundary>
          <Suspense
            fallback={
              <div className="scene-loading">
                <span>Assembling the train…</span>
              </div>
            }
          >
            <TrainScene
              observation={o}
              focus={focus}
              onFocus={setFocus}
              onChoose={chooseSpace}
              onInspect={() => setManifest(true)}
            />
          </Suspense>
        </SceneBoundary>
        <ProgramQueue o={o} />
      </div>
      {o.phase === 'roundEnd' ? (
        <section className="round-complete">
          <div>
            <span className="station-rule" />
            <h2>Round {o.round + 1} complete</h2>
            <p>
              <strong>{event.name}.</strong> {event.description}
            </p>
          </div>
          <button className="primary" onClick={() => g.act({ kind: 'continue' })}>
            Begin round {o.round + 2}
          </button>
        </section>
      ) : o.phase === 'finished' ? (
        <Results o={o} onNew={() => setShowSetup(true)} />
      ) : (
        <TurnControls o={o} onAction={g.act} thinking={g.thinking} status={g.status} />
      )}
      <footer className="game-footer">
        <span>
          {DIFFICULTIES.find((d) => d.id === g.settings.difficulty)?.name} opponents
          {g.game?.config.expert ? ' · Expert decks' : ''}
        </span>
        <label>
          Playback
          <select
            aria-label="Playback speed"
            value={g.settings.speed}
            onChange={(e) =>
              g.setSettings((s) => ({ ...s, speed: e.target.value as 'normal' | 'fast' }))
            }
          >
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <span className="fan-credit">An unofficial fan game · Original app artwork</span>
      </footer>
      {setup ? (
        <Modal
          dismissible={!!g.game}
          title="Plan your heist"
          className="setup-dialog"
          onClose={() => {
            if (g.game) setShowSetup(false);
          }}
        >
          <Setup onStart={start} status={g.status} onRetry={g.retry} />
        </Modal>
      ) : null}
      {manifest ? (
        <Modal title="Aboard the train" onClose={() => setManifest(false)}>
          <TrainManifest o={o} />
        </Modal>
      ) : null}
      {roundInfo ? (
        <Modal
          title={`Round ${o.round + 1} · ${o.roundCard.name}`}
          onClose={() => setRoundInfo(false)}
        >
          <div className="rules-content">
            <p>
              {o.roundCard.turns
                .map((t) =>
                  t === 'normal'
                    ? 'Face up'
                    : t === 'tunnel'
                      ? 'Face down'
                      : t === 'double'
                        ? 'Two turns each'
                        : 'Reverse order',
                )
                .join(' → ')}
            </p>
            <h3>At the end of this round</h3>
            <p>
              <strong>{event.name}.</strong> {event.description}
            </p>
          </div>
        </Modal>
      ) : null}
      {help ? (
        <Modal title="How to play" onClose={() => setHelp(false)}>
          <Rules />
        </Modal>
      ) : null}
      {newGame ? (
        <Modal title="Start a new heist?" onClose={() => setNewGame(false)}>
          <p>This will replace the game saved in this browser.</p>
          <div className="dialog-actions">
            <button onClick={() => setNewGame(false)}>Keep playing</button>
            <button
              className="primary"
              onClick={() => {
                setNewGame(false);
                setShowSetup(true);
              }}
            >
              Set up new game
            </button>
          </div>
        </Modal>
      ) : null}
      {menu ? (
        <Modal title="Game menu" onClose={() => setMenu(false)}>
          <div className="menu-options">
            <button
              onClick={() => {
                setMenu(false);
                setHelp(true);
              }}
            >
              How to play
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setNewGame(true);
              }}
            >
              New game
            </button>
            <button onClick={() => g.setSettings((s) => ({ ...s, sound: !s.sound }))}>
              Sound {g.settings.sound ? 'off' : 'on'}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setHistory(true);
              }}
            >
              Game history
            </button>
          </div>
        </Modal>
      ) : null}
      {history ? (
        <Modal title="The story so far" onClose={() => setHistory(false)}>
          <ol className="history-list">
            {o.log.map((l) => (
              <li key={l.id}>
                <span>R{l.round + 1}</span>
                {l.text}
              </li>
            ))}
          </ol>
        </Modal>
      ) : null}
    </main>
  );
}
function Results({ o, onNew }: { o: Observation; onNew: () => void }) {
  const order = o.players.map((p) => p.id).sort((a, b) => o.scores[b] - o.scores[a]),
    winnerNames = o.winners.map((p) =>
      o.bandits
        .filter((b) => b.controller === p)
        .map((b) => CHARACTER_INFO[b.character].name)
        .join(' & '),
    );
  return (
    <section className="results">
      <h2>
        {o.winners.includes(0)
          ? 'You pulled off the heist.'
          : `${winnerNames.join(' and ')} ${o.winners.length > 1 ? 'share the win' : 'wins the heist'}.`}
      </h2>
      <p>The final haul, including the $1,000 Gunslinger prize.</p>
      <ol>
        {order.map((p, i) => {
          const bs = o.bandits.filter((b) => b.controller === p);
          return (
            <li key={p} className={o.winners.includes(p) ? 'winner' : ''}>
              <b>{i + 1}</b>
              <Portrait character={bs[0].character} />
              <span>
                {bs.map((b) => CHARACTER_INFO[b.character].name).join(' & ')}
                {p === 0 ? ' (you)' : ''}
                <small>
                  {bs.reduce((n, b) => n + b.shots, 0)} shots ·{' '}
                  {bs.reduce((n, b) => n + b.wounds, 0)} wounds
                </small>
              </span>
              <strong>${o.scores[p].toLocaleString()}</strong>
            </li>
          );
        })}
      </ol>
      <button className="primary" onClick={onNew}>
        Another heist
      </button>
    </section>
  );
}
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="24"
      height="22"
      viewBox="0 0 26 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 9h4l6-5v16l-6-5H3z" fill="currentColor" />
      {on ? (
        <>
          <path d="M17 8q5 4 0 8M20 4q9 8 0 16" />
        </>
      ) : (
        <path d="m18 9 6 6m0-6-6 6" />
      )}
    </svg>
  );
}
function TurnSymbol({ type }: { type: string }) {
  return (
    <svg
      width="24"
      height="23"
      viewBox="0 0 26 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {type === 'tunnel' ? (
        <>
          <path d="M3 22V11a10 10 0 0 1 20 0v11h-6V11a4 4 0 0 0-8 0v11z" fill="currentColor" />
          <path d="M10 17h6M10 21h6" />
        </>
      ) : type === 'double' ? (
        <>
          <rect x="1" y="3" width="11" height="18" rx="1" />
          <rect x="14" y="3" width="11" height="18" rx="1" />
        </>
      ) : type === 'reverse' ? (
        <>
          <path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6" />
        </>
      ) : (
        <rect x="5" y="3" width="16" height="19" rx="1" />
      )}
    </svg>
  );
}
