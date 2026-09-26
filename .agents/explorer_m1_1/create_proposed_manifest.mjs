import fs from 'node:fs';
import path from 'node:path';

// Load from step 50 and step 78 cached tree & parts list
const step50 = fs.readFileSync('C:/Users/meyig/.gemini/antigravity/brain/f0e068f8-0dac-44ce-a46a-ba15a198b54a/.system_generated/steps/50/content.md', 'utf8');
const treeData = JSON.parse(step50.slice(step50.indexOf('\n---\n') + 5).trim());

const step78 = fs.readFileSync('C:/Users/meyig/.gemini/antigravity/brain/f0e068f8-0dac-44ce-a46a-ba15a198b54a/.system_generated/steps/78/content.md', 'utf8');
const pObj = JSON.parse(step78.slice(step78.indexOf('\n---\n') + 5).trim());
const pText = Buffer.from(pObj.content, 'base64').toString('utf8');

const nameMap = new Map();
for (const line of pText.split('\n')) {
  const parts = line.split('\t');
  if (parts.length >= 2) {
    const id = parts[0].replace(/"/g, '').trim();
    const name = parts[1].replace(/"/g, '').trim();
    if (id && name) nameMap.set(id, name);
  }
}

const manifest = [];
for (const item of treeData.tree) {
  const filename = path.basename(item.path);
  const id = filename.replace(/\.stl$/i, '');
  const name = nameMap.get(id);
  if (!name) throw new Error(`Missing name for ${id}`);

  manifest.push({
    id,
    name,
    file: filename,
    bytes: item.size,
    size: item.size,
    sha: item.sha,
    concept: id,
    conceptId: id,
    fma: id.startsWith('FMA') ? id.slice(3) : null
  });
}

// Sort deterministically by id
manifest.sort((a, b) => a.id.localeCompare(b.id));

const outPath = path.join('.agents', 'explorer_m1_1', 'proposed_bodyparts3d-available.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

console.log(`Saved ${manifest.length} items to ${outPath}`);
const stat = fs.statSync(outPath);
console.log(`File size: ${(stat.size / 1024).toFixed(1)} KB`);
