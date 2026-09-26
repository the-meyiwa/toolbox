/* ============================================================
   PubChem live lookup (PUG REST / PUG View).
   Covers the compounds that are not in the offline tables and
   supplies GHS hazard classifications, descriptions and
   structure images. PubChem allows cross-origin requests, so
   the browser calls it directly. Every function takes an
   optional fetchImpl so tests can stub the network.
   ============================================================ */

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PUG_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;
const FORMULA_RE = /^(?:[A-Z][a-z]?\d*)+$/;

export function isCasNumber(q) {
  return CAS_RE.test(String(q).trim());
}

/* True for strings such as "C8H9NO2" or "NaCl"; plain words like "Aspirin" are names. */
export function looksLikeFormula(q) {
  const s = String(q).trim();
  if (!FORMULA_RE.test(s)) return false;
  return /\d/.test(s) || (s.match(/[A-Z]/g) || []).length > 1;
}

export function structureImageUrl(cid, size = 300) {
  return `${PUG}/compound/cid/${encodeURIComponent(cid)}/PNG?image_size=${size}x${size}`;
}

export function pubchemPageUrl(cid) {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(cid)}`;
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PubChem request failed (${res.status})`);
  return res.json();
}

/* Search by name, CAS number or molecular formula. Returns up to `limit` records. */
export async function searchPubChem(query, { fetchImpl = globalThis.fetch, limit = 10 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const url = looksLikeFormula(q)
    ? `${PUG}/compound/fastformula/${encodeURIComponent(q)}/cids/JSON?MaxRecords=${limit}`
    : `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON`;
  const found = await getJson(url, fetchImpl);
  const cids = (found?.IdentifierList?.CID || []).slice(0, limit);
  if (!cids.length) return [];

  const props = await getJson(
    `${PUG}/compound/cid/${cids.join(',')}/property/Title,MolecularFormula,MolecularWeight,IUPACName,XLogP/JSON`,
    fetchImpl,
  );
  return (props?.PropertyTable?.Properties || []).map(p => ({
    cid: p.CID,
    name: p.Title || p.IUPACName || `CID ${p.CID}`,
    formula: p.MolecularFormula || '',
    molarMass: Number(p.MolecularWeight) || null,
    iupac: p.IUPACName || '',
    xlogp: p.XLogP ?? null,
    source: 'pubchem',
  }));
}

/* First CAS-formatted synonym PubChem lists for a compound, or null. */
export async function fetchCasNumber(cid, { fetchImpl = globalThis.fetch } = {}) {
  const data = await getJson(`${PUG}/compound/cid/${encodeURIComponent(cid)}/synonyms/JSON`, fetchImpl);
  const synonyms = data?.InformationList?.Information?.[0]?.Synonym || [];
  return synonyms.find(s => CAS_RE.test(s)) || null;
}

export async function fetchDescription(cid, { fetchImpl = globalThis.fetch } = {}) {
  const data = await getJson(`${PUG}/compound/cid/${encodeURIComponent(cid)}/description/JSON`, fetchImpl);
  const info = (data?.InformationList?.Information || []).find(i => i.Description);
  return info ? { text: info.Description, source: info.DescriptionSourceName || '' } : null;
}

function collectInformation(section, out) {
  for (const info of section.Information || []) out.push(info);
  for (const child of section.Section || []) collectInformation(child, out);
  return out;
}

/* GHS classification: pictogram names, signal word and hazard statements.
   Returns null when PubChem has no GHS data for the compound. */
export async function fetchGhs(cid, { fetchImpl = globalThis.fetch } = {}) {
  const data = await getJson(
    `${PUG_VIEW}/data/compound/${encodeURIComponent(cid)}/JSON?heading=${encodeURIComponent('GHS Classification')}`,
    fetchImpl,
  );
  if (!data?.Record) return null;

  const infos = collectInformation(data.Record, []);
  const pictograms = new Set();
  const statements = new Set();
  let signal = '';

  for (const info of infos) {
    const items = info.Value?.StringWithMarkup || [];
    if (info.Name === 'Pictogram(s)') {
      for (const item of items) {
        for (const m of item.Markup || []) if (m.Extra) pictograms.add(m.Extra);
      }
    } else if (info.Name === 'Signal' && !signal) {
      signal = items[0]?.String || '';
    } else if (info.Name === 'GHS Hazard Statements') {
      for (const item of items) {
        const s = item.String || '';
        if (/^H\d{3}/.test(s)) statements.add(s.replace(/\s*\[.*$/, '').replace(/\s*\(\d+(\.\d+)?%\)/, ''));
      }
    }
  }
  if (!signal && !pictograms.size && !statements.size) return null;
  return {
    signal,
    pictograms: [...pictograms],
    statements: [...statements].sort(),
  };
}
