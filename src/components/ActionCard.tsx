import type {Card} from '../game/types';
import {ACTION_KINDS} from '../game/types';
import {ACTION_INFO,CHARACTER_INFO} from '../game/data';
export function ActionCard({card,character,count=1,onClick,disabled=false,selected=false,compact=false}:{card:Card;character?:keyof typeof CHARACTER_INFO;count?:number;onClick?:()=>void;disabled?:boolean;selected?:boolean;compact?:boolean}){const i=ACTION_KINDS.indexOf(card.kind as typeof ACTION_KINDS[number]);const info=ACTION_INFO[card.kind];
 return <button className={'action-card '+(compact?'compact ':'')+(card.kind==='bullet'?'wound ':'')+(selected?'selected':'')} disabled={disabled||card.kind==='bullet'} onClick={onClick} title={info.description} aria-label={`${info.name}${count>1?`, ${count} copies`:''}${character?`, ${CHARACTER_INFO[character].name}`:''}`}>
 <span className="action-card-title">{info.name}</span>
 {card.kind==='bullet'?<span className="bullet-art"><i/><i/><i/></span>:<span className="action-art" style={{backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/>}
 <span className="action-card-foot">{character?<span style={{color:CHARACTER_INFO[character].color}}>{CHARACTER_INFO[character].name}</span>:<span>{card.kind==='bullet'?'Cannot play':info.name==='Move'?'1 car · 3 on roof':info.name==='Climb'?'Inside ↔ roof':info.name==='Shoot'?'Fire one bullet':info.name==='Punch'?'Push & drop loot':info.name==='Loot'?'Take one token':'Move one car'}</span>}<b>×{count}</b></span>
 </button>;
}
