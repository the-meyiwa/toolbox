import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../js/lib/devices/data');
const imgDir = path.join(__dirname, '../public/images/devices');

async function searchDDG(query) {
  try {
    const res = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
    const text = await res.text();
    const vqdMatch = text.match(/vqd=([0-9-]+)/) || text.match(/vqd="([0-9-]+)"/);
    if (!vqdMatch) return null;
    const vqd = vqdMatch[1];
    const imgRes = await fetch('https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent(query) + '&vqd=' + vqd + '&f=,,,&p=1', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
    const data = await imgRes.json();
    return data.results && data.results.length > 0 ? data.results[0].image : null;
  } catch (e) { return null; }
}

async function fetchImage(brand, name, id) {
  const q = brand + ' ' + name + ' phone white background';
  const imgUrl = await searchDDG(q);
  if (imgUrl) {
    try {
      const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
      if (!imgRes.ok) return false;
      const buffer = await imgRes.arrayBuffer();
      fs.writeFileSync(path.join(imgDir, id + '.jpg'), Buffer.from(buffer));
      console.log('Saved:', name);
      return true;
    } catch (e) { console.log('Failed to download:', imgUrl); }
  }
  console.log('Not found:', name);
  return false;
}

async function main() {
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
    const regex = /\{[^}]*id:\s*'([^']+)'[^}]*name:\s*'([^']+)'[^}]*brand:\s*'([^']+)'/g;
    let match;
    let count = 0;
    while ((match = regex.exec(content)) !== null) {
      const [, id, name, brand] = match;
      if (!fs.existsSync(path.join(imgDir, id + '.jpg'))) {
        await fetchImage(brand, name, id);
        await new Promise(r => setTimeout(r, 1500));
      }
      count++;
      // no limit
    }
  }
}
main();
