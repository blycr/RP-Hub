'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('critical pages use local, cacheable assets without blocking CDN dependencies', () => {
    for (const page of ['index.html', 'character/index.html', 'novel/index.html']) {
        const html = read(page);
        assert.doesNotMatch(html, /cdn\.tailwindcss\.com|unpkg\.com|cdn\.jsdelivr\.net/);
        assert.doesNotMatch(html, /document\.write/);
        assert.doesNotMatch(html, /\?t=\s*Date\.now|\?v=\s*Date\.now/);
        assert.match(html, /assets\/vendor\/(?:vue\.global\.prod\.js|tailwind\.css)/);
    }
    assert.match(read('index.html'), /assets\/js\/boot\.js/);
    assert.match(read('assets/js/app.js'), /window\.RPHubBoot\?\.ready\(\)/);
});

test('static build artifacts are present and within the mobile transfer budget', () => {
    for (const file of ['assets/vendor/tailwind.css', 'assets/vendor/vue.global.prod.js', 'assets/vendor/marked.umd.js', 'assets/vendor/purify.min.js', 'assets/vendor/Sortable.min.js', 'assets/vendor/localforage.min.js']) {
        const full = path.join(root, file);
        assert.ok(fs.existsSync(full), file + ' should be generated');
        assert.ok(fs.statSync(full).size > 0, file + ' must not be empty');
    }
    const css = fs.statSync(path.join(root, 'assets/vendor/tailwind.css')).size;
    assert.ok(css < 250 * 1024, 'compiled Tailwind CSS exceeds the mobile budget');
});

test('provider deletion removes legacy URLs, keys, modes and stale bindings', () => {
    const app = read('assets/js/app.js');
    assert.match(app, /const pruneDanglingProviderState =/);
    assert.match(app, /settings\.customApiUrl = '';/);
    assert.match(app, /delete settings\.customApiUrl2;/);
    assert.match(app, /saveData\(\{ saveMemories: false, saveCharacters: false \}\)/);
});
