/* ============================================================
   Architecture knowledge for the Assistant: buildings (including
   shipping-container structures) and software/system design.

   architectureAdvisor() answers in three ways:
   - topic: returns the matching reference notes (principles,
     rules of thumb, common mistakes) for the model to build on;
   - check: runs a design description through a review checklist;
   - calc: sizing with the working shown — beams, columns, loads,
     wind, RC beams, span/depth, U-values, gutters, escape widths,
     ramps, septic tanks, stairs, footings, ventilation and the
     full shipping-container structural check (ISO 1496-1).
   Topic answers also include concepts the Assistant has learned
   from the web (knowledge_library), with their sources.
   Rules of thumb are preliminary sizing only; the notes say when
   an engineer or local building code must decide.
   ============================================================ */

import * as STRUCT from '../structural-calcs.js';
import { checkStructure } from '../container-structure.js';

const T = (id, domain, title, match, points, pitfalls = []) => ({ id, domain, title, match, points, pitfalls });

export const ARCH_TOPICS = [
  T('container-structure', 'building', 'Shipping-container buildings: structure', /\bcontainers?\b|\bportacabin|\bcargo box|\biso ?668|\b1496/i, [
    'ISO 668 sizes: 20 ft is 6.058 × 2.438 × 2.591 m outside (5.898 × 2.352 × 2.393 m inside, tare about 2,230 kg); 40 ft is 12.192 m long; high cubes are 2.896 m tall (2.698 m inside). Maximum gross mass is 30,480 kg.',
    'A container carries its load through the four corner posts and the top and bottom rails; the 1.6 mm corrugated Corten side walls (2.0 mm ends and roof) act as shear panels that stop the box racking.',
    'ISO 1496-1 ratings: the corner posts carry 192,000 kg stacked on top (nine high); transverse racking 150 kN, longitudinal 75 kN; the floor takes a 7,260 kg forklift axle; the roof only 300 kg on 600 × 300 mm. The roof is not a floor: a roof deck needs its own joists on the top rails.',
    'Every opening cut into a wall removes shear capacity: frame it with welded RHS (100 × 50 × 4 is typical) tied into the top and bottom rails, add a lintel over wide openings, and keep cuts at least 300 mm from the corner posts and castings.',
    'Removing more than about half of a long wall (joining two boxes side by side) turns the wall from a deep beam into nothing: add posts at the cut edges and a continuous top beam sized by an engineer.',
    'Stacking: corner castings must line up so load goes post to post; tie stacked units with twist-locks or welded bridge plates. Offset stacking needs a steel transfer beam.',
    'Foundations: pad footings or piers under the corners (and at mid-length for 40 ft boxes), usually 600 mm square or more by 450 mm deep on firm ground; cast-in plates anchor the castings against wind. An empty box can overturn in a 35–40 m/s gust.',
    'Heat and condensation: insulate (PU spray foam, PIR boards or rockwool behind a vapour control layer), shade the roof with a ventilated second roof in hot climates, earth the shell, run wiring in conduit and replace or seal the pesticide-treated floor.',
  ], ['Cutting openings without framing', 'Walking or building on the roof without joists', 'Stacking off the corner castings', 'No anchors against wind uplift', 'Skipping insulation, which causes condensation and rust']),
  T('loads', 'building', 'Loads and load combinations', /\bloads?\b|dead load|imposed|live load|kn\/m|load combination|factor of safety|design load/i, [
    'Dead loads: reinforced concrete 24–25 kN/m³ (a 150 mm slab is 3.6 kN/m²), screed 22 kN/m³, steel 78.5 kN/m³, sandcrete block walls about 2.2 (150 mm) to 2.9 kN/m² (225 mm) plastered, finishes and services 0.5–1.0 kN/m², lightweight partitions 1.0 kN/m².',
    'Imposed loads (EN 1991-1-1): homes 1.5–2.0 kN/m², offices 2.5–3.0, classrooms 3.0, shops 4.0, assembly areas 4.0–5.0, storage 7.5 per metre of stacking height, roofs 0.6–0.75 (maintenance only), roof terraces 1.5–3.0.',
    'Ultimate design load: 1.35 × dead + 1.5 × imposed (EN 1990); older British practice uses 1.4 G + 1.6 Q. Serviceability checks (deflection, vibration) use the unfactored loads.',
    'Wind (EN 1991-1-4): velocity pressure q = 0.613 V² N/m² from the basic wind speed V; multiply by pressure coefficients (about +0.8 windward, −0.5 leeward, −0.9 to −1.5 on roofs and edges). Light roofs are governed by uplift, not weight.',
    'Always trace the load path: roof and floors → beams → columns or walls → foundations → soil, and give the building bracing or shear walls in both directions.',
  ], ['Forgetting partition and finishes loads', 'Designing light roofs for downward load only', 'Ignoring point loads from tanks and machinery']),
  T('concrete', 'building', 'Reinforced concrete design', /\bconcrete|\brc\b|rebar|reinforce|iron rods?|stirrup|cover|slab|column|beam|c20|c25|c30|grade 25/i, [
    'Grades: C20/25 for general work, C25/30 or C30/37 for structural members and anything exposed; mix by weight and test cubes at 7 and 28 days. Nominal 1:2:4 site mixes only reach about C15–C20.',
    'Cover to reinforcement: about 25 mm inside, 35–40 mm outside or exposed, 50–75 mm against the ground. Cover is what stops rebar rusting and spalling.',
    'Preliminary depths: simply supported slab span/28, continuous span/32, cantilever span/10; beams span/12 (simple) to span/15 (continuous). Columns at least 225 × 225 mm (230 × 230 in Nigerian practice), with 4Y12 minimum and links at 12 × bar diameter.',
    'Detailing: minimum tension steel 0.13% of the gross section; laps about 40–50 bar diameters; hooks on bars that end at supports; links closed with 135° hooks in seismic or heavily loaded zones.',
    'Workmanship: vibrate to remove voids, cure for at least 7 days (keep it wet or covered), strip slab soffits after about 14 days with back-propping, and never add water to stiffening concrete.',
  ], ['Insufficient cover', 'Too much water in the mix', 'Removing props too early', 'Starter bars missing at column bases']),
  T('steel', 'building', 'Structural steel', /\bsteel\b|rhs|shs|chs|\bub\b|\buc\b|i-beam|h-beam|portal frame|purlin|welding|bolt|galvani/i, [
    'Grades S275 and S355 (275 and 355 MPa yield). Preliminary beam depth span/20; portal frames suit 15–60 m clear spans; trusses 20–100 m; space frames 30–150 m.',
    'Deflection limits: floors span/360 (span/500 under brittle finishes), roofs span/200, cantilevers span/180.',
    'Columns are governed by buckling: capacity falls fast as slenderness (effective length ÷ radius of gyration) rises, so brace long columns and keep compression members stocky.',
    'Connections: grade 8.8 bolts for structural joints, fillet welds sized to the plate, base plates on grouted anchor bolts. Provide lateral restraint to compression flanges.',
    'Protect from corrosion (hot-dip galvanising about 85 µm, or blast cleaning plus zinc-rich primer and topcoat) and from fire (intumescent paint or boarding) where the code requires.',
  ], ['Unbraced compression flanges', 'Coastal steel without galvanising', 'Welding galvanised steel without fume control and repair']),
  T('timber', 'building', 'Timber structures and roofs', /\btimber|wood|hardwood|iroko|mahogany|glulam|clt|termite|rafter|joist|truss/i, [
    'Strength classes: C16 and C24 softwoods; tropical hardwoods such as Iroko, Mahogany and Opepe are stronger and more durable. Glulam and CLT span 10–50 m and suit exposed structures.',
    'Roof trusses at 600–1200 mm centres; rafters and joists about span/20–24 deep. Brace trusses diagonally and strap them down to the ring beam against wind uplift.',
    'Durability: treat against termites and fungi (pressure treatment or approved preservatives), keep timber off the ground and away from standing water, and ventilate roof spaces.',
  ], ['Untreated timber in termite areas', 'No hurricane straps', 'Notching joists near supports']),
  T('blockwork', 'building', 'Sandcrete blocks, bricks and masonry walls', /\bblock|sandcrete|brick|masonry|laterite|mortar|lintel|ring beam|dpc|damp[- ]proof/i, [
    'Sandcrete blocks: 225 mm (9-inch) for load-bearing and external walls, 150 mm (6-inch) for partitions. NIS 87 asks for about 2.5 N/mm² minimum crushing strength for individual blocks (3.45 N/mm² for load-bearing), which many site blocks miss: test them.',
    'Mortar about 1:6 cement:sand for blockwork; joints 10 mm; stagger vertical joints by half a block and tie corners.',
    'Put a reinforced concrete ring beam (bond beam) at wall-plate level to tie walls together and carry the roof, and lintels over every opening with at least 150–200 mm bearing each side.',
    'Stop rising damp with a damp-proof course (DPC) above ground level and a membrane under the floor slab; keep ground levels at least 150 mm below the DPC.',
  ], ['Weak, under-cured blocks', 'No ring beam', 'Openings too close to corners', 'Missing DPC']),
  T('slabs', 'building', 'Floors and slabs', /\bslab|floor|suspended|hollow pot|waffle|flat slab|screed|decking/i, [
    'Solid slabs span 4–6 m economically (one-way span/28–32, two-way deeper spans for the same thickness); hollow-pot and rib slabs, common in Nigeria, save concrete and weight on 5–8 m spans; flat slabs suit column grids of 6–9 m with drop panels or shear heads.',
    'Precast hollow-core planks span 6–12 m quickly; composite metal decking on steel beams spans 3–4 m unpropped.',
    'Allow for services zones, openings next to columns (punching shear), and movement joints in large slabs (about every 30 m).',
  ]),
  T('long-span', 'building', 'Long-span and special structures', /\blong[- ]span|stadium|hangar|warehouse|space ?frame|shell|dome|arch|cable|tensile|membrane|geodesic|vault|hypar|pavilion/i, [
    'Span ranges: portal frames 15–60 m, steel trusses 20–100 m, space frames 30–150 m, arches 30–200 m, cable-stayed and suspension systems 50 m to over 1 km, concrete shells 20–100 m with very thin sections.',
    'Arches and domes work in compression and push outwards at their base: resist the thrust with ties, buttresses or stiff foundations. Suspension and tensile structures pull inwards at anchors.',
    'Geodesic domes spread load through triangulated members; their frequency (subdivision) sets member count and how round they look. Hyperbolic paraboloid (hypar) shells are doubly curved yet built from straight lines.',
    'Long spans are governed by deflection, vibration and wind uplift more than strength; check ponding on flat roofs and provide a clear load path for bracing.',
  ]),
  T('services', 'building', 'Water, drainage and electrical services', /\bplumb|drain|sewage|septic|soakaway|water tank|borehole|gutter|downpipe|electric|wiring|earthing|solar|inverter/i, [
    'Water: allow about 150 litres per person per day for homes; store two days where supply is unreliable (overhead tank plus borehole or mains). Size pumps for peak flow.',
    'Drainage: 100 mm soil pipes at 1:40 to 1:60 fall, inspection chambers at changes of direction; septic tank capacity C = 180 × people + 2000 litres (BS 6297) followed by a soakaway sized by a percolation test.',
    'Rainwater: gutter flow Q = roof area × rainfall intensity ÷ 3600 (l/s); tropical storms can exceed 150 mm/h. One 75 mm downpipe carries roughly 1.5–2 l/s.',
    'Electrical: separate lighting and socket circuits, RCD protection, a proper earth electrode, surge protection, and cable sized for load and voltage drop. Plan solar and inverter space and ventilation early.',
  ]),
  T('thermal', 'building', 'Thermal performance, insulation and acoustics', /\bu[- ]?value|insulat|thermal|heat gain|condensation|acoustic|sound|noise|decibel/i, [
    'U-value = 1 / (Rsi + Σ thickness/λ + Rse). Typical U: 225 mm hollow sandcrete rendered about 1.7 W/m²K; with 50 mm PIR about 0.4; uninsulated metal roof about 7, with 50 mm insulation about 0.6.',
    'In hot climates the roof matters most: reflective coatings, a ventilated air gap and insulation under the sheet cut heat gain sharply; shade glass rather than insulate walls first.',
    'Condensation: keep a vapour control layer on the warm (air-conditioned) side of insulation and ventilate cavities.',
    'Acoustics: mass stops airborne sound (mass law), gaps leak it; separate structures and resilient layers stop impact noise. Target about 45–50 dB separation between homes.',
  ]),
  T('drawings', 'building', 'Drawings, scales and documentation', /\bdrawing|scale|plan|section|elevation|detail|bim|cad|revit|autocad|sketchup|dimension/i, [
    'Standard set: site plan 1:200–1:500, floor plans and sections 1:50 or 1:100, elevations 1:100, details 1:5–1:20. Dimensions in millimetres, levels in metres to three decimals.',
    'A buildable package has plans, sections, elevations, a structural set (foundations, beams, reinforcement schedules), services layouts and a specification or bill of quantities.',
    'BIM tools (Revit, ArchiCAD, Tekla) keep drawings and quantities in one model; SketchUp and Blender suit massing and visualisation; export GLB/IFC to share 3D models.',
  ]),
  T('styles', 'building', 'Architectural history and styles', /\bstyle|history|classical|gothic|baroque|modernis|brutalis|bauhaus|art deco|tropical modern|vernacular|parametric|deconstruct|postmodern/i, [
    'Classical: orders (Doric, Ionic, Corinthian), symmetry and proportion. Gothic: pointed arches, rib vaults and flying buttresses carrying thrust outward so walls can open up for glass.',
    'Modernism (Le Corbusier, Mies, Bauhaus): free plan, structural frame, honest materials. Brutalism: exposed concrete and monumental mass.',
    'Tropical Modernism (Maxwell Fry and Jane Drew in West Africa; Demas Nwoko and others): deep overhangs, brise-soleil, breeze-block screens, cross-ventilation and courtyards, modern forms shaped by climate.',
    'Contemporary: high-tech (exposed structure and services), deconstructivism, parametric and computational design (Zaha Hadid Architects), and a return to vernacular and low-carbon materials such as earth, bamboo and timber.',
  ]),
  T('foundations', 'building', 'Foundations', /\bfoundation|footing|raft|pile|strip|pad\b|soil|bearing capacity|settle/i, [
    'Strip footings carry wall loads; pad footings carry columns; a raft spreads the whole building on weak soil; piles reach firm strata through soft or expansive soil.',
    'Size a footing from load divided by allowable soil bearing pressure; typical firm clay or dense sand allows about 100 to 200 kN/m2, but get a soil test.',
    'Place footings below topsoil and below the zone of seasonal moisture change; expansive clays need deeper footings or piles.',
    'Provide a damp-proof course and membrane so ground moisture does not rise into walls.',
  ], ['Building on fill without compaction or testing', 'Footings on different soils without movement joints']),
  T('structural-systems', 'building', 'Structural systems and spans', /\bbeam|column|slab|span|load[- ]?bearing|frame|structur|lintel|truss|cantilever/i, [
    'Load path: roof and floors carry load to beams, beams to columns or walls, and those to foundations. Every load needs a continuous path to the ground.',
    'Reinforced concrete beams: preliminary depth about span/12 (simply supported) to span/15 (continuous). Slabs: about span/28 to span/30 for one-way slabs.',
    'Steel beams: preliminary depth about span/20. Timber joists: about span/20 to span/24 depending on spacing.',
    'Lateral stability comes from shear walls, braced bays or rigid frames; a building needs stability in both directions.',
    'Cantilevers are usually limited to about a third of the back span unless designed specifically.',
  ], ['Removing a load-bearing wall without a beam', 'Openings too close to corners of masonry walls']),
  T('climate', 'building', 'Climate-responsive design (hot and humid)', /\bclimate|hot|humid|ventilat|cool|sun|shade|orientation|tropic|passive|thermal|heat/i, [
    'Orient the long axis east to west so the long walls face north and south, where the sun is easier to shade.',
    'Cross-ventilation: openings on opposite walls, with the outlet at least as large as the inlet. Ceiling heights around 3 m help heat rise away from occupants.',
    'Deep roof overhangs (600 mm or more) and verandas shade walls and windows; light-coloured, reflective roofs cut heat gain.',
    'Ventilate the roof space and insulate under the roof sheet; the roof is the largest heat source in a single-storey building.',
  ]),
  T('spaces', 'building', 'Room sizes, circulation and accessibility', /\broom|bedroom|kitchen|toilet|bathroom|corridor|door|stair|ramp|accessib|layout|floor ?plan|circulation/i, [
    'Typical minimums: double bedroom about 11 to 12 m2, single bedroom about 7.5 m2, corridors 900 mm (1200 mm for wheelchair use), doors 800 to 900 mm clear.',
    'Habitable rooms need natural light and ventilation: a common rule is window area at least 10 percent of floor area, with openable area at least 5 percent.',
    'Stairs: rise 150 to 190 mm, going 250 mm or more, and 2R + G between 550 and 700 mm; handrails at 900 to 1000 mm; headroom 2 m or more.',
    'Ramps: 1:12 maximum gradient, with landings every 9 m or so of run.',
    'Keep wet rooms stacked and close together to shorten drainage runs.',
  ]),
  T('roofs', 'building', 'Roofs and drainage', /\broof|gutter|drain|rain|leak|pitch|parapet|flashing/i, [
    'Metal sheet roofs usually need a pitch of 5 to 10 degrees minimum depending on profile; tiles need much steeper pitches.',
    'Size gutters and downpipes for local rainfall intensity; tropical storms can exceed 100 mm per hour.',
    'Flash every junction (walls, chimneys, valleys) and give flat roofs a fall of at least 1:80 to outlets.',
  ]),
  T('fire-safety', 'building', 'Fire safety and escape', /\bfire|escape|exit|smoke|sprinkler|egress/i, [
    'Every occupied room needs a route to a final exit within the travel distance allowed by the local code; large rooms and upper floors often need two escape routes.',
    'Protect stairs as escape routes with fire-resisting walls and doors in multi-storey buildings.',
    'Fit smoke alarms in circulation areas and heat alarms in kitchens.',
  ]),
  T('microservices', 'software', 'Monolith versus microservices', /\bmicroservice|monolith|service boundar|domain[- ]driven|ddd|bounded context/i, [
    'Start with a well-structured modular monolith; split out services only where a module needs independent scaling, deployment or ownership by a separate team.',
    'Draw service boundaries around business capabilities (bounded contexts), not technical layers, and give each service its own data.',
    'Microservices trade code complexity for operational complexity: you need service discovery, distributed tracing, retries with backoff, idempotency and versioned APIs.',
    'Prefer asynchronous events between services for workflows; use synchronous calls only where the caller truly needs the answer now.',
  ], ['Distributed monolith: services that must deploy together', 'Shared database between services', 'Chatty synchronous call chains']),
  T('containers-software', 'software', 'Containers and orchestration (Docker, Kubernetes)', /\bdocker|kubernetes|k8s|pod|helm|orchestrat|container image|compose|dockerfile/i, [
    'One process per container; keep images small (multi-stage builds, slim or distroless bases) and pin versions.',
    'Treat containers as disposable: no state inside; use volumes or managed databases for data and object storage for files.',
    'Configure through environment variables and secrets, never baked into images (twelve-factor app).',
    'Kubernetes: set resource requests and limits, liveness and readiness probes, and a horizontal pod autoscaler; spread replicas across nodes and zones.',
    'Run as a non-root user, scan images for vulnerabilities, and use network policies to limit which pods talk to each other.',
  ], ['Running databases in containers without persistent volumes', 'Using latest tags in production']),
  T('scaling', 'software', 'Scalability, caching and data', /\bscal\w*|cache|caching|cdn|load balanc|database|sharding|replica|queue|kafka|redis|throughput|latency|performance/i, [
    'Scale stateless tiers horizontally behind a load balancer; keep session state in a shared store or signed tokens.',
    'Cache in layers: CDN for static and public content, an in-memory cache (Redis) for hot reads, and HTTP caching headers. Decide invalidation up front.',
    'Databases: add indexes for real query patterns, then read replicas, then partitioning or sharding. Measure before each step.',
    'Queues decouple spikes from processing and make retries safe; make consumers idempotent.',
  ]),
  T('reliability', 'software', 'Reliability, observability and security', /\breliab|availability|uptime|monitor|observab|logging|tracing|metrics|sla|slo|disaster|backup|security|auth/i, [
    'Define service level objectives and alert on symptoms users feel (error rate, latency), not on every internal metric.',
    'Collect structured logs, metrics and distributed traces with a shared request ID.',
    'Remove single points of failure; test backups by restoring them; document recovery time and recovery point objectives.',
    'Security basics: least-privilege access, secrets in a vault, TLS everywhere, input validation, dependency scanning, and audit logs.',
  ]),
  T('patterns', 'software', 'Architecture styles and patterns', /\bpattern|layered|hexagonal|clean architecture|event[- ]driven|cqrs|event sourcing|serverless|mvc|api gateway|architecture/i, [
    'Layered or hexagonal (ports and adapters) keeps business rules independent of frameworks and databases, which makes them testable.',
    'Event-driven architecture suits workflows spanning several systems; CQRS and event sourcing suit audit-heavy domains but add complexity.',
    'Serverless suits spiky, event-triggered work; watch cold starts, execution limits and vendor lock-in.',
    'An API gateway centralises authentication, rate limiting and routing in front of services.',
  ]),
];

