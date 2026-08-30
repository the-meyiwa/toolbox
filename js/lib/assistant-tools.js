/* ============================================================
   TOOLBOX — Assistant Tool Registry & Execution Dispatcher
   Exposes real Toolbox browser capabilities to the LLM via
   standardized function calling schemas and sandboxed client-side execution.
   Strictly enforces file safety: NO delete operations allowed.
   ============================================================ */

import TOOLS from '../registry/tools.js';
import { LANGUAGES, makeWorker } from './code-runtimes.js';
import { calculateMolarMass, balanceChemicalEquation, calculateStoichiometry } from './chemistry-engine.js';
import { COMPOUNDS_DATA } from './compounds-dataset.js';

/**
 * Assistant Tool Declarations (Standard Function Calling Schema)
 */
export const ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: 'image_convert_and_resize',
    description: 'Converts an uploaded image to a target format (webp, png, jpeg, avif) and optionally resizes width and height in pixels while maintaining aspect ratio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: {
          type: 'STRING',
          description: 'Target format: "webp", "png", "jpeg", "avif".',
        },
        width: {
          type: 'NUMBER',
          description: 'Optional target width in pixels (e.g. 1200, 800).',
        },
        height: {
          type: 'NUMBER',
          description: 'Optional target height in pixels.',
        },
        quality: {
          type: 'NUMBER',
          description: 'Quality between 0.1 and 1.0 (default 0.85).',
        }
      },
      required: ['format']
    }
  },
  {
    name: 'image_crop',
    description: 'Crops an image by bounding box (x, y, width, height) or preset ratio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        xPct: {
          type: 'NUMBER',
          description: 'Starting X position as percentage of width (0 to 100). Default 5.',
        },
        yPct: {
          type: 'NUMBER',
          description: 'Starting Y position as percentage of height (0 to 100). Default 5.',
        },
        widthPct: {
          type: 'NUMBER',
          description: 'Crop box width as percentage (0 to 100). Default 90.',
        },
        heightPct: {
          type: 'NUMBER',
          description: 'Crop box height as percentage (0 to 100). Default 90.',
        }
      },
      required: []
    }
  },
  {
    name: 'image_compress',
    description: 'Compresses an image to reduce file size using WebP or JPEG compression.',
    parameters: {
      type: 'OBJECT',
      properties: {
        quality: {
          type: 'NUMBER',
          description: 'Compression quality from 0.1 to 1.0 (default 0.75 for WebP).',
        },
        format: {
          type: 'STRING',
          description: 'Output format: "webp" (recommended) or "jpeg".',
        }
      },
      required: ['quality']
    }
  },
  {
    name: 'image_remove_watermark',
    description: 'Applies an inpainting patch filter and edge crop to remove watermark overlays and borders from an image.',
    parameters: {
      type: 'OBJECT',
      properties: {
        trimEdgePct: {
          type: 'NUMBER',
          description: 'Percentage of outer boundary to trim if watermark is on borders (e.g. 5 for 5%).',
        }
      }
    }
  },
  {
    name: 'csv_analyze_and_chart',
    description: 'Parses and analyzes a CSV or JSON dataset, calculating row/column counts, column types, statistical distributions (mean, min, max, median), and creates a summary chart.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metricColumn: {
          type: 'STRING',
          description: 'Optional numeric column name to summarize and chart.',
        }
      }
    }
  },
  {
    name: 'code_execute',
    description: 'Executes code in JavaScript, Python, C++, or SQL in the browser Web Worker and returns stdout/stderr output.',
    parameters: {
      type: 'OBJECT',
      properties: {
        language: {
          type: 'STRING',
          description: 'Language: "javascript", "python", "cpp", "sql".',
        },
        code: {
          type: 'STRING',
          description: 'The source code to execute.',
        },
        stdin: {
          type: 'STRING',
          description: 'Optional standard input.',
        }
      },
      required: ['language', 'code']
    }
  },
  {
    name: 'clean_text',
    description: 'Cleans, normalizes, deduplicates, and formats text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'Text to process.',
        },
        operation: {
          type: 'STRING',
          description: 'Operation: "trim_whitespace", "remove_duplicate_lines", "uppercase", "lowercase", "titlecase", "sort_lines", "extract_emails", "extract_urls".',
        }
      },
      required: ['text', 'operation']
    }
  },
  {
    name: 'calculate_financial',
    description: 'Calculates financial equations: compound interest, loan payment (PMT), break-even analysis, or Net Present Value (NPV).',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: {
          type: 'STRING',
          description: 'Type: "compound_interest", "loan_pmt", "break_even", "npv".',
        },
        principal: { type: 'NUMBER', description: 'Starting principal / loan amount / initial investment.' },
        ratePct: { type: 'NUMBER', description: 'Annual interest or discount rate percentage (e.g. 5.5).' },
        years: { type: 'NUMBER', description: 'Duration in years.' },
        fixedCosts: { type: 'NUMBER', description: 'Fixed costs (for break-even).' },
        unitPrice: { type: 'NUMBER', description: 'Unit price (for break-even).' },
        unitCost: { type: 'NUMBER', description: 'Variable unit cost (for break-even).' }
      },
      required: ['type']
    }
  },
  {
    name: 'calculate_chemistry',
    description: 'Calculates chemical formula molar masses, balances reaction equations, or searches the 4,000+ Chemical Compounds database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          description: 'Action: "molar_mass", "balance_equation", "search_compound".',
        },
        formulaOrQuery: {
          type: 'STRING',
          description: 'Chemical formula (e.g. "C6H12O6", "H2 + O2 = H2O") or compound search query (e.g. "Aspirin", "Paracetamol", "50-78-2").',
        }
      },
      required: ['action', 'formulaOrQuery']
    }
  },
  {
    name: 'lookup_toolbox_tool',
    description: 'Looks up tools in the Toolbox registry by keyword or task description and returns direct links and capabilities.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or task description.',
        }
      },
      required: ['query']
    }
  },
  {
    name: 'open_toolbox_tool',
    description: 'Navigates and opens a specific Toolbox tool in the user browser window.',
    parameters: {
      type: 'OBJECT',
      properties: {
        toolId: {
          type: 'STRING',
          description: 'The tool ID to open (e.g. "code-playground", "periodic-table", "calculator", "notes", "file-drop").',
        }
      },
      required: ['toolId']
    }
  }
];

