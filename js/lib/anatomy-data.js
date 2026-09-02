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
  'scaphoid': {
    name: 'Os scaphoideum',
    commonName: 'Scaphoid Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Proximal Row)',
    functionDesc: 'The key mechanical bridge linking proximal and distal carpal rows during wrist flexion, extension, and radial/ulnar deviation.',
    clinicalNotes: 'The most commonly fractured carpal bone (FOOSH injury). Retrograde blood supply entering the distal pole leaves the proximal pole vulnerable to avascular necrosis (AVN) and nonunion. Pain in the anatomical snuffbox is classic.',
    bloodSupply: 'Dorsal and volar branches of radial artery.',
    relations: ['Radius', 'Lunate', 'Capitate', 'Trapezium', 'Trapezoid'],
    fma: '23711',
  },
  'lunate': {
    name: 'Os lunatum',
    commonName: 'Lunate Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Proximal Row)',
    functionDesc: 'Crescent-shaped carpal bone central to the radiocarpal and midcarpal joints.',
    clinicalNotes: 'The most commonly dislocated carpal bone; anterior displacement compresses the median nerve within the carpal tunnel causing acute carpal tunnel syndrome. Avascular necrosis of the lunate is known as Kienböck disease.',
    relations: ['Radius', 'Scaphoid', 'Triquetrum', 'Capitate'],
    fma: '23714',
  },
  'triquetrum': {
    name: 'Os triquetrum',
    commonName: 'Triquetral Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Proximal Row)',
    functionDesc: 'Pyramidal bone on the ulnar side of the wrist articulating with the triangular fibrocartilage complex (TFCC).',
    clinicalNotes: 'Second most commonly fractured carpal bone, typically presenting as a dorsal cortical avulsion fracture.',
    relations: ['Lunate', 'Pisiform', 'Hamate', 'TFCC'],
    fma: '23717',
  },
  'pisiform': {
    name: 'Os pisiforme',
    commonName: 'Pisiform',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Volar Proximal Row)',
    functionDesc: 'Small pea-shaped sesamoid bone embedded inside the flexor carpi ulnaris (FCU) tendon to increase its moment arm.',
    clinicalNotes: 'Forms the medial boundary of Guyon canal (ulnar tunnel); pisotriquetral arthritis causes localized ulnar-sided wrist pain.',
    relations: ['Triquetrum', 'FCU tendon', 'Abductor digiti minimi'],
    fma: '23720',
  },
  'trapezium': {
    name: 'Os trapezium',
    commonName: 'Trapezium',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Distal Row)',
    functionDesc: 'Features a classic saddle-shaped articular surface that forms the first carpometacarpal (CMC) joint with the 1st metacarpal, enabling thumb opposition.',
    clinicalNotes: 'First CMC joint osteoarthritis (basilar thumb arthritis) is extremely prevalent in older adults, causing debilitating pinch weakness.',
    relations: ['Scaphoid', 'Trapezoid', '1st Metacarpal', '2nd Metacarpal'],
    fma: '23723',
  },
  'trapezoid': {
    name: 'Os trapezoideum',
    commonName: 'Trapezoid',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Distal Row)',
    functionDesc: 'Wedge-shaped bone firmly seated between trapezium and capitate, forming a stable rigid base for the index finger 2nd metacarpal.',
    clinicalNotes: 'Deeply recessed position makes isolated fractures exceedingly rare.',
    relations: ['Scaphoid', 'Trapezium', 'Capitate', '2nd Metacarpal'],
    fma: '23726',
  },
  'capitate': {
    name: 'Os capitatum',
    commonName: 'Capitate Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Distal Row)',
    functionDesc: 'The largest carpal bone; acts as the central keystone of the wrist arch and pivot for global wrist motion.',
    clinicalNotes: 'Transscaphoid-transcapitate perilunate fracture-dislocations occur in high-energy trauma.',
    relations: ['Scaphoid', 'Lunate', 'Hamate', 'Trapezoid', '3rd Metacarpal'],
    fma: '23729',
  },
  'hamate': {
    name: 'Os hamatum',
    commonName: 'Hamate Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Carpus (Distal Row)',
    functionDesc: 'Distinguished by a prominent hook-like anterior projection (hamulus) that anchors the transverse carpal ligament and flexor retinaculum.',
    clinicalNotes: 'Hook of hamate fractures occur characteristically in baseball players, golfers, and racket sport athletes from direct impact. Endangers the deep branch of the ulnar nerve and ulnar artery.',
    relations: ['Triquetrum', 'Lunate', 'Capitate', '4th and 5th Metacarpals'],
    fma: '23732',
  },
  'metacarpals': {
    name: 'Ossa metacarpalia (I–V)',
    commonName: 'Metacarpal Bones',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Manus / Palm',
    functionDesc: 'Five cylindrical tubular bones forming the skeletal framework of the palm and articulating with proximal phalanges at the MCP knuckles.',
    clinicalNotes: 'Fracture of the 5th metacarpal neck is the classic "Boxer fracture" caused by punching with a closed fist. Fracture of the 1st metacarpal base extending into the CMC joint is a Bennett fracture.',
    relations: ['Carpal bones', 'Proximal phalanges', 'Interossei muscles'],
    fma: '23735',
  },
  'calcaneus': {
    name: 'Calcaneus',
    commonName: 'Heel Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Tarsus / Hindfoot',
    functionDesc: 'The largest tarsal bone; absorbs heel strike impact during locomotion and serves as insertion for the calcaneal (Achilles) tendon.',
    clinicalNotes: 'Axial loading fractures (Lover fracture / Don Juan fracture) from falls from height frequently associate with burst fractures of the lumbar spine (L1–L2). Measured using Böhler angle (normal 20–40 degrees).',
    relations: ['Talus (subtalar joint)', 'Cuboid', 'Achilles tendon'],
    fma: '24483',
  },
  'talus': {
    name: 'Talus',
    commonName: 'Ankle Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Tarsus / Ankle Mortise',
    functionDesc: 'Transmits the entire weight of the human body from the tibia and fibula downward to the calcaneus and navicular; 60% of its surface is covered in articular cartilage.',
    clinicalNotes: 'Has no muscular or tendinous attachments. Displaced talar neck fractures (Hawkins classification) disrupt the blood supply entering through the tarsal canal, causing avascular necrosis of the talar dome (Hawkins sign indicates intact vascularity).',
    relations: ['Tibia', 'Fibula', 'Calcaneus', 'Navicular'],
    fma: '24482',
  },
  'phalanges': {
    name: 'Phalanges manus et pedis',
    commonName: 'Phalanges (Finger & Toe Bones)',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Hand & Foot Digits',
    functionDesc: '14 bones in each hand and foot arranged as proximal, middle (except pollex/hallux), and distal phalanges facilitating intricate manipulation and push-off.',
    clinicalNotes: 'Distal phalanx fractures are the most frequent hand fractures (crush/tuft injuries). Mallet finger results from avulsion of the extensor digitorum terminal slip from the distal phalanx base.',
    relations: ['Metacarpals', 'Metatarsals', 'Flexor/Extensor tendons'],
    fma: '23736',
  },
  'proximal phalanges': {
    name: 'Phalanges proximales manus',
    commonName: 'Proximal Phalanges',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Digits of Hand',
    functionDesc: 'Articulate proximally with metacarpal heads at the MCP knuckle joints and distally with middle phalanges at PIP joints.',
    clinicalNotes: 'Fractures of the proximal phalanx typically angulate apex volar due to the pulling action of the lumbrical and interosseous muscles.',
    relations: ['Metacarpal bones', 'Middle phalanges'],
    fma: '23737',
  },
  'distal phalanges': {
    name: 'Phalanges distales manus',
    commonName: 'Distal Phalanges (Fingertip Bones)',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Terminal Digits',
    functionDesc: 'Spade-like apical tufts that support the nail bed and vascularized pulp of each digit.',
    clinicalNotes: 'Jersey finger occurs when the flexor digitorum profundus (FDP) tendon avulses from the volar base of the distal phalanx (inability to flex DIP joint).',
    relations: ['Middle phalanges', 'FDP tendon', 'Extensor terminal slip'],
    fma: '23739',
  },
  'metatarsals': {
    name: 'Ossa metatarsalia (I–V)',
    commonName: 'Metatarsal Bones',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Forefoot / Instep',
    functionDesc: 'Five tubular bones forming the longitudinal and transverse arches of the foot and distributing weight during terminal stance and push-off.',
    clinicalNotes: 'Jones fracture occurs at the metaphyseal-diaphyseal junction of the 5th metatarsal base with high risk of nonunion due to watershed vascularity. March stress fractures frequently affect the 2nd and 3rd metatarsal necks.',
    relations: ['Tarsal bones (Lisfranc joint)', 'Proximal phalanges (MTP joints)'],
    fma: '24484',
  },
  'navicular': {
    name: 'Os naviculare',
    commonName: 'Navicular Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Midfoot / Tarsus',
    functionDesc: 'Boat-shaped bone on the medial side of the foot; keystone of the medial longitudinal arch; articulates with talus and the three cuneiforms.',
    clinicalNotes: 'Tibialis posterior tendon inserts into the navicular tuberosity; an accessory navicular bone (os tibiale externum) can cause chronic medial foot pain and flatfoot (pes planus).',
    relations: ['Talus', 'Medial, Intermediate, Lateral Cuneiforms', 'Tibialis posterior'],
    fma: '24485',
  },
  'cuboid': {
    name: 'Os cuboideum',
    commonName: 'Cuboid Bone',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Lateral Midfoot',
    functionDesc: 'Pyramidal bone providing lateral midfoot stability; groove on its plantar surface transmits the peroneus (fibularis) longus tendon.',
    clinicalNotes: 'Cuboid syndrome (subluxation of the calcaneocuboid joint) causes lateral foot pain in runners and ballet dancers.',
    relations: ['Calcaneus', '4th and 5th Metatarsals', 'Lateral Cuneiform'],
    fma: '24487',
  },
  'cuneiforms': {
    name: 'Ossa cuneiformia (Mediale, Intermedium, Laterale)',
    commonName: 'Cuneiform Bones (1–3)',
    system: 'skeletal',
    region: 'lower-limb',
    subregion: 'Midfoot / Tarsus',
    functionDesc: 'Three wedge-shaped tarsal bones forming the transverse arch of the foot and articulating with metatarsals 1–3.',
    clinicalNotes: 'Disruption of the Lisfranc ligament connecting the medial cuneiform to the base of the 2nd metatarsal causes catastrophic midfoot instability.',
    relations: ['Navicular', '1st, 2nd, 3rd Metatarsals', 'Cuboid'],
    fma: '24488',
  },
  'clavicle': {
    name: 'Clavicula',
    commonName: 'Collarbone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Pectoral Girdle',
    functionDesc: 'S-shaped strut bone connecting the upper limb to the axial skeleton at the sternoclavicular and acromioclavicular (AC) joints.',
    clinicalNotes: 'The most commonly fractured bone in children; 80% of fractures occur at the junction of the middle and lateral thirds. Downward displacement of lateral fragment caused by limb weight; upward displacement of medial fragment by sternocleidomastoid.',
    relations: ['Sternum', 'Scapula (Acromion)', 'Subclavian vessels and Brachial plexus (deep)'],
    fma: '13321',
  },
  'scapula': {
    name: 'Scapula',
    commonName: 'Shoulder Blade',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Pectoral Girdle',
    functionDesc: 'Flat triangular bone over the posterolateral thoracic wall; provides origin for rotator cuff muscles and forms the glenohumeral joint socket.',
    clinicalNotes: 'Serratus anterior weakness or long thoracic nerve injury (C5, C6, C7) causes "winged scapula" (scapula alata), impairing arm abduction above 90 degrees.',
    relations: ['Clavicle', 'Humerus', 'Ribs 2–7'],
    fma: '13394',
  },
  'humerus': {
    name: 'Humerus',
    commonName: 'Upper Arm Bone',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Brachium',
    functionDesc: 'Long bone of the upper arm; articulates with scapular glenoid cavity and with radius and ulna at the elbow.',
    clinicalNotes: 'Three critical nerve relationships: Fracture of surgical neck endangers axillary nerve and posterior circumflex humeral artery; midshaft spiral fracture in the radial groove endangers radial nerve (wrist drop); supracondylar fracture in children endangers median nerve and brachial artery (Volkmann ischemic contracture).',
    relations: ['Scapula', 'Radius', 'Ulna'],
    fma: '13303',
  },
  'radius': {
    name: 'Radius',
    commonName: 'Radius (Forearm Lateral Bone)',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Antebrachium',
    functionDesc: 'Lateral forearm bone that pivots around the ulna during pronation and supination and transmits wrist loading directly to the elbow.',
    clinicalNotes: 'Colles fracture: Extra-articular transverse fracture of the distal radius with dorsal displacement ("dinner-fork deformity") from FOOSH. Radial head subluxation ("nursemaid elbow") occurs in young children when pulled by the arm.',
    relations: ['Humerus', 'Ulna', 'Scaphoid', 'Lunate'],
    fma: '23463',
  },
  'ulna': {
    name: 'Ulna',
    commonName: 'Ulna (Forearm Medial Bone)',
    system: 'skeletal',
    region: 'upper-limb',
    subregion: 'Antebrachium',
    functionDesc: 'Medial stabilizing bone of the forearm; forms the primary hinge joint with the trochlea of the humerus via the olecranon process.',
    clinicalNotes: 'Monteggia fracture: Fracture of proximal third of ulna with dislocation of the radial head. Nightstick fracture: Isolated fracture of ulnar shaft from direct defensive blow.',
    relations: ['Humerus', 'Radius', 'Triangular fibrocartilage complex (TFCC)'],
    fma: '23466',
  },
  'sternum': {
    name: 'Sternum',
    commonName: 'Breastbone',
    system: 'skeletal',
    region: 'thorax',
    subregion: 'Anterior Thoracic Wall',
    functionDesc: 'T-shaped flat bone consisting of manubrium, body (gladiolus), and xiphoid process; anchors the anterior rib cage.',
    clinicalNotes: 'The sternal angle of Louis (manubriosternal joint) lies at vertebral level T4/T5 and marks the 2nd costal cartilage, bifurcation of trachea (carina), aortic arch origin, and azygos vein entry.',
    relations: ['Clavicles', 'Costal cartilages of ribs 1–7'],
    fma: '7485',
  },
  'ribs': {
    name: 'Costae (I–XII)',
    commonName: 'Ribs (12 Pairs)',
    system: 'skeletal',
    region: 'thorax',
    subregion: 'Thoracic Cage',
    functionDesc: '12 pairs of curved flat bones (1–7 true, 8–10 false, 11–12 floating) protecting thoracic viscera and expanding during respiration.',
    clinicalNotes: 'Flail chest occurs when >= 3 consecutive ribs are fractured in >= 2 places, causing paradoxical chest wall motion during breathing and severe respiratory distress.',
    relations: ['Thoracic vertebrae', 'Costal cartilages', 'Sternum', 'Intercostal vessels & nerves (in subcostal groove at inferior rib border)'],
    fma: '7486',
  },
  'hyoid': {
    name: 'Os hyoideum',
    commonName: 'Hyoid Bone',
    system: 'skeletal',
    region: 'neck',
    subregion: 'Anterior Neck / C3 Level',
    functionDesc: 'U-shaped free-floating bone suspended by stylohyoid ligaments; serves as movable base for the tongue and anchors suprahyoid and infrahyoid strap muscles.',
    clinicalNotes: 'Fracture of the hyoid bone is a classical forensic indicator of manual strangulation in homicide investigations.',
    relations: ['Tongue', 'Thyroid cartilage (via thyrohyoid membrane)', 'Larynx'],
    fma: '52749',
  },
  'cervical vertebrae': {
    name: 'Vertebrae cervicales (C1–C7)',
    commonName: 'Neck Vertebrae (Atlas C1 & Axis C2)',
    system: 'skeletal',
    region: 'neck',
    subregion: 'Cervical Spine',
    functionDesc: 'Seven vertebrae characterized by transverse foramina transmitting vertebral arteries; Atlas C1 supports skull rotation, Axis C2 features odontoid process (dens).',
    clinicalNotes: 'Jefferson fracture: 4-part burst fracture of Atlas C1 ring from axial blow on head. Hangman fracture: Traumatic spondylolisthesis of Axis C2 pedicles from hyperextension.',
    relations: ['Occipital condyles', 'Spinal cord', 'Vertebral arteries'],
    fma: '9138',
  },
  'lumbar vertebrae': {
    name: 'Vertebrae lumbales (L1–L5)',
    commonName: 'Lower Back Vertebrae',
    system: 'skeletal',
    region: 'abdomen',
    subregion: 'Lumbar Spine',
    functionDesc: 'Five massive kidney-shaped vertebrae bearing the majority of upper body mass and facilitating spinal flexion and extension.',
    clinicalNotes: 'Posterolateral intervertebral disc herniation at L4–L5 (compressing L5 root) and L5–S1 (compressing S1 root) causes sciatica with sharp radiating leg pain, foot numbness, and absent Achilles reflex.',
    relations: ['Psoas major', 'Cauda equina', 'Sacrum'],
    fma: '9140',
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

  /* ---------------- RESPIRATORY SYSTEM ---------------- */
  'lung': {
    name: 'Pulmo (dexter et sinister)',
    commonName: 'Lungs',
    system: 'respiratory',
    region: 'thorax',
    subregion: 'Pleural Cavities',
    functionDesc: 'Primary organs of gas exchange; oxygenates mixed venous blood and eliminates carbon dioxide via alveolar-capillary membranes across ~70 square meters of surface area.',
    clinicalNotes: 'The right lung has 3 lobes (superior, middle, inferior) and 2 fissures; the left lung has 2 lobes, a cardiac notch, and the lingula. Aspiration pneumonia and foreign body lodgement occur predominantly in the right mainstem bronchus due to its wider, shorter, and more vertical course. Pulmonary embolism (PE) causes ventilation-perfusion mismatch and acute right heart strain.',
    innervation: 'Pulmonary plexus (sympathetic T2–T5 bronchodilation, parasympathetic vagus CN X bronchoconstriction).',
    bloodSupply: 'Pulmonary trunk/arteries (deoxygenated functional supply) and bronchial arteries (oxygenated nutritional supply from aorta).',
    relations: ['Heart & Pericardium', 'Diaphragm', 'Thoracic wall / Rib cage', 'Tracheobronchial tree'],
    fma: '7333',
  },
  'trachea': {
    name: 'Trachea',
    commonName: 'Windpipe',
    system: 'respiratory',
    region: 'head-neck',
    subregion: 'Superior Mediastinum & Neck (C6–T4/5)',
    functionDesc: 'Cartilaginous and membranous tube conducting air from the larynx to the principal bronchi; contains ciliated pseudostratified epithelium for mucociliary clearance.',
    clinicalNotes: 'Reinforced by 16–20 C-shaped hyaline cartilage rings open posteriorly where the trachealis muscle abuts the esophagus. Tracheostomy is electively performed between the 2nd and 3rd tracheal rings. The internal keel at the bifurcation (carina) is exquisitely sensitive, triggering the cough reflex.',
    innervation: 'Recurrent laryngeal nerves (CN X) and sympathetic trunk.',
    bloodSupply: 'Inferior thyroid arteries and bronchial arteries.',
    relations: ['Esophagus (posterior)', 'Thyroid gland isthmus (anterior)', 'Aortic arch', 'Brachiocephalic trunk'],
    fma: '7394',
  },
  'bronchus': {
    name: 'Bronchus principalis',
    commonName: 'Bronchus / Airway Branches',
    system: 'respiratory',
    region: 'thorax',
    subregion: 'Pulmonary Hilum',
    functionDesc: 'Transports inspired air into individual lung lobes and secondary bronchopulmonary segments.',
    clinicalNotes: 'Chronic inflammation and hyperreactivity cause asthma and COPD. Bronchogenic carcinoma classically arises from the bronchial mucosa near the hilum.',
    innervation: 'Pulmonary plexus (vagus and sympathetic chain).',
    bloodSupply: 'Bronchial arteries.',
    relations: ['Pulmonary artery', 'Pulmonary veins', 'Hilar lymph nodes'],
    fma: '7409',
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
  'arch of aorta': {
    name: 'Arcus aortae',
    commonName: 'Aortic Arch',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Superior Mediastinum (T4 level)',
    functionDesc: 'Distributes systemic arterial blood to the head, neck, upper limbs, and descending systemic tree.',
    clinicalNotes: 'Gives rise to 3 major branches: brachiocephalic trunk, left common carotid artery, and left subclavian artery. Coarctation of the aorta produces elevated upper extremity BP, diminished femoral pulses (radio-femoral delay), and inferior rib notching.',
    relations: ['Trachea (anterior and left)', 'Left recurrent laryngeal nerve', 'Ligamentum arteriosum'],
    fma: '3768',
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
  'inferior vena cava': {
    name: 'Vena cava inferior',
    commonName: 'Inferior Vena Cava (IVC)',
    system: 'cardiovascular',
    region: 'abdomen',
    subregion: 'Retroperitoneum',
    functionDesc: 'The largest vein in the body; carries deoxygenated blood from the lower extremities, pelvis, and abdominal organs to the right atrium.',
    clinicalNotes: 'Formed at L5 by the confluence of the common iliac veins; traverses the central tendon of the diaphragm at T8. IVC filters (Greenfield filters) are placed infra-renally to prevent pulmonary embolism in DVT patients with contraindications to anticoagulation.',
    relations: ['Abdominal aorta (left)', 'Duodenum', 'Head of pancreas', 'Liver'],
    fma: '10951',
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
    fma: '7274',
  },
  'pulmonary artery': {
    name: 'Truncus pulmonalis / Arteria pulmonalis',
    commonName: 'Pulmonary Artery',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Middle Mediastinum',
    functionDesc: 'Carries low-oxygen blood from the right ventricle to the alveolar capillaries for oxygenation.',
    clinicalNotes: 'Saddle pulmonary embolism lodges across the bifurcation, causing acute right ventricular failure and cardiogenic shock.',
    relations: ['Ascending aorta', 'Right ventricle', 'Ligamentum arteriosum'],
    fma: '66326',
  },
  'pulmonary vein': {
    name: 'Venae pulmonales (4 veins)',
    commonName: 'Pulmonary Veins',
    system: 'cardiovascular',
    region: 'thorax',
    subregion: 'Posterior Mediastinum',
    functionDesc: 'Four veins that transport oxygen-rich blood from the lungs into the left atrium.',
    clinicalNotes: 'Ectopic foci around the pulmonary vein ostia are the predominant source of paroxysmal atrial fibrillation; targeted by catheter ablation.',
    relations: ['Left atrium', 'Bronchial tree'],
    fma: '66643',
  },

  /* ---------------- DIGESTIVE SYSTEM ---------------- */
  'stomach': {
    name: 'Gaster / Ventriculus',
    commonName: 'Stomach',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Left Upper Quadrant & Epigastrium',
    functionDesc: 'Secretes hydrochloric acid and pepsinogen for protein breakdown; churns food into chyme; secretes intrinsic factor for vitamin B12 absorption.',
    clinicalNotes: 'Helicobacter pylori colonization and NSAID use cause peptic ulcer disease. Posterior gastric ulcers can erode through into the splenic artery or pancreas causing catastrophic arterial hemorrhage.',
    innervation: 'Anterior and posterior vagal trunks (CN X, parasympathetic) and celiac ganglion (sympathetic).',
    bloodSupply: 'Left gastric (celiac trunk), right gastric (common hepatic), and gastro-omental arteries.',
    relations: ['Diaphragm', 'Liver (left lobe)', 'Pancreas', 'Spleen', 'Transverse colon'],
    fma: '7148',
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
  'gallbladder': {
    name: 'Vesica biliaris',
    commonName: 'Gallbladder',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Inferior Liver Bed (Right Hypochondrium)',
    functionDesc: 'Stores and concentrates bile produced by hepatocytes, ejecting it into the duodenum upon CCK stimulation after fatty meals.',
    clinicalNotes: 'Gallstones (cholelithiasis) in the cystic duct cause acute cholecystitis with positive Murphy sign. Charcot triad (fever, jaundice, RUQ pain) signals life-threatening acute cholangitis.',
    bloodSupply: 'Cystic artery (classically arising from the right hepatic artery within Calot triangle).',
    relations: ['Liver (fossa for gallbladder)', 'Duodenum', 'Transverse colon'],
    fma: '7202',
  },
  'pancreas': {
    name: 'Pancreas',
    commonName: 'Pancreas',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Retroperitoneum (Epigastrium & Left Hypochondrium)',
    functionDesc: 'Dual exocrine (digestive enzymes: amylase, lipase, proteases) and endocrine organ (Islets of Langerhans: insulin, glucagon, somatostatin).',
    clinicalNotes: 'Pancreatic duct (of Wirsung) joins the common bile duct at the hepatopancreatic ampulla of Vater. Pancreatic head adenocarcinoma causes painless obstructive jaundice (Courvoisier law). Acute pancreatitis presents with radiating epigastric-to-back pain and elevated serum lipase.',
    bloodSupply: 'Splenic artery branches and superior/inferior pancreaticoduodenal arteries.',
    relations: ['Duodenum (C-loop)', 'Stomach', 'Splenic vein & artery', 'Left kidney'],
    fma: '7198nsn',
  },
  'duodenum': {
    name: 'Duodenum',
    commonName: 'Duodenum',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Retroperitoneum (C-loop around pancreas)',
    functionDesc: 'First and shortest part of small intestine (~25 cm); neutralizes stomach acid via Brunner glands and receives bile and pancreatic juice.',
    clinicalNotes: 'Posterior wall duodenal ulcers erode into the gastroduodenal artery leading to massive hematemesis and melena.',
    bloodSupply: 'Superior and inferior pancreaticoduodenal arteries (celiac and SMA anastomosis).',
    relations: ['Head of pancreas', 'Stomach (pylorus)', 'Jejunum (ligament of Treitz)'],
    fma: '7206',
  },
  'colon': {
    name: 'Colon',
    commonName: 'Large Intestine / Bowel',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Abdominal & Pelvic Perimeter',
    functionDesc: 'Absorbs water, salts, and vitamins synthesised by gut microbiota; compacts and propels fecal matter toward the rectum.',
    clinicalNotes: 'Distinguished by taeniae coli, haustra, and omental (epiploic) appendices. Diverticulosis and diverticulitis are most prevalent in the high-pressure sigmoid colon. Colorectal cancer is screened via colonoscopy.',
    bloodSupply: 'Superior mesenteric artery (cecum to proximal 2/3 transverse colon) and inferior mesenteric artery (distal 1/3 transverse to rectum).',
    relations: ['Small intestine coils', 'Abdominal wall', 'Liver', 'Spleen'],
    fma: '14543nsn',
  },
  'appendix': {
    name: 'Appendix vermiformis',
    commonName: 'Appendix',
    system: 'digestive',
    region: 'abdomen',
    subregion: 'Right Iliac Fossa (Cecum Base)',
    functionDesc: 'Blind-ended muscular tube containing abundant lymphoid tissue; serves as a bacterial reservoir for gut flora repopulation.',
    clinicalNotes: 'Fecalith obstruction leads to acute appendicitis with initial visceral periumbilical pain that shifts to somatic, sharp right lower quadrant pain at McBurney point (junction of lateral 1/3 and medial 2/3 of line from ASIS to umbilicus).',
    bloodSupply: 'Appendicular artery (branch of ileocolic artery).',
    relations: ['Cecum', 'Terminal ileum', 'Psoas major'],
    fma: '14542',
  },
  'esophagus': {
    name: 'Esophagus',
    commonName: 'Gullet / Food Pipe',
    system: 'digestive',
    region: 'thorax',
    subregion: 'Posterior Mediastinum',
    functionDesc: 'Muscular conduit propelling bolus from pharynx into the stomach via peristalsis.',
    clinicalNotes: 'Traverses the diaphragm at T10. Gastroesophageal reflux disease (GERD) causes metaplastic Barrett esophagus (stratified squamous to columnar epithelium), increasing risk of adenocarcinoma. Mallory-Weiss tears occur at GE junction from severe retching.',
    innervation: 'Esophageal plexus (vagus CN X).',
    bloodSupply: 'Inferior thyroid, esophageal branches of thoracic aorta, and left gastric artery.',
    relations: ['Trachea (anterior)', 'Thoracic aorta', 'Left atrium', 'Diaphragm'],
    fma: '7131',
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

  /* ---------------- NERVOUS SYSTEM ---------------- */
  'brain': {
    name: 'Encephalon',
    commonName: 'Brain / Cerebrum',
    system: 'nervous',
    region: 'head-neck',
    subregion: 'Cranial Cavity',
    functionDesc: 'Central organ of cognition, conscious perception, sensory processing, motor command, autonomic coordination, emotion, and memory.',
    clinicalNotes: 'Protected by blood-brain barrier (BBB) and meninges. Ischemic stroke in the middle cerebral artery (MCA) produces contralateral hemiplegia and aphasia (Broca / Wernicke). Elevated intracranial pressure (ICP) risks lethal uncal or tonsillar brain herniation.',
    bloodSupply: 'Internal carotid arteries (anterior circulation) and vertebral/basilar arteries (posterior circulation) converging at the Circle of Willis.',
    relations: ['Cranium', 'Meninges (dura, arachnoid, pia)', 'Cerebrospinal fluid (ventricles)'],
    fma: '61822',
  },
  'cerebellum': {
    name: 'Cerebellum',
    commonName: 'Little Brain',
    system: 'nervous',
    region: 'head-neck',
    subregion: 'Posterior Cranial Fossa',
    functionDesc: 'Coordinates smooth voluntary movements, motor planning, precision, balance, and motor learning without initiating motor commands.',
    clinicalNotes: 'Cerebellar hemisphere lesions cause ipsilateral signs: ataxia, dysmetria (past-pointing), dysdiadochokinesia, intention tremor, and nystagmus (DANISH triad). Midline cerebellar vermis lesions cause truncal ataxia and wide-based gait.',
    bloodSupply: 'Superior cerebellar artery (SCA), AICA, and PICA (from basilar and vertebral arteries).',
    relations: ['Pons & Medulla', 'Fourth ventricle', 'Tentorium cerebelli'],
    fma: '67944',
  },
  'brainstem': {
    name: 'Truncus encephali (Midbrain, Pons, Medulla)',
    commonName: 'Brainstem',
    system: 'nervous',
    region: 'head-neck',
    subregion: 'Cranial Base & Foramen Magnum',
    functionDesc: 'Houses autonomic control centers for respiration, heart rate, blood pressure, consciousness (reticular activating system), and nuclei for CN III–XII.',
    clinicalNotes: 'Pons basilar occlusion causes Locked-in Syndrome. Lateral medullary syndrome (Wallenberg syndrome, PICA infarct) causes dysphagia, hoarseness, ataxia, Horner syndrome, and crossed sensory loss.',
    bloodSupply: 'Vertebral and basilar arteries.',
    relations: ['Fourth ventricle', 'Cerebellum', 'Spinal cord'],
    fma: '62004',
  },
  'hippocampus': {
    name: 'Hippocampus',
    commonName: 'Hippocampus',
    system: 'nervous',
    region: 'head-neck',
    subregion: 'Medial Temporal Lobe',
    functionDesc: 'Key limbic structure for consolidation of short-term memory into long-term declarative memory and spatial navigation.',
    clinicalNotes: 'Earliest and most profoundly affected structure in Alzheimer disease, causing anterograde amnesia. Highly vulnerable to excitotoxicity in ischemic anoxia and status epilepticus.',
    bloodSupply: 'Anterior choroidal artery and posterior cerebral artery.',
    relations: ['Amygdala', 'Fornix', 'Lateral ventricle inferior horn'],
    fma: '72713',
  },
  'thalamus': {
    name: 'Thalamus',
    commonName: 'Thalamus',
    system: 'nervous',
    region: 'head-neck',
    subregion: 'Diencephalon',
    functionDesc: 'The master relay station for all incoming sensory modalities (except olfaction) to the cerebral cortex; regulates sleep and alertness.',
    clinicalNotes: 'Thalamic stroke causes Déjerine-Roussy syndrome (severe burning central neuropathic pain and contralateral hemi-sensory loss).',
    bloodSupply: 'Thalamoperforating and thalamogeniculate branches of posterior cerebral artery.',
    relations: ['Third ventricle', 'Internal capsule', 'Hypothalamus'],
    fma: '258714',
  },

  /* ---------------- URINARY SYSTEM ---------------- */
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
  'urinary bladder': {
    name: 'Vesica urinaria',
    commonName: 'Bladder',
    system: 'urinary',
    region: 'pelvis',
    subregion: 'Lesser Pelvis',
    functionDesc: 'Hollow, distensible muscular reservoir storing urine until micturition.',
    clinicalNotes: 'The trigone of the bladder is sensitive to distension. Urinary tract infections (cystitis) cause dysuria, frequency, and suprapubic pain. Transitional cell carcinoma (urothelial carcinoma) presents with painless gross hematuria.',
    innervation: 'Pelvic splanchnic nerves (S2–S4 parasympathetic detrusor contraction) and hypogastric nerves (sympathetic internal sphincter closure).',
    bloodSupply: 'Superior and inferior vesical arteries (internal iliac branches).',
    relations: ['Pubic symphysis (anterior)', 'Prostate / Vagina', 'Rectum (posterior)'],
    fma: '15900',
  },
  'ureter': {
    name: 'Ureter',
    commonName: 'Ureter',
    system: 'urinary',
    region: 'abdomen',
    subregion: 'Retroperitoneal Abdomen & Pelvis',
    functionDesc: 'Propels urine from renal pelvis to bladder via active smooth muscle peristalsis.',
    clinicalNotes: 'Three classic anatomical constriction sites where kidney stones lodge: (1) Ureteropelvic junction (UPJ), (2) Crossing the iliac vessels at pelvic brim, (3) Ureterovesical junction (UVJ).',
    bloodSupply: 'Branches from renal, gonadal, aorta, and common iliac arteries.',
    relations: ['Psoas major', 'Genitofemoral nerve', 'Iliac vessels'],
    fma: '15571',
  },

  /* ---------------- MUSCULAR SYSTEM EXPANSIONS ---------------- */
  'trapezius': {
    name: 'Musculus trapezius',
    commonName: 'Trapezius / Traps',
    system: 'muscular',
    region: 'thorax',
    subregion: 'Posterior Neck & Upper Back',
    functionDesc: 'Elevates (upper fibers), retracts (middle fibers), and depresses (lower fibers) the scapula; rotates glenoid cavity superiorly during arm abduction above 90 degrees.',
    clinicalNotes: 'Innervated by the Spinal Accessory Nerve (CN XI). Iatrogenic injury during posterior triangle lymph node biopsy causes shoulder droop and inability to shrug against resistance.',
    innervation: 'Spinal accessory nerve (CN XI, motor) and C3–C4 cervical plexus (proprioception).',
    bloodSupply: 'Transverse cervical artery and dorsal scapular artery.',
    fma: '33585',
  },
  'latissimus dorsi': {
    name: 'Musculus latissimus dorsi',
    commonName: 'Lats',
    system: 'muscular',
    region: 'thorax',
    subregion: 'Posterior Trunk',
    functionDesc: 'Extends, adducts, and medially rotates the humerus; draws the shoulder downward and backward (crucial for climbing and swimming).',
    clinicalNotes: 'Innervated by the thoracodorsal nerve (C6–C8). Vulnerable during axillary lymph node dissection in breast cancer surgery.',
    innervation: 'Thoracodorsal nerve (C6, C7, C8).',
    bloodSupply: 'Thoracodorsal artery.',
    fma: '13358',
  },
  'triceps': {
    name: 'Musculus triceps brachii',
    commonName: 'Triceps',
    system: 'muscular',
    region: 'upper-limb',
    subregion: 'Posterior Arm Compartment',
    functionDesc: 'Chief extensor of the elbow joint; long head assists in adduction and extension of the humerus.',
    clinicalNotes: 'Innervated by the radial nerve. Testing triceps tendon reflex assesses spinal roots C7 and C8.',
    innervation: 'Radial nerve (C6, C7, C8).',
    bloodSupply: 'Profunda brachii artery.',
    fma: '37699',
  },
  'quadriceps': {
    name: 'Musculus quadriceps femoris',
    commonName: 'Quads',
    system: 'muscular',
    region: 'lower-limb',
    subregion: 'Anterior Thigh Compartment',
    functionDesc: 'Four heads (rectus femoris, vastus lateralis, vastus medialis, vastus intermedius) extending the knee; rectus femoris also flexes the hip.',
    clinicalNotes: 'Innervated by the femoral nerve (L2–L4). The patellar tendon reflex tests the L3–L4 spinal reflex arc.',
    innervation: 'Femoral nerve (L2, L3, L4).',
    bloodSupply: 'Femoral artery and lateral circumflex femoral artery.',
    fma: '38928',
  },
  'hamstrings': {
    name: 'Musculi ischiocrurales',
    commonName: 'Hamstrings',
    system: 'muscular',
    region: 'lower-limb',
    subregion: 'Posterior Thigh Compartment',
    functionDesc: 'Biceps femoris, semitendinosus, and semimembranosus; flex the knee and extend the hip during walking and sprinting.',
    clinicalNotes: 'Frequent site of acute strain and avulsion from the ischial tuberosity in athletes. Innervated by the sciatic nerve.',
    innervation: 'Sciatic nerve (tibial and common fibular divisions L5–S2).',
    bloodSupply: 'Perforating branches of profunda femoris artery.',
    fma: '45888',
  },
  'gastrocnemius': {
    name: 'Musculus gastrocnemius',
    commonName: 'Calf Muscle',
    system: 'muscular',
    region: 'lower-limb',
    subregion: 'Superficial Posterior Leg',
    functionDesc: 'Plantarflexes the foot at the talocrural ankle and flexes the leg at the knee joint; primary propulsion engine in jumping and running.',
    clinicalNotes: 'Inserts via the calcaneal (Achilles) tendon. Achilles tendon rupture presents with a sudden "pop", palpable gap, and positive Thompson squeeze test.',
    innervation: 'Tibial nerve (S1, S2).',
    bloodSupply: 'Sural arteries (branches of popliteal artery).',
    fma: '45957',
  },
  'soleus': {
    name: 'Musculus soleus',
    commonName: 'Soleus',
    system: 'muscular',
    region: 'lower-limb',
    subregion: 'Deep Posterior Leg',
    functionDesc: 'Strong plantarflexor of the ankle; acts as the primary "peripheral heart" pumping venous blood back to the IVC against gravity.',
    clinicalNotes: 'Composed largely of slow-twitch fatigue-resistant type I fibers essential for upright posture and standing.',
    innervation: 'Tibial nerve (S1, S2).',
    bloodSupply: 'Posterior tibial and fibular arteries.',
    fma: '22558',
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

/**
 * Natural language synonyms and query expansions for anatomy discovery.
 */
export const ANATOMICAL_SYNONYMS = {
  'biggest bone': 'femur',
  'longest bone': 'femur',
  'thigh bone': 'femur',
  'thighbone': 'femur',
  'shin bone': 'tibia',
  'shinbone': 'tibia',
  'collar bone': 'clavicle',
  'collarbone': 'clavicle',
  'shoulder blade': 'scapula',
  'kneecap': 'patella',
  'knee cap': 'patella',
  'jaw': 'mandible',
  'jawbone': 'mandible',
  'chest muscle': 'pectoralis major',
  'chest muscles': 'pectoralis major',
  'chest': 'pectoralis major',
  'pecs': 'pectoralis major',
  'pec': 'pectoralis major',
  'traps': 'trapezius',
  'trap': 'trapezius',
  'lats': 'latissimus dorsi',
  'quads': 'rectus femoris, vastus lateralis, vastus medialis, vastus intermedius',
  'quadriceps': 'rectus femoris, vastus lateralis, vastus medialis, vastus intermedius',
  'hamstrings': 'biceps femoris, semitendinosus, semimembranosus',
  'calves': 'gastrocnemius, soleus',
  'calf': 'gastrocnemius, soleus',
  'abs': 'rectus abdominis, external oblique, internal oblique',
  'abdominals': 'rectus abdominis, external oblique, internal oblique',
  'belly': 'stomach',
  'gut': 'digestive',
  'gi tract': 'digestive',
  'gastrointestinal': 'digestive',
  'windpipe': 'trachea',
  'voicebox': 'larynx',
  'spine': 'vertebra',
  'backbone': 'vertebra',
  'skull': 'cranium, frontal bone, parietal bone, temporal bone, occipital bone, sphenoid bone',
  'brain': 'cerebral hemisphere, cerebellum, pons, medulla oblongata, thalamus, hippocampus, amygdala',
  'heart': 'wall of heart, ascending aorta, arch of aorta, pulmonary artery, superior vena cava, inferior vena cava',
  'lungs': 'upper lobe of right lung, upper lobe of left lung, lower lobe of right lung, lower lobe of left lung, middle lobe of lung, trachea, bronchus',
  'lung': 'upper lobe of right lung, upper lobe of left lung, lower lobe of right lung, lower lobe of left lung, middle lobe of lung',
  'airway': 'trachea, bronchus',
  'airways': 'trachea, bronchus',
  'pulmonary': 'respiratory',
  'respiratory': 'upper lobe of right lung, upper lobe of left lung, lower lobe of right lung, lower lobe of left lung, middle lobe of lung, trachea, bronchus',
  'kidneys': 'kidney, ureter, urinary bladder',
  'kidney': 'kidney, ureter, urinary bladder',
  'bladder': 'urinary bladder',
  'wrist': 'scaphoid, lunate, triquetrum, pisiform, trapezium, trapezoid, capitate, hamate',
  'carpals': 'scaphoid, lunate, triquetrum, pisiform, trapezium, trapezoid, capitate, hamate',
  'carpal': 'scaphoid, lunate, triquetrum, pisiform, trapezium, trapezoid, capitate, hamate',
  'carpal bones': 'scaphoid, lunate, triquetrum, pisiform, trapezium, trapezoid, capitate, hamate',
  'metacarpals': 'metacarpals',
  'metacarpal': 'metacarpals',
  'hand bones': 'scaphoid, lunate, capitate, hamate, metacarpals, phalanges',
  'phalanges': 'phalanges, proximal phalanges, distal phalanges',
  'phalanx': 'phalanges',
  'fingers': 'phalanges, metacarpals',
  'finger': 'phalanges',
  'finger bones': 'phalanges',
  'toes': 'phalanges, metatarsals',
  'toe bones': 'phalanges',
  'collarbone': 'clavicle',
  'collar bone': 'clavicle',
  'shoulder blade': 'scapula',
  'arm bone': 'humerus',
  'upper arm': 'humerus, biceps brachii, triceps brachii',
  'forearm': 'radius, ulna',
  'ribs': 'ribs',
  'rib': 'ribs',
  'rib cage': 'ribs, sternum',
  'ribcage': 'ribs, sternum',
  'breastbone': 'sternum',
  'breast bone': 'sternum',
  'neck vertebrae': 'cervical vertebrae',
  'cervical spine': 'cervical vertebrae',
  'lower back': 'lumbar vertebrae',
  'lumbar spine': 'lumbar vertebrae',
  'ankle': 'talus, calcaneus, tibia, fibula',
  'tarsals': 'talus, calcaneus, navicular, cuboid, cuneiforms',
  'tarsal': 'talus, calcaneus, navicular, cuboid, cuneiforms',
  'heel': 'calcaneus',
  'heel bone': 'calcaneus',
  'liver': 'liver, gallbladder',
  'stomach': 'stomach, esophagus, duodenum',
  'skeleton': 'skeletal',
  'bones': 'skeletal',
  'muscles': 'muscular',
};

export function stemWord(word = '') {
  const w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 3) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Resolves natural language user query into matched systems, structure IDs, and clinical records.
 * Supports multi-structure queries (e.g. "Pectoralis Major & Trapezius" or "Femur & Digestive System").
 *
 * @param {string} query
 * @param {{systems?: object, structures?: Array<{id: string, name: string, system: string, fma?: string}>}} [indexData]
 * @returns {Promise<{systems: string[], structureIds: string[], structures: Array<object>, details: Array<object>, summary: string}>}
 */
export async function resolveAnatomyQuery(query = '', indexData = null) {
  const cleanQuery = String(query).trim().toLowerCase();
  if (!cleanQuery) {
    return { systems: [], structureIds: [], structures: [], details: [], summary: 'No anatomical structures specified.' };
  }

  // 1. Obtain index catalog
  let index = indexData;
  if (!index) {
    try {
      if (typeof fetch !== 'undefined') {
        const root = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
        const url = `${root}anatomy/index.json`.replace(/\/{2,}/g, '/');
        const res = await fetch(url);
        if (res.ok) index = await res.json();
      }
    } catch {}
  }

  // If index unavailable, fallback to built-in database keys
  const structuresCatalog = index?.structures || Object.entries(ANATOMY_DATABASE).map(([k, v]) => ({
    id: `AN_${k.replace(/\s+/g, '_')}`,
    name: v.name || k,
    commonName: v.commonName || k,
    dbKey: k,
    system: v.system || 'skeletal',
    fma: v.fma || null
  }));

  // 2. Expand synonyms in query
  let expandedQuery = cleanQuery;
  for (const [phrase, replacement] of Object.entries(ANATOMICAL_SYNONYMS)) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(expandedQuery)) {
      expandedQuery = expandedQuery.replace(regex, replacement);
    }
  }

  // 3. Split multi-part query ("and", "&", "with", ",", "as well as", "plus")
  const ANATOMY_STOPWORDS = new Set([
    'tell', 'me', 'all', 'about', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'with', 'show', 'display',
    'explain', 'describe', 'human', 'body', 'muscle', 'muscles', 'bone', 'bones', 'organ', 'organs', 'system',
    'systems', 'part', 'parts', 'item', 'items', 'where', 'is', 'are', 'what', 'can', 'you', 'give', 'detail'
  ]);

  const clauses = expandedQuery
    .split(/\b(?:and|as well as|plus|with|\&|\;|\,)\b/i)
    .map(c => c.trim())
    .filter(Boolean);

  const matchedSystemKeys = new Set();
  const matchedStructureIds = new Set();
  const matchedStructures = [];
  const detailsList = [];
  const seenIds = new Set();

  const allSystemNames = ['skeletal', 'muscular', 'nervous', 'cardiovascular', 'respiratory', 'digestive', 'urinary', 'endocrine'];

  for (const clause of clauses) {
    const rawTokens = clause.split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, '')).filter(t => t.length > 2);
    const keywords = rawTokens.filter(t => !ANATOMY_STOPWORDS.has(t));
    const searchTerms = keywords.length ? keywords : rawTokens;
    if (!searchTerms.length) continue;

    const stemmedTerms = searchTerms.map(stemWord);

    // Check if whole system is named (e.g. "digestive", "skeletal", "respiratory", "nervous system")
    let systemMatch = allSystemNames.find(s => clause.includes(s) || searchTerms.includes(s) || stemmedTerms.includes(s));
    if (systemMatch) {
      matchedSystemKeys.add(systemMatch);
      // Include primary structures of that system
      const sysStructures = structuresCatalog.filter(s => s.system === systemMatch);
      for (const s of sysStructures) {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          matchedStructureIds.add(s.id);
          matchedStructures.push(s);
        }
      }
      continue;
    }

    // Match individual structures
    for (const struct of structuresCatalog) {
      const sName = (struct.name || '').toLowerCase();
      const sCommon = (struct.commonName || '').toLowerCase();
      const sKey = (struct.dbKey || '').toLowerCase();
      const sSystem = struct.system || 'general';

      let isMatch = false;
      if (sName.includes(clause) || sCommon.includes(clause) || sKey.includes(clause) ||
          (clause.length > 3 && (clause.includes(sName) || clause.includes(sCommon) || clause.includes(sKey)))) {
        isMatch = true;
      } else {
        // Test exact term or stemmed term in sName / sCommon / sKey
        const matchCount = searchTerms.filter((t, i) => {
          const stem = stemmedTerms[i];
          return sName.includes(t) || sCommon.includes(t) || sKey.includes(t) ||
            (stem && (sName.includes(stem) || sCommon.includes(stem) || sKey.includes(stem)));
        }).length;

        if (matchCount === searchTerms.length || (searchTerms.length > 1 && matchCount >= 2)) {
          isMatch = true;
        } else if (searchTerms.length === 1 && matchCount === 1) {
          isMatch = true;
        }
      }

      if (isMatch && !seenIds.has(struct.id)) {
        seenIds.add(struct.id);
        matchedStructureIds.add(struct.id);
        matchedSystemKeys.add(sSystem);
        matchedStructures.push(struct);
      }
    }
  }

  // Fallback: if no specific structures matched, search individual keywords and stems
  if (!matchedStructures.length) {
    const fallbackWords = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !ANATOMY_STOPWORDS.has(w));
    for (const word of fallbackWords) {
      const stem = stemWord(word);
      const hits = structuresCatalog.filter(s => {
        const sn = (s.name || '').toLowerCase();
        return sn.includes(word) || (stem && sn.includes(stem));
      });
      for (const hit of hits.slice(0, 10)) {
        if (!seenIds.has(hit.id)) {
          seenIds.add(hit.id);
          matchedStructureIds.add(hit.id);
          matchedSystemKeys.add(hit.system);
          matchedStructures.push(hit);
        }
      }
    }
  }

  // 4. Retrieve rich clinical details for unique structures / systems
  const detailLookup = new Set();
  for (const s of matchedStructures) {
    const detailKey = s.name.toLowerCase().replace(/^(left|right|abdominal part of|clavicular part of|sternocostal part of|transverse part of|descending part of|ascending part of|short head of|long head of|medial head of|lateral head of)\s+/i, '').trim();
    if (!detailLookup.has(detailKey)) {
      detailLookup.add(detailKey);
      const detail = anatomyService.getDetail(detailKey, s.system);
      detailsList.push({
        id: s.id,
        name: detail.name || s.name,
        commonName: detail.commonName || s.name,
        system: s.system,
        region: detail.region,
        functionDesc: detail.functionDesc,
        clinicalNotes: detail.clinicalNotes,
        innervation: detail.innervation,
        bloodSupply: detail.bloodSupply,
        relations: detail.relations
      });
    }
  }

  const systemList = Array.from(matchedSystemKeys);
  const structureIdList = Array.from(matchedStructureIds);
  const summary = `Found ${matchedStructures.length} anatomical structure(s) across ${systemList.length} system(s): ${systemList.join(', ')}.`;

  return {
    query,
    systems: systemList,
    structureIds: structureIdList,
    structures: matchedStructures,
    details: detailsList,
    summary
  };
}
