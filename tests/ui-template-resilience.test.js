'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const coreUtilsSrc = fs.readFileSync(path.join(rootDir, 'assets/js/core-utils.js'), 'utf8');
const dataServicesSrc = fs.readFileSync(path.join(rootDir, 'assets/js/data-services.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

function extractSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

function loadUiTemplateUtils() {
    const windowObj = {
        RPHubBuiltinContent: { prompts: {}, imageStyleArtists: { vertical: '' } },
        DOMPurify: { sanitize: (h) => String(h || '') },
        marked: { parse: (m) => String(m || '') },
    };
    const mockDocument = {
        createElement(tag) {
            const children = [];
            return {
                tagName: tag.toUpperCase(),
                className: '',
                style: {},
                srcdoc: '',
                setAttribute() {},
                appendChild(child) { children.push(child); return child; },
                get outerHTML() {
                    if (tag === 'iframe') return `<iframe srcdoc="${this.srcdoc}"></iframe>`;
                    return `<${tag} class="${this.className}">${children.map((c) => c.outerHTML).join('')}</${tag}>`;
                },
            };
        },
    };
    const ctx = {
        window: windowObj,
        document: mockDocument,
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
        SyntaxError,
        TextDecoder,
        TextEncoder,
        Uint8Array,
        ArrayBuffer,
        DataView,
        btoa,
        atob,
    };
    vm.createContext(ctx);
    vm.runInContext(coreUtilsSrc, ctx);
    vm.runInContext(dataServicesSrc, ctx);
    return windowObj.RPHubUiTemplateUtils;
}

test('parseUiTemplateUpdates repairs trailing commas, comments, chatter, raw newlines, and truncated JSON', () => {
    const uiUtils = loadUiTemplateUtils();
    const tpl = uiUtils.normalizeUiTemplate({
        id: 'tpl-1',
        name: '状态栏',
        initialVariableState: { day: 1, location: '村口', cast: { xueqing: { state: '初始' } } },
    });

    // Trailing comma + comments + surrounding chatter
    const r1 = uiUtils.parseUiTemplateUpdates('好的，更新如下：\n/* comment */\n{"day": 2, "location": "炕头",}\n// done', [tpl]);
    assert.deepEqual(r1.updates[0].variables, { day: 2, location: '炕头' });

    // Unescaped newline inside JSON string
    const r2 = uiUtils.parseUiTemplateUpdates('{"location": "第一行\n第二行"}', [tpl]);
    assert.deepEqual(r2.updates[0].variables, { location: '第一行\n第二行' });

    // Truncated string + missing closing braces
    const r3 = uiUtils.parseUiTemplateUpdates('{"day": 3, "cast": {"xueqing": {"state": "在被窝里', [tpl]);
    assert.deepEqual(r3.updates[0].variables, { day: 3, cast: { xueqing: { state: '在被窝里' } } });

    // Truncated mid-property key
    const r4 = uiUtils.parseUiTemplateUpdates('{"day": 4, "loca', [tpl]);
    assert.deepEqual(r4.updates[0].variables, { day: 4 });

    // Single template mistakenly wrapped in multi-template array or {id, variables} object
    const r5 = uiUtils.parseUiTemplateUpdates('[{"id":"tpl-1","variables":{"day":5}}]', [tpl]);
    assert.equal(r5.updates[0].id, 'tpl-1');
    assert.deepEqual(r5.updates[0].variables, { day: 5 });

    const r6 = uiUtils.parseUiTemplateUpdates('{"id":"tpl-1","variables":{"day":6}}', [tpl]);
    assert.equal(r6.updates[0].id, 'tpl-1');
    assert.deepEqual(r6.updates[0].variables, { day: 6 });

    // Non-JSON garbage still throws SyntaxError
    assert.throws(() => uiUtils.parseUiTemplateUpdates('纯文本没有任何JSON', [tpl]), SyntaxError);
});

test('normalizeUiTemplateUpdateListLenient coerces scalars and partially applies valid fields', () => {
    const uiUtils = loadUiTemplateUtils();
    const tpl = uiUtils.normalizeUiTemplate({
        id: 'tpl-1',
        name: '状态栏',
        initialVariableState: { day: 1, intimacy: 10, unlocked: false, note: '初始' },
    });

    const parsed = uiUtils.parseUiTemplateUpdates(
        '{"day": "3", "intimacy": 25, "unlocked": "true", "note": 99, "bogusExtra": "drop-me", "cast": "bad-type"}',
        [tpl],
    );
    const { updates, warnings } = uiUtils.normalizeUiTemplateUpdateListLenient(parsed, [tpl]);
    assert.equal(updates.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(updates[0].variables)), { day: 3, intimacy: 25, unlocked: true, note: '99' });
    assert.ok(warnings.length > 0, 'dropped fields should be reported in warnings');
    assert.match(warnings.join('；'), /bogusExtra/);

    // Completely invalid payload with 0 usable fields still throws
    const allBad = uiUtils.parseUiTemplateUpdates('{"onlyUnknown": 1}', [tpl]);
    assert.throws(() => uiUtils.normalizeUiTemplateUpdateListLenient(allBad, [tpl]), /未定义变量/);
});

test('applyMainModelUiTemplateUpdates preserves fallback UI panel on failure and supports partial acceptance', () => {
    const uiUtils = loadUiTemplateUtils();
    const applySrc = extractSlice(
        appSrc,
        'const summarizeUiTemplateFailure = ',
        'const removeOrphanedUiTemplateCorrections = ',
    );
    const attachSrc = extractSlice(
        appSrc,
        'const attachUiTemplateBlocksToLastAssistant = ',
        'const getAssistantTurnAtIndex = ',
    );

    const tpl = uiUtils.normalizeUiTemplate({
        id: 'tpl-1',
        name: '状态栏',
        placement: 'bottom',
        enabled: true,
        htmlTemplate: '<div>DAY={{day}} NOTE={{note}}</div>',
        initialVariableState: { day: 1, note: '初始' },
        variableState: { day: 1, note: '初始' },
    });
    const chatHistory = {
        value: [
            { id: 'm0', role: 'assistant', content: '开场白' },
            { id: 'u1', role: 'user', content: '继续' },
            { id: 'm1', role: 'assistant', content: '正文推进了，但忘了写变量块。' },
        ],
    };
    const statusHistory = [];
    const ctx = {
        settings: { uiTemplateEnabled: true, uiTemplateMainModelAnalysis: true, model: 'test-model' },
        activeUiTemplates: { value: [tpl] },
        chatHistory,
        user: { name: '测试' },
        BUILTIN_PROMPTS: {
            buildMainModelUiTemplatePrompt: () => '',
            buildMainModelUiTemplateCorrectionPrompt: ({ failureSummary }) => `[CORRECTION:${failureSummary}]`,
        },
        replaceUserNamePlaceholder: (s) => s,
        findUiTemplateUpdateBlock: uiUtils.findUiTemplateUpdateBlock,
        parseUiTemplateUpdates: uiUtils.parseUiTemplateUpdates,
        normalizeUiTemplateUpdateListLenient: uiUtils.normalizeUiTemplateUpdateListLenient,
        applyUiTemplateUpdateListToTemplate: uiUtils.applyUiTemplateUpdateListToTemplate,
        renderUiTemplateHtml: uiUtils.renderUiTemplateHtml,
        getLastAssistantMessage: () => chatHistory.value.at(-1),
        getAssistantTurnAtIndex: () => 1,
        saveGlobalUiTemplateRuntimeForCharacter: () => {},
        saveData: () => {},
        markUiTemplateStatus: (state, msg) => statusHistory.push({ state, msg }),
        failUiTemplateAnalysis: (msg) => statusHistory.push({ state: 'error', msg }),
        console: { warn: () => {} },
        Date,
        Set,
        Boolean,
        Array,
        Object,
        String,
        SyntaxError,
    };
    vm.createContext(ctx);
    vm.runInContext(
        `${attachSrc}\n${applySrc}\nthis.__out = { applyMainModelUiTemplateUpdates, appendPendingUiTemplateCorrection };`,
        ctx,
    );

    // 1. Missing block -> fails, records failure, AND STILL renders fallback panel with latest state!
    const res1 = ctx.__out.applyMainModelUiTemplateUpdates(chatHistory.value[2], 'test-model', { silent: true });
    assert.equal(res1.failed, true);
    assert.ok(chatHistory.value[2].uiTemplateAnalysisFailure, 'failure metadata recorded');
    assert.ok(chatHistory.value[2].uiTemplateBlocks?.bottom?.length === 1, 'fallback UI panel must remain rendered');
    assert.match(chatHistory.value[2].uiTemplateBlocks.bottom[0], /DAY=1/);

    // 2. Transient correction attaches ONLY to outgoing messageList without mutating user history permanently
    chatHistory.value.push({ id: 'u2', role: 'user', content: '下一轮' });
    const outgoing = [{ role: 'user', content: '下一轮', _sourceIndexes: [3] }];
    ctx.__out.appendPendingUiTemplateCorrection(outgoing);
    assert.match(outgoing[0].content, /\[CORRECTION:/);
    assert.equal(chatHistory.value[3].uiTemplateCorrection, undefined, 'must not permanently pollute chatHistory user message');

    // 3. Partial valid update with trailing comma + extra key succeeds without failing!
    const m2 = {
        id: 'm2',
        role: 'assistant',
        content: '新剧情\n<ui_template_updates>{"day": "2", "note": "已更新", "extraIgnored": true,}</ui_template_updates>',
    };
    chatHistory.value.push(m2);
    const res2 = ctx.__out.applyMainModelUiTemplateUpdates(m2, 'test-model');
    assert.equal(res2.failed, false);
    assert.equal(res2.changed, true);
    assert.equal(m2.uiTemplateAnalysisFailure, undefined);
    assert.equal(tpl.variableState.day, 2);
    assert.equal(tpl.variableState.note, '已更新');
    assert.match(m2.uiTemplateBlocks.bottom[0], /DAY=2/);
    assert.match(m2.uiTemplateBlocks.bottom[0], /NOTE=已更新/);

    // 4. After m2 succeeded, old m1 failure must NOT leak into subsequent turn u3!
    chatHistory.value.push({ id: 'u3', role: 'user', content: '再下一轮' });
    const outgoing2 = [{ role: 'user', content: '再下一轮', _sourceIndexes: [5] }];
    ctx.__out.appendPendingUiTemplateCorrection(outgoing2);
    assert.equal(outgoing2[0].content, '再下一轮');
});

test('Layer 0 history pruning, model fallback resolution, and inline retry UI are wired cleanly', () => {
    const resolverSrc = extractSlice(
        appSrc,
        'const resolveUiTemplateAnalysisModel = ',
        'const updateUiTemplatesFromChat = ',
    );
    const ctx = {
        settings: {
            apiProviderId: 'prov-main',
            model: 'main-m',
            modelProviderId: 'prov-main',
            fastModel: 'fast-m',
            fastModelProviderId: 'prov-fast',
            uiTemplateModel: '',
            uiTemplateModelProviderId: '',
        },
        String,
    };
    vm.createContext(ctx);
    vm.runInContext(`${resolverSrc}\nthis.resolve = resolveUiTemplateAnalysisModel;`, ctx);

    assert.equal(ctx.resolve({ allowFallback: false }), null);
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.resolve({ allowFallback: true }))), { model: 'fast-m', providerId: 'prov-fast' });
    ctx.settings.fastModel = '';
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.resolve({ allowFallback: true }))), { model: 'main-m', providerId: 'prov-main' });
    ctx.settings.uiTemplateModel = 'tpl-m';
    ctx.settings.uiTemplateModelProviderId = 'prov-tpl';
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.resolve({ allowFallback: false }))), { model: 'tpl-m', providerId: 'prov-tpl' });

    // Layer 0 retains only latestValidUiUpdateSource and strips all older/failed update blocks
    assert.match(appSrc, /let latestValidUiUpdateSource = null;/);
    assert.match(appSrc, /source === latestValidUiUpdateSource\s*&& !source\.uiTemplateAnalysisFailure/);
    assert.doesNotMatch(appSrc, /source\.uiTemplateCorrection\)\s*\{/);

    // UI bubble exposes one-click in-place variable retry button
    assert.match(indexHtml, /retryUiTemplateAnalysisForMessage\(msg\)/);
    assert.match(indexHtml, /仅补算变量/);
});
