/* ============================================================
   Boeing 737-800 (Next Generation) — flight deck panels and
   exterior walk-around points

   Every panel a pilot or engineer meets on the flight deck and on
   the walk-around, grouped the way it sits in the aircraft, with
   what each control does. Drawn by control-panel.js; found by
   findControls() for the Vehicle Guide's Flight deck and Exterior
   modes and the Assistant's "One of these?" answers.

   Written from publicly available descriptions of the 737NG flight
   deck. Operators order different options and follow their own
   procedures, so this is for learning, not for operating an
   aircraft; `trim` notes say where fits differ.

   `anchor` names the package component the panel sits on and `at`
   the point within that component's bounds (0–1 per axis, x
   forward, y up, z from the left).
   ============================================================ */

import { makeFinder, allControls } from './controls-search.js';

export const VEHICLE_ID = 'boeing-737-800';
export const SPACES = { interior: 'Flight deck' };
export const HINTS = {
  exterior: 'Exterior: tap a marker to see the nose probes, doors, engines, landing gear, lights, refuelling and APU.',
  interior: 'Flight deck: drag to look around. Tap a marker to see the autopilot, displays, overhead panels, control stand and radios.',
};
export const OPERATING_NOTE = 'For learning only. Follow the operator’s approved manuals and checklists.';

const c = (id, kind, label, sym, what, more = {}) => ({ id, kind, label, sym, what, ...more });

