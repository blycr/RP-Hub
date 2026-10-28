'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('manual model controls bind the active quick slot to its provider', () => {
    const source = read('assets/js/ui-components.js');
    const start = source.indexOf('    const ModelSelectorModal = {');
    const end = source.indexOf('    const PaginationControls = {', start);
    assert.ok(start >= 0 && end > start);
    const component = vm.runInNewContext(`${source.slice(start, end)}\nModelSelectorModal`);
    assert.match(component.template, /@click="selectManual\(\)"/);
    assert.match(component.template, /@keydown.enter.prevent="selectManual\(\)"/);
    const events = [];
    const state = {
        target: 'quickModels', manualModelId: ' custom-model ', manualModelProviderId: 'provider-b',
        activeSlot: 1, draftSlotModels: ['old', '', ''], draftSlotProviderIds: ['provider-a', '', ''],
        $emit: (...args) => events.push(args),
    };
    state.chooseModel = component.methods.chooseModel.bind(state);
    component.methods.selectManual.call(state);
    assert.equal(events.length, 1);
    assert.equal(events[0][0], 'select-slots');
    assert.deepEqual(JSON.parse(JSON.stringify(events[0][1])), [
        { model: 'old', providerId: 'provider-a' },
        { model: 'custom-model', providerId: 'provider-b' },
        { model: '', providerId: '' },
    ]);
    state.target = 'model';
    component.methods.selectManual.call(state);
    assert.equal(events[1][0], 'select-manual');
});

test('numbering old and compressed memories preserves stored references across reloads', () => {
    const source = read('assets/js/data-services.js');
    const start = source.indexOf('// --- Shared summary memory utilities ---');
    const end = source.indexOf('// --- Context utilities ---', start);
    assert.ok(start >= 0 && end > start);
    const window = {};
    vm.runInNewContext(source.slice(start, end), { window, Vue: { markRaw: value => value } });
    const { numberClassicMemories, getNextClassicMemoryNo, flattenClassicMemories } = window.RPHubMemoryUtils;
    const memories = [
        { no: 7, turn: 3, summary: 'Previously cited fact' },
        { secondaryCompressed: true, turnStart: 1, turnEnd: 2,
            sourceMemories: [{ turn: 2, summary: 'Second turn' }, { turn: 1, summary: 'First turn' }] },
    ];
    numberClassicMemories(memories);
    assert.equal(memories[0].no, 7);
    assert.equal(memories[1].sourceMemories[1].no, 8);
    assert.equal(memories[1].sourceMemories[0].no, 9);
    assert.equal(memories[1].no, 10);
    const restored = JSON.parse(JSON.stringify(memories));
    numberClassicMemories(restored);
    assert.deepEqual(restored, memories);
    assert.equal(getNextClassicMemoryNo(restored), 11);
    assert.equal(new Set(flattenClassicMemories(restored).map(memory => memory.no)).size, 4);
});

test('new model filters retain provider capability, same-model identity and original list order', () => {
    const source = read('assets/js/app.js');
    const start = source.indexOf('        const selectableModels = computed(');
    const end = source.indexOf('        const getCharacterWICount =', start);
    assert.ok(start >= 0 && end > start);
    const models = [
        { id: 'same-model', providerId: 'b' },
        { id: 'text-embedding-3-small', providerId: 'a' },
        { id: 'same-model', providerId: 'a' },
        { id: 'bge-m3', providerId: 'a' },
    ];
    const originalOrder = [...models];
    const context = {
        computed: fn => ({ get value() { return fn(); } }),
        availableModels: { value: models }, modelSelectionTarget: { value: 'model' },
        activeModelTag: { value: 'all' }, modelSearchQuery: { value: '' },
        settings: { apiProviderId: 'a' }, popularModelFamilies: ['gpt', 'gemini'],
        getProviderDisplayName: id => id === 'a' ? 'Alpha' : 'Beta',
        isProviderEmbeddingEnabled: id => id === 'a',
    };
    const { filteredModels, modelTags } = vm.runInNewContext(
        `${source.slice(start, end)}\n({filteredModels, modelTags})`, context);
    assert.equal(filteredModels.value.filter(model => model.id === 'same-model').length, 2);
    assert.deepEqual(models, originalOrder, 'sorting must not mutate the shared model list');
    context.modelSelectionTarget.value = 'quickModels';
    assert.equal(filteredModels.value.some(model => /embedding/i.test(model.id)), false);
    context.modelSelectionTarget.value = 'memoryEmbeddingModel';
    assert.equal(filteredModels.value.every(model => model.providerId === 'a'), true);
    assert.equal(filteredModels.value.some(model => model.id === 'bge-m3'), true);
    assert.equal(modelTags.value[0].count, 3);
    context.modelSearchQuery.value = 'alpha';
    assert.equal(filteredModels.value.length, 3);
});

