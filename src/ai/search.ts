import type {Card,GameState,Loot,Observation,RoundCard} from '../game/types';
import {applyAction,legalActions,observe} from '../game/engine';
import {PURSE_VALUES,SMALL_ROUNDS,LARGE_ROUNDS,STATIONS} from '../game/data';
import {seeded} from '../game/random';
import {baseline} from './tactics';
import {infer,softmax,type Model} from './network';
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function shuffled<T>(xs:T[],r:()=>number){for(let i=xs.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]];}return xs;}
/** Sample only from an observer's information. Never accepts the true GameState or seed. */
export function sampleWorld(o:Observation,seed:number):GameState{
 if(!['scheme','cover','execute'].includes(o.phase))throw new Error('Search is available during planning and execution.');
 const r=seeded(seed),s:GameState={version:1,rng:seed,seed,config:{players:o.players.length,expert:o.expert},team:o.team,players:[],bandits:[],cars:[],marshal:o.marshal,neutralBullets:o.neutralBullets,rounds:[],round:o.round,firstPlayer:o.firstPlayer,phase:o.phase,actor:o.actor,schedule:copy(o.schedule),scheduleIndex:o.scheduleIndex,queue:[],executionIndex:o.executionIndex,coverBandit:o.coverBandit,selectionIndex:0,eventBandits:[],eventIndex:0,nextId:100000,log:[],logId:0,winners:[],scores:[],keepCards:[]};
 const allLoot=[...o.bandits.flatMap(b=>b.loot),...o.cars.flatMap(c=>c.loot.flat())],values:number[]=[...PURSE_VALUES];
 for(const l of allLoot)if(l.kind==='purse'&&l.value!==null){const i=values.indexOf(l.value);if(i>=0)values.splice(i,1);}
 shuffled(values,r);const loot=(l:Observation['bandits'][number]['loot'][number]):Loot=>({...l,value:l.value??values.pop()??375});
 s.bandits=o.bandits.map(b=>({...b,loot:b.loot.map(loot)}));s.cars=o.cars.map(c=>({profile:c.profile,loot:[c.loot[0].map(loot),c.loot[1].map(loot)]}));
 const pools=o.players.map(p=>p.inventory.flatMap(x=>Array.from({length:x.count},()=>({id:s.nextId++,kind:x.kind,bandit:x.bandit,...(x.source===undefined?{}:{source:x.source})}) as Card)));
 const take=(pid:number,wanted:Pick<Card,'kind'|'bandit'|'source'>,id?:number)=>{const pool=pools[pid],i=pool.findIndex(c=>c.kind===wanted.kind&&c.bandit===wanted.bandit&&c.source===wanted.source);if(i<0)throw new Error('Inconsistent public card inventory: '+JSON.stringify({pid,wanted,phase:o.phase,round:o.round,execution:o.executionIndex,pool}));const c=pool.splice(i,1)[0];if(id!==undefined)c.id=id;return c;};
 for(const p of o.players){const knownLoot:Record<number,number>={};for(const b of s.bandits)if(b.controller===p.id)for(const l of b.loot)knownLoot[l.id]=l.value;
  if(p.id===o.viewer)for(const l of allLoot)if(l.value!==null)knownLoot[l.id]=l.value;
  s.players.push({id:p.id,hand:p.hand?.map(c=>take(p.id,c,c.id))??[],deck:[],discard:p.discard.map(c=>take(p.id,c,c.id)),knownLoot,firstTurnUsed:p.firstTurnUsed});
 }
 // Reserve every visible future card before sampling any hidden queue entry.
 const reserved=o.queue.map((q,i)=>i>=o.executionIndex&&q.kind!==null&&q.bandit!==null?take(q.controller,{kind:q.kind,bandit:q.bandit}):null);
 for(let i=0;i<o.queue.length;i++){const q=o.queue[i];let c:Card;
  if(i<o.executionIndex){c={id:s.nextId++,kind:q.kind!,bandit:q.bandit!};}
  else if(reserved[i])c=reserved[i]!;
  else{const options=pools[q.controller].filter(c=>c.kind!=='bullet');if(!options.length)throw new Error('No possible hidden card.');const chosen=options[Math.floor(r()*options.length)];c=take(q.controller,chosen);}
  s.queue.push({controller:q.controller,card:c,hidden:q.hidden,turn:q.turn,revealed:q.revealed});
 }
 for(const p of o.players){const pool=shuffled(pools[p.id],r),sp=s.players[p.id];if(p.hand===null)sp.hand=pool.splice(0,p.handCount);sp.deck=pool.splice(0,p.deckCount);sp.discard.push(...pool);if(sp.hand.length!==p.handCount||sp.deck.length!==p.deckCount)throw new Error('Inconsistent hand or deck count.');}
 const used=new Set([...o.previousRounds,o.roundCard.id]),remaining=shuffled(copy(o.players.length<=4?SMALL_ROUNDS:LARGE_ROUNDS).filter(c=>!used.has(c.id)),r);
 // Past rounds are never revisited, but retain their public IDs for rollout observations.
 s.rounds=o.previousRounds.map(id=>copy([...SMALL_ROUNDS,...LARGE_ROUNDS,...STATIONS].find(c=>c.id===id)!));s.rounds.push(copy(o.roundCard));
 while(s.rounds.length<4)s.rounds.push(remaining.pop()!);if(s.rounds.length<5)s.rounds.push(copy(STATIONS[Math.floor(r()*STATIONS.length)]) as RoundCard);
 return s;
}
export interface SearchOptions {samples?:number;maxCandidates?:number;prior?:number;rollout?:'tactical'|'policy';}
export interface SearchResult {index:number;simulations:number;milliseconds:number;estimates:{index:number;value:number;prior:number}[]}
/** Root information-set Monte Carlo search with paired samples and observation-safe rollouts.
 * Uniform hidden-card beliefs are an approximation; this is not equilibrium-solving IS-MCTS.
 */
