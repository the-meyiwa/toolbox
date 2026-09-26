/* ============================================================
   TOOLBOX — Invoicing data layer

   One store shared by the Invoice Generator, Timesheet & Billables
   and the Assistant's invoice tools. DOM-free: it only needs a
   Storage-like object (localStorage in the browser, an in-memory
   map in tests), so it runs in node as-is.

   Money is held in integer minor units (kobo, cents, pence) and
   every rounding happens once, at a named step, so totals never
   drift by a kobo between the editor, the PDF and the dashboard.

   Shape of the saved blob (key toolbox_invoicing_v1):
     { version, profile, clients[], docs[], recurring[],
       time[], timer, counters{}, pending }
   ============================================================ */

export const STORAGE_KEY = 'toolbox_invoicing_v1';
export const DATA_VERSION = 1;

export const CURRENCIES = {
  NGN: { symbol: '₦', major: 'Naira', majorOne: 'Naira', minor: 'Kobo', minorOne: 'Kobo' },
  USD: { symbol: '$', major: 'US Dollars', majorOne: 'US Dollar', minor: 'Cents', minorOne: 'Cent' },
  GBP: { symbol: '£', major: 'Pounds Sterling', majorOne: 'Pound Sterling', minor: 'Pence', minorOne: 'Penny' },
  EUR: { symbol: '€', major: 'Euros', majorOne: 'Euro', minor: 'Cents', minorOne: 'Cent' },
};
export const CURRENCY_CODES = Object.keys(CURRENCIES);
export const BASE_CURRENCY = 'NGN';

export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'converted', 'expired'];
export const STATUS_LABEL = {
  draft: 'Draft', sent: 'Sent', partial: 'Partially paid', paid: 'Paid', overdue: 'Overdue', void: 'Void',
  accepted: 'Accepted', declined: 'Declined', converted: 'Converted', expired: 'Expired',
};
export const PAYMENT_METHODS = ['Bank transfer', 'Cash', 'POS / card', 'Cheque', 'Mobile money', 'Other'];

/* ---------------- money ---------------- */

/** Major units (number or "1,234.56" string) to integer minor units. */
export function toMinor(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  // toPrecision strips binary noise first: 1.005 * 100 = 100.49999… -> 100.5 -> 101
  return Math.round(Number((n * 100).toPrecision(12)));
}
export const toMajor = (minor) => (Number(minor) || 0) / 100;

/** Round half away from zero, for amounts derived from a rate. */
export function roundMinor(x) {
  const v = Number((Number(x) || 0).toPrecision(12));
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/** percentage of an amount, rounded once: pctOf(10000, 7.5) = 750 */
export const pctOf = (minor, rate) => roundMinor((Number(minor) || 0) * (Number(rate) || 0) / 100);

const NUMBER_FORMATS = {
  standard: { group: ',', dec: '.' },    // 1,234,567.89
  european: { group: '.', dec: ',' },    // 1.234.567,89
  space: { group: ' ', dec: '.' },  // 1 234 567.89
};
export const NUMBER_FORMAT_KEYS = Object.keys(NUMBER_FORMATS);

export function formatNumber(minor, { format = 'standard', dp = 2 } = {}) {
  const f = NUMBER_FORMATS[format] || NUMBER_FORMATS.standard;
  const neg = minor < 0;
  const abs = Math.abs(Math.round(Number(minor) || 0));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, f.group);
  return `${neg ? '-' : ''}${grouped}${dp ? f.dec + frac : ''}`;
}

export function formatMoney(minor, currency = BASE_CURRENCY, opts = {}) {
  const c = CURRENCIES[currency] || { symbol: `${currency} ` };
  const s = formatNumber(minor, opts);
  return s.startsWith('-') ? `-${c.symbol}${s.slice(1)}` : `${c.symbol}${s}`;
}

/* ---------------- amount in words ---------------- */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function under1000(n, { andAfterHundred = true } = {}) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) {
    const words = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : '');
    parts.push(h && andAfterHundred ? `and ${words}` : words);
  }
  return parts.join(' ');
}

/** 1250000 -> "One Million, Two Hundred and Fifty Thousand" (British usage, as on Nigerian cheques) */
export function numberToWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'Zero';
  const groups = [];
  let i = 0;
  while (n > 0 && i < SCALES.length) {
    const g = n % 1000;
    if (g) groups.unshift({ g, scale: SCALES[i] });
    n = Math.floor(n / 1000);
    i++;
  }
  return groups.map(({ g, scale }, idx) => {
    let w = under1000(g);
    // "One Thousand and Five": a trailing group under 100 after a larger one takes "and"
    if (idx === groups.length - 1 && idx > 0 && !scale && g < 100) w = `and ${w}`;
    return scale ? `${w} ${scale}` : w;
  }).join(', ').replace(/, and /g, ' and ');
}

/** 125000050 kobo -> "One Million, Two Hundred and Fifty Thousand Naira, Fifty Kobo Only" */
export function amountInWords(minor, currency = BASE_CURRENCY) {
  const c = CURRENCIES[currency] || { major: currency, majorOne: currency, minor: 'Cents', minorOne: 'Cent' };
  const abs = Math.abs(Math.round(Number(minor) || 0));
  const whole = Math.floor(abs / 100), frac = abs % 100;
  const major = `${numberToWords(whole)} ${whole === 1 ? c.majorOne : c.major}`;
  const out = frac ? `${major}, ${numberToWords(frac)} ${frac === 1 ? c.minorOne : c.minor}` : major;
  return `${minor < 0 ? 'Minus ' : ''}${out} Only`;
}

