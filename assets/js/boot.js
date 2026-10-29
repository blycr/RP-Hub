// Small, dependency-free boot watchdog for the main application. Keep this
// synchronous and outside the deferred dependency chain so it can report a
// missing script instead of leaving the entry screen forever.
(function () {
    const startedAt = Date.now();
    let finished = false;
    const shell = () => document.getElementById('rphub-boot-shell');
    const setState = (state, message) => {
        const element = shell();
        if (!element) return;
        element.dataset.state = state;
        const status = element.querySelector('[data-boot-status]');
        if (status) status.textContent = message;
        element.querySelector('[data-boot-actions]')?.toggleAttribute('hidden', state !== 'error');
    };
    const showError = () => {
        if (finished) return;
        setState('error', '页面未能完成加载。请重试；如果问题持续，可清理本站缓存。');
    };
    window.RPHubBoot = {
        ready() {
            finished = true;
            window.__rphubBootAt = performance.now();
            document.documentElement.dataset.appFirstPaint = String(Math.round(window.__rphubBootAt));
            setState('ready', '');
            document.documentElement.classList.add('rphub-ready');
            window.dispatchEvent(new CustomEvent('rphub:ready'));
            setTimeout(() => shell()?.remove(), 450);
        },
        fail: showError,
    };
    window.addEventListener('error', event => {
        if (!finished && event.target instanceof HTMLScriptElement) showError();
    }, true);
    window.addEventListener('unhandledrejection', () => {
        if (!finished) showError();
    });
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!finished && Date.now() - startedAt > 9000) showError();
        }, 10000);
        document.addEventListener('click', async event => {
            const action = event.target.closest?.('[data-boot-action]')?.dataset.bootAction;
            if (action === 'reload') location.reload();
            if (action === 'clear-cache') {
                setState('loading', '正在清理本站缓存…');
                try {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }
                    localStorage.removeItem('rphub.registration');
                    sessionStorage.clear();
                    location.reload();
                } catch (error) {
                    console.error(error);
                    showError();
                }
            }
        });
    });
})();