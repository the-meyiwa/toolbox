/* ============================================================
   2008 Lexus GX 470 — controls, switches, lamps and exterior
   features

   Grouped the way they sit in the vehicle, with what each one does
   and how to use it. Written from public descriptions of the
   2003–2009 GX 470; where equipment or the exact switch position
   varies, a `trim` or `note` says so and the owner's manual is the
   reference. Drawn by control-panel.js; found by findControls().

   `anchor` / `at`: the package component and the point within its
   bounds (0–1 per axis, x forward, y up, z from the left).
   ============================================================ */

import { makeFinder, allControls } from './controls-search.js';

export const VEHICLE_ID = 'lexus-gx-470-2008';
export const SPACES = {};
export const HINTS = {
  exterior: 'Exterior: tap a marker to see the lights, rear door and glass, fuel door, key, door-pillar label and engine bay.',
  interior: 'Interior: drag to look around the cabin. Tap a marker to see the switches, stalks, warning lights and 4WD controls.',
};

const c = (id, kind, label, sym, what, more = {}) => ({ id, kind, label, sym, what, ...more });
const MANUAL = 'Switch shapes and exact positions vary with year and equipment; see the owner’s manual.';

export const CLUSTERS = [
  {
    id: 'driver-door', zone: 'interior', name: 'Driver’s door switches', where: 'On the driver’s door armrest',
    anchor: 'door_front_left_trim_panel', at: [0.55, 0.3, 0.9],
    aliases: ['door', 'armrest', 'window', 'windows', 'power window', 'window switch', 'door lock', 'window lock', 'child lock'],
    rows: [[
      c('window-driver', 'rocker', 'Driver', 'window-up', 'Raises and lowers the driver’s window; press or pull fully for one-touch travel.', { sym2: 'window-down', keywords: ['driver window', 'auto down'] }),
      c('window-passenger', 'rocker', 'Front passenger', 'window-up', 'Front passenger window.', { sym2: 'window-down', keywords: ['passenger window'] }),
      c('window-rear-left', 'rocker', 'Rear left', 'window-up', 'Left rear window.', { sym2: 'window-down', keywords: ['rear window', 'back window'] }),
      c('window-rear-right', 'rocker', 'Rear right', 'window-up', 'Right rear window.', { sym2: 'window-down', keywords: ['rear window', 'back window'] }),
    ], [
      c('window-lock', 'button', 'Window lock', 'window-lock', 'Locks out the passengers’ window switches.', { keywords: ['window lock', 'child lock', 'passenger windows not working'] }),
      c('door-lock', 'rocker', 'Door lock', 'lock', 'Locks or unlocks all doors and the rear door.', { sym2: 'unlock', keywords: ['central locking', 'lock doors', 'unlock doors'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'light-stalk', zone: 'interior', name: 'Headlight and turn-signal lever', where: 'Stalk on the left of the steering column', stalk: 'left',
    anchor: 'steering_wheel', at: [0.4, 0.4, 0.05],
    aliases: ['headlights', 'headlamps', 'lights', 'turn signal', 'indicator', 'blinker', 'high beam', 'fog lights', 'left stalk', 'left lever'],
    rows: [[
      c('light-switch', 'lever', 'Headlight switch', 'low-beam', 'Turn the end of the lever: off, parking and tail lamps, headlights, or AUTO (on with the light sensor, where fitted).', { marks: ['OFF', 'parking-lamps', 'low-beam', 'AUTO'], keywords: ['headlight switch', 'lights on', 'auto lights'] }),
    ], [
      c('turn-signal', 'lever', 'Turn signals', 'turn', 'Push up for right, down for left.', { marks: ['turn-left', 'turn-right'], keywords: ['turn signal', 'indicator', 'blinker'] }),
      c('high-beam', 'lever', 'High beam and flash', 'high-beam', 'Push away for high beam; pull towards you to flash.', { marks: ['high-beam'], keywords: ['high beam', 'flash', 'full beam'] }),
      c('fog', 'lever', 'Fog lamps', 'front-fog', 'Turn the ring to switch the front fog lamps on with the headlights or parking lamps.', { marks: ['front-fog'], keywords: ['fog lights', 'fog lamps'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'wiper-stalk', zone: 'interior', name: 'Wiper and washer lever', where: 'Stalk on the right of the steering column', stalk: 'right',
    anchor: 'steering_wheel', at: [0.4, 0.4, 0.95],
    aliases: ['wipers', 'wiper', 'washer', 'rear wiper', 'windshield washer', 'right stalk', 'right lever'],
    rows: [[
      c('front-wipers', 'lever', 'Windscreen wipers', 'wiper', 'Move up for intermittent, low and high speed; the ring sets the intermittent delay.', { marks: ['MIST', 'INT', 'LO', 'HI'], keywords: ['wipers', 'windscreen wiper', 'windshield wiper'] }),
      c('front-washer', 'lever', 'Windscreen washer', 'washer', 'Pull the lever towards you to spray and wipe.', { marks: ['washer'], keywords: ['washer', 'spray'] }),
    ], [
      c('rear-wiper', 'lever', 'Rear wiper and washer', 'rear-defog', 'Turn the knob at the end of the lever for the rear wiper; turn further to wash the rear glass.', { marks: ['OFF', 'INT', 'ON'], keywords: ['rear wiper', 'rear washer', 'back wiper'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'cruise-stalk', zone: 'interior', name: 'Cruise control lever', where: 'Small lever at the lower right of the steering wheel',
    anchor: 'steering_wheel', at: [0.4, 0.2, 0.85],
    aliases: ['cruise', 'cruise control', 'set speed', 'resume'],
    rows: [[
      c('cruise-lever', 'lever', 'Cruise control', 'cruise', 'Press the end to turn cruise on; push down to set, up to resume or accelerate, pull to cancel.', { marks: ['cruise-set', 'cruise-res', 'cancel'], keywords: ['cruise control', 'set', 'resume', 'cancel'] }),
    ]],
  },
  {
    id: 'cluster', zone: 'interior', name: 'Instrument cluster warning and indicator lights', where: 'In the instrument cluster behind the steering wheel', lamps: true,
    anchor: 'instrument_cluster', at: [1, 0.5, 0.5],
    aliases: ['dashboard light', 'warning light', 'check engine', 'engine light', 'oil light', 'battery light', 'brake light', 'abs light', 'airbag light', 'slip', 'tire pressure light', 'center diff lock light', '4lo', 'l4 light'],
    rows: [[
      c('check-engine', 'lamp', 'Check engine', 'check-engine', 'The engine or emission control system has a fault. Flashing means a misfire: reduce speed and have it checked promptly.', { color: 'amber', keywords: ['check engine', 'engine light', 'mil'] }),
      c('oil-pressure', 'lamp', 'Low oil pressure', 'oil-pressure', 'Stop safely and switch off the engine; check the oil level.', { color: 'red', keywords: ['oil light', 'oil pressure'] }),
      c('charging', 'lamp', 'Charging system', 'battery', 'The alternator is not charging.', { color: 'red', keywords: ['battery light', 'charging'] }),
      c('brake', 'lamp', 'Brake system', 'brake', 'Parking brake on, low brake fluid or a brake fault.', { color: 'red', keywords: ['brake light', 'brake warning'] }),
      c('abs', 'lamp', 'ABS', 'abs', 'Anti-lock brakes are off due to a fault; normal braking remains.', { color: 'amber', keywords: ['abs light'] }),
      c('srs', 'lamp', 'Airbag (SRS)', 'srs', 'Fault in the airbags or seat-belt pretensioners.', { color: 'red', keywords: ['airbag light', 'srs'] }),
    ], [
      c('slip', 'lamp', 'Slip indicator', 'vsc-slip', 'Flashes while stability control (VSC) or traction control (A-TRAC) is working; stays on with a fault.', { color: 'amber', keywords: ['slip', 'vsc', 'traction', 'skid light'] }),
      c('tpms', 'lamp', 'Low tyre pressure', 'tpms', 'One or more tyres is well below the recommended pressure.', { color: 'amber', keywords: ['tire pressure light', 'tyre pressure', 'tpms'] }),
      c('diff-lock', 'lamp', 'Centre diff lock', 'diff-lock', 'The centre differential is locked.', { color: 'amber', keywords: ['center diff lock', 'centre diff lock', 'diff lock light'] }),
      c('l4', 'lamp', 'Low range (L4)', 'low-range', 'The transfer case is in low range.', { color: 'green', keywords: ['4lo', 'l4', 'low range', '4wd low'] }),
      c('low-fuel', 'lamp', 'Low fuel', 'low-fuel', 'Refuel soon.', { color: 'amber', keywords: ['low fuel', 'fuel light'] }),
      c('seatbelt', 'lamp', 'Seat belt reminder', 'seatbelt', 'The driver’s (or passenger’s) belt is not fastened.', { color: 'red', keywords: ['seat belt light'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'center-stack', zone: 'interior', name: 'Hazard switch, audio and climate', where: 'Centre of the dashboard',
    anchor: 'center_stack', at: [1, 0.6, 0.5],
    aliases: ['hazard', 'hazards', 'emergency flashers', 'radio', 'audio', 'navigation', 'screen', 'climate', 'heater', 'air conditioning', 'a/c', 'defrost', 'temperature'],
    rows: [[
      c('hazard', 'button', 'Hazard warning lights', 'hazard', 'Flashes all turn signals.', { keywords: ['hazard', 'hazards', 'flashers'] }),
      c('audio', 'screen', 'Audio / navigation', 'display', 'Audio system; the optional navigation system adds a touchscreen.', { screenText: 'Audio', keywords: ['radio', 'audio', 'navigation', 'screen'] }),
    ], [
      c('auto-climate', 'button', 'AUTO climate', 'auto', 'Automatic climate control holds the set temperature, choosing fan speed and vents.', { keywords: ['auto', 'climate', 'automatic climate'] }),
      c('temp', 'knob', 'Temperature (driver / passenger)', 'temp', 'Sets each side’s temperature.', { keywords: ['temperature', 'heat', 'dual zone'] }),
      c('ac', 'button', 'A/C', 'ac', 'Turns the air-conditioning compressor on or off.', { keywords: ['a/c', 'ac', 'air conditioning'] }),
      c('recirc', 'button', 'Recirculate', 'recirc', 'Recirculates cabin air.', { keywords: ['recirculate', 'recirc'] }),
      c('defrost', 'button', 'Front and rear defrost', 'front-defog', 'Clears the windscreen, and the rear glass with the heating grid.', { keywords: ['defrost', 'defog', 'demist'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'console', zone: 'interior', name: 'Gear selector and 4WD controls', where: 'Centre console between the front seats',
    anchor: 'four_wheel_drive_controls', at: [0.5, 1, 0.5],
    aliases: ['gear selector', 'shifter', 'gear lever', 'park', 'drive', '4wd', 'four wheel drive', 'low range', 'l4', 'transfer', 'center diff', 'centre diff', 'diff lock', 'dac', 'downhill assist', 'vsc off'],
    rows: [[
      c('shift', 'handle', 'Gear selector', 'gear', 'Five-speed automatic: P, R, N, D and lower limits for engine braking and towing.', { marks: ['P', 'R', 'N', 'D'], keywords: ['gear selector', 'shifter', 'park', 'drive', 'reverse'] }),
      c('transfer', 'handle', 'Transfer (H4 / L4)', 'low-range', 'Selects high or low range of the full-time 4WD. Use low range for steep, slow or very rough ground.', { marks: ['H4', 'N', 'L4'], how: 'Stop, put the transmission in N, then move the transfer control; the L4 light confirms low range.', keywords: ['transfer', 'l4', 'h4', 'low range', '4wd low'] }),
      c('diff-lock-sw', 'button', 'Centre diff lock', 'diff-lock', 'Locks the centre differential so front and rear turn together, for loose or slippery ground.', { how: 'Unlock on dry pavement; the indicator shows when it is locked.', keywords: ['diff lock', 'center diff', 'centre diff', 'lock differential'] }),
      c('dac', 'button', 'Downhill Assist Control (DAC)', 'dac', 'Holds a slow, steady speed down steep slopes without using the brake pedal.', { trim: 'Works in low range; see the owner’s manual for the exact conditions.', keywords: ['dac', 'downhill assist', 'hill descent'] }),
      c('vsc-off', 'button', 'VSC OFF', 'vsc-off', 'Turns stability control off, for example to rock free of snow or mud. Leave it on for normal driving.', { keywords: ['vsc off', 'stability control', 'traction'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'overhead', zone: 'interior', name: 'Overhead console', where: 'Headliner above the rear-view mirror',
    anchor: 'overhead_console', at: [0.5, 0, 0.5],
    aliases: ['map light', 'dome light', 'interior light', 'moonroof', 'sunroof', 'overhead'],
    rows: [[
      c('map-lights', 'button', 'Map lights', 'map-light', 'Reading lights for the front seats.', { keywords: ['map light', 'reading light'] }),
      c('dome', 'button', 'Interior light', 'dome-light', 'Cabin lights on, off or with the doors.', { keywords: ['dome light', 'interior light'] }),
      c('moonroof', 'rocker', 'Moonroof', 'sunroof', 'Opens, closes and tilts the moonroof.', { sym2: 'sunroof-tilt', trim: 'Vehicles with a moonroof.', keywords: ['moonroof', 'sunroof'] }),
    ]],
  },
  {
    id: 'releases', zone: 'interior', name: 'Bonnet release', where: 'Under the dashboard on the driver’s side',
    anchor: 'instrument_panel_lower', at: [0.3, 0.1, 0.1],
    aliases: ['hood release', 'bonnet release', 'open hood', 'open bonnet'],
    rows: [[
      c('hood-release', 'handle', 'Bonnet (hood) release', 'hood', 'Pull to pop the bonnet, then release the safety catch under its front edge.', { keywords: ['hood release', 'bonnet release', 'open hood'] }),
    ]],
  },
  /* ---------------------------------------------------------- exterior */
  {
    id: 'key', zone: 'exterior', name: 'Key and remote', where: 'The key fob',
    anchor: 'door_front_left_handle', at: [0.5, 0.5, 0.5],
    aliases: ['key', 'remote', 'fob', 'key fob', 'lock button', 'unlock button', 'panic'],
    rows: [[
      c('fob-lock', 'button', 'Lock', 'lock', 'Locks all doors.', { keywords: ['lock', 'lock button'] }),
      c('fob-unlock', 'button', 'Unlock', 'unlock', 'Unlocks the driver’s door; press again for all doors.', { keywords: ['unlock', 'unlock button'] }),
      c('fob-panic', 'button', 'Panic', 'panic', 'Sounds the alarm; press again to stop.', { keywords: ['panic', 'alarm'] }),
    ]],
    note: MANUAL,
  },
  {
    id: 'front-exterior', zone: 'exterior', name: 'Front of the vehicle', where: 'Headlamps, grille and bumper',
    anchor: 'radiator_grille', at: [1, 0.5, 0.5],
    aliases: ['headlamp', 'headlight', 'fog lamp', 'grille', 'front bumper', 'tow hook', 'front'],
    rows: [[
      c('headlamps-ext', 'tile', 'Headlamps', 'low-beam', 'Low and high beams with the parking lamps.', { keywords: ['headlamp', 'headlight'] }),
      c('fog-ext', 'tile', 'Fog lamps', 'front-fog', 'In the lower bumper.', { keywords: ['fog lamp', 'fog light'] }),
      c('grille-ext', 'tile', 'Grille', 'fan', 'Air for the radiator and A/C condenser; keep it clear of snow and debris.', { keywords: ['grille', 'radiator grille'] }),
      c('tow-hooks', 'tile', 'Tow hooks', 'hook', 'Recovery points under the front bumper, for straight pulls only.', { keywords: ['tow hook', 'recovery point'] }),
    ]],
  },
  {
    id: 'rear-exterior', zone: 'exterior', name: 'Rear door, glass and spare tyre', where: 'Rear of the vehicle',
    anchor: 'rear_door', at: [0, 0.5, 0.5],
    aliases: ['rear door', 'back door', 'tailgate', 'liftgate', 'rear glass', 'back glass', 'hatch', 'spare tire', 'spare tyre', 'tail lights', 'tail lamps', 'trailer'],
    rows: [[
      c('rear-door', 'tile', 'Side-hinged rear door', 'trunk', 'Swings out to the side, hinged on the right (passenger) side. Pull the handle on the left edge.', { keywords: ['rear door', 'back door', 'tailgate', 'swing gate'] }),
      c('rear-glass', 'tile', 'Rear glass hatch', 'glass-hatch', 'The rear window opens on its own, hinged at the top, for loading small items.', { note: 'It has its own release; see the owner’s manual for where it is on your vehicle.', keywords: ['rear glass', 'glass hatch', 'back glass', 'flip up glass'] }),
      c('spare', 'tile', 'Spare tyre', 'spare-tyre', 'Carried under the rear floor on a winch, lowered with the jack handle.', { keywords: ['spare tire', 'spare tyre', 'spare wheel', 'winch'] }),
      c('tail-lamps', 'tile', 'Tail lamps', 'parking-lamps', 'Tail, stop, turn and reversing lamps on the rear corners, and a high-mounted stop lamp on the door.', { keywords: ['tail lights', 'tail lamps', 'brake lights'] }),
    ]],
  },
  {
    id: 'fuel-filler', zone: 'exterior', name: 'Fuel filler door and cap', where: 'Left rear quarter panel',
    anchor: 'fuel_filler_door', at: [0.5, 0.5, 0.5],
    aliases: ['fuel door', 'gas cap', 'fuel cap', 'petrol', 'gas', 'refuel'],
    rows: [[
      c('fuel-door', 'tile', 'Fuel door', 'fuel-door', 'Flap over the fuel cap on the left rear quarter.', { keywords: ['fuel door', 'gas door'] }),
      c('fuel-cap', 'tile', 'Fuel cap', 'fuel-door', 'Turn to remove; tighten until it clicks. A loose cap can turn on the check-engine light.', { keywords: ['fuel cap', 'gas cap'] }),
    ]],
  },
  {
    id: 'door-pillar', zone: 'exterior', name: 'Driver’s door pillar labels', where: 'On the body pillar when the driver’s door is open',
    anchor: 'b_pillar_left', at: [0.5, 0.35, 0.5],
    aliases: ['tire pressure label', 'tyre pressure', 'door pillar', 'placard', 'label', 'vin'],
    rows: [[
      c('tyre-label', 'tile', 'Tyre and loading label', 'tyre', 'Recommended cold tyre pressures and the maximum load.', { keywords: ['tire pressure', 'tyre pressure', 'placard', 'label'] }),
      c('cert-label', 'tile', 'Certification label', 'info', 'Manufacture date, weights and the VIN.', { keywords: ['certification label', 'vin', 'gvwr'] }),
    ]],
  },
  {
    id: 'engine-bay', zone: 'exterior', name: 'Under the bonnet (2UZ-FE 4.7 L V8)', where: 'In the engine compartment',
    anchor: 'engine_block', at: [0.5, 1, 0.5],
    aliases: ['engine bay', 'under the hood', 'oil', 'dipstick', 'coolant', 'radiator cap', 'brake fluid', 'washer fluid', 'battery', 'fuse box', 'air filter', 'power steering fluid'],
    rows: [[
      c('oil-cap', 'tile', 'Oil filler cap', 'dipstick', 'On a cam cover. SAE 5W-30.', { keywords: ['oil cap', 'oil filler', 'add oil'] }),
      c('dipstick', 'tile', 'Oil dipstick', 'dipstick', 'Check with the engine off on level ground; the level should sit between the marks.', { keywords: ['dipstick', 'oil level'] }),
      c('coolant', 'tile', 'Coolant reservoir and radiator cap', 'coolant', 'Top up the reservoir when cold. Never open the radiator cap on a hot engine.', { keywords: ['coolant', 'radiator cap', 'antifreeze'] }),
      c('brake-fluid', 'tile', 'Brake fluid', 'brake-fluid', 'Reservoir on the master cylinder, driver’s side.', { keywords: ['brake fluid'] }),
    ], [
      c('battery', 'tile', '12 V battery', 'battery', 'Starting battery.', { keywords: ['battery', 'jump start'] }),
      c('fuses', 'tile', 'Fuse and relay box', 'fuse', 'Engine-room fuses; the lid shows the layout.', { keywords: ['fuse', 'fuse box', 'relay'] }),
      c('washer', 'tile', 'Washer fluid', 'washer-fluid', 'Washer reservoir.', { keywords: ['washer fluid', 'screenwash'] }),
      c('air-filter', 'tile', 'Air filter box', 'air-filter', 'Engine air filter.', { keywords: ['air filter', 'air cleaner'] }),
    ]],
    note: 'Positions of the reservoirs and boxes are approximate in the 3D model; see the owner’s manual.',
  },
];

export const CLUSTER = Object.fromEntries(CLUSTERS.map(x => [x.id, x]));
export { allControls };
export const findControls = makeFinder(CLUSTERS, { stop: ['lexus', 'gx', '470', 'gx470', 'suv', 'car'] });
