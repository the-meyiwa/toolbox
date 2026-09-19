import { normalizeIcecat } from './js/lib/device-specs-provider.js';

// Fixed upstream and server-only credentials; never accept a user-supplied URL.
export async function handleDeviceRequest(request, response, url) {
  if (!url.pathname.startsWith('/api/devices/')) return false;
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
    return true;
  };
  if (request.method !== 'GET') return send(405, { error: 'Use GET for device lookups.' });
  const configured = Boolean(process.env.ICECAT_USERNAME && process.env.ICECAT_API_TOKEN);
  if (url.pathname === '/api/devices/status') return send(200, { configured, provider: 'Icecat' });
  if (url.pathname !== '/api/devices/lookup') return send(404, { error: 'Unknown device request.' });
  const fields = Object.fromEntries(['brand', 'model', 'gtin', 'icecatId'].map(k => [k, (url.searchParams.get(k) || '').trim()]));
  const { brand, model, gtin, icecatId } = fields;
  if (Object.values(fields).some(v => v.length > 150) ||
      [!!(brand || model), !!gtin, !!icecatId].filter(Boolean).length !== 1 ||
      ((brand || model) && !(brand && model)) || (gtin && !/^(\d{8}|\d{12,14})$/.test(gtin)) ||
      (icecatId && !/^\d{1,12}$/.test(icecatId))) {
    return send(400, { error: 'Enter a brand and exact model/part number, an 8/12/13/14-digit barcode, or an Icecat ID.' });
  }
  if (!configured) return send(503, { error: 'Live device lookup is not connected yet. Saved spec sheets remain available.', code: 'NOT_CONFIGURED' });
  const upstream = new URL('https://live.icecat.biz/api');
  upstream.search = new URLSearchParams({ shopname: process.env.ICECAT_USERNAME, lang: 'EN', content: '' }).toString();
  if (gtin) upstream.searchParams.set('GTIN', gtin);
  else if (icecatId) upstream.searchParams.set('icecat_id', icecatId);
  else { upstream.searchParams.set('Brand', brand); upstream.searchParams.set('ProductCode', model); }
  try {
    const res = await fetch(upstream, { headers: { 'api-token': process.env.ICECAT_API_TOKEN }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (res.status === 429) return send(429, { error: 'The catalog is busy. Please try again shortly.' });
    if (res.status === 401 || res.status === 403) return send(502, { error: 'The catalog connection needs attention. Please contact the site administrator.' });
    if (res.status === 404) return send(404, { error: 'No accessible spec sheet was found for this identifier.' });
    if (!res.ok) throw new Error('Upstream failure');
    const body = await res.json();
    if (!body.data?.GeneralInfo) {
      if ([4, 5, 9, 404].includes(Number(body.statusCode))) return send(404, { error: 'No accessible spec sheet was found. Check the exact part number or barcode.' });
      return send(502, { error: 'This spec sheet is unavailable with the current catalog access.' });
    }
    const device = normalizeIcecat(body.data);
    if (!device.sections.length) return send(404, { error: 'This product does not have an accessible specification sheet.' });
    return send(200, { device });
  } catch (error) {
    return send(error.name === 'TimeoutError' ? 504 : 502, { error: 'The device catalog did not respond. Please try again.' });
  }
}
