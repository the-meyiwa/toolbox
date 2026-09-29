/* ============================================================
   TOOLBOX — Assistant tool groups

   Sending all ~100 tool descriptions with every message makes
   each request ~66 KB: slower for every model, too big for some
   (Groq's free tier), and it makes wrong tool picks more likely.

   Instead each request carries a small core set plus the groups
   the conversation is about. Groups are picked from the words in
   the latest messages, the tools already used in the chat, and any
   attachment; the model can also ask for more with load_tools.
   ============================================================ */

export const CORE_TOOLS = [
  'update_plan', 'load_tools', 'update_memory', 'browse_web',
  'find_toolbox_tools', 'run_toolbox_tool', 'open_toolbox_tool',
];

export const TOOL_GROUPS = {
  web: {
    label: 'Web research: read pages, crawl sites, find images',
    tools: ['browse_web', 'browser_navigate', 'browser_scrape', 'browser_extract_images', 'browser_crawl', 'search_images', 'save_scraped_images', 'knowledge_library'],
    match: /\b(search|google|look ?up|research|online|internet|news|latest|today|current|price[sd]?|review|url|https?:|www\.|\.com|\.ng|scrape|crawl|source|cite|article|image[s]? of|picture[s]? of|photo[s]? of|what does .* look like)\b/i,
  },
  math: {
    label: 'Maths: algebra, calculus, equations, matrices, statistics, units',
    tools: ['calculate_math', 'query_math_knowledge', 'evaluate_math_expression', 'unit_converter'],
    match: /\b(calculat|compute|solve|equation|integral|integrate|derivative|differentiat|limit|matrix|eigen|determinant|factor|prime|probability|statistic|mean|median|variance|regression|convert|units?|km|miles|kg|pounds|celsius|fahrenheit|percent|%|sqrt|log|sin|cos|tan|theorem|proof|formula)\b|[\d)]\s*[-+*/^×÷]\s*[\d(]/i,
  },
  finance: {
    label: 'Business & Finance: VAT, margin/markup, break-even, loans, compound interest, NPV/IRR, depreciation, cap tables, runway, unit economics, payroll cost, salary conversion, meeting cost, leave, subscriptions, budgets, debts, bank statements, invoices and quotes',
    tools: ['business_calc', 'calculate_financial', 'analyze_budget_spending', 'manage_debts', 'import_bank_statement', 'generate_invoice', 'create_invoice', 'list_invoices'],
    match: /\b(loan|mortgage|interest|amorti[sz]|npv|irr|roi|invest|budget|spend|expense|debt|bank statement|invoice|quotation|quote for|owes?|overdue|receivable|wht|withholding|bill|vat|tax|salary|payroll|profit|margin|markup|mark-up|break-?even|depreciat\w*|cap ?table|dilution|equity|valuation|pre-?money|runway|burn rate|churn|ltv|cac|unit economics|pto|annual leave|leave balance|meeting cost|subscription|revenue|cash ?flow|naira|₦|ngn|usd|\$|dollar|currency|exchange rate)\b/i,
  },
  science: {
    label: 'Science: drugs and compounds, elements, chemistry, anatomy, diseases',
    tools: ['lookup_compound', 'lookup_element', 'anatomy_lookup', 'calculate_chemistry', 'explore_elements', 'search_diseases', 'explore_anatomy'],
    match: /\b(chemi\w*|molar|molecules?|compounds?|reactions?|balance .*equation|stoichiom\w*|elements?|periodic|atoms?|atomic|drugs?|medicines?|medications?|tablets?|dosage|pharma\w*|antibiotics?|cas|formula of|anatomy|organs?|bones?|vertebra\w*|muscles?|nerves?|nervous|arter(y|ies)|veins?|brain|spinal|disease|symptoms?|diagnos\w*|icd|patholog\w*|syndrome|infection)\b|\w+(azole|mycin|cillin|oxacin|prazole|sartan|olol|pril|statin|caine|cycline)\b/i,
  },
  files: {
    label: 'Files: create, read, move, rename, zip and save files and artifacts',
    tools: ['create_file', 'save_file', 'read_file', 'list_files', 'create_folder', 'rename_file', 'move_file', 'request_file_deletion', 'delete_file', 'download_file', 'compress_files', 'extract_archive', 'list_saved_artifacts', 'read_artifact', 'create_artifact', 'delete_artifact', 'save_toolbox_artifact'],
    match: /\b(files?|folder|save|saved|download|zip|unzip|archive|rename|move|delete|artifact|document|export)\b/i,
  },
  documents: {
    label: 'Documents: create Word, spreadsheet and slide files; PDF tools, PDF to Word, annotate, clean text',
    tools: ['generate_document', 'pdf_process', 'convert_pdf_to_word', 'annotate_pdf', 'clean_text'],
    match: /\b(pdf|word|docx?|odt|rtf|xlsx|pptx|document|report|letter|memo|proposal|cv|resume|essay|slides?|deck|presentation|powerpoint|spreadsheet|workbook|excel|merge|split|annotate|redact|watermark|clean (up )?text|contract|agreement)\b/i,
  },
  legal: {
    label: 'Legal (Nigeria): review contracts and leases, parse citations and build tables of authorities, digest judgments',
    tools: ['analyze_legal_document', 'parse_citations', 'case_digest'],
    match: /\b(contracts?|agreements?|clauses?|judgm?ents?|rulings?|NWLR|LPELR|FWLR|SCNJ|plaintiffs?|defendants?|appellants?|respondents?|claimants?|court|statutes?|sections? \d|deeds?|lease|tenancy|tenant|landlord|affidavits?|brief of argument|indemnit\w*|governing law|arbitration|ratio decidendi|obiter|citation|authorit(?:y|ies)|precedent|suit no|CAMA|LFN|stamp duty)\b/i,
  },
  images: {
    label: 'Images and drawing: convert, crop, compress, illustrate, QR codes',
    tools: ['image_convert_and_resize', 'image_crop', 'image_compress', 'illustrator', 'draw_illustration', 'generate_qr_code'],
    match: /\b(image|photo|picture|png|jpe?g|webp|heic|resize|crop|compress|draw|illustrat|sketch|logo|icon|diagram|qr)\b/i,
  },
  data: {
    label: 'Data: CSV, charts, JSON',
    tools: ['visualize_data', 'csv_analyze_and_chart', 'generate_csv', 'csv_to_json', 'json_formatter_validator'],
    match: /\b(csv|excel|xlsx|spreadsheet|table|dataset|data|chart|graph|plot|visuali[sz]|json|column|rows?)\b/i,
  },
  code: {
    label: 'Code: run code, build apps and websites in the Code Playground',
    tools: ['code_execute', 'ide_create_project', 'ide_write_file', 'ide_build_and_preview', 'ide_package_project', 'ide_run_command', 'ide_run_tests', 'ide_git_push'],
    match: /\b(code|program|script|python|javascript|typescript|js|html|css|sql|c\+\+|app|website|web ?site|web ?page|landing page|portfolio|build|function|bug|debug|compile|run it|playground)\b/i,
  },
  devtools: {
    label: 'Developer utilities: regex, cron, hashes, UUIDs, slugs, UML, flowcharts, algorithms, logic circuits',
    tools: ['regex_tester', 'cron_parser', 'hash_generator', 'uuid_generator', 'slug_generator', 'generate_uml', 'generate_flowchart', 'simulate_algorithm', 'simulate_logic_circuit', 'build_logic_circuit'],
    match: /\b(regex|regular expression|cron|uuid|guid|hash|sha-?\d+|md5|slug|uml|class diagram|sequence diagram|flowchart|algorithms?|logic gates?|circuits?|truth table)\b/i,
  },
  notes: {
    label: 'Notes: create, list, read and edit notes',
    tools: ['create_note', 'list_notes', 'get_note', 'update_note'],
    match: /\b(note|notes|jot|write (this|that) down|remember this|memo)\b/i,
  },
  calendar: {
    label: 'Calendar: add, list and cancel events and reminders',
    tools: ['calendar_add_event', 'calendar_get_events', 'calendar_cancel_event'],
    match: /\b(calendar|schedule|meeting|appointment|remind|reminder|event|tomorrow|next week|on (mon|tues|wednes|thurs|fri|satur|sun)day|agenda)\b/i,
  },
  places: {
    label: 'Places: maps, directions (car, foot, bike, local transport), nearby places, location, weather',
    tools: ['get_directions', 'search_places_nearby', 'find_place', 'render_map', 'get_current_location', 'weather_forecast'],
    match: /\b(maps?|near(est|by)?|where is|directions?|route|how (do|can|would) i (get|go)|get to|go to|drive to|walk to|commute|transport|bus|buses|brt|taxi|cab|keke|danfo|okada|tricycle|train|ferry|location|address|restaurant|hotel|pharmacy|hospital|bank|supermarket|station|gas station|fuel|petrol|atm|weather|rain|temperature|forecast|lagos|abuja|lekki|ikeja)\b/i,
  },
  music: {
    label: 'Music theory and instruments: the Music Theory Library (topics, instrument guides and roadmaps, glossary), exact scales, chords, chord naming, progressions, keys, intervals and transposition',
    tools: ['music_library', 'music_theory'],
    match: /\b(music theory|scales?|chords?|arpeggio|triad|seventh|progression|cadence|harmony|harmoni[sz]e|melody|counterpoint|voice leading|modes?|dorian|phrygian|lydian|mixolydian|aeolian|locrian|pentatonic|blues scale|key signature|circle of fifths|interval|transpos\w*|time signature|rhythm|syncopation|polyrhythm|clef|staff|sheet music|read music|solf[eè]ge|ear training|notation|how (do i|to) (play|learn) (the )?\w+|instrument|guitar|piano|violin|cello|viola|bass|ukulele|drums?|flute|clarinet|saxophone|trumpet|trombone|horn|tuba|oboe|recorder|harp|kora|harmonica|organ|synth\w*|singing|vocal|jazz|raga|maqam|gamelan|sonata|fugue|twelve-?tone|serial\w*|temperament|harmonic series)\b/i,
  },
  cosmetics: {
    label: 'Cosmetics: skincare, makeup, hair, body, sun care, fragrance and oral-care products, their specs and ingredient lists (every ingredient explained), cosmetic ingredients and beauty brands',
    tools: ['cosmetics_database', 'lookup_compound'],
    match: /\b(cosmetics?|beauty|skin ?care|make-?up|ingredients? list|inci|serum|moisturi[sz]er|cleanser|toner|essence|sunscreen|sun ?cream|spf|retinol|retinoid|niacinamide|hyaluronic|ceramides?|salicylic|glycolic|aha|bha|vitamin c serum|foundation|concealer|lipstick|lip ?gloss|lip balm|mascara|eyeliner|blush|bronzer|primer|setting spray|shampoo|conditioner|hair (oil|mask|treatment)|body (lotion|wash)|deodorant|antiperspirant|toothpaste|mouthwash|perfume|fragrance|cologne|eau de (parfum|toilette)|nail polish|acne|pimple|eczema|fragrance-free|non-comedogenic|parabens?|sulfates?|silicones?|cerave|the ordinary|la roche-?posay|neutrogena|cetaphil|nivea|olay|loreal|l'or[eé]al|maybelline|mac cosmetics|fenty|estee lauder|clinique|kiehl'?s|cosrx|laneige|innisfree|beauty of joseon|sk-?ii|shiseido|bioderma|av[eè]ne|vichy|eucerin|vaseline|dove|garnier|chanel|dior|lanc[oô]me|zaron|house of tara|arami)\b/i,
  },
  media: {
    label: 'Audio: play songs and sounds, metronome, tuner',
    tools: ['play_sound', 'control_audio', 'start_metronome', 'tune_instrument'],
    match: /\b(play|song|music|sound|audio|listen|metronome|tempo|bpm|tune|tuner|guitar|piano)\b/i,
  },
  chess: {
    label: 'Chess: analyse positions, play moves, open the board',
    tools: ['chess_analyze', 'chess_play', 'chess_open_board'],
    match: /\b(chess|fen|pgn|checkmate|opening|gambit|defen[cs]e|sicilian|e4|d4|nf3|knight|bishop|rook|queen|pawn)\b/i,
  },
  devices: {
    label: 'Devices: specs and comparisons for phones, laptops, tablets, TVs, monitors, chips, CPUs, GPUs, watches, earbuds, speakers, consoles, chargers, power banks, printers, photocopiers, coffee makers, inverters, UPS, guitars, keyboards and electric cars',
    tools: ['device_specs', 'device_compare'],
    match: /\b(phone|iphone|samsung|galaxy|pixel|tecno|infinix|xiaomi|laptop|macbook|tablet|ipad|tv|television|monitor|oled|gpu|rtx|cpu|processor|snapdragon|chip|smartwatch|watch|earbuds|headphones|airpods|console|playstation|ps5|xbox|switch|specs?|versus|vs\.?|charger|charging brick|usb-?c cable|cable|power ?bank|power station|ecoflow|jackery|speaker|jbl|bose|printer|ecotank|laserjet|photocopier|copier|bizhub|imagerunner|coffee (maker|machine)|espresso|nespresso|breville|inverter|deye|growatt|victron|ups|electric car|ev|tesla|byd|nio|xpeng|zeekr|model [3sxy]|ioniq|guitar|stratocaster|les paul|keyboard|digital piano|synth\w*|intel|amd|ryzen|core i\d|nvidia|geforce|radeon)\b/i,
  },
  vehicles: {
    label: 'Vehicles and aircraft: fault diagnosis (symptoms to causes and fixes), VIN decoding, car specifications, what a button, switch, lever or warning light is for (shown on a drawing of that part of the car, SUV, airliner flight deck or light-aircraft cockpit), where a part is with its specs (shown in 3D), and the injuries car parts and crashes cause, with first aid, treatment and prevention',
    tools: ['diagnose_vehicle', 'vehicle_lookup', 'vehicle_controls', 'vehicle_part', 'car_injury'],
    match: /\b(cars?|vehicles?|vin|planes?|aircraft|airplanes?|aeroplanes?|airliners?|boeing|737|cessna|172|skyhawk|cockpit|flight deck|landing gear|flaps?|autopilot|yoke|mixture|propeller|throttle quadrant|overhead panel|gx ?470|land cruiser|4wd|four wheel drive|diff lock|toyota|honda|lexus|mercedes|bmw|ford|kia|hyundai|nissan|engine|horsepower|torque|sedan|suv|truck|corolla|camry|mechanic\w*|wipers?|windscreen|windshield|brakes?|battery|alternator|starter|radiator|coolant|overheat\w*|gear ?box|transmission|clutch|tyres?|tires?|suspension|steering|exhaust|spark plugs?|fuel pump|check engine|obd|p0\d{3}|headlights?|indicators?|a\/c|aircon|won'?t start|dash(board)?|warning lights?|(engine|oil|battery|brake|tyre|tire) light|stalk|hazards?|fuel (door|cap|flap)|boot release|trunk release|hood release|bonnet|key ?fob|demister|defrost(er)?|cruise control|handbrake|parking brake|oil filter|air filter|drain plug|dipstick|sump|fan belt|serpentine|drive belt|timing chain|thermostat|water pump|catalytic|cv (joint|axle)|driveshaft|struts?|shocks?|control arm|tie rods?|wheel bearing|brake pads?|rotors?|calipers?|fuse ?box|relay|o2 sensor|oxygen sensor|throttle body|ignition coils?|coolant|bonnet|boot lid|crash|collision|accident|whiplash|seat ?belt injur\w*|airbag injur\w*|dashboard knee|car (injur\w*|accident|crash))\b/i,
  },
  building: {
    label: 'Architecture and buildings: architecture advice (structure, climate, software/system design), container and portacabin design, quotes, floor plans, construction cost estimates',
    tools: ['architecture_advisor', 'model_3d', 'design_container', 'plan_container_quote', 'generate_floor_plan', 'estimate_construction', 'knowledge_library'],
    match: /\b(architect\w*|microservices?|monolith|kubernetes|k8s|docker|system design|scalab\w*|beams?|columns?|spans?|stairs?|staircase|ventilation|container|portacabin|porta ?cabin|cabin|20 ?ft|40 ?ft|high cube|site office|shop|kiosk|floor ?plan|office space|building|structural|quotation|boq|bill of quantities|building cost|cement|concrete|rebar|iron rods?|sandcrete|blockwork|slab|foundation|footing|roofing|plaster(ing)?|bungalow|duplex|construction)\b/i,
  },
  scripture: {
    label: 'Scripture: Bible and Quran passages',
    tools: ['bible_quran_lookup'],
    match: /\b(bible|quran|qur'an|koran|verse|psalm|surah|sura|ayah|genesis|john \d|matthew|al-?fatiha|scripture|chapter \d)\b/i,
  },
  network: {
    label: 'Networking: subnet/CIDR calculator, URL parser, IP lookup, DNS and reverse DNS, WHOIS, domain availability, SSL certificates, robots.txt/sitemaps, MAC vendor, speed test',
    tools: ['network_tool', 'run_speed_test', 'dns_lookup'],
    match: /\b(speed test|internet speed|bandwidth|latency|ping|dns|reverse dns|ptr|domain|mx record|nameserver|subnet|cidr|netmask|subnet mask|ipv4|ipv6|ip address|my ip|whois|registrar|rdap|ssl|tls|certificate|https cert|robots\.txt|sitemap|mac address|oui|url|query string|network)\b|\b\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?\b/i,
  },
  social: {
    label: 'Toolbox messaging and spaces: conversations, messages, profiles',
    tools: ['list_conversations', 'read_space_messages', 'send_space_message', 'list_profiles'],
    match: /\b(message|messages|dm|chat with|space|spaces|conversation|profile|send .* to @|@\w+)\b/i,
  },
  design: {
    label: 'Colour: convert colours and check contrast',
    tools: ['color_converter_and_contrast'],
    match: /\b(colou?r|hex|rgb|hsl|contrast|palette)\b/i,
  },
  modelling: {
    label: '3D: create 3D objects (phones, furniture, props, vehicles, shapes) to view, export and open in the 3D Lab; realistic 3D models of structures (trusses, frames, towers, bridges, domes, buildings, landmarks)',
    tools: ['create_3d_object', 'search_3d_models', 'model_3d', 'knowledge_library'],
    match: /\b(3-?d|model(l?ing)?|render(ing)?|visuali[sz]e|sculpt\w*|mesh|glb|gltf|stl|obj|usdz|fbx|3d ?print\w*|cad|blender|prop|replica|truss(es)?|space ?frame|tower|bridge|dome|pavilion|stadium|skyscraper|landmark|monument|cathedral|pagoda|pyramid|structure|torus|klein|m(o|ö)bius|menger|fractal|polyhedr\w*)\b/i,
  },
};

const GROUP_OF = new Map();
for (const [id, g] of Object.entries(TOOL_GROUPS)) for (const t of g.tools) if (!GROUP_OF.has(t)) GROUP_OF.set(t, id);
export const groupOfTool = (name) => GROUP_OF.get(name) || null;

/** Adds a group, or extends an existing one with more tools (used by tool packs). */
export function addToolGroup(id, { label, tools = [], match } = {}) {
  const g = TOOL_GROUPS[id];
  if (g) {
    for (const t of tools) if (!g.tools.includes(t)) g.tools.push(t);
    if (label) g.label = label;
    if (match) g.match = match;
  } else {
    TOOL_GROUPS[id] = { label: label || id, tools: [...tools], match: match || /(?!)/ };
  }
  for (const t of tools) if (!GROUP_OF.has(t)) GROUP_OF.set(t, id);
}

// Built on read, so groups that tool packs add are listed too.
export const LOAD_TOOLS_DECLARATION = {
  name: 'load_tools',
  get description() {
    return `Loads more tools. Only a core set is loaded; call this with the groups you need first. Groups: ${Object.entries(TOOL_GROUPS).map(([id, g]) => `${id} (${g.label.split(':')[0]})`).join(', ')}.`;
  },
  get parameters() {
    return {
      type: 'object',
      properties: { groups: { type: 'array', items: { type: 'string', enum: Object.keys(TOOL_GROUPS) }, description: 'Group names to load.' } },
      required: ['groups'],
    };
  },
};

/** Picks groups for a request from recent text, tools already used and attachments. */
export function selectGroups({ history = [], hasFile = false, fileType = '' } = {}) {
  const picked = new Set();
  // Only the person's own recent words pick groups: the Assistant's long replies mention
  // everything ("build", "page", "data"…) and used to pull in most groups on every follow-up.
  const recent = history.filter(m => m.role === 'user').slice(-2);
  const text = recent.map(m => (typeof m.content === 'string' ? m.content : '')).join('\n');
  for (const [id, g] of Object.entries(TOOL_GROUPS)) if (g.match.test(text)) picked.add(id);
  // Keep groups whose tools this chat already used, so follow-ups ("now make it red") still work.
  for (const m of history.slice(-6)) {
    for (const r of m.toolResults || []) {
      const g = groupOfTool(r?.toolName);
      if (g) picked.add(g);
    }
  }
  if (hasFile) {
    picked.add('files');
    if (/pdf|word|document/i.test(fileType)) picked.add('documents');
    else if (/^image\//i.test(fileType)) picked.add('images');
    else if (/csv|sheet|excel|json/i.test(fileType)) picked.add('data');
    else picked.add('documents');
  }
  return picked;
}
