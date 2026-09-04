/**
 * TOOLBOX — Mathematical Notation Rendering Engine
 *
 * Converts LaTeX-style mathematical expressions into native, accessible,
 * standards-compliant MathML and styled semantic HTML.
 *
 * Zero external npm dependencies.
 * Natively supported in all modern browsers (Chromium, Safari, Firefox).
 * Integrates directly with Toolbox theme tokens and typography.
 */

// Greek alphabet symbol table
const GREEK_SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
};

// Mathematical operators & special symbols
const MATH_SYMBOLS = {
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·',
  ast: '∗', star: '⋆', circ: '∘', bullet: '•',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
  approx: '≈', sim: '∼', simeq: '≃', equiv: '≡', cong: '≅',
  propto: '∝', infty: '∞', partial: '∂', nabla: '∇',
  hbar: 'ℏ', ell: 'ℓ', wp: '℘', Re: 'Re', Im: 'Im',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃',
  subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩',
  setminus: '∖', emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃', nexists: '∄',
  to: '→', rightarrow: '→', leftarrow: '←', mapsto: '↦',
  implies: '⟹', Longrightarrow: '⟹', Rightarrow: '⇒',
  iff: '⟺', Longleftrightarrow: '⟺', Leftrightarrow: '⇔',
  sum: '∑', prod: '∏', coprod: '∐',
  int: '∫', iint: '∬', iiint: '∭', oint: '∮',
  dots: '…', cdots: '⋯', ldots: '…', vdots: '⋮', ddots: '⋱',
  quad: ' ', qquad: '  '
};

// Named upright mathematical functions
const MATH_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
  'arcsin', 'arccos', 'arctan',
  'ln', 'log', 'exp', 'det', 'gcd', 'lcm',
  'deg', 'dim', 'ker', 'hom', 'arg', 'Arg',
  'max', 'min', 'lim', 'inf', 'sup', 'Res', 'Cov', 'THD'
]);

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extract matched braced content: e.g. `{a + b}` -> returns { content: 'a + b', nextIndex }
 */
function extractBraced(input, startIndex) {
  let depth = 0;
  let start = -1;
  for (let i = startIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: input.slice(start, i),
          nextIndex: i + 1
        };
      }
    }
  }
  return { content: input.slice(startIndex), nextIndex: input.length };
}

/**
 * Extract matched bracketed content: e.g. `[n]` -> returns { content: 'n', nextIndex }
 */
function extractBracketed(input, startIndex) {
  if (input[startIndex] !== '[') return null;
  let depth = 0;
  let start = startIndex + 1;
  for (let i = startIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return {
          content: input.slice(start, i),
          nextIndex: i + 1
        };
      }
    }
  }
  return null;
}

/**
 * Parse an expression string into MathML markup
 */
