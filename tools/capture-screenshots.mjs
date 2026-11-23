// Takes the entry's screenshots from the running game (Node 22, standard library only).
// It serves game/ on a local port, starts desktop Chrome headless, opens the game at each
// scene's ?shot= address, waits until the game says the frame is drawn, and saves what
// Chrome rendered as a JPEG. Nothing is edited afterwards: each file is the browser's frame.
//
//   node tools/capture-screenshots.mjs                 all scenes in shots.json -> screenshots/
//   node tools/capture-screenshots.mjs --only 1-chase  one scene
//   node tools/capture-screenshots.mjs --query "?shot=chase&seed=3" --out ../tmp/test.jpg
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameDir = join(root, 'game');
const WIDTH = 1280;
const HEIGHT = 800;
const MAX_BYTES = 250 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('No Chrome found; set CHROME_PATH');
  return found;
}

function serveGame() {
  return new Promise((ready) => {
    const server = createServer((request, response) => {
      let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(gameDir, normalize(pathname)));
      if (!file.startsWith(gameDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(file).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => ready(server));
  });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** A minimal Chrome DevTools Protocol client over one page's WebSocket. */
async function connect(debugPort) {
  let target = null;
  for (let attempt = 0; attempt < 100 && !target; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      target = list.find((entry) => entry.type === 'page') ?? null;
    } catch {
      target = null;
    }
    if (!target) await sleep(150);
  }
  if (!target) throw new Error('Chrome did not open a page');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((open, fail) => {
    socket.addEventListener('open', open, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  let nextId = 1;
  const waiting = new Map();
  const consoleLines = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      const { done, fail } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) fail(new Error(message.error.message));
      else done(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      consoleLines.push('EXCEPTION ' + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text));
    } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      consoleLines.push(message.params.type.toUpperCase() + ' ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = nextId;
    nextId += 1;
    waiting.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, consoleLines, close: () => socket.close() };
}

async function captureScene(page, base, query, file) {
  page.consoleLines.length = 0;
  await page.send('Page.navigate', { url: base + '/' + query });
  let ready = false;
  for (let attempt = 0; attempt < 400 && !ready; attempt += 1) {
    await sleep(150);
    const result = await page.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
    ready = result.result.value === true;
  }
  if (!ready) console.log('  warning: the game never reported the frame as ready');
  await sleep(300);
  let bytes = null;
  for (const quality of [90, 84, 78, 72, 64, 56]) {
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length <= MAX_BYTES) break;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  console.log(`${file}  ${bytes.length} bytes`);
  for (const line of page.consoleLines) console.log('  console: ' + line);
}

const server = await serveGame();
const base = `http://127.0.0.1:${server.address().port}`;
const debugPort = 9400 + Math.floor(process.pid % 500);
const profile = mkdtempSync(join(tmpdir(), 'tamarind-shots-'));
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--ignore-gpu-blocklist', '--enable-webgl', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', 'about:blank',
], { stdio: 'ignore' });

try {
  const page = await connect(debugPort);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  const query = argument('--query');
  if (query) {
    await captureScene(page, base, query, resolve(argument('--out') ?? join(root, 'screenshots', 'test.jpg')));
  } else {
    const only = argument('--only');
    const scenes = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
    for (const scene of scenes) {
      if (only && !scene.name.startsWith(only)) continue;
      await captureScene(page, base, scene.query, join(root, 'screenshots', scene.name));
    }
  }
  page.close();
} finally {
  chrome.kill();
  server.close();
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still hold its profile for a moment on Windows; the temp folder is harmless.
  }
}
