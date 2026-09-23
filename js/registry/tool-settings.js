/* Per-tool preference schemas, shown in Preferences → Tools.
   A tool with settings reads them through lib/tool-settings.js and never
   renders its own settings panel.

   Field types
     toggle     { default: boolean }
     select     { options: [{ value, label }] | async () => options, default }
     segmented  { options: [{ value, label }], default }
     range      { min, max, step, default, format?: (v) => string } */

const opt = (value, label) => ({ value, label });

const QURAN_API = 'https://api.quran.com/api/v4';
let quranTranslations = null, quranReciters = null;

export const TOOL_SETTINGS = {
  chess: {
    title: 'Chess',
    hint: 'Board, computer opponent and coaching',
    groups: [
      {
        title: 'Board',
        fields: [
          { key: 'boardStyle', label: 'Board style', type: 'select', default: 'graphite',
            options: [opt('graphite', 'Graphite'), opt('paper', 'Paper'), opt('contrast', 'High contrast'), opt('classic', 'Classic walnut')] },
          { key: 'coordinates', label: 'Show coordinates', help: 'Files and ranks along the board edge.', type: 'toggle', default: true },
          { key: 'legalMoves', label: 'Show legal moves', help: 'Dots on the squares the selected piece can reach.', type: 'toggle', default: true },
          { key: 'lastMove', label: 'Highlight the last move', type: 'toggle', default: true },
          { key: 'animate', label: 'Animate moves', type: 'toggle', default: true },
          { key: 'sounds', label: 'Move sounds', type: 'toggle', default: false },
          { key: 'autoQueen', label: 'Always promote to a queen', help: 'Skip the promotion picker.', type: 'toggle', default: false },
          { key: 'autoFlip', label: 'Flip the board each turn', help: 'In two-player games on one device.', type: 'toggle', default: false },
        ],
      },
      {
        title: 'Computer',
        fields: [
          { key: 'strength', label: 'Computer strength', help: 'Level 1 plays loosely; level 10 searches as deep as it can in about three seconds.',
            type: 'range', min: 1, max: 10, step: 1, default: 5, format: (v) => `Level ${v}` },
          { key: 'timeControl', label: 'Clock', type: 'select', default: 'none',
            options: [opt('none', 'No clock'), opt('1+0', 'Bullet 1 min'), opt('3+0', 'Blitz 3 min'), opt('3+2', 'Blitz 3 | 2'),
              opt('5+0', 'Blitz 5 min'), opt('10+0', 'Rapid 10 min'), opt('15+10', 'Rapid 15 | 10'), opt('30+0', 'Classical 30 min')] },
        ],
      },
      {
        title: 'Coach',
        hint: 'Off means the board never tells you what to play or how you played.',
        fields: [
          { key: 'hints', label: 'Best-move hints', help: 'Adds a Hint button that shows the engine\'s best move as an arrow.', type: 'toggle', default: true },
          { key: 'review', label: 'Judge each move', help: 'Marks moves as best, good, inaccuracy, mistake or blunder, and says what was better.', type: 'toggle', default: true },
          { key: 'evalBar', label: 'Evaluation bar', help: 'Shows who is better and by how much.', type: 'toggle', default: true },
          { key: 'reviewDepth', label: 'Analysis depth', type: 'segmented', default: 'balanced',
            options: [opt('fast', 'Fast'), opt('balanced', 'Balanced'), opt('deep', 'Deep')] },
          { key: 'showOpening', label: 'Name the opening', type: 'toggle', default: true },
        ],
      },
    ],
  },

  'tech-device-comparisons': {
    title: 'Tech Device Comparisons',
    hint: 'Scores, units and what the comparison shows',
    groups: [
      {
        title: 'Comparison',
        fields: [
          { key: 'defaultCategory', label: 'Open on', type: 'select', default: 'phones',
            options: [opt('phones', 'Phones'), opt('tablets', 'Tablets'), opt('laptops', 'Laptops'), opt('socs', 'Mobile chips'),
              opt('cpus', 'Processors'), opt('gpus', 'Graphics cards'), opt('watches', 'Smartwatches'), opt('audio', 'Headphones & earbuds'),
              opt('consoles', 'Consoles & handhelds')] },
          { key: 'differencesOnly', label: 'Only show differences', help: 'Hide rows where both devices match.', type: 'toggle', default: false },
          { key: 'highlightWinners', label: 'Highlight the better value', type: 'toggle', default: true },
          { key: 'reasons', label: 'Reasons to list', help: 'How many "why it\'s better" points each side shows.',
            type: 'range', min: 3, max: 12, step: 1, default: 6, format: (v) => `${v}` },
        ],
      },
      {
        title: 'Display',
        fields: [
          { key: 'scoreScale', label: 'Score scale', type: 'segmented', default: '100', options: [opt('100', 'Out of 100'), opt('10', 'Out of 10')] },
          { key: 'units', label: 'Units', type: 'select', default: 'auto',
            options: [opt('auto', 'Follow General preferences'), opt('metric', 'Metric (g, mm)'), opt('imperial', 'Imperial (oz, in)')] },
          { key: 'showPrices', label: 'Show launch prices', type: 'toggle', default: true },
          { key: 'showBenchmarks', label: 'Show benchmark scores', type: 'toggle', default: true },
        ],
      },
    ],
  },

  mail: {
    title: 'Mail',
    hint: 'Layout, reading and sending',
    groups: [
      {
        title: 'Layout',
        fields: [
          { key: 'readingPane', label: 'Reading pane', help: 'Where an opened message appears on larger screens.', type: 'segmented', default: 'right',
            options: [opt('right', 'Right'), opt('bottom', 'Bottom'), opt('off', 'Off')] },
          { key: 'density', label: 'List density', type: 'segmented', default: 'comfortable',
            options: [opt('comfortable', 'Comfortable'), opt('compact', 'Compact')] },
          { key: 'threading', label: 'Conversation view', help: 'Group replies with the message they answer.', type: 'toggle', default: true },
          { key: 'snippets', label: 'Show message previews', help: 'A line of the message under each subject.', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Reading',
        fields: [
          { key: 'remoteImages', label: 'Load remote images automatically', help: 'Remote images can tell the sender when you opened a message.', type: 'toggle', default: false },
          { key: 'markRead', label: 'Mark as read', type: 'select', default: 'open',
            options: [opt('open', 'When opened'), opt('delay', 'After 3 seconds'), opt('manual', 'Only when I choose')] },
          { key: 'shortcuts', label: 'Keyboard shortcuts', help: 'c compose, / search, j/k move, e archive, # delete, r reply, s star.', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Sending',
        fields: [
          { key: 'undoSend', label: 'Undo send window', help: 'How long a sent message waits so you can take it back.', type: 'range', min: 0, max: 30, step: 5, default: 10,
            format: (v) => (v ? `${v} seconds` : 'Off') },
          { key: 'replyAll', label: 'Reply to everyone by default', type: 'toggle', default: false },
        ],
      },
    ],
  },

  notes: {
    title: 'Notes',
    hint: 'Typeface, page and note list',
    groups: [
      {
        title: 'Editor',
        fields: [
          { key: 'fontFamily', label: 'Typeface', type: 'select', default: 'sans',
            options: [opt('sans', 'System sans'), opt('serif', 'Editorial serif'), opt('mono', 'Monospace')] },
          { key: 'fontSize', label: 'Text size', type: 'segmented', default: 'normal',
            options: [opt('small', 'Small'), opt('normal', 'Normal'), opt('large', 'Large'), opt('xl', 'Extra large')] },
          { key: 'lineHeight', label: 'Line spacing', type: 'segmented', default: 'standard',
            options: [opt('compact', 'Compact'), opt('standard', 'Standard'), opt('relaxed', 'Relaxed')] },
          { key: 'paper', label: 'Page', type: 'select', default: 'blank',
            options: [opt('blank', 'Blank'), opt('lined', 'Ruled lines'), opt('grid', 'Grid'), opt('dot', 'Dot grid')] },
          { key: 'readableWidth', label: 'Readable line length', help: 'Keep text in a comfortable column on wide screens.', type: 'toggle', default: true },
          { key: 'spellcheck', label: 'Check spelling', type: 'toggle', default: true },
          { key: 'showWordCount', label: 'Show word count', type: 'toggle', default: true },
        ],
      },
      {
        title: 'Note list',
        fields: [
          { key: 'sort', label: 'Sort notes by', type: 'select', default: 'edited',
            options: [opt('edited', 'Date edited'), opt('created', 'Date created'), opt('title', 'Title')] },
          { key: 'showPreview', label: 'Show preview text', type: 'toggle', default: true },
          { key: 'groupByDate', label: 'Group by date', help: 'Today, Yesterday, Previous 7 days…', type: 'toggle', default: true },
        ],
      },
    ],
  },

  quran: {
    title: 'Quran',
    hint: 'Translation, recitation and reading size',
    groups: [
      {
        title: 'Reading',
        fields: [
          { key: 'translation', label: 'Translation', type: 'select', default: 0,
            options: async () => {
              if (!quranTranslations) {
                const r = await fetch(`${QURAN_API}/resources/translations?language=en`).then(x => x.json());
                quranTranslations = (r.translations ?? []).filter(t => t.language_name === 'english').map(t => opt(t.id, t.name));
              }
              return [opt(0, 'Recommended'), ...quranTranslations];
            } },
          { key: 'reciter', label: 'Reciter', type: 'select', default: 7,
            options: async () => {
              if (!quranReciters) {
                const r = await fetch(`${QURAN_API}/resources/recitations?language=en`).then(x => x.json());
                quranReciters = (r.recitations ?? []).map(x => opt(x.id, x.reciter_name + (x.style ? ` (${x.style})` : '')));
              }
              return quranReciters;
            } },
          { key: 'arabicSize', label: 'Arabic text size', type: 'range', min: 1, max: 4, step: 1, default: 2,
            format: (v) => ['Small', 'Medium', 'Large', 'Largest'][v - 1] },
          { key: 'showTranslation', label: 'Show translation', type: 'toggle', default: true },
          { key: 'showTransliteration', label: 'Show transliteration', type: 'toggle', default: false },
        ],
      },
    ],
  },
};