export function latexToMathML(latex) {
  if (!latex || typeof latex !== 'string') return '<mrow></mrow>';
  let str = latex.trim();

  // Strip enclosing math delimiters if provided: $...$ or \(...\)
  if (str.startsWith('$$') && str.endsWith('$$')) str = str.slice(2, -2).trim();
  else if (str.startsWith('$') && str.endsWith('$')) str = str.slice(1, -1).trim();
  else if (str.startsWith('\\(') && str.endsWith('\\)')) str = str.slice(2, -2).trim();
  else if (str.startsWith('\\[') && str.endsWith('\\]')) str = str.slice(2, -2).trim();

  const out = [];
  let i = 0;
  const len = str.length;

  while (i < len) {
    const ch = str[i];

    // 1. Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // 2. Commands starting with '\'
    if (ch === '\\') {
      i++;
      // Check for escaped characters like \{ \} \% \| \$ \& \, \;
      if (i < len && /[{}%|$&,;!]/.test(str[i])) {
        const spec = str[i];
        i++;
        if (spec === '{' || spec === '}') out.push(`<mo>${escapeXml(spec)}</mo>`);
        else if (spec === '|') out.push(`<mo>‖</mo>`);
        else if (spec === '%') out.push(`<mo>%</mo>`);
        else if (spec === '$') out.push(`<mo>$</mo>`);
        else if (spec === '&') out.push(`<mo>&amp;</mo>`);
        else if (spec === ',' || spec === ';') out.push(`<mspace width="0.22em"/>`);
        else if (spec === '!') out.push(`<mspace width="-0.15em"/>`);
        continue;
      }

      // Read command name
      let cmd = '';
      while (i < len && /[a-zA-Z]/.test(str[i])) {
        cmd += str[i];
        i++;
      }

      // Handle specific commands
      if (cmd === 'frac') {
        while (i < len && /\s/.test(str[i])) i++;
        let num = '', den = '';
        if (str[i] === '{') {
          const numRes = extractBraced(str, i);
          num = numRes.content;
          i = numRes.nextIndex;
        } else {
          num = str[i] || '';
          i++;
        }
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const denRes = extractBraced(str, i);
          den = denRes.content;
          i = denRes.nextIndex;
        } else {
          den = str[i] || '';
          i++;
        }
        out.push(`<mfrac><mrow>${latexToMathML(num)}</mrow><mrow>${latexToMathML(den)}</mrow></mfrac>`);
      } else if (cmd === 'sqrt') {
        while (i < len && /\s/.test(str[i])) i++;
        const rootIndex = extractBracketed(str, i);
        if (rootIndex) {
          i = rootIndex.nextIndex;
          while (i < len && /\s/.test(str[i])) i++;
          let rad = '';
          if (str[i] === '{') {
            const radRes = extractBraced(str, i);
            rad = radRes.content;
            i = radRes.nextIndex;
          } else {
            rad = str[i] || '';
            i++;
          }
          out.push(`<mroot><mrow>${latexToMathML(rad)}</mrow><mrow>${latexToMathML(rootIndex.content)}</mrow></mroot>`);
        } else {
          let rad = '';
          if (str[i] === '{') {
            const radRes = extractBraced(str, i);
            rad = radRes.content;
            i = radRes.nextIndex;
          } else {
            rad = str[i] || '';
            i++;
          }
          out.push(`<msqrt><mrow>${latexToMathML(rad)}</mrow></msqrt>`);
        }
      } else if (cmd === 'text' || cmd === 'mathrm' || cmd === 'operatorname') {
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const tRes = extractBraced(str, i);
          out.push(`<mtext>${escapeXml(tRes.content)}</mtext>`);
          i = tRes.nextIndex;
        }
      } else if (cmd === 'mathbf') {
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const bRes = extractBraced(str, i);
          out.push(`<mi mathvariant="bold">${escapeXml(bRes.content)}</mi>`);
          i = bRes.nextIndex;
        }
      } else if (cmd === 'mathit') {
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const itRes = extractBraced(str, i);
          out.push(`<mi mathvariant="italic">${escapeXml(itRes.content)}</mi>`);
          i = itRes.nextIndex;
        }
      } else if (cmd === 'mathcal') {
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const cRes = extractBraced(str, i);
          out.push(`<mi mathvariant="script">${escapeXml(cRes.content)}</mi>`);
          i = cRes.nextIndex;
        }
      } else if (cmd === 'mathbb') {
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const bbRes = extractBraced(str, i);
          out.push(`<mi mathvariant="double-struck">${escapeXml(bbRes.content)}</mi>`);
          i = bbRes.nextIndex;
        }
      } else if (cmd === 'pmod') {
        while (i < len && /\s/.test(str[i])) i++;
        let modVal = '';
        if (str[i] === '{') {
          const mRes = extractBraced(str, i);
          modVal = mRes.content;
          i = mRes.nextIndex;
        } else {
          while (i < len && /[0-9a-zA-Z]/.test(str[i])) {
            modVal += str[i];
            i++;
          }
        }
        out.push(`<mspace width="0.5em"/><mo>(</mo><mtext>mod</mtext><mspace width="0.33em"/><mrow>${latexToMathML(modVal)}</mrow><mo>)</mo>`);
      } else if (cmd === 'hat' || cmd === 'bar' || cmd === 'vec') {
        while (i < len && /\s/.test(str[i])) i++;
        let arg = '';
        if (str[i] === '{') {
          const aRes = extractBraced(str, i);
          arg = aRes.content;
          i = aRes.nextIndex;
        } else {
          arg = str[i] || '';
          i++;
        }
        const accentSym = cmd === 'hat' ? '^' : (cmd === 'bar' ? '¯' : '→');
        out.push(`<mover><mrow>${latexToMathML(arg)}</mrow><mo>${accentSym}</mo></mover>`);
      } else if (cmd === 'begin') {
        // Environment handling (matrix, pmatrix, vmatrix, cases)
        while (i < len && /\s/.test(str[i])) i++;
        const envRes = extractBraced(str, i);
        const envName = envRes.content;
        i = envRes.nextIndex;

        const endPattern = `\\end{${envName}}`;
        const endIdx = str.indexOf(endPattern, i);
        const envBody = endIdx !== -1 ? str.slice(i, endIdx) : str.slice(i);
        i = endIdx !== -1 ? endIdx + endPattern.length : len;

        const rows = envBody.split(/\\\\/).map(r => r.trim()).filter(Boolean);
        const tableRows = rows.map(r => {
          const cells = r.split('&').map(c => `<mtd><mrow>${latexToMathML(c.trim())}</mrow></mtd>`).join('');
          return `<mtr>${cells}</mtr>`;
        }).join('');

        let leftFence = '', rightFence = '';
        if (envName === 'pmatrix') { leftFence = '('; rightFence = ')'; }
        else if (envName === 'bmatrix') { leftFence = '['; rightFence = ']'; }
        else if (envName === 'vmatrix') { leftFence = '|'; rightFence = '|'; }
        else if (envName === 'Vmatrix') { leftFence = '‖'; rightFence = '‖'; }
        else if (envName === 'cases') { leftFence = '{'; rightFence = ''; }

        let matXml = `<mtable rowspacing="4px" columnspacing="1em">${tableRows}</mtable>`;
        if (leftFence || rightFence) {
          matXml = `${leftFence ? `<mo fence="true">${leftFence}</mo>` : ''}${matXml}${rightFence ? `<mo fence="true">${rightFence}</mo>` : ''}`;
        }
        out.push(matXml);
      } else if (cmd === 'left' || cmd === 'right') {
        while (i < len && /\s/.test(str[i])) i++;
        let fence = str[i];
        i++;
        if (fence === '\\') {
          if (str[i] === '{' || str[i] === '}' || str[i] === '|') {
            fence = str[i];
            i++;
          }
        }
        if (fence !== '.') {
          out.push(`<mo fence="true">${escapeXml(fence)}</mo>`);
        }
      } else if (GREEK_SYMBOLS[cmd]) {
        out.push(`<mi>${GREEK_SYMBOLS[cmd]}</mi>`);
      } else if (MATH_SYMBOLS[cmd]) {
        out.push(`<mo>${MATH_SYMBOLS[cmd]}</mo>`);
      } else if (MATH_FUNCTIONS.has(cmd)) {
        out.push(`<mi mathvariant="normal">${cmd}</mi>`);
      } else if (cmd === 'quad') {
        out.push(`<mspace width="1em"/>`);
      } else if (cmd === 'qquad') {
        out.push(`<mspace width="2em"/>`);
      } else if (cmd === 'zeta') {
        out.push(`<mi>ζ</mi>`);
      } else if (cmd === 'xrightarrow') {
        // e.g. \xrightarrow{d}
        while (i < len && /\s/.test(str[i])) i++;
        if (str[i] === '{') {
          const arrRes = extractBraced(str, i);
          out.push(`<mover><mo>→</mo><mrow>${latexToMathML(arrRes.content)}</mrow></mover>`);
          i = arrRes.nextIndex;
        } else {
          out.push(`<mo>→</mo>`);
        }
      } else {
        // Unknown or custom command fallback
        out.push(`<mi>${escapeXml(cmd)}</mi>`);
      }
      continue;
    }

    // 3. Subscripts '_' and Superscripts '^'
    if (ch === '_' || ch === '^') {
      const isSub = ch === '_';
      i++;
      while (i < len && /\s/.test(str[i])) i++;

      let scriptContent = '';
      if (str[i] === '{') {
        const sRes = extractBraced(str, i);
        scriptContent = sRes.content;
        i = sRes.nextIndex;
      } else {
        scriptContent = str[i] || '';
        i++;
      }

      // Check if preceded by an element or base
      const prev = out.pop() || '<mrow></mrow>';

      // Check if subsequent token is the complementary script (e.g. x_0^2 or x^2_0)
      while (i < len && /\s/.test(str[i])) i++;
      if (i < len && (isSub ? str[i] === '^' : str[i] === '_')) {
        i++;
        while (i < len && /\s/.test(str[i])) i++;
        let secondContent = '';
        if (str[i] === '{') {
          const secRes = extractBraced(str, i);
          secondContent = secRes.content;
          i = secRes.nextIndex;
        } else {
          secondContent = str[i] || '';
          i++;
        }

        const sub = isSub ? scriptContent : secondContent;
        const sup = isSub ? secondContent : scriptContent;

        // Big operators (sum, prod, int, lim) use munderover
        if (prev.includes('∑') || prev.includes('∏') || prev.includes('lim')) {
          out.push(`<munderover>${prev}<mrow>${latexToMathML(sub)}</mrow><mrow>${latexToMathML(sup)}</mrow></munderover>`);
        } else {
          out.push(`<msubsup>${prev}<mrow>${latexToMathML(sub)}</mrow><mrow>${latexToMathML(sup)}</mrow></msubsup>`);
        }
      } else {
        // Single subscript or superscript
        if ((prev.includes('∑') || prev.includes('∏') || prev.includes('lim')) && isSub) {
          out.push(`<munder>${prev}<mrow>${latexToMathML(scriptContent)}</mrow></munder>`);
        } else {
          const tagName = isSub ? 'msub' : 'msup';
          out.push(`<${tagName}>${prev}<mrow>${latexToMathML(scriptContent)}</mrow></${tagName}>`);
        }
      }
      continue;
    }

    // 4. Braced sub-expressions `{ ... }`
    if (ch === '{') {
      const bRes = extractBraced(str, i);
      out.push(`<mrow>${latexToMathML(bRes.content)}</mrow>`);
      i = bRes.nextIndex;
      continue;
    }

    // 5. Prime symbols (e.g. f'(x), f''(x))
    if (ch === "'" || ch === '′') {
      let count = 0;
      while (i < len && (str[i] === "'" || str[i] === '′')) {
        count++;
        i++;
      }
      const primes = '′'.repeat(count);
      const prev = out.pop() || '<mrow></mrow>';
      out.push(`<msup>${prev}<mo>${primes}</mo></msup>`);
      continue;
    }

    // 6. Numbers
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[0-9.]/.test(str[i])) {
        num += str[i];
        i++;
      }
      out.push(`<mn>${num}</mn>`);
      continue;
    }

    // 7. Operators, delimiters and relations
    if (/[=+\-*/><()[\],;!|:±×÷≤≥≠≈≡~]/.test(ch)) {
      let op = ch;
      if (ch === '<' && str[i + 1] === '=') { op = '≤'; i++; }
      else if (ch === '>' && str[i + 1] === '=') { op = '≥'; i++; }
      else if (ch === '!' && str[i + 1] === '=') { op = '≠'; i++; }
      out.push(`<mo>${escapeXml(op)}</mo>`);
      i++;
      continue;
    }

    // 8. Identifiers (single letters, Roman variables)
    if (/[a-zA-Z]/.test(ch)) {
      out.push(`<mi>${ch}</mi>`);
      i++;
      continue;
    }

    // 9. Other unicode characters
    out.push(`<mo>${escapeXml(ch)}</mo>`);
    i++;
  }

  return out.join('');
}

