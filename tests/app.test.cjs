const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const baseline = require('./baseline.json');
const plain = value => JSON.parse(JSON.stringify(value));

function app(initial = {}, blocked = false) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const timers = new Map();
  let timerId = 0;
  const nodes = new Map();
  const context = {
    URL, console,
    window: { scrollTo() {} },
    document: {
      baseURI: 'http://localhost:8000/',
      getElementById(id) {
        if (id === 'boot') return null;
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '' });
        return nodes.get(id);
      },
      querySelectorAll: () => [], addEventListener() {},
    },
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return data.get(key) || null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); data.set(key, value); },
    },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    confirm: () => true,
    fetch: async () => { throw Error('Unexpected network request'); },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, data, timers, nodes };
}

test('formulas, defaults, documento, texto copiado e CSS iguais ao original', () => {
  const hash = value => createHash('sha256').update(value).digest('hex');
  for (const [name, [start, end]] of Object.entries(baseline.sections)) {
    assert.equal(hash(source.slice(source.indexOf(start), source.indexOf(end)).trim()), baseline.hashes[name], name);
  }
  assert.equal(hash(fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8').replace(/\r\n/g, '\n')), baseline.hashes.css);
});

test('paridade de todos os resultados em seis cenarios do motor original', () => {
  const { context: c } = app();
  for (const sample of baseline.cases) {
    const params = { ...c.DEFAULTS, ...sample.overrides };
    const result = c.compute(params);
    assert.deepEqual(plain(result), sample.result);
    assert.deepEqual([0, .15, .3].map(m => result.precoPara(m, c.pc(params.icmsVendaCO), result.co.custoLiq)), sample.precos);
  }
});

test('reabertura preserva parametros, fornecedores, proposta, historico e nuvem', () => {
  const initial = {
    epic_params: { produto: 'Produto salvo', preco: '4.5678', qtdPorVolume: '1309' },
    epic_prop: { cliente: 'Cliente salvo', numero: '099/2026' },
    epic_forn: { B: { nome: 'Fornecedor salvo', fobUnit: '0.4321' } },
    epic_sim_nuvem: { url: 'https://example.invalid', token: 'fake-test-token', empresa: 'teste', auto: '0', freq: '5' },
    epic_num: { seq: 99, ano: 2026, historico: [{ numero: '098/2026', cliente: 'Cliente salvo' }] },
  };
  const { context: c, data } = app(initial);
  assert.equal(c.S.p.produto, initial.epic_params.produto);
  assert.equal(c.S.p.preco, initial.epic_params.preco);
  assert.equal(c.S.prop.numero, initial.epic_prop.numero);
  assert.equal(c.S.forn.B.fobUnit, initial.epic_forn.B.fobUnit);
  assert.deepEqual(plain(c.S.nuvemCfg), initial.epic_sim_nuvem);
  assert.deepEqual(JSON.parse(data.get('epic_sim_nuvem')), initial.epic_sim_nuvem);
  assert.equal(c.contarDoCliente('CLIENTE SALVO'), 1);
  const reloaded = app(Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)]))).context;
  assert.deepEqual(plain(reloaded.S.p), plain(c.S.p));
  assert.deepEqual(plain(reloaded.S.forn), plain(c.S.forn));
  assert.deepEqual(plain(reloaded.S.num), plain(c.S.num));
});

test('novos dados recebem padroes e armazenamento indisponivel nao impede iniciar', () => {
  for (const blocked of [false, true]) {
    const { context: c } = app({}, blocked);
    assert.deepEqual(plain(c.S.nuvemCfg), plain(c.NUVEM_DEF));
    assert.equal(c.S.p.preco, '3.525');
    assert.equal(c.S.forn.A.ptax, '5.23');
    assert.equal(c.compute(c.S.p).direta.custoLiq.toFixed(2), '574125.40');
  }
  assert.equal(app({ epic_num: { historico: 'invalid' } }).context.S.num.historico.length, 0);
  assert.equal(app({ epic_num: { historico: [null, 'invalid', { numero: '001/2026' }] } }).context.S.num.historico.length, 1);
});

test('backup pendente aguarda intervalo e desligar cancela o temporizador', () => {
  const { context: c, timers } = app();
  c.S.nuvemCfg = { ...c.NUVEM_DEF, url: 'https://example.invalid', auto: '1', freq: '10' };
  c.ultimoEnvio = Date.now() - 1000;
  c.agendarNuvem();
  assert.equal(timers.size, 1);
  const pending = [...timers.values()][0];
  assert.ok(pending.delay > 590000 && pending.delay <= 599000);
  let sent = 0;
  c.enviarNuvem = () => sent++;
  pending.fn();
  assert.equal(sent, 1);
  timers.clear();
  c.agendarNuvem();
  c.S.nuvemCfg.auto = '0';
  c.agendarNuvem();
  assert.equal(timers.size, 0);
});

test('enviar, listar e restaurar backup usam contrato original e persistem restauracao', async () => {
  const { context: c, data } = app();
  c.S.nuvemCfg = { ...c.NUVEM_DEF, url: 'https://example.invalid/', token: 'fake-test-token' };
  const requests = [];
  let response = { arquivo: 'backup.json' };
  c.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => response };
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  c.enviarNuvem(true);
  await flush();
  assert.equal(c.S.nuvem.estado, 'ok');
  assert.equal(requests[0].url, 'https://example.invalid/backup');
  const backup = JSON.parse(requests[0].options.body);
  assert.equal(backup.formato, 'epic-simulador-1');
  assert.deepEqual(Object.keys(backup.dados).sort(), ['forn', 'p', 'prop']);
  assert.ok(!requests[0].options.body.includes('fake-test-token'));
  c.enviarNuvem(false);
  assert.equal(requests.length, 1, 'nao reenviar dados identicos');
  response = { itens: [{ arquivo: 'backup.json' }] };
  c.listarNuvem();
  await flush();
  assert.equal(c.S.nuvem.lista[0].arquivo, 'backup.json');
  backup.dados.p.produto = 'Restaurado';
  backup.dados.p.preco = '7,1234';
  backup.dados.forn.B.nome = 'Restaurado B';
  response = backup;
  c.restaurarNuvem('backup.json');
  await flush();
  assert.equal(c.S.p.preco, '7.1234');
  assert.equal(JSON.parse(data.get('epic_params')).produto, 'Restaurado');
  assert.equal(JSON.parse(data.get('epic_forn')).B.nome, 'Restaurado B');
  assert.equal(c.S.nuvemCfg.token, 'fake-test-token');
  response = {};
  c.restaurarNuvem('invalid.json');
  await flush();
  assert.equal(c.S.nuvem.estado, 'erro');
  assert.equal(c.S.p.produto, 'Restaurado');
});

test('falhas HTTP de backup e listagem sao apresentadas sem perder dados', async () => {
  const { context: c } = app();
  c.S.nuvemCfg.url = 'https://example.invalid';
  const params = plain(c.S.p);
  c.fetch = async () => ({ ok: false, status: 401 });
  c.enviarNuvem(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.S.nuvem.estado, 'erro');
  assert.equal(c.S.nuvem.enviando, false);
  assert.match(c.S.nuvem.detalhe, /401/);
  c.listarNuvem();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.S.nuvem.estado, 'erro');
  assert.deepEqual(plain(c.S.p), params);
});
