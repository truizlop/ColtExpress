import type { Character, RoundCard, TurnKind, EventKind } from './types';
export const CHARACTERS: Character[] = ['cheyenne', 'django', 'belle', 'tuco', 'doc', 'ghost'];
export const CHARACTER_INFO: Record<
  Character,
  { name: string; color: string; power: string; tagline: string; portrait: number }
> = {
  cheyenne: {
    name: 'Cheyenne',
    color: '#27604b',
    power: 'When you punch, take the purse your target drops.',
    tagline: 'Fast hands. Faster getaway.',
    portrait: 0,
  },
  django: {
    name: 'Django',
    color: '#b56728',
    power: 'Your shots push the target one car away from you.',
    tagline: 'One shot changes the plan.',
    portrait: 1,
  },
  belle: {
    name: 'Belle',
    color: '#784c83',
    power: 'You cannot be targeted if another bandit is a legal target.',
    tagline: 'Always someone else in the line of fire.',
    portrait: 2,
  },
  tuco: {
    name: 'Tuco',
    color: '#a83c32',
    power: 'You can also shoot through the roof at your own car.',
    tagline: 'Nowhere to hide.',
    portrait: 3,
  },
  doc: {
    name: 'Doc',
    color: '#366b89',
    power: 'Draw seven cards at the beginning of each round.',
    tagline: 'Always one card ahead.',
    portrait: 4,
  },
  ghost: {
    name: 'Ghost',
    color: '#696964',
    power: 'You may play your first action of each round face down.',
    tagline: 'You never saw it coming.',
    portrait: 5,
  },
};
export const ACTION_INFO = {
  move: { name: 'Move', description: 'Inside: move 1 car. On the roof: move 1–3 cars.' },
  climb: { name: 'Climb', description: 'Change between the interior and roof of your car.' },
  shoot: {
    name: 'Shoot',
    description: 'Give a bullet to a legal target. Bullets clog their deck.',
  },
  punch: {
    name: 'Punch',
    description: 'Hit a bandit in your space, drop their loot, and push them 1 car.',
  },
  loot: { name: 'Loot', description: 'Take one loot token from your space.' },
  marshal: {
    name: 'Marshal',
    description: 'Move the Marshal 1 car. Bandits flee to the roof and take a bullet.',
  },
  bullet: { name: 'Bullet', description: 'A wound in your hand. It cannot be played.' },
};
export const EVENT_INFO: Record<EventKind, { name: string; description: string }> = {
  none: { name: 'Open country', description: 'No event at the end of this round.' },
  angryMarshal: {
    name: 'Angry Marshal',
    description: 'The Marshal shoots bandits above him, then moves toward the caboose.',
  },
  strongbox: {
    name: 'Take it all!',
    description: 'A second $1,000 strongbox appears in the Marshal’s car.',
  },
  braking: {
    name: 'Braking',
    description: 'Every bandit on a roof moves one car toward the locomotive.',
  },
  swivel: {
    name: 'Swivel arm',
    description: 'Every bandit on a roof moves to the roof of the caboose.',
  },
  rebellion: {
    name: 'Passengers’ rebellion',
    description: 'Every bandit inside the train receives a neutral bullet.',
  },
  pickpocket: {
    name: 'Pickpocketing',
    description: 'A bandit alone in their space may take one purse there.',
  },
  revenge: {
    name: 'Marshal’s revenge',
    description: 'Bandits above the Marshal drop their least valuable purse.',
  },
  hostage: {
    name: 'Hostage conductor',
    description: 'Every bandit in or on the locomotive receives $250.',
  },
};
// Transcribed from the publisher’s card-face PDF, pages 110–126 (one-based).
const make = (id: string, name: string, turns: TurnKind[], event: EventKind): RoundCard => ({
  id,
  name,
  turns,
  event,
});
export const SMALL_ROUNDS: RoundCard[] = [
  make('small-angry', 'Angry Marshal', ['normal', 'normal', 'tunnel', 'reverse'], 'angryMarshal'),
  make('small-strongbox', 'Take it all!', ['normal', 'tunnel', 'double', 'normal'], 'strongbox'),
  make(
    'small-tunnels',
    'Through the mountain',
    ['normal', 'tunnel', 'normal', 'tunnel', 'normal'],
    'none',
  ),
  make('small-swivel', 'Swivel arm', ['normal', 'tunnel', 'normal', 'normal'], 'swivel'),
  make('small-bridge', 'Full steam', ['normal', 'double', 'normal'], 'none'),
  make('small-braking', 'Braking', ['normal', 'normal', 'normal', 'normal'], 'braking'),
  make(
    'small-rebellion',
    'Passengers’ rebellion',
    ['normal', 'normal', 'tunnel', 'normal', 'normal'],
    'rebellion',
  ),
];
export const LARGE_ROUNDS: RoundCard[] = [
  make('large-angry', 'Angry Marshal', ['normal', 'normal', 'reverse'], 'angryMarshal'),
  make('large-strongbox', 'Take it all!', ['normal', 'double', 'reverse'], 'strongbox'),
  make('large-tunnels', 'Through the mountain', ['normal', 'tunnel', 'normal', 'tunnel'], 'none'),
  make('large-swivel', 'Swivel arm', ['normal', 'tunnel', 'normal'], 'swivel'),
  make('large-bridge', 'Full steam', ['normal', 'double'], 'none'),
  make('large-braking', 'Braking', ['normal', 'tunnel', 'normal', 'normal'], 'braking'),
  make(
    'large-rebellion',
    'Passengers’ rebellion',
    ['normal', 'tunnel', 'normal', 'reverse'],
    'rebellion',
  ),
];
export const STATIONS: RoundCard[] = (['hostage', 'pickpocket', 'revenge'] as EventKind[]).map(
  (e) => make('station-' + e, EVENT_INFO[e].name, ['normal', 'normal', 'tunnel', 'normal'], e),
);
// Printed floor pictograms in the publisher’s 6-car train reference.
export const CAR_PROFILES = [
  { name: 'Baggage', purses: 1, jewels: 0, color: '#867354' },
  { name: 'Second class', purses: 1, jewels: 1, color: '#857448' },
  { name: 'First class', purses: 0, jewels: 3, color: '#854b41' },
  { name: 'Dining car', purses: 3, jewels: 0, color: '#94713f' },
  { name: 'Mail car', purses: 4, jewels: 1, color: '#655a4d' },
  { name: 'Private saloon', purses: 3, jewels: 1, color: '#834237' },
];
export const PURSE_VALUES = [
  250, 250, 250, 250, 250, 250, 250, 250, 300, 300, 350, 350, 400, 400, 450, 450, 500, 500,
];
