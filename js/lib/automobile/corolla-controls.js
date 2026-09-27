/* ============================================================
   2014–2016 Toyota Corolla (E170 North America / E180) —
   controls, switches, lamps and exterior features

   Every cluster of controls a driver can see or touch, grouped the
   way they sit in the car, with what each one does and how to use
   it. Drawn by control-panel.js; found by findControls() for the
   Automobile Guide's Interior and Exterior modes and the
   Assistant's "One of these?" answers.

   Sources: Toyota owner's manual and Quick Reference Guide for the
   2014–2016 Corolla (instrument panel overview, switches, lamps),
   Toyota parts catalogue (mirror switch 84870-02150 sits left of the
   steering column), owner guides for the fuel-door, trunk and hood
   releases. Equipment varies by grade (L, LE, LE Eco, S, and Plus /
   Premium packages) and market; `trim` notes say where.

   `anchor` names the package component the cluster sits on and `at`
   the point within that component's bounds (0–1 per axis, x forward,
   y up, z from the car's left), so hotspots land on the real part.

   Layout: `rows` of controls, drawn left to right; `kind` sets the
   drawing (button, round, rocker, knob, dial, lamp, lever, handle,
   port, screen, tile).
   ============================================================ */

export const VEHICLE_ID = 'toyota-corolla-2014-2016';

const c = (id, kind, label, sym, what, more = {}) => ({ id, kind, label, sym, what, ...more });

