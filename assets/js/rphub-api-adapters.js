/**
 * 作用：为 RP-Hub 提供统一的聊天与向量 API 协议适配器。
 *
 * 本文件是浏览器运行时规范源，由 reapply-multi-provider-patch.js 复制到目标仓库的
 * assets/js/rphub-api-adapters.js，并由 index.html 在 app.js 前加载。当前支持 OpenAI
 * Chat Completions、OpenAI Responses 和 OpenAI Embeddings；同时导出 CommonJS 接口，
 * 供 Node 测试直接验证请求、普通响应和 SSE 事件解析。
 *
 * 本文件不单独执行。协调用法：node scripts/reapply-multi-provider-patch.js [RP-Hub 根目录]
 */

(function initializeRPHubApiAdapters(root, factory) {
    const adapters = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = adapters;
    if (root) root.RPHubApiAdapters = adapters;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRPHubApiAdapters() {
    'use strict';

    const CHAT_PROTOCOL_OPENAI_CHAT = 'openai-chat-completions';
    const CHAT_PROTOCOL_OPENAI_RESPONSES = 'openai-responses';
    const EMBEDDING_PROTOCOL_OPENAI = 'openai-embeddings';
    const EMBEDDING_PROTOCOL_NONE = 'none';

    const normalizeBaseUrl = (value) => String(value || '').replace(/\s+/g, '').replace(/\/+$/, '');

    const buildOpenAIUrl = (baseUrl, endpoint) => {
        const normalizedBase = normalizeBaseUrl(baseUrl);
        if (!normalizedBase) throw new Error('API 地址不能为空');
        const versionedBase = normalizedBase.endsWith('/v1') ? normalizedBase : `${normalizedBase}/v1`;
        return `${versionedBase}/${String(endpoint || '').replace(/^\/+/, '')}`;
    };

    const buildBearerHeaders = (apiKey) => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${String(apiKey || '').trim()}`,
    });

    const readContent = (value) => {
        if (typeof value === 'string') return value;
        if (!Array.isArray(value)) return '';
        return value.map(item => {
            if (typeof item === 'string') return item;
            if (!item || typeof item !== 'object') return '';
            return item.text || item.content || item.output_text || '';
        }).join('');
    };

    const readReasoning = (value) => {
        if (typeof value === 'string') return value;
        if (!Array.isArray(value)) return '';
        return value.map(item => (
            typeof item === 'string' ? item : (item?.text || item?.content || '')
        )).join('');
    };

    const extractErrorMessage = (payload) => {
        if (!payload || typeof payload !== 'object') return '';
        const error = payload.error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            return String(error.message || error.detail || error.type || 'API 请求失败');
        }
        return String(payload.message || payload.detail || '');
    };

    const normalizeMessagesForResponses = (messages) => (Array.isArray(messages) ? messages : [])
        .map(message => ({
            role: message?.role,
            content: typeof message?.content === 'string' ? message.content : readContent(message?.content),
        }))
        .filter(message => message.role && message.content);

    const buildChatRequest = ({
        protocol = CHAT_PROTOCOL_OPENAI_CHAT,
        baseUrl,
        apiKey,
        model,
        messages,
        temperature,
        stream = false,
        signal,
    }) => {
        const commonInit = {
            method: 'POST',
            headers: buildBearerHeaders(apiKey),
            signal,
        };

        if (protocol === CHAT_PROTOCOL_OPENAI_CHAT) {
            const body = {
                model,
                messages: Array.isArray(messages) ? messages : [],
                stream: Boolean(stream),
            };
            if (Number.isFinite(Number(temperature))) body.temperature = Number(temperature);
            if (stream) body.stream_options = { include_usage: true };
            return {
                protocol,
                url: buildOpenAIUrl(baseUrl, 'chat/completions'),
                init: { ...commonInit, body: JSON.stringify(body) },
            };
        }

        if (protocol === CHAT_PROTOCOL_OPENAI_RESPONSES) {
            const body = {
                model,
                input: normalizeMessagesForResponses(messages),
                stream: Boolean(stream),
                store: false,
            };
            if (Number.isFinite(Number(temperature))) body.temperature = Number(temperature);
            return {
                protocol,
                url: buildOpenAIUrl(baseUrl, 'responses'),
                init: { ...commonInit, body: JSON.stringify(body) },
            };
        }

        throw new Error(`不支持的聊天调用方式：${protocol}`);
    };

    const parseChatCompletionResponse = (payload) => {
        const error = extractErrorMessage(payload);
        if (error) throw new Error(error);
        const choice = payload?.choices?.[0] || {};
        const message = choice.message || choice.delta || {};
        return {
            text: readContent(message.content || choice.text),
            reasoning: readReasoning(
                message.reasoning_content
                || message.reasoning
                || message.reasoning_details
                || choice.reasoning_content
                || choice.reasoning
            ),
            usage: payload?.usage || null,
        };
    };

    const parseResponsesResponse = (payload) => {
        const error = extractErrorMessage(payload);
        if (error) throw new Error(error);
        let text = typeof payload?.output_text === 'string' ? payload.output_text : '';
        let reasoning = '';
        (Array.isArray(payload?.output) ? payload.output : []).forEach(item => {
            if (item?.type === 'message' && !text) {
                text += readContent(item.content);
            } else if (item?.type === 'reasoning') {
                reasoning += readReasoning(item.summary || item.content);
            }
        });
        return { text, reasoning, usage: payload?.usage || null };
    };

    const parseChatResponse = (protocol, payload) => {
        if (protocol === CHAT_PROTOCOL_OPENAI_CHAT) return parseChatCompletionResponse(payload);
        if (protocol === CHAT_PROTOCOL_OPENAI_RESPONSES) return parseResponsesResponse(payload);
        throw new Error(`不支持的聊天调用方式：${protocol}`);
    };

    const emptyStreamEvent = () => ({
        textDelta: '',
        reasoningDelta: '',
        usage: null,
        done: false,
        error: '',
    });

    const parseChatCompletionStreamEvent = (payload) => {
        const event = emptyStreamEvent();
        if (payload === '[DONE]') return { ...event, done: true };
        const error = extractErrorMessage(payload);
        if (error) return { ...event, error };
        const choice = payload?.choices?.[0];
        const delta = choice?.delta || choice?.message || {};
        event.textDelta = readContent(delta.content || choice?.text);
        event.reasoningDelta = readReasoning(
            delta.reasoning_content
            || delta.reasoning
            || delta.reasoning_details
            || choice?.reasoning_content
            || choice?.reasoning
        );
        event.usage = payload?.usage || null;
        event.done = Boolean(choice?.finish_reason);
        return event;
    };

    const parseResponsesStreamEvent = (payload) => {
        const event = emptyStreamEvent();
        const error = extractErrorMessage(payload);
        if (error) return { ...event, error };
        switch (payload?.type) {
            case 'response.output_text.delta':
                event.textDelta = String(payload.delta || '');
                break;
            case 'response.reasoning_summary_text.delta':
            case 'response.reasoning_text.delta':
                event.reasoningDelta = String(payload.delta || '');
                break;
            case 'response.completed':
                event.usage = payload.response?.usage || payload.usage || null;
                event.done = true;
                break;
            case 'response.failed':
            case 'error':
                event.error = extractErrorMessage(payload.response || payload) || 'Responses API 请求失败';
                event.done = true;
                break;
            default:
                break;
        }
        return event;
    };

    const parseChatStreamEvent = (protocol, payload) => {
        if (protocol === CHAT_PROTOCOL_OPENAI_CHAT) return parseChatCompletionStreamEvent(payload);
        if (protocol === CHAT_PROTOCOL_OPENAI_RESPONSES) return parseResponsesStreamEvent(payload);
        throw new Error(`不支持的聊天调用方式：${protocol}`);
    };

    const parseSseText = (protocol, rawText) => {
        const result = { text: '', reasoning: '', usage: null };
        String(rawText || '').split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) return;
            const dataText = trimmed.replace(/^data:\s*/, '');
            if (!dataText) return;
            let payload = dataText;
            if (dataText !== '[DONE]') {
                try {
                    payload = JSON.parse(dataText);
                } catch (_) {
                    return;
                }
            }
            const event = parseChatStreamEvent(protocol, payload);
            if (event.error) throw new Error(event.error);
            result.text += event.textDelta;
            result.reasoning += event.reasoningDelta;
            result.usage = event.usage || result.usage;
        });
        return result;
    };

    const parseChatText = (protocol, rawText) => {
        try {
            return parseChatResponse(protocol, JSON.parse(String(rawText || '')));
        } catch (error) {
            if (error?.name !== 'SyntaxError') throw error;
            return parseSseText(protocol, rawText);
        }
    };

    const buildModelListRequest = ({ baseUrl, apiKey, signal }) => ({
        url: buildOpenAIUrl(baseUrl, 'models'),
        init: {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${String(apiKey || '').trim()}` },
            signal,
        },
    });

    const parseModelList = (payload) => {
        const error = extractErrorMessage(payload);
        if (error) throw new Error(error);
        return (Array.isArray(payload?.data) ? payload.data : [])
            .filter(model => model && typeof model.id === 'string');
    };

    const buildEmbeddingRequest = ({ baseUrl, apiKey, model, inputs, signal }) => {
        const normalizedInputs = (Array.isArray(inputs) ? inputs : [inputs]).map(value => String(value || '').trim());
        if (normalizedInputs.length === 0 || normalizedInputs.some(value => !value)) {
            throw new Error('嵌入内容不能为空');
        }
        return {
            url: buildOpenAIUrl(baseUrl, 'embeddings'),
            init: {
                method: 'POST',
                headers: buildBearerHeaders(apiKey),
                body: JSON.stringify({
                    model,
                    input: normalizedInputs.length === 1 ? normalizedInputs[0] : normalizedInputs,
                }),
                signal,
            },
            expectedCount: normalizedInputs.length,
        };
    };

    const parseEmbeddingResponse = (payload, expectedCount) => {
        const error = extractErrorMessage(payload);
        if (error) throw new Error(error);
        const rows = Array.isArray(payload?.data) ? [...payload.data] : [];
        rows.sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));
        const vectors = rows.map(row => (
            Array.isArray(row?.embedding) ? row.embedding.map(Number) : []
        ));
        if (vectors.length !== expectedCount
            || vectors.some(vector => vector.length === 0 || vector.some(value => !Number.isFinite(value)))) {
            throw new Error('嵌入接口返回的数据不完整');
        }
        return { vectors, usage: payload?.usage || null };
    };

    return {
        CHAT_PROTOCOL_OPENAI_CHAT,
        CHAT_PROTOCOL_OPENAI_RESPONSES,
        EMBEDDING_PROTOCOL_OPENAI,
        EMBEDDING_PROTOCOL_NONE,
        normalizeBaseUrl,
        buildOpenAIUrl,
        buildChatRequest,
        parseChatResponse,
        parseChatStreamEvent,
        parseChatText,
        buildModelListRequest,
        parseModelList,
        buildEmbeddingRequest,
        parseEmbeddingResponse,
    };
});
