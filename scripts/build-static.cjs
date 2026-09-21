// Copy only the playable game into Vercel's public output. No dependencies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = [
  'index.html', 'style.css', 'mobile.css', 'game.js',
  'assets/reference.jpeg', 'assets/aelith.png',
  'assets/aelith-actions.png', 'assets/aelith-walk.png'
];
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
console.log(`Static game ready: ${files.length} files in dist/`);
