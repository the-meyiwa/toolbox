/**
 * Automotive Reference Database
 * Authoritative vehicle specifications, engineering taxonomy,
 * component failure diagnostics, and multi-generational vehicle data.
 */

export const VEHICLE_DATABASE = [
  /* ------------------------------------------------------------
     LEXUS GX 550 (J250) — 2024–Present
     ------------------------------------------------------------ */
  {
    id: 'lexus-gx-550',
    manufacturer: 'Lexus',
    model: 'GX',
    generation: 'J250 (3rd Gen)',
    variant: 'GX 550 Overtrail / Luxury',
    years: '2024–present',
    modelYears: '2024, 2025',
    bodyStyle: '5-door SUV',
    platform: 'GA-F (TNGA-F High-Strength Steel Ladder Frame)',
    layout: 'Front Longitudinal Engine, Full-Time 4WD',
    curbWeight: '2,580 kg (5,688 lb)',
    wheelbase: '2,850 mm (112.2 in)',
    dimensions: '5,005 mm L × 2,114 mm W × 1,935 mm H',
    engine: {
      code: 'V35A-FTS',
      type: '3.4L Twin-Turbo 60° V6, DOHC 24-valve',
      displacement: '3,445 cc',
      aspiration: 'Twin Turbochargers with Air-to-Water Intercoolers',
      injection: 'D-4ST (Direct & Port Fuel Injection)',
      output: '349 hp (260 kW) @ 4,800–5,200 rpm',
      torque: '479 lb-ft (649 N·m) @ 2,000–3,600 rpm',
      boreStroke: '85.5 mm × 100.0 mm',
      compressionRatio: '10.3:1',
      fuelReq: 'Premium 91+ Octane Unleaded'
    },
    transmission: {
      code: 'Direct Shift-10AT (AWR10L65)',
      type: '10-speed Electronically Controlled Automatic',
      ratios: '1st: 4.923, 2nd: 3.253, 3rd: 2.349, 4th: 1.944, 5th: 1.532, 6th: 1.193, 7th: 1.000, 8th: 0.801, 9th: 0.657, 10th: 0.536, Rev: 4.307',
      transferCase: '2-speed Full-Time 4WD Transfer Case with Torsen Center Limited-Slip Differential (High/Low Range, Center & Rear Electronic Diff Locks)'
    },
    chassis: {
      frameType: 'Fully boxed high-strength steel ladder frame with hydroformed side rails',
      frontSuspension: 'Independent Double-Wishbone with forged aluminum high-mount upper arms, coil springs, and Adaptive Variable Suspension (AVS)',
      rearSuspension: '4-Link Rigid Axle with coil springs, lateral Panhard control rod, and AVS dampers',
      steering: 'Electric Power Steering (EPS) rack-and-pinion with variable assist',
      brakes: '4-Wheel Power Ventilated Discs; Front: 354 mm discs with 4-piston fixed aluminum calipers; Rear: 335 mm discs with single-piston floating calipers'
    },
    interior: {
      infotainment: '14.0-inch Lexus Interface touchscreen with wireless Apple CarPlay / Android Auto',
      instrumentation: '12.3-inch multi-information digital gauge cluster with customizable HUD',
      seating: '3-row 7-passenger (or 2-row 5-passenger Overtrail) with heated/ventilated semi-aniline front seats and power-folding 3rd row',
      climate: 'Tri-zone automatic climate control with nanoe X air purification'
    },
    safety: 'Lexus Safety System+ 3.0 (Pre-Collision System with Pedestrian Detection, Dynamic Radar Cruise Control, Lane Tracing Assist, Road Sign Assist), 10 Airbags',
    supportedViews: ['chassis', 'profile', 'interior'],
    sections: ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'],
    components: [
      {
        id: 'v35a-engine',
        name: 'V35A-FTS Twin-Turbo V6 Engine',
        section: 'engine',
        subsystem: 'Powertrain',
        location: 'Front Engine Bay (Longitudinal)',
        purpose: 'Primary internal combustion power unit utilizing twin turbochargers and high-pressure dual injection to deliver high low-end torque for towing and off-road duty.',
        specs: 'Aluminum block and heads, cross-bolted main bearing caps, electric VVT-iE intake camshaft timing, water-cooled intercoolers, dual twin-scroll turbochargers.',
        failures: 'Premature main bearing wear on early production runs due to machining debris; wastegate actuator rod seizure; intercooler coolant pump aeration.',
        related: ['10speed-transmission', 'radiator-pack', 'turbos-intercooler']
      },
      {
        id: 'turbos-intercooler',
        name: 'Dual Turbochargers & Intercooler System',
        section: 'engine',
        subsystem: 'Forced Induction',
        location: 'Exhaust Manifolds & Front Core Support',
        purpose: 'Compresses intake air to maximize volumetric efficiency, with dual air-to-water heat exchangers dropping charge temperatures before throttle delivery.',
        specs: 'Electronically actuated variable-vane wastegates, max boost ~18.5 psi, dedicated auxiliary cooling loop with electric coolant pump.',
        failures: 'Electronic wastegate position sensor drift causing P0299 underboost codes; heat exchanger rock puncture.',
        related: ['v35a-engine', 'exhaust-downpipes']
      },
      {
        id: '10speed-transmission',
        name: 'Direct Shift-10AT Transmission',
        section: 'drivetrain',
        subsystem: 'Transmission',
        location: 'Center Tunnel behind Engine',
        purpose: 'Transfers engine torque across 10 close-ratio gears with high-speed lockup torque converter for broad torque multiplication and fuel economy.',
        specs: 'Aisin AWR10L65, planetary gearset, integrated transmission fluid cooler, electro-hydraulic valve body.',
        failures: 'Torque converter shudder if fluid degrades; low-speed 1st-to-2nd gear shift hesitation under cold conditions.',
        related: ['v35a-engine', 'transfer-case', 'center-driveshaft']
      },
      {
        id: 'transfer-case',
        name: 'Full-Time 4WD Torsen Transfer Case',
        section: 'drivetrain',
        subsystem: 'Drivetrain',
        location: 'Behind Transmission Output',
        purpose: 'Splits engine torque 40:60 front-to-rear under standard conditions, automatically biasing up to 30:70 or 50:50, with selectable 4L reduction gearing.',
        specs: 'Torsen Type-C planetary center differential, electric low-range actuator motor, electromagnetic center diff lock.',
        failures: 'Transfer case shift actuator motor stuck due to lack of 4L exercise; output shaft seal weeping.',
        related: ['10speed-transmission', 'center-driveshaft', 'front-differential']
      },
      {
        id: 'ladder-frame',
        name: 'GA-F Boxed Steel Ladder Frame',
        section: 'chassis',
        subsystem: 'Chassis & Structure',
        location: 'Full Vehicle Underside',
        purpose: 'Heavy-duty structural backbone resisting torsional twist and bending loads during high-stress off-road driving and 9,096 lb towing capacity.',
        specs: 'Laser-welded high-tensile steel side members, 9 structural crossmembers, hydroformed front horns, integrated tow hitch receiver.',
        failures: 'Surface oxidation at weld joints in winter road-salt environments; frame bushing degradation under heavy washboard loads.',
        related: ['front-wishbones', 'rear-rigid-axle']
      },
      {
        id: 'front-wishbones',
        name: 'Double-Wishbone Front Suspension',
        section: 'front-suspension',
        subsystem: 'Front Suspension',
        location: 'Front Axle Left & Right',
        purpose: 'Maintains optimal tire contact patch and steering geometry through suspension travel while absorbing heavy dynamic impacts.',
        specs: 'Forged aluminum high-mount upper arms, stamped high-strength steel lower arms, hydraulic compliant bushings, sealed ball joints.',
        failures: 'Lower ball joint boot tear causing grease loss; lower control arm inner compliance bushing tearing after high mileage.',
        related: ['steering-rack', 'front-brakes', 'ladder-frame']
      },
      {
        id: 'steering-rack',
        name: 'Electric Power Steering (EPS) Gear',
        section: 'steering',
        subsystem: 'Steering',
        location: 'Front Subframe Crossmember',
        purpose: 'Translates driver steering wheel angle into lateral tie-rod motion with brushless electric motor assist for light low-speed maneuvers and high-speed stability.',
        specs: 'Belt-driven rack-parallel electric motor, torque sensor on pinion shaft, forged steel tie-rod ends, 3.1 turns lock-to-lock.',
        failures: 'Inner tie rod play causing steering vagueness; steering rack boot clamp looseness allowing water ingress into rack tube.',
        related: ['front-wishbones', 'front-brakes']
      },
      {
        id: 'front-brakes',
        name: 'Front 4-Piston Ventilated Brake Assembly',
        section: 'brakes',
        subsystem: 'Braking',
        location: 'Front Wheel Hubs',
        purpose: 'Provides primary hydraulic braking deceleration to stop 2.5-ton vehicle mass without thermal brake fade.',
        specs: '354 mm × 32 mm spiral-vane ventilated cast iron rotors, 4-piston fixed aluminum monobloc calipers, low-metallic friction pads.',
        failures: 'Rotor thickness variation (DTV) causing brake pedal pulsation under high-heat downhill towing; slider pin corrosion.',
        related: ['rear-brakes', 'front-wishbones']
      },
      {
        id: 'rear-rigid-axle',
        name: '4-Link Solid Rear Axle with Panhard Rod',
        section: 'rear-suspension',
        subsystem: 'Rear Suspension',
        location: 'Rear Axle Assembly',
        purpose: 'Rugged solid axle housing delivering articulation over obstacles, maintaining constant ground clearance beneath differential under suspension compression.',
        specs: 'Cast iron center carrier with heavy-wall steel axle tubes, 4 tubular trailing arms with rubber bushings, lateral Panhard rod, electronic locking rear diff.',
        failures: 'Rear differential pinion seal leak; Panhard rod bushing wear causing high-speed body sway ("rear-end wander").',
        related: ['ladder-frame', 'rear-differential', 'rear-brakes']
      },
      {
        id: 'rear-differential',
        name: 'Electronic Locking Rear Differential',
        section: 'drivetrain',
        subsystem: 'Drivetrain',
        location: 'Rear Axle Housing Center',
        purpose: 'Distributes torque between rear wheels, with electronically commanded dog-clutch locking both wheels 50/50 for maximum off-road traction.',
        specs: 'Hypoid ring and pinion gearset (3.91:1 ratio), 12V electromagnetic lock actuator, 75W-85 synthetic gear lube.',
        failures: 'Electronic lock actuator solenoid corrosion if submerged without extended breather; gear whining if fluid is depleted.',
        related: ['rear-rigid-axle', 'center-driveshaft']
      },
      {
        id: 'exhaust-system',
        name: 'Dual Exhaust System & Catalytic Converters',
        section: 'exhaust-fuel',
        subsystem: 'Exhaust & Emissions',
        location: 'Underbody from Engine to Rear Bumper',
        purpose: 'Directs combusted exhaust gas away from engine, oxidizes carbon monoxide and unburnt hydrocarbons, and silences noise to meet luxury acoustic targets.',
        specs: '304 stainless steel tubing, close-coupled ceramic substrate catalytic converters, underfloor resonator, transverse rear baffle muffler.',
        failures: 'Exhaust hanger rubber deterioration; oxygen/air-fuel ratio sensor heater circuit failure.',
        related: ['v35a-engine', 'fuel-tank']
      },
      {
        id: 'fuel-tank',
        name: 'Reinforced Saddle Fuel Tank & High-Flow Pump',
        section: 'exhaust-fuel',
        subsystem: 'Fuel System',
        location: 'Mid-Chassis between Frame Rails',
        purpose: 'Stores 21.1 gallons (80 L) of gasoline and supplies constant high-pressure fuel to low-pressure fuel pump and direct injection pump.',
        specs: 'Multi-layer blow-molded polyethylene tank, stamped steel protective skid plate, in-tank electric turbine fuel pump with integrated fuel level sender.',
        failures: 'Skid plate denting from extreme rock impact; evaporative emission (EVAP) purge valve sticking open causing rough idle after refueling.',
        related: ['v35a-engine', 'exhaust-system']
      },
      {
        id: 'lexus-interface',
        name: '14-inch Lexus Interface Center Cockpit',
        section: 'cockpit',
        subsystem: 'Interior Electronics',
        location: 'Center Dashboard Console',
        purpose: 'Primary human-machine interface controlling navigation, off-road Multi-Terrain Monitor cameras, media, and vehicle dynamic settings.',
        specs: '14.0-inch anti-glare capacitive optical bonded glass display, digital rotary volume dial, physical climate dials, connected cloud profile sync.',
        failures: 'Touchscreen freeze during simultaneous wireless projection and camera view; occasional Bluetooth disconnects.',
        related: ['digital-cluster', 'front-seats']
      },
      {
        id: 'front-seats',
        name: 'Semi-Aniline 10-Way Heated/Cooled Seats',
        section: 'cabin',
        subsystem: 'Interior Comfort',
        location: 'Front Driver & Passenger Compartment',
        purpose: 'Ergonomic seating engineered with supportive side bolsters to prevent driver fatigue during long-distance touring and extreme chassis pitch/roll.',
        specs: 'Semi-aniline perforated leather, dual blower thermoelectric cooling, high-output heating elements, 4-way pneumatic lumbar support.',
        failures: 'Seat ventilation blower fan lint accumulation; lumbar support bladder slow leak.',
        related: ['lexus-interface']
      }
    ]
  },

  /* ------------------------------------------------------------
     LEXUS GX 460 (J150) — 2010–2023
     ------------------------------------------------------------ */
  {
    id: 'lexus-gx-460',
    manufacturer: 'Lexus',
    model: 'GX',
    generation: 'J150 (2nd Gen)',
    variant: 'GX 460 Premium / Luxury',
    years: '2010–2023',
    modelYears: '2010–2023',
    bodyStyle: '5-door SUV',
    platform: 'Toyota Land Cruiser Prado 150 Ladder Frame',
    layout: 'Front Longitudinal Engine, Full-Time 4WD',
    curbWeight: '2,330 kg (5,130 lb)',
    wheelbase: '2,790 mm (109.8 in)',
    dimensions: '4,880 mm L × 1,885 mm W × 1,885 mm H',
    engine: {
      code: '1UR-FE',
      type: '4.6L Naturally Aspirated 90° V8, DOHC 32-valve',
      displacement: '4,608 cc',
      aspiration: 'Naturally Aspirated with Acoustic Control Induction (ACIS)',
      injection: 'Electronic Sequential Multi-Point Fuel Injection (EFI)',
      output: '301 hp (225 kW) @ 5,500 rpm',
      torque: '329 lb-ft (446 N·m) @ 3,500 rpm',
      boreStroke: '86.0 mm × 99.0 mm',
      compressionRatio: '10.2:1',
      fuelReq: 'Premium 91+ Octane Unleaded'
    },
    transmission: {
      code: 'A760F 6-Speed Automatic',
      type: '6-speed Sequential-Shift Electronically Controlled Automatic',
      ratios: '1st: 3.520, 2nd: 2.042, 3rd: 1.400, 4th: 1.000, 5th: 0.716, 6th: 0.586, Rev: 3.224',
      transferCase: 'VF4BM Full-Time 4WD Transfer Case with Torsen Center Differential (4H/4L mechanical shift lever / switch)'
    },
    chassis: {
      frameType: 'High-strength steel ladder frame with boxed side rails',
      frontSuspension: 'Independent Double-Wishbone with Kinetic Dynamic Suspension System (KDSS) hydraulic sway bars',
      rearSuspension: '4-Link Rigid Axle with KDSS and optional Adaptive Variable Suspension (AVS) with rear air springs',
      steering: 'Hydraulic Power-Assisted Rack-and-Pinion Steering',
      brakes: '4-Wheel Ventilated Disc Brakes; Front: 338 mm rotors with 4-piston fixed calipers; Rear: 312 mm rotors with single-piston calipers'
    },
    interior: {
      infotainment: '10.3-inch touchscreen (2022+) or 8.0-inch Gen 8/9 display with Remote Touch',
      instrumentation: 'Electroluminescent analog dials with central 4.2-inch color multi-information display',
      seating: '3-row 7-passenger seating with 40/20/40 sliding 2nd row and power-folding 3rd row',
      climate: 'Three-zone automatic climate control with interior air filter'
    },
    safety: 'Lexus Safety System+ (Pre-Collision with Pedestrian Detection, Lane Departure Alert, High-Speed Dynamic Radar Cruise), 10 Airbags',
    supportedViews: ['chassis', 'profile', 'interior'],
    sections: ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'],
    components: [
      {
        id: '1ur-engine',
        name: '1UR-FE 4.6L Naturally Aspirated V8',
        section: 'engine',
        subsystem: 'Powertrain',
        location: 'Front Engine Bay (Longitudinal)',
        purpose: 'Legendary bulletproof V8 architecture delivering smooth linear torque, exceptional thermal resilience, and legendary durability for long-term off-road overlanding.',
        specs: 'Cast aluminum alloy block with spiny iron cylinder liners, forged steel crankshaft, magnesium valve covers, Dual VVT-i camshaft timing.',
        failures: 'Secondary air injection pump (SAIS) check valve failure causing limp mode; valley plate coolant heat-exchanger leak after 100k+ miles.',
        related: ['6speed-transmission', 'kdss-system', 'radiator-v8']
      },
      {
        id: '6speed-transmission',
        name: 'A760F 6-Speed Heavy-Duty Automatic',
        section: 'drivetrain',
        subsystem: 'Transmission',
        location: 'Center Tunnel',
        purpose: 'Robust hydraulic planetary automatic transmission delivering proven long-term durability and wide gear spread for highway cruising and low-speed crawl.',
        specs: 'Toyota A760F, lock-up torque converter across 4th-6th gears, heavy-duty fluid cooler, lifetime WS fluid.',
        failures: 'Torque converter shudder if transmission fluid is not replaced at 60k intervals; shift solenoid sticking.',
        related: ['1ur-engine', 'vf4bm-tcase']
      },
      {
        id: 'kdss-system',
        name: 'Kinetic Dynamic Suspension System (KDSS)',
        section: 'front-suspension',
        subsystem: 'Suspension Stabilization',
        location: 'Front & Rear Sway Bars',
        purpose: 'Interconnects front and rear anti-roll bars via dual hydraulic accumulator cylinders, stiffening sway bars for flat on-road cornering and disengaging them for maximum off-road articulation.',
        specs: 'Two dual-acting hydraulic cylinders, high-pressure accumulator valve block mounted on frame rail (approx. 3.0 MPa operating pressure).',
        failures: 'KDSS accumulator control valve body corrosion leading to fluid leaks and permanent vehicle body lean ("KDSS lean").',
        related: ['1ur-engine', 'rear-rigid-axle-j150']
      },
      {
        id: 'hydraulic-steering-rack',
        name: 'Hydraulic Power Rack-and-Pinion Steering',
        section: 'steering',
        subsystem: 'Steering',
        location: 'Front Crossmember',
        purpose: 'Engine-belt driven hydraulic steering gear providing natural tactile steering feedback and high damping against trail kickback.',
        specs: 'Rotary spool control valve, engine-driven vane pump with fluid reservoir, integral steel steering rack cylinder.',
        failures: 'Power steering rack inner end-seal leakage causing fluid buildup in rack boots; high-pressure hose weeping at crimps.',
        related: ['kdss-system', 'front-brakes-j150']
      },
      {
        id: 'vf4bm-tcase',
        name: 'VF4BM Full-Time 4WD Torsen Transfer Case',
        section: 'drivetrain',
        subsystem: 'Drivetrain',
        location: 'Behind Transmission',
        purpose: 'Permanent 4WD split with manual mechanical locking mode for severe mud, sand, and rock crawling.',
        specs: 'Torsen planetary differential, 2.566:1 low-range gear reduction, electric center differential lock motor.',
        failures: 'Electric differential lock actuator internal contact switch oxidation if not periodically cycled.',
        related: ['6speed-transmission', 'rear-diff-j150']
      }
    ]
  },

  /* ------------------------------------------------------------
     TOYOTA COROLLA (E210) — 2019–Present
     ------------------------------------------------------------ */
  {
    id: 'toyota-corolla-e210',
    manufacturer: 'Toyota',
    model: 'Corolla',
    generation: 'E210 (12th Gen)',
    variant: 'Corolla SE / XSE Sedan',
    years: '2019–present',
    modelYears: '2019–2025',
    bodyStyle: '4-door Sedan',
    platform: 'GA-C (TNGA High-Rigidity Unibody Platform)',
    layout: 'Front Transverse Engine, Front-Wheel Drive (FWD)',
    curbWeight: '1,385 kg (3,053 lb)',
    wheelbase: '2,700 mm (106.3 in)',
    dimensions: '4,630 mm L × 1,780 mm W × 1,435 mm H',
    engine: {
      code: 'M20A-FKS Dynamic Force',
      type: '2.0L Inline-4, DOHC 16-valve',
      displacement: '1,987 cc',
      aspiration: 'Naturally Aspirated with 40% Thermal Efficiency',
      injection: 'D-4S (High-Pressure Direct & Low-Pressure Port Injection)',
      output: '169 hp (126 kW) @ 6,600 rpm',
      torque: '151 lb-ft (205 N·m) @ 4,400–4,800 rpm',
      boreStroke: '80.5 mm × 97.6 mm',
      compressionRatio: '13.0:1',
      fuelReq: 'Regular 87 Octane Unleaded'
    },
    transmission: {
      code: 'Dynamic-Shift CVT (K120)',
      type: 'Continuously Variable Transmission with Physical Launch 1st Gear',
      ratios: 'Physical 1st Launch Gear: 3.207; Belt Pulley Ratio Spread: 2.236–0.447; 10-Speed Simulated Sport Mode'
    },
    chassis: {
      frameType: 'TNGA-C Unitized high-strength steel structure with ring-shaped frame reinforcement',
      frontSuspension: 'Independent MacPherson Strut with stabilizer bar and internal rebound springs',
      rearSuspension: 'Independent Multi-Link Rear Suspension with trailing arms and stabilizer bar',
      steering: 'Electric Power Steering (EPS) with column-mounted assist',
      brakes: '4-Wheel Disc; Front: 282 mm ventilated discs with single-piston calipers; Rear: 259 mm solid discs'
    },
    interior: {
      infotainment: '8.0-inch Toyota Audio Multimedia touchscreen with wireless smartphone mirroring',
      instrumentation: '7.0-inch customizable digital speedometer cluster with analog peripheral gauges',
      seating: 'SofTex sport-bolstered front seats with 8-way power driver adjustment, 60/40 folding rear bench',
      climate: 'Automatic climate control with pollen filtration'
    },
    safety: 'Toyota Safety Sense 3.0 (Pre-Collision with Pedestrian & Cyclist Detection, Dynamic Radar Cruise Control, Lane Departure Alert with Steering Assist), 10 Airbags',
    supportedViews: ['chassis', 'profile', 'interior'],
    sections: ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'],
    components: [
      {
        id: 'm20a-engine',
        name: 'M20A-FKS Dynamic Force 2.0L Engine',
        section: 'engine',
        subsystem: 'Powertrain',
        location: 'Front Transverse Engine Bay',
        purpose: 'High-efficiency 4-cylinder engine achieving 40% thermal efficiency through high-tumble intake ports, long stroke ratio, and dual direct/port injection.',
        specs: '13.0:1 compression ratio, electric VVT-iE intake cam phasing, laser-clad valve seats, variable-flow oil pump.',
        failures: 'EGR cooler carbon clogging over high mileage; direct injection high-pressure fuel pump ticking noise.',
        related: ['dynamic-shift-cvt', 'front-macpherson-strut']
      },
      {
        id: 'dynamic-shift-cvt',
        name: 'Dynamic-Shift CVT with Physical Launch Gear',
        section: 'drivetrain',
        subsystem: 'Transmission',
        location: 'Transverse Transaxle next to Engine',
        purpose: 'Combines a physical gear for responsive, slip-free takeoff from standstill with a high-efficiency belt CVT for quiet highway cruising.',
        specs: 'K120 transaxle, mechanical gear drive until ~15 mph then seamless wet-clutch transition to steel push belt.',
        failures: 'CVT fluid degradation leading to belt whine; pulley actuator solenoid hesitation if fluid isn’t serviced.',
        related: ['m20a-engine', 'front-cv-axles']
      },
      {
        id: 'front-macpherson-strut',
        name: 'MacPherson Strut Front Suspension',
        section: 'front-suspension',
        subsystem: 'Front Suspension',
        location: 'Front Left & Right Wheel Arches',
        purpose: 'Compact strut design integrating coil springs, damper struts, and steering knuckle into a lightweight front assembly.',
        specs: 'Low-friction strut bearings, internal rebound springs, stamped steel L-arm, 22 mm tubular sway bar.',
        failures: 'Strut top mount bearing noise ("groan" when turning at low speed); sway bar end link ball joint play.',
        related: ['eps-steering-e210', 'front-brakes-e210']
      },
      {
        id: 'rear-multilink-e210',
        name: 'Independent Multi-Link Rear Suspension',
        section: 'rear-suspension',
        subsystem: 'Rear Suspension',
        location: 'Rear Axle Area',
        purpose: 'Major upgrade over 11th Gen torsion beam; allows each rear wheel to absorb road bumps independently, drastically reducing body pitch and improving cornering grip.',
        specs: 'Trailing arm with upper and lower transverse links, coil-over-damper units, hollow rear anti-roll bar.',
        failures: 'Trailing arm front bushing drying and squeaking over cold speed bumps.',
        related: ['tnga-unibody', 'rear-brakes-e210']
      },
      {
        id: 'tnga-unibody',
        name: 'TNGA-C Rigid Unibody Platform',
        section: 'chassis',
        subsystem: 'Chassis & Structure',
        location: 'Body Shell & Floorpan',
        purpose: 'Delivers 60% higher torsional rigidity than 11th Gen Corolla through continuous ring structures and structural adhesive application.',
        specs: 'Ultra-high-strength hot-stamped steel pillars, ring-shaped door aperture reinforcements, low center of gravity floorpan.',
        failures: 'No common structural failures; minor underbody splash shield fastener loss.',
        related: ['front-macpherson-strut', 'rear-multilink-e210']
      }
    ]
  },

  /* ------------------------------------------------------------
     BMW 3 SERIES (G20) — 2019–Present
     ------------------------------------------------------------ */
  {
    id: 'bmw-3-g20',
    manufacturer: 'BMW',
    model: '3 Series',
    generation: 'G20 (7th Gen)',
    variant: '330i / M340i Sedan',
    years: '2019–present',
    modelYears: '2019–2025',
    bodyStyle: '4-door Sedan',
    platform: 'BMW CLAR (Cluster Architecture Modular Platform)',
    layout: 'Front-Mid Longitudinal Engine, Rear-Wheel Drive (RWD) or xDrive AWD',
    curbWeight: '1,625 kg (3,582 lb)',
    wheelbase: '2,851 mm (112.2 in)',
    dimensions: '4,709 mm L × 1,827 mm W × 1,442 mm H',
    engine: {
      code: 'B48B20 TwinPower Turbo',
      type: '2.0L Inline-4, DOHC 16-valve, Twin-Scroll Turbo',
      displacement: '1,998 cc',
      aspiration: 'Twin-Scroll Turbocharger with Integrated Manifold',
      injection: 'High Precision Direct Injection (350 bar)',
      output: '255 hp (190 kW) @ 5,000–6,500 rpm',
      torque: '295 lb-ft (400 N·m) @ 1,550–4,400 rpm',
      boreStroke: '82.0 mm × 94.6 mm',
      compressionRatio: '10.2:1',
      fuelReq: 'Premium 91+ Octane Unleaded'
    },
    transmission: {
      code: 'ZF 8HP51 Steptronic Sport',
      type: '8-Speed Torque Converter Automatic with Paddle Shifters & Launch Control',
      ratios: '1st: 5.250, 2nd: 3.360, 3rd: 2.172, 4th: 1.720, 5th: 1.316, 6th: 1.000, 7th: 0.822, 8th: 0.640, Rev: 3.712'
    },
    chassis: {
      frameType: 'CLAR aluminum-steel hybrid unibody with 25% higher torsional rigidity than F30',
      frontSuspension: 'Double-joint spring strut front axle with aluminum control arms and hydraulic lift-related rebound dampers',
      rearSuspension: 'Five-link independent rear axle with lightweight stamped steel links and compression stop dampers',
      steering: 'Variable Sport Steering with electric rack-and-pinion and dual-ratio gear teeth',
      brakes: 'M Sport Brakes; Front: 348 mm ventilated discs with 4-piston fixed aluminum calipers; Rear: 345 mm discs with single-piston floating calipers'
    },
    interior: {
      infotainment: 'BMW Curved Display (14.9-inch central touch display running iDrive 8.5 with wireless Apple CarPlay/Android Auto)',
      instrumentation: '12.3-inch configurable digital instrument cluster seamlessly integrated into curved housing',
      seating: 'SensaTec/Vernasca sport seats with power adjustable side bolsters and memory',
      climate: '3-zone automatic climate control with microfilter and automatic recirculation'
    },
    safety: 'Active Driving Assistant (Frontal Collision Warning, City Collision Mitigation, Lane Departure Warning, Active Blind Spot Detection), 8 Airbags',
    supportedViews: ['chassis', 'profile', 'interior'],
    sections: ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'],
    components: [
      {
        id: 'b48-engine',
        name: 'BMW B48 2.0L TwinPower Turbo Engine',
        section: 'engine',
        subsystem: 'Powertrain',
        location: 'Front Longitudinal (Pushed Back Behind Front Axle)',
        purpose: 'Closed-deck aluminum turbo inline-4 featuring 50:50 weight balance, Valvetronic variable valve lift, and double-VANOS camshaft timing.',
        specs: 'Twin-scroll turbocharger, integrated exhaust manifold in cylinder head, water-cooled intercooler built into intake manifold.',
        failures: 'Plastic oil filter housing coolant leak; plastic turbo coolant return line becoming brittle over heat cycles.',
        related: ['zf-8hp-transmission', 'clar-chassis', 'double-joint-strut']
      },
      {
        id: 'zf-8hp-transmission',
        name: 'ZF 8HP51 8-Speed Steptronic Sport',
        section: 'drivetrain',
        subsystem: 'Transmission',
        location: 'Center Tunnel',
        purpose: 'Industry-benchmark torque-converter automatic delivering lightning-fast 200ms gear shifts and wide 8.2 ratio spread.',
        specs: 'Planetary gearsets, integrated Mechatronic valve unit, lock-up clutch with torsional vibration damper.',
        failures: 'Plastic transmission oil pan warping and leaking from gasket; mechatronic bridge seal pressure bleed-down.',
        related: ['b48-engine', 'm-sport-diff', 'propeller-shaft']
      },
      {
        id: 'double-joint-strut',
        name: 'Double-Joint Spring Strut Front Axle',
        section: 'front-suspension',
        subsystem: 'Front Suspension',
        location: 'Front Axle Left & Right',
        purpose: 'Uses two separate lower control arm links with independent ball joints to synthesize a virtual steering axis for sharp turn-in and minimal torque steer.',
        specs: 'Aluminum tension strut and wishbone, lift-related hydraulic dampers that increase damping progressively with wheel deflection.',
        failures: 'Hydraulic tension strut bushing fluid leak causing high-speed braking shudder.',
        related: ['variable-sport-steering', 'm-sport-brakes']
      },
      {
        id: 'variable-sport-steering',
        name: 'Variable Sport Steering Rack',
        section: 'steering',
        subsystem: 'Steering',
        location: 'Front Subframe',
        purpose: 'Features progressive gear tooth spacing that makes steering quicker off-center for tight parking and agile canyon carving without nervous high-speed tracking.',
        specs: 'Dual-pinion electric power steering rack with brushless motor on second pinion, variable ratio from 14.1:1 to 11.2:1.',
        failures: 'Steering rack thrust piece wear causing low-speed knocking noise over cobblestones.',
        related: ['double-joint-strut']
      },
      {
        id: 'fivelink-rear-suspension',
        name: 'Five-Link Independent Rear Suspension',
        section: 'rear-suspension',
        subsystem: 'Rear Suspension',
        location: 'Rear Subframe',
        purpose: 'Decouples longitudinal impact compliance from lateral cornering stiffness, keeping the rear tires squarely planted under hard cornering.',
        specs: 'Five individual forged and stamped steel links per side, rubber-isolated rear subframe, lift-related compression stops.',
        failures: 'Subframe bushing softening after 120k miles causing throttle-lift rear steer.',
        related: ['m-sport-diff', 'clar-chassis']
      },
      {
        id: 'm-sport-diff',
        name: 'M Sport Electronically Controlled Rear Differential',
        section: 'drivetrain',
        subsystem: 'Drivetrain',
        location: 'Rear Subframe Center',
        purpose: 'Electro-mechanically varies locking percentage from 0 to 100% via multi-plate clutch to eliminate inside wheelspin and induce playful power oversteer.',
        specs: 'Electric servo motor actuator, multi-plate wet clutch pack, hypoid final drive (2.81:1 ratio).',
        failures: 'Diff temperature sensor warning under prolonged track use; pinion seal seepage.',
        related: ['zf-8hp-transmission', 'fivelink-rear-suspension']
      }
    ]
  },

  /* ------------------------------------------------------------
     PORSCHE 911 (992) — 2019–Present
     ------------------------------------------------------------ */
  {
    id: 'porsche-911-992',
    manufacturer: 'Porsche',
    model: '911',
    generation: '992 (8th Gen)',
    variant: '911 Carrera / Carrera S',
    years: '2019–present',
    modelYears: '2019–2025',
    bodyStyle: '2-door Coupe',
    platform: 'MMB (Modular Mid/Rear-Engine Architecture, 70% Aluminum Body Shell)',
    layout: 'Rear-Hung Longitudinal Engine, Rear-Wheel Drive (RWD) or AWD',
    curbWeight: '1,505 kg (3,318 lb)',
    wheelbase: '2,450 mm (96.5 in)',
    dimensions: '4,519 mm L × 1,852 mm W × 1,298 mm H',
    engine: {
      code: 'EA9A2 3.0L Twin-Turbo Boxer-6',
      type: '3.0L Horizontally Opposed 6-Cylinder, DOHC 24-valve',
      displacement: '2,981 cc',
      aspiration: 'Symmetrical Twin Turbochargers with Larger Charge-Air Coolers',
      injection: 'Direct Fuel Injection (DFI) with Piezo Central Injectors',
      output: '379–443 hp (283–331 kW) @ 6,500 rpm',
      torque: '331–390 lb-ft (450–530 N·m) @ 1,950–5,000 rpm',
      boreStroke: '91.0 mm × 76.4 mm',
      compressionRatio: '10.2:1',
      fuelReq: 'Premium 93/91 Octane Unleaded'
    },
    transmission: {
      code: 'Porsche Doppelkupplung (8-Speed PDK)',
      type: '8-Speed Dual-Clutch Transmission with Paddle Shifters',
      ratios: '1st: 4.890, 2nd: 3.170, 3rd: 2.150, 4th: 1.560, 5th: 1.180, 6th: 0.940, 7th: 0.760, 8th: 0.610, Rev: 3.990'
    },
    chassis: {
      frameType: 'MMB lightweight aluminum-steel hybrid body structure (70% aluminum content)',
      frontSuspension: 'MacPherson strut front axle with helper springs, aluminum wishbones, and PASM active dampers',
      rearSuspension: 'Multi-link LSA rear axle with subframe mounting, PASM dampers, and optional electromechanical Rear-Axle Steering (RAS)',
      steering: 'Electromechanical power steering with variable steering ratio and active steering pulse',
      brakes: 'Front: 350 mm internally vented and cross-drilled rotors with 6-piston fixed aluminum monobloc calipers; Rear: 350 mm rotors with 4-piston calipers'
    },
    interior: {
      infotainment: '10.9-inch Porsche Communication Management (PCM) full-HD touchscreen',
      instrumentation: 'Central analog tachometer flanked by two high-resolution 7.0-inch TFT display screens',
      seating: '2+2 coupe seating with 14-way or 18-way adaptive sport seats plus, electric backrest adjustment',
      climate: '2-zone automatic climate control with active carbon filter'
    },
    safety: 'Porsche Wet Mode (acoustic water sensors in wheel wells), Warn & Brake Assist, 6 Airbags',
    supportedViews: ['chassis', 'profile', 'interior'],
    sections: ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'],
    components: [
      {
        id: 'boxer6-engine',
        name: '3.0L Twin-Turbo Flat-6 (Boxer) Engine',
        section: 'engine',
        subsystem: 'Powertrain',
        location: 'Rear Longitudinal (Hung Behind Rear Axle)',
        purpose: 'Horizontally opposed 6-cylinder layout providing ultra-low center of gravity, perfect rotational primary balance, and phenomenal rear traction on acceleration.',
        specs: 'Dry-sump lubrication with 4-stage scavenge pump, symmetrical counter-rotating turbochargers, central piezo direct injectors.',
        failures: 'Water pump vacuum changeover valve failure causing coolant temperature warnings; intercooler air duct debris buildup.',
        related: ['8speed-pdk', 'rear-suspension-992']
      },
      {
        id: '8speed-pdk',
        name: '8-Speed Porsche Doppelkupplung (PDK)',
        section: 'drivetrain',
        subsystem: 'Transmission',
        location: 'Transaxle in Front of Engine, Straddling Rear Axle',
        purpose: 'Shifts gears in milliseconds without interrupting torque flow by pre-selecting the next gear on the secondary concentric clutch shaft.',
        specs: 'Dual wet multi-plate clutches, 8 forward speeds, integrated mechanical limited-slip differential (PTV Plus with electronic control).',
        failures: 'Transmission distance sensor (PDK sensor) fault requiring mechatronic unit recalibration or sensor replacement.',
        related: ['boxer6-engine', 'ptv-plus-differential']
      },
      {
        id: 'rear-axle-steering',
        name: 'Electromechanical Rear-Axle Steering (RAS)',
        section: 'rear-suspension',
        subsystem: 'Chassis Dynamics',
        location: 'Rear Multi-Link Suspension Arms',
        purpose: 'Steers rear wheels up to 2.8°: in opposite direction to front wheels below 31 mph for tight turning circles, and in same direction above 50 mph for high-speed lane-change stability.',
        specs: 'Two electromechanical actuators replacing rear toe links, active CAN-bus controller communicating with PSM.',
        failures: 'Rear tie-rod actuator position sensor fault following rear alignment without Porsche Piwis diagnostic reset.',
        related: ['8speed-pdk', 'pasm-dampers']
      },
      {
        id: 'pasm-dampers',
        name: 'Porsche Active Suspension Management (PASM)',
        section: 'rear-suspension',
        subsystem: 'Suspension',
        location: 'All 4 Suspension Corners',
        purpose: 'Continuously adjusts damping force on each individual wheel based on road conditions and driving style to minimize pitch and body roll.',
        specs: 'Continuously variable magnetic valve dampers, 10 mm lower ride height, body acceleration sensors.',
        failures: 'PASM wiring harness chafing at front wheel arch liners.',
        related: ['rear-axle-steering', 'porsche-ceramic-brakes']
      },
      {
        id: 'front-trunk-fuel',
        name: 'Front Cargo (Frunk) & Central Fuel Cell',
        section: 'chassis',
        subsystem: 'Chassis Layout',
        location: 'Front Compartment between Front Wheels',
        purpose: 'Takes advantage of rear-engine packaging to provide 132 L luggage volume in the front nose, with lightweight fuel tank positioned ahead of firewall for optimal polar moment of inertia.',
        specs: '16.9-gallon (64 L) fuel tank (optional 23.7 gal extended range), aluminum front luggage tub, carbon cabin firewall.',
        failures: 'Electric frunk release latch actuator motor jamming.',
        related: ['boxer6-engine']
      }
    ]
  }
];

/**
 * Fast lookup map by ID
 */
export const VEHICLE_BY_ID = new Map(VEHICLE_DATABASE.map(v => [v.id, v]));

/**
 * Filter vehicles by manufacturer or search query
 */
export function searchVehicleDatabase(query) {
  if (!query) return VEHICLE_DATABASE;
  const q = query.toLowerCase().trim();
  return VEHICLE_DATABASE.filter(v => 
    v.manufacturer.toLowerCase().includes(q) ||
    v.model.toLowerCase().includes(q) ||
    v.generation.toLowerCase().includes(q) ||
    v.variant.toLowerCase().includes(q) ||
    v.years.toLowerCase().includes(q) ||
    (v.engine && v.engine.code.toLowerCase().includes(q))
  );
}
