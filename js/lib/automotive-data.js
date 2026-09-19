/**
 * Automotive Data Source Abstraction
 * Supports fetching vehicle metadata from NHTSA vPIC API
 * and generating mock interior structural data.
 */

// Popular default cars to show when no query is present
const POPULAR_MAKES = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW'];

export class AutomotiveDataClient {
  constructor() {}

  async searchVehicles(query) {
    if (!query) {
      // Default to returning a few popular models if no query
      const make = POPULAR_MAKES[Math.floor(Math.random() * POPULAR_MAKES.length)];
      return this._fetchModelsForMake(make);
    }
    
    const parts = query.trim().split(/\s+/);
    const make = parts[0];
    const modelQuery = parts.slice(1).join(' ').toLowerCase();

    const results = await this._fetchModelsForMake(make);
    if (modelQuery) {
      return results.filter(r => r.model.toLowerCase().includes(modelQuery));
    }
    return results;
  }

  async _fetchModelsForMake(make) {
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${encodeURIComponent(make)}?format=json`);
      const data = await res.json();
      let results = data.Results || [];
      
      return results.slice(0, 100).map(r => this._enrichVehicleData(r));
    } catch (e) {
      console.error('Failed to fetch NHTSA data:', e);
      return [];
    }
  }

  _enrichVehicleData(apiData) {
    return {
      id: apiData.Model_ID.toString(),
      manufacturer: apiData.Make_Name,
      model: apiData.Model_Name,
      generation: 'Standard Spec',
      years: 'Current',
      bodyStyle: 'Varies',
      drivetrain: 'Varies by trim',
      engine: 'Refer to OEM specs',
      transmission: 'Refer to OEM specs',
      diagramType: '2D',
      sections: ['Front', 'Engine Bay', 'Suspension', 'Cabin', 'Dashboard', 'Rear'],
      components: [
        { id: 'engine', name: 'Engine block / Motor', section: 'Engine Bay', description: 'Primary power unit.', coordinates: { x: 25, y: 50 } },
        { id: 'f-susp', name: 'Front Suspension', section: 'Suspension', description: 'Steering and shock absorption.', coordinates: { x: 20, y: 30 } },
        { id: 'dash', name: 'Dashboard & Infotainment', section: 'Dashboard', description: 'Central control and display.', coordinates: { x: 45, y: 50 } },
        { id: 'seats-f', name: 'Front Seats', section: 'Cabin', description: 'Driver and passenger seating.', coordinates: { x: 55, y: 50 } },
        { id: 'seats-r', name: 'Rear Seats', section: 'Cabin', description: 'Passenger seating area.', coordinates: { x: 75, y: 50 } },
        { id: 'r-susp', name: 'Rear Suspension', section: 'Suspension', description: 'Rear axle shock absorption.', coordinates: { x: 80, y: 30 } },
        { id: 'trunk', name: 'Trunk / Cargo', section: 'Rear', description: 'Rear storage area.', coordinates: { x: 90, y: 50 } }
      ]
    };
  }

  async getVehicleDetails(id) {
    return null;
  }

  async getVehicleDiagram(vehicleOrId, type = '2D') {
    return this._generatePlaceholderSVG(vehicleOrId);
  }

  _generatePlaceholderSVG(vehicle) {
    const components = (vehicle && vehicle.components) ? vehicle.components : [
      { id: 'engine', name: 'Engine block / Motor', section: 'Engine Bay', description: 'Primary power unit.', coordinates: { x: 25, y: 50 } },
      { id: 'f-susp', name: 'Front Suspension', section: 'Suspension', description: 'Steering and shock absorption.', coordinates: { x: 20, y: 30 } },
      { id: 'dash', name: 'Dashboard & Infotainment', section: 'Dashboard', description: 'Central control and display.', coordinates: { x: 45, y: 50 } },
      { id: 'seats-f', name: 'Front Seats', section: 'Cabin', description: 'Driver and passenger seating.', coordinates: { x: 55, y: 50 } },
      { id: 'seats-r', name: 'Rear Seats', section: 'Cabin', description: 'Passenger seating area.', coordinates: { x: 75, y: 50 } },
      { id: 'r-susp', name: 'Rear Suspension', section: 'Suspension', description: 'Rear axle shock absorption.', coordinates: { x: 80, y: 30 } },
      { id: 'trunk', name: 'Trunk / Cargo', section: 'Rear', description: 'Rear storage area.', coordinates: { x: 90, y: 50 } }
    ];

    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4a5568" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#2d3748" stop-opacity="0.4"/>
          </linearGradient>
        </defs>
        <!-- Abstract Vehicle Body -->
        <path d="M 10,70 L 15,45 L 35,35 L 70,35 L 85,45 L 95,70 Z" fill="url(#chassisGrad)" stroke="var(--border)" stroke-width="1.5" />
        
        <circle cx="20" cy="70" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
        <circle cx="80" cy="70" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
        <circle cx="20" cy="70" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="80" cy="70" r="3" fill="currentColor" opacity="0.5" />

        <!-- Interactive Components -->
        ${components.map(comp => `
          <g class="auto-component" data-comp-id="${comp.id}" style="cursor: pointer; outline: none;" tabindex="0">
            <circle cx="${comp.coordinates.x}" cy="${comp.coordinates.y}" r="3" fill="var(--accent, #3b82f6)" />
            <circle cx="${comp.coordinates.x}" cy="${comp.coordinates.y}" r="6" fill="transparent" stroke="var(--accent, #3b82f6)" stroke-width="0.5" opacity="0.5" />
          </g>
        `).join('')}
      </svg>
    `;
  }
}

export const autoClient = new AutomotiveDataClient();
