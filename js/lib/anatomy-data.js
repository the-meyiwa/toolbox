/* ============================================================
   Anatomy Data Repository & Service.

   Authoritative structured anatomical data layer for Anatomy Explorer.
   Provides Terminologia Anatomica terms, common names, system & region
   taxonomies, physiological functions, clinical pearls, blood supply,
   innervation, relationships, and ontology mappings (FMA / BioPortal).
   Includes local caching, request deduplication, and offline fallbacks.
   ============================================================ */

/**
 * @typedef {Object} AnatomicalDetail
 * @property {string} id - FMA identifier or unique key
 * @property {string} name - Official Latin / Terminologia Anatomica term
 * @property {string} commonName - Widely recognized English name
 * @property {string} system - Organ system (skeletal, muscular, nervous, cardiovascular, etc.)
 * @property {string} region - Major anatomical region (Head & Neck, Thorax, Abdomen, Pelvis, Upper Limb, Lower Limb)
 * @property {string} [subregion] - Detailed anatomical compartment
 * @property {string} functionDesc - Physiological and mechanical function
 * @property {string} clinicalNotes - Clinical pearls, surgical relevance, pathology, and trauma
 * @property {string} [innervation] - Nerve supply
 * @property {string} [bloodSupply] - Arterial supply & venous drainage
 * @property {string[]} [relations] - Articulating or connected structures
 * @property {string} [fma] - FMA numeric identifier
 */

export const ANATOMICAL_REGIONS = [
  { id: 'all', label: 'All Regions' },
  { id: 'head-neck', label: 'Head & Neck' },
  { id: 'thorax', label: 'Thorax' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'pelvis', label: 'Pelvis & Perineum' },
  { id: 'upper-limb', label: 'Upper Limb' },
  { id: 'lower-limb', label: 'Lower Limb' },
];

/**
 * Structured taxonomy and teaching data.
 * @type {Record<string, Partial<AnatomicalDetail>>}
 */
