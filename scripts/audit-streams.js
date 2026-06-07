const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');

const CHANNELS_PATH = path.join(__dirname, '..', 'channels.json');
const channels = JSON.parse(fs.readFileSync(CHANNELS_PATH, 'utf8'));

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function checkChannel(channel) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (channel.headers) {
            for (const [key, val] of Object.entries(channel.headers)) {
                if (val && val !== 'none') headers[key] = val;
            }
        }

        const response = await axios({
            method: 'GET',
            url: channel.url,
            headers: headers,
            httpsAgent: httpsAgent,
            timeout: 10000,
            responseType: 'stream',
            validateStatus: () => true
        });

        const ok = response.status >= 200 && response.status < 400;
        response.data.destroy();
        
        return { 
            id: channel.id, 
            name: channel.name, 
            status: response.status, 
            ok 
        };
    } catch (error) {
        return { 
            id: channel.id, 
            name: channel.name, 
            ok: false, 
            error: error.message 
        };
    }
}

async function runAudit() {
    console.log(`Auditing ${channels.length} channels...\n`);
    
    const stats = {
        total: channels.length,
        reachable: 0,
        failed: 0,
        types: {},
        failures: []
    };

    // Process in chunks of 5
    const concurrency = 5;
    for (let i = 0; i < channels.length; i += concurrency) {
        const chunk = channels.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(checkChannel));
        
        results.forEach((res, idx) => {
            const channel = chunk[idx];
            stats.types[channel.type] = (stats.types[channel.type] || 0) + 1;
            
            if (res.ok) {
                stats.reachable++;
            } else {
                stats.failed++;
                stats.failures.push({
                    name: res.name,
                    id: res.id,
                    error: res.status || res.error
                });
            }
        });
        
        process.stdout.write(`Progress: ${Math.min(i + concurrency, channels.length)}/${channels.length}\r`);
    }

    console.log('\n\n--- Audit Summary ---');
    console.log(`Total: ${stats.total}`);
    console.log(`Reachable: ${stats.reachable}`);
    console.log(`Failed: ${stats.failed}`);
    console.log('\nBy Type:');
    Object.entries(stats.types).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });

    if (stats.failures.length > 0) {
        console.log('\nFailed Channels Sample:');
        stats.failures.slice(0, 10).forEach(f => {
            console.log(`  [${f.id}] ${f.name}: ${f.error}`);
        });
    }
}

runAudit();
