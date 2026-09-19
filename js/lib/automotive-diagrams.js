/**
 * Automotive Technical Blueprint Engine
 * Generates authentic, high-precision 2D technical vector SVG diagrams:
 * - Chassis & Drivetrain Plan (Top-Down X-Ray Blueprint)
 * - Structural Cutaway (Side Elevation Profile)
 * - Interior & Cockpit Architecture (Plan View)
 */

export class AutomotiveDiagramEngine {
  /**
   * Render the appropriate SVG blueprint based on vehicle specs and view mode.
   * @param {Object} vehicle - Vehicle record from automotive database
   * @param {'chassis'|'profile'|'interior'} viewMode - Requested blueprint perspective
   * @param {string|null} activeSection - Current focused section ID
   * @param {string|null} activeComponentId - Currently selected component ID
   * @returns {string} SVG markup string
   */
  static renderBlueprint(vehicle, viewMode = 'chassis', activeSection = null, activeComponentId = null) {
    if (!vehicle) return '<div class="ag-empty-diagram">No vehicle selected</div>';

    switch (viewMode) {
      case 'profile':
        return this._renderProfileCutaway(vehicle, activeSection, activeComponentId);
      case 'interior':
        return this._renderInteriorCockpit(vehicle, activeSection, activeComponentId);
      case 'chassis':
      default:
        return this._renderChassisTopDown(vehicle, activeSection, activeComponentId);
    }
  }

