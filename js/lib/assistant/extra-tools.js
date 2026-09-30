/* ============================================================
   TOOLBOX — Assistant capability pack

   Tools the Assistant can call on top of the core set in
   assistant-tools.js: chess (analysis, playing, opening in the
   board), the device-specs database, vehicles, notes editing,
   drawing SVG illustrations, a visible task plan for multi-step
   work, container structure design with a 3D preview, and
   discovery/running of any Toolbox tool.

   Each result carries `renderer` so the chat can draw a card,
   plus plain fields the model reads back.
   ============================================================ */

import { GENERATORS as STRUCTURE_GENERATORS } from '../structure-model.js';
import { LAB3D_TOOL_DECLARATIONS, create3dObject, search3dModels } from '../lab3d/assistant-tools.js';
import { TOOLS } from '../../registry/index.js';
import * as CE from '../construction/estimate.js';
import { DOMAIN_TOOL_DECLARATIONS, executeDomainTool } from './domain-tools.js';
import { CATEGORY_ORDER as DEVICE_CATEGORIES } from '../devices/schema.js';
import { readMind, addMindItem, connectMindFiles, searchMind } from '../mind-store.js';

const lower = (v) => String(v ?? '').toLowerCase().trim();

/* ---------------- declarations (JSON Schema, lowercase types) ---------------- */

