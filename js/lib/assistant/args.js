/* ============================================================
   TOOLBOX — Assistant tool arguments

   Models do not always send what a tool's schema asks for: a
   number where a string is expected ("name": 2024), a string
   where a number is ("amount": "₦1,500"), a single value where
   a list is, "true" for a boolean, null for anything, a JSON
   object as a string. Tools written for the declared types then
   crash with "x.trim is not a function" or print "undefined",
   "NaN" or "[object Object]" back to the person.

   Every tool call passes through coerceArgs with that tool's own
   (normalised JSON-Schema) parameters before it runs, so each
   tool receives the types it declared, and a call missing a
   required argument gets a clear message instead of a crash.
   ============================================================ */

const typeOf = (schema) => String(schema?.type || '').toLowerCase();

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return undefined;
    // "₦1,500.50", "1 500", "45%", "3.2e4"
    const cleaned = t.replace(/[\s,_]|[₦$€£¥]|^NGN|%$/gi, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  if (Array.isArray(v) && v.length === 1) return toNumber(v[0]);
  return undefined;
}

function toStringValue(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : undefined;
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(toStringValue).filter(x => x !== undefined && x !== '');
    return parts.length ? parts.join(', ') : undefined;
  }
  if (v && typeof v === 'object') {
    // {text: "…"} / {value: "…"} wrappers, else the JSON.
    for (const k of ['text', 'value', 'content', 'name', 'query']) if (typeof v[k] === 'string') return v[k];
    try { const s = JSON.stringify(v); return s === '{}' ? undefined : s; } catch { return undefined; }
  }
  return undefined;
}

function toBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : undefined;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(t)) return true;
    if (['false', 'no', 'off', '0'].includes(t)) return false;
  }
  return undefined;
}

function coerceValue(v, schema, depth) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && !Number.isFinite(v)) return undefined;
  if (!schema || depth > 8) return v;
  const t = typeOf(schema);
  let out;
  switch (t) {
    case 'string': out = toStringValue(v); break;
    case 'number': case 'integer': {
      out = toNumber(v);
      if (out !== undefined && t === 'integer') out = Math.round(out);
      break;
    }
    case 'boolean': out = toBoolean(v); break;
    case 'array': {
      let list = v;
      if (typeof v === 'string') {
        const s = v.trim();
        if (s.startsWith('[')) { try { list = JSON.parse(s); } catch { list = [v]; } } else list = s ? [v] : [];
      }
      if (!Array.isArray(list)) list = [list];
      out = list.map(x => coerceValue(x, schema.items, depth + 1)).filter(x => x !== undefined);
      break;
    }
    case 'object': {
      let obj = v;
      if (typeof v === 'string') { try { obj = JSON.parse(v); } catch { obj = undefined; } }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { out = undefined; break; }
      out = schema.properties && Object.keys(schema.properties).length ? coerceObject(obj, schema, depth + 1).args : obj;
      break;
    }
    default: out = v;
  }
  if (out !== undefined && Array.isArray(schema.enum) && schema.enum.length && t !== 'array') {
    const hit = schema.enum.find(e => String(e) === String(out)) ?? schema.enum.find(e => String(e).toLowerCase() === String(out).trim().toLowerCase());
    out = hit === undefined ? undefined : (t === 'number' || t === 'integer' ? Number(hit) : hit);
  }
  return out;
}

function coerceObject(args, schema, depth) {
  const props = schema?.properties || {};
  const out = {};
  const extraKeys = [];
  for (const [k, v] of Object.entries(args)) {
    if (k in props) {
      const c = coerceValue(v, props[k], depth);
      if (c !== undefined) out[k] = c;
    } else if (v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))) {
      out[k] = v;   // aliases tools accept but do not declare (e.g. "project" for "projectName")
      if (typeof v !== 'string' || v.trim()) extraKeys.push(k);
    }
  }
  // A plausible alternate spelling can cover a required field. An unrelated
  // extra property must not hide a missing argument from the model.
  const similar = (a, b) => {
    const x = a.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const y = b.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return Math.min(x.length, y.length) >= 3 && (x === y || x.startsWith(y) || x.endsWith(y) || y.startsWith(x) || y.endsWith(x));
  };
  const missing = (Array.isArray(schema?.required) ? schema.required : []).filter(k => {
    const v = out[k];
    const absent = v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    return absent && !extraKeys.some(other => similar(k, other));
  });
  return { args: out, missing };
}

/**
 * Coerces a tool call's arguments to the tool's declared schema.
 * Returns { args, missing } — missing lists required parameters still absent.
 */
export function coerceArgs(args, schema) {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  if (!schema || typeof schema !== 'object') return { args: input, missing: [] };
  return coerceObject(input, schema, 0);
}

/** The result a tool call gets when required arguments are missing. */
export function missingArgsResult(name, missing, schema) {
  const describe = (k) => {
    const d = schema?.properties?.[k]?.description;
    return d ? `${k} (${String(d).split(/[.;]/)[0].slice(0, 80)})` : k;
  };
  return {
    status: 'error',
    success: false,
    error: 'missing_arguments',
    missing,
    message: `${name} needs ${missing.map(describe).join(', ')}. Call it again with ${missing.length === 1 ? 'that' : 'those'} filled in.`,
  };
}