  /**
   * Top-Down Chassis & Mechanical Architecture Blueprint
   */
  static _renderChassisTopDown(vehicle, activeSection, activeComponentId) {
    const isTruck = vehicle.bodyStyle.toLowerCase().includes('suv') || vehicle.platform.toLowerCase().includes('ladder');
    const isRearEngine = vehicle.id.includes('porsche') || (vehicle.layout && vehicle.layout.toLowerCase().includes('rear-engine'));
    const isTransverse = vehicle.id.includes('corolla') || (vehicle.layout && vehicle.layout.toLowerCase().includes('transverse'));

    // SVG coordinate space: 1000 x 600
    return `
      <svg viewBox="0 0 1000 600" class="ag-technical-svg ag-blueprint-chassis" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="diag-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border, #2d3748)" stroke-width="0.75" opacity="0.3" />
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="var(--border, #2d3748)" stroke-width="1.2" opacity="0.4" />
          </pattern>
          <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#718096" stop-opacity="0.35" />
            <stop offset="50%" stop-color="#4a5568" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#2d3748" stop-opacity="0.4" />
          </linearGradient>
          <linearGradient id="engine-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4a5568" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#2d3748" stop-opacity="0.95" />
          </linearGradient>
          <filter id="diag-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Technical Background Blueprint Grid -->
        <rect width="1000" height="600" fill="url(#diag-grid)" />

        <!-- Dimension & Alignment Reference Lines -->
        <g class="ag-ref-lines" stroke="var(--border, #4a5568)" stroke-width="1" stroke-dasharray="6,4" opacity="0.4">
          <line x1="50" y1="300" x2="950" y2="300" /> <!-- Centerline -->
          <line x1="220" y1="50" x2="220" y2="550" /> <!-- Front Axle Line -->
          <line x1="780" y1="50" x2="780" y2="550" /> <!-- Rear Axle Line -->
        </g>

        <!-- Vehicle Body Outline Envelope -->
        <g class="ag-body-envelope" fill="none" stroke="var(--text-muted, #718096)" stroke-width="1.5" opacity="0.35">
          ${this._getBodySilhouette(vehicle, 'top')}
        </g>

        <!-- Chassis Framework (Ladder Frame vs Unibody Subframes) -->
        <g class="diag-comp ${this._compClasses('ladder-frame', 'chassis', activeSection, activeComponentId)}"
           data-comp-id="ladder-frame" data-section="chassis" tabindex="0" role="button">
          ${this._getChassisStructuralMembers(isTruck, isRearEngine, isTransverse)}
          <title>Chassis &amp; Structural Frame</title>
        </g>

        <!-- Wheels, Tires, & Wheel Hubs -->
        <g class="ag-wheels" fill="#1a202c" stroke="var(--border, #4a5568)" stroke-width="2">
          <!-- Front Left -->
          <rect x="170" y="80" width="100" height="50" rx="8" />
          <rect x="180" y="90" width="80" height="30" rx="4" fill="#2d3748" />
          <!-- Front Right -->
          <rect x="170" y="470" width="100" height="50" rx="8" />
          <rect x="180" y="480" width="80" height="30" rx="4" fill="#2d3748" />
          <!-- Rear Left -->
          <rect x="730" y="80" width="100" height="50" rx="8" />
          <rect x="740" y="90" width="80" height="30" rx="4" fill="#2d3748" />
          <!-- Rear Right -->
          <rect x="730" y="470" width="100" height="50" rx="8" />
          <rect x="740" y="480" width="80" height="30" rx="4" fill="#2d3748" />
        </g>

        <!-- Brakes (Rotors & Calipers at all 4 corners) -->
        <g class="diag-comp ${this._compClasses('front-brakes', 'brakes', activeSection, activeComponentId)}"
           data-comp-id="front-brakes" data-section="brakes" tabindex="0" role="button">
          <!-- Front Left Rotor & Caliper -->
          <rect x="195" y="130" width="50" height="12" rx="2" fill="#e2e8f0" stroke="#718096" stroke-width="1.5" />
          <path d="M 205 130 L 235 130 L 235 142 L 205 142 Z" fill="#e53e3e" stroke="#9b2c2c" stroke-width="1.2" />
          <!-- Front Right Rotor & Caliper -->
          <rect x="195" y="458" width="50" height="12" rx="2" fill="#e2e8f0" stroke="#718096" stroke-width="1.5" />
          <path d="M 205 458 L 235 458 L 235 470 L 205 470 Z" fill="#e53e3e" stroke="#9b2c2c" stroke-width="1.2" />
          <title>Front Brakes (Ventilated Rotors &amp; Multi-Piston Calipers)</title>
        </g>

        <g class="diag-comp ${this._compClasses('rear-brakes', 'brakes', activeSection, activeComponentId)}"
           data-comp-id="rear-brakes" data-section="brakes" tabindex="0" role="button">
          <!-- Rear Left Rotor & Caliper -->
          <rect x="755" y="130" width="46" height="10" rx="2" fill="#e2e8f0" stroke="#718096" stroke-width="1.5" />
          <path d="M 765 130 L 791 130 L 791 140 L 765 140 Z" fill="#e53e3e" stroke="#9b2c2c" stroke-width="1.2" />
          <!-- Rear Right Rotor & Caliper -->
          <rect x="755" y="460" width="46" height="10" rx="2" fill="#e2e8f0" stroke="#718096" stroke-width="1.5" />
          <path d="M 765 460 L 791 460 L 791 470 L 765 470 Z" fill="#e53e3e" stroke="#9b2c2c" stroke-width="1.2" />
          <title>Rear Brakes</title>
        </g>

        <!-- Front Suspension (Wishbones / Struts & Sway Bar) -->
        <g class="diag-comp ${this._compClasses('front-wishbones', 'front-suspension', activeSection, activeComponentId)}"
           data-comp-id="front-wishbones" data-section="front-suspension" tabindex="0" role="button">
          <!-- Left Suspension Links -->
          <path d="M 220 190 L 195 142 M 220 230 L 245 142" stroke="var(--accent, #3182ce)" stroke-width="5" stroke-linecap="round" fill="none" />
          <!-- Right Suspension Links -->
          <path d="M 220 410 L 195 458 M 220 370 L 245 458" stroke="var(--accent, #3182ce)" stroke-width="5" stroke-linecap="round" fill="none" />
          <!-- Anti-Roll Sway Bar -->
          <path d="M 210 145 C 190 200, 190 400, 210 455" fill="none" stroke="#2b6cb0" stroke-width="3" stroke-linecap="round" />
          <title>Front Suspension System</title>
        </g>

        <!-- Steering System (Rack & Pinion with Tie Rods) -->
        <g class="diag-comp ${this._compClasses('steering-rack', 'steering', activeSection, activeComponentId)}"
           data-comp-id="steering-rack" data-section="steering" tabindex="0" role="button">
          <!-- Central Rack Housing -->
          <rect x="235" y="240" width="30" height="120" rx="6" fill="#4a5568" stroke="#cbd5e0" stroke-width="2" />
          <!-- Tie Rods to Steering Knuckles -->
          <line x1="250" y1="240" x2="245" y2="142" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" />
          <line x1="250" y1="360" x2="245" y2="458" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" />
          <!-- Steering Column Shaft Angle -->
          <line x1="260" y1="270" x2="310" y2="240" stroke="#a0aec0" stroke-width="3.5" stroke-dasharray="4,2" />
          <title>Steering Rack &amp; Pinion with Tie Rods</title>
        </g>

        <!-- Radiator & Cooling System -->
        <g class="diag-comp ${this._compClasses('radiator-pack', 'engine', activeSection, activeComponentId)}"
           data-comp-id="radiator-pack" data-section="engine" tabindex="0" role="button">
          <rect x="${isRearEngine ? 850 : 120}" y="210" width="30" height="180" rx="4" fill="#2d3748" stroke="#4fd1c5" stroke-width="2" />
          <!-- Fan Shrouds -->
          <circle cx="${isRearEngine ? 865 : 135}" cy="260" r="28" fill="none" stroke="#81e6d9" stroke-width="1.5" />
          <circle cx="${isRearEngine ? 865 : 135}" cy="340" r="28" fill="none" stroke="#81e6d9" stroke-width="1.5" />
          <title>Engine Radiator &amp; Auxiliary Cooling Pack</title>
        </g>

        <!-- Engine Assembly (Tailored to Engine Configuration) -->
        <g class="diag-comp ${this._compClasses('v35a-engine', 'engine', activeSection, activeComponentId)}"
           data-comp-id="${this._getEngineCompId(vehicle)}" data-section="engine" tabindex="0" role="button">
          ${this._getEngineSVG(vehicle)}
          <title>${vehicle.engine ? vehicle.engine.code : 'Engine Block'}</title>
        </g>

        <!-- Transmission & Transfer Case / Transaxle -->
        <g class="diag-comp ${this._compClasses('10speed-transmission', 'drivetrain', activeSection, activeComponentId)}"
           data-comp-id="${this._getTransCompId(vehicle)}" data-section="drivetrain" tabindex="0" role="button">
          ${this._getTransmissionSVG(vehicle)}
          <title>Transmission &amp; Gearbox</title>
        </g>

        <!-- Driveshaft / Propeller Shaft (For RWD / 4WD vehicles) -->
        ${!isTransverse && !isRearEngine ? `
          <g class="diag-comp ${this._compClasses('center-driveshaft', 'drivetrain', activeSection, activeComponentId)}"
             data-comp-id="center-driveshaft" data-section="drivetrain" tabindex="0" role="button">
            <!-- Driveshaft Tube -->
            <line x1="430" y1="300" x2="750" y2="300" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" />
            <!-- Center Universal Joint & Support Bearing -->
            <circle cx="580" cy="300" r="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
            <title>Driveshaft &amp; Center Bearing</title>
          </g>
        ` : ''}

        <!-- Fuel Tank & Delivery Lines -->
        <g class="diag-comp ${this._compClasses('fuel-tank', 'exhaust-fuel', activeSection, activeComponentId)}"
           data-comp-id="fuel-tank" data-section="exhaust-fuel" tabindex="0" role="button">
          ${isRearEngine ? `
            <!-- Front-mounted fuel tank in 911 frunk area -->
            <rect x="250" y="240" width="80" height="120" rx="12" fill="#285e61" stroke="#319795" stroke-width="2" opacity="0.85" />
          ` : `
            <!-- Mid/Rear saddle tank under floorpan -->
            <rect x="540" y="190" width="130" height="95" rx="14" fill="#285e61" stroke="#319795" stroke-width="2" opacity="0.85" />
          `}
          <!-- In-tank pump ring -->
          <circle cx="${isRearEngine ? 290 : 605}" cy="${isRearEngine ? 300 : 237}" r="15" fill="#234e52" stroke="#4fd1c5" stroke-width="1.5" />
          <title>Fuel Tank &amp; High-Flow Pump</title>
        </g>

        <!-- Exhaust System (Manifold, Cats, Resonator, Muffler, Tips) -->
        <g class="diag-comp ${this._compClasses('exhaust-system', 'exhaust-fuel', activeSection, activeComponentId)}"
           data-comp-id="exhaust-system" data-section="exhaust-fuel" tabindex="0" role="button">
          ${this._getExhaustSVG(vehicle)}
          <title>Exhaust System &amp; Catalytic Converters</title>
        </g>

        <!-- Rear Suspension & Differential Assembly -->
        <g class="diag-comp ${this._compClasses('rear-rigid-axle', 'rear-suspension', activeSection, activeComponentId)}"
           data-comp-id="${this._getRearSuspCompId(vehicle)}" data-section="rear-suspension" tabindex="0" role="button">
          ${this._getRearSuspensionSVG(vehicle)}
          <title>Rear Suspension &amp; Differential</title>
        </g>

        <!-- Component Pin Callout Markers -->
        <g class="ag-component-markers">
          ${this._renderComponentHotspots(vehicle, 'chassis', activeComponentId)}
        </g>
      </svg>
    `;
  }

