/* ============================================================
   Anatomy model builder.

   Builds a schematic human body out of parametric solids, at
   roughly life-size proportions for a 1.75 m adult.

   Coordinate convention (standard anatomical position):
     +X = the subject's LEFT      (viewer's right, facing them)
     +Y = superior (up)           feet at y = 0, vertex at y ≈ 1.75
     +Z = anterior (forwards)

   This is a schematic, not a scan. Shapes, relative positions and
   relationships are correct enough to reason about; surface detail
   and exact morphology are not. Every part carries a `note` written
   for someone studying it, so the model teaches rather than decorates.
   ============================================================ */

import * as THREE from 'three';

/* ---------------- system definitions ---------------- */

export const SYSTEMS = {
  surface:     { label: 'Body Surface', color: 0xe3bfa0, order: 0 },
  skeletal:    { label: 'Skeletal',     color: 0xeae4d3, order: 1 },
  muscular:    { label: 'Muscular',     color: 0xb2504a, order: 2 },
  nervous:     { label: 'Nervous',      color: 0xdcd0b8, order: 3 },
  circulatory: { label: 'Circulatory',  color: 0xb03a2e, order: 4 },
  respiratory: { label: 'Respiratory',  color: 0xdb91a6, order: 5 },
  digestive:   { label: 'Digestive',    color: 0xc79157, order: 6 },
  urinary:     { label: 'Urinary',      color: 0x94663f, order: 7 },
};

/* ---------------- landmark heights (metres) ---------------- */

const L = {
  vertex: 1.75, eyes: 1.655, chin: 1.525,
  c7: 1.46, acromion: 1.435, t4: 1.315, xiphoid: 1.225,
  umbilicus: 1.055, iliacCrest: 1.045, hipJoint: 0.92,
  knee: 0.50, ankle: 0.075,
};

/* ---------------- material cache ---------------- */

const materials = new Map();