export function search(m:Model,o:Observation,seed:number,options:SearchOptions={}):SearchResult{
 const start=performance.now(),r=seeded(seed),logits=infer(m,o).logits,priors=softmax(logits,.4),ranked=o.legal.map((_,i)=>i).sort((a,b)=>priors[b]-priors[a]);
 const fallback=()=>({index:ranked[0],simulations:0,milliseconds:performance.now()-start,estimates:[]});
 if(o.legal.length<2||!['scheme','cover','execute'].includes(o.phase))return fallback();
 const candidates=ranked.slice(0,options.maxCandidates??6),sums=candidates.map(()=>0),samples=options.samples??20;
 for(let sample=0;sample<samples;sample++){
  const world=sampleWorld(o,Math.floor(r()*2**32)),rollSeed=Math.floor(r()*2**32);
  for(let ci=0;ci<candidates.length;ci++){
   const s=copy(world),rr=seeded(rollSeed);applyAction(s,o.legal[candidates[ci]],false);let steps=0;
   while(s.phase!=='finished'&&steps++<1300){const actions=legalActions(s);let index=0;
    if(actions.length>1){const ob=observe(s,s.actor);if(options.rollout==='policy') {const ls=infer(m,ob).logits;index=ls.indexOf(Math.max(...ls));}else index=baseline(ob,s.actor===o.viewer?'tactical':sample%4===0?'greedy':'tactical',rr);}
    applyAction(s,actions[index],false);
   }
   if(s.phase!=='finished')throw new Error('Search rollout did not finish.');
   const win=s.winners.includes(o.viewer)?1/s.winners.length:0,max=Math.max(...s.scores),probs=s.scores.map(v=>Math.exp((v-max)/500));
   sums[ci]+=.75*win+.25*probs[o.viewer]/probs.reduce((a,b)=>a+b,0);
  }
 }
 const estimates=candidates.map((index,ci)=>({index,value:sums[ci]/samples+(options.prior??.08)*priors[index],prior:priors[index]})).sort((a,b)=>b.value-a.value);
 return{index:estimates[0].index,simulations:samples*candidates.length,milliseconds:performance.now()-start,estimates};
}
