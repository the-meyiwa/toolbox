/* ============================================================
   Container Builder — parts library and presets (pure data, no DOM)

   Every part the Builder can place, with its default size, how it is
   priced, how it is built and what to check. Five kinds:

     opening   cut through a wall (wall, along, sill, w, h)
     fitting   stands on the floor inside (x, z, rot; w × d × h)
     facade    fixed to the outside of a wall, no cut (wall, along, sill, w, h)
     roof      sits on the unit's roof (x, z, w, d)
     site      stands on the site around the units (x, z, rot, w, d, h)

   Sizes are metres. Rates are material + labour in NGN, the same
   basis as container-catalog.js, and every one is editable in the
   Rates tab. `unit` is how a part is priced: each | area (m² of
   w × h, or w × d on plan) | length (m of w) | panel.

   The construction notes (`how`) summarise common practice for
   converted ISO containers: cutting openings and welding frames back
   in, stacking on the corner castings, cantilevers, mezzanines,
   roof decks. They are guidance for early design, not a substitute
   for an engineer's drawings.
   ============================================================ */

/* ISO 668 external sizes and ISO internal clear sizes, metres. */
export const EXT = {
  '10ft': { len: 2.991, wid: 2.438, hgt: 2.591 },
  '20ft': { len: 6.058, wid: 2.438, hgt: 2.591 },
  '40ft': { len: 12.192, wid: 2.438, hgt: 2.591 },
  '40hc': { len: 12.192, wid: 2.438, hgt: 2.896 },
  '45hc': { len: 13.716, wid: 2.438, hgt: 2.896 },
};

