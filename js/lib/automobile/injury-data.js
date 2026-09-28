/* ============================================================
   Vehicle injury reference — what a car part can do to a person,
   how those injuries are usually treated, and how to prevent them.

   Text fields may carry inline references, rendered as links by
   injury-render.js:
     {Paracetamol}         a drug in the Compound Database (green)
     {!Carbon monoxide}    a hazardous substance in the Compound Database (amber)
     [femur-shaft|text]    a body site shown alone in the Anatomy Explorer
   Every drug and substance named must exist in the curated compound
   set, and every site must resolve to real atlas structures
   (tests/unit/vehicle-injuries.test.js).

   General information for learning and first aid. It is not medical
   advice; injured people need emergency services and a clinician.
   ============================================================ */

/* ---------------- body sites (Anatomy Explorer focus) ----------------
   structures: shown solid; context: shown faint for orientation;
   marker: a band on one structure, from/to as fractions along its
   long axis measured from its upper (or medial, for the clavicle) end. */
export const SITES = {
  'skull-vault':      { label: 'Skull (cranial vault)', structures: ['frontal bone', 'left parietal bone', 'right parietal bone', 'occipital bone', 'left temporal bone', 'right temporal bone'], context: ['sphenoid bone', 'mandible'] },
  'skull-temporal':   { label: 'Temporal bone (side of the skull)', structures: ['left temporal bone'], context: ['left parietal bone', 'frontal bone', 'occipital bone', 'sphenoid bone'] },
  'brain':            { label: 'Brain', structures: ['white matter structure of cerebral hemisphere', 'midbrain, nsn'], context: ['frontal bone', 'occipital bone'] },
  'face':             { label: 'Facial skeleton', structures: ['left nasal bone', 'left zygomatic bone', 'right zygomatic bone', 'left maxilla', 'right maxilla', 'mandible'], context: ['frontal bone', 'sphenoid bone'] },
  'nasal':            { label: 'Nasal bones', structures: ['left nasal bone', 'right nasal bone'], context: ['left maxilla', 'right maxilla', 'frontal bone'] },
  'zygoma':           { label: 'Cheekbone (zygoma)', structures: ['left zygomatic bone'], context: ['left maxilla', 'left temporal bone', 'frontal bone'] },
  'mandible':         { label: 'Lower jaw (mandible)', structures: ['mandible'], context: ['left temporal bone', 'right temporal bone', 'left maxilla', 'right maxilla'] },
  'upper-cervical':   { label: 'Upper neck: C1 (atlas) and C2 (axis)', structures: ['atlas', 'axis'], context: ['occipital bone', 'third cervical vertebra'] },
  'cervical-spine':   { label: 'Neck (cervical spine, C1–C7)', structures: ['atlas', 'axis', 'third cervical vertebra', 'fourth cervical vertebra', 'fifth cervical vertebra', 'sixth cervical vertebra', 'seventh cervical vertebra'], context: ['occipital bone', 'first thoracic vertebra'] },
  'thoracolumbar':    { label: 'Thoracolumbar junction (T12–L2)', structures: ['twelfth thoracic vertebra', 'first lumbar vertebra', 'second lumbar vertebra'], context: ['eleventh thoracic vertebra', 'third lumbar vertebra'] },
  'lumbar-spine':     { label: 'Lower back (lumbar spine)', structures: ['first lumbar vertebra', 'second lumbar vertebra', 'third lumbar vertebra', 'fourth lumbar vertebra', 'fifth lumbar vertebra'], context: ['twelfth thoracic vertebra', 'sacrum'] },
  'clavicle-left':    { label: 'Left collarbone (clavicle), middle third', structures: ['left clavicle'], context: ['manubrium', 'left scapula', 'left first rib'], marker: { structure: 'left clavicle', from: 0.35, to: 0.65 } },
  'sternum':          { label: 'Breastbone (sternum)', structures: ['manubrium', 'body of sternum'], context: ['left second rib', 'right second rib', 'left third rib', 'right third rib', 'left fourth rib', 'right fourth rib'] },
  'ribs-left':        { label: 'Left ribs 3–9', structures: ['left third rib', 'left fourth rib', 'left fifth rib', 'left sixth rib', 'left seventh rib', 'left eighth rib', 'left ninth rib'], context: ['body of sternum', 'left clavicle'] },
  'ribs-right':       { label: 'Right ribs 3–9', structures: ['right third rib', 'right fourth rib', 'right fifth rib', 'right sixth rib', 'right seventh rib', 'right eighth rib', 'right ninth rib'], context: ['body of sternum', 'right clavicle'] },
  'lungs':            { label: 'Lungs', structures: ['upper lobe of left lung', 'lower lobe of left lung', 'upper lobe of right lung', 'middle lobe of lung', 'lower lobe of right lung'], context: ['trachea'] },
  'heart':            { label: 'Heart', structures: ['wall of heart'], context: ['ascending aorta', 'arch of aorta', 'body of sternum'] },
  'aorta':            { label: 'Thoracic aorta (arch and descending)', structures: ['ascending aorta', 'arch of aorta', 'descending aorta'], context: ['wall of heart', 'left subclavian artery'] },
  'spleen':           { label: 'Spleen', structures: ['spleen'], context: ['stomach', 'left kidney', 'left ninth rib', 'left tenth rib'] },
  'liver':            { label: 'Liver', structures: ['liver'], context: ['gallbladder', 'right kidney', 'right ninth rib'] },
  'kidneys':          { label: 'Kidneys', structures: ['left kidney', 'right kidney'], context: ['twelfth thoracic vertebra', 'first lumbar vertebra'] },
  'bowel':            { label: 'Bowel (colon)', structures: ['colon, nsn'], context: ['stomach', 'urinary bladder'] },
  'pelvis':           { label: 'Pelvis (hip bones and sacrum)', structures: ['left hip bone', 'right hip bone', 'sacrum'], context: ['fifth lumbar vertebra', 'left femur', 'right femur'] },
  'hip-socket-right': { label: 'Right hip socket (acetabulum)', structures: ['right hip bone'], context: ['right femur', 'sacrum'], marker: { structure: 'right hip bone', from: 0.45, to: 0.7 } },
  'femur-shaft':      { label: 'Right thigh bone (femur), mid-shaft', structures: ['right femur'], context: ['right hip bone', 'right patella', 'right tibia'], marker: { structure: 'right femur', from: 0.35, to: 0.65 } },
  'femur-neck':       { label: 'Right femoral neck (hip)', structures: ['right femur'], context: ['right hip bone'], marker: { structure: 'right femur', from: 0.02, to: 0.14 } },
  'patella':          { label: 'Right kneecap (patella)', structures: ['right patella'], context: ['right femur', 'right tibia', 'right fibula'] },
  'tibial-plateau':   { label: 'Top of the right shin bone (tibial plateau)', structures: ['right tibia'], context: ['right femur', 'right patella', 'right fibula'], marker: { structure: 'right tibia', from: 0.0, to: 0.12 } },
  'lower-leg':        { label: 'Right shin (tibia and fibula), shaft', structures: ['right tibia', 'right fibula'], context: ['right femur', 'right patella', 'right talus'], marker: { structure: 'right tibia', from: 0.35, to: 0.7 } },
  'ankle':            { label: 'Right ankle (tibial pilon, fibula, talus)', structures: ['right tibia', 'right fibula', 'right talus'], context: ['right calcaneus', 'navicular bone of right foot'], marker: { structure: 'right tibia', from: 0.88, to: 1.0 } },
  'heel':             { label: 'Right heel bone (calcaneus) and talus', structures: ['right calcaneus', 'right talus'], context: ['right tibia', 'right fibula', 'right cuboid bone', 'navicular bone of right foot'] },
  'midfoot':          { label: 'Right midfoot and metatarsals', structures: ['right first metatarsal bone', 'right second metatarsal bone', 'right third metatarsal bone', 'right fourth metatarsal bone', 'right fifth metatarsal bone'], context: ['right medial cuneiform bone', 'right intermediate cuneiform bone', 'right lateral cuneiform bone', 'right cuboid bone', 'navicular bone of right foot'] },
  'distal-radius':    { label: 'Wrist end of the left radius', structures: ['left radius'], context: ['left ulna', 'left scaphoid', 'left lunate'], marker: { structure: 'left radius', from: 0.85, to: 1.0 } },
  'forearm':          { label: 'Left forearm (radius and ulna), shafts', structures: ['left radius', 'left ulna'], context: ['left humerus', 'left scaphoid'], marker: { structure: 'left radius', from: 0.35, to: 0.7 } },
  'scaphoid':         { label: 'Left scaphoid (wrist)', structures: ['left scaphoid'], context: ['left radius', 'left lunate', 'left capitate', 'left trapezium'] },
  'thumb':            { label: 'Left thumb', structures: ['left first metacarpal bone', 'proximal phalanx of left thumb', 'distal phalanx of left thumb'], context: ['left trapezium', 'left scaphoid'] },
  'fingertips':       { label: 'Fingertips (distal phalanges), right hand', structures: ['distal phalanx of right index finger', 'distal phalanx of right middle finger', 'distal phalanx of right ring finger', 'distal phalanx of right little finger'], context: ['middle phalanx of right index finger', 'middle phalanx of right middle finger', 'middle phalanx of right ring finger', 'middle phalanx of right little finger'] },
  'hand':             { label: 'Right hand bones', structures: ['right first metacarpal bone', 'right second metacarpal bone', 'right third metacarpal bone', 'right fourth metacarpal bone', 'right fifth metacarpal bone'], context: ['right capitate', 'right hamate', 'right scaphoid', 'right lunate'] },
  'humerus':          { label: 'Left upper arm bone (humerus), shaft', structures: ['left humerus'], context: ['left scapula', 'left radius', 'left ulna'], marker: { structure: 'left humerus', from: 0.35, to: 0.7 } },
};

