import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Html,OrbitControls} from '@react-three/drei';
import {Suspense,useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import type {Observation,VisibleLoot} from '../game/types';
import {CHARACTER_INFO,CAR_PROFILES} from '../game/data';
const LENGTH=3.65,WIDTH=2.0,FLOOR=.72,ROOF=2.7;
const brass=new THREE.MeshStandardMaterial({color:'#b58d50',roughness:.44,metalness:.58});
const dark=new THREE.MeshStandardMaterial({color:'#282b28',roughness:.72,metalness:.3});
const iron=new THREE.MeshStandardMaterial({color:'#424740',roughness:.63,metalness:.5});
const wood=new THREE.MeshStandardMaterial({color:'#94684b',roughness:.94});
const trim=new THREE.MeshStandardMaterial({color:'#c69a69',roughness:.86});
const roofMaterial=new THREE.MeshStandardMaterial({color:'#b29272',roughness:.91});
const red=new THREE.MeshStandardMaterial({color:'#824a39',roughness:.96});
const boxGeo=new THREE.BoxGeometry(1,1,1);
function Box({position,scale,material=wood,rotation=[0,0,0]}:{position:[number,number,number];scale:[number,number,number];material?:THREE.Material;rotation?:[number,number,number]}){return <mesh geometry={boxGeo} material={material} position={position} scale={scale} rotation={rotation} castShadow receiveShadow/>;}
function Wheel({x,z,r=.34}:{x:number;z:number;r?:number}){return <group position={[x,.4,z]} rotation={[Math.PI/2,0,0]}>
 <mesh material={dark} castShadow><cylinderGeometry args={[r,r,.13,16]}/></mesh>
 <mesh material={brass} rotation={[Math.PI/2,0,0]} position={[0,z>0?.075:-.075,0]}><torusGeometry args={[r*.82,.026,5,20]}/></mesh>
 {[0,Math.PI/3,Math.PI*2/3].map(a=><Box key={a} position={[0,z>0?.083:-.083,0]} scale={[r*1.52,.035,.035]} rotation={[0,a,0]} material={trim}/>)}
 <mesh material={brass} position={[0,z>0?.09:-.09,0]}><cylinderGeometry args={[.08,.08,.07,10]}/></mesh>
 </group>;}
function Chassis({length=3.3}:{length?:number}){return <>
 <Box position={[0,.57,0]} scale={[length,.22,WIDTH+.06]} material={dark}/>
 {[-1.05,0,1.05].map(x=><group key={x}><Box position={[x,.4,0]} scale={[.12,.12,2.2]} material={iron}/><Wheel x={x} z={1.06}/><Wheel x={x} z={-1.06}/></group>)}
 <Box position={[0,.34,1.17]} scale={[2.35,.045,.045]} material={brass}/><Box position={[0,.34,-1.17]} scale={[2.35,.045,.045]} material={brass}/>
 {[-1,1].map(i=><group key={i}><Box position={[i*1.74,.58,0]} scale={[.5,.09,.16]} material={iron}/><mesh position={[i*1.89,.58,0]} rotation={[Math.PI/2,0,0]} material={iron}><torusGeometry args={[.14,.035,6,12]}/></mesh></group>)}
 </>;}
function Carriage({profile,index,selected,onChoose}:{profile:number;index:number;selected:boolean;onChoose:(car:number,floor:0|1)=>void}){const panel=useMemo(()=>new THREE.MeshStandardMaterial({color:CAR_PROFILES[profile].color,roughness:.95}),[profile]);
 return <group position={[index*LENGTH,0,0]}>
  <Chassis/>
  <Box position={[0,FLOOR-.01,0]} scale={[3.3,.13,2.06]} material={wood}/>
  {Array.from({length:11},(_,i)=><Box key={i} position={[-1.5+i*.3,FLOOR+.07,0]} scale={[.285,.055,1.94]} material={i%3===0?trim:wood}/>)}
  <mesh position={[0,FLOOR+.12,0]} rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onChoose(index,0);}}><planeGeometry args={[3.25,1.95]}/><meshBasicMaterial color={selected?'#e0bf5b':'#ffffff'} transparent opacity={selected?.12:0} depthWrite={false}/></mesh>
  {[-1.58,1.58].map(x=><group key={x}>
   {[-.9,.9].map(z=><group key={z}><Box position={[x,1.73,z]} scale={[.16,1.98,.17]} material={trim}/><Box position={[x,1.02,z]} scale={[.2,.06,.2]} material={brass}/><Box position={[x,2.41,z]} scale={[.2,.06,.2]} material={brass}/></group>)}
   <Box position={[x,1.04,0]} scale={[.12,.42,1.7]} material={panel}/>
   <Box position={[x,2.4,0]} scale={[.12,.48,1.7]} material={panel}/>
   <Box position={[x,1.72,-.73]} scale={[.12,1.1,.28]} material={panel}/><Box position={[x,1.72,.73]} scale={[.12,1.1,.28]} material={panel}/>
   <Box position={[x,1.51,0]} scale={[.13,.08,.95]} material={brass}/>
  </group>)}
  <Box position={[0,1.03,-.94]} scale={[3.12,.47,.13]} material={panel}/>
  <Box position={[0,2.45,-.94]} scale={[3.12,.41,.13]} material={panel}/>
  {[-1.08,0,1.08].map(x=><Box key={x} position={[x,1.78,-.94]} scale={[.105,1.08,.13]} material={trim}/>)}
  {[-1.45,1.45].map(x=><group key={x}><Box position={[x,1.85,-.8]} scale={[.21,1.0,.10]} material={red}/><Box position={[x,1.7,-.73]} scale={[.22,.09,.12]} material={brass}/></group>)}
  <Box position={[0,1.12,-.58]} scale={[2.7,.16,.42]} material={red}/>
  {[-1.18,1.18].map(x=><Box key={x} position={[x,.94,-.58]} scale={[.1,.31,.3]} material={dark}/>)}
  <Box position={[0,ROOF-.08,0]} scale={[3.48,.12,2.2]} material={dark}/>
  {Array.from({length:12},(_,i)=><Box key={i} position={[-1.6+i*.291,ROOF,0]} scale={[.278,.17,2.21]} material={roofMaterial}/>)}
  {[-1.03,1.03].map(z=><Box key={z} position={[0,ROOF+.12,z]} scale={[3.44,.08,.07]} material={trim}/>)}
  <mesh position={[0,ROOF+.10,0]} rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onChoose(index,1);}}><planeGeometry args={[3.45,2.2]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  <Html center position={[0,.03,1.47]} zIndexRange={[10,0]}><span className={'car-label'+(selected?' selected':'')}>{index}. {CAR_PROFILES[profile].name}</span></Html>
 </group>;
}
function Locomotive({onChoose}:{onChoose:(car:number,floor:0|1)=>void}){return <group>
 <Chassis length={3.6}/>
 <Box position={[.85,.76,0]} scale={[1.7,.12,2.05]} material={wood}/>
 <group position={[-.65,1.28,0]} rotation={[0,0,Math.PI/2]}>
  <mesh material={dark} castShadow><cylinderGeometry args={[.66,.66,2.15,24]}/></mesh>
  {[-.85,0,.85].map(y=><mesh key={y} position={[0,y,0]} material={brass}><cylinderGeometry args={[.683,.683,.045,24]}/></mesh>)}
 </group>
 <mesh material={iron} position={[-1.77,1.28,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.59,.59,.14,24]}/></mesh>
 <mesh material={brass} position={[-1.86,1.28,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.17,.17,.07,16]}/></mesh>
 <mesh position={[-1.3,2.1,0]} material={dark} castShadow><cylinderGeometry args={[.28,.2,1.05,16]}/></mesh>
 <mesh position={[-1.3,2.7,0]} material={dark} castShadow><cylinderGeometry args={[.43,.27,.25,16]}/></mesh>
 <mesh position={[-1.3,2.84,0]} material={brass}><torusGeometry args={[.4,.03,6,20]}/></mesh>
 <mesh position={[-.35,2.02,0]} material={brass} castShadow><sphereGeometry args={[.23,12,10,0,Math.PI*2,0,Math.PI/2]}/></mesh>
 {[-.9,.9].map(z=><group key={z}><Box position={[-.55,.9,z]} scale={[2.3,.04,.06]} material={brass}/><Box position={[-.55,1.28,z]} scale={[2.3,.04,.04]} material={brass}/></group>)}
 <Box position={[1.43,1.64,-.91]} scale={[.12,1.75,.16]} material={brass}/><Box position={[.32,1.64,-.91]} scale={[.12,1.75,.16]} material={brass}/>
 <Box position={[.89,1.07,-.91]} scale={[1.28,.56,.12]} material={dark}/><Box position={[.89,2.35,-.91]} scale={[1.28,.4,.12]} material={dark}/>
 {[-.9,.9].map(z=><group key={z}><Box position={[1.6,1.7,z]} scale={[.13,1.85,.13]} material={dark}/><Box position={[.24,1.7,z]} scale={[.13,1.85,.13]} material={dark}/></group>)}
 <Box position={[.94,ROOF,0]} scale={[1.79,.19,2.27]} material={dark}/><Box position={[.94,ROOF+.11,0]} scale={[1.89,.035,2.32]} material={brass}/>
 <Box position={[.94,.83,.97]} scale={[1.55,.045,.07]} material={brass}/>
 <mesh position={[-2.03,.46,0]} rotation={[0,0,-.33]} material={dark} castShadow><boxGeometry args={[.6,.12,2.14]}/></mesh>
 {Array.from({length:9},(_,i)=><Box key={i} position={[-2.08,.47,-.98+i*.245]} scale={[.7,.065,.065]} rotation={[0,0,-.33]} material={brass}/>)}
 <mesh position={[.85,FLOOR+.11,0]} rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onChoose(0,0);}}><planeGeometry args={[1.5,1.9]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
 <mesh position={[.95,ROOF+.16,0]} rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();onChoose(0,1);}}><planeGeometry args={[1.8,2.25]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
 <Html center position={[0,.03,1.47]} zIndexRange={[10,0]}><span className="car-label">Locomotive</span></Html>
 </group>;}
