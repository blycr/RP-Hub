(function (root) {
    'use strict';

    const SYNC_PREFIX = 'rp-hub-sync/';
    const safeSegment = value => typeof value === 'string'
        && value !== '.' && value !== '..'
        && /^[A-Za-z0-9_.-]{1,100}$/.test(value);
    const safePath = value => typeof value === 'string'
        && value.startsWith(SYNC_PREFIX)
        && value.length < 500
        && value.split('/').every(segment => safeSegment(segment));

    const makeClient = ({ owner, repo, branch = 'main', token, fetchImpl = fetch }) => {
        if (![owner, repo, branch].every(safeSegment) || !String(token || '').trim()) {
            throw new Error('GitHub 同步配置不完整');
        }
        const base = `https://api.github.com/repos/${owner}/${repo}`;
        const request = async (method, path, body, { optional = false } = {}) => {
            const response = await fetchImpl(`${base}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                cache: 'no-store',
            });
            if (optional && response.status === 404) return null;
            if (!response.ok) throw new Error(`GitHub API ${response.status}`);
            return response.json();
        };
        const readText = async (filePath, { optional = false } = {}) => {
            if (!safePath(filePath)) throw new Error('同步文件路径无效');
            const path = filePath.split('/').map(encodeURIComponent).join('/');
            const file = await request('GET', `/contents/${path}?ref=${encodeURIComponent(branch)}`, undefined, { optional });
            if (!file) return null;
            let base64 = file.content;
            if (!base64 && file.sha) {
                const blob = await request('GET', `/git/blobs/${encodeURIComponent(file.sha)}`);
                base64 = blob.content;
            }
            if (typeof base64 !== 'string') throw new Error('GitHub 同步文件缺少内容');
            const binary = atob(base64.replace(/\s/g, ''));
            return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
        };
        const pushAtomic = async (files, deletions, message) => {
            if (!Array.isArray(files) || !Array.isArray(deletions)
                || !files.every(file => safePath(file.path) && typeof file.base64 === 'string')
                || !deletions.every(safePath)) {
                throw new Error('同步文件列表无效');
            }
            const paths = [...files.map(file => file.path), ...deletions];
            if (new Set(paths).size !== paths.length) throw new Error('同步文件路径重复');
            if (!files.length && !deletions.length) throw new Error('没有同步文件变更');
            const ref = await request('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
            const parentSha = ref.object.sha;
            const parentCommit = await request('GET', `/git/commits/${parentSha}`);
            const treeEntries = [];
            for (const file of files) {
                const blob = await request('POST', '/git/blobs', { content: file.base64, encoding: 'base64' });
                treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
            }
            for (const path of deletions) treeEntries.push({ path, mode: '100644', type: 'blob', sha: null });
            const tree = await request('POST', '/git/trees', { base_tree: parentCommit.tree.sha, tree: treeEntries });
            const commit = await request('POST', '/git/commits', {
                message: String(message || 'RP-Hub sync'), tree: tree.sha, parents: [parentSha],
            });
            await request('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false });
            return commit.sha;
        };
        return Object.freeze({ readText, pushAtomic });
    };

    const api = Object.freeze({ makeClient });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.RPHubSyncGitHub = api;
})(typeof window !== 'undefined' ? window : null);
