import {describe,it,expect} from 'vitest';
import {createGame,observe,applyAction,legalActions} from '../src/game/engine';
import {baseline} from '../src/ai/tactics';
import {encode,STATE_DIM,ACTION_DIM} from '../src/ai/features';
import {seeded} from '../src/game/random';
describe('AI input and baselines',()=>{
 it('has fixed finite feature dimensions throughout full games',()=>{for(const players of [2,3,4,5,6]){const s=createGame({players,seed:12}),rng=seeded(3);let n=0;while(s.phase!=='finished'&&n++<1000){const o=observe(s,s.actor),f=encode(o);expect(f.state.length).toBe(STATE_DIM);expect(f.state.every(Number.isFinite)).toBe(true);for(const a of f.actions){expect(a.length).toBe(ACTION_DIM);expect(a.every(Number.isFinite)).toBe(true);}applyAction(s,o.legal[baseline(o,'tactical',rng)]);}expect(s.phase).toBe('finished');}});
 it('features are unchanged by hidden deck permutations',()=>{const s=createGame({players:4,seed:1,firstPlayer:0}),a=encode(observe(s,0));s.players[1].deck.reverse();[s.players[1].hand[0],s.players[1].deck[0]]=[s.players[1].deck[0],s.players[1].hand[0]];expect(encode(observe(s,0))).toEqual(a);});
 it('every baseline terminates legal complete games',()=>{for(const policy of ['random','greedy','tactical','aggressive'] as const){const s=createGame({players:4,seed:2}),r=seeded(2);let steps=0;while(s.phase!=='finished'&&steps++<600){const o=observe(s,s.actor),i=baseline(o,policy,r);expect(i).toBeGreaterThanOrEqual(0);expect(i).toBeLessThan(legalActions(s).length);applyAction(s,o.legal[i]);}expect(s.phase).toBe('finished');}});
});
