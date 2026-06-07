const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');

const channels = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'channels.json'), 'utf8'));
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const REQUEST_TIMEOUT = Number(process.env.AUDIT_TIMEOUT_MS || 8000);

function headersFor(channel) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
    };
    for (const [key, val] of Object.entries(channel.headers || {})) {
        if (val && val !== 'none') headers[key] = val;
    }
    return headers;
}

function resolveLine(line, baseUrl) {
    try {
        return new URL(line.trim(), baseUrl).href;
    } catch {
        return null;
    }
}

function firstPlayableLine(text) {
    return String(text).split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
}

async function get(url, channel, responseType = 'text') {
    return axios({
        method: 'GET',
        url,
        headers: headersFor(channel),
        httpsAgent,
        timeout: REQUEST_TIMEOUT,
        responseType,
        validateStatus: () => true
    });
}

async function auditHls(channel) {
    const manifest = await get(channel.url, channel);
    if (manifest.status < 200 || manifest.status >= 300) return { ok: false, stage: 'manifest', status: manifest.status };

    const first = firstPlayableLine(manifest.data);
    if (!first) return { ok: false, stage: 'manifest-empty', status: manifest.status };

    let mediaUrl = resolveLine(first, channel.url);
    if (!mediaUrl) return { ok: false, stage: 'manifest-url', status: manifest.status };

    if (mediaUrl.includes('.m3u8')) {
        const media = await get(mediaUrl, channel);
        if (media.status < 200 || media.status >= 300) return { ok: false, stage: 'media-playlist', status: media.status, url: mediaUrl };
        const segment = firstPlayableLine(media.data);
        if (!segment) return { ok: false, stage: 'media-empty', status: media.status, url: mediaUrl };
        mediaUrl = resolveLine(segment, mediaUrl);
    }

    const segmentRes = await get(mediaUrl, channel, 'stream');
    if (segmentRes.data && segmentRes.data.destroy) segmentRes.data.destroy();
    return { ok: segmentRes.status >= 200 && segmentRes.status < 300, stage: 'segment', status: segmentRes.status, url: mediaUrl };
}

async function auditChannel(channel) {
    try {
        if (channel.type === 'hls') return { channel, ...(await auditHls(channel)) };
        const manifest = await get(channel.url, channel, 'stream');
        if (manifest.data && manifest.data.destroy) manifest.data.destroy();
        return { channel, ok: manifest.status >= 200 && manifest.status < 300, stage: 'manifest', status: manifest.status };
    } catch (error) {
        return { channel, ok: false, stage: 'error', error: error.message };
    }
}

(async () => {
    const results = [];
    const concurrency = Number(process.argv[2] || 6);
    for (let i = 0; i < channels.length; i += concurrency) {
        const chunk = channels.slice(i, i + concurrency);
        const audited = await Promise.all(chunk.map(auditChannel));
        results.push(...audited);
        process.stderr.write(`Audited ${Math.min(i + concurrency, channels.length)}/${channels.length}\r`);
    }

    const failed = results.filter(r => !r.ok);
    console.log(JSON.stringify({
        total: results.length,
        ok: results.length - failed.length,
        failed: failed.length,
        failures: failed.map(r => ({
            id: r.channel.id,
            name: r.channel.name,
            type: r.channel.type,
            stage: r.stage,
            status: r.status,
            error: r.error,
            url: r.url || r.channel.url
        }))
    }, null, 2));
})();
