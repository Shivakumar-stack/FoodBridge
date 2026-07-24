const fs = require('fs');
const path = require('path');
const glob = require('glob');
const css = require('css');

const cssPath = path.join('c:\\Users\\dellv1\\Music\\food-management-sys\\frontend', 'styles', 'main.css');
const cssString = fs.readFileSync(cssPath, 'utf8');

const ast = css.parse(cssString, { source: 'main.css' });

// 1. Gather all selectors
const allSelectors = [];
const selectorNodes = [];

ast.stylesheet.rules.forEach((rule, idx) => {
  if (rule.type === 'rule') {
    rule.selectors.forEach(sel => {
      allSelectors.push(sel);
      selectorNodes.push({ selector: sel, rule, type: 'rule', index: idx });
    });
  } else if (rule.type === 'media') {
    rule.rules.forEach((innerRule, innerIdx) => {
      if (innerRule.type === 'rule') {
        innerRule.selectors.forEach(sel => {
          allSelectors.push(sel);
          selectorNodes.push({ selector: sel, rule: innerRule, media: rule.media, type: 'media', index: idx + '.' + innerIdx });
        });
      }
    });
  }
});

const totalSelectorsCount = allSelectors.length;

// Duplicate Check
const selectorCounts = {};
allSelectors.forEach(s => {
  selectorCounts[s] = (selectorCounts[s] || 0) + 1;
});
const duplicates = Object.entries(selectorCounts).filter(x => x[1] > 1);

// Find usage in HTML/JS
const files = glob.sync('c:\\Users\\dellv1\\Music\\food-management-sys\\frontend\\{pages,auth,volunteer,ngo,dashboard,dashboard-unified,components,utils,js}/**/*.{html,js}', { absolute: true });

let usedCount = 0;
let unusedCount = 0;

const fileContents = files.map(f => fs.readFileSync(f, 'utf8'));
const allContent = fileContents.join(' ');

const usedSelectors = new Set();
const unusedSelectors = new Set();

Object.keys(selectorCounts).forEach(sel => {
  let tokens = sel.match(/[.#]?[a-zA-Z0-9_-]+/g);
  let isUsed = false;
  if (tokens) {
    isUsed = tokens.every(token => {
       if (token.startsWith('.')) return allContent.includes(token.substring(1));
       if (token.startsWith('#')) return allContent.includes(token.substring(1));
       return allContent.includes('<' + token) || allContent.includes('</' + token) || (token === 'body' || token === 'html' || token === 'root' || token === 'a');
    });
  }
  
  if (isUsed || sel.includes(':hover') || sel.includes(':focus') || sel.includes('::') || sel.includes('nth-')) {
    usedSelectors.add(sel);
    usedCount++;
  } else {
    unusedSelectors.add(sel);
    unusedCount++;
  }
});

const report = {
  total: totalSelectorsCount,
  unique: Object.keys(selectorCounts).length,
  used: usedCount,
  unused: unusedCount,
  duplicateCount: duplicates.length,
  duplicatesTop: duplicates.sort((a, b) => b[1] - a[1]).slice(0, 10),
  unusedSample: Array.from(unusedSelectors).slice(0, 20)
};

fs.writeFileSync('c:\\Users\\dellv1\\Music\\food-management-sys\\frontend\\css_analysis_temp.json', JSON.stringify(report, null, 2));
console.log("Analysis written to css_analysis_temp.json");
