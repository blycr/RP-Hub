// ==UserScript==
// @name         RP-Hub Sync & Plaza LAN Hijack
// @namespace    rphub
// @version      1.3.1
// @description  RP-Hub 跨设备 GitHub 同步 + 广场 LAN 优先/源站兜底资源挟持 + 下载次数绕过（支持 Tampermonkey/Violentmonkey/Firefox Mobile）
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
// @connect      api.github.com
// @connect      192.168.31.40
// @connect      *
// @run-at       document-start
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

    function onDomReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    // 广场被 RP-Hub 以跨域 iframe 嵌入时，浏览器会拦截 autofocus 并刷控制台警告：
    // "Blocked autofocusing on a <input> element in a cross-origin subframe"。
    // 等价处理：用户首次交互前剥离 autofocus 属性并吞掉程序化 focus()，
    // 交互后恢复正常——行为与浏览器默认完全一致，只是不再告警。
    const inCrossOriginSubframe = (() => {
        try {
            if (window.self === window.top) return false;
            void window.top.location.href; // 跨域访问会抛异常
            return false;
        } catch (e) {
            return true;
        }
    })();

    function suppressIframeAutofocus() {
        let activated = false;
        const mark = () => { activated = true; };
        document.addEventListener('pointerdown', mark, { capture: true, once: true });
        document.addEventListener('keydown', mark, { capture: true, once: true });

        const proto = unsafeWindow.HTMLElement && unsafeWindow.HTMLElement.prototype;
        if (proto && typeof proto.focus === 'function') {
            const origFocus = proto.focus;
            Object.defineProperty(proto, 'focus', {
                configurable: true,
                writable: true,
                value: function (...args) {
                    if (!activated) return;
                    return origFocus.apply(this, args);
                },
            });
        }

        const strip = (root) => {
            if (root.matches && root.matches('[autofocus]')) root.removeAttribute('autofocus');
            if (root.querySelectorAll) {
                root.querySelectorAll('[autofocus]').forEach((el) => el.removeAttribute('autofocus'));
            }
        };
        onDomReady(() => strip(document));
        const mo = new MutationObserver((muts) => {
            if (activated) { mo.disconnect(); return; }
            muts.forEach((m) => m.addedNodes.forEach(strip));
        });
        mo.observe(document.documentElement || document, { childList: true, subtree: true });
        setTimeout(() => mo.disconnect(), 20000);
    }

    // favicon：站点根 favicon.ico 不存在会 404；以 data URI 注入 link，零网络请求。
    // 仓库根目录另有 favicon.svg 实体文件（新文件，上游合并不会冲突丢失）。
    const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="14" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><text x="32" y="41" font-family="'Segoe UI',system-ui,-apple-system,Arial,sans-serif" font-size="26" font-weight="700" fill="#111827" text-anchor="middle" letter-spacing="1">RP</text></svg>`;

    function injectFavicon() {
        if (document.querySelector('link[rel~="icon"]')) return;
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = 'data:image/svg+xml,' + encodeURIComponent(FAVICON_SVG);
        (document.head || document.documentElement).appendChild(link);
    }

    if (isRpHub) {
        injectFavicon();
        onDomReady(initRpHubSync);
    } else if (isPlaza) {
        if (inCrossOriginSubframe) suppressIframeAutofocus();
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
            sourceDownloadTemplate: (() => {
                const v = GM_getValue('plaza_source_download_template', '');
                // 旧默认值（错误的 404 端点）自动迁移到已验证的直链模板
                if (!v || v === 'https://rphforum.zeabur.app/api/cards/{id}/download') {
                    return 'https://rphforum.zeabur.app/api/cards/{id}/download/file';
                }
                return v;
            })(),
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
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">源站下载 URL 模板</label>
                <input type="text" id="rphub-cfg-download-template" value="${escapeHtml(cfg.sourceDownloadTemplate)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <div style="font-size:11px;color:#6b7280;margin-top:4px;">用 {id} 占位，例如：https://rphforum.zeabur.app/api/cards/{id}/download/file</div>
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
                <button id="rphub-btn-push" style="flex:1;padding:8px;border:none;border-radius:6px;background:#059669;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg>推送</button>
                <button id="rphub-btn-pull" style="flex:1;padding:8px;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><polyline points="19 12 12 19 5 12"/></svg>拉取</button>
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
        setConfig('plaza_source_download_template', document.getElementById('rphub-cfg-download-template').value.trim() || 'https://rphforum.zeabur.app/api/cards/{id}/download/file');
        setConfig('plaza_enable_lan', document.getElementById('rphub-cfg-enablelan').checked);
        showConfigStatus('✅ 配置已保存');
    }

    async function testLanConnection() {
        const cfg = getConfig();
        showConfigStatus('正在测试 LAN...');
        try {
            const res = await lanRequest(`${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/status`, { timeout: 5000 });
            if (res && res.status === 200) {
                const data = JSON.parse(res.responseText);
                showConfigStatus(`✅ LAN 可达，文件数：${data.pic ? data.pic.length : 'unknown'}`);
            } else {
                showConfigStatus(`❌ LAN 返回 ${res && res.status}`);
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
    // 广场页面可能被 RP-Hub 以 iframe 嵌入；iframe 内不注入悬浮按钮，避免双层
    function isTopFrame() {
        try {
            return window.self === window.top;
        } catch (e) {
            return true;
        }
    }

    function initRpHubSync() {
        registerSyncMenu();
        if (isTopFrame()) injectSyncButton();
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

    // 白底小圆钮：可自由拖动、松手吸附最近侧边、无操作自动淡化，尽量不打断沉浸感
    const FLOAT_BTN_STYLE = `
        position: fixed;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.08);
        background: rgba(255,255,255,0.92);
        color: #6b7280;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        cursor: grab;
        z-index: 99999;
        opacity: 1;
        transition: opacity .3s;
        backdrop-filter: blur(4px);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    `;

    const SYNC_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none;"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`;

    function makeFloatButton(id, title) {
        if (document.getElementById(id)) return null;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = SYNC_SVG;
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.style.cssText = FLOAT_BTN_STYLE;
        document.body.appendChild(btn);

        // ---------- 位置：记忆 + 恢复（GM 存储跨域共享，两个站点通用） ----------
        const POS_KEY = 'float_btn_pos_v1';
        const saved = GM_getValue(POS_KEY, null);
        const pos = saved && typeof saved === 'object' && saved.side
            ? saved
            : { side: 'right', topRatio: 0.62 };

        const applyPos = (animate) => {
            const w = window.innerWidth, h = window.innerHeight;
            const bw = btn.offsetWidth || 40, bh = btn.offsetHeight || 40;
            const top = Math.min(Math.max(pos.topRatio * h - bh / 2, 8), h - bh - 8);
            const left = pos.side === 'left' ? 8 : w - bw - 8;
            btn.style.transition = animate ? 'left .25s ease, top .25s ease, opacity .3s' : 'opacity .3s';
            btn.style.left = left + 'px';
            btn.style.top = top + 'px';
        };
        applyPos(false);
        window.addEventListener('resize', () => applyPos(false));

        // ---------- 无操作自动淡化 ----------
        let idleTimer = null;
        const wake = () => {
            btn.style.opacity = '1';
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => { btn.style.opacity = '0.3'; }, 3000);
        };
        wake();
        btn.addEventListener('mouseenter', wake);

        // ---------- 拖拽 + 贴边吸附 ----------
        let dragging = false, moved = false, suppressClick = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        btn.addEventListener('pointerdown', (e) => {
            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            const r = btn.getBoundingClientRect();
            startLeft = r.left;
            startTop = r.top;
            btn.style.cursor = 'grabbing';
            try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            wake();
            e.preventDefault();
        });

        btn.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.hypot(dx, dy) > 6) moved = true;
            if (!moved) return;
            btn.style.transition = 'opacity .3s';
            const w = window.innerWidth, h = window.innerHeight;
            const bw = btn.offsetWidth, bh = btn.offsetHeight;
            const nl = Math.min(Math.max(startLeft + dx, 0), w - bw);
            const nt = Math.min(Math.max(startTop + dy, 0), h - bh);
            btn.style.left = nl + 'px';
            btn.style.top = nt + 'px';
            pos.topRatio = (nt + bh / 2) / h;
        });

        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            btn.style.cursor = 'grab';
            if (moved) {
                const r = btn.getBoundingClientRect();
                pos.side = (r.left + r.width / 2) < window.innerWidth / 2 ? 'left' : 'right';
                GM_setValue(POS_KEY, pos);
                applyPos(true);
                suppressClick = true;
                setTimeout(() => { suppressClick = false; }, 80);
            }
            wake();
        };
        btn.addEventListener('pointerup', endDrag);
        btn.addEventListener('pointercancel', endDrag);

        btn.addEventListener('click', (e) => {
            if (suppressClick) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            createConfigPanel();
        });
        return btn;
    }

    function injectSyncButton() {
        makeFloatButton('rphub-floating-btn', 'RP-Hub 同步配置');
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
    // 第 2 部分：广场 Hijack（LAN 优先 + 源站兜底 + 下载次数绕过）
    // ============================================================
    const TRANSPARENT_PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    // 只识别"资源类"URL：缩略图 / 预览图 / 头像 / 下载；
    // 其余 API（卡片详情 /api/cards/<id>、/comments、/view、/settings 等）一律放行不拦截
    function classifyPlazaUrl(rawUrl) {
        if (!rawUrl) return null;
        let path;
        try {
            path = new URL(rawUrl, location.href).pathname;
        } catch (e) {
            return null;
        }
        const m = path.match(/\/api\/cards\/([^/?#\s]+)(?:\/([^/?#\s]+))?\/?$/);
        if (!m) return null;
        const cardId = decodeURIComponent(m[1]);
        const action = m[2] || '';
        if (action === 'thumbnail' || action === 'preview-image' || action === 'avatar') {
            return { type: 'image', cardId, action };
        }
        if (action === 'download') {
            return { type: 'download-api', cardId };
        }
        return null;
    }

    function absolutize(url) {
        try {
            return new URL(url, location.href).href;
        } catch (e) {
            return url;
        }
    }

    function initPlazaHijack() {
        log('Plaza hijack initialized');
        // 网络与图片钩子必须在页面脚本渲染前装好（document-start）
        hookNetworkRequests();
        hookImageSrc();
        observeDownloadButtons();
        onDomReady(() => {
            if (isTopFrame()) injectFloatingPlazaButton();
            injectSourceStyle();
        });
    }

    function injectFloatingPlazaButton() {
        makeFloatButton('rphub-plaza-btn', 'RP-Hub 广场配置');
    }

    function injectSourceStyle() {
        const style = document.createElement('style');
        style.textContent = `
            [data-rphub-source="lan"] { outline: 2px solid #22c55e !important; outline-offset: -2px; }
            [data-rphub-source="source"] { outline: 2px solid #f59e0b !important; outline-offset: -2px; }
        `;
        document.head.appendChild(style);
    }

    // ---------- 网络请求挟持：仅拦截 POST /api/cards/<id>/download ----------
    // 源站的"下载次数"鉴权只是 UI 层面的 POST，角色卡文件本身可匿名直链下载。
    // 这里直接构造 download_url 返回给页面自己的 downloadCard 流程。
    function hookNetworkRequests() {
        const originalFetch = unsafeWindow.fetch;
        if (!originalFetch) return;

        unsafeWindow.fetch = async function (input, init) {
            const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
            const method = ((init && init.method) || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
            const cls = classifyPlazaUrl(urlStr);

            if (cls && cls.type === 'download-api' && method === 'POST') {
                log('Hijack download POST:', cls.cardId);
                try {
                    const resolved = await resolveDownload(cls.cardId, getConfig());
                    return fakeJsonResponse({ download_url: resolved.url, download_counted: false });
                } catch (e) {
                    log('Download resolve failed, fallback to source template:', e.message || e);
                    const template = getConfig().sourceDownloadTemplate;
                    return fakeJsonResponse({
                        download_url: template.replace('{id}', encodeURIComponent(cls.cardId)),
                        download_counted: false,
                    });
                }
            }

            return originalFetch.call(this, input, init);
        };
    }

    // 跨隔离世界最稳妥的伪 Response（页面侧只用 resp.ok / resp.json()）
    function fakeJsonResponse(payload) {
        const text = JSON.stringify(payload);
        return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => JSON.parse(text),
            text: async () => text,
        };
    }

    // ---------- 图片挟持：缩略图/预览图 LAN 优先 ----------
    // 直接 hook HTMLImageElement.prototype.src，覆盖 Vue 属性赋值与 new Image() 两条路径；
    // LAN 命中时换成 blob: URL，规避 HTTPS 页面加载 HTTP 局域网资源的混合内容限制。
    function hookImageSrc() {
        const proto = unsafeWindow.HTMLImageElement && unsafeWindow.HTMLImageElement.prototype;
        if (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, 'src');
            if (desc && desc.set && desc.get) {
                Object.defineProperty(proto, 'src', {
                    configurable: true,
                    enumerable: desc.enumerable,
                    get: function () {
                        return desc.get.call(this);
                    },
                    set: function (value) {
                        const str = String(value);
                        const cls = classifyPlazaUrl(str);
                        if (!cls || cls.type !== 'image') {
                            desc.set.call(this, value);
                            return;
                        }
                        const reqId = (this._rphubReq = (this._rphubReq || 0) + 1);
                        try { this.dataset.rphubCardId = cls.cardId; } catch (e) { /* ignore */ }
                        desc.set.call(this, TRANSPARENT_PX);
                        resolveImage(cls, str, getConfig()).then((resolved) => {
                            if (this._rphubReq !== reqId) return;
                            desc.set.call(this, resolved.url);
                            try { this.dataset.rphubSource = resolved.source; } catch (e) { /* ignore */ }
                        }).catch(() => {
                            if (this._rphubReq !== reqId) return;
                            desc.set.call(this, absolutize(str));
                            try { this.dataset.rphubSource = 'source'; } catch (e) { /* ignore */ }
                        });
                    },
                });
                log('Image src hook installed');
            }
        }

        // MutationObserver 兜底：setAttribute('src') 路径与初始已有 img
        onDomReady(() => {
            const sweep = (img) => {
                if (!img.getAttribute) return;
                const src = img.getAttribute('src');
                if (!src || img.dataset.rphubSource) return;
                const cls = classifyPlazaUrl(src);
                if (!cls || cls.type !== 'image') return;
                img.src = src; // 触发上面的 setter 钩子
            };
            document.querySelectorAll('img').forEach(sweep);
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    if (m.type === 'attributes') {
                        if (m.target.tagName === 'IMG') sweep(m.target);
                        return;
                    }
                    m.addedNodes.forEach((node) => {
                        if (node.tagName === 'IMG') sweep(node);
                        if (node.querySelectorAll) node.querySelectorAll('img').forEach(sweep);
                    });
                });
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src'],
            });
        });
    }

    // ---------- 下载按钮点击挟持（捕获阶段，优先于 Vue 处理器） ----------
    // 源站在次数为 0 时连 POST 都不发直接 toast"下载次数不足"，
    // 所以必须在点击层拦截并走自己的直链下载。
    function observeDownloadButtons() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest && e.target.closest('button, a, [role="button"]');
            if (!target) return;
            const text = `${target.textContent || ''} ${target.title || ''} ${target.getAttribute('aria-label') || ''}`.toLowerCase();
            if (!/下载|download/.test(text)) return;

            const cardId = findCardIdNearElement(target);
            if (!cardId) return; // 找不到卡 ID 则放行原逻辑

            e.preventDefault();
            e.stopImmediatePropagation();
            log('Hijacked download click for card:', cardId);
            doDirectDownload(cardId);
        }, true);
    }

    function findCardIdNearElement(el) {
        let current = el;
        for (let i = 0; i < 12 && current && current !== document.documentElement; i++) {
            const img = current.querySelector &&
                current.querySelector('img[data-rphub-card-id], img[data-card-id], img[src*="/api/cards/"]');
            if (img) {
                const fromDataset = img.dataset.rphubCardId || img.dataset.cardId;
                if (fromDataset) return fromDataset;
                const m = (img.getAttribute('src') || '').match(/\/api\/cards\/([^/?#\s]+)/);
                if (m) return decodeURIComponent(m[1]);
            }
            current = current.parentElement;
        }
        return null;
    }

    // ---------- LAN manifest 缓存（含 in-flight 去重与失败短缓存） ----------
    let lanManifestCache = null;
    let lanManifestCacheTime = 0;
    let lanManifestOk = false;
    let lanManifestPromise = null;

    async function getLanManifest(cfg) {
        if (!cfg.enableLan || !cfg.lanBaseUrl) return null;
        const now = Date.now();
        const ttl = lanManifestOk ? 60000 : 20000; // 失败结果缓存更短，LAN 恢复后快速生效
        if (lanManifestCacheTime && now - lanManifestCacheTime < ttl) {
            return lanManifestCache;
        }
        if (lanManifestPromise) return lanManifestPromise;
        lanManifestPromise = (async () => {
            try {
                const url = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/manifest`;
                const res = await lanRequest(url, { timeout: 5000 });
                if (!res || res.status !== 200) throw new Error('HTTP ' + (res && res.status));
                lanManifestCache = JSON.parse(res.responseText);
                lanManifestOk = true;
                log('LAN manifest loaded, cards:', Object.keys(lanManifestCache).length);
            } catch (e) {
                log('LAN manifest fetch failed:', e.message || e);
                lanManifestCache = null;
                lanManifestOk = false;
            }
            lanManifestCacheTime = Date.now();
            lanManifestPromise = null;
            return lanManifestCache;
        })();
        return lanManifestPromise;
    }

    // GM_xmlhttpRequest 由扩展上下文发请求，可绕过 HTTPS 页面 -> HTTP 局域网的
    // 混合内容限制与 CORS；不可用时降级 fetch（可能被浏览器拦截，仅作兜底）
    function lanRequest(url, { responseType = '', timeout = 8000 } = {}) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    responseType: responseType || undefined,
                    timeout,
                    onload: resolve,
                    onerror: () => reject(new Error('LAN request failed')),
                    ontimeout: () => reject(new Error('LAN request timeout')),
                });
            } else {
                fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(timeout) })
                    .then(async (res) => {
                        if (responseType === 'blob') {
                            resolve({ status: res.status, response: await res.blob() });
                        } else {
                            resolve({ status: res.status, responseText: await res.text() });
                        }
                    })
                    .catch(reject);
            }
        });
    }

    // ---------- URL 解析 ----------
    // 图片 blob URL 不能随 img 加载完就回收（Vue 会复用/克隆 img 节点、
    // 翻译类扩展会重新请求同一 URL），改用 LRU 上限控制内存：
    // 只保留最近 24 个，超出才回收最旧的
    const BLOB_LRU_LIMIT = 24;
    const blobUrlLRU = [];

    function registerBlobUrl(url) {
        blobUrlLRU.push(url);
        while (blobUrlLRU.length > BLOB_LRU_LIMIT) {
            const evicted = blobUrlLRU.shift();
            try { URL.revokeObjectURL(evicted); } catch (e) { /* ignore */ }
        }
    }

    async function resolveImage(cls, rawUrl, cfg) {
        // 1. 局域网优先：manifest 命中则取本地原图 blob
        if (cfg.enableLan && cfg.lanBaseUrl) {
            try {
                const manifest = await getLanManifest(cfg);
                const entry = manifest && manifest[cls.cardId];
                if (entry && entry.filename && entry.is_image !== false) {
                    const lanUrl = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/image/${encodeURIComponent(entry.filename)}`;
                    const res = await lanRequest(lanUrl, { responseType: 'blob', timeout: 15000 });
                    const blob = res && res.status === 200 ? res.response : null;
                    if (blob && blob.size > 0) {
                        log('LAN image hit:', cls.cardId, '->', entry.filename);
                        const blobUrl = URL.createObjectURL(blob);
                        registerBlobUrl(blobUrl);
                        return { url: blobUrl, source: 'lan' };
                    }
                }
            } catch (e) {
                log('LAN image fetch failed:', cls.cardId, e.message || e);
            }
        }
        // 2. 回退：保持源站原始 URL 不改写（缩略图 CDN 链接本身可用）
        return { url: absolutize(rawUrl), source: 'source' };
    }

    async function resolveDownload(cardId, cfg) {
        // 1. 局域网优先
        if (cfg.enableLan && cfg.lanBaseUrl) {
            try {
                const manifest = await getLanManifest(cfg);
                const entry = manifest && manifest[cardId];
                if (entry && entry.filename && entry.is_image !== false) {
                    const lanUrl = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/image/${encodeURIComponent(entry.filename)}`;
                    const res = await lanRequest(lanUrl, { responseType: 'blob', timeout: 30000 });
                    const blob = res && res.status === 200 ? res.response : null;
                    if (blob && blob.size > 0) {
                        const blobUrl = URL.createObjectURL(blob);
                        registerBlobUrl(blobUrl);
                        return {
                            url: blobUrl,
                            source: 'lan',
                            filename: entry.filename,
                        };
                    }
                }
            } catch (e) {
                log('LAN download fetch failed:', cardId, e.message || e);
            }
        }
        // 2. 源站直链（已验证无需鉴权：GET /api/cards/<id>/download/file）
        const template = cfg.sourceDownloadTemplate;
        return {
            url: template.replace('{id}', encodeURIComponent(cardId)),
            source: 'source',
            filename: cardId + '.png',
        };
    }

    // ---------- 下载执行与提示 ----------
    async function doDirectDownload(cardId) {
        showPlazaToast('正在准备下载...');
        try {
            const resolved = await resolveDownload(cardId, getConfig());
            const a = document.createElement('a');
            a.href = resolved.url;
            a.download = resolved.filename || (cardId + '.png');
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (resolved.url.startsWith('blob:')) {
                setTimeout(() => URL.revokeObjectURL(resolved.url), 30000);
            }
            showPlazaToast(resolved.source === 'lan' ? '✅ 已从局域网下载' : '✅ 已从源站直链下载');
        } catch (e) {
            console.error('[RP-Hub Sync] Download failed:', e);
            showPlazaToast('❌ 下载失败: ' + (e.message || e), true);
        }
    }

    let plazaToastTimer = null;
    function showPlazaToast(msg, isError = false) {
        let el = document.getElementById('rphub-plaza-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rphub-plaza-toast';
            el.style.cssText = `
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                padding: 10px 18px;
                border-radius: 999px;
                font-size: 13px;
                font-weight: 600;
                color: #fff;
                background: #111827;
                box-shadow: 0 6px 24px rgba(0,0,0,0.18);
                transition: opacity .3s;
                pointer-events: none;
                max-width: 90vw;
            `;
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.background = isError ? '#dc2626' : '#111827';
        el.style.opacity = '1';
        clearTimeout(plazaToastTimer);
        plazaToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
    }
})();
