import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  brass,
  dark,
  iron,
  wood,
  trim,
  roofMaterial,
  red,
  ground,
  paper,
  useTrainMaterials,
  printedMark,
} from './materials';
import type { Observation, VisibleLoot } from '../game/types';
import { DesertProps } from './DesertProps';
import { CHARACTER_INFO, CAR_PROFILES } from '../game/data';
const LENGTH = 3.65,
  WIDTH = 2.0,
  FLOOR = 0.72,
  ROOF = 2.7;
const boxGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.045);
const rivetGeo = new THREE.SphereGeometry(0.038, 8, 6);
function Rivet({ position }: { position: [number, number, number] }) {
  return <mesh position={position} geometry={rivetGeo} material={brass} castShadow />;
}
function Box({
  position,
  scale,
  material = wood,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  scale: [number, number, number];
  material?: THREE.Material;
  rotation?: [number, number, number];
}) {
  return (
    <mesh
      geometry={boxGeo}
      material={material}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow
      receiveShadow
    />
  );
}
function Wheel({ x, z, r = 0.34 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, 0.4, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={dark} castShadow>
        <cylinderGeometry args={[r, r, 0.13, 16]} />
      </mesh>
      <mesh
        material={brass}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, z > 0 ? 0.075 : -0.075, 0]}
      >
        <torusGeometry args={[r * 0.82, 0.026, 5, 20]} />
      </mesh>
      {[0, Math.PI / 3, (Math.PI * 2) / 3].map((a) => (
        <Box
          key={a}
          position={[0, z > 0 ? 0.083 : -0.083, 0]}
          scale={[r * 1.52, 0.035, 0.035]}
          rotation={[0, a, 0]}
          material={trim}
        />
      ))}
      <mesh material={brass} position={[0, z > 0 ? 0.09 : -0.09, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.07, 10]} />
      </mesh>
    </group>
  );
}
function Chassis({ length = 3.3 }: { length?: number }) {
  return (
    <>
      <Box position={[0, 0.57, 0]} scale={[length, 0.22, WIDTH + 0.06]} material={dark} />
      {[-1.05, 0, 1.05].map((x) => (
        <group key={x}>
          <Box position={[x, 0.4, 0]} scale={[0.12, 0.12, 2.2]} material={iron} />
          <Wheel x={x} z={1.06} />
          <Wheel x={x} z={-1.06} />
        </group>
      ))}
      <Box position={[0, 0.34, 1.17]} scale={[2.35, 0.045, 0.045]} material={brass} />
      <Box position={[0, 0.34, -1.17]} scale={[2.35, 0.045, 0.045]} material={brass} />
      {[-1, 1].map((i) => (
        <group key={i}>
          <Box position={[i * 1.74, 0.58, 0]} scale={[0.5, 0.09, 0.16]} material={iron} />
          <mesh position={[i * 1.89, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]} material={iron}>
            <torusGeometry args={[0.14, 0.035, 6, 12]} />
          </mesh>
        </group>
      ))}
    </>
  );
}
function Carriage({
  profile,
  index,
  selected,
  onChoose,
}: {
  profile: number;
  index: number;
  selected: boolean;
  onChoose: (car: number, floor: 0 | 1) => void;
}) {
  const panel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CAR_PROFILES[profile].color,
        map: wood.map,
        bumpMap: wood.bumpMap,
        bumpScale: 0.025,
        roughness: 0.93,
      }),
    [profile],
  );
  return (
    <group position={[index * LENGTH, 0, 0]}>
      <Chassis />
      <Box position={[0, FLOOR - 0.01, 0]} scale={[3.3, 0.13, 2.06]} material={wood} />
      {Array.from({ length: 11 }, (_, i) => (
        <Box
          key={i}
          position={[-1.5 + i * 0.3, FLOOR + 0.07, 0]}
          scale={[1.94, 0.055, 0.285]}
          rotation={[0, Math.PI / 2, 0]}
          material={i % 3 === 0 ? trim : wood}
        />
      ))}
      <mesh
        position={[0, FLOOR + 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onChoose(index, 0);
        }}
      >
        <planeGeometry args={[3.25, 1.95]} />
        <meshBasicMaterial
          color={selected ? '#e0bf5b' : '#ffffff'}
          transparent
          opacity={selected ? 0.12 : 0}
          depthWrite={false}
        />
      </mesh>
      {[-1.58, 1.58].map((x) => (
        <group key={x}>
          {[-0.9, 0.9].map((z) => (
            <group key={z}>
              <Box position={[x, 1.73, z]} scale={[0.16, 1.98, 0.17]} material={trim} />
              <Box position={[x, 1.02, z]} scale={[0.2, 0.06, 0.2]} material={brass} />
              <Box position={[x, 2.41, z]} scale={[0.23, 0.15, 0.23]} material={iron} />
              <Rivet position={[x, 2.41, z + 0.13]} />
              <Rivet position={[x, 1.02, z + 0.13]} />
              <Box position={[x, ROOF + 0.1, z]} scale={[0.24, 0.17, 0.32]} material={iron} />
              <Rivet position={[x, ROOF + 0.13, z + 0.17]} />
            </group>
          ))}
          <Box position={[x, 1.04, 0]} scale={[0.12, 0.42, 1.7]} material={panel} />
          <Box position={[x, 2.4, 0]} scale={[0.12, 0.48, 1.7]} material={panel} />
          <Box position={[x, 1.72, -0.73]} scale={[0.12, 1.1, 0.28]} material={panel} />
          <Box position={[x, 1.72, 0.73]} scale={[0.12, 1.1, 0.28]} material={panel} />
          <Box position={[x, 1.51, 0]} scale={[0.13, 0.08, 0.95]} material={brass} />
        </group>
      ))}
      {[-1.45, 1.45].map((x) => (
        <Box
          key={'wall' + x}
          position={[x, 1.72, -0.98]}
          scale={[0.23, 1.72, 0.1]}
          material={wood}
        />
      ))}
      <Box position={[0, 1.03, -0.94]} scale={[3.12, 0.47, 0.13]} material={panel} />
      <Box position={[0, 2.45, -0.94]} scale={[3.12, 0.41, 0.13]} material={panel} />
      {[-1.08, 0, 1.08].map((x) => (
        <Box key={x} position={[x, 1.78, -0.94]} scale={[0.105, 1.08, 0.13]} material={trim} />
      ))}
      {[-1.45, 1.45].map((x) => (
        <group key={x}>
          <Box position={[x, 1.85, -0.8]} scale={[0.21, 1.0, 0.1]} material={red} />
          <Box position={[x, 1.7, -0.73]} scale={[0.22, 0.09, 0.12]} material={brass} />
        </group>
      ))}
      <Box position={[0.7, 1.96, -0.855]} scale={[0.54, 0.71, 0.025]} material={dark} />
      <Box position={[0.7, 1.96, -0.833]} scale={[0.48, 0.65, 0.018]} material={paper} />
      <mesh position={[0.7, 1.94, -0.815]} material={printedMark('$')}>
        <planeGeometry args={[0.32, 0.39]} />
      </mesh>
      <Box position={[0, 1.12, -0.58]} scale={[2.7, 0.16, 0.42]} material={red} />
      {[-1.18, 1.18].map((x) => (
        <Box key={x} position={[x, 0.94, -0.58]} scale={[0.1, 0.31, 0.3]} material={dark} />
      ))}
      <Box position={[0, ROOF - 0.08, 0]} scale={[3.48, 0.12, 2.2]} material={dark} />
      {Array.from({ length: 12 }, (_, i) => (
        <Box
          key={i}
          position={[-1.6 + i * 0.291, ROOF, 0]}
          scale={[2.21, 0.12, 0.278]}
          rotation={[0, Math.PI / 2, 0]}
          material={roofMaterial}
        />
      ))}
      {[-1.03, 1.03].map((z) => (
        <Box key={z} position={[0, ROOF + 0.12, z]} scale={[3.44, 0.08, 0.07]} material={trim} />
      ))}
      <mesh
        position={[0, ROOF + 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onChoose(index, 1);
        }}
      >
        <planeGeometry args={[3.45, 2.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
function Locomotive({ onChoose }: { onChoose: (car: number, floor: 0 | 1) => void }) {
  return (
    <group>
      <Chassis length={3.6} />
      <Box position={[0.85, 0.76, 0]} scale={[1.7, 0.12, 2.05]} material={wood} />
      <group position={[-0.65, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={dark} castShadow>
          <cylinderGeometry args={[0.66, 0.66, 2.15, 24]} />
        </mesh>
        {[-0.85, 0, 0.85].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={brass}>
            <cylinderGeometry args={[0.683, 0.683, 0.045, 24]} />
          </mesh>
        ))}
      </group>
      <mesh material={iron} position={[-1.77, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.59, 0.59, 0.14, 24]} />
      </mesh>
      <mesh material={brass} position={[-1.86, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.07, 16]} />
      </mesh>
      <mesh position={[-1.3, 2.1, 0]} material={dark} castShadow>
        <cylinderGeometry args={[0.28, 0.2, 1.05, 16]} />
      </mesh>
      <mesh position={[-1.3, 2.7, 0]} material={dark} castShadow>
        <cylinderGeometry args={[0.43, 0.27, 0.25, 16]} />
      </mesh>
      <mesh position={[-1.3, 2.84, 0]} material={brass}>
        <torusGeometry args={[0.4, 0.03, 6, 20]} />
      </mesh>
      <mesh position={[-0.35, 2.02, 0]} material={brass} castShadow>
        <sphereGeometry args={[0.23, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[-0.9, 0.9].map((z) => (
        <group key={z}>
          <Box position={[-0.55, 0.9, z]} scale={[2.3, 0.04, 0.06]} material={brass} />
          <Box position={[-0.55, 1.28, z]} scale={[2.3, 0.04, 0.04]} material={brass} />
        </group>
      ))}
      <Box position={[1.43, 1.64, -0.91]} scale={[0.12, 1.75, 0.16]} material={brass} />
      <Box position={[0.32, 1.64, -0.91]} scale={[0.12, 1.75, 0.16]} material={brass} />
      <Box position={[0.89, 1.07, -0.91]} scale={[1.28, 0.56, 0.12]} material={dark} />
      <Box position={[0.89, 2.35, -0.91]} scale={[1.28, 0.4, 0.12]} material={dark} />
      {[-0.9, 0.9].map((z) => (
        <group key={z}>
          <Box position={[1.6, 1.7, z]} scale={[0.13, 1.85, 0.13]} material={dark} />
          <Box position={[0.24, 1.7, z]} scale={[0.13, 1.85, 0.13]} material={dark} />
        </group>
      ))}
      <Box position={[0.94, ROOF, 0]} scale={[1.79, 0.19, 2.27]} material={dark} />
      <Box position={[0.94, ROOF + 0.11, 0]} scale={[1.89, 0.035, 2.32]} material={iron} />
      {[-1.16, 1.16].map((z) => (
        <Box
          key={z}
          position={[0.94, ROOF + 0.13, z]}
          scale={[1.89, 0.035, 0.035]}
          material={brass}
        />
      ))}
      <Box position={[0.94, 0.83, 0.97]} scale={[1.55, 0.045, 0.07]} material={brass} />
      <mesh position={[-2.03, 0.46, 0]} rotation={[0, 0, -0.33]} material={dark} castShadow>
        <boxGeometry args={[0.6, 0.12, 2.14]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={i}
          position={[-2.08, 0.47, -0.98 + i * 0.245]}
          scale={[0.7, 0.065, 0.065]}
          rotation={[0, 0, -0.33]}
          material={brass}
        />
      ))}
      <mesh
        position={[0.85, FLOOR + 0.11, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onChoose(0, 0);
        }}
      >
        <planeGeometry args={[1.5, 1.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        position={[0.95, ROOF + 0.16, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onChoose(0, 1);
        }}
      >
        <planeGeometry args={[1.8, 2.25]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
function Track({ cars }: { cars: number }) {
  const length = cars * LENGTH + 4;
  return (
    <group>
      {Array.from({ length: Math.ceil(length / 0.43) }, (_, i) => (
        <Box
          key={i}
          position={[-3.6 + i * 0.43, 0.035, 0]}
          scale={[0.2, 0.1, 2.8]}
          material={i % 3 ? wood : dark}
        />
      ))}
      {[-0.98, 0.98].map((z) => (
        <group key={z}>
          <Box
            position={[length / 2 - 3.7, 0.14, z]}
            scale={[length, 0.14, 0.12]}
            material={iron}
          />
          <Box
            position={[length / 2 - 3.7, 0.23, z]}
            scale={[length, 0.035, 0.19]}
            material={brass}
          />
        </group>
      ))}
    </group>
  );
}
const pawnGeometry = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.22, 0);
  s.lineTo(-0.09, 0);
  s.lineTo(0, 0.25);
  s.lineTo(0.09, 0);
  s.lineTo(0.22, 0);
  s.lineTo(0.15, 0.42);
  s.lineTo(0.28, 0.28);
  s.lineTo(0.36, 0.37);
  s.lineTo(0.18, 0.62);
  s.lineTo(0.12, 0.63);
  s.lineTo(0.12, 0.78);
  s.lineTo(0.3, 0.79);
  s.lineTo(0.3, 0.87);
  s.lineTo(0.13, 0.89);
  s.lineTo(0.1, 1.04);
  s.lineTo(-0.1, 1.04);
  s.lineTo(-0.13, 0.89);
  s.lineTo(-0.3, 0.87);
  s.lineTo(-0.3, 0.79);
  s.lineTo(-0.12, 0.78);
  s.lineTo(-0.12, 0.63);
  s.lineTo(-0.18, 0.62);
  s.lineTo(-0.36, 0.37);
  s.lineTo(-0.28, 0.28);
  s.lineTo(-0.15, 0.42);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.025,
  });
  g.translate(0, 0, -0.09);
  return g;
})();
function Pawn({
  position,
  color,
  label,
  active,
  marshal = false,
}: {
  position: [number, number, number];
  color: string;
  label: string;
  active: boolean;
  marshal?: boolean;
}) {
  const { invalidate } = useThree();
  const group = useRef<THREE.Group>(null);
  const initial = useRef(position);
  const target = useMemo(
    () => new THREE.Vector3(...position),
    [position[0], position[1], position[2]],
  );
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useFrame((_, dt) => {
    if (group.current) {
      group.current.position.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 7));
      if (group.current.position.distanceToSquared(target) > 0.00001) invalidate();
      else group.current.position.copy(target);
    }
  });
  return (
    <group ref={group} position={initial.current}>
      <mesh
        geometry={pawnGeometry}
        scale={[1.06, 1.035, 1.03]}
        position={[0, -0.009, -0.035]}
        material={dark}
        castShadow
      />
      <mesh geometry={pawnGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.52} metalness={0.04} />
      </mesh>
      <Box
        position={[0, 0.86, 0.12]}
        scale={[0.39, 0.045, 0.04]}
        material={marshal ? dark : brass}
      />
      <mesh position={[0, 0.56, 0.145]} rotation={[Math.PI / 2, 0, 0]} material={brass}>
        <cylinderGeometry
          args={[marshal ? 0.082 : 0.035, marshal ? 0.082 : 0.035, 0.02, marshal ? 6 : 8]}
        />
      </mesh>
      {active ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.46, 32]} />
          <meshBasicMaterial color="#ffe5a0" transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}
