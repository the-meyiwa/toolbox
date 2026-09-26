/* Per-tool preference schemas, shown in Preferences → Tools.
   A tool with settings reads them through lib/tool-settings.js and never
   renders its own settings panel.

   Field types
     toggle     { default: boolean }
     select     { options: [{ value, label }] | async () => options, default }
     segmented  { options: [{ value, label }], default }
     range      { min, max, step, default, format?: (v) => string } */

const opt = (value, label) => ({ value, label });

const PDF_THUMB_FIELD = { key: 'thumbSize', label: 'Page thumbnails', type: 'segmented', default: 'medium',
  options: [opt('small', 'Small'), opt('medium', 'Medium'), opt('large', 'Large')] };

const QURAN_API = 'https://api.quran.com/api/v4';
let quranTranslations = null, quranReciters = null;

export const TOOL_SETTINGS = {
  'case-digest': {
    title: 'Case Digest',
    hint: 'Page references, exports and the court authorities are weighed for',
    groups: [{
      title: 'Digest',
      fields: [
        { key: 'forum', label: 'Weigh authorities before', help: 'Shows whether each cited case binds this court.', type: 'select', default: 'HC',
          options: [opt('SC', 'Supreme Court'), opt('CA', 'Court of Appeal'), opt('FHC', 'Federal High Court'), opt('HC', 'State High Court'), opt('FCTHC', 'FCT High Court'), opt('NIC', 'National Industrial Court'), opt('MC', "Magistrates' Court")] },
        { key: 'pages', label: 'Show page references', help: 'For PDFs: the page each extract comes from.', type: 'toggle', default: true },
        { key: 'exportToa', label: 'Include the table of authorities in exports', type: 'toggle', default: true },
      ],
    }],
  },

  'legal-document-analyzer': {
    title: 'Legal Document Analyzer',
    hint: 'Tenancy rules and calendar reminders',
    groups: [{
      title: 'Review',
      fields: [
        { key: 'state', label: 'Tenancy rules', help: 'Which State\'s tenancy law the checks assume.', type: 'select', default: 'auto',
          options: [opt('auto', 'Detect from the document'), opt('lagos', 'Lagos State'), opt('fct', 'FCT'), opt('other', 'Another State')] },
        { key: 'showInfo', label: 'Show suggestions for optional clauses', type: 'toggle', default: true },
        { key: 'leadDays', label: 'Calendar reminder before each deadline', type: 'select', default: '7',
          options: [opt('0', 'No reminder'), opt('1', '1 day before'), opt('3', '3 days before'), opt('7', '1 week before'), opt('14', '2 weeks before')] },
      ],
    }],
  },

  'legal-research': {
    title: 'Legal Research Planner',
    hint: 'Default court and databases',
    groups: [{
      title: 'Plans',
      fields: [
        { key: 'forum', label: 'Usual court', type: 'select', default: 'HC',
          options: [opt('SC', 'Supreme Court'), opt('CA', 'Court of Appeal'), opt('FHC', 'Federal High Court'), opt('HC', 'State High Court'), opt('FCTHC', 'FCT High Court'), opt('NIC', 'National Industrial Court'), opt('MC', "Magistrates' Court")] },
        { key: 'scholar', label: 'Include Google Scholar queries', type: 'toggle', default: true },
      ],
    }],
  },

  'legal-pdf': {
    title: 'Legal PDF Bundle & Stamping',
    hint: 'Numbering, exhibits and e-filing size',
    groups: [{
      title: 'Bundle',
      fields: [
        { key: 'pagePosition', label: 'Page number position', type: 'select', default: 'bottom-center',
          options: [opt('bottom-center', 'Bottom centre'), opt('bottom-right', 'Bottom right'), opt('top-right', 'Top right')] },
        { key: 'exhibitScheme', label: 'Exhibit marks', type: 'segmented', default: 'letters',
          options: [opt('letters', 'A, B, C'), opt('numbers', '1, 2, 3'), opt('initials', 'Initials + number')] },
        { key: 'capMB', label: 'E-filing size cap', help: 'Bundles above this are compressed; 0 turns it off.', type: 'range', min: 0, max: 50, step: 1, default: 10, format: (v) => (v ? `${v} MB` : 'Off') },
      ],
    }],
  },

  chess: {
    title: 'Chess',
    hint: 'Board, computer opponent and coaching',
    groups: [
      {
        title: 'Board',
        fields: [
          { key: 'boardStyle', label: 'Board style', type: 'select', default: 'graphite',
            options: [opt('graphite', 'Graphite'), opt('paper', 'Paper'), opt('contrast', 'High contrast'), opt('classic', 'Classic walnut')] },
          { key: 'coordinates', label: 'Show coordinates', help: 'Files and ranks along the board edge.', type: 'toggle', default: true },
          { key: 'legalMoves', label: 'Show legal moves', help: 'Dots on the squares the selected piece can reach.', type: 'toggle', default: true },
          { key: 'lastMove', label: 'Highlight the last move', type: 'toggle', default: true },
          { key: 'animate', label: 'Animate moves', type: 'toggle', default: true },
          { key: 'sounds', label: 'Move sounds', type: 'toggle', default: false },
          { key: 'autoQueen', label: 'Always promote to a queen', help: 'Skip the promotion picker.', type: 'toggle', default: false },
          { key: 'autoFlip', label: 'Flip the board each turn', help: 'In two-player games on one device.', type: 'toggle', default: false },
        ],
      },
      {
        title: 'Computer',
        fields: [
          { key: 'strength', label: 'Computer strength', help: 'Level 1 plays loosely; level 10 searches as deep as it can in about three seconds.',
            type: 'range', min: 1, max: 10, step: 1, default: 5, format: (v) => `Level ${v}` },
          { key: 'timeControl', label: 'Clock', type: 'select', default: 'none',
            options: [opt('none', 'No clock'), opt('1+0', 'Bullet 1 min'), opt('3+0', 'Blitz 3 min'), opt('3+2', 'Blitz 3 | 2'),
              opt('5+0', 'Blitz 5 min'), opt('10+0', 'Rapid 10 min'), opt('15+10', 'Rapid 15 | 10'), opt('30+0', 'Classical 30 min')] },
        ],
      },
      {
        title: 'Coach',
        hint: 'Off means the board never tells you what to play or how you played.',
        fields: [
          { key: 'hints', label: 'Best-move hints', help: 'Adds a Hint button that shows the engine\'s best move as an arrow.', type: 'toggle', default: true },
          { key: 'review', label: 'Judge each move', help: 'Marks moves as best, good, inaccuracy, mistake or blunder, and says what was better.', type: 'toggle', default: true },
          { key: 'evalBar', label: 'Evaluation bar', help: 'Shows who is better and by how much.', type: 'toggle', default: true },
          { key: 'reviewDepth', label: 'Analysis depth', type: 'segmented', default: 'balanced',
            options: [opt('fast', 'Fast'), opt('balanced', 'Balanced'), opt('deep', 'Deep')] },
          { key: 'showOpening', label: 'Name the opening', type: 'toggle', default: true },
        ],
      },
    ],
  },

  'tech-device-comparisons': {
    title: 'Tech Device Comparisons',
    hint: 'Scores, units and what the comparison shows',
    groups: [
      {
        title: 'Comparison',
        fields: [
          { key: 'defaultCategory', label: 'Open on', type: 'select', default: 'phones',
            options: [opt('phones', 'Phones'), opt('tablets', 'Tablets'), opt('laptops', 'Laptops'), opt('tvs', 'TVs'), opt('monitors', 'Monitors'), opt('socs', 'Mobile chips'),
              opt('cpus', 'Processors'), opt('gpus', 'Graphics cards'), opt('watches', 'Smartwatches'), opt('audio', 'Headphones & earbuds'),
              opt('consoles', 'Consoles & handhelds')] },
          { key: 'differencesOnly', label: 'Only show differences', help: 'Hide rows where both devices match.', type: 'toggle', default: false },
          { key: 'highlightWinners', label: 'Highlight the better spec on each row', type: 'toggle', default: true },
          { key: 'reasons', label: 'Reasons to list', help: 'How many "why it\'s better" points each side shows.',
            type: 'range', min: 3, max: 12, step: 1, default: 6, format: (v) => `${v}` },
        ],
      },
      {
        title: 'Display',
        fields: [
          { key: 'scoreScale', label: 'Score scale', type: 'segmented', default: '100', options: [opt('100', 'Out of 100'), opt('10', 'Out of 10')] },
          { key: 'units', label: 'Units', type: 'select', default: 'auto',
            options: [opt('auto', 'Follow General preferences'), opt('metric', 'Metric (g, mm)'), opt('imperial', 'Imperial (oz, in)')] },
          { key: 'showPrices', label: 'Show launch prices and the Better buy verdict', type: 'toggle', default: true },
          { key: 'showBenchmarks', label: 'Show benchmark scores', type: 'toggle', default: true },
        ],
      },
    ],
  },

  'concrete-estimator': {
    title: 'Construction Estimator',
    hint: 'Units, pricing and default concrete',
    groups: [
      {
        title: 'Measuring',
        fields: [
          { key: 'units', label: 'Dimensions in', help: 'Quantities in the bill stay metric, as materials are sold.', type: 'segmented', default: 'm',
            options: [opt('m', 'Metres'), opt('ft', 'Feet')] },
          { key: 'waste', label: 'Waste allowance', help: 'Added to materials only; labour is priced on net quantities.', type: 'range', min: 0, max: 20, step: 1, default: 5,
            format: (v) => `${v}%` },
          { key: 'grade', label: 'Default concrete', help: 'Used by any element set to "Project default". Blinding is always 1:3:6.', type: 'select', default: 'C20',
            options: [opt('C15', 'C15 — 1:2:4'), opt('C20', 'C20 — 1:1.5:3'), opt('C25', 'C25 — 1:1:2'), opt('C30', 'C30 — about 1:1:1.5 (designed mix advised)')] },
        ],
      },
      {
        title: 'Pricing',
        fields: [
          { key: 'region', label: 'Rate region', help: 'Scales the built-in rates. Rates you type in yourself are kept as they are.', type: 'select', default: 'lagos',
            options: [opt('lagos', 'Lagos'), opt('abuja', 'Abuja (FCT)'), opt('ph', 'Port Harcourt'), opt('southwest', 'Ibadan, Abeokuta, South-West'),
              opt('southeast', 'Enugu, Onitsha, South-East'), opt('north', 'Kano, Kaduna, North')] },
          { key: 'vat', label: 'Add VAT at 7.5%', help: 'New projects start with this; each project can switch it.', type: 'toggle', default: false },
          { key: 'currency', label: 'Show amounts as', type: 'segmented', default: 'symbol',
            options: [opt('symbol', '₦1,250,000'), opt('code', 'NGN 1,250,000'), opt('compact', '₦1.25m')] },
        ],
      },
    ],
  },

  mail: {
    title: 'Mail',
    hint: 'Layout, reading and sending',
    groups: [
      {
        title: 'Layout',
        fields: [
          { key: 'readingPane', label: 'Reading pane', help: 'Where an opened message appears on larger screens.', type: 'segmented', default: 'right',
            options: [opt('right', 'Right'), opt('bottom', 'Bottom'), opt('off', 'Off')] },
          { key: 'density', label: 'List density', type: 'segmented', default: 'comfortable',
            options: [opt('comfortable', 'Comfortable'), opt('compact', 'Compact')] },
          { key: 'threading', label: 'Conversation view', help: 'Group replies with the message they answer.', type: 'toggle', default: true },
          { key: 'snippets', label: 'Show message previews', help: 'A line of the message under each subject.', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Reading',
        fields: [
          { key: 'remoteImages', label: 'Load remote images automatically', help: 'Remote images can tell the sender when you opened a message.', type: 'toggle', default: false },
          { key: 'markRead', label: 'Mark as read', type: 'select', default: 'open',
            options: [opt('open', 'When opened'), opt('delay', 'After 3 seconds'), opt('manual', 'Only when I choose')] },
          { key: 'shortcuts', label: 'Keyboard shortcuts', help: 'c compose, / search, j/k move, e archive, # delete, r reply, s star.', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Sending',
        fields: [
          { key: 'undoSend', label: 'Undo send window', help: 'How long a sent message waits so you can take it back.', type: 'range', min: 0, max: 30, step: 5, default: 10,
            format: (v) => (v ? `${v} seconds` : 'Off') },
          { key: 'replyAll', label: 'Reply to everyone by default', type: 'toggle', default: false },
        ],
      },
    ],
  },

  notes: {
    title: 'Notes',
    hint: 'Typeface, page and note list',
    groups: [
      {
        title: 'Editor',
        fields: [
          { key: 'fontFamily', label: 'Typeface', type: 'select', default: 'sans',
            options: [opt('sans', 'System sans'), opt('serif', 'Editorial serif'), opt('mono', 'Monospace')] },
          { key: 'fontSize', label: 'Text size', type: 'segmented', default: 'normal',
            options: [opt('small', 'Small'), opt('normal', 'Normal'), opt('large', 'Large'), opt('xl', 'Extra large')] },
          { key: 'lineHeight', label: 'Line spacing', type: 'segmented', default: 'standard',
            options: [opt('compact', 'Compact'), opt('standard', 'Standard'), opt('relaxed', 'Relaxed')] },
          { key: 'paper', label: 'Page', type: 'select', default: 'blank',
            options: [opt('blank', 'Blank'), opt('lined', 'Ruled lines'), opt('grid', 'Grid'), opt('dot', 'Dot grid')] },
          { key: 'readableWidth', label: 'Readable line length', help: 'Keep text in a comfortable column on wide screens.', type: 'toggle', default: true },
          { key: 'spellcheck', label: 'Check spelling', type: 'toggle', default: true },
          { key: 'showWordCount', label: 'Show word count', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Note list',
        fields: [
          { key: 'sort', label: 'Sort notes by', type: 'select', default: 'edited',
            options: [opt('edited', 'Date edited'), opt('created', 'Date created'), opt('title', 'Title')] },
          { key: 'showPreview', label: 'Show preview text', type: 'toggle', default: true },
          { key: 'groupByDate', label: 'Group by date', help: 'Today, Yesterday, Previous 7 days…', type: 'toggle', default: true },
        ],
      },
    ],
  },

  'invoice-generator': {
    title: 'Invoice Generator',
    hint: 'Currency, tax defaults, due dates and the invoice template',
    groups: [
      {
        title: 'New invoices',
        hint: 'Your business details, bank account and number prefixes are kept on the Business page of the tool.',
        fields: [
          { key: 'currency', label: 'Default currency', type: 'select', default: 'NGN',
            options: [opt('NGN', 'Nigerian Naira (NGN)'), opt('USD', 'US Dollar (USD)'), opt('GBP', 'British Pound (GBP)'), opt('EUR', 'Euro (EUR)')] },
          { key: 'vat', label: 'Charge VAT at 7.5%', help: 'New invoices start with VAT on every line. You can switch it per invoice or per line.', type: 'toggle', default: true },
          { key: 'whtRate', label: 'Withholding tax', help: 'Deducted by the client and shown below the total. 5% for most contracts and supplies, 10% for professional and consultancy fees.',
            type: 'segmented', default: '0', options: [opt('0', 'None'), opt('5', '5%'), opt('10', '10%')] },
          { key: 'dueDays', label: 'Payment due', type: 'select', default: '14',
            options: [opt('0', 'On receipt'), opt('7', 'In 7 days'), opt('14', 'In 14 days'), opt('30', 'In 30 days'), opt('45', 'In 45 days'), opt('60', 'In 60 days')] },
        ],
      },
      {
        title: 'Document',
        fields: [
          { key: 'template', label: 'Template', type: 'segmented', default: 'classic',
            options: [opt('classic', 'Classic'), opt('modern', 'Modern'), opt('compact', 'Compact')] },
          { key: 'numberFormat', label: 'Number format', type: 'select', default: 'standard',
            options: [opt('standard', '1,234,567.89'), opt('space', '1 234 567.89'), opt('european', '1.234.567,89')] },
          { key: 'amountInWords', label: 'Print the amount in words', help: 'For example "One Million Naira Only", as banks and many clients expect.', type: 'toggle', default: true },
        ],
      },
    ],
  },

  timesheet: {
    title: 'Timesheet & Billables',
    hint: 'Billing increments, week start and defaults for new entries',
    groups: [
      {
        title: 'Time',
        fields: [
          { key: 'increment', label: 'Round billed time up to', help: 'Six-minute units (a tenth of an hour) are usual for legal work.', type: 'select', default: '6',
            options: [opt('0', 'The exact minute'), opt('6', '6 minutes (0.1 hour)'), opt('15', '15 minutes'), opt('30', '30 minutes')] },
          { key: 'weekStart', label: 'Week starts on', type: 'segmented', default: '1', options: [opt('1', 'Monday'), opt('0', 'Sunday')] },
          { key: 'billable', label: 'New entries are billable', type: 'toggle', default: true },
          { key: 'currency', label: 'Currency for rates', type: 'select', default: 'NGN',
            options: [opt('NGN', 'Nigerian Naira (NGN)'), opt('USD', 'US Dollar (USD)'), opt('GBP', 'British Pound (GBP)'), opt('EUR', 'Euro (EUR)')] },
        ],
      },
      {
        title: 'Invoicing',
        fields: [
          { key: 'group', label: 'Invoice lines', help: 'How unbilled time turns into invoice lines.', type: 'segmented', default: 'entry',
            options: [opt('entry', 'One per entry'), opt('matter', 'One per matter')] },
        ],
      },
    ],
  },

  quran: {
    title: 'Quran',
    hint: 'Translation, recitation and reading size',
    groups: [
      {
        title: 'Reading',
        fields: [
          { key: 'translation', label: 'Translation', type: 'select', default: 0,
            options: async () => {
              if (!quranTranslations) {
                const r = await fetch(`${QURAN_API}/resources/translations?language=en`).then(x => x.json());
                quranTranslations = (r.translations ?? []).filter(t => t.language_name === 'english').map(t => opt(t.id, t.name));
              }
              return [opt(0, 'Recommended'), ...quranTranslations];
            } },
          { key: 'reciter', label: 'Reciter', type: 'select', default: 7,
            options: async () => {
              if (!quranReciters) {
                const r = await fetch(`${QURAN_API}/resources/recitations?language=en`).then(x => x.json());
                quranReciters = (r.recitations ?? []).map(x => opt(x.id, x.reciter_name + (x.style ? ` (${x.style})` : '')));
              }
              return quranReciters;
            } },
          { key: 'arabicSize', label: 'Arabic text size', type: 'range', min: 1, max: 4, step: 1, default: 2,
            format: (v) => ['Small', 'Medium', 'Large', 'Largest'][v - 1] },
          { key: 'showTranslation', label: 'Show translation', type: 'toggle', default: true },
          { key: 'showTransliteration', label: 'Show transliteration', type: 'toggle', default: false },
        ],
      },
    ],
  },
  /* The four PDF tools share one workspace; each keeps its own defaults. */
  'pdf-editor': {
    title: 'PDF Editor',
    hint: 'Page grid, opening tab and export quality',
    groups: [
      {
        title: 'Workspace',
        fields: [
          PDF_THUMB_FIELD,
          { key: 'startTab', label: 'Open files on', type: 'select', default: 'organise',
            options: [opt('organise', 'Organise'), opt('edit', 'Edit'), opt('sign', 'Sign'), opt('forms', 'Forms'), opt('protect', 'Protect'), opt('convert', 'Convert')] },
          { key: 'annotColor', label: 'Default ink colour', type: 'segmented', default: '#d92626',
            options: [opt('#d92626', 'Red'), opt('#111111', 'Black'), opt('#1f7a3a', 'Green')] },
        ],
      },
      {
        title: 'Export',
        fields: [
          { key: 'imageDpi', label: 'Page image resolution', help: 'Used for PNG/JPEG export, redaction and downsampling.', type: 'range', min: 72, max: 300, step: 6, default: 150, format: (v) => `${v} dpi` },
          { key: 'textFormat', label: 'Extract text as', type: 'segmented', default: 'md', options: [opt('md', 'Markdown'), opt('txt', 'Plain text')] },
        ],
      },
    ],
  },

  'pdf-split': {
    title: 'PDF Split',
    hint: 'Default split method and page grid',
    groups: [{
      title: 'Split',
      fields: [
        PDF_THUMB_FIELD,
        { key: 'mode', label: 'Default method', type: 'select', default: 'ranges',
          options: [opt('ranges', 'Page ranges'), opt('every', 'Every N pages'), opt('bookmarks', 'By bookmarks'), opt('selected', 'Selected pages'), opt('each', 'Every page')] },
        { key: 'everyN', label: 'Pages per file (every N)', type: 'range', min: 1, max: 50, step: 1, default: 1, format: (v) => `${v} page${v === 1 ? '' : 's'}` },
      ],
    }],
  },

  'pdf-merge': {
    title: 'PDF Merge',
    hint: 'Bookmarks and page grid',
    groups: [{
      title: 'Merge',
      fields: [
        PDF_THUMB_FIELD,
        { key: 'bookmarks', label: 'Add a bookmark for each file', help: 'Lets readers jump between the original documents.', type: 'toggle', default: true },
        { key: 'compress', label: 'Compact the result', help: 'Re-save with object streams (lossless).', type: 'toggle', default: true },
      ],
    }],
  },

  'image-to-pdf': {
    title: 'Image to PDF',
    hint: 'Page size, margins and image quality',
    groups: [{
      title: 'Pages',
      fields: [
        { key: 'pageSize', label: 'Page size', type: 'select', default: 'a4',
          options: [opt('a4', 'A4'), opt('letter', 'US Letter'), opt('legal', 'US Legal'), opt('a5', 'A5'), opt('a3', 'A3'), opt('fit', 'Fit to image')] },
        { key: 'margin', label: 'Margin', type: 'segmented', default: 'normal',
          options: [opt('none', 'None'), opt('small', 'Small'), opt('normal', 'Normal'), opt('large', 'Large')] },
        { key: 'quality', label: 'Image quality', help: 'Original embeds JPEG and PNG files untouched.', type: 'select', default: 'original',
          options: [opt('original', 'Original'), opt('high', 'High'), opt('balanced', 'Balanced'), opt('small', 'Small file')] },
      ],
    }],
  },
};