/**
 * Convert LaTeX formula into clean human-readable text for accessibility aria-label
 */
export function latexToAriaLabel(latex) {
  if (!latex) return '';
  return renderMathInText(latex)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1th root of $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\\begin\{[a-zA-Z]+\}/g, '')
    .replace(/\\end\{[a-zA-Z]+\}/g, '')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ', ')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Render a LaTeX formula into an HTML container with MathML and accessible fallback
 * @param {string} latex - The formula string (LaTeX or mathematical expression)
 * @param {Object} [options]
 * @param {boolean} [options.displayMode=true] - Block (display) vs inline
 * @param {string} [options.className=''] - Optional CSS class
 * @returns {string} Safe HTML string containing the rendered mathematical notation
 */
export function renderMath(latex, { displayMode = true, className = '' } = {}) {
  if (!latex || typeof latex !== 'string') return '';
  const trimmed = latex.trim();
  if (!trimmed) return '';

  const mathmlBody = latexToMathML(trimmed);
  const ariaText = latexToAriaLabel(trimmed);
  const displayAttr = displayMode ? 'block' : 'inline';
  const wrapClass = `math-rendered-formula ${displayMode ? 'math-display' : 'math-inline'} ${className}`.trim();

  return `
    <div class="${wrapClass}" role="math" aria-label="${escapeXml(ariaText)}">
      <math xmlns="http://www.w3.org/1998/Math/MathML" display="${displayAttr}">
        <mrow>${mathmlBody}</mrow>
      </math>
    </div>
  `.trim();
}