function LootPiece({ loot, position }: { loot: VisibleLoot; position: [number, number, number] }) {
  return (
    <group position={position}>
      {loot.kind === 'purse' ? (
        <>
          <mesh scale={[1, 0.92, 0.86]} castShadow receiveShadow>
            <latheGeometry
              args={[
                [
                  [0, 0.0],
                  [0.16, 0.012],
                  [0.24, 0.08],
                  [0.26, 0.2],
                  [0.22, 0.34],
                  [0.09, 0.43],
                  [0.1, 0.46],
                  [0.15, 0.52],
                  [0.09, 0.54],
                ].map(([x, y]) => new THREE.Vector2(x, y)),
                16,
              ]}
            />
            <meshStandardMaterial color="#d5be87" roughness={1} />
          </mesh>
          <mesh position={[0, 0.22, 0.227]} material={printedMark('$')}>
            <planeGeometry args={[0.28, 0.3]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
            <torusGeometry args={[0.1, 0.014, 4, 12]} />
          </mesh>
          <mesh position={[0.075, 0.37, 0.09]} rotation={[0.3, 0, -0.7]} material={wood}>
            <cylinderGeometry args={[0.012, 0.012, 0.15, 5]} />
          </mesh>
        </>
      ) : loot.kind === 'jewel' ? (
        <mesh position={[0, 0.24, 0]} rotation={[0.1, 0.4, 0.1]} castShadow>
          <octahedronGeometry args={[0.28]} />
          <meshStandardMaterial color="#ba3438" roughness={0.28} metalness={0.35} flatShading />
        </mesh>
      ) : (
        <>
          <Box position={[0, 0.16, 0]} scale={[0.54, 0.3, 0.36]} material={wood} />
          {[-0.18, 0.18].map((x) => (
            <Box key={x} position={[x, 0.18, 0]} scale={[0.045, 0.32, 0.39]} material={brass} />
          ))}
          <Box position={[0, 0.19, 0.195]} scale={[0.085, 0.1, 0.025]} material={brass} />
          <mesh position={[0, 0.34, 0]} material={dark}>
            <torusGeometry args={[0.1, 0.022, 5, 10, Math.PI]} />
          </mesh>
        </>
      )}
    </group>
  );
}
function CameraRig({ count, focus, viewKey }: { count: number; focus: number; viewKey: number }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<any>(null);
  const initialized = useRef(false);
  const transition = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
    zoom: number;
  } | null>(null);
  useFrame((_, delta) => {
    const goal = transition.current;
    if (!goal || !controls.current) return;
    const cam = camera as THREE.OrthographicCamera;
    const blend = 1 - Math.exp(-Math.min(delta, 0.06) * 11);
    cam.position.lerp(goal.position, blend);
    controls.current.target.lerp(goal.target, blend);
    cam.zoom = THREE.MathUtils.lerp(cam.zoom, goal.zoom, blend);
    cam.updateProjectionMatrix();
    controls.current.update();
    if (
      cam.position.distanceToSquared(goal.position) < 0.00001 &&
      Math.abs(cam.zoom - goal.zoom) < 0.005
    ) {
      cam.position.copy(goal.position);
      cam.zoom = goal.zoom;
      controls.current.target.copy(goal.target);
      controls.current.enabled = true;
      cam.updateProjectionMatrix();
      controls.current.update();
      transition.current = null;
    }
    invalidate();
  });
  useEffect(() => {
    const mobile = size.width < 700,
      center = focus < 0 ? ((count - 1) * LENGTH) / 2 : focus * LENGTH,
      width = focus < 0 ? count * LENGTH + 4 : mobile ? 7.2 : 11;
    const cam = camera as THREE.OrthographicCamera;
    cam.left = -size.width / 2;
    cam.right = size.width / 2;
    cam.top = size.height / 2;
    cam.bottom = -size.height / 2;
    const goal = {
      position: new THREE.Vector3(center - 5.8, 7.6, 18.5),
      target: new THREE.Vector3(center, 1.05, 0),
      zoom: Math.min(size.width / width, size.height / 6.6),
    };
    const animate =
      initialized.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    initialized.current = true;
    if (animate && controls.current) {
      transition.current = goal;
      controls.current.enabled = false;
    } else {
      cam.position.copy(goal.position);
      cam.zoom = goal.zoom;
    }
    cam.near = 0.1;
    cam.far = 180;
    cam.updateProjectionMatrix();
    if (!animate) cam.lookAt(center, 1.05, 0);
    if (controls.current && !animate) {
      controls.current.target.set(center, 1.05, 0);
      controls.current.update();
    }
    invalidate();
  }, [camera, size.width, size.height, count, focus, viewKey, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minZoom={12}
      maxZoom={180}
      minPolarAngle={0.77}
      maxPolarAngle={1.38}
      minAzimuthAngle={-0.38}
      maxAzimuthAngle={0.38}
      enableDamping
      dampingFactor={0.1}
    />
  );
}
function Table({
  o,
  focus,
  viewKey,
  onChoose,
}: {
  o: Observation;
  viewKey: number;
  focus: number;
  onChoose: (car: number, floor: 0 | 1) => void;
}) {
  const active =
    o.phase === 'execute'
      ? o.queue[o.executionIndex]?.bandit
      : o.bandits.find((b) => b.controller === o.actor)?.id;
  useTrainMaterials();
  const sunTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(((o.cars.length - 1) * LENGTH) / 2, 0, 0);
    return target;
  }, [o.cars.length]);
  return (
    <>
      <primitive object={sunTarget} />
      <ambientLight intensity={0.55} color="#fff3d5" />
      <hemisphereLight args={['#dbe6e9', '#795737', 0.9]} />
      <directionalLight
        position={[((o.cars.length - 1) * LENGTH) / 2 - 7, 12, 8]}
        target={sunTarget}
        intensity={3.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={(-o.cars.length * LENGTH) / 2 - 4}
        shadow-camera-right={(o.cars.length * LENGTH) / 2 + 4}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00025}
        shadow-normalBias={0.015}
        shadow-radius={2}
      />
      <CameraRig count={o.cars.length} focus={focus} viewKey={viewKey} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, -0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 70]} />
        <shadowMaterial opacity={0.34} />
      </mesh>
      <mesh
        position={[((o.cars.length - 1) * LENGTH) / 2, -0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={ground}
        receiveShadow
      >
        <planeGeometry args={[o.cars.length * LENGTH + 12, 13]} />
      </mesh>
      <DesertProps count={o.cars.length} />
      <Track cars={o.cars.length} />
      <Locomotive onChoose={onChoose} />
      {o.cars.slice(1).map((c, i) => (
        <Carriage
          key={i}
          index={i + 1}
          profile={c.profile}
          selected={focus === i + 1}
          onChoose={onChoose}
        />
      ))}
      {o.cars.flatMap((c, car) =>
        c.loot.flatMap((ls, floor) =>
          ls.map((loot, i) => (
            <LootPiece
              key={loot.id}
              loot={loot}
              position={[
                car * LENGTH + (car === 0 ? 0.9 : -1.0) + (i % 4) * 0.52,
                floor ? ROOF + 0.14 : FLOOR + 0.13,
                -0.43 + Math.floor(i / 4) * 0.55,
              ]}
            />
          )),
        ),
      )}
      {o.bandits.map((b) => {
        const same = o.bandits.filter((t) => t.car === b.car && t.floor === b.floor),
          i = same.findIndex((t) => t.id === b.id),
          x = b.car * LENGTH + (b.car === 0 ? 0.85 : 0) + (i - (same.length - 1) / 2) * 0.58;
        return (
          <Pawn
            key={b.id}
            color={
              b.character === 'ghost'
                ? '#ebe1ca'
                : b.character === 'django'
                  ? '#322b27'
                  : CHARACTER_INFO[b.character].color
            }
            position={[x, b.floor ? ROOF + 0.14 : FLOOR + 0.15, 0.44]}
            label={CHARACTER_INFO[b.character].name}
            active={active === b.id}
          />
        );
      })}
      <Pawn
        position={[o.marshal * LENGTH + (o.marshal === 0 ? 0.85 : 0), FLOOR + 0.15, -0.05]}
        color="#d8ae3b"
        label="Marshal"
        active={false}
        marshal
      />
    </>
  );
}
interface SceneLabel {
  id: string;
  text: string;
  position: [number, number, number];
  kind: 'car' | 'pawn';
  active: boolean;
}
function sceneLabels(o: Observation, focus: number): SceneLabel[] {
  const active =
    o.phase === 'execute'
      ? o.queue[o.executionIndex]?.bandit
      : o.bandits.find((b) => b.controller === o.actor)?.id;
  const labels: SceneLabel[] = o.cars.map((c, i) => ({
    id: 'car-' + i,
    text: i === 0 ? 'Locomotive' : `${i}. ${CAR_PROFILES[c.profile].name}`,
    position: [i * LENGTH, 0.03, 1.47],
    kind: 'car',
    active: i === focus,
  }));
  for (const b of o.bandits) {
    const same = o.bandits.filter((t) => t.car === b.car && t.floor === b.floor),
      i = same.findIndex((t) => t.id === b.id);
    labels.push({
      id: 'pawn-' + b.id,
      text: CHARACTER_INFO[b.character].name,
      position: [
        b.car * LENGTH + (b.car === 0 ? 0.85 : 0) + (i - (same.length - 1) / 2) * 0.58,
        (b.floor ? ROOF + 0.14 : FLOOR + 0.15) + 1.27 + (i % 2) * 0.35,
        0.44,
      ],
      kind: 'pawn',
      active: b.id === active,
    });
  }
  labels.push({
    id: 'marshal',
    text: 'Marshal',
    position: [o.marshal * LENGTH + (o.marshal === 0 ? 0.85 : 0), FLOOR + 1.5, -0.05],
    kind: 'pawn',
    active: false,
  });
  return labels;
}
function LabelProjector({
  labels,
  nodes,
}: {
  labels: SceneLabel[];
  nodes: RefObject<Map<string, HTMLSpanElement>>;
}) {
  const { camera, size } = useThree(),
    v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const l of labels) {
      const el = nodes.current.get(l.id);
      if (!el) continue;
      v.set(...l.position).project(camera);
      el.style.transform = `translate(${((v.x + 1) * size.width) / 2}px,${((1 - v.y) * size.height) / 2}px) translate(-50%,-50%)`;
      el.style.visibility = v.z > 1 || v.z < -1 ? 'hidden' : 'visible';
    }
  });
  return null;
}
export default function TrainScene({
  observation,
  focus,
  onFocus,
  onChoose,
  onInspect,
}: {
  observation: Observation;
  focus: number;
  onFocus: (n: number) => void;
  onInspect: () => void;
  onChoose: (car: number, floor: 0 | 1) => void;
}) {
  const [viewKey, setViewKey] = useState(0);
  const [lost, setLost] = useState(false),
    nodes = useRef(new Map<string, HTMLSpanElement>()),
    labels = useMemo(() => sceneLabels(observation, focus), [observation, focus]);
  return (
    <div
      className="train-stage"
      aria-label="Interactive 3D train. Drag to rotate, scroll or pinch to zoom."
    >
      <div className="desert-backdrop" />
      {lost ? (
        <div className="scene-fallback">
          <strong>The 3D view needs to reload.</strong>
          <p>You can still play using the action buttons below.</p>
          <button onClick={() => setLost(false)}>Reload train</button>
        </div>
      ) : (
        <Canvas
          frameloop="demand"
          orthographic
          camera={{ position: [7, 7, 15], zoom: 35, near: 0.1, far: 180 }}
          dpr={[1, 1.5]}
          shadows
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setLost(true);
            });
            gl.setClearColor(0, 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <Suspense fallback={null}>
            <Table o={observation} focus={focus} viewKey={viewKey} onChoose={onChoose} />
            <LabelProjector labels={labels} nodes={nodes} />
          </Suspense>
        </Canvas>
      )}
      <div className="scene-labels" aria-hidden="true">
        {labels.map((l) => (
          <span
            key={l.id}
            ref={(el) => {
              if (el) nodes.current.set(l.id, el);
              else nodes.current.delete(l.id);
            }}
            className={l.kind + '-label world-label' + (l.active ? ' active selected' : '')}
          >
            {l.text}
          </span>
        ))}
      </div>
      <div className="train-controls">
        <button
          aria-label="Previous car"
          onClick={() =>
            onFocus(Math.max(0, (focus < 0 ? observation.cars.length - 1 : focus) - 1))
          }
        >
          <Chevron left />
        </button>
        <div className="train-view-actions">
          <button
            className="fit-train"
            onClick={() => {
              onFocus(-1);
              setViewKey((v) => v + 1);
            }}
          >
            <TrainIcon /> Fit train
          </button>
          <button className="fit-train" onClick={onInspect}>
            Inspect train
          </button>
        </div>
        <button
          aria-label="Next car"
          onClick={() =>
            onFocus(Math.min(observation.cars.length - 1, (focus < 0 ? 0 : focus) + 1))
          }
        >
          <Chevron />
        </button>
      </div>
    </div>
  );
}
function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d={left ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}
function TrainIcon() {
  return (
    <svg width="23" height="18" viewBox="0 0 28 20" fill="currentColor" aria-hidden="true">
      <path d="M2 3h9v11H2zm11 1h8v10h-8zm10 3h3v7h-3zM5 0h3v4H5z" />
      <circle cx="5" cy="16" r="2" />
      <circle cx="10" cy="16" r="2" />
      <circle cx="16" cy="16" r="2" />
      <circle cx="22" cy="16" r="2" />
    </svg>
  );
}
