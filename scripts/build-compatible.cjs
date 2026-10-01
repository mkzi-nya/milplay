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

function listFiles(dir, extension, prefix = '') {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const absolute = path.join(dir, name);
    const relative = path.join(prefix, name);
    if (fs.statSync(absolute).isDirectory()) files.push(...listFiles(absolute, extension, relative));
    else if (!extension || path.extname(name) === extension) files.push(relative);
  }
  return files;
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

const jsFiles = listFiles(path.join(root, 'js'), '.js');
for (const relative of jsFiles) {
  const source = path.join(root, 'js', relative);
  const destination = path.join(jsOut, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const text = fs.readFileSync(source, 'utf8');
  const result = babel.transformSync(text, {
    filename: source,
    presets: [preset],
    comments: true,
    compact: false,
    sourceMaps: false,
  });
  fs.writeFileSync(destination, result.code + '\n');
}

copyDirEntries(path.join(root, 'css'), cssOut, '.css');
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
const fflateRoot = path.resolve(path.dirname(require.resolve('fflate')), '..');
fs.copyFileSync(path.join(fflateRoot, 'umd', 'index.js'), path.join(jsOut, 'fflate.js'));
fs.copyFileSync(path.join(fflateRoot, 'LICENSE'), path.join(out, 'fflate-LICENSE'));

const crypto = require('node:crypto');
/* Safari caches compat/*.js and *.css very aggressively, so a rebuilt file can be
 * served from cache after the source changes and the fix looks like it "did nothing".
 * Append a content hash to every local js/css URL so each build is a distinct URL. */
function contentHash(file) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10); }
  catch { return '0'; }
}
const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/src="compat\/js\//g, 'src="js/');
html = html.replace(/(src|href)="(js|css)\/([^"]+?)(\?[^"]*)?"/g, (match, attr, dir, name) => {
  return `${attr}="${dir}/${name}?v=${contentHash(path.join(out, dir, name))}"`;
});
fs.writeFileSync(indexPath, html);

/* The user opens the repository-root index.html, which points at compat/. Stamp those
 * references with the same content hash so a stale cached compat file can never hide a
 * fix. The token is derived from the built file, and the line is rewritten in place. */
const rootIndexPath = path.join(root, 'index.html');
let rootHtml = fs.readFileSync(rootIndexPath, 'utf8');
rootHtml = rootHtml
  .replace(/((?:compat\/)?(?:js|css)\/[^"?]+)\?v=[0-9a-f]+/g, '$1')
  .replace(/"(compat\/(js|css)\/([^"?]+))"/g, (m, rel, dir, name) =>
    `"${rel}?v=${contentHash(path.join(out, dir, name))}"`)
  .replace(/"(css\/([^"?]+))"/g, (m, rel, name) =>
    `"${rel}?v=${contentHash(path.join(root, 'css', name))}"`);
fs.writeFileSync(rootIndexPath, rootHtml);

console.log(`Built ${jsFiles.length} JS files for Safari 12 in ${path.relative(root, out)}/`);