/**
 * Render mathematical prose: detects and parses any embedded LaTeX tokens or equations
 * ensuring no raw LaTeX syntax like \frac, \equiv, \pmod, \sqrt ever leaks to the user.
 * @param {string} text - Prose text that may contain LaTeX fragments
 * @returns {string} Clean HTML string with all mathematical expressions properly rendered
 */
export function renderMathInText(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Replace explicit block formulas $$...$$ or \[...\]
  let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => renderMath(eq, { displayMode: true }));
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => renderMath(eq, { displayMode: true }));

  // 2. Replace inline formulas $...$ or \(...\)
  result = result.replace(/\$([^\$\n]+?)\$/g, (_, eq) => renderMath(eq, { displayMode: false }));
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => renderMath(eq, { displayMode: false }));

  // 3. Clean up any remaining stray LaTeX tokens in plain prose
  // e.g. \equiv -> ≡, \pmod{n} -> (mod n), \le -> ≤, \ge -> ≥, \pm -> ±, \times -> ×, \to -> →
  result = result
    .replace(/\\equiv/g, '≡')
    .replace(/\\pmod\{([^}]+)\}/g, '(mod $1)')
    .replace(/\\pmod\s+([a-zA-Z0-9]+)/g, '(mod $1)')
    .replace(/\\le(q)?\b/g, '≤')
    .replace(/\\ge(q)?\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\to\b/g, '→')
    .replace(/\\implies\b/g, '⟹')
    .replace(/\\iff\b/g, '⟺')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\partial\b/g, '∂')
    .replace(/\\nabla\b/g, '∇')
    .replace(/\\in\b/g, '∈')
    .replace(/\\subset\b/g, '⊂')
    .replace(/\\sum\b/g, '∑')
    .replace(/\\prod\b/g, '∏')
    .replace(/\\int\b/g, '∫')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\phi\b/g, 'φ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\quad\b/g, '  ')
    .replace(/\\qquad\b/g, '    ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\{/g, '{')
    .replace(/\\right\}/g, '}');

  // Convert remaining \frac{A}{B} in prose to A / B if any slipped through
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');

  return result;
}
