/* ============================================================
   Vehicle part search — turns what a driver or mechanic calls a
   part ("sump", "fan belt", "cat", "front left pads") into the
   package's component, with the spec-sheet rows that go with it.
   Used by the Assistant's vehicle_part tool.
   ============================================================ */

// What people call a part → words the package uses.
const SYNONYMS = [
  [/\bbonnet\b/, 'hood'], [/\bhood\b/, 'bonnet'],
  [/\bboot\b/, 'trunk'], [/\btrunk\b/, 'boot'],
  [/\btires?\b/, 'tyre'], [/\bwing\b/, 'fender'], [/\bsill\b/, 'rocker'],
  [/\bsump\b/, 'oil pan'], [/\bcat\b|\bcatalyst\b/, 'catalytic converter'],
  [/\b(fan|serpentine|accessory|alternator|v-?ribbed) belt\b/, 'drive belt'],
  [/\bcv (joint|axle|shaft)\b|\bhalf ?shaft\b|\baxle shaft\b/, 'driveshaft'],
  [/\bshocks?\b|\bdampers?\b/, 'strut shock absorber'], [/\banti-?roll\b|\bsway bar\b/, 'stabiliser'],
  [/\bstabili[sz]er\b/, 'stabiliser'], [/\bo2\b|\blambda\b|\ba\/f sensor\b/, 'oxygen sensors'],
  [/\bcoil packs?\b/, 'ignition coils'], [/\bplugs?\b/, 'spark plugs'], [/\bfuses?\b|\brelays?\b/, 'fuse relay box'],
  [/\bgearbox\b|\btransmission\b|\bcvt\b/, 'transaxle'], [/\bwishbone\b|\bcontrol arm\b|\ba-?arm\b/, 'lower control arm'],
  [/\brotors?\b/, 'brake disc'], [/\bpads?\b/, 'brake pads'], [/\bcalipers?\b/, 'brake caliper'],
  [/\bab?s pump\b|\bab?s module\b/, 'abs actuator'], [/\bpower steering\b|\beps\b/, 'steering column eps'],
  [/\brack\b/, 'steering rack'], [/\btrack rod\b|\btie ?rods?\b/, 'tie rod'],
  [/\bwheel bearings?\b/, 'wheel hub bearing'], [/\bheadlights?\b/, 'headlamp'], [/\btail ?lights?\b|\bbrake lights?\b/, 'tail lamp'],
  [/\bfog ?lights?\b/, 'fog lamp'], [/\bmirrors?\b/, 'mirror'], [/\bwindscreen\b|\bwindshield\b/, 'windscreen glass'],
  [/\bexpansion tank\b|\boverflow\b/, 'coolant reservoir'], [/\bantifreeze\b/, 'coolant'],
  [/\bbattery\b/, 'battery 12v'], [/\bstarter\b/, 'starter motor'], [/\bmuffler\b|\bsilencer\b|\bback box\b/, 'muffler'],
  [/\bsubframe\b|\bcrossmember\b/, 'subframe suspension member'], [/\bdipstick\b/, 'oil dipstick'],
  [/\bthrottle\b/, 'throttle body'], [/\bair box\b/, 'air cleaner housing'], [/\bcabin filter\b|\bpollen filter\b/, 'cabin air filter'],
  [/\bhandbrake\b|\bemergency brake\b|\be-?brake\b/, 'parking brake lever'], [/\bspare\b/, 'spare wheel'],
  [/\bjack\b/, 'jack and tools'], [/\bengine mounts?\b|\bgearbox mounts?\b/, 'engine mounts'], [/\bgear ?(stick|lever|shifter)\b/, 'gear selector'],
];
// Which spec-sheet rows go with which parts (matched on component ids).
const SPEC_LINKS = [
  [/oil/, ['Engine oil', 'Oil filter']], [/spark|ignition/, ['Spark plugs', 'Firing order']],
  [/coolant|radiator|water_pump|cooling/, ['Coolant']], [/^fuel/, ['Fuel tank']],
  [/brake/, ['Brakes']], [/tyre|wheel_hub|spare/, ['Tyres', 'Wheel fastening']],
  [/engine_block|cylinder_head|valve_cover|timing|crankshaft|intake_manifold|throttle/, ['Code', 'Type', 'Bore × stroke', 'Compression', 'Valvetrain', 'Output', 'LE Eco']],
  [/transaxle|gear_selector|driveshaft/, ['Transmissions']], [/strut|spring|shock|control_arm|stabil|torsion|trailing/, ['Suspension']],
  [/steering|tie_rod/, ['Steering', 'Turning circle']], [/airbag/, ['Airbags']], [/headlamp|fog|tail_lamp/, ['Headlamps']],
  [/audio|touchscreen/, ['Audio']],
];
const STOP = new Set('the a an of my on in at to for is it where whats what\'s what this that do does and or with car toyota corolla part parts located location find show me how can i replace change check'.split(' '));
const words = (s) => (String(s || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []);

/** Expands a query with the package's own words for the part. */
export function expandQuery(query) {
  const q = String(query || '').toLowerCase();
  const extra = SYNONYMS.filter(([rx]) => rx.test(q)).map(([, w]) => w);
  return `${q} ${extra.join(' ')}`;
}

/**
 * Best component for a query. components: the manifest's list.
 * Returns { component, alternatives: [component], score } or null.
 */
export function findPart(components, query) {
  const expanded = expandQuery(query);
  const qw = words(expanded).filter(w => !STOP.has(w));
  if (!qw.length) return null;
  const side = /\bleft\b|\bdriver'?s?\b/.test(expanded) ? 'left' : /\bright\b|\bpassenger'?s?\b/.test(expanded) ? 'right' : null;
  const end = /\bfront\b/.test(expanded) ? 'front' : /\brear\b|\bback\b/.test(expanded) ? 'rear' : null;
  const scored = components.map((c) => {
    const label = new Set(words(`${c.label} ${c.id.replace(/_/g, ' ')}`));
    const rest = new Set(words(`${c.category} ${c.description || ''} ${c.location || ''}`));
    let s = 0;
    for (const w of qw) {
      if (label.has(w)) s += 3;
      else if ([...label].some(l => l.length > 3 && w.length > 3 && (l.startsWith(w) || w.startsWith(l)))) s += 1.5;
      else if (rest.has(w)) s += 0.5;
    }
    if (s > 0) {
      const id = c.id;
      if (side && new RegExp(`_${side}\\b|_${side}$`).test(id)) s += 1;
      if (side && new RegExp(`_${side === 'left' ? 'right' : 'left'}\\b|_${side === 'left' ? 'right' : 'left'}$`).test(id)) s -= 1;
      if (end && id.includes(end)) s += 0.8;
      if (end && id.includes(end === 'front' ? 'rear' : 'front')) s -= 0.8;
    }
    return { c, s };
  }).filter(x => x.s >= 2.5).sort((a, b) => b.s - a.s || a.c.id.length - b.c.id.length);
  if (!scored.length) return null;
  return { component: scored[0].c, score: scored[0].s, alternatives: scored.slice(1, 6).map(x => x.c) };
}

/** Spec-sheet rows that belong with a component, as [group, label, value]. */
export function specRowsFor(specSheet, component) {
  if (!specSheet?.groups || !component) return [];
  const key = component.id;
  const wanted = new Set(SPEC_LINKS.filter(([rx]) => rx.test(key)).flatMap(([, rows]) => rows));
  const out = [];
  for (const g of specSheet.groups) for (const [label, value] of g.rows || []) if (wanted.has(label)) out.push([g.title, label, value]);
  return out;
}
