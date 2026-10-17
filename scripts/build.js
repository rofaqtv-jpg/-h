#!/usr/bin/env node

/**
 * Build script for Driving Simulator
 * Copies and optimizes files for production
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = 'dist';
const SOURCE_DIRS = ['js', 'css'];

console.log('🚗 Building Driving Simulator...\n');

// Create build directory
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Copy HTML
console.log('📄 Copying index.html...');
fs.copyFileSync('index.html', path.join(BUILD_DIR, 'index.html'));

// Copy directories
SOURCE_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
        console.log(`📁 Copying ${dir}/...`);
        copyDirSync(dir, path.join(BUILD_DIR, dir));
    }
});

// Create libs directory
const libsDir = path.join(BUILD_DIR, 'libs');
if (!fs.existsSync(libsDir)) {
    fs.mkdirSync(libsDir, { recursive: true });
}

console.log('\n✅ Build complete!');
console.log(`📦 Output: ${BUILD_DIR}/`);
console.log('\nTo test locally:');
console.log('  npx http-server dist -p 8080');

function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
