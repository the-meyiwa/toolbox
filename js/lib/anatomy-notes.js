/* ============================================================
   Teaching notes for the Anatomy Explorer.

   The BodyParts3D dataset gives accurate geometry and a Terminologia
   Anatomica name, but no description. These notes add the clinically
   useful part — the thing a student actually gets asked about.

   Matching is by name. Keys are matched against the lower-cased
   structure name: an exact hit wins, otherwise the longest matching
   substring key wins, so "right kidney" picks up the "kidney" note
   without needing an entry per side.
   ============================================================ */

const NOTES = {
  /* ---------------- skeletal ---------------- */
  'skull': 'Eight cranial bones fused at sutures, enclosing the brain, meninges and CSF. The floor forms anterior, middle and posterior cranial fossae; the middle fossa carries the middle meningeal artery, the vessel torn in an extradural haemorrhage.',
  'frontal bone': 'Forms the forehead, the roof of the orbits and the anterior cranial fossa. Contains the frontal air sinuses, which is why frontal headache is a feature of sinusitis.',
  'parietal bone': 'Paired bones forming the roof and sides of the cranium. The pterion, where frontal, parietal, temporal and sphenoid meet, is the thinnest part of the skull and overlies the middle meningeal artery.',
  'temporal bone': 'Houses the middle and inner ear and the mastoid air cells. Its petrous part is the densest bone in the body; the mastoid air cells can transmit infection intracranially.',
  'occipital bone': 'Surrounds the foramen magnum, where the medulla becomes the spinal cord. Bears the occipital condyles that articulate with the atlas.',
  'sphenoid bone': 'The keystone of the cranial base, articulating with almost every other cranial bone. Its sella turcica cradles the pituitary gland.',
  'ethmoid bone': 'A light, thin-walled bone between the orbits, forming part of the nasal septum and roof. Its cribriform plate transmits the olfactory nerves — a fracture here causes CSF rhinorrhoea and anosmia.',
  'mandible': 'The only mobile bone of the skull, articulating at the temporomandibular joint. It fractures most often at the condylar neck and the angle, and frequently in two places at once.',
  'maxilla': 'Forms the upper jaw, the floor of the orbit and most of the hard palate, and contains the maxillary sinus — the sinus that drains upwards against gravity.',
  'zygomatic bone': 'The cheek prominence, forming the lateral orbital rim. Commonly fractured in facial trauma, where it may trap the infraorbital nerve.',
  'hyoid bone': 'The only bone in the body articulating with no other bone, slung from the styloid processes. Fracture is a classic post-mortem sign of manual strangulation.',
  'vertebra': 'A segment of the vertebral column, carrying load through its body and protecting the cord in its vertebral foramen. The four sagittal curves act as a spring and place the centre of gravity over the pelvis.',
  'cervical vertebra': 'Seven in total, distinguished by transverse foramina carrying the vertebral arteries. C1 (atlas) has no body and nods; C2 (axis) has the dens and rotates.',
  'thoracic vertebra': 'Twelve, each articulating with a pair of ribs via costal facets. Long, downward-sloping spinous processes overlap like roof tiles and limit extension.',
  'lumbar vertebra': 'Five massive weight-bearing vertebrae. The spinal cord ends at L1–L2, which is why a lumbar puncture is performed at L3–L4 or below — into the cauda equina, not the cord.',
  'sacrum': 'Five fused vertebrae transmitting the weight of the trunk to the pelvis through the sacroiliac joints. The sacral hiatus at its base is the route for a caudal epidural.',
  'coccyx': 'Three to five fused rudimentary vertebrae. Gives attachment to the pelvic floor and to gluteus maximus.',
  'rib': 'Ribs 1–7 are true, joining the sternum by their own costal cartilage; 8–10 are false; 11 and 12 float. The neurovascular bundle lies in the subcostal groove on the inferior border — so a chest drain goes in just above the rib below.',
  'sternum': 'Manubrium, body and xiphoid. The sternal angle marks the 2nd costal cartilage, the T4/T5 disc, the carina, and both ends of the aortic arch — the most useful surface landmark in the chest.',
  'clavicle': 'The only bony strut between the upper limb and the axial skeleton. Fractures most often at the junction of the middle and lateral thirds, where its two curves meet.',
  'scapula': 'A flat triangular bone gliding on the posterior thoracic wall, held entirely by muscle. Its shallow glenoid covers only about a third of the humeral head — great mobility, poor stability.',
  'humerus': 'The radial nerve spirals round its posterior surface in the radial groove, so a mid-shaft fracture classically causes wrist drop. The surgical neck is the usual fracture site in the elderly, endangering the axillary nerve.',
  'radius': 'Carries the wrist and rotates over a fixed ulna in pronation and supination. A distal radius (Colles’) fracture is the commonest fracture in people over 65.',
  'ulna': 'Forms the hinge of the elbow at the trochlear notch. The ulnar nerve is subcutaneous behind the medial epicondyle — the "funny bone".',
  'scaphoid': 'The most commonly fractured carpal bone. Its blood supply enters distally, so a proximal fracture risks avascular necrosis — why a tender anatomical snuffbox is taken seriously despite a normal X-ray.',
  'hip bone': 'Ilium, ischium and pubis, fused at the acetabulum. Markedly sexually dimorphic: the female pelvis is wider, with a broader subpubic angle and a rounder inlet.',
  'femur': 'The longest and strongest bone in the body. Its head is supplied mainly by retinacular vessels running up the neck, so a displaced intracapsular neck fracture threatens the head and usually needs replacement rather than fixation.',
  'patella': 'The largest sesamoid bone, held in the quadriceps tendon. It holds the tendon away from the joint axis, increasing the moment arm and making knee extension substantially more efficient.',
  'tibia': 'The weight-bearing bone of the leg. Its subcutaneous anteromedial surface is why tibial fractures are so often open.',
  'fibula': 'Carries almost no load; it provides muscle attachment and the lateral malleolus. The common fibular nerve winds round its neck and is easily compressed there, causing foot drop.',
  'calcaneus': 'The heel bone and the largest tarsal. Fractures from an axial fall are often bilateral and associated with lumbar burst fractures — always examine the spine too.',
  'talus': 'Transmits the entire body weight from tibia to foot. No muscle attaches to it, and its retrograde blood supply makes avascular necrosis a real risk after fracture.',

  /* ---------------- muscular ---------------- */
  'muscle': 'A skeletal muscle: it crosses at least one joint and produces movement by shortening. Its action is inferred from where it attaches relative to the joint axis.',
  'deltoid': 'Caps the shoulder in anterior, middle and posterior parts giving flexion, abduction and extension. Supplied by the axillary nerve — hence wasting and loss of sensation over the regimental badge area after shoulder dislocation.',
  'pectoralis major': 'Fans from clavicle, sternum and costal cartilages to the intertubercular groove; adducts, flexes and medially rotates the arm. Its lower border forms the anterior axillary fold.',
  'latissimus dorsi': 'The broadest muscle of the back; extends, adducts and medially rotates the arm — the pulling-up and swimming muscle. Its reliable thoracodorsal pedicle makes it a workhorse reconstructive flap.',
  'trapezius': 'Upper fibres elevate the scapula, middle retract, lower depress; together they rotate the glenoid upwards, which is what allows the arm above shoulder height. Supplied by the accessory nerve (CN XI).',
  'biceps': 'Crosses both shoulder and elbow. The primary supinator of the forearm as well as a strong elbow flexor — most powerful when already supinated, which is why screws are threaded clockwise.',
  'triceps': 'Occupies the whole posterior compartment of the arm and is the sole extensor of the elbow. Supplied by the radial nerve.',
  'rectus abdominis': 'Paired vertical straps from pubis to costal margin, crossed by tendinous intersections — the "six pack" is a tendon pattern, not separate muscles. Enclosed in the rectus sheath, whose posterior wall ends at the arcuate line.',
  'external oblique': 'Fibres run infero-medially, "hands in pockets". With internal oblique and transversus it raises intra-abdominal pressure for coughing and defecation. Its lower border rolls in to form the inguinal ligament.',
  'diaphragm': 'The principal muscle of respiration, supplied by the phrenic nerve (C3, 4, 5 — keep the diaphragm alive). Three major openings: caval at T8, oesophageal at T10, aortic at T12.',
  'intercostal': 'External intercostals elevate the ribs in inspiration; internals depress them in forced expiration. The neurovascular bundle runs between the internal and innermost layers.',
  'gluteus maximus': 'The largest muscle in the body and the principal hip extensor — used for standing from sitting, climbing and running rather than level walking.',
  'psoas': 'A powerful hip flexor arising from the lumbar vertebrae. Because it lies against them, a psoas abscess can track from the spine to the groin.',
  'quadriceps': 'Four heads converging on the patella and inserting on the tibial tuberosity via the patellar ligament — the sole extensor of the knee. Rectus femoris also crosses the hip and so flexes it.',
  'biceps femoris': 'One of the hamstrings; extends the hip and flexes the knee. Spanning two joints makes it prone to strain during the deceleration phase of sprinting.',
  'gastrocnemius': 'Crosses knee and ankle, inserting via the Achilles tendon. With soleus it drives push-off and pumps the deep veins — immobility disables that pump and contributes to DVT.',
  'soleus': 'The deep, broad plantarflexor beneath gastrocnemius. Rich in slow-twitch fibres, it is the endurance muscle of standing posture.',
  'masseter': 'The most powerful muscle of mastication by cross-section, elevating the mandible. Supplied by the mandibular division of the trigeminal nerve.',
  'sternocleidomastoid': 'Turns the head to the opposite side and flexes the neck. Divides the neck into anterior and posterior triangles — the key landmark for describing neck lumps. Supplied by CN XI.',

  /* ---------------- nervous ---------------- */
  'cerebral hemisphere': 'Folded cortex divided into frontal, parietal, temporal and occipital lobes. The central sulcus separates primary motor (precentral) from primary sensory (postcentral) cortex. Each hemisphere controls the opposite side of the body.',
  'cerebellum': 'Does not initiate movement — it coordinates it, tuning timing, balance and precision. Damage causes ataxia, intention tremor and nystagmus, and crucially the signs are ipsilateral to the lesion.',
  'pons': 'Relays between cerebrum and cerebellum and houses the nuclei of cranial nerves V to VIII. Contains respiratory centres that modulate the medullary rhythm.',
  'medulla oblongata': 'Contains the cardiovascular and respiratory centres and the decussation of the pyramids, where the corticospinal tracts cross. Small lesions here are devastating.',
  'midbrain': 'Carries CN III and IV nuclei, the cerebral peduncles and the substantia nigra — degeneration of the latter causes Parkinson’s disease.',
  'thalamus': 'The relay station for almost all sensory information heading to the cortex — every modality except smell synapses here first.',
  'spinal cord': 'Runs from the foramen magnum to the conus medullaris at about L1–L2, then continues as the cauda equina. Thirty-one pairs of spinal nerves leave it.',
  'corpus callosum': 'The great commissure, around 200 million axons connecting the two hemispheres and allowing them to share information.',
  'lateral ventricle': 'Paired CSF-filled cavities within the hemispheres. CSF made by the choroid plexus flows to the third then fourth ventricle; obstruction anywhere along that path causes hydrocephalus.',
  'choroid plexus': 'Produces cerebrospinal fluid, roughly 500 ml a day, of which only about 150 ml is in circulation at any moment — the whole volume is turned over three times daily.',
  'nerve': 'A bundle of axons with its connective tissue sheaths. Peripheral nerves can regenerate at roughly 1 mm a day if the endoneurial tube survives; central axons largely cannot.',
  'pituitary': 'Sits in the sella turcica and governs the endocrine system. Because the optic chiasm lies just above, an enlarging adenoma classically causes bitemporal hemianopia.',

  /* ---------------- cardiovascular ---------------- */
  'heart': 'A four-chambered pump the size of a closed fist, in the middle mediastinum, about two-thirds left of the midline. Right side to the lungs, left side to the body — which is why the left ventricular wall is roughly three times thicker.',
  'left ventricle': 'Generates systemic pressure, so its wall is far thicker than the right. Its output is the cardiac output; failure here causes pulmonary congestion.',
  'right ventricle': 'Pumps into the low-pressure pulmonary circuit at roughly a fifth of systemic pressure. Failure causes systemic venous congestion — raised JVP, hepatomegaly, peripheral oedema.',
  'left atrium': 'Receives oxygenated blood from four pulmonary veins. Its appendage is where thrombus forms in atrial fibrillation, and thence to the brain.',
  'right atrium': 'Receives both venae cavae and the coronary sinus. Contains the sinoatrial node, the heart’s natural pacemaker.',
  'mitral valve': 'The only bicuspid valve. Stenosis causes left atrial hypertrophy and atrial fibrillation; regurgitation gives a pansystolic murmur radiating to the axilla.',
  'tricuspid valve': 'Guards the right atrioventricular orifice. Regurgitation produces giant V waves in the JVP and a pulsatile liver.',
  'aortic valve': 'Three semilunar cusps; the coronary arteries arise from the sinuses just above two of them. Stenosis gives an ejection systolic murmur radiating to the carotids, with syncope, angina and dyspnoea.',
  'aorta': 'Leaves the left ventricle, arches over the left main bronchus at the sternal angle giving off brachiocephalic, left common carotid and left subclavian, then descends to bifurcate into the common iliacs at L4.',
  'coronary artery': 'The first branches of the aorta, filling during diastole — which is why tachycardia worsens ischaemia. The left anterior descending supplies the anterior wall and septum and is the "widow-maker".',
  'superior vena cava': 'Drains head, neck and upper limbs into the right atrium. Obstruction gives facial swelling, distended neck veins and headache — a mediastinal-mass emergency.',
  'inferior vena cava': 'The largest vein in the body, draining everything below the diaphragm and lying to the right of the aorta.',
  'pulmonary artery': 'The one artery pair carrying deoxygenated blood. Pressure is far lower than systemic — normally about 25/8 mmHg.',
  'pulmonary vein': 'The one vein pair carrying oxygenated blood, returning it from the lungs to the left atrium.',
  'common carotid': 'Divides at the upper border of the thyroid cartilage into internal (brain and eye) and external (face and scalp). The carotid sinus at the bifurcation is a baroreceptor.',
  'artery': 'A vessel carrying blood away from the heart. Thick elastic and muscular walls let it withstand and smooth pulsatile pressure.',
  'vein': 'A vessel returning blood to the heart. Thin-walled, low-pressure and valved, relying on muscle pumps rather than cardiac pressure.',

  /* ---------------- respiratory ---------------- */
  'lung': 'Gas exchange happens across roughly 300 million alveoli and a surface area near that of a tennis court. The right lung has three lobes, the left two plus the lingula and cardiac notch.',
  'upper lobe of right lung': 'One of three right lobes, separated from the middle lobe by the horizontal fissure — a feature the left lung does not have.',
  'lower lobe of left lung': 'Separated from the upper lobe by the oblique fissure. Basal segments are the commonest site for aspiration pneumonia in a supine patient.',
  'trachea': 'About 10–12 cm long, held open by 16–20 C-shaped cartilage rings, incomplete posteriorly so the oesophagus behind can distend. Bifurcates at the carina at the sternal angle.',
  'bronchus': 'The right main bronchus is wider, shorter and more vertical than the left, so inhaled foreign bodies and aspirated material go right far more often.',
  'larynx': 'Protects the airway and produces voice. Supplied by the recurrent laryngeal nerve, which loops under the aortic arch on the left — hence hoarseness in left-sided lung and thyroid tumours.',

  /* ---------------- digestive ---------------- */
  'liver': 'The largest internal organ, roughly 1.5 kg, with a dual supply — about 75% portal vein, 25% hepatic artery. Handles protein synthesis, detoxification, bile, glycogen storage and clotting factors.',
  'stomach': 'A J-shaped reservoir with fundus, body, antrum and pylorus. Parietal cells make HCl and intrinsic factor; chief cells make pepsinogen. It churns rather than absorbs.',
  'oesophagus': 'A 25 cm muscular tube passing behind the trachea and through the diaphragm at T10. Upper third skeletal muscle, lower third smooth. Three natural constrictions trap swallowed objects.',
  'esophagus': 'A 25 cm muscular tube passing behind the trachea and through the diaphragm at T10. Upper third skeletal muscle, lower third smooth. Three natural constrictions trap swallowed objects.',
  'duodenum': 'The first and shortest part of the small bowel, receiving bile and pancreatic juice at the ampulla of Vater. Mostly retroperitoneal and C-shaped around the pancreatic head.',
  'small intestine': 'About 6 m long and where nearly all nutrient absorption occurs. Plicae circulares, villi and microvilli multiply the surface area roughly 600-fold. Only the ileum absorbs B12 and bile salts.',
  'large intestine': 'Reabsorbs water and electrolytes and stores faeces. Recognised on imaging by taeniae coli, haustra and appendices epiploicae — features the small bowel lacks.',
  'colon': 'Ascending, transverse, descending and sigmoid. The splenic flexure is a watershed between superior and inferior mesenteric territories and is vulnerable to ischaemic colitis.',
  'rectum': 'The final 12–15 cm of bowel. Its lower third drains to systemic veins, the upper to the portal system — an anastomosis that becomes clinically obvious in portal hypertension.',
  'appendix': 'A blind-ended tube off the caecum, on average 9 cm long, with highly variable position — retrocaecal most often. McBurney’s point marks its base on the surface.',
  'pancreas': 'Retroperitoneal at L1–L2. Exocrine acini make digestive enzymes; islets of Langerhans make insulin, glucagon and somatostatin. A head tumour obstructs the bile duct, causing painless jaundice.',
  'gallbladder': 'Stores and concentrates bile, contracting in response to CCK when fat reaches the duodenum. Its fundus lies at the tip of the 9th costal cartilage — Murphy’s point.',
  'spleen': 'The largest lymphoid organ, filtering blood and removing aged red cells. Normally impalpable; it must roughly triple in size before it can be felt below the left costal margin.',

  /* ---------------- urinary & endocrine ---------------- */
  'kidney': 'Retroperitoneal, roughly T12–L3, the right slightly lower because of the liver. Together they filter about 180 litres of plasma a day and return over 99% of it, while regulating blood pressure, red cell production and vitamin D.',
  'renal artery': 'Branches directly from abdominal aorta at L1–L2. Receives 20–25% of resting cardiac output. Renal artery stenosis is a classic cause of secondary renovascular hypertension.',
  'renal cortex': 'Outer layer of the kidney containing glomeruli, proximal and distal convoluted tubules. Site of ultrafiltration and erythropoietin synthesis.',
  'renal medulla': 'Inner region composed of renal pyramids and collecting ducts; establishes the hypertonic medullary gradient via countercurrent multiplication in the loops of Henle.',
  'ureter': 'A 25 cm muscular tube moving urine by peristalsis, not gravity. Three natural narrowings — pelviureteric junction, pelvic brim, vesicoureteric junction — are where stones lodge and cause colic.',
  'urinary bladder': 'A distensible reservoir behind the pubic symphysis holding 400–600 ml comfortably. When full it rises out of the pelvis and becomes palpable and percussible above the pubis.',
  'urethra': 'Conveys urine out of the bladder. The male urethra is around 20 cm with prostatic, membranous, bulbar and penile parts; the female is about 4 cm, which is why UTIs are far commoner in women.',
  'prostate': 'Surrounds the prostatic urethra just below the bladder. Benign hypertrophy affects the central zone and obstructs flow; carcinoma usually arises peripherally, which is why it is felt on rectal examination.',
  'thyroid gland': 'Produces T3 and T4 governing metabolic rate, and calcitonin. It moves on swallowing because it is bound to the larynx by pretracheal fascia — the classic bedside test for a neck lump.',
  'parathyroid gland': 'Four tiny endocrine glands on the posterior thyroid capsule; secretes parathyroid hormone (PTH) to regulate serum calcium and phosphate balance.',
  'adrenal gland': 'Cortex makes aldosterone, cortisol and androgens (salt, sugar, sex — the deeper you go, the sweeter it gets); medulla makes adrenaline and is modified sympathetic nervous tissue.',
  'testis': 'Produces sperm and testosterone. It descends through the inguinal canal in development, dragging its blood supply from the abdominal aorta — which is why testicular pain refers to the abdomen.',
  'epididymis': 'Coiled tube cap on the posterior testis where spermatozoa mature and gain motility over 10–14 days.',
  'ovary': 'Female gonad suspended by the suspensory ligament (carrying ovarian vessels) and ovarian ligament. Site of oogenesis and estrogen/progesterone secretion.',
  'fallopian tube': 'Uterine tube with fimbriae, infundibulum, ampulla, and isthmus. Fertilization normally occurs in the ampulla; commonest site of ectopic pregnancy.',
  'uterus': 'Thick pear-shaped muscular organ in the female pelvis between bladder and rectum; composed of fundus, corpus, and cervix, lined by endometrium.',
  'thymus': 'Where T lymphocytes mature. Large in childhood, it involutes after puberty and is largely replaced by fat in adults.',
  'circle of willis': 'Anastomotic arterial polygon at the skull base uniting carotid and vertebrobasilar supplies; commonest site of saccular (berry) aneurysms causing subarachnoid haemorrhage.',
  'internal carotid artery': 'Enters the carotid canal of the petrous temporal bone, traverses the cavernous sinus (siphon), and supplies anterior cerebral circulation and the ophthalmic artery.',
  'vertebral artery': 'Ascends through the transverse foramina of C6–C1, enters foramen magnum, and fuses to form the basilar artery supplying brainstem, cerebellum, and posterior cortex.',
  'brachial plexus': 'Formed by anterior rami of C5–T1 roots, giving trunks (upper, middle, lower), divisions, cords (lateral, posterior, medial), and terminal branches (musculocutaneous, axillary, radial, median, ulnar).',
  'sciatic nerve': 'The largest single nerve in the body (L4–S3), exiting the greater sciatic foramen below piriformis and dividing in the popliteal fossa into tibial and common fibular nerves.',
  'femoral artery': 'Continuation of the external iliac artery beneath the midpoint of the inguinal ligament; the primary vascular access site for coronary and endovascular catheterization.',
  'lymph node': 'Bean-shaped encapsulated lymphoid organ filtering lymph for foreign antigens; site of B and T cell activation and germinal centre proliferation in immune responses.'
};

/* Longest keys first so "upper lobe of right lung" beats "lung". */
const KEYS = Object.keys(NOTES).sort((a, b) => b.length - a.length);

export function noteFor(name) {
  const n = String(name || '').toLowerCase();
  if (NOTES[n]) return NOTES[n];
  for (const k of KEYS) if (n.includes(k)) return NOTES[k];
  return null;
}

export const NOTE_COUNT = KEYS.length;
