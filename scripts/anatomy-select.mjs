/* ============================================================
   Anatomy asset pipeline — step 1: choose and download.

   Discovers BodyParts3D structures across an authoritative 3-tier
   fallback hierarchy, classifies parts into 8 canonical body systems
   using complete un-capped ontology regexes, generates the metadata
   catalog (public/anatomy/index.json) and selection manifest
   (.anatomy-src/selected.json), and optionally downloads source STLs
   into a local cache (.anatomy-src/stl).

   Step 2 (anatomy-build.mjs) turns the cached STLs into Draco-compressed
   GLB files.

   Source data: BodyParts3D, © 2008 Database Center for Life Science,
   licensed CC BY-SA 2.1 Japan. See public/anatomy/ATTRIBUTION.md.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

const SRC = '.anatomy-src';
const STL_DIR = path.join(SRC, 'stl');
const PUBLIC_ANATOMY = path.join('public', 'anatomy');
const COMMITTED_MANIFEST = path.join('scripts', 'data', 'bodyparts3d-available.json');
const RAW_BASE = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';

// Maximum size filter: whole-body skin blobs (>40 MB) are omitted
const MAX_BYTES = 40 * 1024 * 1024;
const CONCURRENCY = 6;

/* ---------------- canonical system metadata ---------------- */

export const SYSTEM_META = {
  skeletal: {
    name: 'Skeletal',
    label: 'Skeletal',
    color: [0.918, 0.894, 0.827],
    colorInt: 15064530, // 0xE5DDCE
    order: 1,
    file: 'skeletal.glb',
  },
  muscular: {
    name: 'Muscular',
    label: 'Muscular',
    color: [0.698, 0.314, 0.290],
    colorInt: 11449886, // 0xAE501E
    order: 2,
    file: 'muscular.glb',
  },
  nervous: {
    name: 'Nervous',
    label: 'Nervous',
    color: [0.863, 0.816, 0.722],
    colorInt: 14172344, // 0xD840B8
    order: 3,
    file: 'nervous.glb',
  },
  cardiovascular: {
    name: 'Cardiovascular',
    label: 'Cardiovascular',
    color: [0.690, 0.227, 0.180],
    colorInt: 11317038, // 0xAD112E
    order: 4,
    file: 'cardiovascular.glb',
  },
  respiratory: {
    name: 'Respiratory',
    label: 'Respiratory',
    color: [0.859, 0.569, 0.651],
    colorInt: 14076327, // 0xD6C9A7
    order: 5,
    file: 'respiratory.glb',
  },
  digestive: {
    name: 'Digestive',
    label: 'Digestive',
    color: [0.780, 0.569, 0.341],
    colorInt: 12792663, // 0xC35357
    order: 6,
    file: 'digestive.glb',
  },
  urinary: {
    name: 'Urinary',
    label: 'Urinary',
    color: [0.553, 0.353, 0.235],
    colorInt: 9059132,  // 0x8A3B3C
    order: 7,
    file: 'urinary.glb',
  },
  endocrine: {
    name: 'Endocrine',
    label: 'Endocrine',
    color: [0.494, 0.588, 0.443],
    colorInt: 8109169,  // 0x7B9C71
    order: 8,
    file: 'endocrine.glb',
  },
};

/* ---------------- classification ----------------
   Ordered: specific cases (brain ventricles vs heart ventricles)
   are listed before looser rules. Expanded to cover all 927 organ structures. */

export const RULES = [
  ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b|gyrus|gyri|internal capsule|insula|geniculate|collicul|habenula|septum pellucidum|commissure|lamina terminalis|tuber cinereum|optic tract|stria terminalis|mammillary|interventricular foramen|interpeduncular/i],

  ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|\brotator|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalene|scalenus|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis|subclavius|teres|tensor fasciae|palmaris|puborectalis|pyramidalis|sphincter|frontalis|epicranius|orbicularis|corrugator|mentalis|buccinator|risorius|nasalis|procerus|\bdepressor\b|\blevator|\blevatores|linea alba/i],

  ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis|\batlas\b|\baxis\b|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|concha/i],

  ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar/i],

  ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i],

  ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva|\btaenia/i],

  ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i],

  ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary|deferent duct|penis/i],
];