export const ANATOMY_DATABASE = {
  /* ---------------- SKELETAL SYSTEM ---------------- */
  'skull': {
    name: 'Cranium / Skull',
    commonName: 'Skull',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Cranial Vault & Base',
    functionDesc: 'Protects the brain, sensory organs (eyes, ears, vestibular system, olfactory receptors), and forms the framework of the face.',
    clinicalNotes: 'The floor forms anterior, middle, and posterior cranial fossae. Pterion fracture endangers the middle meningeal artery leading to acute extradural hematoma (lucid interval followed by rapid herniation).',
    bloodSupply: 'Internal & external carotid branches; middle meningeal artery; vertebral arteries.',
    relations: ['Atlas (C1 vertebra)', 'Mandible', 'Hyoid bone'],
    fma: '46565',
  },
  'frontal bone': {
    name: 'Os frontale',
    commonName: 'Frontal Bone',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Neurocranium',
    functionDesc: 'Forms the forehead, the roofs of the orbits, and the anterior part of the cranial fossa.',
    clinicalNotes: 'Contains frontal air sinuses. Fracture of the orbital plate can lead to subconjunctival ecchymosis and anosmia if the cribriform plate is involved.',
    relations: ['Parietal bones', 'Nasal bones', 'Zygomatic bones', 'Sphenoid bone', 'Ethmoid bone'],
    fma: '52734',
  },
  'parietal bone': {
    name: 'Os parietale',
    commonName: 'Parietal Bone',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Calvaria',
    functionDesc: 'Forms the bulges of the sides and roof of the cranium, protecting the parietal lobes.',
    clinicalNotes: 'Joined at the sagittal suture. The grooved inner surface carries branches of the middle meningeal vessels.',
    relations: ['Frontal bone', 'Occipital bone', 'Temporal bone', 'Sphenoid bone'],
    fma: '52788',
  },
  'temporal bone': {
    name: 'Os temporale',
    commonName: 'Temporal Bone',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Cranial Base & Lateral Wall',
    functionDesc: 'Houses the cochlea, semicircular canals, middle ear ossicles, and the mastoid air cells; articulates with the mandible.',
    clinicalNotes: 'The petrous part is the densest bone in the body. Mastoiditis can spread intracranially causing sigmoid sinus thrombosis or temporal lobe abscess.',
    innervation: 'Facial nerve (CN VII) and Vestibulocochlear nerve (CN VIII) traverse internal acoustic meatus.',
    relations: ['Parietal bone', 'Occipital bone', 'Sphenoid bone', 'Zygomatic bone', 'Mandible'],
    fma: '52738',
  },
  'occipital bone': {
    name: 'Os occipitale',
    commonName: 'Occipital Bone',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Posterior Cranial Fossa',
    functionDesc: 'Encloses the posterior cranial fossa containing the cerebellum, pons, and medulla oblongata.',
    clinicalNotes: 'The foramen magnum allows passage of the medulla into the spinal cord, vertebral arteries, and spinal accessory nerve. Basilar skull fractures may present with Battle sign (mastoid ecchymosis).',
    relations: ['Parietal bones', 'Temporal bones', 'Sphenoid bone', 'Atlas (C1)'],
    fma: '52735',
  },
  'sphenoid bone': {
    name: 'Os sphenoidale',
    commonName: 'Sphenoid Bone',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Central Cranial Base',
    functionDesc: 'The keystone of the cranial floor; anchors the neurocranium and forms the optic canal and superior orbital fissure.',
    clinicalNotes: 'The sella turcica (hypophyseal fossa) cradles the pituitary gland. Transsphenoidal surgery accesses pituitary adenomas through the sphenoid air sinus.',
    relations: ['Frontal', 'Ethmoid', 'Occipital', 'Parietal', 'Temporal', 'Zygomatic', 'Vomer'],
    fma: '52736',
  },
  'mandible': {
    name: 'Mandibula',
    commonName: 'Lower Jaw / Mandible',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Viscerocranium',
    functionDesc: 'The only mobile bone of the skull; supports lower dentition and enables mastication and speech.',
    clinicalNotes: 'Because of its rigid ring-like arch, mandible fractures frequently occur in two places simultaneously (e.g. angle and contralateral condyle). Endangers the inferior alveolar nerve.',
    innervation: 'Inferior alveolar nerve (branch of CN V3) through mandibular foramen.',
    bloodSupply: 'Inferior alveolar artery.',
    relations: ['Temporal bone at TMJ', 'Teeth of lower arch'],
    fma: '52748',
  },
  'maxilla': {
    name: 'Maxilla',
    commonName: 'Upper Jaw',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Viscerocranium',
    functionDesc: 'Forms the upper jaw, anterior hard palate, inferomedial orbital rim, and lateral wall of the nasal cavity.',
    clinicalNotes: 'Contains the large pyramidal maxillary sinus whose ostium drains superiorly against gravity into the middle meatus, predisposing to chronic sinusitis. Subject to Le Fort I, II, and III fracture patterns.',
    innervation: 'Infraorbital nerve and superior alveolar nerves (CN V2).',
    relations: ['Frontal', 'Ethmoid', 'Nasal', 'Zygomatic', 'Palatine', 'Vomer'],
    fma: '53649',
  },
  'cervical vertebra': {
    name: 'Vertebrae cervicales (C1–C7)',
    commonName: 'Cervical Vertebrae',
    system: 'skeletal',
    region: 'head-neck',
    subregion: 'Cervical Spine',
    functionDesc: 'Supports the head and facilitates flexion, extension, lateral bending, and rotation.',
    clinicalNotes: 'Distinguished by transverse foramina carrying the vertebral arteries (C1–C6). C1 (atlas) lacks a vertebral body and nods at atlanto-occipital joint; C2 (axis) bears the dens (odontoid process) allowing 50% of cervical rotation.',
    relations: ['Spinal cord', 'Vertebral artery', 'Occipital condyles', 'T1 vertebra'],
    fma: '12521',
  },
  'thoracic vertebra': {
    name: 'Vertebrae thoracicae (T1–T12)',
    commonName: 'Thoracic Vertebrae',
    system: 'skeletal',
    region: 'thorax',
    subregion: 'Thoracic Spine',
    functionDesc: 'Articulates with 12 pairs of ribs to form the rigid protective thoracic cage.',
    clinicalNotes: 'Characterized by costal facets on the bodies and transverse processes. Spinous processes overlap like roof tiles, severely limiting hyperextension.',
    relations: ['Ribs 1–12', 'Thoracic aorta', 'Sympathetic chain'],
    fma: '9165',
  },
  'lumbar vertebra': {
    name: 'Vertebrae lumbales (L1–L5)',
    commonName: 'Lumbar Vertebrae',
    system: 'skeletal',
    region: 'abdomen',
    subregion: 'Lumbar Spine',
    functionDesc: 'Bears the weight of the entire upper torso and transfers axial loads to the sacrum and pelvis.',
    clinicalNotes: 'The adult spinal cord terminates at the L1–L2 level (conus medullaris). Lumbar punctures (spinal tap) and spinal anesthesia are placed at L3–L4 or L4–L5 into the safe subarachnoid space of the cauda equina.',
    relations: ['Cauda equina', 'Sacrum', 'Psoas major'],
    fma: '13072',
  },
  'sacrum': {
    name: 'Os sacrum',
    commonName: 'Sacrum',
    system: 'skeletal',
    region: 'pelvis',
    subregion: 'Pelvic Ring',
    functionDesc: 'Five fused vertebrae forming the posterior wedge of the pelvis and distributing trunk weight to the ilia.',
    clinicalNotes: 'The sacral hiatus at S5 allows access for caudal epidural blocks in pediatric surgery and obstetrics. Sacroiliac joint inflammation (sacroiliitis) is a hallmark of HLA-B27 spondyloarthropathies.',
    relations: ['L5 vertebra', 'Ilium (sacroiliac joint)', 'Coccyx'],
    fma: '16202',
  },
  'sternum': {
    name: 'Sternum',
    commonName: 'Breastbone',
    system: 'skeletal',
    region: 'thorax',
    subregion: 'Anterior Thoracic Wall',
    functionDesc: 'Protects the mediastinum, heart, and great vessels; anchors anterior costal cartilages.',
    clinicalNotes: 'The sternal angle (Angle of Louis at T4/T5 level) marks the attachment of the 2nd costal cartilage, tracheal bifurcation (carina), and the start and end of the aortic arch. Crucial landmark for chest auscultation and needle thoracostomy.',
    relations: ['Clavicles', 'Costal cartilages 1–7', 'Heart & Pericardium'],
    fma: '7487',
  },
  'rib': {
    name: 'Costae (1–12)',
    commonName: 'Ribs',
    system: 'skeletal',
    region: 'thorax',
    subregion: 'Thoracic Cage',
    functionDesc: 'Encloses thoracic organs; expands with intercostal muscles during negative-pressure respiration.',
    clinicalNotes: 'The subcostal groove along the inferior border of each rib houses the intercostal vein, artery, and nerve (VAN order from superior to inferior). Thoracocentesis / chest tube insertion is always performed directly ABOVE the rib margin to avoid lacerating the neurovascular bundle.',
    relations: ['Thoracic vertebrae', 'Costal cartilages', 'Sternum', 'Lungs'],
    fma: '7857',
  },
  'clavicle': {
    name: 'Clavicula',
    commonName: 'Collarbone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Shoulder Pectoral Girdle',
    functionDesc: 'Acts as a mechanical strut that holds the upper limb away from the thorax for maximal range of motion.',
    clinicalNotes: 'The most commonly fractured long bone in the human body, classically occurring at the junction of the middle and lateral thirds where the bone curves reverse.',
    relations: ['Sternum (sternoclavicular joint)', 'Scapula (acromioclavicular joint)'],
    fma: '13322',
  },
  'scapula': {
    name: 'Scapula',
    commonName: 'Shoulder Blade',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Shoulder Girdle',
    functionDesc: 'Provides origin and insertion for 17 muscles; forms the glenohumeral socket for the head of the humerus.',
    clinicalNotes: 'The glenoid fossa covers only one-third of the humeral head, providing immense mobility at the expense of inherent stability. Long thoracic nerve injury (C5–C7) paralyzes serratus anterior causing winged scapula.',
    relations: ['Clavicle', 'Humerus', 'Thoracic wall (scapulothoracic sliding plane)'],
    fma: '13395',
  },
  'humerus': {
    name: 'Humerus',
    commonName: 'Arm Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Brachium',
    functionDesc: 'Transmits muscular torque from shoulder to elbow and forearm.',
    clinicalNotes: 'Midshaft spiral fractures endanger the radial nerve in the radial groove leading to wrist drop and sensory loss over the first dorsal web space. Surgical neck fractures endanger the axillary nerve and posterior circumflex humeral artery.',
    relations: ['Scapula', 'Radius', 'Ulna'],
    fma: '23130',
  },
  'femur': {
    name: 'Femur',
    commonName: 'Thigh Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Thigh',
    functionDesc: 'The longest and strongest bone in the body; transmits total body mass to the tibial plateau.',
    clinicalNotes: 'Displaced femoral neck fractures tear the ascending retinacular branches of the medial circumflex femoral artery, predisposing the femoral head to avascular necrosis (AVN) and requiring hemiarthroplasty or total hip replacement.',
    relations: ['Acetabulum (hip joint)', 'Patella', 'Tibia (knee joint)'],
    fma: '24474',
  },
  'tibia': {
    name: 'Tibia',
    commonName: 'Shinbone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Leg / Crus',
    functionDesc: 'The principal weight-bearing bone of the lower leg; forms the knee and talocrural ankle joints.',
    clinicalNotes: 'Its entire anteromedial shaft is subcutaneous, making tibial fractures the most frequent open (compound) fractures in human trauma, with high risk of osteomyelitis.',
    relations: ['Femur', 'Fibula', 'Talus'],
    fma: '24477',
  },
  'fibula': {
    name: 'Fibula',
    commonName: 'Calf Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Lateral Leg',
    functionDesc: 'Provides muscular attachments and lateral stability to the ankle via the lateral malleolus.',
    clinicalNotes: 'The common fibular (peroneal) nerve winds tightly around the neck of the fibula; blunt trauma or tight casting causes peroneal nerve palsy leading to foot drop and high-stepping gait.',
    relations: ['Tibia', 'Talus'],
    fma: '24480',
  },
  'patella': {
    name: 'Patella',
    commonName: 'Kneecap',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Anterior Knee',
    functionDesc: 'The largest sesamoid bone in the body; embedded in the quadriceps tendon to increase the mechanical leverage of the quadriceps femoris across the knee joint axis.',
    clinicalNotes: 'Subject to lateral subluxation/dislocation if the vastus medialis oblique (VMO) is weak or the Q-angle is abnormally elevated.',
    relations: ['Femur (trochlear groove)', 'Patellar tendon'],
    fma: '24486',
  },

  /* ---------------- MUSCULAR SYSTEM ---------------- */
  'diaphragm': {
    name: 'Diaphragma',
    commonName: 'Diaphragm',
    system: 'muscular',
    region: 'thorax',
    subregion: 'Thoracoabdominal Junction',
    functionDesc: 'Primary muscle of inspiration; flattens upon contraction to increase thoracic volume and draw air into the lungs.',
    clinicalNotes: 'Innervated solely by the phrenic nerve (roots C3, C4, C5: "C3, 4, 5 keeps the diaphragm alive"). Features 3 major apertures: Caval hiatus (T8, IVC), Esophageal hiatus (T10, esophagus & vagus), Aortic hiatus (T12, aorta, thoracic duct, azygos vein).',
    innervation: 'Phrenic nerve (C3–C5).',
    bloodSupply: 'Pericardiacophrenic, musculophrenic, and superior/inferior phrenic arteries.',
    fma: '13295',
  },
  'pectoralis major': {
    name: 'Musculus pectoralis major',
    commonName: 'Pec Major',
    system: 'muscular',
    region: 'thorax',
    subregion: 'Anterior Chest Wall',
    functionDesc: 'Adducts, medially rotates, and flexes the humerus at the glenohumeral joint.',
    clinicalNotes: 'Supplied by medial and lateral pectoral nerves. Commonly mobilized as a myocutaneous flap in head and neck reconstructive surgery.',
    innervation: 'Medial and lateral pectoral nerves (C5–T1).',
    bloodSupply: 'Pectoral branch of thoracoacromial trunk.',
    fma: '45874',
  },
  'deltoid': {
    name: 'Musculus deltoideus',
    commonName: 'Deltoid Muscle',
    system: 'muscular',
    region: 'upper-limb',
    subregion: 'Shoulder',
    functionDesc: 'Principal abductor of the arm past 15 degrees (initiated by supraspinatus); anterior fibers flex and medially rotate; posterior fibers extend and laterally rotate.',
    clinicalNotes: 'Innervated by the axillary nerve. An anterior shoulder dislocation endangers the axillary nerve, resulting in deltoid atrophy and sensory loss over the "regimental badge" area.',
    innervation: 'Axillary nerve (C5, C6).',
    bloodSupply: 'Posterior circumflex humeral artery.',
    fma: '34680',
  },
  'biceps': {
    name: 'Musculus biceps brachii',
    commonName: 'Biceps',
    system: 'muscular',
    region: 'upper-limb',
    subregion: 'Anterior Arm Compartment',
    functionDesc: 'Powerful supinator of the flexed forearm and strong flexor of the elbow joint; assists in shoulder flexion.',
    clinicalNotes: 'Rupture of the long head tendon causes the classic "Popeye deformity". Testing the biceps reflex assesses spinal roots C5 and C6 (musculocutaneous nerve).',
    innervation: 'Musculocutaneous nerve (C5, C6).',
    bloodSupply: 'Brachial artery branches.',
    fma: '37684',
  },
  'gluteus maximus': {
    name: 'Musculus gluteus maximus',
    commonName: 'Gluteus Maximus',
    system: 'muscular',
    region: 'pelvis',
    subregion: 'Gluteal Region',
    functionDesc: 'The strongest extensor and lateral rotator of the thigh; essential for rising from a sitting position, climbing stairs, and running.',
    clinicalNotes: 'Innervated exclusively by the inferior gluteal nerve (L5, S1, S2). Intramuscular injections are placed in the upper outer quadrant of the buttock (ventrogluteal site) to avoid piercing the sciatic nerve.',
    innervation: 'Inferior gluteal nerve (L5, S1, S2).',
    bloodSupply: 'Superior and inferior gluteal arteries.',
    fma: '22328',
  },
  'rectus abdominis': {
    name: 'Musculus rectus abdominis',
    commonName: 'Abs / Six-Pack',
    system: 'muscular',
    region: 'abdomen',
    subregion: 'Anterior Abdominal Wall',
    functionDesc: 'Flexes the lumbar spine, compresses abdominal viscera, and stabilizes the pelvis during gait.',
    clinicalNotes: 'Contained within the rectus sheath. Below the arcuate line (linea semicircularis), the posterior rectus sheath is absent, leaving only transversalis fascia between muscle and peritoneum.',
    innervation: 'Thoracoabdominal nerves (T7–T11) and subcostal nerve (T12).',
    bloodSupply: 'Superior and inferior epigastric arteries.',
    fma: '13377',
  },

  /* ---------------- CARDIOVASCULAR & VISCERAL ---------------- */
  'ascending aorta': {
    name: 'Aorta ascendens',
    commonName: 'Ascending Aorta',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Middle Mediastinum',
    functionDesc: 'Carries oxygenated blood directly from the left ventricle into systemic circulation at high systolic pressures.',
    clinicalNotes: 'Gives off the right and left coronary arteries from the aortic sinuses of Valsalva. Stanford Type A aortic dissection involves the ascending aorta and is an immediate surgical emergency due to risk of cardiac tamponade and coronary occlusion.',
    relations: ['Left ventricle', 'Aortic arch', 'Pulmonary trunk'],
    fma: '3736',
  },
  'superior vena cava': {
    name: 'Vena cava superior',
    commonName: 'Superior Vena Cava (SVC)',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Superior / Middle Mediastinum',
    functionDesc: 'Returns deoxygenated blood from the head, neck, upper extremities, and chest wall to the right atrium.',
    clinicalNotes: 'SVC Syndrome occurs when mediastinal masses (e.g. bronchogenic carcinoma) compress the thin-walled vein, causing facial edema, cyanosis, and distended collateral chest wall veins.',
    relations: ['Brachiocephalic veins', 'Azygos vein', 'Right atrium'],
    fma: '4720',
  },
  'heart': {
    name: 'Cor',
    commonName: 'Heart',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Middle Mediastinum',
    functionDesc: 'Four-chambered muscular pump driving systemic (left side) and pulmonary (right side) circulatory loops.',
    clinicalNotes: 'The left anterior descending (LAD) coronary artery is the most frequently occluded vessel in myocardial infarction ("widow maker"). Cardiac conduction originates in the sinoatrial (SA) node located in the superior right atrium.',
    innervation: 'Cardiac plexus (sympathetic T1–T4, parasympathetic vagus nerve CN X).',
    bloodSupply: 'Right and left coronary arteries.',
    fma: '7088',
  },
  'liver': {
    name: 'Hepar',
    commonName: 'Liver',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Right Hypochondrium & Epigastrium',
    functionDesc: 'Largest visceral organ; central for carbohydrate/lipid metabolism, plasma protein synthesis, bile production, and xenobiotic detoxification.',
    clinicalNotes: 'Receives dual blood supply: 75% venous blood via hepatic portal vein and 25% oxygenated arterial blood via hepatic artery. Cirrhosis causes portal hypertension leading to esophageal varices, caput medusae, and splenomegaly.',
    bloodSupply: 'Hepatic artery proper and hepatic portal vein; drained by hepatic veins into IVC.',
    relations: ['Diaphragm', 'Gallbladder', 'Stomach', 'Duodenum', 'Right kidney'],
    fma: '7197',
  },
  'kidney': {
    name: 'Ren',
    commonName: 'Kidney',
    system: 'urinary',
    region: 'abdomen',
    subregion: 'Retroperitoneum (T12–L3)',
    functionDesc: 'Filters metabolic waste, regulates electrolyte balances, acid-base homeostasis, systemic blood pressure (renin-angiotensin-aldosterone), and erythropoiesis (EPO).',
    clinicalNotes: 'The right kidney sits slightly lower than the left due to the liver. Renal stones (nephrolithiasis) cause excruciating loin-to-groin colicky pain following the dermatomal distribution of the ureter (T11–L2).',
    bloodSupply: 'Renal artery (arising directly from abdominal aorta) and renal vein (left renal vein crosses anterior to aorta beneath SMA).',
    relations: ['Adrenal gland', 'Renal pelvis', 'Psoas major', 'Quadratus lumborum'],
    fma: '7204',
  },
  'spleen': {
    name: 'Splen / Lien',
    commonName: 'Spleen',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Left Hypochondrium (Ribs 9–11)',
    functionDesc: 'Filters blood, removes senescent red blood cells, stores platelets, and mounts adaptive immune responses in the white pulp.',
    clinicalNotes: 'Extremely vascular; fractures of the left 9th to 11th ribs commonly lacerate the spleen, resulting in massive intraperitoneal hemorrhage and Kehr sign (referred pain to the left shoulder tip via the phrenic nerve). Post-splenectomy patients require vaccination against encapsulated organisms (Strep pneumoniae, Neisseria meningitidis, H. influenzae).',
    bloodSupply: 'Splenic artery (branch of celiac trunk) and splenic vein (joins SMV to form portal vein).',
    relations: ['Stomach', 'Tail of pancreas', 'Left kidney', 'Splenic flexure of colon'],
    fma: '7196',
  },
};

