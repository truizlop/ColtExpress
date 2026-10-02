import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { wood, trim, iron, brass, printedMark } from './materials';
const cube = new RoundedBoxGeometry(1, 1, 1, 1, 0.045),
  rock = new THREE.DodecahedronGeometry(1, 0),
  green = new THREE.MeshStandardMaterial({ color: '#686c43', roughness: 1 }),
  stone = new THREE.MeshStandardMaterial({ color: '#a18a69', roughness: 1 });
function Beam({
  p,
  s,
  material = wood,
  rotation = [0, 0, 0],
}: {
  p: [number, number, number];
  s: [number, number, number];
  material?: THREE.Material;
  rotation?: [number, number, number];
}) {
  return (
    <mesh
      geometry={cube}
      position={p}
      scale={s}
      rotation={rotation}
      material={material}
      castShadow
      receiveShadow
    />
  );
}
function Barrel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.36, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.68, 14, 3]} />
      </mesh>
      {[0.1, 0.35, 0.61].map((y) => (
        <mesh key={y} material={iron} position={[0, y, 0]}>
          <cylinderGeometry args={[0.294, 0.294, 0.037, 14]} />
        </mesh>
      ))}
      <mesh material={trim} position={[0, 0.71, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.266, 14]} />
      </mesh>
      <Beam p={[0, 0.724, 0]} s={[0.51, 0.028, 0.065]} material={iron} />
    </group>
  );
}
function Crate({ position, size = 0.7 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position} rotation={[0, 0.18, 0]}>
      <Beam p={[0, size / 2, 0]} s={[size, size, size]} material={wood} />
      {[-0.34, 0.34].map((x) => (
        <Beam
          key={x}
          p={[(x * size) / 0.7, size / 2, size / 2 + 0.018]}
          s={[0.07, size + 0.045, 0.065]}
          material={trim}
        />
      ))}
      {[0.04, size - 0.035].map((y) => (
        <Beam key={y} p={[0, y, size / 2 + 0.018]} s={[size, 0.065, 0.065]} material={trim} />
      ))}
      <Beam
        p={[0, size / 2, size / 2 + 0.029]}
        s={[0.063, size * 1.23, 0.064]}
        material={trim}
        rotation={[0, 0, -0.71]}
      />
    </group>
  );
}
function Cactus({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.76, 0]} material={green} castShadow>
        <capsuleGeometry args={[0.13, 1.3, 4, 10]} />
      </mesh>
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <mesh
            position={[side * 0.19, 0.63 + i * 0.26, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={green}
            castShadow
          >
            <capsuleGeometry args={[0.095, 0.24, 4, 8]} />
          </mesh>
          <mesh position={[side * 0.36, 0.89 + i * 0.26, 0]} material={green} castShadow>
            <capsuleGeometry args={[0.095, 0.45, 4, 8]} />
          </mesh>
        </group>
      ))}
      {[-0.045, 0.045].map((x) => (
        <Beam key={x} p={[x, 0.79, 0.119]} s={[0.014, 1.3, 0.012]} material={wood} />
      ))}
    </group>
  );
}
export function DesertProps({ count }: { count: number }) {
  const end = (count - 1) * 3.65;
  return (
    <group>
      <Cactus position={[-3.3, -0.02, -1.8]} scale={1.12} />
      <Cactus position={[end + 2.8, -0.02, -2.1]} scale={0.95} />
      <Cactus position={[end * 0.4, -0.02, -3.5]} scale={0.64} />
      <Barrel position={[-2.8, 0, 3]} />
      <Crate position={[-1.9, 0, 3.15]} size={0.6} />
      <Crate position={[end + 0.6, 0, 3]} size={0.72} />
      <Crate position={[end + 1.43, 0, 3.2]} size={0.5} />
      {Array.from({ length: 15 }, (_, i) => (
        <mesh
          key={i}
          geometry={rock}
          material={stone}
          position={[-3 + (i * (end + 6)) / 14, 0.03, (i % 2 ? -1 : 1) * (2.2 + (i % 3) * 0.47)]}
          scale={[0.14 + (i % 3) * 0.09, 0.1 + (i % 2) * 0.11, 0.19 + (i % 3) * 0.07]}
          rotation={[i * 0.6, i * 2.3, i * 0.12]}
          castShadow
          receiveShadow
        />
      ))}
      <group position={[end - 1.5, 0, -3.8]} rotation={[0, -0.13, 0]}>
        <Beam p={[0, 1.2, 0]} s={[0.09, 2.4, 0.1]} material={wood} />
        <Beam p={[0, 2.15, 0]} s={[1.45, 0.25, 0.08]} material={wood} />
        <Beam p={[0.08, 1.82, 0]} s={[1.33, 0.22, 0.08]} material={trim} />
        <mesh position={[0, 2.15, 0.049]} material={printedMark('TUCSON', '#ead7ac')}>
          <planeGeometry args={[1.17, 0.23]} />
        </mesh>
        <mesh position={[0.08, 1.82, 0.049]} material={printedMark('EXPRESS', '#42321f')}>
          <planeGeometry args={[1.09, 0.2]} />
        </mesh>
        <mesh position={[0.71, 2.15, 0.01]} rotation={[0, 0, -Math.PI / 2]} material={brass}>
          <coneGeometry args={[0.13, 0.22, 3]} />
        </mesh>
      </group>
    </group>
  );
}
