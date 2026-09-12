const fs = require('fs');
let text = fs.readFileSync('index.html', 'utf8');
const lines = text.split('\n');
const newAbout = `      <div id="support-view" class="page-view hidden">
        <div class="support-content" style="max-width: 600px; margin: 40px auto; padding: 20px; text-align: center;">
          <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 24px;">About Toolbox</h2>
          <div style="text-align: left; font-size: 1.1rem; line-height: 1.6; color: var(--text-secondary);">
            <p style="margin-bottom: 20px;">
              Toolbox is for anyone who wants a fast, reliable collection of tools in one place.
            </p>
            <p>
              I only built it because I was looking for a PDF editor on Google and decided to build my own because it was tedious looking it up.
            </p>
          </div>
        </div>
      </div>`;
lines.splice(142, 498 - 143 + 1, newAbout);
fs.writeFileSync('index.html', lines.join('\n'), 'utf8');
console.log('Replaced.');