export const CLUSTERS = [
  {
    id: 'driver-door', zone: 'interior', name: 'Driver’s door switches', where: 'On the driver’s door armrest',
    anchor: 'door_front_left_trim_panel', at: [0.55, 0.62, 0.95],
    aliases: ['door', 'armrest', 'window', 'windows', 'power window', 'window switch', 'door switch', 'door button', 'lock button', 'child', 'window lock'],
    rows: [[
      c('window-driver', 'rocker', 'Driver', 'window-up', 'Raises and lowers the driver’s window.', { sym2: 'window-down', how: 'Push down to lower, pull up to raise; the window moves while you hold the switch. Push or pull it all the way to the second click for one-touch auto down (and auto up on grades that have it).', note: 'A jam-protection feature reverses the window if something is caught while it closes automatically.', keywords: ['driver window', 'auto down', 'one touch'] }),
      c('window-passenger', 'rocker', 'Front passenger', 'window-up', 'Raises and lowers the front passenger’s window from the driver’s seat.', { sym2: 'window-down', how: 'Push to lower, pull to raise while held.', keywords: ['passenger window'] }),
      c('window-rear-left', 'rocker', 'Rear left', 'window-up', 'Raises and lowers the left rear window.', { sym2: 'window-down', how: 'Push to lower, pull to raise while held.', keywords: ['rear window', 'back window'] }),
      c('window-rear-right', 'rocker', 'Rear right', 'window-up', 'Raises and lowers the right rear window.', { sym2: 'window-down', how: 'Push to lower, pull to raise while held.', keywords: ['rear window', 'back window'] }),
    ], [
      c('window-lock', 'button', 'Window lock', 'window-lock', 'Stops the passengers’ window switches working — the child lock for the windows.', { how: 'Press to lock out the passenger switches; the driver can still move every window. Press again to release.', note: 'Use it when children ride in the back.', keywords: ['window lock', 'child lock', 'lock out', 'passenger windows not working'] }),
      c('door-lock', 'rocker', 'Door lock', 'lock', 'Locks or unlocks every door at once from inside.', { sym2: 'unlock', how: 'Press the front (padlock closed) to lock all doors; press the rear (padlock open) to unlock them.', note: 'The car can also lock the doors automatically when you drive off and unlock them in P; a dealer can turn these settings on or off.', keywords: ['central locking', 'lock all doors', 'unlock doors'] }),
    ]],
  },
  {
    id: 'lower-left-dash', zone: 'interior', name: 'Switches left of the steering wheel', where: 'Low on the dashboard, left of the steering column',
    anchor: 'steering_wheel', at: [0.6, 0.05, 0.05],
    aliases: ['mirror', 'mirrors', 'side mirror', 'wing mirror', 'mirror switch', 'mirror knob', 'vsc', 'vsc off', 'traction', 'stability', 'tire pressure button', 'tpms button', 'reset button', 'set button', 'headlight level', 'left of steering wheel', 'knee', 'under the steering wheel'],
    rows: [[
      c('mirror-switch', 'knob', 'Outside mirrors', 'mirror', 'Adjusts the door mirrors electrically.', { marks: ['L', '•', 'R'], how: 'Turn the knob to L or R to choose a mirror, then tilt it up, down, left or right to aim that mirror. Turn it back to the centre to avoid moving a mirror by accident.', note: 'Some European cars add power folding here.', keywords: ['mirror adjust', 'adjust mirrors', 'side mirror', 'l r knob'] }),
      c('vsc-off', 'button', 'VSC OFF', 'vsc-off', 'Turns traction control (TRAC) and then vehicle stability control (VSC) off.', { how: 'Press briefly to turn TRAC off — useful to rock free of snow or mud; the “TRAC OFF” indicator lights. Press and hold for over 3 seconds with the car stopped to turn VSC off too. Press again to turn both back on.', note: 'Leave both on for normal driving.', keywords: ['vsc off', 'vsc', 'trac off', 'traction control', 'stability control', 'car with squiggly lines', 'skid'] }),
      c('tpms-set', 'button', 'Tire pressure warning reset', 'tpms-set', 'Teaches the tire-pressure warning system the pressures you have just set.', { how: 'Inflate all four tires to the pressure on the driver’s door-pillar label, switch the ignition ON, then press and hold the switch until the low-tire-pressure light blinks slowly three times. Drive for about 20 minutes to finish.', note: 'Needed after changing tire sizes or pressures, or rotating wheels on some grades.', keywords: ['tpms', 'tire pressure reset', 'tyre pressure', 'set button'] }),
      c('headlamp-level', 'knob', 'Headlight leveling (Europe)', 'headlamp-level', 'Lowers the headlight beams when the car is loaded so they do not dazzle oncoming drivers.', { marks: ['0', '1', '2', '3'], how: '0 with only the driver or front passengers; 1–3 as the load and passengers in the back increase.', trim: 'European and some other markets; North American cars do not have it.', keywords: ['headlight level', 'beam height', 'dial 0 1 2 3'] }),
    ]],
  },
  {
    id: 'steering-left', zone: 'interior', name: 'Steering wheel audio and phone switches', where: 'Left spoke of the steering wheel',
    anchor: 'steering_wheel', at: [0.3, 0.5, 0.25],
    aliases: ['steering wheel', 'steering wheel buttons', 'steering wheel controls', 'wheel buttons', 'volume', 'phone', 'bluetooth', 'call', 'answer', 'hang up', 'voice', 'talk', 'mode', 'seek'],
    rows: [[
      c('vol-up', 'button', 'Volume +', 'vol-up', 'Turns the audio (or call) volume up.', { how: 'Press, or hold to keep turning it up.', keywords: ['volume up', 'louder', 'plus'] }),
      c('seek-up', 'button', 'Seek / track up', 'seek-up', 'Next radio station, track or preset.', { how: 'Press for the next preset or track; hold to seek the next station or fast-forward.', keywords: ['next', 'skip', 'arrow up'] }),
      c('mode', 'button', 'MODE', 'mode', 'Turns the audio on and changes the source (radio, USB, Bluetooth, AUX…).', { how: 'Press to switch audio on or change the source; press and hold to mute or pause.', keywords: ['source', 'audio mode', 'mute'] }),
    ], [
      c('vol-down', 'button', 'Volume −', 'vol-down', 'Turns the audio (or call) volume down.', { how: 'Press, or hold to keep turning it down.', keywords: ['volume down', 'quieter', 'minus'] }),
      c('seek-down', 'button', 'Seek / track down', 'seek-down', 'Previous radio station, track or preset.', { how: 'Press for the previous preset or track; hold to seek down or rewind.', keywords: ['previous', 'back', 'arrow down'] }),
      c('talk', 'button', 'Talk', 'talk', 'Starts voice commands for the phone and audio.', { how: 'Press, wait for the beep, then speak a command such as “Call Mum”. Press and hold to cancel.', trim: 'Grades with the Bluetooth hands-free system (most).', keywords: ['voice command', 'voice control', 'face with sound waves'] }),
    ], [
      c('off-hook', 'button', 'Answer / call', 'phone-on', 'Answers an incoming call, or opens the phone screen to make one.', { keywords: ['answer call', 'green phone', 'pick up'] }),
      c('on-hook', 'button', 'End call', 'phone-off', 'Ends or declines a call.', { keywords: ['hang up', 'red phone', 'decline', 'reject'] }),
    ]],
  },
  {
    id: 'steering-right', zone: 'interior', name: 'Steering wheel display switches', where: 'Right spoke of the steering wheel (grades with the multi-information display)',
    anchor: 'steering_wheel', at: [0.3, 0.5, 0.75],
    aliases: ['display', 'trip', 'screen in cluster', 'multi information', 'mid', 'right side of steering wheel', 'disp'],
    rows: [[
      c('mid-up', 'button', 'Up', 'seek-up', 'Scrolls the multi-information display.', { keywords: ['display up'] }),
      c('mid-enter', 'round', 'Enter', 'display', 'Chooses the item shown, or changes between displays (trip, fuel economy, range, settings).', { how: 'Press to select; press and hold to reset the shown trip value.', keywords: ['disp', 'enter', 'ok', 'trip meter'] }),
      c('mid-down', 'button', 'Down', 'seek-down', 'Scrolls the multi-information display.', { keywords: ['display down'] }),
      c('mid-back', 'button', 'Back', 'turn-left', 'Returns to the previous screen of the display.', { keywords: ['back'] }),
    ]],
    note: 'On L and LE grades without the colour display, the trip and odometer are changed with the knob on the instrument cluster instead.',
  },
  {
    id: 'light-stalk', zone: 'interior', name: 'Headlight and turn-signal lever', where: 'Stalk on the left of the steering column',
    anchor: 'steering_wheel', at: [1.1, 0.55, -0.05],
    aliases: ['headlight', 'headlights', 'lights', 'indicator', 'turn signal', 'blinker', 'high beam', 'flash', 'left stalk', 'light switch', 'fog light', 'fog lights', 'auto lights', 'parking lights'],
    rows: [[
      c('light-switch', 'lever', 'Headlight switch (turn the end)', 'low-beam', 'Turns the lights on.', { marks: ['OFF', 'AUTO', 'parking-lamps', 'low-beam'], how: 'Twist the end: OFF; AUTO (grades that have it) switches the headlights and tail lights on and off with daylight; the parking-lamp symbol lights the front parking, tail, licence-plate and dash lights; the headlight symbol adds the low beams.', note: 'Every 2014–2016 Corolla has LED low beams.', keywords: ['auto', 'headlights on', 'dial on stalk'] }),
    ], [
      c('high-beam', 'button', 'High beam', 'high-beam', 'Switches the high beams on (push the lever away from you) or flashes them (pull it towards you).', { how: 'With the headlights on, push the lever forward for high beam; pull it back to return. Pull and release to flash the high beams at any time.', keywords: ['high beams', 'brights', 'full beam', 'flash'] }),
      c('turn', 'button', 'Turn signals', 'turn', 'Signals a turn or lane change.', { how: 'Move the lever up for right, down for left. Press it part-way and release for three flashes when changing lanes.', keywords: ['indicators', 'blinkers', 'signal'] }),
      c('fog', 'round', 'Front fog lights', 'front-fog', 'Turns the front fog lights on and off.', { how: 'Turn the ring on the lever to the fog-light symbol while the headlights or parking lights are on.', trim: 'Grades with fog lights (S and some LE).', keywords: ['fog ring', 'fog lamps'] }),
    ]],
  },
  {
    id: 'wiper-stalk', zone: 'interior', name: 'Wiper and washer lever', where: 'Stalk on the right of the steering column',
    anchor: 'steering_wheel', at: [1.1, 0.55, 1.05],
    aliases: ['wiper', 'wipers', 'washer', 'windshield', 'windscreen', 'right stalk', 'rain', 'spray'],
    rows: [[
      c('wiper-lever', 'lever', 'Wiper lever (move up or down)', 'wiper', 'Sets the windshield wipers.', { marks: ['MIST', 'OFF', 'INT', 'LO', 'HI'], how: 'Push up once for a single wipe (MIST); move down for intermittent (INT), low (LO) and high (HI) speed. In INT, turn the ring to change how often it wipes.', keywords: ['wiper speed', 'intermittent', 'mist'] }),
    ], [
      c('wiper-ring', 'round', 'Intermittent frequency ring', 'wiper', 'Changes how often the wipers wipe in INT.', { keywords: ['wiper delay', 'ring'] }),
      c('washer', 'button', 'Washer (pull)', 'washer', 'Sprays washer fluid on the windshield and wipes it.', { how: 'Pull the lever towards you; the wipers run a few times after you let go.', keywords: ['washer fluid', 'spray'] }),
    ]],
  },
  {
    id: 'cruise-stalk', zone: 'interior', name: 'Cruise control lever', where: 'Small lever behind the lower right of the steering wheel',
    anchor: 'steering_wheel', at: [1.2, 0.3, 0.95],
    aliases: ['cruise', 'cruise control', 'speed control', 'small lever', 'set speed', 'resume'],
    rows: [[
      c('cruise-onoff', 'round', 'ON·OFF button (end of the lever)', 'on-off', 'Switches cruise control on (the cruise indicator lights) and off.', { keywords: ['cruise on', 'cruise off'] }),
      c('cruise-set', 'button', 'SET / − (push down)', 'cruise-set', 'Holds your current speed; push and hold to slow the set speed.', { how: 'Get to the speed you want, push the lever down and let go.', keywords: ['set speed', 'decrease'] }),
      c('cruise-res', 'button', 'RES / + (push up)', 'cruise-res', 'Returns to the set speed after cancelling; push and hold to raise the set speed.', { keywords: ['resume', 'increase'] }),
      c('cruise-cancel', 'button', 'CANCEL (pull towards you)', 'cancel', 'Cancels cruise without forgetting the set speed. Braking cancels it too.', { keywords: ['cancel cruise'] }),
    ]],
  },
  {
    id: 'cluster', zone: 'interior', name: 'Instrument cluster warning and indicator lights', where: 'In the instrument cluster behind the steering wheel',
    anchor: 'steering_wheel', at: [2.2, 1.0, 0.5],
    aliases: ['dash light', 'dashboard light', 'warning light', 'warning lights', 'light on dash', 'symbol', 'icon', 'indicator', 'gauge', 'check engine', 'exclamation', 'triangle', 'battery light', 'oil light', 'odometer', 'trip'],
    rows: [[
      c('lamp-brake', 'lamp', 'Brake system', 'brake', 'Red: the parking brake is on, or the brake fluid is low / the brake system has a fault.', { color: 'red', how: 'Release the parking brake. If it stays on, stop safely and have the brakes checked — do not keep driving.', keywords: ['brake light', 'exclamation in circle'] }),
      c('lamp-charging', 'lamp', 'Charging system', 'battery', 'Red: the battery is not being charged (alternator or belt problem).', { color: 'red', how: 'Turn off the A/C and audio, drive to a safe place and have it checked; the car will stop when the battery runs down.', keywords: ['battery light'] }),
      c('lamp-oil', 'lamp', 'Low oil pressure', 'oil-pressure', 'Red: engine oil pressure is too low.', { color: 'red', how: 'Stop as soon as it is safe and switch the engine off; check the oil level. Driving on can destroy the engine.', keywords: ['oil can', 'oil light', 'genie lamp'] }),
      c('lamp-master', 'lamp', 'Master warning', 'master-warning', 'Red or amber: a message is shown on the multi-information display, or a buzzer sounds.', { color: 'amber', how: 'Read the message in the display and follow it.', keywords: ['triangle with exclamation', 'master warning'] }),
      c('lamp-mil', 'lamp', 'Check engine', 'check-engine', 'Amber: the engine or emissions control system has a fault.', { color: 'amber', how: 'Check the fuel cap is tight; if the light stays on, have the car checked soon. If it flashes, the engine is misfiring — slow down and get it checked promptly.', keywords: ['check engine', 'engine light', 'malfunction indicator'] }),
      c('lamp-srs', 'lamp', 'SRS airbag', 'srs', 'Red: a fault in the airbags or seat-belt pretensioners.', { color: 'red', how: 'Have it checked straight away: the airbags may not work in a crash.', keywords: ['airbag light', 'person with circle'] }),
    ], [
      c('lamp-abs', 'lamp', 'ABS', 'abs', 'Amber: the anti-lock brakes have a fault (normal brakes still work).', { color: 'amber', keywords: ['abs light'] }),
      c('lamp-slip', 'lamp', 'Slip indicator', 'vsc-slip', 'Flashes while VSC or TRAC is working to stop a skid; stays on for a fault.', { color: 'amber', how: 'If it flashes, the road is slippery: ease off. If it stays on, have the system checked.', keywords: ['car with squiggly lines', 'skid light', 'traction light'] }),
      c('lamp-vsc-off', 'lamp', 'VSC OFF', 'vsc-off', 'Amber: VSC (and TRAC) has been switched off with the VSC OFF switch.', { color: 'amber', keywords: ['vsc off light', 'trac off'] }),
      c('lamp-tpms', 'lamp', 'Low tire pressure', 'tpms', 'Amber: one or more tires are low. Flashing for about a minute then staying on means a system fault.', { color: 'amber', how: 'Check and inflate the tires to the pressure on the driver’s door-pillar label.', keywords: ['tire pressure light', 'horseshoe with exclamation', 'exclamation in a horseshoe', 'horseshoe', 'tyre'] }),
      c('lamp-eps', 'lamp', 'Electric power steering', 'eps', 'Red or amber: a fault in the power steering; steering may be heavy.', { color: 'amber', keywords: ['steering wheel light', 'eps'] }),
      c('lamp-fuel', 'lamp', 'Low fuel', 'low-fuel', 'Amber: the fuel is running low.', { color: 'amber', how: 'Refuel soon with regular unleaded (87 octane in the US).', keywords: ['fuel light', 'gas light'] }),
    ], [
      c('lamp-belt', 'lamp', 'Seat belt reminder', 'seatbelt', 'Red: the driver or front passenger is not wearing a seat belt.', { color: 'red', keywords: ['seatbelt light'] }),
      c('lamp-door', 'lamp', 'Door open', 'door-open', 'A door or the trunk is not fully closed.', { color: 'red', keywords: ['door ajar', 'open door'] }),
      c('lamp-security', 'lamp', 'Security', 'security', 'Flashes when the engine immobiliser is set (normal when parked).', { color: 'amber', keywords: ['car with padlock', 'immobilizer', 'blinking light when parked'] }),
      c('lamp-cruise', 'lamp', 'Cruise control', 'cruise-lamp', 'Green: cruise control is switched on.', { color: 'green', keywords: ['cruise light'] }),
      c('lamp-eco', 'lamp', 'Eco driving indicator', 'eco-drive', 'Green: you are driving economically.', { color: 'green', keywords: ['eco light', 'leaf'] }),
      c('lamp-high', 'lamp', 'High beam', 'high-beam', 'Blue: the high beams are on.', { color: 'blue', keywords: ['blue light', 'high beam indicator'] }),
    ], [
      c('lamp-turn', 'lamp', 'Turn signals', 'turn', 'Green arrows: the turn signals or hazard lights are on.', { color: 'green', keywords: ['arrows'] }),
      c('lamp-tail', 'lamp', 'Headlight / tail light', 'parking-lamps', 'Green: the tail lights (and headlights) are on.', { color: 'green', keywords: ['lights on indicator'] }),
      c('lamp-fog', 'lamp', 'Front fog lights', 'front-fog', 'Green: the front fog lights are on.', { color: 'green', keywords: ['fog indicator'] }),
      c('lamp-sport', 'lamp', 'SPORT mode', 'sport_lamp', 'SPORT mode is on (S grades).', { color: 'green', keywords: ['sport light'] }),
      c('odo-knob', 'round', 'ODO/TRIP and brightness knob', 'trip-reset', 'Changes between the odometer and trip meters, resets a trip, and dims the instrument lights.', { how: 'Press to switch ODO → TRIP A → TRIP B; press and hold to reset the trip shown. On some grades it also sets the instrument brightness.', keywords: ['odometer button', 'trip reset', 'stick in the dash', 'dimmer'] }),
    ]],
  },
  {
    id: 'center-stack', zone: 'interior', name: 'Hazard switch and audio', where: 'Centre of the dashboard',
    anchor: 'center_stack', at: [0.5, 0.75, 0.5],
    aliases: ['hazard', 'hazards', 'triangle button', 'button with a triangle', 'red triangle', 'emergency lights', 'radio', 'stereo', 'screen', 'touchscreen', 'entune', 'audio', 'cd'],
    rows: [[
      c('hazard', 'button', 'Hazard lights', 'hazard', 'Flashes all the turn signals to warn other drivers.', { how: 'Press to switch on; press again to switch off. Use it when stopped in an emergency.', keywords: ['hazard lights', 'red triangle', 'emergency flashers'] }),
    ], [
      c('audio-power', 'knob', 'POWER / VOLUME', 'power', 'Turns the audio on and off and sets the volume.', { marks: [], how: 'Press to turn on or off; turn to change the volume.', keywords: ['radio on', 'volume knob'] }),
      c('audio-screen', 'screen', 'Entune audio touchscreen', 'display', 'Shows the radio, media, Bluetooth phone, backup camera and settings.', { how: 'Touch the screen; press the buttons beside it for HOME/AUDIO, APPS, SETUP and seek.', trim: '6.1-inch display on most grades; navigation on higher grades.', keywords: ['screen', 'backup camera display'] }),
      c('audio-tune', 'knob', 'TUNE / SCROLL', 'seek-up', 'Tunes the radio or scrolls lists.', { marks: [], keywords: ['tune knob'] }),
    ]],
  },
  {
    id: 'climate', zone: 'interior', name: 'Climate controls', where: 'Below the audio, centre of the dashboard',
    anchor: 'climate_controls', at: [0.85, 0.7, 0.45],
    aliases: ['ac', 'a/c', 'air conditioning', 'heater', 'heat', 'fan', 'defrost', 'defog', 'demist', 'recirculation', 'climate', 'temperature', 'air', 'car with arrow'],
    rows: [[
      c('fan-dial', 'dial', 'Fan speed', 'fan', 'Sets the fan speed (OFF to highest).', { marks: ['OFF', '1', '2', '3', '4'], keywords: ['fan speed', 'blower'] }),
      c('temp-dial', 'dial', 'Temperature', 'temp', 'Sets how warm the air is: blue for cold, red for hot.', { marks: ['❄', '', '', '', '☀'], keywords: ['temperature', 'hot cold'] }),
      c('mode-dial', 'dial', 'Air outlets', 'mode-face', 'Chooses where the air comes out: face, face and feet, feet, feet and windshield, windshield.', { marks: ['face', 'bi', 'feet', 'feet+ws', 'ws'], keywords: ['vents', 'air direction'] }),
    ], [
      c('ac', 'button', 'A/C', 'ac', 'Turns the air-conditioning compressor on to cool and dry the air.', { how: 'Press to switch on (the indicator lights); use it with the windshield setting to clear fog fast.', keywords: ['air conditioning', 'a c'] }),
      c('recirc', 'button', 'Recirculate / outside air', 'recirc', 'Switches between recirculating cabin air and drawing in fresh outside air.', { how: 'Use recirculate for dusty or smelly air and fastest cooling; fresh air otherwise, so the windows do not fog.', keywords: ['car with arrow', 'car with an arrow', 'arrow inside a car', 'recirculation', 'u turn arrow'] }),
      c('rear-defog', 'button', 'Rear window defogger', 'rear-defog', 'Heats the lines in the rear window to clear fog and frost (and heats the mirrors on grades that have it).', { how: 'Press on; it switches itself off after about 15 minutes.', keywords: ['rear defrost', 'back window lines'] }),
      c('front-defog', 'button', 'Windshield defogger', 'front-defog', 'Sends air to the windshield to clear it (automatic climate grades have a separate button).', { keywords: ['front defrost', 'windshield'] }),
    ], [
      c('usb', 'port', 'USB port', 'usb', 'Plays music from and charges a phone or USB drive.', { keywords: ['usb', 'charge phone'] }),
      c('aux', 'port', 'AUX input', 'aux', 'Plays audio from a device with a 3.5 mm cable.', { keywords: ['aux', 'headphone jack'] }),
      c('outlet', 'port', 'Power outlet (12 V)', 'outlet', 'Powers accessories up to 12 V / 10 A (120 W) with the ignition on.', { keywords: ['cigarette lighter', '12v socket'] }),
    ]],
    note: 'Premium grades have automatic climate control: AUTO, temperature up/down buttons and an OFF button in place of the three dials.',
  },
  {
    id: 'console', zone: 'interior', name: 'Gear selector and centre console', where: 'Between the front seats',
    anchor: 'gear_selector', at: [0.5, 0.5, 0.5],
    aliases: ['gear', 'gearshift', 'gear shift', 'shifter', 'gear stick', 'transmission', 'park', 'sport', 'eco', 'eco mode', 'parking brake', 'handbrake', 'hand brake', 'emergency brake', 'cup holder', 'console', 'paddle'],
    rows: [[
      c('shift', 'handle', 'Gear selector (CVT)', 'gear', 'Chooses the gear: P park, R reverse, N neutral, D drive, B engine braking (S grades: S with + / − manual steps).', { marks: ['P', 'R', 'N', 'D', 'B'], how: 'Press the brake and the button on the knob to move out of P. Use B on long downhills to slow the car with the engine.', keywords: ['p r n d b', 'b on the gear', 'b mode', 'what is b', 'drive', 'reverse'] }),
      c('shift-lock', 'round', 'Shift lock release', 'shift-lock', 'Lets you move the lever out of P if the battery is flat or the brake-switch fails.', { how: 'Switch the ignition off, apply the parking brake, prise off the small cover next to the lever and press the button inside while pressing the shift-knob button.', keywords: ['stuck in park', 'shift lock'] }),
      c('eco-sport', 'button', 'ECO MODE / SPORT', 'eco', 'ECO MODE (LE Eco) softens throttle response and the climate for economy; SPORT (S) sharpens throttle and the CVT.', { how: 'Press to switch on or off; an indicator shows in the cluster.', keywords: ['eco button', 'sport button'] }),
      c('handbrake', 'handle', 'Parking brake', 'parking-brake', 'Holds the car when parked.', { marks: ['pull'], how: 'Pull up firmly to apply; to release, pull up slightly, press the button on the end and lower it fully.', keywords: ['handbrake', 'emergency brake'] }),
    ], [
      c('cups', 'tile', 'Cup holders', 'cup', 'Two cup holders ahead of the parking brake.', { keywords: ['cup holder'] }),
      c('armrest', 'tile', 'Console box', 'storage', 'Storage under the armrest lid.', { keywords: ['storage', 'armrest'] }),
    ]],
    note: 'Manual-gearbox cars have a 6-speed lever (reverse: lift the ring under the knob).',
  },
  {
    id: 'overhead', zone: 'interior', name: 'Overhead lights and moonroof switches', where: 'On the headliner above the rear-view mirror',
    anchor: 'dome_lamp', at: [0.5, 0.0, 0.5],
    aliases: ['roof', 'ceiling', 'overhead', 'dome light', 'interior light', 'map light', 'reading light', 'sunroof', 'moonroof', 'above mirror'],
    rows: [[
      c('map-left', 'button', 'Personal light', 'map-light', 'Reading light for the driver.', { how: 'Press to switch on or off.', keywords: ['map light', 'reading light'] }),
      c('interior-switch', 'rocker', 'Interior light switch', 'dome-light', 'Sets the dome light.', { sym2: 'door-open', how: 'ON: always on. DOOR: on while a door is open (and for a while after). OFF: stays off.', keywords: ['door position', 'dome', 'light stays on'] }),
      c('map-right', 'button', 'Personal light', 'map-light', 'Reading light for the passenger.', { keywords: ['map light'] }),
    ], [
      c('moonroof-slide', 'rocker', 'Moonroof open / close', 'sunroof', 'Slides the moonroof open and closed.', { sym2: 'sunroof', how: 'Press to the rear to open (one-touch), forward to close.', trim: 'Grades with a moonroof.', keywords: ['sunroof', 'open roof'] }),
      c('moonroof-tilt', 'rocker', 'Moonroof tilt', 'sunroof-tilt', 'Tilts the rear of the moonroof up for ventilation.', { sym2: 'sunroof-tilt', trim: 'Grades with a moonroof.', keywords: ['tilt sunroof', 'vent'] }),
    ]],
  },
  {
    id: 'releases', zone: 'interior', name: 'Fuel door, trunk and hood releases', where: 'Two levers on the floor beside the driver’s seat; the hood release is under the dash on the left',
    anchor: 'seat_cushion_front_left', at: [0.85, 0.0, 0.0],
    aliases: ['fuel door', 'gas door', 'gas cap', 'fuel flap', 'trunk', 'boot', 'hood', 'bonnet', 'release', 'lever on floor', 'lever by seat', 'lever under dash', 'open trunk', 'open hood'],
    rows: [[
      c('fuel-release', 'handle', 'Fuel door opener', 'fuel-door', 'Opens the fuel filler door on the driver’s side of the car.', { marks: ['lift'], how: 'Pull the lever beside the driver’s seat (fuel-pump symbol) upwards.', keywords: ['gas door', 'fuel flap'] }),
      c('trunk-release', 'handle', 'Trunk opener', 'trunk', 'Opens the trunk.', { marks: ['lift'], how: 'Pull the lever with the open-trunk symbol upwards.', note: 'Also opens with the key remote, or the button on the trunk lid on smart-key grades.', keywords: ['boot release', 'trunk lever'] }),
      c('hood-release', 'handle', 'Hood release', 'hood', 'Unlatches the hood.', { marks: ['pull'], how: 'Pull the lever under the left of the dashboard, then at the front push the secondary catch under the hood edge sideways and lift the hood; hold it with the prop rod.', keywords: ['bonnet release', 'hood lever', 'open hood'] }),
    ]],
  },
  {
    id: 'key', zone: 'exterior', name: 'Key and remote', where: 'The key fob (and the door handles on smart-key grades)',
    anchor: 'door_front_left_handle', at: [0.5, 0.5, 0.0],
    aliases: ['key', 'fob', 'remote', 'key fob', 'keyless', 'smart key', 'panic', 'alarm', 'door handle', 'push start', 'start button'],
    rows: [[
      c('fob-lock', 'button', 'Lock', 'lock', 'Locks all the doors and the trunk.', { how: 'The turn signals flash once to confirm.', keywords: ['lock car'] }),
      c('fob-unlock', 'button', 'Unlock', 'unlock', 'Unlocks the doors.', { how: 'Press once for the driver’s door; press again within 3 seconds for all doors (default setting).', keywords: ['unlock car'] }),
      c('fob-trunk', 'button', 'Trunk', 'trunk', 'Opens the trunk.', { how: 'Press and hold.', keywords: ['open trunk from key'] }),
      c('fob-panic', 'button', 'Panic', 'panic', 'Sounds the horn and flashes the lights to scare off a thief or find the car.', { how: 'Press and hold for about a second; press any button to stop.', keywords: ['panic button', 'alarm'] }),
    ], [
      c('handle-sensor', 'tile', 'Door-handle sensors (smart key)', 'smart-key', 'With the smart key on you, grip the front handle to unlock; touch the lock sensor on the handle to lock.', { trim: 'Smart-key grades (Premium packages).', keywords: ['touch handle', 'keyless entry'] }),
      c('push-start', 'round', 'ENGINE START STOP', 'push-start', 'Starts the engine on smart-key cars.', { how: 'Press the brake pedal and the button. Without the brake, each press cycles ACCESSORY → ON → OFF. To stop in an emergency while moving, press and hold for over 2 seconds or press 3 times quickly.', trim: 'Smart-key grades.', keywords: ['start button', 'push button start'] }),
      c('key-blade', 'tile', 'Mechanical key', 'key', 'A key blade hidden in the fob opens the driver’s door if the remote battery is flat.', { keywords: ['flat key battery', 'emergency key'] }),
    ]],
  },
  {
    id: 'front-exterior', zone: 'exterior', name: 'Front of the car', where: 'Headlights, bumper and hood',
    anchor: 'headlamp_left', at: [0.6, 0.5, 0.2],
    aliases: ['headlight', 'headlamp', 'front', 'grille', 'bumper', 'tow hook', 'cover on bumper', 'small cover', 'flap on bumper', 'daytime running', 'drl', 'fog lamp outside'],
    rows: [[
      c('led-low', 'lamp', 'LED low beams', 'low-beam', 'The main headlights: standard LED low beams on every 2014–2016 Corolla.', { color: 'white', keywords: ['headlight bulb', 'led'] }),
      c('high-beam-lamp', 'lamp', 'High beam', 'high-beam', 'Halogen high-beam lamp in the headlight unit.', { color: 'white', keywords: ['high beam bulb'] }),
      c('front-turn', 'lamp', 'Front turn signal', 'turn-left', 'Amber turn-signal lamp in the headlight unit.', { color: 'amber', keywords: ['indicator bulb'] }),
      c('drl', 'lamp', 'Daytime running lights', 'parking-lamps', 'Light automatically with the engine on during the day (LED light bars on S and LE Plus / Premium).', { color: 'white', keywords: ['drl', 'daytime running lights'] }),
    ], [
      c('fog-lamps', 'lamp', 'Front fog lights', 'front-fog', 'Low, wide lights in the lower bumper for fog (grades with fog lights).', { color: 'white', keywords: ['fog lamps'] }),
      c('tow-cover', 'tile', 'Towing-eyelet cover', 'hook', 'A small cover in the front bumper hides the socket for the screw-in towing eyelet.', { how: 'Prise the cover off with a flat-blade screwdriver wrapped in cloth; the eyelet is with the jack in the trunk. Screw it in fully clockwise before towing.', keywords: ['tow hook', 'small cover on bumper', 'little flap on bumper', 'hole in bumper'] }),
    ]],
  },
  {
    id: 'rear-exterior', zone: 'exterior', name: 'Rear of the car', where: 'Tail lights, trunk lid and rear bumper',
    anchor: 'tail_lamp_left', at: [0.3, 0.6, 0.2],
    aliases: ['tail light', 'taillight', 'rear light', 'brake light', 'reverse light', 'back of car', 'trunk lid', 'camera', 'rear camera', 'license plate', 'number plate', 'rear fog'],
    rows: [[
      c('tail', 'lamp', 'Tail / stop lights (LED)', 'parking-lamps', 'Red LED tail lights, brighter when you brake.', { color: 'red', keywords: ['brake light', 'tail light'] }),
      c('rear-turn', 'lamp', 'Rear turn signal', 'turn-right', 'Amber turn-signal lamp in the tail-light unit.', { color: 'amber', keywords: ['rear indicator'] }),
      c('reverse', 'lamp', 'Back-up light', 'lamp-generic', 'White light when in reverse.', { color: 'white', keywords: ['reverse light', 'backup light'] }),
      c('rear-fog-lamp', 'lamp', 'Rear fog light (Europe)', 'rear-fog', 'Bright red light for thick fog, on the driver’s side.', { color: 'red', trim: 'European cars.', keywords: ['rear fog'] }),
    ], [
      c('backup-camera', 'tile', 'Backup camera', 'camera', 'Above the licence plate on the trunk lid; shows on the audio screen in reverse on grades with the display audio.', { keywords: ['rear camera', 'reversing camera'] }),
      c('plate-lights', 'tile', 'Licence-plate lights', 'plate', 'Light the rear plate whenever the tail lights are on.', { keywords: ['number plate light'] }),
      c('trunk-button', 'tile', 'Trunk opener button (smart key)', 'trunk', 'With the smart key on you, press the button under the trunk-lid garnish to open it.', { trim: 'Smart-key grades.', keywords: ['button on trunk', 'boot button'] }),
    ]],
  },
  {
    id: 'fuel-filler', zone: 'exterior', name: 'Fuel filler door and cap', where: 'Rear quarter panel on the driver’s side',
    anchor: 'fuel_filler_door', at: [0.5, 0.5, 0.0],
    aliases: ['fuel', 'gas', 'petrol', 'fuel door', 'gas cap', 'fuel cap', 'filler', 'which side is the gas tank', 'octane', 'tank size'],
    rows: [[
      c('filler-door', 'tile', 'Fuel filler door', 'fuel-door', 'Opened with the lever beside the driver’s seat; it is on the driver’s side (the arrow by the fuel gauge points to it).', { keywords: ['gas door side'] }),
      c('fuel-cap', 'round', 'Fuel cap', 'fuel-door', 'Turn anticlockwise to open; turn clockwise until it clicks to close. Hang it on the holder inside the door while filling.', { note: 'A loose cap can turn on the check-engine light.', keywords: ['gas cap', 'tighten cap'] }),
      c('fuel-spec', 'tile', 'Fuel', 'info', 'Regular unleaded, 87 octane (AKI) or higher in the US; tank about 13.2 US gal (50 L).', { keywords: ['octane', 'tank capacity', 'what fuel'] }),
    ]],
  },
  {
    id: 'door-pillar', zone: 'exterior', name: 'Driver’s door pillar labels', where: 'On the body pillar when the driver’s door is open',
    anchor: 'door_front_left_outer_panel', at: [0.0, 0.45, 0.0],
    aliases: ['sticker', 'label', 'placard', 'door jamb', 'door pillar', 'tire pressure', 'tyre pressure', 'recommended pressure', 'vin', 'build date'],
    rows: [[
      c('tire-placard', 'tile', 'Tire and loading information', 'tyre', 'The cold tire pressures, tire size and maximum load for your car.', { how: 'Set pressures cold; they are about 32 psi (220 kPa) front and rear on most grades — always follow the label on your car.', keywords: ['tire pressure', 'psi', 'placard'] }),
      c('cert-label', 'tile', 'Certification label', 'info', 'Shows the build month, weight ratings and the vehicle identification number (VIN).', { keywords: ['vin', 'build date'] }),
    ]],
  },
  {
    id: 'engine-bay', zone: 'exterior', name: 'Under the hood (2ZR-FE 1.8 L)', where: 'In the engine compartment',
    anchor: 'oil_filler_cap', at: [0.5, 0.5, 0.5],
    aliases: ['engine', 'under the hood', 'under the bonnet', 'cap', 'oil', 'dipstick', 'coolant', 'antifreeze', 'washer fluid', 'brake fluid', 'battery', 'fuse box', 'air filter', 'yellow', 'reservoir'],
    rows: [[
      c('oil-cap', 'round', 'Engine oil filler cap', 'oil-pressure', 'Where engine oil is added (0W-20 synthetic; about 4.4 US qt with filter).', { how: 'Check the level on the dipstick first; add a little at a time.', keywords: ['oil cap', 'add oil'] }),
      c('dipstick', 'handle', 'Oil dipstick', 'dipstick', 'Shows the oil level between the two marks.', { marks: ['pull'], how: 'With the engine off for a few minutes on level ground, pull it out, wipe it, push it fully back in and pull it again; the oil should be between the low and full marks.', keywords: ['dipstick', 'yellow ring', 'check oil'] }),
      c('coolant-cap', 'round', 'Coolant reservoir', 'coolant', 'Shows the coolant level between FULL and LOW (Toyota Super Long Life Coolant, pink).', { how: 'Check when cold. Never open the radiator cap when the engine is hot.', keywords: ['antifreeze', 'coolant'] }),
    ], [
      c('washer-cap', 'round', 'Washer fluid', 'washer-fluid', 'Fill with windshield washer fluid (not plain water in winter).', { keywords: ['washer fluid cap', 'blue cap'] }),
      c('brake-fluid-cap', 'round', 'Brake fluid reservoir', 'brake-fluid', 'Level between MAX and MIN (DOT 3 / SAE J1703). A falling level can mean worn pads or a leak.', { keywords: ['brake fluid'] }),
      c('fusebox', 'tile', 'Fuse and relay box', 'fuse', 'Fuses for the engine-bay circuits; the cover shows which is which.', { keywords: ['fuses', 'relay'] }),
      c('battery-12v', 'tile', '12 V battery', 'battery', 'Starts the car and runs the electrics. Jump-start from its terminals.', { keywords: ['battery', 'jump start'] }),
    ]],
  },
];

