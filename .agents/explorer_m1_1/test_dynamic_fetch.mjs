import fs from 'node:fs';
import path from 'node:path';

async function fetchPartsFromGitHub() {
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
      throw new Error(`GitHub API rate limit exceeded while querying trees. Please set GITHUB_TOKEN environment variable or provide scripts/data/bodyparts3d-available.json.`);
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
      if (!name) {
        console.warn(`Warning: No English name found in parts_list_e.txt for STL: ${id}`);
      }
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

async function run() {
  console.log('Testing fetchPartsFromGitHub()...');
  const manifest = await fetchPartsFromGitHub();
  console.log(`Success! Fetched ${manifest.length} items`);
  console.log('First:', manifest[0]);
  console.log('Last:', manifest[manifest.length - 1]);
}

run().catch(err => console.error(err));
