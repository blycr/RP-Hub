// ==UserScript==
// @name         RP-Hub Sync & Plaza LAN Hijack
// @namespace    rphub
// @version      1.1.0
// @description  RP-Hub 跨设备 GitHub 同步 + 广场 LAN 优先/源站兜底资源挟持（支持 Tampermonkey/Violentmonkey/Firefox Mobile）
// @author       You
// @match        https://*.github.io/RP-Hub/*
// @match        https://rphforum.zeabur.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
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
    // 统一配置管理
    // ============================================================
    function getConfig() {
        return {
            // GitHub 同步配置
            githubToken: GM_getValue('github_token', ''),
            githubOwner: GM_getValue('github_owner', ''),
            githubRepo: GM_getValue('github_repo', 'RP-Hub-Sync'),
            githubBranch: GM_getValue('github_branch', SYNC_BRANCH),
            syncPassphrase: GM_getValue('sync_passphrase', ''),

            // 广场资源配置
            lanBaseUrl: GM_getValue('plaza_lan_url', 'http://192.168.31.40:8765'),
            sourceBaseUrl: GM_getValue('plaza_source_url', 'https://rphforum.zeabur.app'),
            enableLan: GM_getValue('plaza_enable_lan', true),

            // 调试
            debug: GM_getValue('rphub_debug', true),
        };
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    function log(...args) {
        const cfg = getConfig();
        if (cfg.debug) {
            console.log('[RP-Hub Sync]', ...args);
        }
    }

    // ============================================================
    // 可视化配置面板
    // ============================================================
    function createConfigPanel() {
        if (document.getElementById('rphub-config-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'rphub-config-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 320px;
            max-height: 90vh;
            overflow-y: auto;
            background: rgba(255,255,255,0.98);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            padding: 16px;
            z-index: 999999;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            color: #1f2937;
        `;

        const cfg = getConfig();
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <strong style="font-size:14px;">RP-Hub 同步配置</strong>
                <button id="rphub-config-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280;">×</button>
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">GitHub Token</label>
                <input type="password" id="rphub-cfg-token" value="${escapeHtml(cfg.githubToken)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">GitHub Owner</label>
                <input type="text" id="rphub-cfg-owner" value="${escapeHtml(cfg.githubOwner)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">Sync Repo</label>
                <input type="text" id="rphub-cfg-repo" value="${escapeHtml(cfg.githubRepo)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">同步口令</label>
                <input type="password" id="rphub-cfg-passphrase" value="${escapeHtml(cfg.syncPassphrase)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">局域网 RP-Hub-Card 地址</label>
                <input type="text" id="rphub-cfg-lan" value="${escapeHtml(cfg.lanBaseUrl)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <div style="font-size:11px;color:#6b7280;margin-top:4px;">例如：http://192.168.31.40:8765</div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="rphub-cfg-enablelan" ${cfg.enableLan ? 'checked' : ''}>
                    <span>启用局域网优先</span>
                </label>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <button id="rphub-btn-save" style="flex:1;padding:8px;border:none;border-radius:6px;background:#4f46e5;color:#fff;cursor:pointer;">保存配置</button>
                <button id="rphub-btn-test-lan" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">测试 LAN</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="rphub-btn-push" style="flex:1;padding:8px;border:none;border-radius:6px;background:#059669;color:#fff;cursor:pointer;">📤 推送</button>
                <button id="rphub-btn-pull" style="flex:1;padding:8px;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;">📥 拉取</button>
            </div>
            <div id="rphub-config-status" style="margin-top:10px;font-size:12px;color:#6b7280;min-height:18px;"></div>
        `;

        document.body.appendChild(panel);

        document.getElementById('rphub-config-close').addEventListener('click', () => panel.remove());
        document.getElementById('rphub-btn-save').addEventListener('click', saveConfigFromPanel);
        document.getElementById('rphub-btn-test-lan').addEventListener('click', testLanConnection);
        document.getElementById('rphub-btn-push').addEventListener('click', pushStateToGitHub);
        document.getElementById('rphub-btn-pull').addEventListener('click', pullStateFromGitHub);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function saveConfigFromPanel() {
        setConfig('github_token', document.getElementById('rphub-cfg-token').value.trim());
        setConfig('github_owner', document.getElementById('rphub-cfg-owner').value.trim());
        setConfig('github_repo', document.getElementById('rphub-cfg-repo').value.trim() || 'RP-Hub-Sync');
        setConfig('sync_passphrase', document.getElementById('rphub-cfg-passphrase').value);
        setConfig('plaza_lan_url', document.getElementById('rphub-cfg-lan').value.trim());
        setConfig('plaza_enable_lan', document.getElementById('rphub-cfg-enablelan').checked);
        showConfigStatus('✅ 配置已保存');
    }

    async function testLanConnection() {
        const cfg = getConfig();
        showConfigStatus('正在测试 LAN...');
        try {
            const res = await fetch(`${cfg.lanBaseUrl}/api/status`, { cache: 'no-cache', signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const data = await res.json();
                showConfigStatus(`✅ LAN 可达，文件数：${data.pic?.length || 'unknown'}`);
            } else {
                showConfigStatus(`❌ LAN 返回 ${res.status}`);
            }
        } catch (e) {
            showConfigStatus(`❌ LAN 不可达：${e.message}`);
        }
    }

    function showConfigStatus(msg) {
        const el = document.getElementById('rphub-config-status');
        if (el) el.textContent = msg;
    }

    // ============================================================
    // 第 1 部分：RP-Hub 状态同步
    // ============================================================
    function initRpHubSync() {
        registerSyncMenu();
        injectSyncButton();
    }

    function registerSyncMenu() {
        try {
            GM_registerMenuCommand('⚙️ RP-Hub 同步配置', createConfigPanel);
            GM_registerMenuCommand('📤 推送状态到 GitHub', pushStateToGitHub);
            GM_registerMenuCommand('📥 从 GitHub 拉取并覆盖', pullStateFromGitHub);
        } catch (e) {
            log('GM_registerMenuCommand failed:', e);
        }
    }

    function injectSyncButton() {
        if (document.getElementById('rphub-floating-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'rphub-floating-btn';
        btn.textContent = '🔄 RP-Hub Sync';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            padding: 10px 16px;
            border-radius: 999px;
            border: none;
            background: #4f46e5;
            color: #fff;
            font-weight: 600;
            box-shadow: 0 4px 14px rgba(0,0,0,0.15);
            cursor: pointer;
        `;
        btn.addEventListener('click', createConfigPanel);
        document.body.appendChild(btn);
    }

    async function pushStateToGitHub() {
        const cfg = getConfig();
        if (!validateSyncConfig(cfg)) return;

        try {
            showConfigStatus('正在读取本地状态...');
            const data = await dumpIndexedDB();
            const json = JSON.stringify(data);
            log('IndexedDB size:', json.length, 'chars');

            showConfigStatus('正在加密...');
            const compressed = await gzipText(json);
            const encrypted = await encrypt(compressed, cfg.syncPassphrase);

            const payload = {
                version: 1,
                exportedAt: Date.now(),
                deviceId: await getDeviceId(),
                encryptedBlob: arrayBufferToBase64(encrypted),
                encoding: 'base64+aes-gcm+gzip',
            };

            showConfigStatus('正在上传到 GitHub...');
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
                url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${SYNC_FILE_PATH}`,
                headers: {
                    Authorization: `token ${cfg.githubToken}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(body),
            });

            notify('✅ 状态已推送到 GitHub');
            showConfigStatus('✅ 推送成功');
        } catch (e) {
            console.error('[RP-Hub Sync] Push failed:', e);
            notify('❌ 推送失败: ' + e.message, true);
            showConfigStatus('❌ 推送失败: ' + e.message);
        }
    }

    async function pullStateFromGitHub() {
        const cfg = getConfig();
        if (!validateSyncConfig(cfg)) return;

        if (!confirm('确定要从 GitHub 拉取并覆盖本地所有数据吗？\n当前本地的角色、聊天记录、设置等将被替换。')) {
            return;
        }

        try {
            showConfigStatus('正在从 GitHub 下载...');
            const file = await getGitHubFile(cfg);
            if (!file) {
                notify('❌ GitHub 上没有找到同步文件');
                showConfigStatus('❌ 未找到同步文件');
                return;
            }

            const content = base64ToString(file.content);
            const payload = JSON.parse(content);

            showConfigStatus('正在解密...');
            const encrypted = base64ToArrayBuffer(payload.encryptedBlob);
            const compressed = await decrypt(encrypted, cfg.syncPassphrase);
            const json = await gunzipText(compressed);
            const data = JSON.parse(json);

            showConfigStatus('正在覆盖本地 IndexedDB...');
            await restoreIndexedDB(data);

            notify('✅ 恢复完成，即将刷新页面');
            showConfigStatus('✅ 拉取成功，刷新中...');
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            console.error('[RP-Hub Sync] Pull failed:', e);
            notify('❌ 拉取失败: ' + e.message, true);
            showConfigStatus('❌ 拉取失败: ' + e.message);
        }
    }

    function validateSyncConfig(cfg) {
        if (!cfg.githubToken || !cfg.githubOwner || !cfg.githubRepo || !cfg.syncPassphrase) {
            notify('请先配置 GitHub 同步参数', true);
            createConfigPanel();
            return false;
        }
        return true;
    }

    async function getGitHubFile(cfg) {
        try {
            const res = await githubRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${SYNC_FILE_PATH}?ref=${cfg.githubBranch}`,
                headers: {
                    Authorization: `token ${cfg.githubToken}`,
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

                store.clear();
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
    // gzip 压缩/解压
    // ============================================================
    async function gzipText(text) {
        if (typeof CompressionStream === 'undefined') {
            return new TextEncoder().encode(text).buffer;
        }
        const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
        return readStreamToBuffer(stream);
    }

    async function gunzipText(buffer) {
        if (typeof DecompressionStream === 'undefined') {
            return new TextDecoder().decode(buffer);
        }
        try {
            const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
            const text = await readStreamToBuffer(stream);
            return new TextDecoder().decode(text);
        } catch (e) {
            return new TextDecoder().decode(buffer);
        }
    }

    async function readStreamToBuffer(stream) {
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

    // ============================================================
    // GitHub API 请求封装
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
        log(message);
        showConfigStatus(message);
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
        log('Plaza hijack initialized');
        injectFloatingPlazaButton();
        hookNetworkRequests();
        hookImageSrc();
        observeDownloadButtons();
    }

    function injectFloatingPlazaButton() {
        if (document.getElementById('rphub-plaza-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'rphub-plaza-btn';
        btn.textContent = '🔄 RP-Hub 广场配置';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            padding: 10px 16px;
            border-radius: 999px;
            border: none;
            background: #4f46e5;
            color: #fff;
            font-weight: 600;
            box-shadow: 0 4px 14px rgba(0,0,0,0.15);
            cursor: pointer;
        `;
        btn.addEventListener('click', createConfigPanel);
        document.body.appendChild(btn);
    }

    function hookNetworkRequests() {
        const cfg = getConfig();
        const originalFetch = unsafeWindow.fetch;

        unsafeWindow.fetch = async function (url, options) {
            const urlStr = typeof url === 'string' ? url : url?.url || '';
            log('fetch intercepted:', urlStr);
            const resolved = await resolveUrl(urlStr, cfg);
            if (resolved) {
                log('Redirect fetch:', urlStr, '->', resolved.url, `(source: ${resolved.source})`);
                return originalFetch.call(this, resolved.url, options);
            }
            return originalFetch.call(this, url, options);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            this._rphub_url = url;
            this._rphub_method = method;
            return originalOpen.call(this, method, url, async, user, password);
        };

        XMLHttpRequest.prototype.send = async function (body) {
            const url = this._rphub_url;
            const method = this._rphub_method || 'GET';
            log('XHR intercepted:', url);
            const resolved = await resolveUrl(url, cfg);
            if (resolved && originalOpen) {
                log('Redirect XHR:', url, '->', resolved.url, `(source: ${resolved.source})`);
                originalOpen.call(this, method, resolved.url, true);
            }
            return originalSend.call(this, body);
        };
    }

    function hookImageSrc() {
        const cfg = getConfig();

        const rewrite = async (img) => {
            const src = img.getAttribute('src');
            if (!src || img.dataset.rphubProcessed) return;
            img.dataset.rphubProcessed = 'true';
            const resolved = await resolveUrl(src, cfg);
            if (resolved) {
                log('Redirect img:', src, '->', resolved.url);
                img.src = resolved.url;
                img.dataset.rphubSource = resolved.source;
            }
        };

        document.querySelectorAll('img').forEach(rewrite);
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

    function observeDownloadButtons() {
        // 在卡片容器上监听点击，尝试识别下载按钮
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('button, a, [role="button"]');
            if (!target) return;

            // 检查是否是下载按钮（根据文本或 class）
            const text = (target.textContent || target.title || '').toLowerCase();
            const isDownload = /下载|download|保存|save/.test(text);
            if (!isDownload) return;

            log('Download button clicked:', target);

            // 尝试从按钮周围找到卡片 ID
            const cardId = findCardIdNearElement(target);
            if (!cardId) return;

            e.preventDefault();
            e.stopPropagation();

            const cfg = getConfig();
            const resolved = await resolveUrlByCardId(cardId, cfg);
            if (!resolved) {
                log('No resolved URL for card:', cardId);
                return;
            }

            log('Direct download:', cardId, '->', resolved.url, `(source: ${resolved.source})`);
            triggerDownload(resolved.url, `${cardId}.png`);
        }, true);
    }

    function findCardIdNearElement(el) {
        // 向上查找 data-card-id 或 data-id
        let current = el;
        for (let i = 0; i < 8 && current; i++) {
            const id = current.dataset?.cardId || current.dataset?.id || current.dataset?.card_id || current.dataset?.plazaId;
            if (id) return id;

            // 从 href 中提取
            const link = current.querySelector?.('a[href*="/card/"], a[href*="/download/"]') ||
                         current.closest?.('a[href*="/card/"], a[href*="/download/"]');
            if (link) {
                const url = link.getAttribute('href');
                const idFromUrl = getPlazaCardIdFromUrl(url);
                if (idFromUrl) return idFromUrl;
            }

            current = current.parentElement;
        }
        return null;
    }

    function getPlazaCardIdFromUrl(url) {
        if (!url) return null;
        try {
            const u = new URL(url, location.href);
            const patterns = [
                /\/api\/download\/([^/?#]+)/,
                /\/api\/card\/([^/?#]+)/,
                /\/api\/cards\/([^/?#]+)/,
                /\/card\/([^/?#]+)/,
                /\/cards\/([^/?#]+)/,
                /\/download\/([^/?#]+)/,
                /\/file\/([^/?#]+)/,
                /\/plaza\/card\/([^/?#]+)/,
                /[?&]card_id=([^&#]+)/,
                /[?&]id=([^&#]+)/,
            ];
            for (const p of patterns) {
                const m = (u.pathname + u.search).match(p);
                if (m) return decodeURIComponent(m[1]);
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    async function resolveUrl(url, cfg) {
        const cardId = getPlazaCardIdFromUrl(url);
        if (!cardId) return null;
        return resolveUrlByCardId(cardId, cfg);
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
            log('LAN manifest fetch failed:', e.message);
            return null;
        }
    }

    async function resolveUrlByCardId(cardId, cfg) {
        // 1. 优先 LAN
        if (cfg.enableLan && cfg.lanBaseUrl) {
            const manifest = await getLanManifest(cfg);
            if (manifest && manifest[cardId] && manifest[cardId].filename) {
                return {
                    url: `${cfg.lanBaseUrl}/api/image/${encodeURIComponent(manifest[cardId].filename)}`,
                    source: 'lan',
                    cardId,
                };
            }
        }

        // 2. 源站直链（绕过 UI 鉴权）
        // 这里需要根据源站实际下载地址构造，常见模式：
        return {
            url: `${cfg.sourceBaseUrl}/api/download/${encodeURIComponent(cardId)}`,
            source: 'source',
            cardId,
        };
    }

    function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
    }

    // 注入样式
    const style = document.createElement('style');
    style.textContent = `
        [data-rphub-source="lan"] { outline: 2px solid #22c55e !important; outline-offset: -2px; }
        [data-rphub-source="source"] { outline: 2px solid #f59e0b !important; outline-offset: -2px; }
    `;
    document.head.appendChild(style);
})();
