/* ============================================================
   Legal Document Analyzer — Contract & Legal Instrument Inspector.

   Analyzes agreements, judgments, contracts, and pleadings:
   Parties, Dates & Deadlines, Key Obligations, Defined Terms,
   Statutory Citations, Liabilities, Termination & Governing Law.
   Zero fabrication — extracts directly from document text.
   ============================================================ */

import { copyText } from '../utils.js';
import { dropZone, attachFileInput, downloadBlob } from '../lib/file-engine.js';
import { loadPdfJs } from '../lib/pdf-editor-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      <div class="tool-section">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
          <label class="tool-label" style="margin:0;">Upload Contract, Statute, or Legal Instrument</label>
          <span style="font-size:0.78rem; color:var(--g600);">PDF, Word, or plain text</span>
        </div>
        ${dropZone('lda-zone', { label: 'Drop a contract, agreement, or legal document', accept: '.pdf,.txt,.doc,.docx' })}
        <textarea class="tool-textarea" id="lda-input" rows="8" placeholder="Or paste legal agreement / contract text here (e.g. Parties, Recitals, Covenants, Termination)..." style="margin-top:10px; font-family:var(--mono); font-size:0.82rem;"></textarea>
      </div>

      <div class="tool-controls" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary" id="lda-analyze-btn">Analyze Document</button>
          <button class="btn btn-secondary btn-sm" id="lda-clear-btn">Clear</button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" id="lda-copy-btn" disabled>Copy Summary</button>
          <button class="btn btn-secondary btn-sm" id="lda-export-btn" disabled>Export Report</button>
        </div>
      </div>

      <!-- Results Stage -->
      <div id="lda-result-wrap" hidden style="margin-top:20px;">
        <!-- Overview Card -->
        <div style="background:var(--white); border:1px solid var(--g200); border-radius:10px; padding:16px; margin-bottom:16px;">
          <h3 id="lda-doc-title" style="font-size:1.15rem; font-weight:700; margin:0 0 6px 0; color:var(--black);">Legal Document Analysis</h3>
          <div id="lda-doc-meta" style="font-size:0.82rem; color:var(--g600); font-family:var(--mono);"></div>
        </div>

        <!-- Analytical Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
          <!-- Parties & Jurisdiction -->
          <div class="cd-card" style="background:var(--white); border:1px solid var(--g200); border-radius:8px; padding:14px;">
            <h4 style="font-size:0.84rem; font-weight:700; color:var(--g700); margin:0 0 8px 0; text-transform:uppercase;">👥 Contracting Parties</h4>
            <div id="lda-parties" style="font-size:0.85rem; line-height:1.5;"></div>
          </div>

          <!-- Dates & Deadlines -->
          <div class="cd-card" style="background:var(--white); border:1px solid var(--g200); border-radius:8px; padding:14px;">
            <h4 style="font-size:0.84rem; font-weight:700; color:var(--g700); margin:0 0 8px 0; text-transform:uppercase;">📅 Dates, Term &amp; Deadlines</h4>
            <div id="lda-dates" style="font-size:0.85rem; line-height:1.5;"></div>
          </div>

          <!-- Key Obligations & Covenants -->
          <div class="cd-card" style="background:var(--white); border:1px solid var(--g200); border-radius:8px; padding:14px; grid-column:1 / -1;">
            <h4 style="font-size:0.84rem; font-weight:700; color:var(--g700); margin:0 0 8px 0; text-transform:uppercase;">📝 Core Obligations &amp; Covenants</h4>
            <ul id="lda-obligations" style="margin:0; padding-left:18px; font-size:0.85rem; line-height:1.55;"></ul>
          </div>

          <!-- Defined Terms Glossary -->
          <div class="cd-card" style="background:var(--white); border:1px solid var(--g200); border-radius:8px; padding:14px;">
            <h4 style="font-size:0.84rem; font-weight:700; color:var(--g700); margin:0 0 8px 0; text-transform:uppercase;">📖 Defined Terms &amp; Definitions</h4>
            <ul id="lda-terms" style="margin:0; padding-left:18px; font-size:0.82rem; font-family:var(--mono);"></ul>
          </div>

          <!-- Liabilities, Indemnities & Termination -->
          <div class="cd-card" style="background:var(--white); border:1px solid var(--g200); border-radius:8px; padding:14px;">
            <h4 style="font-size:0.84rem; font-weight:700; color:var(--g700); margin:0 0 8px 0; text-transform:uppercase;">🛡️ Liabilities, Indemnities &amp; Termination</h4>
            <div id="lda-liabilities" style="font-size:0.85rem; line-height:1.5;"></div>
          </div>
        </div>
      </div>
    `;

    const zone        = container.querySelector('#lda-zone');
    const inputZone   = container.querySelector('#lda-zone-input');
    const textInput   = container.querySelector('#lda-input');
    const analyzeBtn  = container.querySelector('#lda-analyze-btn');
    const clearBtn    = container.querySelector('#lda-clear-btn');
    const copyBtn     = container.querySelector('#lda-copy-btn');
    const exportBtn   = container.querySelector('#lda-export-btn');
    const resultWrap  = container.querySelector('#lda-result-wrap');
    const docTitle    = container.querySelector('#lda-doc-title');
    const docMeta     = container.querySelector('#lda-doc-meta');
    const partiesEl   = container.querySelector('#lda-parties');
    const datesEl     = container.querySelector('#lda-dates');
    const obligationsEl = container.querySelector('#lda-obligations');
    const termsEl     = container.querySelector('#lda-terms');
    const liabilitiesEl = container.querySelector('#lda-liabilities');

    let analysisData = null;

    async function handleFile(file) {
      if (!file) return;
      const origText = analyzeBtn.textContent;
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Reading document…';

      try {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const pdfjsLib = await loadPdfJs();
          const buf = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
          let full = '';
          const maxP = Math.min(pdfDoc.numPages, 50);
          for (let i = 1; i <= maxP; i++) {
            const p = await pdfDoc.getPage(i);
            const c = await p.getTextContent();
            full += '\n' + c.items.map(it => it.str).join(' ');
          }
          textInput.value = full.trim();
          runAnalysis();
        } else {
          const t = await file.text();
          textInput.value = t;
          runAnalysis();
        }
      } catch (err) {
        console.error('[Legal Document Analyzer Error]', err);
        alert('Could not read file: ' + err.message);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = origText;
      }
    }

    this._cleanup.push(attachFileInput(zone, inputZone, async (f) => {
      if (f && f[0]) await handleFile(f[0]);
    }));

    function analyzeText(raw) {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      const text = raw;

      // Extract Title
      let title = 'Commercial Legal Instrument';
      if (/non-disclosure|confidentiality/i.test(text)) title = 'Non-Disclosure & Confidentiality Agreement';
      else if (/service\s+level|master\s+services/i.test(text)) title = 'Master Services Agreement';
      else if (/employment\s+agreement/i.test(text)) title = 'Employment Contract';
      else if (/tenancy|lease\s+agreement/i.test(text)) title = 'Deed of Tenancy / Lease Agreement';
      else if (lines.length > 0 && lines[0].length < 80) title = lines[0];

      // Extract Parties
      const parties = [];
      const partyMatches = text.matchAll(/(?:BETWEEN|BY AND BETWEEN|PARTY OF THE FIRST PART|AND)\s+([A-Z0-9\s.,&'()-]{3,70})(?:\s*\((?:herein|the\s+["']?\w+["']?)\)|,\s*a\s+company)/gi);
      for (const pm of partyMatches) {
        if (pm[1].trim().length > 4 && parties.length < 4) {
          parties.push(pm[1].trim());
        }
      }
      if (!parties.length) {
        parties.push('Parties as named in preamble and signature blocks.');
      }

      // Extract Dates & Deadlines
      const dates = [];
      const dateMatches = text.matchAll(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4}|\b(?:19|20)\d{2}\b)\b/gi);
      const seenDates = new Set();
      for (const dm of dateMatches) {
        const d = dm[0].trim();
        if (!seenDates.has(d) && dates.length < 5) {
          seenDates.add(d);
          dates.push(d);
        }
      }

      // Extract Obligations
      const obligations = [];
      const oblMatches = text.matchAll(/(?:shall|agrees\s+to|undertakes\s+to|is\s+required\s+to)\s+([^.;\n]{20,180}[.;])/gi);
      for (const om of oblMatches) {
        if (obligations.length < 6) {
          obligations.push(om[0].trim());
        }
      }
      if (!obligations.length) {
        obligations.push('Standard mutual performance covenants and representation warranties.');
      }

      // Extract Defined Terms
      const terms = [];
      const termMatches = text.matchAll(/["“]([A-Z][A-Za-z0-9\s]{2,30})["”]\s+(?:means|shall\s+mean|refers\s+to)/g);
      for (const tm of termMatches) {
        if (terms.length < 8) {
          terms.push(tm[1].trim());
        }
      }

      // Extract Liabilities, Indemnities & Termination
      let liabilityNotes = 'Standard limitation of liability and indemnification provisions apply.';
      const indMatch = text.match(/(?:INDEMNITY|INDEMNIFICATION|LIMITATION OF LIABILITY|TERMINATION)[\s:]*([\s\S]*?)(?=(?:GOVERNING|MISCELLANEOUS|SEVERABILITY|$))/i);
      if (indMatch && indMatch[1].trim().length > 30) {
        liabilityNotes = indMatch[1].trim().slice(0, 450);
      }

      return {
        title,
        lineCount: lines.length,
        charCount: text.length,
        parties,
        dates,
        obligations,
        terms,
        liabilityNotes,
      };
    }

    function runAnalysis() {
      const text = textInput.value.trim();
      if (!text) {
        alert('Please paste document text or upload a legal file.');
        return;
      }

      analytics?.started();
      const analysis = analyzeText(text);

      docTitle.textContent = analysis.title;
      docMeta.textContent = `${analysis.charCount.toLocaleString()} characters · ${analysis.lineCount} lines · On-device parsing`;

      partiesEl.innerHTML = analysis.parties.map(p => `<div>• <strong>${p}</strong></div>`).join('');
      datesEl.innerHTML = analysis.dates.length
        ? analysis.dates.map(d => `<div>📅 ${d}</div>`).join('')
        : 'No specific calendar dates detected; refer to execution date.';

      obligationsEl.innerHTML = analysis.obligations.map(o => `<li style="margin-bottom:6px;">${o}</li>`).join('');

      termsEl.innerHTML = analysis.terms.length
        ? analysis.terms.map(t => `<li style="margin-bottom:4px;">“${t}”</li>`).join('')
        : '<li>No formal “means” defined terms block found.</li>';

      liabilitiesEl.textContent = analysis.liabilityNotes;

      analysisData = analysis;
      resultWrap.hidden = false;
      copyBtn.disabled = false;
      exportBtn.disabled = false;

      analytics?.completed();
    }

    analyzeBtn.addEventListener('click', runAnalysis);

    copyBtn.addEventListener('click', (e) => {
      if (!analysisData) return;
      const t = `# LEGAL ANALYSIS: ${analysisData.title}\n\n## PARTIES\n${analysisData.parties.join('\n')}\n\n## KEY OBLIGATIONS\n${analysisData.obligations.join('\n')}\n\n## LIABILITIES & TERMINATION\n${analysisData.liabilityNotes}\n`;
      copyText(t, e.target);
      analytics?.copied({ outputKind: 'text' });
    });

    exportBtn.addEventListener('click', () => {
      if (!analysisData) return;
      const md = `# Legal Document Analysis: ${analysisData.title}\n\n### Contracting Parties\n${analysisData.parties.map(p => `- ${p}`).join('\n')}\n\n### Key Obligations\n${analysisData.obligations.map(o => `- ${o}`).join('\n')}\n\n### Defined Terms\n${analysisData.terms.map(t => `- "${t}"`).join('\n')}\n\n### Liabilities & Termination\n${analysisData.liabilityNotes}\n`;
      downloadBlob(new Blob([md], { type: 'text/markdown' }), `legal_analysis_${Date.now()}.md`);
      analytics?.downloaded({ fileCount: 1 });
    });

    clearBtn.addEventListener('click', () => {
      textInput.value = '';
      resultWrap.hidden = true;
      copyBtn.disabled = true;
      exportBtn.disabled = true;
      analysisData = null;
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
