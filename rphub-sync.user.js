// ==UserScript==
// @name         RP-Hub Sync & Plaza LAN Hijack
// @namespace    rphub
// @version      1.0.0
// @description  RP-Hub 跨设备 GitHub 同步 + 广场 LAN 优先/源站兜底资源挟持
// @author       You
// @match        https://*.github.io/RP-Hub/*
// @match        https://rphforum.zeabur.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 配置常量
    // ============================================================
    const DB_NAME = 'RPHubDB';
    const DB_STORE = 'store';
    const SYNC_FILE_PATH = 'rp-hub-sync/snapshot.enc.json';
    const SYNC_BRANCH = 'main';

    // ============================================================
    // 环境判断
    // ============================================================
    const isRpHub = /github\.io\/RP-Hub/.test(location.href);
    const isPlaza = location.hostname.includes('rphforum.zeabur.app');

    if (isRpHub) {
        initRpHubSync();
    } else if (isPlaza) {
        initPlazaHijack();
    }

    // ============================================================
    // 第 1 部分：RP-Hub 状态同步
    // ============================================================
    function initRpHubSync() {
        registerSyncMenu();
        injectSyncPanel();
    }

    function registerSyncMenu() {
        try {
            GM_registerMenuCommand('📤 推送状态到 GitHub', pushStateToGitHub);
            GM_registerMenuCommand('📥 从 GitHub 拉取并覆盖', pullStateFromGitHub);
            GM_registerMenuCommand('⚙️ 同步设置', openSyncSettings);
        } catch (e) {
            console.warn('[RP-Hub Sync] GM_registerMenuCommand failed:', e);
        }
    }

    function getSyncConfig() {
        return {
            token: GM_getValue('github_token', ''),
            owner: GM_getValue('github_owner', ''),
            repo: GM_getValue('github_repo', 'RP-Hub-Sync'),
            branch: GM_getValue('github_branch', SYNC_BRANCH),
            passphrase: GM_getValue('sync_passphrase', ''),
        };
    }

    function setSyncConfig(key, value) {
        GM_setValue(key, value);
    }

    function openSyncSettings() {
        const cfg = getSyncConfig();
        const token = prompt('GitHub Personal Access Token:', cfg.token);
        if (token === null) return;
        const owner = prompt('GitHub Owner（用户名）:', cfg.owner);
        if (owner === null) return;
        const repo = prompt('GitHub Sync 仓库名:', cfg.repo);
        if (repo === null) return;
        const passphrase = prompt('同步加密口令（所有设备需相同）:', cfg.passphrase);
        if (passphrase === null) return;

        setSyncConfig('github_token', token.trim());
        setSyncConfig('github_owner', owner.trim());
        setSyncConfig('github_repo', repo.trim());
        setSyncConfig('sync_passphrase', passphrase);

        notify('同步设置已保存');
    }

    async function pushStateToGitHub() {
        const cfg = getSyncConfig();
        if (!validateConfig(cfg)) return;

        try {
            notify('正在读取本地状态...');
            const data = await dumpIndexedDB();
            const json = JSON.stringify(data);

            notify('正在加密...');
            const compressed = await gzipText(json);
            const encrypted = await encrypt(compressed, cfg.passphrase);

            const payload = {
                version: 1,
                exportedAt: Date.now(),
                deviceId: await getDeviceId(),
                encryptedBlob: arrayBufferToBase64(encrypted),
                encoding: 'base64+aes-gcm+gzip',
            };

            notify('正在上传到 GitHub...');
            const content = stringToBase64(JSON.stringify(payload));
            const existing = await getGitHubFile(cfg);
            const body = {
                message: `RP-Hub sync from ${await getDeviceId()} @ ${new Date().toISOString()}`,
                content: content,
            };
            if (existing && existing.sha) {
                body.sha = existing.sha;
            }

            await githubRequest({
                method: 'PUT',
                url: `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${SYNC_FILE_PATH}`,
                headers: {
                    Authorization: `token ${cfg.token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(body),
            });

            notify('✅ 状态已推送到 GitHub');
        } catch (e) {
            console.error('[RP-Hub Sync] Push failed:', e);
            notify('❌ 推送失败: ' + e.message, true);
        }
    }

    async function pullStateFromGitHub() {
        const cfg = getSyncConfig();
        if (!validateConfig(cfg)) return;

        if (!confirm('确定要从 GitHub 拉取并覆盖本地所有数据吗？\n当前本地的角色、聊天记录、设置等将被替换。')) {
            return;
        }

        try {
            notify('正在从 GitHub 下载...');
            const file = await getGitHubFile(cfg);
            if (!file) {
                notify('❌ GitHub 上没有找到同步文件');
                return;
            }

            const content = base64ToString(file.content);
            const payload = JSON.parse(content);

            notify('正在解密...');
            const encrypted = base64ToArrayBuffer(payload.encryptedBlob);
            const compressed = await decrypt(encrypted, cfg.passphrase);
            const json = await gunzipText(compressed);
            const data = JSON.parse(json);

            notify('正在覆盖本地 IndexedDB...');
            await restoreIndexedDB(data);

            notify('✅ 恢复完成，即将刷新页面');
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            console.error('[RP-Hub Sync] Pull failed:', e);
            notify('❌ 拉取失败: ' + e.message, true);
        }
    }

    function validateConfig(cfg) {
        if (!cfg.token || !cfg.owner || !cfg.repo || !cfg.passphrase) {
            notify('请先配置 GitHub 同步参数（脚本菜单 → 同步设置）', true);
            openSyncSettings();
            return false;
        }
        return true;
    }

    async function getGitHubFile(cfg) {
        try {
            const res = await githubRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${SYNC_FILE_PATH}?ref=${cfg.branch}`,
                headers: {
                    Authorization: `token ${cfg.token}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            return JSON.parse(res.responseText);
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    }

    // ============================================================
    // 注入设置面板到 RP-Hub 页面
    // ============================================================
    function injectSyncPanel() {
        const checkInterval = setInterval(() => {
            const settingsView = document.querySelector('[v-if*="currentView === \'settings\'"]') ||
                                 document.querySelector('#app');
            if (!settingsView) return;

            // 避免重复注入
            if (document.getElementById('rphub-sync-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'rphub-sync-panel';
            panel.style.cssText = 'margin-top: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff;';
            panel.innerHTML = `
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">RP-Hub 跨设备同步</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="rphub-btn-push" style="padding: 8px 16px; border-radius: 8px; border: none; background: #4f46e5; color: #fff; cursor: pointer;">📤 推送到 GitHub</button>
                    <button id="rphub-btn-pull" style="padding: 8px 16px; border-radius: 8px; border: none; background: #059669; color: #fff; cursor: pointer;">📥 从 GitHub 拉取</button>
                    <button id="rphub-btn-config" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer;">⚙️ 设置</button>
                </div>
                <div id="rphub-sync-status" style="margin-top: 10px; font-size: 13px; color: #6b7280;"></div>
            `;

            // 尝试插入到设置页末尾或 body
            const target = document.querySelector('.max-w-3xl') || document.body;
            target.appendChild(panel);

            document.getElementById('rphub-btn-push').addEventListener('click', pushStateToGitHub);
            document.getElementById('rphub-btn-pull').addEventListener('click', pullStateFromGitHub);
            document.getElementById('rphub-btn-config').addEventListener('click', openSyncSettings);

            clearInterval(checkInterval);
        }, 1000);
    }

    // ============================================================
    // IndexedDB 读取与恢复
    // ============================================================
    async function dumpIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readonly');
                const store = tx.objectStore(DB_STORE);
                const data = {};

                const cursorReq = store.openCursor();
                cursorReq.onerror = () => reject(cursorReq.error);
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        data[cursor.key] = cursor.value;
                        cursor.continue();
                    } else {
                        db.close();
                        resolve(data);
                    }
                };
            };
        });
    }

    async function restoreIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readwrite');
                const store = tx.objectStore(DB_STORE);

                // 清空
                store.clear();

                // 写入
                for (const [key, value] of Object.entries(data)) {
                    store.put(value, key);
                }

                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            };
        });
    }

    // ============================================================
    // 加密/解密
    // ============================================================
    async function deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encrypt(plaintext, passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );
        const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(ciphertext), salt.length + iv.length);
        return result.buffer;
    }

    async function decrypt(ciphertext, passphrase) {
        const data = new Uint8Array(ciphertext);
        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const encrypted = data.slice(28);
        const key = await deriveKey(passphrase, salt);
        return crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
    }

    // ============================================================
    // gzip 压缩/解压（优先 CompressionStream，降级不压缩）
    // ============================================================
    async function gzipText(text) {
        if (typeof CompressionStream === 'undefined') {
            return new TextEncoder().encode(text).buffer;
        }
        const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
        const chunks = [];
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const totalLength = chunks.reduce((a, b) => a + b.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }

    async function gunzipText(buffer) {
        if (typeof DecompressionStream === 'undefined') {
            return new TextDecoder().decode(buffer);
        }
        try {
            const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
            const chunks = [];
            const reader = stream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            const totalLength = chunks.reduce((a, b) => a + b.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            return new TextDecoder().decode(result);
        } catch (e) {
            // 可能未压缩，直接解码
            return new TextDecoder().decode(buffer);
        }
    }

    // ============================================================
    // GitHub API 请求封装（GM_xmlhttpRequest + fetch 降级）
    // ============================================================
    function githubRequest(options) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    ...options,
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) {
                            resolve(res);
                        } else {
                            const err = new Error(`GitHub API ${res.status}: ${res.responseText}`);
                            err.status = res.status;
                            reject(err);
                        }
                    },
                    onerror: (err) => reject(err),
                });
            } else {
                // Via 等浏览器可能不支持 GM_xmlhttpRequest，降级 fetch
                fetch(options.url, {
                    method: options.method,
                    headers: options.headers,
                    body: options.data,
                })
                    .then(async (res) => {
                        const text = await res.text();
                        if (res.ok) {
                            resolve({ responseText: text });
                        } else {
                            const err = new Error(`GitHub API ${res.status}: ${text}`);
                            err.status = res.status;
                            reject(err);
                        }
                    })
                    .catch(reject);
            }
        });
    }

    // ============================================================
    // 工具函数
    // ============================================================
    async function getDeviceId() {
        let id = GM_getValue('device_id', '');
        if (!id) {
            id = 'device-' + Math.random().toString(36).slice(2) + '-' + Date.now();
            GM_setValue('device_id', id);
        }
        return id;
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function stringToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function base64ToString(base64) {
        return decodeURIComponent(escape(atob(base64.replace(/\s/g, ''))));
    }

    function notify(message, isError = false) {
        console.log('[RP-Hub Sync]', message);
        const statusEl = document.getElementById('rphub-sync-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = isError ? '#dc2626' : '#6b7280';
        }
        try {
            if (typeof GM_notification === 'function') {
                GM_notification({ title: 'RP-Hub Sync', text: message });
            }
        } catch (e) {
            // ignore
        }
    }

    // ============================================================
    // 第 2 部分：广场 Hijack（LAN 优先 + 源站直链兜底）
    // ============================================================
    function initPlazaHijack() {
        const cfg = getPlazaConfig();

        // Hook fetch
        const originalFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function (url, options) {
            const resolved = await resolveUrl(url, cfg);
            if (resolved) {
                console.log('[RP-Hub Plaza] Redirect fetch:', url, '->', resolved.url);
                return originalFetch.call(this, resolved.url, options);
            }
            return originalFetch.call(this, url, options);
        };

        // Hook XHR
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            this._rphub_url = url;
            this._rphub_method = method;
            return originalOpen.call(this, method, url, async, user, password);
        };
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = async function (body) {
            const url = this._rphub_url;
            const method = this._rphub_method || 'GET';
            const resolved = await resolveUrl(url, cfg);
            if (resolved && originalOpen) {
                console.log('[RP-Hub Plaza] Redirect XHR:', url, '->', resolved.url);
                originalOpen.call(this, method, resolved.url, true);
            }
            return originalSend.call(this, body);
        };

        // Hook 图片 src（通过 MutationObserver 监听后续加载的 img）
        observeAndRewriteImages(cfg);

        // 注入状态标签样式
        injectPlazaStyles();

        console.log('[RP-Hub Plaza] Hijack initialized. LAN:', cfg.lanBaseUrl);
    }

    function getPlazaConfig() {
        return {
            lanBaseUrl: GM_getValue('plaza_lan_url', 'http://127.0.0.1:8765'),
            sourceBaseUrl: GM_getValue('plaza_source_url', 'https://rphforum.zeabur.app'),
            enableLan: GM_getValue('plaza_enable_lan', true),
        };
    }

    function getPlazaCardIdFromUrl(url) {
        if (!url) return null;
        try {
            const u = new URL(url, location.href);
            // 这里需要根据源站实际 URL 规则调整
            // 常见模式：/api/download/<id>、/card/<id>、/download/<id>
            const patterns = [
                /\/api\/download\/([^/?#]+)/,
                /\/api\/card\/([^/?#]+)/,
                /\/card\/([^/?#]+)/,
                /\/download\/([^/?#]+)/,
            ];
            for (const p of patterns) {
                const m = u.pathname.match(p);
                if (m) return decodeURIComponent(m[1]);
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    let lanManifestCache = null;
    let lanManifestCacheTime = 0;

    async function getLanManifest(cfg) {
        if (!cfg.enableLan || !cfg.lanBaseUrl) return null;
        const now = Date.now();
        if (lanManifestCache && now - lanManifestCacheTime < 60000) {
            return lanManifestCache;
        }
        try {
            const res = await fetch(`${cfg.lanBaseUrl}/manifest.json`, { cache: 'no-cache' });
            if (!res.ok) return null;
            lanManifestCache = await res.json();
            lanManifestCacheTime = now;
            return lanManifestCache;
        } catch (e) {
            console.warn('[RP-Hub Plaza] LAN manifest fetch failed:', e);
            return null;
        }
    }

    async function resolveUrl(url, cfg) {
        if (typeof url !== 'string') return null;

        const cardId = getPlazaCardIdFromUrl(url);
        if (!cardId) return null;

        // 1. 优先 LAN
        const manifest = await getLanManifest(cfg);
        if (manifest && manifest[cardId] && manifest[cardId].filename) {
            return {
                url: `${cfg.lanBaseUrl}/api/image/${encodeURIComponent(manifest[cardId].filename)}`,
                source: 'lan',
                cardId,
            };
        }

        // 2. 源站直链（绕过 UI 鉴权）
        // 直接返回原 URL，因为已经识别为卡片下载链接
        // 如果源站需要特定 host/path，可在这里重写
        return null; // 返回 null 表示不拦截，走原请求
    }

    function observeAndRewriteImages(cfg) {
        const rewrite = async (img) => {
            const src = img.getAttribute('src');
            if (!src) return;
            const resolved = await resolveUrl(src, cfg);
            if (resolved) {
                img.src = resolved.url;
                img.dataset.rphubSource = resolved.source;
            }
        };

        // 初始化时处理已有图片
        document.querySelectorAll('img').forEach(rewrite);

        // 监听新增图片
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                m.addedNodes.forEach((node) => {
                    if (node.tagName === 'IMG') rewrite(node);
                    if (node.querySelectorAll) {
                        node.querySelectorAll('img').forEach(rewrite);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function injectPlazaStyles() {
        const style = document.createElement('style');
        style.textContent = `
            [data-rphub-source="lan"] {
                outline: 2px solid #22c55e !important;
                outline-offset: -2px;
            }
        `;
        document.head.appendChild(style);
    }
})();
