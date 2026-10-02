import {CHARACTER_INFO} from '../game/data';
import type {Character} from '../game/types';
export function Portrait({character,className=''}:{character:Character;className?:string}){const i=CHARACTER_INFO[character].portrait;return <span className={'portrait '+className} role="img" aria-label={CHARACTER_INFO[character].name} style={{backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/>;}