export const CLUSTERS = [
  {
    id: 'mcp', zone: 'interior', name: 'Mode control panel (autopilot)', where: 'Centre of the glareshield',
    anchor: 'mode_control_panel', at: [0.5, 0.5, 0.5],
    aliases: ['mcp', 'autopilot', 'auto pilot', 'autothrottle', 'auto throttle', 'flight director', 'glareshield', 'heading bug', 'altitude knob', 'vnav', 'lnav', 'cmd', 'a/p'],
    rows: [[
      c('mcp-crs', 'knob', 'Course (CRS)', 'course', 'Sets the VOR or ILS course for the captain’s (left) or first officer’s (right) instruments.', { keywords: ['course', 'crs', 'vor course', 'ils course'] }),
      c('mcp-fd', 'rocker', 'Flight director', 'flight-director', 'Turns the flight director command bars on the primary flight display on or off.', { sym2: 'flight-director', keywords: ['flight director', 'f/d', 'fd'] }),
      c('mcp-at', 'rocker', 'A/T ARM', 'autothrottle', 'Arms the autothrottle so it can move the thrust levers to hold a speed or thrust.', { sym2: 'autothrottle', how: 'Arm before takeoff; the autothrottle then engages in the takeoff mode when TO/GA is pressed.', keywords: ['autothrottle', 'a/t', 'at arm', 'auto throttle'] }),
      c('mcp-speed', 'knob', 'IAS / MACH selector', 'speed', 'Sets the target speed for the autothrottle and flight director, shown in the window above it.', { how: 'Turn to set the speed. The C/O button beside it swaps between knots and Mach.', keywords: ['speed', 'ias', 'mach', 'speed knob', 'spd'] }),
      c('mcp-vnav', 'button', 'VNAV', 'vnav', 'Vertical navigation: the flight management computer controls climb, cruise and descent speeds and altitudes.', { keywords: ['vnav', 'vertical navigation'] }),
      c('mcp-lnav', 'button', 'LNAV', 'lnav', 'Lateral navigation: steers along the route programmed in the flight management computer.', { keywords: ['lnav', 'lateral navigation', 'route'] }),
    ], [
      c('mcp-hdg', 'knob', 'Heading and bank limit', 'heading', 'Sets the heading bug; the outer ring limits the bank angle the autopilot uses (10°–30°). HDG SEL flies the selected heading.', { keywords: ['heading', 'hdg', 'hdg sel', 'heading bug', 'bank angle'] }),
      c('mcp-app', 'button', 'APP', 'approach', 'Arms the approach mode to capture the ILS localizer and glideslope.', { keywords: ['app', 'approach', 'ils', 'localizer', 'glideslope'] }),
      c('mcp-alt', 'knob', 'Altitude selector', 'altitude', 'Sets the altitude the aircraft will climb or descend to and level at. ALT HOLD holds the current altitude.', { keywords: ['altitude', 'alt', 'alt hold', 'altitude knob', 'level off'] }),
      c('mcp-vs', 'dial', 'Vertical speed', 'vertical-speed', 'V/S mode holds a set climb or descent rate, chosen with the thumbwheel.', { keywords: ['vertical speed', 'v/s', 'vs', 'thumbwheel', 'rate of climb'] }),
      c('mcp-cmd', 'button', 'CMD A / CMD B', 'autopilot', 'Engages autopilot A or B. On a dual-channel approach both are engaged for an automatic landing.', { keywords: ['cmd', 'command', 'autopilot on', 'engage autopilot', 'cws'] }),
      c('mcp-disengage', 'handle', 'A/P disengage bar', 'autopilot', 'Pulled down, it disconnects both autopilots and stops them being re-engaged.', { keywords: ['disengage', 'disconnect autopilot', 'a/p disengage bar'] }),
    ]],
    note: 'The same speed, heading and altitude windows appear on the primary flight display.',
  },
  {
    id: 'efis', zone: 'interior', name: 'EFIS control panel', where: 'Glareshield, one in front of each pilot',
    anchor: 'efis_control_panels', at: [0.5, 0.5, 0.12],
    aliases: ['efis', 'baro', 'barometric', 'altimeter setting', 'minimums', 'map mode', 'range', 'weather radar display', 'terrain', 'nd range'],
    rows: [[
      c('efis-mins', 'knob', 'Minimums', 'minimums', 'Sets the decision altitude (BARO) or decision height (RADIO) shown on the primary flight display.', { keywords: ['minimums', 'mins', 'decision height', 'da', 'dh'] }),
      c('efis-baro', 'knob', 'Barometric setting', 'baro', 'Sets the altimeter pressure in inches or hectopascals; pushing it selects standard (29.92 in / 1013 hPa).', { keywords: ['baro', 'qnh', 'altimeter setting', 'std', 'standard', 'inches', 'hpa'] }),
      c('efis-mode', 'knob', 'Display mode', 'nav-mode', 'Chooses what the navigation display shows: APP, VOR, MAP or PLN.', { marks: ['APP', 'VOR', 'MAP', 'PLN'], keywords: ['map', 'mode', 'plan', 'nd mode'] }),
      c('efis-range', 'knob', 'Range', 'nav-mode', 'Sets the navigation display range, from 5 to 640 nautical miles.', { keywords: ['range', 'zoom', 'miles'] }),
    ], [
      c('efis-wxr', 'button', 'WXR', 'radar', 'Shows the weather radar picture on the navigation display.', { keywords: ['weather', 'radar', 'wxr'] }),
      c('efis-terr', 'button', 'TERR', 'altitude', 'Shows the terrain from the ground proximity warning system.', { keywords: ['terrain', 'terr', 'egpws', 'gpws'] }),
      c('efis-map', 'button', 'STA · WPT · ARPT · DATA · POS', 'nav-mode', 'Adds navaids, waypoints, airports, route data and position information to the map.', { keywords: ['waypoints', 'airports', 'stations', 'navaids'] }),
    ]],
  },
  {
    id: 'warnings', zone: 'interior', name: 'Fire warning and master caution', where: 'Glareshield, in front of each pilot',
    anchor: 'master_caution_lights', at: [0.5, 0.5, 0.05], lamps: true,
    aliases: ['master caution', 'fire warning', 'fire warn', 'six pack', 'annunciator', 'warning light', 'caution light', 'bell'],
    rows: [[
      c('fire-warn', 'lamp', 'FIRE WARN', 'fire', 'Red light with the fire bell: an engine, APU, cargo or wheel-well fire or overheat has been detected.', { color: 'red', how: 'Press to silence the bell and reset the light; the fire switch for the affected engine lights up to show which one.', keywords: ['fire', 'fire warn', 'bell', 'red light'] }),
      c('master-caution', 'lamp', 'MASTER CAUTION', 'master-caution', 'Amber light: a system fault needs attention. The six-pack annunciator beside it says which system.', { color: 'amber', how: 'Press to reset. Pressing the annunciator panel recalls any caution that is still active.', keywords: ['master caution', 'caution', 'amber light'] }),
      c('six-pack', 'tile', 'System annunciators', 'info', 'Six labels on each side (FLT CONT, IRS, FUEL, ELEC, APU, OVHT/DET; ANTI-ICE, HYD, DOORS, ENG, OVERHEAD, AIR COND) that point to the panel with the fault.', { keywords: ['six pack', 'annunciator', 'recall', 'system annunciator'] }),
    ]],
  },
  {
    id: 'captain-displays', zone: 'interior', name: 'Captain’s displays and standby instruments', where: 'Main instrument panel, left side',
    anchor: 'display_units_captain', at: [1, 0.5, 0.5], lamps: true,
    aliases: ['pfd', 'nd', 'primary flight display', 'navigation display', 'screens', 'displays', 'standby', 'isfd', 'clock', 'attitude', 'speed tape'],
    rows: [[
      c('pfd', 'screen', 'Primary flight display', 'attitude', 'Attitude, speed and altitude tapes, vertical speed, heading, the flight-mode annunciations and ILS deviation.', { screenText: 'PFD', keywords: ['pfd', 'primary flight display', 'attitude', 'speed tape', 'artificial horizon'] }),
      c('nd', 'screen', 'Navigation display', 'nav-mode', 'Map of the route, with weather radar, traffic (TCAS) and terrain overlays.', { screenText: 'ND', keywords: ['nd', 'navigation display', 'map', 'tcas', 'traffic'] }),
      c('isfd', 'screen', 'Integrated standby flight display', 'airspeed', 'Independent standby attitude, altitude and airspeed.', { screenText: 'Standby', trim: 'Older aircraft have separate standby instruments.', keywords: ['standby', 'isfd', 'backup instrument'] }),
    ], [
      c('ap-lights', 'lamp', 'A/P · A/T · FMC lights', 'autopilot', 'Red flashing A/P or A/T light: the autopilot or autothrottle has disconnected. Amber FMC: a flight management alert.', { color: 'red', keywords: ['a/p light', 'autopilot disconnect light', 'a/t light', 'fmc alert'] }),
      c('clock', 'button', 'Clock', 'odo', 'Clock with chronograph and elapsed-time functions.', { keywords: ['clock', 'timer', 'chronograph'] }),
    ]],
  },
  {
    id: 'center-panel', zone: 'interior', name: 'Landing gear, autobrake and engine display', where: 'Centre of the main instrument panel',
    anchor: 'landing_gear_lever', at: [1, 0.5, 0.5], lamps: true,
    aliases: ['landing gear', 'gear lever', 'gear handle', 'wheels', 'autobrake', 'rto', 'engine display', 'n1', 'egt', 'three greens', 'flap indicator'],
    rows: [[
      c('gear-lever', 'handle', 'Landing gear lever', 'gear-lever', 'Selects the gear UP, OFF or DN. The knob is wheel-shaped so it can be found by touch.', { marks: ['UP', 'OFF', 'DN'], how: 'Pull out and move. OFF removes hydraulic pressure from the gear once it is up and locked.', keywords: ['gear lever', 'landing gear', 'gear handle', 'gear up', 'gear down'] }),
      c('gear-lights', 'lamp', 'Gear indicator lights', 'gear-down', 'Three green lights: each gear is down and locked. Red: the gear is in transit or disagrees with the lever.', { color: 'green', keywords: ['three greens', 'gear lights', 'green light', 'red gear light'] }),
      c('autobrake', 'knob', 'Autobrake selector', 'brake', 'Sets automatic braking for landing (1, 2, 3, MAX) or for a rejected takeoff (RTO).', { marks: ['RTO', 'OFF', '1', '2', '3', 'MAX'], keywords: ['autobrake', 'rto', 'auto brake', 'max brake'] }),
    ], [
      c('engine-display', 'screen', 'Engine display', 'engine-start', 'Upper centre display: N1 (fan speed), EGT, fuel flow and fuel quantity, plus alerts. The lower one shows secondary engine data.', { screenText: 'N1 · EGT', keywords: ['engine display', 'n1', 'egt', 'fuel flow', 'eicas'] }),
      c('flap-indicator', 'dial', 'Flap position indicator', 'flaps', 'Shows the left and right trailing-edge flap positions.', { marks: ['0', '5', '15', '30', '40'], keywords: ['flap indicator', 'flap position'] }),
      c('brake-pressure', 'dial', 'Brake pressure', 'brake', 'Hydraulic brake accumulator pressure.', { keywords: ['brake pressure', 'accumulator'] }),
    ]],
  },
  {
    id: 'overhead-fuel', zone: 'interior', name: 'Fuel panel', where: 'Overhead panel, centre',
    anchor: 'overhead_panel', at: [0.55, 0.1, 0.42],
    aliases: ['fuel panel', 'fuel pumps', 'crossfeed', 'boost pumps', 'center tank', 'fuel temperature'],
    rows: [[
      c('fuel-pumps-main', 'rocker', 'Main tank pumps (FWD / AFT)', 'fuel-pump', 'Two boost pumps in each main tank feed its engine. The LOW PRESSURE light shows if a pump is not delivering.', { sym2: 'fuel-pump', keywords: ['fuel pump', 'boost pump', 'low pressure'] }),
      c('fuel-pumps-ctr', 'rocker', 'Centre tank pumps', 'fuel-pump', 'Centre tank pumps push harder than the main-tank pumps, so the centre tank is used first. Switched off when it is empty.', { sym2: 'fuel-pump', keywords: ['center tank', 'centre tank', 'ctr pump'] }),
      c('crossfeed', 'knob', 'Crossfeed selector', 'crossfeed', 'Opens a valve joining the left and right fuel manifolds, to balance fuel or feed both engines from one side.', { marks: ['CLOSED', 'OPEN'], keywords: ['crossfeed', 'fuel imbalance', 'balance fuel'] }),
      c('fuel-temp', 'dial', 'Fuel temperature', 'temp', 'Fuel temperature in the main tank.', { keywords: ['fuel temperature', 'fuel temp'] }),
    ]],
  },
  {
    id: 'overhead-electrical', zone: 'interior', name: 'Electrical and APU', where: 'Overhead panel, centre',
    anchor: 'overhead_panel', at: [0.4, 0.1, 0.58],
    aliases: ['electrical', 'battery switch', 'generator', 'ground power', 'standby power', 'apu switch', 'apu start', 'bus transfer'],
    rows: [[
      c('bat', 'rocker', 'Battery', 'battery', 'Connects the main battery. Usually the first switch on a cold aircraft.', { sym2: 'battery', keywords: ['battery switch', 'bat'] }),
      c('stby-power', 'knob', 'Standby power', 'battery', 'Selects the source for the standby buses; AUTO lets the battery take over if normal power fails.', { marks: ['BAT', 'OFF', 'AUTO'], keywords: ['standby power', 'stby'] }),
      c('grd-power', 'rocker', 'Ground power', 'outlet', 'Connects external ground power when it is plugged in and available.', { sym2: 'outlet', keywords: ['ground power', 'gpu', 'external power'] }),
      c('gen', 'rocker', 'Generator 1 / 2 and APU GEN', 'generator', 'Put the engine or APU generators on the buses.', { sym2: 'generator', keywords: ['generator', 'gen', 'apu gen', 'idg'] }),
    ], [
      c('apu-switch', 'knob', 'APU switch', 'apu', 'Starts and stops the auxiliary power unit. START is spring-loaded back to ON.', { marks: ['OFF', 'ON', 'START'], how: 'Turn to START and release; the APU runs up by itself. After shutdown it runs on for a short cooling period.', keywords: ['apu', 'apu start', 'auxiliary power'] }),
      c('apu-egt', 'dial', 'APU EGT', 'temp', 'APU exhaust gas temperature.', { keywords: ['apu egt', 'apu temperature'] }),
    ]],
  },
  {
    id: 'overhead-start-hyd', zone: 'interior', name: 'Engine start, hydraulics and flight controls', where: 'Overhead panel, forward and left',
    anchor: 'overhead_panel', at: [0.75, 0.1, 0.25],
    aliases: ['engine start', 'start switch', 'ignition', 'hydraulic pumps', 'hydraulics', 'yaw damper', 'flight control switches', 'alternate flaps', 'spoiler switches'],
    rows: [[
      c('eng-start', 'knob', 'Engine start switches', 'engine-start', 'GRD opens the starter valve to spin the engine with bleed air; CONT and FLT give continuous ignition in rain, turbulence or icing.', { marks: ['GRD', 'OFF', 'CONT', 'FLT'], keywords: ['engine start', 'start switch', 'grd', 'starter'] }),
      c('ign-select', 'knob', 'Ignition select', 'ignition', 'Chooses which igniter (left, right or both) is used.', { marks: ['L', 'BOTH', 'R'], keywords: ['ignition', 'igniter'] }),
      c('hyd-pumps', 'rocker', 'Hydraulic pumps', 'hydraulics', 'ENG 1 and ELEC 2 pressurise system A; ENG 2 and ELEC 1 pressurise system B.', { sym2: 'hydraulics', keywords: ['hydraulic pump', 'hyd', 'elec pump'] }),
    ], [
      c('flt-control', 'knob', 'Flight control A / B', 'hydraulics', 'Connects hydraulic systems A and B to the flight controls; STBY RUD powers the standby rudder unit instead.', { marks: ['STBY RUD', 'OFF', 'ON'], keywords: ['flight control switch', 'stby rud', 'standby rudder'] }),
      c('yaw-damper', 'rocker', 'Yaw damper', 'plane', 'Moves the rudder automatically to damp Dutch roll and coordinate turns.', { sym2: 'plane', keywords: ['yaw damper', 'dutch roll'] }),
      c('alt-flaps', 'rocker', 'Alternate flaps', 'flaps', 'Extends the flaps electrically if hydraulic system B fails (arm, then hold DOWN).', { sym2: 'flaps', keywords: ['alternate flaps', 'alt flaps'] }),
    ]],
  },
  {
    id: 'overhead-air', zone: 'interior', name: 'Air conditioning, pressurisation and anti-ice', where: 'Overhead panel, right and aft',
    anchor: 'overhead_panel', at: [0.3, 0.1, 0.78],
    aliases: ['packs', 'bleed', 'pressurisation', 'pressurization', 'cabin altitude', 'air conditioning', 'anti ice', 'window heat', 'probe heat', 'wing anti ice', 'engine anti ice'],
    rows: [[
      c('packs', 'knob', 'Pack switches', 'pack', 'Turn the two air-conditioning packs off, on (AUTO) or to HIGH flow.', { marks: ['OFF', 'AUTO', 'HIGH'], keywords: ['pack', 'packs', 'air conditioning'] }),
      c('bleeds', 'rocker', 'Engine and APU bleed', 'bleed', 'Open the valves that take compressed air from the engines or the APU for air conditioning, pressurisation, anti-ice and engine start.', { sym2: 'bleed', keywords: ['bleed', 'apu bleed', 'engine bleed'] }),
      c('press', 'knob', 'Pressurisation mode', 'pressurisation', 'AUTO schedules the cabin altitude from the flight and landing altitudes set on the panel; ALTN and MAN are backups.', { marks: ['AUTO', 'ALTN', 'MAN'], keywords: ['pressurisation', 'pressurization', 'cabin altitude', 'outflow valve'] }),
    ], [
      c('window-heat', 'rocker', 'Window heat', 'window-heat', 'Heats the flight deck windows against ice and to make them tougher against bird strikes.', { sym2: 'window-heat', keywords: ['window heat', 'windshield heat'] }),
      c('probe-heat', 'rocker', 'Probe heat', 'probe-heat', 'Heats the pitot probes, angle-of-attack vanes and temperature probe.', { sym2: 'probe-heat', keywords: ['probe heat', 'pitot heat'] }),
      c('anti-ice', 'rocker', 'Wing and engine anti-ice', 'anti-ice', 'Hot bleed air through the wing leading edges and the engine inlets to stop ice forming.', { sym2: 'anti-ice', keywords: ['anti-ice', 'anti ice', 'wing anti-ice', 'engine anti-ice', 'icing'] }),
    ]],
  },
  {
    id: 'overhead-lights', zone: 'interior', name: 'Exterior lights and cabin signs', where: 'Overhead panel, forward',
    anchor: 'overhead_panel', at: [0.95, 0.1, 0.5],
    aliases: ['landing lights', 'taxi light', 'strobe', 'beacon', 'logo light', 'position lights', 'seat belt sign', 'fasten seat belt', 'no smoking', 'emergency exit lights'],
    rows: [[
      c('landing-lights', 'rocker', 'Landing lights', 'landing-light', 'Fixed (and on some aircraft retractable) landing lights.', { sym2: 'landing-light', keywords: ['landing light', 'landing lights'] }),
      c('turnoff', 'rocker', 'Runway turnoff', 'landing-light', 'Lights angled out from the wing roots for turning off the runway.', { sym2: 'landing-light', keywords: ['runway turnoff', 'turnoff lights'] }),
      c('taxi', 'rocker', 'Taxi', 'taxi-light', 'Light on the nose gear.', { sym2: 'taxi-light', keywords: ['taxi light'] }),
      c('logo', 'rocker', 'Logo', 'logo-light', 'Lights the tail logo.', { sym2: 'logo-light', keywords: ['logo light'] }),
    ], [
      c('position', 'knob', 'Position and strobe', 'strobe', 'STEADY for the position lights, STROBE & STEADY to add the white strobes (switched on entering the runway).', { marks: ['STROBE', 'OFF', 'STEADY'], keywords: ['strobe', 'position lights', 'nav lights'] }),
      c('beacon', 'rocker', 'Anti-collision (beacon)', 'beacon', 'Red flashing beacons, on before pushback or engine start: they tell ground staff the aircraft is live.', { sym2: 'beacon', keywords: ['beacon', 'anti-collision', 'red light'] }),
      c('belts', 'knob', 'Fasten belts sign', 'seatbelt', 'Turns on the fasten-seat-belt signs in the cabin, with a chime.', { marks: ['OFF', 'AUTO', 'ON'], keywords: ['seat belt sign', 'fasten belts', 'seatbelt sign'] }),
      c('no-smoking', 'knob', 'No smoking sign', 'no-smoking', 'Turns on the no-smoking signs.', { marks: ['OFF', 'AUTO', 'ON'], keywords: ['no smoking'] }),
    ]],
  },
  {
    id: 'control-stand', zone: 'interior', name: 'Thrust levers, flaps and speed brake', where: 'Control stand between the pilots',
    anchor: 'thrust_levers', at: [0.5, 1, 0.5],
    aliases: ['throttle', 'throttles', 'thrust lever', 'flap lever', 'flaps', 'speed brake', 'speedbrake', 'spoilers', 'trim wheel', 'stab trim', 'parking brake', 'start lever', 'fuel cutoff', 'reverse thrust', 'toga'],
    rows: [[
      c('thrust-levers', 'handle', 'Thrust levers', 'thrust-lever', 'Set engine thrust; the autothrottle moves them when engaged. TO/GA switches below the knobs; autothrottle disconnect switches on the outboard sides.', { how: 'Reverse thrust levers on the front of each lever are lifted only after touchdown.', keywords: ['thrust lever', 'throttle', 'toga', 'to/ga', 'power levers', 'reverse thrust'] }),
      c('speed-brake', 'handle', 'Speed brake lever', 'speedbrake', 'Raises the spoilers: DOWN, ARMED (deploys them automatically at touchdown), FLIGHT DETENT, UP.', { marks: ['DOWN', 'ARMED', 'FLT', 'UP'], keywords: ['speed brake', 'speedbrake', 'spoilers', 'armed'] }),
      c('flap-lever', 'handle', 'Flap lever', 'flaps', 'Selects UP, 1, 2, 5, 10, 15, 25, 30 or 40. Gates at 1 and 15 guard against over-retracting in a go-around.', { marks: ['UP', '1', '5', '15', '30', '40'], keywords: ['flap lever', 'flaps', 'flap handle'] }),
    ], [
      c('stab-trim', 'dial', 'Stabiliser trim wheels', 'trim-wheel', 'Turn whenever the stabiliser trims (they can be wound by hand). The indicator shows units of trim and the green takeoff band.', { keywords: ['trim wheel', 'stab trim', 'stabilizer trim', 'stabiliser trim'] }),
      c('stab-cutout', 'rocker', 'Stab trim cutout switches', 'trim-wheel', 'Cut power to the electric trim (MAIN ELEC) and the autopilot trim (AUTO PILOT) — used for runaway trim.', { sym2: 'trim-wheel', keywords: ['stab trim cutout', 'cutout', 'runaway trim'] }),
      c('start-levers', 'handle', 'Engine start levers', 'engine-start', 'IDLE opens the engine fuel valve and powers ignition during start; CUTOFF shuts the engine down.', { marks: ['IDLE', 'CUTOFF'], keywords: ['start lever', 'fuel cutoff', 'cutoff', 'idle detent'] }),
      c('park-brake', 'handle', 'Parking brake', 'parking-brake', 'With the brake pedals pressed, pull to set; the red light shows it is set.', { keywords: ['parking brake', 'park brake'] }),
    ]],
  },
  {
    id: 'aft-pedestal', zone: 'interior', name: 'Radios, fire protection and trim', where: 'Aft electronic panel, behind the control stand',
    anchor: 'aft_electronic_panel', at: [0.5, 1, 0.5],
    aliases: ['radio', 'radios', 'vhf', 'transponder', 'tcas', 'squawk', 'weather radar', 'fire handle', 'fire switch', 'engine fire', 'rudder trim', 'aileron trim', 'audio panel'],
    rows: [[
      c('vhf', 'knob', 'VHF communication radios', 'radio', 'Tune the active and standby frequencies; the transfer switch swaps them.', { keywords: ['vhf', 'comm radio', 'frequency', 'com radio'] }),
      c('xpdr', 'knob', 'Transponder and TCAS', 'transponder', 'Sets the squawk code and the traffic collision avoidance mode (TA only or TA/RA).', { keywords: ['transponder', 'squawk', 'tcas', 'xpdr'] }),
      c('wxr-panel', 'knob', 'Weather radar', 'radar', 'Controls the radar mode, tilt and gain.', { keywords: ['weather radar', 'radar tilt'] }),
      c('audio', 'button', 'Audio control panel', 'mic', 'Chooses which radio each pilot transmits on and listens to.', { keywords: ['audio panel', 'acp', 'headset', 'intercom'] }),
    ], [
      c('fire-handles', 'handle', 'Engine and APU fire switches', 'fire', 'Pulling a fire switch shuts off fuel, bleed air, hydraulics and the generator for that engine; turning it fires an extinguisher bottle.', { how: 'Follow the fire checklist; the switch lights when its fire is detected.', keywords: ['fire handle', 'fire switch', 'engine fire', 'extinguisher', 'apu fire'] }),
      c('rudder-trim', 'knob', 'Rudder trim', 'plane', 'Trims the rudder, for example after an engine failure.', { keywords: ['rudder trim'] }),
      c('aileron-trim', 'rocker', 'Aileron trim', 'plane', 'Trims the ailerons (both switches must be moved together).', { sym2: 'plane', keywords: ['aileron trim'] }),
    ]],
  },
  {
    id: 'control-wheel', zone: 'interior', name: 'Control column and wheel', where: 'In front of each pilot',
    anchor: 'control_wheel_captain', at: [0.5, 0.5, 0.5],
    aliases: ['yoke', 'control wheel', 'control column', 'stick', 'trim switch', 'autopilot disconnect button', 'push to talk', 'mic switch'],
    rows: [[
      c('wheel', 'handle', 'Control wheel and column', 'yoke', 'Turn to roll, push and pull to pitch. The two columns are linked; the stick shaker warns of an approaching stall.', { keywords: ['control wheel', 'yoke', 'column', 'stick shaker'] }),
      c('trim-switches', 'rocker', 'Stabiliser trim switches', 'trim-wheel', 'Two switches on the outboard horn that must be moved together to trim electrically.', { sym2: 'trim-wheel', keywords: ['trim switch', 'electric trim', 'thumb switch'] }),
      c('ap-disconnect', 'button', 'Autopilot disconnect', 'autopilot', 'Disconnects the autopilot; a second press silences the warning.', { keywords: ['autopilot disconnect', 'a/p disconnect', 'red button'] }),
      c('ptt', 'button', 'Push-to-talk', 'mic', 'Microphone switch for the selected radio or the interphone.', { keywords: ['push to talk', 'ptt', 'mic', 'microphone'] }),
    ]],
  },
  {
    id: 'pedals-tiller', zone: 'interior', name: 'Rudder pedals, brakes and tiller', where: 'Floor and left sidewall',
    anchor: 'rudder_pedals_captain', at: [0.5, 0.5, 0.5],
    aliases: ['rudder pedals', 'pedals', 'toe brakes', 'brakes', 'tiller', 'nose wheel steering', 'steering'],
    rows: [[
      c('pedals', 'handle', 'Rudder pedals', 'pedals', 'Move the rudder, and steer the nose wheel a few degrees.', { keywords: ['rudder pedals', 'pedals', 'rudder'] }),
      c('toe-brakes', 'handle', 'Toe brakes', 'brake', 'Press the tops of the pedals to brake each main gear.', { keywords: ['toe brakes', 'brakes', 'wheel brakes'] }),
      c('tiller', 'dial', 'Nose-wheel steering tiller', 'tiller', 'Steers the nose wheel through up to about 78° for taxiing tight turns.', { trim: 'The captain has one; some aircraft also have one for the first officer.', keywords: ['tiller', 'steering', 'nose wheel steering', 'nws'] }),
    ]],
  },
  /* ---------------------------------------------------------- exterior */
  {
    id: 'ext-nose', zone: 'exterior', name: 'Nose: radome and probes', where: 'Nose and forward fuselage',
    anchor: 'radome', at: [0.4, 0.6, 0.5],
    aliases: ['nose', 'radome', 'pitot', 'pitot tube', 'probe', 'static port', 'angle of attack', 'aoa vane', 'tat probe', 'wiper', 'windshield wiper'],
    rows: [[
      c('radome', 'tile', 'Radome', 'radar', 'Nose cone covering the weather radar; it hinges up for access.', { keywords: ['radome', 'nose cone'] }),
      c('pitots', 'tile', 'Pitot probes', 'pitot', 'Heated probes for airspeed. Their covers must come off before flight.', { keywords: ['pitot', 'pitot probe', 'pitot cover'] }),
      c('aoa', 'tile', 'Angle-of-attack vanes', 'stall-warning', 'Measure angle of attack for the stall warning and instruments.', { keywords: ['aoa', 'angle of attack', 'alpha vane'] }),
      c('static', 'tile', 'Static ports', 'static-port', 'Flush ports sensing outside pressure for altitude; keep the marked area clean and undamaged.', { keywords: ['static port', 'static'] }),
      c('tat', 'tile', 'Total air temperature probe', 'temp', 'Measures air temperature for the engines and air data.', { keywords: ['tat', 'temperature probe'] }),
    ]],
  },
  {
    id: 'ext-doors', zone: 'exterior', name: 'Doors and exits', where: 'Both sides of the fuselage',
    anchor: 'door_l1', at: [0.5, 0.5, 0],
    aliases: ['door', 'doors', 'entry door', 'service door', 'exit', 'overwing exit', 'emergency exit', 'slide', 'escape slide', 'evacuation'],
    rows: [[
      c('entry-door', 'tile', 'Entry door (L1, L2)', 'aircraft-door', 'Plug door on the left, held shut by cabin pressure. It lifts, swings out and folds forward against the fuselage.', { keywords: ['entry door', 'l1', 'boarding door', 'passenger door'] }),
      c('service-door', 'tile', 'Service door (R1, R2)', 'aircraft-door', 'Galley door on the right for catering; also an emergency exit.', { keywords: ['service door', 'r1', 'galley door', 'catering'] }),
      c('slide', 'tile', 'Escape slide', 'slide', 'Each door carries an inflatable slide. When armed, opening the door deploys and inflates it; crews disarm doors before opening them at the gate.', { keywords: ['slide', 'escape slide', 'armed', 'disarm', 'girt bar'] }),
      c('overwing', 'tile', 'Overwing exits', 'aircraft-door', 'Two on each side of the 737-800. Pull the handle; on most NGs the hatch swings up out of the way. Step onto the wing and slide off the trailing edge.', { keywords: ['overwing exit', 'window exit', 'emergency exit row'] }),
    ]],
  },
  {
    id: 'ext-engine', zone: 'exterior', name: 'CFM56-7B engine', where: 'Under each wing',
    anchor: 'engine_inlet_cowl_left', at: [0.9, 0.5, 0.5],
    aliases: ['engine', 'jet engine', 'cfm56', 'inlet', 'fan', 'fan blades', 'nacelle', 'cowl', 'thrust reverser', 'exhaust', 'oil tank', 'engine oil'],
    rows: [[
      c('inlet', 'tile', 'Inlet and fan', 'engine-start', 'Check the inlet and fan blades for damage or foreign objects. Never approach a running engine: it sucks in air from well ahead of the inlet.', { keywords: ['inlet', 'fan', 'fan blades', 'intake', 'fod'] }),
      c('cowl-latches', 'tile', 'Fan cowl latches', 'lock', 'Latches along the bottom of the fan cowls; checked closed and flush on every walk-around.', { keywords: ['cowl latches', 'fan cowl', 'latch'] }),
      c('oil-service', 'tile', 'Engine oil', 'dipstick', 'Oil tank on the fan case with a sight gauge, reached through an access door in the cowl.', { keywords: ['engine oil', 'oil tank', 'oil level'] }),
      c('reverser', 'tile', 'Thrust reverser', 'reverser', 'Sleeves that slide aft after landing to turn the fan air forward.', { keywords: ['thrust reverser', 'reverser', 'reverse'] }),
      c('exhaust', 'tile', 'Exhaust', 'fire', 'Hot core exhaust and nozzle; jet blast is dangerous well behind the aircraft.', { keywords: ['exhaust', 'jet blast', 'nozzle'] }),
    ]],
  },
  {
    id: 'ext-gear', zone: 'exterior', name: 'Landing gear, wheels and brakes', where: 'Nose gear and main gear',
    anchor: 'main_gear_shock_strut_left', at: [0.5, 0.3, 0.5],
    aliases: ['landing gear', 'wheels', 'tyres', 'tires', 'brakes', 'wear pin', 'gear pin', 'ground lock', 'strut', 'oleo', 'towing'],
    rows: [[
      c('tyres', 'tile', 'Tyres', 'tyre', 'Nitrogen-filled tyres: H44.5 × 16.5-21 mains, 27 × 7.75-15 nose. Checked for cuts, wear and pressure; fusible plugs let hot tyres deflate safely.', { keywords: ['tyres', 'tires', 'tyre pressure', 'nitrogen'] }),
      c('brake-pins', 'tile', 'Brake wear pins', 'brake', 'Pins that shrink back as the brake wears; brakes are replaced when the pin reaches its limit.', { keywords: ['wear pin', 'brake wear', 'brakes'] }),
      c('gear-pins', 'tile', 'Gear pins (ground locks)', 'lock', 'Pins with red flags that lock the gear down on the ground; they are removed and stowed before flight.', { keywords: ['gear pin', 'ground lock', 'red flag'] }),
      c('struts', 'tile', 'Shock struts', 'gear-down', 'Oleo struts are checked for leaks and the right extension.', { keywords: ['oleo', 'strut', 'shock strut'] }),
      c('towing', 'tile', 'Towing and steering lockout', 'tiller', 'A bypass pin in the nose gear disconnects the steering so a tug can push the aircraft back.', { keywords: ['towing', 'pushback', 'bypass pin', 'tug'] }),
    ]],
  },
  {
    id: 'ext-lights', zone: 'exterior', name: 'Exterior lights', where: 'Wingtips, fuselage and tail',
    anchor: 'navigation_light_left', at: [0.5, 0.5, 0.5],
    aliases: ['lights', 'nav light', 'navigation light', 'position light', 'red light', 'green light', 'strobe', 'beacon', 'landing light', 'logo light'],
    rows: [[
      c('nav', 'tile', 'Position lights', 'nav-light', 'Red on the left wingtip, green on the right, white facing aft.', { keywords: ['position light', 'nav light', 'red and green light'] }),
      c('strobes', 'tile', 'Strobes', 'strobe', 'White strobes on the wingtips and tail.', { keywords: ['strobe'] }),
      c('beacons', 'tile', 'Beacons', 'beacon', 'Red flashing beacons on top and bottom: engines are about to start or running.', { keywords: ['beacon', 'red flashing'] }),
      c('landing', 'tile', 'Landing, turnoff and taxi lights', 'landing-light', 'Wing-root landing and turnoff lights, and the taxi light on the nose gear.', { keywords: ['landing light', 'taxi light', 'turnoff'] }),
      c('logo-ext', 'tile', 'Logo and wing lights', 'logo-light', 'Tail logo lights and the wing-inspection lights on the fuselage.', { keywords: ['logo light', 'wing light'] }),
    ]],
  },
  {
    id: 'ext-fuel', zone: 'exterior', name: 'Refuelling', where: 'Under the right wing',
    anchor: 'single_point_refuelling_panel', at: [0.5, 0.5, 0.5],
    aliases: ['refuel', 'refuelling', 'refueling', 'fuel', 'fuel panel', 'fuel nozzle', 'fuel vent', 'fuel quantity', 'drain'],
    rows: [[
      c('refuel-panel', 'tile', 'Refuelling panel', 'fuel-door', 'Pressure refuelling connection and panel; the fueller sets the load for each tank and the valves close automatically.', { keywords: ['refuelling panel', 'refuel panel', 'fuel panel', 'nozzle'] }),
      c('drains', 'tile', 'Fuel sump drains', 'washer-fluid', 'Drains at the low points of the tanks, sampled for water.', { keywords: ['sump', 'drain', 'water in fuel'] }),
      c('vents', 'tile', 'Fuel vents', 'fresh-air', 'Vents near the wingtips let the tanks breathe as fuel is used.', { keywords: ['fuel vent', 'vent'] }),
      c('bonding', 'tile', 'Bonding (grounding) point', 'power', 'The fuel truck is bonded to the aircraft before refuelling to prevent static sparks.', { keywords: ['bonding', 'grounding', 'static'] }),
    ]],
  },
  {
    id: 'ext-apu', zone: 'exterior', name: 'APU and tail cone', where: 'Tail cone',
    anchor: 'apu_inlet_door', at: [0.5, 0.5, 0.5],
    aliases: ['apu', 'auxiliary power unit', 'tail cone', 'apu exhaust', 'apu inlet'],
    rows: [[
      c('apu-inlet', 'tile', 'APU air inlet', 'fresh-air', 'Door that opens when the APU starts.', { keywords: ['apu inlet', 'apu door'] }),
      c('apu-exhaust', 'tile', 'APU exhaust', 'fire', 'Very hot exhaust at the end of the tail cone.', { keywords: ['apu exhaust'] }),
      c('apu-fire-ext', 'tile', 'APU fire protection', 'fire', 'On the ground an APU fire sounds a horn outside, and ground crew can shut the APU down and fire its bottle from an external panel.', { trim: 'Panel location varies; check the aircraft’s manuals.', keywords: ['apu fire', 'apu horn'] }),
    ]],
  },
  {
    id: 'ext-cargo', zone: 'exterior', name: 'Cargo doors', where: 'Right side, lower fuselage',
    anchor: 'cargo_door_forward', at: [0.5, 0.5, 1],
    aliases: ['cargo', 'cargo door', 'baggage door', 'hold', 'cargo hold', 'luggage'],
    rows: [[
      c('cargo-doors', 'tile', 'Forward and aft cargo doors', 'cargo-door', 'Plug doors that open inward and up inside the hold. Bags are loaded by hand from a belt loader.', { keywords: ['cargo door', 'hold door', 'baggage door'] }),
      c('cargo-holds', 'tile', 'Cargo holds', 'storage', 'Forward and aft bulk holds, about 44 m³ in all, lined and fire-protected.', { keywords: ['cargo hold', 'hold', 'baggage'] }),
    ]],
  },
];

export const CLUSTER = Object.fromEntries(CLUSTERS.map(x => [x.id, x]));
export { allControls };
export const findControls = makeFinder(CLUSTERS, { stop: ['boeing', '737', 'plane', 'aircraft', 'airplane', 'jet', 'cockpit', 'flight', 'deck'] });
