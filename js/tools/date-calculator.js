/* ============================================================
   Date Calculator — time between dates, add or subtract, what day
   a date falls on, decimal hours, leap years and Discord
   timestamps. Calendar maths is done in UTC days, so daylight
   saving never moves an answer.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import * as D from '../lib/transforms/time-ops.js';
import { kv, table, code } from '../lib/kit/render.js';

const today = () => new Date().toISOString().slice(0, 10);
const inAMonth = () => D.fmtDay(D.addToDate(D.parseDay(today()), { months: 1 }));
const need = (s, what) => { const d = D.parseDay(s); if (!d) throw new Error(`Choose ${what}`); return d; };
const n = (x) => Number(x).toLocaleString();
const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default makeTextTool({
  id: 'date-calculator',
  produces: ['text'],
  placeholder: 'One duration per line: 7:30, 7h 30m, 450m or 7.5',
  sample: '7:30\n8h 15m\n6.75\n45m',
  modes: [
    { id: 'between', label: 'Between', noInput: true,
      fields: [{ key: 'a', label: 'From', type: 'date', value: today }, { key: 'b', label: 'To', type: 'date', value: inAMonth }, { key: 'inclusive', label: 'Count the end day too', type: 'checkbox', value: false }],
      run(_, v) {
        const a = need(v.a, 'a start date'); let b = need(v.b, 'an end date');
        if (v.inclusive) b = D.addToDate(b, { days: b >= a ? 1 : -1 });
        const r = D.between(a, b);
        const parts = [r.years && `${r.years} year${r.years === 1 ? '' : 's'}`, r.months && `${r.months} month${r.months === 1 ? '' : 's'}`, `${r.days} day${r.days === 1 ? '' : 's'}`].filter(Boolean).join(', ');
        const text = `${r.sign < 0 ? '−' : ''}${parts}`;
        return { text, html: `<p class="kit-h" style="font-size:20px">${text}</p>${kv([['Total days', n(r.totalDays)], ['Weeks', `${n(r.weeks)} weeks and ${Math.abs(r.totalDays) % 7} days`], ['Weekdays (Mon–Fri)', n(r.weekdays)], ['Months', n(r.totalMonths)], ['Hours', n(r.hours)]])}` };
      } },
    { id: 'add', label: 'Add / subtract', noInput: true,
      fields: [{ key: 'a', label: 'Start', type: 'date', value: today }, { key: 'op', label: 'Operation', type: 'seg', options: [['add', 'Add'], ['sub', 'Subtract']], value: 'add' },
        { key: 'years', label: 'Years', type: 'number', value: 0 }, { key: 'months', label: 'Months', type: 'number', value: 0 }, { key: 'weeks', label: 'Weeks', type: 'number', value: 0 }, { key: 'days', label: 'Days', type: 'number', value: 30 }],
      run(_, v) {
        const s = v.op === 'sub' ? -1 : 1;
        const r = D.addToDate(need(v.a, 'a start date'), { years: s * v.years, months: s * v.months, weeks: s * v.weeks, days: s * v.days });
        const info = D.describeDay(r);
        return { text: D.fmtDay(r), html: `<p class="kit-h" style="font-size:20px">${info.long}</p>${kv([['ISO date', D.fmtDay(r)], ['ISO week', info.isoWeek], ['Day of year', `${info.dayOfYear} of ${info.daysInYear}`]])}` };
      } },
    { id: 'day', label: 'About a date', noInput: true,
      fields: [{ key: 'a', label: 'Date', type: 'date', value: today }],
      run(_, v) {
        const d = need(v.a, 'a date'); const i = D.describeDay(d); const t = D.between(D.parseDay(today()), d);
        return { text: i.long, html: `<p class="kit-h" style="font-size:20px">${i.long}</p>${kv([['Weekday', i.weekday], ['ISO week', i.isoWeek], ['Day of year', `${i.dayOfYear} of ${i.daysInYear}`], ['Quarter', `Q${i.quarter}`], ['Days in month', i.daysInMonth], ['Leap year', i.leapYear ? 'Yes' : 'No'], ['From today', t.totalDays === 0 ? 'Today' : `${n(Math.abs(t.totalDays))} days ${t.totalDays > 0 ? 'from now' : 'ago'}`]])}` };
      } },
    { id: 'duration', label: 'Hours',
      run(input) {
        const rows = input.split('\n').filter((l) => l.trim()).map((l) => { const h = D.parseDuration(l); return [l.trim(), h]; });
        const valid = rows.filter(([, h]) => h != null); const total = valid.reduce((a, [, h]) => a + h, 0);
        const f = D.formatDuration(total);
        return {
          text: rows.map(([l, h]) => `${l}\t${h == null ? '?' : h.toFixed(2)}`).join('\n') + `\nTotal\t${total.toFixed(2)}`,
          html: table(['Entered', 'Decimal hours', 'Clock'], [...rows.map(([l, h]) => [l, h == null ? 'not understood' : h.toFixed(2), h == null ? '' : D.formatDuration(h).clock]), [{ html: '<b>Total</b>' }, { html: `<b>${total.toFixed(2)}</b>` }, { html: `<b>${f.clock}</b>` }]], { numeric: [1, 2] }),
          stats: [['total', f.words], ['minutes', n(Math.round(total * 60))], ['seconds', n(Math.round(total * 3600))]],
        };
      } },
    { id: 'leap', label: 'Leap years', noInput: true,
      fields: [{ key: 'from', label: 'From year', type: 'number', value: 2000 }, { key: 'to', label: 'To year', type: 'number', value: 2100 }],
      run(_, v) { const y = D.leapYearsBetween(Number(v.from), Number(v.to)); return { text: y.join(', '), stats: [['leap years', y.length]] }; } },
    { id: 'discord', label: 'Discord time', noInput: true,
      fields: [{ key: 'when', label: 'Date and time (your time zone)', type: 'datetime', value: nowLocal }],
      run(_, v) {
        const d = new Date(v.when);
        if (Number.isNaN(d.getTime())) throw new Error('Choose a date and time');
        const rows = D.discordTimestamps(d);
        return { text: rows.map((r) => r.tag).join('\n'), html: table(['Style', 'Paste this', 'Shows as'], rows.map((r) => [r.label, code(r.tag), r.preview])), stats: [['Unix time', Math.floor(d / 1000)]] };
      } },
  ],
});