export const CLUSTER = Object.fromEntries(CLUSTERS.map(x => [x.id, x]));
export const allControls = (cl) => cl.rows.flat();

/* ---------------- search ---------------- */

const STOP = new Set('the a an of my on in at to for is it what whats what\'s this that there these those do does and or with car toyota corolla button buttons switch switches thing one mean means used use why how can i me some little small near next'.split(' '));
const words = (s) => (String(s || '').toLowerCase().replace(/[’']/g, '').match(/[a-z0-9/]+/g) || []);

/**
 * What the person most likely means. Returns { cluster, control, confidence,
 * alternatives: [cluster ids] } — `control` only when one control clearly stands out.
 */
export function findControls(query) {
  const q = String(query || '').toLowerCase();
  const qw = words(q).filter(w => !STOP.has(w));
  if (!qw.length) return null;
  const has = (a) => new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z0-9]|$)`).test(q);
  const phraseHit = (list) => list.reduce((s, a) => s + (a.length > 1 && has(a) ? (a.includes(' ') ? 4 : 2.5) : 0), 0);
  // Intent: "light / symbol on the dash" means a lamp; "button / switch" means something you press;
  // "lever / stalk on the left / right" means that stalk.
  const wantsLamp = /\b(light|lamp|symbol|icon|indicator|warning)s?\b/.test(q) && /\b(dash|dashboard|cluster|came on|comes on|lit|on the dash|flashing|blinking|symbol|icon|warning|orange|amber|yellow|red|green|blue|looks like|shaped like|shape of)\b/.test(q);
  const wantsPress = /\b(button|switch|press|knob)\b/.test(q);
  const wantsLever = /\b(lever|stalk)\b/.test(q);
  const side = /\bright\b/.test(q) ? 'right' : /\bleft\b/.test(q) ? 'left' : null;
  const intent = (cl) => {
    let b = 0;
    if (wantsLamp) b += cl.id === 'cluster' ? 4 : 0;
    if (wantsPress && cl.id === 'cluster' && !wantsLamp) b -= 2;
    if (wantsLever && /lever/i.test(cl.name)) b += 2 + (side && ((side === 'right' && cl.id === 'wiper-stalk') || (side === 'left' && cl.id === 'light-stalk')) ? 3 : 0);
    return b;
  };
  const wordHit = (text) => { const t = new Set(words(text)); return qw.reduce((s, w) => s + (t.has(w) ? 1 : 0), 0); };
  const scored = CLUSTERS.map(cl => {
    let score = phraseHit(cl.aliases) + wordHit(`${cl.name} ${cl.where}`) * 1.2 + intent(cl);
    let best = null;
    for (const ctl of allControls(cl)) {
      const s = phraseHit(ctl.keywords || []) * 1.3 + wordHit(`${ctl.label} ${ctl.what}`) * 0.6 + wordHit((ctl.keywords || []).join(' ')) * 0.8;
      if (!best || s > best.s) best = { ctl, s };
    }
    return { cl, score: score + (best ? best.s * 0.7 : 0), best };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 0.5) return null;
  const second = scored[1];
  const ctlScores = allControls(top.cl).map(ctl => phraseHit(ctl.keywords || []) * 1.3 + wordHit(`${ctl.label} ${ctl.what}`) * 0.6 + wordHit((ctl.keywords || []).join(' ')) * 0.8).sort((a, b) => b - a);
  const standout = top.best && top.best.s >= 1.5 && top.best.s >= (ctlScores[1] || 0) * 1.5;
  return {
    cluster: top.cl,
    control: standout ? top.best.ctl : null,
    confidence: second ? top.score / (top.score + second.score) : 1,
    alternatives: scored.slice(1, 4).filter(x => x.score > 0.5).map(x => x.cl.id),
  };
}
