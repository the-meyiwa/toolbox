/* ============================================================
   TOOLBOX — App Shell & Fuzzy Search Engine
   ============================================================ */

function svg(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// --------------- TOOL REGISTRY WITH RICH KEYWORD INDEXES ---------------
const TOOLS = [
  // ------------------------------------------------------------
  // TEXT & MANIPULATION (Easiest to Hardest)
  // ------------------------------------------------------------
  {
    id: 'word-counter',
    name: 'Word Counter',
    category: 'Text & Content',
    description: 'Words, characters, sentences, paragraphs, and reading time',
    icon: svg('<path d="M3 7h18"/><path d="M3 12h12"/><path d="M3 17h15"/>'),
    keywords: ['word', 'words', 'wordcnt', 'wrd', 'count', 'counter', 'character', 'char', 'letters', 'length', 'sentence', 'paragraph', 'reading time', 'stats', 'calculator', 'text length', 'metrics']
  },
  {
    id: 'case-converter',
    name: 'Case Converter',
    category: 'Text & Content',
    description: 'Transform text to UPPER, lower, camelCase, snake_case, kebab-case',
    icon: svg('<path d="M3 17l5-12h1l5 12"/><path d="M5 13h6"/><path d="M16 17v-5a2.5 2.5 0 1 1 5 0v5"/>'),
    keywords: ['case', 'convert', 'uppercase', 'lowercase', 'camelcase', 'snakecase', 'kebabcase', 'titlecase', 'capitalize', 'text case', 'change case', 'format text', 'lower', 'upper']
  },
  {
    id: 'lorem-ipsum',
    name: 'Lorem Ipsum',
    category: 'Text & Content',
    description: 'Generate customizable dummy placeholder text',
    icon: svg('<path d="M3 6h18"/><path d="M3 10h18"/><path d="M3 14h12"/><path d="M3 18h15"/>'),
    keywords: ['lorem', 'ipsum', 'placeholder', 'dummy text', 'filler', 'generator', 'sample text', 'lipsum', 'fake text', 'mock text', 'words']
  },
  {
    id: 'sort-lines',
    name: 'Sort Lines',
    category: 'Text & Content',
    description: 'Alphabetize, reverse, shuffle, or sort lines by length',
    icon: svg('<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>'),
    keywords: ['sort', 'order', 'alphabetize', 'shuffle', 'reverse', 'lines', 'organize', 'list', 'line sorter', 'rearrange', 'a to z', 'z to a']
  },
  {
    id: 'remove-duplicates',
    name: 'Remove Duplicates',
    category: 'Text & Content',
    description: 'Deduplicate lines with case-sensitivity & trimming options',
    icon: svg('<polyline points="20 6 9 17 4 12"/>'),
    keywords: ['dedup', 'duplicate', 'deduplicate', 'remove duplicates', 'unique', 'distinct', 'filter lines', 'clean text', 'strip duplicates']
  },
  {
    id: 'slug-generator',
    name: 'Slug Generator',
    category: 'Text & Content',
    description: 'Convert any text into a URL-friendly slug',
    icon: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    keywords: ['slug', 'slugify', 'url string', 'friendly url', 'hyphenate', 'dash', 'seo url', 'permalink', 'convert text to url']
  },
  {
    id: 'find-replace',
    name: 'Find & Replace',
    category: 'Text & Content',
    description: 'Search and replace text with regex & case options',
    icon: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/>'),
    keywords: ['find', 'replace', 'search', 'swap', 'substitute', 'regex replace', 'find and replace', 'change text', 'string replace']
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    category: 'Text & Content',
    description: 'Compare two text blocks and highlight additions & deletions',
    icon: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/><path d="M15 3v5h5"/><path d="M9 12h6"/><path d="M12 9v6"/>'),
    keywords: ['diff', 'difference', 'compare', 'comparison', 'text diff', 'changes', 'checker', 'dff', 'line diff', 'git diff', 'what changed', 'additions']
  },
  {
    id: 'markdown-preview',
    name: 'Markdown Preview',
    category: 'Text & Content',
    description: 'Write markdown with live side-by-side HTML preview',
    icon: svg('<rect x="2" y="3" width="20" height="18" rx="1"/><path d="M12 3v18"/><path d="M6 15v-6l2.5 3L11 9v6"/>'),
    keywords: ['markdown', 'md', 'preview', 'editor', 'gfm', 'html', 'live preview', 'render', 'text editor', 'formatting']
  },

  // ------------------------------------------------------------
  // GENERATORS & KEYS (Easiest to Hardest)
  // ------------------------------------------------------------
  {
    id: 'random-number',
    name: 'Random Number',
    category: 'Math & Measurements',
    description: 'Generate single or multiple unique random numbers',
    icon: svg('<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/>'),
    keywords: ['random', 'number', 'rng', 'rand', 'dice', 'roll', 'generate number', 'randomizer', 'picker']
  },
  {
    id: 'password-generator',
    name: 'Password Generator',
    category: 'Math & Measurements',
    description: 'Create strong passwords with length control & strength meter',
    icon: svg('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>'),
    keywords: ['password', 'pasword', 'pwd', 'pass', 'sec', 'secret', 'generator', 'strong password', 'entropy', 'random password', 'generate pass', 'key maker']
  },
  {
    id: 'qr-generator',
    name: 'QR Generator',
    category: 'Design & Media',
    description: 'Generate customizable QR codes with PNG download',
    icon: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="15" y="15" width="2" height="2"/><rect x="19" y="15" width="2" height="2"/><rect x="15" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/>'),
    keywords: ['qr', 'qrcode', 'qr code', 'barcode', 'generator', 'make qr', 'download qr', 'url qr', 'scan']
  },
  {
    id: 'color-palette-generator',
    name: 'Color Palette',
    category: 'Design & Media',
    description: 'Generate beautiful random color palettes instantly',
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>'),
    keywords: ['color', 'palette', 'colours', 'generator', 'random colors', 'hex', 'scheme', 'theme', 'design', 'swatches']
  },
  {
    id: 'uuid-generator',
    name: 'UUID Generator',
    category: 'Developer Utilities',
    description: 'Generate bulk cryptographically secure v4 UUIDs',
    icon: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    keywords: ['uuid', 'guid', 'v4', 'unique id', 'generator', 'random id', 'key', 'identifiers', 'generate id']
  },

  // ------------------------------------------------------------
  // CONVERTERS & MATH (Easiest to Hardest)
  // ------------------------------------------------------------
  {
    id: 'percentage-calculator',
    name: 'Percentage Calculator',
    category: 'Math & Measurements',
    description: 'Calculate percentages, increases, and decreases easily',
    icon: svg('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
    keywords: ['percent', 'percentage', 'math', 'calculator', 'calc', 'increase', 'decrease', 'fraction', 'discount', 'tax']
  },
  {
    id: 'aspect-ratio',
    name: 'Aspect Ratio',
    category: 'Design & Media',
    description: 'Calculate aspect ratios and rescale image/video dimensions',
    icon: svg('<rect x="2" y="4" width="20" height="16" rx="2"/>'),
    keywords: ['aspect', 'ratio', 'resolution', 'dimension', 'width', 'height', 'scale', 'rescale', '16:9', '4:3', 'image size', 'video size', 'calculate']
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    category: 'Math & Measurements',
    description: 'Convert Length, Weight/Mass, and Digital Storage metrics',
    icon: svg('<path d="M12 3v18M3 12h18"/>'),
    keywords: ['unit', 'units', 'convert', 'converter', 'length', 'weight', 'mass', 'metric', 'digital', 'mb', 'gb', 'km', 'miles', 'lbs', 'kilograms', 'inches', 'cm']
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    category: 'Design & Media',
    description: 'Convert color values seamlessly between HEX, RGB, and HSL',
    icon: svg('<circle cx="12" cy="12" r="9"/>'),
    keywords: ['color', 'colour', 'clor', 'hex', 'rgb', 'hsl', 'converter', 'swatch', 'picker', 'palette', 'convert color', 'css color']
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    category: 'Math & Measurements',
    description: 'Convert between Unix timestamps and human-readable dates',
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
    keywords: ['timestamp', 'time', 'unix', 'epoch', 'date', 'datetime', 'clock', 'converter', 'tmes', 'stamp', 'milliseconds', 'timezone']
  },
  {
    id: 'number-base-converter',
    name: 'Number Base',
    category: 'Math & Measurements',
    description: 'Convert numbers across Binary, Octal, Decimal, and Hexadecimal',
    icon: svg('<path d="M6 6v12M4 6h4M4 18h4"/><circle cx="16" cy="8" r="3.5"/><circle cx="16" cy="17" r="3.5"/>'),
    keywords: ['number', 'base', 'binary', 'octal', 'decimal', 'hex', 'hexadecimal', 'radix', 'converter', 'bin', 'dec', 'math', 'system']
  },

  // ------------------------------------------------------------
  // DEVELOPER & CODE (Easiest to Hardest)
  // ------------------------------------------------------------
  {
    id: 'url-codec',
    name: 'URL Codec',
    category: 'Developer Utilities',
    description: 'Encode and decode URLs and query components',
    icon: svg('<path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    keywords: ['url', 'uri', 'encode', 'decode', 'urlencode', 'urldecode', 'escape', 'percent encoding', 'link', 'web link', 'query param']
  },
  {
    id: 'html-entity-codec',
    name: 'HTML Entity Codec',
    category: 'Developer Utilities',
    description: 'Escape and unescape HTML special characters',
    icon: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    keywords: ['html', 'entity', 'entities', 'escape', 'unescape', 'special characters', 'sanitize', 'html code', 'tags', 'encode']
  },
  {
    id: 'base64-codec',
    name: 'Base64 Codec',
    category: 'Developer Utilities',
    description: 'Encode and decode UTF-8 text to/from Base64',
    icon: svg('<path d="M3 8h14M7 4l-4 4 4 4"/><path d="M21 16H7M17 12l4 4-4 4"/>'),
    keywords: ['base64', 'b64', 'encode', 'decode', 'codec', 'converter', 'string', 'utf8', 'binary', 'text format']
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    category: 'Developer Utilities',
    description: 'Format, beautify, minify, and validate JSON data',
    icon: svg('<path d="M9 3H7a2 2 0 0 0-2 2v3c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v3a2 2 0 0 0 2 2h2"/><path d="M15 3h2a2 2 0 0 1 2 2v3c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v3a2 2 0 0 1-2 2h-2"/>'),
    keywords: ['json', 'jso', 'josn', 'format', 'beautify', 'minify', 'validate', 'parser', 'prettify', 'json lint', 'parse json', 'beautifier', 'object']
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    category: 'Developer Utilities',
    description: 'Convert CSV table data into a JSON array',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    keywords: ['csv', 'json', 'convert', 'data', 'table', 'spreadsheet', 'excel', 'export', 'import', 'comma separated', 'parse csv']
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    category: 'Developer Utilities',
    description: 'Test regular expressions with instant visual match highlighting',
    icon: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h.01M11 11h.01M14 11h.01"/>'),
    keywords: ['regex', 'regx', 'regexp', 'regular expression', 'test', 'tester', 'matcher', 'pattern', 'find', 'validate regex', 'expression']
  },
  {
    id: 'hash-generator',
    name: 'Hash Generator',
    category: 'Developer Utilities',
    description: 'Generate SHA-1, SHA-256, SHA-384, and SHA-512 cryptographic hashes',
    icon: svg('<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3l-2 18"/><path d="M16 3l-2 18"/>'),
    keywords: ['hash', 'sha', 'sha256', 'sha512', 'sha1', 'crypto', 'checksum', 'digest', 'generator', 'encrypt', 'security', 'md5']
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    category: 'Developer Utilities',
    description: 'Inspect and decode JSON Web Tokens header, payload & expiry',
    icon: svg('<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="16" r="1"/>'),
    keywords: ['jwt', 'token', 'auth', 'bearer', 'decode', 'jsonwebtoken', 'header', 'payload', 'claims', 'expiration', 'authentication', 'security token']
  },
  {
    id: 'cron-parser',
    name: 'Cron Parser',
    category: 'Developer Utilities',
    description: 'Translate cron schedule expressions into readable text',
    icon: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    keywords: ['cron', 'crontab', 'schedule', 'parser', 'time', 'task', 'job', 'interval', 'timer', 'frequency', 'explain cron']
  },

  // ------------------------------------------------------------
  // MORE SPECIFIC -> FINANCE
  // ------------------------------------------------------------
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    category: 'Finance & Money',
    description: 'Calculate investment growth over time with monthly contributions',
    icon: svg('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    keywords: ['finance', 'compound', 'interest', 'investment', 'growth', 'calculator', 'money', 'stock', 'returns', 'yield', 'savings']
  },
  {
    id: 'salary-converter',
    name: 'Salary Converter',
    category: 'Finance & Money',
    description: 'Convert between hourly wages and annual salaries instantly',
    icon: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M17 12h.01M7 12h.01"/>'),
    keywords: ['salary', 'hourly', 'wage', 'income', 'pay', 'paycheck', 'converter', 'money', 'job', 'work', 'annual']
  },
  {
    id: 'loan-calculator',
    name: 'Loan Calculator',
    category: 'Finance & Money',
    description: 'Calculate EMI, total interest, and payments for mortgages/loans',
    icon: svg('<path d="M3 21v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 13V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M10 21V11M14 21V11"/>'),
    keywords: ['loan', 'mortgage', 'emi', 'interest', 'debt', 'payment', 'calculator', 'finance', 'auto loan', 'car loan', 'house']
  },
  {
    id: 'subscription-analyzer',
    name: 'Cost Analyzer',
    category: 'Finance & Money',
    description: 'See how much recurring expenses drain from you over a decade',
    icon: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    keywords: ['subscription', 'cost', 'recurring', 'expense', 'analyzer', 'finance', 'money', 'drain', 'coffee', 'netflix', 'budget']
  },
  {
    id: 'financial-analyzer',
    name: 'Financial Analyzer',
    category: 'Finance & Money',
    description: 'A plain-English spreadsheet for analyzing transactions without formulas',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
    keywords: ['spreadsheet', 'excel', 'finance', 'table', 'grid', 'analyzer', 'dashboard', 'transactions', 'money', 'csv']
  },
  
  // ------------------------------------------------------------
  // INTERNET (Easiest to Hardest)
  // ------------------------------------------------------------
  {
    id: 'weather-forecast',
    name: 'Weather Forecast',
    category: 'Internet',
    description: 'Get current conditions and 3-day forecast anywhere',
    icon: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
    keywords: ['weather', 'forecast', 'temperature', 'climate', 'sun', 'rain', 'meteo', 'open-meteo', 'conditions']
  },
  {
    id: 'currency-exchange',
    name: 'Currency Exchange',
    category: 'Internet',
    description: 'Real-time global currency exchange rates',
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>'),
    keywords: ['currency', 'money', 'exchange', 'forex', 'rates', 'usd', 'eur', 'ngn', 'conversion', 'realtime']
  },
  {
    id: 'interactive-map',
    name: 'Interactive Map',
    category: 'Internet',
    description: 'Search, pan, and zoom across the globe instantly',
    icon: svg('<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>'),
    keywords: ['map', 'maps', 'globe', 'leaflet', 'location', 'geography', 'search location', 'address']
  },
  {
    id: 'document-analyzer',
    name: 'Document Analyzer',
    category: 'Internet',
    description: 'Local text document analysis: counts, reading time, and top keywords',
    icon: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
    keywords: ['document', 'analyze', 'text', 'file', 'read', 'keywords', 'nlp', 'word count', 'reading time', 'stats']
  },
  {
    id: 'ip-lookup',
    name: 'IP Lookup',
    category: 'Internet',
    description: 'Instantly find your public IP address, ISP, and location',
    icon: svg('<rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="18" x2="6" y2="18"/><line x1="10" y1="18" x2="10" y2="18"/><path d="M12 14V10"/><path d="M18 14V6"/><path d="M6 14V2"/>'),
    keywords: ['ip', 'address', 'lookup', 'isp', 'location', 'network', 'internet', 'whois']
  },

  // ------------------------------------------------------------
  // ARTIFICIAL INTELLIGENCE
  // ------------------------------------------------------------
  {
    id: 'ai-sentiment',
    name: 'Sentiment Analyzer',
    category: 'Artificial Intelligence',
    description: 'In-browser AI classifies text as Positive, Negative, or Neutral',
    icon: svg('<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M8 15h8"/><path d="M9 9h.01"/><path d="M15 9h.01"/>'),
    keywords: ['ai', 'sentiment', 'emotion', 'positive', 'negative', 'neutral', 'classifier', 'machine learning']
  },
  {
    id: 'ai-image-classifier',
    name: 'Image Classifier',
    category: 'Artificial Intelligence',
    description: 'Local Vision AI identifies objects and subjects in your images',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    keywords: ['ai', 'image', 'classifier', 'vision', 'identify', 'recognition', 'machine learning', 'photo']
  },
  {
    id: 'ai-object-detection',
    name: 'Object Detection',
    category: 'Artificial Intelligence',
    description: 'AI draws bounding boxes around detected objects in images',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18"/><path d="M16 3v18"/><path d="M3 8h18"/><path d="M3 16h18"/>'),
    keywords: ['ai', 'object', 'detection', 'bounding box', 'vision', 'yolo', 'machine learning']
  },
  {
    id: 'ai-toxicity',
    name: 'Toxicity Filter',
    category: 'Artificial Intelligence',
    description: 'AI analyzes text for toxic, hateful, or insulting content',
    icon: svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    keywords: ['ai', 'toxic', 'filter', 'hate speech', 'moderation', 'classifier', 'nsfw', 'insult']
  },
  {
    id: 'ai-translator',
    name: 'Language Translator',
    category: 'Artificial Intelligence',
    description: 'Translate text between 50+ languages instantly for free',
    icon: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
    keywords: ['ai', 'translate', 'translator', 'language', 'dictionary', 'multilingual', 'mymemory']
  },
  {
    id: 'ai-grammar',
    name: 'Grammar Checker',
    category: 'Artificial Intelligence',
    description: 'AI-powered spell check and grammar correction',
    icon: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><polyline points="9 10 12 13 16 7"/>'),
    keywords: ['ai', 'grammar', 'spell', 'checker', 'correction', 'proofread', 'languagetool']
  },
  {
    id: 'ai-fill-mask',
    name: 'AI Auto-Complete',
    category: 'Artificial Intelligence',
    description: 'Use the [MASK] token and AI will guess the missing word!',
    icon: svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
    keywords: ['ai', 'fill', 'mask', 'auto', 'complete', 'guess', 'nlp']
  },
  {
    id: 'ai-language-detector',
    name: 'Language Detector',
    category: 'Artificial Intelligence',
    description: 'Instantly identifies the language of any given text',
    icon: svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    keywords: ['ai', 'language', 'detect', 'identifier', 'translation', 'locale']
  },
  {
    id: 'ai-summarizer',
    name: 'Text Summarizer',
    category: 'Artificial Intelligence',
    description: 'Automatically condense long articles into short summaries',
    icon: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/>'),
    keywords: ['ai', 'summarize', 'summary', 'tldr', 'condense', 'shorten', 'text']
  },
  
  // ------------------------------------------------------------
  // INTERNET & WEB
  // ------------------------------------------------------------
  {
    id: 'inet-weather',
    name: 'Weather Dashboard',
    category: 'Internet & Web',
    description: 'Get the current weather for any city instantly.',
    icon: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
    keywords: ['weather', 'forecast', 'climate', 'temperature', 'city', 'open-meteo']
  },
  {
    id: 'inet-ip-lookup',
    name: 'IP & Geolocation',
    category: 'Internet & Web',
    description: 'Find physical location and details about an IP address.',
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
    keywords: ['ip', 'address', 'geolocation', 'location', 'tracker', 'network']
  },
  {
    id: 'inet-qr-generator',
    name: 'QR Code Generator',
    category: 'Internet & Web',
    description: 'Generate high-quality QR codes for URLs and text.',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/>'),
    keywords: ['qr', 'code', 'barcode', 'generator', 'scan', 'link']
  },
  {
    id: 'inet-url-shortener',
    name: 'URL Shortener',
    category: 'Internet & Web',
    description: 'Shorten long, ugly links using a free API.',
    icon: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    keywords: ['url', 'shorten', 'link', 'is.gd', 'tinyurl', 'web']
  },
  {
    id: 'inet-base64',
    name: 'Base64 Encoder',
    category: 'Internet & Web',
    description: 'Encode or decode text to Base64 format locally.',
    icon: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    keywords: ['base64', 'encode', 'decode', 'string', 'text', 'format']
  },
  {
    id: 'inet-jwt',
    name: 'JWT Decoder',
    category: 'Internet & Web',
    description: 'Decode and inspect JSON Web Tokens locally.',
    icon: svg('<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="16" r="1"/>'),
    keywords: ['jwt', 'token', 'auth', 'bearer', 'decode', 'json']
  },
  {
    id: 'inet-http-status',
    name: 'HTTP Status Guide',
    category: 'Internet & Web',
    description: 'Quick reference for common HTTP status codes.',
    icon: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    keywords: ['http', 'status', 'code', 'error', '404', '200', 'reference']
  },
  {
    id: 'inet-password',
    name: 'Password Generator',
    category: 'Internet & Web',
    description: 'Generate highly secure random passwords instantly.',
    icon: svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    keywords: ['password', 'secure', 'generator', 'random', 'auth']
  },
  {
    id: 'inet-uuid',
    name: 'UUID Generator',
    category: 'Internet & Web',
    description: 'Generate secure Version 4 UUIDs.',
    icon: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/>'),
    keywords: ['uuid', 'guid', 'generator', 'random', 'unique', 'id']
  },
  {
    id: 'inet-color-extractor',
    name: 'Color Picker',
    category: 'Internet & Web',
    description: 'Visual color picker to copy HEX and RGB values.',
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10c0 5.5-4.5 10-10 10S2 17.5 2 12 7.5 2 12 2Z"/><path d="M12 2a10 10 0 0 0 0 20"/>'),
    keywords: ['color', 'picker', 'hex', 'rgb', 'palette', 'css']
  },
  {
    id: 'inet-box-shadow',
    name: 'Box Shadow Generator',
    category: 'Internet & Web',
    description: 'Visually generate CSS box-shadow code.',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M21 12H3"/>'),
    keywords: ['css', 'box', 'shadow', 'generator', 'style', 'design']
  },
  {
    id: 'inet-meta-tags',
    name: 'Meta Tag Generator',
    category: 'Internet & Web',
    description: 'Generate SEO and Social Media HTML meta tags.',
    icon: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    keywords: ['meta', 'tags', 'seo', 'social', 'html', 'head']
  },
  {
    id: 'inet-regex',
    name: 'Regex Tester',
    category: 'Internet & Web',
    description: 'Test regular expressions against text strings.',
    icon: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    keywords: ['regex', 'regular', 'expression', 'test', 'match', 'pattern']
  },
  {
    id: 'inet-json-format',
    name: 'JSON Formatter',
    category: 'Internet & Web',
    description: 'Prettify and validate JSON data instantly.',
    icon: svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
    keywords: ['json', 'format', 'prettify', 'validate', 'data']
  },
  {
    id: 'inet-advice',
    name: 'Random Advice',
    category: 'Internet & Web',
    description: 'Get a random piece of advice.',
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    keywords: ['advice', 'random', 'quote', 'life', 'help']
  },
  {
    id: 'net-google-search',
    name: 'Google Search Dorks',
    category: 'Internet',
    description: 'Generate advanced Google search queries instantly.',
    icon: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    keywords: ['google', 'search', 'dork', 'advanced', 'query']
  },
  {
    id: 'net-url-analyzer',
    name: 'URL Analyzer',
    category: 'Internet',
    description: 'Parse and break down a URL into its raw components completely offline.',
    icon: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    keywords: ['url', 'analyzer', 'parse', 'breakdown', 'uri', 'domain']
  },
  {
    id: 'net-dns-lookup',
    name: 'DNS Lookup',
    category: 'Internet',
    description: 'Query DNS records (A, MX, TXT, CNAME) for any domain.',
    icon: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
    keywords: ['dns', 'lookup', 'records', 'domain', 'mx', 'txt', 'a', 'cname']
  },
  {
    id: 'net-reverse-dns',
    name: 'Reverse DNS Lookup',
    category: 'Internet',
    description: 'Resolve an IP address back to its hostname.',
    icon: svg('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
    keywords: ['dns', 'reverse', 'ip', 'hostname', 'resolve', 'ptr']
  },
  {
    id: 'net-whois',
    name: 'WHOIS Lookup',
    category: 'Internet',
    description: 'Find domain registration details, dates, and contacts.',
    icon: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    keywords: ['whois', 'domain', 'lookup', 'registration', 'info', 'registrar']
  },
  {
    id: 'net-domain-availability',
    name: 'Domain Availability',
    category: 'Internet',
    description: 'Check if a domain name is available for registration.',
    icon: svg('<circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 15 9"/>'),
    keywords: ['domain', 'available', 'availability', 'register', 'check']
  },
  {
    id: 'net-http-headers',
    name: 'HTTP Headers Checker',
    category: 'Internet',
    description: 'Check the HTTP response headers and status of any URL.',
    icon: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
    keywords: ['http', 'headers', 'status', 'check', 'curl', 'response', 'server']
  },
  {
    id: 'net-ssl-viewer',
    name: 'SSL Certificate Viewer',
    category: 'Internet',
    description: 'View SSL/TLS certificate details (issuer, expiry, validity).',
    icon: svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    keywords: ['ssl', 'tls', 'certificate', 'security', 'https', 'expiry', 'valid']
  },
  {
    id: 'net-ipv4-ipv6',
    name: 'IPv4 to IPv6 Converter',
    category: 'Internet',
    description: 'Map a standard IPv4 address to an IPv6 address.',
    icon: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    keywords: ['ip', 'ipv4', 'ipv6', 'convert', 'network', 'address', 'map']
  },
  {
    id: 'net-subnet',
    name: 'Subnet Calculator',
    category: 'Internet',
    description: 'Calculate Network, Broadcast, and Host Range from an IP/CIDR.',
    icon: svg('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
    keywords: ['subnet', 'calculator', 'cidr', 'network', 'broadcast', 'host', 'ip', 'mask']
  },
  {
    id: 'net-favicon',
    name: 'Favicon Finder',
    category: 'Internet',
    description: 'Quickly extract the Favicon from any website.',
    icon: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    keywords: ['favicon', 'icon', 'extract', 'website', 'logo', 'grab']
  },
  {
    id: 'net-mac-lookup',
    name: 'MAC Address Lookup',
    category: 'Internet',
    description: 'Identify the manufacturer/vendor of a MAC Address.',
    icon: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M14 4v4"/><path d="M4 10h16"/><path d="M4 14h16"/>'),
    keywords: ['mac', 'address', 'lookup', 'vendor', 'manufacturer', 'oui', 'network']
  },
  {
    id: 'net-sitemap',
    name: 'Sitemap & Robots Viewer',
    category: 'Internet',
    description: 'Quickly view a site\'s robots.txt directives and search for sitemaps.',
    icon: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    keywords: ['sitemap', 'robots.txt', 'seo', 'spider', 'crawler', 'viewer']
  }
];

const CATEGORY_ORDER = ['Artificial Intelligence', 'Text & Content', 'Finance & Money', 'Developer Utilities', 'Math & Measurements', 'Design & Media', 'Internet'];

// Lazy-load tool modules
const toolModules = import.meta.glob('./tools/*.js');

// --------------- STATE ---------------
let currentToolId       = null;
let currentToolInstance = null;
let currentToolObj      = null;
let currentPage         = 'home';

// --------------- DOM REFS ---------------
const homeView        = document.getElementById('home-view');
const toolsView       = document.getElementById('tools-view');
const viewport        = document.getElementById('tool-viewport');
const supportView     = document.getElementById('support-view');
const viewportTitle   = document.getElementById('viewport-title');
const viewportContent = document.getElementById('viewport-content');
const backBtn         = document.getElementById('back-btn');
const searchInput     = document.getElementById('search');
const searchWrapper   = document.getElementById('search-wrapper');
const logo            = document.getElementById('logo');
const grid            = document.getElementById('tool-grid');
const navLinks        = document.querySelectorAll('.nav-link');
const homeToolCount   = document.getElementById('home-tool-count');

if (homeToolCount) homeToolCount.textContent = `${TOOLS.length}`;

const VIEWS = {
  home:    homeView,
  tools:   toolsView,
  support: supportView,
  tool:    viewport,
};

// --------------- FUZZY SEARCH & LEVENSHTEIN ENGINE ---------------
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = [];
  for (let i = 0; i <= a.length; i++) row[i] = i;
  for (let i = 1; i <= b.length; i++) {
    let prev = i;
    for (let j = 1; j <= a.length; j++) {
      const val = (b[i - 1] === a[j - 1]) ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

function matchScore(query, tool) {
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const targets = [
    tool.name.toLowerCase(),
    tool.category.toLowerCase(),
    tool.description.toLowerCase(),
    ...tool.keywords.map(k => k.toLowerCase())
  ];

  // 1. Direct substring match
  for (const t of targets) {
    if (t.includes(q)) return 100;
  }

  // 2. Word prefix match
  const qWords = q.split(/\\s+/);
  for (const t of targets) {
    const tWords = t.split(/\\s+/);
    if (qWords.every(qw => tWords.some(tw => tw.startsWith(qw)))) {
      return 80;
    }
  }

  // 3. Typo / Levenshtein fuzzy match
  let maxFuzzy = 0;
  for (const t of targets) {
    const tWords = t.split(/\\s+/);
    for (const tw of tWords) {
      if (Math.abs(tw.length - q.length) <= 3) {
        const dist = levenshtein(q, tw);
        const maxLen = Math.max(q.length, tw.length);
        const similarity = 1 - (dist / maxLen);
        if (similarity > 0.6) {
          const score = Math.round(similarity * 60);
          if (score > maxFuzzy) maxFuzzy = score;
        }
      }
    }
  }

  return maxFuzzy;
}

// --------------- PAGE ROUTING ---------------
function showPage(page) {
  if (currentToolInstance?.destroy) currentToolInstance.destroy();
  currentToolInstance = null;
  currentToolId       = null;

  Object.values(VIEWS).forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('fade-in');
  });

  const view = VIEWS[page];
  if (view) {
    view.classList.remove('hidden');
    // Force reflow for animation
    void view.offsetWidth;
    view.classList.add('fade-in');
  }

  currentPage = page;

  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  searchWrapper.style.display = (page === 'tools') ? '' : 'none';
}

async function openTool(id) {
  const tool = TOOLS.find(t => t.id === id);
  if (!tool) return;

  if (currentToolInstance?.destroy) currentToolInstance.destroy();

  Object.values(VIEWS).forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('fade-in');
  });
  searchWrapper.style.display = 'none';

  viewportTitle.textContent   = tool.name;
  viewportContent.innerHTML   = '';
  viewport.classList.remove('hidden');
  
  // Force reflow
  void viewport.offsetWidth;
  viewport.classList.add('fade-in');

  navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === 'tools'));

  currentPage = 'tool';
  currentToolObj = tool;

  const path = `./tools/${id}.js`;
  try {
    const loader = toolModules[path];
    if (!loader) throw new Error(`Module not found: ${path}`);
    const module   = await loader();
    currentToolInstance = module.default;
    currentToolId       = id;
    currentToolInstance.render(viewportContent);
  } catch (err) {
    viewportContent.innerHTML = `<div class="no-results"><p class="no-results-title">Failed to load tool</p><p class="no-results-text">${err.message}</p></div>`;
    console.error(err);
  }

  currentPage = 'tool';
}

// --------------- GRID RENDERING ---------------
function renderGrid(toolList) {
  grid.innerHTML = '';

  if (toolList.length === 0) {
    grid.innerHTML = `<div class="no-results"><p class="no-results-title">No tools found</p><p class="no-results-text">Try typing a keyword or tool name</p></div>`;
    return;
  }

  const byCat = {};
  for (const tool of toolList) {
    const cat = tool.category || 'Miscellaneous';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(tool);
  }

  for (const category of CATEGORY_ORDER) {
    const tools = byCat[category];
    if (!tools || tools.length === 0) continue;

    const section       = document.createElement('section');
    section.className   = 'grid-category fade-in';
    section.innerHTML   = `<h2 class="category-label" style="font-family: var(--pixel); font-size: 1.5rem; color:var(--black); border-bottom: 2px solid var(--black); padding-bottom: 8px; margin-bottom: 24px; font-weight: 500; letter-spacing: -0.5px;">${category}</h2>`;

    const toolsGrid     = document.createElement('div');
    toolsGrid.className = 'category-tools';

    for (const tool of tools) {
      const card       = document.createElement('a');
      card.className   = 'tool-card';
      card.href        = `#${tool.id}`;
      card.id          = `card-${tool.id}`;
      card.innerHTML   = `
        <div class="tool-card-icon">${tool.icon}</div>
        <div class="tool-card-info">
          <div class="tool-card-name">${tool.name}</div>
          <div class="tool-card-desc">${tool.description}</div>
        </div>`;
      toolsGrid.appendChild(card);
    }

    section.appendChild(toolsGrid);
    grid.appendChild(section);
  }
}

// --------------- SEARCH ---------------
function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) { renderGrid(TOOLS); return; }

  const scored = TOOLS.map(t => ({ tool: t, score: matchScore(q, t) }))
                      .filter(item => item.score > 0)
                      .sort((a, b) => b.score - a.score)
                      .map(item => item.tool);

  renderGrid(scored);
}

