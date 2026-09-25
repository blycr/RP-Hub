// Optional browser-native encrypted GitHub sync. No credentials are persisted by this module.
(function () {
    'use strict';

    const SNAPSHOT_PATH = 'rp-hub-sync/manifest.json';
    const BACKUP_DB = 'RPHubSyncRecovery';
    const BACKUP_STORE = 'backups';
    const WORKSHOP_DB = 'AICharGen';
    const WORKSHOP_STORE = 'characters';
    const WORKSHOP_KEY = 'ai_chargen_characters';
    const WORKSHOP_OPTIONS_KEY = 'ai_chargen_options';
    const WORKSHOP_ACTIVE_KEY = 'ai_chargen_active_index';
    const WORKSHOP_OPTIONS = ['generateExtra', 'avatarStyle', 'resetOnLoad'];
    const WORKSHOP_PRIVATE_FIELDS = ['avatar', 'avatarUrl', 'profileImage', 'image', 'avatar_data', 'image_url',
        'imageGenKey', 'apiUrl', 'apiKey', 'providerId', 'providerName', 'model', 'modelId', 'chatProtocol', 'protocol'];
    const PLACEHOLDER = '__RPHUB_SYNC_AVATAR_PLACEHOLDER__';
    const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const requestValue = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    const waitTransaction = transaction => new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已回滚'));
    });
    const openDatabase = (name, onUpgrade) => new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onupgradeneeded = () => onUpgrade?.(request.result);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    const readMainState = async () => {
        const db = await window.RPHubStorage.initDB();
        const transaction = db.transaction('store', 'readonly');
        const result = {};
        const request = transaction.objectStore('store').openCursor();
        await new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return resolve();
                if (typeof cursor.key === 'string') result[cursor.key] = cursor.value;
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
            transaction.onabort = () => reject(transaction.error);
        });
        return result;
    };
    const writeMainState = async (data, replaceAll = false) => {
        if (!isRecord(data)) throw new Error('恢复数据必须是对象');
        const db = await window.RPHubStorage.initDB();
        const transaction = db.transaction('store', 'readwrite');
        const done = waitTransaction(transaction);
        const store = transaction.objectStore('store');
        if (replaceAll) store.clear();
        else {
            const keys = await requestValue(store.getAllKeys());
            for (const key of keys) {
                if (typeof key === 'string' && key.startsWith('rp_hub_') && !key.startsWith('rp_hub_card_blob_')) {
                    store.delete(key);
                }
            }
        }
        for (const [key, value] of Object.entries(data)) store.put(value, key);
        await done;
    };
    const readWorkshop = async () => {
        let exists = false;
        if (typeof indexedDB.databases === 'function') {
            exists = (await indexedDB.databases()).some(item => item?.name === WORKSHOP_DB);
        } else {
            exists = localStorage.getItem(WORKSHOP_OPTIONS_KEY) !== null
                || localStorage.getItem(WORKSHOP_ACTIVE_KEY) !== null;
        }
        if (!exists) return { available: false };
        const db = await openDatabase(WORKSHOP_DB);
        try {
            if (!db.objectStoreNames.contains(WORKSHOP_STORE)) return { available: false };
            const transaction = db.transaction(WORKSHOP_STORE, 'readonly');
            const raw = await requestValue(transaction.objectStore(WORKSHOP_STORE).get(WORKSHOP_KEY));
            const characters = raw == null ? [] : typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!Array.isArray(characters) || !characters.every(isRecord)) throw new Error('角色工坊本地数据无效');
            const clean = characters.map(character => {
                const copy = JSON.parse(JSON.stringify(character));
                for (const key of WORKSHOP_PRIVATE_FIELDS) delete copy[key];
                return copy;
            });
            let savedOptions;
            try { savedOptions = JSON.parse(localStorage.getItem(WORKSHOP_OPTIONS_KEY) || '{}'); }
            catch { savedOptions = {}; }
            const options = {};
            if (isRecord(savedOptions)) for (const key of WORKSHOP_OPTIONS) {
                const value = savedOptions[key];
                if (key === 'avatarStyle' ? typeof value === 'string' && value.length <= 256
                    : typeof value === 'boolean') options[key] = value;
            }
            const active = Number(localStorage.getItem(WORKSHOP_ACTIVE_KEY));
            return { available: true, snapshot: { version: 1, characters: clean, options,
                activeIndex: Number.isInteger(active) && active >= 0 ? Math.min(active, Math.max(0, clean.length - 1)) : 0 },
                backup: { raw, options: localStorage.getItem(WORKSHOP_OPTIONS_KEY),
                    active: localStorage.getItem(WORKSHOP_ACTIVE_KEY) },
                avatars: new Map(characters.filter(character => character.id != null && character.avatar)
                    .map(character => [String(character.id), character.avatar])) };
        } finally { db.close(); }
    };
    const validateWorkshop = value => {
        if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.characters)
            || !value.characters.every(isRecord) || !isRecord(value.options)
            || !Number.isInteger(value.activeIndex) || value.activeIndex < 0) {
            throw new Error('角色工坊快照格式无效');
        }
        const characters = value.characters.map(character => {
            const copy = JSON.parse(JSON.stringify(character));
            for (const key of WORKSHOP_PRIVATE_FIELDS) delete copy[key];
            return copy;
        });
        const options = {};
        for (const key of Object.keys(value.options)) {
            if (!WORKSHOP_OPTIONS.includes(key)) continue;
            const item = value.options[key];
            if (key === 'avatarStyle' ? typeof item !== 'string' || item.length > 256 : typeof item !== 'boolean') {
                throw new Error('角色工坊选项格式无效');
            }
            options[key] = item;
        }
        return { characters, options, activeIndex: value.activeIndex };
    };
    const writeWorkshop = async (snapshot, previous) => {
        const parsed = validateWorkshop(snapshot);
        const avatars = previous?.avatars || new Map();
        const characters = parsed.characters.map(character => ({ ...character,
            ...(avatars.has(String(character.id)) ? { avatar: avatars.get(String(character.id)) } : {}) }));
        const db = await openDatabase(WORKSHOP_DB, database => {
            if (!database.objectStoreNames.contains(WORKSHOP_STORE)) database.createObjectStore(WORKSHOP_STORE);
        });
        try {
            if (!db.objectStoreNames.contains(WORKSHOP_STORE)) throw new Error('角色工坊存储不存在');
            const transaction = db.transaction(WORKSHOP_STORE, 'readwrite');
            const done = waitTransaction(transaction);
            transaction.objectStore(WORKSHOP_STORE).put(JSON.stringify(characters), WORKSHOP_KEY);
            await done;
            let current;
            try { current = JSON.parse(localStorage.getItem(WORKSHOP_OPTIONS_KEY) || '{}'); }
            catch { current = {}; }
            localStorage.setItem(WORKSHOP_OPTIONS_KEY, JSON.stringify({ ...(isRecord(current) ? current : {}), ...parsed.options }));
            localStorage.setItem(WORKSHOP_ACTIVE_KEY, String(Math.min(parsed.activeIndex, Math.max(0, characters.length - 1))));
        } finally { db.close(); }
    };
    const writeWorkshopBackup = async backup => {
        if (!backup?.available) {
            const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
            if (databases.some(item => item?.name === WORKSHOP_DB)) {
                const db = await openDatabase(WORKSHOP_DB);
                try {
                    if (db.objectStoreNames.contains(WORKSHOP_STORE)) {
                        const transaction = db.transaction(WORKSHOP_STORE, 'readwrite');
                        const done = waitTransaction(transaction);
                        transaction.objectStore(WORKSHOP_STORE).delete(WORKSHOP_KEY);
                        await done;
                    }
                } finally { db.close(); }
            }
            localStorage.removeItem(WORKSHOP_OPTIONS_KEY);
            localStorage.removeItem(WORKSHOP_ACTIVE_KEY);
            return;
        }
        const db = await openDatabase(WORKSHOP_DB);
        try {
            const transaction = db.transaction(WORKSHOP_STORE, 'readwrite');
            const done = waitTransaction(transaction);
            const store = transaction.objectStore(WORKSHOP_STORE);
            if (backup.backup.raw === undefined) store.delete(WORKSHOP_KEY);
            else store.put(backup.backup.raw, WORKSHOP_KEY);
            await done;
            for (const [key, value] of [[WORKSHOP_OPTIONS_KEY, backup.backup.options],
                [WORKSHOP_ACTIVE_KEY, backup.backup.active]]) {
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, value);
            }
        } finally { db.close(); }
    };
    const recoveryDatabase = () => openDatabase(BACKUP_DB, db => db.createObjectStore(BACKUP_STORE));
    const saveRecovery = async state => {
        const db = await recoveryDatabase();
        try {
            const transaction = db.transaction(BACKUP_STORE, 'readwrite');
            const done = waitTransaction(transaction);
            transaction.objectStore(BACKUP_STORE).put({ savedAt: Date.now(), ...state }, 'latest');
            await done;
        } finally { db.close(); }
    };
    const readRecovery = async () => {
        const db = await recoveryDatabase();
        try { return await requestValue(db.transaction(BACKUP_STORE, 'readonly').objectStore(BACKUP_STORE).get('latest')); }
        finally { db.close(); }
    };
    const prepareMainRestore = (remote, local) => {
        if (!isRecord(remote) || !Object.keys(remote).every(key => key.length > 0 && key.length < 500
            && !/[\x00-\x1f]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key))) {
            throw new Error('远端状态包含无效键');
        }
        const data = Object.fromEntries(Object.entries(remote).filter(([key]) => !key.startsWith('rp_hub_card_blob_')));
        if (data.rp_hub_characters !== undefined && !Array.isArray(data.rp_hub_characters)) {
            throw new Error('远端角色数据无效');
        }
        const avatars = new Map((Array.isArray(local.rp_hub_characters) ? local.rp_hub_characters : [])
            .filter(character => character?.uuid).map(character => [character.uuid, character]));
        if (Array.isArray(data.rp_hub_characters)) data.rp_hub_characters = data.rp_hub_characters.map(character => {
            if (!isRecord(character)) throw new Error('远端角色数据无效');
            const copy = { ...character };
            const previous = avatars.get(copy.uuid);
            for (const key of ['avatar', 'avatarUrl', 'profileImage', 'image']) {
                if (copy[key] !== PLACEHOLDER) continue;
                if (previous?.[key] && previous[key] !== PLACEHOLDER) copy[key] = previous[key];
                else delete copy[key];
            }
            delete copy.__rphubSyncAvatarStripped__;
            return copy;
        });
        return data;
    };
    const sha256 = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join('');
    const encodeText = text => {
        let binary = '';
        for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
        return btoa(binary);
    };
    const deviceId = () => {
        let id = localStorage.getItem('rphub_native_sync_device_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('rphub_native_sync_device_id', id);
        }
        return id;
    };
    const formValue = (form, name) => form.elements.namedItem(name).value;
    const makeClient = form => window.RPHubSyncGitHub.makeClient({ owner: formValue(form, 'owner').trim(),
        repo: formValue(form, 'repo').trim(), branch: formValue(form, 'branch').trim(),
        token: formValue(form, 'token').trim() });
    const passphrase = form => {
        const value = formValue(form, 'passphrase');
        if (!value) throw new Error('请输入同步口令');
        return value;
    };
    const push = async (form, status) => {
        const client = makeClient(form);
        const password = passphrase(form);
        status('正在读取本地数据与角色工坊…');
        const data = await readMainState();
        const workshop = await readWorkshop();
        const remoteText = await client.readText(SNAPSHOT_PATH, { optional: true });
        const remote = remoteText ? JSON.parse(remoteText) : null;
        if (remote && (!isRecord(remote.files) || remote.version !== 1)) throw new Error('远端清单格式无效');
        if (remote && !Object.keys(data).length
            && !confirm('本机没有 RP-Hub 数据，继续推送会把远端快照改为空。确定继续吗？')) return;
        const id = deviceId();
        const lastPull = Number(localStorage.getItem('rphub_native_sync_last_pull') || 0);
        if (remote?.deviceId && remote.deviceId !== id && Date.parse(remote.updatedAt) > lastPull
            && !confirm('远端有其他设备的更新。继续推送会覆盖这些更新。确定继续吗？')) return;
        status('正在加密并比较分片…');
        const snapshot = await window.RPHubSyncSnapshot.createSnapshot(data, {
            deviceId: id, passphrase: password, workshop: workshop.available ? workshop.snapshot : null,
            version: '2.9.13',
        }, window.RPHubSyncCrypto);
        const hashChanged = remote?.passphraseHash && remote.passphraseHash !== await sha256(password);
        if (!workshop.available && remote?.files?.[window.RPHubSyncSnapshot.FILES.workshop]) {
            snapshot.manifest.files[window.RPHubSyncSnapshot.FILES.workshop]
                = remote.files[window.RPHubSyncSnapshot.FILES.workshop];
        }
        const oldHashes = remote?.files || {};
        const currentPaths = new Set(Object.keys(snapshot.manifest.files));
        const stale = Object.keys(oldHashes).filter(path => path.startsWith('rp-hub-sync/')
            && !currentPaths.has(path));
        const changed = snapshot.files.filter(file => file.path !== SNAPSHOT_PATH
            && (hashChanged || oldHashes[file.path] !== file.hash));
        if (!changed.length && !stale.length) { status('本地数据没有变化'); return; }
        changed.push({ path: SNAPSHOT_PATH, base64: encodeText(JSON.stringify(snapshot.manifest)) });
        if (changed.reduce((sum, file) => sum + file.base64.length, 0) > 90 * 1024 * 1024) {
            throw new Error('本次上传超过 90 MiB，请先整理大数据');
        }
        status(`正在原子提交 ${changed.length - 1} 个分片…`);
        await client.pushAtomic(changed, stale, `RP-Hub native sync ${new Date().toISOString()}`);
        status('推送完成，已加密保存到 GitHub');
    };
    const pull = async (form, status) => {
        const client = makeClient(form);
        const password = passphrase(form);
        status('正在下载并校验所有远端分片…');
        const pulled = await window.RPHubSyncSnapshot.readSnapshot(client.readText, password, window.RPHubSyncCrypto);
        const validatedWorkshop = pulled.workshopPresent ? validateWorkshop(pulled.workshop) : null;
        const current = await readMainState();
        const next = prepareMainRestore(pulled.data, current);
        if (!confirm('远端快照已通过解密校验。现在覆盖本机角色、聊天和设置吗？本机头像与图片 Blob 会保留，并先建立本地备份。')) {
            status('已取消恢复');
            return;
        }
        status('正在创建完整本地备份…');
        const workshop = await readWorkshop();
        await saveRecovery({ main: current, workshop });
        try {
            status('正在恢复本地数据…');
            await writeMainState(next);
            if (validatedWorkshop) await writeWorkshop({ version: 1, ...validatedWorkshop }, workshop);
        } catch (error) {
            try { await writeMainState(current, true); await writeWorkshopBackup(workshop); }
            catch { throw new Error(`恢复失败且自动回滚未完成，请使用“恢复上次本地备份”：${error.message}`); }
            throw error;
        }
        localStorage.setItem('rphub_native_sync_last_pull', String(Date.now()));
        status('恢复完成，正在刷新页面…');
        location.reload();
    };
    const restoreRecovery = async status => {
        const backup = await readRecovery();
        if (!backup?.main) throw new Error('没有可用的本地备份');
        if (!confirm(`恢复 ${new Date(backup.savedAt).toLocaleString()} 的本地备份？当前本机数据会被覆盖。`)) return;
        status('正在恢复本地备份…');
        await writeMainState(backup.main, true);
        await writeWorkshopBackup(backup.workshop);
        location.reload();
    };

    class NativeSyncPanel extends HTMLElement {
        connectedCallback() {
            this.style.display = 'block';
            this.innerHTML = `<div class="settings-card__header"><div class="settings-card__title">加密跨设备同步（预览）</div></div>
                <form class="settings-card__body space-y-4" autocomplete="off">
                    <p class="text-sm text-gray-600">凭据仅在本页输入框内使用。拉取前会校验全部文件并在本机保存完整备份；已有用户脚本仍可继续使用。</p>
                    <div><label class="settings-label">GitHub 用户名</label><input name="owner" class="settings-control" required value="blycr"></div>
                    <div><label class="settings-label">私有数据仓库</label><input name="repo" class="settings-control" required value="RP-Hub-Sync"></div>
                    <div><label class="settings-label">分支</label><input name="branch" class="settings-control" required value="main"></div>
                    <div><label class="settings-label">GitHub Token</label><input name="token" type="password" class="settings-control" required autocomplete="new-password"></div>
                    <div><label class="settings-label">同步口令</label><input name="passphrase" type="password" class="settings-control" required autocomplete="new-password"></div>
                    <div class="flex flex-wrap gap-2"><button type="button" data-action="push" class="settings-action">加密推送</button>
                        <button type="button" data-action="pull" class="settings-action">校验并拉取</button>
                        <button type="button" data-action="recover" class="settings-action">恢复上次本地备份</button></div>
                    <p data-status role="status" aria-live="polite" class="text-sm text-gray-600"></p>
                </form>`;
            const form = this.querySelector('form');
            form.addEventListener('submit', event => event.preventDefault());
            this.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
                if (button.dataset.action !== 'recover' && !form.reportValidity()) return;
                this.querySelectorAll('button').forEach(item => { item.disabled = true; });
                const status = message => { this.querySelector('[data-status]').textContent = message; };
                try {
                    if (button.dataset.action === 'push') await push(form, status);
                    else if (button.dataset.action === 'pull') await pull(form, status);
                    else await restoreRecovery(status);
                } catch (error) { status(`操作失败：${error.message || error}`); }
                finally { this.querySelectorAll('button').forEach(item => { item.disabled = false; }); }
            }));
        }
    }
    customElements.define('rphub-native-sync', NativeSyncPanel);
    window.RPHubNativeSync = Object.freeze({ prepareMainRestore });
})();
