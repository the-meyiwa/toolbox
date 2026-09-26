import fs from 'node:fs';
import path from 'node:path';

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
      names.set(parts[0].replace(/"/g, '').trim(), parts[1].replace(/"/g, '').trim());
    }
  }

  const stls = treeData.tree.filter(x => x.path.startsWith('assets/BodyParts3D_data/stl/'));
  const parts = stls.map(s => {
    const id = s.path.replace('assets/BodyParts3D_data/stl/', '').replace('.stl', '');
    return { id, name: names.get(id) || id, size: s.size };
  });

  const EXPANDED_RULES = [
    ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain|gyrus|gyri|eyeball|retina|cornea|lens of eye|ciliary body|iris\b/i],
    
    ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|subscapularis|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotator|rotatores|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalen(e|us)|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis|teres (major|minor)|palmaris|subclavius|pyramidalis|tensor fasciae|puborectalis|sphincter|cremaster|ischiocavernosus|bulbospongiosus/i],
    
    ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis|atlas\b|axis\b|scaphoid|lunate|triquetr(al|um)|pisiform|trapezium|trapezoid|capitate|hamate|linea alba|aponeurosis/i],
    
    ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar/i],
    
    ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i],
    
    ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva/i],
    
    ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i],
    
    ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|deferent duct|mammary|penis|scrotum|corpus cavernosum|corpus spongiosum/i],
  ];

  function classify(name) {
    for (const [system, re] of EXPANDED_RULES) if (re.test(name)) return system;
    return null;
  }

  let classified = 0, unclass = [];
  const counts = {};
  for (const p of parts) {
    if (p.size > 40*1024*1024) continue; // skin blob
    const sys = classify(p.name);
    if (sys) {
      classified++;
      counts[sys] = (counts[sys] || 0) + 1;
    } else {
      unclass.push(p);
    }
  }

  console.log(`With expanded rules:`);
  console.log(`Classified: ${classified} / ${parts.length - 1} (${((classified/(parts.length-1))*100).toFixed(1)}%)`);
  console.log(`Unclassified remaining: ${unclass.length}`);
  console.log('Breakdown:', counts);
  if (unclass.length) {
    console.log('Remaining unclassified:');
    for (const u of unclass) console.log(`  ${u.id}: ${u.name}`);
  }
}

main().catch(console.error);
