const fs = require('fs');
const path = require('path');
const https = require('https');

const channelsFile = path.join(__dirname, 'channels.json');
let channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));

const keywords = ['volleyball', 'uefa', 'friendly', 'futsal', 'vnl'];

const isTempEvent = (name) => keywords.some(k => name.toLowerCase().includes(k));

// Separate temp events and regular channels
const tempEvents = channels.filter(c => isTempEvent(c.name));
const regularChannels = channels.filter(c => !isTempEvent(c.name));

// Sort regular channels alphabetically, then append temp events
regularChannels.sort((a, b) => a.name.localeCompare(b.name));
channels = [...regularChannels, ...tempEvents];

fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));
console.log('Channels reordered and saved.');