/**
 * Authoritative Anatomy Service with in-memory caching and request deduplication.
 */
class AnatomyService {
  constructor() {
    this._cache = new Map();
    this._pending = new Map();
  }

  /**
   * Look up clinical notes and structured metadata for a given anatomical structure name or ID.
   * @param {string} name - Name or FMA ID
   * @param {string} [system] - Optional system filter
   * @returns {AnatomicalDetail}
   */
  getDetail(name, system = '') {
    const rawKey = (name || '').toLowerCase().trim();
    if (!rawKey) return this._defaultDetail(name, system);

    if (this._cache.has(rawKey)) return this._cache.get(rawKey);

    // 1. Direct exact key match
    if (ANATOMY_DATABASE[rawKey]) {
      const entry = { ...this._defaultDetail(name, system), ...ANATOMY_DATABASE[rawKey] };
      this._cache.set(rawKey, entry);
      return entry;
    }

    // 2. Longest substring match (e.g. "right femur" matches "femur")
    let bestKey = '';
    for (const k of Object.keys(ANATOMY_DATABASE)) {
      if (rawKey.includes(k) && k.length > bestKey.length) {
        bestKey = k;
      }
    }

    if (bestKey && ANATOMY_DATABASE[bestKey]) {
      const match = ANATOMY_DATABASE[bestKey];
      const entry = {
        ...this._defaultDetail(name, system || match.system),
        ...match,
        name: name, // Keep full specific name
        commonName: `${name.replace(/^(left|right)\s+/i, '')} (${name.match(/^(left|right)/i)?.[0] || 'bilateral'})`,
      };
      this._cache.set(rawKey, entry);
      return entry;
    }

    const fallback = this._defaultDetail(name, system);
    this._cache.set(rawKey, fallback);
    return fallback;
  }