/* ---------------- fracture patterns ---------------- */
export const FRACTURE_TYPES = {
  transverse:   { name: 'Transverse', what: 'A straight break across the bone.', how: 'A direct blow or bending force, such as a shin hitting a bumper.' },
  oblique:      { name: 'Oblique', what: 'An angled break across the shaft.', how: 'Bending combined with compression along the bone.' },
  spiral:       { name: 'Spiral', what: 'A break that twists around the shaft.', how: 'A twisting force, such as a foot trapped by a pedal while the body rotates.' },
  comminuted:   { name: 'Comminuted', what: 'The bone is broken into three or more pieces.', how: 'High-energy impact; common in crashes.' },
  segmental:    { name: 'Segmental', what: 'Two breaks leave a free-floating segment of bone.', how: 'High-energy impact along a long bone.' },
  open:         { name: 'Open (compound)', what: 'The bone breaks through the skin, or a wound reaches the fracture.', how: 'Any high-energy fracture; carries a high infection risk.' },
  displaced:    { name: 'Displaced', what: 'The broken ends have moved out of line.', how: 'Muscle pull and the force of the injury.' },
  greenstick:   { name: 'Greenstick', what: 'An incomplete break that bends the bone, seen in children.', how: 'Bending of soft, growing bone.' },
  compression:  { name: 'Compression (wedge)', what: 'The front of a vertebra collapses into a wedge.', how: 'The spine is bent forward under load.' },
  burst:        { name: 'Burst', what: 'A vertebra shatters outward, and pieces can press on the spinal cord.', how: 'A heavy axial load along the spine.' },
  chance:       { name: 'Chance (flexion-distraction)', what: 'A horizontal break through a vertebra, usually at T12–L2.', how: 'The body jack-knives over a lap belt worn too high across the abdomen.' },
  avulsion:     { name: 'Avulsion', what: 'A tendon or ligament pulls off a fragment of bone.', how: 'A sudden, forceful muscle pull or joint wrench.' },
  impacted:     { name: 'Impacted', what: 'The broken ends are driven into each other.', how: 'A load along the length of the bone.' },
  depressed:    { name: 'Depressed (skull)', what: 'Part of the skull is pushed inward.', how: 'A focused blow, such as against a pillar or door frame.' },
  linear:       { name: 'Linear (skull)', what: 'A thin crack in the skull without displacement.', how: 'A broad blow to the head.' },
  basilar:      { name: 'Basilar skull', what: 'A break at the base of the skull. Signs are bruising behind the ear or around the eyes, or clear fluid from the nose or ear.', how: 'A severe blow to the head or face.' },
  colles:       { name: 'Colles', what: 'A break of the radius near the wrist, with the fragment tilted towards the back of the hand.', how: 'A fall or push onto an outstretched hand; airbag or wheel impact with arms braced.' },
  smith:        { name: 'Smith', what: 'A wrist fracture of the radius with the fragment tilted towards the palm.', how: 'A force on the back of a flexed wrist.' },
  jefferson:    { name: 'Jefferson (C1 burst)', what: 'The ring of the first neck vertebra breaks in several places.', how: 'A blow to the top of the head, such as against the roof in a rollover.' },
  hangman:      { name: 'Hangman’s (C2)', what: 'A break through both sides of the arch of the second neck vertebra.', how: 'The head is thrown backward with force, such as face or chin against the windscreen.' },
  odontoid:     { name: 'Odontoid (dens)', what: 'A break of the peg of C2 that the skull turns on.', how: 'Flexion or extension of the neck in a crash; more common in older people.' },
  'le-fort':    { name: 'Le Fort (I–III)', what: 'Mid-face fractures that separate the upper jaw (I), the nose and upper jaw (II), or the whole face from the skull (III).', how: 'A face striking the steering wheel or dashboard.' },
  tripod:       { name: 'Zygomaticomaxillary (tripod)', what: 'The cheekbone breaks at its three attachments and sinks.', how: 'A blow to the cheek.' },
  blowout:      { name: 'Orbital blow-out', what: 'The thin orbital floor gives way under pressure on the eye.', how: 'A blunt object (or airbag) striking the eye socket.' },
  flail:        { name: 'Flail chest', what: 'Three or more neighbouring ribs, each broken in two places, so a segment moves the wrong way when breathing.', how: 'A heavy chest impact, such as against the steering wheel or a door in a side crash.' },
  acetabular:   { name: 'Acetabular (dashboard)', what: 'The hip socket breaks, often the posterior wall, with the hip dislocated.', how: 'The knee hits the dashboard and drives the thigh bone back into the socket.' },
  'open-book':  { name: 'Open-book pelvic', what: 'The front of the pelvic ring springs open. It can bleed heavily.', how: 'A front or side impact crushing the pelvis.' },
  'tibial-plateau': { name: 'Tibial plateau', what: 'A break into the knee joint surface at the top of the shin.', how: 'The knee is driven into the dashboard, or a bumper strikes the side of the knee.' },
  pilon:        { name: 'Pilon (plafond)', what: 'The lower end of the tibia is driven into the ankle joint.', how: 'Footwell intrusion or a foot braced hard on the brake pedal in a frontal crash.' },
  calcaneal:    { name: 'Calcaneal', what: 'The heel bone is crushed, often through its joint surface.', how: 'An axial load through the heel, such as a pedal or floor pushed in by the crash.' },
  'talar-neck': { name: 'Talar neck', what: 'A break through the neck of the talus; its blood supply is easily damaged.', how: 'Forced upward bending of the foot against a pedal.' },
  bumper:       { name: 'Bumper fracture', what: 'A fracture of the tibia or fibula (or the tibial plateau) in a pedestrian struck at bumper height.', how: 'The front of a car hits a standing person’s legs.' },
  tuft:         { name: 'Tuft (fingertip)', what: 'The tip of a finger bone is crushed, often with a nail-bed injury.', how: 'A finger caught in a closing door, bonnet or boot.' },
  boxers:       { name: 'Boxer’s', what: 'A break in the neck of the fifth metacarpal.', how: 'A closed fist striking something hard.' },
};

