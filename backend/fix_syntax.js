const fs = require('fs');
const content = fs.readFileSync('c:/Users/patel/Downloads/gmail/gmail/backend/server.js', 'utf8');
const fixed = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('c:/Users/patel/Downloads/gmail/gmail/backend/server.js', fixed);
console.log('Fixed syntax in server.js');
