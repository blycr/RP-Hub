'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const builtinContentSrc = fs.readFileSync(path.join(rootDir, 'assets/js/built-in-content.js'), 'utf8');
const coreUtilsSrc = fs.readFileSync(path.join(rootDir, 'assets/js/core-utils.js'), 'utf8');
const dataServicesSrc = fs.readFileSync(path.join(rootDir, 'assets/js/data-services.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

function loadEnv() {
    const windowObj = {
        DOMPurify: { sanitize: (h) => String(h || '') },
        marked: { parse: (m) => String(m || '') },
    };
    const ctx = {
        window: windowObj,
        console,
        URL,
        Date,
        Math,
        JSON,
        Object,
        Array,
        Set,
        Map,
        RegExp,
        String,
        Number,
        Boolean,
        Error,
        encodeURIComponent,
        TextDecoder,
        TextEncoder,
        Uint8Array,
        ArrayBuffer,
        DataView,
        btoa,
        atob,
    };
    vm.createContext(ctx);
    vm.runInContext(builtinContentSrc, ctx);
    vm.runInContext(coreUtilsSrc, ctx);
    vm.runInContext(dataServicesSrc, ctx);
    return {
        cu: windowObj.RPHubContextUtils,
        prompts: windowObj.RPHubBuiltinContent.prompts,
        presets: windowObj.RPHubBuiltinPresets,
    };
}

test('buildProximalFormatAnchor activates on long sessions or high budget without bloating early turns', () => {
    const { cu, prompts } = loadEnv();
    const character = { name: '东北大炕的故事', formatAnchor: '严格保持选项前使用 ▶ 符号' };
    const regexScripts = [
        { name: '隐藏阶段锚点标签', scope: 'character', enabled: true, promptOnly: false },
        { name: '对话台词微高光', scope: 'character', enabled: true, promptOnly: false },
        { name: '已停用正则', scope: 'character', enabled: false, promptOnly: false },
        { name: '全局正则', scope: 'global', enabled: true, promptOnly: false },
    ];

    // Short session inside normal budget -> silent (no bloat)
    const early = cu.buildProximalFormatAnchor({
        character,
        regexScripts,
        activeUiTemplates: [{ id: 't1' }],
        turnCount: 3,
        budgetLevel: 'normal',
        uiTemplateMainModelAnalysis: true,
    });
    assert.equal(early, '');

    // Long session (>= 8 turns) -> compact <format_anchor> with character regexes + UI reminder + custom anchor
    const late = cu.buildProximalFormatAnchor({
        character,
        regexScripts,
        activeUiTemplates: [{ id: 't1' }],
        turnCount: 12,
        budgetLevel: 'normal',
        uiTemplateMainModelAnalysis: true,
    });
    assert.match(late, /^<format_anchor>/);
    assert.match(late, /隐藏阶段锚点标签/);
    assert.match(late, /对话台词微高光/);
    assert.doesNotMatch(late, /已停用正则|全局正则/);
    assert.match(late, /<ui_template_updates>/);
    assert.match(late, /严格保持选项前使用 ▶ 符号/);

    // buildNextResponsePrompt embeds formatAnchor cleanly inside <next_response>
    const nextPrompt = prompts.buildNextResponsePrompt({ formatAnchor: late });
    assert.match(nextPrompt, /<format_anchor>[\s\S]*<\/format_anchor>/);
});

test('computeEffectiveSummaryKeepFloors preserves full window inside sweet spot and tightens above it with 6-floor floor', () => {
    const { cu } = loadEnv();
    const budget = cu.resolveModelContextBudget({ providerId: 'p1', modelId: 'deepseek-v4' }); // 1M / 300k sweet spot -> 195k rawBudget

    // Moderate messages (20 floors * ~500 tokens = ~10k << 195k) -> keeps full configured 20 floors
    const normalMsgs = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '这是一段正常长度的剧情描写。'.repeat(40),
    }));
    assert.equal(
        cu.computeEffectiveSummaryKeepFloors({ messages: normalMsgs, configuredKeepFloors: 20, budget }),
        20,
    );

    // Extremely long messages (each ~30k tokens) -> smoothly tightens down while NEVER dropping below MIN_PROTECTED_RAW_FLOORS (6)
    const hugeMsgs = Array.from({ length: 24 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '超长剧情正文细节记录。'.repeat(4500),
    }));
    const tightened = cu.computeEffectiveSummaryKeepFloors({ messages: hugeMsgs, configuredKeepFloors: 20, budget });
    assert.ok(tightened >= cu.MIN_PROTECTED_RAW_FLOORS, `expected >= 6, got ${tightened}`);
    assert.ok(tightened < 20, `expected tightened < 20, got ${tightened}`);
});

