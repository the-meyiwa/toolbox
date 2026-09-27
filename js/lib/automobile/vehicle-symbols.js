/* ============================================================
   Vehicle symbols — simplified ISO 2575 style pictograms

   Each entry is SVG markup in a 24 × 24 box, drawn with
   currentColor strokes (fills where the real symbol is solid), so a
   symbol can sit on a switch, a warning lamp or a list row and take
   the colour of its context.
   ============================================================ */

const car = '<path d="M4 15v-3l2-4.5h12L20 12v3"/><path d="M3.5 15h17v2.5h-17z"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>';

export const SYMBOLS = {
  /* ---- doors, windows, locks ---- */
  'window-up': '<path d="M5 20V9l6-5h8v16z"/><path d="M12 16V9"/><path d="m9.5 11.5 2.5-2.5 2.5 2.5"/>',
  'window-down': '<path d="M5 20V9l6-5h8v16z"/><path d="M12 9v7"/><path d="m9.5 13.5 2.5 2.5 2.5-2.5"/>',
  'window-updown': '<path d="M5 20V9l6-5h8v16z"/><path d="M12 8.5v8"/><path d="m10 10.5 2-2 2 2M10 14.5l2 2 2-2"/>',
  'window-lock': '<path d="M4 20V9l6-5h9v16z"/><rect x="9" y="12" width="6" height="5" rx="1"/><path d="M10.2 12v-1.6a1.8 1.8 0 0 1 3.6 0V12"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  unlock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2"/>',
  'door-open': `${car}<path d="M9 8.5 12.5 4"/>`,
  trunk: '<path d="M3.5 15h17v2.5h-17z"/><path d="M4 15v-3l2-4.5h8L20 12"/><path d="M20 12 22 6.5"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>',
  hood: '<path d="M3.5 15h17v2.5h-17z"/><path d="M20 15v-3l-2-4.5H10"/><path d="M4 12 2.2 6.5"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>',
  'fuel-door': '<rect x="4" y="5" width="9" height="15" rx="1"/><path d="M4 10h9"/><path d="M13 9h2.5l1.5 2v6.5a1.5 1.5 0 0 0 3 0V8l-2-2.5"/>',
  mirror: '<path d="M4 8.5c0-2 1.5-3.5 3.5-3.5h9c2 0 3.5 1.5 3.5 3.5V13c0 2-1.5 3.5-3.5 3.5h-9C5.5 16.5 4 15 4 13z"/><path d="M12 16.5V20M9 20h6"/>',
  'mirror-lr': '<text x="12" y="16" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" stroke="none">L · R</text>',
  arrows4: '<path d="M12 4v16M4 12h16"/><path d="m9.5 6.5 2.5-2.5 2.5 2.5M9.5 17.5l2.5 2.5 2.5-2.5M6.5 9.5 4 12l2.5 2.5M17.5 9.5 20 12l-2.5 2.5"/>',
  seat: '<path d="M8 4.5c1.5 0 2 1 2 2.5l-.5 7h7l1.5 5"/><path d="M7 14.5h9"/>',
  'seat-slide': '<path d="M9 4.5c1.3 0 1.8.9 1.8 2.2l-.4 6.3h5.6l1.2 3.5"/><path d="M8 13h8"/><path d="M4 20h16M6 18l-2 2 2 2M18 18l2 2-2 2"/>',
  'seat-recline': '<path d="M11 13.5h5.5l1.3 3.5"/><path d="M10.5 13.5 8 4.5"/><path d="M5 6.5a7 7 0 0 1 3.2-3.6M3.8 3.8l1.7 2.9 3-1.3"/>',
  'seat-height': '<path d="M10 4.5c1.3 0 1.8.9 1.8 2.2l-.4 6.3h5.6l1.2 3.5"/><path d="M9 13h8"/><path d="M5 5v9M3 7l2-2 2 2M3 12l2 2 2-2"/>',
  lumbar: '<path d="M9 3.5c2 3.5 2.5 6 1 9.5l-.5 3h7l1.5 4"/><path d="M13 7.5c-1.3 1.2-1.3 2.8 0 4"/><path d="M16 7.5l-3 2 3 2"/>',
  'seat-heater': '<path d="M9 4.5c1.3 0 1.8.9 1.8 2.2l-.4 6.3h5.6l1.2 3.5"/><path d="M8 13h8"/><path d="M14 3.5c-1 1 1 2 0 3M17 3.5c-1 1 1 2 0 3M20 3.5c-1 1 1 2 0 3"/>',
  back: '<path d="M9 8H15a4 4 0 0 1 0 8h-4"/><path d="M12 5 9 8l3 3"/>',
  enter: '<circle cx="12" cy="12" r="3"/>',
  airbag: '<circle cx="8" cy="5" r="1.8"/><path d="M8 8v5l3 4M8 13H5"/><circle cx="16" cy="12" r="4.2"/>',
  /* ---- lights ---- */
  'low-beam': '<path d="M10 6c-3 0-5 2.7-5 6s2 6 5 6h1.5V6z"/><path d="M14 8.5 20 10M14 12l6 1.5M14 15.5 20 17"/>',
  'high-beam': '<path d="M10 6c-3 0-5 2.7-5 6s2 6 5 6h1.5V6z"/><path d="M14 8h6M14 12h6M14 16h6"/>',
  'parking-lamps': '<path d="M8.5 7.5c-2 0-3.5 2-3.5 4.5s1.5 4.5 3.5 4.5V7.5zM15.5 7.5c2 0 3.5 2 3.5 4.5s-1.5 4.5-3.5 4.5V7.5z"/><path d="M2.5 9.5h2M2.5 14.5h2M19.5 9.5h2M19.5 14.5h2"/>',
  'front-fog': '<path d="M11 6c-3 0-5 2.7-5 6s2 6 5 6h1.5V6z"/><path d="M15 8.5 20 10M15 12l5 1.5M15 15.5 20 17"/><path d="M17.5 7c-.7 1.7-.7 8.3 0 10"/>',
  'rear-fog': '<path d="M13 6c3 0 5 2.7 5 6s-2 6-5 6h-1.5V6z"/><path d="M4 8h5.5M4 12h5.5M4 16h5.5"/><path d="M6.5 6.5c-.7 1.7-.7 9.3 0 11"/>',
  turn: '<path d="M3 12 8 7v3h4v4H8v3z" fill="currentColor"/><path d="m21 12-5-5v3h-4v4h4v3z" fill="currentColor"/>',
  'turn-left': '<path d="M4 12 10 6v4h10v4H10v4z" fill="currentColor"/>',
  'turn-right': '<path d="m20 12-6-6v4H4v4h10v4z" fill="currentColor"/>',
  hazard: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5 16.3 17H7.7z"/>',
  'dome-light': '<path d="M5 9h14"/><path d="M7 9a5 5 0 0 0 10 0"/><path d="M12 17v3M7 15.5l-1.5 2M17 15.5l1.5 2"/>',
  'map-light': '<circle cx="12" cy="10" r="4"/><path d="M12 16v3M7.5 14.5 6 16.5M16.5 14.5 18 16.5"/>',
  brightness: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  'headlamp-level': '<path d="M9 6c-3 0-5 2.7-5 6s2 6 5 6h1.5V6z"/><path d="M13 8.5 19 10M13 12h6M13 15.5 19 14"/><path d="M20.5 7v10"/>',
  /* ---- wipers ---- */
  wiper: '<path d="M4 17a10 10 0 0 1 16 0"/><path d="M12 17 6.5 9"/>',
  washer: '<path d="M4 17a10 10 0 0 1 16 0"/><path d="M12 17 6.5 9"/><path d="M14.5 8.5l1 -2M17 10l2-1.5M12 7.5V5"/>',
  'rear-defog': '<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M8 8.5c1 1-1 2 0 3s-1 2 0 3M12 8.5c1 1-1 2 0 3s-1 2 0 3M16 8.5c1 1-1 2 0 3s-1 2 0 3"/><path d="M9 20h6"/>',
  'front-defog': '<path d="M3.5 17c1.5-6 5-9 8.5-9s7 3 8.5 9z"/><path d="M8.5 11c1 1-1 2 0 3M12 10.5c1 1-1 2 0 3.5M15.5 11c1 1-1 2 0 3"/>',
  /* ---- climate ---- */
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C11 6 13.5 3.5 16 5c1.6 1-.3 4.3-4 5.2M13.6 12.9c4.1 1.3 4.5 4.8 2 5.8-1.8.7-3.6-2.6-2-5.8M10.4 12.9C7.3 15.8 4.1 14.5 4.6 12c.4-1.9 4.1-1.9 5.8.9"/>',
  temp: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a3.5 3.5 0 1 1-4 0z"/><path d="M12 9v7"/>',
  ac: '<text x="12" y="15.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="currentColor" stroke="none">A/C</text>',
  recirc: `${car}<path d="M8 5.5h7a2 2 0 0 1 0 4H9" /><path d="m10.5 7.5-2 2 2 2"/>`,
  'fresh-air': `${car}<path d="M3 5.5h9l-2-2M12 5.5l-2 2"/>`,
  'mode-face': '<circle cx="8" cy="5.5" r="2"/><path d="M8 7.5v6l3 5M8 11h5"/><path d="M14 6h6M17.5 4 20 6l-2.5 2"/>',
  'mode-feet': '<circle cx="8" cy="5.5" r="2"/><path d="M8 7.5v6l3 5M8 11h5"/><path d="M14 18h6M17.5 16l2.5 2-2.5 2"/>',
  auto: '<text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none">AUTO</text>',
  /* ---- audio, phone ---- */
  'vol-up': '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15 12h6M18 9v6"/>',
  'vol-down': '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15 12h6"/>',
  'seek-up': '<path d="m6 14 6-6 6 6"/>',
  'seek-down': '<path d="m6 10 6 6 6-6"/>',
  mode: '<text x="12" y="15" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">MODE</text>',
  'phone-on': '<path d="M6.5 4.5h3l1.5 4-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2 4 1.5v3c0 1-1 2-2 2A15 15 0 0 1 4.5 6.5c0-1 1-2 2-2z"/>',
  'phone-off': '<path d="M3.5 13.5c4.8-4.6 12.2-4.6 17 0l-1.8 2.4-3.4-1.4v-2.4a9 9 0 0 0-6.6 0v2.4l-3.4 1.4z"/>',
  talk: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3.5 19c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5"/><path d="M16 6.5c1 1 1 3 0 4M18.5 4.5c2 2.2 2 6 0 8"/>',
  power: '<path d="M12 4v7"/><path d="M7.5 7a7 7 0 1 0 9 0"/>',
  display: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  usb: '<path d="M12 3v14"/><circle cx="12" cy="19" r="2"/><path d="m10 5.5 2-2.5 2 2.5"/><path d="M12 13 8 10.5V8M12 11l4-2V7"/><rect x="7" y="6.5" width="2" height="2"/><circle cx="16" cy="6.2" r="1"/>',
  aux: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.8"/>',
  outlet: '<rect x="5" y="5" width="14" height="14" rx="7"/><path d="M12 8.5v4M9.5 15h5"/>',
  /* ---- driving ---- */
  cruise: '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 13l4-4"/><path d="M8 19h8"/>',
  'cruise-set': '<text x="12" y="15" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">SET</text>',
  'cruise-res': '<text x="12" y="15" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">RES</text>',
  cancel: '<text x="12" y="15" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor" stroke="none">CANCEL</text>',
  'on-off': '<text x="12" y="15" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor" stroke="none">ON·OFF</text>',
  eco: '<text x="12" y="15" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">ECO</text>',
  sport: '<text x="12" y="15" text-anchor="middle" font-size="6.5" font-weight="700" fill="currentColor" stroke="none">SPORT</text>',
  'parking-brake': '<circle cx="12" cy="12" r="6"/><path d="M4.5 6.5a10 10 0 0 0 0 11M19.5 6.5a10 10 0 0 1 0 11"/><text x="12" y="15" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none">P</text>',
  gear: '<path d="M7 5v14M12 5v14M17 5v7M7 12h10"/>',
  'shift-lock': '<rect x="8" y="4" width="8" height="10" rx="2"/><path d="M12 14v6"/><path d="M9 20h6"/>',
  horn: '<path d="M4 10h3l7-4v12l-7-4H4z"/><path d="M17 9c1.3 1.6 1.3 4.4 0 6M19.5 7c2.3 2.8 2.3 7.2 0 10"/>',
  paddle: '<path d="M5 12h14"/><text x="8" y="10" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">−</text><text x="16" y="10" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">+</text>',
  /* ---- warning & indicator lamps ---- */
  'master-warning': '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v5M12 17.2v.3"/>',
  brake: '<circle cx="12" cy="12" r="5.5"/><path d="M4.5 6.5a10 10 0 0 0 0 11M19.5 6.5a10 10 0 0 1 0 11"/><path d="M12 9v3.5M12 14.8v.3"/>',
  battery: '<rect x="3.5" y="7.5" width="17" height="11" rx="1"/><path d="M7 7.5V5.5h3v2M14 7.5V5.5h3v2"/><path d="M6.5 13h3.5M15 13h3.5M16.7 11.3v3.4"/>',
  'oil-pressure': '<path d="M3 13h5l1.5-2h6l5-2.5L19 14h-10L8 13"/><path d="M7 11V9h3M20.5 15.5c0 1 .7 1.6 0 2.3-.7-.7 0-1.3 0-2.3z"/><path d="M8 15h10l-1.5 3.5H9.5z"/>',
  'check-engine': '<path d="M6 9h3V7h5v2h2l1.5 2H20v5h-2.5L16 18H9l-2-2H4.5v-5H6z"/><path d="M4.5 13.5H3M20 13.5h1"/>',
  srs: '<circle cx="9" cy="5" r="2"/><path d="M9 7.5v6l3.5 5"/><path d="M5.5 11h4"/><circle cx="16.5" cy="13.5" r="4"/><path d="M5 20h9"/>',
  abs: '<circle cx="12" cy="12" r="6.5"/><path d="M4 6.5a10 10 0 0 0 0 11M20 6.5a10 10 0 0 1 0 11"/><text x="12" y="14.5" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor" stroke="none">ABS</text>',
  'vsc-slip': `${car.replace('<circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>', '')}<path d="M6 20c1-1 2 1 3 0M11 20c1-1 2 1 3 0"/>`,
  'vsc-off': `${car.replace('<circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>', '')}<path d="M6 20c1-1 2 1 3 0M11 20c1-1 2 1 3 0"/><text x="18.5" y="22" text-anchor="middle" font-size="4.8" font-weight="700" fill="currentColor" stroke="none">OFF</text>`,
  tpms: '<path d="M6.5 5.5C4.5 7.5 4 9.5 4 12s1 4.8 2.5 6.5h11C19 16.8 20 14.5 20 12s-.5-4.5-2.5-6.5"/><path d="M6.5 18.5 7.5 20M17.5 18.5l-1 1.5M9 20.5h6"/><path d="M12 8v5.5M12 16v.3"/>',
  eps: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M5 12h5M14 12h5M12 14v5"/><text x="21" y="6" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">!</text>',
  'low-fuel': '<rect x="4" y="5" width="9" height="15" rx="1"/><path d="M4 10h9"/><path d="M13 9h2.5l1.5 2v6.5a1.5 1.5 0 0 0 3 0V8l-2-2.5"/>',
  seatbelt: '<circle cx="12" cy="4.8" r="2"/><path d="M9 20v-8.5l3-3 3 3V20"/><path d="m8 9 8 10"/>',
  security: `${car.replace('<circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>', '')}<rect x="10" y="3" width="4" height="3.5" rx=".6"/><path d="M10.8 3V2a1.2 1.2 0 0 1 2.4 0v1"/>`,
  'eco-drive': '<path d="M5 18c0-7 5-12 14-12 0 9-5 13-11 13"/><path d="M5 19c3-5 6-8 10-10"/>',
  coolant: '<path d="M11 13V4h2v9"/><path d="M11 6h3M11 8.5h2.5M11 11h3"/><circle cx="12" cy="15.5" r="2.5"/><path d="M3.5 19c1.5-1 3 1 4.5 0s3 1 4.5 0 3 1 4.5 0 3 1 4 0"/>',
  'washer-fluid': '<path d="M4 17a10 10 0 0 1 16 0"/><path d="M12 17 6.5 9"/><path d="M14.5 8.5l1-2M17 10l2-1.5M12 7.5V5"/>',
  'brake-fluid': '<circle cx="12" cy="13" r="5"/><path d="M5 8a9 9 0 0 0 0 10M19 8a9 9 0 0 1 0 10"/><path d="M12 3c1 1.3 1.8 2.3 1.8 3.2a1.8 1.8 0 0 1-3.6 0C10.2 5.3 11 4.3 12 3z"/>',
  dipstick: '<circle cx="12" cy="5" r="2.8"/><path d="M12 7.8V21"/><path d="M11 16h2M11 18.5h2"/>',
  fuse: '<rect x="4" y="8" width="16" height="8" rx="2"/><path d="M4 12h3M17 12h3"/><path d="M8 12c1.5-2 2.5 2 4 0s2.5 2 4 0"/>',
  'air-filter': '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M7 6v12M10 6v12M13 6v12M16 6v12"/>',
  tyre: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v4.5M12 15.5V20M4 12h4.5M15.5 12H20"/>',
  info: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  camera: '<rect x="4" y="7" width="16" height="11" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M9 7l1.5-2h3L15 7"/>',
  plate: '<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M7 12h10"/>',
  hook: '<path d="M12 3v9a4 4 0 1 1-4-4"/><circle cx="12" cy="3.5" r="1"/>',
  key: '<circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h10M17 12v3M20 12v2"/>',
  panic: '<path d="M4 10h3l7-4v12l-7-4H4z"/><path d="M17 9c1.3 1.6 1.3 4.4 0 6"/><text x="20.5" y="8" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none">!</text>',
  'smart-key': '<rect x="7" y="3" width="10" height="18" rx="4"/><path d="M10 8h4M10 12h4M10 16h4"/>',
  'push-start': '<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><path d="M9.3 9.5a4 4 0 1 0 5.4 0"/>',
  cup: '<path d="M6 7h12l-1.5 12h-9z"/><path d="M6 10h12"/>',
  storage: '<rect x="4" y="7" width="16" height="11" rx="1.5"/><path d="M4 11h16M10 14h4"/>',
  sunroof: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="m9.5 15 2.5-2.5 2.5 2.5"/>',
  'sunroof-tilt': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M6 13 18 9"/>',
  glovebox: '<path d="M4 8h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 11h6"/>',
  odo: '<text x="12" y="15" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor" stroke="none">ODO</text>',
  'trip-reset': '<text x="12" y="11" text-anchor="middle" font-size="5.5" font-weight="700" fill="currentColor" stroke="none">TRIP</text><path d="M8 15a4 4 0 1 0 1.2-2.8"/><path d="M8 11v2.5h2.5"/>',
  'tpms-set': '<path d="M6.5 5.5C4.5 7.5 4 9.5 4 12s1 4.8 2.5 6.5h11C19 16.8 20 14.5 20 12s-.5-4.5-2.5-6.5"/><text x="12" y="15" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor" stroke="none">SET</text>',
  'lamp-generic': '<circle cx="12" cy="12" r="6"/>',
  'cruise-lamp': '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 13l4-4"/>',
  sport_lamp: '<text x="12" y="15" text-anchor="middle" font-size="6.5" font-weight="700" fill="currentColor" stroke="none">SPORT</text>',
};

/** SVG markup for a symbol, sized `size`, as a standalone <svg>. */
export function symbolSvg(id, size = 20, extra = '') {
  const body = SYMBOLS[id] || SYMBOLS['lamp-generic'];
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
}

/** The symbol body for embedding inside a larger SVG, positioned at (x, y) with size s. */
export function symbolAt(id, x, y, s = 22) {
  const body = SYMBOLS[id] || SYMBOLS['lamp-generic'];
  return `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})" fill="none" stroke="currentColor" stroke-width="${(1.7 * 24 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}
