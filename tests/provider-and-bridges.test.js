const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const adaptersSrc = fs.readFileSync(path.join(repoRoot, 'assets/js/rphub-api-adapters.js'), 'utf8');
const coreUtilsSrc = fs.readFileSync(path.join(repoRoot, 'assets/js/core-utils.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(repoRoot, 'assets/js/app.js'), 'utf8');
const uiComponentsSrc = fs.readFileSync(path.join(repoRoot, 'assets/js/ui-components.js'), 'utf8');
const novelHtml = fs.readFileSync(path.join(repoRoot, 'novel/index.html'), 'utf8');

function extractSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

function createProviderTestHarness(initialSettings = {}, initialMemory = {}, options = {}) {
    const windowObj = {
        location: { href: 'https://rp.blycr.xyz/', origin: 'https://rp.blycr.xyz' },
        RPHubApiAdapters: null,
        RPHubBuiltinContent: { imageStyleArtists: [] },
        RPHubConfig: null,
        RPHubUtils: null,
    };

    const settings = {
        apiUrl: 'https://api.deepseek.com',
        apiKey: '',
        apiProviderId: 'deepseek',
        apiProviderKeys: {},
        modelProviderId: '',
        qualityModelProviderId: '',
        balancedModelProviderId: '',
        fastModelProviderId: '',
        uiTemplateModelProviderId: '',
        customApiProviders: [],
        apiProviderModes: {},
        providerMigrationVersion: 0,
        customApiUrl: '',
        model: '',
        qualityModel: '',
        balancedModel: '',
        fastModel: '',
        uiTemplateModel: '',
        ...initialSettings,
    };

    const backingMemory = {
        embeddingProviderId: '',
        embeddingModel: '',
        classicProviderId: '',
        classicModel: '',
        ...initialMemory,
    };

    const availableModels = { value: [...(options.availableModels || [])] };
    const toasts = [];
    let saveCalls = 0;

    const context = {
        console,
        URL,
        Set,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Date,
        Math,
        Error,
        window: windowObj,
        self: windowObj,
        DEFAULT_API_PROVIDER_ID: 'deepseek',
        DEFAULT_API_CONFIG: {
            apiUrl: 'https://api.deepseek.com',
            apiKey: '',
            qualityModel: 'deepseek-chat',
            balancedModel: 'deepseek-chat',
            fastModel: 'deepseek-chat',
        },
        settings,
        availableModels,
        ref: (value) => ({ value }),
        computed: (getter) => ({ get value() { return getter(); } }),
        confirmAction: (_msg, onConfirm) => onConfirm(),
        saveData: async () => { saveCalls += 1; },
        showToast: (msg, type) => toasts.push({ msg, type }),
    };

    if (options.simulateMemoryTdz) {
        Object.defineProperty(context, 'memorySettings', {
            configurable: true,
            get() {
                throw new ReferenceError("Cannot access 'memorySettings' before initialization");
            },
        });
    } else {
        context.memorySettings = backingMemory;
    }

    vm.createContext(context);
    vm.runInContext(adaptersSrc, context);
    context.window.RPHubApiAdapters = context.window.RPHubApiAdapters || context.RPHubApiAdapters;
    context.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    vm.runInContext(coreUtilsSrc, context);
    context.apiProviderOptions = context.window.RPHubConfig.apiProviderOptions;

    const slice = extractSlice(
        appSrc,
        '// RP-Hub-Sync dynamic API provider registry v3',
        'const ensureLegacyMemoryProvider ='
    );

    vm.runInContext(`
        ${slice}
        globalThis.__testExports = {
            pruneDanglingProviderState,
            migrateLegacyCustomApiProviders,
            migrateLegacyApiOrigins,
            deleteCustomApiProvider,
            getProviderApiConfig,
            getProviderReferences,
            allApiProviderOptions,
            customApiProviderOptions,
        };
    `, context);

    return {
        settings,
        memorySettings: backingMemory,
        availableModels,
        toasts,
        getSaveCalls: () => saveCalls,
        exports: context.__testExports,
    };
}

test('provider migration, deletion, and reload never revive deleted custom provider or leak dangling bindings', () => {
    const harness = createProviderTestHarness(
        {
            apiProviderId: 'custom',
            apiUrl: 'https://legacy.example.com/v1',
            apiKey: 'sk-legacy-secret',
            apiProviderKeys: { custom: 'sk-legacy-secret' },
            apiProviderModes: { custom: { chat: 'openai-responses', embedding: 'none' } },
            customApiUrl: 'https://legacy.example.com/v1',
            modelProviderId: 'custom',
            model: 'legacy-chat-model',
            qualityModelProviderId: 'custom',
            qualityModel: 'legacy-q-model',
            providerMigrationVersion: 0,
        },
        {
            embeddingProviderId: 'custom',
            embeddingModel: 'legacy-embed',
            classicProviderId: 'custom',
            classicModel: 'legacy-summary',
        }
    );

    const migrated = harness.exports.migrateLegacyCustomApiProviders(harness.memorySettings);
    assert.equal(migrated, true);
    assert.equal(harness.settings.providerMigrationVersion, 2);
    assert.equal('customApiUrl' in harness.settings, false);
    assert.equal(harness.settings.customApiProviders.length, 1);

    const newId = harness.settings.customApiProviders[0].id;
    assert.match(newId, /^custom-/);
    assert.equal(harness.settings.apiProviderId, newId);
    assert.equal(harness.settings.modelProviderId, newId);
    assert.equal(harness.settings.qualityModelProviderId, newId);
    assert.equal(harness.memorySettings.embeddingProviderId, newId);
    assert.equal(harness.memorySettings.classicProviderId, newId);
    assert.equal(harness.settings.apiProviderKeys[newId], 'sk-legacy-secret');

    harness.availableModels.value.push({ id: 'legacy-chat-model', providerId: newId });
    harness.exports.deleteCustomApiProvider(newId);

    assert.equal(harness.settings.customApiProviders.length, 0);
    assert.equal('customApiUrl' in harness.settings, false);
    assert.equal(harness.settings.apiProviderId, 'deepseek');
    assert.equal(harness.settings.modelProviderId, '');
    assert.equal(harness.settings.model, '');
    assert.equal(harness.settings.qualityModelProviderId, '');
    assert.equal(harness.settings.qualityModel, '');
    assert.equal(harness.memorySettings.embeddingProviderId, '');
    assert.equal(harness.memorySettings.embeddingModel, '');
    assert.equal(harness.memorySettings.classicProviderId, '');
    assert.equal(harness.memorySettings.classicModel, '');
    assert.equal(harness.settings.apiProviderKeys[newId], undefined);
    assert.equal(harness.settings.apiProviderModes[newId], undefined);
    assert.equal(harness.availableModels.value.length, 0);

    // Simulate reload where stale legacy URL field reappears: migration v2 must not revive it
    harness.settings.customApiUrl = 'https://legacy.example.com/v1';
    const revivedOnReload = harness.exports.migrateLegacyCustomApiProviders(harness.memorySettings);
    assert.equal(revivedOnReload, false);
    assert.equal(harness.settings.customApiProviders.length, 0);
});

test('unreferenced legacy customApiUrl is pruned on initial migration without creating a provider', () => {
    const harness = createProviderTestHarness({
        apiProviderId: 'deepseek',
        apiUrl: 'https://api.deepseek.com',
        customApiUrl: 'https://stale.example.com/v1',
        providerMigrationVersion: 0,
    });

    const changed = harness.exports.migrateLegacyCustomApiProviders();
    assert.equal(changed, true);
    assert.equal(harness.settings.providerMigrationVersion, 2);
    assert.equal(harness.settings.customApiProviders.length, 0);
    assert.equal('customApiUrl' in harness.settings, false);
});

test('pruneDanglingProviderState respects targetMemorySettings and stays TDZ-safe when includeMemory is false', () => {
    const harness = createProviderTestHarness(
        {
            modelProviderId: 'deleted-provider',
            model: 'ghost-model',
            apiProviderKeys: { 'deleted-provider': 'sk-ghost', deepseek: 'sk-live' },
        },
        {},
        {
            simulateMemoryTdz: true,
            availableModels: [{ id: 'ghost-model', providerId: 'deleted-provider' }],
        }
    );

    assert.doesNotThrow(() => harness.exports.pruneDanglingProviderState());
    assert.equal(harness.settings.modelProviderId, '');
    assert.equal(harness.settings.model, '');
    assert.deepEqual(JSON.parse(JSON.stringify(harness.settings.apiProviderKeys)), { deepseek: 'sk-live' });
    assert.equal(harness.availableModels.value.length, 0);

    const loadedMemory = {
        embeddingProviderId: 'deleted-provider',
        embeddingModel: 'embed-ghost',
        classicProviderId: 'deleted-provider',
        classicModel: 'sum-ghost',
    };
    assert.doesNotThrow(() => harness.exports.pruneDanglingProviderState({
        includeMemory: true,
        memorySettings: loadedMemory,
    }));
    assert.equal(loadedMemory.embeddingProviderId, '');
    assert.equal(loadedMemory.embeddingModel, '');
    assert.equal(loadedMemory.classicProviderId, '');
    assert.equal(loadedMemory.classicModel, '');
});

test('ModelSelectorModal.selectManual validates whitespace in quickModels mode instead of corrupting slots', () => {
    const windowObj = {};
    const context = {
        console,
        String,
        window: windowObj,
        Vue: {
            ref: (v) => ({ value: v }),
            computed: (g) => ({ value: g() }),
            nextTick: async () => {},
            watch: () => {},
            onBeforeUnmount: () => {},
        },
    };
    vm.createContext(context);
    vm.runInContext(uiComponentsSrc, context);
    const Modal = context.window.RPHubComponents.ModelSelectorModal;
    assert.ok(Modal?.methods?.selectManual);

    const emitted = [];
    let chosenArgs = null;
    const baseCtx = {
        target: 'quickModels',
        activeSlot: 'qualityModel',
        manualModelId: '   ',
        manualModelProviderId: 'deepseek',
        draftSlotModels: { qualityModel: 'existing' },
        draftSlotProviderIds: { qualityModel: 'deepseek' },
        $emit: (eventName) => emitted.push(eventName),
        chooseModel: (modelId, providerId) => { chosenArgs = { modelId, providerId }; },
    };

    Modal.methods.selectManual.call(baseCtx);
    assert.equal(chosenArgs, null);
    assert.deepEqual(emitted, ['select-manual']);

    emitted.length = 0;
    baseCtx.manualModelId = '  gpt-4o-mini  ';
    Modal.methods.selectManual.call(baseCtx);
    assert.deepEqual(chosenArgs, { modelId: 'gpt-4o-mini', providerId: 'deepseek' });
    assert.deepEqual(emitted, []);
});

test('app.js novel bridge responds with exact origin and syncs live provider updates on settings watch', () => {
    const postedToNovel = [];
    const novelWindow = {
        postMessage(payload, targetOrigin) {
            postedToNovel.push({ payload, targetOrigin });
        },
    };
    const novelIframe = {
        getAttribute: (name) => (name === 'src' ? 'novel/index.html' : null),
        src: 'https://rp.blycr.xyz/novel/index.html',
        contentWindow: novelWindow,
    };
    const listeners = {};
    let watchCallback = null;

    const context = {
        console,
        URL,
        Array,
        String,
        JSON,
        window: {
            addEventListener: (type, fn) => { listeners[type] = fn; },
        },
        location: { href: 'https://rp.blycr.xyz/', origin: 'https://rp.blycr.xyz' },
        document: {
            documentElement: { dataset: { appTheme: 'light' } },
            getElementById: () => null,
            querySelector: (selector) => (selector.includes('novel/index.html') ? novelIframe : null),
            querySelectorAll: () => [novelIframe],
        },
        squareUrl: { value: 'https://square.example.com/' },
        allApiProviderOptions: {
            value: [{ id: 'deepseek', name: 'DeepSeek', icon: '', apiUrl: 'https://api.deepseek.com' }],
        },
        settings: {
            apiProviderId: 'deepseek',
            apiUrl: 'https://api.deepseek.com',
            apiKey: 'sk-initial',
            apiProviderKeys: { deepseek: 'sk-initial' },
            apiProviderModes: { deepseek: { chat: 'openai-chat-completions', embedding: 'openai-embeddings' } },
            customApiProviders: [],
            model: 'deepseek-chat',
            modelProviderId: 'deepseek',
            imageGenKey: '',
            imageStyle: 'vertical',
            qualityModel: '',
            qualityModelProviderId: '',
            balancedModel: '',
            balancedModelProviderId: '',
            fastModel: '',
            fastModelProviderId: '',
        },
        getProviderApiConfig: (id) => ({
            apiUrl: 'https://api.deepseek.com',
            apiKey: context.settings.apiProviderKeys[id] || '',
            chatProtocol: 'openai-chat-completions',
        }),
        getProviderModes: () => ({ chat: 'openai-chat-completions' }),
        watch: (_getter, cb) => { watchCallback = cb; },
        importSquareCard: async () => {},
        importCharacterFileFromExternalUrl: async () => {},
    };

    vm.createContext(context);
    const bridgeSlice = extractSlice(
        appSrc,
        '// RP-Hub-Sync upstream 1.9 embedded bridge',
        '// RP-Hub-Sync direct chat model state'
    );
    const watchSlice = extractSlice(
        appSrc,
        'watch(() => [\n            settings.apiUrl,',
        '// Watch image gen and model settings for sync'
    );

    vm.runInContext(`${bridgeSlice}\n${watchSlice}`, context);
    assert.equal(typeof listeners.message, 'function');
    assert.equal(typeof watchCallback, 'function');

    // Untrusted origin must be ignored
    const rogueResponses = [];
    listeners.message({
        origin: 'https://evil.example.com',
        source: novelWindow,
        data: { type: 'REQUEST_RPHUB_API_SETTINGS', requestId: 'req-1' },
    });
    assert.equal(postedToNovel.length, 0);
    assert.equal(rogueResponses.length, 0);

    // Exact origin + iframe source receives settings snapshot with exact targetOrigin
    listeners.message({
        origin: 'https://rp.blycr.xyz',
        source: novelWindow,
        data: { type: 'REQUEST_RPHUB_API_SETTINGS', requestId: 'req-2' },
    });
    assert.equal(postedToNovel.length, 1);
    assert.equal(postedToNovel[0].targetOrigin, 'https://rp.blycr.xyz');
    assert.equal(postedToNovel[0].payload.type, 'RPHUB_API_SETTINGS');
    assert.equal(postedToNovel[0].payload.requestId, 'req-2');
    assert.equal(postedToNovel[0].payload.providers[0].apiKey, 'sk-initial');

    // Mutate provider key + trigger watch -> pushes RPHUB_API_SETTINGS_UPDATED to novel iframe
    context.settings.apiKey = 'sk-rotated';
    context.settings.apiProviderKeys.deepseek = 'sk-rotated';
    watchCallback();
    assert.equal(postedToNovel.length, 2);
    assert.equal(postedToNovel[1].targetOrigin, 'https://rp.blycr.xyz');
    assert.equal(postedToNovel[1].payload.type, 'RPHUB_API_SETTINGS_UPDATED');
    assert.equal(postedToNovel[1].payload.providers[0].apiKey, 'sk-rotated');
});

test('novel/index.html uses exact targetOrigin, enforces parent/origin check, and preserves providers on fallback', async () => {
    const parentPosts = [];
    const windowListeners = new Map();
    const parentWin = {
        postMessage(data, targetOrigin) {
            parentPosts.push({ data, targetOrigin });
        },
    };
    const windowObj = {
        parent: parentWin,
        location: { origin: 'https://rp.blycr.xyz' },
        RPHubBuiltinContent: { imageStyleArtists: [] },
        RPHubConfig: null,
        RPHubUtils: null,
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        addEventListener: (type, fn) => {
            if (!windowListeners.has(type)) windowListeners.set(type, new Set());
            windowListeners.get(type).add(fn);
        },
        removeEventListener: (type, fn) => {
            windowListeners.get(type)?.delete(fn);
        },
    };

    const settingsRef = { value: { providerId: '', apiUrl: '', apiKey: '', chatProtocol: 'openai-chat-completions' } };
    const globalSettingsRef = { value: { activeProviderId: '', providers: [] } };
    const apiProvidersRef = { value: [] };
    const availableModelsRef = { value: ['stale-model'] };
    const isSyncingRPHubRef = { value: false };
    let savedCount = 0;

    const context = {
        console,
        URL,
        Array,
        String,
        JSON,
        Date,
        Math,
        Error,
        setTimeout: (fn) => {
            // Trigger immediate timeout when simulating parent unreachability in fallback test
            if (context.__immediateTimeout) fn();
            return 1;
        },
        clearTimeout: () => {},
        window: windowObj,
        location: windowObj.location,
        settings: settingsRef,
        globalSettings: globalSettingsRef,
        apiProviders: apiProvidersRef,
        availableModels: availableModelsRef,
        isSyncingRPHub: isSyncingRPHubRef,
        readRPHubSettings: async () => ({
            apiProviderId: 'custom-fallback',
            apiProviderKeys: {
                deepseek: 'sk-ds-fallback',
                'custom-fallback': 'sk-custom-fallback',
            },
            apiProviderModes: {
                'custom-fallback': { chat: 'openai-responses' },
            },
            customApiProviders: [
                { id: 'custom-fallback', name: 'My Custom', apiUrl: 'https://custom.example/v1' },
            ],
        }),
        saveData: async () => { savedCount += 1; },
        showToast: () => {},
    };

    vm.createContext(context);
    vm.runInContext(coreUtilsSrc, context);
    const novelSlice = extractSlice(
        novelHtml,
        'const requestRPHubSettingsFromParent = () => new Promise((resolve, reject) => {',
        'const selectModel = (id) =>'
    );
    vm.runInContext(`
        ${novelSlice}
        globalThis.__novelExports = {
            requestRPHubSettingsFromParent,
            applyParentProviderUpdate,
            syncRPHubSettings,
        };
    `, context);

    // 1) Immediate timeout triggers readRPHubSettings() fallback -> must include builtin + custom providers
    context.__immediateTimeout = true;
    const ok = await context.__novelExports.syncRPHubSettings(false);
    assert.equal(ok, true);
    assert.equal(savedCount, 1);
    assert.equal(parentPosts.length, 1);
    assert.equal(parentPosts[0].targetOrigin, 'https://rp.blycr.xyz');
    const mappedProviders = JSON.parse(JSON.stringify(apiProvidersRef.value.map(p => [p.id, p.apiKey, p.chatProtocol])));
    assert.ok(mappedProviders.some(([id]) => id === 'sta1n'));
    assert.deepEqual(
        mappedProviders.filter(([id]) => id === 'deepseek' || id === 'custom-fallback'),
        [
            ['deepseek', 'sk-ds-fallback', 'openai-chat-completions'],
            ['custom-fallback', 'sk-custom-fallback', 'openai-responses'],
        ]
    );
    assert.equal(settingsRef.value.providerId, 'custom-fallback');
    assert.equal(availableModelsRef.value.length, 0);

    // 2) Live parent update rejects spoofed origin and wrong source, accepts exact parent + origin
    context.__novelExports.applyParentProviderUpdate({
        source: parentWin,
        origin: 'https://evil.example.com',
        data: {
            type: 'RPHUB_API_SETTINGS_UPDATED',
            settings: { apiProviderId: 'deepseek', apiProviderKeys: { deepseek: 'sk-hijack' } },
            providers: [{ id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://evil.example/v1' }],
        },
    });
    assert.equal(settingsRef.value.apiKey, 'sk-custom-fallback');

    context.__novelExports.applyParentProviderUpdate({
        source: {},
        origin: 'https://rp.blycr.xyz',
        data: {
            type: 'RPHUB_API_SETTINGS_UPDATED',
            settings: { apiProviderId: 'deepseek', apiProviderKeys: { deepseek: 'sk-hijack' } },
            providers: [{ id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://evil.example/v1' }],
        },
    });
    assert.equal(settingsRef.value.apiKey, 'sk-custom-fallback');

    context.__novelExports.applyParentProviderUpdate({
        source: parentWin,
        origin: 'https://rp.blycr.xyz',
        data: {
            type: 'RPHUB_API_SETTINGS_UPDATED',
            settings: { apiProviderId: 'deepseek', apiProviderKeys: { deepseek: 'sk-fresh' } },
            providers: [{ id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://api.deepseek.com' }],
        },
    });
    assert.equal(settingsRef.value.providerId, 'deepseek');
    assert.equal(settingsRef.value.apiKey, 'sk-fresh');
});
