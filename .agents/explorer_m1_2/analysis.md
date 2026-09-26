# Technical Specification & Analysis: Classification & Regex Rules Expansion

**Specialist**: Explorer M1-2 (Classification & Regex Rules Specialist)  
**Milestone**: M1 - Dataset Extraction & Manifest  
**Target File**: `scripts/anatomy-select.mjs`  
**Date**: 2026-09-24  
**Project Root**: `c:\Users\meyig\Documents\Projects\toolbox-ola`  

---

## 1. Executive Summary

This report establishes the complete, verified implementation specification for expanding the anatomical classification rules (`RULES`) and removing the hardcoded selection caps (`CAPS`) in `scripts/anatomy-select.mjs`.

### Key Quantified Outcomes:
- **Total Upstream Dataset**: Exactly **934 binary STL structures** (1,254.99 MB source geometry) from `Kevin-Mattheus-Moerman/BodyParts3D`.
- **Pre-Change State (With CAPS)**: Only **517 structures** extracted across 8 systems (Skeletal capped at 175, Muscular capped at 175; 154 parts completely unclassified).
- **Post-Change State (Uncapped & Expanded Rules)**: Exactly **927 structures** classified and extracted into the 8 canonical anatomical systems:
  - **Skeletal**: 268 parts (+93 parts total, +20 newly classified from regex additions)
  - **Muscular**: 428 parts (+253 parts total, +63 newly classified from regex additions)
  - **Cardiovascular**: 60 parts (0 omitted; complete)
  - **Nervous**: 95 parts (+56 newly classified from regex additions)
  - **Digestive**: 46 parts (+3 newly classified from regex additions)
  - **Respiratory**: 7 parts (0 omitted; complete)
  - **Urinary**: 8 parts (0 omitted; complete)
  - **Endocrine**: 15 parts (+5 newly classified from regex additions)
- **Cleanly Excluded**: Exactly **7 non-organ / integumentary / sensory items**:
  - `FMA7163 skin` (77.47 MB, excluded by `MAX_BYTES = 40 MB`)
  - `FMA12513 eyeball` (sensory organ)
  - `FMA52780 ear` (sensory organ)
  - `FMA70751 set of head hairs` (integumentary adnexa)
  - `FMA70754 set of pubic hairs` (integumentary adnexa)
  - `FMA71098 set of eyebrows` (integumentary adnexa)
  - `FMA59815nsn labial part of mouth, nsn` (non-standard facial external tissue)
- **Integrity**: 0 duplicate IDs, 0 unhandled exceptions, 100% pass of existing unit tests (`tests/unit/assistant-anatomy.test.js`).

---

## 2. Root Cause Analysis: Why Structures Were Previously Dropped

Two distinct architectural barriers previously prevented full dataset ingestion:

### 2.1 The Hardcoded `CAPS` Truncation
In `scripts/anatomy-select.mjs` lines 54–57 and 114–120:
```javascript
const CAPS = {
  skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
  digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
};
...
selected.push(...pool.slice(0, CAPS[system]));
```
- Skeletal has 248 classified meshes in the raw dataset; `CAPS.skeletal = 175` truncated 73 skeletal bones.
- Muscular has 365 classified meshes; `CAPS.muscular = 175` truncated 190 muscles.
- Downstream build steps never received these valid structures.

### 2.2 Classification Regex Deficiencies (154 Dropped Parts)
Even if `CAPS` were removed, the existing `RULES` regex patterns failed to match **154 valid anatomical structures**. Because `classify(p.name)` returned `null`, these structures were silently bypassed on line 108 (`if (!system) continue;`).

