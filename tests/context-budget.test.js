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

function loadContextUtils() {
    const windowObj = {
        RPHubBuiltinContent: { prompts: {}, imageStyleArtists: { vertical: '' } },
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
    return windowObj.RPHubContextUtils;
}

test('resolveModelContextBudget supports modern 256k/500k/1M/2M limits, metadata, and manual overrides', () => {
    const cu = loadContextUtils();

    // DeepSeek V4 -> 1M hard limit, 300k default sweet spot (30%), 968k hard cap (32k reserve)
    const dsV4 = cu.resolveModelContextBudget({ providerId: 'p1', modelId: 'deepseek-v4-chat' });
    assert.equal(dsV4.hardLimit, 1000000);
    assert.equal(dsV4.hardLimitSource, 'family');
    assert.equal(dsV4.sweetSpotTokens, 300000);
    assert.equal(dsV4.hardCapTokens, 968000);

    // /v1/models metadata overrides family default
    const fromMeta = cu.resolveModelContextBudget({
        providerId: 'p1',
        modelId: 'custom-relay-model',
        modelMeta: { id: 'custom-relay-model', context_length: 500000 },
    });
    assert.equal(fromMeta.hardLimit, 500000);
    assert.equal(fromMeta.hardLimitSource, 'metadata');
    assert.equal(fromMeta.sweetSpotTokens, 150000);

    // Unknown model uses modern 256k default rather than outdated 48k cap
    const unknown = cu.resolveModelContextBudget({ providerId: 'p1', modelId: 'mystery-llm' });
    assert.equal(unknown.hardLimit, 256000);
    assert.equal(unknown.hardLimitSource, 'default');
    assert.ok(unknown.sweetSpotTokens >= 75000 && unknown.sweetSpotTokens <= 80000);

    // Manual per-provider+model override takes top priority
    const key = cu.buildModelBudgetKey('p1', 'deepseek-v4-chat');
    const manual = cu.resolveModelContextBudget({
        providerId: 'p1',
        modelId: 'deepseek-v4-chat',
        modelMeta: { context_length: 500000 },
        overrides: { [key]: { hardLimit: 1000000, sweetSpotTokens: 350000 } },
    });
    assert.equal(manual.hardLimit, 1000000);
    assert.equal(manual.hardLimitSource, 'manual');
    assert.equal(manual.sweetSpotTokens, 350000);
});

test('self-calibrating token estimator converges via EMA and ignores outliers', () => {
    const cu = loadContextUtils();

    const zhBase = cu.estimateTextBaseTokens('这是一段中文剧情测试文本，用来验证中英文基础估算。');
    const enBase = cu.estimateTextBaseTokens('{"location":"village","day":2,"status":"calm"}');
    assert.ok(zhBase > 0 && enBase > 0);

    // First calibration: actual is 1.2x of base -> factor becomes 1.2
    const c1 = cu.updateTokenCalibration(null, { estimatedBaseTokens: 10000, actualInputTokens: 12000 });
    assert.equal(c1.factor, 1.2);
    assert.equal(c1.samples, 1);

    // Second calibration: actual is 1.0x -> EMA = 1.2 * 0.65 + 1.0 * 0.35 = 1.13
    const c2 = cu.updateTokenCalibration(c1, { estimatedBaseTokens: 10000, actualInputTokens: 10000 });
    assert.equal(c2.factor, 1.13);
    assert.equal(c2.samples, 2);

    // Extreme outlier (10x) or tiny base (<150) is safely ignored
    const cOutlier = cu.updateTokenCalibration(c2, { estimatedBaseTokens: 10000, actualInputTokens: 100000 });
    assert.equal(cOutlier.factor, 1.13);
    assert.equal(cOutlier.samples, 2);
});

test('summarizeContextBudget classifies normal / sweetspot / danger levels and formats token counts cleanly', () => {
    const cu = loadContextUtils();
    const budget = cu.resolveModelContextBudget({ providerId: 'p1', modelId: 'deepseek-v4' }); // 1M / 300k / 968k

    const sNormal = cu.summarizeContextBudget({
        sections: { system: 10000, worldInfo: 20000, uiTemplates: 5000, memories: 0, recentChat: 100000 },
        budget,
        calibration: { factor: 1.1, samples: 3 },
    });
    assert.equal(sNormal.totalTokens, 148500);
    assert.equal(sNormal.level, 'normal');
    assert.equal(sNormal.calibrated, true);
    assert.equal(sNormal.sections.length, 5);

    const sSweet = cu.summarizeContextBudget({
        sections: { system: 20000, worldInfo: 30000, uiTemplates: 10000, memories: 40000, recentChat: 250000 },
        budget,
    });
    assert.equal(sSweet.totalTokens, 350000);
    assert.equal(sSweet.level, 'sweetspot');

    const sDanger = cu.summarizeContextBudget({
        sections: { system: 20000, worldInfo: 30000, uiTemplates: 10000, memories: 100000, recentChat: 820000 },
        budget,
    });
    assert.equal(sDanger.totalTokens, 980000);
    assert.equal(sDanger.level, 'danger');

    assert.equal(cu.formatContextTokenCount(850), '850');
    assert.equal(cu.formatContextTokenCount(31700), '31.7k');
    assert.equal(cu.formatContextTokenCount(300000), '300k');
    assert.equal(cu.formatContextTokenCount(1000000), '1M');
    assert.equal(cu.formatContextTokenCount(2000000), '2M');
});

test('parseContextTokenInput, API calibration hook, provider pruning, and popover UI are wired cleanly', () => {
    const start = appSrc.indexOf('const parseContextTokenInput = ');
    const end = appSrc.indexOf('const currentChatProviderId = ', start);
    assert.ok(start > 0 && end > start);
    const ctx = { String, Number, Math };
    vm.createContext(ctx);
    vm.runInContext(`${appSrc.slice(start, end)}\nthis.parse = parseContextTokenInput;`, ctx);

    assert.equal(ctx.parse('1M'), 1000000);
    assert.equal(ctx.parse('500k'), 500000);
    assert.equal(ctx.parse('300k'), 300000);
    assert.equal(ctx.parse('30w'), 300000);
    assert.equal(ctx.parse('30万'), 300000);
    assert.equal(ctx.parse('256000'), 256000);
    assert.equal(ctx.parse('100'), null);
    assert.equal(ctx.parse('abc'), null);

    // Calibration wired into chat usage callback and provider pruning
    assert.match(appSrc, /calibrateModelTokenEstimator\(providerId, request\.model, estimatedBaseTokens, normalized\.inputTokens\)/);
    assert.match(appSrc, /settings\.modelContextBudgets = pruneModelScopedMap\(settings\.modelContextBudgets\)/);
    assert.match(appSrc, /settings\.modelTokenCalibrations = pruneModelScopedMap\(settings\.modelTokenCalibrations\)/);

    // Composer pill & popover wired in index.html
    assert.match(indexHtml, /toggleContextBudgetPanel/);
    assert.match(indexHtml, /MODEL_CONTEXT_LIMIT_PRESETS/);
    assert.match(indexHtml, /MODEL_SWEET_SPOT_RATIO_PRESETS/);
    assert.match(indexHtml, /applyCustomModelBudgetInputs/);
});
