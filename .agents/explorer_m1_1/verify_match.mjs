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

let matched = 0, missing = 0;
const missingList = [];
for (const item of treeData.tree) {
  const id = item.path.replace(/\.stl$/i, '');
  if (nameMap.has(id)) {
    matched++;
  } else {
    missing++;
    missingList.push(id);
  }
}
console.log('Total tree items:', treeData.tree.length, 'Matched:', matched, 'Missing:', missing);
if (missingList.length > 0) {
  console.log('Missing sample:', missingList.slice(0, 10));
}