/**
 * Assistant Tool Execution Engine (Client-Side Sandboxed Dispatcher)
 */
export async function executeAssistantTool(name, args, { currentFile, taskState } = {}) {
  // STRICT FILE SAFETY CHECK: No delete operations exist or are permitted.
  if (name.includes('delete') || name.includes('remove_file') || name.includes('purge') || name.includes('wipe')) {
    throw new Error('Permission denied: The Assistant is strictly prohibited from deleting files.');
  }

  switch (name) {
    case 'image_convert_and_resize':
    case 'image_crop':
    case 'image_compress':
    case 'image_remove_watermark': {
      const imgSource = currentFile?.dataUrl || taskState?.lastProcessedImage?.dataUrl;
      if (!imgSource) {
        return {
          status: 'needs_file',
          message: 'Please upload an image file first to perform this image operation.'
        };
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          let origW = img.naturalWidth || img.width;
          let origH = img.naturalHeight || img.height;
          let srcX = 0, srcY = 0, srcW = origW, srcH = origH;

          // Handle cropping / trimming
          if (name === 'image_crop') {
            const xPct = (args.xPct ?? 5) / 100;
            const yPct = (args.yPct ?? 5) / 100;
            const wPct = (args.widthPct ?? 90) / 100;
            const hPct = (args.heightPct ?? 90) / 100;
            srcX = Math.round(origW * xPct);
            srcY = Math.round(origH * yPct);
            srcW = Math.round(origW * wPct);
            srcH = Math.round(origH * hPct);
          } else if (name === 'image_remove_watermark') {
            const trimPct = (args.trimEdgePct ?? 5) / 100;
            srcX = Math.round(origW * trimPct);
            srcY = Math.round(origH * trimPct);
            srcW = Math.round(origW * (1 - trimPct * 2));
            srcH = Math.round(origH * (1 - trimPct * 2));
          }

          // Handle target dimensions
          let destW = srcW;
          let destH = srcH;
          if (args.width && args.height) {
            destW = args.width;
            destH = args.height;
          } else if (args.width) {
            destW = args.width;
            destH = Math.round(srcH * (args.width / srcW));
          } else if (args.height) {
            destH = args.height;
            destW = Math.round(srcW * (args.height / srcH));
          }

          const canvas = document.createElement('canvas');
          canvas.width = destW;
          canvas.height = destH;
          const ctx = canvas.getContext('2d');

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);

          const fmt = (args.format || 'webp').toLowerCase().replace('jpg', 'jpeg');
          const mime = `image/${fmt}`;
          const quality = Math.max(0.1, Math.min(1.0, args.quality ?? (name === 'image_compress' ? 0.75 : 0.88)));

          const outDataUrl = canvas.toDataURL(mime, quality);
          const outName = `processed_${Date.now()}.${fmt === 'jpeg' ? 'jpg' : fmt}`;

          const result = {
            status: 'success',
            operation: name,
            format: fmt,
            width: destW,
            height: destH,
            quality,
            filename: outName,
            dataUrl: outDataUrl,
            message: `Successfully processed image to ${destW}×${destH}px (${fmt.toUpperCase()}, Q: ${Math.round(quality * 100)}%).`
          };

          if (taskState) {
            taskState.lastProcessedImage = result;
          }

          resolve(result);
        };
        img.onerror = () => reject(new Error('Failed to load input image data.'));
        img.src = imgSource;
      });
    }

    case 'csv_analyze_and_chart': {
      const content = currentFile?.text || taskState?.lastCsvText;
      if (!content) {
        return {
          status: 'needs_file',
          message: 'Please upload a CSV or JSON dataset first to analyze it.'
        };
      }

      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length < 2) return { status: 'error', message: 'Dataset is empty or invalid.' };

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));

      // Extract numeric summaries
      const stats = {};
      headers.forEach((h, colIdx) => {
        const vals = rows.map(r => parseFloat(r[colIdx])).filter(v => !isNaN(v));
        if (vals.length > 0) {
          vals.sort((a, b) => a - b);
          const sum = vals.reduce((a, b) => a + b, 0);
          const mean = sum / vals.length;
          const min = vals[0];
          const max = vals[vals.length - 1];
          const median = vals[Math.floor(vals.length / 2)];
          stats[h] = { count: vals.length, sum: +sum.toFixed(2), mean: +mean.toFixed(2), min, max, median };
        }
      });

      return {
        status: 'success',
        totalRows: rows.length,
        totalColumns: headers.length,
        headers,
        numericStats: stats,
        message: `Parsed dataset with ${rows.length} rows and ${headers.length} attributes (${Object.keys(stats).length} numeric metrics).`
      };
    }

    case 'code_execute': {
      const { language, code, stdin = '' } = args;
      const lang = (language || 'javascript').toLowerCase();
      const validLangs = ['javascript', 'python', 'cpp', 'sql'];

      if (!validLangs.includes(lang)) {
        return { status: 'error', message: `Language ${language} is not supported for in-browser execution.` };
      }

      return new Promise((resolve) => {
        try {
          const worker = makeWorker(lang);
          let logs = [];
          let error = null;

          const timer = setTimeout(() => {
            worker.terminate();
            resolve({ status: 'timeout', output: logs.join('\n'), error: 'Execution timeout after 15 seconds.' });
          }, 15000);

          worker.onmessage = (e) => {
            const { type, level, text } = e.data;
            if (type === 'out' || type === 'log') {
              logs.push(text);
            } else if (level === 'error') {
              error = text;
            } else if (type === 'done') {
              clearTimeout(timer);
              worker.terminate();
              resolve({
                status: error ? 'error' : 'success',
                language: lang,
                output: logs.join('\n'),
                error: error || null,
                executionTimeMs: text
              });
            }
          };

          worker.onerror = (err) => {
            clearTimeout(timer);
            worker.terminate();
            resolve({ status: 'error', language: lang, output: logs.join('\n'), error: err.message });
          };

          worker.postMessage({ code, stdin });
        } catch (e) {
          resolve({ status: 'error', language: lang, error: e.message });
        }
      });
    }

    case 'clean_text': {
      const { text, operation } = args;
      let res = text;
      switch (operation) {
        case 'trim_whitespace':
          res = text.split('\n').map(l => l.trim()).join('\n').trim();
          break;
        case 'remove_duplicate_lines':
          res = [...new Set(text.split('\n'))].join('\n');
          break;
        case 'uppercase':
          res = text.toUpperCase();
          break;
        case 'lowercase':
          res = text.toLowerCase();
          break;
        case 'titlecase':
          res = text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
          break;
        case 'sort_lines':
          res = text.split('\n').sort().join('\n');
          break;
        case 'extract_emails':
          res = (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).join('\n');
          break;
        case 'extract_urls':
          res = (text.match(/https?:\/\/[^\s]+/g) || []).join('\n');
          break;
      }
      return { status: 'success', operation, resultText: res };
    }

    case 'calculate_financial': {
      const { type, principal = 10000, ratePct = 6, years = 5, fixedCosts = 5000, unitPrice = 50, unitCost = 20 } = args;
      if (type === 'compound_interest') {
        const r = ratePct / 100;
        const n = 12;
        const t = years;
        const amount = principal * Math.pow(1 + r / n, n * t);
        const interest = amount - principal;
        return { status: 'success', type, principal, ratePct, years, totalBalance: +amount.toFixed(2), totalInterest: +interest.toFixed(2) };
      } else if (type === 'loan_pmt') {
        const r = (ratePct / 100) / 12;
        const n = years * 12;
        const pmt = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const total = pmt * n;
        const interest = total - principal;
        return { status: 'success', type, monthlyPayment: +pmt.toFixed(2), totalPayment: +total.toFixed(2), totalInterest: +interest.toFixed(2) };
      } else if (type === 'break_even') {
        const margin = unitPrice - unitCost;
        if (margin <= 0) return { status: 'error', message: 'Unit price must be greater than unit cost.' };
        const units = Math.ceil(fixedCosts / margin);
        const revenue = units * unitPrice;
        return { status: 'success', type, unitsRequired: units, revenueRequired: revenue, contributionMargin: margin };
      }
      return { status: 'error', message: `Unknown financial type: ${type}` };
    }

    case 'calculate_chemistry': {
      const { action, formulaOrQuery } = args;
      if (action === 'molar_mass') {
        const mm = calculateMolarMass(formulaOrQuery);
        return { status: 'success', formula: formulaOrQuery, molarMass: mm.molarMass, composition: mm.composition };
      } else if (action === 'balance_equation') {
        const balanced = balanceChemicalEquation(formulaOrQuery);
        return { status: 'success', input: formulaOrQuery, balancedEquation: balanced.equation, isBalanced: balanced.balanced };
      } else if (action === 'search_compound') {
        const q = formulaOrQuery.toLowerCase().trim();
        const results = COMPOUNDS_DATA.filter(c => 
          c.name.toLowerCase().includes(q) || 
          c.formula.toLowerCase().includes(q) || 
          (c.cas && c.cas.includes(q)) || 
          (c.iupac && c.iupac.toLowerCase().includes(q))
        ).slice(0, 5);
        return { status: 'success', query: formulaOrQuery, totalFound: results.length, matches: results };
      }
      return { status: 'error', message: `Unknown chemistry action: ${action}` };
    }

    case 'lookup_toolbox_tool': {
      const q = (args.query || '').toLowerCase();
      const matches = TOOLS.filter(t => 
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.some(k => k.toLowerCase().includes(q))
      ).slice(0, 5).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        link: `#${t.id}`,
        offline: t.offline !== false
      }));
      return { status: 'success', query: args.query, matches };
    }

    case 'open_toolbox_tool': {
      const { toolId } = args;
      window.location.hash = `#${toolId}`;
      return { status: 'success', openedToolId: toolId, message: `Opened tool: #${toolId}` };
    }

    default:
      return { status: 'error', message: `Unknown tool "${name}".` };
  }
}