test('enforceHardCapOnMessages protects prefix and recent tail while trimming oldest middle history only past hardCap', () => {
    const { cu } = loadEnv();
    const smallBudget = cu.resolveModelContextBudget({
        providerId: 'p1',
        modelId: 'test-model',
        overrides: { 'p1::test-model': { hardLimit: 20000, sweetSpotTokens: 6000 } },
    }); // hardCapTokens = 12000

    const prefix = [
        { role: 'system', content: '系统设定与核心规则' },
        { role: 'user', content: '[Character] 核心角色设定' },
    ];
    const middle = Array.from({ length: 16 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `中段第${i}条历史：` + '剧情内容描写。'.repeat(300),
    }));
    const tail = Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `最新第${i}条回复`,
    }));

    const res = cu.enforceHardCapOnMessages({
        messages: [...prefix, ...middle, ...tail],
        safePrefixCount: 2,
        budget: smallBudget,
    });
    assert.ok(res.trimmedCount > 0, 'should trim oldest middle messages past hardCap');
    assert.equal(res.messages[0].content, prefix[0].content);
    assert.equal(res.messages[1].content, prefix[1].content);
    assert.match(res.messages[2].content, /上下文红线保护/);
    // All 6 protected tail messages remain intact at the end
    assert.deepEqual(
        Array.from(res.messages.slice(-6), (m) => m.content),
        tail.map((m) => m.content),
    );
});

test('probeModelContextAndTokenizer tries multi-protocol zero-cost endpoints and falls back cleanly', async () => {
    const { cu } = loadEnv();
    const buildApiEndpoint = (base, suffix) => `${base.replace(/\/+$/, '')}/v1/${suffix}`;

    // Case 1: Responses API /responses/input_tokens succeeds + GET /models/{id} returns context_length
    const res1 = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'deepseek-v4',
        buildApiEndpoint,
        requestJson: async ({ url }) => {
            if (url.endsWith('/v1/models/deepseek-v4')) return { id: 'deepseek-v4', context_length: 1000000 };
            if (url.endsWith('/v1/responses/input_tokens')) return { input_tokens: 185 };
            throw new Error('404');
        },
    });
    assert.equal(res1.contextLimit, 1000000);
    assert.equal(res1.probeMode, 'responses_input_tokens');
    assert.equal(res1.calibratedInputTokens, 185);

    // Case 2: Responses fails -> falls back to Anthropic /messages/count_tokens
    const res2 = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'claude-4-sonnet',
        buildApiEndpoint,
        requestJson: async ({ url }) => {
            if (url.endsWith('/v1/messages/count_tokens')) return { input_tokens: 192 };
            throw new Error('404');
        },
    });
    assert.equal(res2.probeMode, 'anthropic_count_tokens');
    assert.equal(res2.calibratedInputTokens, 192);

    // Case 3: Responses + Anthropic fail -> falls back to Gemini :countTokens
    const res3 = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'gemini-2.5-pro',
        buildApiEndpoint,
        requestJson: async ({ url }) => {
            if (url.endsWith(':countTokens')) return { totalTokens: 170 };
            throw new Error('404');
        },
    });
    assert.equal(res3.probeMode, 'gemini_count_tokens');
    assert.equal(res3.calibratedInputTokens, 170);

    // Case 4: Standard relay supports none -> clean passive_usage fallback without throwing
    const res4 = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'generic-chat',
        buildApiEndpoint,
        requestJson: async () => { throw new Error('404 Not Found'); },
    });
    assert.equal(res4.probeMode, 'passive_usage');
    assert.equal(res4.calibratedInputTokens, null);
    assert.equal(res4.tried.length, 4);
});

