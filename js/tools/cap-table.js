import { currencySelect, statGrid, dataTable, money, num, pct, parseNum, escapeHtml } from '../lib/biz.js';

/* Models a priced-round cap table. Each round issues new shares at the
   post-money valuation, so existing holders keep their share count and
   lose percentage — which is what dilution actually is. */

let uid = 0;

export default {
  render(container) {
    const state = {
      founders: [
        { id: ++uid, name: 'Founder A', shares: 5000000 },
        { id: ++uid, name: 'Founder B', shares: 3000000 },
      ],
      pool: 10,
      rounds: [
        { id: ++uid, name: 'Seed',     raise: 1500000, pre: 6000000 },
        { id: ++uid, name: 'Series A', raise: 6000000, pre: 24000000 },
      ],
    };

    container.innerHTML = `
      <div class="tool-section">
        <div class="biz-field" style="max-width:340px;">
          <label class="tool-label" for="ct-cur">Currency</label>
          ${currencySelect('ct-cur')}
        </div>
      </div>

      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Founders &amp; existing shares</label>
          <div id="ct-founders" class="ct-rows"></div>
          <button class="btn btn-secondary btn-sm" id="ct-add-founder">Add a founder</button>

          <div class="biz-field" style="margin-top:22px;">
            <label class="tool-label" for="ct-pool">Option pool</label>
            <div class="biz-input-wrap has-suffix">
              <input type="number" class="tool-input" id="ct-pool" value="${state.pool}" min="0" max="50" step="0.5">
              <span class="biz-suffix">%</span>
            </div>
            <p class="biz-hint">Set aside for employees before the first round, so it dilutes the founders.</p>
          </div>
        </div>

        <div class="tool-section">
          <label class="tool-label">Funding rounds</label>
          <div id="ct-rounds" class="ct-rows"></div>
          <button class="btn btn-secondary btn-sm" id="ct-add-round">Add a round</button>
        </div>
      </div>

      <div id="ct-out" style="margin-top:26px;"></div>
      <div id="ct-table"></div>
      <div id="ct-rounds-table"></div>`;

    const foundersEl = container.querySelector('#ct-founders');
    const roundsEl   = container.querySelector('#ct-rounds');

    function renderInputs() {
      foundersEl.innerHTML = state.founders.map(f => `
        <div class="ct-row" data-founder="${f.id}">
          <input type="text" class="tool-input" data-k="name" value="${escapeHtml(f.name)}" placeholder="Name">
          <input type="number" class="tool-input" data-k="shares" value="${f.shares}" min="0" step="1000" placeholder="Shares">
          <button class="ct-del" data-del-founder="${f.id}" aria-label="Remove ${escapeHtml(f.name)}">×</button>
        </div>`).join('');

      roundsEl.innerHTML = state.rounds.map(r => `
        <div class="ct-row ct-row-3" data-round="${r.id}">
          <input type="text" class="tool-input" data-k="name" value="${escapeHtml(r.name)}" placeholder="Round">
          <input type="number" class="tool-input" data-k="raise" value="${r.raise}" min="0" step="10000" placeholder="Raise">
          <input type="number" class="tool-input" data-k="pre" value="${r.pre}" min="0" step="100000" placeholder="Pre-money">
          <button class="ct-del" data-del-round="${r.id}" aria-label="Remove ${escapeHtml(r.name)}">×</button>
        </div>`).join('');
    }

    function compute() {
      const cur = container.querySelector('#ct-cur').value;

      const founderShares = state.founders.reduce((s, f) => s + Math.max(f.shares, 0), 0);
      const poolPct = Math.min(Math.max(state.pool, 0), 90) / 100;

      // The pool is carved out of the pre-round company, so founders end up
      // holding (1 - pool) of it. Solve for the pool share count that gives that.
      const poolShares = poolPct > 0 && poolPct < 1
        ? founderShares * poolPct / (1 - poolPct)
        : 0;

      const holders = [
        ...state.founders.map(f => ({ name: f.name, shares: Math.max(f.shares, 0), kind: 'founder' })),
        ...(poolShares > 0 ? [{ name: 'Option pool', shares: poolShares, kind: 'pool' }] : []),
      ];

      let total = holders.reduce((s, h) => s + h.shares, 0);
      const roundRows = [];

      for (const r of state.rounds) {
        const raise = Math.max(parseNum(String(r.raise)), 0);
        const pre   = Math.max(parseNum(String(r.pre)), 0);
        const post  = pre + raise;
        if (post <= 0 || raise <= 0 || total <= 0) continue;

        const investorPct = raise / post;
        // New shares such that they represent investorPct of the enlarged total.
        const newShares = total * investorPct / (1 - investorPct);
        const pricePerShare = pre / total;

        holders.push({ name: r.name, shares: newShares, kind: 'investor' });
        total += newShares;

        roundRows.push({
          name: r.name, raise, pre, post,
          pricePerShare, newShares, investorPct: investorPct * 100,
        });
      }

      const founderTotal = holders.filter(h => h.kind === 'founder').reduce((s, h) => s + h.shares, 0);
      const lastPost = roundRows.length ? roundRows[roundRows.length - 1].post : 0;

      container.querySelector('#ct-out').innerHTML = statGrid([
        { value: pct(total > 0 ? founderTotal / total * 100 : NaN), label: 'Founders keep', tone: 'hero' },
        { value: pct(total > 0 ? holders.filter(h => h.kind === 'investor').reduce((s, h) => s + h.shares, 0) / total * 100 : NaN),
          label: 'Investors hold' },
        { value: pct(total > 0 ? (holders.find(h => h.kind === 'pool')?.shares ?? 0) / total * 100 : NaN), label: 'Option pool' },
        { value: num(Math.round(total)), label: 'Shares outstanding' },
        { value: money(roundRows.reduce((s, r) => s + r.raise, 0), cur), label: 'Total raised' },
        { value: lastPost ? money(lastPost, cur) : '—', label: 'Latest valuation' },
      ]);

      container.querySelector('#ct-table').innerHTML = dataTable(
        ['Holder',
         { label: 'Shares', align: 'right' },
         { label: 'Ownership', align: 'right' },
         { label: 'Value at latest round', align: 'right' }],
        holders.map(h => ({
          emphasis: h.kind === 'founder',
          cells: [escapeHtml(h.name), num(Math.round(h.shares)),
                  pct(total > 0 ? h.shares / total * 100 : NaN),
                  lastPost ? money(total > 0 ? h.shares / total * lastPost : 0, cur) : '—'],
        })),
        { caption: 'Cap table after all rounds' }
      );

      container.querySelector('#ct-rounds-table').innerHTML = roundRows.length
        ? dataTable(
            ['Round',
             { label: 'Raised', align: 'right' },
             { label: 'Pre-money', align: 'right' },
             { label: 'Post-money', align: 'right' },
             { label: 'Price per share', align: 'right' },
             { label: 'Investor stake', align: 'right' }],
            roundRows.map(r => [escapeHtml(r.name), money(r.raise, cur), money(r.pre, cur),
                                money(r.post, cur), money(r.pricePerShare, cur, { dp: 4 }), pct(r.investorPct)]),
            { caption: 'Round by round' })
        : '';
    }

    function refresh() { renderInputs(); compute(); }

    container.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) {
        const fRow = e.target.closest('[data-founder]');
        const rRow = e.target.closest('[data-round]');
        if (fRow) {
          const f = state.founders.find(x => x.id === Number(fRow.dataset.founder));
          if (f) f[k] = k === 'name' ? e.target.value : parseNum(e.target);
        } else if (rRow) {
          const r = state.rounds.find(x => x.id === Number(rRow.dataset.round));
          if (r) r[k] = k === 'name' ? e.target.value : parseNum(e.target);
        }
        compute();          // no re-render: that would blow away focus mid-typing
        return;
      }
      if (e.target.id === 'ct-pool') { state.pool = parseNum(e.target); compute(); }
      if (e.target.id === 'ct-cur')  compute();
    });

    container.addEventListener('change', (e) => { if (e.target.id === 'ct-cur') compute(); });

    container.addEventListener('click', (e) => {
      if (e.target.id === 'ct-add-founder') {
        state.founders.push({ id: ++uid, name: `Founder ${String.fromCharCode(65 + state.founders.length)}`, shares: 1000000 });
        refresh();
      } else if (e.target.id === 'ct-add-round') {
        const last = state.rounds[state.rounds.length - 1];
        state.rounds.push({
          id: ++uid,
          name: `Series ${String.fromCharCode(65 + state.rounds.length - 1)}`,
          raise: last ? last.raise * 3 : 1000000,
          pre: last ? last.pre * 4 : 5000000,
        });
        refresh();
      } else if (e.target.dataset.delFounder) {
        state.founders = state.founders.filter(f => f.id !== Number(e.target.dataset.delFounder));
        refresh();
      } else if (e.target.dataset.delRound) {
        state.rounds = state.rounds.filter(r => r.id !== Number(e.target.dataset.delRound));
        refresh();
      }
    });

    refresh();
  },
  destroy() {},
};
