'use strict';

const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'compat');
const jsOut = path.join(out, 'js');
const cssOut = path.join(out, 'css');

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirEntries(from, to, extension) {
  for (const name of fs.readdirSync(from)) {
    if (extension && path.extname(name) !== extension) continue;
    fs.copyFileSync(path.join(from, name), path.join(to, name));
  }
}

cleanDir(out);
fs.mkdirSync(jsOut, { recursive: true });
fs.mkdirSync(cssOut, { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

const preset = [require.resolve('@babel/preset-env'), {
  targets: { safari: '12' },
  bugfixes: true,
  modules: false,
  loose: true,
}];

for (const name of fs.readdirSync(path.join(root, 'js'))) {
  if (path.extname(name) !== '.js') continue;
  const source = path.join(root, 'js', name);
  const result = babel.transformFileSync(source, {
    filename: source,
    presets: [preset],
    comments: true,
    compact: false,
    sourceMaps: false,
  });
  fs.writeFileSync(path.join(jsOut, name), result.code + '\n');
}

copyDirEntries(path.join(root, 'css'), cssOut, '.css');
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
fs.copyFileSync(path.join(root, 'js', '00-ios12-runtime.js'), path.join(jsOut, '00-ios12-runtime.js'));

const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('src="compat/js/00-ios12-runtime.js"', 'src="js/00-ios12-runtime.js"');
html = html.replace(/src="compat\/js\//g, 'src="js/');
fs.writeFileSync(indexPath, html);

console.log(`Built ${fs.readdirSync(jsOut).length} JS files for Safari 12 in ${path.relative(root, out)}/`);