test('structured dual-track memory prompts and Phase 2B UI/app hooks are wired cleanly', () => {
    const { prompts } = loadEnv();
    const classicPrompt = prompts.buildClassicSummarySystemPrompt({ userName: '小宝', characterName: '素兰' });
    const secondaryPrompt = prompts.buildClassicSecondarySummaryPrompt({ userName: '小宝', characterName: '素兰', startTurn: 1, endTurn: 5 });
    assert.match(classicPrompt, /【硬事实】/);
    assert.match(classicPrompt, /【剧情】/);
    assert.match(secondaryPrompt, /【硬事实】/);
    assert.match(secondaryPrompt, /【剧情】/);

    assert.match(appSrc, /const effectiveKeepFloors = computeEffectiveSummaryKeepFloors\(/);
    assert.match(appSrc, /const proximalFormatAnchor = buildProximalFormatAnchor\(/);
    assert.match(appSrc, /const hardCapResult = enforceHardCapOnMessages\(/);
    assert.match(appSrc, /splitDynamicState:\s*true/);
    assert.match(appSrc, /appendUiTemplateStateTailBlock\(messages,\s*buildUiTemplateDynamicTailBlock\(\)\)/);
    assert.match(appSrc, /syncBuiltinPreset\(BUILTIN_PRESETS\.strictFormatGuard\)/);
    assert.match(indexHtml, /probeCurrentModelContext/);
    assert.match(indexHtml, /探测上限\/协议/);
    assert.match(indexHtml, /probeCurrentModelContext\(\{\s*force:\s*true\s*\}\)/);
});

test('enforceHardCapOnMessages applies 100%->85% hysteresis batch trimming and reuses monotonic anchor cleanly', () => {
    const { cu } = loadEnv();
    const budget = cu.resolveModelContextBudget({
        providerId: 'p1',
        modelId: 'test-hysteresis',
        overrides: { 'p1::test-hysteresis': { hardLimit: 20000, sweetSpotTokens: 6000 } },
    }); // hardCapTokens = 12000, 85% target = 10200

    const prefix = [
        { role: 'system', content: '系统设定与核心规则' },
        { role: 'user', content: '[Character] 核心角色设定' },
    ];
    const makeHistory = (count) => Array.from({ length: count }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        _contextFloor: i + 1,
        content: `第${i + 1}楼：` + '剧情正文记录内容。'.repeat(110),
    }));

    // Exceeds 12000 -> drops all the way down to <= 10200 (85% hysteresis target)
    const turn1History = makeHistory(20);
    const res1 = cu.enforceHardCapOnMessages({
        messages: [...prefix, ...turn1History],
        safePrefixCount: 2,
        budget,
    });
    assert.equal(res1.advancedBatch, true);
    assert.ok(res1.trimmedCount > 0);
    assert.ok(res1.nextCutAnchorFloor > 0);
    assert.ok(res1.estimatedTokens <= Math.round(budget.hardCapTokens * 0.85) + 120,
        `expected hysteresis trim <= 85% target (+notice), got ${res1.estimatedTokens}`);
    assert.match(res1.messages[2].content, new RegExp(`截至第 ${res1.nextCutAnchorFloor} 楼`));

    // Next turn appends 2 new messages while still inside the 15% buffer -> reuses exact same anchor floor & notice text!
    const turn2History = makeHistory(22);
    const res2 = cu.enforceHardCapOnMessages({
        messages: [...prefix, ...turn2History],
        safePrefixCount: 2,
        budget,
        previousCutAnchorFloor: res1.nextCutAnchorFloor,
    });
    assert.equal(res2.advancedBatch, false, 'should reuse anchor without advancing batch inside 15% buffer');
    assert.equal(res2.nextCutAnchorFloor, res1.nextCutAnchorFloor);
    assert.equal(res2.messages[2].content, res1.messages[2].content, 'notice text must stay byte-identical for KV cache');
    assert.equal(res2.messages[3].content, res1.messages[3].content, 'first retained history message must stay identical');
});

test('probeModelContextAndTokenizer enforces 24h cooldown, remembered endpoint direct probe, force override, gateway guard, and empty sessionId', async () => {
    const { cu } = loadEnv();
    const buildApiEndpoint = (base, suffix) => `${base.replace(/\/+$/, '')}/v1/${suffix}`;
    const now = 1_700_000_000_000;

    // 1. 24h passive_usage cooldown -> 0 network requests
    let calls = 0;
    const skipped = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'deepseek-v4',
        previousProbeMode: 'passive_usage',
        lastProbedAt: now - 3600_000,
        now,
        buildApiEndpoint,
        requestJson: async () => { calls++; return {}; },
    });
    assert.equal(skipped.skipped, true);
    assert.equal(skipped.skipReason, 'cooldown_passive');
    assert.equal(calls, 0);

    // 2. 24h remembered working protocol + known context limit -> only 1 direct request, empty sessionId
    const seen = [];
    const direct = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'deepseek-v4',
        previousProbeMode: 'responses_input_tokens',
        lastProbedAt: now - 3600_000,
        knownContextLimit: 1000000,
        now,
        buildApiEndpoint,
        requestJson: async (opts) => {
            seen.push(opts);
            return { input_tokens: 180 };
        },
    });
    assert.equal(direct.skipped, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].sessionId, '');
    assert.match(seen[0].url, /\/responses\/input_tokens$/);
    assert.equal(direct.calibratedInputTokens, 180);

    // 3. Protocol/model hint puts Anthropic first on first probe (hits on attempt #1 after skipping known models_detail)
    const anthSeen = [];
    const anth = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://api.anthropic.example.com',
        apiKey: 'sk-test',
        modelId: 'claude-4-sonnet',
        knownContextLimit: 200000,
        now,
        buildApiEndpoint,
        requestJson: async (opts) => {
            anthSeen.push(opts.url);
            if (opts.url.endsWith('/messages/count_tokens')) return { input_tokens: 190 };
            throw new Error('should not hit other endpoints');
        },
    });
    assert.equal(anth.probeMode, 'anthropic_count_tokens');
    assert.equal(anthSeen.length, 1);

    // 4. force: true bypasses 24h cooldown
    let forcedCalls = 0;
    const forced = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'deepseek-v4',
        previousProbeMode: 'passive_usage',
        lastProbedAt: now - 1000,
        force: true,
        now,
        buildApiEndpoint,
        requestJson: async () => { forcedCalls++; throw new Error('404'); },
    });
    assert.equal(forced.skipped, false);
    assert.equal(forcedCalls, 4);

    // 5. Gateway whitelist active -> 0 network requests
    let gwCalls = 0;
    const gw = await cu.probeModelContextAndTokenizer({
        baseUrl: 'https://relay.example.com',
        apiKey: 'sk-test',
        modelId: 'deepseek-v4',
        gatewayActive: true,
        now,
        buildApiEndpoint,
        requestJson: async () => { gwCalls++; return {}; },
    });
    assert.equal(gw.skipped, true);
    assert.equal(gw.skipReason, 'gateway_whitelist');
    assert.equal(gwCalls, 0);
});