function mat(color, { opacity = 1, shine = 0.25, flat = false } = {}) {
  const key = `${color}|${opacity}|${shine}|${flat}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: 1 - shine,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity,
      flatShading: flat,
      side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: opacity > 0.85,
    }));
  }
  return materials.get(key);
}

export function disposeMaterials() {
  for (const m of materials.values()) m.dispose();
  materials.clear();
}

/* ---------------- primitive helpers ----------------
   Each returns a Mesh already positioned. `w/h/d` are full
   extents, not radii, so numbers read like real measurements. */

function ellipsoid(w, h, d, [x, y, z], color, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), mat(color, opts));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

function box(w, h, d, [x, y, z], color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  return m;
}

// A capsule running between two points — the workhorse for limbs,
// long bones and vessels.
function capsuleBetween(a, b, radius, color, opts) {
  const start = new THREE.Vector3(...a);
  const end   = new THREE.Vector3(...b);
  const dir   = new THREE.Vector3().subVectors(end, start);
  const len   = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(len - radius * 2, 0.001), 6, 16), mat(color, opts));
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function tubeAlong(points, radius, color, opts, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(points.length * 8, 40), radius, 12, closed), mat(color, opts));
  return m;
}

/* ---------------- part registry ---------------- */

export class AnatomyModel {
  constructor() {
    this.root  = new THREE.Group();
    this.parts = [];                      // { id, name, system, note, object }
    this.systemGroups = {};

    for (const key of Object.keys(SYSTEMS)) {
      const g = new THREE.Group();
      g.name = `system:${key}`;
      this.systemGroups[key] = g;
      this.root.add(g);
    }

    this._buildSkeletal();
    this._buildMuscular();
    this._buildNervous();
    this._buildCirculatory();
    this._buildRespiratory();
    this._buildDigestive();
    this._buildUrinary();
    this._buildSurface();

    this.root.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  /* Register a part. `meshes` may be one Mesh or an array. */
  add(system, id, name, note, meshes, { labelAt = null, pickable = true } = {}) {
    const group = new THREE.Group();
    group.name = id;
    for (const m of [].concat(meshes)) group.add(m);

    const part = { id, name, system, note, object: group, labelAt };
    group.userData.part = part;
    group.userData.pickable = pickable;

    this.systemGroups[system].add(group);
    this.parts.push(part);
    return part;
  }

  getPart(id) { return this.parts.find(p => p.id === id); }

  partsBySystem(system) { return this.parts.filter(p => p.system === system); }

  setSystemVisible(system, visible) {
    this.systemGroups[system].visible = visible;
  }

  setSystemOpacity(system, opacity) {
    this.systemGroups[system].traverse(o => {
      if (!o.isMesh) return;
      o.material.transparent = opacity < 1;
      o.material.opacity = opacity;
      o.material.depthWrite = opacity > 0.85;
      o.material.needsUpdate = true;
    });
  }

  /* ============================================================
     SKELETAL
     ============================================================ */
  _buildSkeletal() {
    const S = 'skeletal';
    const bone = SYSTEMS.skeletal.color;

    // --- Skull & mandible ---
    this.add(S, 'skull', 'Cranium',
      'Eight cranial bones — frontal, two parietal, two temporal, occipital, sphenoid and ethmoid — fused at sutures to form the neurocranium. It encloses the brain, meninges and CSF. The floor is divided into anterior, middle and posterior cranial fossae; the middle fossa houses the temporal lobes and is where the middle meningeal artery runs, the vessel torn in an extradural haemorrhage.',
      ellipsoid(0.155, 0.205, 0.195, [0, 1.645, 0.005], bone),
      { labelAt: [0, 1.72, 0] });

    this.add(S, 'mandible', 'Mandible',
      'The only mobile bone of the skull, articulating at the temporomandibular joint. It carries the lower dentition and is the attachment for the muscles of mastication. Its weakest points are the condylar neck and the angle, which is why those are the commonest sites of fracture — and mandibular fractures are frequently bilateral.',
      ellipsoid(0.125, 0.075, 0.135, [0, 1.545, 0.03], bone),
      { labelAt: [0, 1.52, 0.08] });

    // --- Vertebral column: 7 cervical, 12 thoracic, 5 lumbar, sacrum ---
    const vertebrae = [];
    const spineCurve = (y) => {
      // Cervical lordosis, thoracic kyphosis, lumbar lordosis — a real
      // spine is a sine-ish curve in the sagittal plane, not a straight rod.
      if (y > 1.30) return -0.055 + (y - 1.30) * 0.30;       // cervical, moving anterior
      if (y > 1.05) return -0.075 - (1.30 - y) * 0.05;       // thoracic, posterior bulge
      return -0.085 + (1.05 - y) * 0.28;                     // lumbar, anterior again
    };

    for (let i = 0; i < 24; i++) {
      const y = 1.475 - i * 0.0295;
      const r = 0.020 + i * 0.0011;
      vertebrae.push(box(r * 2.1, 0.021, r * 1.9, [0, y, spineCurve(y)], bone));
      // spinous process pointing posteriorly
      vertebrae.push(box(0.012, 0.012, 0.045, [0, y - 0.004, spineCurve(y) - 0.038], bone));
    }

    this.add(S, 'vertebral-column', 'Vertebral Column',
      '33 vertebrae: 7 cervical, 12 thoracic, 5 lumbar, 5 fused sacral and 4 fused coccygeal. The four sagittal curves (cervical and lumbar lordosis, thoracic and sacral kyphosis) act as a spring and shift the centre of gravity over the pelvis. The spinal cord ends at L1–L2, which is why a lumbar puncture is done at L3–L4 or L4–L5 — below the conus, into the cauda equina.',
      vertebrae, { labelAt: [0, 1.20, -0.14] });

    // --- Ribcage ---
    const ribs = [];
    for (let i = 0; i < 12; i++) {
      const y = 1.415 - i * 0.028;
      const t = i / 11;
      const lateral = 0.105 + Math.sin(t * Math.PI * 0.85) * 0.055;   // widest around rib 8
      const ap      = lateral * 0.68;
      const isFloating = i >= 10;
      const arc = isFloating ? Math.PI * 0.62 : Math.PI * 0.95;

      for (const side of [1, -1]) {
        const g = new THREE.TorusGeometry(1, 0.0075, 6, 26, arc);
        g.rotateX(-Math.PI / 2);
        const rib = new THREE.Mesh(g, mat(bone));
        rib.scale.set(lateral * side, 1, ap);
        rib.rotation.y = -Math.PI / 2;
        rib.position.set(0, y, spineCurve(y) + ap * 0.55);
        rib.rotation.z = side * 0.06;   // ribs slope inferiorly as they run anteriorly
        ribs.push(rib);
      }
    }
    this.add(S, 'ribcage', 'Ribcage',
      '12 pairs. Ribs 1–7 are true ribs, joining the sternum by their own costal cartilage; 8–10 are false ribs, joining the cartilage above; 11 and 12 are floating, with no anterior attachment. The neurovascular bundle runs in the subcostal groove on the inferior border of each rib, which is why a chest drain is inserted just *above* the rib below.',
      ribs, { labelAt: [0.20, 1.30, 0] });

    this.add(S, 'sternum', 'Sternum',
      'Manubrium, body and xiphoid process. The manubriosternal joint forms the sternal angle (angle of Louis) at the level of the 2nd costal cartilage — the single most useful surface landmark in the chest: it marks the T4/T5 disc, the aortic arch, the carina, and the start and end of the aortic arch.',
      [box(0.055, 0.055, 0.022, [0, 1.375, 0.088], bone),
       box(0.042, 0.12, 0.020, [0, 1.285, 0.098], bone),
       box(0.022, 0.030, 0.014, [0, 1.212, 0.100], bone)],
      { labelAt: [0, 1.31, 0.14] });

    this.add(S, 'clavicle', 'Clavicles',
      'S-shaped struts holding the shoulder away from the trunk — the only bony connection between the upper limb and the axial skeleton. The commonest fracture site is the junction of the middle and lateral thirds, where the two curves meet.',
      [1, -1].map(s => capsuleBetween([s * 0.015, 1.425, 0.075], [s * 0.165, 1.435, 0.015], 0.011, bone)),
      { labelAt: [0.11, 1.45, 0.05] });

    this.add(S, 'scapula', 'Scapulae',
      'Flat triangular bones gliding on the posterior thoracic wall, held entirely by muscle. The glenoid fossa is shallow and covers only about a third of the humeral head — great range of movement, poor stability, hence the shoulder is the most commonly dislocated major joint.',
      [1, -1].map(s => {
        const m = ellipsoid(0.105, 0.145, 0.022, [s * 0.115, 1.345, -0.095], bone);
        m.rotation.z = -s * 0.12;
        return m;
      }),
      { labelAt: [0.13, 1.35, -0.14] });

    this.add(S, 'pelvis', 'Pelvis',
      'Two hip bones (ilium, ischium, pubis, fused at the acetabulum) plus sacrum and coccyx. It transmits body weight from spine to lower limbs, and its shape is strongly sexually dimorphic: the female pelvis is wider with a broader subpubic angle and a more circular inlet, for childbirth.',
      [ellipsoid(0.30, 0.155, 0.19, [0, 1.00, -0.015], bone),
       box(0.075, 0.11, 0.055, [0, 0.955, -0.075], bone)],
      { labelAt: [0, 1.02, 0.13] });

    // --- Upper limb ---
    for (const [s, side] of [[1, 'Left'], [-1, 'Right']]) {
      const sh = [s * 0.185, L.acromion - 0.02, 0];
      const el = [s * 0.215, 1.135, 0.005];
      const wr = [s * 0.225, 0.875, 0.02];

      this.add(S, `humerus-${side.toLowerCase()}`, `Humerus (${side})`,
        'The long bone of the arm. The radial nerve spirals around its posterior surface in the radial groove — a mid-shaft fracture classically produces wrist drop. The surgical neck, just below the head, is the usual fracture site in the elderly and endangers the axillary nerve.',
        capsuleBetween(sh, el, 0.023, bone), { labelAt: [s * 0.26, 1.28, 0] });

      this.add(S, `forearm-${side.toLowerCase()}`, `Radius & Ulna (${side})`,
        'Two parallel bones joined by an interosseous membrane. The radius carries the wrist; the ulna forms the elbow hinge. Pronation and supination are the radius rotating over a fixed ulna. A distal radius fracture (Colles’) is the commonest fracture in people over 65.',
        [capsuleBetween([el[0] + s * 0.012, el[1], el[2] + 0.012], [wr[0] + s * 0.012, wr[1], wr[2] + 0.008], 0.014, bone),
         capsuleBetween([el[0] - s * 0.012, el[1], el[2] - 0.010], [wr[0] - s * 0.012, wr[1], wr[2] - 0.006], 0.013, bone)],
        { labelAt: [s * 0.27, 1.00, 0] });

      this.add(S, `hand-${side.toLowerCase()}`, `Hand (${side})`,
        '27 bones: 8 carpals, 5 metacarpals, 14 phalanges. The scaphoid is the most commonly fractured carpal and its blood supply enters distally, so a proximal fracture risks avascular necrosis — the reason a tender anatomical snuffbox is taken seriously even with a normal X-ray.',
        [ellipsoid(0.075, 0.115, 0.03, [wr[0], 0.815, wr[2]], bone)],
        { labelAt: [s * 0.26, 0.80, 0] });
    }

    // --- Lower limb ---
    for (const [s, side] of [[1, 'Left'], [-1, 'Right']]) {
      const hip = [s * 0.09, L.hipJoint, -0.01];
      const kn  = [s * 0.075, L.knee, 0];
      const an  = [s * 0.068, L.ankle, -0.005];

      this.add(S, `femur-${side.toLowerCase()}`, `Femur (${side})`,
        'The longest and strongest bone in the body. Its head sits deep in the acetabulum and receives blood mainly through retinacular vessels running up the neck, so a displaced intracapsular neck-of-femur fracture threatens the head’s blood supply and often needs replacement rather than fixation.',
        capsuleBetween(hip, kn, 0.031, bone), { labelAt: [s * 0.13, 0.72, 0] });

      this.add(S, `patella-${side.toLowerCase()}`, `Patella (${side})`,
        'The largest sesamoid bone, embedded in the quadriceps tendon. It increases the moment arm of the quadriceps by holding the tendon away from the joint’s axis, making knee extension substantially more efficient.',
        ellipsoid(0.048, 0.05, 0.022, [s * 0.075, L.knee + 0.015, 0.038], bone),
        { labelAt: [s * 0.10, 0.53, 0.08] });

      this.add(S, `tibia-fibula-${side.toLowerCase()}`, `Tibia & Fibula (${side})`,
        'The tibia is weight-bearing; the fibula carries almost no load and mainly provides muscle attachment and the lateral malleolus. The tibia’s subcutaneous anteromedial surface is why tibial fractures are so often open. The common fibular nerve winds round the fibular neck — vulnerable to compression, causing foot drop.',
        [capsuleBetween([kn[0] - s * 0.010, kn[1], kn[2]], [an[0] - s * 0.008, an[1], an[2]], 0.021, bone),
         capsuleBetween([kn[0] + s * 0.026, kn[1] - 0.02, kn[2]], [an[0] + s * 0.024, an[1], an[2]], 0.010, bone)],
        { labelAt: [s * 0.13, 0.30, 0] });

      this.add(S, `foot-${side.toLowerCase()}`, `Foot (${side})`,
        '26 bones arranged into medial and lateral longitudinal arches and a transverse arch, sprung by the plantar fascia and supported by tibialis posterior. The arches distribute load and act as a shock absorber; their collapse is pes planus.',
        ellipsoid(0.085, 0.06, 0.24, [s * 0.068, 0.035, 0.055], bone),
        { labelAt: [s * 0.09, 0.03, 0.16] });
    }
  }

  /* ============================================================
     MUSCULAR — major superficial groups only
     ============================================================ */
  _buildMuscular() {
    const M = 'muscular';
    const red = SYSTEMS.muscular.color;

    this.add(M, 'pectoralis', 'Pectoralis Major',
      'Broad fan from clavicle, sternum and costal cartilages to the intertubercular groove of the humerus. It adducts, flexes and medially rotates the arm. Its lower border forms the anterior axillary fold, and it is the landmark under which the axillary tail of the breast runs.',
      [1, -1].map(s => {
        const m = ellipsoid(0.16, 0.13, 0.075, [s * 0.085, 1.325, 0.085], red);
        m.rotation.z = -s * 0.25;
        return m;
      }), { labelAt: [0.10, 1.36, 0.14] });

    this.add(M, 'deltoid', 'Deltoid',
      'Caps the shoulder in three parts — anterior, middle and posterior — giving flexion, abduction and extension respectively. The middle fibres are multipennate for power. Supplied by the axillary nerve, which is why deltoid wasting and a loss of sensation over the regimental badge area follow shoulder dislocation.',
      [1, -1].map(s => ellipsoid(0.10, 0.135, 0.115, [s * 0.185, 1.385, 0], red)),
      { labelAt: [0.23, 1.42, 0] });

    this.add(M, 'biceps', 'Biceps Brachii',
      'Two heads crossing both the shoulder and the elbow. It is the primary supinator of the forearm and a strong elbow flexor — most powerful when the forearm is already supinated, which is the mechanical reason screws are threaded clockwise.',
      [1, -1].map(s => capsuleBetween([s * 0.19, 1.36, 0.03], [s * 0.215, 1.16, 0.03], 0.035, red)),
      { labelAt: [0.25, 1.26, 0.06] });

    this.add(M, 'triceps', 'Triceps Brachii',
      'Three heads occupying the entire posterior compartment of the arm — the sole extensor of the elbow. Supplied by the radial nerve. Its long head crosses the shoulder and so also assists extension and adduction of the arm.',
      [1, -1].map(s => capsuleBetween([s * 0.185, 1.38, -0.035], [s * 0.21, 1.16, -0.03], 0.033, red)),
      { labelAt: [0.25, 1.26, -0.07] });

    this.add(M, 'rectus-abdominis', 'Rectus Abdominis',
      'Paired vertical straps from pubis to costal margin, crossed by three or four tendinous intersections — the "six pack" is a tendon pattern, not separate muscles. Enclosed in the rectus sheath, whose posterior wall ends at the arcuate line, below which all aponeuroses pass in front.',
      [1, -1].map(s => box(0.065, 0.28, 0.045, [s * 0.038, 1.16, 0.10], red)),
      { labelAt: [0, 1.14, 0.15] });

    this.add(M, 'obliques', 'External Obliques',
      'Fibres run infero-medially — "hands in pockets". With the internal oblique and transversus abdominis they compress the abdomen, raise intra-abdominal pressure for coughing and defecation, and rotate the trunk. Their lower border rolls in to form the inguinal ligament.',
      [1, -1].map(s => {
        const m = ellipsoid(0.10, 0.26, 0.15, [s * 0.105, 1.16, 0.03], red);
        m.rotation.z = s * 0.08;
        return m;
      }), { labelAt: [0.15, 1.15, 0.08] });

    this.add(M, 'trapezius', 'Trapezius',
      'A large diamond over the upper back. Upper fibres elevate the scapula, middle retract it, lower depress it — together they rotate the glenoid upwards, which is what lets you raise your arm above shoulder height. Supplied by the accessory nerve (CN XI).',
      [ellipsoid(0.34, 0.30, 0.09, [0, 1.34, -0.10], red)],
      { labelAt: [0, 1.42, -0.14] });

    this.add(M, 'latissimus', 'Latissimus Dorsi',
      'The broadest muscle of the back, from thoracolumbar fascia and iliac crest to the intertubercular groove. It extends, adducts and medially rotates the arm — the pulling-up and swimming muscle. Its bulk and reliable thoracodorsal pedicle make it a workhorse flap in reconstructive surgery.',
      [1, -1].map(s => {
        const m = ellipsoid(0.17, 0.30, 0.10, [s * 0.10, 1.19, -0.075], red);
        m.rotation.z = s * 0.16;
        return m;
      }), { labelAt: [0.15, 1.18, -0.13] });

    this.add(M, 'gluteus', 'Gluteus Maximus',
      'The largest muscle in the body; the principal extensor of the hip, used for standing from sitting, climbing and running rather than level walking. Gluteus medius and minimus beneath it abduct the hip and stabilise the pelvis in single-leg stance — their failure gives a Trendelenburg gait.',
      [1, -1].map(s => ellipsoid(0.155, 0.17, 0.145, [s * 0.088, 0.985, -0.095], red)),
      { labelAt: [0.12, 0.99, -0.16] });

    this.add(M, 'quadriceps', 'Quadriceps Femoris',
      'Four heads — rectus femoris plus the three vasti — converging on the patella and inserting via the patellar ligament onto the tibial tuberosity. The sole extensor of the knee. Rectus femoris also crosses the hip, so it flexes the hip as well.',
      [1, -1].map(s => capsuleBetween([s * 0.088, 0.90, 0.025], [s * 0.077, 0.55, 0.025], 0.056, red)),
      { labelAt: [0.14, 0.72, 0.07] });

    this.add(M, 'hamstrings', 'Hamstrings',
      'Biceps femoris, semitendinosus and semimembranosus. They extend the hip and flex the knee, and because they span both joints they are prone to strain during the deceleration phase of sprinting. All are supplied by the tibial division of the sciatic nerve.',
      [1, -1].map(s => capsuleBetween([s * 0.088, 0.90, -0.045], [s * 0.077, 0.55, -0.035], 0.048, red)),
      { labelAt: [0.14, 0.72, -0.09] });

    this.add(M, 'gastrocnemius', 'Gastrocnemius & Soleus',
      'The triceps surae, inserting via the Achilles tendon onto the calcaneus. They plantarflex the ankle and drive push-off in gait. Their pumping action on the deep veins is the "calf muscle pump" — immobility disables it and is a major contributor to DVT.',
      [1, -1].map(s => capsuleBetween([s * 0.073, 0.485, -0.045], [s * 0.068, 0.19, -0.03], 0.045, red)),
      { labelAt: [0.12, 0.35, -0.08] });
  }

  /* ============================================================
     NERVOUS
     ============================================================ */
  _buildNervous() {
    const N = 'nervous';
    const brainC = 0xd9c7ac, cordC = 0xefe4cf, nerveC = 0xf0e2b8;

    this.add(N, 'cerebrum', 'Cerebrum',
      'Two hemispheres of folded cortex divided into frontal, parietal, temporal and occipital lobes. The central sulcus separates the primary motor cortex (precentral gyrus) from primary sensory cortex (postcentral). Each hemisphere controls the opposite side of the body; language is left-dominant in the great majority of people.',
      [1, -1].map(s => ellipsoid(0.068, 0.115, 0.155, [s * 0.036, 1.665, 0.015], brainC, { flat: true })),
      { labelAt: [0, 1.73, 0.02] });

    this.add(N, 'cerebellum', 'Cerebellum',
      'Sits in the posterior cranial fossa under the tentorium. It does not initiate movement — it coordinates it, tuning timing, balance and precision. Damage causes ataxia, intention tremor, dysdiadochokinesia and nystagmus, and crucially the signs are *ipsilateral* to the lesion.',
      ellipsoid(0.095, 0.05, 0.06, [0, 1.60, -0.055], 0xc4ae90, { flat: true }),
      { labelAt: [0, 1.60, -0.10] });

    this.add(N, 'brainstem', 'Brainstem',
      'Midbrain, pons and medulla. It carries every ascending and descending tract, houses cranial nerve nuclei III–XII, and contains the cardiovascular and respiratory centres. Because so much is packed into so little space, small brainstem lesions produce devastating deficits.',
      capsuleBetween([0, 1.605, -0.005], [0, 1.525, -0.02], 0.019, cordC),
      { labelAt: [0, 1.56, -0.05] });

    this.add(N, 'spinal-cord', 'Spinal Cord',
      'Runs from the foramen magnum to the conus medullaris at about L1–L2, then continues as the cauda equina. 31 pairs of spinal nerves leave it. Because the cord ends at L1–L2 while the canal continues, lumbar punctures below L3 reach CSF without risking the cord itself.',
      tubeAlong([[0, 1.525, -0.03], [0, 1.42, -0.045], [0, 1.25, -0.068], [0, 1.10, -0.058], [0, 1.00, -0.03]], 0.011, cordC),
      { labelAt: [0, 1.25, -0.10] });

    this.add(N, 'brachial-plexus', 'Brachial Plexus',
      'C5–T1 roots forming trunks, divisions, cords and branches — the classic "Real Texans Drink Cold Beer" chain. It supplies the whole upper limb. Upper root injury (C5–6) gives Erb’s palsy with the waiter’s-tip posture; lower root injury (C8–T1) gives Klumpke’s palsy with a claw hand.',
      [1, -1].flatMap(s => [
        capsuleBetween([s * 0.02, 1.44, -0.04], [s * 0.14, 1.40, -0.005], 0.006, nerveC),
        capsuleBetween([s * 0.14, 1.40, -0.005], [s * 0.20, 1.32, 0.01], 0.005, nerveC),
      ]), { labelAt: [0.16, 1.42, 0.02] });

    this.add(N, 'peripheral-nerves', 'Major Peripheral Nerves',
      'Radial, median and ulnar in the upper limb; sciatic, tibial and common fibular in the lower. The sciatic nerve is the largest in the body, leaving the pelvis through the greater sciatic foramen and dividing above the knee. The ulnar nerve is superficial at the medial epicondyle — the "funny bone".',
      [1, -1].flatMap(s => [
        capsuleBetween([s * 0.20, 1.32, 0.01], [s * 0.225, 0.90, 0.01], 0.005, nerveC),
        capsuleBetween([s * 0.075, 0.99, -0.04], [s * 0.078, 0.52, -0.02], 0.007, nerveC),
        capsuleBetween([s * 0.078, 0.52, -0.02], [s * 0.070, 0.12, -0.01], 0.005, nerveC),
      ]), { labelAt: [0.12, 0.75, -0.10] });
  }

  /* ============================================================
     CIRCULATORY
     ============================================================ */
  _buildCirculatory() {
    const C = 'circulatory';
    const arteryC = 0xb5372c, veinC = 0x36618e, heartC = 0x8f2a22;

    this.add(C, 'heart', 'Heart',
      'A four-chambered pump the size of a closed fist, sitting in the middle mediastinum, about two-thirds to the left of the midline. Right side to the lungs, left side to the body — which is why the left ventricle’s wall is roughly three times thicker. Its own supply comes from the coronary arteries, the first branches off the aorta.',
      [(() => { const m = ellipsoid(0.10, 0.125, 0.088, [-0.028, 1.30, 0.045], heartC); m.rotation.z = 0.32; return m; })(),
       ellipsoid(0.055, 0.045, 0.05, [-0.055, 1.355, 0.035], 0xa8443a)],
      { labelAt: [-0.10, 1.31, 0.10] });

    this.add(C, 'aorta', 'Aorta',
      'The body’s main artery. It leaves the left ventricle, arches over the left main bronchus at the level of the sternal angle giving off brachiocephalic, left common carotid and left subclavian, then descends through the thorax and abdomen to bifurcate into the common iliacs at L4.',
      tubeAlong([[-0.02, 1.28, 0.05], [-0.01, 1.375, 0.035], [0.005, 1.405, -0.01],
                 [-0.005, 1.36, -0.045], [-0.008, 1.20, -0.05], [-0.008, 1.05, -0.035],
                 [-0.008, 0.985, -0.02]], 0.0135, arteryC),
      { labelAt: [0.05, 1.40, -0.02] });

    this.add(C, 'vena-cava', 'Vena Cavae',
      'The superior vena cava drains head, neck and upper limbs; the inferior vena cava drains everything below the diaphragm. Both empty into the right atrium. The IVC is the largest vein in the body and lies to the right of the aorta — which is why a right-sided approach is used to access it.',
      [tubeAlong([[0.038, 1.40, 0.01], [0.032, 1.34, 0.015], [0.022, 1.30, 0.025]], 0.013, veinC),
       tubeAlong([[0.022, 1.30, 0.02], [0.030, 1.20, -0.02], [0.032, 1.05, -0.02], [0.030, 0.985, -0.015]], 0.014, veinC)],
      { labelAt: [0.08, 1.34, 0] });

    this.add(C, 'pulmonary-vessels', 'Pulmonary Trunk & Arteries',
      'The one artery pair in the body carrying deoxygenated blood, and the one vein pair carrying oxygenated. The pulmonary trunk leaves the right ventricle and divides at the level of the sternal angle. Pressure here is far lower than systemic — normally about 25/8 mmHg.',
      [tubeAlong([[-0.02, 1.345, 0.04], [-0.01, 1.375, 0.01], [0.02, 1.375, -0.01]], 0.011, 0x6a4f8f),
       tubeAlong([[-0.01, 1.375, 0.005], [-0.075, 1.36, -0.01]], 0.009, 0x6a4f8f),
       tubeAlong([[-0.01, 1.375, 0.005], [0.075, 1.36, -0.01]], 0.009, 0x6a4f8f)],
      { labelAt: [0, 1.40, 0.06] });

    this.add(C, 'carotid-jugular', 'Carotid Arteries & Jugular Veins',
      'The common carotid divides at the upper border of the thyroid cartilage into internal (brain and eye) and external (face and scalp). The carotid sinus at the bifurcation is a baroreceptor. The internal jugular runs with it inside the carotid sheath, lateral to the artery.',
      [1, -1].flatMap(s => [
        capsuleBetween([s * 0.028, 1.44, 0.015], [s * 0.038, 1.575, 0.03], 0.008, arteryC),
        capsuleBetween([s * 0.050, 1.44, 0.02], [s * 0.055, 1.565, 0.035], 0.009, veinC),
      ]), { labelAt: [0.07, 1.51, 0.05] });

    this.add(C, 'limb-vessels', 'Major Limb Vessels',
      'Subclavian becomes axillary at the first rib, then brachial in the arm, dividing into radial and ulnar at the elbow. In the leg, external iliac becomes femoral at the inguinal ligament, popliteal behind the knee, then anterior and posterior tibial. These transition points are named by location, not by any change in the vessel itself.',
      [1, -1].flatMap(s => [
        capsuleBetween([s * 0.16, 1.40, 0.005], [s * 0.215, 1.15, 0.015], 0.0075, arteryC),
        capsuleBetween([s * 0.215, 1.15, 0.015], [s * 0.225, 0.89, 0.02], 0.006, arteryC),
        capsuleBetween([s * 0.085, 0.985, 0.02], [s * 0.077, 0.52, 0.01], 0.0085, arteryC),
        capsuleBetween([s * 0.077, 0.52, 0.01], [s * 0.068, 0.12, 0], 0.0065, arteryC),
      ]), { labelAt: [0.14, 0.90, 0.05] });
  }

  /* ============================================================
     RESPIRATORY
     ============================================================ */
  _buildRespiratory() {
    const R = 'respiratory';
    const lungC = 0xdc9aae, airwayC = 0xc9d6da;

    this.add(R, 'trachea', 'Trachea',
      'About 10–12 cm long, held open by 16–20 C-shaped cartilage rings that are incomplete posteriorly so the oesophagus behind can distend. It bifurcates at the carina at the level of the sternal angle (T4/T5).',
      tubeAlong([[0, 1.50, 0.02], [0, 1.44, 0.01], [0, 1.385, 0.0]], 0.0135, airwayC),
      { labelAt: [0, 1.46, 0.06] });

    this.add(R, 'bronchi', 'Main Bronchi',
      'The right main bronchus is wider, shorter and more vertical than the left — so inhaled foreign bodies and aspirated material go right far more often than left. Each divides into lobar then segmental bronchi following the lobes.',
      [tubeAlong([[0, 1.385, 0], [0.045, 1.355, -0.005], [0.075, 1.335, -0.005]], 0.010, airwayC),
       tubeAlong([[0, 1.385, 0], [-0.040, 1.360, -0.005], [-0.085, 1.345, -0.005]], 0.009, airwayC)],
      { labelAt: [0, 1.35, -0.06] });

    this.add(R, 'lung-right', 'Right Lung',
      'Three lobes — upper, middle and lower — separated by the oblique and horizontal fissures. It is shorter than the left because the liver pushes the right hemidiaphragm up, but wider, because the heart is not in the way. Gas exchange happens across roughly 300 million alveoli.',
      [ellipsoid(0.115, 0.115, 0.15, [0.098, 1.365, -0.005], lungC, { opacity: 0.93 }),
       ellipsoid(0.105, 0.075, 0.135, [0.100, 1.275, 0.005], lungC, { opacity: 0.93 }),
       ellipsoid(0.115, 0.115, 0.15, [0.098, 1.195, -0.01], lungC, { opacity: 0.93 })],
      { labelAt: [0.19, 1.30, 0] });

    this.add(R, 'lung-left', 'Left Lung',
      'Only two lobes, upper and lower, split by the oblique fissure. Its anterior border carries the cardiac notch and the lingula, both accommodating the heart. Slightly smaller in total volume than the right for the same reason.',
      [ellipsoid(0.105, 0.14, 0.148, [-0.098, 1.345, -0.005], lungC, { opacity: 0.93 }),
       ellipsoid(0.105, 0.125, 0.148, [-0.098, 1.205, -0.01], lungC, { opacity: 0.93 })],
      { labelAt: [-0.19, 1.30, 0] });

    this.add(R, 'diaphragm', 'Diaphragm',
      'The principal muscle of respiration, supplied by the phrenic nerve (C3, 4, 5 — "keep the diaphragm alive"). Contraction flattens the dome and drops intrathoracic pressure. Three major openings: caval at T8, oesophageal at T10, aortic at T12.',
      (() => { const m = ellipsoid(0.29, 0.10, 0.20, [0, 1.145, -0.005], 0xc06a62, { opacity: 0.92 }); return m; })(),
      { labelAt: [0, 1.13, 0.14] });
  }

  /* ============================================================
     DIGESTIVE
     ============================================================ */
  _buildDigestive() {
    const D = 'digestive';
    const gutC = 0xcf9a63, liverC = 0x7d3b34, stomachC = 0xc98a6b;

    this.add(D, 'oesophagus', 'Oesophagus',
      'A 25 cm muscular tube from pharynx to stomach, passing behind the trachea and through the diaphragm at T10. Its upper third is skeletal muscle, the lower third smooth, the middle mixed. It has three natural constrictions where swallowed objects lodge and where caustic injury is worst.',
      tubeAlong([[0, 1.50, -0.02], [0, 1.35, -0.03], [0, 1.20, -0.02], [-0.01, 1.15, 0.0]], 0.011, gutC),
      { labelAt: [0.05, 1.24, -0.06] });

    this.add(D, 'stomach', 'Stomach',
      'A J-shaped reservoir in the left upper quadrant with fundus, body, antrum and pylorus. Parietal cells secrete HCl and intrinsic factor; chief cells secrete pepsinogen. It holds and churns rather than absorbs — very little absorption happens here besides alcohol and some drugs.',
      (() => { const m = ellipsoid(0.135, 0.115, 0.095, [-0.055, 1.085, 0.02], stomachC); m.rotation.z = -0.35; return m; })(),
      { labelAt: [-0.13, 1.10, 0.08] });

    this.add(D, 'liver', 'Liver',
      'The largest internal organ, roughly 1.5 kg, occupying the right upper quadrant under the diaphragm. It has a dual blood supply — about 75% from the portal vein, 25% from the hepatic artery. It handles protein synthesis, detoxification, bile production, glycogen storage and clotting factor manufacture.',
      [(() => { const m = ellipsoid(0.21, 0.115, 0.155, [0.055, 1.13, 0.025], liverC); m.rotation.z = 0.10; return m; })(),
       ellipsoid(0.085, 0.075, 0.10, [-0.055, 1.14, 0.03], liverC)],
      { labelAt: [0.15, 1.16, 0.10] });

    this.add(D, 'gallbladder', 'Gallbladder',
      'A small sac on the liver’s inferior surface storing and concentrating bile. It contracts in response to CCK when fat reaches the duodenum. Its fundus sits at the tip of the 9th costal cartilage at the lateral border of rectus abdominis — Murphy’s point.',
      ellipsoid(0.035, 0.055, 0.045, [0.055, 1.075, 0.055], 0x5f7a3e),
      { labelAt: [0.10, 1.06, 0.09] });

    this.add(D, 'pancreas', 'Pancreas',
      'A retroperitoneal gland lying across the posterior abdominal wall at L1–L2. Exocrine acini make digestive enzymes; islets of Langerhans make insulin, glucagon and somatostatin. Its head sits in the C of the duodenum, which is why a head tumour obstructs the bile duct and causes painless jaundice.',
      (() => { const m = ellipsoid(0.155, 0.038, 0.05, [-0.015, 1.045, -0.03], 0xc9ae7a); m.rotation.z = 0.12; return m; })(),
      { labelAt: [-0.10, 1.03, -0.06] });

    this.add(D, 'small-intestine', 'Small Intestine',
      'Duodenum, jejunum and ileum — about 6 m in total and where nearly all nutrient absorption happens. Plicae circulares, villi and microvilli multiply the surface area roughly 600-fold. The ileum is the only site that absorbs vitamin B12 and bile salts.',
      tubeAlong([
        [-0.01, 1.02, 0.02], [0.055, 0.995, 0.045], [0.02, 0.965, 0.06], [-0.06, 0.985, 0.05],
        [-0.075, 0.945, 0.015], [-0.01, 0.925, 0.045], [0.065, 0.945, 0.03], [0.045, 0.905, -0.01],
        [-0.04, 0.905, 0.02], [-0.055, 0.965, -0.02], [0.02, 0.99, -0.015], [0.055, 0.94, -0.03],
      ], 0.021, gutC), { labelAt: [0, 0.93, 0.09] });

    this.add(D, 'large-intestine', 'Large Intestine',
      'Caecum, ascending, transverse, descending and sigmoid colon, then rectum. Its job is water and electrolyte reabsorption and storage. Recognisable by taeniae coli, haustra and appendices epiploicae — features the small bowel lacks, which is how you tell them apart on a film.',
      tubeAlong([
        [0.105, 0.925, 0.01], [0.115, 1.00, 0.015], [0.105, 1.055, 0.02],
        [0.04, 1.075, 0.045], [-0.05, 1.070, 0.045], [-0.105, 1.045, 0.02],
        [-0.115, 0.975, 0.005], [-0.085, 0.915, 0.005], [-0.02, 0.895, -0.005], [0, 0.855, -0.015],
      ], 0.028, 0xb9834f), { labelAt: [0.16, 1.00, 0.03] });

    this.add(D, 'appendix', 'Appendix',
      'A blind-ended tube off the caecum, on average 9 cm long, with highly variable position — retrocaecal most often, pelvic next. McBurney’s point, a third of the way from the right anterior superior iliac spine to the umbilicus, marks its base on the surface.',
      capsuleBetween([0.105, 0.915, 0.015], [0.09, 0.875, 0.03], 0.008, 0xb9834f),
      { labelAt: [0.15, 0.88, 0.05] });
  }

  /* ============================================================
     URINARY
     ============================================================ */
  _buildUrinary() {
    const U = 'urinary';
    const kidneyC = 0x8d5a3b;

    this.add(U, 'kidneys', 'Kidneys',
      'Retroperitoneal, roughly T12–L3, with the right sitting slightly lower because of the liver. Together they filter about 180 litres of plasma a day and return over 99% of it. Beyond urine they regulate blood pressure via renin, red cell production via erythropoietin, and activate vitamin D.',
      [1, -1].map(s => {
        const m = ellipsoid(0.055, 0.115, 0.065, [s * 0.075, 1.055 - (s < 0 ? 0.018 : 0), -0.055], kidneyC);
        m.rotation.z = -s * 0.12;
        return m;
      }), { labelAt: [0.12, 1.06, -0.10] });

    this.add(U, 'ureters', 'Ureters',
      'Muscular tubes about 25 cm long carrying urine by peristalsis, not gravity. Three natural narrowings — the pelviureteric junction, the pelvic brim where they cross the iliac vessels, and the vesicoureteric junction — are where stones lodge and cause renal colic.',
      [1, -1].map(s => tubeAlong([
        [s * 0.072, 1.005, -0.05], [s * 0.062, 0.94, -0.035], [s * 0.030, 0.895, -0.01],
      ], 0.006, 0xa8794f)), { labelAt: [0.08, 0.95, -0.06] });

    this.add(U, 'bladder', 'Bladder',
      'A distensible muscular reservoir sitting behind the pubic symphysis, holding 400–600 ml comfortably. The detrusor muscle contracts to void. When full it rises out of the pelvis and becomes palpable — and percussible — above the pubis.',
      ellipsoid(0.09, 0.075, 0.085, [0, 0.885, 0.015], 0xd9c56b),
      { labelAt: [0, 0.86, 0.08] });
  }

  /* ============================================================
     SURFACE — a translucent shell for orientation
     ============================================================ */
  _buildSurface() {
    const S = 'surface';
    const skin = SYSTEMS.surface.color;
    const o = { opacity: 0.20, shine: 0.35 };
    const meshes = [];

    meshes.push(ellipsoid(0.165, 0.225, 0.205, [0, 1.635, 0.005], skin, o));                // head
    meshes.push(capsuleBetween([0, 1.44, 0], [0, 1.56, 0.005], 0.058, skin, o));            // neck
    meshes.push(ellipsoid(0.34, 0.30, 0.225, [0, 1.30, 0], skin, o));                       // thorax
    meshes.push(ellipsoid(0.29, 0.24, 0.195, [0, 1.10, 0], skin, o));                       // abdomen
    meshes.push(ellipsoid(0.335, 0.20, 0.215, [0, 0.965, -0.005], skin, o));                // pelvis

    for (const s of [1, -1]) {
      meshes.push(capsuleBetween([s * 0.185, 1.42, 0], [s * 0.215, 1.14, 0.005], 0.052, skin, o));
      meshes.push(capsuleBetween([s * 0.215, 1.14, 0.005], [s * 0.225, 0.88, 0.015], 0.042, skin, o));
      meshes.push(ellipsoid(0.085, 0.125, 0.045, [s * 0.228, 0.82, 0.015], skin, o));
      meshes.push(capsuleBetween([s * 0.09, 0.94, 0], [s * 0.077, 0.52, 0], 0.077, skin, o));
      meshes.push(capsuleBetween([s * 0.077, 0.52, 0], [s * 0.068, 0.10, -0.005], 0.056, skin, o));
      meshes.push(ellipsoid(0.095, 0.075, 0.255, [s * 0.068, 0.04, 0.06], skin, o));
    }

    for (const m of meshes) { m.castShadow = false; }

    this.add(S, 'body-surface', 'Body Surface',
      'The outer shell, shown translucent for orientation. Turn it off to see the deeper systems clearly, or leave it on at low opacity to keep track of where a structure sits relative to the body wall.',
      meshes, { pickable: false });
  }
}
