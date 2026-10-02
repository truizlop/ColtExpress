import {
  ACTION_KINDS,
  type Action,
  type Card,
  type GameConfig,
  type GameState,
  type Loot,
  type Observation,
  type Bandit,
} from './types';
import {
  CHARACTERS,
  CHARACTER_INFO,
  CAR_PROFILES,
  PURSE_VALUES,
  SMALL_ROUNDS,
  LARGE_ROUNDS,
  STATIONS,
  EVENT_INFO,
  ACTION_INFO,
} from './data';
import { shuffle, random } from './random';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const cloneGame = (s: GameState): GameState => clone(s);
export const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);
const name = (s: GameState, b: number) => CHARACTER_INFO[s.bandits[b].character].name;
const has = (s: GameState, p: number, c: string) =>
  s.bandits.some((b) => b.controller === p && b.character === c);
function log(s: GameState, text: string, bandit?: number, action?: string) {
  s.log.push({ id: s.logId++, round: s.round, text, bandit, action });
  if (s.log.length > 180) s.log.shift();
}
function card(s: GameState, kind: Card['kind'], bandit: number, source?: number): Card {
  return { id: s.nextId++, kind, bandit, ...(source === undefined ? {} : { source }) };
}
function token(s: GameState, kind: Loot['kind'], value: number): Loot {
  return { id: s.nextId++, kind, value };
}
export function createGame(config: GameConfig): GameState {
  const n = config.players;
  if (!Number.isInteger(n) || n < 2 || n > 6) throw new Error('Choose 2 to 6 players.');
  const team = n === 2,
    count = team ? 4 : n,
    seed = (config.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  const s: GameState = {
    version: 1,
    rng: seed,
    seed,
    config: { players: n, expert: team ? false : !!config.expert },
    team,
    players: [],
    bandits: [],
    cars: [],
    marshal: 0,
    neutralBullets: 13,
    rounds: [],
    round: 0,
    firstPlayer: 0,
    phase: team ? 'choose' : 'scheme',
    actor: 0,
    schedule: [],
    scheduleIndex: 0,
    queue: [],
    executionIndex: 0,
    coverBandit: -1,
    selectionIndex: 0,
    eventBandits: [],
    eventIndex: 0,
    nextId: 1,
    log: [],
    logId: 0,
    winners: [],
    scores: [],
    keepCards: [],
  };
  const chars = config.characters ?? shuffle(s, [...CHARACTERS]).slice(0, count);
  if (
    chars.length !== count ||
    new Set(chars).size !== count ||
    chars.some((c) => !CHARACTERS.includes(c))
  )
    throw new Error('Each bandit must be a unique character.');
  s.firstPlayer = config.firstPlayer ?? Math.floor(random(s) * n);
  if (s.firstPlayer < 0 || s.firstPlayer >= n) throw new Error('Invalid first player.');
  for (let i = 0; i < n; i++)
    s.players.push({ id: i, hand: [], deck: [], discard: [], knownLoot: {}, firstTurnUsed: false });
  const purseValues = [...PURSE_VALUES];
  for (let i = 0; i < count; i++) {
    const controller = team ? Math.floor(i / 2) : i;
    const purse = token(s, 'purse', 250);
    purseValues.splice(purseValues.indexOf(250), 1);
    // Starting purses are public knowledge, despite their face-down orientation.
    for (const p of s.players) p.knownLoot[purse.id] = 250;
    s.bandits.push({
      id: i,
      controller,
      character: chars[i],
      car: 0,
      floor: 0,
      loot: [purse],
      shots: 0,
      creditedShots: 0,
      wounds: 0,
    });
    const kinds = team
      ? [...ACTION_KINDS].filter((k) => !(k === 'marshal' && i % 2 === 1))
      : ([
          'move',
          'move',
          'climb',
          'climb',
          'shoot',
          'shoot',
          'punch',
          'loot',
          'loot',
          'marshal',
        ] as Card['kind'][]);
    s.players[controller].deck.push(...kinds.map((k) => card(s, k, i)));
  }
  const carCount = team ? 3 : n;
  const profiles =
    config.carProfiles ??
    shuffle(
      s,
      CAR_PROFILES.map((_, i) => i),
    ).slice(0, carCount);
  if (
    profiles.length !== carCount ||
    new Set(profiles).size !== carCount ||
    profiles.some((i) => !CAR_PROFILES[i])
  )
    throw new Error('Invalid train cars.');
  s.cars.push({ profile: -1, loot: [[token(s, 'strongbox', 1000)], []] });
  shuffle(s, purseValues);
  for (const profile of profiles) {
    const p = CAR_PROFILES[profile],
      loot: Loot[] = [];
    for (let j = 0; j < p.purses; j++) {
      const value = purseValues.pop();
      if (value === undefined) throw new Error('Purse supply exhausted.');
      loot.push(token(s, 'purse', value));
    }
    for (let j = 0; j < p.jewels; j++) loot.push(token(s, 'jewel', 500));
    s.cars.push({ profile, loot: [loot, []] });
  }
  for (const b of s.bandits)
    b.car = team
      ? carCount - (b.id % 2)
      : carCount - (((b.controller - s.firstPlayer + n) % n) % 2);
  s.rounds = [
    ...shuffle(s, clone(n <= 4 ? SMALL_ROUNDS : LARGE_ROUNDS)).slice(0, 4),
    clone(STATIONS[Math.floor(random(s) * STATIONS.length)]),
  ];
  startRound(s);
  return s;
}
function draw(s: GameState, pid: number, n: number) {
  const p = s.players[pid];
  for (let i = 0; i < n; i++) {
    if (!p.deck.length && s.config.expert && p.discard.length)
      p.deck = shuffle(s, p.discard.splice(0));
    const c = p.deck.pop();
    if (!c) break;
    p.hand.push(c);
  }
}
function makeSchedule(s: GameState) {
  s.schedule = [];
  s.rounds[s.round].turns.forEach((kind, turn) => {
    for (let i = 0; i < s.players.length; i++) {
      const controller =
        (s.firstPlayer + (kind === 'reverse' ? -i : i) + s.players.length) % s.players.length;
      for (let repeat = 0; repeat < (kind === 'double' ? 2 : 1); repeat++)
        s.schedule.push({ controller, turn, repeat });
    }
  });
  s.scheduleIndex = 0;
  s.actor = s.schedule[0].controller;
}
function startRound(s: GameState) {
  s.queue = [];
  s.executionIndex = 0;
  s.coverBandit = -1;
  s.selectionIndex = 0;
  s.eventBandits = [];
  s.eventIndex = 0;
  for (const p of s.players) {
    p.firstTurnUsed = false;
    if (!s.config.expert) {
      p.deck.push(...p.hand.splice(0), ...p.discard.splice(0));
      shuffle(s, p.deck);
    }
  }
  makeSchedule(s);
  log(s, `Round ${s.round + 1}: ${s.rounds[s.round].name}.`);
  if (s.team) {
    s.phase = 'choose';
    s.actor = s.firstPlayer;
  } else {
    for (const p of s.players)
      draw(s, p.id, Math.max(0, (has(s, p.id, 'doc') ? 7 : 6) - p.hand.length));
    s.phase = 'scheme';
  }
}
export function activeBandit(s: GameState): number {
  if (s.phase === 'execute') return s.queue[s.executionIndex]?.card.bandit ?? -1;
  if (s.phase === 'event') return s.eventBandits[s.eventIndex] ?? -1;
  return s.bandits.find((b) => b.controller === s.actor)?.id ?? -1;
}
function adjacent(s: GameState, car: number): number[] {
  return [car - 1, car + 1].filter((c) => c >= 0 && c < s.cars.length);
}
export function targets(s: GameState, bid: number, kind: 'shoot' | 'punch'): Bandit[] {
  const b = s.bandits[bid];
  let ts: Bandit[] = [];
  if (kind === 'punch')
    ts = s.bandits.filter((t) => t.id !== bid && t.car === b.car && t.floor === b.floor);
  else if (b.shots < 6) {
    ts = s.bandits.filter((t) => {
      if (t.id === bid) return false;
      if (b.character === 'tuco' && t.car === b.car && t.floor !== b.floor) return true;
      if (t.floor !== b.floor || t.car === b.car) return false;
      if (b.floor === 0) return Math.abs(t.car - b.car) === 1;
      return !s.bandits.some(
        (x) =>
          x.id !== bid &&
          x.floor === 1 &&
          Math.sign(x.car - b.car) === Math.sign(t.car - b.car) &&
          Math.abs(x.car - b.car) > 0 &&
          Math.abs(x.car - b.car) < Math.abs(t.car - b.car),
      );
    });
  }
  if (ts.length > 1) ts = ts.filter((t) => t.character !== 'belle');
  return ts;
}
export function legalActions(s: GameState): Action[] {
  const p = s.players[s.actor];
  if (s.phase === 'finished') return [];
  if (s.phase === 'roundEnd') return [{ kind: 'continue' }];
  if (s.phase === 'choose')
    return p.deck
      .filter((c, i, a) => a.findIndex((x) => x.kind === c.kind && x.bandit === c.bandit) === i)
      .map((c) => ({ kind: 'choose', card: c.id }));
  if (s.phase === 'retain') {
    const c = p.hand[0];
    return c
      ? [
          { kind: 'keep', card: c.id },
          { kind: 'discard', card: c.id },
        ]
      : [{ kind: 'continue' }];
  }
  if (s.phase === 'scheme' || s.phase === 'cover') {
    const slot = s.schedule[s.scheduleIndex],
      turn = s.rounds[s.round].turns[slot.turn],
      hidden = turn === 'tunnel';
    const ghost = !p.firstTurnUsed && has(s, p.id, 'ghost');
    const out: Action[] = s.phase === 'cover' ? [{ kind: 'pass' }] : [{ kind: 'draw' }];
    for (const c of p.hand) {
      if (
        c.kind === 'bullet' ||
        (s.phase === 'cover' && (c.bandit === s.coverBandit || c.kind === 'marshal'))
      )
        continue;
      if (
        out.some(
          (a) =>
            a.kind === 'play' &&
            p.hand.find((x) => x.id === a.card)?.kind === c.kind &&
            p.hand.find((x) => x.id === a.card)?.bandit === c.bandit,
        )
      )
        continue;
      out.push({ kind: 'play', card: c.id, hidden });
      if (ghost && !hidden && s.phase === 'scheme')
        out.push({ kind: 'play', card: c.id, hidden: true });
    }
    return out;
  }
  const b = s.bandits[activeBandit(s)];
  if (!b) return [{ kind: 'continue' }];
  if (s.phase === 'event')
    return [
      { kind: 'pass' },
      ...s.cars[b.car].loot[b.floor]
        .filter((l) => l.kind === 'purse')
        .map((l) => ({ kind: 'loot' as const, loot: l.id })),
    ];
  const kind = s.queue[s.executionIndex].card.kind;
  let out: Action[] = [];
  if (kind === 'move') {
    for (let to = 0; to < s.cars.length; to++)
      if (to !== b.car && Math.abs(to - b.car) <= (b.floor ? 3 : 1)) out.push({ kind: 'move', to });
  }
  if (kind === 'climb') out = [{ kind: 'climb' }];
  if (kind === 'shoot')
    out = targets(s, b.id, 'shoot').map((t) => ({ kind: 'shoot', target: t.id }));
  if (kind === 'marshal') out = adjacent(s, s.marshal).map((to) => ({ kind: 'marshal', to }));
  if (kind === 'loot') out = s.cars[b.car].loot[b.floor].map((l) => ({ kind: 'loot', loot: l.id }));
  if (kind === 'punch')
    for (const t of targets(s, b.id, 'punch'))
      for (const to of adjacent(s, t.car))
        for (const loot of t.loot.length ? t.loot.map((l) => l.id) : [null])
          out.push({ kind: 'punch', target: t.id, to, loot });
  return out.length ? out : [{ kind: 'pass' }];
}
function neutral(s: GameState, bids: number[]) {
  if (bids.length > s.neutralBullets) return;
  for (const id of bids) {
    const b = s.bandits[id];
    s.players[b.controller].deck.push(card(s, 'bullet', id, -1));
    b.wounds++;
    s.neutralBullets--;
  }
}
function marshalEncounter(s: GameState) {
  const bs = s.bandits.filter((b) => b.car === s.marshal && b.floor === 0);
  neutral(
    s,
    bs.map((b) => b.id),
  );
  for (const b of bs) {
    b.floor = 1;
    log(s, `${name(s, b.id)} escapes the Marshal to the roof.`, b.id, 'marshal');
  }
}
function giveLoot(s: GameState, b: Bandit, l: Loot) {
  b.loot.push(l);
  s.players[b.controller].knownLoot[l.id] = l.value;
}
function endPlanning(s: GameState) {
  if (s.config.expert) {
    s.phase = 'retain';
    s.selectionIndex = 0;
    s.actor = s.firstPlayer;
    s.keepCards = [];
  } else {
    for (const p of s.players) p.deck.push(...p.hand.splice(0));
    startExecution(s);
  }
}
function startExecution(s: GameState) {
  s.phase = 'execute';
  s.executionIndex = 0;
  revealNext(s);
}
function nextPlanning(s: GameState) {
  s.scheduleIndex++;
  s.coverBandit = -1;
  if (s.scheduleIndex >= s.schedule.length) {
    endPlanning(s);
    return;
  }
  s.phase = 'scheme';
  s.actor = s.schedule[s.scheduleIndex].controller;
}
function revealNext(s: GameState) {
  if (s.executionIndex >= s.queue.length) {
    applyEvent(s);
    return;
  }
  const q = s.queue[s.executionIndex];
  q.revealed = true;
  s.actor = q.controller;
  s.phase = 'execute';
}
function applyEvent(s: GameState) {
  const e = s.rounds[s.round].event;
  if (e !== 'none') log(s, EVENT_INFO[e].name + '.');
  if (e === 'angryMarshal') {
    neutral(
      s,
      s.bandits.filter((b) => b.car === s.marshal && b.floor === 1).map((b) => b.id),
    );
    s.marshal = Math.min(s.cars.length - 1, s.marshal + 1);
    marshalEncounter(s);
  }
  if (e === 'strongbox') s.cars[s.marshal].loot[0].push(token(s, 'strongbox', 1000));
  if (e === 'braking') for (const b of s.bandits) if (b.floor === 1) b.car = Math.max(0, b.car - 1);
  if (e === 'swivel') for (const b of s.bandits) if (b.floor === 1) b.car = s.cars.length - 1;
  if (e === 'rebellion')
    neutral(
      s,
      s.bandits.filter((b) => b.floor === 0).map((b) => b.id),
    );
  if (e === 'revenge')
    for (const b of s.bandits)
      if (b.car === s.marshal && b.floor === 1) {
        const purses = b.loot.filter((l) => l.kind === 'purse').sort((a, b) => a.value - b.value);
        if (purses[0])
          s.cars[b.car].loot[b.floor].push(b.loot.splice(b.loot.indexOf(purses[0]), 1)[0]);
      }
  if (e === 'hostage')
    for (const b of s.bandits)
      if (b.car === 0) {
        const l = token(s, 'purse', 250);
        giveLoot(s, b, l);
        for (const p of s.players) p.knownLoot[l.id] = 250;
      }
  if (e === 'pickpocket') {
    s.eventBandits = s.bandits
      .filter(
        (b) =>
          !s.bandits.some((t) => t.id !== b.id && t.car === b.car && t.floor === b.floor) &&
          s.cars[b.car].loot[b.floor].some((l) => l.kind === 'purse'),
      )
      .map((b) => b.id);
    s.eventIndex = 0;
    if (s.eventBandits.length) {
      s.phase = 'event';
      s.actor = s.bandits[s.eventBandits[0]].controller;
      return;
    }
  }
  finishRound(s);
}
export function scores(s: GameState): number[] {
  const shots = s.players.map((p) =>
      s.bandits
        .filter((b) => b.controller === p.id)
        .reduce((t, b) => t + (s.team ? b.creditedShots : b.shots), 0),
    ),
    max = Math.max(...shots);
  return s.players.map(
    (p) =>
      s.bandits
        .filter((b) => b.controller === p.id)
        .reduce((t, b) => t + b.loot.reduce((x, l) => x + l.value, 0), 0) +
      (shots[p.id] === max ? 1000 : 0),
  );
}
function finishRound(s: GameState) {
  if (s.round === 4) {
    s.phase = 'finished';
    s.scores = scores(s);
    const max = Math.max(...s.scores),
      contenders = s.players.filter((p) => s.scores[p.id] === max),
      wounds = (pid: number) =>
        s.bandits.filter((b) => b.controller === pid).reduce((t, b) => t + b.wounds, 0),
      min = Math.min(...contenders.map((p) => wounds(p.id)));
    s.winners = contenders.filter((p) => wounds(p.id) === min).map((p) => p.id);
    log(s, 'The train has reached the station.');
  } else {
    s.phase = 'roundEnd';
    s.actor = s.firstPlayer;
  }
}
/** Mutating transition for simulations. Validation can only be skipped for actions produced by legalActions. */
export function applyAction(s: GameState, a: Action, validate = true): GameState {
  if (validate && !legalActions(s).some((x) => sameAction(x, a)))
    throw new Error('Illegal action: ' + JSON.stringify(a));
  const p = s.players[s.actor];
  if (s.phase === 'roundEnd') {
    s.round++;
    s.firstPlayer = (s.firstPlayer + 1) % s.players.length;
    startRound(s);
    return s;
  }
  if (s.phase === 'choose' && a.kind === 'choose') {
    p.hand.push(
      p.deck.splice(
        p.deck.findIndex((c) => c.id === a.card),
        1,
      )[0],
    );
    s.selectionIndex++;
    if (s.selectionIndex === s.players.length) {
      for (const pl of s.players) {
        shuffle(s, pl.deck);
        draw(s, pl.id, has(s, pl.id, 'doc') ? 7 : 6);
      }
      s.phase = 'scheme';
      s.actor = s.schedule[0].controller;
    } else s.actor = (s.firstPlayer + s.selectionIndex) % s.players.length;
    return s;
  }
  if (s.phase === 'retain') {
    if (a.kind === 'keep' || a.kind === 'discard') {
      const c = p.hand.shift()!;
      if (a.kind === 'keep') s.keepCards.push(c);
      else p.discard.push(c);
    }
    if (!p.hand.length) {
      p.hand = s.keepCards;
      s.keepCards = [];
      s.selectionIndex++;
      if (s.selectionIndex === s.players.length) startExecution(s);
      else s.actor = (s.firstPlayer + s.selectionIndex) % s.players.length;
    }
    return s;
  }
  if (s.phase === 'scheme' || s.phase === 'cover') {
    const cover = s.phase === 'cover';
    let coverEligible = false;
    if (a.kind === 'draw') {
      const before = p.hand.length;
      draw(s, p.id, 3);
      log(s, `Player ${p.id + 1} draws ${p.hand.length - before} cards.`, undefined, 'draw');
    }
    if (a.kind === 'play') {
      const c = p.hand.splice(
        p.hand.findIndex((c) => c.id === a.card),
        1,
      )[0];
      s.queue.push({
        controller: p.id,
        card: c,
        hidden: a.hidden,
        turn: s.schedule[s.scheduleIndex].turn,
        revealed: false,
      });
      log(
        s,
        a.hidden
          ? `Player ${p.id + 1} programs a face-down card.`
          : `${name(s, c.bandit)} programs ${ACTION_INFO[c.kind].name}.`,
        a.hidden ? undefined : c.bandit,
        a.hidden ? 'hidden' : c.kind,
      );
      coverEligible =
        s.team &&
        !cover &&
        c.kind === 'shoot' &&
        !a.hidden &&
        s.rounds[s.round].turns[s.schedule[s.scheduleIndex].turn] === 'normal';
      s.coverBandit = c.bandit;
    }
    p.firstTurnUsed = true;
    if (coverEligible) {
      s.phase = 'cover';
      if (legalActions(s).length === 1) nextPlanning(s);
    } else nextPlanning(s);
    return s;
  }
  const b = s.bandits[activeBandit(s)];
  if (s.phase === 'execute' || s.phase === 'event') {
    if (a.kind === 'move') {
      b.car = a.to;
      log(
        s,
        `${name(s, b.id)} moves to ${a.to === 0 ? 'the locomotive' : `car ${a.to}`}.`,
        b.id,
        'move',
      );
      marshalEncounter(s);
    }
    if (a.kind === 'climb') {
      b.floor = b.floor === 0 ? 1 : 0;
      log(s, `${name(s, b.id)} ${b.floor ? 'climbs to the roof' : 'goes inside'}.`, b.id, 'climb');
      marshalEncounter(s);
    }
    if (a.kind === 'marshal') {
      s.marshal = a.to;
      log(
        s,
        `The Marshal moves to ${a.to === 0 ? 'the locomotive' : `car ${a.to}`}.`,
        b.id,
        'marshal',
      );
      marshalEncounter(s);
    }
    if (a.kind === 'shoot') {
      const t = s.bandits[a.target];
      s.players[t.controller].deck.push(card(s, 'bullet', t.id, b.id));
      b.shots++;
      if (t.controller !== b.controller) b.creditedShots++;
      t.wounds++;
      log(s, `${name(s, b.id)} shoots ${name(s, t.id)}.`, b.id, 'shoot');
      if (b.character === 'django') {
        t.car = Math.max(0, Math.min(s.cars.length - 1, t.car + Math.sign(t.car - b.car)));
        marshalEncounter(s);
      }
    }
    if (a.kind === 'loot') {
      const source = s.cars[b.car].loot[b.floor],
        l = source.splice(
          source.findIndex((x) => x.id === a.loot),
          1,
        )[0];
      giveLoot(s, b, l);
      log(s, `${name(s, b.id)} takes a ${l.kind}.`, b.id, 'loot');
    }
    if (a.kind === 'punch') {
      const t = s.bandits[a.target];
      if (a.loot !== null) {
        const l = t.loot.splice(
          t.loot.findIndex((x) => x.id === a.loot),
          1,
        )[0];
        if (b.character === 'cheyenne' && l.kind === 'purse') giveLoot(s, b, l);
        else s.cars[b.car].loot[b.floor].push(l);
      }
      t.car = a.to;
      log(
        s,
        `${name(s, b.id)} punches ${name(s, t.id)} into ${a.to === 0 ? 'the locomotive' : `car ${a.to}`}.`,
        b.id,
        'punch',
      );
      marshalEncounter(s);
    }
    if (s.phase === 'event') {
      s.eventIndex++;
      if (s.eventIndex >= s.eventBandits.length) finishRound(s);
      else s.actor = s.bandits[s.eventBandits[s.eventIndex]].controller;
      return s;
    }
    const q = s.queue[s.executionIndex];
    if (a.kind === 'pass')
      log(
        s,
        `${name(s, b.id)} cannot ${ACTION_INFO[q.card.kind].name.toLowerCase()} here.`,
        b.id,
        'miss',
      );
    s.players[q.controller].discard.push(q.card);
    s.executionIndex++;
    revealNext(s);
    return s;
  }
  return s;
}
export const step = (s: GameState, a: Action): GameState => applyAction(cloneGame(s), a);
export function observe(s: GameState, viewer: number, includeLog = true): Observation {
  if (!s.players[viewer]) throw new Error('Invalid observer.');
  const known = s.players[viewer].knownLoot;
  const loot = (l: Loot) => ({
    id: l.id,
    kind: l.kind,
    value: s.phase === 'finished' || l.kind !== 'purse' ? l.value : (known[l.id] ?? null),
  });
  return {
    version: 1,
    viewer,
    team: s.team,
    expert: s.config.expert,
    phase: s.phase,
    actor: s.actor,
    round: s.round,
    roundCard: clone(s.rounds[s.round]),
    previousRounds: s.rounds.slice(0, s.round).map((r) => r.id),
    firstPlayer: s.firstPlayer,
    schedule: clone(s.schedule),
    scheduleIndex: s.scheduleIndex,
    executionIndex: s.executionIndex,
    coverBandit: s.coverBandit,
    bandits: s.bandits.map((b) => ({ ...b, loot: b.loot.map(loot) })),
    players: s.players.map((p) => {
      const all = [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...s.queue
          .slice(s.executionIndex)
          .filter((q) => q.controller === p.id)
          .map((q) => q.card),
        ...(s.phase === 'retain' && s.actor === p.id ? s.keepCards : []),
      ];
      const inv: Observation['players'][number]['inventory'] = [];
      for (const c of all) {
        const item = inv.find(
          (x) => x.kind === c.kind && x.bandit === c.bandit && x.source === c.source,
        );
        if (item) item.count++;
        else
          inv.push({
            kind: c.kind,
            bandit: c.bandit,
            ...(c.source === undefined ? {} : { source: c.source }),
            count: 1,
          });
      }
      inv.sort(
        (a, b) =>
          a.bandit - b.bandit ||
          a.kind.localeCompare(b.kind) ||
          (a.source ?? -2) - (b.source ?? -2),
      );
      return {
        id: p.id,
        hand: p.id === viewer ? clone(p.hand) : null,
        handCount: p.hand.length,
        deckCount: p.deck.length,
        discard: s.config.expert ? clone(p.discard) : [],
        inventory: inv,
        firstTurnUsed: p.firstTurnUsed,
      };
    }),
    cars: s.cars.map((c) => ({
      profile: c.profile,
      loot: [c.loot[0].map(loot), c.loot[1].map(loot)],
    })),
    marshal: s.marshal,
    neutralBullets: s.neutralBullets,
    queue: s.queue.map((q) => {
      const visible = !q.hidden || q.revealed || q.controller === viewer;
      return {
        controller: q.controller,
        bandit: visible ? q.card.bandit : null,
        kind: visible ? (q.card.kind as import('./types').ActionKind) : null,
        hidden: q.hidden,
        turn: q.turn,
        revealed: q.revealed,
      };
    }),
    selectionCards:
      s.phase === 'choose' && s.actor === viewer
        ? clone(s.players[viewer].deck).sort((a, b) => a.id - b.id)
        : [],
    legal: s.actor === viewer ? clone(legalActions(s)) : [],
    log: includeLog ? clone(s.log) : [],
    scores: s.phase === 'finished' ? [...s.scores] : [],
    winners: [...s.winners],
  };
}
export function assertInvariants(s: GameState) {
  const cards = [
    ...s.players.flatMap((p) => [...p.hand, ...p.deck, ...p.discard]),
    ...s.queue.slice(s.executionIndex).map((q) => q.card),
    ...s.keepCards,
  ];
  if (new Set(cards.map((c) => c.id)).size !== cards.length) throw new Error('Duplicate card.');
  const loot = [...s.bandits.flatMap((b) => b.loot), ...s.cars.flatMap((c) => c.loot.flat())];
  if (new Set(loot.map((l) => l.id)).size !== loot.length) throw new Error('Duplicate loot.');
  for (const b of s.bandits) {
    if (b.car < 0 || b.car >= s.cars.length || !(b.floor === 0 || b.floor === 1))
      throw new Error('Bandit off board.');
    if (b.floor === 0 && b.car === s.marshal) throw new Error('Bandit sharing Marshal space.');
    if (b.shots < 0 || b.shots > 6) throw new Error('Invalid ammunition.');
  }
  const bullets = cards.filter((c) => c.kind === 'bullet');
  if (bullets.filter((c) => c.source === -1).length + s.neutralBullets !== 13)
    throw new Error('Neutral bullet conservation.');
  if (bullets.filter((c) => c.source !== -1).length !== s.bandits.reduce((t, b) => t + b.shots, 0))
    throw new Error('Bullet conservation.');
  const expected = s.team ? 22 : s.players.length * 10;
  if (cards.filter((c) => c.kind !== 'bullet').length !== expected)
    throw new Error('Action card conservation.');
}
