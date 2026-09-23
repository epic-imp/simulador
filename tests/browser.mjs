// Node 22+ e Chrome/Edge instalados. Sem bibliotecas adicionais.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.env.EPIC_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
assert.ok(browser, 'Defina EPIC_BROWSER com o caminho do Chrome ou Edge.');
assert.ok(existsSync(path.join(root, 'dist/index.html')), 'Execute python build.py primeiro.');
const temporary = mkdtempSync(path.join(tmpdir(), 'epic-browser-'));
const failures = [];
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(root + path.sep) || !existsSync(filename)) {
    failures.push(pathname);
    response.writeHead(404).end();
    return;
  }
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png' }[path.extname(filename)];
  response.writeHead(200, { 'Content-Type': mime || 'application/octet-stream', 'Cache-Control': 'no-store' });
  response.end(readFileSync(filename));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${path.join(temporary, 'profile')}`, 'about:blank'], { windowsHide: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Chrome nao iniciou em 20 segundos')), 20000);
    let stderr = '';
    chrome.on('error', error => { clearTimeout(timer); reject(error); });
    chrome.stderr.on('data', chunk => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.on('exit', code => { clearTimeout(timer); reject(Error(`Chrome encerrou: ${code}`)); });
  });
  socket = new WebSocket(endpoint);
  await once(socket, 'open');
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  });
  function call(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`Timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params = {}) => call(method, params, sessionId);
  await page('Page.enable');
  await page('Runtime.enable');
  async function evaluate(expression) {
    const result = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function navigate(url) {
    await page('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && typeof S !== 'undefined' && !!document.querySelector('#tabs button')`)) return;
      await delay(100);
    }
    throw Error('Pagina nao carregou: ' + url);
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  async function input(selector, value) {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      el.focus(); el.value = ${JSON.stringify(value)};
      el.setSelectionRange(el.value.length, el.value.length);
      el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    await delay(350);
  }
  for (const entry of ['/index.html', '/dist/index.html', '/dist/epic-simulador.html']) {
    await navigate(origin + entry);
    assert.equal(await evaluate('TABS.length'), 9);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".top")).backgroundColor'), 'rgb(31, 78, 121)');
    assert.ok(await evaluate('Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)'));
    const tabs = await evaluate('TABS.map(t => t[0])');
    for (const mode of ['direta', 'co']) {
      await click(`[data-mode="${mode}"]`);
      for (const tab of tabs) {
        await click(`[data-tab="${tab}"]`);
        assert.ok(await evaluate('document.querySelector("#sheet").textContent.length > 100'));
        assert.ok(!await evaluate('/NaN|undefined|O simulador falhou/.test(document.querySelector("#sheet").textContent)'));
      }
    }
    console.log(`OK: nove abas, duas modalidades, CSS e imagens em ${entry}`);
  }
  await navigate(origin + '/index.html');
  await evaluate(`localStorage.setItem('epic_sim_nuvem', JSON.stringify({url:'https://example.invalid',token:'fake-test-token',empresa:'teste',auto:'0',freq:'5'}))`);
  await navigate(origin + '/index.html?reload=1');
  assert.equal(await evaluate('S.nuvemCfg.token'), 'fake-test-token');
  await click('[data-tab="parametros"]');
  await input('[data-k="preco"]', '4,5678');
  await evaluate('document.activeElement.blur()');
  assert.equal(await evaluate('S.p.preco'), '4.5678');
  await click('[data-tab="fornecedores"]');
  await click('[data-forn="B"]');
  await input('[data-store="forn"][data-k="nome"]', 'Fornecedor de teste');
  assert.equal(await evaluate('document.activeElement.getAttribute("data-k")'), 'nome');
  assert.equal(await evaluate('document.activeElement.selectionStart'), 19);
  await input('[data-store="forn"][data-k="fobUnit"]', '0,4321');
  assert.equal(await evaluate('document.activeElement.value'), '0,4321');
  await evaluate('document.activeElement.blur()');
  await click('[data-tab="demonstrativo"]');
  await input('[data-store="prop"][data-k="cliente"]', 'Cliente de teste');
  await navigate(origin + '/index.html?reload=2');
  assert.equal(await evaluate('S.p.preco'), '4.5678');
  assert.equal(await evaluate('S.forn.B.fobUnit'), '0.4321');
  assert.equal(await evaluate('S.forn.B.nome'), 'Fornecedor de teste');
  assert.equal(await evaluate('S.prop.cliente'), 'Cliente de teste');
  assert.equal(await evaluate('S.nuvemCfg.token'), 'fake-test-token');
  console.log('OK: edicao numerica, foco do fornecedor e persistencia apos reabrir');

  await click('[data-tab="fornecedores"]');
  await click('[data-forn="B"]');
  await evaluate('window.confirm = () => true');
  await click('[data-act="fornAplicar"]');
  assert.equal(await evaluate('S.p.fobUnit'), '0.4321');
  await click('[data-tab="fornecedores"]');
  await click('[data-forn="C"]');
  await click('[data-act="fornCopiar"]');
  assert.equal(await evaluate('S.forn.C.fobUnit'), '0.4321');

  await click('[data-tab="demonstrativo"]');
  await evaluate(`Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text => {window.copiedText = text;}}});
    window.print = () => {window.printVersion = S.versaoCliente; window.printTitle = document.title; window.dispatchEvent(new Event('afterprint'));};`);
  await click('#btnCopy');
  assert.match(await evaluate('window.copiedText'), /Cliente de teste/);
  const proposal = await evaluate('S.prop.numero');
  await click('[data-act="pdfInterna"]');
  await delay(200);
  assert.equal(await evaluate('window.printVersion'), false);
  assert.match(await evaluate('window.printTitle'), /Demonstrativo-interno/);
  assert.ok(await evaluate(`jaEmitida(${JSON.stringify(proposal)})`));
  assert.equal(await evaluate('S.versaoCliente'), true);
  assert.equal(await evaluate('document.body.classList.contains("imprimindo")'), false);
  await click('[data-act="pdfCliente"]');
  await delay(200);
  assert.equal(await evaluate('window.printVersion'), true);
  for (const version of ['cliente', 'interna']) {
    await click(`[data-ver="${version}"]`);
    const { data } = await page('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    const pdf = Buffer.from(data, 'base64');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    writeFileSync(path.join(temporary, version + '.pdf'), pdf);
  }
  await click('[data-act="novaProposta"]');
  assert.notEqual(await evaluate('S.prop.numero'), proposal);
  console.log('OK: fornecedores, copia de texto, historico, fluxo de impressao e dois PDFs renderizados');
  await click('[data-tab="resumo"]');
  const screenshot = await page('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(temporary, 'resumo.png'), Buffer.from(screenshot.data, 'base64'));
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero")).gridTemplateColumns.split(" ").length'), 1);
  await navigate(pathToFileURL(path.join(root, 'dist/index.html')).href);
  assert.ok(await evaluate('Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)'));
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log('OK: layout movel e HTML autonomo aberto por file://; sem erros JS ou recursos ausentes');
  console.log('Artefatos temporarios:', temporary);
  await call('Browser.close');
} finally {
  socket?.close();
  chrome.kill();
  server.close();
}
