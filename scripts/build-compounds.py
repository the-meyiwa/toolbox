#!/usr/bin/env python3
"""Build the chemical compound datasets from published, citable sources.

Outputs
  js/lib/compounds-dataset.js         Curated compounds grouped by field of use
                                      (bundled with the app).
  public/data/compounds-extended.json Every compound in the source tables
                                      (~76k), loaded lazily by the tool.

Sources (all shipped in the MIT-licensed `chemicals` package by Caleb Bell)
  Identifiers   PubChem-derived identifier tables (CID, CAS, formula, MW, IUPAC
                name, synonyms).
  Properties    CRC Handbook physical constants, CAS Common Chemistry, NIST
                WebBook, Wikidata, Yaws boiling points, Open Notebook melting
                points.
  Safety        IARC Monographs carcinogen classifications, NTP Report on
                Carcinogens, Ontario occupational exposure limits, DIPPR / IEC
                60079-20-1 / NFPA 497 flash points.

The curated lists in scripts/compounds/*.txt only name compounds and describe
their use; every identifier and property comes from the tables above. Names the
tables do not know ship as lookup stubs that the tool resolves live from
PubChem.

Usage
  python3 -m pip install chemicals==1.5.2
  python3 scripts/build-compounds.py
"""

import csv
import json
import os
import re
import sys

try:
    import chemicals
except ImportError:
    sys.exit('Install the source data first: python3 -m pip install chemicals==1.5.2')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.dirname(chemicals.__file__)
LISTS = os.path.join(ROOT, 'scripts', 'compounds')

FIELDS = [
    # (list file, field name) in priority order for the primary category.
    ('pharmaceutical', 'Pharmaceutical'),
    ('agricultural', 'Agricultural'),
    ('food', 'Food & Nutrition'),
    ('cosmetic', 'Cosmetic & Personal Care'),
    ('laboratory', 'Laboratory Reagent'),
    ('industrial', 'Industrial'),
    ('materials', 'Materials'),
    ('biochemical', 'Biochemical'),
    ('toxic', 'Toxic & Hazardous'),
]

HANDLING = {
    'cyanide': 'Handle only in a fume hood under a written cyanide procedure, never alone. Keep acids away, since they release hydrogen cyanide gas. Wear nitrile gloves, goggles and a lab coat. On exposure, move the person to fresh air and call emergency services; cyanide antidotes such as hydroxocobalamin are given by medical staff.',
    'toxic-gas': 'Use only in a ventilated gas cabinet or fume hood with gas detection. Emergency responders need self-contained breathing apparatus. Move exposed people to fresh air and get medical care, because lung injury can appear hours later.',
    'nerve-agent': 'Prohibited chemical weapon under the Chemical Weapons Convention; possession is limited to authorized protective-research facilities. Any exposure is a medical emergency: evacuate, decontaminate and call emergency services. Atropine and pralidoxime are given by medical staff.',
    'vesicant': 'Prohibited chemical weapon under the Chemical Weapons Convention. Any exposure is a medical emergency: evacuate, remove contaminated clothing, decontaminate skin and eyes at once and call emergency services. Symptoms can be delayed by hours.',
    'organophosphate': 'Cholinesterase inhibitor. Wear chemical-resistant gloves, coveralls and the respiratory protection the label requires. Warning signs are pinpoint pupils, drooling, sweating and muscle twitching. Get emergency care; atropine is given by medical staff.',
    'pesticide-toxic': 'Restricted-use pesticide in many countries. Avoid swallowing, skin contact and dust. Store locked away from food and feed. Get medical care immediately after any exposure and bring the label.',
    'heavy-metal': 'Avoid breathing dust or fume: work in a fume hood or with local exhaust ventilation. Wear nitrile gloves and goggles, and wash hands before eating. Collect waste as hazardous heavy-metal waste and never pour it down the drain.',
    'carcinogen': 'Keep exposure as low as possible: use a closed system or fume hood, a designated and labelled work area, and gloves rated for this chemical. Follow local occupational exposure limits.',
    'solvent-toxic': 'Use with good ventilation or in a fume hood, away from ignition sources. Wear solvent-resistant gloves and goggles. Get medical care after swallowing any amount.',
    'corrosive': 'Causes severe burns. Wear resistant gloves, goggles and a face shield. When diluting acids, add acid to water, never the reverse. Flush skin or eyes with water for at least 15 minutes and get medical care.',
    'oxidizer': 'Keep away from fuels, organic material, reducing agents and heat, and store it separately. Wear goggles and gloves. Contaminated clothing can ignite.',
    'pyrophoric': 'Handle under an inert atmosphere (glovebox or Schlenk line) away from air and water, and never alone. Keep a Class D extinguisher or dry sand at hand; do not use water.',
    'toxic-solid': 'Highly toxic: weigh in a fume hood and avoid dust. Wear gloves and goggles. Keep away from acids and metals. Get medical care immediately after any exposure.',
    'toxin': 'Highly toxic in small amounts. Avoid swallowing, breathing dust and skin contact; handle in a fume hood or biosafety cabinet with gloves. After any exposure contact a poison center or emergency services.',
    'radioactive': 'Radioactive material for licensed use only. Use shielding, contamination monitoring and designated areas, and avoid ingestion or inhalation. Follow your radiation safety officer\'s procedures.',
}