// --------------- HASH ROUTING ---------------
function handleHash() {
  const hash = window.location.hash.slice(1) || 'home';

  if (hash === 'home' || hash === '')          showPage('home');
  else if (hash === 'tools')                   showPage('tools');
  else if (hash === 'support')                 showPage('support');
  else if (TOOLS.find(t => t.id === hash))     openTool(hash);
  else                                         showPage('home');
}

// --------------- KEYBOARD SHORTCUTS ---------------
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInput && currentPage === 'tools') {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === 'Escape') {
    if (document.activeElement === searchInput) {
      searchInput.blur();
      if (searchInput.value) { searchInput.value = ''; handleSearch(); }
    } else if (currentPage === 'tool') {
      window.location.hash = '#tools';
    }
  }
});

// --------------- EVENT BINDINGS ---------------
searchInput.addEventListener('input', handleSearch);
backBtn.addEventListener('click', () => { window.location.hash = '#tools'; });
logo.addEventListener('click',    (e) => { e.preventDefault(); window.location.hash = '#home'; });
window.addEventListener('hashchange', handleHash);

// --------------- INIT ---------------
renderGrid(TOOLS);
handleHash();

// --------------- FLOATING TIPS LOGIC ---------------
const tipsFab = document.getElementById('tips-fab');
const tipsModal = document.getElementById('tips-modal');
const closeTipsBtn = document.getElementById('close-tips');
const tipsContent = document.getElementById('tips-content');
const modalInner = tipsModal.querySelector('div');

