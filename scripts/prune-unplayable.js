const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');

const channelsPath = path.join(__dirname, '..', 'channels.json');
const removedPath = path.join(__dirname, '..', 'channels.removed.json');
const channels = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const timeout = Number(process.env.PRUNE_TIMEOUT_MS || 5000);

function headersFor(channel) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
    };
    for (const [key, val] of Object.entries(channel.headers || {})) {
        if (val && val !== 'none') headers[key] = val;
    }
    return headers;
}

function firstPlayableLine(text) {
    return String(text).split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
}

function resolveUrl(line, base) {
    try {
        return new URL(line, base).href;
    } catch {
        return null;
    }
}

async function request(url, channel, responseType = 'text') {
    return axios({
        url,
        method: 'GET',
        headers: headersFor(channel),
        httpsAgent,
        responseType,
        timeout,
        maxContentLength: 1024 * 1024,
        validateStatus: () => true,
        signal: AbortSignal.timeout(timeout + 1000)
    });
}

async function playable(channel) {
    try {
        if (channel.type !== 'hls') {
            const res = await request(channel.url, channel, 'stream');
            if (res.data && res.data.destroy) res.data.destroy();
            return res.status >= 200 && res.status < 300;
        }

        const manifest = await request(channel.url, channel);
        if (manifest.status < 200 || manifest.status >= 300) return false;

        let next = resolveUrl(firstPlayableLine(manifest.data), channel.url);
        if (!next) return false;

        if (next.includes('.m3u8')) {
            const media = await request(next, channel);
            if (media.status < 200 || media.status >= 300) return false;
            next = resolveUrl(firstPlayableLine(media.data), next);
            if (!next) return false;
        }

        const segment = await request(next, channel, 'stream');
        if (segment.data && segment.data.destroy) segment.data.destroy();
        return segment.status >= 200 && segment.status < 300;
    } catch {
        return false;
    }
}

(async () => {
    const keep = [];
    const removed = [];
    const concurrency = Number(process.argv[2] || 12);

    for (let i = 0; i < channels.length; i += concurrency) {
        const chunk = channels.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(async channel => ({ channel, ok: await playable(channel) })));
        for (const result of results) {
            (result.ok ? keep : removed).push(result.channel);
        }
        process.stderr.write('Checked ' + Math.min(i + concurrency, channels.length) + '/' + channels.length + '\r');
    }

    fs.writeFileSync(channelsPath, JSON.stringify(keep, null, 2));
    fs.writeFileSync(removedPath, JSON.stringify(removed, null, 2));

    console.log(JSON.stringify({ kept: keep.length, removed: removed.length, removedChannels: removed.map(c => c.name) }, null, 2));
})();