IARC = {1: 'IARC Group 1: carcinogenic to humans', 11: 'IARC Group 2A: probably carcinogenic',
        12: 'IARC Group 2B: possibly carcinogenic'}
NTP = {1: 'NTP: known human carcinogen', 2: 'NTP: reasonably anticipated human carcinogen'}


def read_tsv(path, delimiter='\t'):
    with open(path, encoding='utf8') as f:
        return list(csv.DictReader(f, delimiter=delimiter))


def num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


# ---------------------------------------------------------------- identifiers
def load_identifiers():
    db = {}
    # Exact common names win over IUPAC names, which win over synonyms, so
    # 'sulfur' resolves to the element rather than to a compound listing it
    # as a synonym.
    by_name = ({}, {}, {})
    folder = os.path.join(SRC, 'Identifiers')
    files = ['chemical identifiers pubchem small.tsv', 'chemical identifiers pubchem large.tsv',
             'Inorganic db.tsv', 'chemical identifiers example user db.tsv']
    for fn in files:
        with open(os.path.join(folder, fn), encoding='utf8') as f:
            for line in f:
                r = line.rstrip('\n').split('\t')
                if len(r) < 9 or r[1] in db:
                    continue
                cid, cas, formula, mw, smiles, _inchi, key, iupac, common = r[:9]
                syn = [s for s in r[9:] if s]
                db[cas] = {
                    'cid': int(cid) if int(cid) > 0 else None,
                    'cas': cas, 'formula': formula, 'mw': round(float(mw), 3),
                    'iupac': iupac, 'name': common, 'syn': syn,
                }
                for tier, names in enumerate([[common], [iupac], syn]):
                    for n in names:
                        by_name[tier].setdefault(n.lower().strip(), cas)
    return db, by_name


# ----------------------------------------------------------------- properties
def load_properties():
    tm, tb, rho = {}, {}, {}

    def put(store, cas, value):
        if value is not None and cas not in store:
            store[cas] = value

    misc = os.path.join(SRC, 'Misc')
    for fn in ['Physical Constants of Organic Compounds.csv', 'Physical Constants of Inorganic Compounds.csv',
               'wikidata_properties.tsv']:
        for r in read_tsv(os.path.join(misc, fn)):
            put(tm, r['CAS'], num(r.get('Tm')))
            put(tb, r['CAS'], num(r.get('Tb')))
            put(rho, r['CAS'], num(r.get('rho')))
    for r in read_tsv(os.path.join(SRC, 'Phase Change', 'Yaws Boiling Points.tsv')):
        put(tb, r['CAS'], num(r['Tb']))
    for r in read_tsv(os.path.join(SRC, 'Phase Change', 'OpenNotebook Melting Points.tsv')):
        put(tm, r['CAS'], num(r['Tm']))
    # CAS Common Chemistry and the NIST WebBook store CAS numbers without dashes.
    for fn in ['common_chemistry_data.tsv', 'webbook_constants.tsv']:
        for r in read_tsv(os.path.join(misc, fn)):
            cas = dashed(r['CAS'])
            put(tm, cas, num(r.get('Tm')))
            put(tb, cas, num(r.get('Tb')))
    return tm, tb, rho


def dashed(cas):
    cas = str(cas).strip()
    if '-' in cas or len(cas) < 5:
        return cas
    return f'{cas[:-3]}-{cas[-3:-1]}-{cas[-1]}'


def load_safety():
    folder = os.path.join(SRC, 'Safety')
    iarc = {r['CAS']: int(r['group']) for r in read_tsv(os.path.join(folder, 'IARC Carcinogen Database.tsv'))}
    ntp = {r['CAS']: int(r['Listing']) for r in read_tsv(os.path.join(folder, 'National Toxicology Program Carcinogens.tsv'))}
    flash = {}
    for fn, sep in [('DIPPR T_flash Serat.csv', '\t'), ('IS IEC 60079-20-1 2010.tsv', '\t'), ('NFPA 497 2008.tsv', '\t')]:
        for r in read_tsv(os.path.join(folder, fn), sep):
            v = num(r.get('T_flash'))
            if v is not None:
                flash.setdefault(r['CAS'], v)
    with open(os.path.join(folder, 'Ontario Exposure Limits.json'), encoding='utf8') as f:
        oel = json.load(f)
    return iarc, ntp, flash, oel


