import {describe,it,expect} from 'vitest';
import {createGame,legalActions,applyAction,step,observe,targets,assertInvariants,cloneGame,scores} from '../src/game/engine';
import {SMALL_ROUNDS,LARGE_ROUNDS,STATIONS,CAR_PROFILES} from '../src/game/data';
import {seeded} from '../src/game/random';
import type {GameState,ActionKind,Card} from '../src/game/types';
function fixture(kind:ActionKind,characters:GameState['bandits'][number]['character'][]=['cheyenne','django','belle','tuco']){
 const s=createGame({players:characters.length,characters,seed:1});
 s.phase='execute';s.actor=0;s.executionIndex=0;s.queue=[{controller:0,card:{id:900,kind,bandit:0},hidden:false,revealed:true,turn:0}];
 s.marshal=0;for(let i=0;i<s.bandits.length;i++){s.bandits[i].car=i%2+2;s.bandits[i].floor=0;}return s;
}
function outcome(s:GameState){let k=0;const r=seeded(402);while(s.phase!=='finished'&&k++<1000){const a=legalActions(s);applyAction(s,a[Math.floor(r()*a.length)]);assertInvariants(s);}expect(s.phase).toBe('finished');return s;}
describe('source-backed setup',()=>{
 it('has the full original component supply',()=>{expect(CAR_PROFILES.reduce((n,c)=>n+c.purses,0)).toBe(12);expect(CAR_PROFILES.reduce((n,c)=>n+c.jewels,0)).toBe(6);const s=createGame({players:6,seed:7});expect(s.cars.length).toBe(7);expect(s.bandits.flatMap(b=>b.loot).length+s.cars.flatMap(c=>c.loot.flat()).length).toBe(25);});
 it('encodes all seven schedules per player count and all stations',()=>{expect(SMALL_ROUNDS).toHaveLength(7);expect(LARGE_ROUNDS).toHaveLength(7);expect(STATIONS).toHaveLength(3);expect(SMALL_ROUNDS[1].turns).toEqual(['normal','tunnel','double','normal']);expect(LARGE_ROUNDS[4].turns).toEqual(['normal','double']);});
 it('is deterministic and rejects invalid setup',()=>{expect(createGame({players:4,seed:17})).toEqual(createGame({players:4,seed:17}));expect(()=>createGame({players:7})).toThrow();expect(()=>createGame({players:3,characters:['doc','doc','tuco']})).toThrow();});
 it('deals Doc seven cards and everyone else six',()=>{const s=createGame({players:3,characters:['doc','tuco','ghost'],seed:1});expect(s.players.map(p=>p.hand.length)).toEqual([7,6,6]);});
 it('starts alternating from the first player',()=>{const s=createGame({players:4,firstPlayer:2,seed:4});expect(s.bandits.map(b=>b.car)).toEqual([4,3,4,3]);});
 it('implements revised team setup and private card selection',()=>{const s=createGame({players:2,characters:['cheyenne','doc','django','belle'],seed:5});expect(s.cars).toHaveLength(4);expect(s.players.map(p=>p.deck.length)).toEqual([11,11]);expect(s.bandits.map(b=>b.car)).toEqual([3,2,3,2]);while(s.phase==='choose')applyAction(s,legalActions(s)[0]);expect(s.players.map(p=>p.hand.length)).toEqual([8,7]);});
});
describe('full game invariants',()=>{
 for(const players of [2,3,4,5,6])for(const expert of [false,true])it(`${players} players, expert=${expert}: 30 seeded complete games`,()=>{
 for(let seed=1;seed<=30;seed++){const s=createGame({players,expert,seed});assertInvariants(s);outcome(s);expect(s.winners.length).toBeGreaterThan(0);expect(s.scores.length).toBe(players);}
 });
 it('step leaves the original state unchanged',()=>{const s=createGame({players:4,seed:1}),before=cloneGame(s);step(s,legalActions(s)[0]);expect(s).toEqual(before);});
 it('rejects an illegal action',()=>{const s=createGame({players:3,seed:1});expect(()=>applyAction(s,{kind:'move',to:100})).toThrow('Illegal action');});
});
describe('actions and powers',()=>{
 it('moves 1 car inside and 1–3 cars on roofs',()=>{const s=fixture('move');s.bandits[0].car=2;expect(legalActions(s)).toEqual([{kind:'move',to:1},{kind:'move',to:3}]);s.bandits[0].floor=1;expect(legalActions(s).map(a=>'to'in a?a.to:-1)).toEqual([0,1,3,4]);});
 it('a Marshal encounter forces the roof and adds a neutral bullet',()=>{const s=fixture('move');s.bandits[0].car=1;applyAction(s,{kind:'move',to:0});expect(s.bandits[0].floor).toBe(1);expect(s.bandits[0].wounds).toBeGreaterThanOrEqual(1);});
 it('roof line of sight stops at nearest occupied car',()=>{const s=fixture('shoot');s.bandits.forEach(b=>b.floor=1);s.bandits[0].car=0;s.bandits[1].car=2;s.bandits[2].car=3;s.bandits[3].car=2;expect(targets(s,0,'shoot').map(b=>b.id)).toEqual([1,3]);});
 it('Belle is protected only when another legal target exists',()=>{const s=fixture('shoot');s.bandits[0].car=2;s.bandits[1].car=1;s.bandits[2].car=3;s.bandits[3].car=4;expect(targets(s,0,'shoot').map(b=>b.id)).toEqual([1]);s.bandits[1].car=4;expect(targets(s,0,'shoot').map(b=>b.id)).toEqual([2]);});
 it('protected Belle still blocks roof sight',()=>{const s=fixture('shoot');s.bandits.forEach(b=>b.floor=1);s.bandits[0].car=2;s.bandits[1].car=0;s.bandits[2].car=3;s.bandits[3].car=4;expect(targets(s,0,'shoot').map(b=>b.id)).toEqual([1]);});
 it('Tuco shoots through the ceiling',()=>{const s=fixture('shoot',['tuco','doc','django']);s.bandits[0].car=2;s.bandits[1].car=2;s.bandits[1].floor=1;s.bandits[2].car=0;expect(targets(s,0,'shoot').map(b=>b.id)).toEqual([1]);});
 it('Django pushes targets away and cannot eject them',()=>{const s=fixture('shoot',['django','doc','tuco']);s.bandits[0].car=1;s.bandits[1].car=2;s.bandits[2].car=1;applyAction(s,{kind:'shoot',target:1});expect(s.bandits[1].car).toBe(3);expect(s.bandits[0].shots).toBe(1);});
 it('no target does not waste bullets',()=>{const s=fixture('shoot');s.bandits.forEach(b=>b.car=2);expect(legalActions(s)).toEqual([{kind:'pass'}]);applyAction(s,{kind:'pass'});expect(s.bandits[0].shots).toBe(0);});
 it('an empty cylinder cannot fire',()=>{const s=fixture('shoot');s.bandits[0].shots=6;expect(legalActions(s)).toEqual([{kind:'pass'}]);});
 it('Cheyenne steals a punched purse',()=>{const s=fixture('punch');s.rounds[s.round].event='none';s.bandits[0].car=2;s.bandits[1].car=2;s.bandits[2].car=4;s.bandits[3].car=3;const id=s.bandits[1].loot[0].id;applyAction(s,{kind:'punch',target:1,to:1,loot:id});expect(s.bandits[0].loot.some(l=>l.id===id)).toBe(true);expect(s.players[0].knownLoot[id]).toBe(250);});
 it('Cheyenne drops jewels instead of stealing them',()=>{const s=fixture('punch');s.rounds[s.round].event='none';s.bandits[1].car=2;s.bandits[1].loot=[{id:999,kind:'jewel',value:500}];applyAction(s,{kind:'punch',target:1,to:1,loot:999});expect(s.cars[2].loot[0].some(l=>l.id===999)).toBe(true);});
 it('insufficient neutral bullets spare the whole group',()=>{const s=fixture('marshal');s.rounds[s.round].event='none';s.neutralBullets=1;s.bandits[0].car=1;s.bandits[1].car=1;s.bandits[2].car=3;s.bandits[3].car=3;applyAction(s,{kind:'marshal',to:1});expect(s.bandits[0].floor).toBe(1);expect(s.bandits[1].floor).toBe(1);expect(s.neutralBullets).toBe(1);expect(s.bandits[0].wounds).toBe(0);});
 it('Ghost may hide only the first turn, including after drawing',()=>{const s=createGame({players:3,characters:['ghost','doc','tuco'],seed:7,firstPlayer:0});expect(legalActions(s).some(a=>a.kind==='play'&&a.hidden)).toBe(true);applyAction(s,{kind:'draw'});expect(s.players[0].firstTurnUsed).toBe(true);});
 it('team standard Shoot permits one non-Marshal action by the other bandit',()=>{const s=createGame({players:2,characters:['cheyenne','tuco','django','belle'],seed:2,firstPlayer:0});while(s.phase==='choose')applyAction(s,legalActions(s)[0]);s.rounds[0].turns[0]='normal';s.players[0].hand=[{id:200,kind:'shoot',bandit:0},{id:201,kind:'shoot',bandit:1},{id:202,kind:'marshal',bandit:1}];applyAction(s,{kind:'play',card:200,hidden:false});expect(s.phase).toBe('cover');expect(legalActions(s)).toEqual([{kind:'pass'},{kind:'play',card:201,hidden:false}]);applyAction(s,{kind:'play',card:201,hidden:false});expect(s.phase).toBe('scheme');expect(s.actor).toBe(1);});
});
describe('events and scoring',()=>{
 const trigger=(event:GameState['rounds'][number]['event'])=>{const s=fixture('shoot');s.rounds[0].event=event;s.bandits.forEach(b=>b.car=2);return s;};
 it('awards all tied gunslingers $1000',()=>{const s=createGame({players:3,seed:1});s.bandits[0].shots=3;s.bandits[1].shots=3;expect(scores(s)).toEqual([1250,1250,250]);});
 it('team gunslinger excludes friendly shots',()=>{const s=createGame({players:2,seed:1});s.bandits[0].shots=4;s.bandits[0].creditedShots=0;s.bandits[2].shots=1;s.bandits[2].creditedShots=1;expect(scores(s)).toEqual([500,1500]);});
 it('rebellion adds a bullet to every interior bandit',()=>{const s=trigger('rebellion');applyAction(s,{kind:'pass'});expect(s.bandits.map(b=>b.wounds)).toEqual([1,1,1,1]);});
 it('braking moves roof bandits forward without leaving train',()=>{const s=trigger('braking');s.bandits.forEach(b=>b.floor=1);s.bandits[0].shots=6;applyAction(s,{kind:'pass'});expect(s.bandits.map(b=>b.car)).toEqual([1,1,1,1]);});
 it('swivel sends roof bandits to caboose',()=>{const s=trigger('swivel');s.bandits.forEach(b=>b.floor=1);applyAction(s,{kind:'pass'});expect(s.bandits.every(b=>b.car===4)).toBe(true);});
 it('strongbox appears at Marshal',()=>{const s=trigger('strongbox');applyAction(s,{kind:'pass'});expect(s.cars[0].loot[0].filter(l=>l.kind==='strongbox')).toHaveLength(2);});
 it('revenge drops the cheapest purse onto roof',()=>{const s=trigger('revenge');s.bandits.forEach(b=>b.floor=1);s.marshal=2;s.bandits[0].loot.push({id:999,kind:'purse',value:500});applyAction(s,{kind:'pass'});expect(s.bandits[0].loot.map(l=>l.value)).toEqual([500]);expect(s.cars[2].loot[1]).toHaveLength(4);});
 it('hostage grants $250 to bandits on locomotive',()=>{const s=trigger('hostage');s.bandits.forEach(b=>{b.floor=1;b.car=0;});applyAction(s,{kind:'pass'});expect(s.bandits.map(b=>b.loot.reduce((n,l)=>n+l.value,0))).toEqual([500,500,500,500]);});
 it('pickpocket offers only purses when alone',()=>{const s=trigger('pickpocket');s.bandits[0].car=1;s.bandits[0].floor=1;s.cars[1].loot[1]=[{id:999,kind:'purse',value:350},{id:998,kind:'jewel',value:500}];applyAction(s,{kind:'pass'});expect(s.phase).toBe('event');expect(legalActions(s)).toEqual([{kind:'pass'},{kind:'loot',loot:999}]);});
});
describe('information boundaries',()=>{
 it('never reveals an opponent hand or deck order',()=>{const s=createGame({players:4,seed:1});const a=observe(s,0);s.players[1].hand.reverse();s.players[1].deck.reverse();expect(observe(s,0)).toEqual(a);expect(a.players[1].hand).toBeNull();expect('rng'in a).toBe(false);expect('seed'in a).toBe(false);});
 it('swapping unseen hand/deck cards does not change observation',()=>{const s=createGame({players:4,seed:1}),a=observe(s,0);[s.players[1].hand[0],s.players[1].deck[0]]=[s.players[1].deck[0],s.players[1].hand[0]];expect(observe(s,0)).toEqual(a);});
 it('future round selection remains hidden',()=>{const s=createGame({players:4,seed:1}),a=observe(s,0);s.rounds[4]=STATIONS[2];s.rounds[3]=SMALL_ROUNDS[3];expect(observe(s,0)).toEqual(a);});
 it('unseen purse values remain hidden',()=>{const s=createGame({players:6,seed:1}),a=observe(s,0);const l=s.cars.flatMap(c=>c.loot.flat()).find(l=>l.kind==='purse')!;l.value=499;expect(observe(s,0)).toEqual(a);});
 it('own purse knowledge survives loss of possession',()=>{const s=createGame({players:4,seed:1}),l=s.bandits[0].loot.pop()!;s.players[0].knownLoot[l.id]=425;l.value=425;s.bandits[1].loot.push(l);expect(observe(s,0).bandits[1].loot.find(x=>x.id===l.id)?.value).toBe(425);});
 it('concealed actions expose neither kind nor bandit until reveal',()=>{const s=createGame({players:4,seed:1,firstPlayer:1});s.rounds[0].turns[0]='tunnel';const a=legalActions(s).find(a=>a.kind==='play')!;applyAction(s,a);expect(observe(s,0).queue[0].kind).toBeNull();expect(observe(s,0).queue[0].bandit).toBeNull();expect(observe(s,1).queue[0].kind).not.toBeNull();});
});