/* ---------------- dates ---------------- */

export function isoDate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function parseISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}
export function addDays(iso, days) {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}
export function daysBetween(fromIso, toIso) {
  const a = parseISO(fromIso), b = parseISO(toIso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}
/** Add months keeping the anchor day, clamped to the month's length (31 Jan + 1 -> 28/29 Feb). */
export function addMonths(iso, months, anchorDay) {
  const { y, m, d } = parseISO(iso);
  const day = anchorDay || d;
  const total = (m - 1) + Number(months || 0);
  const ny = y + Math.floor(total / 12), nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function formatDate(iso, style = 'long') {
  if (!iso) return '';
  const { y, m, d } = parseISO(iso);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (style === 'short') return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
/** Monday (or Sunday) that starts the week containing iso */
export function weekStart(iso, startsOn = 1) {
  const { y, m, d } = parseISO(iso);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(iso, -((dow - startsOn + 7) % 7));
}

/* ---------------- duration ---------------- */

/** "1:30", "1.5", "1.5h", "90m", "1h 20m", "45 min" -> minutes */
export function parseDuration(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return 0;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/);
  if (m && (m[1] || m[2])) return Math.round((Number(m[1] || 0) * 60) + Number(m[2] || 0));
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}
export function formatDuration(minutes) {
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
/** Round a duration up to a billing increment (6-minute units for legal work). */
export function roundUpMinutes(minutes, increment = 0) {
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  if (!increment || increment <= 1) return mins;
  return Math.ceil(mins / increment) * increment;
}
/** Amount for a time entry: hours x hourly rate, rounded once. */
export const timeAmount = (minutes, rateMinor) => roundMinor((Number(minutes) || 0) * (Number(rateMinor) || 0) / 60);

/* ---------------- totals ---------------- */

/** Line maths: gross = qty x rate, discount (%), net. */
export function lineTotals(item) {
  const qty = Number(item.qty) || 0;
  const rate = Math.round(Number(item.rate) || 0);
  const gross = roundMinor(qty * rate);
  const discPct = Math.min(Math.max(Number(item.discount) || 0, 0), 100);
  const discount = pctOf(gross, discPct);
  return { gross, discount, net: gross - discount };
}

/**
 * Invoice totals, all in minor units.
 *  vat.mode 'none' | 'global' (every line) | 'line' (only items with vat: true)
 *  WHT is withheld by the client on the amount before VAT and shown separately.
 */
export function computeTotals(doc) {
  const items = Array.isArray(doc?.items) ? doc.items : [];
  const vatMode = doc?.vat?.mode || 'none';
  const vatRate = Number(doc?.vat?.rate ?? 7.5) || 0;
  const whtRate = Number(doc?.wht?.rate || 0) || 0;
  let gross = 0, discount = 0, net = 0, vatBase = 0;
  const lines = items.map(it => {
    const t = lineTotals(it);
    gross += t.gross; discount += t.discount; net += t.net;
    const vatable = vatMode === 'global' || (vatMode === 'line' && it.vat);
    if (vatable) vatBase += t.net;
    return { ...t, vatable, vat: vatable ? pctOf(t.net, vatRate) : 0 };
  });
  const vat = vatMode === 'none' ? 0 : pctOf(vatBase, vatRate);
  const total = net + vat;
  const wht = whtRate > 0 ? pctOf(net, whtRate) : 0;
  const payable = total - wht;
  const paid = (doc?.payments || []).reduce((s, p) => s + Math.round(Number(p.amount) || 0), 0);
  const balance = payable - paid;
  return { lines, gross, discount, subtotal: net, vatBase, vatRate, vat, total, whtRate, wht, payable, paid, balance };
}

/* ---------------- status ---------------- */

/** Status as shown to the user: stored draft/sent/void plus what payments and dates imply. */
export function effectiveStatus(doc, today = isoDate()) {
  if (!doc) return 'draft';
  if (doc.type === 'quote') {
    if (['converted', 'accepted', 'declined'].includes(doc.status)) return doc.status;
    if (doc.status === 'sent' && doc.dueDate && doc.dueDate < today) return 'expired';
    return doc.status === 'sent' ? 'sent' : 'draft';
  }
  if (doc.status === 'void') return 'void';
  const t = computeTotals(doc);
  if (t.paid > 0 && t.balance <= 0) return 'paid';
  if (doc.status === 'draft') return 'draft';
  if (doc.dueDate && doc.dueDate < today && t.balance > 0) return 'overdue';
  if (t.paid > 0) return 'partial';
  return 'sent';
}

/* ---------------- storage helpers ---------------- */

export function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; },
  };
}

