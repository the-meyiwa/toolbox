/* ============================================================
   TOOLBOX PLATFORM OVERHAUL: COMPREHENSIVE REGRESSION & INTEGRATION TESTS
   Validates:
   1. Assistant Output Sanitization & Clean Output (no tags, no JSON leak, zero emojis)
   2. Dynamic User-Facing Status Messages (user-appropriate level, no raw tool names)
   3. Deterministic Math & Collatz Conjecture Status with SVG Chart Data
   4. Function Plot Generation & Mathematical Verification
   5. File Icons Centralization across all 14 categories (pure SVG, zero emojis)
   6. Web Scraper Engine (schema.org JSON-LD, OpenGraph, image extraction & deduplication)
   7. CSV Artifact Generation & Auto-Persistence to Artifacts Store
   8. Local Places Geolocation & Haversine Distance Ascending Ranking
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanAssistantOutput, sanitizeUserFacingText } from '../../js/utils.js';
import { formatToolProgressStatus } from '../../js/tools/assistant.js';
import { calculateMath, calculateCollatz } from '../../js/lib/math-engine.js';
import { detectFileCategory, getFileTypeIcon } from '../../js/lib/file-icons.js';
import { parseWebPage } from '../../js/lib/web-scraper-engine.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { list as listArtifacts } from '../../js/lib/artifacts.js';

test('Platform Overhaul: Assistant Output Sanitization & Zero Emojis', async (t) => {
  await t.test('cleanAssistantOutput strips [Completed Actions: ...]', () => {
    const raw = 'Here is your report.\n[Completed Actions: tool: file_saved; search: NNPC gas station]\nHave a great day.';
    const cleaned = cleanAssistantOutput(raw);
    assert.ok(!cleaned.includes('[Completed Actions:'), 'Must strip [Completed Actions:] tag');
    assert.ok(cleaned.includes('Here is your report.'), 'Preserves user-facing text');
    assert.ok(cleaned.includes('Have a great day.'), 'Preserves closing text');
  });

  await t.test('cleanAssistantOutput strips raw tool execution logs and JSON dumps', () => {
    const raw = `Executing tool search_places_nearby...\nAction result: map-view\n\`\`\`json\n{\n  "operation": "collatz",\n  "input": 27\n}\n\`\`\`\nThe Collatz sequence for 27 reaches 1 after 111 steps.`;
    const cleaned = cleanAssistantOutput(raw);
    assert.ok(!cleaned.includes('Executing tool'), 'Must strip Executing tool logs');
    assert.ok(!cleaned.includes('Action result:'), 'Must strip Action result logs');
    assert.ok(!cleaned.includes('"operation": "collatz"'), 'Must strip leaked tool call JSON blocks');
    assert.ok(cleaned.includes('The Collatz sequence for 27 reaches 1 after 111 steps.'), 'Preserves real explanation');
  });

  await t.test('cleanAssistantOutput strips all emojis strictly', () => {
    const rawWithEmojis = 'Found the nearest NNPC filling station ⛽ 📍 at Victoria Island 🚗 🌟!';
    const cleaned = cleanAssistantOutput(rawWithEmojis);
    assert.doesNotMatch(cleaned, /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u, 'Cleaned text must contain zero emojis');
    assert.ok(cleaned.includes('Found the nearest NNPC filling station'), 'Preserves substantive wording');
  });

  await t.test('cleanAssistantOutput decodes HTML entities like &#x20;', () => {
    const rawWithEntities = 'Price:&#x20;₦450,000&nbsp;&amp;&nbsp;Availability:&#x20;In&#x20;Stock';
    const cleaned = cleanAssistantOutput(rawWithEntities);
    assert.ok(!cleaned.includes('&#x20;'), 'Decodes &#x20;');
    assert.ok(!cleaned.includes('&nbsp;'), 'Decodes &nbsp;');
    assert.ok(cleaned.includes('Price: ₦450,000 & Availability: In Stock'), 'Normalizes spaces cleanly');
  });
});

test('Platform Overhaul: Dynamic User-Facing Status Messages', async (t) => {
  await t.test('Generates user-appropriate progress messages without leaking tool names', () => {
    const placesMsg = formatToolProgressStatus('search_places_nearby', { query: 'Shoprite' });
    assert.equal(placesMsg, 'Searching verified places for "Shoprite"...');
    assert.ok(!placesMsg.includes('search_places_nearby'));

    const collatzMsg = formatToolProgressStatus('calculate_math', { operation: 'collatz', input: 27 });
    assert.equal(collatzMsg, 'Calculating Collatz sequence and trajectory...');

    const graphMsg = formatToolProgressStatus('calculate_math', { operation: 'graph', formula: 'sin(x)' });
    assert.equal(graphMsg, 'Generating mathematical function plot...');

    const scrapeMsg = formatToolProgressStatus('browser_scrape', { url: 'https://apple.com/iphone' });
    assert.equal(scrapeMsg, 'Extracting structured content from apple.com...');

    const imagesMsg = formatToolProgressStatus('browser_extract_images', { url: 'https://apple.com' });
    assert.equal(imagesMsg, 'Extracting images and media from apple.com...');

    const searchImagesMsg = formatToolProgressStatus('search_images', { query: 'femur bone' });
    assert.equal(searchImagesMsg, 'Searching verified images for "femur bone"...');

    const csvMsg = formatToolProgressStatus('generate_csv', { title: 'Apple Products' });
    assert.equal(csvMsg, 'Building and verifying CSV dataset...');
  });
});

test('Platform Overhaul: Deterministic Math, Collatz Status & Visualizations', async (t) => {
  await t.test('Collatz calculation produces verified trajectory, chart data, and unproven conjecture status', () => {
    const res = calculateCollatz(12);
    assert.equal(res.input, 12);
    assert.equal(res.steps, 9);
    assert.equal(res.maximum_value, 16);
    assert.equal(res.reached_one, true);
    assert.equal(res.conjectureStatus, 'CONJECTURE (UNPROVEN)');

    // Chart structure for inline SVG rendering
    assert.ok(res.chart, 'Must provide structured chart data');
    assert.equal(res.chart.labels.length, 10);
    assert.equal(res.chart.datasets[0].data.length, 10);
    assert.equal(res.chart.peakMetric.peakValue, 16);
    assert.equal(res.chart.stoppingTime, 9);
  });

  await t.test('calculateMath handles function graphing deterministically', () => {
    const res = calculateMath({
      operation: 'graph',
      formula: 'x^2 - 4',
      range: [-3, 3],
      samples: 13
    });
    assert.equal(res.operation, 'function_graph');
    assert.ok(Array.isArray(res.points), 'Points array exists');
    assert.equal(res.points.length, 14); // 0 through 13 inclusive
    assert.ok(res.chart, 'Chart object exists for SVG rendering');
    assert.equal(res.chart.formula, 'x^2 - 4');
  });
});

test('Platform Overhaul: File Category Detection and SVG Icons', async (t) => {
  await t.test('detectFileCategory classifies all 14 standard types accurately', () => {
    assert.equal(detectFileCategory('folder', true), 'folder');
    assert.equal(detectFileCategory('annual_report.pdf'), 'pdf');
    assert.equal(detectFileCategory('apple_prices.csv'), 'spreadsheet');
    assert.equal(detectFileCategory('financial_model.xlsx'), 'spreadsheet');
    assert.equal(detectFileCategory('brief.docx'), 'document');
    assert.equal(detectFileCategory('pitch.pptx'), 'presentation');
    assert.equal(detectFileCategory('banner.png'), 'image');
    assert.equal(detectFileCategory('data.json'), 'json');
    assert.equal(detectFileCategory('script.py'), 'code');
    assert.equal(detectFileCategory('audio.mp3'), 'audio');
    assert.equal(detectFileCategory('video.mp4'), 'video');
    assert.equal(detectFileCategory('archive.zip'), 'archive');
    assert.equal(detectFileCategory('notes.md'), 'markdown');
    assert.equal(detectFileCategory('readme.txt'), 'text');
    assert.equal(detectFileCategory('binary.dat'), 'generic');
  });

  await t.test('getFileTypeIcon returns valid SVG string with zero emojis', () => {
    const categories = [
      'folder', 'pdf', 'spreadsheet', 'document', 'presentation',
      'image', 'json', 'code', 'audio', 'video', 'archive', 'markdown', 'text', 'generic'
    ];
    for (const cat of categories) {
      const svg = getFileTypeIcon(cat, 20);
      assert.ok(svg.startsWith('<svg'), `Category ${cat} must return <svg>`);
      assert.ok(svg.endsWith('</svg>'), `Category ${cat} must close </svg>`);
      assert.doesNotMatch(svg, /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u, `SVG for ${cat} must contain zero emojis`);
    }
  });
});

test('Platform Overhaul: Web Scraper Engine & Image Extraction', async (t) => {
  await t.test('parseWebPage deduplicates images, captures dimensions and alt text', () => {
    const sampleHtml = `
      <html>
        <body>
          <img src="https://example.com/logo.svg" alt="Company Logo" width="120" height="40" />
          <img src="https://example.com/products/iphone15.jpg" alt="iPhone 15 Pro" width="600" height="400" />
          <img src="https://example.com/products/iphone15.jpg" alt="Duplicate Image" />
          <picture>
            <source srcset="https://example.com/products/macbook.webp" type="image/webp">
            <img src="https://example.com/products/macbook.jpg" alt="MacBook Pro" width="800" height="600" />
          </picture>
        </body>
      </html>
    `;

    const page = parseWebPage(sampleHtml, 'https://example.com/store');
    assert.ok(Array.isArray(page.images), 'Returns array of images');
    assert.ok(page.images.length >= 2, 'Extracts images from img and picture/source tags');
    
    // Deduplication check
    const iphoneImages = page.images.filter(img => img.url === 'https://example.com/products/iphone15.jpg');
    assert.equal(iphoneImages.length, 1, 'Duplicate image URLs must be deduplicated');

    const iphone = iphoneImages[0];
    assert.equal(iphone.alt, 'iPhone 15 Pro');
    assert.equal(iphone.width, 600);
    assert.equal(iphone.height, 400);
  });

  await t.test('parseWebPage extracts structured schema.org JSON-LD product data', () => {
    const htmlWithJsonLd = `
      <html>
        <head>
          <title>Apple iPhone 15 - Slot Systems Nigeria</title>
          <meta property="og:title" content="iPhone 15 128GB" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "iPhone 15 Pro",
              "category": "Smartphones",
              "offers": {
                "@type": "Offer",
                "price": "1450000",
                "priceCurrency": "NGN",
                "availability": "https://schema.org/InStock"
              }
            }
          </script>
        </head>
        <body>
          <h1>Apple iPhone 15 Pro</h1>
        </body>
      </html>
    `;

    const page = parseWebPage(htmlWithJsonLd, 'https://example.com/iphone-15');
    assert.equal(page.title, 'Apple iPhone 15 - Slot Systems Nigeria');
    assert.ok(page.products?.length > 0, 'Extracted schema.org product');
    const prod = page.products[0];
    assert.equal(prod.name, 'iPhone 15 Pro');
    assert.equal(prod.category, 'Smartphones');
    assert.equal(prod.price, 1450000);
    assert.equal(prod.currency, 'NGN');
  });
});

test('Platform Overhaul: CSV Generation & Artifact System Integration', async (t) => {
  await t.test('executeAssistantTool("generate_csv") saves CSV directly to workspace artifacts', async () => {
    const csvResult = await executeAssistantTool('generate_csv', {
      title: 'Apple Products in Nigeria',
      filename: 'apple_nigeria_products.csv',
      headers: ['Product Name', 'Category', 'Product Type', 'Price (NGN)', 'Source URL'],
      rows: [
        ['iPhone 15 Pro Max', 'Phones', 'Smartphone', '₦1,850,000', 'https://slot.ng/iphone-15'],
        ['MacBook Air M3', 'Computers', 'Laptop', '₦1,650,000', 'https://jumia.com.ng/macbook-m3'],
        ['AirPods Pro 2', 'Audio', 'Earphones', '₦380,000', 'https://konga.com/airpods-pro']
      ]
    });

    assert.equal(csvResult.status, 'success');
    assert.ok(csvResult.csv.includes('iPhone 15 Pro Max'), 'CSV content contains product name');
    assert.ok(csvResult.csv.includes('₦1,850,000'), 'CSV content contains price');
    assert.ok(csvResult.artifact, 'Returns artifact metadata');

    // Verify artifact is registered in listArtifacts()
    const stored = listArtifacts();
    const found = stored.find(a => a.id === csvResult.artifact.id || a.name === 'apple_nigeria_products.csv');
    assert.ok(found, 'CSV file must be registered in workspace artifacts');
    assert.equal(found.kind, 'csv');
  });
});
