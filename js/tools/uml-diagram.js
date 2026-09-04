/* UML Diagram — write the diagram as text, get a drawing.

   Uses Mermaid, which covers the UML diagrams people actually draw:
   class, sequence, state, entity-relationship and use-case-ish flow.
   Mermaid is ~1 MB, so it is imported only when this tool opens.

   Rendering happens on the device; nothing is uploaded, which matters
   because architecture diagrams tend to describe systems people would
   rather not paste into a stranger's website. */

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';

const TEMPLATES = {
  class: {
    name: 'Class diagram',
    code: `classDiagram
    class Invoice {
        +String number
        +Date issued
        -Decimal subtotal
        +addLine(LineItem item) void
        +total() Decimal
    }

    class LineItem {
        +String description
        +int quantity
        +Decimal unitPrice
        +amount() Decimal
    }

    class Client {
        +String name
        +String email
    }

    class Payment {
        +Decimal amount
        +Date received
    }

    Invoice "1" *-- "many" LineItem : contains
    Invoice "many" --> "1" Client : billed to
    Invoice "1" o-- "many" Payment : settled by`,
  },
  sequence: {
    name: 'Sequence diagram',
    code: `sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant API
    participant DB

    User->>Browser: Submits invoice
    Browser->>API: POST /invoices
    activate API
    API->>DB: INSERT invoice
    DB-->>API: id 4711
    API-->>Browser: 201 Created
    deactivate API
    Browser-->>User: Shows confirmation

    alt Payment overdue
        API->>User: Sends reminder
    else Paid on time
        API->>API: Closes the invoice
    end`,
  },
  state: {
    name: 'State diagram',
    code: `stateDiagram-v2
    [*] --> Draft
    Draft --> Sent : send()
    Sent --> PartiallyPaid : payment received
    Sent --> Paid : paid in full
    PartiallyPaid --> Paid : balance cleared
    Sent --> Overdue : due date passed
    Overdue --> Paid : paid late
    Overdue --> WrittenOff : after 90 days
    Paid --> [*]
    WrittenOff --> [*]

    note right of Overdue
        Reminders go out
        every 7 days
    end note`,
  },
  er: {
    name: 'Entity relationship',
    code: `erDiagram
    CLIENT ||--o{ INVOICE : "is billed"
    INVOICE ||--|{ LINE_ITEM : contains
    INVOICE ||--o{ PAYMENT : "settled by"
    PRODUCT ||--o{ LINE_ITEM : "appears in"

    CLIENT {
        int id PK
        string name
        string email
    }
    INVOICE {
        int id PK
        int client_id FK
        date issued
        decimal total
    }
    LINE_ITEM {
        int id PK
        int invoice_id FK
        int quantity
        decimal unit_price
    }`,
  },
  flow: {
    name: 'Flowchart',
    code: `flowchart TD
    A([Invoice raised]) --> B{Payment received?}
    B -- Yes --> C[Mark as paid]
    B -- No --> D{Past due date?}
    D -- No --> E[Wait]
    E --> B
    D -- Yes --> F[Send reminder]
    F --> G{Over 90 days?}
    G -- No --> B
    G -- Yes --> H[/Write off/]
    C --> I([Closed])
    H --> I`,
  },
  journey: {
    name: 'User journey',
    code: `journey
    title Getting paid
    section Raising
      Draft the invoice: 3: Finance
      Check the figures: 4: Finance
      Send to client: 5: Finance
    section Waiting
      Client reviews: 3: Client
      Client approves: 4: Client
      Chase by email: 2: Finance
    section Settled
      Payment lands: 5: Finance, Client
      Reconcile: 4: Finance`,
  },
};

