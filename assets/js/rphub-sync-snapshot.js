(function (root) {
    'use strict';

    const PREFIX = 'rp-hub-sync/';
    const FILES = Object.freeze({
        state: `${PREFIX}state.enc.json`,
        cardMap: `${PREFIX}card-id-map.enc.json`,
        chatsIndex: `${PREFIX}chats-index.enc.json`,
        workshop: `${PREFIX}workshop.enc.json`,
        legacy: `${PREFIX}snapshot.enc.json`,
    });
    const AVATAR_PLACEHOLDER = '__RPHUB_SYNC_AVATAR_PLACEHOLDER__';
    const imageData = value => typeof value === 'string'
        && (/^data:image\/(?:png|jpeg|webp);base64,/.test(value) || value.startsWith('blob:'));
    const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const safeStateKey = key => typeof key === 'string' && key.length > 0 && key.length < 500
        && !/[\x00-\x1f]/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
    const chatFilePath = key => {
        if (typeof key !== 'string' || !/^rp_hub_(?:chat|memories|classic_memories)_[A-Za-z0-9_-]+$/.test(key)) {
            throw new Error('聊天记录键无效');
        }
        return `${PREFIX}chats/${key.replace(/^rp_hub_/, '').replace(/_/g, '-')}.enc.json`;
    };
    const stripAvatars = characters => {
        if (!Array.isArray(characters)) return characters;
        return characters.map(character => {
            if (!isRecord(character)) return character;
            const clean = { ...character };
            for (const field of ['avatar', 'avatarUrl', 'profileImage', 'image']) {
                if (imageData(clean[field])) {
                    clean[field] = AVATAR_PLACEHOLDER;
                    clean.__rphubSyncAvatarStripped__ = true;
                }
            }
            return clean;
        });
    };
    const splitState = data => {
        if (!isRecord(data)) throw new Error('本地状态无效');
        const state = {};
        const chats = {};
        for (const [key, value] of Object.entries(data)) {
            if (!safeStateKey(key)) throw new Error('本地状态键无效');
            if (key === 'rp_hub_characters') state[key] = stripAvatars(value);
            else if (/^rp_hub_(?:chat|memories|classic_memories)_/.test(key)) chats[key] = value;
            else if (!key.startsWith('rp_hub_card_blob_')) state[key] = value;
        }
        return { state, chats };
    };
    const sha256Hex = async text => {
        const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const base64Utf8 = text => {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    };
    const createSnapshot = async (data, { deviceId, passphrase, workshop = null, version = '2.9.12' }, cryptoApi) => {
        if (!deviceId || !passphrase || !cryptoApi?.encryptText) throw new Error('同步配置不完整');
        const { state, chats } = splitState(data);
        const characters = Array.isArray(state.rp_hub_characters) ? state.rp_hub_characters : [];
        const cardMap = {};
        for (const character of characters) {
            if (character?.uuid && character?.plazaId) cardMap[character.uuid] = character.plazaId;
        }
        const files = [];
        const add = async (path, text) => {
            files.push({ path, base64: base64Utf8(await cryptoApi.encryptText(text, passphrase)), hash: await sha256Hex(text) });
        };
        await add(FILES.state, JSON.stringify({ version: 2, deviceId, state }));
        await add(FILES.cardMap, JSON.stringify(cardMap));
        const chatsIndex = {};
        for (const [key, value] of Object.entries(chats)) {
            const path = chatFilePath(key);
            if (files.some(file => file.path === path)) throw new Error('聊天记录文件路径冲突');
            const text = JSON.stringify({ version: 2, key, value });
            await add(path, text);
            chatsIndex[key] = { size: text.length };
        }
        await add(FILES.chatsIndex, JSON.stringify({ version: 2, chats: chatsIndex }));
        if (workshop !== null) {
            if (!isRecord(workshop) || !Array.isArray(workshop.characters)) throw new Error('角色工坊状态无效');
            await add(FILES.workshop, JSON.stringify(workshop));
        }
        const manifest = {
            version: 1,
            minVersion: version,
            updatedAt: new Date().toISOString(),
            deviceId,
            passphraseHash: await sha256Hex(passphrase),
            files: Object.fromEntries(files.map(file => [file.path, file.hash])),
        };
        files.push({ path: `${PREFIX}manifest.json`, base64: base64Utf8(JSON.stringify(manifest)) });
        return { files, manifest };
    };
    const readSnapshot = async (readText, passphrase, cryptoApi) => {
        if (typeof readText !== 'function' || !passphrase || !cryptoApi?.decryptText) throw new Error('同步配置不完整');
        const manifestText = await readText(`${PREFIX}manifest.json`, { optional: true });
        const manifest = manifestText === null ? null : JSON.parse(manifestText);
        if (manifest !== null && (manifest?.version !== 1 || !isRecord(manifest.files))) {
            throw new Error('同步清单格式无效');
        }
        const readJson = async (path, optional = false) => {
            const text = await readText(path, { optional });
            if (text === null && optional) return null;
            if (typeof text !== 'string') throw new Error(`同步文件缺失: ${path}`);
            return JSON.parse(text);
        };
        const decryptJson = async (path, optional = false) => {
            const envelope = await readJson(path, optional);
            if (envelope === null) {
                if (manifest && Object.hasOwn(manifest.files, path)) throw new Error(`同步清单中的文件缺失: ${path}`);
                return null;
            }
            const plaintext = await cryptoApi.decryptText(envelope, passphrase);
            if (manifest) {
                const expected = manifest.files[path];
                if (typeof expected !== 'string' || expected !== await sha256Hex(plaintext)) {
                    throw new Error(`同步文件校验失败: ${path}`);
                }
            }
            return JSON.parse(plaintext);
        };
        const stateFile = await decryptJson(FILES.state, !manifest);
        if (stateFile === null) {
            const legacyEnvelope = await readJson(FILES.legacy, true);
            if (legacyEnvelope === null) throw new Error('GitHub 上没有可恢复的同步快照');
            const legacyData = JSON.parse(await cryptoApi.decryptText(legacyEnvelope, passphrase));
            if (!isRecord(legacyData) || !Object.keys(legacyData).every(safeStateKey)) {
                throw new Error('旧版同步状态格式无效');
            }
            return { data: legacyData, workshop: null, workshopPresent: false, cardMap: {} };
        }
        if (stateFile?.version !== 2 || !isRecord(stateFile.state)) throw new Error('同步状态格式无效');
        const cardMap = await decryptJson(FILES.cardMap);
        if (!isRecord(cardMap)) throw new Error('角色卡索引格式无效');
        const index = await decryptJson(FILES.chatsIndex);
        if (index?.version !== 2 || !isRecord(index.chats)) throw new Error('聊天索引格式无效');
        const chats = {};
        for (const key of Object.keys(index.chats)) {
            const chat = await decryptJson(chatFilePath(key));
            if (chat?.version !== 2 || chat.key !== key) throw new Error('聊天分片与索引不一致');
            chats[key] = chat.value;
        }
        const workshop = await decryptJson(FILES.workshop, true);
        if (workshop !== null && (!isRecord(workshop) || !Array.isArray(workshop.characters))) {
            throw new Error('角色工坊状态无效');
        }
        return { data: { ...stateFile.state, ...chats }, workshop, workshopPresent: workshop !== null, cardMap };
    };

    const api = Object.freeze({ FILES, createSnapshot, readSnapshot, splitState });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.RPHubSyncSnapshot = api;
})(typeof window !== 'undefined' ? window : null);
