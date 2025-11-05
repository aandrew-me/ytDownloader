const fs = require('fs');
const path = require('path');

console.log('=== Package Analysis ===');

// Check package.json
try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('✅ package.json is valid');
    console.log('Name:', pkg.name);
    console.log('Main:', pkg.main);
    console.log('Dependencies:', Object.keys(pkg.dependencies || {}));
    console.log('DevDependencies:', Object.keys(pkg.devDependencies || {}));
} catch (e) {
    console.log('❌ package.json error:', e.message);
}

// Check main.js
try {
    const mainJs = fs.readFileSync('main.js', 'utf8');
    console.log('✅ main.js exists and is readable');
    console.log('Size:', mainJs.length, 'bytes');
} catch (e) {
    console.log('❌ main.js error:', e.message);
}

// Check if node_modules exists
if (fs.existsSync('node_modules')) {
    console.log('✅ node_modules exists');
} else {
    console.log('⚠️ node_modules does not exist (run npm install)');
}

// List some source files
const srcFiles = ['src', 'html', 'resources'];
for (const dir of srcFiles) {
    if (fs.existsSync(dir)) {
        console.log(`✅ ${dir}/ directory exists`);
    } else {
        console.log(`⚠️ ${dir}/ directory missing`);
    }
}