export const EXTRA_TOOL_DECLARATIONS = [
  {
    name: 'update_plan',
    description: 'Show the user a live checklist for a multi-step task. Call it at the start of any task that needs 3+ steps or several tools, then again as steps finish (mark them done), so the user can follow progress. Keep step titles short.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short name for the overall task.' },
        steps: {
          type: 'array',
          description: 'Every step in order, with its current status.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'active', 'done', 'failed', 'skipped'] },
            },
            required: ['title', 'status'],
          },
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'chess_analyze',
    description: 'Analyse a chess position with the Toolbox chess engine: evaluation, best move, principal variation, whose turn, check/checkmate/stalemate, legal moves and the opening name. Give either a FEN, a PGN, or a list of moves from the start position. Also use it to judge whether a move was a blunder by passing the moves before it and `move_to_judge`.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string', description: 'Position in FEN.' },
        pgn: { type: 'string', description: 'A game in PGN (analyses the final position).' },
        moves: { type: 'array', items: { type: 'string' }, description: 'Moves from the start position, SAN or UCI, e.g. ["e4","e5","Nf3"].' },
        move_to_judge: { type: 'string', description: 'Optional move (SAN/UCI) to classify from the given position: best / good / inaccuracy / mistake / blunder.' },
        depth: { type: 'string', enum: ['fast', 'normal', 'deep'], description: 'How long to think (default normal).' },
      },
    },
  },
  {
    name: 'chess_play',
    description: 'Play a chess move and (optionally) get the engine reply, returning the new board. Use this to play a game against the user in chat or to demonstrate lines. Illegal moves are rejected with the list of legal ones.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string', description: 'Current position FEN (default: start position).' },
        moves: { type: 'array', items: { type: 'string' }, description: 'Moves already played from the start (alternative to fen).' },
        move: { type: 'string', description: 'The move to play now (SAN or UCI). Omit to let the engine move.' },
        engine_reply: { type: 'boolean', description: 'After the move, let the engine answer (default true).' },
        level: { type: 'number', description: 'Engine strength 1-10 (default 6).' },
      },
    },
  },
  {
    name: 'chess_open_board',
    description: 'Open the Toolbox Chess board with a position or game loaded for analysis, so the user can continue on the full board.',
    parameters: {
      type: 'object',
      properties: {
        fen: { type: 'string' },
        pgn: { type: 'string' },
        moves: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'device_specs',
    description: 'Look up specifications from the Toolbox device database (2,000+ phones, tablets, laptops, TVs, monitors, mobile chips, processors and graphics cards back to 2007, smartwatches, headphones/earbuds, Bluetooth speakers, consoles, chargers and cables, power banks and power stations, printers, photocopiers, coffee makers, solar inverters, UPS units, electric guitars, keyboards/digital pianos and electric cars from Chinese and global brands). Returns specs, benchmark scores and Toolbox scores. Use for any question about a specific device\'s specs or for "best X" rankings.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Device name, e.g. "iPhone 17 Pro", "RTX 4070", "Snapdragon 8 Elite".' },
        category: { type: 'string', enum: DEVICE_CATEGORIES, description: 'Optional category to search (socs = mobile chips, cpus = processors, gpus = graphics cards, audio = headphones/earbuds, evs = electric cars).' },
        rank_by: { type: 'string', description: 'Optional: return the top devices in the category sorted by this (score, value, price, battery, gb6m, timespy, nits …; value = best score for the money) instead of searching.' },
        limit: { type: 'number', description: 'Max results (default 5, max 15).' },
      },
    },
  },
  {
    name: 'device_compare',
    description: 'Compare two devices head to head and show a comparison card. Returns two separate verdicts: betterTech (spec score only, price ignored) and betterBuy (value: score weighed against launch price) — report both, since the better buy is not always the better tech. Also returns reasons each wins and key specs. Opens in Tech Device Comparisons.',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'string', description: 'First device name.' },
        b: { type: 'string', description: 'Second device name.' },
        category: { type: 'string', description: 'Optional category if ambiguous.' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'car_injury',
    description: `Car-related injuries: what a part or a crash can do to the body, the signs, first aid, likely hospital treatment and how to prevent it. Covers whiplash, head and neck injuries, airbag and seat-belt injuries, fractures (skull, face, collarbone, ribs, spine, pelvis, femur, knee, shin, ankle, wrist) with their fracture types, organ injuries, burns and scalds, battery acid, coolant and carbon monoxide poisoning, crush and finger injuries. The card links each drug to the Compound Database and each injury site to the Anatomy Explorer, showing only that part of the body. Use it for "what injuries can seat belts cause", "how is a broken femur from a crash treated", "dashboard knee injury", "is antifreeze poisonous". For a specific car part, vehicle_part also includes its safety section.`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The injury, body part, crash type or car part, in the person’s words.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'vehicle_part',
    description: `Find a part on a vehicle or aircraft and show it: where it is, what it does, its specifications, maintenance, common failures, and the matching spec-sheet figures (oil grade and capacity, spark plugs, tyres, wheel torque, brakes…), with a "Show in 3D" button that opens the Vehicle Guide on that part, in X-Ray if it sits under the skin. Use it for "where is the …", "show me the …", "what does the … do", or when a diagnosis points at a part. Understands mechanics' and British/American names (sump, fan belt, cat, CV axle, bonnet, boot, rotor, shock, O2 sensor) and sides (front left, passenger side). Covers four detailed packages: the 2014–2016 Toyota Corolla (E170, the default), the 2008 Lexus GX 470, the Boeing 737-800 and the Cessna 172S — pass the vehicle the person means. Quote figures as given and pass on the accuracy note: some positions are approximate.`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The part, in the person\'s words, with side or end if they said (e.g. "front left brake pads").' },
        vehicle: { type: 'string', description: 'The vehicle or aircraft, if they said (e.g. "GX 470", "737", "Cessna 172").' },
      },
      required: ['query'],
    },
  },
  {
    name: 'vehicle_controls',
    description: `Identify a button, switch, knob, lever, warning light, symbol or exterior part on a car or aircraft and SHOW the person that part drawn with every switch and symbol, so they can point at the one they mean ("One of these?"). Use it whenever someone asks what a button, light, symbol, lever or fitting is for, e.g. "there's a button on my car door, what is it for?", "orange light that looks like an engine", "lever on the right of the steering wheel", "how do I open the fuel door", "what does the MCP do on a 737", "which knob is the mixture in a Cessna". Covers in detail: the 2014–2016 Toyota Corolla (the default: door switches, stalks, warning lamps, centre stack, climate, console, overhead, releases, key fob, exterior, engine bay), the 2008 Lexus GX 470 (plus its 4WD controls, side-hinged rear door and glass hatch), the Boeing 737-800 flight deck (mode control panel, EFIS, warnings, displays, overhead panels, control stand, radios and fire panel) and walk-around, and the Cessna 172S cockpit and pre-flight walk-around. Pass the vehicle. Other cars share most ISO symbols, so it still helps; say so. Aircraft answers are for learning, not operating. After the card is shown, answer in one or two sentences and invite them to tap the one they mean.`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the person described, in their words (location, shape, colour, symbol).' },
        vehicle: { type: 'string', description: 'The vehicle or aircraft, if they said (make, model, year).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'vehicle_lookup',
    description: 'Find information about a car or vehicle: decode a VIN (NHTSA), list models for a make/model search with an encyclopedia summary and photo, and any detailed Toolbox vehicle package (3D model and spec sheet) that exists. Use for automotive specifics.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Make and model, e.g. "Toyota Corolla 2020", or a 17-character VIN.' },
        open_guide: { type: 'boolean', description: 'Also open the Vehicle Guide (3D) if a package exists.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_note',
    description: 'Edit an existing note in Notes: replace its title/body or append text. Find it by id or title.',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Note id or (part of) its title.' },
        title: { type: 'string', description: 'New title (optional).' },
        body: { type: 'string', description: 'New full body (replaces). Markdown-style text is fine.' },
        append: { type: 'string', description: 'Text to add at the end instead of replacing.' },
      },
      required: ['note'],
    },
  },
  {
    name: 'draw_illustration',
    description: 'Show an illustration, diagram, icon, chart or scene you drew as SVG. Write complete, self-contained SVG markup (viewBox set, no scripts, no external images). Use it whenever the user asks you to draw, sketch, illustrate, design a logo/icon, or visualise something that is not plain data.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        svg: { type: 'string', description: 'The SVG markup.' },
        caption: { type: 'string' },
      },
      required: ['svg'],
    },
  },
  {
    name: 'design_container',
    description: 'Design and preview a shipping-container or portacabin structure: offices, site offices, shops, kiosks, cafés, homes, staff quarters, clinics, salons, gatehouses, storage, stacked or joined units. Shows an interactive isometric 3D preview, dimensioned floor plan and NGN cost estimate. Give just the intent in `brief` (use, headcount, rooms, size, levels, arrangement, budget, colour, style) and the engine picks sizes and lays out rooms, doors, windows, furniture and stairs; or give exact `modules` with openings/fittings; mix both. To change an existing design ("add a window on the left", "make it 40ft", "paint it blue", "add a roof deck"), call again with `revise` = its design id (or "last") plus `changes` — never start over. Use for ANY container building request instead of drawing it yourself. Lengths in metres; walls: front = door end, back, left, right (long sides).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Optional name for the design.' },
        revise: { type: 'string', description: 'Design id to update (from an earlier result), or "last". Omit to create a new design.' },
        brief: {
          type: 'object',
          description: 'What the person wants. Fill only what they said; the engine decides the rest.',
          properties: {
            use: { type: 'string', description: 'e.g. office, site office, coffee shop, shop, kiosk, home, bunkhouse, clinic, salon, gatehouse, storage, classroom, toilet block.' },
            headcount: { type: 'number', description: 'Staff / desks, seats for a café, or beds for quarters.' },
            rooms: { type: 'array', description: 'Rooms wanted, e.g. ["toilet", "reception", "manager\'s office upstairs", "meeting room upstairs", "2 bedrooms"]. Objects allowed: {name, level ("ground"|"upper"), desks, seats, bunks, length_m}.', items: { type: 'object', properties: { name: { type: 'string' }, level: { type: 'string' }, desks: { type: 'number' }, seats: { type: 'number' }, bunks: { type: 'number' }, length_m: { type: 'number' } } } },
            size: { type: 'string', description: '10ft, 20ft, 40ft, 40hc, 45hc, or a cabin: pc12, pc16, pc20, pc24, pc32.' },
            containers: { type: 'number', description: 'Total number of units, if stated.' },
            levels: { type: 'number', description: 'Storeys (1 or 2).' },
            arrangement: { type: 'string', enum: ['single', 'side-by-side', 'row', 'L', 'T', 'stacked'] },
            budget_ngn: { type: 'number' },
            color: { type: 'string', description: 'green, blue, red, grey, white or sand.' },
            style: { type: 'array', items: { type: 'string' }, description: 'Keywords: glass front, timber, composite cladding, canopy, deck, roof deck, pitched roof, modern.' },
          },
        },
        modules: {
          type: 'array',
          description: 'Exact units, when the person specifies them. Omitted fields are auto-filled.',
          items: {
            type: 'object',
            properties: {
              size: { type: 'string' }, length_m: { type: 'number' }, width_m: { type: 'number' }, height_m: { type: 'number' },
              x_m: { type: 'number', description: 'Site position of the back-left corner.' }, z_m: { type: 'number' },
              level: { type: 'number', description: '0 = ground, 1 = stacked on top.' }, rotation: { type: 'number', enum: [0, 90] }, color: { type: 'string' },
              rooms: { type: 'array', description: 'Back to front, e.g. ["toilet", "office", "reception"].', items: { type: 'string' } },
              openings: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', description: 'door, double-door, glass-door, roller-door, window, small-window, vent, serving-hatch, glass-wall.' }, wall: { type: 'string', enum: ['front', 'back', 'left', 'right'] }, along_m: { type: 'number', description: 'Centre, metres from the wall’s start. Omit to auto-place.' }, room: { type: 'string' }, width_m: { type: 'number' } } } },
              fittings: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', description: 'partition, desk, chair, bed, bunk, kitchen, toilet, shower, basin, rack, cabinet, table, sofa, counter, reception, fridge, stool, bistro, ac.' }, room: { type: 'string' }, x_m: { type: 'number' }, z_m: { type: 'number' }, rotation: { type: 'number' } } } },
            },
          },
        },
        changes: {
          type: 'array',
          description: 'Edits for `revise`. action: add_opening {type, wall, along_m?, room?} | add_fitting {type, room?} | remove {type or item id, wall?, all?} | move {item, wall?, along_m?} | resize {size or length_m} | recolor {color} | add_room {room} | set_rooms {rooms} | add_module {size, level} | remove_module | set_extras {stairs, roof_deck, canopy, pitched_roof, cladding, glass_wall, deck} | set_brief {…brief fields}. `module` = unit id ("m2") or number, default the first.',
          items: { type: 'object', properties: { action: { type: 'string' }, module: { type: 'string' }, type: { type: 'string' }, wall: { type: 'string' }, along_m: { type: 'number' }, item: { type: 'string' }, room: { type: 'string' }, size: { type: 'string' }, length_m: { type: 'number' }, color: { type: 'string' }, rooms: { type: 'array', items: { type: 'string' } }, level: { type: 'number' }, all: { type: 'boolean' } } },
        },
        extras: {
          type: 'object',
          properties: {
            stairs: { type: 'boolean', description: 'External stair (auto for two storeys or a roof deck).' },
            roof_deck: { type: 'boolean' }, pitched_roof: { type: 'boolean' },
            canopy: { type: 'string', enum: ['none', 'entrance', 'full'] },
            cladding: { type: 'string', enum: ['none', 'timber', 'composite'] },
            glass_wall: { type: 'boolean', description: 'Glass curtain wall on the entrance side.' },
            deck: { type: 'boolean', description: 'Deck / verandah beside the entrance.' },
          },
        },
        spec_level: { type: 'string', enum: ['economy', 'standard', 'premium'], description: 'Finish specification for the estimate (default standard; economy is chosen automatically to meet a budget).' },
        units: { type: 'string', enum: ['ft', 'm'], description: 'Units shown on the plan (default ft).' },
        client_supplies_container: { type: 'boolean' },
      },
    },
  },
  {
    name: 'create_invoice',
    description: "Create an invoice (or quotation) and save it as a draft in the user's Invoice Generator records, with Nigerian VAT (7.5%) and withholding tax handled. Amounts are in major units (naira, not kobo). The client is matched by name or created. Returns the number, totals and amount in words, with a card that opens the invoice. Prefer this over generate_invoice whenever the user wants the invoice kept, sent or tracked.",
    parameters: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Client name. An existing client with this name is reused; otherwise one is created.' },
        client_email: { type: 'string' },
        client_address: { type: 'string' },
        items: {
          type: 'array',
          description: 'Line items.',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              qty: { type: 'number', description: 'Quantity (default 1). Hours can be fractional.' },
              rate: { type: 'number', description: 'Unit price in major units, e.g. 4850000 for ₦4,850,000.' },
              unit: { type: 'string', description: 'Optional unit, e.g. hr, m², trip.' },
              discount: { type: 'number', description: 'Optional discount percent for this line.' },
            },
            required: ['description', 'rate'],
          },
        },
        type: { type: 'string', enum: ['invoice', 'quote'], description: 'Default invoice.' },
        currency: { type: 'string', enum: ['NGN', 'USD', 'GBP', 'EUR'], description: 'Default: the user\'s preference (usually NGN).' },
        fx_rate: { type: 'number', description: 'Naira per 1 unit of a foreign currency, for the Naira equivalent.' },
        vat: { type: 'boolean', description: 'Charge VAT at 7.5% on all lines (default: the user\'s preference, usually yes).' },
        wht: { type: 'number', description: 'Withholding tax percent deducted by the client: 0, 5 (contracts, supplies) or 10 (professional fees). Default: preference.' },
        due_days: { type: 'number', description: 'Days until payment is due (default: preference, usually 14).' },
        reference: { type: 'string', description: 'PO number or matter reference.' },
        notes: { type: 'string' },
      },
      required: ['client', 'items'],
    },
  },
  {
    name: 'list_invoices',
    description: "List the user's saved invoices or quotes with status (draft, sent, partially paid, paid, overdue, void) and totals, plus what is outstanding and overdue. Use to answer who owes money, what is overdue, or what was paid this month.",
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'draft', 'outstanding', 'overdue', 'partial', 'paid', 'void', 'sent', 'accepted', 'converted', 'declined', 'expired'], description: 'Filter (default all).' },
        type: { type: 'string', enum: ['invoice', 'quote'], description: 'Default invoice.' },
        client: { type: 'string', description: 'Only this client (name).' },
        limit: { type: 'number', description: 'Max rows (default 20).' },
      },
    },
  },
  {
    name: 'find_toolbox_tools',
    description: 'Search the 130+ Toolbox tools by what they do. Returns ids, names and descriptions. Use before run_toolbox_tool or open_toolbox_tool when unsure which tool fits.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'run_toolbox_tool',
    description: 'Run any Toolbox tool without opening it. Text tools (json-tools, data-converter, sql-formatter, csv-tools, list-tools, text-extractor, date-calculator, number-to-words, cert-decoder, …) take `input`. File tools (pdf-ocr, pdf-compare, pdf-nup, pdf-protect, pdf-tables, pdf-to-image, pdf-workflow, video-compressor, video-trimmer, video-to-gif, audio-converter, audio-editor, lossless-archiver, …) use the attached file(s), or else the latest result from another tool, and return a downloadable file that the next tool can use in turn, so jobs chain. Pass options by field name; call with options {"help": true} to list a tool\'s modes and options. Tools that cannot run this way are opened for the person.',
    parameters: {
      type: 'object',
      properties: {
        tool_id: { type: 'string', description: 'Tool id from find_toolbox_tools, e.g. "json-formatter".' },
        input: { type: 'string', description: 'The text to process.' },
        options: { type: 'object', description: 'Tool options by field name, plus "mode" for text tools with modes. {"help": true} lists them.' },
      },
      required: ['tool_id'],
    },
  },
  {
    name: 'estimate_construction',
    description: 'Price a building or container-conversion job in naira with the Toolbox Construction Estimator: bill of quantities by element (concrete, rebar, blocks, plaster, screed, tiles, paint, roofing, doors/windows, excavation, hardcore, DPM, formwork), contingency, VAT 7.5%, and an aggregated shopping list (bags of cement, tonnes and tipper trips of sand/granite, 12 m rods by size, blocks, buckets of paint). Give `building` for a quick whole-building estimate from its outline, `container_base` for container foundations, and/or explicit `elements`. All dimensions metric. Rates are editable 2026 Nigerian estimates, so present totals as estimates. The user can open the result in the full estimator.',
    parameters: {
      type: 'object',
      properties: {
        project_name: { type: 'string' },
        client: { type: 'string' },
        site: { type: 'string' },
        building: {
          type: 'object',
          description: 'Rectangular building outline; generates footings, slab, columns, walls, lintels, beams, finishes and roof.',
          properties: {
            length: { type: 'number', description: 'metres' }, width: { type: 'number', description: 'metres' },
            storeys: { type: 'number', description: '1-4 (default 1)' }, wall_height: { type: 'number', description: 'metres per storey (default 3)' },
            finishes: { type: 'boolean', description: 'Include plaster, screed, tiles, paint, ceiling, doors and windows (default true).' },
            roof: { type: 'boolean', description: 'Include long-span roof and trusses (default true).' },
          },
          required: ['length', 'width'],
        },
        container_base: {
          type: 'object',
          description: 'Pad footings, plinth pedestals and an apron slab for shipping containers.',
          properties: { size: { type: 'string', enum: ['20', '40'] }, count: { type: 'number' }, apron: { type: 'boolean' } },
        },
        elements: {
          type: 'array',
          description: `Explicit elements. Each has "type" plus any of its fields (omitted fields use sensible defaults). Types and fields (m = metres, mm = millimetres, m2 = square metres): ${Object.entries(CE.ELEMENT_TYPES).map(([k, d]) => `${k}: ${d.fields.map(f => `${f.key}${['m', 'mm', 'm2', 'deg', 'pct'].includes(f.kind) ? `(${f.kind})` : f.kind === 'select' ? `(${f.options.map(o => o.value).join('|')})` : ''}`).join(', ')}`).join('; ')}.`,
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: Object.keys(CE.ELEMENT_TYPES) },
              name: { type: 'string', description: 'Label for this section of the bill.' },
            },
            required: ['type'],
          },
        },
        contingency_pct: { type: 'number', description: 'Default 5.' },
        vat: { type: 'boolean', description: 'Add VAT at 7.5% (default: the user\'s preference).' },
        waste_pct: { type: 'number', description: 'Material waste allowance (default: the user\'s preference, usually 5).' },
        grade: { type: 'string', enum: ['C15', 'C20', 'C25', 'C30'], description: 'Default concrete grade.' },
        region: { type: 'string', enum: Object.keys(CE.REGIONS), description: 'Rate region (default: the user\'s preference, Lagos).' },
      },
    },
  },
  {
    name: 'open_toolbox_tool',
    description: 'Open a Toolbox tool for the user (navigates the app). Use when the user wants to work in a tool themselves, or after preparing something they should continue in the full tool.',
    parameters: {
      type: 'object',
      properties: { tool_id: { type: 'string' } },
      required: ['tool_id'],
    },
  },
  {
    name: 'analyze_legal_document',
    description: 'Review a contract, lease, tenancy agreement, deed or other legal instrument for Nigerian practice: parties, clause map, missing clauses, risk flags (one-sided indemnity, uncapped liability, automatic renewal, unilateral termination, foreign governing law, Lagos tenancy rules), obligations with deadlines, execution check and stamp duty / registration reminders. Pass the document text in `text` (for an attached PDF or Word file, pass the text you can read from it). Results are heuristic prompts for review, not advice.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Full text of the document.' },
        doc_type: { type: 'string', enum: ['auto', 'tenancy', 'supply', 'services', 'employment', 'nda', 'loan', 'assignment', 'poa', 'mou', 'generic'], description: 'Document type (default: detect).' },
        state: { type: 'string', enum: ['auto', 'lagos', 'fct', 'other'], description: 'Which State\'s tenancy rules apply (default: detect).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'parse_citations',
    description: 'Extract and normalise every legal citation in a text: Nigerian law reports (NWLR with Pt., LPELR, All FWLR, SC, SCNJ …), foreign reports (AC, QB, WLR, All ER, neutral citations), suit/appeal numbers, statutes (with Cap. LFN references), Constitution sections and rules of court (Order/Rule), and build a table of authorities with pinpoints, court and whether each case binds a chosen court. Only what is in the text is returned; nothing is looked up.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text containing citations (a brief, judgment, opinion or list).' },
        forum: { type: 'string', enum: ['SC', 'CA', 'FHC', 'HC', 'FCTHC', 'NIC', 'MC'], description: 'Court the authorities will be cited before, for the binding/persuasive column (default HC).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'case_digest',
    description: 'Digest a Nigerian judgment or ruling from its text: court, parties, appeal/suit number, date, coram and lead judgment, facts, issues for determination and how each was resolved, arguments, holding and outcome, candidate ratio decidendi and obiter, orders, and a table of authorities, plus a citation built from the judgment. Pass the judgment text in `text`.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Full text of the judgment.' },
        forum: { type: 'string', enum: ['SC', 'CA', 'FHC', 'HC', 'FCTHC', 'NIC', 'MC'], description: 'Court to weigh the cited authorities against (default HC).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'model_3d',
    description: `Build and show a realistic, interactive 3D model of any structure or object: buildings, frames, trusses, roofs, stairs, towers, bridges, domes, space frames, shells, pavilions, furniture, machines, landmarks, sculptures. The person can orbit it, cut through it and download it (PNG, GLB). Reports back size, member count and a steel takeoff. Use it whenever someone asks to model, render, visualise or design something in 3D (containers use design_container instead). For an unfamiliar structure, look it up first (browse_web / knowledge_library) and model it from real proportions.
Write \`objects\` as a list of nodes. Units are metres, y is up, the ground is y = 0. Every node takes at [x,y,z], rotate [rx,ry,rz] in degrees, scale, material, color "#rrggbb", name and label (a text tag).
Materials: paint (painted steel), steel, galvanised, aluminium, chrome, glass, concrete, render, timber, brick, block, asphalt, grass, soil, water, marble, plastic, fabric, rubber, copper, gold, emissive.
Solids: box {size [w,h,d]} (centred on at), cylinder {radius, radiusTop, height} and cone (centred), sphere {radius, hemisphere}, torus {radius, tube, arc}, extrude {points [[x,z]…] plan outline, height, holes}, lathe {profile [[r,y]…]} (vases, columns, domes), tube {path [[x,y,z]…], radius} (handrails, cables, pipes), mesh {vertices, faces} (any custom shape).
Structural members: member {from, to, section} — sections like "RHS 100x50x4", "SHS 60x3", "CHS 114.3x5", "UB 406x178x60", "UC 254x254x73", "PFC 200x90", "rod 20", "cable 40", "300x600" (solid mm, e.g. concrete); polyline {points, section, closed}.
Repetition: group {children}, array {item, count, step [dx,dy,dz], rotateStep}, polar array {item, count, around {center, axis, angle}}, mirror {item, axis}.
Generators (parametric, preferred for real structures): ${Object.entries(STRUCTURE_GENERATORS).map(([k, v]) => `${k} {${v}}`).join('; ')}.
Model real proportions and real member sizes, add people (person) or trees for scale and context, and keep it to what was asked. To change a model, call again with the full updated description.`,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string', description: 'One or two sentences on what the model shows.' },
        environment: { type: 'string', enum: ['outdoor', 'studio'], description: 'outdoor (sky and ground, default) or studio (neutral backdrop, for objects).' },
        objects: { type: 'array', description: 'The nodes that make up the model.', items: { type: 'object', properties: { type: { type: 'string' } } } },
      },
      required: ['objects'],
    },
  },
];