export const EXCLUDE_NON_ORGAN = /\b(skin|hair|hairs|eyebrow|eyebrows|eyeball|\bear\b|labial part of mouth)/i;

export function classify(name) {
  for (const [system, re] of RULES) {
    if (re.test(name)) return system;
  }
  return null;
}

/* ---------------- 3-tier discovery fallback ---------------- */

export async function fetchPartsFromGitHub() {
  const headers = {
    'User-Agent': 'Toolbox-Anatomy-Pipeline',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  // 1. Fetch parts list for English names
  const rawPartsListUrl = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/parts_list_e.txt';
  const nameRes = await fetch(rawPartsListUrl);
  if (!nameRes.ok) {
    throw new Error(`Failed to fetch parts_list_e.txt: HTTP ${nameRes.status} ${nameRes.statusText}`);
  }
  const nameText = await nameRes.text();
  const nameMap = new Map();
  for (const line of nameText.split('\n')) {
    const cols = line.split('\t');
    if (cols.length >= 2) {
      const id = cols[0].replace(/"/g, '').trim();
      const name = cols[1].replace(/"/g, '').trim();
      if (id && name) nameMap.set(id, name);
    }
  }

  // 2. Fetch Git tree for STLs
  const treeUrl = 'https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1';
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    if (treeRes.status === 403) {
      throw new Error(`GitHub API rate limit exceeded (HTTP 403). Set GITHUB_TOKEN environment variable or ensure ${COMMITTED_MANIFEST} exists.`);
    }
    throw new Error(`Failed to fetch GitHub tree: HTTP ${treeRes.status} ${treeRes.statusText}`);
  }
  const treeJson = await treeRes.json();
  if (!treeJson.tree || !Array.isArray(treeJson.tree)) {
    throw new Error('Invalid response structure from GitHub tree API');
  }

  const stlPrefix = 'assets/BodyParts3D_data/stl/';
  const manifest = [];
  for (const entry of treeJson.tree) {
    if (entry.type === 'blob' && entry.path.startsWith(stlPrefix) && entry.path.endsWith('.stl')) {
      const filename = path.basename(entry.path);
      const id = filename.replace(/\.stl$/i, '');
      const name = nameMap.get(id);
      manifest.push({
        id,
        name: name || id,
        file: filename,
        bytes: entry.size,
        size: entry.size,
        sha: entry.sha,
        concept: id,
        conceptId: id,
        fma: id.startsWith('FMA') ? id.slice(3) : null,
      });
    }
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return manifest;
}

export async function loadAvailableParts() {
  const localCachePath = path.join(SRC, 'available.json');

  // Tier 1: Local cache in .anatomy-src/available.json
  if (fs.existsSync(localCachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localCachePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Discovery] Loaded ${data.length} parts from local cache (${localCachePath})`);
        return data;
      }
    } catch (err) {
      console.warn(`[Discovery] Warning: Failed to parse ${localCachePath}: ${err.message}`);
    }
  }

  // Tier 2: Committed manifest in scripts/data/bodyparts3d-available.json
  if (fs.existsSync(COMMITTED_MANIFEST)) {
    try {
      const data = JSON.parse(fs.readFileSync(COMMITTED_MANIFEST, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Discovery] Loaded ${data.length} parts from committed manifest (${COMMITTED_MANIFEST})`);
        fs.mkdirSync(SRC, { recursive: true });
        fs.writeFileSync(localCachePath, JSON.stringify(data, null, 2), 'utf8');
        return data;
      }
    } catch (err) {
      console.warn(`[Discovery] Warning: Failed to parse ${COMMITTED_MANIFEST}: ${err.message}`);
    }
  }

  // Tier 3: Dynamic fetch from GitHub API
  console.log('[Discovery] No local manifest found. Fetching catalog dynamically from GitHub upstream...');
  const data = await fetchPartsFromGitHub();

  fs.mkdirSync(SRC, { recursive: true });
  fs.writeFileSync(localCachePath, JSON.stringify(data, null, 2), 'utf8');

  const manifestDir = path.dirname(COMMITTED_MANIFEST);
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(COMMITTED_MANIFEST, JSON.stringify(data, null, 2), 'utf8');

  console.log(`[Discovery] Successfully fetched and cached ${data.length} parts to ${localCachePath} and ${COMMITTED_MANIFEST}`);
  return data;
}