  /**
   * Profile Elevation / Structural Cutaway Blueprint
   */
  static _renderProfileCutaway(vehicle, activeSection, activeComponentId) {
    const isTruck = vehicle.bodyStyle.toLowerCase().includes('suv') || vehicle.platform.toLowerCase().includes('ladder');
    const isCoupe = vehicle.bodyStyle.toLowerCase().includes('coupe') || vehicle.id.includes('porsche');

    return `
      <svg viewBox="0 0 1000 500" class="ag-technical-svg ag-blueprint-profile" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="diag-grid-p" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border, #2d3748)" stroke-width="0.75" opacity="0.3" />
          </pattern>
        </defs>

        <rect width="1000" height="500" fill="url(#diag-grid-p)" />

        <!-- Ground Plane Line -->
        <line x1="50" y1="420" x2="950" y2="420" stroke="var(--border, #4a5568)" stroke-width="2" />

        <!-- Profile Wheel Assemblies -->
        <g class="ag-wheels-profile">
          <!-- Front Wheel -->
          <circle cx="230" cy="380" r="60" fill="#1a202c" stroke="var(--border, #718096)" stroke-width="4" />
          <circle cx="230" cy="380" r="42" fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
          <circle cx="230" cy="380" r="14" fill="#a0aec0" />
          <!-- Rear Wheel -->
          <circle cx="770" cy="380" r="60" fill="#1a202c" stroke="var(--border, #718096)" stroke-width="4" />
          <circle cx="770" cy="380" r="42" fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
          <circle cx="770" cy="380" r="14" fill="#a0aec0" />
        </g>

        <!-- Body Silhouette & Glass Area -->
        <g class="ag-body-profile" fill="none" stroke="var(--accent, #3182ce)" stroke-width="2" opacity="0.7">
          ${this._getProfileSilhouette(vehicle, isTruck, isCoupe)}
        </g>

        <!-- Structural Safety Cage & Pillars (A, B, C, D Pillars) -->
        <g class="diag-comp ${this._compClasses('safety-cage', 'chassis', activeSection, activeComponentId)}"
           data-comp-id="ladder-frame" data-section="chassis" tabindex="0" role="button">
          ${this._getStructuralPillars(isTruck, isCoupe)}
          <title>Structural Safety Cage (Pillars &amp; Roof Rails)</title>
        </g>

        <!-- Cabin Seating Profile & Steering Wheel -->
        <g class="diag-comp ${this._compClasses('front-seats', 'cabin', activeSection, activeComponentId)}"
           data-comp-id="front-seats" data-section="cabin" tabindex="0" role="button">
          <!-- Front Driver Seat Silhouette -->
          <path d="M 400 370 L 450 370 L 465 270 Q 470 230 460 210 L 440 210 Q 445 235 440 270 L 420 350 Z"
                fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
          <ellipse cx="452" cy="190" rx="14" ry="18" fill="#4a5568" stroke="#cbd5e0" stroke-width="1.5" />
          <!-- Steering Wheel & Column -->
          <line x1="360" y1="320" x2="385" y2="280" stroke="#718096" stroke-width="5" stroke-linecap="round" />
          <line x1="375" y1="260" x2="395" y2="300" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" />
          <!-- Rear Seat (if applicable) -->
          ${!isCoupe ? `
            <path d="M 580 370 L 630 370 L 645 270 Q 650 230 640 215 L 620 215 Q 625 240 620 270 L 600 350 Z"
                  fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
            <ellipse cx="632" cy="195" rx="13" ry="16" fill="#4a5568" stroke="#cbd5e0" stroke-width="1.5" />
          ` : ''}
          <title>Cabin Seating Architecture</title>
        </g>

        <!-- Powertrain Cutaway Profile Position -->
        <g class="diag-comp ${this._compClasses('v35a-engine', 'engine', activeSection, activeComponentId)}"
           data-comp-id="${this._getEngineCompId(vehicle)}" data-section="engine" tabindex="0" role="button">
          ${isCoupe ? `
            <!-- Rear Engine Location (Behind Rear Axle) -->
            <rect x="800" y="300" width="110" height="90" rx="8" fill="#4a5568" stroke="#ed8936" stroke-width="2.5" />
            <text x="855" y="350" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">BOXER 6</text>
          ` : `
            <!-- Front Engine Location -->
            <rect x="150" y="280" width="120" height="90" rx="8" fill="#4a5568" stroke="#ed8936" stroke-width="2.5" />
            <text x="210" y="330" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">ENGINE</text>
          `}
          <title>Powertrain Location</title>
        </g>

        <!-- Profile Hotspots -->
        <g class="ag-component-markers">
          ${this._renderComponentHotspots(vehicle, 'profile', activeComponentId)}
        </g>
      </svg>
    `;
  }