test('upstream 2.0.2 performance and embedded-page additions remain wired', () => {
    const app = read('assets/js/app.js');
    const index = read('index.html');
    const novel = read('novel/index.html');
    assert.match(app, /const styleFilteredContentCache = new Map\(\)/);
    assert.match(app, /const currentCharacterAvatar = computed\(\(\) =>/);
    assert.match(app, /const SUMMARY_KEEP_FLOORS_MAX = 50/);
    assert.match(app, /await yieldToUi\(\)/);
    assert.match(app, /type: 'RPHUB_THEME'/);
    assert.match(app, /RPH_FORUM_THEME_REQUEST/);
    assert.match(app, /window\.addEventListener\('rphub-theme-change'/);
    assert.match(app, /char\.plazaId = pending\.cardId/);
    assert.match(index, /currentCharacterAvatar/);
    assert.match(novel, /书评团/);
    assert.match(novel, /const startBookReview = async/);
    assert.match(novel, /marked\.parse/);
});

test('upstream 2.0.5 Gemini input obfuscation runs automatically with a fresh request prefix', () => {
    const apiSource = read('assets/js/api-utils.js');
    const window = {
        RPHubUtils: {
            extractApiErrorMessage: () => '',
            formatApiErrorMessage: () => '',
            getApiUsagePayload: () => null,
        },
        RPHubCardUtils: {
            extractNativeReasoning: () => '',
            isNativeReasoningPart: () => false,
        },
    };
    vm.runInNewContext(apiSource, {
        window, TextDecoder, AbortController,
        fetch: () => { throw new Error('unused'); },
        setTimeout, clearTimeout, setInterval, clearInterval,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(window.RPHubApiUtils.buildUserInputToolMessages('真实输入', 'call_test'))), [
        {
            role: 'assistant',
            content: null,
            tool_calls: [{
                id: 'call_test',
                type: 'function',
                function: { name: 'read_user_input', arguments: '{}' },
            }],
        },
        {
            role: 'tool',
            tool_call_id: 'call_test',
            content: JSON.stringify({ source: 'user_input', text: '真实输入' }),
        },
    ]);
    const app = read('assets/js/app.js');
    const index = read('index.html');
    assert.match(app, /const obfuscateInput = \/gemini\/i\.test\(String\(requestModel \|\| ''\)\)/);
    assert.match(app, /buildUserInputToolMessages\(inputMessage\.content/);
    assert.match(app, /const prepareRequest = \(\) =>/);
    assert.match(app, /onBeforeRequest: prepareRequest/);
    assert.match(app, /prefix \+ inputPrompt/);
    assert.match(apiSource, /options\.onBeforeRequest\?\.\(\)/);
    assert.doesNotMatch(app, /settings\.inputObfuscation/);
    assert.doesNotMatch(index, /v-model="settings\.inputObfuscation"/);
    assert.doesNotMatch(index, /模型请求网关/);
    assert.doesNotMatch(index, /rphub-native-sync/);
    assert.match(index, /enterkeyhint="enter"/);
    assert.doesNotMatch(index, /@keydown\.enter\.exact\.prevent="sendMessage"/);
});

test('upstream 2.0.5 secret inputs, context markers and long durations are retained', () => {
    const ui = read('assets/js/ui-components.js');
    const index = read('index.html');
    const data = read('assets/js/data-services.js');
    assert.match(ui, /const SecretInput = \{/);
    assert.match(ui, /navigator\.clipboard\.writeText/);
    assert.match(ui, /`\$\{Math\.floor\(seconds \/ 60\)\}m\$\{seconds % 60\}s`/);
    assert.match(index, /<secret-input v-model="settings\.apiKey"/);
    assert.match(index, /<secret-input v-model="settings\.imageGenKey"/);
    assert.match(data, /const isMemory = message\.role !== 'system' && isRoleMemoryContextContent\(message\.content\);/);
    assert.match(data, /if \(isMemory \|\| recallCount > 0\)/);
});
