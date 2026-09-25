const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const ENDPOINTS = new Set(['models', 'chat/completions', 'responses', 'embeddings']);
const RESPONSE_TYPES = new Set(['application/json', 'text/event-stream']);

const exactOrigins = text => new Set(String(text || '').split(',').map(value => value.trim()).filter(Boolean));

export function parseConfig(env) {
    const siteOrigins = exactOrigins(env.RPHUB_SITE_ORIGINS);
    const providerOrigins = exactOrigins(env.RPHUB_PROVIDER_ORIGINS);
    const token = String(env.RPHUB_GATEWAY_TOKEN || '');
    if (token.length < 32 || !siteOrigins.size || !providerOrigins.size) throw new Error('Gateway configuration is incomplete');
    for (const origin of [...siteOrigins, ...providerOrigins]) {
        const url = new URL(origin);
        if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
            throw new Error('Gateway origins must be exact HTTPS origins');
        }
    }
    return { siteOrigins, providerOrigins, token };
}

export function validateTarget(raw, providerOrigins) {
    if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Invalid target');
    const url = new URL(raw);
    const endpoint = url.pathname.match(/(?:^|\/)v1\/(models|chat\/completions|responses|embeddings)\/?$/)?.[1];
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !providerOrigins.has(url.origin)
        || !ENDPOINTS.has(endpoint) || url.search) {
        throw new Error('Target is not approved');
    }
    return url;
}

const readBody = async body => {
    if (!body) return new Uint8Array();
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REQUEST_BYTES) {
            await reader.cancel();
            const error = new Error('Request too large');
            error.status = 413;
            throw error;
        }
        chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
};

export function createHandler(fetchProvider = fetch) {
    return async (request, env) => {
        let config;
        try { config = parseConfig(env); }
        catch { return new Response('Gateway unavailable', { status: 503 }); }
        const origin = request.headers.get('Origin');
        if (!origin || !config.siteOrigins.has(origin)) return new Response(null, { status: 403 });
        const cors = {
            'Access-Control-Allow-Origin': origin,
            Vary: 'Origin',
            'Cache-Control': 'no-store',
        };
        const respond = (status, message = '') => new Response(message, { status, headers: cors });
        const route = new URL(request.url);
        if (route.pathname !== '/proxy' || route.search) return respond(404);
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    ...cors,
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-RPHub-Gateway-Token, X-RPHub-Target',
                    'Access-Control-Max-Age': '600',
                },
            });
        }
        if (!['GET', 'POST'].includes(request.method)) return respond(405);
        if (request.headers.get('X-RPHub-Gateway-Token') !== config.token) return respond(401);
        let target;
        try { target = validateTarget(request.headers.get('X-RPHub-Target'), config.providerOrigins); }
        catch { return respond(400, 'Invalid provider target'); }
        const authorization = request.headers.get('Authorization');
        if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) return respond(400, 'Provider authorization is required');
        if (request.method === 'GET' && target.pathname.split('/').pop() !== 'models') return respond(405);
        if (request.method === 'POST' && target.pathname.split('/').pop() === 'models') return respond(405);
        if (request.method === 'POST' && request.headers.get('Content-Type')?.split(';', 1)[0].toLowerCase() !== 'application/json') {
            return respond(415, 'JSON requests only');
        }
        try {
            const body = request.method === 'POST' ? await readBody(request.body) : undefined;
            const upstream = await fetchProvider(target, {
                method: request.method,
                headers: {
                    Authorization: authorization,
                    Accept: 'application/json, text/event-stream',
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                ...(body === undefined ? {} : { body }),
                redirect: 'manual',
                signal: request.signal,
            });
            if (upstream.status >= 300 && upstream.status < 400) return respond(502, 'Provider redirect refused');
            const contentType = upstream.headers.get('Content-Type') || '';
            if (!RESPONSE_TYPES.has(contentType.split(';', 1)[0].toLowerCase())) {
                return respond(502, 'Unsupported provider response');
            }
            return new Response(upstream.body, {
                status: upstream.status,
                headers: { ...cors, 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' },
            });
        } catch (error) {
            return respond(error.status === 413 ? 413 : 502, error.status === 413 ? 'Request too large' : 'Provider request failed');
        }
    };
}

export default { fetch: createHandler() };
