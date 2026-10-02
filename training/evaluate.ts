import fs from 'node:fs';
import {createGame,observe,applyAction,legalActions} from '../src/game/engine';
import {baseline,type Baseline} from '../src/ai/tactics';
import {modelChoice,type Model} from '../src/ai/network';
import {seeded} from '../src/game/random';
const arg=(key:string,fallback:string)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const candidate=arg('--candidate','tactical'),opponent=arg('--opponent','greedy'),games=Number(arg('--games','500')),seed=Number(arg('--seed','900001')),playerArg=arg('--players','mixed'),out=arg('--out','');
const load=(v:string)=>v.endsWith('.json')?JSON.parse(fs.readFileSync(v,'utf8')) as Model:null;
const model=load(candidate),other=load(opponent),r=seeded(seed+123),records:{players:number;seat:number;win:number;score:number;seed:number}[]=[];const start=performance.now();
for(let game=0;game<games;game++){
 const players=playerArg==='mixed'?2+game%5:Number(playerArg),seat=Math.floor(game/5)%players,s=createGame({players,seed:seed+game*31337});let steps=0;
 while(s.phase!=='finished'&&steps++<1500){const legal=legalActions(s);if(legal.length===1){applyAction(s,legal[0],false);continue;}const o=observe(s,s.actor),isCandidate=s.actor===seat,m=isCandidate?model:other,p=isCandidate?candidate:opponent;
 const i=m?modelChoice(m,o,r,.1):baseline(o,p as Baseline,r);applyAction(s,legal[i],false);
 }
 if(s.phase!=='finished')throw new Error('Nonterminating game');records.push({players,seat,win:s.winners.includes(seat)?1/s.winners.length:0,score:s.scores[seat],seed:s.seed});
 if((game+1)%100===0)process.stderr.write(`Evaluated ${game+1}/${games}\n`);
}
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const summarize=(rs:typeof records)=>{const wins=rs.reduce((a,b)=>a+b.win,0),rate=wins/rs.length,z=1.96,den=1+z*z/rs.length,center=(rate+z*z/(2*rs.length))/den,half=z*Math.sqrt(rate*(1-rate)/rs.length+z*z/(4*rs.length*rs.length))/den;return{games:rs.length,winRate:rate,approx95:[Math.max(0,center-half),Math.min(1,center+half)],chance:mean(rs.map(r=>1/r.players)),averageScore:mean(rs.map(r=>r.score))};};
const report={candidate,opponent,seed,seconds:(performance.now()-start)/1000,overall:summarize(records),byPlayers:Object.fromEntries([2,3,4,5,6].filter(n=>records.some(r=>r.players===n)).map(n=>[n,summarize(records.filter(r=>r.players===n))])),records};
console.log(JSON.stringify({...report,records:undefined},null,2));if(out)fs.writeFileSync(out,JSON.stringify(report,null,2));