function Track({cars}:{cars:number}){const length=cars*LENGTH+4;return <group>
 {Array.from({length:Math.ceil(length/.43)},(_,i)=><Box key={i} position={[-3.6+i*.43,.035,0]} scale={[.2,.1,2.8]} material={i%3?wood:dark}/>)}
 {[-.98,.98].map(z=><group key={z}><Box position={[length/2-3.7,.14,z]} scale={[length,.14,.12]} material={iron}/><Box position={[length/2-3.7,.23,z]} scale={[length,.035,.19]} material={brass}/></group>)}
 </group>;}
const pawnGeometry=(()=>{const s=new THREE.Shape();s.moveTo(-.22,0);s.lineTo(-.09,0);s.lineTo(0,.25);s.lineTo(.09,0);s.lineTo(.22,0);s.lineTo(.15,.42);s.lineTo(.28,.28);s.lineTo(.36,.37);s.lineTo(.18,.62);s.lineTo(.12,.63);s.lineTo(.12,.78);s.lineTo(.3,.79);s.lineTo(.3,.87);s.lineTo(.13,.89);s.lineTo(.10,1.04);s.lineTo(-.10,1.04);s.lineTo(-.13,.89);s.lineTo(-.3,.87);s.lineTo(-.3,.79);s.lineTo(-.12,.78);s.lineTo(-.12,.63);s.lineTo(-.18,.62);s.lineTo(-.36,.37);s.lineTo(-.28,.28);s.lineTo(-.15,.42);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025});g.translate(0,0,-.09);return g;})();
function Pawn({position,color,label,active,marshal=false}:{position:[number,number,number];color:string;label:string;active:boolean;marshal?:boolean}){const group=useRef<THREE.Group>(null);const target=useMemo(()=>new THREE.Vector3(...position),[position[0],position[1],position[2]]);const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 useFrame((_,dt)=>{if(group.current)group.current.position.lerp(target,reduced?1:1-Math.exp(-dt*7));});
 return <group ref={group} position={position}>
 <mesh geometry={pawnGeometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.67}/></mesh>
 <Box position={[0,.86,.12]} scale={[.39,.045,.04]} material={marshal?dark:brass}/>
 <mesh position={[0,.56,.145]} rotation={[Math.PI/2,0,0]} material={brass}><cylinderGeometry args={[marshal?.082:.035,marshal?.082:.035,.02,marshal?6:8]}/></mesh>
 {active?<mesh position={[0,.02,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.4,.46,32]}/><meshBasicMaterial color="#ffe5a0" transparent opacity={.9}/></mesh>:null}
 <Html center position={[0,1.26,0]} distanceFactor={25} zIndexRange={[15,1]}><span className={'pawn-label'+(active?' active':'')}>{label}</span></Html>
 </group>;
}
function LootPiece({loot,position}:{loot:VisibleLoot;position:[number,number,number]}){return <group position={position}>
 {loot.kind==='purse'?<><mesh position={[0,.16,0]} scale={[1,.86,.8]} castShadow><sphereGeometry args={[.19,10,8]}/><meshStandardMaterial color="#e4d4a4" roughness={1}/></mesh><mesh position={[0,.33,0]} castShadow><coneGeometry args={[.1,.16,7]}/><meshStandardMaterial color="#d8c48d" roughness={1}/></mesh><mesh position={[0,.28,0]} rotation={[Math.PI/2,0,0]} material={dark}><torusGeometry args={[.064,.018,4,8]}/></mesh></>:loot.kind==='jewel'?<mesh position={[0,.17,0]} rotation={[.3,.4,.2]} castShadow><octahedronGeometry args={[.22]}/><meshStandardMaterial color="#ba3438" roughness={.28} metalness={.35} flatShading/></mesh>:<><Box position={[0,.16,0]} scale={[.54,.3,.36]} material={wood}/>{[-.18,.18].map(x=><Box key={x} position={[x,.18,0]} scale={[.045,.32,.39]} material={brass}/>)}<Box position={[0,.19,.195]} scale={[.085,.1,.025]} material={brass}/><mesh position={[0,.34,0]} material={dark}><torusGeometry args={[.1,.022,5,10,Math.PI]}/></mesh></>}
 </group>;}
