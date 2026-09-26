# Handoff Report: Classification & Regex Rules Expansion

**Agent**: Explorer M1-2 (Classification & Regex Rules Specialist)  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2`  
**Date**: 2026-09-24  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

### 1.1 Existing Code Constraints in `scripts/anatomy-select.mjs`
- **Line 54–57**: Hardcoded `CAPS` mapping:
  ```javascript
  const CAPS = {
    skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
    digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
  };
  ```
  Total sum of caps = 600 structures.
- **Line 114–120**: Truncation logic:
  ```javascript
  const selected = [];
  for (const system of Object.keys(CAPS)) {
    const pool = classified
      .filter(p => p.system === system)
      .sort((a, b) => rank(b) - rank(a) || a.size - b.size);
    selected.push(...pool.slice(0, CAPS[system]));
  }
  ```
  Because `pool.slice(0, CAPS[system])` caps Skeletal at 175 and Muscular at 175, 73 skeletal bones and 190 muscles were dropped despite being classified.
- **Lines 29–45**: The `RULES` array contained 8 system regexes that failed to match 154 parts in the upstream BodyParts3D dataset.

### 1.2 Upstream Dataset Inventory
- The upstream repository `Kevin-Mattheus-Moerman/BodyParts3D` (git tree `87872e81ee4defb42aeef92b311a06c5e484834d`) contains exactly **934 binary STL files** (1,254.99 MB total uncompressed size).
- Decoded `parts_list_e.txt` (1,524 concepts) confirmed 100% ID-to-English-name mapping across all 934 STLs.
- Tested the original `RULES` against all 934 parts:
  - Nervous: 39 matches
  - Muscular: 365 matches
  - Skeletal: 248 matches
  - Cardiovascular: 60 matches
  - Respiratory: 7 matches
  - Digestive: 43 matches
  - Urinary: 8 matches
  - Endocrine: 10 matches
  - Unmatched: Exactly 154 parts.

### 1.3 Identification of the 154 Unmatched Parts
Direct analysis of the 154 unmatched parts revealed:
1. **Skeletal (20 parts)**:
   - `atlas` (FMA12519), `axis` (FMA12520).
   - 16 wrist carpal bones (`FMA23725`, `FMA24435`–`FMA24449`): right/left `scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`.
   - `concha` (`FMA54737`, `FMA54738` right/left inferior nasal concha).
2. **Muscular (63 parts)**:
   - 6 scalene muscles: `FMA13388`–`FMA13393` (`right/left scalenus anterior/medius/posterior`).
   - 2 subclavius muscles: `FMA13411`, `FMA13412` (`right/left subclavius`).
   - 4 teres muscles: `FMA32551`–`FMA32554` (`right/left teres major/minor`).
   - 2 tensor fasciae latae: `FMA22425`, `FMA22426`.
   - 2 palmaris longus: `FMA38463`, `FMA38464`.
   - 2 puborectalis: `FMA45856`, `FMA45857`.
   - 2 pyramidalis: `FMA22346`, `FMA22347`.
   - 5 rotators: `FMA23083` (thoracic), `FMA23089`/`90` (lumbar), `FMA81752`/`53` (cervical).
   - 1 sphincter: `FMA21930 external anal sphincter`.
   - 1 aponeurotic raphe: `FMA11336 linea alba`.
   - 29 facial expression muscles / aponeurosis: `frontalis` (2), `epicranius` (1), `orbicularis` (5), `corrugator` (2), `mentalis` (2), `buccinator` (2), `risorius` (2), `nasalis` (2), `procerus` (2), `depressor` (6), `levator` (7, including `levatores costarum`).
3. **Nervous (56 parts)**:
   - 25 cerebral gyri: `BP51` orbital/straight gyrus, 24 frontal, temporal, parietal, and occipital gyri (`FMA72653`–`FMA72805`).
   - 2 internal capsule limbs: `FMA72908`, `FMA72909`.
   - 2 insular cortex parts: `FMA72977`, `FMA72978`.
   - 4 geniculate bodies: `FMA73303`, `FMA73304`, `FMA73309`, `FMA73310`.
   - 8 colliculi & brachia: `FMA73422`, `FMA73423`, `FMA73434`, `FMA73435`, `FMA73461`–`64`.
   - 2 optic tracts: `FMA62382`, `FMA67936`.
   - Deep brain nuclei & pathways: `habenula` (`FMA62032`), `septum pellucidum` (`FMA61844`), `commissure` (`FMA61961`, `FMA62072`), `lamina terminalis` (`FMA61975`), `tuber cinereum` (`FMA62327`), `stria terminalis` (`FMA72939`/`40`), `mammillary body` (`FMA74877`), `interventricular foramen` (`FMA75351`), `interpeduncular fossa` (`FMA83740`).
4. **Digestive (3 parts)**:
   - `FMA76891 mesocolic taenia`, `FMA76892 omental taenia`, `FMA76893 free taenia`.
5. **Endocrine (5 parts)**:
   - `FMA19235 right deferent duct`, `FMA19236 left deferent duct`.
   - `FMA18247 glans penis`, `FMA19618 corpus cavernosum of penis`, `FMA19617nsn corpus spongiosum of penis, nsn`.
6. **Non-Organ / Excluded Items (7 parts)**:
   - `FMA7163 skin` (77.47 MB > 40 MB).
   - 6 sensory/adnexa: `eyeball`, `ear`, `head hairs`, `pubic hairs`, `eyebrows`, `labial part of mouth, nsn`.

### 1.4 Verification Test Execution
Executing the revised rules simulation against all 934 parts yielded:
```
Skipped oversized (>40MB): 1
Skipped non-organ / adnexa: 6
Classified and selected: 927 of 934
  skeletal        268 parts  157.9 MB
  muscular        428 parts  833.6 MB
  cardiovascular   60 parts  35.3 MB
  nervous          95 parts  93.8 MB
  digestive        46 parts  26.7 MB
  respiratory       7 parts  15.9 MB
  urinary           8 parts  3.2 MB
  endocrine        15 parts  4.8 MB
