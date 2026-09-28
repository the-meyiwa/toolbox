/* ============================================================
   Cessna 172S Skyhawk SP — cockpit controls and pre-flight
   walk-around points

   The panel is the conventional six-instrument layout (aircraft from
   2005 on usually have the Garmin G1000; its switches are much the
   same). Written from the published 172S Pilot's Operating Handbook
   descriptions. For learning only — the aircraft's own handbook and
   checklist govern any real flight.

   `anchor` / `at`: the package component and the point within its
   bounds (0–1 per axis, x forward, y up, z from the left).
   ============================================================ */

import { makeFinder, allControls } from './controls-search.js';

export const VEHICLE_ID = 'cessna-172s';
export const SPACES = { interior: 'Cockpit' };
export const HINTS = {
  exterior: 'Exterior: tap a marker for the pre-flight walk-around — engine, wings, fuel, controls, gear and lights.',
  interior: 'Cockpit: drag to look around. Tap a marker to see the instruments, switches, engine controls, flaps, trim and fuel selector.',
};
export const OPERATING_NOTE = 'For learning only. Follow the aircraft’s own handbook and checklist.';

const c = (id, kind, label, sym, what, more = {}) => ({ id, kind, label, sym, what, ...more });

export const CLUSTERS = [
  {
    id: 'flight-instruments', zone: 'interior', name: 'Flight instruments (six pack)', where: 'Panel, in front of the left seat',
    anchor: 'flight_instruments', at: [1, 0.5, 0.5],
    aliases: ['six pack', 'instruments', 'airspeed', 'attitude', 'altimeter', 'turn coordinator', 'heading indicator', 'directional gyro', 'vsi', 'vertical speed', 'artificial horizon', 'gauges'],
    rows: [[
      c('asi', 'dial', 'Airspeed indicator', 'airspeed', 'Indicated airspeed in knots, with coloured arcs: white (flap range), green (normal), yellow (caution, smooth air only) and the red line at 163 KIAS.', { keywords: ['airspeed', 'asi', 'speed', 'knots', 'red line'] }),
      c('ai', 'dial', 'Attitude indicator', 'attitude', 'Shows pitch and bank against an artificial horizon. Vacuum-driven gyro.', { keywords: ['attitude', 'artificial horizon', 'ai', 'horizon'] }),
      c('alt', 'dial', 'Altimeter', 'altimeter', 'Altitude above sea level. Set the local pressure in the Kollsman window with the knob.', { how: 'Set the reported altimeter setting before takeoff and when told by ATC.', keywords: ['altimeter', 'altitude', 'kollsman', 'pressure setting'] }),
    ], [
      c('tc', 'dial', 'Turn coordinator', 'turn-coordinator', 'The little aircraft shows rate of turn; the ball shows whether the turn is coordinated ("step on the ball").', { keywords: ['turn coordinator', 'ball', 'turn rate', 'inclinometer'] }),
      c('hi', 'dial', 'Heading indicator', 'heading-indicator', 'Gyroscopic compass card. It drifts, so reset it to the magnetic compass about every 15 minutes.', { keywords: ['heading indicator', 'directional gyro', 'dg', 'heading'] }),
      c('vsi', 'dial', 'Vertical speed indicator', 'vsi', 'Rate of climb or descent in feet per minute.', { keywords: ['vsi', 'vertical speed', 'climb rate', 'descent rate'] }),
    ]],
  },
  {
    id: 'engine-instruments', zone: 'interior', name: 'Engine instruments and annunciators', where: 'Panel, left of centre', lamps: true,
    anchor: 'engine_instruments', at: [1, 0.5, 0.5],
    aliases: ['tachometer', 'tach', 'rpm', 'oil pressure', 'oil temperature', 'fuel gauge', 'fuel quantity', 'egt', 'fuel flow', 'vacuum gauge', 'ammeter', 'annunciator', 'low fuel light', 'low voltage'],
    rows: [[
      c('tach', 'dial', 'Tachometer', 'tachometer', 'Engine and propeller rpm; red line at 2,700 rpm. It also counts engine hours.', { keywords: ['tachometer', 'tach', 'rpm'] }),
      c('oil-p', 'dial', 'Oil pressure', 'oil-pressure', 'Green arc 50–90 psi. Pressure should rise within 30 seconds of start.', { keywords: ['oil pressure'] }),
      c('oil-t', 'dial', 'Oil temperature', 'temp', 'Green arc 100–245 °F.', { keywords: ['oil temperature', 'oil temp'] }),
      c('fuel-qty', 'dial', 'Fuel quantity (left / right)', 'low-fuel', 'Fuel in each wing tank. Always confirm by looking in the tanks before flight.', { keywords: ['fuel gauge', 'fuel quantity', 'fuel level'] }),
    ], [
      c('ff-egt', 'dial', 'Fuel flow and EGT', 'temp', 'Fuel flow in gallons per hour and exhaust gas temperature, used to lean the mixture.', { keywords: ['fuel flow', 'egt', 'exhaust gas temperature', 'leaning'] }),
      c('vac', 'dial', 'Vacuum and ammeter', 'battery', 'Suction for the gyros (4.5–5.5 in Hg) and the ammeter showing battery charge or discharge.', { keywords: ['vacuum', 'suction', 'ammeter'] }),
      c('annunciators', 'lamp', 'Annunciator panel', 'master-warning', 'Warning lights: LOW FUEL (left or right), OIL PRESS, LOW VAC and VOLTS.', { color: 'red', how: 'Test with the switch beside it before flight.', keywords: ['annunciator', 'low fuel light', 'low vacuum', 'volts light', 'warning light'] }),
    ]],
  },
  {
    id: 'switches', zone: 'interior', name: 'Master, ignition and light switches', where: 'Lower left of the panel',
    anchor: 'switch_panel', at: [1, 0.5, 0.4],
    aliases: ['master switch', 'master', 'alternator', 'battery', 'avionics master', 'fuel pump', 'beacon', 'landing light', 'taxi light', 'nav lights', 'strobe', 'pitot heat', 'ignition', 'key', 'magnetos', 'mags', 'start'],
    rows: [[
      c('master', 'rocker', 'Master switch (BAT / ALT)', 'master-switch', 'Split rocker: BAT connects the battery, ALT the alternator. ALT cannot be on without BAT.', { sym2: 'battery', keywords: ['master', 'master switch', 'bat', 'alt', 'alternator'] }),
      c('avionics', 'rocker', 'Avionics master', 'avionics', 'Powers the radios and avionics. Kept off during engine start and shutdown.', { sym2: 'avionics', keywords: ['avionics master', 'avionics', 'radio power'] }),
      c('fuel-pump', 'rocker', 'Fuel pump', 'fuel-pump', 'Electric auxiliary fuel pump, used for starting and as a backup to the engine-driven pump.', { sym2: 'fuel-pump', keywords: ['fuel pump', 'aux pump', 'auxiliary pump'] }),
      c('ignition', 'knob', 'Ignition switch', 'magnetos', 'Key switch for the two magnetos: OFF, R, L, BOTH, START. The run-up checks each magneto alone.', { marks: ['OFF', 'R', 'L', 'BOTH', 'START'], keywords: ['ignition', 'key', 'magneto', 'mags', 'mag check', 'start'] }),
    ], [
      c('beacon-sw', 'rocker', 'Beacon', 'beacon', 'Red flashing beacon, on before start.', { sym2: 'beacon', keywords: ['beacon'] }),
      c('land-sw', 'rocker', 'Landing and taxi', 'landing-light', 'Lights in the left wing leading edge.', { sym2: 'taxi-light', keywords: ['landing light', 'taxi light'] }),
      c('nav-sw', 'rocker', 'Navigation and strobe', 'strobe', 'Position lights and wingtip strobes.', { sym2: 'nav-light', keywords: ['nav lights', 'navigation lights', 'strobe'] }),
      c('pitot-sw', 'rocker', 'Pitot heat', 'probe-heat', 'Heats the pitot tube in visible moisture near freezing.', { sym2: 'probe-heat', keywords: ['pitot heat'] }),
    ]],
  },
  {
    id: 'power-controls', zone: 'interior', name: 'Throttle and mixture', where: 'Lower centre of the panel',
    anchor: 'throttle', at: [1, 0.5, 0.5],
    aliases: ['throttle', 'power', 'mixture', 'red knob', 'black knob', 'lean', 'rich', 'idle cutoff', 'friction lock'],
    rows: [[
      c('throttle', 'handle', 'Throttle', 'throttle', 'Black knob: push in for more power, pull out for less. A friction lock holds it in place.', { keywords: ['throttle', 'power', 'black knob'] }),
      c('mixture', 'handle', 'Mixture', 'mixture', 'Red knob: in for RICH, out to lean at altitude. Pulled fully out (idle cut-off) it stops the engine.', { keywords: ['mixture', 'red knob', 'lean', 'rich', 'idle cutoff', 'shut down'] }),
    ]],
  },
  {
    id: 'flaps-trim', zone: 'interior', name: 'Flaps and elevator trim', where: 'Right of the throttle, and between the seats',
    anchor: 'flap_switch', at: [1, 0.5, 0.5],
    aliases: ['flaps', 'flap lever', 'flap switch', 'trim', 'trim wheel', 'elevator trim', 'nose up', 'nose down'],
    rows: [[
      c('flap-lever', 'handle', 'Flap lever', 'flaps', 'Move to the 10°, 20° or 30° detent; the electric flaps follow and the indicator beside it shows their position.', { marks: ['0', '10', '20', '30'], keywords: ['flap lever', 'flap switch', 'flaps'] }),
      c('trim-wheel', 'dial', 'Elevator trim wheel', 'trim-wheel', 'Roll forward for nose down, back for nose up. Set to TAKEOFF before takeoff.', { keywords: ['trim', 'trim wheel', 'elevator trim'] }),
    ]],
  },
  {
    id: 'fuel', zone: 'interior', name: 'Fuel selector and shutoff', where: 'Floor between the front seats',
    anchor: 'fuel_selector', at: [0.5, 1, 0.5],
    aliases: ['fuel selector', 'fuel valve', 'both', 'left tank', 'right tank', 'fuel shutoff', 'fuel cutoff'],
    rows: [[
      c('selector', 'knob', 'Fuel selector', 'fuel-selector', 'LEFT, BOTH or RIGHT. BOTH for takeoff, landing and most flight.', { marks: ['LEFT', 'BOTH', 'RIGHT'], keywords: ['fuel selector', 'both', 'left tank', 'right tank'] }),
      c('shutoff', 'handle', 'Fuel shutoff valve', 'fuel-door', 'Red knob: pushed in (ON) for flight; pulled out it cuts all fuel to the engine, as in an engine fire.', { keywords: ['fuel shutoff', 'fuel cutoff', 'shutoff valve'] }),
    ]],
  },
  {
    id: 'avionics-stack', zone: 'interior', name: 'Radios and autopilot', where: 'Centre of the panel',
    anchor: 'avionics_stack', at: [1, 0.5, 0.5],
    aliases: ['radio', 'radios', 'com', 'nav', 'gps', 'transponder', 'squawk', 'audio panel', 'autopilot', 'kap 140', 'intercom'],
    rows: [[
      c('audio-panel', 'button', 'Audio panel', 'mic', 'Chooses the radio to talk and listen on, and runs the intercom and marker beacons.', { keywords: ['audio panel', 'intercom', 'marker'] }),
      c('navcom', 'knob', 'NAV / COM radios', 'radio', 'Communication and VOR/ILS navigation radios (often with GPS). Active and standby frequencies swap with a button.', { keywords: ['com', 'nav', 'radio', 'frequency', 'gps'] }),
      c('xpdr', 'knob', 'Transponder', 'transponder', 'Sends the squawk code and altitude to ATC radar.', { keywords: ['transponder', 'squawk', 'xpdr', 'code'] }),
      c('autopilot', 'button', 'Autopilot', 'autopilot', 'Holds wings level, a heading or a navigation course, and altitude or vertical speed on two-axis units.', { trim: 'Bendix/King KAP 140 on many conventional-panel aircraft; G1000 aircraft may have the GFC 700.', keywords: ['autopilot', 'kap 140', 'a/p'] }),
    ]],
  },
  {
    id: 'yoke-pedals', zone: 'interior', name: 'Yoke, pedals and brakes', where: 'In front of each front seat',
    anchor: 'control_yoke_left', at: [0.9, 0.5, 0.5],
    aliases: ['yoke', 'control wheel', 'push to talk', 'ptt', 'rudder pedals', 'brakes', 'toe brakes', 'parking brake', 'control lock'],
    rows: [[
      c('yoke', 'handle', 'Control yoke', 'yoke', 'Pull to raise the nose, push to lower it, turn to roll.', { keywords: ['yoke', 'control wheel', 'stick'] }),
      c('ptt', 'button', 'Push-to-talk', 'mic', 'Microphone switch on the left yoke.', { keywords: ['push to talk', 'ptt', 'mic'] }),
      c('pedals', 'handle', 'Rudder pedals and toe brakes', 'pedals', 'Move the rudder and steer the nose wheel; press the tops for the main-wheel brakes.', { keywords: ['rudder pedals', 'pedals', 'toe brakes', 'brakes', 'steering'] }),
      c('park-brake', 'handle', 'Parking brake', 'parking-brake', 'Press the toe brakes, pull the handle and turn it to lock.', { keywords: ['parking brake', 'park brake'] }),
      c('control-lock', 'tile', 'Control lock', 'lock', 'A pin through the yoke column that locks the controls while parked; it must be removed before flight.', { keywords: ['control lock', 'gust lock'] }),
    ]],
  },
  {
    id: 'cabin-controls', zone: 'interior', name: 'Cabin heat, air and circuit breakers', where: 'Lower right of the panel',
    anchor: 'cabin_heat_air_controls', at: [1, 0.5, 0.5],
    aliases: ['cabin heat', 'heater', 'cabin air', 'fresh air', 'circuit breaker', 'breakers', 'alternate static', 'carbon monoxide'],
    rows: [[
      c('heat', 'handle', 'Cabin heat', 'cabin-heat', 'Pull for warm air heated around the muffler.', { note: 'If you smell exhaust, push cabin heat off and open the fresh-air vents.', keywords: ['cabin heat', 'heater', 'heat'] }),
      c('air', 'handle', 'Cabin air', 'cabin-air', 'Pull for fresh air.', { keywords: ['cabin air', 'fresh air', 'vent'] }),
      c('breakers', 'tile', 'Circuit breakers', 'circuit-breaker', 'Push-to-reset breakers for each electrical circuit.', { keywords: ['circuit breaker', 'breaker', 'popped'] }),
      c('alt-static', 'handle', 'Alternate static source', 'static-port', 'Takes static pressure from inside the cabin if the outside port is blocked.', { keywords: ['alternate static', 'static source', 'blocked static'] }),
    ]],
  },
  /* --------------------------------------------------------- exterior */
  {
    id: 'ext-engine', zone: 'exterior', name: 'Engine, propeller and oil', where: 'Nose and cowling',
    anchor: 'oil_access_door', at: [0.5, 0.8, 0.5],
    aliases: ['engine', 'oil', 'dipstick', 'oil level', 'cowling', 'propeller', 'prop', 'spinner', 'air inlet', 'fuel strainer', 'gascolator'],
    rows: [[
      c('oil', 'tile', 'Oil dipstick', 'dipstick', 'Open the oil access door and check the level on the dipstick against the handbook minimum; capacity is 8 US qt.', { keywords: ['oil', 'dipstick', 'oil level', 'oil door'] }),
      c('prop', 'tile', 'Propeller and spinner', 'propeller', 'Check for nicks and security. Treat it as live at all times — a faulty magneto ground can let the engine fire.', { keywords: ['propeller', 'prop', 'spinner', 'nicks'] }),
      c('inlets', 'tile', 'Air inlets', 'fresh-air', 'Cooling-air inlets and the induction air filter in the nose; check they are clear of birds’ nests and debris.', { keywords: ['air inlet', 'air filter', 'cooling inlet', 'bird nest'] }),
      c('strainer', 'tile', 'Fuel strainer drain', 'washer-fluid', 'Drain under the cowling for water and sediment at the lowest point of the fuel system.', { keywords: ['fuel strainer', 'gascolator', 'strainer drain'] }),
    ]],
  },
  {
    id: 'ext-wing', zone: 'exterior', name: 'Wing: fuel, pitot and stall warning', where: 'Left wing (both wings for fuel)',
    anchor: 'fuel_cap_left', at: [0.5, 1, 0.5],
    aliases: ['wing', 'fuel cap', 'fuel tank', 'sump', 'fuel drain', 'fuel vent', 'pitot', 'pitot tube', 'stall warning', 'stall horn', 'tie down', 'strut'],
    rows: [[
      c('fuel-caps', 'tile', 'Fuel caps', 'fuel-door', 'Check the fuel level by looking in each tank, then secure the cap.', { keywords: ['fuel cap', 'fuel level', 'fuel tank'] }),
      c('sumps', 'tile', 'Sump drains', 'washer-fluid', 'Sample fuel from each sump into a clear cup: check it is blue 100LL (or green 100) and free of water.', { keywords: ['sump', 'fuel sample', 'fuel drain', 'water in fuel'] }),
      c('vent', 'tile', 'Fuel vent', 'fresh-air', 'Tube under the left wing that must be clear, or the tanks cannot feed.', { keywords: ['fuel vent', 'vent tube'] }),
      c('pitot-tube', 'tile', 'Pitot tube', 'pitot', 'Remove the cover and check the opening is clear.', { keywords: ['pitot', 'pitot tube', 'pitot cover'] }),
      c('stall', 'tile', 'Stall warning', 'stall-warning', 'Opening in the left leading edge that sounds the stall horn.', { keywords: ['stall warning', 'stall horn'] }),
    ]],
  },
  {
    id: 'ext-controls', zone: 'exterior', name: 'Control surfaces', where: 'Wings and tail',
    anchor: 'elevator_right', at: [0.2, 0.5, 0.5],
    aliases: ['aileron', 'ailerons', 'flap', 'flaps', 'elevator', 'trim tab', 'rudder', 'control surfaces', 'hinges'],
    rows: [[
      c('ailerons', 'tile', 'Ailerons', 'plane', 'Check freedom of movement, hinges and security.', { keywords: ['aileron'] }),
      c('flaps-ext', 'tile', 'Flaps', 'flaps', 'Check tracks, rollers and security with the flaps extended.', { keywords: ['flaps', 'flap'] }),
      c('elevator', 'tile', 'Elevator and trim tab', 'trim-wheel', 'Check the elevator and that the trim tab position matches the trim indicator.', { keywords: ['elevator', 'trim tab', 'tab'] }),
      c('rudder', 'tile', 'Rudder', 'pedals', 'Check freedom of movement and the rudder stops.', { keywords: ['rudder'] }),
    ]],
  },
  {
    id: 'ext-gear', zone: 'exterior', name: 'Landing gear, tyres and brakes', where: 'Main gear and nose gear',
    anchor: 'main_wheel_fairing_left', at: [0.5, 0.5, 0.5],
    aliases: ['landing gear', 'gear', 'wheels', 'tyres', 'tires', 'brakes', 'nose strut', 'nose wheel', 'shimmy damper', 'wheel pants', 'chocks'],
    rows: [[
      c('tyres', 'tile', 'Tyres', 'tyre', 'Main 6.00-6 and nose 5.00-5: check inflation, cuts and wear.', { keywords: ['tyre', 'tire', 'tyre pressure', 'tread'] }),
      c('brakes', 'tile', 'Brakes', 'brake', 'Disc brakes on the main wheels: check for leaks and worn pads.', { keywords: ['brakes', 'brake pads', 'brake leak'] }),
      c('nose-strut', 'tile', 'Nose strut and shimmy damper', 'gear-down', 'Check strut extension and that the shimmy damper and steering links are secure.', { keywords: ['nose strut', 'oleo', 'shimmy damper', 'nose gear'] }),
      c('chocks', 'tile', 'Chocks and tie-downs', 'chock', 'Remove chocks and untie the wings and tail before start.', { keywords: ['chocks', 'tie down', 'tiedown'] }),
    ]],
  },
  {
    id: 'ext-lights', zone: 'exterior', name: 'Exterior lights', where: 'Wingtips, tail and left wing',
    anchor: 'beacon', at: [0.5, 0.5, 0.5],
    aliases: ['lights', 'beacon', 'strobe', 'nav light', 'position light', 'landing light', 'taxi light'],
    rows: [[
      c('nav-lights', 'tile', 'Position and strobe lights', 'nav-light', 'Red left, green right, white on the tail; white strobes on the wingtips.', { keywords: ['nav lights', 'position lights', 'strobe'] }),
      c('beacon-ext', 'tile', 'Beacon', 'beacon', 'Red flashing beacon on top of the fin.', { keywords: ['beacon'] }),
      c('landing-ext', 'tile', 'Landing and taxi lights', 'landing-light', 'Two lights in the left wing leading edge.', { keywords: ['landing light', 'taxi light'] }),
    ]],
  },
  {
    id: 'ext-doors', zone: 'exterior', name: 'Doors, windows and static port', where: 'Fuselage sides',
    anchor: 'cabin_door_left', at: [0.5, 0.5, 0],
    aliases: ['door', 'doors', 'cabin door', 'baggage door', 'window', 'static port', 'door latch'],
    rows: [[
      c('cabin-door', 'tile', 'Cabin doors', 'aircraft-door', 'Hinged at the front. Latch and check before takeoff; a door that pops open in flight is noisy but not dangerous — keep flying the aircraft.', { keywords: ['cabin door', 'door', 'door latch', 'door open in flight'] }),
      c('baggage-door', 'tile', 'Baggage door', 'cargo-door', 'Lockable door to the baggage area on the left side.', { keywords: ['baggage door', 'luggage'] }),
      c('static-ext', 'tile', 'Static port', 'static-port', 'Check it is clear; a blocked port upsets the altimeter, VSI and airspeed.', { keywords: ['static port', 'static'] }),
    ]],
  },
];

export const CLUSTER = Object.fromEntries(CLUSTERS.map(x => [x.id, x]));
export { allControls };
export const findControls = makeFinder(CLUSTERS, { stop: ['cessna', '172', 'skyhawk', 'plane', 'aircraft', 'airplane', 'cockpit'] });
