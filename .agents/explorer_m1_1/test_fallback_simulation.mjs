import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpDir = path.join(os.tmpdir(), 'toolbox-anatomy-discovery-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const SRC = path.join(tmpDir, '.anatomy-src');
const COMMITTED_MANIFEST = path.join(tmpDir, 'scripts', 'data', 'bodyparts3d-available.json');

async function fetchPartsFromGitHub() {
  const headers = {
    'User-Agent': 'Toolbox-Anatomy-Pipeline',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const rawPartsListUrl = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/parts_list_e.txt';
  const nameRes = await fetch(rawPartsListUrl);
  if (!nameRes.ok) throw new Error(`HTTP ${nameRes.status}`);
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

  const treeUrl = 'https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1';
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) throw new Error(`HTTP ${treeRes.status}`);
  const treeJson = await treeRes.json();

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
  manifest.sort((a, b) => a.id.localeCompare(b.id));
  return manifest;
}

async function loadAvailableParts() {
  const localCachePath = path.join(SRC, 'available.json');

  // Tier 1
  if (fs.existsSync(localCachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(localCachePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Tier 1] Loaded ${data.length} parts from local cache`);
        return { tier: 1, data };
      }
    } catch (e) {}
  }

  // Tier 2
  if (fs.existsSync(COMMITTED_MANIFEST)) {
    try {
      const data = JSON.parse(fs.readFileSync(COMMITTED_MANIFEST, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[Tier 2] Loaded ${data.length} parts from committed manifest`);
        fs.mkdirSync(SRC, { recursive: true });
        fs.writeFileSync(localCachePath, JSON.stringify(data, null, 2));
        return { tier: 2, data };
      }
    } catch (e) {}
  }

  // Tier 3
  console.log('[Tier 3] Fetching from GitHub...');
  const data = await fetchPartsFromGitHub();
  fs.mkdirSync(SRC, { recursive: true });
  fs.writeFileSync(localCachePath, JSON.stringify(data, null, 2));
  fs.mkdirSync(path.dirname(COMMITTED_MANIFEST), { recursive: true });
  fs.writeFileSync(COMMITTED_MANIFEST, JSON.stringify(data, null, 2));
  return { tier: 3, data };
}

async function testAll() {
  console.log('--- Test 1: Neither exists (should trigger Tier 3) ---');
  const res3 = await loadAvailableParts();
  if (res3.tier !== 3 || res3.data.length !== 934) throw new Error('Tier 3 failed');
  console.log('Tier 3 verified. Output files created:', fs.existsSync(COMMITTED_MANIFEST), fs.existsSync(path.join(SRC, 'available.json')));

  console.log('--- Test 2: Local cache exists (should trigger Tier 1) ---');
  const res1 = await loadAvailableParts();
  if (res1.tier !== 1 || res1.data.length !== 934) throw new Error('Tier 1 failed');
  console.log('Tier 1 verified.');

  console.log('--- Test 3: Local cache deleted, committed exists (should trigger Tier 2) ---');
  fs.rmSync(path.join(SRC, 'available.json'));
  const res2 = await loadAvailableParts();
  if (res2.tier !== 2 || res2.data.length !== 934) throw new Error('Tier 2 failed');
  console.log('Tier 2 verified. Local cache re-created:', fs.existsSync(path.join(SRC, 'available.json')));

  // Cleanup tmp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('All tests passed successfully!');
}

testAll().catch(err => {
  console.error(err);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