/* ---------------- injuries ----------------
   severity: minor | serious | critical */
export const INJURIES = {
  'whiplash': {
    name: 'Whiplash (neck sprain)', severity: 'minor',
    what: 'The head is thrown back and forth, straining the soft tissues of the [cervical-spine|neck]. It is the most common injury in rear-end collisions.',
    signs: 'Neck pain and stiffness, headache from the base of the skull, and shoulder pain, often worse the next day.',
    firstAid: 'Keep still and support the head if there is numbness, tingling, weakness or severe pain, and call emergency services.',
    treatment: ['Doctors use rules such as the Canadian C-spine rule to decide whether an X-ray or CT is needed.', 'Keep moving gently; long rest or a soft collar slows recovery.', 'Short-term pain relief with {Paracetamol} or {Ibuprofen}.', 'Physiotherapy if symptoms last beyond a few weeks.'],
    sites: ['cervical-spine'],
  },
  'cervical-fracture': {
    name: 'Neck (cervical spine) fracture', severity: 'critical',
    what: 'A break of a neck vertebra, which can injure the spinal cord. The [upper-cervical|top two vertebrae (C1 and C2)] are especially at risk in rollovers and head strikes.',
    signs: 'Severe neck pain, pain on pressing the spine, and numbness, tingling or weakness in the arms or legs.',
    firstAid: 'Do not move the person unless there is a fire or other immediate danger. Keep the head in line with the body and call emergency services.',
    treatment: ['Spinal immobilisation and a CT scan.', 'Stable breaks: a rigid collar or a halo brace. Unstable breaks: surgical fixation or fusion.', 'Spinal cord injury is managed in a specialist unit. High-dose {Methylprednisolone} is no longer given routinely.', 'Pain relief with {Morphine} or {Fentanyl} in hospital.'],
    fractures: ['jefferson', 'hangman', 'odontoid', 'burst', 'compression'],
    sites: ['upper-cervical', 'cervical-spine'],
  },
  'tbi': {
    name: 'Head injury and concussion', severity: 'serious',
    what: 'The [brain|brain] is shaken or struck inside the skull. The range runs from concussion to bleeding and swelling of the brain.',
    signs: 'Confusion, headache, vomiting, memory loss, drowsiness, unequal pupils, fits, or clear fluid from the nose or ears.',
    firstAid: 'Call emergency services for any loss of consciousness, repeated vomiting, fits or worsening drowsiness. Assume a neck injury too.',
    treatment: ['A CT scan of the head when warning signs are present.', 'Concussion: rest, then a gradual return to activity. Pain relief with {Paracetamol}; many clinicians avoid {Ibuprofen} for the first day or two.', 'Moderate or severe injury: protecting the airway, oxygen and blood pressure. {Tranexamic acid} within 3 hours reduces deaths in mild-to-moderate head injury (CRASH-3).', 'Raised pressure in the skull: {Mannitol} or hypertonic saline, and surgery to remove a clot.'],
    fractures: ['linear', 'depressed', 'basilar'],
    sites: ['brain', 'skull-vault'],
  },
  'skull-fracture': {
    name: 'Skull fracture', severity: 'serious',
    what: 'A break in the [skull-vault|skull]. The [skull-temporal|side of the skull] is thin, and a break there can tear the artery beneath and cause bleeding around the brain.',
    signs: 'A scalp wound or dent, bruising behind the ear or around the eyes, clear fluid from the nose or ears, and any sign of head injury.',
    firstAid: 'Do not press on a dent in the skull. Cover wounds lightly, keep the neck in line, and call emergency services.',
    treatment: ['A CT scan.', 'Linear breaks are often watched without treatment. Depressed or open breaks may need surgery.', 'Open breaks: antibiotics such as {Ceftriaxone}, and tetanus cover.'],
    fractures: ['linear', 'depressed', 'basilar'],
    sites: ['skull-vault', 'skull-temporal'],
  },
  'facial-fracture': {
    name: 'Facial fractures', severity: 'serious',
    what: 'Breaks of the [nasal|nose], [zygoma|cheekbone], [face|upper jaw and eye socket] or [mandible|lower jaw] when the face strikes the wheel, dashboard or airbag.',
    signs: 'Swelling, a flattened cheek, teeth that no longer meet, double vision, a nosebleed, or numbness of the cheek or lip.',
    firstAid: 'Lean the person forward if bleeding into the mouth or nose, if the neck is not injured. Keep the airway clear.',
    treatment: ['A CT scan of the face.', 'Many nasal fractures are reset within about two weeks. Displaced cheek, jaw or eye-socket fractures are plated.', 'Pain relief with {Paracetamol} and {Ibuprofen}. Antibiotics such as {Amoxicillin} for fractures open into the mouth or sinuses.'],
    fractures: ['le-fort', 'tripod', 'blowout'],
    sites: ['face', 'nasal', 'zygoma', 'mandible'],
  },
  'airbag-abrasion': {
    name: 'Airbag abrasions and burns', severity: 'minor',
    what: 'The bag inflates at up to about 300 km/h, so it can graze the face, chest and forearms. The hot gas and the powder released can cause superficial burns and eye irritation.',
    signs: 'Red grazes on the face, neck or forearms, stinging eyes, and a sore throat or cough from the powder.',
    firstAid: 'Wash skin and rinse the eyes with plenty of clean water. Get fresh air.',
    treatment: ['Clean and dress grazes; most heal in a week or two.', 'Eyes: an examination with {Fluorescein} dye to look for a scratch on the cornea, and antibiotic drops if one is found.', 'Pain relief with {Paracetamol}.'],
  },
  'forearm-fracture': {
    name: 'Wrist and forearm fractures', severity: 'serious',
    what: 'Arms bracing against the wheel, or hands in the path of the airbag, can break the [distal-radius|wrist end of the radius], the [forearm|forearm bones] or the [scaphoid|scaphoid].',
    signs: 'Pain, swelling and deformity of the wrist or forearm, and pain in the hollow at the base of the thumb (scaphoid).',
    firstAid: 'Support the arm in a sling in the position you find it. Remove rings and watches before swelling starts.',
    treatment: ['X-rays. A scaphoid break may not show at first, so it is often treated as broken until proven otherwise.', 'Straightening under local anaesthetic (a haematoma block with {Lidocaine}) and a cast; displaced breaks are plated.', 'Pain relief with {Paracetamol} and {Ibuprofen}.'],
    fractures: ['colles', 'smith', 'transverse', 'comminuted'],
    sites: ['distal-radius', 'forearm', 'scaphoid'],
  },
  'thumb-injury': {
    name: 'Thumb injuries', severity: 'minor',
    what: 'A thumb hooked inside the steering wheel rim can be bent back or broken when the airbag deploys or the wheel kicks.',
    signs: 'Pain and swelling at the base of the [thumb|thumb], and a weak pinch grip.',
    firstAid: 'Cool it and support it with a splint.',
    treatment: ['X-ray. Ligament tears at the base of the thumb (ulnar collateral ligament) may need a splint or repair.', 'Pain relief with {Ibuprofen}.'],
    fractures: ['avulsion', 'displaced'],
    sites: ['thumb'],
  },
  'clavicle-fracture': {
    name: 'Collarbone fracture (seat belt)', severity: 'serious',
    what: 'The shoulder belt restrains the chest across the [clavicle-left|middle of the collarbone]. In a severe frontal crash, the load can break it. In a left-hand-drive car the driver’s belt crosses the left collarbone.',
    signs: 'Pain and a bump along the collarbone, and the shoulder slumping forward and down.',
    firstAid: 'Support the arm in a sling.',
    treatment: ['X-ray.', 'Most middle-third fractures heal in a sling in 6–12 weeks. Badly displaced or shortened breaks, or ones threatening the skin, are plated.', 'Pain relief with {Paracetamol} and {Ibuprofen}.'],
    fractures: ['transverse', 'comminuted', 'displaced'],
    sites: ['clavicle-left'],
  },
  'chest-injury': {
    name: 'Rib and breastbone fractures', severity: 'serious',
    what: 'The chest is loaded by the belt, the steering wheel or the door, which can break the [ribs-left|ribs] and [sternum|breastbone] and bruise the [lungs|lungs] and [heart|heart].',
    signs: 'Pain on breathing or coughing, breathlessness, a segment of chest moving the wrong way (flail chest), and coughing blood.',
    firstAid: 'Help the person sit in the most comfortable position and call emergency services for breathlessness.',
    treatment: ['X-ray or CT; an ECG and blood tests to look for a bruised heart after a breastbone fracture.', 'Good pain relief is the treatment that lets the person breathe deeply: {Paracetamol}, {Ibuprofen} where safe, {Morphine}, or a nerve block with {Bupivacaine}.', 'A chest drain for collapsed lung or blood in the chest; surgical fixation for flail chest in some cases.'],
    fractures: ['flail', 'transverse', 'displaced'],
    sites: ['ribs-left', 'ribs-right', 'sternum', 'lungs', 'heart'],
  },
  'aortic-injury': {
    name: 'Torn aorta', severity: 'critical',
    what: 'In a sudden high-speed stop, the fixed and mobile parts of the [aorta|aorta] move differently and it can tear just beyond the arch. It is often fatal.',
    signs: 'Often few outward signs; a widened space in the middle of the chest on X-ray.',
    firstAid: 'Call emergency services; keep the person still and calm.',
    treatment: ['CT angiography.', 'Controlling heart rate and blood pressure, then a stent graft placed from inside the artery (TEVAR) or open surgery.'],
    sites: ['aorta', 'heart'],
  },
  'abdominal-organ': {
    name: 'Spleen, liver and kidney injuries', severity: 'critical',
    what: 'Side impacts and belts can tear the [spleen|spleen] (left side) or the [liver|liver] (right side) and bruise the [kidneys|kidneys]. A lap belt worn too high can also tear the [bowel|bowel].',
    signs: 'Abdominal pain or a tight abdomen, left shoulder-tip pain (spleen), a belt-shaped bruise across the abdomen, blood in the urine, and signs of shock.',
    firstAid: 'Lay the person flat, keep them warm, give nothing to eat or drink, and call emergency services.',
    treatment: ['An ultrasound scan in the emergency department, and CT.', 'Many spleen and liver tears stop bleeding with observation or embolisation; others need surgery.', 'Major bleeding: blood transfusion and {Tranexamic acid} within 3 hours of injury (CRASH-2).'],
    sites: ['spleen', 'liver', 'kidneys', 'bowel'],
  },
  'chance-fracture': {
    name: 'Lap-belt spine fracture', severity: 'serious',
    what: 'If the lap belt rides up over the abdomen, the body folds over it and the [thoracolumbar|spine at T12–L2] breaks. Bowel injury often comes with it (seat-belt syndrome).',
    signs: 'Back pain, a bruise across the abdomen from the belt, and leg numbness or weakness.',
    firstAid: 'Do not move the person unless there is a fire or other immediate danger. Call emergency services.',
    treatment: ['CT of the spine and abdomen.', 'Bony injuries: a brace. Ligament injuries: surgical fixation.', 'Pain relief with {Morphine} in hospital, then {Paracetamol} and {Ibuprofen}.'],
    fractures: ['chance', 'compression', 'burst'],
    sites: ['thoracolumbar', 'bowel'],
  },
  'pelvic-fracture': {
    name: 'Pelvic and hip-socket fractures', severity: 'critical',
    what: 'A side impact against the door, or the knee driven into the dashboard, can break the [pelvis|pelvic ring] or the [hip-socket-right|hip socket]. Pelvic ring fractures can bleed heavily.',
    signs: 'Hip or groin pain, being unable to stand, a shortened and turned-in leg (hip dislocation), and signs of shock.',
    firstAid: 'Do not roll or rock the pelvis. Keep the person flat and still, and call emergency services.',
    treatment: ['A pelvic binder; X-ray and CT.', 'A dislocated hip is put back within hours to protect the femoral head’s blood supply.', 'Bleeding: transfusion, {Tranexamic acid}, embolisation or pelvic packing; then surgical fixation.'],
    fractures: ['open-book', 'acetabular', 'comminuted'],
    sites: ['pelvis', 'hip-socket-right'],
  },
  'femur-fracture': {
    name: 'Thigh bone (femur) fracture', severity: 'critical',
    what: 'The knee is driven into the dashboard, breaking the [femur-shaft|mid-shaft of the femur] or the [femur-neck|femoral neck]. A shaft fracture can lose over a litre of blood into the thigh.',
    signs: 'Severe thigh pain, a swollen or deformed thigh, a shortened leg, and being unable to move the leg.',
    firstAid: 'Keep the leg still and support it as found. Treat for shock and call emergency services.',
    treatment: ['A traction splint and X-rays.', 'Strong pain relief: {Morphine} or {Fentanyl}, or a femoral or fascia iliaca nerve block with {Bupivacaine}.', 'Surgery, usually an intramedullary nail inside the bone, within 24 hours when possible.', 'Open fractures: antibiotics such as {Cefazolin} as soon as possible, and tetanus cover.'],
    fractures: ['transverse', 'oblique', 'spiral', 'comminuted', 'segmental', 'open'],
    sites: ['femur-shaft', 'femur-neck'],
  },
  'knee-injury': {
    name: 'Kneecap and knee fractures', severity: 'serious',
    what: 'A dashboard knee strike, or a bumper striking a pedestrian, can break the [patella|kneecap] or the [tibial-plateau|top of the shin bone].',
    signs: 'Knee pain and swelling, being unable to straighten the leg or bear weight, and a gap felt in the kneecap.',
    firstAid: 'Splint the knee in the position found and apply a cold pack.',
    treatment: ['X-ray and often CT.', 'Undisplaced breaks: a brace. Displaced breaks: wiring or plating to restore the joint surface.', 'Pain relief with {Paracetamol}, {Ibuprofen}, and {Morphine} if severe.'],
    fractures: ['transverse', 'comminuted', 'tibial-plateau', 'bumper'],
    sites: ['patella', 'tibial-plateau'],
  },
  'lower-leg-fracture': {
    name: 'Shin, ankle and foot fractures', severity: 'serious',
    what: 'In a frontal crash the footwell is pushed in and the foot is braced on a pedal. This breaks the [lower-leg|shin], the [ankle|ankle], the [heel|heel and talus] or the [midfoot|midfoot].',
    signs: 'Pain, swelling and deformity, being unable to bear weight, and cold or pale toes (a warning sign).',
    firstAid: 'Splint the leg as found and check that the toes stay warm and pink.',
    treatment: ['X-ray and CT.', 'Casting, or surgery with nails, plates or an external frame. Heel and talus fractures often need specialist fixation.', 'Pain relief with {Morphine} and {Paracetamol}.', 'Open fractures: {Cefazolin} and tetanus cover.'],
    fractures: ['pilon', 'calcaneal', 'talar-neck', 'spiral', 'transverse', 'open'],
    sites: ['lower-leg', 'ankle', 'heel', 'midfoot'],
  },
  'pedestrian': {
    name: 'Pedestrian injuries', severity: 'critical',
    what: 'A person hit by the front of a car is struck at bumper height, breaking the [lower-leg|shin] or [tibial-plateau|knee]. They are then thrown onto the bonnet or windscreen, which injures the [pelvis|pelvis], [ribs-left|chest] and [skull-vault|head].',
    signs: 'Leg deformity, head injury, and chest or abdominal pain.',
    firstAid: 'Protect the scene, keep the person still, and call emergency services.',
    treatment: ['Full trauma assessment and CT.', 'Treatment of each injury as described for leg, pelvic and head injuries.'],
    fractures: ['bumper', 'tibial-plateau', 'open-book'],
    sites: ['lower-leg', 'tibial-plateau', 'pelvis', 'skull-vault'],
  },
  'crush-finger': {
    name: 'Fingertip crush and nail-bed injury', severity: 'minor',
    what: 'A finger caught in a closing door, bonnet, boot or window crushes the [fingertips|fingertip] and can cut the nail bed.',
    signs: 'Pain, a blue-black nail (blood beneath it), a split nail, or a cut through the fingertip.',
    firstAid: 'Cool the finger, raise the hand, and cover any wound. Keep a severed fingertip cool in a clean, damp cloth inside a sealed bag.',
    treatment: ['X-ray.', 'Draining blood from under the nail, or repairing the nail bed under a finger block with {Lidocaine}.', 'Open fractures: antibiotics such as {Cefazolin}, and tetanus cover.', 'Pain relief with {Paracetamol} and {Ibuprofen}.'],
    fractures: ['tuft', 'open'],
    sites: ['fingertips'],
  },
  'hand-laceration': {
    name: 'Hand cuts and amputation (moving parts)', severity: 'serious',
    what: 'The electric cooling fan can start with the engine off, and the drive belt can trap fingers. Both cut or amputate [hand|fingers and hands].',
    signs: 'Bleeding, exposed tendon, loss of feeling or movement.',
    firstAid: 'Press firmly on the wound and raise the hand. Wrap an amputated part in damp gauze, seal it in a bag and keep that bag on ice (not touching the ice).',
    treatment: ['Wound exploration and repair of tendons and nerves under {Lidocaine} or a regional block.', 'Replantation for suitable amputations.', 'Antibiotics such as {Cefazolin} for dirty or open injuries, and tetanus cover.'],
    fractures: ['open', 'comminuted'],
    sites: ['hand', 'fingertips'],
  },
  'laceration': {
    name: 'Cuts from glass and metal', severity: 'minor',
    what: 'Breaking side glass and sharp metal edges cut skin. The windscreen is laminated and cracks rather than shattering.',
    signs: 'Bleeding, and glass fragments in the wound.',
    firstAid: 'Press firmly on the wound with a clean pad. Do not pull out large embedded objects.',
    treatment: ['Cleaning, removing glass (an X-ray finds fragments), then stitches, glue or strips, with {Lidocaine} to numb the area.', 'Tetanus cover; antibiotics only for dirty or bite-like wounds.'],
  },
  'thermal-burn': {
    name: 'Burns and scalds', severity: 'serious',
    what: 'Hot coolant (over 100 °C under pressure), exhaust parts at several hundred °C, hot oil, and fuel fires burn skin.',
    signs: 'Red, blistered, white or charred skin; burns to the face or airway cause a hoarse voice or soot around the mouth.',
    firstAid: 'Cool the burn under cool running water for 20 minutes, remove jewellery, and cover it loosely with cling film. Do not use ice, butter or creams.',
    treatment: ['Assessment of burn depth and area; burns units for large, deep, facial, hand or genital burns.', 'Pain relief with {Paracetamol}, {Ibuprofen}, or {Morphine} for large burns.', 'Dressings; large burns need intravenous fluids and sometimes skin grafts.'],
  },
  'chemical-burn': {
    name: 'Battery acid and fluid burns', severity: 'serious',
    what: 'Battery electrolyte is {!Sulfuric acid}. Brake fluid, coolant and fuel irritate skin and eyes, and acid in the eye can cause permanent damage.',
    signs: 'Stinging skin, redness, and painful, watering or blurred eyes.',
    firstAid: 'Rinse skin and eyes with plenty of running water for at least 20 minutes, holding the eyelids open. Remove contaminated clothing. Do not try to neutralise acid with an alkali.',
    treatment: ['Continued eye irrigation until the eye surface pH is normal, then an eye examination with {Fluorescein}.', 'Burns care as for heat burns.'],
  },
  'coolant-poisoning': {
    name: 'Coolant (antifreeze) poisoning', severity: 'critical',
    what: 'Toyota coolant contains glycol, and many antifreezes are {!Ethylene glycol}. It tastes sweet, so children and pets drink spills. It damages the kidneys and brain.',
    signs: 'Appearing drunk, vomiting, then fast breathing, fits and kidney failure over the following hours.',
    firstAid: 'Call emergency services or a poisons centre at once, even if the person seems well. Do not make them vomit.',
    treatment: ['Blood tests for acid build-up.', 'The antidote {Fomepizole} blocks the breakdown of glycol into its toxic products; haemodialysis removes it.', '{Sodium bicarbonate} for severe acid build-up.'],
  },
  'co-poisoning': {
    name: 'Carbon monoxide poisoning', severity: 'critical',
    what: 'Exhaust contains {!Carbon monoxide}, which has no colour or smell. Running the engine in a closed garage, or an exhaust leak into the cabin, can kill.',
    signs: 'Headache, dizziness, nausea, confusion, and several people affected at once.',
    firstAid: 'Get everyone into fresh air, switch off the engine, and call emergency services.',
    treatment: ['High-flow oxygen through a tight-fitting mask.', 'Hyperbaric oxygen for severe cases, pregnancy or loss of consciousness.'],
  },
  'crush-injury': {
    name: 'Crushed under the car', severity: 'critical',
    what: 'A car falling off a jack can crush the [ribs-left|chest] (stopping breathing) or the limbs. When the weight is lifted, damaged muscle releases potassium and myoglobin (crush syndrome).',
    signs: 'Trapped under the vehicle, breathlessness, and a swollen, numb limb after release.',
    firstAid: 'Call emergency services. Lift the car only with proper equipment and enough help, and never get under a car held only by a jack.',
    treatment: ['Intravenous fluids ({Sodium chloride}) before and after release.', 'High potassium: calcium, {Insulin} with {Glucose}, and {Sodium bicarbonate}; dialysis for kidney failure.', 'Treatment of chest, pelvic and limb injuries.'],
    sites: ['ribs-left', 'pelvis'],
  },
  'back-strain': {
    name: 'Back strain', severity: 'minor',
    what: 'Lifting a spare wheel or battery with a bent back strains the muscles of the [lumbar-spine|lower back].',
    signs: 'Aching and stiffness in the lower back.',
    firstAid: 'Stay gently active.',
    treatment: ['Pain relief with {Ibuprofen} or {Paracetamol}, heat, and staying active.', 'See a doctor urgently for numbness around the groin, bladder problems or leg weakness.'],
    sites: ['lumbar-spine'],
  },
  'head-strike': {
    name: 'Head strike on a closure', severity: 'minor',
    what: 'A bonnet whose prop rod slips, or an opening boot lid, can strike the [skull-vault|head].',
    signs: 'A scalp cut or lump; any head-injury warning signs.',
    firstAid: 'Press on scalp cuts, which bleed a lot. Watch for head-injury warning signs.',
    treatment: ['Scalp wounds closed with staples or glue.', 'Pain relief with {Paracetamol}.'],
    sites: ['skull-vault'],
  },
  'electrical': {
    name: 'Electrical burns and sparks', severity: 'minor',
    what: 'A spanner or ring bridging the battery terminals heats red-hot in seconds. A spark can ignite hydrogen gas from the battery, causing an explosion.',
    signs: 'Deep burns under rings or watch straps.',
    firstAid: 'Cool the burn and remove jewellery.',
    treatment: ['Burns care as for heat burns.'],
  },
};