/* ---------------- chess (engine in a worker so the chat stays smooth) ---------------- */

let chessModules = null;
async function chess() {
  if (!chessModules) {
    const [engine] = await Promise.all([import('../chess/engine.js')]);
    chessModules = { engine };
  }
  return chessModules;
}

function chessWorker() {
  return new Worker(new URL('../chess/worker.js', import.meta.url), { type: 'module' });
}

function askWorker(msg, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const w = chessWorker();
    const t = setTimeout(() => { w.terminate(); reject(new Error('The chess engine took too long.')); }, timeout);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || 'Chess engine error')); };
    w.postMessage({ id: 1, ...msg });
  });
}

/** Build a position from fen / pgn / moves. Returns { pos, startFen, uci[] } */
async function positionFrom({ fen, pgn, moves }) {
  const { engine } = await chess();
  const { Position, START_FEN, parsePgn } = engine;
  let startFen = START_FEN;
  let list = [];
  if (pgn && String(pgn).trim()) {
    const parsed = parsePgn(pgn);
    startFen = parsed.startFen;
    const p = new Position(startFen);
    for (const m of parsed.moves) { list.push(p.toUci(m)); p.make(m); }
  } else {
    if (fen && String(fen).trim() && !/^start/i.test(fen)) startFen = new Position(fen).fen();
    const p = new Position(startFen);
    for (const raw of moves || []) {
      const m = p.fromSan(String(raw).trim());
      if (!m) throw new Error(`"${raw}" is not a legal move in that position (${p.fen()}).`);
      list.push(p.toUci(m)); p.make(m);
    }
  }
  const pos = new Position(startFen);
  const sans = [];
  for (const u of list) { const m = pos.fromSan(u); sans.push(pos.toSan(m)); pos.make(m); }
  return { pos, startFen, uci: list, sans };
}

function describeStatus(pos, st) {
  const side = pos.turn === 0 ? 'White' : 'Black';
  if (st.over) {
    if (st.reason === 'checkmate') return `Checkmate — ${side === 'White' ? 'Black' : 'White'} wins.`;
    return `Draw (${st.reason}).`;
  }
  return `${side} to move${st.check ? ', in check' : ''}.`;
}

const fmtEval = (cp, mate) => mate ? `mate in ${Math.abs(mate)} for ${mate > 0 ? 'White' : 'Black'}` : `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)} (White's view)`;

async function chessAnalyze(args) {
  const { pos, startFen, uci, sans } = await positionFrom(args);
  const st = pos.status();
  const time = { fast: 500, normal: 1500, deep: 3500 }[args.depth] || 1500;
  const result = {
    status: 'success', renderer: 'chess-board', type: 'chess-board',
    fen: pos.fen(), startFen, moves: sans, turn: pos.turn === 0 ? 'white' : 'black',
    check: st.check, gameOver: st.over, result: st.result || null, reason: st.reason || null,
    legalMoves: st.moves.map(m => pos.toSan(m, st.moves)).slice(0, 60),
    summary: describeStatus(pos, st),
  };
  if (!st.over) {
    const a = await askWorker({ type: 'analyse', startFen, moves: uci, timeMs: time }, time + 15000);
    Object.assign(result, {
      evaluation: a.score, mate: a.mate || 0, evalText: fmtEval(a.score, a.mate),
      bestMove: a.san, bestMoveUci: a.move, principalVariation: a.pvSan?.slice(0, 8) || [], depth: a.depth,
      arrows: a.move ? [{ from: a.move.slice(0, 2), to: a.move.slice(2, 4), kind: 'best' }] : [],
    });
  }
  if (args.move_to_judge && !st.over) {
    const m = pos.fromSan(String(args.move_to_judge));
    if (!m) throw new Error(`"${args.move_to_judge}" is not legal here. Legal moves: ${result.legalMoves.join(', ')}`);
    const r = await askWorker({ type: 'review', startFen, moves: uci, played: pos.toUci(m), timeMs: time }, time * 2 + 15000);
    const loss = r.loss;
    const verdict = r.forced ? 'only move' : r.isBest ? 'best move' : loss < 0.02 ? 'excellent' : loss < 0.05 ? 'good' : loss < 0.1 ? 'inaccuracy' : loss < 0.2 ? 'mistake' : 'blunder';
    result.judgement = {
      move: pos.toSan(m), verdict, bestMove: r.best?.san, bestLine: r.best?.pvSan?.slice(0, 6),
      evalBefore: fmtEval(r.bestScore, r.best?.mate), evalAfter: fmtEval(r.playedScore, r.after?.mate),
      refutation: r.after?.pvSan?.slice(0, 4) || [], winChanceLost: Math.round(loss * 100),
    };
  }
  let opening = null;
  try {
    if (startFen === (await chess()).engine.START_FEN && sans.length) {
      const { buildBook, posKey } = await import('../chess/book.js');
      const book = new Map(buildBook().positions.map(([k, eco, name]) => [k, [eco, name]]));
      const { engine } = await chess();
      const p = new engine.Position();
      for (const u of uci) { p.make(p.fromSan(u)); const hit = book.get(posKey(p)); if (hit) opening = { eco: hit[0], name: hit[1] }; }
    }
  } catch { /* book is optional */ }
  result.opening = opening;
  result.message = `${result.summary}${result.bestMove ? ` Best move: ${result.bestMove} (${result.evalText}).` : ''}`;
  return result;
}

