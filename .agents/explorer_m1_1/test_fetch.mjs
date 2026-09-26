import fs from 'node:fs';

async function testFetch() {
  const partsUrl = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/parts_list_e.txt';
  console.log('Testing fetch of parts_list_e.txt from raw GitHub...');
  const res = await fetch(partsUrl);
  console.log('Status:', res.status, res.statusText);
  if (res.ok) {
    const text = await res.text();
    console.log('Fetched bytes:', text.length, 'Lines:', text.split('\n').length);
  }
}

testFetch().catch(err => console.error('Fetch error:', err.message));
