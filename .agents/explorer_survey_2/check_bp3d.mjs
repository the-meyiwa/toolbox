// Temporary helper script to analyze BodyParts3D dataset structure and sizes
async function main() {
  const [treeRes, txtRes] = await Promise.all([
    fetch('https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1'),
    fetch('https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/parts_list_e.txt')
  ]);

  const treeData = await treeRes.json();
  const txt = await txtRes.text();

  const names = new Map();
  for (const line of txt.trim().split(/\r?\n/).slice(1)) {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const id = parts[0].replace(/"/g, '').trim();
      const name = parts[1].replace(/"/g, '').trim();
      names.set(id, name);
    }
  }

  const stls = treeData.tree.filter(x => x.path.startsWith('assets/BodyParts3D_data/stl/'));
  let matched = 0;
  const unmatched = [];
  const parts = [];

  for (const s of stls) {
    const id = s.path.replace('assets/BodyParts3D_data/stl/', '').replace('.stl', '');
    const name = names.get(id);
    if (name) {
      matched++;
      parts.push({ id, name, size: s.size });
    } else {
      unmatched.push(id);
      parts.push({ id, name: id, size: s.size });
    }
  }

  console.log(`Total STLs in tree: ${stls.length}`);
  console.log(`Matched with parts_list_e.txt: ${matched}`);
  console.log(`Unmatched IDs: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(`Sample unmatched IDs: ${unmatched.slice(0, 10).join(', ')}`);
  }

  // Classification rules from scripts/anatomy-select.mjs
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

  const MAX_BYTES = 40 * 1024 * 1024;
  const classified = [];
  const unclassified = [];
  const tooLarge = [];

  for (const p of parts) {
    if (p.size > MAX_BYTES) {
      tooLarge.push(p);
      continue;
    }
    const system = classify(p.name);
    if (!system) {
      unclassified.push(p);
      continue;
    }
    classified.push({ ...p, system });
  }

  console.log(`\n--- Classification Breakdown ---`);
  console.log(`Classified: ${classified.length}`);
  console.log(`Unclassified: ${unclassified.length}`);
  console.log(`Too large (>40MB): ${tooLarge.length}`);
  if (tooLarge.length > 0) {
    for (const t of tooLarge) console.log(`  Too large: ${t.id} ${t.name} (${(t.size/1048576).toFixed(1)} MB)`);
  }

  const bySys = {};
  const bySysBytes = {};
  for (const c of classified) {
    bySys[c.system] = (bySys[c.system] || 0) + 1;
    bySysBytes[c.system] = (bySysBytes[c.system] || 0) + c.size;
  }

  console.log('\nBy system (count & total source STL bytes):');
  for (const s of Object.keys(bySys)) {
    console.log(`  ${s.padEnd(16)}: ${String(bySys[s]).padStart(4)} parts, ${(bySysBytes[s] / 1048576).toFixed(1)} MB`);
  }

  console.log(`\nSample unclassified (first 20):`);
  for (const u of unclassified.slice(0, 20)) {
    console.log(`  ${u.id}: ${u.name}`);
  }
}

main().catch(console.error);
