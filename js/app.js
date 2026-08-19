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
    category: 'Business & Finance',
    description: 'Calculate investment growth over time with monthly contributions',
    icon: svg('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    keywords: ['finance', 'compound', 'interest', 'investment', 'growth', 'calculator', 'money', 'stock', 'returns', 'yield', 'savings']
  },
  {
    id: 'salary-converter',
    name: 'Salary Converter',
    category: 'Business & Finance',
    description: 'Convert between hourly wages and annual salaries instantly',
    icon: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M17 12h.01M7 12h.01"/>'),
    keywords: ['salary', 'hourly', 'wage', 'income', 'pay', 'paycheck', 'converter', 'money', 'job', 'work', 'annual']
  },
  {
    id: 'loan-calculator',
    name: 'Loan Calculator',
    category: 'Business & Finance',
    description: 'Calculate EMI, total interest, and payments for mortgages/loans',
    icon: svg('<path d="M3 21v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 13V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M10 21V11M14 21V11"/>'),
    keywords: ['loan', 'mortgage', 'emi', 'interest', 'debt', 'payment', 'calculator', 'finance', 'auto loan', 'car loan', 'house']
  },
  {
    id: 'subscription-analyzer',
    name: 'Cost Analyzer',
    category: 'Business & Finance',
    description: 'See how much recurring expenses drain from you over a decade',
    icon: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    keywords: ['subscription', 'cost', 'recurring', 'expense', 'analyzer', 'finance', 'money', 'drain', 'coffee', 'netflix', 'budget']
  },
  {
    id: 'financial-analyzer',
    name: 'Financial Analyzer',
    category: 'Business & Finance',
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
    category: 'Business & Finance',
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
  
  // ------------------------------------------------------------
  // INTERNET & WEB
  // ------------------------------------------------------------
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
  },

  // ------------------------------------------------------------
  // MODELING & 3D
  // ------------------------------------------------------------
  {
    id: 'anatomy-explorer',
    name: 'Anatomy Explorer',
    category: 'Modeling & 3D',
    description: 'Interactive 3D human body — isolate systems, click structures, slice through planes',
    icon: svg('<circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7"/><path d="M8 9h8"/><path d="M12 14l-2.5 7"/><path d="M12 14l2.5 7"/>'),
    keywords: ['anatomy', 'human body', 'body', 'medical', 'med school', 'medicine', 'skeleton', 'bones', 'organs', 'muscles', 'circulatory', 'nervous', 'respiratory', 'digestive', 'anatomical', '3d', 'model', 'modeler', 'physiology', 'biology', 'study', 'heart', 'lungs', 'brain', 'liver', 'kidney', 'ribcage', 'spine', 'skull']
  },
  {
    id: 'container-planner',
    name: 'Container & Cabin Planner',
    category: 'Modeling & 3D',
    description: 'Lay out a shipping container or portacabin in 3D — doors, windows, walls, and a printable spec sheet',
    icon: svg('<rect x="2" y="7" width="20" height="11" rx="1"/><path d="M6 7v11"/><path d="M10 7v11"/><path d="M14 7v11"/><path d="M18 7v11"/>'),
    keywords: ['container', 'portacabin', 'porta cabin', 'portakabin', 'shipping container', 'cabin', 'conex', 'iso container', 'site office', 'modular', 'prefab', 'layout', 'floor plan', 'floorplan', 'planner', 'modeler', '3d', 'building', 'construction', 'office', '20ft', '40ft', 'high cube', 'conversion', 'cabin design']
  },

  // ------------------------------------------------------------
  // CODE & COMPILERS
  // ------------------------------------------------------------
  {
    id: 'code-playground',
    name: 'Code Playground',
    category: 'Developer Utilities',
    description: 'Write and run JavaScript, TypeScript, Python, and SQL — no install, runs in your browser',
    icon: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    keywords: ['code', 'compiler', 'interpreter', 'run code', 'playground', 'repl', 'ide', 'editor', 'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'sql', 'sqlite', 'execute', 'compile', 'programming', 'coding', 'sandbox', 'online compiler', 'student', 'practice', 'exercise', 'script']
  },

  // ------------------------------------------------------------
  // BUSINESS & FINANCE — ACCOUNTING & TAX
  // ------------------------------------------------------------
  {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    category: 'Business & Finance',
    description: 'Build a professional invoice with line items and tax, then print or save as PDF',
    icon: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>'),
    keywords: ['invoice', 'bill', 'billing', 'receipt', 'quote', 'estimate', 'line items', 'client', 'freelance', 'accounting', 'pdf', 'print', 'tax', 'vat', 'payment', 'due', 'business']
  },
  {
    id: 'depreciation-calculator',
    name: 'Depreciation Schedule',
    category: 'Business & Finance',
    description: 'Straight-line, declining balance, and sum-of-years depreciation with a full yearly table',
    icon: svg('<path d="M3 3v18h18"/><polyline points="7 8 11 12 15 9 21 15"/>'),
    keywords: ['depreciation', 'asset', 'assets', 'straight line', 'declining balance', 'double declining', 'sum of years', 'syd', 'book value', 'salvage', 'useful life', 'accounting', 'fixed assets', 'capex', 'writedown', 'amortize', 'tax']
  },
  {
    id: 'vat-calculator',
    name: 'VAT & Sales Tax',
    category: 'Business & Finance',
    description: 'Add or strip tax from any amount, with reverse calculation and multi-rate support',
    icon: svg('<path d="M9 14l6-6"/><circle cx="9.5" cy="8.5" r="1.5"/><circle cx="14.5" cy="14.5" r="1.5"/><rect x="3" y="3" width="18" height="18" rx="3"/>'),
    keywords: ['vat', 'sales tax', 'tax', 'gst', 'hst', 'value added tax', 'add tax', 'remove tax', 'net', 'gross', 'inclusive', 'exclusive', 'reverse vat', 'percentage', 'accounting']
  },
  {
    id: 'break-even',
    name: 'Break-Even Analysis',
    category: 'Business & Finance',
    description: 'Find the units and revenue where you stop losing money, with a visual break-even chart',
    icon: svg('<path d="M3 3v18h18"/><path d="M6 18L20 6"/><path d="M6 8l14 10"/>'),
    keywords: ['break even', 'breakeven', 'break-even', 'fixed costs', 'variable costs', 'contribution margin', 'units', 'profit', 'loss', 'analysis', 'pricing', 'business plan', 'startup', 'margin of safety']
  },
  {
    id: 'amortization-schedule',
    name: 'Amortization Schedule',
    category: 'Business & Finance',
    description: 'Full payment-by-payment loan breakdown with extra payments and interest saved',
    icon: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="M8 4V2"/><path d="M16 4V2"/><path d="M8 14h3"/><path d="M8 18h3"/>'),
    keywords: ['amortization', 'amortisation', 'schedule', 'loan', 'mortgage', 'payment', 'principal', 'interest', 'table', 'extra payment', 'payoff', 'balance', 'monthly payment', 'debt']
  },

  // ------------------------------------------------------------
  // BUSINESS & FINANCE — EXEC & STRATEGY
  // ------------------------------------------------------------
  {
    id: 'runway-calculator',
    name: 'Runway & Burn Rate',
    category: 'Business & Finance',
    description: 'How many months of cash you have left, with growth and hiring factored in',
    icon: svg('<path d="M12 2l3 6 6 .9-4.5 4.2 1.1 6-5.6-3-5.6 3 1.1-6L3 8.9 9 8z"/>'),
    keywords: ['runway', 'burn rate', 'burn', 'cash', 'months left', 'startup', 'founder', 'ceo', 'out of money', 'fundraising', 'net burn', 'gross burn', 'mrr', 'growth', 'hiring', 'cash flow']
  },
  {
    id: 'cap-table',
    name: 'Cap Table & Dilution',
    category: 'Business & Finance',
    description: 'Model ownership across funding rounds and see exactly who gets diluted',
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v9l7 4.5"/>'),
    keywords: ['cap table', 'capitalization table', 'equity', 'dilution', 'shares', 'ownership', 'founder', 'investor', 'seed', 'series a', 'safe', 'convertible', 'option pool', 'esop', 'valuation', 'startup', 'ceo', 'stake']
  },
  {
    id: 'npv-irr',
    name: 'NPV, IRR & Payback',
    category: 'Business & Finance',
    description: 'Evaluate an investment: net present value, internal rate of return, and payback period',
    icon: svg('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    keywords: ['npv', 'irr', 'payback', 'net present value', 'internal rate of return', 'discount rate', 'cash flow', 'investment', 'roi', 'capital budgeting', 'project', 'valuation', 'finance', 'wacc', 'dcf']
  },
  {
    id: 'unit-economics',
    name: 'Unit Economics',
    category: 'Business & Finance',
    description: 'CAC, LTV, payback period and the ratios investors will ask you about',
    icon: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'),
    keywords: ['unit economics', 'cac', 'ltv', 'clv', 'customer acquisition cost', 'lifetime value', 'churn', 'retention', 'arpu', 'payback', 'saas', 'metrics', 'growth', 'ceo', 'startup', 'ratio']
  },
  {
    id: 'margin-markup',
    name: 'Margin & Markup',
    category: 'Business & Finance',
    description: 'Convert between cost, price, margin and markup — and price a product properly',
    icon: svg('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
    keywords: ['margin', 'markup', 'gross margin', 'profit margin', 'cost', 'price', 'pricing', 'selling price', 'discount', 'retail', 'wholesale', 'profit', 'sales', 'accounting']
  },

  // ------------------------------------------------------------
  // BUSINESS & FINANCE — OPS & PEOPLE
  // ------------------------------------------------------------
  {
    id: 'payroll-cost',
    name: 'Employee Cost Calculator',
    category: 'Business & Finance',
    description: 'What a hire actually costs you once taxes, benefits and overhead are added',
    icon: svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    keywords: ['payroll', 'employee cost', 'salary', 'hire', 'hiring', 'benefits', 'employer tax', 'ni', 'national insurance', 'pension', 'overhead', 'fully loaded', 'headcount', 'hr', 'budget', 'total cost']
  },
  {
    id: 'meeting-cost',
    name: 'Meeting Cost Calculator',
    category: 'Business & Finance',
    description: 'Live counter showing what this meeting is costing the company right now',
    icon: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    keywords: ['meeting', 'cost', 'time', 'salary', 'waste', 'productivity', 'attendees', 'hourly rate', 'timer', 'stopwatch', 'burn', 'office', 'corporate', 'ceo', 'manager']
  },
  {
    id: 'timesheet',
    name: 'Timesheet & Billables',
    category: 'Business & Finance',
    description: 'Log hours by task and rate, then total up what to invoice',
    icon: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="M8 4V2"/><path d="M16 4V2"/><path d="M12 14v3"/><path d="M12 14h3"/>'),
    keywords: ['timesheet', 'time sheet', 'billable', 'hours', 'tracking', 'consultant', 'freelance', 'rate', 'invoice', 'logging', 'work', 'project', 'client', 'timekeeping', 'utilization']
  },
  {
    id: 'pto-accrual',
    name: 'PTO & Leave Tracker',
    category: 'Business & Finance',
    description: 'Track accrued holiday, days taken, and what balance is left',
    icon: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="M8 4V2"/><path d="M16 4V2"/><polyline points="9 15 11 17 15 13"/>'),
    keywords: ['pto', 'paid time off', 'holiday', 'vacation', 'leave', 'accrual', 'annual leave', 'days off', 'balance', 'hr', 'sick days', 'carryover', 'entitlement', 'tracker']
  },
  {
    id: 'business-days',
    name: 'Business Days Calculator',
    category: 'Business & Finance',
    description: 'Count working days between dates, or find a deadline N working days out',
    icon: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="M8 4V2"/><path d="M16 4V2"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>'),
    keywords: ['business days', 'working days', 'weekdays', 'deadline', 'date', 'calculator', 'sla', 'due date', 'holidays', 'workdays', 'between dates', 'project', 'schedule', 'delivery']
  },
  {
    id: 'email-signature',
    name: 'Email Signature Builder',
    category: 'Business & Finance',
    description: 'Design a clean corporate email signature and copy it straight into your mail client',
    icon: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>'),
    keywords: ['email signature', 'signature', 'sign off', 'outlook', 'gmail', 'html signature', 'corporate', 'branding', 'contact', 'footer', 'professional', 'business card', 'builder']
  }
];

// Preferred display order. Any category present on a tool but missing here is
// appended automatically, so a new category can never silently vanish from the grid.
const PREFERRED_ORDER = [
  'Modeling & 3D',
  'Business & Finance',
  'Developer Utilities',
  'Text & Content',
  'Math & Measurements',
  'Design & Media',
  'Internet',
];

function categoryOrder(toolList) {
  const present = [...new Set(toolList.map(t => t.category || 'Miscellaneous'))];
  const ordered = PREFERRED_ORDER.filter(c => present.includes(c));
  const extras  = present.filter(c => !PREFERRED_ORDER.includes(c)).sort();
  return [...ordered, ...extras];
}

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

// Counts are derived, never hand-maintained — adding a tool updates the copy.
if (homeToolCount) homeToolCount.textContent = `${TOOLS.length}`;
const homeEyebrowCount = document.getElementById('home-eyebrow-count');
if (homeEyebrowCount) homeEyebrowCount.textContent = `${TOOLS.length}`;

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
  const qWords = q.split(/\s+/);
  for (const t of targets) {
    const tWords = t.split(/\s+/);
    if (qWords.every(qw => tWords.some(tw => tw.startsWith(qw)))) {
      return 80;
    }
  }

  // 3. Typo / Levenshtein fuzzy match
  let maxFuzzy = 0;
  for (const t of targets) {
    const tWords = t.split(/\s+/);
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

  for (const category of categoryOrder(toolList)) {
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

// Usage hints keyed by the category strings actually used in the registry.
// Keep these in sync with PREFERRED_ORDER — an unknown category falls back to GENERIC_TIPS.
const CATEGORY_TIPS = {
  'Modeling & 3D': [
    'Drag with the left mouse button to rotate the model, and scroll to zoom in and out.',
    'Use the panel on the left to show or hide parts, then click any part to read about it.',
  ],
  'Business & Finance': [
    'Fill in the numbers you know — results recalculate the moment you stop typing.',
    'Every figure stays on your device. Nothing is uploaded, saved, or sent anywhere.',
  ],
  'Developer Utilities': [
    'Paste your code or data into the input field.',
    'Output updates as you type, and the copy button grabs the whole result.',
  ],
  'Text & Content': [
    'Type or paste your text into the main text area.',
    'Use the controls to reformat, analyse, or transform it instantly.',
  ],
  'Math & Measurements': [
    'Enter a value and the conversions or calculations appear immediately.',
    'Units and bases can be swapped without retyping your input.',
  ],
  'Design & Media': [
    'Adjust the inputs and the preview updates live.',
    'Generated values can be copied straight into your stylesheet or design file.',
  ],
  'Internet': [
    'Enter the IP, domain, or URL you want to look up.',
    'This tool queries a public service, so it needs an internet connection — unlike most of Toolbox.',
  ],
};

const GENERIC_TIPS = [
  'Follow the on-screen inputs to use this tool. Everything runs in your browser.',
];

const PAGE_TIPS = {
  home: [
    'Welcome to Toolbox.',
    'Hit <strong>Browse Tools</strong> to see the full collection.',
  ],
  tools: [
    'Type in the search bar to filter by name, keyword, or what you are trying to do.',
    'Search tolerates typos, so <em>calender</em> still finds the calendar tools.',
    'Press <kbd>/</kbd> to jump straight to search.',
  ],
  support: [
    'Found a bug? Use <strong>Complain about a tool</strong> to send a report.',
    'Want something built? Use <strong>Ask for a tool</strong>.',
  ],
};

const showTips = () => {
  tipsContent.innerHTML = '';
  let tips;

  if (currentPage === 'tool' && currentToolObj) {
    const usage = currentToolObj.tips
      || CATEGORY_TIPS[currentToolObj.category]
      || GENERIC_TIPS;
    tips = [`<strong>${currentToolObj.name}</strong> — ${currentToolObj.description}.`, ...usage];
  } else {
    tips = PAGE_TIPS[currentPage] || PAGE_TIPS.tools;
  }

  for (const tip of tips) {
    const li = document.createElement('li');
    li.innerHTML = tip;
    tipsContent.appendChild(li);
  }

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
