import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'character/index.html', 'novel/index.html'];

for (const page of pages) {
  const html = await readFile(path.join(root, page), 'utf8');
  for (const forbidden of ['cdn.tailwindcss.com', 'unpkg.com', 'cdn.jsdelivr.net', 'document.write']) {
    if (html.includes(forbidden)) throw new Error(page + ' still references ' + forbidden);
  }
  if (!html.includes('assets/vendor/')) throw new Error(page + ' does not use local vendor assets');
  if (html.includes('?t=' ) && html.includes('Date.now()')) throw new Error(page + ' still cache-busts local assets');
}

for (const file of [
  'assets/vendor/tailwind.css',
  'assets/vendor/vue.global.prod.js',
  'assets/vendor/marked.umd.js',
  'assets/vendor/purify.min.js',
  'assets/vendor/Sortable.min.js',
  'assets/vendor/localforage.min.js',
]) {
  await access(path.join(root, file));
}
console.log('Static asset check passed.');
