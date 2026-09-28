/**
 * Reference data for the Cessna 172S Skyhawk SP package.
 *
 * Figures come from the published Pilot's Operating Handbook and the other
 * public sources in SOURCES. Geometry and placement are Toolbox
 * approximations and say so. This is for learning; the aircraft's own
 * approved handbook governs any real flight.
 */
import { makeDescriber, makeSheet, cap } from './package-data.mjs';

export const SOURCES = {
  poh: { label: 'Cessna 172S Pilot’s Operating Handbook and FAA-approved flight manual', url: 'https://www.befa.org/wp-content/uploads/2019/12/POH-Cessna-172S.pdf' },
  pohG1000: { label: 'Cessna 172S NAV III (G1000) Pilot’s Operating Handbook', url: 'https://www.norcalflight.com/pdfs/poh/POH_C172S_Nav_III.pdf' },
  aopa: { label: 'AOPA — Cessna 172 aircraft guide', url: 'https://www.aopa.org/go-fly/aircraft-and-ownership/aircraft-guide/aircraft/cessna-172' },
  specs: { label: 'Airmart — Cessna 172S Skyhawk performance and specifications', url: 'https://airmart.com/wp-content/uploads/2022/11/Cessna-172S-Skyhawk-Performance-and-Specs.pdf' },
  wiki: { label: 'Wikipedia — Cessna 172', url: 'https://en.wikipedia.org/wiki/Cessna_172' },
  lycoming: { label: 'Wikipedia — Lycoming O-360 (IO-360 variants)', url: 'https://en.wikipedia.org/wiki/Lycoming_O-360' }
};

export const LAYERS = [
  { id: 'airframe', label: 'Fuselage & cowling' },
  { id: 'doors', label: 'Doors' },
  { id: 'glass', label: 'Windows & windshield' },
  { id: 'wings', label: 'Wings & tail' },
  { id: 'controls', label: 'Flight control surfaces' },
  { id: 'engines', label: 'Engine & propeller' },
  { id: 'gear', label: 'Landing gear' },
  { id: 'lighting', label: 'Exterior lighting' },
  { id: 'sensors', label: 'Probes & antennas' },
  { id: 'cockpit', label: 'Cockpit & cabin' },
  { id: 'systems', label: 'Fuel & systems' }
];

const APPROX = 'Shape and position are a Toolbox approximation for orientation; not a Cessna drawing.';
const LEARN = 'For learning only; follow the aircraft’s own handbook and checklist.';

