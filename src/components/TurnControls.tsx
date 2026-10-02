import {useState} from 'react';
import type {Action,Card,Observation} from '../game/types';
import {ACTION_INFO,CHARACTER_INFO,CAR_PROFILES} from '../game/data';
import {ActionCard} from './ActionCard';
import {Portrait} from './Portrait';
export const carName=(o:Observation,n:number)=>n===0?'Locomotive':`Car ${n} · ${CAR_PROFILES[o.cars[n].profile].name}`;
function lootName(o:Observation,id:number){const l=[...o.bandits.flatMap(b=>b.loot),...o.cars.flatMap(c=>c.loot.flat())].find(l=>l.id===id);return l?`${l.kind==='strongbox'?'Strongbox':l.kind==='jewel'?'Jewel':'Purse'}${l.value!==null?` · $${l.value}`:''}`:'No loot';}
function groupCards(cards:Card[]){const groups:{card:Card;count:number}[]=[];for(const card of cards){const old=groups.find(x=>x.card.kind===card.kind&&x.card.bandit===card.bandit);if(old)old.count++;else groups.push({card,count:1});}return groups;}
export function TurnControls({o,onAction,thinking,status}:{o:Observation;onAction:(a:Action)=>void;thinking:boolean;status:string}){const [hidden,setHidden]=useState(true),legal=o.legal,mine=o.actor===0;
 const hand=o.players[0].hand??[],own=o.bandits.filter(b=>b.controller===0),loot=own.reduce((n,b)=>n+b.loot.reduce((v,l)=>v+(l.value??0),0),0);
 const q=o.queue[o.executionIndex],b=o.phase==='execute'&&q?.bandit!==null?o.bandits[q?.bandit??0]:own[0];
 let title=mine?`Your turn, ${CHARACTER_INFO[b.character].name}`:`${o.bandits.filter(b=>b.controller===o.actor).map(b=>CHARACTER_INFO[b.character].name).join(' & ')} ${thinking?'is thinking…':'is playing'}`;
 const slot=o.schedule[o.scheduleIndex],turn=slot?o.roundCard.turns[slot.turn]:null;
 let description=turn==='tunnel'?'Tunnel: play face down, or draw 3 cards.':turn==='double'?'Two turns each: play a card or draw 3.':'Play a card or draw 3 cards.';
 if(o.phase==='choose'){title=mine?'Choose your opening card':title;description='Keep one card, then draw the rest of your team’s hand.';}
 if(o.phase==='cover'){title=mine?'Give your partner cover':title;description='Your shot lets your other bandit play one extra action. Marshal is excluded.';}
 if(o.phase==='retain'){title=mine?'Plan for the next round':title;description='Keep this card in your hand or send it to your discard pile.';}
 if(o.phase==='execute'){title=`${CHARACTER_INFO[b.character].name} · ${ACTION_INFO[q?.kind??'move'].name}`;description=mine?'Choose how to carry out your action.':'The programmed action is being resolved.';if(legal.length===1&&legal[0].kind==='pass')description='There is no legal target here. This action has no effect.';}
 if(o.phase==='event'){title=mine?'A chance to pick a pocket':title;description='You are alone here. You may take one purse.';}
 const ghost=legal.some(a=>a.kind==='play'&&a.hidden)&&legal.some(a=>a.kind==='play'&&!a.hidden);
 const play=(card:Card)=>{const options=legal.filter((a):a is Extract<Action,{kind:'play'}>=>a.kind==='play'&&a.card===card.id);const action=options.find(a=>a.hidden===hidden)??options[0];if(action)onAction(action);};
 const cards=o.phase==='choose'&&mine?o.selectionCards:hand;
 return <section className="turn-area"><div className="turn-prompt" aria-live="polite"><h2>{title}</h2><p>{description}</p></div>
 <div className="hand-layout"><aside className="your-bandit"><div className="your-portraits">{own.map(x=><Portrait key={x.id} character={x.character}/>)}</div><div><h2 style={{color:CHARACTER_INFO[own[0].character].color}}>{own.map(x=>CHARACTER_INFO[x.character].name).join(' & ')}</h2><strong className="your-loot">${loot.toLocaleString()}</strong><span className="your-caption">your loot</span><p>{own.reduce((n,b)=>n+b.wounds,0)} wounds · {o.players[0].deckCount} in deck</p></div></aside>
 <div className="decision-area">
 {(o.phase==='scheme'||o.phase==='cover'||o.phase==='choose')?<><div className="hand-scroll" aria-label={o.phase==='choose'?'Opening card choices':'Your action cards'}>{groupCards(cards).map(({card,count})=><ActionCard key={card.id} card={card} count={count} character={o.team?o.bandits[card.bandit].character:undefined} disabled={!mine||!legal.some(a=>('card'in a)&&a.card===card.id)} onClick={()=>o.phase==='choose'?onAction({kind:'choose',card:card.id}):play(card)}/>)}{!cards.length?<p className="empty-hand">No cards in hand. Draw to find your next move.</p>:null}</div>
 {ghost?<label className="ghost-toggle"><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/>Use Ghost’s power: play face down</label>:null}</>:
 o.phase==='retain'&&mine?<div className="retain-choice">{hand[0]?<ActionCard card={hand[0]} compact disabled/>:null}<div><button className="primary" onClick={()=>onAction(legal.find(a=>a.kind==='keep')!)}>Keep for next round</button><button onClick={()=>onAction(legal.find(a=>a.kind==='discard')!)}>Discard this card</button></div></div>:
 mine?<ResolutionChoices key={`${o.round}-${o.executionIndex}-${o.phase}`} o={o} onAction={onAction}/>:<div className="watching"><div className="mini-hand">{groupCards(hand).map(({card,count})=><ActionCard key={card.id} card={card} count={count} character={o.team?o.bandits[card.bandit].character:undefined} disabled compact/>)}</div><p>Watch the train. Your next choice is coming.</p></div>}
 </div>
 <div className="hand-actions">{mine&&legal.some(a=>a.kind==='draw')?<button className="primary" onClick={()=>onAction({kind:'draw'})}>Draw 3 cards</button>:null}{mine&&o.phase==='cover'?<button onClick={()=>onAction({kind:'pass'})}>Skip cover</button>:null}<div className="deck-stack" aria-hidden="true"><i/><i/><i/></div><p><strong>{o.players[0].deckCount} cards</strong><br/>in your deck</p>{status==='loading'?<small>Loading trained AI…</small>:null}</div>
 </div></section>;
}
function ResolutionChoices({o,onAction}:{o:Observation;onAction:(a:Action)=>void}){const legal=o.legal,[target,setTarget]=useState<number|null>(null),[loot,setLoot]=useState<number|null|undefined>(undefined);
 if(legal[0]?.kind==='punch'){
  const punches=legal as Extract<Action,{kind:'punch'}>[],targets=[...new Set(punches.map(a=>a.target))],chosen=target??(targets.length===1?targets[0]:null),tokens=chosen===null?[]:[...new Set(punches.filter(a=>a.target===chosen).map(a=>a.loot))],chosenLoot=loot??(tokens.length===1?tokens[0]:undefined);
  return <div className="punch-choices"><span className="choice-label">Punch a bandit</span><div className="choice-grid">{targets.map(t=><button key={t} className={'target-choice '+(chosen===t?'chosen':'')} onClick={()=>{setTarget(t);setLoot(undefined);}}><Portrait character={o.bandits[t].character}/>{CHARACTER_INFO[o.bandits[t].character].name}</button>)}</div>
  {chosen!==null?<><span className="choice-label">Choose the loot they drop</span><div className="choice-grid">{tokens.map(l=><button key={l??'none'} className={chosenLoot===l?'chosen':''} onClick={()=>setLoot(l)}>{l===null?'No loot to drop':lootName(o,l)}</button>)}</div></>:null}
  {chosen!==null&&chosenLoot!==undefined?<><span className="choice-label">Push them toward…</span><div className="choice-grid">{punches.filter(a=>a.target===chosen&&a.loot===chosenLoot).map(a=><button className="primary" key={a.to} onClick={()=>onAction(a)}>{carName(o,a.to)}</button>)}</div></>:null}</div>;
 }
 return <div className="choice-grid resolution-grid">{legal.map((a,i)=>{if(a.kind==='shoot')return <button key={i} className="target-choice" onClick={()=>onAction(a)}><Portrait character={o.bandits[a.target].character}/><span>Shoot {CHARACTER_INFO[o.bandits[a.target].character].name}</span></button>;
 if(a.kind==='move'||a.kind==='marshal')return <button key={i} className="destination-choice" onClick={()=>onAction(a)}><span className="destination-number">{a.to===0?'L':a.to}</span><span>{a.kind==='marshal'?'Marshal to':'Move to'}<strong>{carName(o,a.to)}</strong></span></button>;
 if(a.kind==='loot')return <button key={i} className="loot-choice" onClick={()=>onAction(a)}><span className="loot-symbol">$</span>Take {lootName(o,a.loot)}</button>;
 if(a.kind==='climb')return <button key={i} className="primary" onClick={()=>onAction(a)}>Change floor</button>;
 if(a.kind==='pass')return <button key={i} onClick={()=>onAction(a)}>{o.phase==='event'?'Leave the purse':'No action possible'}</button>;
 return null;})}</div>;
}
