import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls" style="justify-content:center; margin-bottom:24px;">
        <button class="btn btn-primary" id="pal-generate" style="font-size:0.9rem; padding:0 24px; height:44px;">Generate palette</button>
      </div>
      <div id="pal-container" style="display:flex; height:240px; border:1px solid var(--g200); border-radius:4px; overflow:hidden; width:100%;">
      </div>
      <div style="text-align:center; margin-top:16px; color:var(--g500); font-size:0.8rem;">
        Click a colour to copy its hex · press <kbd>Space</kbd> for a new palette
      </div>
    `;

    const palContainer = container.querySelector('#pal-container');

    function randomHex() {
      return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
    }

    function readableInkOn(hex) {
      const value = hex.replace('#', '');
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq >= 128 ? 'var(--black)' : 'var(--white)';
    }

    function generatePalette() {
      palContainer.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const color = randomHex();
        const textColor = readableInkOn(color);

        const col = document.createElement('div');
        col.style.flex = '1';
        col.style.backgroundColor = color;
        col.style.display = 'flex';
        col.style.alignItems = 'flex-end';
        col.style.justifyContent = 'center';
        col.style.padding = '16px';
        col.style.cursor = 'pointer';
        col.style.transition = 'flex 0.2s ease';
        
        const label = document.createElement('span');
        label.textContent = color;
        label.style.fontFamily = 'var(--mono)';
        label.style.fontSize = '0.9rem';
        label.style.fontWeight = '500';
        label.style.color = textColor;
        label.style.opacity = '0.9';
        label.style.transition = 'transform 0.1s ease';
        
        col.appendChild(label);
        
        col.addEventListener('mouseenter', () => { col.style.flex = '1.2'; label.style.transform = 'scale(1.1)'; });
        col.addEventListener('mouseleave', () => { col.style.flex = '1'; label.style.transform = 'scale(1)'; });
        
        // Confirmation goes on the label, not the column. Handing the whole
        // column to the copy helper would replace its children with plain
        // text and take the swatch's styling with it.
        col.addEventListener('click', () => copyText(color, label));
        
        palContainer.appendChild(col);
      }
    }

    container.querySelector('#pal-generate').addEventListener('click', generatePalette);
    
    // Spacebar to generate. Buttons and form fields keep Space for themselves,
    // or the focused Generate button would fire twice on one press.
    const handleKeydown = (e) => {
      if (e.code !== 'Space') return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
      e.preventDefault();
      generatePalette();
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Cleanup event listener on destroy
    this._cleanup = () => document.removeEventListener('keydown', handleKeydown);

    generatePalette();
  },
  destroy() {
    if (this._cleanup) this._cleanup();
  }
};
