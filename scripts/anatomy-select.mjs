/* ============================================================
   Anatomy asset pipeline — step 1: choose and download.

   Picks a curated subset of BodyParts3D structures, classifies each
   into a body system, and downloads the source STL into a local cache
   that is NOT committed. Step 2 (anatomy-build.mjs) turns the cache
   into compressed GLB files that are.

   Source data: BodyParts3D, © 2008 Database Center for Life Science,
   licensed CC BY-SA 2.1 Japan. See public/anatomy/ATTRIBUTION.md.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

const SRC       = '.anatomy-src';
const STL_DIR   = path.join(SRC, 'stl');
const RAW_BASE  = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';

// Only the whole-body skin/soft-tissue blobs are genuinely too big; a
// 26 MB external oblique is fine because the build decimates it anyway.
const MAX_BYTES   = 40 * 1024 * 1024;
const CONCURRENCY = 6;

/* ---------------- classification ----------------
   Ordered: the first rule that matches wins, so the specific cases
   (brain ventricles vs heart ventricles) are listed before the loose ones. */

const RULES = [
  ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b/i],

  ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalene|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis/i],

  ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis/i],

  ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar/i],

  ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i],

  ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva/i],

  ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i],

  ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary/i],
];

function classify(name) {
  for (const [system, re] of RULES) if (re.test(name)) return system;
  return null;
}

/* Per-system caps keep the download and the shipped bundle sane. The
   caps are generous where detail matters most for study. */
const CAPS = {
  skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
  digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
};

/* ---------------- importance ranking ----------------
   The cap has to cut something, and the wrong cut is fatal: ranking by
   file size alone once shipped 150 toe phalanges and no femur, because
   small bones make small meshes. These patterns name the structures a
   student is actually examined on, so they survive the cap regardless
   of how big their mesh happens to be. */

const CORE = {
  skeletal: /\b(femur|tibia|fibula|patella|humerus|radius|ulna|clavicle|scapula|hip bone|sacrum|coccyx|sternum|manubrium|xiphoid|rib\b|ribs\b|costal cartilage|vertebra|intervertebral disk|occipital bone|frontal bone|parietal bone|temporal bone|sphenoid bone|ethmoid|mandible|maxilla|zygomatic|nasal bone|palatine|vomer|lacrimal|hyoid|calcaneus|talus|navicular|cuboid|cuneiform|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|metatarsal|thyroid cartilage|cricoid)/i,

  muscular: /\b(deltoid|pectoralis|latissimus|trapezius|rhomboid|serratus|levator scapulae|infraspinatus|supraspinatus|subscapularis|teres (major|minor)|biceps|triceps|brachialis|brachioradialis|coracobrachialis|pronator teres|supinator|rectus abdominis|external oblique|internal oblique|transversus abdominis|quadratus lumborum|psoas|iliacus|gluteus|piriformis|sartorius|gracilis|pectineus|adductor (longus|magnus|brevis)|rectus femoris|vastus|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|tibialis (anterior|posterior)|fibularis longus|extensor digitorum longus|flexor digitorum longus|sternocleidomastoid|scalene|masseter|temporalis|pterygoid|digastric|mylohyoid|platysma|diaphragm|intercostal|erector spinae|longissimus|iliocostalis|spinalis|multifidus|semispinalis|splenius|levator ani)/i,

  cardiovascular: /\b(wall of heart|heart|atrium|ventricle|valve|interventricular septum|aorta|aortic|pulmonary (trunk|artery|vein)|vena cava|coronary|carotid|jugular|subclavian|axillary (artery|vein)|brachial|radial artery|ulnar artery|femoral|popliteal|tibial (artery|vein)|iliac|renal (artery|vein)|hepatic|portal vein|celiac|mesenteric|gastric artery|splenic|basilar|vertebral artery|circle of willis)/i,

  nervous: /\b(cerebral hemisphere|cerebellum|pons|medulla oblongata|midbrain|thalamus|hypothalamus|hippocampus|amygdala|corpus callosum|fornix|spinal cord|lateral ventricle|third ventricle|fourth ventricle|white matter|grey matter|frontal lobe|parietal lobe|temporal lobe|occipital lobe|insula|cingulate|precentral|postcentral|caudate|putamen|globus pallidus|substantia nigra|choroid plexus|optic|olfactory|pituitary|pineal|corona radiata|internal capsule|cerebral peduncle)/i,

  digestive: /\b(liver|lobe of liver|stomach|pancreas|spleen|gallbladder|bile duct|esophagus|oesophagus|duodenum|jejunum|ileum|small intestine|large intestine|colon|caecum|cecum|rectum|anal canal|appendix|tongue|parotid|submandibular|sublingual|pharynx|peritoneum|omentum)/i,

  respiratory: /./i,     // only a handful exist; take them all
  urinary:     /./i,
  endocrine:   /./i,
};

