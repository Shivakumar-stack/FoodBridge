const fs = require('fs');
const path = require('path');

const pages = [
  'about.html',
  'contact.html',
  'donate.html',
  'how-it-works.html',
  'index.html',
  'live-map.html',
  'privacy-policy.html',
  'sitemap.html',
  'terms.html',
  'volunteer.html'
];

const directory = path.join(__dirname, 'frontend', 'pages');

pages.forEach(page => {
  const filePath = path.join(directory, page);
  let content = fs.readFileSync(filePath, 'utf8');

  // Find <div id="mobileMenu"
  const mobileMenuIndex = content.indexOf('id="mobileMenu"');
  if (mobileMenuIndex === -1) {
    console.log(`Skipping ${page} - no mobileMenu`);
    return;
  }

  // Backtrack to the opening <!-- Mobile Menu -->
  let startIndex = content.lastIndexOf('<!-- Mobile Menu -->', mobileMenuIndex);
  
  // If not found, just backtrack to the opening <div
  if (startIndex === -1) {
    startIndex = content.lastIndexOf('<div', mobileMenuIndex);
  } else {
    // Backtrack to the start of the line for the comment
    const lineStart = content.lastIndexOf('\n', startIndex);
    if (lineStart !== -1 && lineStart > content.lastIndexOf('<', startIndex - 1)) {
       startIndex = lineStart + 1; // start of the comment line
    }
  }
  
  // Find </nav>
  const navEndIndex = content.indexOf('</nav>', mobileMenuIndex);
  
  if (navEndIndex === -1) {
    console.log(`Skipping ${page} - no </nav> after mobileMenu`);
    return;
  }

  // Get the whitespace before </nav> to maintain formatting
  const navLineStart = content.lastIndexOf('\n', navEndIndex);
  const navIndent = content.substring(navLineStart + 1, navEndIndex);
  
  let menuContent = content.substring(startIndex, navEndIndex);
  // trim trailing whitespace from menuContent so it doesn't add extra blank lines
  menuContent = menuContent.replace(/\s+$/, '');

  const prefix = content.substring(0, startIndex);
  const suffix = content.substring(navEndIndex + '</nav>'.length);
  
  const newContent = prefix + navIndent + '</nav>\n\n' + navIndent + menuContent + '\n' + suffix;
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Processed ${page}`);
});