test('UI template static/dynamic split keeps messages[0] byte-identical across turns and registers default-off strictFormatGuard preset', () => {
    const { prompts, presets } = loadEnv();
    const turn1Static = prompts.buildMainModelUiTemplatePrompt({
        userName: '测试用户',
        splitDynamicState: true,
        templatePayload: [{
            id: 'tpl-status',
            name: '状态栏',
            initialVariables: { day: 1, hp: 100, mood: '平静' },
            currentVariables: { day: 1, hp: 100, mood: '平静' },
            variableSchema: 'day: 天数; hp: 体力; mood: 心情',
        }],
    });
    const turn2Static = prompts.buildMainModelUiTemplatePrompt({
        userName: '测试用户',
        splitDynamicState: true,
        templatePayload: [{
            id: 'tpl-status',
            name: '状态栏',
            initialVariables: { day: 1, hp: 100, mood: '平静' },
            currentVariables: { day: 9, hp: 42, mood: '警惕' },
            variableSchema: 'day: 天数; hp: 体力; mood: 心情',
        }],
    });
    assert.equal(turn1Static, turn2Static, 'static messages[0] prompt must stay byte-identical when variables change');
    assert.match(turn1Static, /<ui_template_state_context>/);
    assert.match(turn1Static, /绝非用户发言/);
    assert.doesNotMatch(turn2Static, /警惕/);

    const tailBlock = prompts.buildUiTemplateStateTailBlock({
        templates: [{
            id: 'tpl-status',
            name: '状态栏',
            currentVariables: { day: 9, hp: 42, mood: '警惕' },
        }],
    });
    assert.match(tailBlock, /^<ui_template_state_context>/);
    assert.match(tailBlock, /id="tpl-status"/);
    assert.match(tailBlock, /"mood": "警惕"/);
    assert.match(tailBlock, /非用户发言/);

    assert.ok(presets.managedPresets.strictFormatGuard, 'strictFormatGuard preset should be defined');
    assert.equal(presets.managedPresets.strictFormatGuard.name, '严格格式守卫');
    assert.equal(presets.managedPresets.strictFormatGuard.enabled, false, 'strictFormatGuard must default to OFF');
    assert.doesNotMatch(presets.managedPresets.strictFormatGuard.content, /必须输出\s*<ui_template_updates>/);
});