  /**
   * Interior Cockpit Architecture Blueprint
   */
  static _renderInteriorCockpit(vehicle, activeSection, activeComponentId) {
    const isTruck = vehicle.bodyStyle.toLowerCase().includes('suv') || vehicle.platform.toLowerCase().includes('ladder');

    return `
      <svg viewBox="0 0 1000 600" class="ag-technical-svg ag-blueprint-interior" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="diag-grid-i" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border, #2d3748)" stroke-width="0.75" opacity="0.3" />
          </pattern>
        </defs>

        <rect width="1000" height="600" fill="url(#diag-grid-i)" />

        <!-- Interior Cockpit Perimeter / Door Sills -->
        <path d="M 150 120 L 850 120 Q 920 120 920 190 L 920 410 Q 920 480 850 480 L 150 480 Q 80 480 80 410 L 80 190 Q 80 120 150 120 Z"
              fill="#1a202c" stroke="var(--border, #4a5568)" stroke-width="3" />

        <!-- Dashboard Cowl & Fascia -->
        <g class="diag-comp ${this._compClasses('lexus-interface', 'cockpit', activeSection, activeComponentId)}"
           data-comp-id="lexus-interface" data-section="cockpit" tabindex="0" role="button">
          <!-- Main Dashboard Arch -->
          <path d="M 120 160 L 320 160 Q 360 200 360 260 L 360 340 Q 360 400 320 440 L 120 440 Z"
                fill="#2d3748" stroke="#4a5568" stroke-width="2" />
          
          <!-- Central Touchscreen Display -->
          <rect x="250" y="240" width="45" height="120" rx="4" fill="#3182ce" stroke="#90cdf4" stroke-width="2" />
          <text x="272" y="305" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(90 272 305)">DISPLAY</text>

          <!-- Instrument Gauge Cluster (In front of Driver) -->
          <rect x="160" y="170" width="30" height="90" rx="4" fill="#171923" stroke="#cbd5e0" stroke-width="1.5" />
          <line x1="175" y1="185" x2="175" y2="245" stroke="#48bb78" stroke-width="2" />

          <!-- Multifunction Steering Wheel -->
          <circle cx="210" cy="215" r="34" fill="none" stroke="#e2e8f0" stroke-width="5" />
          <circle cx="210" cy="215" r="14" fill="#4a5568" stroke="#cbd5e0" stroke-width="2" />
          <line x1="176" y1="215" x2="244" y2="215" stroke="#cbd5e0" stroke-width="3" />
          <line x1="210" y1="215" x2="210" y2="249" stroke="#cbd5e0" stroke-width="3" />

          <!-- Center Console / Shifter Unit -->
          <rect x="360" y="265" width="160" height="70" rx="8" fill="#2d3748" stroke="#4a5568" stroke-width="2" />
          <circle cx="410" cy="300" r="12" fill="#e2e8f0" stroke="#718096" stroke-width="2" /> <!-- Shifter -->
          <rect x="440" y="280" width="30" height="40" rx="4" fill="#1a202c" /> <!-- Cup Holders -->
          <title>Cockpit &amp; Instrument Control Architecture</title>
        </g>

        <!-- Driver & Front Passenger Bucket Seats -->
        <g class="diag-comp ${this._compClasses('front-seats', 'cabin', activeSection, activeComponentId)}"
           data-comp-id="front-seats" data-section="cabin" tabindex="0" role="button">
          <!-- Driver Seat (Left Hand Drive) -->
          <g transform="translate(280, 160)">
            <rect x="0" y="0" width="90" height="90" rx="12" fill="#2b6cb0" stroke="#cbd5e0" stroke-width="2" />
            <rect x="90" y="10" width="35" height="70" rx="8" fill="#2c5282" stroke="#cbd5e0" stroke-width="1.5" />
            <rect x="125" y="25" width="20" height="40" rx="6" fill="#1a365d" />
            <text x="45" y="50" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">DRIVER</text>
          </g>

          <!-- Passenger Seat -->
          <g transform="translate(280, 350)">
            <rect x="0" y="0" width="90" height="90" rx="12" fill="#2b6cb0" stroke="#cbd5e0" stroke-width="2" />
            <rect x="90" y="10" width="35" height="70" rx="8" fill="#2c5282" stroke="#cbd5e0" stroke-width="1.5" />
            <rect x="125" y="25" width="20" height="40" rx="6" fill="#1a365d" />
            <text x="45" y="50" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">PASSENGER</text>
          </g>
          <title>Front Ergonomic Seating</title>
        </g>

        <!-- Rear Seating Row -->
        <g class="diag-comp ${this._compClasses('rear-seats', 'cabin', activeSection, activeComponentId)}"
           data-comp-id="front-seats" data-section="cabin" tabindex="0" role="button">
          <g transform="translate(540, 150)">
            <rect x="0" y="0" width="85" height="300" rx="12" fill="#2c5282" stroke="#cbd5e0" stroke-width="2" />
            <rect x="85" y="10" width="35" height="280" rx="8" fill="#1a365d" stroke="#cbd5e0" stroke-width="1.5" />
            <text x="42" y="155" fill="#fff" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(90 42 155)">2ND ROW BENCH</text>
          </g>
          <title>Rear Passenger Seating</title>
        </g>

        <!-- 3rd Row Seating (Lexus GX and 3-row SUVs) -->
        ${isTruck ? `
          <g transform="translate(710, 170)">
            <rect x="0" y="0" width="70" height="260" rx="10" fill="#2a4365" stroke="#a0aec0" stroke-width="1.5" stroke-dasharray="4,2" />
            <text x="35" y="135" fill="#cbd5e0" font-size="10" font-weight="600" text-anchor="middle" transform="rotate(90 35 135)">3RD ROW (FOLDABLE)</text>
          </g>
        ` : ''}

        <!-- Side Curtain Airbag Deployment Zones -->
        <g class="ag-airbags" stroke="#e53e3e" stroke-width="2" stroke-dasharray="4,4" fill="none" opacity="0.6">
          <rect x="250" y="130" width="550" height="15" rx="6" />
          <rect x="250" y="455" width="550" height="15" rx="6" />
        </g>

        <!-- Interior Hotspots -->
        <g class="ag-component-markers">
          ${this._renderComponentHotspots(vehicle, 'interior', activeComponentId)}
        </g>
      </svg>
    `;
  }

