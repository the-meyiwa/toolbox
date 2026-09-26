import fs from 'node:fs';

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
    nameMap.set(id, name);
  }
}

const manifest = [];
for (const item of treeData.tree) {
  const id = item.path.replace(/\.stl$/i, '');
  const name = nameMap.get(id);
  if (!name) {
    throw new Error(`Missing name for ${id}`);
  }
  const fma = id.startsWith('FMA') ? id.replace(/^FMA/i, '').replace(/nsn$/i, '') : null;
  manifest.push({
    id,
    name,
    file: item.path,
    bytes: item.size,
    size: item.size,
    sha: item.sha,
    concept: id,
    conceptId: id,
    fma: id.startsWith('FMA') ? id.slice(3) : null
  });
}

// Sort manifest deterministically by id
manifest.sort((a, b) => a.id.localeCompare(b.id));

console.log(`Generated manifest with ${manifest.length} items`);
console.log('Total bytes:', manifest.reduce((sum, item) => sum + item.bytes, 0));
console.log('Sample item 0:', manifest[0]);
console.log('Sample item 500:', manifest[500]);
console.log('Sample item 933:', manifest[933]);

// Validate all required fields
for (const item of manifest) {
  if (!item.id || !item.name || !item.file || typeof item.bytes !== 'number' || !item.sha || !item.concept) {
    throw new Error(`Invalid item: ${JSON.stringify(item)}`);
  }
}
console.log('All 934 items validated successfully!');
