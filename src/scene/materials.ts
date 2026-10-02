import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
export const brass = new THREE.MeshStandardMaterial({
  color: '#ac8958',
  roughness: 0.38,
  metalness: 0.68,
});
export const dark = new THREE.MeshStandardMaterial({
  color: '#77736b',
  roughness: 0.59,
  metalness: 0.48,
});
export const iron = new THREE.MeshStandardMaterial({
  color: '#a6a49a',
  roughness: 0.66,
  metalness: 0.42,
});
export const wood = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.38, 1.3, 1.14),
  roughness: 0.92,
});
export const trim = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.65, 1.53, 1.29),
  roughness: 0.87,
});
export const roofMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(1.5, 1.43, 1.29),
  roughness: 0.92,
});
export const red = new THREE.MeshStandardMaterial({ color: '#623b32', roughness: 0.96 });
export const ground = new THREE.MeshStandardMaterial({
  color: '#d8c9ad',
  roughness: 1,
  transparent: true,
  depthWrite: false,
});
export const paper = new THREE.MeshStandardMaterial({ color: '#e8d1a0', roughness: 1 });
export function useTrainMaterials() {
  const atlas = useLoader(THREE.TextureLoader, import.meta.env.BASE_URL + 'art/materials.webp');
  useMemo(() => {
    const tile = (x: number, y: number) => {
      const t = atlas.clone();
      t.offset.set(x * 0.5 + 0.001, y * 0.5 + 0.001);
      t.repeat.set(0.498, 0.498);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    };
    const timber = tile(0, 1),
      metal = tile(0, 0),
      sand = tile(1, 0),
      parchment = tile(1, 1);
    for (const m of [wood, trim, roofMaterial]) {
      m.map = timber;
      m.bumpMap = timber;
      m.bumpScale = 0.022;
      m.needsUpdate = true;
    }
    for (const m of [dark, iron]) {
      m.map = metal;
      m.bumpMap = metal;
      m.bumpScale = 0.012;
      m.needsUpdate = true;
    }
    paper.map = parchment;
    paper.needsUpdate = true;
    ground.map = sand;
    ground.needsUpdate = true;
    ground.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundUV;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvGroundUV=uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundUV;')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(0.0,0.14,vGroundUV.x)*smoothstep(0.0,0.14,1.0-vGroundUV.x)*smoothstep(0.0,0.28,vGroundUV.y)*smoothstep(0.0,0.28,1.0-vGroundUV.y);',
        );
    };
  }, [atlas]);
}
const markingCache = new Map<string, THREE.MeshStandardMaterial>();
/** Printed lettering on physical props; all illustrated surface art comes from the atlas. */
export function printedMark(text: string, ink = '#392b1d', background = 'transparent') {
  const key = text + ink + background;
  if (markingCache.has(key)) return markingCache.get(key)!;
  const canvas = document.createElement('canvas');
  const wide = text.length > 2;
  canvas.width = wide ? 512 : 256;
  canvas.height = wide ? 128 : 256;
  const ctx = canvas.getContext('2d')!;
  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${wide ? 78 : 170}px Georgia`;
  ctx.fillText(text, canvas.width / 2, canvas.height * 0.54);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    roughness: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  markingCache.set(key, material);
  return material;
}