export const UNIT_TYPES = [
  { group: 'Shipping containers', items: [
    { id: '10ft', name: '10 ft container', len: 2.831, wid: 2.352, hgt: 2.393, shell: 'buy-20' },
    { id: '20ft', name: '20 ft container', len: 5.898, wid: 2.352, hgt: 2.393, shell: 'buy-20' },
    { id: '40ft', name: '40 ft container', len: 12.032, wid: 2.352, hgt: 2.393, shell: 'buy-40' },
    { id: '40hc', name: '40 ft high cube', len: 12.032, wid: 2.352, hgt: 2.698, shell: 'buy-40hc' },
    { id: '45hc', name: '45 ft high cube', len: 13.556, wid: 2.352, hgt: 2.698, shell: 'buy-40hc' },
  ] },
  { group: 'Portacabins', items: [
    { id: 'pc12', name: '12 × 8 ft cabin', len: 3.658, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
    { id: 'pc16', name: '16 × 8 ft cabin', len: 4.877, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
    { id: 'pc20', name: '20 × 8 ft cabin', len: 6.096, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
    { id: 'pc24', name: '24 × 9 ft cabin', len: 7.315, wid: 2.743, hgt: 2.5, shell: 'fabricate' },
    { id: 'pc32', name: '32 × 10 ft cabin', len: 9.754, wid: 3.048, hgt: 2.5, shell: 'fabricate' },
  ] },
];
export const UNIT_TYPE = Object.fromEntries(UNIT_TYPES.flatMap(g => g.items).map(u => [u.id, u]));

/** External size of a unit (ISO table, or internal size plus a fabricated frame for cabins). */
export function extOf(u) {
  const iso = EXT[u.preset];
  return iso ? { ...iso } : { len: u.len + 0.12, wid: u.wid + 0.12, hgt: u.hgt + 0.26 };
}

export const WALLS = [
  { id: 'front', name: 'Front (door end)' },
  { id: 'back', name: 'Back end' },
  { id: 'left', name: 'Left side' },
  { id: 'right', name: 'Right side' },
];

export const SHELL_COLORS = [
  { id: 'green', name: 'Green', hex: 0x3f6b52 }, { id: 'blue', name: 'Blue', hex: 0x2f5f86 },
  { id: 'red', name: 'Red', hex: 0x8d3a32 }, { id: 'grey', name: 'Grey', hex: 0x6f7479 },
  { id: 'white', name: 'White', hex: 0xdedbd4 }, { id: 'sand', name: 'Sand', hex: 0xbfa87e },
  { id: 'charcoal', name: 'Charcoal', hex: 0x2e3134 }, { id: 'black', name: 'Black', hex: 0x1b1c1e },
  { id: 'olive', name: 'Olive', hex: 0x5b5f3a }, { id: 'corten', name: 'Corten rust', hex: 0x8a4b2a },
];

/* Library categories, in sidebar order. */
export const CATEGORIES = [
  { id: 'doors', name: 'Doors' },
  { id: 'glazing', name: 'Windows & glazing' },
  { id: 'cuts', name: 'Structural openings' },
  { id: 'living', name: 'Living & dining' },
  { id: 'kitchen', name: 'Kitchen & bath' },
  { id: 'sleep', name: 'Sleeping & storage' },
  { id: 'work', name: 'Work & commercial' },
  { id: 'levels', name: 'Mezzanines & stairs' },
  { id: 'facade', name: 'Facade' },
  { id: 'roof', name: 'Roof' },
  { id: 'outdoor', name: 'Decks & outdoor' },
  { id: 'site', name: 'Site & services' },
];

const P = (o) => o;

/* ---------------- the parts ---------------- */

export const PARTS = [
  /* ----- doors ----- */
  P({ id: 'personnel-door', kind: 'opening', cat: 'doors', name: 'Door', w: 0.9, h: 2.0, sill: 0, rate: 185000, labour: 38000,
    spec: 'Steel security door, 900 × 2100', how: 'Cut the opening, weld a 50 × 50 × 3 mm RHS frame into the cut, then hang the door on the frame and seal it with a drip flashing over the head.' }),
  P({ id: 'glass-door', kind: 'opening', cat: 'doors', name: 'Glazed entrance door', w: 0.9, h: 2.1, sill: 0, glazed: true, rate: 260000, labour: 45000,
    spec: 'Aluminium glazed door, double glazed, 900 × 2100', how: 'Same RHS frame as a steel door; fix the aluminium sub-frame to it with a thermal break strip so the steel does not bridge heat to the frame.' }),
  P({ id: 'double-door', kind: 'opening', cat: 'doors', name: 'Double door', w: 1.8, h: 2.0, sill: 0, rate: 320000, labour: 56000, spec: 'Double leaf door, 1800 × 2100',
    how: 'A 1.8 m cut in a side wall takes out most of a corrugation bay: weld the frame in before cutting the second jamb so the wall cannot spring.' }),
  P({ id: 'french-door', kind: 'opening', cat: 'doors', name: 'French doors', w: 1.5, h: 2.1, sill: 0, glazed: true, rate: 520000, labour: 70000,
    spec: 'Aluminium French doors, double glazed, 1500 × 2100', how: 'Welded RHS frame; the head member carries the wall above, so over 1.2 m use a 100 × 50 RHS lintel.' }),
  P({ id: 'pivot-door', kind: 'opening', cat: 'doors', name: 'Pivot entrance door', w: 1.2, h: 2.3, sill: 0, rate: 950000, labour: 90000,
    spec: 'Oversized pivot door, 1200 × 2300', how: 'Needs a high cube (2.3 m leaf). The floor pivot is bolted through the plywood into a steel plate welded to the cross-members.' }),
  P({ id: 'sliding-door', kind: 'opening', cat: 'doors', name: 'Sliding patio door', w: 2.4, h: 2.1, sill: 0, glazed: true, rate: 780000, labour: 95000,
    spec: 'Thermally broken aluminium sliding door, low-E double glazed, 2400 × 2100',
    how: 'The signature container-home move: a long-wall slider. Weld HSS jambs and a 150 mm header into the cut; the wall above now spans the opening, so size the header for it. Flash the head and fit a sill tray over the bottom rail.' }),
  P({ id: 'bifold', kind: 'opening', cat: 'doors', name: 'Bi-fold glass wall', w: 3.6, h: 2.1, sill: 0, glazed: true, rate: 1650000, labour: 180000,
    spec: 'Aluminium bi-fold door set, 5 panels, 3600 × 2100',
    how: 'Treat anything over 2.4 m in a side wall as a structural opening: weld in a portal frame (HSS columns and an I-beam or 200 × 100 RHS head) before the corrugated panel is cut out, and check racking with an engineer.' }),
  P({ id: 'garage-door', kind: 'opening', cat: 'doors', name: 'Sectional garage door', w: 2.4, h: 2.1, sill: 0, rate: 980000, labour: 120000,
    spec: 'Insulated sectional overhead door, 2400 × 2100', how: 'Best in an end wall (the cargo doors come out). Keep the door header and corner posts; the tracks bolt to the inside of the corner posts.' }),
  P({ id: 'roller-door', kind: 'opening', cat: 'doors', name: 'Roller shutter', w: 2.2, h: 2.1, sill: 0, rate: 480000, labour: 85000, spec: 'Roller shutter door',
    how: 'The coil box sits under the roof inside the header; allow 350 mm of headroom above the opening.' }),
  P({ id: 'fold-down-deck', kind: 'opening', cat: 'doors', name: 'Fold-down deck wall', w: 2.4, h: 2.1, sill: 0, glazed: true, rate: 2400000, labour: 350000,
    spec: 'Hinged drop-down wall with winch, cables and glazed wall behind', deck: 2.0,
    how: 'The cut-out side panel is re-framed in RHS, hinged at floor level and lowered on two cables to become a deck; a glazed wall or slider closes the opening behind it. Size the hinge pins and cables for the deck’s live load (about 2.5 kN/m²) and add a lock-down for high winds.' }),

  /* ----- windows & glazing ----- */
  P({ id: 'window', kind: 'opening', cat: 'glazing', name: 'Window', w: 1.2, h: 1.0, sill: 0.95, glazed: true, rate: 95000, labour: 19000, spec: 'Aluminium sliding window, 1200 × 1000',
    how: 'Cut, weld a 50 × 50 RHS frame, fix the window to the frame with a sealed sub-sill and a drip flashing over the head.' }),
  P({ id: 'small-window', kind: 'opening', cat: 'glazing', name: 'Small window', w: 0.6, h: 0.6, sill: 1.3, glazed: true, rate: 48000, labour: 12000, spec: 'Aluminium window, 600 × 600',
    how: 'Bathroom-height window; use obscured glass.' }),
  P({ id: 'picture-window', kind: 'opening', cat: 'glazing', name: 'Picture window', w: 2.0, h: 1.4, sill: 0.6, glazed: true, rate: 420000, labour: 55000,
    spec: 'Fixed aluminium picture window, low-E double glazed, 2000 × 1400', how: 'A fixed pane frames a view without the cost of sliders. Welded RHS frame; over 1.2 m wide a lintel carries the wall above.' }),
  P({ id: 'box-window', kind: 'opening', cat: 'glazing', name: 'Box-frame window', w: 1.8, h: 1.2, sill: 0.7, glazed: true, rate: 620000, labour: 95000,
    spec: 'Picture window in a projecting 300 mm steel box frame', proj: 0.3,
    how: 'A folded 5 mm steel plate box welded around the opening projects 300 mm out: it shades the glass, hides the cut edge of the corrugation and reads from the street. Seal the head with a sloped cap.' }),
  P({ id: 'clerestory', kind: 'opening', cat: 'glazing', name: 'Clerestory ribbon window', w: 3.0, h: 0.45, sill: 1.85, glazed: true, rate: 280000, labour: 45000,
    spec: 'High-level ribbon window, 3000 × 450', how: 'A long, shallow cut just under the top rail brings daylight and cross-ventilation without losing wall for furniture. Keep 150 mm of corrugation under the top rail so it still acts as a beam.' }),
  P({ id: 'glass-wall', kind: 'opening', cat: 'glazing', name: 'Full-height glazing', w: 2.4, h: 2.1, sill: 0.1, glazed: true, unit: 'area', rate: 115000, labour: 22000,
    spec: 'Aluminium curtain wall, low-E double glazed', how: 'Full-height glazing replaces the wall, so the frame must carry it: HSS mullions at 1.2 m and a steel head beam. Ideal for end walls (cargo doors removed) where the end frame already carries the roof.' }),
  P({ id: 'serving-hatch', kind: 'opening', cat: 'glazing', name: 'Serving hatch', w: 1.8, h: 1.0, sill: 0.95, glazed: true, rate: 480000, labour: 70000,
    spec: 'Gas-strut awning hatch with counter', how: 'The cut panel is re-framed and hinged at the top on gas struts, becoming a shade awning when open.' }),
  P({ id: 'vent', kind: 'opening', cat: 'glazing', name: 'Air vent', w: 0.3, h: 0.25, sill: 2.0, rate: 12000, labour: 4500, spec: 'Louvre air vent',
    how: 'Cross-ventilate high on opposite walls; steel boxes sweat without it.' }),

  /* ----- structural openings ----- */
  P({ id: 'wall-removal', kind: 'opening', cat: 'cuts', name: 'Open wall (steel frame)', w: 4.8, h: 2.2, sill: 0, unit: 'length', rate: 185000, labour: 95000, open: true,
    spec: 'Remove side wall; weld in HSS columns and an I-beam header (per metre of opening)',
    how: 'Joins side-by-side units into one open plan. Every metre of corrugated wall removed is replaced by steel: HSS 100 × 100 columns at the ends (and every 3–4 m) with a UB header, welded top and bottom, restoring the rails as beams and stopping the box racking. Bolt or weld the two units together at floor and roof rails and cover the joint with a flashing.' }),
  P({ id: 'cutout', kind: 'opening', cat: 'cuts', name: 'Doorway to next unit', w: 1.2, h: 2.1, sill: 0, rate: 90000, labour: 60000, open: true,
    spec: 'Framed doorway through a shared wall', how: 'Cut both units’ walls in line and weld a common frame through; seal the gap between the units round the frame.' }),

  /* ----- living & dining ----- */
  P({ id: 'sofa', kind: 'fitting', cat: 'living', name: 'Sofa', w: 2.0, d: 0.9, h: 0.8, color: 0x7c7468, rate: 450000, labour: 0 }),
  P({ id: 'armchair', kind: 'fitting', cat: 'living', name: 'Armchair', w: 0.85, d: 0.85, h: 0.8, color: 0x8d8272, rate: 180000, labour: 0 }),
  P({ id: 'table', kind: 'fitting', cat: 'living', name: 'Dining table', w: 1.6, d: 0.8, h: 0.75, color: 0xb08d5f, rate: 125000, labour: 8000 }),
  P({ id: 'chair', kind: 'fitting', cat: 'living', name: 'Chair', w: 0.55, d: 0.55, h: 0.95, color: 0x555b60, rate: 78000, labour: 0 }),
  P({ id: 'tv-unit', kind: 'fitting', cat: 'living', name: 'Media unit', w: 1.8, d: 0.4, h: 0.5, color: 0x6f5a45, rate: 160000, labour: 10000 }),
  P({ id: 'bookcase', kind: 'fitting', cat: 'living', name: 'Bookcase', w: 1.0, d: 0.35, h: 2.0, color: 0xa0825e, rate: 120000, labour: 10000 }),
  P({ id: 'window-seat', kind: 'fitting', cat: 'living', name: 'Window seat', w: 1.8, d: 0.5, h: 0.45, color: 0xb59872, rate: 190000, labour: 40000,
    how: 'A built-in bench under a picture window: storage below, and it uses the 2.35 m width without blocking the walkway.' }),
  P({ id: 'stove', kind: 'fitting', cat: 'living', name: 'Wood stove', w: 0.5, d: 0.45, h: 1.0, color: 0x2a2b2d, rate: 620000, labour: 120000,
    how: 'Stand on a 12 mm non-combustible hearth; twin-wall flue through a roof flashing collar; keep the maker’s clearances to the lining.' }),

  /* ----- kitchen & bath ----- */
  P({ id: 'kitchen', kind: 'fitting', cat: 'kitchen', name: 'Kitchen run', w: 2.4, d: 0.6, h: 0.9, color: 0xc9c4bb, rate: 520000, labour: 75000, spec: 'Kitchen units & worktop' }),
  P({ id: 'island', kind: 'fitting', cat: 'kitchen', name: 'Kitchen island', w: 1.6, d: 0.9, h: 0.92, color: 0xd8d4cc, rate: 480000, labour: 45000,
    how: 'Only in double-wide or open-wall plans: a single container is 2.35 m inside, and an island needs about 1 m of clear walkway on each side.' }),
  P({ id: 'fridge', kind: 'fitting', cat: 'kitchen', name: 'Fridge', w: 0.7, d: 0.7, h: 1.8, color: 0xd9dcde, rate: 520000, labour: 0 }),
  P({ id: 'toilet', kind: 'fitting', cat: 'kitchen', name: 'Toilet cubicle', w: 0.9, d: 1.2, h: 2.1, color: 0xdfe3e6, rate: 385000, labour: 95000, spec: 'Toilet cubicle, WC & fittings' }),
  P({ id: 'shower', kind: 'fitting', cat: 'kitchen', name: 'Walk-in shower', w: 0.9, d: 0.9, h: 2.1, color: 0xdfe3e6, rate: 295000, labour: 78000, spec: 'Shower tray, glass screen & fittings',
    how: 'Tank the floor under a wet room (liquid membrane over cement board) and fall it to the drain; the steel floor rusts from the inside otherwise.' }),
  P({ id: 'bath', kind: 'fitting', cat: 'kitchen', name: 'Bath', w: 1.7, d: 0.75, h: 0.55, color: 0xf2f2ef, rate: 420000, labour: 90000 }),
  P({ id: 'vanity', kind: 'fitting', cat: 'kitchen', name: 'Vanity basin', w: 0.8, d: 0.45, h: 0.85, color: 0x9a8a74, rate: 210000, labour: 45000 }),
  P({ id: 'laundry', kind: 'fitting', cat: 'kitchen', name: 'Washer-dryer stack', w: 0.6, d: 0.62, h: 1.75, color: 0xeeeeec, rate: 780000, labour: 25000 }),
  P({ id: 'water-heater', kind: 'fitting', cat: 'kitchen', name: 'Water heater', w: 0.45, d: 0.45, h: 0.8, color: 0xf1f1ef, rate: 185000, labour: 35000, mount: 1.4 }),

  /* ----- sleeping & storage ----- */
  P({ id: 'bed', kind: 'fitting', cat: 'sleep', name: 'Single bed', w: 0.9, d: 1.9, h: 0.55, color: 0x8f7f6a, rate: 165000, labour: 8000 }),
  P({ id: 'double-bed', kind: 'fitting', cat: 'sleep', name: 'Double bed', w: 1.5, d: 2.0, h: 0.55, color: 0x8f7f6a, rate: 320000, labour: 10000,
    how: 'Across a 2.35 m container a 2.0 m bed leaves only 0.35 m: run it along the length, or use a double-wide plan.' }),
  P({ id: 'wall-bed', kind: 'fitting', cat: 'sleep', name: 'Fold-away wall bed', w: 1.5, d: 0.45, h: 2.1, color: 0xb9a78d, rate: 680000, labour: 60000,
    how: 'The frame bolts to the floor, not the wall lining; the bed folds down to 2.1 m deep, so it suits the length of a unit.' }),
  P({ id: 'bunk', kind: 'fitting', cat: 'sleep', name: 'Bunk beds', w: 0.9, d: 1.9, h: 1.7, color: 0x8f7f6a, rate: 285000, labour: 15000, spec: 'Bunk beds & mattresses' }),
  P({ id: 'wardrobe', kind: 'fitting', cat: 'sleep', name: 'Wardrobe', w: 1.2, d: 0.6, h: 2.1, color: 0xb9a78d, rate: 260000, labour: 30000 }),
  P({ id: 'cabinet', kind: 'fitting', cat: 'sleep', name: 'Cabinet', w: 0.8, d: 0.45, h: 1.8, color: 0xa89a86, rate: 118000, labour: 12000, spec: 'Cabinet / cupboard' }),
  P({ id: 'rack', kind: 'fitting', cat: 'sleep', name: 'Storage rack', w: 1.8, d: 0.5, h: 2.0, color: 0x7d8388, rate: 135000, labour: 15000 }),

  /* ----- work & commercial ----- */
  P({ id: 'desk', kind: 'fitting', cat: 'work', name: 'Desk', w: 1.4, d: 0.7, h: 0.75, color: 0xb08d5f, rate: 145000, labour: 12000, spec: 'Office desk' }),
  P({ id: 'reception', kind: 'fitting', cat: 'work', name: 'Reception desk', w: 1.6, d: 0.7, h: 1.05, color: 0xa58a66, rate: 420000, labour: 30000 }),
  P({ id: 'counter', kind: 'fitting', cat: 'work', name: 'Service counter', w: 2.0, d: 0.6, h: 1.05, color: 0xa58a66, rate: 450000, labour: 45000 }),
  P({ id: 'stool', kind: 'fitting', cat: 'work', name: 'Bar stool', w: 0.4, d: 0.4, h: 0.75, color: 0x555b60, rate: 45000, labour: 0 }),
  P({ id: 'bistro', kind: 'fitting', cat: 'work', name: 'Café table', w: 0.7, d: 0.7, h: 0.75, color: 0xb08d5f, rate: 95000, labour: 0 }),
  P({ id: 'partition', kind: 'fitting', cat: 'work', name: 'Partition wall', w: 0.1, d: 2.35, h: 2.3, color: 0xe4e0d8, isWall: true, unit: 'area', rate: 18500, labour: 8500,
    spec: 'Internal partition wall (framed & lined, both faces)', how: '40 × 40 steel or 50 × 75 timber studs at 600 mm, lined both sides; screw the head track to the roof bows, not the corrugation.' }),
  P({ id: 'glass-partition', kind: 'fitting', cat: 'work', name: 'Glass partition', w: 0.06, d: 2.35, h: 2.3, color: 0xcfe0e6, isWall: true, unit: 'area', rate: 68000, labour: 14000,
    spec: 'Framed glass partition, 10 mm toughened', how: 'Keeps daylight from a glazed end reaching the back of a long unit.' }),

  /* ----- mezzanines & stairs ----- */
  P({ id: 'mezzanine', kind: 'fitting', cat: 'levels', name: 'Mezzanine / sleeping loft', w: 2.4, d: 2.35, h: 0.15, deck: 1.8, color: 0xb08d5f, unit: 'area', rate: 95000, labour: 38000, wallToWall: true,
    spec: 'Welded steel mezzanine deck with plywood floor and balustrade',
    how: 'A welded steel platform (PFC edge beams on the side rails, joists at 400 mm, 18 mm ply deck) carried by the container’s side walls and, at its open edge, by posts or a beam into the corner-post line. Fit a 1.1 m balustrade on the open edge and reach it by a ship ladder or alternating-tread stair. Inside a high cube (2.70 m) it is a sleeping or storage loft, not a full floor: building codes want about 2.1 m under and over a habitable mezzanine, which only a double-height space gives.' }),
  P({ id: 'stair', kind: 'fitting', cat: 'levels', name: 'Interior stair', w: 0.8, d: 2.6, h: 2.6, color: 0x3d4145, rate: 620000, labour: 150000, stair: true,
    spec: 'Steel stringer stair with timber treads', how: 'Straight flight: rises up to about 190 mm, goings at least 250 mm, pitch under 42°, 2.0 m headroom over the pitch line and a handrail 0.9–1.0 m high. It needs a floor opening in the unit above (trimmed with steel) where units stack.' }),
  P({ id: 'ship-ladder', kind: 'fitting', cat: 'levels', name: 'Ship ladder', w: 0.6, d: 1.3, h: 1.8, color: 0x3d4145, rate: 260000, labour: 50000, stair: true,
    spec: 'Steel ship ladder with handrails', how: 'For lofts only: steep (about 68°) with handrails both sides. Codes allow it to non-habitable or loft spaces; use a stair for bedrooms.' }),
  P({ id: 'spiral-in', kind: 'fitting', cat: 'levels', name: 'Spiral stair', w: 1.4, d: 1.4, h: 2.9, color: 0x3d4145, rate: 1250000, labour: 260000, stair: true,
    spec: 'Steel spiral stair, 1400 mm diameter', how: 'The most compact route between stacked units: a 1.4 m square floor opening, trimmed with steel angle in both units.' }),

  /* ----- facade (outside, no cut) ----- */
  P({ id: 'slat-screen', kind: 'facade', cat: 'facade', name: 'Timber slat screen', w: 2.4, h: 2.3, sill: 0.05, unit: 'area', rate: 38000, labour: 12000,
    spec: 'Vertical hardwood slats (45 × 20 mm at 60 mm) on steel battens', how: 'Stand the battens off the corrugation on welded clips so air can move behind the slats; seal the steel first. Charred (shou sugi ban) or thermally modified timber lasts without paint.' }),
  P({ id: 'fins', kind: 'facade', cat: 'facade', name: 'Vertical steel fins', w: 2.4, h: 2.3, sill: 0.05, unit: 'area', rate: 55000, labour: 15000,
    spec: 'Folded steel fins at 300 mm, 200 mm deep', how: 'Fins on a west or east face cut low sun better than a canopy.' }),
  P({ id: 'green-wall', kind: 'facade', cat: 'facade', name: 'Living green wall', w: 2.0, h: 2.0, sill: 0.3, unit: 'area', rate: 85000, labour: 25000,
    spec: 'Modular planted wall with drip irrigation', how: 'Hang the modular trays on a rail fixed to welded studs, with a waterproof backing sheet between the trays and the steel.' }),
  P({ id: 'awning', kind: 'facade', cat: 'facade', name: 'Canopy / awning', w: 2.6, h: 0.2, sill: 2.25, proj: 1.2, unit: 'area', rate: 45000, labour: 15000,
    spec: 'Cantilever steel canopy with polycarbonate or sheet roof', how: 'Bracket it off the top rail (the strongest part of the side wall), with tie rods back to the wall; fall it away from the wall.' }),
  P({ id: 'window-hood', kind: 'facade', cat: 'facade', name: 'Window hood', w: 1.4, h: 1.2, sill: 0.9, proj: 0.25, rate: 180000, labour: 45000,
    spec: 'Folded steel box surround', how: 'Fits round an existing window to shade it and give the elevation depth.' }),
  P({ id: 'ac-outdoor', kind: 'facade', cat: 'facade', name: 'AC outdoor unit', w: 0.8, h: 0.55, sill: 0.4, proj: 0.3, rate: 0, labour: 0,
    how: 'Priced with the split air conditioner under Services. Mount it on the shaded side with 300 mm clear behind.' }),

  /* ----- roof ----- */
  P({ id: 'roof-deck', kind: 'roof', cat: 'roof', name: 'Roof deck', w: 5.6, d: 2.3, unit: 'area', rate: 24000, labour: 8000, railing: true,
    spec: 'WPC decking on steel joists, glass balustrade', how: 'Never deck straight onto the corrugated roof: it is rated for about 300 kg on a small patch. Weld steel joists between the top side rails (or to the corner castings), deck over them, and fit a 1.1 m balustrade. Waterproof the roof under the joists and drain it off the ends.' }),
  P({ id: 'solar', kind: 'roof', cat: 'roof', name: 'Solar array', w: 5.4, d: 2.2, unit: 'panel', rate: 145000, labour: 25000, panel: { w: 1.13, d: 1.76, watts: 430 },
    spec: '430 W monocrystalline panels on tilted rails, per panel', how: 'Clamp the rails to the top rails or corner castings (no roof penetrations), tilted at least 10° so rain cleans them. A 20 ft roof takes about six 430 W panels, about 2.5 kWp.' }),
  P({ id: 'green-roof', kind: 'roof', cat: 'roof', name: 'Green roof', w: 5.8, d: 2.3, unit: 'area', rate: 38000, labour: 12000,
    spec: 'Extensive sedum roof, 80–100 mm substrate', how: 'Saturated it weighs 100–150 kg/m², more than the corrugated roof should carry: lay it on a steel or plywood deck spanning between the top rails, over a root-resistant membrane, with an edge trim and outlets.' }),
  P({ id: 'skylight', kind: 'roof', cat: 'roof', name: 'Skylight', w: 1.0, d: 1.0, rate: 420000, labour: 85000,
    spec: 'Double-glazed rooflight on an upstand kerb', how: 'Cut between the roof bows, weld a 150 mm steel upstand kerb round the hole and fix the rooflight to it; the kerb keeps standing water out.' }),
  P({ id: 'roof-hatch', kind: 'roof', cat: 'roof', name: 'Roof access hatch', w: 0.9, d: 0.9, rate: 350000, labour: 80000,
    spec: 'Insulated roof hatch with kerb', how: 'Frames like a skylight; pair it with a ship ladder inside.' }),
  P({ id: 'roof-pergola', kind: 'roof', cat: 'roof', name: 'Rooftop pergola', w: 3.0, d: 2.3, h: 2.3, unit: 'area', rate: 32000, labour: 10000,
    spec: 'Steel pergola with timber louvres', how: 'Bolt the posts to plates welded over the corner castings or the top rail, never to the roof sheet.' }),
  P({ id: 'pitched-roof', kind: 'roof', cat: 'roof', name: 'Mono-pitch roof over', w: 6.6, d: 3.0, unit: 'area', rate: 17500, labour: 6500, cover: true,
    spec: 'Steel purlins and long-span sheet, 300 mm overhang', how: 'A ventilated second roof over the container keeps the sun off the steel (the biggest cooling gain in hot climates) and sheds rain. Posts or brackets weld to the top rails; leave the gap open at the eaves.' }),

  /* ----- decks & outdoor ----- */
  P({ id: 'deck', kind: 'site', cat: 'outdoor', name: 'Deck', w: 3.6, d: 2.4, h: 0.26, unit: 'area', rate: 27000, labour: 9000,
    spec: 'WPC decking on galvanised steel frame', how: 'Set the deck on its own posts or pads, level with the container floor (about 250 mm up on pads), and keep a 10 mm gap from the container so each can move.' }),
  P({ id: 'pergola', kind: 'site', cat: 'outdoor', name: 'Pergola', w: 3.6, d: 3.0, h: 2.6, unit: 'area', rate: 32000, labour: 10000,
    spec: 'Steel posts with timber louvres', how: 'Posts on concrete pads; where it meets a container, bolt the beam to a plate welded to the top rail.' }),
  P({ id: 'canopy', kind: 'site', cat: 'outdoor', name: 'Carport canopy', w: 5.5, d: 3.0, h: 2.6, unit: 'area', rate: 26000, labour: 8000,
    spec: 'Steel frame, polycarbonate roof', how: 'Four posts on 600 mm pads; fall the roof 3° to a gutter.' }),
  P({ id: 'steps', kind: 'site', cat: 'outdoor', name: 'Entrance steps', w: 1.2, d: 0.9, h: 0.26, rate: 120000, labour: 40000,
    spec: 'Galvanised steel steps with chequer-plate treads', how: 'Two risers of about 130 mm to the container floor.' }),
  P({ id: 'ramp', kind: 'site', cat: 'outdoor', name: 'Access ramp', w: 1.2, d: 3.2, h: 0.26, unit: 'length', rate: 65000, labour: 20000, lengthOf: 'd',
    spec: 'Steel ramp at 1:12 with handrails', how: 'At 1:12 a 260 mm rise needs 3.1 m of ramp; add a 1.2 m landing at the door and handrails at 0.9 m.' }),
  P({ id: 'ext-stair', kind: 'site', cat: 'outdoor', name: 'External stair', w: 0.95, d: 4.2, h: 2.85, rate: 780000, labour: 220000, stair: true,
    spec: 'Galvanised steel stair with landing and handrails (per flight)', how: 'Straight flight up the long side: 15–16 risers of about 180 mm, 250 mm goings, 1.1 m guarding at the top landing. Bolt the stringers to the top-rail landing and a pad at the foot so the stair does not load the corrugated wall.' }),
  P({ id: 'spiral', kind: 'site', cat: 'outdoor', name: 'Spiral stair', w: 1.6, d: 1.6, h: 2.85, rate: 1250000, labour: 260000, stair: true,
    spec: 'Galvanised spiral stair, 1600 mm', how: 'A compact external route to a roof deck: centre column on a pad, top landing bolted to the top rail.' }),
  P({ id: 'walkway', kind: 'site', cat: 'outdoor', name: 'Link bridge', w: 3.0, d: 1.2, h: 2.85, unit: 'area', rate: 95000, labour: 25000,
    spec: 'Steel walkway with grating deck and balustrades', how: 'Spans between two units at upper level, bolted to plates on the top rails; slotted holes at one end let it move.' }),
  P({ id: 'balustrade', kind: 'site', cat: 'outdoor', name: 'Glass balustrade', w: 3.0, d: 0.05, h: 1.1, unit: 'length', rate: 42000, labour: 9000,
    spec: 'Toughened laminated glass in a base shoe, 1.1 m', how: '1.1 m high at any edge more than 600 mm above the ground.' }),
  P({ id: 'screen', kind: 'site', cat: 'outdoor', name: 'Privacy screen', w: 3.0, d: 0.1, h: 1.8, unit: 'length', rate: 38000, labour: 12000,
    spec: 'Slatted timber screen on steel posts' }),
  P({ id: 'planter', kind: 'site', cat: 'outdoor', name: 'Planter', w: 2.0, d: 0.6, h: 0.6, rate: 85000, labour: 25000, spec: 'Corten raised planter' }),
  P({ id: 'hot-tub', kind: 'site', cat: 'outdoor', name: 'Hot tub', w: 2.2, d: 2.2, h: 0.9, rate: 3800000, labour: 250000,
    how: 'About 2 t full: on a slab or a structural deck, never on a container roof without an engineer.' }),

  /* ----- site & services ----- */
  P({ id: 'column', kind: 'site', cat: 'site', name: 'Steel post', w: 0.15, d: 0.15, h: 2.85, rate: 180000, labour: 60000,
    spec: 'SHS 150 × 150 × 6 post on a pad footing', how: 'Props a cantilever or bridge: base plate on a 600 mm pad, cap plate welded to the corner casting or a transfer beam.' }),
  P({ id: 'rain-tank', kind: 'site', cat: 'site', name: 'Rainwater tank', w: 1.8, d: 1.8, h: 2.2, rate: 450000, labour: 60000,
    spec: '5,000 litre tank with first-flush diverter', how: 'A 40 ft roof (about 30 m²) collects roughly 25 litres per mm of rain; gutter the long sides and fit a first-flush diverter.' }),
  P({ id: 'septic', kind: 'site', cat: 'site', name: 'Septic tank', w: 2.4, d: 1.2, h: 0.3, rate: 950000, labour: 380000,
    spec: 'Two-chamber septic tank with soakaway', how: 'Size about 2,000 L plus 180 L per person (BS 6297); at least 7 m from the building.' }),
  P({ id: 'generator', kind: 'site', cat: 'site', name: 'Generator / inverter', w: 1.2, d: 0.7, h: 1.0, rate: 1450000, labour: 90000,
    spec: 'Inverter and battery cabinet (or standby generator)', how: 'Pair with the solar array; keep a generator 3 m from openings.' }),
];

export const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const partsIn = (cat) => PARTS.filter(p => p.cat === cat);

/* ---------------- checks a part can raise ---------------- */

/** Design warnings for one placed part in a unit of internal height `hgt`. */
export function partNotes(it, unit) {
  const p = PART[it.type];
  const out = [];
  if (!p) return out;
  const H = unit?.hgt ?? 2.393;
  if (p.id === 'mezzanine') {
    const deck = it.deck ?? p.deck;
    const below = deck - 0.15, above = H - deck;
    if (below < 2.0) out.push(`Headroom under the loft is ${below.toFixed(2)} m: storage, a wardrobe or a low bathroom only (about 2.0 m is needed to walk under).`);
    if (above < 0.9) out.push(`Only ${above.toFixed(2)} m above the deck: a mattress platform. About 1.0 m lets you sit up in bed.`);
    if (above >= 0.9 && below >= 2.0) out.push('Headroom works both sides.');
  }
  if (p.kind === 'opening' && (it.wall === 'left' || it.wall === 'right') && it.w > 2.4 && !p.open) out.push('Over 2.4 m in a side wall: weld in a portal frame and have racking checked.');
  if (p.id === 'pivot-door' && H < 2.4) out.push('A 2.3 m pivot door needs a high cube.');
  if (p.id === 'island' && (unit?.wid ?? 2.35) < 3 && !(unit?.items || []).some(o => o.type === 'wall-removal')) out.push('An island needs about 1 m clear each side: open this unit into the next one.');
  if (p.id === 'double-bed' && (unit?.wid ?? 2.35) < 3 && (it.rot || 0) % 2 === 0) out.push('Turn the bed to run along the unit: across it leaves only 0.35 m.');
  if (p.id === 'green-roof' || p.id === 'hot-tub') out.push(p.id === 'hot-tub' ? 'Heavy when full: slab or engineered deck only.' : 'Heavy when wet: needs a structural deck over the roof.');
  return out;
}

/* ---------------- multi-unit presets ---------------- */

const op = (type, wall, along, o = {}) => ({ kind: 'opening', type, wall, along, ...o });
const fit = (type, x, z, rot = 0, o = {}) => ({ kind: 'fitting', type, x, z, rot, ...o });
const fac = (type, wall, along, o = {}) => ({ kind: 'facade', type, wall, along, ...o });
const roof = (type, x, z, w, d, o = {}) => ({ kind: 'roof', type, x, z, w, d, ...o });
const site = (type, x, z, rot = 0, o = {}) => ({ kind: 'site', type, x, z, rot, ...o });
/** A unit: `cx, cz` = centre of its footprint on site; rot 1 = turned 90°. */
const U = (preset, cx, cz, o = {}) => ({ preset, cx, cz, rot: 0, level: 0, color: 'charcoal', items: [], ...o });

/* Ground-floor slab level above the site: pads 100 mm + floor 155 mm. */
const FL = 0.255;
/* Level-1 floor above the site for standard / high-cube units below. */
const L1 = FL + 2.591, L1HC = FL + 2.896;

export const PRESETS = [
  { id: 'studio20', name: '20 ft studio', tag: '1 unit · 14 m²', blurb: 'Sliding patio door, clerestory, shower room, deck and awning.',
    units: [U('20ft', 0, 0, { color: 'charcoal', items: [
      op('sliding-door', 'left', 3.3), op('clerestory', 'right', 3.0, { w: 2.4 }), op('small-window', 'back', 0.6), op('glass-door', 'front', 1.6),
      fit('double-bed', 4.8, 1.2, 1), fit('kitchen', 2.2, 2.05, 2), fit('shower', 0.5, 0.5), fit('toilet', 0.5, 1.75), fit('partition', 1.05, 1.176), fit('armchair', 3.2, 0.6),
      fac('awning', 'left', 3.3, { w: 3.0 }), fac('slat-screen', 'right', 1.0, { w: 1.6 }),
      roof('solar', 2.95, 1.18, 5.4, 2.2),
    ] })],
    site: [site('deck', 0.35, -2.55, 0, { w: 4.2, d: 2.6 }), site('planter', -2.3, -3.6, 0)],
    notes: ['The slider sits in the long wall: weld jambs and a header in before cutting.', 'Awning bracketed off the top rail.'] },

  { id: 'loft40hc', name: '40 ft high cube with loft', tag: '1 unit · 28 m²', blurb: 'Sleeping loft over the bathroom, bi-fold wall, picture window.',
    units: [U('40hc', 0, 0, { color: 'black', items: [
      op('bifold', 'left', 6.2), op('picture-window', 'right', 3.0, { sill: 0.9, h: 1.2 }), op('box-window', 'front', 1.176, { w: 1.6, h: 1.4, sill: 0.6 }), op('glass-door', 'right', 9.2), op('clerestory', 'left', 10.4, { w: 2.0 }),
      fit('mezzanine', 1.2, 1.176, 0, { w: 2.4, deck: 2.15 }), fit('ship-ladder', 3.1, 0.45, 1, { h: 2.15 }), fit('shower', 0.5, 1.85), fit('toilet', 0.5, 0.65), fit('vanity', 1.7, 2.1, 2),
      fit('kitchen', 5.6, 2.05, 2), fit('sofa', 9.0, 1.9, 2), fit('tv-unit', 9.0, 0.25), fit('table', 10.4, 1.176, 1), fit('stove', 11.6, 0.3),
      fac('fins', 'right', 2.4, { w: 2.0 }), roof('green-roof', 3.1, 1.176, 5.8, 2.2), roof('skylight', 8.5, 1.176, 1.0, 1.0),
    ] })],
    site: [site('deck', 0.8, -2.6, 0, { w: 7.2, d: 2.8 }), site('pergola', 0.8, -2.6, 0, { w: 4.8, d: 2.8 })],
    notes: ['In a 2.70 m high cube a loft is a mattress platform: 2.0 m under (bathroom), 0.55 m over. Full headroom on both sides needs a double-height space.'] },

  { id: 'double40', name: 'Double-wide open plan', tag: '2 × 40 ft · 57 m²', blurb: 'Two 40 ft side by side, shared walls removed on a steel frame.',
    units: [
      U('40ft', 0, -1.219, { color: 'white', items: [
        op('wall-removal', 'right', 5.032, { w: 6.4, h: 2.2 }), op('sliding-door', 'left', 4.0), op('sliding-door', 'left', 8.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }),
        fit('sofa', 3.0, 0.7, 0), fit('armchair', 5.0, 1.2), fit('tv-unit', 3.0, 2.15, 2), fit('table', 9.0, 1.3, 1), fit('stove', 1.0, 0.4),
      ] }),
      U('40ft', 0, 1.219, { color: 'white', items: [
        op('wall-removal', 'left', 7.0, { w: 6.4, h: 2.2 }), op('picture-window', 'right', 3.0), op('window', 'right', 9.8), op('personnel-door', 'back', 1.176),
        fit('kitchen', 7.6, 2.05, 2, { w: 3.0 }), fit('island', 7.6, 0.55, 0), fit('partition', 3.4, 1.176, 0), fit('double-bed', 1.6, 1.176, 1), fit('wardrobe', 3.0, 2.0, 2, { w: 0.8 }),
        fit('shower', 11.4, 0.5), fit('toilet', 11.4, 1.7), fit('partition', 10.8, 1.176),
      ] }),
    ],
    site: [site('deck', 0, -4.0, 0, { w: 9.0, d: 3.0 }), site('pergola', -2.0, -4.0, 0, { w: 4.5, d: 3.0 })],
    notes: ['Open wall: HSS columns at each end of the cut and every 3–4 m, with a UB header.', 'Bolt the two units together at floor and roof rails; flash the roof joint.'] },

  { id: 'lshape', name: 'L-shape with corner deck', tag: '40 + 20 ft · 42 m²', blurb: 'Living wing and bedroom wing round a sheltered deck.',
    units: [
      U('40ft', 0, 0, { color: 'charcoal', items: [op('sliding-door', 'right', 4.0), op('sliding-door', 'right', 8.0), op('window', 'left', 6.0), op('cutout', 'front', 1.176, { w: 1.0 }),
        fit('kitchen', 9.8, 0.3, 0), fit('table', 7.0, 1.2, 1), fit('sofa', 2.5, 0.45, 0), fit('tv-unit', 2.5, 2.1, 2)] }),
      U('20ft', 7.315, 1.8, { rot: 1, color: 'charcoal', items: [op('cutout', 'right', 4.75, { w: 1.0 }), op('picture-window', 'left', 3.0), op('small-window', 'front', 1.2),
        fit('double-bed', 3.3, 1.2, 1), fit('shower', 5.4, 0.5), fit('toilet', 5.4, 1.8), fit('partition', 4.8, 1.176)] }),
    ],
    site: [site('deck', 0.6, 3.6, 0, { w: 9.6, d: 4.4 }), site('pergola', 2.0, 3.6, 0, { w: 4.8, d: 3.6 }), site('planter', -4.0, 5.3, 0)],
    notes: ['The 20 ft wing meets the 40 ft end: seal and flash the junction; a framed cut-out joins them.'] },

  { id: 'ushape', name: 'U-shape courtyard', tag: '3 units · 72 m²', blurb: 'Three 40 ft units round a private courtyard deck.',
    units: [
      U('40ft', 0, 0, { color: 'sand', items: [op('bifold', 'right', 6.0), op('window', 'left', 3.0), op('window', 'left', 9.0), fit('kitchen', 6.0, 0.3), fit('table', 6.0, 1.5, 1), fit('sofa', 2.2, 1.9, 2)] }),
      U('40ft', -4.877, 7.315, { rot: 1, color: 'sand', items: [op('sliding-door', 'left', 6.0), op('window', 'right', 3.0), fit('double-bed', 3.0, 1.2, 1), fit('wardrobe', 5.0, 2.0, 2), fit('shower', 11.4, 0.5), fit('toilet', 11.4, 1.8), fit('partition', 10.7, 1.176)] }),
      U('40ft', 4.877, 7.315, { rot: 1, color: 'sand', items: [op('sliding-door', 'right', 6.0), op('window', 'left', 3.0), fit('bed', 3.0, 0.5, 1), fit('desk', 7.0, 2.0, 2), fit('bookcase', 9.0, 2.1, 2)] }),
    ],
    site: [site('deck', 0, 6.8, 0, { w: 7.2, d: 9.0 }), site('hot-tub', 1.5, 9.8, 0), site('planter', -1.8, 3.4, 0)],
    notes: ['Each wing is a separate unit on its own pads; flash the corners where they meet.'] },

  { id: 'stack2', name: 'Two-storey stack', tag: '2 × 40 ft HC · 55 m²', blurb: 'Corner-to-corner stack, external stair, roof terrace.',
    units: [
      U('40hc', 0, 0, { color: 'charcoal', items: [op('sliding-door', 'left', 5.0), op('picture-window', 'right', 4.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.4 }), op('personnel-door', 'right', 10.8),
        fit('kitchen', 1.6, 2.05, 2), fit('table', 4.2, 1.2, 1), fit('sofa', 8.5, 0.45), fit('tv-unit', 8.5, 2.15, 2), fit('shower', 11.4, 0.5), fit('toilet', 11.4, 1.8), fit('partition', 10.7, 1.176)] }),
      U('40hc', 0, 0, { level: 1, color: 'charcoal', items: [op('glass-door', 'right', 1.0), op('window', 'left', 3.0), op('window', 'left', 8.5), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.4 }),
        fit('double-bed', 3.0, 1.2, 1), fit('partition', 5.2, 1.176), fit('bed', 7.0, 0.5, 1), fit('wardrobe', 6.2, 2.0, 2, { w: 0.8 }), fit('shower', 11.4, 0.5), fit('toilet', 11.4, 1.8), fit('partition', 10.7, 1.176),
        roof('roof-deck', 3.0, 1.176, 6.0, 2.35), roof('solar', 9.0, 1.176, 5.6, 2.2)] }),
    ],
    site: [site('ext-stair', 3.2, 1.9, 3, { d: 4.4, h: L1HC }), site('deck', -3.0, -2.6, 0, { w: 6.0, d: 2.8 }), site('spiral', -5.3, 2.2, 0, { h: L1HC + 2.896 })],
    notes: ['Stacked corner casting on corner casting and welded (or twist-locked) at all four corners.', 'The roof deck sits on steel joists between the top rails, not on the roof sheet.'] },

  { id: 'cantilever', name: 'Cantilevered upper floor', tag: '2 × 40 ft · 57 m²', blurb: 'Upper unit slides 3 m out over the terrace, glazed at the end.',
    units: [
      U('40ft', 0, 0, { color: 'grey', items: [op('bifold', 'right', 6.0), op('window', 'left', 10.5), op('personnel-door', 'back', 1.176), fit('kitchen', 2.0, 2.05, 2), fit('table', 6.0, 1.2, 1), fit('sofa', 9.8, 0.45)] }),
      U('40ft', 3.0, 0, { level: 1, color: 'black', items: [op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }), op('window', 'left', 5.0), op('window', 'right', 7.0), op('glass-door', 'left', 2.0),
        fit('double-bed', 9.5, 1.2, 1), fit('sofa', 5.5, 1.9, 2), fit('shower', 0.5, 0.5), fit('toilet', 0.5, 1.8), fit('partition', 1.2, 1.176)] }),
    ],
    site: [site('deck', 7.9, 0, 0, { w: 3.6, d: 4.2 }), site('ext-stair', 0.8, -1.95, 1, { d: 4.4, h: L1 })],
    notes: ['3.0 m cantilever with 9.2 m back-span (rule of thumb: back-span at least 1.5 × the overhang).', 'Carry the overhang on steel I-beams welded along both bottom rails of the upper unit and to the corner posts of the lower one; have it engineered.'] },

  { id: 'cross', name: 'Cross stack on posts', tag: '2 × 40 ft · 57 m²', blurb: 'Upper unit turned 90°, propped on steel posts at both ends.',
    units: [
      U('40ft', 0, 0, { color: 'white', items: [op('sliding-door', 'left', 3.0), op('sliding-door', 'right', 9.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }), fit('kitchen', 9.8, 2.05, 2), fit('table', 7.2, 1.2, 1), fit('sofa', 2.6, 1.9, 2)] }),
      U('40ft', 0, 0, { rot: 1, level: 1, color: 'charcoal', items: [op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }), op('glass-wall', 'back', 1.176, { w: 2.1, h: 2.2 }), op('glass-door', 'left', 11.3), op('window', 'left', 3.0), op('window', 'right', 9.0),
        fit('double-bed', 3.0, 1.2, 1), fit('shower', 6.6, 0.5), fit('toilet', 6.6, 1.8), fit('partition', 7.2, 1.176), fit('desk', 10.5, 2.0, 2)] }),
    ],
    site: [site('column', -1.0, 5.6), site('column', 1.0, 5.6), site('column', -1.0, -5.6), site('column', 1.0, -5.6), site('ext-stair', 1.75, 3.6, 0, { d: 4.4, h: L1 }), site('deck', 0, -4.0, 0, { w: 4.4, d: 3.4 })],
    notes: ['Each end overhangs 4.9 m on only a 2.4 m back-span, so posts are not optional: SHS posts carry both ends, with a transfer beam where the upper unit crosses the lower one’s side rails.'] },

  { id: 'bridge', name: 'Bridge house', tag: '3 units · 43 m²', blurb: 'A 40 ft unit spans two 20 ft units; covered patio beneath.',
    units: [
      U('20ft', -4.0, 0, { rot: 1, color: 'corten', items: [op('glass-door', 'left', 3.0), op('window', 'right', 3.0), fit('bed', 1.2, 0.5, 1), fit('desk', 4.5, 2.0, 2)] }),
      U('20ft', 4.0, 0, { rot: 1, color: 'corten', items: [op('glass-door', 'right', 3.0), op('window', 'left', 3.0), fit('shower', 0.5, 0.5), fit('toilet', 0.5, 1.8), fit('kitchen', 3.8, 2.05, 2)] }),
      U('40ft', 0, 0, { level: 1, color: 'black', items: [op('sliding-door', 'left', 6.0), op('glass-door', 'right', 6.016), op('picture-window', 'right', 9.5), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }), op('glass-wall', 'back', 1.176, { w: 2.1, h: 2.2 }),
        fit('sofa', 6.0, 1.9, 2), fit('table', 3.0, 1.2, 1), fit('double-bed', 10.0, 1.2, 1), roof('solar', 6.0, 1.176, 10.8, 2.2)] }),
    ],
    site: [site('deck', 0, 0, 0, { w: 5.5, d: 5.8 }), site('ext-stair', 0, 3.7, 2, { d: 4.4, h: L1 })],
    notes: ['The upper unit’s corner castings do not land on the lower units’ castings: carry it on transfer beams over the lower units’ corner posts, welded to both.', 'The 5.6 m span between supports is within what the bottom rails of a 40 ft unit carry, but have it checked.'] },

  { id: 'stagger', name: 'Staggered with terrace', tag: '40 + 20 ft · 42 m²', blurb: '20 ft upper unit set back on a 40 ft base; terrace on the rest.',
    units: [
      U('40ft', 0, 0, { color: 'olive', items: [op('sliding-door', 'left', 4.0), op('window', 'right', 3.0), op('window', 'right', 9.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }),
        fit('kitchen', 2.0, 2.05, 2), fit('table', 5.0, 1.2, 1), fit('sofa', 9.6, 0.45), fit('armchair', 11.3, 1.7), roof('roof-deck', 9.0, 1.176, 5.9, 2.35)] }),
      U('20ft', -3.067, 0, { level: 1, color: 'olive', items: [op('sliding-door', 'front', 1.176, { w: 1.8 }), op('window', 'left', 3.0), fit('double-bed', 2.4, 1.2, 1), fit('shower', 0.5, 0.5), fit('toilet', 0.5, 1.8), fit('partition', 1.2, 1.176)] }),
    ],
    site: [site('ext-stair', 3.7, 1.9, 3, { d: 4.4, h: L1 }), site('deck', 0, -2.6, 0, { w: 6.0, d: 2.6 })],
    notes: ['The 20 ft unit’s outer end lands on the 40 ft corner castings; its inner end lands mid-span, so add a transfer beam and a post or frame in the 40 ft unit below.'] },

  { id: 'tower3', name: 'Three-storey tower', tag: '3 × 20 ft · 42 m²', blurb: 'Stacked 20 ft units with an external stair and roof terrace.',
    units: [
      U('20ft', 0, 0, { color: 'red', items: [op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.2 }), op('window', 'left', 3.0), fit('kitchen', 1.6, 2.05, 2), fit('table', 4.0, 1.2, 1)] }),
      U('20ft', 0, 0, { level: 1, color: 'red', items: [op('glass-door', 'right', 1.2), op('window', 'left', 3.5), fit('sofa', 3.5, 0.45), fit('shower', 5.4, 0.5), fit('toilet', 5.4, 1.8), fit('partition', 4.8, 1.176)] }),
      U('20ft', 0, 0, { level: 2, color: 'red', items: [op('glass-door', 'right', 1.2), op('picture-window', 'front', 1.176, { w: 1.8 }), fit('double-bed', 3.6, 1.2, 1), roof('roof-deck', 2.95, 1.176, 5.8, 2.35)] }),
    ],
    site: [site('spiral', 1.75, 2.07, 0, { h: FL + 3 * 2.591 })],
    notes: ['Three high on corner castings is well within the rating (ISO stacking is 192 t per post); wind overturning governs, so anchor the base unit.'] },

  { id: 'family4', name: 'Family home, two storeys', tag: '4 × 40 ft HC · 112 m²', blurb: 'Open-plan ground floor, three bedrooms up, stair inside.',
    units: [
      U('40hc', 0, -1.219, { color: 'white', items: [op('wall-removal', 'right', 6.016, { w: 9.0, h: 2.4 }), op('bifold', 'left', 4.0), op('sliding-door', 'left', 9.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.4 }),
        fit('sofa', 3.5, 0.6), fit('armchair', 5.6, 1.3), fit('tv-unit', 3.5, 2.15, 2), fit('table', 9.5, 1.3, 1)] }),
      U('40hc', 0, 1.219, { color: 'white', items: [op('wall-removal', 'left', 6.016, { w: 9.0, h: 2.4 }), op('window', 'right', 6.0), op('personnel-door', 'back', 1.176),
        fit('kitchen', 6.0, 2.05, 2, { w: 3.0 }), fit('island', 6.0, 0.7), fit('stair', 9.0, 1.6, 1), fit('toilet', 11.4, 1.8), fit('vanity', 11.4, 0.4)] }),
      U('40hc', 0, -1.219, { level: 1, color: 'charcoal', items: [op('window', 'left', 3.0), op('window', 'left', 9.0), op('glass-wall', 'front', 1.176, { w: 2.1, h: 2.4 }),
        fit('double-bed', 10.2, 1.2, 1), fit('partition', 8.4, 1.176), fit('double-bed', 5.0, 1.2, 1), fit('partition', 3.2, 1.176), roof('solar', 6.0, 1.176, 10.8, 2.2)] }),
      U('40hc', 0, 1.219, { level: 1, color: 'charcoal', items: [op('window', 'right', 3.0), op('window', 'right', 9.0), op('glass-door', 'front', 1.7),
        fit('bed', 5.0, 1.8, 1), fit('desk', 6.8, 1.9, 2), fit('shower', 0.5, 0.5), fit('bath', 1.5, 1.95, 0), fit('toilet', 2.6, 2.0, 2), fit('partition', 3.2, 1.176), roof('roof-deck', 9.0, 1.176, 6.0, 2.35)] }),
    ],
    site: [site('deck', 0, -4.2, 0, { w: 10.0, d: 3.2 }), site('pergola', -2.5, -4.2, 0, { w: 5.0, d: 3.2 }), site('spiral', 7.2, 2.0, 0, { h: L1HC + 2.896 }), site('rain-tank', -7.4, 2.0, 0)],
    notes: ['Ground floor: shared walls removed on a steel moment frame.', 'Upper units stack corner to corner; the stair needs a trimmed floor opening in the unit above.'] },

  { id: 'office', name: 'Site office with WC', tag: '40 + 20 ft', blurb: 'Open office, meeting table, WC unit, ramp and canopy.',
    units: [
      U('40ft', 0, 0, { color: 'blue', items: [op('glass-door', 'right', 1.2), op('window', 'right', 3.0), op('window', 'left', 3.0), op('window', 'left', 6.0), op('window', 'left', 9.0),
        fit('desk', 3.0, 0.4), fit('chair', 3.0, 1.0, 2), fit('desk', 5.0, 0.4), fit('chair', 5.0, 1.0, 2), fit('desk', 7.0, 0.4), fit('chair', 7.0, 1.0, 2), fit('table', 10.2, 1.2, 1), fit('cabinet', 11.6, 2.0, 2)] }),
      U('20ft', -3.0, 2.438, { color: 'blue', items: [op('personnel-door', 'right', 1.0), op('small-window', 'right', 3.5), fit('toilet', 0.8, 0.8), fit('toilet', 1.8, 0.8), fit('vanity', 3.2, 0.3), fit('shower', 5.4, 0.5)] }),
    ],
    site: [site('ramp', 4.8, 2.95, 2, { d: 3.2 }), site('canopy', 3.0, 5.2, 0, { w: 5.0, d: 2.6 })],
    notes: ['Ramp at 1:12 with handrails for level access.'] },

  { id: 'cafe', name: 'Café kiosk', tag: '20 ft', blurb: 'Fold-down deck, serving hatch, awning and seating.',
    units: [U('20ft', 0, 0, { color: 'corten', items: [
      op('fold-down-deck', 'left', 2.2, { w: 2.4 }), op('serving-hatch', 'left', 4.6, { w: 1.6 }), op('personnel-door', 'back', 1.176),
      fit('counter', 2.2, 0.35), fit('counter', 4.6, 0.35, 0, { w: 1.6 }), fit('kitchen', 3.5, 2.05, 2, { w: 3.6 }), fit('fridge', 0.6, 2.0, 2),
      fac('awning', 'left', 4.6, { w: 1.8 }), fac('green-wall', 'right', 3.0, { w: 3.0 }), roof('solar', 2.95, 1.176, 5.4, 2.2),
    ] })],
    site: [site('bistro', 1.6, -3.0), site('bistro', 2.6, -4.2), site('planter', 0, -5.0, 0, { w: 3.0 })],
    notes: ['The fold-down deck is the old wall panel re-framed and hinged at floor level.'] },
];

