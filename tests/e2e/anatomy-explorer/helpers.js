/* ============================================================
   E2E Test Helpers & Fixtures — 3D Anatomy Subsystem
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../../helpers/dom-env.js';

export const CANONICAL_SYSTEMS = [
  'skeletal',
  'muscular',
  'cardiovascular',
  'nervous',
  'digestive',
  'respiratory',
  'urinary',
  'endocrine'
];

export const MAX_BYTES = 40 * 1024 * 1024; // 40 MB threshold

/**
 * Creates a valid binary STL buffer in memory.
 * Spec: 80 bytes header + 4 bytes uint32 triangle count + 50 bytes per triangle.
 */
export function createMockSTL(triangles = [
  // Default: single triangle in XY plane
  {
    normal: [0, 0, 1],
    vertices: [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0]
    ]
  }
]) {
  const triCount = triangles.length;
  const byteLength = 84 + triCount * 50;
  const buffer = new ArrayBuffer(byteLength);
  const dv = new DataView(buffer);

  // Write 80-byte header
  const headerStr = 'COLOR=TEST_STL_BINARY_E2E';
  for (let i = 0; i < headerStr.length; i++) {
    dv.setUint8(i, headerStr.charCodeAt(i));
  }

  // Write triangle count at offset 80 (uint32, little-endian)
  dv.setUint32(80, triCount, true);

  // Write triangles
  let offset = 84;
  for (const tri of triangles) {
    // Normal (12 bytes)
    dv.setFloat32(offset, tri.normal[0], true);
    dv.setFloat32(offset + 4, tri.normal[1], true);
    dv.setFloat32(offset + 8, tri.normal[2], true);
    offset += 12;

    // 3 Vertices (36 bytes)
    for (let v = 0; v < 3; v++) {
      const vert = tri.vertices[v];
      dv.setFloat32(offset, vert[0], true);
      dv.setFloat32(offset + 4, vert[1], true);
      dv.setFloat32(offset + 8, vert[2], true);
      offset += 12;
    }

    // Attribute byte count (2 bytes uint16)
    dv.setUint16(offset, 0, true);
    offset += 2;
  }

  return Buffer.from(buffer);
}

/**
 * Parses binary STL into raw positions Float32Array (as in anatomy-build.mjs).
 */
export function readBinarySTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 84) throw new Error('not a binary STL (too short)');
  const triangles = dv.getUint32(80, true);

  const expected = 84 + triangles * 50;
  if (expected > buf.byteLength) throw new Error('not a binary STL (corrupt triangle count)');

  const positions = new Float32Array(triangles * 9);
  let o = 84, p = 0;
  for (let i = 0; i < triangles; i++) {
    o += 12; // skip normal
    for (let v = 0; v < 3; v++) {
      positions[p++] = dv.getFloat32(o, true);
      positions[p++] = dv.getFloat32(o + 4, true);
      positions[p++] = dv.getFloat32(o + 8, true);
      o += 12;
    }
    o += 2; // skip attribute
  }
  return positions;
}

/**
 * Welds coincident vertices into indexed mesh using spatial hash key (0.05mm quantization).
 */
export function buildIndexed(positions) {
  const map = new Map();
  const out = [];
  const index = new Uint32Array(positions.length / 3);

  for (let i = 0, n = positions.length / 3; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = out.length / 3;
      map.set(key, id);
      out.push(x, y, z);
    }
    index[i] = id;
  }
  return { position: new Float32Array(out), index };
}

/**
 * Computes smooth vertex normals by area-weighted accumulation.
 */