/* ---------------- catalog integrity validation ---------------- */

export function validateCatalogIntegrity(systems, structures) {
  const seenIds = new Set();
  const duplicates = [];
  const systemCounts = {};

  for (const sysKey of Object.keys(SYSTEM_META)) {
    systemCounts[sysKey] = 0;
  }

  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];

    if (!s.id || typeof s.id !== 'string') {
      throw new Error(`Integrity Error at index ${i}: Invalid structure ID: ${JSON.stringify(s.id)}`);
    }
    if (seenIds.has(s.id)) {
      duplicates.push(s.id);
    }
    seenIds.add(s.id);

    if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
      throw new Error(`Integrity Error: Structure ${s.id} has empty name.`);
    }

    if (!SYSTEM_META[s.system]) {
      throw new Error(`Integrity Error: Structure ${s.id} has unrecognized system: '${s.system}'`);
    }
    systemCounts[s.system]++;

    if (s.fma !== null && (typeof s.fma !== 'string' || s.fma.length === 0)) {
      throw new Error(`Integrity Error: Structure ${s.id} has invalid FMA field: ${JSON.stringify(s.fma)}`);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(`Integrity Violation: ${duplicates.length} duplicate structure IDs detected: ${duplicates.slice(0, 10).join(', ')}`);
  }

  for (const [sysKey, meta] of Object.entries(systems)) {
    const actualCount = systemCounts[sysKey];
    if (meta.count !== actualCount) {
      throw new Error(`System Count Mismatch for '${sysKey}': index claims ${meta.count}, but structures contains ${actualCount}`);
    }
  }

  const totalSystemCounts = Object.values(systems).reduce((sum, s) => sum + s.count, 0);
  if (totalSystemCounts !== structures.length) {
    throw new Error(`Catalog Length Mismatch: systems sum to ${totalSystemCounts}, but structures length is ${structures.length}`);
  }
}

/* ---------------- catalog generation ---------------- */