async function chessPlay(args) {
  const { pos, startFen, uci } = await positionFrom(args);
  const played = [];
  let st = pos.status();
  if (args.move && !st.over) {
    const m = pos.fromSan(String(args.move).trim());
    if (!m) {
      const legal = st.moves.map(x => pos.toSan(x, st.moves));
      return { status: 'error', message: `${args.move} is not legal here. ${describeStatus(pos, st)} Legal moves: ${legal.join(', ')}` };
    }
    played.push({ by: pos.turn === 0 ? 'white' : 'black', san: pos.toSan(m) });
    uci.push(pos.toUci(m)); pos.make(m); st = pos.status();
  }
  const wantReply = args.engine_reply !== false;
  if ((wantReply || !args.move) && !st.over) {
    const r = await askWorker({ type: 'play', startFen, moves: uci, level: Math.max(1, Math.min(10, Number(args.level) || 6)) });
    const m = pos.fromSan(r.move);
    played.push({ by: pos.turn === 0 ? 'white' : 'black', san: pos.toSan(m), engine: true });
    uci.push(pos.toUci(m)); pos.make(m); st = pos.status();
  }
  const { engine } = await chess();
  const replay = new engine.Position(startFen); const sans = [];
  for (const u of uci) { const m = replay.fromSan(u); sans.push(replay.toSan(m)); replay.make(m); }
  const last = uci[uci.length - 1];
  return {
    status: 'success', renderer: 'chess-board', type: 'chess-board',
    fen: pos.fen(), startFen, moves: sans, played, turn: pos.turn === 0 ? 'white' : 'black',
    check: st.check, gameOver: st.over, result: st.result || null, reason: st.reason || null,
    lastMove: last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null,
    summary: describeStatus(pos, st),
    message: `${played.map(p => `${p.by === 'white' ? 'White' : 'Black'} played ${p.san}${p.engine ? ' (engine)' : ''}`).join('. ')}. ${describeStatus(pos, st)} FEN: ${pos.fen()}`,
  };
}

async function chessOpenBoard(args) {
  const { startFen, uci, sans } = await positionFrom(args);
  const game = {
    id: Date.now(), mode: 'analysis', human: 'w', startFen,
    moves: uci.map((u, i) => ({ uci: u, san: sans[i] })), cursor: uci.length, result: null, flipped: false, clock: null,
  };
  try { localStorage.setItem('toolbox_chess_game_v1', JSON.stringify(game)); } catch { /* storage full */ }
  window.location.hash = '#chess';
  return { status: 'success', openedToolId: 'chess', message: `Opened the Chess board with ${uci.length ? `${uci.length} moves` : 'the position'} loaded for analysis.` };
}

/* ---------------- devices ---------------- */

async function devicesDb() { return import('../devices/db.js'); }

async function findDevice(name, category) {
  const db = await devicesDb();
  const cats = category && db.CATEGORIES[category] ? [category] : db.CATEGORY_ORDER;
  let best = null;
  for (const c of cats) {
    const data = await db.loadCategory(c);
    const hits = db.searchDevices(data, name, 3);
    if (!hits.length) continue;
    const h = hits[0];
    const exact = lower(h.name) === lower(name) || lower(`${h.brand} ${h.name}`) === lower(name);
    const score = (exact ? 100 : 0) + (lower(h.name).startsWith(lower(name)) ? 20 : 0) + (h._score || 0) / 10;
    if (!best || score > best.score) best = { score, device: h, data, category: c };
  }
  return best;
}

function keySpecs(db, category, d, max = 18) {
  const def = db.CATEGORIES[category];
  const out = {};
  for (const f of def.fields) {
    if (/Id$/.test(f.key) || d[f.key] == null) continue;
    out[f.label] = db.formatValue(f, d[f.key], 'metric');
    if (Object.keys(out).length >= max) break;
  }
  return out;
}

async function deviceSpecs({ query = '', category, rank_by: rankBy, limit = 5 }) {
  const db = await devicesDb();
  const n = Math.max(1, Math.min(15, Number(limit) || 5));
  if (rankBy && category && db.CATEGORIES[category]) {
    const data = await db.loadCategory(category);
    const field = db.CATEGORIES[category].fields.find(f => f.key === rankBy);
    const sub = data.scores.find(s => s.key === rankBy);
    const val = (d) => rankBy === 'score' ? d._score : rankBy === 'value' ? d._value : sub ? d._scores[rankBy] : d[rankBy];
    let list = data.devices.filter(d => val(d) != null && (!query || d._search.includes(lower(query))));
    list.sort((a, b) => (field?.better === 'low' ? val(a) - val(b) : val(b) - val(a)));
    list = list.slice(0, n);
    return {
      status: 'success', renderer: 'device-list', type: 'device-list', category, rankBy,
      devices: list.map(d => ({ id: d.id, name: d.name, brand: d.brand, released: d.released, price: d.price, score: d._score, valueScore: d._value, value: field ? db.formatValue(field, d[rankBy], 'metric') : val(d) })),
      message: `Top ${list.length} ${db.CATEGORIES[category].label.toLowerCase()} by ${field?.label || rankBy}.`,
    };
  }
  if (!query) return { status: 'error', message: 'Give a device name, or a category with rank_by.' };
  const cats = category && db.CATEGORIES[category] ? [category] : db.CATEGORY_ORDER;
  const results = [];
  for (const c of cats) {
    const data = await db.loadCategory(c);
    for (const d of db.searchDevices(data, query, n)) results.push({ d, c });
  }
  results.sort((x, y) => (lower(y.d.name).includes(lower(query)) - lower(x.d.name).includes(lower(query))) || (y.d._score || 0) - (x.d._score || 0));
  const top = results.slice(0, n);
  if (!top.length) return { status: 'error', message: `No device matching "${query}" in the Toolbox database. Try browse_web for very new or niche devices.` };
  return {
    status: 'success', renderer: 'device-list', type: 'device-list',
    devices: top.map(({ d, c }) => ({
      id: d.id, category: c, name: d.name, brand: d.brand, released: d.released, price: d.price,
      score: d._score, valueScore: d._value, rank: d._rank, subScores: d._scores, specs: keySpecs(db, c, d),
    })),
    message: `Found ${top.length} device(s) for "${query}".`,
  };
}

async function deviceCompare({ a, b, category }) {
  const db = await devicesDb();
  const A = await findDevice(a, category);
  if (!A) return { status: 'error', message: `Could not find "${a}" in the device database.` };
  const B = await findDevice(b, category || A.category);
  if (!B) return { status: 'error', message: `Could not find "${b}" in the device database.` };
  if (A.category !== B.category) return { status: 'error', message: `${A.device.name} is in ${A.category} but ${B.device.name} is in ${B.category}; they can't be compared directly.` };
  const c = A.category, x = A.device, y = B.device;
  try {
    const store = JSON.parse(localStorage.getItem('toolbox_devices_v2') || '{}');
    // one-shot hand-over: the tool applies it once, otherwise categories open blank
    store.cat = c; store.view = 'compare'; store.handoff = { cat: c, pair: [x.id, y.id] };
    localStorage.setItem('toolbox_devices_v2', JSON.stringify(store));
  } catch { /* storage unavailable */ }
  const specRows = db.CATEGORIES[c].fields.filter(f => !/Id$/.test(f.key) && (x[f.key] != null || y[f.key] != null)).slice(0, 40)
    .map(f => ({ label: f.label, a: db.formatValue(f, x[f.key], 'metric') || '—', b: db.formatValue(f, y[f.key], 'metric') || '—', winner: db.winner(f, x[f.key], y[f.key]) }));
  const V = db.verdicts(c, x, y);
  const verdict = (v) => ({ winner: v.winner === 'a' ? x.name : v.winner === 'b' ? y.name : v.winner, side: v.winner, headline: v.headline, explanation: v.text, figures: v.figures, ...(v.noPrice ? { noPriceData: true } : {}) });
  return {
    status: 'success', renderer: 'device-compare', type: 'device-compare', category: c,
    a: { id: x.id, name: x.name, brand: x.brand, score: x._score, valueScore: x._value, rank: x._rank, subScores: x._scores, released: x.released, price: x.price },
    b: { id: y.id, name: y.name, brand: y.brand, score: y._score, valueScore: y._value, rank: y._rank, subScores: y._scores, released: y.released, price: y.price },
    betterTech: verdict(V.tech),
    betterBuy: verdict(V.buy),
    sameWinner: V.same,
    subScoreLabels: Object.fromEntries(A.data.scores.map(s => [s.key, s.label])),
    whyA: db.reasons(c, x, y, 'metric', 6).map(r => `${r.title}${r.detail ? ` (${r.detail})` : ''}`),
    whyB: db.reasons(c, y, x, 'metric', 6).map(r => `${r.title}${r.detail ? ` (${r.detail})` : ''}`),
    specs: specRows,
    openHash: '#tech-device-comparisons',
    message: `${x.name} scores ${x._score ?? '—'} and ${y.name} scores ${y._score ?? '—'} out of 100 on specs in Toolbox's ${db.CATEGORIES[c].label.toLowerCase()} ranking. Better tech: ${V.tech.headline} — ${V.tech.text} Better buy: ${V.buy.headline} — ${V.buy.text}${V.summary ? ` ${V.summary}` : ''}`,
  };
}

