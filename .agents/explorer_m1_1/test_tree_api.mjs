async function testTree() {
  const url = 'https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1';
  console.log('Testing GitHub tree API fetch...');
  const headers = {
    'User-Agent': 'Toolbox-Anatomy-Pipeline',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  console.log('Status:', res.status, res.statusText);
  if (res.ok) {
    const data = await res.json();
    console.log('Tree entries total:', data.tree.length);
    const stlBlobs = data.tree.filter(t => t.path.startsWith('assets/BodyParts3D_data/stl/') && t.path.endsWith('.stl'));
    console.log('STL blobs found:', stlBlobs.length);
    if (stlBlobs.length > 0) {
      console.log('Sample STL blob:', stlBlobs[0]);
    }
  } else {
    console.warn('API error body:', await res.text());
  }
}

testTree().catch(err => console.error('Tree fetch error:', err.message));