/* Site furniture uses the fitting models; let them be placed outdoors too. */
PART['bistro'].siteOk = true;

export const PRESET = Object.fromEntries(PRESETS.map(p => [p.id, p]));
export { FL as FLOOR_LEVEL };

/* ---------------- layout geometry (shared by the Builder and the quote) ---------------- */

/** External footprint of a unit on site: its centre (cx, cz), turned by rot quarter turns. */
export function unitRect(u) {
  const e = extOf(u);
  const L = (u.rot || 0) % 2 ? e.wid : e.len, W = (u.rot || 0) % 2 ? e.len : e.wid;
  return { x0: u.cx - L / 2, x1: u.cx + L / 2, z0: u.cz - W / 2, z1: u.cz + W / 2 };
}
const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

/**
 * Works out how units sit on each other. Returns Map id → {
 *   elev (m, bottom of the unit above the ground-floor underside), below: [ids],
 *   supported, aligned (lands corner casting on corner casting), overhang (m of its length unsupported),
 *   covered (m² of its roof under a unit above) }
 */
export function layoutUnits(units) {
  const info = new Map();
  const sorted = [...units].sort((a, b) => (a.level || 0) - (b.level || 0));
  for (const u of sorted) {
    const r = unitRect(u);
    const lv = u.level || 0;
    const below = lv > 0 ? units.filter(b => (b.level || 0) === lv - 1 && overlapArea(r, unitRect(b)) > 0.5) : [];
    let elev = 0;
    if (lv > 0) elev = below.length ? Math.max(...below.map(b => (info.get(b.id)?.elev ?? 0) + extOf(b).hgt)) : lv * 2.591;
    const aligned = lv === 0 || below.some(b => b.preset === u.preset && (b.rot || 0) % 2 === (u.rot || 0) % 2 && Math.abs(b.cx - u.cx) < 0.05 && Math.abs(b.cz - u.cz) < 0.05);
    // Length of the unit (along its own axis) not over any unit below.
    let overhang = 0;
    if (lv > 0) {
      const alongX = !((u.rot || 0) % 2);
      const [a0, a1] = alongX ? [r.x0, r.x1] : [r.z0, r.z1];
      const spans = below.map(b => { const rb = unitRect(b); return alongX ? [Math.max(a0, rb.x0), Math.min(a1, rb.x1)] : [Math.max(a0, rb.z0), Math.min(a1, rb.z1)]; })
        .filter(([s, e]) => e > s).sort((p, q) => p[0] - q[0]);
      // Only what projects beyond the outermost supports; a span between two supports is a bridge, not a cantilever.
      overhang = spans.length ? Math.max(0, spans[0][0] - a0) + Math.max(0, a1 - Math.max(...spans.map(x => x[1]))) : a1 - a0;
    }
    info.set(u.id, { elev, below: below.map(b => b.id), supported: lv === 0 || below.length > 0, aligned, overhang: Math.round(overhang * 1000) / 1000, covered: 0, span: lv > 0 && !aligned && below.length > 1 });
  }
  for (const u of units) {
    const r = unitRect(u);
    const cov = units.filter(a => (a.level || 0) === (u.level || 0) + 1).reduce((s, a) => s + overlapArea(r, unitRect(a)), 0);
    info.get(u.id).covered = Math.min(cov, (r.x1 - r.x0) * (r.z1 - r.z0));
  }
  return info;
}

/** Pairs of units on the same level that touch along an edge of at least 1 m. */
export function adjoiningPairs(units) {
  const out = [];
  for (let i = 0; i < units.length; i++) for (let k = i + 1; k < units.length; k++) {
    const a = units[i], b = units[k];
    if ((a.level || 0) !== (b.level || 0)) continue;
    const ra = unitRect(a), rb = unitRect(b), tol = 0.06;
    const ox = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0), oz = Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0);
    const touchX = Math.abs(ra.x1 - rb.x0) < tol || Math.abs(rb.x1 - ra.x0) < tol, touchZ = Math.abs(ra.z1 - rb.z0) < tol || Math.abs(rb.z1 - ra.z0) < tol;
    if ((touchZ && ox >= 1) || (touchX && oz >= 1)) out.push([a.id, b.id]);
  }
  return out;
}