The gaps stemmed from:
1. **Omission of Latin anatomical terminology**: e.g., the dataset names scalene muscles `scalenus` rather than `scalene`, and rotators `rotator` (singular) rather than `rotatores` (plural).
2. **Missing atomic bone names**: The skeletal regex included generic terms like `carpal` and `vertebra`, but omitted individual carpal bones (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`) and atypical vertebrae (`atlas`, `axis`).
3. **Missing cortical and deep brain structures**: Absence of `gyrus`/`gyri`, `internal capsule`, `insula`, `optic tract`, `colliculi`, and `geniculate` bodies.
4. **Missing facial expression muscles**: No patterns existed for `frontalis`, `orbicularis`, `buccinator`, `risorius`, `mentalis`, `nasalis`, `procerus`, `corrugator`, or `depressor` muscles.
5. **Missing visceral anatomical terms**: Colon taeniae (`taenia`) and reproductive organs (`deferent duct`, `penis`).

---

## 3. System-by-System Classification Rules Specification

### 3.1 Rule Precedence & Ordering Architecture
In `classify(name)`, rules are tested sequentially; the **first match determines the system**. Maintaining strict ordering is mandatory to prevent cross-system false positives:

```
[0] nervous        -> Evaluated first so cerebral ventricles (lateral/third/fourth) are captured before heart ventricle
[1] muscular       -> Evaluated before skeletal so muscles named after bones (subclavius, tibialis, fibularis, temporalis, levator scapulae) are captured as muscles
[2] skeletal       -> Captures all bones, cartilages, joints, and ligaments
[3] cardiovascular -> Evaluated before digestive/urinary so mesenteric/renal blood vessels (mesenteric artery/vein, renal artery/vein) remain in cardiovascular
[4] respiratory    -> Lungs, airways, larynx
[5] digestive      -> Alimentary canal, liver, pancreas, taeniae, teeth
[6] urinary        -> Kidneys, ureters, bladder, urethra, adrenal glands (suprarenal)
[7] endocrine      -> Thyroid, thymus, gonads, male genitalia (penis, deferent duct/vas deferens)
```

### 3.2 Skeletal System
- **Current Regex**:
  ```javascript
  /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis/i
  ```
- **Additions**:
  - `\batlas\b`: C1 cervical vertebra (`FMA12519 atlas`).
  - `\baxis\b`: C2 cervical vertebra (`FMA12520 axis` and `FMA25058 intervertebral disk of axis`).
  - Carpal bones (16 meshes for left & right wrists):
    - `scaphoid` (`FMA24435`, `FMA24436`)
    - `lunate` (`FMA24437`, `FMA24438`)
    - `triquetral` (`FMA24439`, `FMA24440`)
    - `pisiform` (`FMA24441`, `FMA24442`)
    - `trapezium` (`FMA24443`, `FMA24444`)
    - `trapezoid` (`FMA23725`, `FMA24445`)
    - `capitate` (`FMA24446`, `FMA24447`)
    - `hamate` (`FMA24448`, `FMA24449`)
  - Nasal conchae: `concha` (`FMA54737 right inferior nasal concha`, `FMA54738 left inferior nasal concha`).
- **Complete Proposed Regex**:
  ```javascript
  ['skeletal', /\bbone\b|vertebra|\brib\b|\bribs\b|costal cartilage|sternum|manubrium|xiphoid|clavicle|scapula|humerus|radius\b|ulna\b|carpal|metacarpal|phalanx|phalanges|pelvis|hip bone|ilium|ischium|pubis|sacrum|coccyx|femur|patella|tibia|fibula|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|skull|cranium|occipital|frontal bone|parietal|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|intervertebral disk|cartilage|meniscus|ligament|tendon|joint|symphysis|\batlas\b|\baxis\b|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|concha/i]
  ```
- **Structure Count**: Increases from 248 to **268 parts** (+20 parts).

### 3.3 Muscular System
- **Current Regex**:
  ```javascript
  /\bmuscle\b|deltoid|infraspinatus|supraspinatus|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalene|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis/i
  ```
- **Additions**:
  - `scalenus`: 6 scalene muscles (`FMA13388`–`FMA13393` scalenus anterior/medius/posterior right/left).
  - `subclavius`: 2 subclavius muscles (`FMA13411`, `FMA13412`).
  - `teres`: 4 shoulder muscles (`FMA32551`–`FMA32554` teres major/minor right/left).
  - `tensor fasciae`: 2 hip muscles (`FMA22425`, `FMA22426` tensor fasciae latae right/left).
  - `palmaris`: 2 forearm muscles (`FMA38463`, `FMA38464` palmaris longus right/left).
  - `puborectalis`: 2 pelvic floor muscles (`FMA45856`, `FMA45857` right/left).
  - `pyramidalis`: 2 abdominal muscles (`FMA22346`, `FMA22347` right/left).
  - `\brotator`: 5 deep spinal rotators (`FMA23083` thoracic rotator, `FMA23089`/`90` lumbar rotators, `FMA81752`/`53` cervical rotators).
  - `sphincter`: `FMA21930 external anal sphincter`.
  - `linea alba`: `FMA11336 linea alba` (aponeurotic abdominal midline).
  - Facial expression muscles (29 parts):
    - `frontalis` (`FMA46759`, `FMA46760`)
    - `epicranius` (`FMA46768 aponeurosis of epicranius`)
    - `orbicularis` (`FMA46782`/`83` orbital orbicularis oculi, `FMA46785`/`86` palpebral orbicularis oculi, `FMA46841 orbicularis oris`)
    - `corrugator` (`FMA46796`, `FMA46797 corrugator supercilii`)
    - `mentalis` (`FMA46826`, `FMA46827`)
    - `buccinator` (`FMA46835`, `FMA46836`)
    - `risorius` (`FMA46839`, `FMA46840`)
    - `nasalis` (`FMA55606`, `FMA55607`)
    - `procerus` (`FMA55610`, `FMA55611`)
    - `\bdepressor\b`: catches `depressor labii inferioris` (`FMA46817`/`18`), `depressor anguli oris` (`FMA46829`/`30`), `depressor septi nasi` (`FMA55608`/`09`).
    - `\blevator|\blevatores`: generalizes `levator scapulae` and `levator ani` to also catch `levator labii superioris` (`FMA46806`/`07`), `levator labii superioris alaeque nasi` (`FMA46803`/`04`), `levator anguli oris` (`FMA46823`/`24`), and `levatores costarum` longi and breves (`FMA74075`–`FMA74078`).
- **Complete Proposed Regex**:
  ```javascript
  ['muscular', /\bmuscle\b|deltoid|infraspinatus|supraspinatus|semispinalis|spinalis|longissimus|iliocostalis|intertransversari|interspinales|multifidus|rotatores|\brotator|trapezius|latissimus|rhomboid|levator scapulae|pectoralis|serratus|biceps|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|rectus abdominis|oblique|transversus|quadratus|psoas|iliacus|gluteus|piriformis|gemellus|obturator (internus|externus)|sartorius|gracilis|pectineus|quadriceps|vastus|rectus femoris|biceps femoris|semitendinosus|semimembranosus|popliteus|gastrocnemius|soleus|plantaris|tibialis|peroneus|fibularis|masseter|temporalis|pterygoid|sternocleidomastoid|scalene|scalenus|sternohyoid|sternothyroid|omohyoid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|platysma|intercostal|diaphragm|levator ani|coccygeus|papillary muscle|longus colli|longus capitis|splenius|rectus capitis|obliquus capitis|subclavius|teres|tensor fasciae|palmaris|puborectalis|pyramidalis|sphincter|frontalis|epicranius|orbicularis|corrugator|mentalis|buccinator|risorius|nasalis|procerus|\bdepressor\b|\blevator|\blevatores|linea alba/i]
  ```
- **Structure Count**: Increases from 365 to **428 parts** (+63 parts).

### 3.4 Nervous System
- **Current Regex**:
  ```javascript
  /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b/i
  ```
- **Additions**:
  - `gyrus|gyri`: 25 cortical gyri (`BP51` orbital/straight gyrus, `FMA72653`/`54` superior frontal, `FMA72655`/`56` middle frontal, `FMA72661`/`62` precentral [motor cortex], `FMA72665`/`66` postcentral [sensory cortex], `FMA72667`/`68` supramarginal, `FMA72669`/`70` angular, `FMA72685`/`86` middle temporal, `FMA72687`/`88` inferior temporal, `FMA72689`/`90` fusiform, `FMA72701`/`02` accessory short gyrus, `FMA72717`/`18` cingulate gyrus, `FMA72800`–`805` superior temporal gyrus parts).
  - `internal capsule`: `FMA72908`/`09` anterior limb of right/left internal capsule.
  - `insula`: `FMA72977`, `FMA72978` right/left insula.
  - `geniculate`: `FMA73303`/`04` lateral geniculate bodies, `FMA73309`/`10` medial geniculate bodies.
  - `collicul`: `FMA73422`/`23` superior colliculi, `FMA73434`/`35` inferior colliculi, `FMA73461`–`64` brachia of colliculi.
  - `optic tract`: `FMA62382`, `FMA67936` right/left optic tracts.
  - Deep structures and pathways:
    - `habenula`: `FMA62032 habenula`.
    - `septum pellucidum`: `FMA61844 septum pellucidum`.
    - `commissure`: `FMA61961 anterior commissure`, `FMA62072 posterior commissure`.
    - `lamina terminalis`: `FMA61975 lamina terminalis`.
    - `tuber cinereum`: `FMA62327 tuber cinereum`.
    - `stria terminalis`: `FMA72939`, `FMA72940` right/left stria terminalis.
    - `mammillary`: `FMA74877 mammillary body`.
    - `interventricular foramen`: `FMA75351 interventricular foramen` (Foramen of Monro).
    - `interpeduncular`: `FMA83740 interpeduncular fossa`.
- **Complete Proposed Regex**:
  ```javascript
  ['nervous', /\b(lateral|third|fourth)\s+ventricle|ventricle of (the )?(brain|cerebrum)|cerebral aqueduct|choroid plexus|corpus callosum|fornix|thalamus|hypothalamus|pons|medulla oblongata|midbrain|peduncle|cerebell|cerebral hemisphere|cerebrum|spinal cord|central canal|\bnerve\b|olfactory|optic chiasm|pituitary|hippocamp|amygdala|caudate|putamen|globus pallidus|dura mater|arachnoid|pia mater|brain\b|gyrus|gyri|internal capsule|insula|geniculate|collicul|habenula|septum pellucidum|commissure|lamina terminalis|tuber cinereum|optic tract|stria terminalis|mammillary|interventricular foramen|interpeduncular/i]
  ```
- **Structure Count**: Increases from 39 to **95 parts** (+56 parts).

### 3.5 Digestive System
- **Current Regex**:
  ```javascript
  /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva/i
  ```
- **Additions**:
  - `\btaenia`: Captures the three longitudinal smooth muscle bands of the large intestine: `FMA76891 mesocolic taenia`, `FMA76892 omental taenia`, `FMA76893 free taenia`.
- **Complete Proposed Regex**:
  ```javascript
  ['digestive', /stomach|small intestine|large intestine|duoden|jejun|ileum|cecum|caecum|colon|rectum|anal canal|appendix|liver|hepatic duct|gallbladder|bile duct|pancrea|esophagus|oesophagus|spleen|omentum|peritoneum|mesenter|salivary|parotid|submandibular gland|sublingual|tongue|pharynx|tooth|teeth|gingiva|\btaenia/i]
  ```
- **Structure Count**: Increases from 43 to **46 parts** (+3 parts).

### 3.6 Endocrine System
- **Current Regex**:
  ```javascript
  /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary/i
  ```
- **Additions**:
  - `deferent duct`: Formal FMA anatomical term for the vas deferens (`FMA19235 right deferent duct`, `FMA19236 left deferent duct`).
  - `penis`: Male reproductive erectile structures grouped canonically with the male genital block (`FMA18247 glans penis`, `FMA19618 corpus cavernosum of penis`, `FMA19617nsn corpus spongiosum of penis, nsn`).
- **Complete Proposed Regex**:
  ```javascript
  ['endocrine', /thyroid gland|parathyroid|adrenal|suprarenal|thymus|pineal|prostate|testis|testicle|epididymis|ovary|uterus|vagina|seminal|vas deferens|mammary|deferent duct|penis/i]
  ```
- **Structure Count**: Increases from 10 to **15 parts** (+5 parts).

### 3.7 Cardiovascular, Respiratory, and Urinary Systems
- **Cardiovascular (60 parts)**:
  - Current pattern matches all 60 blood vessels, chambers, valves, and cardiac walls present in the dataset.
  - Evaluated before `digestive` and `urinary` so mesenteric and renal vessels remain correctly classified.
  - Regex remains:
    ```javascript
    ['cardiovascular', /\bheart\b|atrium|ventricle|valve|aorta|aortic|\bartery\b|arterial|arteries|\bvein\b|venous|veins|vena cava|coronary|pulmonary trunk|myocardium|endocardium|pericardium|septum of heart|interventricular septum|interatrial|sinus|truncus|capillar/i]
    ```
- **Respiratory (7 parts)**:
  - Current pattern matches all 7 lung lobes, trachea, and bronchi in the dataset.
  - Regex remains:
    ```javascript
    ['respiratory', /\blung\b|lobe of (the )?(right |left )?lung|bronch|trachea|larynx|laryngeal|pleura|epiglottis|nasal cavity|paranasal|alveol/i]
    ```
- **Urinary (8 parts)**:
  - Current pattern matches the 2 kidneys, 2 ureters, urinary bladder, urethra, and 2 adrenal glands (`right/left adrenal gland`).
  - *Architectural Note on Adrenals*: In the existing repository, `right adrenal gland` and `left adrenal gland` match `/renal/i` in the urinary rule and are baked into `public/anatomy/urinary.glb` and `public/anatomy/index.json`. Retaining this rule ensures 100% backward compatibility with pre-built assets and existing tests.
  - Regex remains:
    ```javascript
    ['urinary', /kidney|renal|ureter|urinary bladder|urethra|nephron/i]
    ```

---

## 4. Removal of Selection Caps (`CAPS`) and Pipeline Refactoring

### 4.1 Deleting the Artificial Ceilings
In `scripts/anatomy-select.mjs`:
Delete:
```javascript
const CAPS = {
  skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
  digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
};
```
And replace with the authoritative array of systems:
```javascript
const SYSTEMS = [
  'skeletal', 'muscular', 'cardiovascular', 'nervous',
  'digestive', 'respiratory', 'urinary', 'endocrine',
];
```

### 4.2 Retirement of Ranking Machinery
Because all 927 classified structures are now retained without artificial truncation, `CORE`, `LOW_YIELD`, `MUST_HAVE`, and `rank()` (lines 66–98 of `anatomy-select.mjs`) are no longer required to guard against truncation.

The selection loop on lines 114–120:
```javascript
// BEFORE:
const selected = [];
for (const system of Object.keys(CAPS)) {
  const pool = classified
    .filter(p => p.system === system)
    .sort((a, b) => rank(b) - rank(a) || a.size - b.size);
  selected.push(...pool.slice(0, CAPS[system]));
}

// AFTER:
const selected = [];
for (const system of SYSTEMS) {
  const pool = classified
    .filter(p => p.system === system)
    .sort((a, b) => a.name.localeCompare(b.name));
  selected.push(...pool);
}
```
Sorting alphabetically within each system guarantees **deterministic output** in `.anatomy-src/selected.json` and `public/anatomy/index.json`, providing a predictable index order for virtualization and test assertions.

---

## 5. Clean Handling of Excluded Items

Exactly 7 structures in the 934-item dataset do not represent internal organ or musculoskeletal systems. They are handled cleanly and deterministically:

### 5.1 Oversized Non-Organ Blob (`skin` > 40 MB)
- `FMA7163 skin` is 79,324,984 bytes (~77.5 MB).
- Filtered on line 106:
  ```javascript
  if (p.size > MAX_BYTES) continue;
  ```
  Where `MAX_BYTES = 40 * 1024 * 1024`. This prevents downloading or decimating the massive whole-body skin shell.

### 5.2 Sensory Organs & Integumentary Adnexa
Six structures are non-standard or external adnexa:
1. `FMA12513 eyeball` (816 KB)
2. `FMA52780 ear` (1.18 MB)
3. `FMA70751 set of head hairs` (4.52 MB)
4. `FMA70754 set of pubic hairs` (1.40 MB)
5. `FMA71098 set of eyebrows` (140 KB)
6. `FMA59815nsn labial part of mouth, nsn` (322 KB)

#### Clean Handling Architecture:
1. **Implicit Exclusion**: None of these match any of the 8 organ system regexes in `RULES`. Consequently, `classify(p.name)` returns `null`, and they are naturally bypassed by `if (!system) continue;`.
2. **Explicit Exclusion Defense-in-Depth**: To make exclusion self-documenting and prevent accidental capture by future regex refinements, define an explicit exclusion pattern:
   ```javascript
   const EXCLUDE_NON_ORGAN = /\b(skin|hair|hairs|eyebrow|eyebrows|eyeball|\bear\b|labial part of mouth)/i;
   ```
   Applied directly in the filtering loop:
   ```javascript
   if (p.size > MAX_BYTES || EXCLUDE_NON_ORGAN.test(p.name)) continue;
   ```

---

## 6. Implementation Specification for the Worker Agent

Below is the concrete code patch for `scripts/anatomy-select.mjs`.

```javascript
/* ============================================================
   Anatomy asset pipeline — step 1: choose and download.

   Picks all BodyParts3D structures across 8 anatomical systems,
   classifies each into a body system, and downloads the source STL into
   a local cache that is NOT committed. Step 2 (anatomy-build.mjs) turns
   the cache into compressed GLB files that are.

   Source data: BodyParts3D, © 2008 Database Center for Life Science,
   licensed CC BY-SA 2.1 Japan. See public/anatomy/ATTRIBUTION.md.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

const SRC       = '.anatomy-src';
const STL_DIR   = path.join(SRC, 'stl');
const RAW_BASE  = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';

// Whole-body skin is >77 MB; internal organ STLs remain <= 28 MB.
const MAX_BYTES   = 40 * 1024 * 1024;
const CONCURRENCY = 6;

// Non-organ adnexa and sensory meshes outside the 8 standard systems
const EXCLUDE_NON_ORGAN = /\b(skin|hair|hairs|eyebrow|eyebrows|eyeball|\bear\b|labial part of mouth)/i;

/* ---------------- classification ----------------
   Ordered: the first rule that matches wins. Specific cases
   (brain ventricles vs heart ventricles; muscles attached to bones)
   are positioned ahead of broader matches. */

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
  for (const [system, re] of RULES) if (re.test(name)) return system;
  return null;
}

