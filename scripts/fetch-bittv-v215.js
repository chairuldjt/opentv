const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = 'https://raw.githubusercontent.com/suaraalamraya/datv/main/bittv/v215/';
const COUNTRIES = ['ID'];
const CHANNELS_PATH = path.join(__dirname, '..', 'channels.json');
const BACKUP_PATH = path.join(__dirname, '..', 'channels.backup.json');

function decodeBitTvPayload(payload) {
    const input = String(payload).trim();

    for (let offset = 0; offset < 512; offset++) {
        try {
            const first = Buffer.from([...input.slice(offset)].reverse().join(''), 'base64').toString('utf8');
            const second = Buffer.from([...first].reverse().join(''), 'base64').toString('utf8');
            const decoded = [...second].reverse().join('');
            if (decoded.trimStart().startsWith('{')) return decoded;
        } catch {
            // Try next offset. BitTV prefixes encrypted payloads with patch metadata.
        }
    }

    throw new Error('Unable to decode BitTV payload');
}

function classifyType(url, urlLicense, headerLicense) {
    const lowerUrl = String(url || '').toLowerCase();
    const lowerLicense = String(urlLicense || '').toLowerCase();
    const looksLikeClearKey = /^[0-9a-f]{32}:[0-9a-f]{32}$/i.test(String(urlLicense || ''))
        || String(urlLicense || '').startsWith('ey');
    const hasWidevine = headerLicense && String(headerLicense.widevine || '').toLowerCase().startsWith('http');

    if (!looksLikeClearKey && (hasWidevine || lowerLicense.includes('widevine'))) return 'dash-widevine';
    if (lowerUrl.includes('.mpd')) return 'dash';
    if (lowerUrl.includes('.m3u8')) return 'hls';
    if (lowerUrl.includes('.ts')) return 'ts';
    return 'hls';
}

function parseJsonObject(value, fallback) {
    try {
        if (!value || value === 'none') return fallback;
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function convertChannel(item, group) {
    const headers = parseJsonObject(item.header_iptv, {});
    const licenseHeaders = parseJsonObject(item.header_license, {});
    const url = item.hls || '';
    const key = item.url_license && item.url_license !== 'none'
        ? item.url_license
        : (licenseHeaders.widevine || licenseHeaders['x-data'] || '');

    return {
        id: String(item.id || ''),
        name: item.name || item.namespace || '',
        group,
        type: classifyType(url, item.url_license, licenseHeaders),
        url,
        key,
        headers: {
            Referer: headers.Referer || 'none',
            Origin: headers.Origin || 'none',
            'User-Agent': headers['User-Agent'] || 'none'
        },
        image: item.image || ''
    };
}

async function fetchCountry(country) {
    const url = `${BASE_URL}${country}.json`;
    const response = await axios.get(url, {
        responseType: 'text',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            Referer: 'https://duktek.id/',
            Origin: 'https://duktek.id'
        }
    });

    const data = JSON.parse(decodeBitTvPayload(response.data));
    const group = data.country_name || country;
    return (data.info || []).map(item => convertChannel(item, group));
}

(async () => {
    const channels = (await Promise.all(COUNTRIES.map(fetchCountry))).flat();

    if (!fs.existsSync(BACKUP_PATH) && fs.existsSync(CHANNELS_PATH)) {
        fs.copyFileSync(CHANNELS_PATH, BACKUP_PATH);
    }

    fs.writeFileSync(CHANNELS_PATH, JSON.stringify(channels, null, 2));
    console.log(`Wrote ${channels.length} channels to ${CHANNELS_PATH}`);
})();