/* Frontal crash injuries, used by parts whose failure causes collisions. */
const FRONTAL = ['whiplash', 'tbi', 'chest-injury', 'clavicle-fracture', 'femur-fracture', 'knee-injury', 'lower-leg-fracture', 'forearm-fracture'];

/* ---------------- parts → hazards ----------------
   First match wins. Component ids come from the vehicle package. */
export const PART_SAFETY = [
  { test: /^airbag_/, hazard: 'Airbags deploy in about 30 milliseconds and save lives, but they can injure people who are too close, out of position, or small.', injuries: ['airbag-abrasion', 'forearm-fracture', 'thumb-injury', 'facial-fracture', 'tbi', 'cervical-fracture'], prevention: ['Sit with your breastbone at least 25 cm (10 in) from the steering wheel hub.', 'Hold the wheel at 9 and 3 o’clock, with thumbs along the rim rather than hooked inside it.', 'Children under 13 ride in the back seat. Never put a rear-facing child seat in front of an active airbag.', 'Always wear the seat belt; airbags are designed to work with it.', 'Get the SRS warning lamp checked if it stays on.'] },
  { test: /^seat_belts$/, hazard: 'Seat belts prevent most crash deaths, and a belt worn incorrectly concentrates force where the body is weak.', injuries: ['clavicle-fracture', 'chest-injury', 'chance-fracture', 'abdominal-organ'], prevention: ['Lap belt low across the hip bones, never across the stomach.', 'Shoulder belt across the middle of the collarbone and chest, never under the arm or behind the back.', 'Remove slack, and keep the seatback fairly upright so you cannot slide under the belt.', 'Pregnant: the lap belt goes under the bump.', 'Use the correct child seat or booster until the belt fits properly.'] },
  { test: /^(headrest_|rear_headrest)/, hazard: 'A head restraint set too low or too far back lets the head whip backward in a rear-end collision.', injuries: ['whiplash', 'cervical-fracture'], prevention: ['The top of the restraint should be level with the top of your head.', 'Keep the gap to the back of your head as small as is comfortable (about 5 cm).'] },
  { test: /^(seat_back|seat_cushion|seat_rails|rear_seat)/, hazard: 'A steeply reclined seat lets the body slide under the lap belt. Loose items and unlatched seatbacks become missiles in a crash.', injuries: ['chance-fracture', 'abdominal-organ', 'whiplash'], prevention: ['Keep the seatback fairly upright when moving.', 'Check that the seat has locked on its rails after adjusting it.', 'Make sure folding rear seatbacks click into place.'] },
  { test: /^steering_(wheel|column)$/, hazard: 'In a frontal crash the chest and face move towards the wheel. The column collapses and the airbag cushions the impact, but a person sitting close still hits it.', injuries: ['chest-injury', 'facial-fracture', 'forearm-fracture', 'thumb-injury', 'aortic-injury'], prevention: ['Keep at least 25 cm between your breastbone and the wheel hub.', 'Tilt the wheel so the airbag points at your chest, not your face.', 'Hold the wheel at 9 and 3 o’clock.'] },
  { test: /^(steering_rack|tie_rod|steering_intermediate)/, hazard: 'Worn tie-rod ends or a failing rack cause wandering or loss of steering control.', injuries: FRONTAL, prevention: ['Have steering and suspension joints checked at every service, and after hitting a kerb or pothole hard.', 'Get knocking, looseness or a pull to one side checked promptly.'] },
  { test: /^brake_|^abs_actuator$/, hazard: 'Worn pads, leaks or air in the fluid lengthen stopping distances and can end in a collision. Brake fluid irritates skin and eyes.', injuries: [...FRONTAL, 'chemical-burn'], prevention: ['Replace pads before the wear indicator squeals, and check fluid level and condition at each service.', 'Get a soft pedal, pulling to one side, or the brake warning lamp checked before driving.', 'Wear gloves and eye protection when topping up fluid.'] },
  { test: /^(tyre_|spare_tyre)/, hazard: 'Worn or under-inflated tyres lose grip in the wet and can blow out, causing loss of control or rollover.', injuries: [...FRONTAL, 'cervical-fracture', 'pedestrian'], prevention: ['Keep tyres at the pressures on the driver’s door-pillar label, checked cold, monthly.', 'Replace tyres at 1.6 mm (2/32 in) of tread at the latest, and sooner for wet grip.', 'Do not ignore the low tyre pressure warning.'] },
  { test: /^(wheel_hub|front_lower_control|front_strut|rear_shock|front_coil|rear_coil|front_stabil|rear_torsion|rear_trailing|rear_hub)/, hazard: 'Failed suspension or wheel bearings cause instability. Coil springs store great energy, and compressing them without the right tool can launch parts.', injuries: [...FRONTAL, 'crush-injury', 'hand-laceration'], prevention: ['Use a proper spring compressor rated for the job, and never stand in line with a compressed spring.', 'Have clunks, wandering and wheel-bearing hum checked.'] },
  { test: /^jack_and_tools$/, hazard: 'The scissor jack is for changing a wheel only. A car on a jack can fall off it.', injuries: ['crush-injury', 'crush-finger', 'back-strain'], prevention: ['Park on firm, level ground away from traffic, with the parking brake on and hazards on.', 'Use only the jack points marked on the sills. Never put any part of your body under a car held by a jack.', 'Loosen the wheel nuts before lifting, and tighten them fully once the wheel is back on the ground.'] },
  { test: /^(door_.*(outer_panel|trim_panel|handle|window_frame)|door_sill)/, hazard: 'Closing doors crush fingers. In a side impact, the door intrudes into the space where the pelvis and chest sit.', injuries: ['crush-finger', 'pelvic-fracture', 'chest-injury', 'abdominal-organ', 'tbi'], prevention: ['Check fingers are clear before closing; use the child locks on the rear doors.', 'Check mirrors for cyclists before opening (the “Dutch reach”: open with the far hand).'] },
  { test: /glass$/, hazard: 'Power windows close with enough force to trap a child’s hand, arm or neck. Side glass shatters into fragments in a crash.', injuries: ['crush-finger', 'laceration'], prevention: ['Lock the rear windows with the window lock switch when children ride along.', 'Check that everyone is clear before closing a window, and never leave children alone in the car.'] },
  { test: /^(windscreen|rear_window)/, hazard: 'An unbelted occupant can strike the windscreen or be thrown through it; a cracked or dirty screen hides hazards.', injuries: ['tbi', 'facial-fracture', 'laceration', 'cervical-fracture'], prevention: ['Always wear the seat belt.', 'Replace cracked glass in the driver’s view, and keep the screen and wiper blades clean.'] },
  { test: /^(instrument_panel|dash_trim|glovebox)/, hazard: 'In a frontal crash the knees can strike the lower dashboard, and objects on the dashboard become projectiles.', injuries: ['knee-injury', 'femur-fracture', 'pelvic-fracture'], prevention: ['Wear the seat belt, sit well back and keep the knees off the dashboard.', 'Never ride with feet on the dashboard.', 'Keep the dashboard clear of loose objects.'] },
  { test: /^(gear_selector|parking_brake_lever|center_console|console_armrest)/, hazard: 'A car left in gear rather than P, or without the parking brake on a slope, can roll away and crush someone.', injuries: ['crush-injury', 'pedestrian'], prevention: ['Select P and apply the parking brake firmly every time you park.', 'On slopes, turn the wheels towards the kerb.'] },
  { test: /^(headlamp|tail_lamp|fog_lamp)/, hazard: 'Failed lamps make the car hard to see and the road hard to read, leading to rear-end and pedestrian collisions.', injuries: ['whiplash', 'pedestrian'], prevention: ['Check all lamps weekly, including brake lights, with a helper.', 'Use dipped headlights in rain and poor light.'] },
  { test: /^(front_bumper|hood$|lower_grille|upper_grille|front_emblem)/, hazard: 'The front of the car is what strikes a pedestrian first: the bumper at knee height, then the bonnet and windscreen.', injuries: ['pedestrian', 'head-strike'], prevention: ['Slow down near schools, crossings and parked cars.', 'Make sure the bonnet prop rod is seated in its slot before leaning under it.'] },
  { test: /^hood_prop_rod$/, hazard: 'A prop rod that slips from its slot drops the bonnet onto the head or hands.', injuries: ['head-strike', 'crush-finger'], prevention: ['Seat the rod firmly in the marked slot, and do not lean on the bonnet.', 'Close the bonnet by dropping it from about 20 cm; do not push down with the fingers on the edge.'] },
  { test: /^(trunk_lid|trunk_floor)/, hazard: 'The boot lid can close on the head or hands.', injuries: ['head-strike', 'crush-finger', 'back-strain'], prevention: ['Keep children out of the boot; the glowing emergency release inside opens it from within.', 'Lift heavy items with a straight back, keeping them close to the body.'] },
  { test: /^(radiator|coolant_reservoir|radiator_cap|radiator_hoses|water_pump|heater_hoses)/, hazard: 'The cooling system runs at over 100 °C under pressure. Opening it hot sprays scalding coolant, and spilled coolant is poisonous.', injuries: ['thermal-burn', 'coolant-poisoning', 'chemical-burn'], prevention: ['Never open the radiator cap while the engine is hot; wait until it is cool to touch.', 'Top up at the reservoir, and wipe up spills; store coolant away from children and pets.'] },
  { test: /^cooling_fan$/, hazard: 'The electric fan can switch on without warning, even with the engine off, when the coolant is hot.', injuries: ['hand-laceration'], prevention: ['Keep hands, hair, ties and tools away from the fan, and disconnect the battery before working near it.'] },
  { test: /^(drive_belt|crankshaft_pulley|alternator|ac_compressor)/, hazard: 'Belts and pulleys move fast and can pull in fingers, hair and clothing while the engine runs.', injuries: ['hand-laceration', 'crush-finger'], prevention: ['Work on belts only with the engine off and the key out.', 'Tie back hair and loose clothing.'] },
  { test: /^battery/, hazard: 'The battery holds {!Sulfuric acid} and gives off hydrogen gas, and short-circuiting it causes burns and sparks.', injuries: ['chemical-burn', 'electrical', 'back-strain'], prevention: ['Wear eye protection. Disconnect the negative (−) terminal first and reconnect it last.', 'When jump-starting, make the final connection to bare engine metal away from the battery.', 'Remove rings and watches, and keep sparks and flames away.'] },
  { test: /^(exhaust|catalytic|muffler)/, hazard: 'Exhaust parts reach several hundred °C, and leaks let {!Carbon monoxide} into the cabin.', injuries: ['thermal-burn', 'co-poisoning'], prevention: ['Never run the engine in a closed garage.', 'Have exhaust leaks, rattles and smells repaired promptly, and let the system cool before touching it.', 'Do not park over dry grass.'] },
  { test: /^(engine_block|cylinder_head|valve_cover|oil_|intake_manifold|timing_chain|ignition_coils|spark_plugs|throttle|transaxle)/, hazard: 'A running or recently run engine has hot surfaces, hot oil and high-voltage ignition parts.', injuries: ['thermal-burn', 'hand-laceration', 'electrical'], prevention: ['Let the engine cool before servicing, and switch it off before touching ignition parts.', 'Wear gloves when changing oil; used engine oil irritates skin.'] },
  { test: /^(fuel_|evap_canister)/, hazard: 'Petrol vapour ignites easily; leaks and spills are a fire risk, and siphoning fuel risks inhaling it into the lungs.', injuries: ['thermal-burn', 'chemical-burn'], prevention: ['Switch the engine off and do not smoke while refuelling; touch bare metal before handling the nozzle.', 'Never siphon fuel by mouth, and get fuel smells checked promptly.'] },
  { test: /^(wiper|washer)/, hazard: 'Worn blades and an empty washer leave the screen smeared, hiding pedestrians and hazards.', injuries: ['pedestrian', 'whiplash'], prevention: ['Replace blades when they streak, and keep the washer filled with proper screenwash.'] },
  { test: /^(side_mirror|rearview_mirror)/, hazard: 'Badly set mirrors leave blind spots where motorcycles, cyclists and cars disappear.', injuries: ['pedestrian', 'whiplash'], prevention: ['Set the mirrors so the side of the car just disappears from view, and check blind spots over your shoulder.'] },
  { test: /^(body_shell|firewall|front_side_member|rocker_panel|roof_panel|strut_tower|front_subframe|front_bumper_reinforcement|rear_bumper_reinforcement)/, hazard: 'The body structure is the crash protection. Rust or poorly repaired damage weakens it, so the cabin collapses more in a crash.', injuries: FRONTAL, prevention: ['Have crash damage repaired to the manufacturer’s methods, and treat rust early.'] },
];

