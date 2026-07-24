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

  // If already processed, the comment <!-- Mobile Menu --> might be right before the new div.
  // Wait, if already processed, it will have "z-40" in it.
  if (content.includes('z-40') && content.includes('id="mobileMenu"')) {
    console.log(`Skipping ${page} - already processed`);
    return;
  }

  // Find id="mobileMenu"
  const mobileMenuIdIndex = content.indexOf('id="mobileMenu"');
  if (mobileMenuIdIndex === -1) {
    console.log(`Skipping ${page} - no mobileMenu`);
    return;
  }

  // Find the opening <div
  let startIndex = content.lastIndexOf('<div', mobileMenuIdIndex);
  
  // See if there's a comment right above it
  const commentIndex = content.lastIndexOf('<!-- Mobile Menu -->', mobileMenuIdIndex);
  if (commentIndex !== -1 && startIndex - commentIndex < 50) {
    startIndex = commentIndex;
  }

  // Find the <div class="px-4 py-4 space-y-2">
  const linksIndex = content.indexOf('<div class="px-4 py-4 space-y-2">', mobileMenuIdIndex);
  if (linksIndex === -1) {
    console.log(`Skipping ${page} - no links block`);
    return;
  }
  
  const prefix = content.substring(0, startIndex);
  const suffix = content.substring(linksIndex);
  
  const newHeader = `<!-- Mobile Menu -->
      <div
        id="mobileMenu"
        class="lg:hidden hidden fixed top-16 left-0 right-0 bottom-0 z-40 bg-white overflow-y-auto"
      >
        `;
        
  const newContent = prefix + newHeader + suffix;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Processed ${page}`);
});
