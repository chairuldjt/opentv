const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const axios = require('axios');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => res.status(204).end());

function getChannels() {
    try {
        const channelsData = fs.readFileSync(path.join(__dirname, 'channels.json'), 'utf8');
        return JSON.parse(channelsData);
    } catch (e) {
        console.error("Error reading channels.json:", e);
        return [];
    }
}

function rewriteUrl(originalUrl, targetUrl, req, channelId) {
    if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('blob:') || originalUrl.startsWith('urn:')) return originalUrl;
    try {
        const absoluteUrl = new URL(originalUrl, targetUrl).href;
        return `${req.protocol}://${req.get('host')}/proxy?id=${channelId}&url=${encodeURIComponent(absoluteUrl)}`;
    } catch (e) {
        return originalUrl;
    }
}

const httpsAgent = new https.Agent({  
  rejectUnauthorized: false,
  ciphers: 'DEFAULT',
  honorCipherOrder: true
});
const httpAgent = new http.Agent({ keepAlive: false });

function getDetikMasterUrl(targetUrl) {
    if (targetUrl.includes('/trans7/')) return 'https://video.detik.com/trans7/smil:trans7.smil/playlist.m3u8';
    if (targetUrl.includes('/transtv/')) return 'https://video.detik.com/transtv/smil:transtv.smil/playlist.m3u8';
    return null;
}

app.get('/api/channels', (req, res) => {
    const CHANNELS = getChannels();
    res.json(CHANNELS.map(ch => ({
        id: ch.id, name: ch.name, group: ch.group, type: ch.type, key: ch.key, url: ch.url, headers: ch.headers, image: ch.image
    })));
});

app.all('/proxy', async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.status(204).end();
    }

    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL is required');
    const channelId = req.query.id;
    const CHANNELS = getChannels();
    const channel = CHANNELS.find(c => c.id === channelId);
    const isM3u8 = targetUrl.endsWith('.m3u8') || targetUrl.includes('.m3u8?');
    const isManifest = targetUrl.endsWith('.mpd') || targetUrl.includes('.mpd?');

    console.log(`[REQ] ${targetUrl}`);

    try {
        const parsedUrl = new URL(targetUrl);
        let finalUrl = targetUrl;
        let finalHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'id-ID,id;q=0.9',
            'Connection': 'keep-alive'
        };

        // Apply channel-specific headers
        if (channel && channel.headers) {
            for (const [key, val] of Object.entries(channel.headers)) {
                if (val && val !== 'none') finalHeaders[key] = val;
            }
        }

        // Special handling for Detik/Trans7
        if (targetUrl.includes('detik.com')) {
            finalHeaders['Referer'] = 'https://www.detik.com/';
            finalHeaders['Origin'] = 'https://www.detik.com';
            finalHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        }

        if (targetUrl.includes('cloudfront.net')) {
            finalHeaders['Host'] = parsedUrl.hostname;
        }

        const responseType = (isM3u8 || isManifest) ? 'text' : 'stream';
        let response = await axios({
            method: req.method,
            url: finalUrl,
            headers: finalHeaders,
            responseType: responseType,
            httpsAgent,
            httpAgent,
            timeout: 20000,
            validateStatus: () => true
        });

        const detikMasterUrl = targetUrl.includes('detik.com') ? getDetikMasterUrl(targetUrl) : null;
        if (response.status === 403 && detikMasterUrl && targetUrl.includes('chunklist_kamiselaluada')) {
            console.warn(`[RETRY] stale Detik chunklist -> ${detikMasterUrl}`);
            finalUrl = detikMasterUrl;
            targetUrl = detikMasterUrl;
            response = await axios({
                method: req.method,
                url: finalUrl,
                headers: finalHeaders,
                responseType: 'text',
                httpsAgent,
                httpAgent,
                timeout: 20000,
                validateStatus: () => true
            });
        }

        console.log(`[RES] ${response.status} - ${targetUrl}`);

        res.status(response.status);
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (isM3u8) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        } else {
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        }
        if (isManifest) res.setHeader('Content-Location', targetUrl);

        if (responseType === 'text') {
            let content = Buffer.isBuffer(response.data) ? response.data.toString('utf8') : response.data;
            const isOk = response.status >= 200 && response.status < 300;
            const contentType = response.headers['content-type'] || '';
            const looksLikeM3u8 = typeof content === 'string' && content.trimStart().startsWith('#EXTM3U');
            const looksLikeMpd = typeof content === 'string' && content.includes('<MPD');

            if (isOk && isM3u8 && looksLikeM3u8) {
                content = content.split('\n').map(line => {
                    const l = line.trim();
                    if (l && !l.startsWith('#')) return rewriteUrl(l, targetUrl, req, channelId);
                    if (l.startsWith('#EXT-X-KEY:')) {
                        return l.replace(/URI="([^"]+)"/, (m, u) => `URI="${rewriteUrl(u, targetUrl, req, channelId)}"`);
                    }
                    return line;
                }).join('\n');
            } else if (isOk && isManifest && (looksLikeMpd || contentType.includes('dash+xml'))) {
                const upstreamBase = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                if (content.includes('<BaseURL>')) {
                    content = content.replace(/<BaseURL>[^<]+<\/BaseURL>/g, `<BaseURL>${upstreamBase}</BaseURL>`);
                } else {
                    content = content.replace(/<MPD([^>]*)>/, `<MPD$1><BaseURL>${upstreamBase}</BaseURL>`);
                }
            }
            res.send(content);
        } else {
            response.data.pipe(res);
        }
    } catch (error) {
        console.error(`[FAIL] ${targetUrl} - ${error.message}`);
        if (!res.headersSent) res.status(500).send(error.message);
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
