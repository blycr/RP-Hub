'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const workshopHtml = fs.readFileSync(path.join(rootDir, 'character/index.html'), 'utf8');

test('workshop main inline script carries data-cfasync="false" and runs setupSyncListener after options/api init', () => {
    assert.match(workshopHtml, /<script data-cfasync="false">\s*const \{ createApp,/);

    const optionsIdx = workshopHtml.indexOf('const options = reactive({');
    const apiIdx = workshopHtml.indexOf('const api = reactive({');
    const setupSyncCallIdx = workshopHtml.indexOf('setupSyncListener();');
    assert.ok(optionsIdx > 0 && apiIdx > optionsIdx, 'options and api must be initialized in order');
    assert.ok(setupSyncCallIdx > apiIdx, 'setupSyncListener() must run after options and api are initialized');
});

test('workshop loadData and currentCharacter never leave an empty character list or undefined currentCharacter', () => {
    assert.match(workshopHtml, /const nextChars = validChars\.length > 0 \? validChars : \[createEmptyCharacter\(\)\];/);
    assert.match(workshopHtml, /const currentCharacter = computed\(\(\) => characters\.value\[currentCharacterIndex\.value\] \|\| characters\.value\[0\] \|\| fallbackCharacter\);/);
    assert.match(workshopHtml, /watch\(\(\) => currentCharacter\.value\?\.avatar,/);
});