/* Structures that are real but low-yield, and numerous enough to crowd
   out everything else if left unranked. */
const LOW_YIELD = /\b(tooth|teeth|premolar|incisor|canine tooth|molar|phalanx|phalanges|lumbrical|interosseous|opponens|digiti minimi|digitorum brevis|abductor hallucis|adductor hallucis|flexor hallucis brevis|extensor hallucis brevis|nail|hair)/i;

/* A cap can still cut a core structure when more than `cap` of them
   match, and the size tie-break then quietly drops the biggest — which
   is how the diaphragm and latissimus dorsi went missing while dozens
   of small intrinsic muscles stayed. These must never be cut. */
const MUST_HAVE = /\b(diaphragm|latissimus dorsi|pectoralis major|deltoid|trapezius|rectus abdominis|external oblique|internal oblique|gluteus maximus|gluteus medius|biceps brachii|triceps brachii|rectus femoris|vastus lateralis|vastus medialis|biceps femoris|semitendinosus|semimembranosus|gastrocnemius|soleus|sternocleidomastoid|masseter|psoas major|serratus anterior|femur|tibia|fibula|patella|humerus|radius|ulna|clavicle|scapula|hip bone|sacrum|sternum|mandible|frontal bone|parietal bone|temporal bone|occipital bone|sphenoid bone|rib\b|vertebra|wall of heart|aorta|vena cava|pulmonary|coronary|carotid|cerebellum|pons|medulla oblongata|thalamus|hippocampus|corpus callosum|spinal cord|lateral ventricle|white matter|liver|stomach|pancreas|spleen|gallbladder|esophagus|oesophagus|duodenum|colon|small intestine|rectum|appendix|kidney|urinary bladder|lung|trachea|bronchus)/i;

function rank(part) {
  const n = part.name.toLowerCase();
  if (MUST_HAVE.test(n)) return 200;
  if (LOW_YIELD.test(n)) return -10;
  if (CORE[part.system]?.test(n)) return 100;
  return 0;
}

/* ---------------- main ---------------- */

const parts = JSON.parse(fs.readFileSync(path.join(SRC, 'available.json'), 'utf8'));

const classified = [];
for (const p of parts) {
  if (p.size > MAX_BYTES) continue;
  const system = classify(p.name);
  if (!system) continue;
  classified.push({ ...p, system });
}

// Rank by teaching importance first, then by size as a tie-break, so a
// cap trims obscure detail rather than the structures that matter.
const selected = [];
for (const system of Object.keys(CAPS)) {
  const pool = classified
    .filter(p => p.system === system)
    .sort((a, b) => rank(b) - rank(a) || a.size - b.size);
  selected.push(...pool.slice(0, CAPS[system]));
}

const bytes = selected.reduce((s, p) => s + p.size, 0);
console.log(`classified ${classified.length} of ${parts.length}; selected ${selected.length}`);
for (const system of Object.keys(CAPS)) {
  const n = selected.filter(p => p.system === system);
  console.log(`  ${system.padEnd(15)} ${String(n.length).padStart(3)}  ${(n.reduce((s, p) => s + p.size, 0) / 1048576).toFixed(1)} MB`);
}
console.log(`total source: ${(bytes / 1048576).toFixed(1)} MB`);

fs.mkdirSync(STL_DIR, { recursive: true });
fs.writeFileSync(path.join(SRC, 'selected.json'), JSON.stringify(selected, null, 2));

/* ---------------- download with a small worker pool ---------------- */

let done = 0, failed = 0, skipped = 0;

async function fetchOne(part) {
  const dest = path.join(STL_DIR, `${part.id}.stl`);
  if (fs.existsSync(dest) && fs.statSync(dest).size === part.size) { skipped++; return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${RAW_BASE}/${part.id}.stl`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      done++;
      return;
    } catch (err) {
      if (attempt === 3) { failed++; console.warn(`  failed ${part.id} (${part.name}): ${err.message}`); }
      else await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

const queue = [...selected];
async function worker() {
  while (queue.length) {
    const part = queue.pop();
    await fetchOne(part);
    const total = done + skipped + failed;
    if (total % 25 === 0) console.log(`  ${total}/${selected.length} …`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\ndownloaded ${done}, cached ${skipped}, failed ${failed}`);
