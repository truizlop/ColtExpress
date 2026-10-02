import { useEffect, useRef, useState } from 'react';
import type { Observation } from '../game/types';
import { ACTION_KINDS } from '../game/types';
import { CHARACTER_INFO, ACTION_INFO } from '../game/data';
export function ProgramQueue({ o }: { o: Observation }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:700px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width:700px)');
    const change = () => setMobile(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  const Heading = mobile ? 'button' : 'div';
  const [expanded, setExpanded] = useState(true),
    ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const current = el.querySelector('.resolving');
      if (current) {
        const item = current as HTMLElement;
        el.scrollTop = item.offsetTop - el.offsetTop - el.clientHeight / 2 + item.clientHeight / 2;
        el.scrollLeft = item.offsetLeft - el.offsetLeft - el.clientWidth / 2 + item.clientWidth / 2;
      } else {
        el.scrollTop = el.scrollHeight;
        el.scrollLeft = el.scrollWidth;
      }
    }
  }, [o.queue.length, o.executionIndex]);
  return (
    <aside className={'program-panel ' + (expanded ? 'expanded' : '')}>
      <Heading
        className="program-heading"
        onClick={mobile ? () => setExpanded((v) => !v) : undefined}
        aria-expanded={mobile ? expanded : undefined}
      >
        <h2>The plan</h2>
        <span>
          {o.queue.length} cards{' '}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d={expanded ? 'm3 10 5-5 5 5' : 'm3 6 5 5 5-5'} />
          </svg>
        </span>
      </Heading>
      <ol ref={ref} className="program-list">
        {o.queue.length ? (
          o.queue.map((q, i) => {
            const b = q.bandit === null ? null : o.bandits[q.bandit],
              resolved = i < o.executionIndex && o.phase !== 'scheme' && o.phase !== 'cover',
              active = o.phase === 'execute' && i === o.executionIndex;
            return (
              <li key={i} className={(resolved ? 'resolved ' : '') + (active ? 'resolving' : '')}>
                <span className="queue-number">{i + 1}</span>
                <svg
                  className="queue-marker"
                  viewBox="0 0 24 32"
                  aria-hidden="true"
                  style={{ color: b ? CHARACTER_INFO[b.character].color : '#947d59' }}
                >
                  <path
                    fill="currentColor"
                    stroke="#392e23"
                    strokeWidth="1.2"
                    d="M8 1h8l2 7 4 2v3H2v-3l4-2zm-2 13h12l5 9-5 2-1-5 1 11h-5l-1-6-1 6H6l1-11-1 5-5-2z"
                  />
                </svg>
                <span className="queue-owner">
                  {b ? CHARACTER_INFO[b.character].name : `Player ${q.controller + 1}`}
                </span>
                <span
                  className={'queue-action ' + (q.kind === null ? 'concealed' : '')}
                  aria-label={q.kind ? ACTION_INFO[q.kind].name : 'Face-down card'}
                >
                  {q.kind ? (
                    <>
                      <strong>{ACTION_INFO[q.kind].name}</strong>
                      <span
                        className="action-art"
                        style={{
                          backgroundPosition: `${(ACTION_KINDS.indexOf(q.kind) % 3) * 50}% ${Math.floor(ACTION_KINDS.indexOf(q.kind) / 3) * 100}%`,
                        }}
                      />
                    </>
                  ) : (
                    <span className="sr-only">Face down</span>
                  )}
                  {q.hidden && q.kind !== null && !q.revealed ? <small>hidden</small> : null}
                </span>
              </li>
            );
          })
        ) : (
          <li className="queue-empty">The first card starts the plan.</li>
        )}
      </ol>
      <p className="queue-note">
        Cards resolve in this order. Face-down cards stay secret until their turn.
      </p>
    </aside>
  );
}