  /* ------------------------------------------------------------
     HELPER METHODS & PARAMETRIC GEOMETRY
     ------------------------------------------------------------ */

  static _compClasses(compId, section, activeSection, activeComponentId) {
    const classes = [];
    if (activeSection && activeSection === section) classes.push('is-section-focused');
    if (activeComponentId && activeComponentId === compId) classes.push('is-active');
    return classes.join(' ');
  }

  static _getEngineCompId(vehicle) {
    if (vehicle.id.includes('gx-550')) return 'v35a-engine';
    if (vehicle.id.includes('gx-460')) return '1ur-engine';
    if (vehicle.id.includes('corolla')) return 'm20a-engine';
    if (vehicle.id.includes('bmw')) return 'b48-engine';
    if (vehicle.id.includes('porsche')) return 'boxer6-engine';
    return 'engine';
  }

  static _getTransCompId(vehicle) {
    if (vehicle.id.includes('gx-550')) return '10speed-transmission';
    if (vehicle.id.includes('gx-460')) return '6speed-transmission';
    if (vehicle.id.includes('corolla')) return 'dynamic-shift-cvt';
    if (vehicle.id.includes('bmw')) return 'zf-8hp-transmission';
    if (vehicle.id.includes('porsche')) return '8speed-pdk';
    return 'transmission';
  }

  static _getRearSuspCompId(vehicle) {
    if (vehicle.id.includes('gx-550')) return 'rear-rigid-axle';
    if (vehicle.id.includes('gx-460')) return 'rear-rigid-axle-j150';
    if (vehicle.id.includes('corolla')) return 'rear-multilink-e210';
    if (vehicle.id.includes('bmw')) return 'fivelink-rear-suspension';
    if (vehicle.id.includes('porsche')) return 'rear-axle-steering';
    return 'rear-suspension';
  }

  static _getBodySilhouette(vehicle, view) {
    if (vehicle.id.includes('porsche')) {
      // Sleek teardrop coupe
      return `
        <path d="M 80 300 Q 80 200 180 160 Q 350 140 550 140 Q 750 150 880 220 Q 920 260 920 300 Q 920 340 880 380 Q 750 450 550 460 Q 350 460 180 440 Q 80 400 80 300 Z" />
      `;
    }
    if (vehicle.bodyStyle.toLowerCase().includes('suv') || vehicle.platform.toLowerCase().includes('ladder')) {
      // Robust squared off SUV perimeter
      return `
        <path d="M 70 300 L 80 200 Q 90 150 150 140 L 840 140 Q 900 140 920 190 L 930 300 L 920 410 Q 900 460 840 460 L 150 460 Q 90 450 80 400 Z" />
      `;
    }
    // Executive sports sedan
    return `
      <path d="M 70 300 Q 80 200 160 155 Q 350 145 550 145 Q 750 145 840 165 Q 920 210 930 300 Q 920 390 840 435 Q 750 455 550 455 Q 350 455 160 445 Q 80 400 70 300 Z" />
    `;
  }

