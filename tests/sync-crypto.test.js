'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptText, decryptText } = require('../assets/js/rphub-sync-crypto');

// Generated once by private userscript v2.9.12 using this public sample text and passphrase.
const legacyFixture = '8UbmOjD1Rile0MFNdkjpFLMDCE5w7cpEu8KlyxubrStU/b5FPG74E0zkIUmw1pCi9Urr0zDLz4KhL9/F/h6Icv74psQRchmXbtfGWJHhupiJAC6RmS2NNhP8GWpiV+spAM6CA8Ls+SA25+8R6xwF4Q==';

test('creates the existing encrypted snapshot envelope', async () => {
    const text = JSON.stringify({ version: 2, state: { name: '角色', count: 3 } });
    const payload = JSON.parse(await encryptText(text, 'long-private-passphrase'));
    assert.equal(payload.version, 2);
    assert.equal(payload.encoding, 'base64+aes-gcm+gzip');
    assert.equal(await decryptText(payload, 'long-private-passphrase'), text);
    await assert.rejects(() => decryptText(payload, 'wrong-passphrase'));
});

test('old encrypted snapshot is readable by the new client', async () => {
    const text = JSON.stringify({ version: 2, chats: { 'rp_hub_chat_a': ['你好'] } });
    const payload = {
        version: 2,
        encryptedBlob: legacyFixture,
        encoding: 'base64+aes-gcm+gzip',
    };
    assert.equal(await decryptText(payload, 'long-private-passphrase'), text);
});
