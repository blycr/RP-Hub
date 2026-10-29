import { copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'assets', 'vendor');
await mkdir(vendor, { recursive: true });

const copies = [
  ['node_modules/vue/dist/vue.global.prod.js', 'assets/vendor/vue.global.prod.js'],
  ['node_modules/marked/lib/marked.umd.js', 'assets/vendor/marked.umd.js'],
  ['node_modules/dompurify/dist/purify.min.js', 'assets/vendor/purify.min.js'],
  ['node_modules/sortablejs/Sortable.min.js', 'assets/vendor/Sortable.min.js'],
  ['node_modules/localforage/dist/localforage.min.js', 'assets/vendor/localforage.min.js'],
];
for (const [from, to] of copies) {
  await copyFile(path.join(root, from), path.join(root, to));
}

const tailwind = path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
execFileSync(process.execPath, [tailwind, '-c', 'tailwind.config.cjs', '-i', 'assets/css/tailwind-source.css',
  '-o', 'assets/vendor/tailwind.css', '--minify'], { cwd: root, stdio: 'inherit' });
console.log('Static vendor assets and Tailwind CSS generated.');
