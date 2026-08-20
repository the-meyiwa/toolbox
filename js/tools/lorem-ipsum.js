import { copyText } from '../utils.js';

const WORDS = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
  'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim',
  'ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi',
  'aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit',
  'voluptate','velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint',
  'occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt',
  'mollit','anim','id','est','laborum','porta','nibh','venenatis','cras','pulvinar',
  'mattis','nunc','lacus','viverra','vitae','congue','mauris','rhoncus','aenean',
  'vel','facilisis','volutpat','maecenas','pharetra','convallis','posuere','morbi',
  'leo','urna','molestie','at','elementum','eu','facilisi','nullam','vehicula','ipsum',
  'a','arcu','cursus','eget','nunc','scelerisque','vivamus','dictum','semper','dui',
  'diam','quam','pellentesque','habitant','senectus','netus','fames','turpis','egestas'
];

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSentence() {
  const len = 8 + Math.floor(Math.random() * 12);
  const words = Array.from({ length: len }, randomWord);
  words[0] = capitalize(words[0]);
  return words.join(' ') + '.';
}

function generateParagraph() {
  const count = 3 + Math.floor(Math.random() * 5);
  return Array.from({ length: count }, generateSentence).join(' ');
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls">
        <div class="btn-group">
          <button class="btn btn-sm active" data-type="paragraphs">Paragraphs</button>
          <button class="btn btn-sm" data-type="sentences">Sentences</button>
          <button class="btn btn-sm" data-type="words">Words</button>
        </div>
        <div class="tool-row" style="margin-left:8px;">
          <label class="tool-label" style="margin:0;">Count</label>
          <input type="number" class="tool-input" id="li-count" value="3" min="1" max="100" style="width:70px; height:28px; text-align:center; font-size:0.78rem;">
        </div>
        <button class="btn btn-primary btn-sm" id="li-generate" style="margin-left:auto;">Generate</button>
      </div>
      <div class="tool-section">
        <div class="tool-output" id="li-output" style="min-height:200px; white-space:pre-wrap; word-break:normal;">
          <button class="copy-btn" id="li-copy">Copy</button>
          <span id="li-result"></span>
        </div>
      </div>
    `;

    let type = 'paragraphs';
    const result = container.querySelector('#li-result');

    function generate() {
      const count = Math.max(1, Math.min(100, parseInt(container.querySelector('#li-count').value) || 3));
      let text = '';
      if (type === 'paragraphs') {
        text = Array.from({ length: count }, generateParagraph).join('\n\n');
      } else if (type === 'sentences') {
        text = Array.from({ length: count }, generateSentence).join(' ');
      } else {
        text = Array.from({ length: count }, randomWord).join(' ');
      }
      result.textContent = text;
    }

    // Type selector
    container.querySelector('.btn-group').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      type = btn.dataset.type;
      container.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      generate();
    });

    container.querySelector('#li-generate').addEventListener('click', generate);

    container.querySelector('#li-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    // Auto-generate on load
    generate();

    this._read = () => result.textContent;
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },

  destroy() { this._read = null; }
};
