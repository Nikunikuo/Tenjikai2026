import fs from 'node:fs';
fs.copyFileSync('dist-local/local.html', 'dist-local/index.html');
console.log('Local exhibition build ready: dist-local/index.html');