export function computeNormals(position, index) {
  const normals = new Float32Array(position.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const ax = position[a], ay = position[a + 1], az = position[a + 2];
    const e1x = position[b] - ax, e1y = position[b + 1] - ay, e1z = position[b + 2] - az;
    const e2x = position[c] - ax, e2y = position[c + 1] - ay, e2z = position[c + 2] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
  return normals;
}

/**
 * Creates a minimal valid glTF 2.0 binary (GLB) buffer.
 */
export function createMockGLB(json = { asset: { version: '2.0', generator: 'Toolbox-E2E' }, nodes: [] }) {
  const jsonText = JSON.stringify(json);
  const jsonBuffer = Buffer.from(jsonText, 'utf8');
  // glTF 2.0 JSON chunk must be padded with trailing spaces (0x20) to a 4-byte boundary
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  const jsonChunkLength = jsonBuffer.length + jsonPadding;

  const totalByteLength = 12 + 8 + jsonChunkLength;
  const out = Buffer.alloc(totalByteLength);

  // 12-byte header
  out.write('glTF', 0, 4, 'ascii'); // Magic 0x46546C67
  out.writeUInt32LE(2, 4);           // Version 2
  out.writeUInt32LE(totalByteLength, 8); // Total length

  // Chunk 0: JSON
  out.writeUInt32LE(jsonChunkLength, 12);
  out.write('JSON', 16, 4, 'ascii'); // Chunk type 0x4E4F534A
  jsonBuffer.copy(out, 20);
  for (let i = 0; i < jsonPadding; i++) {
    out[20 + jsonBuffer.length + i] = 0x20;
  }

  return out;
}

/**
 * Expanded classification rules supporting the complete BodyParts3D dataset (>900 parts).
 */
export const EXTENDED_RULES = [
  ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b|gyrus|gyri|sulcus|insula|internal capsule|optic tract|collicul|geniculate|corona radiata|crus cerebri/i],

  ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|subscapularis|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|rotator|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalenus|scalene|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis|teres (major|minor)|subclavius|tensor fasciae latae|palmaris longus|puborectalis|frontalis|orbicularis|buccinator|risorius|nasalis|procerus|mentalis|corrugator|depressor|levator labii|zygomaticus/i],

  ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis|atlas|axis|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|concha/i],

  ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar|carotid|jugular|subclavian|brachial|iliac|saphenous/i],

  ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i],

  ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva/i],

  ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i],

  ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary/i],
];

export function classifyAnatomicalStructure(name) {
  for (const [system, re] of EXTENDED_RULES) {
    if (re.test(name)) return system;
  }
  return null;
}

/**
 * Pure vanilla VirtualScroller implementation fulfilling PROJECT.md contract.
 */
export class TestVirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 36;
    this.containerHeight = options.containerHeight || 400;
    this.renderItem = options.renderItem || ((item) => `<div>${item.name}</div>`);
    this.items = [];

    // Pool size = visible items + 2 buffer
    this.poolSize = Math.ceil(this.containerHeight / this.itemHeight) + 2;

    this.initDOM();
  }

  initDOM() {
    this.container.style.overflowY = 'auto';
    this.container.style.position = 'relative';
    this.container.style.height = `${this.containerHeight}px`;

    // 1. Phantom height spacer maintaining native scrollbar
    this.spacer = document.createElement('div');
    this.spacer.className = 't3d-virtual-spacer';
    this.spacer.style.width = '100%';
    this.spacer.style.pointerEvents = 'none';

    // 2. Viewport container translated via translateY
    this.viewport = document.createElement('div');
    this.viewport.className = 't3d-virtual-viewport';
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.width = '100%';

    // 3. Pool of DOM elements
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement('div');
      el.className = 't3d-virtual-item';
      el.style.height = `${this.itemHeight}px`;
      this.pool.push(el);
      this.viewport.appendChild(el);
    }

    this.container.appendChild(this.spacer);
    this.container.appendChild(this.viewport);

    this.scrollTop = 0;
  }

  setItems(items) {
    this.items = items;
    this.update();
  }

  scrollTo(top) {
    this.scrollTop = Math.max(0, top);
    this.update();
  }

  update() {
    const totalCount = this.items.length;
    this.spacer.style.height = `${totalCount * this.itemHeight}px`;

    if (totalCount === 0) {
      this.viewport.style.display = 'none';
      return;
    }
    this.viewport.style.display = 'block';

    const maxScroll = Math.max(0, totalCount * this.itemHeight - this.containerHeight);
    const clampedScroll = Math.min(Math.max(0, this.scrollTop), maxScroll);

    const startIndex = Math.floor(clampedScroll / this.itemHeight);
    const offsetY = startIndex * this.itemHeight;
    this.viewport.style.transform = `translateY(${offsetY}px)`;

    for (let i = 0; i < this.poolSize; i++) {
      const itemIndex = startIndex + i;
      const el = this.pool[i];
      if (itemIndex < totalCount) {
        el.style.display = 'block';
        const item = this.items[itemIndex];
        el.innerHTML = this.renderItem(item, itemIndex);
        el.dataset.id = item.id;
        el.dataset.index = itemIndex;
      } else {
        el.style.display = 'none';
      }
    }
  }

  getPoolElementCount() {
    return this.pool.length;
  }
}