function CameraRig({count,focus}:{count:number;focus:number}){const {camera,size}=useThree();const controls=useRef<any>(null);
 useEffect(()=>{const mobile=size.width<700,center=focus<0?(count-1)*LENGTH/2:focus*LENGTH,width=focus<0?count*LENGTH+4:(mobile?7.2:11);const cam=camera as THREE.OrthographicCamera;
 cam.position.set(center-1.3,7.3,14.5);cam.zoom=Math.min(size.width/width,size.height/6.7);cam.near=.1;cam.far=180;cam.updateProjectionMatrix();cam.lookAt(center,1.2,0);
 if(controls.current){controls.current.target.set(center,1.2,0);controls.current.update();}
 },[camera,size.width,size.height,count,focus]);
 return <OrbitControls ref={controls} enablePan={false} minZoom={12} maxZoom={180} minPolarAngle={.77} maxPolarAngle={1.38} minAzimuthAngle={-.38} maxAzimuthAngle={.38} enableDamping dampingFactor={.1}/>;
}
function Table({o,focus,onChoose}:{o:Observation;focus:number;onChoose:(car:number,floor:0|1)=>void}){const active=o.phase==='execute'?o.queue[o.executionIndex]?.bandit:o.bandits.find(b=>b.controller===o.actor)?.id;
 return <><ambientLight intensity={1.35} color="#fff3d5"/><hemisphereLight args={['#d9e6e7','#8e6846',1.5]}/><directionalLight position={[-6,12,8]} intensity={3.1} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.0008}/>
 <CameraRig count={o.cars.length} focus={focus}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[10,-.02,0]} receiveShadow><planeGeometry args={[100,70]}/><shadowMaterial opacity={.22}/></mesh>
 <Track cars={o.cars.length}/><Locomotive onChoose={onChoose}/>
 {o.cars.slice(1).map((c,i)=><Carriage key={i} index={i+1} profile={c.profile} selected={focus===i+1} onChoose={onChoose}/>)}
 {o.cars.flatMap((c,car)=>c.loot.flatMap((ls,floor)=>ls.map((loot,i)=><LootPiece key={loot.id} loot={loot} position={[car*LENGTH+(car===0?.9:-1.0)+(i%4)*.52,floor?ROOF+.14:FLOOR+.13,-.43+Math.floor(i/4)*.55]}/>)))}
 {o.bandits.map(b=>{const same=o.bandits.filter(t=>t.car===b.car&&t.floor===b.floor),i=same.findIndex(t=>t.id===b.id),x=b.car*LENGTH+(b.car===0?.85:0)+(i-(same.length-1)/2)*.58;return <Pawn key={b.id} color={b.character==='ghost'?'#ebe1ca':b.character==='django'?'#322b27':CHARACTER_INFO[b.character].color} position={[x,b.floor?ROOF+.14:FLOOR+.15,.44]} label={CHARACTER_INFO[b.character].name} active={active===b.id}/>;})}
 <Pawn position={[o.marshal*LENGTH+(o.marshal===0?.85:0),FLOOR+.15,-.05]} color="#d8ae3b" label="Marshal" active={false} marshal/>
 </>;
}
export default function TrainScene({observation,focus,onFocus,onChoose}:{observation:Observation;focus:number;onFocus:(n:number)=>void;onChoose:(car:number,floor:0|1)=>void}){const [lost,setLost]=useState(false);
 return <div className="train-stage" aria-label="Interactive 3D train. Drag to rotate, scroll or pinch to zoom.">
 <div className="desert-backdrop"/>
 {lost?<div className="scene-fallback"><strong>The 3D view needs to reload.</strong><p>You can still play using the action buttons below.</p><button onClick={()=>setLost(false)}>Reload train</button></div>:<Canvas orthographic camera={{position:[7,7,15],zoom:35,near:.1,far:180}} dpr={[1,1.5]} shadows gl={{alpha:true,antialias:true,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setLost(true);});gl.setClearColor(0,0);}}><Suspense fallback={null}><Table o={observation} focus={focus} onChoose={onChoose}/></Suspense></Canvas>}
 <div className="train-controls"><button aria-label="Previous car" onClick={()=>onFocus(Math.max(0,(focus<0?observation.cars.length-1:focus)-1))}><Chevron left/></button><button className="fit-train" onClick={()=>onFocus(-1)}><TrainIcon/> Fit train</button><button aria-label="Next car" onClick={()=>onFocus(Math.min(observation.cars.length-1,(focus<0?0:focus)+1))}><Chevron/></button></div>
 </div>;
}
function Chevron({left=false}:{left?:boolean}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d={left?'M15 5 8 12l7 7':'m9 5 7 7-7 7'}/></svg>;}
function TrainIcon(){return <svg width="23" height="18" viewBox="0 0 28 20" fill="currentColor" aria-hidden="true"><path d="M2 3h9v11H2zm11 1h8v10h-8zm10 3h3v7h-3zM5 0h3v4H5z"/><circle cx="5" cy="16" r="2"/><circle cx="10" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="22" cy="16" r="2"/></svg>;}
