const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/lib/chemistry-data.js');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure import is at the top
if (!content.includes("import { COMPOUNDS_DATA } from './compounds-dataset.js';")) {
  content = "import { COMPOUNDS_DATA } from './compounds-dataset.js';\n\n" + content;
}

// Find export const COMMON_COMPOUNDS = [
const targetIdx = content.indexOf('export const COMMON_COMPOUNDS = [');
if (targetIdx !== -1) {
  content = content.substring(0, targetIdx) + `/**\n * Comprehensive Chemical & Pharmaceutical Compound Database (1,050+ verified entries)\n */\nexport const COMMON_COMPOUNDS = COMPOUNDS_DATA;\n`;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated chemistry-data.js');
