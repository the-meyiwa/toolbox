import fs from 'fs';

async function searchDDG(query) {
  const res = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query));
  const text = await res.text();
  const vqdMatch = text.match(/vqd=([0-9-]+)/);
  if (!vqdMatch) return null;
  const vqd = vqdMatch[1];
  const imgRes = await fetch('https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent(query) + '&vqd=' + vqd + '&f=,,,&p=1');
  const data = await imgRes.json();
  return data.results && data.results.length > 0 ? data.results[0].image : null;
}

searchDDG('Apple iPhone 15 Pro white background device').then(console.log);
