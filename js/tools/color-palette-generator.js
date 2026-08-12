import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls" style="justify-content:center; margin-bottom:24px;">
        <button class="btn btn-primary" id="pal-generate" style="font-size:0.9rem; padding:0 24px; height:44px;">Generate Palette (Spacebar)</button>
      </div>
      <div id="pal-container" style="display:flex; height:240px; border:1px solid var(--g200); border-radius:4px; overflow:hidden; width:100%;">
      </div>
      <div style="text-align:center; margin-top:16px; color:var(--g500); font-size:0.8rem;">
        Click any color hex to copy it
      </div>
    `;

    const palContainer = container.querySelector('#pal-container');

    function randomHex() {
      return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
    }

    function getContrastYIQ(hexcolor) {
      hexcolor = hexcolor.replace("#", "");
      const r = parseInt(hexcolor.substr(0, 2), 16);
      const g = parseInt(hexcolor.substr(2, 2), 16);
      const b = parseInt(hexcolor.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? 'var(--black)' : 'var(--white)';
    }

    function generatePalette() {
      palContainer.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const color = randomHex();
        const textColor = getContrastYIQ(color);
        
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
        
        col.addEventListener('click', (e) => {
          copyText(color, col);
          const originalText = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(() => label.textContent = originalText, 1000);
        });
        
        palContainer.appendChild(col);
      }
    }

    container.querySelector('#pal-generate').addEventListener('click', generatePalette);
    
    // Spacebar to generate
    const handleKeydown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        generatePalette();
      }
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
