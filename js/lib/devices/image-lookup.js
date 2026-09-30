// Missing local photos are looked up by exact model title. A loose search can
// silently show the wrong device, so ambiguous results keep the category glyph.
const cache = new Map();
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);

export async function findDevicePhoto(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  const lookup = (async () => {
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php');
      url.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `intitle:"${key.replace(/"/g, '')}"`, gsrlimit: '5', prop: 'pageimages|info', piprop: 'thumbnail', pithumbsize: '500', inprop: 'url', format: 'json', origin: '*' });
      const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!response.ok) return null;
      const pages = Object.values((await response.json())?.query?.pages || {});
      const wanted = words(key);
      const candidates = pages.filter(p => p.thumbnail?.source && p.fullurl && wanted.every(w => words(p.title).includes(w)));
      candidates.sort((a, b) => words(a.title).length - words(b.title).length);
      const page = candidates[0];
      if (!page) return null;
      const src = new URL(page.thumbnail.source);
      if (src.protocol !== 'https:' || src.hostname !== 'upload.wikimedia.org') return null;
      const source = new URL(page.fullurl);
      if (source.protocol !== 'https:' || source.hostname !== 'en.wikipedia.org') return null;
      return { src: src.href, source: source.href, title: page.title };
    } catch { return null; }
  })();
  cache.set(key, lookup);
  return lookup;
}