# ------------------------------------------------------------------ formatting
def c_from_k(k):
    return None if k is None else round(k - 273.15, 1)


def density_g_cm3(kg_m3):
    # Gas densities at STP (under 0.05 g/cm³) read as 0.001-style noise; skip them.
    if kg_m3 is None or kg_m3 < 50:
        return None
    return round(kg_m3 / 1000, 3)


def oel_text(entry):
    if not entry:
        return None
    parts = []
    for label, key in [('TWA', 'TWA'), ('STEL', 'STEL'), ('Ceiling', 'Ceiling')]:
        ppm, mg = entry.get(f'{key} (ppm)'), entry.get(f'{key} (mg/m^3)')
        # The source converts between ppm and mg/m³; show whichever unit the
        # limit was set in (the round one).
        if ppm and (not mg or float(f'{ppm:.3g}') == ppm):
            parts.append(f'{label} {ppm:g} ppm')
        elif mg:
            parts.append(f'{label} {mg:.3g} mg/m³')
    if not parts:
        return None
    text = 'Ontario OEL ' + ', '.join(parts)
    return text + ' (skin)' if entry.get('Skin') else text


ACRONYMS = {'ddt', 'deet', 'edta', 'egta', 'dapi', 'mops', 'mes', 'pipes', 'caps', 'hepes', 'chaps', 'iptg',
            'dbcp', 'mcpa', 'vx', 'pcb', 'msg', 'bha', 'bht', 'tbhq', 'dmdm', 'pca', 'fcf', 'ac', 'x-gal'}


def display_name(name):
    """Capitalize a lowercase source name without mangling locants or acronyms."""
    if not name:
        return name
    name = ' '.join(w.upper() if w in ACRONYMS else w for w in name.split(' '))
    out = re.sub(r'-([a-z])$', lambda m: '-' + m.group(1).upper(), name)
    out = re.sub(r'(?<![a-z])([a-z])(?=[a-z])', lambda m: m.group(1).upper(), out, count=1)
    return out


