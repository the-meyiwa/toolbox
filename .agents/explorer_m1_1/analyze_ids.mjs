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

const idTypes = new Map();
const bpItems = [];
const fmaItems = [];
const otherItems = [];

for (const item of treeData.tree) {
  const id = item.path.replace(/\.stl$/i, '');
  if (id.startsWith('FMA')) {
    fmaItems.push({ id, name: nameMap.get(id), size: item.size });
  } else if (id.startsWith('BP')) {
    bpItems.push({ id, name: nameMap.get(id), size: item.size });
  } else {
    otherItems.push({ id, name: nameMap.get(id), size: item.size });
  }
}

console.log(`Total: ${treeData.tree.length}`);
console.log(`FMA items: ${fmaItems.length}`);
console.log(`BP items: ${bpItems.length}`);
console.log(`Other items: ${otherItems.length}`);
console.log('Sample BP items:', bpItems.slice(0, 5));
