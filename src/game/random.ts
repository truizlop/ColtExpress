export function random(s:{rng:number}):number {
 s.rng=(s.rng+0x6D2B79F5)>>>0;let t=s.rng;
 t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
 return ((t^(t>>>14))>>>0)/4294967296;
}
export function shuffle<T>(s:{rng:number},a:T[]):T[]{
 for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function seeded(seed:number){const s={rng:seed>>>0};return ()=>random(s);}
