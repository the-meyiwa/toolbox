/* ============================================================
   3D Lab — library thumbnails

   One small off-screen renderer draws each model or shape once, in a
   three-quarter studio view, when the browser is idle. Results are
   kept for the session so reopening the Lab is instant.
   ============================================================ */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SIZE = 176;
const mem = new Map();
let ctx = null;
const queue = [];
let running = false;

function setup() {
  if (ctx) return ctx;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.6));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 5000);
  ctx = { renderer, scene, camera };
  return ctx;
}

function shoot(object, turn = 0) {
  const { renderer, scene, camera } = setup();
  const holder = new THREE.Group();
  holder.add(object);
  holder.rotation.y = turn;
  scene.add(holder);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const dir = new THREE.Vector3(1, 0.7, 1.35).normalize();
  const dist = r / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.02;
  camera.position.copy(c).addScaledVector(dir, dist);
  camera.near = dist / 100; camera.far = dist * 10;
  camera.lookAt(c);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/webp', 0.86);
  scene.remove(holder);
  holder.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); } } });
  return url;
}

function pump() {
  if (running) return;
  running = true;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  const step = (deadline) => {
    while (queue.length && deadline.timeRemaining() > 4) {
      const job = queue.shift();
      try {
        const url = shoot(job.build(), job.turn);
        mem.set(job.key, url);
        try { sessionStorage.setItem(`lab3d:thumb:${job.key}`, url); } catch { /* quota */ }
        job.resolve(url);
      } catch { job.resolve(null); }
    }
    if (queue.length) idle(step); else running = false;
  };
  idle(step);
}

/** Resolves to a data URL for `key`, building it with `build()` when first asked. */
export function thumbnail(key, build, { turn = 0 } = {}) {
  if (mem.has(key)) return Promise.resolve(mem.get(key));
  try {
    const hit = sessionStorage.getItem(`lab3d:thumb:${key}`);
    if (hit) { mem.set(key, hit); return Promise.resolve(hit); }
  } catch { /* storage unavailable */ }
  return new Promise((resolve) => { queue.push({ key, build, turn, resolve }); pump(); });
}

/** Drops pending work (the Lab closed). */
export function cancelThumbnails() {
  for (const j of queue.splice(0)) j.resolve(null);
}