# --------------------------------------------------------------- curated lists
def read_list(key):
    rows = []
    with open(os.path.join(LISTS, f'curated-{key}.txt'), encoding='utf8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            rows.append([p.strip() for p in line.split('|')])
    return rows


def name_variants(name):
    n = name.lower()
    yield n
    yield n.replace('aluminium', 'aluminum')
    yield n.replace('caesium', 'cesium')
    yield n.replace('sulphur', 'sulfur')
    yield re.sub(r'^[ld]-', '', n)
    yield re.sub(r'^(l|d|dl)-', 'l-', n)
    yield n.replace(' acid', 'ic acid') if not n.endswith('ic acid') else n
    yield n.replace('(ii)', '').replace('(iii)', '').replace('(iv)', '').replace('(i)', '').replace('  ', ' ').strip()


# Reviewed with `-v`: synonym matches that land on the wrong compound. Mixtures,
# polymers and minerals have no single record, so they stay live stubs.
CAS_OVERRIDES = {'mercury(ii) chloride': '7487-94-7'}
NO_MATCH = {'sulfur', 'xanthan gum', 'carbomer', 'mica', 'dimethicone', 'giemsa stain', 'hyaluronic acid',
            'quinoline yellow', 'iron oxide black', 'n-acetylglucosamine'}


def resolve(name, by_name):
    key = name.lower()
    if key in CAS_OVERRIDES:
        return CAS_OVERRIDES[key]
    if key in NO_MATCH:
        return None
    for tier in by_name:
        for v in name_variants(name):
            if v in tier:
                return tier[v]
    return None


def main():
    db, by_name = load_identifiers()
    tm, tb, rho = load_properties()
    iarc, ntp, flash, oel = load_safety()

    def hazard_notes(cas):
        notes = []
        if cas in iarc and iarc[cas] in IARC:
            notes.append(IARC[iarc[cas]])
        if cas in ntp:
            notes.append(NTP[ntp[cas]])
        t = oel_text(oel.get(cas))
        if t:
            notes.append(t)
        fp = c_from_k(flash.get(cas))
        if fp is not None and fp < 60:
            notes.append(f'Flammable (flash point {fp:g} °C)')
        return notes

    curated, by_key, unresolved = [], {}, []
    for key, field in FIELDS:
        for row in read_list(key):
            name, use = row[0], row[1]
            cas = resolve(name, by_name)
            rec_key = cas or f'name:{name.lower()}'
            rec = by_key.get(rec_key)
            if rec is None:
                rec = {'name': display_name(name), 'category': field, 'fields': [], 'uses': []}
                if cas:
                    d = db[cas]
                    rec.update({
                        'cas': cas, 'cid': d['cid'], 'formula': d['formula'], 'molarMass': d['mw'],
                        'iupac': d['iupac'],
                        'melt': c_from_k(tm.get(cas)), 'boil': c_from_k(tb.get(cas)),
                        'density': density_g_cm3(rho.get(cas)),
                        'flash': c_from_k(flash.get(cas)),
                    })
                else:
                    rec['live'] = True
                    unresolved.append(f'{key}: {name}')
                by_key[rec_key] = rec
                curated.append(rec)
            if field not in rec['fields']:
                rec['fields'].append(field)
            if key == 'toxic':
                profile, note = row[1], row[2]
                rec['toxicProfile'] = profile
                rec['handling'] = HANDLING[profile]
                rec['uses'].append(note)
            elif use not in rec['uses']:
                rec['uses'].append(use)

    for rec in curated:
        notes = hazard_notes(rec.get('cas'))
        if rec.get('toxicProfile') and 'Toxic & Hazardous' not in rec['fields']:
            rec['fields'].append('Toxic & Hazardous')
        if any(n.startswith(('IARC Group 1', 'NTP: known')) for n in notes) and 'Toxic & Hazardous' not in rec['fields']:
            rec['fields'].append('Toxic & Hazardous')
        rec['hazards'] = notes
        parts = [p for u in rec.pop('uses') for p in u.split('; ')]
        rec['use'] = '; '.join(dict.fromkeys(parts))
        for k in [k for k, v in rec.items() if v is None or v == []]:
            del rec[k]

    # ------------------------------------------------------------ extended table
    cols = ['cid', 'cas', 'name', 'formula', 'mw', 'iupac', 'melt', 'boil', 'density', 'hazard', 'synonyms']
    rows = []
    for cas, d in db.items():
        if not d['formula']:
            continue
        name = d['name'] or (d['syn'][0] if d['syn'] else d['iupac'])
        # Two short synonyms keep brand and trivial names searchable without
        # tripling the file size; long IUPAC names are left to the live lookup.
        syn = [s for s in d['syn'] if s != name and len(s) <= 40 and not re.fullmatch(r'[\d-]+', s)][:2]
        rows.append([
            d['cid'], cas, display_name(name), d['formula'], d['mw'],
            d['iupac'] if d['iupac'] != name and len(d['iupac']) <= 80 else '',
            c_from_k(tm.get(cas)), c_from_k(tb.get(cas)), density_g_cm3(rho.get(cas)),
            '; '.join(hazard_notes(cas)), '|'.join(syn),
        ])
    rows.sort(key=lambda r: r[2].lower())

    os.makedirs(os.path.join(ROOT, 'public', 'data'), exist_ok=True)
    ext_path = os.path.join(ROOT, 'public', 'data', 'compounds-extended.json')
    with open(ext_path, 'w', encoding='utf8') as f:
        json.dump({'version': 1, 'source': 'chemicals ' + chemicals.__version__, 'columns': cols, 'rows': rows},
                  f, ensure_ascii=False, separators=(',', ':'))

    js_path = os.path.join(ROOT, 'js', 'lib', 'compounds-dataset.js')
    with open(js_path, 'w', encoding='utf8') as f:
        f.write('/* Generated by scripts/build-compounds.py. Do not edit by hand.\n\n'
                '   Curated compounds grouped by field of use. Identifiers and properties come\n'
                '   from PubChem-derived tables, the CRC Handbook, CAS Common Chemistry, NIST,\n'
                '   IARC, NTP and Ontario exposure limits via the MIT-licensed `chemicals`\n'
                '   package. Temperatures are in °C and densities in g/cm³. Records with\n'
                '   `live: true` are not in the offline tables and resolve from PubChem. */\n\n')
        f.write('export const COMPOUND_FIELDS = ' + json.dumps([f for _, f in FIELDS]) + ';\n\n')
        f.write('export const COMPOUNDS_DATA = ')
        f.write(json.dumps(curated, ensure_ascii=False, indent=1))
        f.write(';\n')

    print(f'curated: {len(curated)} ({len(unresolved)} live stubs)')
    print(f'extended: {len(rows)} rows, {os.path.getsize(ext_path) / 1e6:.1f} MB')
    print(f'module: {os.path.getsize(js_path) / 1e6:.2f} MB')
    if '-v' in sys.argv:
        print('\n'.join(unresolved))
        for rec in curated:
            if rec.get('cas') and db[rec['cas']]['name'].lower() != rec['name'].lower():
                print(f"  {rec['name']!r} -> {db[rec['cas']]['name']!r} {rec['formula']}")


if __name__ == '__main__':
    main()
