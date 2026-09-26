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
  'update_plan', 'load_tools', 'update_memory', 'calculate_math', 'browse_web',
  'find_toolbox_tools', 'run_toolbox_tool', 'open_toolbox_tool',
];

export const TOOL_GROUPS = {
  web: {
    label: 'Web research: read pages, crawl sites, find images',
    tools: ['browse_web', 'browser_navigate', 'browser_scrape', 'browser_extract_images', 'browser_crawl', 'search_images', 'save_scraped_images'],
    match: /\b(search|google|look ?up|research|website|web ?site|online|internet|news|latest|today|current|price[sd]?|review|url|https?:|www\.|\.com|\.ng|scrape|crawl|source|cite|article|image[s]? of|picture[s]? of|photo[s]? of|what does .* look like)\b/i,
  },
  math: {
    label: 'Maths: algebra, calculus, equations, matrices, statistics, units',
    tools: ['calculate_math', 'query_math_knowledge', 'evaluate_math_expression', 'unit_converter'],
    match: /\b(calculat|compute|solve|equation|integral|integrate|derivative|differentiat|limit|matrix|eigen|determinant|factor|prime|probability|statistic|mean|median|variance|regression|convert|units?|km|miles|kg|pounds|celsius|fahrenheit|percent|%|sqrt|log|sin|cos|tan|theorem|proof|formula)\b|[\d)]\s*[-+*/^×÷]\s*[\d(]/i,
  },
  finance: {
    label: 'Money: loans, interest, budgets, debts, bank statements, invoices and quotes',
    tools: ['calculate_financial', 'analyze_budget_spending', 'manage_debts', 'import_bank_statement', 'generate_invoice', 'create_invoice', 'list_invoices'],
    match: /\b(loan|mortgage|interest|amorti[sz]|npv|irr|roi|invest|budget|spend|expense|debt|bank statement|invoice|quotation|quote for|owes?|overdue|receivable|wht|withholding|bill|vat|tax|salary|payroll|profit|margin|revenue|cash ?flow|naira|₦|ngn|usd|\$|dollar|currency|exchange rate)\b/i,
  },
  science: {
    label: 'Science: chemistry, elements, anatomy, diseases',
    tools: ['calculate_chemistry', 'explore_elements', 'search_diseases', 'explore_anatomy'],
    match: /\b(chemi|molar|molecule|compound|reaction|balance .*equation|stoichiom|element|periodic|atom|anatomy|organ|bone|vertebra|muscle|disease|symptom|diagnos|icd|patholog|syndrome|infection)\b/i,
  },
  files: {
    label: 'Files: create, read, move, rename, zip and save files and artifacts',
    tools: ['create_file', 'save_file', 'read_file', 'list_files', 'create_folder', 'rename_file', 'move_file', 'request_file_deletion', 'delete_file', 'download_file', 'compress_files', 'extract_archive', 'list_saved_artifacts', 'read_artifact', 'create_artifact', 'delete_artifact', 'save_toolbox_artifact'],
    match: /\b(files?|folder|save|saved|download|zip|unzip|archive|rename|move|delete|artifact|document|export)\b/i,
  },
  documents: {
    label: 'Documents: PDF tools, PDF to Word, annotate, clean text',
    tools: ['pdf_process', 'convert_pdf_to_word', 'annotate_pdf', 'clean_text'],
    match: /\b(pdf|word|docx|document|page[s]?|merge|split|annotate|redact|watermark|clean (up )?text|contract|agreement)\b/i,
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
    label: 'Code: run code, build apps in the Code Playground, regex, cron, UML, flowcharts, logic circuits',
    tools: ['code_execute', 'ide_create_project', 'ide_write_file', 'ide_build_and_preview', 'ide_package_project', 'ide_run_command', 'ide_run_tests', 'ide_git_push', 'regex_tester', 'cron_parser', 'hash_generator', 'uuid_generator', 'slug_generator', 'generate_uml', 'generate_flowchart', 'simulate_algorithm', 'simulate_logic_circuit', 'build_logic_circuit'],
    match: /\b(code|program|script|python|javascript|typescript|js|html|css|sql|c\+\+|app|website|build|function|bug|debug|compile|run it|playground|regex|cron|uuid|hash|uml|flowchart|algorithm|logic gate|circuit)\b/i,
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
    label: 'Places: maps, nearby places, location, weather',
    tools: ['render_map', 'search_places_nearby', 'get_current_location', 'weather_forecast'],
    match: /\b(map|near(est|by)?|where is|directions|route|location|address|restaurant|hotel|pharmacy|hospital|bank|supermarket|station|weather|rain|temperature|forecast|lagos|abuja|lekki|ikeja)\b/i,
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
    label: 'Devices: specs and comparisons for phones, laptops, tablets, TVs, monitors, chips, GPUs, watches, audio, consoles',
    tools: ['device_specs', 'device_compare'],
    match: /\b(phone|iphone|samsung|galaxy|pixel|tecno|infinix|xiaomi|laptop|macbook|tablet|ipad|tv|television|monitor|oled|gpu|rtx|cpu|processor|snapdragon|chip|smartwatch|watch|earbuds|headphones|airpods|console|playstation|ps5|xbox|switch|specs?|versus|vs\.?)\b/i,
  },
  vehicles: {
    label: 'Vehicles: VIN decoding and car specifications',
    tools: ['vehicle_lookup'],
    match: /\b(car|vehicle|vin|toyota|honda|lexus|mercedes|bmw|ford|engine|horsepower|torque|sedan|suv|truck|corolla|camry)\b/i,
  },
  building: {
    label: 'Buildings: container and portacabin design, quotes, floor plans, construction cost estimates and bills of quantities',
    tools: ['design_container', 'plan_container_quote', 'generate_floor_plan', 'estimate_construction'],
    match: /\b(container|portacabin|porta ?cabin|cabin|20 ?ft|40 ?ft|high cube|site office|shop|kiosk|floor ?plan|office space|build(ing)?|structure|quote|quotation|boq|bill of quantities|building cost|cement|concrete|rebar|iron rods?|sandcrete|blockwork|slab|foundation|footing|roofing|plaster(ing)?|bungalow|duplex|construction)\b/i,
  },
  scripture: {
    label: 'Scripture: Bible and Quran passages',
    tools: ['bible_quran_lookup'],
    match: /\b(bible|quran|qur'an|koran|verse|psalm|surah|sura|ayah|genesis|john \d|matthew|al-?fatiha|scripture|chapter \d)\b/i,
  },
  network: {
    label: 'Network: speed test, DNS',
    tools: ['run_speed_test', 'dns_lookup'],
    match: /\b(speed test|internet speed|bandwidth|latency|ping|dns|domain|mx record|nameserver)\b/i,
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
};

const GROUP_OF = new Map();
for (const [id, g] of Object.entries(TOOL_GROUPS)) for (const t of g.tools) if (!GROUP_OF.has(t)) GROUP_OF.set(t, id);
export const groupOfTool = (name) => GROUP_OF.get(name) || null;

export const LOAD_TOOLS_DECLARATION = {
  name: 'load_tools',
  description: `Loads more tools for this conversation. Only a core set is loaded by default; call this with the groups you need before using a tool you do not have. Groups: ${Object.entries(TOOL_GROUPS).map(([id, g]) => `${id} (${g.label})`).join('; ')}.`,
  parameters: {
    type: 'object',
    properties: { groups: { type: 'array', items: { type: 'string', enum: Object.keys(TOOL_GROUPS) }, description: 'Group names to load.' } },
    required: ['groups'],
  },
};

/** Picks groups for a request from recent text, tools already used and attachments. */
export function selectGroups({ history = [], hasFile = false, fileType = '' } = {}) {
  const picked = new Set();
  const recent = history.slice(-4);
  const text = recent.map(m => (typeof m.content === 'string' ? m.content : '')).join('\n');
  for (const [id, g] of Object.entries(TOOL_GROUPS)) if (g.match.test(text)) picked.add(id);
  // Keep groups whose tools this chat already used, so follow-ups ("now make it red") still work.
  for (const m of history.slice(-12)) {
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
