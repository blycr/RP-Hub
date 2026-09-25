'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/rphub-sync-native.js'), 'utf8');
const window = {};
let registeredTag;
vm.runInNewContext(source, { window, HTMLElement: class {},
    customElements: { define(tag) { registeredTag = tag; } } });

test('native sync registers the Vue-recognized custom element', () => {
    assert.equal(registeredTag, 'rphub-native-sync');
    const app = fs.readFileSync(path.join(__dirname, '../assets/js/app.js'), 'utf8');
    assert.match(app, /compilerOptions\.isCustomElement = tag => tag === 'rphub-native-sync'/);
});

test('native restore preserves local avatars and excludes legacy blob payloads', () => {
    const local = { rp_hub_characters: [{ uuid: 'same', avatar: 'data:image/png;base64,bG9jYWw=' }] };
    const remote = {
        rp_hub_characters: [{ uuid: 'same', avatar: '__RPHUB_SYNC_AVATAR_PLACEHOLDER__',
            __rphubSyncAvatarStripped__: true },
        { uuid: 'new', avatar: '__RPHUB_SYNC_AVATAR_PLACEHOLDER__' }],
        rp_hub_card_blob_old: { bytes: 'old image' },
        rp_hub_settings: { model: 'remote' },
    };
    const result = window.RPHubNativeSync.prepareMainRestore(remote, local);
    assert.equal(result.rp_hub_characters[0].avatar, local.rp_hub_characters[0].avatar);
    assert.equal('avatar' in result.rp_hub_characters[1], false);
    assert.equal('__rphubSyncAvatarStripped__' in result.rp_hub_characters[0], false);
    assert.equal('rp_hub_card_blob_old' in result, false);
    assert.deepEqual(JSON.parse(JSON.stringify(result.rp_hub_settings)), remote.rp_hub_settings);
    assert.equal(remote.rp_hub_characters[0].avatar, '__RPHUB_SYNC_AVATAR_PLACEHOLDER__');
});

test('native restore rejects unsafe storage keys and malformed characters before writing', () => {
    assert.throws(() => window.RPHubNativeSync.prepareMainRestore({ '\u0000bad': 'bad' }, {}), /无效键/);
    assert.throws(() => window.RPHubNativeSync.prepareMainRestore({ rp_hub_characters: [null] }, {}), /角色数据无效/);
});
