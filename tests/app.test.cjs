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

test('reabertura preserva parametros, fornecedores, proposta e historico', () => {
  const initial = {
    epic_params: { produto: 'Produto salvo', preco: '4.5678', qtdPorVolume: '1309' },
    epic_prop: { cliente: 'Cliente salvo', numero: '099/2026' },
    epic_forn: { B: { nome: 'Fornecedor salvo', fobUnit: '0.4321' } },
    epic_num: { seq: 99, ano: 2026, historico: [{ numero: '098/2026', cliente: 'Cliente salvo' }] },
  };
  const { context: c, data } = app(initial);
  assert.equal(c.S.p.produto, initial.epic_params.produto);
  assert.equal(c.S.p.preco, initial.epic_params.preco);
  assert.equal(c.S.prop.numero, initial.epic_prop.numero);
  assert.equal(c.S.forn.B.fobUnit, initial.epic_forn.B.fobUnit);
  assert.equal(c.contarDoCliente('CLIENTE SALVO'), 1);
  const reloaded = app(Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v)]))).context;
  assert.deepEqual(plain(reloaded.S.p), plain(c.S.p));
  assert.deepEqual(plain(reloaded.S.forn), plain(c.S.forn));
  assert.deepEqual(plain(reloaded.S.num), plain(c.S.num));
});

test('novos dados recebem padroes e armazenamento indisponivel nao impede iniciar', () => {
  for (const blocked of [false, true]) {
    const { context: c } = app({}, blocked);
    assert.equal(c.S.p.preco, '3.525');
    assert.equal(c.S.forn.A.ptax, '5.23');
    assert.equal(c.compute(c.S.p).direta.custoLiq.toFixed(2), '574125.40');
  }
  assert.equal(app({ epic_num: { historico: 'invalid' } }).context.S.num.historico.length, 0);
  assert.equal(app({ epic_num: { historico: [null, 'invalid', { numero: '001/2026' }] } }).context.S.num.historico.length, 1);
});

test('aplicacao nao contem chamadas de rede e salva apenas dados locais do simulador', () => {
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/);
  assert.doesNotMatch(source, /https?:\/\//);
  const { data } = app();
  assert.deepEqual([...data.keys()].sort(), ['epic_forn', 'epic_num', 'epic_params', 'epic_prop']);
});
