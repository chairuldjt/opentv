const fs = require('fs');
const path = require('path');

const channelsFile = path.join(__dirname, 'channels.json');
let channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));

const logosDir = path.join(__dirname, 'public', 'assets', 'logos');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

function generateSvgLogo(text, bgColor) {
    const letter = text.substring(0, 2).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${bgColor}" rx="20"/>
  <text x="50" y="55" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text>
</svg>`;
}

const colors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#0f766e', '#be123c'];

let colorIndex = 0;
for (let channel of channels) {
    // Generate beautiful fallback SVG based on channel name
    const color = colors[colorIndex % colors.length];
    const nameSanitized = channel.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${nameSanitized}_fallback.svg`;
    const filePath = path.join(logosDir, fileName);
    
    // Always generate the local SVG so it's guaranteed to exist
    fs.writeFileSync(filePath, generateSvgLogo(channel.name, color));
    channel.image = `/assets/logos/${fileName}`;
    colorIndex++;
}

fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
console.log('Semua aset logo lokal berhasil digenerate.');
