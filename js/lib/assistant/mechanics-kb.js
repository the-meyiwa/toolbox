/* ============================================================
   Automotive fault-finding knowledge for the Assistant.

   Each fault is a small diagnostic tree: the symptom, the likely
   causes in the order a mechanic would check them (cheapest and
   most common first), the check that confirms each one, and the
   usual fix. diagnoseVehicle() matches a plain-English complaint
   ("my wipers don't work") against these and returns the tree.
   ============================================================ */

const C = (cause, likelihood, check, fix, diy = 'easy') => ({ cause, likelihood, check, fix, diy });

export const VEHICLE_FAULTS = [
  {
    id: 'wipers-dead', system: 'Electrical: wipers',
    symptom: 'Windscreen wipers do not move at all',
    match: /\bwipers?\b.*\b(not|n't|dead|won'?t|stopp|no)\b|\b(not|n't|won'?t|stopp).*\bwipers?\b|\bwipers?\b.*\bwork/i,
    first: 'Turn the ignition on and switch the wipers on while listening at the base of the windscreen for the motor hum or a click from the relay.',
    causes: [
      C('Blown wiper fuse', 'very common', 'Find the wiper fuse in the cabin or engine-bay fuse box (the lid legend names it) and look for a broken link, or test both sides with a test light.', 'Replace it with a fuse of the same rating. If it blows again, look for a jammed linkage or a short in the motor.'),
      C('Seized or disconnected wiper linkage', 'common', 'Motor hums but arms do not move, or the arms flop freely. Remove the scuttle panel and look for a ball joint that has popped off.', 'Clip the joint back on or replace the linkage; free up seized pivots with penetrating oil.', 'moderate'),
      C('Loose wiper arm nut', 'common', 'The spindle turns but the arm stays still. Hold the arm and switch on.', 'Tighten the arm nut onto the spline; replace the arm if the splines are stripped.'),
      C('Faulty wiper relay or multifunction module', 'common', 'No click from the relay. Swap the relay with an identical one from another circuit (such as the horn).', 'Replace the relay. On newer cars the body control module drives the wipers; scan it for codes.'),
      C('Failed wiper motor', 'moderate', 'Put 12 V directly on the motor connector (low-speed pin and earth). No movement means the motor is dead.', 'Replace the motor, or fit a good used one. Check the park switch too.', 'moderate'),
      C('Faulty stalk switch', 'moderate', 'With a multimeter, check for 12 V at the motor connector with the stalk on each speed. No voltage with a good fuse points at the switch or wiring.', 'Replace the combination switch.', 'moderate'),
      C('Broken wire or corroded earth', 'less common', 'Check the earth strap near the motor and the loom where it passes through the bulkhead for chafing.', 'Clean and tighten the earth; repair the broken wire with solder and heat shrink.', 'moderate'),
    ],
    safety: 'Driving in rain without wipers is illegal and dangerous. Keep hands clear of the linkage when testing, because the arms can move suddenly.',
  },
  {
    id: 'wipers-partial', system: 'Electrical: wipers',
    symptom: 'Wipers work on one speed only, will not park, or will not stop',
    match: /\bwipers?\b.*\b(one speed|only (fast|slow|high|low)|won'?t (park|stop|turn off)|keep (going|running)|intermittent|slow)\b/i,
    first: 'Note which speeds work. One speed missing points at the switch or motor brushes; not parking points at the park switch or relay.',
    causes: [
      C('Worn motor brushes (high or low speed brush)', 'common', 'Apply 12 V to each speed pin on the motor directly.', 'Replace the motor or its brush plate.', 'moderate'),
      C('Faulty stalk switch contact', 'common', 'Measure voltage at the motor for each switch position.', 'Replace the combination switch.', 'moderate'),
      C('Stuck intermittent relay or failed park switch', 'common', 'Wipers will not stop when switched off, or stop mid-screen.', 'Replace the relay; if they still will not park, the park switch inside the motor gearbox is at fault.', 'moderate'),
      C('Rain sensor fault (cars with automatic wipers)', 'moderate', 'Turn off auto mode and see if manual speeds behave.', 'Clean the windscreen over the sensor, then recalibrate or replace the sensor.'),
    ],
    safety: 'If the wipers will not stop, pull the fuse until it is fixed so the motor does not burn out.',
  },
  {
    id: 'washer', system: 'Electrical: washers',
    symptom: 'Screen washer does not spray',
    match: /\b(washer|squirt|spray|washer fluid|windscreen fluid)\b/i,
    first: 'Operate the washer and listen for the pump whirring near the reservoir.',
    causes: [
      C('Empty or frozen reservoir', 'very common', 'Look at the reservoir level.', 'Fill it with screen wash.'),
      C('Blocked jets', 'common', 'Pump runs but nothing comes out of one or both jets.', 'Clear the jet with a pin and blow the line through.'),
      C('Split or disconnected hose', 'common', 'Fluid pools under the car or under the bonnet.', 'Reconnect or replace the hose and joiners.'),
      C('Failed pump or fuse', 'moderate', 'No whirr. Check the fuse, then 12 V at the pump connector.', 'Replace the pump.'),
    ],
  },
  {
    id: 'no-crank', system: 'Starting and charging',
    symptom: 'Engine will not crank (click or nothing when turning the key)',
    match: /\b(won'?t|will not|doesn'?t|does not|not)\s+(start|crank|turn over)\b|\bclick(ing)? when\b|\bdead battery\b|\bno crank\b/i,
    first: 'Turn on the headlights and try to start. Lights dimming hard means the battery or connections; lights staying bright with a click points at the starter.',
    causes: [
      C('Flat or failing battery', 'very common', 'A healthy battery reads 12.6 V at rest and stays above 9.6 V while cranking.', 'Jump start or charge it; replace it if it will not hold charge (most last 3 to 5 years).'),
      C('Corroded or loose battery terminals', 'very common', 'White or green deposits, or a terminal you can twist by hand.', 'Clean with baking soda and water, then tighten and grease the terminals.'),
      C('Failed starter motor or solenoid', 'common', 'A single loud click with bright lights. Check for 12 V at the solenoid trigger wire while cranking.', 'Replace the starter.', 'moderate'),
      C('Immobiliser or key not recognised', 'common', 'Security light flashing on the dash.', 'Try the spare key; replace the key battery; have the key reprogrammed.'),
      C('Neutral safety or clutch switch', 'moderate', 'Automatic: try starting in N instead of P. Manual: press the clutch fully.', 'Adjust or replace the switch.', 'moderate'),
      C('Bad earth strap between engine and body', 'less common', 'Voltage drop test across the earth strap while cranking (should be under 0.5 V).', 'Clean or replace the strap.'),
    ],
  },
  {
    id: 'crank-no-start', system: 'Fuel, ignition and air',
    symptom: 'Engine cranks but will not fire',
    match: /\b(cranks?|turns over)\b.*\b(won'?t|not|doesn'?t|no)\b.*\b(start|fire|catch)\b/i,
    first: 'Turn the ignition on and listen for the fuel pump priming for two seconds. Check for a check-engine light and read the codes.',
    causes: [
      C('Out of fuel or faulty fuel gauge', 'common', 'Add a few litres and try again.', 'Refuel; test the gauge sender if it reads wrong.'),
      C('Fuel pump, relay or fuse', 'common', 'No priming sound. Check the pump fuse and relay, then fuel pressure at the rail.', 'Replace the relay or pump.', 'moderate'),
      C('No spark (crank sensor, coil pack, ignition module)', 'common', 'Scan for codes; a failed crankshaft position sensor stops both spark and injection.', 'Replace the failed sensor or coil.', 'moderate'),
      C('Flooded engine', 'moderate', 'Strong fuel smell after repeated attempts.', 'Hold the accelerator flat while cranking for a few seconds (clear-flood mode) on fuel-injected cars.'),
      C('Timing belt or chain failure', 'less common', 'Cranking sounds unusually fast and even; the camshaft does not turn when the oil cap is removed.', 'Stop cranking. Replace the belt and check the valves.', 'workshop'),
    ],
  },
  {
    id: 'overheating', system: 'Cooling',
    symptom: 'Engine overheating or temperature gauge high',
    match: /\b(overheat\w*|temperature (gauge )?(high|rising|red)|running hot|coolant|boil(ing)? over|steam from)\b/i,
    first: 'Stop and switch off. Never open the radiator cap while hot. When cool, check the coolant level in the expansion tank.',
    causes: [
      C('Low coolant from a leak', 'very common', 'Look for drips, crusty residue on hoses, radiator or water pump.', 'Fix the leak and refill with the correct coolant mix.'),
      C('Radiator fan not working', 'common', 'Let it idle to temperature: the fan should cut in. Check the fan fuse, relay and temperature switch.', 'Replace the failed part.', 'moderate'),
      C('Stuck thermostat', 'common', 'Top hose stays cool while the engine is hot.', 'Replace the thermostat and gasket.', 'moderate'),
      C('Failed water pump', 'moderate', 'Weeping from the weep hole, or play in the pump pulley.', 'Replace the pump (often with the timing belt).', 'workshop'),
      C('Blocked radiator', 'moderate', 'Cold spots on the radiator core; debris in the fins.', 'Flush or replace the radiator.', 'moderate'),
      C('Head gasket failure', 'less common', 'Bubbles in the expansion tank, white exhaust smoke, milky oil, coolant loss with no visible leak.', 'Combustion leak (block) test, then head gasket replacement.', 'workshop'),
    ],
    safety: 'Keep driving an overheating engine and it can warp the cylinder head. Stop as soon as the gauge climbs.',
  },
  {
    id: 'brakes-noise', system: 'Brakes',
    symptom: 'Brakes squeal, grind or feel soft, or the car pulls when braking',
    match: /\bbrak\w*\b/i,
    first: 'Check the brake fluid level and look at pad thickness through the wheel spokes.',
    causes: [
      C('Worn brake pads (wear indicator squeal)', 'very common', 'Pad friction material under 3 mm.', 'Replace pads on both sides of the axle.', 'moderate'),
      C('Metal-on-metal from pads worn through', 'common', 'Grinding noise; scored discs.', 'Replace pads and discs now.', 'moderate'),
      C('Air or moisture in the fluid (soft pedal)', 'common', 'Pedal sinks or feels spongy; fluid older than 2 years.', 'Bleed the system with fresh DOT fluid.', 'moderate'),
      C('Fluid leak', 'moderate', 'Wet patches at calipers, hoses or master cylinder; fluid level dropping.', 'Replace the leaking part and bleed. Do not drive.', 'workshop'),
      C('Sticking caliper (pulls to one side, hot wheel)', 'moderate', 'One wheel much hotter after a drive.', 'Service or replace the caliper and slide pins.', 'moderate'),
      C('Warped discs (vibration through the pedal)', 'moderate', 'Pedal pulses when braking from speed.', 'Skim or replace the discs.', 'moderate'),
    ],
    safety: 'Soft pedal, fluid loss or grinding: do not drive until fixed.',
  },
  {
    id: 'battery-drain', system: 'Starting and charging',
    symptom: 'Battery keeps going flat or battery warning light is on',
    match: /\b(battery (keeps|always|goes) (dying|flat|dead)|battery light|charging (light|warning)|alternator|drain)\b/i,
    first: 'With the engine running, measure battery voltage: 13.8 to 14.7 V means the alternator is charging.',
    causes: [
      C('Alternator not charging', 'common', 'Running voltage below 13.2 V; battery light on.', 'Check the drive belt and alternator fuse, then replace the alternator or regulator.', 'moderate'),
      C('Slipping or broken drive belt', 'common', 'Squeal on start-up; belt glazed or cracked.', 'Replace and tension the belt.', 'moderate'),
      C('Parasitic drain', 'common', 'With everything off and the car asleep, current draw above about 50 mA. Pull fuses one at a time to find the circuit.', 'Fix the offending circuit (boot light, aftermarket alarm, radio, stuck relay).', 'moderate'),
      C('Old battery that no longer holds charge', 'common', 'Fully charged battery drops below 12.4 V overnight.', 'Replace the battery.'),
    ],
  },
  {
    id: 'check-engine', system: 'Engine management',
    symptom: 'Check engine light is on',
    match: /\b(check engine|engine (warning )?light|mil\b|malfunction light|obd|p0\d{3}|p[0-3]\d{3})\b/i,
    first: 'Read the stored codes with an OBD-II scanner. A flashing light means an active misfire: reduce load and get it checked soon.',
    causes: [
      C('Loose fuel cap (evaporative leak codes P0455, P0456)', 'common', 'Cap not clicking shut.', 'Tighten or replace the cap; the light clears after some drive cycles.'),
      C('Oxygen sensor or catalytic converter efficiency (P0130 to P0167, P0420)', 'common', 'Read live sensor data.', 'Replace the failed sensor; fix exhaust leaks before blaming the converter.', 'moderate'),
      C('Misfire (P0300 to P0308)', 'common', 'The last digit names the cylinder. Swap its coil with a neighbour and see if the misfire follows.', 'Replace the coil, plug or injector that the misfire follows.', 'moderate'),
      C('Mass airflow or vacuum leak (P0171, P0174 lean codes)', 'common', 'Hissing at idle; spray around intake joints and listen for idle change.', 'Clean the MAF sensor; replace split hoses.', 'moderate'),
    ],
  },
  {
    id: 'rough-idle', system: 'Engine',
    symptom: 'Rough idle, misfire, loss of power or stalling',
    match: /\b(rough idle|misfir\w*|stall\w*|hesitat\w*|loss of power|lacks power|jerk\w*|sputter\w*|shak\w* at idle)\b/i,
    first: 'Scan for codes, then check spark plugs, coils and air filter.',
    causes: [
      C('Worn spark plugs or failing coil', 'very common', 'Fouled or worn plug electrodes; misfire codes.', 'Replace plugs to the service interval and swap in a new coil where needed.', 'moderate'),
      C('Dirty throttle body or idle control valve', 'common', 'Carbon build-up around the throttle plate.', 'Clean with throttle body cleaner and relearn idle.', 'moderate'),
      C('Vacuum leak', 'common', 'Hissing; lean codes.', 'Replace the split hose or intake gasket.', 'moderate'),
      C('Clogged fuel filter or weak pump', 'moderate', 'Power loss under load; low fuel pressure.', 'Replace the filter or pump.', 'moderate'),
      C('Dirty or faulty injectors', 'moderate', 'Balance test; misfire on one cylinder that is not the coil.', 'Clean or replace injectors.', 'workshop'),
    ],
  },
  {
    id: 'smoke', system: 'Engine',
    symptom: 'Smoke from the exhaust',
    match: /\b(smok\w*|white smoke|blue smoke|black smoke)\b/i,
    first: 'Note the colour. Thin white vapour on a cold morning is normal condensation.',
    causes: [
      C('Blue smoke: burning oil (worn valve seals, piston rings, turbo seals)', 'common', 'Oil level dropping between changes; smoke on start-up or when accelerating.', 'Valve stem seals, turbo, or engine rebuild depending on source.', 'workshop'),
      C('Black smoke: running rich (air filter, MAF, injectors, diesel over-fuelling)', 'common', 'Poor fuel economy; sooty tailpipe.', 'Replace the air filter, clean the MAF, test injectors.', 'moderate'),
      C('Thick white smoke: coolant burning (head gasket)', 'moderate', 'Sweet smell; coolant loss; bubbles in the expansion tank.', 'Combustion leak test and head gasket repair.', 'workshop'),
    ],
  },
  {
    id: 'ac', system: 'Air conditioning',
    symptom: 'Air conditioning blows warm air',
    match: /\b(a\/?c|air ?con\w*|aircon|blow\w* (hot|warm)|not cooling)\b/i,
    first: 'Turn the AC on at full cold and check whether the compressor clutch at the front of the engine engages (it clicks and the centre spins).',
    causes: [
      C('Low refrigerant from a leak', 'very common', 'Compressor cycles on and off rapidly or does not engage; oily residue at joints.', 'Leak test with dye, repair and recharge.', 'workshop'),
      C('Compressor clutch, fuse or relay', 'common', 'Clutch not engaging with enough pressure. Check the AC fuse and relay.', 'Replace the relay or clutch coil.', 'moderate'),
      C('Condenser fan not running', 'common', 'Cool at speed but warm when stopped.', 'Replace the fan motor or relay.', 'moderate'),
      C('Blocked cabin filter or blend door fault', 'moderate', 'Weak airflow, or air not changing temperature when you move the control.', 'Replace the cabin filter; repair the blend door actuator.', 'moderate'),
    ],
  },
  {
    id: 'lights', system: 'Electrical: lighting',
    symptom: 'Headlights, brake lights or indicators not working',
    match: /\b(headlights?|headlamps?|brake lights?|tail ?lights?|indicators?|turn signals?|hazards?|blinkers?)\b/i,
    first: 'Check whether one lamp or the whole circuit is out. One side out is usually a bulb; both out is usually a fuse, relay or switch.',
    causes: [
      C('Blown bulb', 'very common', 'Look at the filament or swap bulbs side to side.', 'Replace the bulb.'),
      C('Blown fuse or failed relay', 'common', 'Both sides out. Check the lighting fuses and relays.', 'Replace the fuse or relay.'),
      C('Brake light switch at the pedal', 'common', 'All brake lights out with good bulbs and fuse.', 'Replace the pedal switch.'),
      C('Indicator flashing fast', 'common', 'Fast flash means a bulb on that side is out.', 'Replace the bulb.'),
      C('Corroded socket or bad earth', 'moderate', 'Green corrosion in the lamp holder; dim or flickering lamp.', 'Clean the contacts and earth.'),
    ],
  },
  {
    id: 'windows', system: 'Electrical: body',
    symptom: 'Power window, central locking or horn not working',
    match: /\b(power windows?|window (won'?t|will not|doesn'?t) (go|move|roll)|window (motor|regulator)|central lock\w*|door locks?|horn)\b/i,
    first: 'Try the same function from another switch (driver master switch versus door switch) to separate a switch fault from a motor fault.',
    causes: [
      C('Failed window regulator (motor runs, glass does not move)', 'very common', 'You hear the motor but the glass drops or stays still.', 'Replace the regulator.', 'moderate'),
      C('Window motor', 'common', 'No sound from either switch; 12 V present at the motor.', 'Replace the motor.', 'moderate'),
      C('Switch or broken wires in the door hinge boot', 'common', 'Intermittent operation that changes as you open and close the door.', 'Repair the wires in the door boot; replace the switch.', 'moderate'),
      C('Fuse or relay (horn, locks)', 'common', 'Check the fuse and relay for that circuit.', 'Replace the fuse or relay.'),
      C('Horn clock spring (horn dead, airbag light on)', 'moderate', 'Airbag warning light together with a dead horn.', 'Replace the clock spring. Airbag work needs care: disconnect the battery and wait before touching it.', 'workshop'),
    ],
  },
  {
    id: 'transmission', system: 'Transmission and clutch',
    symptom: 'Gearbox slipping, hard shifting, or clutch problems',
    match: /\b(gear ?box|transmission|gears? (slip|grind|crunch)|slipping|clutch|hard (to )?shift|won'?t go into gear|delayed engagement)\b/i,
    first: 'Automatic: check the transmission fluid level and colour (red and clean is good; brown and burnt-smelling is bad). Manual: note whether revs rise without the car speeding up.',
    causes: [
      C('Low or burnt transmission fluid', 'common', 'Dipstick level and smell.', 'Top up or change the fluid and filter with the correct specification.', 'moderate'),
      C('Worn clutch (manual)', 'common', 'Revs flare in high gears under load; biting point very high.', 'Replace clutch kit.', 'workshop'),
      C('Hydraulic clutch leak (soft pedal, crunching gears)', 'common', 'Low clutch fluid; wet slave cylinder.', 'Replace master or slave cylinder and bleed.', 'moderate'),
      C('Solenoid or control module fault (automatic)', 'moderate', 'Transmission codes; limp mode stuck in one gear.', 'Scan and replace the solenoid pack or repair wiring.', 'workshop'),
    ],
  },
  {
    id: 'steering-suspension', system: 'Steering and suspension',
    symptom: 'Knocking over bumps, pulling, vibration, or heavy steering',
    match: /\b(knock\w*|clunk\w*|pull(s|ing)? to|vibrat\w*|wobbl\w*|steering (heavy|stiff|hard)|shock absorbers?|suspension|bouncy|tyres? wear\w*|tire wear\w*)\b/i,
    first: 'Check tyre pressures and look for uneven tyre wear, then bounce each corner of the car.',
    causes: [
      C('Wrong tyre pressure or wheel alignment', 'very common', 'Pressures differ side to side; inner or outer edge wear.', 'Set pressures to the door-pillar sticker; get a four-wheel alignment.'),
      C('Unbalanced wheels (vibration at motorway speed)', 'common', 'Steering shake between 90 and 120 km/h.', 'Balance the wheels.'),
      C('Worn anti-roll bar links or bushes (knocking)', 'common', 'Play when you rock the link by hand.', 'Replace links and bushes.', 'moderate'),
      C('Worn ball joints or tie-rod ends', 'common', 'Play when you rock the wheel at 12 and 6, or 3 and 9 o\'clock with the car raised.', 'Replace and realign.', 'moderate'),
      C('Worn shock absorbers', 'moderate', 'Car keeps bouncing after you push a corner down; oil on the shock body.', 'Replace in axle pairs.', 'moderate'),
      C('Low power steering fluid or failing pump (hydraulic)', 'moderate', 'Whine when turning; fluid low.', 'Fix leaks and top up; replace the pump.', 'moderate'),
    ],
  },
  {
    id: 'noises', system: 'Engine and drivetrain',
    symptom: 'Squealing, ticking, whining or rattling noise',
    match: /\b(squeal\w*|squeak\w*|tick\w*|whin\w*|rattl\w*|grind\w*|hum(ming)?|noise|sound)\b/i,
    first: 'Note when it happens: at start-up, with speed, with engine revs, when turning, or when braking.',
    causes: [
      C('Squeal at start-up or with AC on: drive belt', 'very common', 'Glazed or cracked belt; weak tensioner.', 'Replace belt and tensioner.', 'moderate'),
      C('Ticking that follows engine revs: low oil or valve clearance', 'common', 'Check the oil level first.', 'Top up oil; adjust valves or replace lifters.', 'moderate'),
      C('Hum or growl that rises with road speed: wheel bearing', 'common', 'Noise changes when weaving left and right; play in the raised wheel.', 'Replace the wheel bearing.', 'moderate'),
      C('Clicking when turning at full lock: CV joint', 'common', 'Torn CV boot with grease flung around.', 'Replace the driveshaft or CV joint.', 'moderate'),
      C('Rattle underneath: loose heat shield or exhaust mount', 'common', 'Tap the exhaust with the engine cold.', 'Refit the clamp or mount.'),
    ],
  },
  {
    id: 'fuel-economy', system: 'Engine',
    symptom: 'Poor fuel economy',
    match: /\b(fuel (economy|consumption)|mileage (drop|bad|poor)|uses? (a lot of|too much) (fuel|petrol|gas)|drinks? fuel|guzzl\w*)\b/i,
    first: 'Check tyre pressures and the air filter, then scan for codes.',
    causes: [
      C('Under-inflated tyres', 'very common', 'Pressure gauge against the door sticker.', 'Inflate to specification.'),
      C('Dirty air filter', 'common', 'Filter visibly dark and clogged.', 'Replace it.'),
      C('Faulty oxygen sensor or thermostat stuck open', 'common', 'Codes; temperature gauge sitting low.', 'Replace the sensor or thermostat.', 'moderate'),
      C('Dragging brakes', 'moderate', 'A hot wheel after driving.', 'Service the caliper.', 'moderate'),
    ],
  },
];

const SYSTEM_WORDS = /\b(electrical|fuse|relay|wiring)\b/i;

/** Rank faults for a complaint. Returns the best trees plus generic advice. */
export function diagnoseVehicle({ symptom = '', vehicle = '', codes = [] } = {}) {
  const text = `${symptom} ${(codes || []).join(' ')}`.trim();
  if (!text) return { status: 'error', message: 'Describe the symptom, for example "my wipers do not work".' };
  const hits = VEHICLE_FAULTS.filter(f => f.match.test(text));
  // Specific wiper, washer and lighting trees beat the general noise tree when both match.
  const ordered = hits.sort((a, b) => (a.id === 'noises') - (b.id === 'noises'));
  const faults = ordered.slice(0, 3).map(f => ({
    symptom: f.symptom, system: f.system, firstCheck: f.first,
    likelyCauses: f.causes.map((c, i) => ({ rank: i + 1, ...c })),
    ...(f.safety ? { safety: f.safety } : {}),
  }));
  return {
    status: faults.length ? 'success' : 'no_match',
    vehicle: vehicle || undefined,
    complaint: symptom,
    faults,
    generalSteps: [
      'Check the obvious first: fuses, fluid levels, battery voltage, loose connectors.',
      'Read fault codes with an OBD-II scanner where the car has one (1996 onward in most markets).',
      'Test one cause at a time and confirm it before buying parts.',
      ...(SYSTEM_WORDS.test(text) ? ['For electrical faults, check power, then earth, then the switch, then the load.'] : []),
    ],
    message: faults.length
      ? `Matched ${faults.length} fault tree(s): ${faults.map(f => f.symptom).join('; ')}. Present the causes in this order, with the check for each.`
      : 'No fault tree matched. Ask for the make, model, year and exactly what happens (when, noises, warning lights), then reason from the general steps.',
  };
}
