(function (root) {
    'use strict';

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const toBase64 = bytes => {
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    };
    const fromBase64 = text => Uint8Array.from(atob(text.replace(/\s/g, '')), char => char.charCodeAt(0));

    const deriveKey = async (passphrase, salt) => {
        const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    };
    const readStream = async stream => {
        const reader = stream.getReader();
        const chunks = [];
        let length = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            length += value.byteLength;
        }
        const result = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return result;
    };
    const compress = async text => {
        if (typeof CompressionStream === 'undefined') return encoder.encode(text);
        return readStream(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')));
    };
    const decompress = async bytes => {
        if (typeof DecompressionStream === 'undefined') return decoder.decode(bytes);
        try {
            return decoder.decode(await readStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))));
        } catch {
            return decoder.decode(bytes);
        }
    };
    const encryptText = async (text, passphrase) => {
        if (typeof text !== 'string' || !passphrase) throw new Error('同步口令或内容无效');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt);
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await compress(text)));
        const packed = new Uint8Array(salt.length + iv.length + ciphertext.length);
        packed.set(salt);
        packed.set(iv, salt.length);
        packed.set(ciphertext, salt.length + iv.length);
        return JSON.stringify({ version: 2, encryptedBlob: toBase64(packed), encoding: 'base64+aes-gcm+gzip' });
    };
    const decryptText = async (payload, passphrase) => {
        const envelope = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const encoded = envelope?.encryptedBlob || envelope?.content;
        if (typeof encoded !== 'string' || !passphrase) throw new Error('同步口令或加密文件无效');
        const packed = fromBase64(encoded);
        if (packed.length < 44) throw new Error('加密文件长度无效');
        const key = await deriveKey(passphrase, packed.slice(0, 16));
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: packed.slice(16, 28) }, key, packed.slice(28),
        );
        return decompress(new Uint8Array(plaintext));
    };
    const api = Object.freeze({ encryptText, decryptText });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.RPHubSyncCrypto = api;
})(typeof window !== 'undefined' ? window : null);
