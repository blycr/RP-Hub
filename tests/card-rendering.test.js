'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const dataServicesSrc = fs.readFileSync(path.join(rootDir, 'assets/js/data-services.js'), 'utf8');
const runtimeServicesSrc = fs.readFileSync(path.join(rootDir, 'assets/js/runtime-services.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

function extractSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

test('iframe height shim survives Firefox hidden getComputedStyle=null and binds ResizeObserver on DOMContentLoaded', () => {
    const windowObj = {
        RPHubBuiltinContent: { prompts: {} },
        RPHubUtils: { generateUUID: () => 'u', deepClone: (v) => JSON.parse(JSON.stringify(v)) },
        RPHubCardUtils: { findLastUnprotectedMatch: () => null },
        DOMPurify: { sanitize: (h) => String(h || '') },
        marked: { parse: (m) => String(m || '') },
    };
    const dsCtx = { window: windowObj, console, URL, Date, Math, JSON, Object, Array, Set, Map, RegExp, String, Number, Boolean, Error };
    vm.createContext(dsCtx);
    vm.runInContext(dataServicesSrc, dsCtx);

    const docHtml = windowObj.RPHubUiTemplateUtils.buildExecutableHtmlDocument(
        '<!DOCTYPE html><html><head><title>t</title></head><body><div class="root">hi</div></body></html>',
    );
    const scripts = [...docHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 1, 'expected inline scriptShim');
    const shimCode = scripts[0];

    let visible = false;
    const listeners = new Map();
    const observedByResize = [];
    let ioCallback = null;
    const frameElement = {
        style: { height: 'auto' },
        getBoundingClientRect: () => ({ width: visible ? 324 : 0, height: visible ? 200 : 0 }),
    };
    const childDiv = {
        tagName: 'DIV',
        offsetTop: 0,
        offsetHeight: 1536,
        getBoundingClientRect: () => ({ bottom: visible ? 1536 : 0 }),
    };
    const bodyEl = {
        children: [childDiv],
        get scrollHeight() { return visible ? 1540 : 0; },
    };
    const docEl = { tagName: 'HTML' };
    const doc = {
        readyState: 'loading',
        body: null, // <head> runs before <body> exists!
        documentElement: docEl,
        head: { appendChild: () => {} },
        querySelectorAll: () => [],
        addEventListener: () => {},
    };
    const iframeWindow = {
        frameElement,
        parent: {},
        ResizeObserver: class {
            constructor(cb) { this.cb = cb; }
            observe(target) { observedByResize.push(target); }
        },
        IntersectionObserver: class {
            constructor(cb) { ioCallback = cb; }
            observe() {}
        },
        getComputedStyle: () => (visible ? { position: 'static', marginBottom: '0px' } : null),
        addEventListener: (type, fn) => {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        requestAnimationFrame: (fn) => fn(),
        setTimeout: () => 0,
        setInterval: () => 0,
    };
    const shimSandbox = {
        window: iframeWindow,
        document: doc,
        ResizeObserver: iframeWindow.ResizeObserver,
        IntersectionObserver: iframeWindow.IntersectionObserver,
        requestAnimationFrame: iframeWindow.requestAnimationFrame,
        setTimeout: iframeWindow.setTimeout,
        setInterval: iframeWindow.setInterval,
        parseFloat,
        Math,
        Date,
    };
    vm.createContext(shimSandbox);
    vm.runInContext(shimCode, shimSandbox);

    // Body did not exist during <head> execution
    assert.equal(observedByResize.length, 0);

    // DOMContentLoaded fires while hidden in square view (Firefox returns getComputedStyle=null)
    doc.body = bodyEl;
    doc.readyState = 'interactive';
    assert.doesNotThrow(() => {
        (listeners.get('DOMContentLoaded') || []).forEach((fn) => fn());
        (listeners.get('load') || []).forEach((fn) => fn());
    });
    // Must attach ResizeObserver once body exists, and must NOT collapse height to 4px while hidden
    assert.ok(observedByResize.includes(bodyEl), 'ResizeObserver should observe document.body on DOMContentLoaded');
    assert.equal(frameElement.style.height, 'auto', 'hidden iframe must not be locked to 4px');

    // Switch to visible chat view -> IntersectionObserver or parent __rphubUpdateHeight(true) measures full height
    visible = true;
    assert.ok(typeof ioCallback === 'function', 'IntersectionObserver should be registered');
    ioCallback([{ isIntersecting: true }]);
    assert.equal(frameElement.style.height, '1544px');

    // Parent explicit refresh hook also works
    frameElement.style.height = 'auto';
    iframeWindow.__rphubUpdateHeight(true);
    assert.equal(frameElement.style.height, '1544px');
});

test('replaceUserNamePlaceholderInHtml escapes quotes and angle brackets inside srcdoc', () => {
    const fnSrc = extractSlice(
        appSrc,
        'const replaceUserNamePlaceholder = ',
        'const buildUserInfoPrompt = ',
    );
    const sandbox = {
        user: { name: '小"宝<测试>&1' },
        String,
        RegExp,
    };
    vm.createContext(sandbox);
    vm.runInContext(`${fnSrc}\nthis.replaceUserNamePlaceholderInHtml = replaceUserNamePlaceholderInHtml;`, sandbox);

    const frameHtml = '<div class="html-card-container"><iframe srcdoc="&lt;p&gt;你好，{{user}}&lt;/p&gt;"></iframe></div>';
    const out = sandbox.replaceUserNamePlaceholderInHtml(frameHtml);
    assert.match(out, /^<div class="html-card-container"><iframe srcdoc="[^"]+"><\/iframe><\/div>$/);
    assert.doesNotMatch(out, /\{\{user\}\}/);
    assert.ok(out.includes('&amp;quot;'), 'double quotes inside srcdoc must be double-escaped');
    assert.ok(out.includes('&amp;lt;'), 'angle brackets inside srcdoc must be double-escaped');
    assert.match(indexHtml, /replaceUserNamePlaceholderInHtml\(html\)/);
});

test('filterBlockedStyleText preserves Markdown block prefixes and balanced emphasis markers', () => {
    const patternsSrc = extractSlice(
        appSrc,
        'const blockedStyleSentencePattern = ',
        'const loggedBlockedStyleFragments = ',
    );
    const filterSrc = extractSlice(
        appSrc,
        'const markdownBlockPrefixPattern = ',
        '// 历史回复的文风过滤结果按原文缓存',
    );
    const sandbox = {
        settings: { styleFilterEnabled: true },
        loggedBlockedStyleFragments: new Set(),
        findUiTemplateUpdateBlock: () => null,
        normalizeStyleFilterHit: (s) => String(s || '').trim(),
        cardUtils: { transformUnprotectedText: (text, fn) => fn(text) },
        console,
        Array,
        String,
        Set,
        RegExp,
    };
    vm.createContext(sandbox);
    vm.runInContext(`${patternsSrc}\n${filterSrc}\nthis.filterBlockedStyleText = filterBlockedStyleText;`, sandbox);

    assert.equal(
        sandbox.filterBlockedStyleText('**不是他不想说，而是他说不出口。这是真正要加粗的后半句**'),
        '**这是真正要加粗的后半句**',
    );
    assert.equal(
        sandbox.filterBlockedStyleText('> 这不是偶然，而是必然。后面的引用内容'),
        '> 后面的引用内容',
    );
    assert.equal(
        sandbox.filterBlockedStyleText('第一句**极其**重要'),
        '第一句重要',
    );
    assert.equal(
        sandbox.filterBlockedStyleText('**她露出了一抹笑容。**下一句'),
        '下一句',
    );
    assert.equal(
        sandbox.filterBlockedStyleText('> 这不是偶然，而是必然。'),
        '',
    );
});

test('app lifecycle restores opening UI templates on mount, toggle, and view switch', () => {
    const onMountedRestore = extractSlice(
        appSrc,
        '// Load Char Specifics\n                applyCharacterScopedResources(char);',
        'if (char.recentGenerationTimes)',
    );
    assert.match(onMountedRestore, /ensureInitialUiTemplateBlocks\(\);/);

    const viewWatch = extractSlice(
        appSrc,
        'watch(currentView, (newView) => {',
        '// --- Character-scoped persistence ---',
    );
    assert.match(viewWatch, /if \(newView === 'chat'\) \{\s*refreshExecutableHtmlFrames\(\);/);

    assert.match(
        appSrc,
        /watch\(\(\) => settings\.uiTemplateEnabled,[\s\S]*?ensureInitialUiTemplateBlocks\(\)/,
    );
});