  static _getChassisStructuralMembers(isTruck, isRearEngine, isTransverse) {
    if (isTruck) {
      // Heavy-duty Boxed Ladder Frame Side Rails & Crossmembers
      return `
        <!-- Left Longitudinal Rail -->
        <rect x="120" y="180" width="760" height="24" rx="4" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Right Longitudinal Rail -->
        <rect x="120" y="396" width="760" height="24" rx="4" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Front Crossmember -->
        <rect x="150" y="180" width="28" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Engine Sub-Crossmember -->
        <rect x="270" y="180" width="24" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Transmission Crossmember -->
        <rect x="420" y="180" width="30" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Mid Crossmember -->
        <rect x="580" y="180" width="22" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Rear Axle Arch Crossmember -->
        <rect x="740" y="180" width="26" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
        <!-- Rear Bumper Beam Crossmember -->
        <rect x="860" y="180" width="24" height="240" fill="url(#metal-grad)" stroke="#cbd5e0" stroke-width="2" />
      `;
    }
    // High-Rigidity Monocoque Subframes
    return `
      <!-- Front Perimeter Subframe Cradle -->
      <path d="M 150 200 L 300 200 L 300 400 L 150 400 Z" fill="url(#metal-grad)" stroke="#a0aec0" stroke-width="2" />
      <!-- Floorpan Center Tunnel -->
      <rect x="300" y="275" width="440" height="50" fill="none" stroke="#718096" stroke-width="2" stroke-dasharray="8,4" />
      <!-- Rear Multi-Link Subframe -->
      <path d="M 720 200 L 840 200 L 840 400 L 720 400 Z" fill="url(#metal-grad)" stroke="#a0aec0" stroke-width="2" />
    `;
  }

  static _getEngineSVG(vehicle) {
    if (vehicle.id.includes('porsche')) {
      // Rear Flat-6 Boxer Engine
      return `
        <g transform="translate(800, 235)">
          <rect x="0" y="0" width="95" height="130" rx="8" fill="url(#engine-grad)" stroke="#ed8936" stroke-width="2.5" />
          <!-- Opposed Cylinders (Left & Right Banks) -->
          <rect x="-20" y="20" width="25" height="90" rx="4" fill="#4a5568" stroke="#cbd5e0" stroke-width="1.5" />
          <rect x="90" y="20" width="25" height="90" rx="4" fill="#4a5568" stroke="#cbd5e0" stroke-width="1.5" />
          <!-- Twin Turbochargers -->
          <circle cx="-15" cy="15" r="14" fill="#718096" stroke="#ed8936" stroke-width="2" />
          <circle cx="-15" cy="115" r="14" fill="#718096" stroke="#ed8936" stroke-width="2" />
          <text x="47" y="70" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">FLAT 6</text>
        </g>
      `;
    }
    if (vehicle.id.includes('corolla')) {
      // Transverse Inline-4
      return `
        <g transform="translate(180, 240)">
          <rect x="0" y="0" width="110" height="65" rx="8" fill="url(#engine-grad)" stroke="#ed8936" stroke-width="2.5" />
          <!-- 4 Inline Cylinders -->
          <circle cx="20" cy="32" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <circle cx="45" cy="32" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <circle cx="70" cy="32" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <circle cx="95" cy="32" r="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <text x="55" y="58" fill="#fff" font-size="10" font-weight="700" text-anchor="middle">I4 DYNAMIC FORCE</text>
        </g>
      `;
    }
    if (vehicle.id.includes('gx-460')) {
      // V8 90-degree Engine
      return `
        <g transform="translate(180, 230)">
          <rect x="0" y="0" width="130" height="140" rx="10" fill="url(#engine-grad)" stroke="#ed8936" stroke-width="2.5" />
          <!-- 8 Cylinders (V-Bank) -->
          <ellipse cx="35" cy="35" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="65" cy="35" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="95" cy="35" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="125" cy="35" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="35" cy="105" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="65" cy="105" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="95" cy="105" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <ellipse cx="125" cy="105" rx="12" ry="12" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
          <!-- Intake Plenum Center -->
          <rect x="25" y="58" width="90" height="24" rx="4" fill="#1a202c" stroke="#a0aec0" stroke-width="1.2" />
          <text x="70" y="74" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">1UR-FE V8</text>
        </g>
      `;
    }
    // V6 Twin-Turbo (Lexus GX 550) or Inline-4 Longitudinal (BMW 3)
    return `
      <g transform="translate(180, 235)">
        <rect x="0" y="0" width="125" height="130" rx="10" fill="url(#engine-grad)" stroke="#ed8936" stroke-width="2.5" />
        <!-- V6 Cylinder Banks -->
        <circle cx="35" cy="35" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <circle cx="70" cy="35" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <circle cx="105" cy="35" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <circle cx="35" cy="95" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <circle cx="70" cy="95" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <circle cx="105" cy="95" r="13" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <!-- Turbochargers on Flanks -->
        <circle cx="65" cy="5" r="13" fill="#718096" stroke="#e2e8f0" stroke-width="2" />
        <circle cx="65" cy="125" r="13" fill="#718096" stroke="#e2e8f0" stroke-width="2" />
        <text x="62" y="70" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">${vehicle.engine ? vehicle.engine.code : 'V6 TWIN TURBO'}</text>
      </g>
    `;
  }