const CHECKS = {
  building: [
    ['Structure', /beam|column|load|frame|structur|wall/i, 'State how loads reach the ground and how the building resists sideways (wind) forces.'],
    ['Foundations', /foundation|footing|soil|pile|raft/i, 'Name the foundation type and whether a soil investigation has been done.'],
    ['Climate', /ventilat|shade|overhang|insulat|orientation/i, 'Describe shading, ventilation and insulation for the local climate.'],
    ['Escape', /exit|escape|fire|stair/i, 'Show escape routes and travel distances; check the local fire code.'],
    ['Services', /electric|plumb|drain|water|sewage|power/i, 'Plan water, drainage, power and earthing routes early.'],
    ['Access', /ramp|accessib|wheelchair|door width/i, 'Check step-free access, door widths and a usable toilet.'],
  ],
  software: [
    ['Boundaries', /service|module|boundar|domain/i, 'Describe the modules or services and what each owns.'],
    ['Data', /database|store|storage|sql|postgres|mongo|redis/i, 'Say where each piece of data lives and who may write it.'],
    ['Scaling', /scal|load balanc|replica|autoscal|cache/i, 'Explain how the busiest path scales and what is cached.'],
    ['Failure', /retry|timeout|fallback|circuit|backup|redundan|failover/i, 'Cover timeouts, retries, backups and what happens when a dependency is down.'],
    ['Observability', /log|metric|trac|monitor|alert/i, 'Add logs, metrics, traces and alerts on user-facing symptoms.'],
    ['Security', /auth|tls|https|secret|encrypt|permission|role/i, 'State authentication, authorisation, secret storage and encryption in transit and at rest.'],
    ['Delivery', /ci|cd|pipeline|deploy|docker|kubernetes|container/i, 'Describe build, test and deployment, including rollbacks.'],
  ],
};

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function calculate(calc = '', p = {}) {
  const S = STRUCT;
  switch (calc) {
    case 'stairs': {
      const height = Number(p.floorToFloorMm || p.heightMm || 3000);
      let risers = Math.ceil(height / 180);
      const rise = height / risers;
      const going = Math.max(250, Math.min(300, 625 - 2 * rise));
      return { calc, floorToFloorMm: height, risers, riseMm: round(rise, 1), goingMm: round(going, 0), treads: risers - 1, runLengthMm: round((risers - 1) * going, 0), check2RplusG: round(2 * rise + going, 0), note: '2R + G should be 550 to 700 mm; rise 150 to 190 mm. Confirm against the local building code.' };
    }
    case 'beam_depth': case 'span_depth': {
      const material = String(p.material || p.element || 'concrete').toLowerCase();
      const element = /steel/.test(material) ? 'steel' : /timber|wood/.test(material) ? 'timber' : /slab/.test(material) || p.element === 'slab' ? 'slab' : /truss/.test(material) ? 'truss' : 'beam';
      return { calc, ...strip(S.spanDepth({ span: Number(p.spanM || 4), element, support: p.continuous ? 'continuous' : p.support || 'simple' })), note: 'Preliminary sizing only. A structural engineer must design the final member for the actual loads.' };
    }
    case 'beam': {
      const r = S.beam({ L: p.spanM ?? p.L, w: p.udlKnm ?? p.w, P: p.pointKn ?? p.P, a: p.pointAtM ?? p.a, support: p.support, section: p.section, material: p.material });
      return { calc, ...strip(r), note: 'Loads in kN and kN/m (factor them for strength). Preliminary check; an engineer confirms connections, lateral-torsional buckling and bearing.' };
    }
    case 'column': return { calc, ...strip(S.columnBuckling({ section: p.section, L: p.lengthM ?? p.L, K: p.K, material: p.material, curve: p.curve, NEd: p.axialKn ?? p.NEd })), note: 'Flexural buckling about the weak axis (EN 1993-1-1 §6.3.1).' };
    case 'loads': return { calc, ...strip(S.designLoad({ use: p.use, dead: p.deadKnm2, extras: p.extras })), table: { imposed: S.IMPOSED_LOADS, dead: S.DEAD_LOADS } };
    case 'wind': return { calc, ...strip(S.windLoad({ V: p.windSpeed ?? p.V, height: p.heightM, width: p.widthM, depth: p.depthM, Cp: p.Cp, CpRoof: p.CpRoof })) };
    case 'rc_beam': return { calc, ...strip(S.rcBeam({ M: p.momentKnm ?? p.M, b: p.widthMm ?? p.b, d: p.effectiveDepthMm ?? p.d, fcu: p.fcu, fy: p.fy })), note: 'BS 8110 simplified singly reinforced section; check shear links and deflection separately.' };
    case 'u_value': return { calc, ...strip(S.uValue({ layers: p.layers || [] })), materials: Object.keys(S.LAMBDA) };
    case 'gutter': return { calc, ...strip(S.gutterFlow({ area: p.roofAreaM2 ?? p.area, intensity: p.intensityMmH ?? p.intensity })) };
    case 'escape': return { calc, ...strip(S.escapeWidth({ occupants: p.occupants, storeys: p.storeys })) };
    case 'ramp': return { calc, ...strip(S.ramp({ rise: p.riseM ?? p.rise, gradient: p.gradient })) };
    case 'septic': case 'water': return { calc, ...strip(S.septicTank({ people: p.people, litresPerDay: p.litresPerDay, storageDays: p.storageDays })) };
    case 'ventilation': {
      const area = Number(p.floorAreaM2 || (Number(p.lengthM || 4) * Number(p.widthM || 3)));
      return { calc, floorAreaM2: round(area), minWindowAreaM2: round(area * 0.1), minOpenableAreaM2: round(area * 0.05), note: 'Common rule: glazing at least 10 percent and openable area at least 5 percent of floor area.' };
    }
    case 'footing': {
      const loadKn = Number(p.loadKn || 200);
      const bearing = Number(p.bearingKpa || 150);
      const area = loadKn * 1.1 / bearing;
      return { calc, loadKn, allowableBearingKpa: bearing, requiredAreaM2: round(area), squarePadSideM: round(Math.sqrt(area)), stripWidthM: p.lineLoadKnm ? round(Number(p.lineLoadKnm) * 1.1 / bearing) : undefined, note: 'Includes about 10 percent for footing self-weight. Get a soil test for the real bearing pressure.' };
    }
    case 'container_stack': case 'container_structure': {
      const levels = Math.max(1, Math.min(4, Math.round(Number(p.levels || 1))));
      const size = String(p.size || '20ft').toLowerCase().replace(/\s+/g, '');
      const openings = Array.isArray(p.openings) ? p.openings : [];
      const dims = { '10ft': [2.831, 2.352, 2.393], '20ft': [5.898, 2.352, 2.393], '40ft': [12.032, 2.352, 2.393], '40hc': [12.032, 2.352, 2.698], '45hc': [13.556, 2.352, 2.698] }[size] || [5.898, 2.352, 2.393];
      const modules = Array.from({ length: levels }, (_, L) => ({
        id: `m${L + 1}`, name: L ? `Level ${L} unit` : 'Ground unit', size, len: dims[0], wid: dims[1], hgt: dims[2], x: 0, z: 0, rot: 0, level: L,
        items: openings.filter(o => (o.level ?? 0) === L).map(o => ({ kind: 'opening', type: o.type || 'window', wall: o.wall || 'left', along: Number(o.along_m ?? o.along ?? dims[0] / 2), w: Number(o.width_m ?? o.w ?? 1.2), h: Number(o.height_m ?? o.h ?? 1.0), sill: Number(o.sill_m ?? o.sill ?? 0.9) })),
      }));
      const roofs = p.roofDeck ? [{ module: `m${levels}`, kind: 'deck' }] : [];
      const st = checkStructure({ modules, roofs, use: p.use || 'office' }, { windSpeed: Number(p.windSpeed) || undefined, soilBearing: Number(p.soilBearing) || undefined });
      return { calc: 'container_structure', ...st, note: 'Use design_container for a full layout; this checks the shell only.' };
    }
    default:
      return { calc, error: 'Unknown calculation. Use beam, column, loads, wind, rc_beam, span_depth, u_value, gutter, escape, ramp, septic, stairs, footing, ventilation or container_structure.' };
  }
}

