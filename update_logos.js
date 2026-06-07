const fs = require('fs');
const path = require('path');

const channelsFile = path.join(__dirname, 'channels.json');
let channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));

const logoMapping = {
    'ANTV HD': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/ANTV_logo_%282009%E2%80%932016%2C_2018%E2%80%93present%29.svg',
    'G.T.V': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/GTV_logo_%282017%E2%80%93present%29.svg',
    'Indosiar': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Indosiar_logo_%282014%E2%80%93present%29.svg',
    'KompasTV': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Kompas_TV_logo.svg',
    'MetroTV': 'https://upload.wikimedia.org/wikipedia/commons/8/87/MetroTV_logo_%282010-present%29.svg',
    'MNCTV': 'https://upload.wikimedia.org/wikipedia/commons/5/58/MNCTV_logo_%282010%E2%80%93present%29.svg',
    'mOji Digital TV': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Moji_logo.svg',
    'R.C.T.I': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/RCTI_logo_%282015%E2%80%93present%29.svg',
    'SCTV': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/SCTV_logo_%282005%E2%80%93present%29.svg',
    'Trans7': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Trans7_logo_%282006%E2%80%93present%29.svg',
    'TransTV HD': 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Trans_TV_logo_%282001%E2%80%93present%29.svg',
    'tvOne': 'https://upload.wikimedia.org/wikipedia/commons/2/23/TvOne_logo.svg',
    'TVRI Nasional': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/TVRI_logo_%282019%E2%80%93present%29.svg',
    'Animax HD': 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Animax_logo_%282016%E2%80%93present%29.svg',
    'AXN': 'https://upload.wikimedia.org/wikipedia/commons/9/9c/AXN_logo_%282015%E2%80%93present%29.svg',
    'CNBC': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/CNBC_logo.svg',
    'CNN': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg',
    'HBO': 'https://upload.wikimedia.org/wikipedia/commons/d/de/HBO_logo.svg',
    'HBO Cinemax': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Cinemax_logo_%282011%E2%80%93present%29.svg',
    'HBO Family': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/HBO_Family_logo_%282011%E2%80%93present%29.svg',
    'HBO Hits': 'https://upload.wikimedia.org/wikipedia/commons/9/91/HBO_Hits_logo_%282011%E2%80%93present%29.svg',
    'HBO Signature': 'https://upload.wikimedia.org/wikipedia/commons/9/91/HBO_Signature_logo_%282011%E2%80%93present%29.svg',
    'BTV': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/BTV_logo_%282023%E2%80%93present%29.svg',
    'Garuda TV': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Garuda_TV_logo_%282023%E2%80%93present%29.svg',
    'RTV': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/RTV_logo_%282014%E2%80%93present%29.svg',
    'Sindo News': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Sindonews_TV_logo.svg'
};

for (let channel of channels) {
    if (logoMapping[channel.name]) {
        channel.image = logoMapping[channel.name];
    } else if (channel.image && channel.image.startsWith('data:image')) {
        channel.image = ''; // Clear broken base64
    }
}

fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
console.log('Channels logos updated in channels.json.');
