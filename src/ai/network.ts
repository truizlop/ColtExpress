import {encode,FEATURE_VERSION,STATE_DIM,ACTION_DIM} from './features';
import type {Observation} from '../game/types';
export interface Dense {weight:number[][];bias:number[]}
export interface Model {format:'colt-policy-v1';featureVersion:number;stateDim:number;actionDim:number;name:string;steps:number;layers:{state:Dense;action:Dense;joint:Dense;policy:Dense;value:Dense};metadata?:Record<string,unknown>}
function dense(layer:Dense,x:number[],activate=true){return layer.weight.map((row,i)=>{let t=layer.bias[i];for(let j=0;j<row.length;j++)t+=row[j]*x[j];return activate?Math.tanh(t):t;});}
export function validateModel(m:Model){if(m.format!=='colt-policy-v1'||m.featureVersion!==FEATURE_VERSION||m.stateDim!==STATE_DIM||m.actionDim!==ACTION_DIM)throw new Error('Unsupported AI model.');for(const l of Object.values(m.layers))if(l.weight.length!==l.bias.length||l.weight.some(r=>r.some(v=>!Number.isFinite(v))))throw new Error('Invalid model weights.');}
export function inferEncoded(m:Model,state:number[],actions:number[][]){const h=dense(m.layers.state,state);return{logits:actions.map(a=>dense(m.layers.policy,dense(m.layers.joint,[...h,...dense(m.layers.action,a)]),false)[0]),value:dense(m.layers.value,h,false)[0]};}
export function infer(m:Model,o:Observation){const f=encode(o);return inferEncoded(m,f.state,f.actions);}
export function softmax(logits:number[],temperature=1){const max=Math.max(...logits),ex=logits.map(x=>Math.exp((x-max)/Math.max(.01,temperature))),sum=ex.reduce((a,b)=>a+b,0);return ex.map(x=>x/sum);}
export function sample(logits:number[],rng:()=>number=Math.random,temperature=1){const probs=softmax(logits,temperature);let r=rng();for(let i=0;i<probs.length;i++){r-=probs[i];if(r<=0)return i;}return probs.length-1;}
export function modelChoice(m:Model,o:Observation,rng:()=>number=Math.random,temperature=.15){if(o.legal.length<2)return 0;return sample(infer(m,o).logits,rng,temperature);}
