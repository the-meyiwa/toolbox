const fs = require('fs');
let code = fs.readFileSync('js/tools/anatomy-explorer.js', 'utf8');

// Replace the concurrent checkbox firing with sequential firing
const original = `    const systemCBs = systemsEl.querySelectorAll('input[type="checkbox"]');
    systemCBs.forEach(cb => {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });`;

const replacement = `    const systemCBs = Array.from(systemsEl.querySelectorAll('input[type="checkbox"]'));
    (async () => {
      for (const cb of systemCBs) {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          // Wait briefly between initiating loads to avoid blocking the main thread too heavily
          await new Promise(r => setTimeout(r, 800));
        }
      }
    })();`;

code = code.replace(original, replacement);
fs.writeFileSync('js/tools/anatomy-explorer.js', code);
console.log('patched anatomy explorer');