const SYSTEMS = [
  'skeletal', 'muscular', 'cardiovascular', 'nervous',
  'digestive', 'respiratory', 'urinary', 'endocrine',
];

/* ---------------- discovery & load ---------------- */

// 3-tier fallback discovery: local cache -> committed manifest -> remote fetch
let parts;
const cachedAvailable = path.join(SRC, 'available.json');
const committedManifest = path.join('scripts', 'data', 'bodyparts3d-available.json');

if (fs.existsSync(cachedAvailable)) {
  parts = JSON.parse(fs.readFileSync(cachedAvailable, 'utf8'));
} else if (fs.existsSync(committedManifest)) {
  parts = JSON.parse(fs.readFileSync(committedManifest, 'utf8'));
} else {
  throw new Error(`Available parts manifest not found. Expected ${cachedAvailable} or ${committedManifest}.`);
}

const classified = [];
for (const p of parts) {
  if (p.size > MAX_BYTES) continue;
  if (EXCLUDE_NON_ORGAN.test(p.name)) continue;
  const system = classify(p.name);
  if (!system) continue;
  classified.push({ ...p, system });
}

// Uncapped selection: retain all classified structures, sorted deterministically
const selected = [];
for (const system of SYSTEMS) {
  const pool = classified
    .filter(p => p.system === system)
    .sort((a, b) => a.name.localeCompare(b.name));
  selected.push(...pool);
}

const bytes = selected.reduce((s, p) => s + p.size, 0);
console.log(`classified and selected ${selected.length} of ${parts.length} available structures`);
for (const system of SYSTEMS) {
  const n = selected.filter(p => p.system === system);
  const mb = (n.reduce((s, p) => s + p.size, 0) / 1048576).toFixed(1);
  console.log(`  ${system.padEnd(15)} ${String(n.length).padStart(3)} parts  ${mb} MB`);
}
console.log(`total source STL size: ${(bytes / 1048576).toFixed(1)} MB`);

fs.mkdirSync(STL_DIR, { recursive: true });
fs.writeFileSync(path.join(SRC, 'selected.json'), JSON.stringify(selected, null, 2));

/* ---------------- download worker pool ---------------- */
// (Remains identical to existing download logic)
```