Total source STL: 1171.3 MB
```

---

## 2. Logic Chain

1. **Premise 1 (R1 & Feature 1)**: ORIGINAL_REQUEST §R1 and PROJECT.md Feature 1 require uncapped selection of all available BodyParts3D structures (~927 parts) into 8 organ systems without artificial truncations.
2. **Premise 2 (Rule Ordering)**: In `classify(name)`, regexes match greedily on preferred names. Rule order establishes anatomical domain ownership:
   - `nervous` must precede `cardiovascular` so brain ventricles (lateral/third/fourth) are not hijacked by cardiac ventricles.
   - `muscular` must precede `skeletal` so muscles with bone-related names (`subclavius`, `tibialis`, `fibularis`, `levator scapulae`) are classified as muscle.
   - `cardiovascular` must precede `digestive` and `urinary` so mesenteric and renal blood vessels remain cardiovascular.
   - `urinary` preceding `endocrine` maintains continuity for `adrenal gland` (`right/left adrenal gland`), which matches `/renal/i` and is already baked into `public/anatomy/urinary.glb` and `index.json`.
3. **Premise 3 (Deterministic Slicing Removal)**:
   - Slicing `pool.slice(0, CAPS[system])` was the only reason ranking functions (`CORE`, `LOW_YIELD`, `MUST_HAVE`, `rank()`) existed.
   - When all classified parts are retained, `selected.push(...pool)` eliminates truncation entirely.
   - Sorting `pool` alphabetically with `a.name.localeCompare(b.name)` guarantees deterministic index generation across operating systems.
4. **Premise 4 (Exclusion Safety)**:
   - `skin` (77.47 MB) is safely filtered out by `p.size > MAX_BYTES` (40 MB).
   - Non-organ sensory/hair meshes (`eyeball`, `ear`, `hairs`, `eyebrows`, `labial part of mouth`) do not match any of the 8 systems and are explicitly filtered by `EXCLUDE_NON_ORGAN`.

---

## 3. Caveats

1. **Adrenal Gland System Assignment**:
   - Biologically, the adrenal glands are endocrine glands. However, in the existing project repository, `right adrenal gland` and `left adrenal gland` match `/renal/i` in the urinary rule and are baked into `public/anatomy/urinary.glb` and `public/anatomy/index.json`.
   - Changing adrenals to endocrine would modify the partition of pre-existing GLB files and change urinary count from 8 to 6 and endocrine from 15 to 17.
   - Retaining the existing urinary rule preserves 100% backward compatibility and matches the 8 urinary / 15 endocrine counts established in Survey 1.
2. **Download Volume**:
   - The uncapped selection comprises **927 STLs totaling 1,171.3 MB** (~1.17 GB). When executed in an environment with no local STL cache, running `scripts/anatomy-select.mjs` will download this full dataset from GitHub raw storage.
   - The script's 6-worker pool with 3 exponential retries handles transient network dropouts.

---

## 4. Conclusion

1. **Implementation Actions for Worker**:
   - In `scripts/anatomy-select.mjs`:
     - Replace `RULES` with the expanded regexes specified in `analysis.md` §3.
     - Delete `const CAPS` and replace with `const SYSTEMS = ['skeletal', 'muscular', 'cardiovascular', 'nervous', 'digestive', 'respiratory', 'urinary', 'endocrine']`.
     - In the selection loop, replace `pool.slice(0, CAPS[system])` with `pool.sort((a, b) => a.name.localeCompare(b.name))` and push all items.
     - Add `const EXCLUDE_NON_ORGAN = /\b(skin|hair|hairs|eyebrow|eyebrows|eyeball|\bear\b|labial part of mouth)/i;` to explicitly drop non-organ meshes.
2. **Handoff Coordination**:
   - Manifest Explorer (M1-1): Provides `scripts/data/bodyparts3d-available.json` (934 items).
   - Index Specialist (M1-3): Consumes the 927 selected structures into `public/anatomy/index.json`.
   - Build Track (M2): Receives the exact count of 927 structures (muscular: 428, skeletal: 268, nervous: 95) to configure Draco decimation budgets.

---

## 5. Verification Method

To independently verify the classification rules:

1. **Run Unit Tests**:
   ```bash
   node --test tests/unit/assistant-anatomy.test.js
   ```
   *Expected outcome*: 8 passing tests (0 failures).

2. **Run Rules Validation Script**:
   Execute the following inline Node command from the project root:
   ```bash
   node -e "
   const fs = require('fs');
   const s50 = JSON.parse(fs.readFileSync('C:/Users/meyig/.gemini/antigravity/brain/f0e068f8-0dac-44ce-a46a-ba15a198b54a/.system_generated/steps/50/content.md', 'utf8').split('\n').slice(8).join('\n'));
   const s78 = JSON.parse(fs.readFileSync('C:/Users/meyig/.gemini/antigravity/brain/f0e068f8-0dac-44ce-a46a-ba15a198b54a/.system_generated/steps/78/content.md', 'utf8').split('\n').slice(8).join('\n'));
   const rawTxt = Buffer.from(s78.content, 'base64').toString('utf8');
   const nameMap = {};
   for (const line of rawTxt.split('\n')) {
     const parts = line.trim().split('\t');
     if (parts.length >= 2) nameMap[parts[0]] = parts[1];
   }
   const RULES = [
     ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b|gyrus|gyri|internal capsule|insula|geniculate|collicul|habenula|septum pellucidum|commissure|lamina terminalis|tuber cinereum|optic tract|stria terminalis|mammillary|interventricular foramen|interpeduncular/i],
     ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|\brotator|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalene|scalenus|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis|subclavius|teres|tensor fasciae|palmaris|puborectalis|pyramidalis|sphincter|frontalis|epicranius|orbicularis|corrugator|mentalis|buccinator|risorius|nasalis|procerus|\bdepressor\b|\blevator|\blevatores|linea alba/i],
     ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis|\batlas\b|\baxis\b|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|concha/i],
     ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar/i],
     ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i],
     ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva|\btaenia/i],
     ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i],
     ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary|deferent duct|penis/i],
   ];
   function classify(name) {
     for (const [sys, re] of RULES) if (re.test(name)) return sys;
     return null;
   }
   const stls = s50.tree.filter(x => x.path.endsWith('.stl'));
   let classified = 0;
   for (const t of stls) {
     const id = t.path.replace('.stl', '');
     if (t.size > 40*1024*1024) continue;
     if (classify(nameMap[id])) classified++;
   }
   console.log('Classified parts count:', classified);
   assert.equal(classified, 927);
   console.log('Verification PASSED: Exactly 927 structures classified.');
   "
   ```
   *Expected outcome*: `Verification PASSED: Exactly 927 structures classified.`