export default {
  async render(container, { analytics } = {}) {
    this._alive = true;

    container.innerHTML = `<div class="t3d-loading"><div class="t3d-spinner"></div><p>Loading the diagram engine…</p></div>`;

    let mermaid;
    try {
      mermaid = (await import(/* @vite-ignore */ MERMAID_URL)).default;
    } catch (err) {
      container.innerHTML = `<div class="no-results">
        <p class="no-results-title">Could not load the diagram engine</p>
        <p class="no-results-text">${err.message}. It is fetched from a CDN, so this needs a connection the first time.</p>
      </div>`;
      return;
    }
    if (!this._alive) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      fontFamily: "'Inter', system-ui, sans-serif",
      themeVariables: { fontSize: '14px' },
    });

    container.innerHTML = `
      <div class="uml">
        <div class="uml-bar">
          <select class="tool-select" id="uml-template" aria-label="Diagram type">
            ${Object.entries(TEMPLATES).map(([id, t]) =>
              `<option value="${id}">${t.name}</option>`).join('')}
          </select>
          <div class="uml-bar-right">
            <button class="btn btn-sm" id="uml-svg">Download SVG</button>
            <button class="btn btn-sm" id="uml-png">Download PNG</button>
            <button class="btn btn-sm" id="uml-copy">Copy code</button>
          </div>
        </div>

        <div class="uml-split">
          <div class="uml-editor-wrap">
            <textarea class="cpg-editor uml-editor" id="uml-code" spellcheck="false"
                      autocomplete="off" autocapitalize="off" autocorrect="off" wrap="off"
                      aria-label="Diagram source"></textarea>
          </div>
          <div class="uml-preview-wrap">
            <div class="uml-preview" id="uml-preview"></div>
            <p class="uml-error" id="uml-error" hidden></p>
          </div>
        </div>

        <p class="biz-hint">
          Written in Mermaid syntax and drawn on your device — nothing is uploaded.
          Pick a diagram type above to load a worked example you can edit.
        </p>
      </div>`;

    const codeEl = container.querySelector('#uml-code');
    const previewEl = container.querySelector('#uml-preview');
    const errorEl = container.querySelector('#uml-error');
    let seq = 0;
    let lastGoodSvg = '';

    async function draw() {
      const source = codeEl.value.trim();
      if (!source) { previewEl.innerHTML = ''; errorEl.hidden = true; return; }

      const id = `uml-${++seq}`;
      try {
        // parse() first: it validates without leaving a half-drawn node behind.
        await mermaid.parse(source);
        const { svg } = await mermaid.render(id, source);
        if (!this._alive) return;
        previewEl.innerHTML = svg;
        lastGoodSvg = svg;
        errorEl.hidden = true;
        analytics?.completed({ outputKind: 'image' });
      } catch (err) {
        // Keep the last good drawing on screen. Blanking the canvas on every
        // keystroke makes the tool feel broken while you are mid-edit.
        errorEl.hidden = false;
        errorEl.textContent = (err?.message || String(err)).split('\n').slice(0, 3).join(' ');
        analytics?.error('parse_failed');
      }
    }
    const drawBound = draw.bind(this);

    let debounce;
    codeEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(drawBound, 400);
    });

    container.querySelector('#uml-template').addEventListener('change', (e) => {
      codeEl.value = TEMPLATES[e.target.value].code;
      drawBound();
    });

    /* ---------------- export ---------------- */

    const download = (blob, name) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    container.querySelector('#uml-svg').addEventListener('click', () => {
      if (!lastGoodSvg) return;
      download(new Blob([lastGoodSvg], { type: 'image/svg+xml' }), 'diagram.svg');
      analytics?.downloaded({ outputKind: 'image' });
    });

    container.querySelector('#uml-png').addEventListener('click', async () => {
      const svgEl = previewEl.querySelector('svg');
      if (!svgEl) return;
      // Rasterise at 2x so the PNG is usable in a document, not just on screen.
      const box = svgEl.getBoundingClientRect();
      const scale = 2;
      const svgText = new XMLSerializer().serializeToString(svgEl);
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(box.width * scale));
        canvas.height = Math.max(1, Math.round(box.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          if (b) { download(b, 'diagram.png'); analytics?.downloaded({ outputKind: 'image' }); }
        }, 'image/png');
      } catch {
        errorEl.hidden = false;
        errorEl.textContent = 'This diagram could not be converted to PNG. The SVG download will work.';
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    container.querySelector('#uml-copy').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(codeEl.value);
        const b = e.target;
        const prev = b.textContent;
        b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = prev; }, 1200);
        analytics?.copied({ outputKind: 'text' });
      } catch { /* clipboard blocked — the text is already selectable */ }
    });

    codeEl.value = TEMPLATES.class.code;

    this._read = () => codeEl.value;
    this._write = (text) => { codeEl.value = text; drawBound(); };

    await drawBound();
  },

  getArtifact() { return { kind: 'uml', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._alive = false; this._read = this._write = null; },
};
