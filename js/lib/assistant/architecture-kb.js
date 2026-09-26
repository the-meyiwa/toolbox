/* ============================================================
   Architecture knowledge for the Assistant: buildings (including
   shipping-container structures) and software/system design.

   architectureAdvisor() answers in three ways:
   - topic: returns the matching reference notes (principles,
     rules of thumb, common mistakes) for the model to build on;
   - check: runs a design description through a review checklist;
   - calc: small sizing rules (stairs, spans, ventilation,
     container stacking) with the working shown.
   Rules of thumb are preliminary sizing only; the notes say when
   an engineer or local building code must decide.
   ============================================================ */

const T = (id, domain, title, match, points, pitfalls = []) => ({ id, domain, title, match, points, pitfalls });

export const ARCH_TOPICS = [
  T('container-structure', 'building', 'Shipping-container buildings: structure', /\bcontainers?\b|\bportacabin|\bcargo box/i, [
    'A container carries its load through the four corner posts and the top and bottom rails; the corrugated walls act as shear panels that stop the box racking.',
    'Every opening cut into a wall removes shear capacity: frame it with steel box section or channel welded to the rails, and add a lintel over wide openings.',
    'Removing most of a long wall (joining two boxes side by side) needs a replacement beam and posts sized by an engineer.',
    'Stacking: corner castings line up and take the load; standard boxes are rated for heavy stacking, but only through the corners. Twist-locks or welded plates tie stacked units together against wind.',
    'Foundations: pad footings or concrete piers under the corners (and at mid-length for 40 ft boxes) are usually enough; keep the floor off the ground for ventilation.',
    'Heat and condensation: steel conducts heat fast. Insulate (rockwool, PU spray foam or PIR boards), add a ventilated roof over the box in hot climates, and use a vapour control layer on the warm side.',
    'Earth the steel shell and run wiring in conduit; treat the floor, because original plywood floors are often treated with pesticides.',
  ], ['Cutting openings without framing', 'No roof overhang in tropical sun', 'Skipping insulation, which causes condensation and rust']),
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
  switch (calc) {
    case 'stairs': {
      const height = Number(p.floorToFloorMm || p.heightMm || 3000);
      let risers = Math.ceil(height / 180);
      const rise = height / risers;
      const going = Math.max(250, Math.min(300, 625 - 2 * rise));
      return { calc, floorToFloorMm: height, risers, riseMm: round(rise, 1), goingMm: round(going, 0), treads: risers - 1, runLengthMm: round((risers - 1) * going, 0), check2RplusG: round(2 * rise + going, 0), note: '2R + G should be 550 to 700 mm; rise 150 to 190 mm. Confirm against the local building code.' };
    }
    case 'beam_depth': {
      const span = Number(p.spanM || 4);
      const material = String(p.material || 'concrete').toLowerCase();
      const ratio = material.startsWith('steel') ? 20 : material.startsWith('timber') ? 20 : p.continuous ? 15 : 12;
      return { calc, spanM: span, material, spanToDepth: ratio, preliminaryDepthMm: round(span * 1000 / ratio, 0), note: 'Preliminary sizing only. A structural engineer must design the final member for the actual loads.' };
    }
    case 'ventilation': {
      const area = Number(p.floorAreaM2 || (Number(p.lengthM || 4) * Number(p.widthM || 3)));
      return { calc, floorAreaM2: round(area), minWindowAreaM2: round(area * 0.1), minOpenableAreaM2: round(area * 0.05), note: 'Common rule: glazing at least 10 percent and openable area at least 5 percent of floor area.' };
    }
    case 'footing': {
      const loadKn = Number(p.loadKn || 200);
      const bearing = Number(p.bearingKpa || 150);
      const area = loadKn * 1.1 / bearing;
      return { calc, loadKn, allowableBearingKpa: bearing, requiredAreaM2: round(area), squarePadSideM: round(Math.sqrt(area)), note: 'Includes about 10 percent for footing self-weight. Get a soil test for the real bearing pressure.' };
    }
    case 'container_stack': {
      const levels = Number(p.levels || 2);
      const perBoxKg = Number(p.loadedMassKg || 6000);
      const bottomKg = perBoxKg * (levels - 1);
      return { calc, levels, loadedMassPerBoxKg: perBoxKg, loadOnBottomBoxKg: bottomKg, perCornerKg: round(bottomKg / 4, 0), note: 'ISO containers are rated for far more than this when loads go through aligned corner castings. Wall cut-outs and offset stacking change that entirely and need an engineer.' };
    }
    default:
      return { calc, error: 'Unknown calculation. Use stairs, beam_depth, ventilation, footing or container_stack.' };
  }
}

/** Entry point for the architecture_advisor tool. */
export function architectureAdvisor({ mode = 'topic', question = '', domain = '', design = '', calc = '', params = {} } = {}) {
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
  return {
    status: 'success', mode: 'topic',
    topics: topics.slice(0, 4).map(({ id, domain: dm, title, points, pitfalls }) => ({ id, domain: dm, title, points, pitfalls })),
    message: 'Use these reference notes to answer; apply them to the person\'s specific case and say where an engineer or local code must decide.',
  };
}
