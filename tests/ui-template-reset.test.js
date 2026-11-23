'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSrc = fs.readFileSync(path.join(__dirname, '../assets/js/app.js'), 'utf8');
const dataServicesSrc = fs.readFileSync(path.join(__dirname, '../assets/js/data-services.js'), 'utf8');

function extractSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

function createClearChatHarness({ uiTemplateEnabled = true } = {}) {
    const windowObj = {
        RPHubBuiltinContent: { prompts: {} },
        RPHubUtils: {
            generateUUID: () => 'test-uuid',
            deepClone: (v) => JSON.parse(JSON.stringify(v)),
        },
        RPHubCardUtils: {
            findLastUnprotectedMatch: () => null,
        },
        DOMPurify: {
            sanitize: (html) => String(html || ''),
        },
        marked: {
            parse: (md) => String(md || ''),
        },
    };
    const mockDocument = {
        createElement(tag) {
            const attrs = {};
            const children = [];
            return {
                tagName: tag.toUpperCase(),
                className: '',
                style: {},
                srcdoc: '',
                setAttribute(k, v) { attrs[k] = String(v); },
                appendChild(child) { children.push(child); return child; },
                get outerHTML() {
                    if (tag === 'iframe') return `<iframe srcdoc="${this.srcdoc}"></iframe>`;
                    return `<${tag} class="${this.className}">${children.map((c) => c.outerHTML).join('')}</${tag}>`;
                },
            };
        },
    };
    const dsCtx = { window: windowObj, document: mockDocument, console, URL, Date, Math, JSON, Object, Array, Set, Map, RegExp, String, Number, Boolean, Error };
    vm.createContext(dsCtx);
    vm.runInContext(dataServicesSrc, dsCtx);

    const uiUtils = windowObj.RPHubUiTemplateUtils;
    assert.ok(uiUtils && typeof uiUtils.renderUiTemplateHtml === 'function');

    const attachSrc = extractSlice(
        appSrc,
        'const attachUiTemplateBlocksToLastAssistant = ',
        'const getAssistantTurnAtIndex = ',
    );
    const resetSrc = extractSlice(
        appSrc,
        'const resetUiTemplateRuntimeState = ',
        'const getUiTemplateRuntimeKey = ',
    );
    const clearSrc = extractSlice(
        appSrc,
        'const clearChat = ',
        'const getNativeFullscreenElement = ',
    );

    const character = {
        uuid: 'char-1',
        name: '泉',
        first_mes: '[zhengwen]欢迎来到种名车站[/zhengwen]',
        uiTemplates: [
            uiUtils.normalizeUiTemplate({
                id: 'tpl-status',
                name: '种付都市状态栏',
                scope: 'character',
                placement: 'bottom',
                enabled: true,
                htmlTemplate: '<div>DAY={{day}} LOC={{location}}</div>',
                initialVariableState: { day: 1, location: '种名车站' },
                variableState: { day: 5, location: '废弃工厂' },
                changeLog: [{ turn: 1, time: 1000, changes: { day: { from: 1, to: 5 } } }],
            }),
            uiUtils.normalizeUiTemplate({
                id: 'tpl-quick',
                name: '种付都市快捷推进面板',
                scope: 'character',
                placement: 'bottom',
                enabled: true,
                htmlTemplate: '<section>TIP={{scene_tip}}</section>',
                initialVariableState: { scene_tip: '初抵种名车站' },
                variableState: { scene_tip: '已经推进到第5天' },
                changeLog: [{ turn: 1, time: 1001, changes: { scene_tip: { from: '初抵种名车站', to: '已经推进到第5天' } } }],
            }),
            uiUtils.normalizeUiTemplate({
                id: 'tpl-disabled',
                name: '已停用模板',
                scope: 'character',
                placement: 'top',
                enabled: false,
                htmlTemplate: '<header>OFF</header>',
                initialVariableState: {},
            }),
        ],
    };

    const settings = { uiTemplateEnabled };
    const chatHistory = {
        value: [
            { role: 'assistant', name: '泉', content: character.first_mes },
            { role: 'user', content: '你好' },
            {
                role: 'assistant',
                name: '泉',
                content: '第1轮回复',
                uiTemplateBlocks: { top: [], bottom: ['<div>STALE</div>'], updatedAt: 123 },
            },
        ],
    };
    const classicMemories = { value: [{ turn: 1, summary: '旧记忆' }] };
    const currentCharacter = { value: character };
    const currentUiTemplates = { value: character.uiTemplates };
    const activeUiTemplates = {
        get value() {
            return currentUiTemplates.value.filter((t) => t.enabled !== false);
        },
    };
    let savedCount = 0;
    const toasts = [];
    const savedRuntimeCalls = [];

    const harnessCtx = {
        settings,
        chatHistory,
        classicMemories,
        currentCharacter,
        currentUiTemplates,
        activeUiTemplates,
        cloneUiObject: uiUtils.cloneUiObject,
        inferInitialUiTemplateState: uiUtils.inferInitialUiTemplateState,
        renderUiTemplateHtml: uiUtils.renderUiTemplateHtml,
        createInitialChatHistory: (char) => (char?.first_mes ? [{ role: 'assistant', name: char.name, content: char.first_mes }] : []),
        getLastAssistantMessage: () => [...chatHistory.value].reverse().find((m) => m && m.role === 'assistant'),
        confirmAction: (_msg, onConfirm) => onConfirm(),
        clearPendingChatImages: () => {},
        clearPendingCardInteraction: () => {},
        abortConversationBackgroundWork: () => {},
        resetChatRenderWindow: () => {},
        abortUiTemplateUpdate: () => {},
        saveGlobalUiTemplateRuntimeForCharacter: () => { savedRuntimeCalls.push(Date.now()); },
        markUiTemplateStatus: () => {},
        saveData: () => { savedCount++; },
        showToast: (msg, type) => { toasts.push({ msg, type }); },
        Date,
        Set,
        Boolean,
        Object,
        Array,
    };

    vm.createContext(harnessCtx);
    vm.runInContext(
        `${attachSrc}\n${resetSrc}\n${clearSrc}\nthis.__exports = { clearChat, attachUiTemplateBlocksToLastAssistant, resetUiTemplateRuntimeState, ensureInitialUiTemplateBlocks: typeof ensureInitialUiTemplateBlocks === 'function' ? ensureInitialUiTemplateBlocks : null };`,
        harnessCtx,
    );

    return {
        exports: harnessCtx.__exports,
        settings,
        character,
        chatHistory,
        classicMemories,
        getSavedCount: () => savedCount,
        toasts,
    };
}

