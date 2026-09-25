import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, parseConfig, validateTarget } from './worker.mjs';

const site = 'https://rp.blycr.xyz';
const provider = 'https://api.example.com';
const token = 't'.repeat(40);
const env = {
    RPHUB_SITE_ORIGINS: site,
    RPHUB_PROVIDER_ORIGINS: provider,
    RPHUB_GATEWAY_TOKEN: token,
};
const headers = (target = `${provider}/v1/chat/completions`) => ({
    Origin: site,
    Authorization: 'Bearer provider-key',
    'Content-Type': 'application/json',
    'X-RPHub-Gateway-Token': token,
    'X-RPHub-Target': target,
});
const call = (handler, init = {}) => handler(new Request('https://gateway.example/proxy', {
    method: init.method || 'POST',
    headers: init.headers || headers(),
    ...(init.method === 'GET' || init.method === 'OPTIONS' ? {} : { body: init.body || '{}' }),
}), env);

test('requires exact HTTPS site and provider origins', () => {
    assert.equal(validateTarget(`${provider}/v1/responses`, parseConfig(env).providerOrigins).origin, provider);
    for (const target of ['http://api.example.com/v1/models', 'https://127.0.0.1/v1/models',
        `${provider}/admin`, `${provider}/v1/models#x`, `${provider}/v1/models?redirect=1`,
        'https://api.example.com@evil.example/v1/models']) {
        assert.throws(() => validateTarget(target, parseConfig(env).providerOrigins));
    }
});

test('rejects unauthorized and unapproved requests before contacting a provider', async () => {
    let calls = 0;
    const handler = createHandler(async () => { calls++; throw new Error('must not fetch'); });
    assert.equal((await call(handler, { headers: { ...headers(), Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await call(handler, { headers: { ...headers(), 'X-RPHub-Gateway-Token': 'wrong' } })).status, 401);
    assert.equal((await call(handler, { headers: headers('https://evil.example/v1/responses') })).status, 400);
    assert.equal(calls, 0);
});

test('answers browser preflight only for an approved site origin', async () => {
    const handler = createHandler(async () => { throw new Error('preflight must not reach provider'); });
    const request = origin => new Request('https://gateway.example/proxy', {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization,content-type,x-rphub-gateway-token,x-rphub-target' },
    });
    const allowed = await handler(request(site), env);
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), site);
    assert.match(allowed.headers.get('Access-Control-Allow-Headers'), /X-RPHub-Target/);
    const denied = await handler(request('https://evil.example'), env);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('streams provider SSE while retaining only safe response headers', async () => {
    let received;
    const handler = createHandler(async (url, init) => {
        received = { url: String(url), method: init.method, key: init.headers.Authorization,
            body: new TextDecoder().decode(init.body) };
        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"delta":"a"}\n\n'));
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
            },
        }), { headers: { 'Content-Type': 'text/event-stream', 'Set-Cookie': 'should-not-pass=1' } });
    });
    const response = await call(handler, { body: '{"model":"m"}' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), site);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.match(await response.text(), /\[DONE\]/);
    assert.deepEqual(received, { url: `${provider}/v1/chat/completions`, method: 'POST',
        key: 'Bearer provider-key', body: '{"model":"m"}' });
});

test('refuses redirects and oversized bodies', async () => {
    const redirect = createHandler(async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }));
    assert.equal((await call(redirect, { method: 'GET', headers: headers(`${provider}/v1/models`) })).status, 502);
    const large = createHandler(async () => { throw new Error('must not fetch'); });
    assert.equal((await call(large, { body: 'x'.repeat(5 * 1024 * 1024 + 1) })).status, 413);
});
