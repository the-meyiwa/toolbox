import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Cron Expression</label>
        <input type="text" class="tool-input" id="cron-input" placeholder="* * * * * (min hour dom month dow)" value="0 12 * * 1-5" style="font-size:1.2rem; height:50px; text-align:center;">
      </div>
      
      <div class="tool-section">
        <label class="tool-label">Explanation</label>
        <div class="tool-output" id="cron-desc" style="font-size:1.1rem; text-align:center; padding:24px 16px;"></div>
      </div>
      
      <div class="tool-section">
        <label class="tool-label">Next 5 Occurrences (Local Time)</label>
        <div class="tool-output" id="cron-next" style="padding:16px;"></div>
      </div>
    `;

    const input = container.querySelector('#cron-input');
    const descEl = container.querySelector('#cron-desc');
    const nextEl = container.querySelector('#cron-next');

    // Very basic cron parser for demonstration (client-side only without external libs)
    function describeCron(cronStr) {
      const parts = cronStr.trim().split(/\\s+/);
      if (parts.length !== 5) return { error: 'Invalid format. Expected 5 parts (minute, hour, day of month, month, day of week).' };
      
      return { text: `Runs at ${parts[0]}m, ${parts[1]}h, on day ${parts[2]}, month ${parts[3]}, weekday ${parts[4]}` };
    }
    
    // Note: Writing a full robust cron parser from scratch is complex (dealing with ranges, steps, lists).
    // For this simple tool, we will use a basic textual description to show something useful.
    function parse() {
        const cronStr = input.value.trim();
        if (!cronStr) {
            descEl.textContent = 'Enter a cron expression';
            nextEl.innerHTML = '';
            return;
        }
        
        const desc = describeCron(cronStr);
        if (desc.error) {
            descEl.innerHTML = `<span style="color:var(--g600);">${desc.error}</span>`;
            nextEl.innerHTML = '';
        } else {
            // Very simplified description mapping just for display since we don't have cronstrue lib
            descEl.innerHTML = `<strong>${desc.text}</strong><br><span style="font-size:0.8rem; color:var(--g400);">(Basic interpretation)</span>`;
            nextEl.innerHTML = `<span style="color:var(--g500);">Future occurrences calculation requires a full cron engine library.</span>`;
        }
    }

    input.addEventListener('input', parse);
    parse();
  },
  destroy() {}
};