// Drop the plotting functions so results serialise.
function strip(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (typeof v !== 'function') out[k] = v;
  if (Array.isArray(out.steps)) out.steps = out.steps.map(s => s.text);
  return out;
}

/** Entry point for the architecture_advisor tool. */
export async function architectureAdvisor({ mode = 'topic', question = '', domain = '', design = '', calc = '', params = {} } = {}) {
  if (mode === 'calc' || calc) return { status: 'success', mode: 'calc', result: calculate(calc, params || {}) };
  if (mode === 'check') {
    const d = domain === 'software' || (!domain && /service|api|database|server|docker|kubernetes|app\b|backend|frontend/i.test(design)) ? 'software' : 'building';
    const results = CHECKS[d].map(([area, re, advice]) => ({ area, covered: re.test(design), advice }));
    return {
      status: 'success', mode: 'check', domain: d,
      covered: results.filter(r => r.covered).map(r => r.area),
      gaps: results.filter(r => !r.covered).map(r => ({ area: r.area, advice: r.advice })),
      message: 'Review the design against these areas: praise what is covered, and turn each gap into a concrete recommendation.',
    };
  }
  const text = `${question} ${design}`;
  let topics = ARCH_TOPICS.filter(t => (!domain || t.domain === domain) && t.match.test(text));
  if (!topics.length) topics = ARCH_TOPICS.filter(t => !domain || t.domain === domain).slice(0, 2);
  let learned = [];
  try { learned = (await import('./knowledge-library.js')).searchKnowledge(text, { limit: 6 }); } catch { /* library unavailable (node without storage) */ }
  return {
    status: 'success', mode: 'topic',
    topics: topics.slice(0, 5).map(({ id, domain: dm, title, points, pitfalls }) => ({ id, domain: dm, title, points, pitfalls })),
    ...(learned.length ? { learned: learned.map(c => ({ term: c.term, summary: c.summary, source: c.source, learnedAt: c.learnedAt })) } : {}),
    message: `Use these reference notes${learned.length ? ' and the concepts you learned earlier (cite their sources)' : ''} to answer; apply them to the person's specific case and say where an engineer or local code must decide. If they do not cover the question, research it with browse_web and save what you learn with knowledge_library.`,
  };
}