/** Safety record for a component: { hazard, injuries: [injury…], prevention } or null. */
/**
 * Aircraft parts that can hurt someone on the ramp, in the hangar or on
 * board. Kept apart from the car rules: the same part names (doors, seats,
 * fuel) carry different hazards on an aircraft.
 */
export const AIRCRAFT_SAFETY = [
  { test: /^propeller(_spinner)?$/, hazard: 'A propeller can fire the engine if it is turned while a magneto is live — even with the key off — and a turning propeller is almost invisible.', injuries: ['tbi', 'hand-laceration', 'laceration', 'crush-injury'], prevention: ['Treat every propeller as live: never lean on it or stand in its arc.', 'Before anyone moves it by hand, the ignition is off and the mixture at cut-off — and even then, keep your body out of its arc.', 'Walk round the tail or behind the wing, never past the nose, and board or leave only with the engine stopped.'] },
  { test: /^engine_(inlet_cowl|fan)_/, hazard: 'A running jet engine draws in air — and people or objects — from well ahead of the inlet.', injuries: ['tbi', 'crush-injury', 'laceration'], prevention: ['Stay out of the marked inlet danger area whenever the beacon is on.', 'Approach only when the engines are shut down, the beacon is off and the crew signals it is safe.', 'Keep the ramp clear of loose objects that can be ingested.'] },
  { test: /^(engine_exhaust_(nozzle|plug)_|thrust_reverser_)/, hazard: 'Jet blast behind a running engine can throw people and vehicles, and the exhaust is very hot. Thrust reversers can move under hydraulic power.', injuries: ['thermal-burn', 'tbi', 'crush-injury'], prevention: ['Keep well clear behind running engines, especially as the aircraft starts to taxi.', 'Reversers are locked out before anyone works on them.'] },
  { test: /^(engine_(core|accessory_gearbox|oil_tank)_|apu$|apu_exhaust$)/, hazard: 'Engine cases, oil and the APU exhaust stay very hot after shutdown; the APU can run with no one on the flight deck.', injuries: ['thermal-burn', 'chemical-burn'], prevention: ['Let engines cool before opening cowls; wear gloves when servicing oil.', 'Keep clear of the APU inlet and exhaust while it runs.'] },
  { test: /^(main_gear_|nose_gear_(shock|drag|steering|door))/, hazard: 'Landing gear, gear doors and nose-wheel steering move under hydraulic power, and the gear can collapse if its locks are not in.', injuries: ['crush-injury', 'crush-finger', 'tbi'], prevention: ['Gear pins (ground locks) are fitted whenever the aircraft is parked or towed.', 'Keep clear of the nose gear during pushback and towing.'] },
  { test: /^(main|nose)_(tyre|wheel)(_|$)/, hazard: 'Aircraft tyres run at high pressure and can burst, especially after heavy braking.', injuries: ['laceration', 'crush-injury', 'tbi'], prevention: ['Approach hot brakes and tyres from the front or rear, never from the side, and let them cool.', 'Inflate only with the proper equipment and a pressure regulator.'] },
  { test: /^(door_[lr][12]|overwing_exit_)/, hazard: 'An armed door deploys its escape slide with great force when opened; heavy doors and hatches can trap hands.', injuries: ['head-strike', 'crush-finger', 'tbi', 'lower-leg-fracture'], prevention: ['Only cabin crew arm and disarm the slides; an armed door is opened only in an evacuation.', 'In an evacuation leave bags behind, jump onto the slide feet first and move well away from the aircraft.', 'Keep hands clear of hinges and handles.'] },
  { test: /^(cargo_door_|baggage_door$)/, hazard: 'Cargo doors swing overhead, and loading means heavy lifting in a cramped hold.', injuries: ['head-strike', 'back-strain', 'crush-finger'], prevention: ['Mind your head under the door opening and use the door’s hold-open lock.', 'Lift with a straight back and share heavy bags.'] },
  { test: /^cabin_door_/, hazard: 'Light-aircraft doors can slam in wind and trap fingers. A door that pops open in flight is noisy but not dangerous in itself.', injuries: ['crush-finger', 'head-strike'], prevention: ['Latch the door and check it before takeoff.', 'If a door opens in flight, keep flying the aircraft; the handbook covers closing it.'] },
  { test: /^(passenger_seats_|flight_attendant_seats$|pilot_seat_)/, hazard: 'Unbelted people are thrown against the ceiling and bins in unexpected turbulence; in a crash the lap belt carries the load through the hips.', injuries: ['head-strike', 'tbi', 'chance-fracture', 'abdominal-organ'], prevention: ['Keep the seat belt fastened whenever seated, low and tight across the hips.', 'Stow bags under the seat or in the bins, and take the brace position if told to.'] },
  { test: /^(seat_front_|rear_seat$|seat_belts$)/, hazard: 'A light-aircraft seat that slips back on its rails at takeoff can pull the pilot away from the controls; belts and harnesses protect the head and chest in a forced landing.', injuries: ['tbi', 'facial-fracture', 'chest-injury', 'chance-fracture'], prevention: ['Check the seat is locked on its rail before takeoff.', 'Wear the lap belt and shoulder harness for every takeoff and landing.'] },
  { test: /^exhaust_system$/, hazard: 'The exhaust and muffler get very hot, and a crack in the muffler lets carbon monoxide into the cabin through the heater.', injuries: ['thermal-burn', 'co-poisoning'], prevention: ['Carry a carbon monoxide detector.', 'If you smell exhaust, push cabin heat off, open the fresh-air vents and land.'] },
  { test: /^(fuel_tank|fuel_cap|fuel_sump|fuel_strainer|fuel_surge_tank|fuel_vent|single_point_refuelling)/, hazard: 'Aviation fuel burns fiercely: avgas is highly flammable and contains lead, and jet fuel irritates skin and eyes.', injuries: ['thermal-burn', 'chemical-burn'], prevention: ['Bond (ground) the aircraft to the fuel supply before refuelling, with no smoking or ignition sources nearby.', 'Wear gloves when sampling fuel, and dispose of samples properly.'] },
  { test: /^(battery|main_battery)$/, hazard: 'The battery can short, overheat or leak corrosive electrolyte.', injuries: ['chemical-burn', 'electrical'], prevention: ['Switch the master off before working near the battery, and wear eye protection.', 'Remove rings and watches.'] },
  { test: /^(pitot_(tube|probes)|total_air_temperature_probe|angle_of_attack_vanes|elevator_feel_pitots)$/, hazard: 'Heated probes get hot enough to burn skin within seconds on the ground.', injuries: ['thermal-burn'], prevention: ['Check probe heat by holding a hand near, not on, the probe, and only briefly.', 'Fit the covers only once the probes have cooled.'] },
  { test: /^(aileron|elevator|rudder|flap|spoiler|slat|krueger_flap)(_|$)/, hazard: 'Control surfaces and flaps can move suddenly under hydraulic or electric power, trapping anyone in their path.', injuries: ['crush-injury', 'crush-finger', 'laceration'], prevention: ['Keep clear of control surfaces whenever power is on; maintenance uses locks and warning tags.', 'Never put a hand into a flap track or spoiler well.'] },
  { test: /^oxygen_cylinder$/, hazard: 'Oxygen makes anything burn fiercely; oil or grease on oxygen fittings can ignite.', injuries: ['thermal-burn'], prevention: ['Keep oil, grease and flames away from oxygen equipment.'] },
];

export function safetyFor(componentId, { kind = 'car' } = {}) {
  const rules = kind === 'aircraft' ? AIRCRAFT_SAFETY : PART_SAFETY;
  const rule = rules.find(r => r.test.test(String(componentId || '')));
  if (!rule) return null;
  return { hazard: rule.hazard, injuries: rule.injuries.map(id => ({ id, ...INJURIES[id] })), prevention: rule.prevention };
}

/** Injuries whose name or description matches a query (for the Assistant). */
export function findInjuries(query) {
  const q = String(query || '').toLowerCase();
  const words = q.match(/[a-z]{3,}/g) || [];
  return Object.entries(INJURIES).map(([id, inj]) => {
    const text = `${inj.name} ${inj.what} ${(inj.fractures || []).map(f => FRACTURE_TYPES[f]?.name).join(' ')}`.toLowerCase();
    const score = words.reduce((s, w) => s + (text.includes(w) ? (inj.name.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
    return { id, inj, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => ({ id: x.id, ...x.inj }));
}

export const DISCLAIMER = 'General information for learning and first aid, not medical advice. In an emergency call your local emergency number; injured people need assessment by a clinician.';
