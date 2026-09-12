const fs = require('fs');
let content = fs.readFileSync('css/style.css', 'utf8');

const retainThemes = ['white-on-black', 'linux-mint', 'ubuntu'];
const removeThemes = [
  'burgundy', 'cozy-pink', 'solar-blue', 'nocturne-blue', 'alpine-green', 
  'canary-yellow', 'espresso', 'neon-tokyo', 'cyber-matrix', 'akira-crimson', 
  'cyber-cyan', 'nordic-slate', 'sunset-ember', 'paper-ink', 'cyber-neon'
];

// Clean block helper
function removeThemeBlocks(text, themeName) {
  const regex = new RegExp('\\[data-theme="' + themeName + '"\\][^{]*\\{[^}]*\\}', 'g');
  return text.replace(regex, '');
}

for (const theme of removeThemes) {
  content = removeThemeBlocks(content, theme);
}

// Clean comma separated selectors where the removed theme is part of it.
// e.g. [data-theme="cyber-neon"] .dropdown, [data-theme="neon-tokyo"] .dropdown { ... }
// Actually it's easier to just remove the lines containing the bad themes if they only contain selectors.
// Let's do a more robust cleanup or just regex out lines containing [data-theme="deleted-theme"]
let lines = content.split('\n');
let newLines = [];
let skipBlock = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // if line has a bad theme
  if (removeThemes.some(t => line.includes('[data-theme="' + t + '"]'))) {
     // if it's a comma separated selector, we can just skip the line if the block is retained by another selector?
     // Actually in this CSS, they group multiple bad themes together (e.g. cyber-neon and neon-tokyo). 
     // If the line ends with '{', we skip until '}'
     if (line.includes('{')) {
         skipBlock = true;
     }
     // skip the line
     continue;
  }
  
  if (skipBlock) {
     if (line.includes('}')) {
         skipBlock = false;
     }
     continue;
  }
  
  newLines.push(line);
}

fs.writeFileSync('css/style.css', newLines.join('\n'), 'utf8');
console.log('Cleaned up style.css');