  static _getTransmissionSVG(vehicle) {
    if (vehicle.id.includes('porsche')) {
      // 8-Speed PDK Transaxle Forward of Engine
      return `
        <g transform="translate(710, 260)">
          <path d="M 0 10 L 80 0 L 80 80 L 0 70 Z" fill="#4a5568" stroke="#9f7aea" stroke-width="2" />
          <text x="40" y="45" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">8-PDK</text>
        </g>
      `;
    }
    if (vehicle.id.includes('corolla')) {
      // Transverse Dynamic-Shift CVT Transaxle
      return `
        <g transform="translate(180, 310)">
          <rect x="0" y="0" width="110" height="70" rx="8" fill="#4a5568" stroke="#9f7aea" stroke-width="2" />
          <line x1="20" y1="35" x2="90" y2="35" stroke="#cbd5e0" stroke-width="3" />
          <text x="55" y="48" fill="#fff" font-size="10" font-weight="700" text-anchor="middle">CVT K120</text>
        </g>
      `;
    }
    // Longitudinal 8/10-Speed Transmission
    return `
      <g transform="translate(310, 260)">
        <!-- Bellhousing -->
        <path d="M 0 0 L 25 15 L 25 65 L 0 80 Z" fill="#2d3748" stroke="#cbd5e0" stroke-width="1.5" />
        <!-- Gearbox Case -->
        <rect x="25" y="15" width="100" height="50" rx="6" fill="#4a5568" stroke="#9f7aea" stroke-width="2" />
        <text x="75" y="45" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">${vehicle.id.includes('gx-550') ? '10-SPEED' : '8-SPEED'}</text>
      </g>
    `;
  }

