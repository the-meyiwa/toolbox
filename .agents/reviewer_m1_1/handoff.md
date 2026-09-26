# Handoff Report: Review & Adversarial Challenge of Milestone M1 (Dataset Extraction & Manifest)

**Agent**: Reviewer M1-1 (`teamwork_preview_reviewer`)  
**Roles**: reviewer, critic  
**Target Milestone**: M1 (Dataset Extraction & Manifest)  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\reviewer_m1_1`  
**Date**: 2026-09-24  
**Handoff Type**: Hard (Review Complete)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Integrity Check & Anti-Cheating Assessment
- **Hardcoded test results / expected outputs**: None found. `scripts/anatomy-select.mjs` dynamically parses the input manifest, groups parts by system, computes GLB sizes, collates names, and validates catalog constraints.
- **Dummy or facade implementations**: None found. The 3-tier fallback, schema generator, and sorting logic are genuine implementations.
- **Shortcuts / task bypasses**: None found. All 934 parts from the upstream BodyParts3D dataset were preserved in the committed manifest, and 927 structures were processed without truncation.
- **Fabricated verification outputs**: None found. All test runs and command results cited in Worker M1's handoff match actual reproduction results.
- **Self-certifying work**: The E2E test suite was developed independently by `test_writer_e2e` prior to Worker M1's modifications and was not tampered with.

### 1.2 Test Execution Results
All test commands specified in the dispatch were executed directly:
1. `node scripts/anatomy-select.mjs`:
   ```
   [Discovery] Loaded 934 parts from local cache (.anatomy-src\available.json)
   [Selection] Classified 927 of 934 available parts.

   [Catalog] Generated 927 structures across 8 systems:
     skeletal        268 parts  157.9 MB
     muscular        428 parts  833.6 MB
     nervous          95 parts  93.8 MB
     cardiovascular   60 parts  35.3 MB
     respiratory       7 parts  15.9 MB
     digestive        46 parts  26.7 MB
     urinary           8 parts  3.2 MB
     endocrine        15 parts  4.8 MB
   total source STL: 1171.3 MB
   [Catalog] Saved -> .anatomy-src\selected.json
   [Catalog] Saved -> public\anatomy\index.json (Version 2)
   ```
   Exit code: 0, execution time: 380 ms.

2. `node --test tests/unit/assistant-anatomy.test.js`:
   ```
   ✔ resolveAnatomyQuery: resolves Pectoralis Major & Trapezius Muscle multi-part query (6.0559ms)
   ✔ resolveAnatomyQuery: resolves "biggest bone in human body and digestive system" (1.8172ms)
   ✔ resolveAnatomyQuery: resolves "lungs" query (0.4143ms)
   ✔ resolveAnatomyQuery: resolves "heart and brain" (0.4979ms)
   ✔ Assistant Tool explore_anatomy: executes query and returns structured anatomy-3d payload (47.1562ms)
   ✔ Assistant Result Renderer: selects anatomy-3d renderer for anatomy payloads (1.4061ms)
   ✔ Anatomy3DResultRenderer: renders preview card with clinical notes section (1.2946ms)
   ✔ FileSavedResultRenderer: renders simplified, clutter-free single-row card (0.6262ms)
   ℹ tests 8, pass 8, fail 0
   ```
   Exit code: 0.

3. `node --test tests/e2e/anatomy-explorer/*.test.js`:
   ```
   ℹ tests 82, pass 82, fail 0, duration_ms 345.1103
   ```
   Exit code: 0.

### 1.3 3-Tier Fallback Stress Testing
Direct stress-testing of `loadAvailableParts()` in `scripts/anatomy-select.mjs`:
1. **Cache missing**: Deleting `.anatomy-src/available.json` and running the script loaded 934 parts from `scripts/data/bodyparts3d-available.json` (Tier 2) and correctly re-seeded `.anatomy-src/available.json`.
2. **Cache corrupted JSON**: Writing invalid JSON to `.anatomy-src/available.json` produced a warning log (`[Discovery] Warning: Failed to parse...`) and seamlessly fell back to Tier 2.
3. **Empty array cache**: Writing `[]` to `.anatomy-src/available.json` triggered the fallback to Tier 2 without throwing an error.

### 1.4 Dataset Selection & CAPS Verification
- Inspected `scripts/anatomy-select.mjs`:
  - `CAPS`, `CORE`, `LOW_YIELD`, `MUST_HAVE`, and `rank()` have been completely removed.
  - No `.slice()` or artificial bounding exists on the structure pool.
- Exclusions:
  - 1 whole-body skin blob excluded by `MAX_BYTES` (40 MB limit): `FMA7163` (`skin`, 79,324,984 bytes).
  - 6 non-organ adnexa excluded by `EXCLUDE_NON_ORGAN`: `FMA12513` (`eyeball`), `FMA52780` (`ear`), `FMA59815nsn` (`labial part of mouth, nsn`), `FMA70751` (`set of head hairs`), `FMA70754` (`set of pubic hairs`), `FMA71098` (`set of eyebrows`).
  - Total remaining parts: exactly 927.

### 1.5 Adversarial Classification & Regex Audit
A comprehensive cross-examination of all 934 manifest parts against all 8 system rules in `scripts/anatomy-select.mjs` lines 104–120 identified **12 critical misclassifications and regex collisions**:

1. **Brain / Nervous System Structures Misclassified as Skeletal Bones**:
   - `BP49` ("left superior parietal lobule precuneus") -> classified as `skeletal`.
   - `BP50` ("right superior parietal lobule precuneus") -> classified as `skeletal`.
   - `FMA72975` ("right occipital lobe") -> classified as `skeletal`.
   - `FMA72976` ("left occipital lobe") -> classified as `skeletal`.
   *Root Cause*: In `RULES`, the `skeletal` regex (line 109) contains broad tokens `|occipital|` and `|parietal|` intended for skull bones (`occipital bone`, `parietal bone`), but lacks the `bone` qualifier. Concurrently, the `nervous` regex (line 105) lacks patterns for `precuneus`, `lobule`, or `lobe`. Because nervous fails to match, these cerebral cortex structures fall through to skeletal and match `occipital` and `parietal`.

2. **Muscular Structures Misclassified as Skeletal Bones**:
   - `FMA13414` ("right subscapularis") -> classified as `skeletal`.
   - `FMA13415` ("left subscapularis") -> classified as `skeletal`.
   - `FMA46761` ("right occipitalis") -> classified as `skeletal`.
   - `FMA46762` ("left occipitalis") -> classified as `skeletal`.
   - `FMA46763` ("right temporoparietalis") -> classified as `skeletal`.
   - `FMA46764` ("left temporoparietalis") -> classified as `skeletal`.
   *Root Cause*:
   - The subscapularis (one of the four primary rotator cuff muscles) was omitted from the `muscular` regex (line 107). It falls through to `skeletal` (line 109) and matches `scapula` because "subscapularis" contains "scapula".
   - `occipitalis` and `temporoparietalis` (cranial/scalp muscles) were omitted from `muscular` and match unconstrained `occipital` and `parietal` in `skeletal`.

3. **Endocrine Glands Misclassified as Urinary Organs**:
   - `FMA15629` ("right adrenal gland") -> classified as `urinary`.
   - `FMA15630` ("left adrenal gland") -> classified as `urinary`.
   *Root Cause*: In `RULES`, the `urinary` regex (line 117) uses `/...|renal|.../i` without word boundaries (`\brenal\b`). The substring "renal" matches "ad**renal**". Because the `urinary` rule precedes the `endocrine` rule (line 119), the adrenal glands match `urinary` and never reach `endocrine`, even though line 119 explicitly lists `adrenal`.

---

## 2. Logic Chain

1. **Premise**: In Milestone M1, `scripts/anatomy-select.mjs` generates `.anatomy-src/selected.json` (the system-keyed structure assignment for Milestone M2's 3D mesh decimation and GLB assembly) and `public/anatomy/index.json` (the runtime catalog for Milestone M3's viewer).
2. **Impact on Downstream Milestone M2**:
   - In M2, `scripts/anatomy-build.mjs` iterates over each system in `.anatomy-src/selected.json`, parses the corresponding STLs, combines them, decimates them, and outputs `{system}.glb`.
   - Under current classification:
     - `public/anatomy/skeletal.glb` will physically contain the 3D meshes for the **occipital lobes of the brain**, the **precuneus/superior parietal lobules of the brain**, the **subscapularis rotator cuff muscles**, and the **occipitalis/temporoparietalis scalp muscles**.
     - `public/anatomy/nervous.glb` will have an incomplete cerebral cortex missing both occipital lobes and the precuneus.
     - `public/anatomy/muscular.glb` will be missing the subscapularis rotator cuff muscles.
     - `public/anatomy/urinary.glb` will contain the adrenal glands while `public/anatomy/endocrine.glb` will lack them.
3. **Impact on User Experience (R3 & Acceptance Criteria)**:
   - When a user views the Skeletal System in the 3D viewer, they will see brain lobes and shoulder muscles rendered as bones.
   - When querying or isolating the Nervous or Muscular systems, core anatomical structures will not be visible in their proper system.
4. **Feasibility of Correction**:
   - The correction requires no architectural overhaul: only tightening/expanding the regex rules in `scripts/anatomy-select.mjs`.
   - A simulated test of the tightened regexes confirmed that all 927 structures remain 100% classified with 0 unclassified parts:
     - Skeletal: 258 parts (-10 false positives)
     - Muscular: 434 parts (+6 corrected muscles)
     - Nervous: 99 parts (+4 corrected brain structures)
     - Cardiovascular: 60 parts (unchanged)
     - Respiratory: 7 parts (unchanged)
     - Digestive: 46 parts (unchanged)
     - Urinary: 6 parts (-2 adrenal glands)
     - Endocrine: 17 parts (+2 adrenal glands)
   - All 8 unit tests and 82 E2E tests will continue to pass.

---

## 3. Caveats

1. **Historical Baseline Behavior**:
   Investigation of git history revealed that in the pre-M1 baseline, `adrenal gland` was already classified under `urinary` due to the same regex overlap, and the pre-existing placeholder `urinary.glb` on disk contains the adrenal meshes. Reclassifying adrenal to `endocrine` will require M2 to package adrenal into `endocrine.glb` when all GLBs are re-built.
2. **Tendons Classification**:
   Calcaneal and intermediate tendons (`FMA258847`, `FMA258850`, etc.) match `skeletal` because `tendon` is explicitly in the skeletal rule. This is consistent with standard orthopedic modeling conventions in BodyParts3D and is acceptable.
3. **Reviewer Boundary**:
   Per the review constraint (`🔒 Key Constraints: Review-only — do NOT modify implementation code`), this reviewer did not edit `scripts/anatomy-select.mjs` directly. The required changes must be executed by Worker M1.

---

## 4. Conclusion & Actionable Verdict

### **Verdict: REQUEST_CHANGES**

Worker M1 successfully implemented the authoritative manifest (`scripts/data/bodyparts3d-available.json`), the 3-tier discovery fallback, uncapped structure processing, and Schema Version 2 catalog generation. All automated test suites pass.

However, changes are requested due to **12 anatomical misclassifications / false positives** in `scripts/anatomy-select.mjs` that directly affect the integrity of downstream 3D assets:

### Action Items for Worker M1:
1. **Update `RULES` in `scripts/anatomy-select.mjs`**:
   - **Muscular regex** (line 107): Add `subscapularis`, `occipitalis`, and `temporoparietalis`.
   - **Nervous regex** (line 105): Add `precuneus`, `cuneus`, `lobule`, and `occipital lobe|frontal lobe|temporal lobe|parietal lobe`.
   - **Skeletal regex** (line 109): Change unconstrained `|occipital|` to `|occipital bone|` (or `occipital(?!\s*lobe|is)`), and `|parietal|` to `|parietal bone|` (or `parietal(?!\s*lobe|\s*lobule|is)`).
   - **Urinary regex** (line 117): Replace loose `renal` with word-bounded `\brenal\b` so it does not match "adrenal".
2. **Re-run the pipeline**:
   - Execute `node scripts/anatomy-select.mjs` to regenerate `.anatomy-src/selected.json` and `public/anatomy/index.json`.
3. **Verify Reconciliation**:
   - Verify that all 927 structures are classified across the 8 systems (target counts: skeletal: 258, muscular: 434, nervous: 99, cardiovascular: 60, respiratory: 7, digestive: 46, urinary: 6, endocrine: 17).
   - Verify that `node --test tests/unit/assistant-anatomy.test.js` and `node --test tests/e2e/anatomy-explorer/*.test.js` continue to pass 100%.

---

## 5. Verification Method

To verify the required fixes:

1. **Verify Correct Classification of Landmarks & Problematic Structures**:
   ```bash
   node -e "
   import('./scripts/anatomy-select.mjs').then(({ classify }) => {
     const assert = require('assert');
     assert.equal(classify('right subscapularis'), 'muscular');
     assert.equal(classify('right occipital lobe'), 'nervous');
     assert.equal(classify('left superior parietal lobule precuneus'), 'nervous');
     assert.equal(classify('right occipitalis'), 'muscular');
     assert.equal(classify('right temporoparietalis'), 'muscular');
     assert.equal(classify('right adrenal gland'), 'endocrine');
     console.log('Classification accuracy tests PASSED.');
   });
   "
   ```

2. **Run Pipeline Generation**:
   ```bash
   node scripts/anatomy-select.mjs
   ```
   *Expected*: Exactly 927 parts classified across all 8 systems; exit code 0.

3. **Verify Catalog Integrity & Counts**:
   ```bash
   node -e "
   const fs = require('fs');
   const idx = JSON.parse(fs.readFileSync('public/anatomy/index.json', 'utf8'));
   assert.equal(idx.structures.length, 927);
   assert.equal(idx.systems.skeletal.count, 258);
   assert.equal(idx.systems.muscular.count, 434);
   assert.equal(idx.systems.nervous.count, 99);
   assert.equal(idx.systems.endocrine.count, 17);
   assert.equal(idx.systems.urinary.count, 6);
   console.log('Catalog counts verified.');
   "
   ```

4. **Run Unit & E2E Tests**:
   ```bash
   node --test tests/unit/assistant-anatomy.test.js
   node --test tests/e2e/anatomy-explorer/*.test.js
   ```
   *Expected*: 8/8 unit tests pass, 82/82 E2E tests pass.
