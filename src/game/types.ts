export const ACTION_KINDS = ['move', 'climb', 'shoot', 'punch', 'loot', 'marshal'] as const;
export type ActionKind = typeof ACTION_KINDS[number];
export type Character = 'cheyenne' | 'django' | 'belle' | 'tuco' | 'doc' | 'ghost';
export type TurnKind = 'normal' | 'tunnel' | 'double' | 'reverse';
export type EventKind = 'none' | 'angryMarshal' | 'strongbox' | 'braking' | 'swivel' | 'rebellion' | 'pickpocket' | 'revenge' | 'hostage';
export type Phase = 'choose' | 'scheme' | 'cover' | 'retain' | 'execute' | 'event' | 'roundEnd' | 'finished';
export interface Card { id: number; kind: ActionKind | 'bullet'; bandit: number; source?: number }
export interface Loot { id: number; kind: 'purse' | 'jewel' | 'strongbox'; value: number }
export interface Bandit { id: number; controller: number; character: Character; car: number; floor: 0 | 1; loot: Loot[]; shots: number; creditedShots: number; wounds: number }
export interface Player { id: number; hand: Card[]; deck: Card[]; discard: Card[]; knownLoot: Record<number, number>; firstTurnUsed: boolean }
export interface Car { profile: number; loot: [Loot[], Loot[]] }
export interface RoundCard { id: string; name: string; turns: TurnKind[]; event: EventKind }
export interface Programmed { controller: number; card: Card; hidden: boolean; turn: number; revealed: boolean }
export interface LogEntry { id: number; round: number; text: string; bandit?: number; action?: string }
export interface GameConfig { players: number; characters?: Character[]; seed?: number; expert?: boolean; firstPlayer?: number; carProfiles?: number[] }
export interface GameState {
  version: 1; rng: number; seed: number; config: {players: number; expert: boolean}; team: boolean;
  players: Player[]; bandits: Bandit[]; cars: Car[]; marshal: number; neutralBullets: number;
  rounds: RoundCard[]; round: number; firstPlayer: number; phase: Phase; actor: number;
  schedule: {controller: number; turn: number; repeat: number}[]; scheduleIndex: number;
  queue: Programmed[]; executionIndex: number; coverBandit: number; selectionIndex: number;
  eventBandits: number[]; eventIndex: number; nextId: number; log: LogEntry[]; logId: number;
  winners: number[]; scores: number[]; keepCards: Card[];
}
export type Action =
 | {kind: 'play'; card: number; hidden: boolean}
 | {kind: 'draw'} | {kind: 'pass'} | {kind: 'continue'}
 | {kind: 'choose'; card: number}
 | {kind: 'keep' | 'discard'; card: number}
 | {kind: 'move' | 'marshal'; to: number}
 | {kind: 'climb'}
 | {kind: 'shoot'; target: number}
 | {kind: 'punch'; target: number; to: number; loot: number | null}
 | {kind: 'loot'; loot: number};
export interface VisibleLoot { id: number; kind: Loot['kind']; value: number | null }
export interface Observation {
  version: 1; viewer: number; team: boolean; expert: boolean; phase: Phase; actor: number;
  round: number; roundCard: RoundCard; previousRounds: string[]; firstPlayer: number;
  schedule: GameState['schedule']; scheduleIndex: number; executionIndex: number; coverBandit: number;
  bandits: (Omit<Bandit, 'loot'> & {loot: VisibleLoot[]})[];
  players: {id: number; hand: Card[] | null; handCount: number; deckCount: number; discard: Card[]; inventory: {kind: Card['kind']; bandit: number; source?: number; count: number}[]; firstTurnUsed: boolean}[];
  cars: {profile: number; loot: [VisibleLoot[], VisibleLoot[]]}[];
  marshal: number; neutralBullets: number;
  queue: {controller: number; bandit: number | null; kind: ActionKind | null; hidden: boolean; turn: number; revealed: boolean}[];
  selectionCards: Card[]; legal: Action[]; log: LogEntry[]; scores: number[]; winners: number[];
}
