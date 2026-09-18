const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Add import
code = code.replace(/import \{ listJoinedSpaces \} from '\.\/lib\/space-engine\.js';/, 
  "import { listJoinedSpaces } from './lib/space-engine.js';\nimport { openContextMenu } from './lib/context-menu.js';");

// 2. Add event listener
const contextMenuLogic = `
viewport.addEventListener('contextmenu', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.closest('[contenteditable="true"]')) return;
  
  let items = [];
  if (currentToolInstance && typeof currentToolInstance.getContextMenu === 'function') {
      const customItems = currentToolInstance.getContextMenu(e);
      if (customItems && customItems.length > 0) {
          items = items.concat(customItems);
      }
  } else if (currentToolObj) {
      // Tailored actions based on category
      switch (currentToolObj.category) {
        case 'text':
          items.push({ label: 'Clear Editor', action: () => { const els = document.querySelectorAll('textarea, input[type="text"]'); els.forEach(el => el.value = ''); } });
          break;
        case 'numbers':
        case 'business':
          items.push({ label: 'Reset Calculation', action: () => { const btn = document.querySelector('button[class*="reset"], button[id*="reset"], button[class*="clear"], button[id*="clear"]'); if(btn) btn.click(); else { document.querySelectorAll('input').forEach(el => el.value = ''); } } });
          break;
        case 'audio':
        case 'music':
          items.push({ label: 'Stop Audio', action: () => { document.querySelectorAll('audio, video').forEach(a => { a.pause(); a.currentTime = 0; }); } });
          break;
      }
  }
  
  if (currentToolObj) {
      if (items.length > 0) items.push({ separator: true });
      items.push({ label: 'Copy Tool Link', action: () => navigator.clipboard.writeText(window.location.href).catch(()=>{}) });
      const standaloneMode = new URLSearchParams(window.location.search).get('standalone') === 'true';
      if (!standaloneMode) {
          items.push({ label: 'Open in new tab', action: () => window.open(window.location.href, '_blank') });
      }
      openContextMenu({ x: e.clientX, y: e.clientY, items, title: currentToolObj.name });
      e.preventDefault();
  }
});

initTheme();
`;

code = code.replace(/initTheme\(\);/, contextMenuLogic);
fs.writeFileSync('js/app.js', code);
console.log('patched app.js');
