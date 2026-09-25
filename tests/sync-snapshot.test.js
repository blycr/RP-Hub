'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cryptoApi = require('../assets/js/rphub-sync-crypto');
const { FILES, createSnapshot, readSnapshot } = require('../assets/js/rphub-sync-snapshot');

test('builds legacy-compatible encrypted shards without image blobs', async () => {
    const original = {
        rp_hub_characters: [{ uuid: 'id-1', name: '角色', plazaId: 'card-1', avatar: 'data:image/png;base64,aGVsbG8=' }],
        rp_hub_chat_id_1: [{ role: 'user', content: '你好' }],
        rp_hub_card_blob_card_1: { image: 'must not upload' },
        rp_hub_settings: { apiKey: 'private-test-key' },
    };
    const { files, manifest } = await createSnapshot(original, {
        deviceId: 'device-example', passphrase: 'long-private-passphrase',
        workshop: { version: 1, characters: [{ name: '工坊卡' }], options: {}, activeIndex: 0 },
    }, cryptoApi);
    const textByPath = new Map(files.map(file => [file.path, Buffer.from(file.base64, 'base64').toString('utf8')]));
    assert.equal(files.length, 6);
    assert.equal(manifest.version, 1);
    assert.equal(manifest.deviceId, 'device-example');
    assert.equal(textByPath.get(FILES.state).includes('private-test-key'), false);
    const result = await readSnapshot(async (path, { optional }) => textByPath.get(path) ?? (optional ? null : undefined),
        'long-private-passphrase', cryptoApi);
    assert.equal(result.data.rp_hub_characters[0].avatar, '__RPHUB_SYNC_AVATAR_PLACEHOLDER__');
    assert.equal(result.data.rp_hub_characters[0].plazaId, 'card-1');
    assert.deepEqual(result.data.rp_hub_chat_id_1, original.rp_hub_chat_id_1);
    assert.deepEqual(result.data.rp_hub_settings, original.rp_hub_settings);
    assert.equal('rp_hub_card_blob_card_1' in result.data, false);
    assert.equal(result.workshop.characters[0].name, '工坊卡');
});

test('fails before returning partial state when a shard is missing', async () => {
    const { files } = await createSnapshot({ rp_hub_chat_id_1: ['text'] }, {
        deviceId: 'device-example', passphrase: 'long-private-passphrase',
    }, cryptoApi);
    const textByPath = new Map(files.map(file => [file.path, Buffer.from(file.base64, 'base64').toString('utf8')]));
    textByPath.delete('rp-hub-sync/chats/chat-id-1.enc.json');
    await assert.rejects(() => readSnapshot(async path => textByPath.get(path),
        'long-private-passphrase', cryptoApi), /同步文件缺失/);
});

test('rejects a valid encrypted shard from another snapshot when the manifest hash differs', async () => {
    const settings = { deviceId: 'device-example', passphrase: 'long-private-passphrase' };
    const current = await createSnapshot({ rp_hub_chat_id_1: ['current'] }, settings, cryptoApi);
    const stale = await createSnapshot({ rp_hub_chat_id_1: ['stale'] }, settings, cryptoApi);
    const textByPath = new Map(current.files.map(file => [file.path, Buffer.from(file.base64, 'base64').toString('utf8')]));
    const staleChat = stale.files.find(file => file.path === 'rp-hub-sync/chats/chat-id-1.enc.json');
    textByPath.set(staleChat.path, Buffer.from(staleChat.base64, 'base64').toString('utf8'));
    await assert.rejects(() => readSnapshot(async path => textByPath.get(path) ?? null,
        settings.passphrase, cryptoApi), /同步文件校验失败/);
});

test('rejects chat keys that collide after legacy filename conversion', async () => {
    await assert.rejects(() => createSnapshot({
        rp_hub_chat_a_b: ['first'],
        'rp_hub_chat_a-b': ['second'],
    }, { deviceId: 'device-example', passphrase: 'long-private-passphrase' }, cryptoApi), /路径冲突/);
});

test('reads an old single-file snapshot without changing the local workshop', async () => {
    const data = { rp_hub_settings: { model: 'test' }, rp_hub_chat_example: ['old chat'], future_app_key: 'kept' };
    const encrypted = await cryptoApi.encryptText(JSON.stringify(data), 'legacy-passphrase');
    const restored = await readSnapshot(async (path, { optional }) => path === FILES.legacy
        ? encrypted : (optional ? null : undefined), 'legacy-passphrase', cryptoApi);
    assert.deepEqual(restored.data, data);
    assert.equal(restored.workshopPresent, false);
    assert.deepEqual(restored.cardMap, {});
});

test('rejects unsafe database keys before creating an upload', async () => {
    await assert.rejects(() => createSnapshot({ '\u0000bad': 'value' }, {
        deviceId: 'device-example', passphrase: 'long-private-passphrase',
    }, cryptoApi), /状态键无效/);
});

test('does not treat a missing current shard as a legacy snapshot', async () => {
    const manifest = JSON.stringify({ version: 1, files: { [FILES.state]: 'hash' } });
    await assert.rejects(() => readSnapshot(async (path, { optional }) => path === 'rp-hub-sync/manifest.json'
        ? manifest : (optional ? null : undefined), 'legacy-passphrase', cryptoApi), /同步文件缺失/);
});
