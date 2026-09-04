import { currencySelect, field, statGrid, money, num, parseNum } from '../lib/biz.js';

/* Two modes: cost a meeting before you schedule it, or start a live
   ticker in the meeting itself and watch it climb. */

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="mc-cur">Currency</label>
            ${currencySelect('mc-cur')}
          </div>
          ${field('People in the meeting', 'mc-people', 8, { min: 1, max: 500, step: 1 })}
          ${field('Average salary', 'mc-salary', 72000, { min: 0, suffix: 'per year' })}
          ${field('Overhead multiplier', 'mc-multiplier', 1.4, { min: 1, max: 3, step: 0.05, hint: 'Employees cost more than their salary. 1.4 is a common rule of thumb.' })}
          ${field('Working hours a year', 'mc-hours', 1700, { min: 1, step: 10, hint: '227 working days at 7.5 hours.' })}
          ${field('Meeting length', 'mc-minutes', 60, { min: 1, max: 600, step: 5, suffix: 'minutes' })}
          ${field('How often it repeats', 'mc-frequency', 52, { min: 0, max: 365, step: 1, suffix: 'per year', hint: '52 for weekly, 12 for monthly, 0 for a one-off.' })}
        </div>

        <div class="tool-section">
          <div id="mc-out"></div>

          <div class="mc-live">
            <div class="mc-live-head">
              <span>Live meeting</span>
              <span class="mc-clock" id="mc-clock">00:00:00</span>
            </div>
            <div class="mc-live-cost" id="mc-live-cost">—</div>
            <div class="tool-controls">
              <button class="btn btn-primary btn-sm" id="mc-start">Start the clock</button>
              <button class="btn btn-secondary btn-sm" id="mc-reset">Reset</button>
            </div>
            <p class="biz-hint">Start this when the meeting begins. It counts the real cost as it runs.</p>
          </div>

          <div class="tool-output biz-explain" id="mc-note"></div>
        </div>
      </div>`;

    const out = container.querySelector('#mc-out');
    const clockEl = container.querySelector('#mc-clock');
    const liveEl  = container.querySelector('#mc-live-cost');
    const startBtn = container.querySelector('#mc-start');

    let running = false, startedAt = 0, elapsed = 0;
    const self_ = this;

    function ratePerSecond() {
      const people     = Math.max(parseNum(container.querySelector('#mc-people'), 1), 1);
      const salary     = parseNum(container.querySelector('#mc-salary'));
      const multiplier = parseNum(container.querySelector('#mc-multiplier'), 1);
      const hours      = Math.max(parseNum(container.querySelector('#mc-hours'), 1), 1);
      const hourly     = salary * multiplier / hours;
      return (hourly * people) / 3600;
    }

    function compute() {
      const cur     = container.querySelector('#mc-cur').value;
      const minutes = Math.max(parseNum(container.querySelector('#mc-minutes'), 1), 0);
      const freq    = parseNum(container.querySelector('#mc-frequency'));
      const people  = Math.max(parseNum(container.querySelector('#mc-people'), 1), 1);

      const perSecond = ratePerSecond();
      const perMeeting = perSecond * minutes * 60;
      const annual = perMeeting * freq;
      const hoursLost = minutes / 60 * people * freq;

      out.innerHTML = statGrid([
        { value: money(perMeeting, cur), label: 'This meeting costs', tone: 'hero' },
        { value: money(perSecond * 60, cur, { dp: 2 }), label: 'Per minute' },
        { value: freq > 0 ? money(annual, cur) : '—', label: 'Per year if it repeats', tone: annual > 50000 ? 'bad' : null },
        { value: freq > 0 ? `${num(hoursLost)} hrs` : '—', label: 'Person-hours a year' },
      ]);

      container.querySelector('#mc-note').innerHTML = freq > 0
        ? `A ${minutes}-minute meeting with ${people} people, held ${freq} times a year, costs
           <strong>${money(annual, cur)}</strong> and consumes <strong>${num(hoursLost)} person-hours</strong>.
           Cutting it to ${Math.round(minutes / 2)} minutes would give back
           <strong>${money(annual / 2, cur)}</strong>; dropping two attendees would save
           <strong>${money(annual * (2 / people), cur)}</strong>.`
        : `A one-off ${minutes}-minute meeting with ${people} people costs
           <strong>${money(perMeeting, cur)}</strong> in salary time alone.`;

      if (!running) renderLive();
    }

    function renderLive() {
      const cur = container.querySelector('#mc-cur').value;
      const secs = Math.floor(elapsed / 1000);
      const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      clockEl.textContent = `${hh}:${mm}:${ss}`;
      liveEl.textContent = money(ratePerSecond() * (elapsed / 1000), cur, { dp: 2 });
    }

    function tick() {
      if (!running) return;
      elapsed = Date.now() - startedAt;
      renderLive();
      self_._raf = requestAnimationFrame(tick);
    }

    startBtn.addEventListener('click', () => {
      if (running) {
        running = false;
        cancelAnimationFrame(self_._raf);
        startBtn.textContent = 'Resume';
      } else {
        running = true;
        startedAt = Date.now() - elapsed;
        startBtn.textContent = 'Pause';
        tick();
      }
    });

    container.querySelector('#mc-reset').addEventListener('click', () => {
      running = false;
      cancelAnimationFrame(self_._raf);
      elapsed = 0;
      startBtn.textContent = 'Start the clock';
      renderLive();
    });

    container.addEventListener('input', compute);
    container.addEventListener('change', compute);
    compute();
  },

  destroy() {
    cancelAnimationFrame(this._raf);
  },
};