/* ---------------- vehicles ---------------- */

/* Detailed Vehicle Guide packages: the one the person means, its manifest and spec sheet. */
const DEFAULT_VEHICLE = 'toyota-corolla-2014-2016';
const packages = new Map();
async function loadPackage(id = DEFAULT_VEHICLE) {
  if (!packages.has(id)) {
    const base = `/automobile/packages/${id}`;
    packages.set(id, Promise.all([fetch(`${base}/manifest.json`), fetch(`${base}/specs.json`)])
      .then(async ([m, s]) => ({ manifest: await m.json(), specs: s.ok ? await s.json() : null }))
      .catch((error) => { packages.delete(id); throw error; }));
  }
  return packages.get(id);
}
const loadCorollaPackage = () => loadPackage(DEFAULT_VEHICLE);

/** Which package to answer from: the vehicle named (or named in the question), else the Corolla. */
async function resolvePackage(vehicle, query) {
  const { vehicleFromText } = await import('../automobile/vehicle-controls.js');
  const named = vehicleFromText(vehicle) || vehicleFromText(query);
  // An unknown vehicle ("Honda Civic") is answered from the Corolla, with a caveat.
  return { id: named || DEFAULT_VEHICLE, mismatch: Boolean(vehicle && !named) };
}

async function vehiclePartTool({ query = '', vehicle = '' } = {}) {
  const { findPart, specRowsFor } = await import('../automobile/part-search.js');
  const { safetyFor } = await import('../automobile/injury-data.js');
  const { plainText } = await import('../automobile/injury-render.js');
  const target = await resolvePackage(vehicle, query);
  let pkg;
  try { pkg = await loadPackage(target.id); } catch { return { status: 'error', message: 'The Vehicle Guide data could not be loaded.' }; }
  const name = pkg.manifest.vehicle?.displayName || 'this vehicle';
  const kind = pkg.manifest.vehicle?.category === 'aircraft' ? 'aircraft' : 'car';
  const hit = findPart(pkg.manifest.components || [], query);
  if (!hit) return { status: 'error', message: `No part in the ${name} package matches "${query}". It has ${pkg.manifest.components.length} components; ask what it is called or what it does.` };
  const c = hit.component;
  const specRows = specRowsFor(pkg.specs, c);
  const safety = safetyFor(c.id, { kind });
  const lines = [
    `${c.label} (${c.category}). Where: ${c.location || 'not recorded'}.`,
    c.description, c.specs ? `Specs: ${typeof c.specs === 'string' ? c.specs : JSON.stringify(c.specs)}` : '',
    c.maintenance ? `Maintenance: ${c.maintenance}` : '', c.failures ? `Common failures: ${c.failures}` : '',
    specRows.length ? `Spec sheet: ${specRows.map(([, k, v]) => `${k}: ${v}`).join('; ')}.` : '',
    c.accuracyNote ? `Accuracy: ${c.accuracyNote}` : '',
    safety ? `Safety: ${plainText(safety.hazard)} Common injuries: ${safety.injuries.map(i => i.name).join('; ')}. Prevention: ${safety.prevention.map(plainText).join(' ')}` : '',
    target.mismatch ? `This is the ${name}; ${vehicle} may differ.` : '',
    'Shown to the user as a card with a "Show in 3D" button.',
  ];
  return {
    status: 'success', renderer: 'vehicle-part', type: 'vehicle-part',
    vehicleId: target.id, vehicle: name, kind, askedAbout: vehicle || '', mismatch: target.mismatch,
    component: { id: c.id, label: c.label, category: c.category, layer: c.layer, location: c.location || '', description: c.description || '', specs: c.specs || null, maintenance: c.maintenance || '', failures: c.failures || '', accuracyNote: c.accuracyNote || '', sources: (c.sources || []).slice(0, 4) },
    specRows,
    alternatives: hit.alternatives.map(a => ({ id: a.id, label: a.label })),
    hasSafety: Boolean(safety),
    message: lines.filter(Boolean).join('\n'),
  };
}

/* Car injuries: the injury reference behind the Vehicle Guide's safety sections. */
async function carInjuryTool({ query = '' } = {}) {
  const { findInjuries, safetyFor, DISCLAIMER } = await import('../automobile/injury-data.js');
  const { plainText } = await import('../automobile/injury-render.js');
  let injuries = findInjuries(query);
  let part = null;
  if (!injuries.length || /\b(belt|airbag|seat|tyre|tire|brake|battery|radiator|coolant|exhaust|door|window|jack|fan|dashboard|steering|head ?rest|bonnet|hood|boot|trunk)\b/i.test(query)) {
    const { findPart } = await import('../automobile/part-search.js');
    try {
      const pkg = await loadCorollaPackage();
      const hit = findPart(pkg.manifest.components || [], query);
      const safety = hit && safetyFor(hit.component.id);
      if (safety) { part = { id: hit.component.id, label: hit.component.label, hazard: safety.hazard, prevention: safety.prevention }; injuries = safety.injuries; }
    } catch { /* the injury list alone still answers */ }
  }
  if (!injuries.length) return { status: 'error', message: `No car-related injury matches "${query}". Try an injury (whiplash, femur fracture, burns), a body part, or a car part (seat belt, airbag, battery).` };
  injuries = injuries.slice(0, 6);
  return {
    status: 'success', renderer: 'car-injury', type: 'car-injury',
    query, part, injuries: injuries.map(i => i.id),
    message: [
      part ? `${part.label}: ${plainText(part.hazard)}` : '',
      ...injuries.map(i => `${i.name} (${i.severity}): ${plainText(i.what)} First aid: ${plainText(i.firstAid)} Likely treatment: ${(i.treatment || []).map(plainText).join(' ')}`),
      part ? `Prevention: ${part.prevention.map(plainText).join(' ')}` : '',
      'Shown as a card; drugs link to the Compound Database and injury sites open in the Anatomy Explorer.',
      DISCLAIMER,
    ].filter(Boolean).join('\n'),
  };
}

/* The researched controls libraries: find what the person means and show that part of the vehicle. */
async function vehicleControlsTool({ query = '', vehicle = '' } = {}) {
  const { controlsFor } = await import('../automobile/vehicle-controls.js');
  const target = await resolvePackage(vehicle, query);
  let lib = controlsFor(target.id);
  if (!lib.clusters.length) lib = controlsFor(DEFAULT_VEHICLE);
  const names = { 'toyota-corolla-2014-2016': 'Toyota Corolla 2014–2016 (E170)', 'lexus-gx-470-2008': 'Lexus GX 470 (2008)', 'boeing-737-800': 'Boeing 737-800', 'cessna-172s': 'Cessna 172S Skyhawk SP' };
  const name = names[lib.vehicleId] || lib.vehicleId;
  const hit = lib.find(`${query}`);
  if (!hit) {
    return { status: 'error', message: `Could not tell which part of the ${name} that is. Ask where it is (door, steering wheel or yoke, dashboard or panel, ceiling or overhead, outside) and what the symbol looks like.` };
  }
  const cl = hit.cluster, ctl = hit.control;
  return {
    status: 'success', renderer: 'vehicle-controls', type: 'vehicle-controls',
    vehicleId: lib.vehicleId, vehicle: name,
    askedAbout: vehicle || '', mismatch: target.mismatch,
    cluster: cl.id, clusterName: cl.name, where: cl.where,
    control: ctl?.id || null,
    alternatives: hit.alternatives.map(id => ({ id, name: lib.byId[id]?.name })).filter(a => a.name),
    controls: cl.rows.flat().map(c => ({ id: c.id, label: c.label, what: c.what })),
    ...(ctl ? { best_match: { label: ctl.label, what: ctl.what, how: ctl.how || '', note: ctl.note || '', trim: ctl.trim || '' } } : {}),
    message: `Shown to the user as "One of these?": ${cl.name} (${cl.where})${ctl ? `, with "${ctl.label}" highlighted` : ''}. They can tap any control to read what it does.${target.mismatch ? ` The drawing is the ${name}; ${vehicle} may lay these out differently, though the symbols are standard.` : ''}${lib.note ? ` ${lib.note}` : ''}`,
  };
}

async function vehicleLookup({ query = '', open_guide: openGuide }) {
  const q = String(query).trim();
  const out = { status: 'success', renderer: 'vehicle', type: 'vehicle', query: q };
  if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(q)) {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(q)}?format=json`);
    const data = await res.json();
    const r = data.Results?.[0] || {};
    const pick = ['Make', 'Model', 'ModelYear', 'Trim', 'Series', 'BodyClass', 'VehicleType', 'DriveType', 'EngineCylinders', 'DisplacementL', 'EngineHP', 'FuelTypePrimary', 'TransmissionStyle', 'TransmissionSpeeds', 'Doors', 'Seats', 'PlantCountry', 'PlantCity', 'Manufacturer', 'GVWR', 'ErrorText'];
    out.vin = q.toUpperCase();
    out.decoded = Object.fromEntries(pick.filter(k => r[k] && r[k] !== 'Not Applicable').map(k => [k, r[k]]));
    out.title = [r.ModelYear, r.Make, r.Model, r.Trim].filter(Boolean).join(' ') || 'Unknown vehicle';
    out.message = `VIN ${out.vin} decodes to ${out.title}.`;
    return out;
  }
  try {
    const res = await fetch(`/api/automotive/resolve?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    out.models = (data.results || []).slice(0, 25).map(m => `${m.Make_Name} ${m.Model_Name}`);
    out.summary = data.meta?.extract || null;
    out.image = data.meta?.image || null;
    out.title = data.meta?.title || q;
  } catch { out.title = q; }
  try {
    const { autoClient } = await import('../automotive-data.js');
    const pkgs = await autoClient.searchVehicles(q);
    if (pkgs.length) {
      const p = pkgs[0];
      out.package = { id: p.id, name: `${p.manufacturer} ${p.model}`, years: p.years };
      const specs = await autoClient.getVehicleDetails(p.id, p.manufacturer, p.model);
      if (specs?.specSheet?.groups) {
        out.specSheet = specs.specSheet.groups.slice(0, 8).map(g => ({ group: g.title || g.name, rows: (g.rows || g.items || []).slice(0, 10) }));
      } else if (specs && Object.keys(specs).length) out.specifications = specs;
      if (openGuide) {
        try { localStorage.setItem('toolbox.automobile.focus', JSON.stringify({ vehicleId: p.id })); } catch { /* the guide still opens */ }
        window.location.hash = '#automobile-guide';
      }
    }
  } catch { /* packages are optional */ }
  out.message = [out.summary ? out.summary.slice(0, 900) : '', out.models?.length ? `Models found: ${out.models.slice(0, 12).join(', ')}.` : '', out.package ? `A detailed 3D package exists in the Vehicle Guide: ${out.package.name}.` : ''].filter(Boolean).join('\n') || `No vehicle data found for "${q}".`;
  return out;
}

