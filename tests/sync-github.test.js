'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeClient } = require('../assets/js/rphub-sync-github');

const json = value => new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
});

test('reads a UTF-8 snapshot through the authenticated GitHub contents API', async () => {
    const calls = [];
    const client = makeClient({
        owner: 'blycr', repo: 'RP-Hub-Sync', token: 'test-token',
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            return json({ content: Buffer.from('{"name":"角色"}').toString('base64') });
        },
    });
    assert.equal(await client.readText('rp-hub-sync/state.enc.json'), '{"name":"角色"}');
    assert.match(calls[0].url, /\/contents\/rp-hub-sync\/state\.enc\.json\?ref=main$/);
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
    assert.equal(calls[0].init.cache, 'no-store');
});

test('limits writes to sync data and creates one non-force commit', async () => {
    const calls = [];
    const replies = [
        { object: { sha: 'parent' } },
        { tree: { sha: 'parent-tree' } },
        { sha: 'blob' },
        { sha: 'tree' },
        { sha: 'commit' },
        { object: { sha: 'commit' } },
    ];
    const client = makeClient({
        owner: 'blycr', repo: 'RP-Hub-Sync', token: 'test-token',
        fetchImpl: async (url, init) => {
            calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
            return json(replies.shift());
        },
    });
    await assert.rejects(() => client.pushAtomic([{ path: 'assets/js/app.js', base64: 'YQ==' }], [], 'bad'));
    await assert.rejects(() => client.pushAtomic([], ['rp-hub-sync/../README.md'], 'bad'));
    assert.equal(calls.length, 0);
    assert.equal(await client.pushAtomic([
        { path: 'rp-hub-sync/state.enc.json', base64: 'YQ==' },
    ], ['rp-hub-sync/chats/old.enc.json'], 'sync'), 'commit');
    assert.deepEqual(calls.map(call => call.method), ['GET', 'GET', 'POST', 'POST', 'POST', 'PATCH']);
    assert.deepEqual(calls[3].body.tree.map(entry => [entry.path, entry.sha]), [
        ['rp-hub-sync/state.enc.json', 'blob'],
        ['rp-hub-sync/chats/old.enc.json', null],
    ]);
    assert.equal(calls[5].body.force, false);
});
