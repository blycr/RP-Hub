'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/api-utils.js'), 'utf8');
const token = 't'.repeat(40);

const makeClient = fetch => {
    const session = new Map();
    const window = {
        sessionStorage: {
            getItem: key => session.get(key) ?? null,
            setItem: (key, value) => session.set(key, value),
            removeItem: key => session.delete(key),
        },
        RPHubUtils: {
            extractApiErrorMessage: data => data?.error?.message || '',
            formatApiErrorMessage: status => `HTTP ${status}`,
            getApiUsagePayload: data => data?.usage || null,
        },
        RPHubCardUtils: {
            extractNativeReasoning: () => '',
            isNativeReasoningPart: () => false,
        },
    };
    vm.runInNewContext(source, { window, fetch, URL, Headers, AbortController, TextDecoder,
        setTimeout, clearTimeout, setInterval, clearInterval, console });
    return { client: window.RPHubApiClient, session };
};

test('routes only selected HTTPS model origins and preserves provider authorization', async () => {
    const requests = [];
    const { client, session } = makeClient(async (url, init) => {
        requests.push({ url, init });
        return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
    });
    const status = client.configureGateway({
        url: 'https://rphub-gateway-preview.qixmz.workers.dev/proxy',
        token, providerOrigins: 'https://api.example.com',
    });
    assert.equal(status.enabled, true);
    assert.equal('token' in status, false);
    assert.equal(session.size, 1);
    await client.requestJson({ url: 'https://api.example.com/v1/embeddings', apiKey: 'provider-key', body: { input: 'x' } });
    await client.requestJson({ url: 'https://direct.example.com/v1/models', apiKey: 'other-key' });
    assert.equal(requests[0].url, 'https://rphub-gateway-preview.qixmz.workers.dev/proxy');
    assert.equal(requests[0].init.headers.get('X-RPHub-Target'), 'https://api.example.com/v1/embeddings');
    assert.equal(requests[0].init.headers.get('X-RPHub-Gateway-Token'), token);
    assert.equal(requests[0].init.headers.get('Authorization'), 'Bearer provider-key');
    assert.equal(requests[1].url, 'https://direct.example.com/v1/models');
    assert.equal(requests[1].init.headers.Authorization, 'Bearer other-key');
    client.clearGatewayConfig();
    assert.equal(client.getGatewayStatus().enabled, false);
    assert.equal(session.size, 0);
});

test('rejects unsafe gateway configuration and unsupported proxied paths', async () => {
    const { client, session } = makeClient(async () => { throw new Error('must not fetch'); });
    for (const input of [
        { url: 'http://gateway.example/proxy', token, providerOrigins: 'https://api.example.com' },
        { url: 'https://gateway.example/proxy?key=x', token, providerOrigins: 'https://api.example.com' },
        { url: 'https://gateway.example/proxy', token: 'short', providerOrigins: 'https://api.example.com' },
        { url: 'https://gateway.example/proxy', token, providerOrigins: 'https://api.example.com/path' },
    ]) assert.throws(() => client.configureGateway(input));
    assert.equal(session.size, 0);
    client.configureGateway({ url: 'https://gateway.example/proxy', token,
        providerOrigins: 'https://api.example.com' });
    assert.throws(() => client.fetchModelApi('https://api.example.com/admin', {}), /模型端点/);
    assert.throws(() => client.fetchModelApi('https://api.example.com/v1/models?redirect=1', {}), /HTTPS 地址/);
});