  static _getExhaustSVG(vehicle) {
    if (vehicle.id.includes('porsche')) {
      // Short Rear Boxer Exhaust System
      return `
        <g stroke="#cbd5e0" stroke-width="3" fill="none">
          <path d="M 800 240 L 780 230 L 780 270 L 910 270" />
          <path d="M 800 360 L 780 370 L 780 330 L 910 330" />
          <!-- Rear Transverse Muffler -->
          <rect x="880" y="250" width="35" height="100" rx="6" fill="#2d3748" stroke="#a0aec0" stroke-width="2" />
          <!-- Tailpipes -->
          <line x1="915" y1="270" x2="935" y2="270" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round" />
          <line x1="915" y1="330" x2="935" y2="330" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round" />
        </g>
      `;
    }
    // Front-to-Back Longitudinal Exhaust System
    return `
      <g stroke="#cbd5e0" stroke-width="3.5" fill="none">
        <!-- Downpipes from Engine -->
        <path d="M 280 260 L 330 245 L 360 245" />
        <path d="M 280 340 L 330 355 L 360 355" />
        <!-- Dual Catalytic Converters -->
        <rect x="360" y="235" width="40" height="20" rx="4" fill="#d69e2e" stroke="#b7791f" stroke-width="1.5" />
        <rect x="360" y="345" width="40" height="20" rx="4" fill="#d69e2e" stroke="#b7791f" stroke-width="1.5" />
        <!-- Mid Pipes Converging to Resonator -->
        <path d="M 400 245 L 480 280 L 520 280" />
        <path d="M 400 355 L 480 320 L 520 320" />
        <!-- Center Resonator -->
        <rect x="520" y="270" width="70" height="60" rx="8" fill="#4a5568" stroke="#a0aec0" stroke-width="2" />
        <!-- Exhaust Pipe Over Rear Axle -->
        <path d="M 590 300 L 710 300 Q 750 300 760 330 L 800 330" />
        <!-- Rear Muffler -->
        <rect x="800" y="280" width="85" height="75" rx="10" fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
        <!-- Dual Exhaust Tips Out Back -->
        <line x1="885" y1="300" x2="915" y2="300" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round" />
        <line x1="885" y1="335" x2="915" y2="335" stroke="#e2e8f0" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  }

  static _getRearSuspensionSVG(vehicle) {
    const isTruck = vehicle.bodyStyle.toLowerCase().includes('suv') || vehicle.platform.toLowerCase().includes('ladder');

    if (isTruck) {
      // Solid Rigid Rear Live Axle with Differential Housing
      return `
        <!-- Solid Axle Tube -->
        <line x1="780" y1="130" x2="780" y2="470" stroke="#4a5568" stroke-width="18" stroke-linecap="round" />
        <!-- Center Differential Pumpkin -->
        <circle cx="780" cy="300" r="34" fill="#2d3748" stroke="#cbd5e0" stroke-width="2.5" />
        <circle cx="780" cy="300" r="18" fill="#1a202c" />
        <!-- Lateral Panhard Rod -->
        <line x1="760" y1="160" x2="800" y2="420" stroke="#3182ce" stroke-width="4.5" stroke-linecap="round" />
        <!-- Trailing Control Arms -->
        <line x1="660" y1="180" x2="770" y2="180" stroke="#2b6cb0" stroke-width="5" stroke-linecap="round" />
        <line x1="660" y1="420" x2="770" y2="420" stroke="#2b6cb0" stroke-width="5" stroke-linecap="round" />
      `;
    }
    // Independent Multi-Link Rear Axle
    return `
      <!-- Center Rear Differential (If AWD/RWD) -->
      <rect x="755" y="275" width="50" height="50" rx="8" fill="#2d3748" stroke="#cbd5e0" stroke-width="2" />
      <!-- Half-shafts (CV Axles) to Hubs -->
      <line x1="780" y1="275" x2="780" y2="135" stroke="#a0aec0" stroke-width="8" stroke-linecap="round" />
      <line x1="780" y1="325" x2="780" y2="465" stroke="#a0aec0" stroke-width="8" stroke-linecap="round" />
      <!-- Multi-Link Control Arms -->
      <path d="M 730 220 L 775 140 M 795 220 L 775 140" stroke="#3182ce" stroke-width="4.5" stroke-linecap="round" />
      <path d="M 730 380 L 775 460 M 795 380 L 775 460" stroke="#3182ce" stroke-width="4.5" stroke-linecap="round" />
    `;
  }

  static _getProfileSilhouette(vehicle, isTruck, isCoupe) {
    if (isCoupe) {
      // Classic 911 Coupe Flyline
      return `
        <path d="M 100 380 L 120 370 Q 180 365 240 330 L 380 270 Q 520 180 620 180 Q 750 180 840 260 Q 900 320 920 380 Z" />
      `;
    }
    if (isTruck) {
      // Upright Boxy SUV Silhouette
      return `
        <path d="M 90 380 L 110 320 L 240 310 L 330 200 L 820 200 L 860 380 Z" />
      `;
    }
    // Aerodynamic Sedan Silhouette
    return `
      <path d="M 90 380 L 120 340 L 260 320 L 380 215 L 680 215 L 820 320 L 880 380 Z" />
    `;
  }

  static _getStructuralPillars(isTruck, isCoupe) {
    if (isTruck) {
      // High-Strength A, B, C, D Pillars
      return `
        <!-- A-Pillar -->
        <line x1="250" y1="310" x2="330" y2="200" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
        <!-- B-Pillar -->
        <line x1="490" y1="370" x2="490" y2="200" stroke="#e53e3e" stroke-width="7" stroke-linecap="round" />
        <!-- C-Pillar -->
        <line x1="680" y1="370" x2="680" y2="200" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
        <!-- D-Pillar -->
        <line x1="820" y1="360" x2="820" y2="200" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
        <!-- Roof Rail -->
        <line x1="330" y1="200" x2="820" y2="200" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
      `;
    }
    // A, B, C Pillars for Sedan / Coupe
    return `
      <!-- A-Pillar -->
      <line x1="270" y1="320" x2="380" y2="215" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
      <!-- B-Pillar -->
      <line x1="530" y1="370" x2="530" y2="215" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
      <!-- C-Pillar -->
      <line x1="680" y1="215" x2="810" y2="320" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
      <!-- Roof Rail -->
      <line x1="380" y1="215" x2="680" y2="215" stroke="#e53e3e" stroke-width="6" stroke-linecap="round" />
    `;
  }

  static _renderComponentHotspots(vehicle, view, activeComponentId) {
    // Return interactive glowing pulsing pin markers for direct selection
    const components = vehicle.components || [];
    return components.map((c, idx) => {
      // Calculate sensible anchor points based on component ID and current view
      const pt = this._getComponentHotspotCoords(c.id, view, vehicle);
      if (!pt) return '';

      const isSelected = activeComponentId === c.id;
      return `
        <g class="ag-pin ${isSelected ? 'is-selected' : ''}" data-comp-id="${c.id}" transform="translate(${pt.x}, ${pt.y})">
          <circle cx="0" cy="0" r="${isSelected ? 8 : 5}" class="ag-pin-core" />
          <circle cx="0" cy="0" r="${isSelected ? 16 : 10}" class="ag-pin-ring" />
          <text x="12" y="4" class="ag-pin-label">${c.name.split(' ')[0]}</text>
        </g>
      `;
    }).join('');
  }

  static _getComponentHotspotCoords(compId, view, vehicle) {
    if (view === 'chassis') {
      switch (compId) {
        case 'v35a-engine':
        case '1ur-engine':
        case 'b48-engine':
        case 'm20a-engine':
          return { x: 240, y: 300 };
        case 'boxer6-engine':
          return { x: 840, y: 300 };
        case '10speed-transmission':
        case '6speed-transmission':
        case 'zf-8hp-transmission':
        case 'dynamic-shift-cvt':
          return { x: 370, y: 300 };
        case '8speed-pdk':
          return { x: 740, y: 300 };
        case 'front-wishbones':
        case 'front-macpherson-strut':
        case 'double-joint-strut':
          return { x: 220, y: 200 };
        case 'steering-rack':
        case 'hydraulic-steering-rack':
        case 'variable-sport-steering':
          return { x: 250, y: 300 };
        case 'front-brakes':
          return { x: 220, y: 140 };
        case 'rear-brakes':
          return { x: 780, y: 140 };
        case 'rear-rigid-axle':
        case 'rear-rigid-axle-j150':
        case 'rear-multilink-e210':
        case 'fivelink-rear-suspension':
        case 'rear-axle-steering':
          return { x: 780, y: 300 };
        case 'exhaust-system':
          return { x: 550, y: 300 };
        case 'fuel-tank':
          return { x: 600, y: 230 };
        case 'ladder-frame':
        case 'tnga-unibody':
        case 'clar-chassis':
          return { x: 500, y: 190 };
        case 'lexus-interface':
          return { x: 420, y: 300 };
        case 'front-seats':
          return { x: 480, y: 230 };
        default:
          return null;
      }
    } else if (view === 'profile') {
      switch (compId) {
        case 'v35a-engine':
        case '1ur-engine':
        case 'b48-engine':
        case 'm20a-engine':
          return { x: 210, y: 330 };
        case 'boxer6-engine':
          return { x: 855, y: 350 };
        case 'front-seats':
          return { x: 450, y: 290 };
        case 'ladder-frame':
          return { x: 500, y: 390 };
        case 'front-brakes':
          return { x: 230, y: 380 };
        case 'rear-brakes':
          return { x: 770, y: 380 };
        default:
          return null;
      }
    } else { // interior view
      switch (compId) {
        case 'lexus-interface':
          return { x: 270, y: 300 };
        case 'front-seats':
          return { x: 330, y: 210 };
        default:
          return null;
      }
    }
  }
}
