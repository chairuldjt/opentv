const axios = require('axios');
const https = require('https');
const http = require('http');

const urls = [
    'http://khano.nng.cloudns.us/live/m3u8/id/575eeb9f08dc8db.m3u8',
    'http://op-group1-swiftservehd-1.dens.tv/h/h234/02.m3u8'
];

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const httpAgent = new http.Agent({ keepAlive: true });

async function test() {
    for (const url of urls) {
        console.log(`Testing ${url}...`);
        try {
            const res = await axios({
                method: 'GET',
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                httpsAgent,
                httpAgent,
                timeout: 10000
            });
            console.log(`Status: ${res.status}`);
            console.log(`Content-Type: ${res.headers['content-type']}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
            if (e.response) console.log(`Response Status: ${e.response.status}`);
        }
        console.log('---');
    }
}

test();
