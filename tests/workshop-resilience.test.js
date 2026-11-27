'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const workshopHtml = fs.readFileSync(path.join(rootDir, 'character/index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');

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

test('main app syncSettingsToGenerator and workshop SYNC_SETTINGS populate current and preset models cleanly', () => {
    assert.match(appSrc, /qualityModel:\s*quality\.model/);
    assert.match(appSrc, /balancedModel:\s*balanced\.model/);
    assert.match(appSrc, /fastModel:\s*fast\.model/);
    assert.match(appSrc, /imageModel:\s*settings\.imageModel/);
    assert.match(appSrc, /customImageArtists,/);

    assert.match(workshopHtml, /options\.customModels\.current = api\.modelConfigs\.current\.model \|\| ''/);
    assert.match(workshopHtml, /options\.customModels\.quality = api\.modelConfigs\.quality\.model \|\| mainSettings\.qualityModel \|\| ''/);
    assert.match(workshopHtml, /api\.model \|\| options\.customModels\[activeModelType\] \|\| '未设置模型'/);
    assert.match(workshopHtml, /v-if="showCurrentModelOption"/);
});