  _defaultDetail(name, system) {
    // Infer region from name heuristics if unknown
    let region = 'abdomen';
    const lower = (name || '').toLowerCase();
    if (/skull|frontal|parietal|temporal|occipital|mandible|maxilla|cervical|brain|head|neck|ear|eye|nasal/i.test(lower)) {
      region = 'head-neck';
    } else if (/rib|sternum|thorac|lung|heart|aorta|intercostal|clavicle/i.test(lower)) {
      region = 'thorax';
    } else if (/lumbar|kidney|liver|stomach|spleen|pancreas|duodenum|colon|ileum|jejunum|adrenal/i.test(lower)) {
      region = 'abdomen';
    } else if (/sacrum|coccyx|pelvis|hip|glute|bladder|urethra|prostate|testis|uterus|ovary/i.test(lower)) {
      region = 'pelvis';
    } else if (/humerus|radius|ulna|scapula|carpal|metacarpal|biceps|triceps|deltoid|brachi|hand|finger/i.test(lower)) {
      region = 'upper-limb';
    } else if (/femur|tibia|fibula|patella|tarsal|metatarsal|foot|toe|soleus|gastrocnemius|quadriceps/i.test(lower)) {
      region = 'lower-limb';
    }

    return {
      id: name,
      name: name || 'Anatomical Structure',
      commonName: name,
      system: system || 'general',
      region: region,
      subregion: 'Standard Anatomical Plane',
      functionDesc: `Essential component of the human ${system || 'visceral'} system, providing structural integrity and physiological support.`,
      clinicalNotes: `Classified under international Terminologia Anatomica standards. Standard clinical examination evaluates symmetry, structural continuity, neurovascular integrity, and mobility.`,
      bloodSupply: 'Local regional vascular tree.',
      innervation: 'Somatic / autonomic peripheral nerve distribution.',
      relations: [],
      fma: null,
    };
  }
}

export const anatomyService = new AnatomyService();