test('clearChat resets UI templates to initialVariableState and re-attaches initial panels to opening message', () => {
    const h = createClearChatHarness({ uiTemplateEnabled: true });
    h.exports.clearChat();

    assert.equal(h.chatHistory.value.length, 1);
    assert.equal(h.chatHistory.value[0].content, h.character.first_mes);
    assert.equal(h.classicMemories.value.length, 0);
    assert.equal(h.getSavedCount(), 1);

    // Variable states and logs are restored to initial values
    assert.deepEqual(JSON.parse(JSON.stringify(h.character.uiTemplates[0].variableState)), { day: 1, location: '种名车站' });
    assert.equal(h.character.uiTemplates[0].changeLog.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(h.character.uiTemplates[1].variableState)), { scene_tip: '初抵种名车站' });

    // Opening message now displays the freshly rendered initial UI panels (excluding disabled templates)
    const blocks = h.chatHistory.value[0].uiTemplateBlocks;
    assert.ok(blocks, 'opening message should carry initial uiTemplateBlocks after clearChat');
    assert.equal(blocks.top.length, 0);
    assert.equal(blocks.bottom.length, 2);
    assert.match(blocks.bottom[0], /DAY=1/);
    assert.match(blocks.bottom[0], /LOC=种名车站/);
    assert.doesNotMatch(blocks.bottom[0], /废弃工厂/);
    assert.match(blocks.bottom[1], /TIP=初抵种名车站/);
});

test('clearChat does not attach UI panels when uiTemplateEnabled is false', () => {
    const h = createClearChatHarness({ uiTemplateEnabled: false });
    h.exports.clearChat();

    assert.equal(h.chatHistory.value.length, 1);
    assert.equal(h.chatHistory.value[0].uiTemplateBlocks, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(h.character.uiTemplates[0].variableState)), { day: 1, location: '种名车站' });
});

test('ensureInitialUiTemplateBlocks attaches initial panels on fresh opening load without clobbering active chats', () => {
    const h = createClearChatHarness({ uiTemplateEnabled: true });
    assert.equal(typeof h.exports.ensureInitialUiTemplateBlocks, 'function');

    // Multi-message chat must not be touched
    assert.equal(h.exports.ensureInitialUiTemplateBlocks(), false);

    // Fresh opening-only chat gets initial panels attached
    h.character.uiTemplates[0].variableState = { day: 1, location: '种名车站' };
    h.character.uiTemplates[1].variableState = { scene_tip: '初抵种名车站' };
    h.chatHistory.value = [{ role: 'assistant', name: '泉', content: h.character.first_mes }];
    assert.equal(h.exports.ensureInitialUiTemplateBlocks(), true);
    assert.equal(h.chatHistory.value[0].uiTemplateBlocks.bottom.length, 2);

    // Second non-forced call is idempotent no-op
    assert.equal(h.exports.ensureInitialUiTemplateBlocks(), false);
});
