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
    assert.equal(requests[1].init.headers.get('Authorization'), 'Bearer other-key');
    client.clearGatewayConfig();
    assert.equal(client.getGatewayStatus().enabled, false);
    assert.equal(session.size, 0);
});

test('adds OpenCode Go headers only to the Go API and keeps sessions stable', async () => {
    const requests = [];
    const { client } = makeClient(async (url, init) => {
        requests.push({ url: String(url), init });
        if (String(url).endsWith('/models')) return new Response('{"data":[]}', { headers: { 'Content-Type': 'application/json' } });
        return new Response('{"choices":[{"message":{"content":"ok"}}]}', { headers: { 'Content-Type': 'application/json' } });
    });
    const sessionId = 'character-uuid__branch__branch-uuid';
    await client.requestChatCompletion({
        url: 'https://opencode.ai/inference/go/openai/v1/chat/completions',
        apiKey: 'key', model: 'go-model', sessionId,
        messages: [{ role: 'user', content: 'hello' }],
    });
    await client.requestJson({
        url: 'https://opencode.ai/inference/go/v1/models', apiKey: 'key', sessionId,
    });
    await client.requestJson({ url: 'https://example.test/v1/models', apiKey: 'key', sessionId });
    assert.match(requests[0].init.headers.get('x-opencode-session'), /^ses_rphub_[0-9a-f]{8}_[0-9a-f]+$/);
    assert.match(requests[1].init.headers.get('x-opencode-session'), /^ses_rphub_[0-9a-f]{8}_[0-9a-f]+$/);
    assert.equal(requests[0].init.headers.get('x-opencode-session'), requests[1].init.headers.get('x-opencode-session'));
    assert.equal(requests[2].init.headers.has('x-opencode-session'), false);
    assert.equal(requests[1].url, 'https://opencode.ai/inference/go/v1/models');
});

test('adds the OpenCode Go session header to Responses requests', async () => {
    const requests = [];
    const { client } = makeClient(async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response('{"output":[{"type":"message","content":[{"type":"output_text","text":"ok"}]}],"usage":{}}', {
            headers: { 'Content-Type': 'application/json' },
        });
    });
    await client.requestChatCompletion({
        url: 'https://opencode.ai/inference/go/openai/v1/responses',
        protocol: 'openai-responses', apiKey: 'key', model: 'go-model',
        sessionId: 'character__branch__branch', messages: [{ role: 'user', content: 'hello' }],
    });
    assert.match(requests[0].init.headers.get('x-opencode-session'), /^ses_rphub_[0-9a-f]{8}_[0-9a-f]+$/);
    assert.equal(JSON.parse(requests[0].init.body).input[0].content, 'hello');
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