/* ---------------- notes ---------------- */

function updateNote({ note, title, body, append }) {
  const KEY = 'toolbox_notes_v1';
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* empty */ }
  const key = lower(note);
  const match = notes.find(n => lower(n.id) === key) || notes.find(n => lower(n.title) === key) || notes.find(n => lower(n.title).includes(key));
  if (!match) return { status: 'error', message: `No note matches "${note}".` };
  if (title) match.title = String(title).trim();
  if (typeof body === 'string') match.body = body;
  if (append) match.body = `${match.body || ''}${match.body ? '\n\n' : ''}${append}`;
  match.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent('toolbox:notes-changed', { detail: { id: match.id } }));
  return { status: 'success', renderer: 'note', type: 'note', noteId: match.id, title: match.title, body: match.body, folder: match.folder, message: `Updated note "${match.title}".` };
}

/* ---------------- illustration ---------------- */

export function sanitizeSvg(svg) {
  let s = String(svg || '').trim();
  const start = s.indexOf('<svg');
  const end = s.lastIndexOf('</svg>');
  if (start < 0 || end < 0) throw new Error('The drawing must be SVG markup starting with <svg and ending with </svg>.');
  s = s.slice(start, end + 6);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript:|https?:|data:text)[^"']*\2/gi, '');
  if (!/viewBox=/i.test(s)) {
    const w = /\swidth="(\d+(?:\.\d+)?)/.exec(s)?.[1] || 400, h = /\sheight="(\d+(?:\.\d+)?)/.exec(s)?.[1] || 300;
    s = s.replace('<svg', `<svg viewBox="0 0 ${w} ${h}"`);
  }
  return s;
}

/* ---------------- Toolbox tools ---------------- */

