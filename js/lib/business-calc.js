/* ============================================================
   TOOLBOX — Business & Finance calculations, without the UI

   The Assistant runs every Business & Finance calculator through
   here. The formulas match the tools (js/tools/<id>.js) so an
   answer in chat and the same numbers typed into the tool agree.
   Each calculator returns { toolId, title, rows: [[label, value]],
   note, data } — rows are formatted for people, data is raw.
   ============================================================ */

import { money, num, pct } from './biz.js';

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const months = (m) => {
  if (!Number.isFinite(m)) return 'never';
  const y = Math.floor(m / 12), r = Math.round(m % 12);
  return y ? `${y} yr${y > 1 ? 's' : ''}${r ? ` ${r} mo` : ''}` : `${Math.round(m)} mo`;
};

export function npv(rate, flows) {
  return flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

export function irr(flows) {
  const f = (r) => npv(r, flows);
  let lo = -0.9999, hi = 10, flo = f(lo);
  if (!Number.isFinite(flo) || flo * f(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export function amortise(principal, ratePct, years, extra = 0) {
  const r = ratePct / 100 / 12, count = Math.round(years * 12);
  const base = r > 0 ? principal * r / (1 - Math.pow(1 + r, -count)) : principal / count;
  const rows = [];
  let bal = principal, totalInterest = 0;
  for (let m = 1; m <= count && bal > 0.005; m++) {
    const interest = bal * r;
    const payment = Math.min(base + extra, bal + interest);
    bal -= payment - interest;
    totalInterest += interest;
    rows.push({ m, payment, interest, principalPart: payment - interest, balance: Math.max(bal, 0) });
  }
  return { base, rows, totalInterest };
}

export function depreciationSchedule({ method = 'sl', cost, salvage = 0, life, factor = 2, totalUnits = 1, unitsYear = 0 }) {
  const rows = [], depreciable = Math.max(cost - salvage, 0), sumYears = life * (life + 1) / 2;
  let book = cost;
  for (let year = 1; year <= life; year++) {
    let charge;
    if (method === 'ddb') charge = Math.min(book * (factor / life), Math.max(book - salvage, 0));
    else if (method === 'syd') charge = depreciable * (life - year + 1) / sumYears;
    else if (method === 'units') charge = Math.min(depreciable / Math.max(totalUnits, 1) * unitsYear, Math.max(book - salvage, 0));
    else charge = depreciable / life;
    charge = Math.max(Math.min(charge, Math.max(book - salvage, 0)), 0);
    book -= charge;
    rows.push({ year, charge, book });
  }
  return rows;
}

const CALCULATORS = {
  vat({ amount = 1000, rate = 7.5, mode = 'add', currency }) {
    const a = n(amount), r = n(rate) / 100;
    const net = mode === 'remove' ? a / (1 + r) : a;
    const tax = net * r, gross = net + tax;
    return {
      toolId: 'vat-calculator', title: `VAT at ${pct(r * 100, r * 100 % 1 ? 1 : 0)}`,
      rows: [['Net (before tax)', money(net, currency, { dp: 2 })], ['Tax', money(tax, currency, { dp: 2 })], ['Gross (tax included)', money(gross, currency, { dp: 2 })]],
      note: mode === 'remove' ? `Tax was taken out of a price that included it: divide by ${(1 + r).toFixed(3)}, not multiply by ${(1 - r).toFixed(3)}.` : '',
      data: { net, tax, gross },
    };
  },

  margin_markup({ cost, price, margin_pct, markup_pct, currency }) {
    let c = cost != null ? n(cost) : null, p = price != null ? n(price) : null;
    if (c != null && p == null && margin_pct != null) p = c / (1 - n(margin_pct) / 100);
    if (c != null && p == null && markup_pct != null) p = c * (1 + n(markup_pct) / 100);
    if (p != null && c == null && margin_pct != null) c = p * (1 - n(margin_pct) / 100);
    if (c == null || p == null) return { error: 'Give two of: cost, price, margin_pct (or markup_pct).' };
    const profit = p - c, margin = p ? profit / p * 100 : NaN, markup = c ? profit / c * 100 : NaN;
    return {
      toolId: 'margin-markup', title: 'Margin and markup',
      rows: [['Cost', money(c, currency, { dp: 2 })], ['Price', money(p, currency, { dp: 2 })], ['Profit per sale', money(profit, currency, { dp: 2 })], ['Gross margin', pct(margin)], ['Markup', pct(markup)]],
      note: 'Margin is profit as a share of price; markup is profit as a share of cost. A 50% markup is a 33.3% margin.',
      data: { cost: c, price: p, profit, margin, markup },
    };
  },

  break_even({ fixed_costs = 0, price = 0, variable_cost = 0, expected_units = 0, currency }) {
    const fixed = n(fixed_costs), pr = n(price), vc = n(variable_cost), exp = n(expected_units);
    const contribution = pr - vc, beUnits = contribution > 0 ? fixed / contribution : Infinity;
    const profit = contribution * exp - fixed;
    return {
      toolId: 'break-even', title: 'Break-even',
      rows: [
        ['Units to break even', contribution > 0 ? num(Math.ceil(beUnits)) : 'never (price ≤ variable cost)'],
        ['Revenue to break even', contribution > 0 ? money(beUnits * pr, currency) : '—'],
        ['Contribution per unit', `${money(contribution, currency, { dp: 2 })} (${pct(pr > 0 ? contribution / pr * 100 : NaN)} of price)`],
        ...(exp ? [['Profit at forecast', money(profit, currency)], ['Margin of safety', contribution > 0 ? pct((exp - beUnits) / exp * 100) : '—']] : []),
      ],
      data: { contribution, beUnits, beRevenue: beUnits * pr, profit },
    };
  },

  loan({ principal = 0, rate_pct = 0, years = 1, extra_monthly = 0, currency }) {
    const P = n(principal), rate = n(rate_pct), yrs = Math.max(n(years, 1), 0.1), extra = n(extra_monthly);
    const plain = amortise(P, rate, yrs), withExtra = extra > 0 ? amortise(P, rate, yrs, extra) : plain;
    const paid = withExtra.rows.reduce((s, r) => s + r.payment, 0);
    const rows = [
      ['Monthly payment', money(withExtra.base + extra, currency, { dp: 2 })],
      ['Total interest', money(withExtra.totalInterest, currency)],
      ['Total repaid', money(paid, currency)],
      ['Paid off in', months(withExtra.rows.length)],
    ];
    if (extra > 0) rows.push(['Interest saved by paying extra', money(plain.totalInterest - withExtra.totalInterest, currency)], ['Time saved', months(plain.rows.length - withExtra.rows.length)]);
    const byYear = [];
    for (let y = 0; y * 12 < withExtra.rows.length; y++) { const s = withExtra.rows.slice(y * 12, y * 12 + 12); byYear.push({ year: y + 1, interest: Math.round(s.reduce((a, r) => a + r.interest, 0)), principal: Math.round(s.reduce((a, r) => a + r.principalPart, 0)), balance: Math.round(s[s.length - 1].balance) }); }
    return { toolId: 'amortization-schedule', title: 'Loan repayment', rows, data: { payment: withExtra.base + extra, totalInterest: withExtra.totalInterest, byYear } };
  },

  compound_interest({ principal = 0, monthly_contribution = 0, rate_pct = 0, years = 1, compounds_per_year = 12, currency }) {
    const p = n(principal), m = n(monthly_contribution), t = n(years, 1), k = Math.max(1, Math.round(n(compounds_per_year, 12)));
    const rate = n(rate_pct) / 100 / k, periods = k * t;
    const fvP = p * Math.pow(1 + rate, periods);
    const fvC = rate > 0 ? m * (12 / k) * ((Math.pow(1 + rate, periods) - 1) / rate) : m * 12 * t;
    const total = fvP + fvC, paidIn = p + m * 12 * t;
    return {
      toolId: 'compound-interest', title: `Growth over ${t} year${t === 1 ? '' : 's'}`,
      rows: [['Final balance', money(total, currency)], ['You put in', money(paidIn, currency)], ['Interest earned', money(total - paidIn, currency)]],
      data: { total, paidIn, interest: total - paidIn },
    };
  },

  npv_irr({ rate_pct = 10, initial_investment = 0, cash_flows = [], currency }) {
    const flows = [-Math.abs(n(initial_investment)), ...(Array.isArray(cash_flows) ? cash_flows : String(cash_flows).split(/[\s,;]+/)).map(v => n(v)).filter(Number.isFinite)];
    const value = npv(n(rate_pct) / 100, flows), r = irr(flows);
    let cum = 0, payback = null;
    flows.forEach((cf, t) => { const before = cum; cum += cf; if (payback == null && t > 0 && cum >= 0) payback = t - 1 + (-before / cf); });
    return {
      toolId: 'npv-irr', title: 'Investment appraisal',
      rows: [['NPV', money(value, currency)], ['IRR', Number.isFinite(r) ? pct(r * 100) : 'none (flows never change sign)'], ['Payback', payback == null ? 'not within these years' : `${payback.toFixed(1)} years`], ['Decision at this rate', value >= 0 ? 'accept (NPV ≥ 0)' : 'reject (NPV < 0)']],
      data: { npv: value, irr: r, payback, flows },
    };
  },

  depreciation({ method = 'sl', cost = 0, salvage = 0, life_years = 5, factor = 2, total_units, units_per_year, currency }) {
    const life = Math.max(1, Math.round(n(life_years, 5)));
    const sched = depreciationSchedule({ method, cost: n(cost), salvage: n(salvage), life, factor: n(factor, 2), totalUnits: n(total_units, 1), unitsYear: n(units_per_year) });
    const names = { sl: 'Straight line', ddb: 'Declining balance', syd: "Sum of the years' digits", units: 'Units of production' };
    return {
      toolId: 'depreciation-calculator', title: `${names[method] || names.sl} depreciation`,
      rows: sched.map(r => [`Year ${r.year}`, `${money(r.charge, currency)} charge · book ${money(r.book, currency)}`]),
      data: { schedule: sched },
    };
  },

  cap_table({ founders = [], pool_pct = 0, rounds = [] }) {
    const fs = (Array.isArray(founders) && founders.length ? founders : [{ name: 'Founders', shares: 10_000_000 }]).map(f => ({ name: f.name || 'Founder', shares: Math.max(n(f.shares), 0), kind: 'founder' }));
    const fShares = fs.reduce((s, f) => s + f.shares, 0), pp = Math.min(Math.max(n(pool_pct), 0), 90) / 100;
    const holders = [...fs, ...(pp > 0 ? [{ name: 'Option pool', shares: fShares * pp / (1 - pp), kind: 'pool' }] : [])];
    let total = holders.reduce((s, h) => s + h.shares, 0);
    const roundRows = [];
    for (const r of Array.isArray(rounds) ? rounds : []) {
      const raise = Math.max(n(r.raise), 0), pre = Math.max(n(r.pre_money), 0), post = pre + raise;
      if (!raise || !post || !total) continue;
      const share = raise / post, newShares = total * share / (1 - share);
      holders.push({ name: r.name || `Round ${roundRows.length + 1}`, shares: newShares, kind: 'investor' });
      roundRows.push({ name: r.name, raise, pre, post, pricePerShare: pre / total, investorPct: share * 100 });
      total += newShares;
    }
    return {
      toolId: 'cap-table', title: 'Cap table after the rounds',
      rows: holders.map(h => [h.name, `${pct(h.shares / total * 100, 2)} (${num(Math.round(h.shares))} shares)`]),
      note: roundRows.map(r => `${r.name || 'Round'}: ${pct(r.investorPct)} sold at ${r.pricePerShare.toFixed(4)} per share.`).join(' '),
      data: { holders, total, rounds: roundRows },
    };
  },

  runway({ cash = 0, monthly_costs = 0, monthly_revenue = 0, revenue_growth_pct = 0, cost_growth_pct = 0, currency }) {
    let c = n(cash), rev = n(monthly_revenue), cost = n(monthly_costs), zero = null, be = null;
    const gR = n(revenue_growth_pct) / 100, gC = n(cost_growth_pct) / 100;
    for (let m = 1; m <= 120; m++) {
      const burn = cost - rev; c -= burn;
      if (be == null && burn <= 0) be = m;
      if (c <= 0) { zero = m; break; }
      if (burn <= 0 && m > 12) break;
      rev *= 1 + gR; cost *= 1 + gC;
    }
    const burn0 = n(monthly_costs) - n(monthly_revenue);
    return {
      toolId: 'runway-calculator', title: 'Runway',
      rows: [['Net burn now', `${money(burn0, currency)} / month`], ['Cash runs out', zero ? `in ${months(zero)}` : 'not within 10 years'], ['Break-even month', be ? `month ${be}` : 'not before cash runs out']],
      data: { zeroMonth: zero, breakEvenMonth: be, burn: burn0 },
    };
  },

  unit_economics({ marketing_spend = 0, new_customers = 0, arpu = 0, gross_margin_pct = 0, churn_pct = 3, currency }) {
    const cac = n(new_customers) > 0 ? n(marketing_spend) / n(new_customers) : NaN;
    const churn = Math.max(n(churn_pct, 3) / 100, 0.0001), life = 1 / churn;
    const gm = n(arpu) * n(gross_margin_pct) / 100, ltv = gm * life, ratio = cac > 0 ? ltv / cac : NaN, payback = gm > 0 ? cac / gm : NaN;
    return {
      toolId: 'unit-economics', title: 'Unit economics',
      rows: [['CAC', money(cac, currency)], ['LTV', money(ltv, currency)], ['LTV : CAC', Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : '—'], ['CAC payback', months(payback)], ['Average customer life', months(life)], ['Annual churn', pct((1 - Math.pow(1 - churn, 12)) * 100)]],
      note: 'A healthy SaaS business usually has LTV:CAC of 3× or more and pays back CAC within 12 months.',
      data: { cac, ltv, ratio, payback },
    };
  },

  payroll_cost({ salary = 0, employer_tax_pct = 0, pension_pct = 0, benefits = 0, equipment = 0, overhead = 0, recruitment = 0, working_days = 227, currency }) {
    const s = n(salary), tax = s * n(employer_tax_pct) / 100, pen = s * n(pension_pct) / 100;
    const ongoing = s + tax + pen + n(benefits) + n(equipment) + n(overhead), perDay = ongoing / Math.max(n(working_days, 227), 1);
    return {
      toolId: 'payroll-cost', title: 'True cost of an employee',
      rows: [['True annual cost', money(ongoing, currency)], ['First year (with recruitment)', money(ongoing + n(recruitment), currency)], ['Cost multiplier', s ? `${(ongoing / s).toFixed(2)}× salary` : '—'], ['Per working day', money(perDay, currency)], ['Per hour (7.5 h day)', money(perDay / 7.5, currency, { dp: 2 })]],
      data: { ongoing, perDay },
    };
  },

  salary_convert({ amount = 0, period = 'year', hours_per_week = 40, weeks_per_year = 52, days_per_week = 5, currency }) {
    const hw = n(hours_per_week, 40), wy = n(weeks_per_year, 52), dw = n(days_per_week, 5), a = n(amount);
    const annual = { year: a, month: a * 12, week: a * wy, day: a * dw * wy, hour: a * hw * wy }[period] ?? a;
    return {
      toolId: 'salary-converter', title: 'Pay in every period',
      rows: [['Per year', money(annual, currency)], ['Per month', money(annual / 12, currency)], ['Per week', money(annual / wy, currency)], ['Per day', money(annual / (dw * wy), currency)], ['Per hour', money(annual / (hw * wy), currency, { dp: 2 })]],
      data: { annual },
    };
  },

  meeting_cost({ minutes = 60, people = 5, average_salary = 0, hours_per_year = 1800, times_per_year = 0, currency }) {
    const perSecond = n(people, 1) * n(average_salary) / Math.max(n(hours_per_year, 1800), 1) / 3600;
    const per = perSecond * n(minutes, 60) * 60, freq = n(times_per_year);
    return {
      toolId: 'meeting-cost', title: 'Meeting cost',
      rows: [['This meeting', money(per, currency)], ['Per minute', money(perSecond * 60, currency, { dp: 2 })], ...(freq ? [['Per year', money(per * freq, currency)], ['Person-hours a year', num(n(minutes) / 60 * n(people) * freq)]] : [])],
      data: { perMeeting: per, annual: per * freq },
    };
  },

  pto_accrual({ annual_days = 25, periods_per_year = 12, carried_over = 0, taken = 0, booked = 0, months_elapsed = new Date().getMonth() + 1, carry_cap = 5 }) {
    const annual = n(annual_days), f = n(periods_per_year, 12), el = Math.min(Math.max(n(months_elapsed), 0), 12);
    const accrued = (f ? annual / f : 0) * Math.floor(f * el / 12);
    const now = n(carried_over) + accrued - n(taken) - n(booked), end = n(carried_over) + annual - n(taken) - n(booked);
    return {
      toolId: 'pto-accrual', title: 'Leave balance',
      rows: [['Available now', `${num(now, 1)} days`], ['Accrued so far', `${num(accrued, 1)} days`], ['Left at year end', `${num(end, 1)} days`], ['Lost at year end (over the cap)', `${num(Math.max(end - n(carry_cap), 0), 1)} days`]],
      data: { now, accrued, end },
    };
  },

  subscription({ cost = 0, frequency = 'month', currency }) {
    const daily = { day: 1, week: 1 / 7, month: 1 / 30.416, year: 1 / 365 }[frequency] * n(cost);
    return {
      toolId: 'subscription-analyzer', title: 'What a subscription really costs',
      rows: [['Per month', money(daily * 30.416, currency, { dp: 2 })], ['Per year', money(daily * 365, currency, { dp: 2 })], ['Over ten years', money(daily * 3650, currency)]],
      data: { monthly: daily * 30.416, yearly: daily * 365 },
    };
  },
};

export const BUSINESS_CALCULATORS = Object.keys(CALCULATORS);

/** Runs one calculator. Returns { error } when the inputs can't produce an answer. */
export function businessCalc(calculator, args = {}) {
  const fn = CALCULATORS[String(calculator || '').toLowerCase().replace(/[-\s]/g, '_')];
  if (!fn) return { error: `Unknown calculator "${calculator}". Use one of: ${BUSINESS_CALCULATORS.join(', ')}.` };
  const currency = /^[A-Za-z]{3}$/.test(args.currency || '') ? args.currency.toUpperCase() : 'NGN';
  try { return fn({ ...args, currency }); } catch (e) { return { error: e.message }; }
}