let idSeq = 0;
export function makeId(prefix = 'id') {
  idSeq = (idSeq + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${idSeq.toString(36)}`;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const str = (v, max = 2000) => String(v ?? '').slice(0, max);

export function emptyProfile() {
  return {
    name: '', address: '', phone: '', email: '', website: '',
    rcNumber: '', tin: '', vatNumber: '',
    bankName: '', accountName: '', accountNumber: '',
    logo: '', signature: '', signatoryName: '', signatoryTitle: '',
    invoicePrefix: 'INV', quotePrefix: 'QUO',
    notes: 'Thank you for your business.',
    terms: '',
  };
}

function emptyData() {
  return {
    version: DATA_VERSION,
    profile: emptyProfile(),
    clients: [], docs: [], recurring: [], time: [],
    timer: null, counters: {}, pending: null,
  };
}

/* Bring any older or partial blob up to the current shape. */
export function migrate(raw) {
  const d = emptyData();
  if (!raw || typeof raw !== 'object') return d;
  d.profile = { ...d.profile, ...(raw.profile || {}) };
  for (const k of ['clients', 'docs', 'recurring', 'time']) if (Array.isArray(raw[k])) d[k] = raw[k];
  d.timer = raw.timer && raw.timer.startedAt ? raw.timer : null;
  d.counters = raw.counters && typeof raw.counters === 'object' ? raw.counters : {};
  d.pending = raw.pending || null;
  d.docs = d.docs.map(x => ({ payments: [], items: [], vat: { mode: 'none', rate: 7.5 }, wht: { rate: 0 }, ...x }));
  d.version = DATA_VERSION;
  return d;
}

/* ============================================================
   Store
   ============================================================ */

export function createStore({ storage = null, key = STORAGE_KEY, now = () => new Date() } = {}) {
  let data = null;
  const listeners = new Set();
  const today = () => isoDate(now());

  function load() {
    if (data) return data;
    let raw = null;
    try { raw = storage ? JSON.parse(storage.getItem(key) || 'null') : null; } catch { raw = null; }
    data = migrate(raw);
    return data;
  }
  function save(what = 'data') {
    try { storage?.setItem(key, JSON.stringify(data)); } catch { /* quota or private mode: keep in memory */ }
    for (const fn of listeners) { try { fn(what); } catch { /* listener errors never break a save */ } }
  }
  function reload() { data = null; load(); for (const fn of listeners) { try { fn('reload'); } catch {} } }

  /* ---------- profile ---------- */
  const getProfile = () => clone(load().profile);
  function updateProfile(patch = {}) {
    const p = load().profile;
    for (const [k, v] of Object.entries(patch)) if (k in p) p[k] = typeof v === 'string' ? str(v, k === 'logo' || k === 'signature' ? 400000 : 2000) : v;
    save('profile');
    return clone(p);
  }

  /* ---------- clients ---------- */
  const listClients = () => clone(load().clients).sort((a, b) => a.name.localeCompare(b.name));
  const getClient = (id) => { const c = load().clients.find(x => x.id === id); return c ? clone(c) : null; };
  function findClientByName(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const c = load().clients.find(x => x.name.trim().toLowerCase() === n);
    return c ? clone(c) : null;
  }
  function saveClient(input = {}) {
    const d = load();
    const name = str(input.name, 200).trim();
    if (!name) throw new Error('A client needs a name.');
    const fields = {
      name, email: str(input.email, 200).trim(), phone: str(input.phone, 60).trim(),
      address: str(input.address, 600), tin: str(input.tin, 40).trim(), contact: str(input.contact, 120).trim(),
      hourlyRate: Math.max(0, Math.round(Number(input.hourlyRate) || 0)),
    };
    let c = input.id ? d.clients.find(x => x.id === input.id) : null;
    if (c) Object.assign(c, fields, { updatedAt: now().toISOString() });
    else { c = { id: makeId('cli'), ...fields, createdAt: now().toISOString() }; d.clients.push(c); }
    save('clients');
    return clone(c);
  }
  function ensureClient(nameOrObj) {
    if (!nameOrObj) return null;
    if (typeof nameOrObj === 'object' && nameOrObj.id && getClient(nameOrObj.id)) return getClient(nameOrObj.id);
    const obj = typeof nameOrObj === 'string' ? { name: nameOrObj } : nameOrObj;
    const [first, ...rest] = String(obj.name || '').split('\n');
    const existing = findClientByName(first);
    if (existing) return existing;
    return saveClient({ ...obj, name: first.trim(), address: obj.address ?? rest.join('\n') });
  }
  function deleteClient(id) {
    const d = load();
    if (d.docs.some(x => x.clientId === id)) throw new Error('This client has invoices or quotes. Void or delete them first.');
    d.clients = d.clients.filter(x => x.id !== id);
    save('clients');
  }

  /* ---------- numbering ---------- */
  function prefixFor(type) {
    const p = load().profile;
    return (type === 'quote' ? p.quotePrefix || 'QUO' : p.invoicePrefix || 'INV').trim().toUpperCase() || (type === 'quote' ? 'QUO' : 'INV');
  }
  function peekNumber(type = 'invoice', date = today()) {
    const d = load();
    const prefix = prefixFor(type), year = String(date).slice(0, 4);
    const key = `${prefix}-${year}`;
    let n = (d.counters[key] || 0) + 1;
    const taken = new Set(d.docs.map(x => x.number));
    while (taken.has(`${key}-${String(n).padStart(4, '0')}`)) n++;
    return { key, n, number: `${key}-${String(n).padStart(4, '0')}` };
  }
  function nextNumber(type = 'invoice', date = today()) {
    const p = peekNumber(type, date);
    load().counters[p.key] = p.n;
    return p.number;
  }
  const numberTaken = (number, exceptId) => load().docs.some(x => x.number === number && x.id !== exceptId);

  /* ---------- documents ---------- */
  function normItem(it = {}) {
    return {
      id: it.id || makeId('li'),
      description: str(it.description, 1000),
      qty: Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1,
      unit: str(it.unit, 20),
      rate: Math.round(Number(it.rate) || 0),
      discount: Math.min(Math.max(Number(it.discount) || 0, 0), 100),
      vat: it.vat !== false,
      timeIds: Array.isArray(it.timeIds) ? it.timeIds.slice() : undefined,
    };
  }

  function createDoc(input = {}, defaults = {}) {
    const d = load();
    const type = input.type === 'quote' ? 'quote' : 'invoice';
    const issueDate = input.issueDate || today();
    const dueDays = Number(input.dueDays ?? defaults.dueDays ?? (type === 'quote' ? 30 : 14));
    const currency = CURRENCIES[input.currency] ? input.currency : (defaults.currency || BASE_CURRENCY);
    const p = d.profile;
    let number = input.number && !numberTaken(input.number) ? str(input.number, 40) : null;
    if (!number) number = nextNumber(type, issueDate);
    const doc = {
      id: makeId(type === 'quote' ? 'quo' : 'inv'),
      type, number, status: 'draft',
      clientId: input.clientId || null,
      issueDate, dueDate: input.dueDate || addDays(issueDate, dueDays),
      currency, fxRate: currency === BASE_CURRENCY ? 1 : Math.max(0, Number(input.fxRate ?? defaults.fxRate?.[currency] ?? 0)) || 0,
      reference: str(input.reference, 120),
      items: (input.items || []).map(normItem),
      vat: { mode: input.vat?.mode || (defaults.vat ? (defaults.vatMode || 'global') : 'none'), rate: Number(input.vat?.rate ?? 7.5) },
      wht: { rate: Number(input.wht?.rate ?? defaults.whtRate ?? 0) || 0 },
      notes: str(input.notes ?? p.notes, 4000),
      terms: str(input.terms ?? p.terms, 4000),
      template: input.template || defaults.template || 'classic',
      payments: [],
      recurringId: input.recurringId || null,
      fromQuoteId: input.fromQuoteId || null,
      createdAt: now().toISOString(), updatedAt: now().toISOString(),
      sentAt: null,
    };
    d.docs.push(doc);
    save('docs');
    return clone(doc);
  }

  const getDoc = (id) => { const x = load().docs.find(y => y.id === id); return x ? clone(x) : null; };
  function rawDoc(id) {
    const x = load().docs.find(y => y.id === id);
    if (!x) throw new Error('That invoice no longer exists.');
    return x;
  }

  const EDITABLE = ['clientId', 'issueDate', 'dueDate', 'currency', 'fxRate', 'reference', 'notes', 'terms', 'template', 'number'];
  function updateDoc(id, patch = {}) {
    const doc = rawDoc(id);
    for (const k of EDITABLE) {
      if (!(k in patch)) continue;
      if (k === 'number') {
        const n = str(patch.number, 40).trim();
        if (!n) continue;
        if (numberTaken(n, id)) throw new Error(`${n} is already used by another document.`);
        doc.number = n;
      } else if (k === 'currency') {
        if (CURRENCIES[patch.currency]) { doc.currency = patch.currency; if (patch.currency === BASE_CURRENCY) doc.fxRate = 1; }
      } else if (k === 'fxRate') doc.fxRate = Math.max(0, Number(patch.fxRate) || 0);
      else doc[k] = patch[k];
    }
    if (patch.items) doc.items = patch.items.map(normItem);
    if (patch.vat) doc.vat = { mode: ['none', 'global', 'line'].includes(patch.vat.mode) ? patch.vat.mode : doc.vat.mode, rate: Number(patch.vat.rate ?? doc.vat.rate) || 0 };
    if (patch.wht) doc.wht = { rate: Math.max(0, Math.min(100, Number(patch.wht.rate) || 0)) };
    doc.updatedAt = now().toISOString();
    save('docs');
    return clone(doc);
  }

  function listDocs({ type = 'invoice', status = 'all', q = '', clientId = null } = {}) {
    const t = today();
    const clients = new Map(load().clients.map(c => [c.id, c]));
    const needle = String(q || '').trim().toLowerCase();
    return load().docs
      .filter(x => type === 'all' || x.type === type)
      .filter(x => !clientId || x.clientId === clientId)
      .map(x => {
        const totals = computeTotals(x);
        const st = effectiveStatus(x, t);
        const client = clients.get(x.clientId);
        return { ...clone(x), totals, effectiveStatus: st, clientName: client?.name || '' };
      })
      .filter(x => status === 'all' || x.effectiveStatus === status || (status === 'outstanding' && ['sent', 'partial', 'overdue'].includes(x.effectiveStatus)))
      .filter(x => !needle || [x.number, x.clientName, x.reference, ...x.items.map(i => i.description)].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => (b.issueDate.localeCompare(a.issueDate)) || b.number.localeCompare(a.number));
  }

  /** NGN value of a minor amount on a document (manual rate; 0 rate = unknown -> excluded). */
  const toBase = (doc, minor) => (doc.currency === BASE_CURRENCY ? minor : roundMinor(minor * (Number(doc.fxRate) || 0)));

  function dashboard() {
    const t = today();
    const month = t.slice(0, 7);
    const out = { outstanding: 0, overdue: 0, paidThisMonth: 0, drafts: 0, counts: {}, missingFx: 0, currency: BASE_CURRENCY };
    for (const doc of load().docs) {
      if (doc.type !== 'invoice') continue;
      const st = effectiveStatus(doc, t);
      out.counts[st] = (out.counts[st] || 0) + 1;
      if (st === 'draft') { out.drafts++; continue; }
      if (st === 'void') continue;
      if (doc.currency !== BASE_CURRENCY && !(doc.fxRate > 0)) out.missingFx++;
      const tt = computeTotals(doc);
      if (['sent', 'partial', 'overdue'].includes(st)) out.outstanding += toBase(doc, tt.balance);
      if (st === 'overdue') out.overdue += toBase(doc, tt.balance);
      for (const p of doc.payments) if (String(p.date).slice(0, 7) === month) out.paidThisMonth += toBase(doc, p.amount);
    }
    out.counts.outstanding = (out.counts.sent || 0) + (out.counts.partial || 0) + (out.counts.overdue || 0);
    return out;
  }

  /* ---------- transitions ---------- */
  function markSent(id) {
    const doc = rawDoc(id);
    if (doc.status === 'void') throw new Error('A void document cannot be sent.');
    if (doc.type === 'quote' && ['converted', 'accepted', 'declined'].includes(doc.status)) throw new Error('This quote has already been answered.');
    if (!doc.items.length) throw new Error('Add at least one line item first.');
    if (doc.status === 'draft') { doc.status = 'sent'; doc.sentAt = now().toISOString(); }
    doc.updatedAt = now().toISOString();
    save('docs');
    return clone(doc);
  }
  function markDraft(id) {
    const doc = rawDoc(id);
    if (doc.payments.length) throw new Error('Remove the recorded payments before returning this invoice to draft.');
    if (doc.status === 'void') throw new Error('A void document stays void.');
    doc.status = 'draft'; doc.sentAt = null;
    save('docs');
    return clone(doc);
  }
  function releaseTime(docId) {
    for (const e of load().time) if (e.invoiceId === docId) { e.invoiced = false; e.invoiceId = null; }
  }
  function voidDoc(id) {
    const doc = rawDoc(id);
    if (doc.payments.length) throw new Error('This invoice has payments recorded. Remove them before voiding.');
    doc.status = 'void'; doc.voidedAt = now().toISOString();
    releaseTime(id);
    save('docs');
    return clone(doc);
  }
  function deleteDoc(id) {
    const d = load();
    const doc = rawDoc(id);
    if (doc.type === 'invoice' && doc.status !== 'draft' && doc.status !== 'void') throw new Error('Only drafts and void invoices can be deleted. Void it first.');
    releaseTime(id);
    for (const q of d.docs) if (q.convertedToId === id) { q.convertedToId = null; if (q.status === 'converted') q.status = 'accepted'; }
    d.docs = d.docs.filter(x => x.id !== id);
    // Deleting the newest draft gives its number back, so the series stays gapless.
    const m = String(doc.number).match(/^(.*)-(\d+)$/);
    if (m && d.counters[m[1]] === Number(m[2])) d.counters[m[1]] = Number(m[2]) - 1;
    save('docs');
  }
  function setQuoteStatus(id, status) {
    const doc = rawDoc(id);
    if (doc.type !== 'quote') throw new Error('Not a quote.');
    if (!['draft', 'sent', 'accepted', 'declined'].includes(status)) throw new Error('Unknown quote status.');
    if (doc.status === 'converted') throw new Error('This quote is already an invoice.');
    doc.status = status;
    save('docs');
    return clone(doc);
  }

  /* ---------- payments ---------- */
  function recordPayment(id, { amount, date, method = 'Bank transfer', reference = '', note = '' } = {}) {
    const doc = rawDoc(id);
    if (doc.type !== 'invoice') throw new Error('Payments are recorded against invoices, not quotes.');
    if (doc.status === 'void') throw new Error('A void invoice cannot take payments.');
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) throw new Error('Enter an amount above zero.');
    const { balance } = computeTotals(doc);
    if (amt > balance) throw new Error(`That is more than the balance due (${formatMoney(balance, doc.currency)}).`);
    const pay = { id: makeId('pay'), amount: amt, date: date || today(), method: str(method, 40), reference: str(reference, 120), note: str(note, 400) };
    doc.payments.push(pay);
    doc.payments.sort((a, b) => a.date.localeCompare(b.date));
    if (doc.status === 'draft') { doc.status = 'sent'; doc.sentAt = doc.sentAt || now().toISOString(); }
    doc.updatedAt = now().toISOString();
    save('docs');
    return clone(doc);
  }
  function deletePayment(id, paymentId) {
    const doc = rawDoc(id);
    doc.payments = doc.payments.filter(p => p.id !== paymentId);
    save('docs');
    return clone(doc);
  }

  /* ---------- duplicate / convert ---------- */
  function duplicateDoc(id, { type } = {}) {
    const src = rawDoc(id);
    const copy = createDoc({
      type: type || src.type, clientId: src.clientId, currency: src.currency, fxRate: src.fxRate,
      items: src.items.map(({ id: _i, timeIds: _t, ...rest }) => rest),
      vat: src.vat, wht: src.wht, notes: src.notes, terms: src.terms, template: src.template, reference: src.reference,
      dueDays: Math.max(0, daysBetween(src.issueDate, src.dueDate)),
    });
    return copy;
  }
  function convertQuote(id) {
    const q = rawDoc(id);
    if (q.type !== 'quote') throw new Error('Only a quote can be converted to an invoice.');
    if (q.status === 'converted' && q.convertedToId && getDoc(q.convertedToId)) throw new Error('This quote was already converted.');
    if (q.status === 'declined') throw new Error('This quote was declined.');
    const inv = createDoc({
      type: 'invoice', clientId: q.clientId, currency: q.currency, fxRate: q.fxRate,
      items: q.items.map(({ id: _i, ...rest }) => rest), vat: q.vat, wht: q.wht,
      notes: q.notes, terms: q.terms, template: q.template, reference: q.reference || q.number, fromQuoteId: q.id,
    });
    const qq = rawDoc(id);
    qq.status = 'converted'; qq.convertedToId = inv.id;
    save('docs');
    return inv;
  }

  /* ---------- recurring ---------- */
  function setRecurring(docId, frequency, { startDate } = {}) {
    const d = load();
    const doc = rawDoc(docId);
    const existing = d.recurring.find(r => r.templateId === docId || r.id === doc.recurringId);
    if (!frequency || frequency === 'none') {
      if (existing) { existing.active = false; }
      doc.recurringId = null;
      save('recurring');
      return null;
    }
    if (!['monthly', 'quarterly'].includes(frequency)) throw new Error('Repeat monthly or quarterly.');
    const months = frequency === 'monthly' ? 1 : 3;
    const anchor = startDate || doc.issueDate;
    const r = existing || { id: makeId('rec'), templateId: docId, createdAt: now().toISOString() };
    Object.assign(r, { frequency, active: true, anchorDay: Number(anchor.slice(8, 10)), nextDate: existing?.frequency === frequency && existing.active ? existing.nextDate : addMonths(anchor, months, Number(anchor.slice(8, 10))) });
    if (!existing) d.recurring.push(r);
    doc.recurringId = r.id;
    save('recurring');
    return clone(r);
  }
  const listRecurring = () => clone(load().recurring);
  const getRecurringFor = (docId) => { const r = load().recurring.find(x => x.templateId === docId && x.active); return r ? clone(r) : null; };

  /** Create a draft for every schedule whose date has come; catches up missed periods (max 12 each). */
  function runRecurring(onDate = today()) {
    const d = load();
    const created = [];
    for (const r of d.recurring) {
      if (!r.active) continue;
      const tpl = d.docs.find(x => x.id === r.templateId);
      if (!tpl) { r.active = false; continue; }
      let guard = 0;
      while (r.nextDate <= onDate && guard++ < 12) {
        const dueDays = Math.max(0, daysBetween(tpl.issueDate, tpl.dueDate));
        const inv = createDoc({
          type: 'invoice', clientId: tpl.clientId, currency: tpl.currency, fxRate: tpl.fxRate,
          items: tpl.items.map(({ id: _i, timeIds: _t, ...rest }) => rest), vat: tpl.vat, wht: tpl.wht,
          notes: tpl.notes, terms: tpl.terms, template: tpl.template, reference: tpl.reference,
          issueDate: r.nextDate, dueDays, recurringId: r.id,
        });
        created.push(inv);
        r.lastGeneratedAt = now().toISOString();
        r.lastDocId = inv.id;
        r.nextDate = addMonths(r.nextDate, r.frequency === 'quarterly' ? 3 : 1, r.anchorDay);
      }
    }
    if (created.length) save('recurring');
    return created;
  }

  /* ---------- time ---------- */
  function normEntry(input = {}) {
    return {
      clientId: input.clientId || null,
      matter: str(input.matter, 200).trim(),
      task: str(input.task, 600).trim(),
      date: input.date || today(),
      minutes: Math.max(0, Math.round(Number(input.minutes) || 0)),
      rate: Math.max(0, Math.round(Number(input.rate) || 0)),
      currency: CURRENCIES[input.currency] ? input.currency : BASE_CURRENCY,
      billable: input.billable !== false,
    };
  }
  function addTime(input = {}) {
    const e = { id: makeId('t'), ...normEntry(input), invoiced: false, invoiceId: null, createdAt: now().toISOString() };
    if (!e.minutes) throw new Error('Enter how long you worked, e.g. 1:30 or 45m.');
    load().time.push(e);
    save('time');
    return clone(e);
  }
  function updateTime(id, patch = {}) {
    const e = load().time.find(x => x.id === id);
    if (!e) throw new Error('That entry no longer exists.');
    if (e.invoiced && ['minutes', 'rate', 'clientId', 'billable'].some(k => k in patch)) throw new Error('This entry is already on an invoice.');
    Object.assign(e, normEntry({ ...e, ...patch }));
    save('time');
    return clone(e);
  }
  function deleteTime(id) {
    const e = load().time.find(x => x.id === id);
    if (e?.invoiced) throw new Error('This entry is on an invoice. Void or delete that invoice first.');
    load().time = load().time.filter(x => x.id !== id);
    save('time');
  }
  function listTime({ from = null, to = null, clientId = null, unbilled = false } = {}) {
    return clone(load().time)
      .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
      .filter(e => !clientId || e.clientId === clientId)
      .filter(e => !unbilled || (e.billable && !e.invoiced))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  function timeSummary(entries = load().time) {
    const clients = new Map(load().clients.map(c => [c.id, c.name]));
    const by = new Map();
    for (const e of entries) {
      const k = `${e.clientId || ''}\u0000${e.matter}\u0000${e.currency}`;
      const row = by.get(k) || { clientId: e.clientId, clientName: clients.get(e.clientId) || 'No client', matter: e.matter || 'General', currency: e.currency, minutes: 0, billableMinutes: 0, amount: 0, unbilledMinutes: 0, unbilled: 0 };
      row.minutes += e.minutes;
      if (e.billable) {
        row.billableMinutes += e.minutes;
        row.amount += timeAmount(e.minutes, e.rate);
        if (!e.invoiced) { row.unbilledMinutes += e.minutes; row.unbilled += timeAmount(e.minutes, e.rate); }
      }
      by.set(k, row);
    }
    return [...by.values()].sort((a, b) => a.clientName.localeCompare(b.clientName) || a.matter.localeCompare(b.matter));
  }

  /* timer: one running at a time, persisted so it survives reloads */
  const getTimer = () => (load().timer ? clone(load().timer) : null);
  function startTimer(input = {}) {
    const d = load();
    if (d.timer) throw new Error('A timer is already running.');
    d.timer = { ...normEntry(input), startedAt: now().getTime(), date: today() };
    save('timer');
    return clone(d.timer);
  }
  function updateTimer(patch = {}) {
    const d = load();
    if (!d.timer) return null;
    const { startedAt } = d.timer;
    d.timer = { ...normEntry({ ...d.timer, ...patch }), startedAt, date: d.timer.date };
    save('timer');
    return clone(d.timer);
  }
  const timerElapsedMs = () => (load().timer ? Math.max(0, now().getTime() - load().timer.startedAt) : 0);
  /** Stop the timer and log the time (rounded up to the increment, at least one minute). */
  function stopTimer({ increment = 0, discard = false } = {}) {
    const d = load();
    const t = d.timer;
    if (!t) return null;
    d.timer = null;
    if (discard) { save('timer'); return null; }
    const minutes = roundUpMinutes(Math.max(1, Math.ceil(timerElapsedMsFor(t) / 60000)), increment);
    const e = { id: makeId('t'), ...normEntry({ ...t, minutes }), invoiced: false, invoiceId: null, createdAt: now().toISOString() };
    d.time.push(e);
    save('time');
    return clone(e);
  }
  function timerElapsedMsFor(t) { return Math.max(0, now().getTime() - t.startedAt); }

  /**
   * Turn unbilled time into a draft invoice.
   *  group 'entry'  one line per entry (dated narrative, as law firms bill)
   *  group 'matter' one line per matter + rate
   * Entries are marked invoiced and linked, and released again if the invoice is voided or deleted.
   */
  function invoiceFromTime({ clientId, entryIds = null, group = 'entry', currency = null, defaults = {} } = {}) {
    const d = load();
    let entries = d.time.filter(e => e.billable && !e.invoiced && (entryIds ? entryIds.includes(e.id) : e.clientId === clientId));
    if (!entries.length) throw new Error('There is no unbilled time for that client.');
    const cur = currency || entries[0].currency;
    entries = entries.filter(e => e.currency === cur);
    const cid = clientId || entries[0].clientId;
    entries.sort((a, b) => a.date.localeCompare(b.date));
    let items;
    if (group === 'matter') {
      const m = new Map();
      for (const e of entries) {
        const k = `${e.matter}\u0000${e.rate}`;
        const row = m.get(k) || { description: `${e.matter || 'Professional services'}: professional time`, minutes: 0, rate: e.rate, timeIds: [] };
        row.minutes += e.minutes; row.timeIds.push(e.id);
        m.set(k, row);
      }
      items = [...m.values()].map(r => ({ description: r.description, qty: Number((r.minutes / 60).toFixed(4)), unit: 'hr', rate: r.rate, vat: true, timeIds: r.timeIds }));
    } else {
      items = entries.map(e => ({
        description: `${formatDate(e.date, 'short')}, ${[e.matter, e.task].filter(Boolean).join(': ') || 'Professional services'}`,
        qty: Number((e.minutes / 60).toFixed(4)), unit: 'hr', rate: e.rate, vat: true, timeIds: [e.id],
      }));
    }
    const inv = createDoc({ type: 'invoice', clientId: cid, currency: cur, items, reference: [...new Set(entries.map(e => e.matter).filter(Boolean))].join(', ').slice(0, 120) }, defaults);
    for (const e of entries) { e.invoiced = true; e.invoiceId = inv.id; }
    save('time');
    return { invoice: inv, entries: entries.length, minutes: entries.reduce((s, e) => s + e.minutes, 0) };
  }

  /* ---------- hand-off between tools ---------- */
  function setPending(p) { load().pending = p ? { ...p, at: now().getTime() } : null; save('pending'); }
  function takePending() {
    const p = load().pending;
    if (!p) return null;
    load().pending = null; save('pending');
    return now().getTime() - (p.at || 0) < 10 * 60 * 1000 ? p : null;
  }

  /* ---------- import / export ---------- */
  function exportJSON() {
    return JSON.stringify({ app: 'toolbox-invoicing', exportedAt: now().toISOString(), ...load() }, null, 2);
  }
  function importJSON(text, { mode = 'replace' } = {}) {
    let raw;
    try { raw = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('That file is not valid JSON.'); }
    if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.docs) && !Array.isArray(raw.clients) && !raw.profile)) throw new Error('That file is not an invoicing backup.');
    const incoming = migrate(raw);
    if (mode === 'merge') {
      const d = load();
      for (const k of ['clients', 'docs', 'recurring', 'time']) {
        const ids = new Set(d[k].map(x => x.id));
        for (const x of incoming[k]) if (!ids.has(x.id)) d[k].push(x);
      }
      for (const [k, v] of Object.entries(incoming.counters)) d.counters[k] = Math.max(d.counters[k] || 0, v);
    } else {
      data = incoming;
    }
    save('import');
    return { clients: load().clients.length, docs: load().docs.length, time: load().time.length };
  }
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCSV = (rows) => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  function invoicesCSV({ type = 'invoice' } = {}) {
    const rows = [['Number', 'Type', 'Status', 'Client', 'Issue date', 'Due date', 'Currency', 'Subtotal', 'VAT', 'Total', 'WHT', 'Payable', 'Paid', 'Balance', 'Reference']];
    for (const x of listDocs({ type })) {
      const t = x.totals;
      rows.push([x.number, x.type, STATUS_LABEL[x.effectiveStatus], x.clientName, x.issueDate, x.dueDate, x.currency,
        toMajor(t.subtotal).toFixed(2), toMajor(t.vat).toFixed(2), toMajor(t.total).toFixed(2), toMajor(t.wht).toFixed(2),
        toMajor(t.payable).toFixed(2), toMajor(t.paid).toFixed(2), toMajor(t.balance).toFixed(2), x.reference]);
    }
    return toCSV(rows);
  }
  function timeCSV(entries = listTime()) {
    const clients = new Map(load().clients.map(c => [c.id, c.name]));
    const rows = [['Date', 'Client', 'Matter', 'Task', 'Hours', 'Duration', 'Rate', 'Currency', 'Billable', 'Amount', 'Invoiced', 'Invoice']];
    const nums = new Map(load().docs.map(x => [x.id, x.number]));
    for (const e of entries) {
      rows.push([e.date, clients.get(e.clientId) || '', e.matter, e.task, (e.minutes / 60).toFixed(2), formatDuration(e.minutes),
        toMajor(e.rate).toFixed(2), e.currency, e.billable ? 'yes' : 'no', toMajor(e.billable ? timeAmount(e.minutes, e.rate) : 0).toFixed(2),
        e.invoiced ? 'yes' : 'no', nums.get(e.invoiceId) || '']);
    }
    return toCSV(rows);
  }

  /** Plain text for email / WhatsApp with amount and bank details. */
  function shareText(id, { format = 'standard' } = {}) {
    const doc = rawDoc(id);
    const p = load().profile;
    const c = getClient(doc.clientId);
    const t = computeTotals(doc);
    const m = (v) => formatMoney(v, doc.currency, { format });
    const kind = doc.type === 'quote' ? 'quotation' : 'invoice';
    const lines = [
      `Hello${c?.contact ? ` ${c.contact}` : c?.name ? ` ${c.name}` : ''},`,
      '',
      doc.type === 'quote'
        ? `Please find our ${kind} ${doc.number} for ${m(t.total)}, valid until ${formatDate(doc.dueDate)}.`
        : `Please find ${kind} ${doc.number} for ${m(t.total)}, due on ${formatDate(doc.dueDate)}.`,
    ];
    if (doc.type === 'invoice') {
      if (t.wht) lines.push(`After ${t.whtRate}% withholding tax (${m(t.wht)}), the amount payable is ${m(t.payable)}.`);
      if (t.paid) lines.push(`We have received ${m(t.paid)}; the balance due is ${m(t.balance)}.`);
      if (p.bankName || p.accountNumber) {
        lines.push('', 'Payment details:');
        if (p.bankName) lines.push(`Bank: ${p.bankName}`);
        if (p.accountName) lines.push(`Account name: ${p.accountName}`);
        if (p.accountNumber) lines.push(`Account number: ${p.accountNumber}`);
        lines.push(`Reference: ${doc.number}`);
      }
    }
    lines.push('', 'Thank you.', p.name || '');
    return lines.join('\n').trim();
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  return {
    load, reload, subscribe, today,
    getProfile, updateProfile,
    listClients, getClient, findClientByName, saveClient, ensureClient, deleteClient,
    peekNumber, nextNumber, numberTaken,
    createDoc, getDoc, updateDoc, listDocs, dashboard, deleteDoc,
    markSent, markDraft, voidDoc, setQuoteStatus, recordPayment, deletePayment,
    duplicateDoc, convertQuote,
    setRecurring, listRecurring, getRecurringFor, runRecurring,
    addTime, updateTime, deleteTime, listTime, timeSummary,
    getTimer, startTimer, updateTimer, stopTimer, timerElapsedMs, invoiceFromTime,
    setPending, takePending,
    exportJSON, importJSON, invoicesCSV, timeCSV, shareText,
  };
}

/* One shared store per page, backed by localStorage. */
let shared = null;
export function getStore() {
  if (!shared) {
    let storage = null;
    try { storage = globalThis.localStorage || null; } catch { storage = null; }
    shared = createStore({ storage });
    try {
      globalThis.addEventListener?.('storage', (e) => { if (e.key === STORAGE_KEY) shared.reload(); });
    } catch { /* not in a browser */ }
  }
  return shared;
}