function findTools(query) {
  const terms = lower(query).split(/\s+/).filter(Boolean);
  const scored = TOOLS.map(t => {
    const hay = lower([t.id, t.name, t.description, ...(t.keywords || []), ...(t.synonyms || []), ...(t.intents || [])].join(' '));
    const s = terms.reduce((a, w) => a + (hay.includes(w) ? 1 : 0) + (lower(t.name).includes(w) ? 1 : 0), 0);
    return { t, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
  return {
    status: 'success',
    tools: scored.map(({ t }) => ({ id: t.id, name: t.name, description: t.description, category: t.category })),
    message: scored.length ? `Matching tools: ${scored.map(x => x.t.id).join(', ')}` : 'No matching tools.',
  };
}

/* Attached files and earlier results, as work items for a file tool. */
async function inputFiles(ctx, tool, wanted) {
  const { kindOf, toItem } = await import('../interop.js');
  const { recent } = await import('../recent.js');
  const accepts = new Set(tool.accepts || []);
  const fits = (it) => !accepts.size || accepts.has(it.kind);
  const toBytes = (b64) => Uint8Array.from(atob(String(b64).replace(/^data:[^,]*,/, '')), c => c.charCodeAt(0));
  const out = [];
  const cf = ctx?.currentFile;
  const attached = cf ? (Array.isArray(cf.files) && cf.files.length ? cf.files : [cf]) : [];
  for (const f of attached) {
    const b64 = f.base64 || f.dataUrl;
    if (!b64) continue;
    const item = await toItem({ name: f.name || 'file', type: f.type, data: toBytes(b64) });
    if (fits(item)) out.push(item);
  }
  // Nothing attached: take the newest results that fit, so "now compress it" works.
  if (!out.length) for (const r of recent([...accepts])) { if (out.length >= wanted) break; if (r.blob) out.push(r); }
  if (!out.length && ctx?.taskState?.lastProcessedFile?.dataUrl) {
    const lp = ctx.taskState.lastProcessedFile;
    const item = await toItem({ name: lp.filename || 'file', type: (lp.dataUrl.match(/^data:([^;,]+)/) || [])[1], data: toBytes(lp.dataUrl) });
    if (fits(item)) out.push(item);
  }
  return out.map(i => ({ name: i.name, data: i.blob, type: i.blob?.type || '', kind: i.kind || kindOf(i.name) }));
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(s)}`;
}

/* A file tool's result, as a chat result: one file to download (several are zipped). */
async function fileResult(tool, res, ctx) {
  const { mimeOf } = await import('../kit/file-tool.js');
  const { publish, kindOf } = await import('../interop.js');
  const files = (res.files || []).map(f => ({ name: f.name, blob: f.data instanceof Blob ? f.data : new Blob([f.data], { type: f.type || mimeOf(f.name) }) }));
  for (const f of files) publish({ name: f.name, kind: kindOf(f.name, f.blob.type), blob: f.blob, from: tool.id });
  const note = typeof res.note === 'string' ? res.note : '';
  if (!files.length) return { status: 'success', renderer: 'transform', type: 'transform', operation: tool.name, resultText: res.text || note || 'Done.', message: `${tool.name}: ${note || res.text || 'done, nothing to download.'}` };
  let out = files[0];
  if (files.length > 1) {
    const { createZip } = await import('../pdf/zip.js');
    const entries = await Promise.all(files.map(async f => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
    out = { name: res.zipName || `${tool.id}.zip`, blob: new Blob([createZip(entries)], { type: 'application/zip' }) };
  }
  const dataUrl = await blobToDataUrl(out.blob);
  const ext = out.name.split('.').pop().toLowerCase();
  const result = {
    status: 'success', type: /^image\//.test(out.blob.type) ? 'image' : 'file', renderer: /^image\//.test(out.blob.type) ? 'image' : 'file',
    operation: tool.name, filename: out.name, format: ext, dataUrl, size: out.blob.size,
    message: `${tool.name} made ${files.length > 1 ? `${files.length} files (${files.map(f => f.name).join(', ')}), zipped as ${out.name}` : out.name} (${Math.round(out.blob.size / 1024)} KB).${note ? ` ${note}` : ''}${res.text ? `\n${String(res.text).slice(0, 4000)}` : ''} It is ready to download and is also in Recent, so another tool can use it next.`,
  };
  if (ctx?.taskState) ctx.taskState.lastProcessedFile = result;
  return result;
}

async function runTool({ tool_id: id, input = '', options = {} }, ctx = {}) {
  const tool = TOOLS.find(t => t.id === id || t.id === String(id).replace(/_/g, '-'));
  if (!tool) return { status: 'error', message: `No tool "${id}". Use find_toolbox_tools.` };
  try {
    const modules = import.meta.glob('../../tools/*.js');
    const loader = modules[`../../tools/${tool.id}.js`];
    const instance = loader ? (await loader()).default : null;

    /* Tools built on the shared shells run directly: same code, no UI. */
    if (options?.help || options?.describe) {
      if (instance?.describe) return { status: 'success', tool: tool.id, ...instance.describe(), message: `${tool.name} options listed. Pass them in options (and "mode" for text tools).` };
    }
    if (instance?.runHeadless && instance.describe?.().kind === 'text') {
      const res = await instance.runHeadless(String(input ?? ''), options || {});
      const text = res.text || (res.html ? res.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
      const stats = (res.stats || []).map(([l, v]) => `${v} ${l}`).join(', ');
      return { status: 'success', renderer: 'transform', type: 'transform', operation: tool.name, output: text, resultText: text, message: `Ran ${tool.name}${res.mode ? ` (${res.mode})` : ''}.${stats ? ` ${stats}.` : ''}` };
    }
    if (instance?.runHeadless) {
      const d = instance.describe();
      const files = await inputFiles(ctx, tool, d.maxFiles || 1);
      if (files.length < (d.minFiles || 1)) {
        return { status: 'needs_file', message: `${tool.name} needs ${d.minFiles > 1 ? `${d.minFiles} files` : 'a file'} (${(tool.accepts || []).join(', ') || 'any'}). Ask the person to attach ${d.minFiles > 1 ? 'them' : 'one'}, or make one with another tool first.` };
      }
      const res = await instance.runHeadless(files, options || {});
      return fileResult(tool, res || {}, ctx);
    }

    if (instance?.setArtifact && instance?.getArtifact) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;visibility:hidden';
      document.body.appendChild(host);
      try {
        await instance.render(host, {});
        instance.setArtifact({ kind: 'text', text: String(input), name: 'input', ...options });
        await new Promise(r => setTimeout(r, 60));
        const out = instance.getArtifact();
        if (out) return { status: 'success', renderer: 'transform', type: 'transform', operation: tool.name, output: out.text ?? JSON.stringify(out), resultText: out.text ?? JSON.stringify(out), message: `Ran ${tool.name}.` };
      } finally { try { instance.destroy?.(); } catch { /* ignore */ } host.remove(); }
    }
  } catch (e) { /* fall through to opening the tool */ console.warn('Headless run failed', e); }
  window.location.hash = `#${tool.id}`;
  return { status: 'success', openedToolId: tool.id, message: `${tool.name} can't run inside chat, so it was opened for the user.` };
}

/* ---------------- container design ---------------- */

function savedContainerRates() {
  try { return JSON.parse(localStorage.getItem('toolbox.container.rates') || '{}'); } catch { return {}; }
}

async function designContainerTool(args) {
  const { designContainer } = await import('../container-design.js');
  const design = designContainer(args, { rateBook: savedContainerRates() });
  const openingsBrief = (m) => m.items.filter(i => i.kind === 'opening').map(o => ({ id: o.id, type: o.type, wall: o.wall, along_m: o.along }));
  return {
    status: 'success', renderer: 'container-design', type: 'container-design',
    designId: design.id, version: design.version, title: design.title,
    message: `${design.version > 1 ? `Updated design ${design.id} (v${design.version})${design.changes?.length ? `: ${design.changes.join(', ')}` : ''}.` : `Created design ${design.id}.`} The preview card is shown to the person. Revise it with revise="${design.id}".\n${design.summary}`,
    units: design.modules.map(m => ({ id: m.id, label: m.label, size: m.size, level: m.level, x_m: m.x, z_m: m.z, rotation: m.rot, color: m.color, rooms: m.rooms.map(r => `${r.name} (${r.area} m²)`), openings: openingsBrief(m), furniture: m.items.filter(i => i.kind === 'fitting' && i.type !== 'partition').length })),
    estimateNgn: design.cost.total, specLevel: design.specLevel,
    warnings: design.warnings.map(w => w.text),
    design,
  };
}

/* ---------------- 3D structure models ---------------- */

async function model3dTool(args = {}) {
  const { expandStructure } = await import('../structure-model.js');
  const spec = { title: args.title || 'Model', description: args.description || '', environment: args.environment, objects: Array.isArray(args.objects) ? args.objects : [] };
  const m = expandStructure(spec);
  if (!m.prims.length && !m.members.length) {
    return { status: 'error', message: `Nothing to show: ${m.warnings.join(' ') || 'the model had no objects'}. Give objects such as {type: "box", size: [w,h,d], at: [x,y,z]} or a generator like {type: "truss", span: 20, height: 2}.` };
  }
  const s = m.bounds.size;
  const st = m.stats;
  const top = st.takeoff.slice(0, 5).map(r => `${r.count} × ${r.section} (${r.material}, ${r.lengthM} m, ${Math.round(r.massKg)} kg)`).join('; ');
  return {
    status: 'success', renderer: 'structure-model', type: 'structure-model', title: m.title,
    spec,
    size_m: { width: s[0], depth: s[2], height: s[1] },
    stats: { solids: st.solids, members: st.members, nodes: st.nodes, memberLengthM: st.memberLengthM, steelTonnes: st.steelT, byRole: st.roles },
    warnings: m.warnings,
    message: `3D model shown to the person: ${s[0]} × ${s[2]} m on plan, ${s[1]} m high; ${st.solids} solid parts, ${st.members} members${st.steelT ? `, about ${st.steelT} t of steel` : ''}.${top ? ` Main members: ${top}.` : ''}${m.warnings.length ? ` Notes: ${m.warnings.join(' ')}` : ''} Describe what you built in a sentence or two; do not repeat these numbers as a list unless asked.`,
  };
}

/* ---------------- construction estimate ---------------- */

async function estimateConstruction(args = {}) {
  let prefs = { units: 'm', waste: 5, grade: 'C20', region: 'lagos', vat: false };
  let overrides = {}, trips = {};
  try { prefs = { ...prefs, ...(await import('../tool-settings.js')).getToolSettings('concrete-estimator') }; } catch { /* defaults */ }
  try {
    const st = JSON.parse(localStorage.getItem('toolbox_construction_v1') || '{}');
    overrides = st.rates?.overrides || {}; trips = st.rates?.trips || {};
  } catch { /* storage unavailable */ }
  const elements = [];
  if (args.building && Number(args.building.length) > 0 && Number(args.building.width) > 0) {
    const b = args.building;
    elements.push(...CE.presetBuilding({ length: b.length, width: b.width, storeys: b.storeys, wallHeight: b.wall_height, finishes: b.finishes !== false, roof: b.roof !== false }));
  }
  if (args.container_base) elements.push(...CE.presetContainerBase(args.container_base));
  for (const raw of Array.isArray(args.elements) ? args.elements : []) {
    const type = String(raw?.type || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (!CE.ELEMENT_TYPES[type]) continue;
    const def = CE.ELEMENT_TYPES[type];
    const o = {};
    for (const f of def.fields) {
      const snake = f.key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
      const v = raw[f.key] ?? raw[snake];
      if (v === undefined || v === null) continue;
      o[f.key] = f.kind === 'select' ? String(v) : f.kind === 'bool' ? Boolean(v) : f.kind === 'text' ? String(v) : Number(v);
    }
    if (raw.name) o.name = String(raw.name);
    elements.push(CE.newElement(type, o));
  }
  if (!elements.length) return { status: 'error', message: 'Give a building outline (length and width), a container_base, or a list of elements to estimate.' };
  const region = CE.REGIONS[args.region] ? args.region : prefs.region;
  const project = CE.normaliseProject({
    name: args.project_name || (Number(args.building?.length) > 0 && Number(args.building?.width) > 0 ? `${args.building.length} × ${args.building.width} m building` : 'Construction estimate'),
    client: args.client, site: args.site,
    contingency: args.contingency_pct ?? 5,
    vat: typeof args.vat === 'boolean' ? args.vat : null,
    elements,
  });
  const r = CE.estimate(project, {
    rates: CE.resolveRates(overrides, region), trips,
    waste: (Number.isFinite(Number(args.waste_pct)) ? Number(args.waste_pct) : prefs.waste) / 100,
    grade: CE.GRADES[args.grade] ? args.grade : prefs.grade, vat: prefs.vat,
  });
  const ngn = (v) => `₦${Math.round(v).toLocaleString('en-US')}`;
  const key = ['cement', 'sand', 'granite', 'rebar', 'block9', 'block6'];
  const brief = r.shopping.filter(s => key.includes(s.key)).map(s => `${s.qty.toLocaleString('en-US')} ${s.unit} ${s.label.toLowerCase()}`).join(', ');
  return {
    status: 'success', renderer: 'construction-estimate', type: 'construction-estimate',
    project: r.project,
    region: CE.REGIONS[region].label, ratesDate: CE.RATES_DATE,
    total: Math.round(r.total), subtotal: Math.round(r.subtotal), materials: Math.round(r.materialsCost), labour: Math.round(r.labourCost),
    contingencyPct: r.contingencyPct, contingency: Math.round(r.contingency), vatOn: r.vatOn, vat: Math.round(r.vat),
    floorArea: Math.round(r.floorArea * 10) / 10, costPerM2: Math.round(r.costPerM2),
    sections: r.groups.map(g => ({ name: g.name, type: g.type, subtotal: Math.round(g.subtotal), lines: g.lines.length })),
    shopping: r.shopping.map(s => ({ group: s.group, label: s.label, qty: s.qty, unit: s.unit, detail: s.detail, cost: s.cost == null ? null : Math.round(s.cost) })),
    issues: r.issues,
    openHash: '#concrete-estimator',
    message: `${r.project.name}: estimated ${ngn(r.total)} (${r.groups.length} sections; subtotal ${ngn(r.subtotal)}, contingency ${r.contingencyPct}%${r.vatOn ? `, VAT ${ngn(r.vat)}` : ', no VAT'})${r.floorArea > 0 ? `, about ${ngn(r.costPerM2)} per m² over ${Math.round(r.floorArea)} m²` : ''}. Key materials: ${brief}. Rates are editable ${CE.REGIONS[region].label} 2026 estimates, not quotes; excludes plumbing, electrical and external works unless listed.`,
  };
}

/* ---------------- invoicing ---------------- */

async function invoicingDefaults() {
  try {
    const { getToolSettings } = await import('../tool-settings.js');
    const p = getToolSettings('invoice-generator');
    return { currency: p.currency, vat: p.vat !== false, whtRate: Number(p.whtRate) || 0, dueDays: Number(p.dueDays ?? 14), template: p.template, numberFormat: p.numberFormat };
  } catch { return { currency: 'NGN', vat: true, whtRate: 0, dueDays: 14, template: 'classic', numberFormat: 'standard' }; }
}

function invoiceSummary(S, store, doc, fmt) {
  const t = S.computeTotals(doc);
  const client = store.getClient(doc.clientId);
  const m = (v) => S.formatMoney(v, doc.currency, { format: fmt });
  return {
    id: doc.id, type: doc.type, number: doc.number, status: S.effectiveStatus(doc), statusLabel: S.STATUS_LABEL[S.effectiveStatus(doc)],
    client: client?.name || '', currency: doc.currency, issueDate: doc.issueDate, dueDate: doc.dueDate, dueDateText: S.formatDate(doc.dueDate, 'short'),
    items: doc.items.map(i => ({ description: i.description, qty: i.qty, unit: i.unit, rate: S.toMajor(i.rate) })),
    vatRate: doc.vat.mode === 'none' ? 0 : doc.vat.rate, whtRate: t.whtRate,
    subtotal: S.toMajor(t.subtotal), vat: S.toMajor(t.vat), total: S.toMajor(t.total), wht: S.toMajor(t.wht),
    payable: S.toMajor(t.payable), paid: S.toMajor(t.paid), balance: S.toMajor(t.balance),
    display: { subtotal: m(t.subtotal), vat: m(t.vat), total: m(t.total), wht: m(t.wht), payable: m(t.payable), paid: m(t.paid), balance: m(t.balance) },
    amountInWords: S.amountInWords(doc.type === 'quote' ? t.total : t.payable, doc.currency),
  };
}

async function createInvoiceTool(args) {
  const S = await import('../invoicing/store.js');
  const store = S.getStore();
  const d = await invoicingDefaults();
  const items = (Array.isArray(args.items) ? args.items : []).filter(i => i && (i.description || i.rate))
    .map(i => ({ description: String(i.description || 'Item'), qty: Number(i.qty ?? 1) || 1, unit: i.unit || '', rate: S.toMinor(i.rate), discount: Number(i.discount) || 0, vat: true }));
  if (!items.length) return { status: 'error', message: 'Give at least one line item with a description and rate.' };
  if (!String(args.client || '').trim()) return { status: 'error', message: 'Say who the invoice is for.' };
  const client = store.ensureClient({ name: String(args.client).trim(), email: args.client_email || '', address: args.client_address || '' });
  const vatOn = typeof args.vat === 'boolean' ? args.vat : d.vat;
  const currency = S.CURRENCIES[String(args.currency || '').toUpperCase()] ? String(args.currency).toUpperCase() : d.currency;
  const doc = store.createDoc({
    type: args.type === 'quote' ? 'quote' : 'invoice', clientId: client.id, currency, fxRate: args.fx_rate, items,
    vat: { mode: vatOn ? 'global' : 'none', rate: 7.5 },
    wht: { rate: args.wht !== undefined ? Number(args.wht) || 0 : d.whtRate },
    dueDays: args.due_days !== undefined ? Number(args.due_days) : d.dueDays,
    reference: args.reference || '', ...(args.notes ? { notes: String(args.notes) } : {}),
  }, d);
  const inv = invoiceSummary(S, store, doc, d.numberFormat);
  return {
    status: 'success', renderer: 'invoice-card', type: 'invoice-card', invoice: inv,
    message: `Saved draft ${inv.type === 'quote' ? 'quote' : 'invoice'} ${inv.number} for ${inv.client}: total ${inv.display.total}${inv.wht ? `, ${inv.display.payable} payable after ${inv.whtRate}% WHT` : ''}. It is a draft in Invoice Generator; the user can open it to review, print or send.`,
  };
}

async function listInvoicesTool(args) {
  const S = await import('../invoicing/store.js');
  const store = S.getStore();
  const d = await invoicingDefaults();
  const type = args.type === 'quote' ? 'quote' : 'invoice';
  const client = args.client ? store.findClientByName(args.client) : null;
  if (args.client && !client) return { status: 'error', message: `No client named "${args.client}". Clients: ${store.listClients().map(c => c.name).join(', ') || 'none yet'}.` };
  const docs = store.listDocs({ type, status: args.status || 'all', clientId: client?.id || null });
  const limit = Math.max(1, Math.min(50, Number(args.limit) || 20));
  const dash = store.dashboard();
  const m = (v) => S.formatMoney(v, 'NGN', { format: d.numberFormat });
  const rows = docs.slice(0, limit).map(x => invoiceSummary(S, store, x, d.numberFormat)).map(({ items: _i, ...r }) => r);
  return {
    status: 'success', renderer: 'invoice-list', type: 'invoice-list', docType: type, filter: args.status || 'all', client: client?.name || null,
    count: docs.length, invoices: rows,
    summary: { outstanding: m(dash.outstanding), overdue: m(dash.overdue), paidThisMonth: m(dash.paidThisMonth), drafts: dash.drafts, outstandingCount: dash.counts.outstanding || 0, overdueCount: dash.counts.overdue || 0 },
    message: docs.length
      ? `${docs.length} ${type}${docs.length === 1 ? '' : 's'}${args.status && args.status !== 'all' ? ` (${args.status})` : ''}. Outstanding across all invoices: ${m(dash.outstanding)}; overdue ${m(dash.overdue)}; paid this month ${m(dash.paidThisMonth)}.`
      : `No ${type}s match. Outstanding across all invoices: ${m(dash.outstanding)}.`,
  };
}

/* ---------------- dispatcher ---------------- */

/* ---------------- legal (Nigerian practice) ---------------- */

const LEGAL_NOTE = 'Heuristic, on-device extraction: tell the user to check every point against the document; do not add case law that is not in the text.';
const needText = (args) => (String(args?.text || '').trim().length >= 40 ? null : { status: 'error', message: 'Pass the document text in `text` (at least a few sentences). For an attached PDF or Word file, pass the text you can read from it.' });

async function analyzeLegalDocument(args) {
  const miss = needText(args); if (miss) return miss;
  const { analyzeContract } = await import('../legal/contract.js');
  const a = analyzeContract(args.text, { docType: args.doc_type && args.doc_type !== 'auto' ? args.doc_type : null, state: args.state || 'auto' });
  const risks = a.flags.filter(f => f.severity !== 'info').map(f => ({ severity: f.severity, title: f.title, where: f.where, why: f.why, evidence: f.evidence, suggestion: f.suggestion }));
  return {
    status: 'success', renderer: 'legal-contract', type: 'legal-contract',
    title: a.title, docType: a.docTypeLabel, parties: a.parties,
    clauses: a.clauses.map(c => ({ number: c.number, heading: c.heading, type: c.typeLabel })),
    missing: a.coverage.filter(c => !c.present).map(c => ({ label: c.label, required: c.required })),
    risks, obligations: a.obligations.map(o => ({ party: o.party, action: o.action, deadline: o.deadline?.text || null, due: o.deadline?.due || null, clause: o.clause?.number || null })),
    execution: a.execution, reminders: a.reminders.map(r => ({ title: r.title, why: r.why })),
    definedTerms: a.defined.map(d => ({ term: d.term, used: d.count })),
    counts: a.counts, openHash: '#legal-document-analyzer', note: LEGAL_NOTE,
    message: `${a.title} (${a.docTypeLabel}): ${a.counts.clauses} clauses, ${a.counts.high} high and ${a.counts.medium} medium risk flags, ${a.counts.obligations} obligations. ${LEGAL_NOTE}`,
  };
}

async function parseCitationsTool(args) {
  const miss = needText(args); if (miss) return miss;
  const { buildAuthorities } = await import('../legal/authorities.js');
  const { findSuitNumbers } = await import('../legal/citations.js');
  const toa = buildAuthorities(args.text, { forum: args.forum || 'HC' });
  const cases = toa.cases.all.map(c => ({ title: c.title, citations: c.citations, court: c.courtName, courtInferred: Boolean(c.court?.inferred), foreign: c.foreign, weight: c.court && c.weight ? c.weight.label : null, pinpoints: c.pinpoints, treatments: c.treatments, warnings: c.warnings, mentions: c.mentions }));
  const statutes = [...toa.constitution, ...toa.statutes].map(s => ({ name: s.name, provisions: s.provisions.map(p => p.ref) }));
  return {
    status: 'success', renderer: 'legal-citations', type: 'legal-citations', forum: args.forum || 'HC',
    cases, statutes, rules: toa.rules, suits: findSuitNumbers(args.text).map(s => ({ number: s.normalised, court: s.court?.name || null })),
    counts: toa.counts, note: LEGAL_NOTE,
    message: `${cases.length} cases, ${statutes.length} statutes, ${toa.rules.length} rules of court recognised. ${LEGAL_NOTE}`,
  };
}

async function caseDigestTool(args) {
  const miss = needText(args); if (miss) return miss;
  const { extractJudgment } = await import('../legal/judgment.js');
  const d = extractJudgment(args.text, { forum: args.forum || 'HC' });
  const pick = (list, n) => list.slice(0, n).map(x => ({ text: x.text, page: x.page, resolution: x.resolution || undefined }));
  return {
    status: 'success', renderer: 'legal-digest', type: 'legal-digest',
    title: d.title, court: d.court?.name || null, suitNo: d.suitNo, date: d.date?.text || null, lead: d.lead, coram: d.coram,
    outcome: d.outcome?.label || null, citation: d.citation,
    facts: pick(d.facts, 2), issues: pick(d.issues, 8), holdings: pick(d.holdings, 6), ratio: pick(d.ratio, 5), obiter: pick(d.obiter, 4), orders: pick(d.orders, 8),
    authorities: d.authorities.cases.all.map(c => ({ title: c.title, citations: c.citations, court: c.courtName })), statutes: [...d.authorities.constitution, ...d.authorities.statutes].map(s => s.name),
    openHash: '#case-digest', note: LEGAL_NOTE,
    message: `${d.title}${d.court ? `, ${d.court.name}` : ''}${d.date ? `, ${d.date.text}` : ''}: ${d.issues.length} issues, outcome ${d.outcome?.label || 'not found'}, ${d.authorities.counts.cases} cases cited. Ratio and obiter are candidates. ${LEGAL_NOTE}`,
  };
}

EXTRA_TOOL_DECLARATIONS.push(...DOMAIN_TOOL_DECLARATIONS, ...LAB3D_TOOL_DECLARATIONS);
EXTRA_TOOL_DECLARATIONS.push({
  name: 'mind',
  description: 'Read or update the user’s Mind: rooms contain desks, desks contain files of information. Search and list are read only. Create and connect only when the user asks; never invent personal facts or connections.',
  parameters: { type: 'object', properties: {
    action: { type: 'string', enum: ['list', 'search', 'create_room', 'create_desk', 'create_file', 'connect_files'] },
    query: { type: 'string' }, name: { type: 'string' }, parentId: { type: 'string' }, content: { type: 'string' }, fileId: { type: 'string' }, otherFileId: { type: 'string' },
  }, required: ['action'] },
});
export const EXTRA_TOOL_NAMES = new Set(EXTRA_TOOL_DECLARATIONS.map(d => d.name));

export async function executeExtraTool(name, args = {}, ctx = {}) {
  switch (name) {
    case 'mind': {
      const { action, query, parentId, content, fileId, otherFileId } = args;
      if (action === 'list') return { status: 'success', mind: readMind(), openHash: '#mind' };
      if (action === 'search') return { status: 'success', files: searchMind(query).slice(0, 50), openHash: '#mind' };
      if (action === 'connect_files') { connectMindFiles(fileId, otherFileId); return { status: 'success', message: 'Files connected.', openHash: '#mind' }; }
      const kind = ({ create_room: 'room', create_desk: 'desk', create_file: 'file' })[action];
      if (kind) return { status: 'success', item: addMindItem(kind, args.name, parentId, content), openHash: '#mind' };
      throw new Error('Unknown Mind action.');
    }
    case 'analyze_legal_document': return analyzeLegalDocument(args);
    case 'parse_citations': return parseCitationsTool(args);
    case 'case_digest': return caseDigestTool(args);
    case 'update_plan': {
      const steps = (args.steps || []).map(s => ({ title: String(s.title || ''), status: s.status || 'pending' }));
      const done = steps.filter(s => s.status === 'done').length;
      return { status: 'success', renderer: 'task-plan', type: 'task-plan', title: args.title || 'Plan', steps, message: `Plan: ${done}/${steps.length} steps done.` };
    }
    case 'chess_analyze': return chessAnalyze(args);
    case 'chess_play': return chessPlay(args);
    case 'chess_open_board': return chessOpenBoard(args);
    case 'device_specs': return deviceSpecs(args);
    case 'device_compare': return deviceCompare(args);
    case 'vehicle_lookup': return vehicleLookup(args);
    case 'vehicle_controls': return vehicleControlsTool(args);
    case 'vehicle_part': return vehiclePartTool(args);
    case 'car_injury': return carInjuryTool(args);
    case 'update_note': return updateNote(args);
    case 'draw_illustration': {
      const svg = sanitizeSvg(args.svg);
      return { status: 'success', renderer: 'svg-illustration', type: 'svg-illustration', title: args.title || 'Illustration', caption: args.caption || '', svg, message: 'Illustration shown to the user.' };
    }
    case 'design_container': return designContainerTool(args);
    case 'model_3d': return model3dTool(args);
    case 'create_3d_object': return create3dObject(args);
    case 'search_3d_models': return search3dModels(args);
    case 'create_invoice': return createInvoiceTool(args);
    case 'list_invoices': return listInvoicesTool(args);
    case 'find_toolbox_tools': return findTools(args.query || '');
    case 'run_toolbox_tool': return runTool(args, ctx);
    case 'estimate_construction': return estimateConstruction(args);
    case 'open_toolbox_tool': {
      const tool = TOOLS.find(t => t.id === args.tool_id || t.id === String(args.tool_id).replace(/_/g, '-'));
      if (!tool) return { status: 'error', message: `No tool "${args.tool_id}".` };
      window.location.hash = `#${tool.id}`;
      return { status: 'success', openedToolId: tool.id, message: `Opened ${tool.name}.` };
    }
    default: return executeDomainTool(name, args);
  }
}