export function generateCatalogs(classifiedParts) {
  // 1. Group parts by system and ensure uniqueness
  const selectedBySystem = {};
  const seenIds = new Set();
  const duplicates = [];

  for (const sys of Object.keys(SYSTEM_META)) {
    selectedBySystem[sys] = [];
  }

  for (const part of classifiedParts) {
    if (seenIds.has(part.id)) {
      duplicates.push(part.id);
      continue;
    }
    seenIds.add(part.id);

    const fma = part.fma
      ? String(part.fma)
      : (part.id.startsWith('FMA') ? part.id.slice(3) : null);

    const item = {
      id: part.id,
      name: part.name.toLowerCase().trim(),
      system: part.system,
      fma,
      file: `${part.id}.stl`,
      bytes: part.bytes || part.size || 0,
    };

    selectedBySystem[part.system].push(item);
  }

  if (duplicates.length > 0) {
    console.warn(`[WARN] Encountered ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`);
  }

  // 2. Sort each system deterministically by name, tie-breaking on ID
  for (const sys of Object.keys(selectedBySystem)) {
    selectedBySystem[sys].sort((a, b) => {
      const nameDiff = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id, 'en');
    });
  }

  // 3. Build structures array sorted by canonical system order then name
  const structures = [];
  const systemsIndex = {};

  const sortedSystems = Object.keys(SYSTEM_META).sort(
    (a, b) => SYSTEM_META[a].order - SYSTEM_META[b].order
  );

  for (const sys of sortedSystems) {
    const list = selectedBySystem[sys];
    const meta = SYSTEM_META[sys];

    let glbBytes = 0;
    const glbPath = path.join(PUBLIC_ANATOMY, meta.file);
    if (fs.existsSync(glbPath)) {
      try { glbBytes = fs.statSync(glbPath).size; } catch {}
    }

    systemsIndex[sys] = {
      name: meta.name,
      label: meta.label,
      color: meta.color,
      colorInt: meta.colorInt,
      order: meta.order,
      file: meta.file,
      count: list.length,
      bytes: glbBytes,
    };

    for (const item of list) {
      structures.push({
        id: item.id,
        name: item.name,
        system: item.system,
        fma: item.fma,
      });
    }
  }

  // 4. Validate integrity before writing
  validateCatalogIntegrity(systemsIndex, structures);

  // 5. Build final index manifest (Version 2)
  const indexManifest = {
    version: 2,
    systems: systemsIndex,
    structures,
    attribution: {
      source: 'BodyParts3D',
      holder: 'Database Center for Life Science (DBCLS)',
      year: 2008,
      licence: 'CC BY-SA 2.1 Japan',
      url: 'https://lifesciencedb.jp/bp3d/',
    },
    generated: new Date().toISOString(),
  };

  // 6. Write target files
  fs.mkdirSync(SRC, { recursive: true });
  fs.mkdirSync(PUBLIC_ANATOMY, { recursive: true });

  const selectedPath = path.join(SRC, 'selected.json');
  const indexPath = path.join(PUBLIC_ANATOMY, 'index.json');

  fs.writeFileSync(selectedPath, JSON.stringify(selectedBySystem, null, 2), 'utf8');
  fs.writeFileSync(indexPath, JSON.stringify(indexManifest, null, 2), 'utf8');

  console.log(`\n[Catalog] Generated ${structures.length} structures across ${sortedSystems.length} systems:`);
  let totalBytes = 0;
  for (const sys of sortedSystems) {
    const sysBytes = selectedBySystem[sys].reduce((s, p) => s + p.bytes, 0);
    totalBytes += sysBytes;
    console.log(`  ${sys.padEnd(15)} ${String(systemsIndex[sys].count).padStart(3)} parts  ${(sysBytes / 1048576).toFixed(1)} MB`);
  }
  console.log(`total source STL: ${(totalBytes / 1048576).toFixed(1)} MB`);
  console.log(`[Catalog] Saved -> ${selectedPath}`);
  console.log(`[Catalog] Saved -> ${indexPath} (Version ${indexManifest.version})\n`);

  return { selectedBySystem, indexManifest };
}

/* ---------------- optional STL downloader ---------------- */

export async function downloadSTLs(selectedBySystem) {
  const allParts = Object.values(selectedBySystem).flat();
  fs.mkdirSync(STL_DIR, { recursive: true });
  console.log(`[Download] Starting download of ${allParts.length} STL files to ${STL_DIR}...`);

  let done = 0, failed = 0, skipped = 0;

  async function fetchOne(part) {
    const dest = path.join(STL_DIR, `${part.id}.stl`);
    if (fs.existsSync(dest) && fs.statSync(dest).size === part.bytes) {
      skipped++;
      return;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${RAW_BASE}/${part.id}.stl`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        done++;
        return;
      } catch (err) {
        if (attempt === 3) {
          failed++;
          console.warn(`  failed ${part.id} (${part.name}): ${err.message}`);
        } else {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }
  }

  const queue = [...allParts];
  async function worker() {
    while (queue.length) {
      const part = queue.pop();
      await fetchOne(part);
      const total = done + skipped + failed;
      if (total % 50 === 0) {
        console.log(`  download progress: ${total}/${allParts.length} ...`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n[Download Complete] downloaded ${done}, cached ${skipped}, failed ${failed}`);
}

/* ---------------- main execution ---------------- */

const parts = await loadAvailableParts();

const classified = [];
for (const p of parts) {
  const size = p.bytes || p.size || 0;
  if (size > MAX_BYTES) continue;
  if (EXCLUDE_NON_ORGAN.test(p.name)) continue;
  const system = classify(p.name);
  if (!system) continue;
  classified.push({ ...p, system });
}

console.log(`[Selection] Classified ${classified.length} of ${parts.length} available parts.`);

const { selectedBySystem, indexManifest } = generateCatalogs(classified);

const shouldDownload = process.argv.includes('--download') || (process.env.DOWNLOAD_STL === '1' && !process.argv.includes('--no-download'));

if (shouldDownload) {
  await downloadSTLs(selectedBySystem);
} else {
  console.log('To download raw STL meshes into .anatomy-src/stl, run: node scripts/anatomy-select.mjs --download\n');
}