const FAMILIES = [
  /* ------------------------------------------------------------- airframe */
  { test: /^fuselage_cabin$/, data: () => ({ label: 'Fuselage, cabin section', category: 'Airframe', layer: 'airframe', description: 'Aluminium semi-monocoque cabin with the wing carry-through on top and the main-gear attachments underneath.', location: 'Centre fuselage.' }) },
  { test: /^fuselage_tailcone$/, data: () => ({ label: 'Tailcone', category: 'Airframe', layer: 'airframe', description: 'Monocoque rear fuselage carrying the tail; it houses the elevator and rudder cables and the ELT.', location: 'Behind the cabin.' }) },
  { test: /^cowling_(upper|lower)$/, data: (id, m) => ({ label: `${cap(m[1])} engine cowling`, category: 'Airframe', layer: 'airframe', description: m[1] === 'upper' ? 'Removable top cowling held by quick-release fasteners; it carries the oil access door.' : 'Lower cowling with the nose bowl, the cooling-air outlet and the exhaust exits.', location: 'Around the engine.' }) },
  { test: /^cowl_air_inlets$/, data: () => ({ label: 'Cooling-air inlets', category: 'Airframe', layer: 'airframe', description: 'Openings either side of the spinner that feed cooling air over the cylinders; birds’ nests here are a classic pre-flight find.', location: 'Nose bowl.' }) },
  { test: /^cowl_flaps_exhaust_outlet$/, data: () => ({ label: 'Cooling-air outlet', category: 'Airframe', layer: 'airframe', description: 'Where cooling air leaves the bottom of the cowling (the 172S has no cowl flaps).', location: 'Bottom rear of the cowling.', accuracyNote: APPROX }) },
  { test: /^oil_access_door$/, data: () => ({ label: 'Oil access door', category: 'Airframe', layer: 'airframe', description: 'Hinged door in the top cowling for checking and topping up the oil.', location: 'Top right of the cowling.', accuracyNote: APPROX }) },
  { test: /^firewall$/, data: () => ({ label: 'Firewall', category: 'Airframe', layer: 'airframe', description: 'Stainless-steel bulkhead between the engine and the cabin; the battery and fuel strainer mount on it.', location: 'Behind the engine.' }) },
  /* ---------------------------------------------------------------- doors */
  { test: /^cabin_door_(left|right)$/, data: (id, m) => ({ label: `Cabin door, ${m[1]}`, category: 'Doors', layer: 'doors', description: 'Cabin door hinged at its front edge, with an opening window. The pilot normally boards on the left.', location: `${cap(m[1])} side of the cabin.` }) },
  { test: /^door_window_(left|right)$/, data: (id, m) => ({ label: `Door window, ${m[1]}`, category: 'Glass', layer: 'glass', description: 'Acrylic window in the door; it can be opened on the ground and in flight below the handbook speed.', location: `${cap(m[1])} cabin door.`, sources: ['poh'] }) },
  { test: /^baggage_door$/, data: () => ({ label: 'Baggage door', category: 'Doors', layer: 'doors', description: 'Lockable door to the baggage area behind the rear seat.', location: 'Left side, behind the cabin.' }) },
  /* ---------------------------------------------------------------- glass */
  { test: /^windshield$/, data: () => ({ label: 'Windshield', category: 'Glass', layer: 'glass', description: 'One-piece acrylic windshield; clean with water and a soft cloth, never solvents or a dry rag.', location: 'Front of the cabin.' }) },
  { test: /^rear_side_window_(left|right)$/, data: (id, m) => ({ label: `Rear side window, ${m[1]}`, category: 'Glass', layer: 'glass', description: 'Fixed side window beside the rear seat.', location: `${cap(m[1])} side, behind the door.` }) },
  { test: /^rear_window$/, data: () => ({ label: 'Rear window', category: 'Glass', layer: 'glass', description: 'The wrap-around rear window behind the wing that gives the 172 its rear view.', location: 'Top of the fuselage behind the wing.' }) },
  /* ----------------------------------------------------------- wings, tail */
  { test: /^wing_(left|right)$/, data: (id, m) => ({ label: `Wing, ${m[1]}`, category: 'Wings', layer: 'wings', description: 'Strut-braced high wing with a constant-chord inboard section and tapered outer panel, 1°44′ of dihedral. It carries the fuel tank inboard.', location: `${cap(m[1])} side.`, specs: { 'Wing area (both)': '174 sq ft (16.2 m²)', Span: '36 ft 1 in (11.00 m)' }, sources: ['poh'] }) },
  { test: /^wing_strut_(left|right)$/, data: (id, m) => ({ label: `Wing strut, ${m[1]}`, category: 'Wings', layer: 'wings', description: 'Streamlined strut from the lower fuselage to the wing, carrying much of the wing’s lift load in flight.', location: `${cap(m[1])} side, below the wing.` }) },
  { test: /^horizontal_stabilizer_(left|right)$/, data: (id, m) => ({ label: `Horizontal stabiliser, ${m[1]}`, category: 'Tail', layer: 'wings', description: 'Fixed tailplane; the elevator hinges from its trailing edge.', location: 'Tail.' }) },
  { test: /^vertical_fin$/, data: () => ({ label: 'Vertical fin', category: 'Tail', layer: 'wings', description: 'Swept fin with a dorsal fairing; the rudder hinges from its trailing edge and the beacon sits on top.', location: 'Tail; the top of the fin is the highest point, 8 ft 11 in (2.72 m) up.', sources: ['poh'] }) },
  /* ------------------------------------------------------- control surfaces */
  { test: /^aileron_(left|right)$/, data: (id, m) => ({ label: `Aileron, ${m[1]}`, category: 'Flight controls', layer: 'controls', description: 'Cable-operated aileron; turning the yoke raises one and lowers the other to roll the aircraft.', location: `${cap(m[1])} wing, outboard trailing edge.` }) },
  { test: /^flap_(left|right)$/, data: (id, m) => ({ label: `Flap, ${m[1]}`, category: 'Flight controls', layer: 'controls', description: 'Electrically driven single-slotted flap, set with the flap switch to 0°, 10°, 20° or 30°. It moves aft and down on its tracks.', location: `${cap(m[1])} wing, inboard trailing edge.`, specs: { 'Max flap speed': '110 KIAS (10°), 85 KIAS (10°–30°)' }, sources: ['poh'] }) },
  { test: /^elevator_(left|right)$/, data: (id, m) => ({ label: `Elevator, ${m[1]}`, category: 'Flight controls', layer: 'controls', description: 'Pitches the nose up or down; pulling the yoke raises the elevator.', location: `${cap(m[1])} stabiliser trailing edge.` }) },
  { test: /^elevator_trim_tab$/, data: () => ({ label: 'Elevator trim tab', category: 'Flight controls', layer: 'controls', description: 'Tab on the right elevator, set by the trim wheel, that holds the elevator where the pilot wants it so the yoke needs no force.', location: 'Right elevator trailing edge.' }) },
  { test: /^rudder$/, data: () => ({ label: 'Rudder', category: 'Flight controls', layer: 'controls', description: 'Yaws the nose left or right, worked by the rudder pedals.', location: 'Fin trailing edge.' }) },
  /* ---------------------------------------------------------------- engine */
  { test: /^propeller$/, data: () => ({ label: 'Propeller', category: 'Engine', layer: 'engines', description: 'McCauley two-blade, fixed-pitch aluminium propeller, 76 in (1.93 m) across.', location: 'Front of the engine.', maintenance: 'Nicks are dressed out by a mechanic; always treat the propeller as live — a broken magneto ground wire can let it start.', sources: ['specs', 'poh'] }) },
  { test: /^propeller_spinner$/, data: () => ({ label: 'Spinner', category: 'Engine', layer: 'engines', description: 'Streamlined cover over the propeller hub.', location: 'Nose.' }) },
  { test: /^engine_crankcase$/, data: () => ({ label: 'Engine crankcase (Lycoming IO-360-L2A)', category: 'Engine', layer: 'engines', description: 'Four-cylinder, horizontally opposed, air-cooled, fuel-injected engine giving 180 bhp at 2,700 rpm. It drives the propeller directly.', location: 'Under the cowling.', specs: { Power: '180 bhp @ 2,700 rpm', Displacement: '361 cu in (5.9 L)' }, sources: ['poh', 'lycoming'] }) },
  { test: /^engine_cylinders$/, data: () => ({ label: 'Cylinders', category: 'Engine', layer: 'engines', description: 'Four air-cooled cylinders with finned barrels and heads, two on each side.', location: 'Each side of the crankcase.' }) },
  { test: /^oil_sump$/, data: () => ({ label: 'Oil sump', category: 'Engine', layer: 'engines', description: 'Holds the engine oil.', location: 'Bottom of the engine.', specs: { Capacity: '8 US qt (7.6 L)' }, sources: ['poh'] }) },
  { test: /^oil_dipstick$/, data: () => ({ label: 'Oil dipstick and filler', category: 'Engine', layer: 'engines', description: 'Checked on every pre-flight through the oil access door; the handbook gives the minimum for flight.', location: 'Top right rear of the engine.', sources: ['poh'], accuracyNote: APPROX }) },
  { test: /^oil_filter$/, data: () => ({ label: 'Oil filter', category: 'Engine', layer: 'engines', description: 'Spin-on full-flow filter.', location: 'Rear of the engine.', accuracyNote: APPROX }) },
  { test: /^induction_air_box$/, data: () => ({ label: 'Induction air box and filter', category: 'Engine', layer: 'engines', description: 'Takes filtered air from the nose inlet; an alternate-air door opens automatically if the filter ices over. (The fuel-injected 172S has no carburettor heat.)', location: 'Bottom front of the engine.', accuracyNote: APPROX }) },
  { test: /^fuel_injection_servo$/, data: () => ({ label: 'Fuel injection servo', category: 'Engine', layer: 'engines', description: 'Meters fuel to the injector nozzles according to airflow and the mixture setting.', location: 'Under the engine.', accuracyNote: APPROX }) },
  { test: /^exhaust_system$/, data: () => ({ label: 'Exhaust and muffler', category: 'Engine', layer: 'engines', description: 'Collects the exhaust into the muffler, whose shroud also supplies cabin heat — so an exhaust crack can bring carbon monoxide into the cabin.', location: 'Under the engine.', maintenance: 'A CO detector in the cabin is cheap insurance.' }) },
  { test: /^(alternator|starter_motor|magnetos|vacuum_pump)$/, data: (id, m) => ({ label: { alternator: 'Alternator', starter_motor: 'Starter motor', magnetos: 'Magnetos', vacuum_pump: 'Vacuum pump' }[m[1]], category: 'Engine', layer: 'engines', description: { alternator: 'Engine-driven alternator for the 28-volt electrical system.', starter_motor: 'Electric starter, engaged with the key.', magnetos: 'Two independent magnetos fire two plugs in every cylinder, independent of the battery. The key selects L, R or BOTH.', vacuum_pump: 'Drives the gyroscopic attitude and heading indicators (conventional panel).' }[m[1]], location: 'On the engine.', accuracyNote: APPROX }) },
  { test: /^engine_mount$/, data: () => ({ label: 'Engine mount', category: 'Engine', layer: 'engines', description: 'Welded steel-tube mount bolting the engine to the firewall through rubber isolators.', location: 'Between the engine and the firewall.' }) },
  { test: /^battery$/, data: () => ({ label: 'Battery', category: 'Systems', layer: 'systems', description: '24-volt battery for starting and backup electrical power.', location: 'Firewall, engine side.', accuracyNote: APPROX }) },
  { test: /^fuel_strainer$/, data: () => ({ label: 'Fuel strainer (gascolator)', category: 'Fuel', layer: 'systems', description: 'Lowest point of the fuel system; its drain is sampled on pre-flight for water and sediment.', location: 'Bottom of the firewall.', accuracyNote: APPROX }) },
  /* ---------------------------------------------------------------- gear */
  { test: /^main_gear_leg_(left|right)$/, data: (id, m) => ({ label: `Main gear leg, ${m[1]}`, category: 'Landing gear', layer: 'gear', description: 'Tubular spring-steel leg that absorbs landing loads by flexing.', location: `${cap(m[1])} side, below the cabin.` }) },
  { test: /^main_(tyre|wheel)_(left|right)$/, data: (id, m) => ({ label: `Main ${m[1]}, ${m[2]}`, category: 'Landing gear', layer: 'gear', description: m[1] === 'tyre' ? 'Main tyre.' : 'Main wheel.', location: `${cap(m[2])} main gear.`, specs: m[1] === 'tyre' ? { Size: '6.00-6' } : undefined, sources: ['poh'] }) },
  { test: /^main_brake_(left|right)$/, data: (id, m) => ({ label: `Main wheel brake, ${m[1]}`, category: 'Landing gear', layer: 'gear', description: 'Hydraulic disc brake worked by the toe of the rudder pedals.', location: `${cap(m[1])} main wheel.` }) },
  { test: /^main_wheel_fairing_(left|right)$/, data: (id, m) => ({ label: `Wheel fairing, ${m[1]}`, category: 'Landing gear', layer: 'gear', description: 'Streamlined "wheel pant" that reduces drag.', location: `${cap(m[1])} main wheel.` }) },
  { test: /^nose_gear_strut$/, data: () => ({ label: 'Nose gear strut', category: 'Landing gear', layer: 'gear', description: 'Air-oil shock strut. The nose wheel is steered by the rudder pedals through a spring link.', location: 'Under the engine.' }) },
  { test: /^nose_gear_shimmy_damper$/, data: () => ({ label: 'Shimmy damper', category: 'Landing gear', layer: 'gear', description: 'Damps nose-wheel shimmy.', location: 'Nose gear.' }) },
  { test: /^nose_(tyre|wheel)$/, data: (id, m) => ({ label: `Nose ${m[1]}`, category: 'Landing gear', layer: 'gear', description: m[1] === 'tyre' ? 'Nose tyre.' : 'Nose wheel.', location: 'Nose gear.', specs: m[1] === 'tyre' ? { Size: '5.00-5' } : undefined, sources: ['poh'] }) },
  { test: /^nose_wheel_fairing$/, data: () => ({ label: 'Nose wheel fairing', category: 'Landing gear', layer: 'gear', description: 'Wheel pant on the nose wheel.', location: 'Nose gear.' }) },
  { test: /^boarding_steps$/, data: () => ({ label: 'Boarding steps', category: 'Landing gear', layer: 'gear', description: 'Steps on the main gear legs for climbing in and for reaching the fuel caps.', location: 'Main gear legs.', accuracyNote: APPROX }) },
  { test: /^tie_down_rings$/, data: () => ({ label: 'Tie-down rings', category: 'Airframe', layer: 'airframe', description: 'Rings under each wing and the tail for tying the aircraft down when parked.', location: 'Under the wings and tail.' }) },
  /* -------------------------------------------------------------- lighting */
  { test: /^navigation_light_(left|right)$/, data: (id, m) => ({ label: `Navigation and strobe light, ${m[1]}`, category: 'Lighting', layer: 'lighting', description: `${m[1] === 'left' ? 'Red' : 'Green'} position light with a white strobe.`, location: `${cap(m[1])} wingtip.` }) },
  { test: /^tail_position_light$/, data: () => ({ label: 'Tail position light', category: 'Lighting', layer: 'lighting', description: 'White rear-facing position light.', location: 'Bottom of the rudder.' }) },
  { test: /^beacon$/, data: () => ({ label: 'Flashing beacon', category: 'Lighting', layer: 'lighting', description: 'Red anti-collision beacon, on before start-up.', location: 'Top of the fin.' }) },
  { test: /^landing_taxi_lights$/, data: () => ({ label: 'Landing and taxi lights', category: 'Lighting', layer: 'lighting', description: 'Two lights in the left wing leading edge.', location: 'Left wing leading edge.', sources: ['poh'] }) },
  /* --------------------------------------------------------------- sensors */
  { test: /^pitot_tube$/, data: () => ({ label: 'Pitot tube', category: 'Sensors', layer: 'sensors', description: 'Measures ram-air pressure for the airspeed indicator; electrically heated for flight in visible moisture. Remove its cover before flight.', location: 'Under the left wing.' }) },
  { test: /^static_port$/, data: () => ({ label: 'Static port', category: 'Sensors', layer: 'sensors', description: 'Senses outside air pressure for the altimeter, vertical speed and airspeed indicators. An alternate static source is inside the cabin.', location: 'Left side of the fuselage, ahead of the door.', accuracyNote: APPROX }) },
  { test: /^stall_warning_inlet$/, data: () => ({ label: 'Stall warning inlet', category: 'Sensors', layer: 'sensors', description: 'Opening in the leading edge that sounds the pneumatic stall horn as the wing nears the stall.', location: 'Left wing leading edge.' }) },
  { test: /^fuel_vent$/, data: () => ({ label: 'Fuel tank vent', category: 'Fuel', layer: 'systems', description: 'Vent tube under the left wing that lets air into the tanks as fuel is used; check it is clear on pre-flight.', location: 'Under the left wing, near the strut.' }) },
  { test: /^outside_air_temperature_probe$/, data: () => ({ label: 'Outside air temperature probe', category: 'Sensors', layer: 'sensors', description: 'Probe through the windshield top.', location: 'Top of the windshield.', accuracyNote: APPROX }) },
  { test: /^(com_antennas|nav_antenna|transponder_antenna)$/, data: (id, m) => ({ label: { com_antennas: 'Communication antennas', nav_antenna: 'Navigation antenna', transponder_antenna: 'Transponder antenna' }[m[1]], category: 'Sensors', layer: 'sensors', description: { com_antennas: 'VHF radio antennas on the cabin roof.', nav_antenna: 'VOR/localizer antenna on the fin.', transponder_antenna: 'Transponder antenna under the fuselage.' }[m[1]], location: 'Fuselage.', accuracyNote: APPROX }) },
  { test: /^elt$/, data: () => ({ label: 'Emergency locator transmitter (ELT)', category: 'Systems', layer: 'systems', description: 'Transmits a distress signal automatically after a crash.', location: 'Tailcone.', accuracyNote: APPROX }) },
  /* --------------------------------------------------------------- fuel */
  { test: /^fuel_tank_(left|right)$/, data: (id, m) => ({ label: `Fuel tank, ${m[1]} wing`, category: 'Fuel', layer: 'systems', description: 'Wing tank holding 28 US gal (26.5 usable). Fuel flows by gravity to the selector valve; the 172S also has an electric auxiliary pump.', location: `${cap(m[1])} wing, inboard.`, specs: { Capacity: '28 US gal (26.5 usable)', 'Fuel grade': '100LL (blue) or 100 (green) aviation gasoline' }, sources: ['poh'] }) },
  { test: /^fuel_cap_(left|right)$/, data: (id, m) => ({ label: `Fuel cap, ${m[1]}`, category: 'Fuel', layer: 'systems', description: 'Filler cap on top of the wing; check the level visually on pre-flight.', location: `Top of the ${m[1]} wing, near the strut.` }) },
  { test: /^fuel_sump_drains$/, data: () => ({ label: 'Fuel sump drains', category: 'Fuel', layer: 'systems', description: 'Quick drains under each tank (and more in the system) sampled before the first flight of the day and after refuelling.', location: 'Under each wing.', accuracyNote: APPROX }) },
  /* ----------------------------------------------------------- cockpit */
  { test: /^instrument_panel$/, data: () => ({ label: 'Instrument panel', category: 'Cockpit', layer: 'cockpit', description: 'Flight instruments in front of the pilot, radios in the centre, engine gauges and switches below. (G1000 aircraft have two large displays instead.)', location: 'Front of the cabin.' }) },
  { test: /^glareshield$/, data: () => ({ label: 'Glareshield', category: 'Cockpit', layer: 'cockpit', description: 'Top of the panel.', location: 'Top of the panel.' }) },
  { test: /^flight_instruments$/, data: () => ({ label: 'Flight instruments ("six pack")', category: 'Cockpit', layer: 'cockpit', description: 'Airspeed, attitude, altimeter (top row); turn coordinator, heading, vertical speed (bottom row).', location: 'Panel, in front of the left seat.' }) },
  { test: /^engine_instruments$/, data: () => ({ label: 'Engine instruments', category: 'Cockpit', layer: 'cockpit', description: 'Tachometer, fuel quantity, oil temperature and pressure, fuel flow / EGT and vacuum and electrical gauges.', location: 'Panel, left of centre.', accuracyNote: APPROX }) },
  { test: /^avionics_stack$/, data: () => ({ label: 'Avionics stack', category: 'Cockpit', layer: 'cockpit', description: 'Audio panel, navigation/communication radios, GPS, transponder and the autopilot.', location: 'Centre of the panel.' }) },
  { test: /^annunciator_panel$/, data: () => ({ label: 'Annunciator panel', category: 'Cockpit', layer: 'cockpit', description: 'Warning lights for low fuel, oil pressure, low vacuum and low voltage.', location: 'Top left of the panel.', accuracyNote: APPROX }) },
  { test: /^switch_panel$/, data: () => ({ label: 'Switch panel', category: 'Cockpit', layer: 'cockpit', description: 'Master (BAT/ALT), avionics master, fuel pump, beacon, landing, taxi, navigation and strobe lights, and pitot heat.', location: 'Lower left of the panel.' }) },
  { test: /^ignition_switch$/, data: () => ({ label: 'Ignition (magneto) switch', category: 'Cockpit', layer: 'cockpit', description: 'Key switch: OFF, R, L, BOTH, START.', location: 'Lower left of the panel.' }) },
  { test: /^throttle$/, data: () => ({ label: 'Throttle', category: 'Cockpit', layer: 'cockpit', description: 'Black push-pull knob: push in for more power; a friction lock holds it.', location: 'Lower centre of the panel.' }) },
  { test: /^mixture_control$/, data: () => ({ label: 'Mixture control', category: 'Cockpit', layer: 'cockpit', description: 'Red knob: in for rich, out to lean; pulling it fully out stops the engine.', location: 'Lower centre, right of the throttle.' }) },
  { test: /^flap_switch$/, data: () => ({ label: 'Flap switch and indicator', category: 'Cockpit', layer: 'cockpit', description: 'Lever with detents at 0°, 10°, 20° and 30°, with a position indicator beside it.', location: 'Lower centre-right of the panel.' }) },
  { test: /^elevator_trim_wheel$/, data: () => ({ label: 'Elevator trim wheel', category: 'Cockpit', layer: 'cockpit', description: 'Roll forward for nose down, back for nose up; the indicator beside it shows the setting.', location: 'Between the front seats, low on the console.' }) },
  { test: /^fuel_selector$/, data: () => ({ label: 'Fuel selector valve', category: 'Cockpit', layer: 'cockpit', description: 'LEFT, BOTH or RIGHT tank. BOTH is used for takeoff, landing and most flight.', location: 'Floor between the front seats.' }) },
  { test: /^fuel_shutoff_valve$/, data: () => ({ label: 'Fuel shutoff valve', category: 'Cockpit', layer: 'cockpit', description: 'Red knob: pushed in (ON) for flight; pulled out it cuts all fuel to the engine.', location: 'Floor, beside the fuel selector.' }) },
  { test: /^parking_brake_handle$/, data: () => ({ label: 'Parking brake handle', category: 'Cockpit', layer: 'cockpit', description: 'Set by pressing the toe brakes and pulling the handle.', location: 'Lower left of the panel.', accuracyNote: APPROX }) },
  { test: /^cabin_heat_air_controls$/, data: () => ({ label: 'Cabin heat and cabin air', category: 'Cockpit', layer: 'cockpit', description: 'Push-pull knobs for heated air (from the muffler shroud) and fresh air.', location: 'Lower right of the panel.', accuracyNote: APPROX }) },
  { test: /^circuit_breaker_panel$/, data: () => ({ label: 'Circuit breakers', category: 'Cockpit', layer: 'cockpit', description: 'Push-to-reset breakers for each electrical circuit.', location: 'Lower right of the panel.', accuracyNote: APPROX }) },
  { test: /^magnetic_compass$/, data: () => ({ label: 'Magnetic compass', category: 'Cockpit', layer: 'cockpit', description: 'Standby compass with its deviation card.', location: 'Top centre of the windshield.' }) },
  { test: /^control_yoke_(left|right)$/, data: (id, m) => ({ label: `Control yoke, ${m[1]}`, category: 'Cockpit', layer: 'cockpit', description: 'Push and pull for pitch, turn for roll. The left yoke carries the push-to-talk switch.', location: `In front of the ${m[1]} seat.` }) },
  { test: /^rudder_pedals_(left|right)$/, data: (id, m) => ({ label: `Rudder pedals, ${m[1]}`, category: 'Cockpit', layer: 'cockpit', description: 'Move the rudder and steer the nose wheel; press the tops for the brakes.', location: `Footwell of the ${m[1]} seat.` }) },
  { test: /^seat_front_(left|right)$/, data: (id, m) => ({ label: `Front seat, ${m[1]}`, category: 'Cockpit', layer: 'cockpit', description: 'Seat that slides on rails and adjusts in height and recline; check it is locked on the rail before takeoff.', location: `${cap(m[1])} front.` }) },
  { test: /^headrest_front_(left|right)$/, data: (id, m) => ({ label: `Headrest, ${m[1]}`, category: 'Cockpit', layer: 'cockpit', description: 'Front seat headrest.', location: `${cap(m[1])} front seat.` }) },
  { test: /^rear_seat$/, data: () => ({ label: 'Rear seat', category: 'Cockpit', layer: 'cockpit', description: 'Bench for two passengers.', location: 'Rear of the cabin.' }) },
  { test: /^seat_belts$/, data: () => ({ label: 'Seat belts and shoulder harnesses', category: 'Cockpit', layer: 'cockpit', description: 'Lap belts with shoulder harnesses (with inflatable restraints on some later aircraft).', location: 'Seats.' }) },
  { test: /^cabin_floor$/, data: () => ({ label: 'Cabin floor', category: 'Cockpit', layer: 'cockpit', description: 'Floor with the seat rails.', location: 'Cabin.' }) },
  { test: /^baggage_compartment$/, data: () => ({ label: 'Baggage compartment', category: 'Cockpit', layer: 'cockpit', description: 'Area behind the rear seat; the handbook limits the weight in each area and in total.', location: 'Behind the rear seat.', sources: ['poh'] }) }
];

