import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distJsDir = path.join(__dirname, '..', 'dist', 'assets', 'js');

if (!fs.existsSync(distJsDir)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(distJsDir)) {
  if (entry === 'panorama.js') {
    continue;
  }

  const absolutePath = path.join(distJsDir, entry);
  if (fs.statSync(absolutePath).isFile()) {
    fs.unlinkSync(absolutePath);
  }
}