const showTips = () => {
  tipsContent.innerHTML = '';
  let tips = [];
  
  if (currentPage === 'home') {
    tips = [
      'Welcome to Toolbox!',
      'Click the <strong>Browse Tools</strong> button to see the full collection of available tools.'
    ];
  } else if (currentPage === 'support') {
    tips = [
      'If you encounter a bug, use the <strong>Complain about a tool</strong> button to send a report.',
      'To request a new feature, use the <strong>Ask for a tool</strong> button.'
    ];
  } else if (currentPage === 'tool' && currentToolObj) {
    let usage = [];
    switch (currentToolObj.category) {
      case 'Developer Tools':
        usage = ['Paste your code or data into the input fields.', 'The output will automatically generate or update as you type.'];
        break;
      case 'Text & Content':
        usage = ['Type or paste your text into the main text area.', 'Use the controls to manipulate, format, or analyze the text instantly.'];
        break;
      case 'Converters':
        usage = ['Enter the value you want to convert.', 'The converted results will instantly appear below.'];
        break;
      case 'Finance & Math':
        usage = ['Input your numerical data into the fields.', 'The tool will automatically calculate and display the results.'];
        break;
      case 'Internet':
      case 'Internet & Web':
        usage = ['Enter the IP, Domain, or URL you want to analyze.', 'Click the action button to fetch the network information.'];
        break;
      case 'Artificial Intelligence':
        usage = ['Provide the text or image for the AI to analyze.', 'Wait for the model to process your request (it runs entirely offline in your browser!).', 'Models may take a moment to download the first time you use them.'];
        break;
      default:
        usage = ['Follow the on-screen inputs to use this tool. All processing happens instantly in your browser.'];
    }

    tips = [
      `<strong>${currentToolObj.name}:</strong> ${currentToolObj.description}.`,
      ...usage
    ];
  } else { // tools
    tips = [
      'Type in the search bar above to quickly filter tools by name or keyword.',
      'Click on any tool card to open it.'
    ];
  }

  tips.forEach(tip => {
    const li = document.createElement('li');
    li.innerHTML = tip;
    tipsContent.appendChild(li);
  });

  tipsModal.style.display = 'flex';
  requestAnimationFrame(() => {
    tipsModal.style.opacity = '1';
    modalInner.style.transform = 'translateY(0)';
  });
};

const hideTips = () => {
  tipsModal.style.opacity = '0';
  modalInner.style.transform = 'translateY(20px)';
  setTimeout(() => {
    tipsModal.style.display = 'none';
  }, 200);
};

if (tipsFab) {
  tipsFab.addEventListener('click', showTips);
  closeTipsBtn.addEventListener('click', hideTips);
  tipsModal.addEventListener('click', (e) => {
    if (e.target === tipsModal) hideTips();
  });
}