export const describeComponent = makeDescriber({ families: FAMILIES, sources: SOURCES, defaultSources: ['poh'], accuracyNote: 'Geometry is a representative procedural model built from published dimensions.' });

export function specSheet() {
  return makeSheet({
    vehicle: 'Cessna 172S Skyhawk SP', generation: '172S',
    sources: SOURCES, sourceKeys: ['poh', 'pohG1000', 'specs', 'aopa', 'wiki', 'lycoming'],
    groups: [
      { title: 'Overview', rows: [['Type', 'Four-seat, single-engine, strut-braced high-wing monoplane'], ['Model', '172S Skyhawk SP (from 1998); G1000 NAV III avionics from 2005'], ['Family', 'The most-produced aircraft in history (over 44,000 Cessna 172s built)'], ['Seats', '4']] },
      { title: 'Dimensions', rows: [['Length', '27 ft 2 in (8.28 m)'], ['Wingspan', '36 ft 1 in (11.00 m)'], ['Height', '8 ft 11 in (2.72 m)'], ['Wing area', '174 sq ft (16.2 m²)'], ['Wheelbase', 'About 65 in (1.65 m)'], ['Propeller', 'McCauley two-blade fixed pitch, 76 in (1.93 m)']] },
      { title: 'Weights', rows: [['Maximum takeoff weight', '2,550 lb (1,157 kg)'], ['Standard empty weight', 'About 1,660 lb (753 kg); varies by equipment'], ['Baggage', 'Up to 120 lb, within the handbook’s area limits']] },
      { title: 'Engine & fuel', rows: [['Engine', 'Lycoming IO-360-L2A, four-cylinder, horizontally opposed, air-cooled, fuel-injected'], ['Power', '180 bhp @ 2,700 rpm'], ['Fuel', '56 US gal total, 53 usable (two wing tanks)'], ['Fuel grade', '100LL (blue) or 100 (green) aviation gasoline'], ['Oil', '8 US qt capacity, aviation-grade ashless dispersant oil']] },
      { title: 'Performance', rows: [['Maximum speed', '126 KTAS at sea level'], ['Cruise', '124 KTAS at 75 % power, 8,000 ft'], ['Range', '518 nm at 75 % power; 638 nm at 45 % power'], ['Rate of climb', '730 ft/min at sea level'], ['Service ceiling', '14,000 ft'], ['Takeoff', '960 ft ground roll; 1,630 ft over a 50 ft obstacle'], ['Landing', '575 ft ground roll; 1,335 ft over a 50 ft obstacle'], ['Stall speed', '48 KCAS flaps up; 40 KCAS flaps 30°']] },
      { title: 'Airspeeds (KIAS)', rows: [['Never exceed (VNE)', '163'], ['Max structural cruise (VNO)', '129'], ['Manoeuvring (VA, 2,550 lb)', '105'], ['Max flap extended (VFE)', '110 at 10°; 85 at 10°–30°'], ['Best angle of climb (VX)', '62'], ['Best rate of climb (VY)', '74'], ['Best glide', '68']] },
      { title: 'Systems', rows: [['Electrical', '28-volt DC with engine-driven alternator and 24-volt battery'], ['Flaps', 'Electric single-slotted, 0°–30°'], ['Landing gear', 'Fixed tricycle: spring-steel main legs, air-oil nose strut steered by the rudder pedals'], ['Brakes', 'Hydraulic discs on the main wheels, toe-operated'], ['Tyres', 'Main 6.00-6, nose 5.00-5']] }
    ],
    disclaimer: `Figures are from the Cessna 172S handbook and the public sources listed; individual aircraft differ with equipment and modifications. ${LEARN}`
  });
}
