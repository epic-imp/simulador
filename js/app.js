"use strict";

/* Sem isto, um erro de execucao deixaria a pagina em branco sem explicacao. */
window.onerror = function(msg, arquivo, linha){
  var alvo = document.getElementById("sheet");
  if (!alvo) return false;
  alvo.innerHTML = '<div style="max-width:640px;margin:40px auto;padding:20px;'
    + 'border-left:3px solid #a4262c;background:#fdf4f4;font-family:system-ui,sans-serif">'
    + '<strong style="display:block;margin-bottom:6px">O simulador falhou ao carregar</strong>'
    + '<p style="margin:0 0 8px;color:#5a6a7a">' + esc(msg) + '</p>'
    + '<p style="margin:0;color:#5a6a7a;font-size:12px">' + esc(arquivo) + ' linha ' + esc(linha) + '</p></div>';
  return false;
};

function resolveAsset(u){ if (u.indexOf("data:") === 0) return u;
  try { return new URL(u, document.baseURI).href; } catch(e){ return u; } }
var VERSAO = "2026.09.09-b";   // carimbo de versao, visivel no rodape e na aba Fontes
var LOGO_DARK = resolveAsset("img/logo-epic.png");
var LOGO_LIGHT = resolveAsset("img/logo-epic-branca.png");

/* ============================ ESTADO ============================ */
var DEFAULTS = {
  produto:"TECIDO COLCHAO", ncm:"5407.61.00", unidade:"m\u00b2", ptax:"5,23",
  origem:"Peru", preferencia:"0",
  nVolumes:"1", qtdPorVolume:"186970", pesoPorVolume:"27", fobUnit:"0,40",
  freteIntl:"9000", seguroPct:"0,60", freteNacional:"0", freteVenda:"0", freteCliente:"0",
  ii:"26", ipiImp:"0", pisImp:"2,10", cofinsImp:"9,65", adicCofins:"0,60",
  afrmm:"8", siscomex:"154,23", antidumping:"0", icmsImp:"0,80", icmsImpCreditavel:"0",
  despachante:"1650", armazenagem:"5862", outras:"0",
  preco:"3,525", icmsVenda:"4", pisVenda:"1,65", cofinsVenda:"7,60", ipiSaida:"0",
  comissao:"0", irpjCsll:"34", despDedutiveis:"0", margemAlvo:"30", tema69:"1",
  ufAdquirente:"BA", tradingPct:"0", tradingFixo:"0", icmsImpCO:"0",
  icmsImpCOCreditavel:"1", icmsVendaCO:"4", creditarServico:"0", despesasInclusas:"0",
  tradingPagaCliente:"0"
};
var PROP_DEF = {
  cliente:"", cnpj:"", numero:"", data:"",
  validade:"15 dias", porto:"Suape", prazo:"60 dias ap\u00f3s confirma\u00e7\u00e3o do pedido",
  pagamento:"30% na confirma\u00e7\u00e3o, 70% contra documentos de embarque", obs:"",
  emitente:"EPIC Importa\u00e7\u00e3o e Exporta\u00e7\u00e3o Ltda", emitenteCnpj:"", contato:""
};
/* Variaveis que pertencem a cada fornecedor. Tudo o que muda conforme a origem
   da mercadoria. Os parametros de venda ficam de fora porque o produto e o preco
   ao cliente sao os mesmos nos tres cenarios. */
var FORN_KEYS = ["nome","origem","preferencia","ptax","nVolumes","qtdPorVolume","pesoPorVolume",
  "fobUnit","freteIntl","seguroPct","freteNacional","ii","ipiImp","pisImp","cofinsImp",
  "adicCofins","afrmm","siscomex","antidumping","icmsImp","icmsImpCreditavel",
  "despachante","armazenagem","outras"];

function fornPadrao(nome){
  var o = { nome: nome };
  for (var i = 0; i < FORN_KEYS.length; i++){
    var k = FORN_KEYS[i];
    if (k !== "nome") o[k] = DEFAULTS[k];
  }
  return normalizar(o);
}
function loadForn(){
  var base = { A: fornPadrao("Fornecedor A"), B: fornPadrao("Fornecedor B"), C: fornPadrao("Fornecedor C") };
  try {
    var raw = localStorage.getItem("epic_forn");
    if (raw){
      var o = JSON.parse(raw);
      ["A","B","C"].forEach(function(id){
        if (!o[id]) return;
        for (var i = 0; i < FORN_KEYS.length; i++){
          var k = FORN_KEYS[i];
          if (o[id][k] !== undefined) base[id][k] = o[id][k];
        }
        normalizar(base[id]);
      });
    }
  } catch(e){}
  return base;
}

/* Junta os parametros de venda com as variaveis de um fornecedor. */
function paramsForn(id){
  var out = Object.assign({}, S.p);
  var f = S.forn[id];
  for (var i = 0; i < FORN_KEYS.length; i++){
    var k = FORN_KEYS[i];
    if (k !== "nome" && f[k] !== undefined) out[k] = f[k];
  }
  return out;
}

function load(k, def){
  try{ var raw = localStorage.getItem(k); if(!raw) return Object.assign({},def);
       var o = JSON.parse(raw); var out = Object.assign({},def);
       for(var i in def){ if(o[i]!==undefined) out[i]=o[i]; } return out;
  }catch(e){ return Object.assign({},def); }
}
function save(){
  try{ localStorage.setItem("epic_params", JSON.stringify(S.p));
       localStorage.setItem("epic_prop", JSON.stringify(S.prop));
       localStorage.setItem("epic_forn", JSON.stringify(S.forn)); }catch(e){}
}

/* ==================================================================
   NUMERA\u00c7\u00c3O DAS PROPOSTAS
   Sequencial real, gravado no navegador. Reinicia a cada ano.
   ================================================================== */
function hojeBR(){ return new Date().toLocaleDateString("pt-BR"); }
function pad3(n){ n = String(n); while (n.length < 3) n = "0" + n; return n; }

function carregarNum(){
  var o = { seq:0, ano:new Date().getFullYear(), historico:[] };
  try{
    var raw = localStorage.getItem("epic_num");
    if (raw){
      var d = JSON.parse(raw);
      if (typeof d.seq === "number") o.seq = d.seq;
      if (typeof d.ano === "number") o.ano = d.ano;
      if (Array.isArray(d.historico)) o.historico = d.historico.filter(function(x){
        return x && typeof x === "object" && !Array.isArray(x);
      });
    }
  }catch(e){}
  return o;
}
function salvarNum(){ try{ localStorage.setItem("epic_num", JSON.stringify(S.num)); }catch(e){} }

function proximoNumero(){
  var ano = new Date().getFullYear();
  if (S.num.ano !== ano){ S.num.ano = ano; S.num.seq = 0; }   // vira o ano, reinicia
  S.num.seq++;
  salvarNum();
  return pad3(S.num.seq) + "/" + ano;
}
function jaEmitida(numero){
  for (var i = 0; i < S.num.historico.length; i++)
    if (S.num.historico[i].numero === numero) return true;
  return false;
}
/* Grava a proposta no hist\u00f3rico. Chamado ao gerar o PDF. */
function registrarProposta(c){
  if (jaEmitida(S.prop.numero)) return false;
  S.num.historico.unshift({
    numero: S.prop.numero,
    cliente: S.prop.cliente || "(sem cliente)",
    data: S.prop.data || hojeBR(),
    produto: S.p.produto || "",
    quantidade: c ? qty(c.qtd) + " " + u() : "",
    valor: c ? money(c.totalCliente) : "",
    modalidade: S.modo === "co" ? "Conta e ordem" : "Direta"
  });
  if (S.num.historico.length > 200) S.num.historico.length = 200;
  salvarNum();
  return true;
}
function contarDoCliente(nome){
  var alvo = String(nome || "").trim().toLowerCase(), n = 0;
  S.num.historico.forEach(function(x){
    if (String(x.cliente || "").trim().toLowerCase() === alvo && alvo) n++;
  });
  return n;
}

/* ============================ NUMEROS ============================ */
/* Casas decimais de cada campo numerico. Campos com 0 nunca tem parte
   fracionaria, entao ponto e virgula neles sao sempre separador de milhar. */
var NUMF = { ptax:4, preferencia:0, nVolumes:0, qtdPorVolume:0, pesoPorVolume:3, fobUnit:4,
  freteIntl:2, seguroPct:2, freteNacional:2, freteVenda:4, freteCliente:2, ii:2, ipiImp:2, pisImp:2,
  cofinsImp:2, adicCofins:2, afrmm:2, siscomex:2, antidumping:4, icmsImp:2, despachante:2,
  armazenagem:2, outras:2, preco:4, icmsVenda:2, pisVenda:2, cofinsVenda:2, ipiSaida:2,
  comissao:2, irpjCsll:2, despDedutiveis:2, margemAlvo:2, tradingPct:2, tradingFixo:2,
  icmsImpCO:2, icmsVendaCO:2 };

/* Carregar somente depois de definir a precisao numerica. */
var S = { p:normalizar(load("epic_params", DEFAULTS)), prop:load("epic_prop", PROP_DEF),
          forn:loadForn(), fornAtivo:"A",
          num:carregarNum(),
          tab:"resumo", modo:"direta", versaoCliente:true };

/* Interpreta o texto digitado sabendo quantas casas decimais o campo aceita. */
function parseField(txt, dec){
  var s = String(txt === null || txt === undefined ? "" : txt).replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  var neg = s.indexOf("-") === 0;
  s = s.replace(/-/g, "");
  if (dec === 0){
    s = s.replace(/[.,]/g, "");                 // inteiro: separador so pode ser milhar
  } else {
    var dp = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    if (dp >= 0){
      var sep = s.charAt(dp);
      var vezes = s.split(sep).length - 1;      // repetido = milhar
      var ini = s.slice(0, dp).replace(/[.,]/g, "");
      var fim = s.slice(dp + 1).replace(/[.,]/g, "");
      s = (vezes > 1) ? (ini + fim) : (ini + "." + fim);
    }
  }
  var x = parseFloat(s);
  if (!isFinite(x)) return 0;
  return neg ? -x : x;
}

/* Formato de exibicao, com separador de milhar. Se o resultado sair com ponto de
   milhar e nenhuma virgula, forca as casas decimais: sem isso "1650" viraria
   "1.650" e a releitura seguinte devolveria 1,65. */
function fmtNum(v, dec){
  var x = parseField(v, dec);
  var s = x.toLocaleString("pt-BR", {minimumFractionDigits:0, maximumFractionDigits:dec});
  if (dec > 0 && s.indexOf(".") >= 0 && s.indexOf(",") < 0){
    s = x.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:dec});
  }
  return s;
}

/* Converte todo campo numerico para a forma canonica: ponto decimal, sem milhar.
   E o que fica guardado no estado, para o num() nunca ficar ambiguo. */
function normalizar(obj){
  for (var k in NUMF){
    if (obj[k] !== undefined) obj[k] = String(parseField(obj[k], NUMF[k]));
  }
  return obj;
}

function num(v){
  if (typeof v === "number") return isFinite(v)?v:0;
  if (v === null || v === undefined) return 0;
  var s = String(v).trim().replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  var neg = s.charAt(0) === "-"; s = s.replace(/-/g,"");
  var hasC = s.indexOf(",") >= 0, hasD = s.indexOf(".") >= 0;
  if (hasC && hasD){ s = s.replace(/\./g,""); s = s.replace(/,/g,"."); }
  else if (hasC){ var pc = s.split(","); s = pc.length>2 ? pc.join("") : pc.join("."); }
  else if (hasD){ var pd = s.split("."); s = pd.length>2 ? pd.join("") : pd.join("."); }
  var x = parseFloat(s);
  if (!isFinite(x)) return 0;
  return neg ? -x : x;
}
function pc(v){ return num(v)/100; }
function brl(v,d){ d = (d===undefined)?2:d; v = isFinite(v)?v:0;
  return v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function money(v,d){ return "R$ " + brl(v,d); }
function perc(v,d){ d=(d===undefined)?2:d; return brl((isFinite(v)?v:0)*100,d) + "%"; }
function qty(v){ return brl(v,0); }
function esc(s){ return String(s===undefined||s===null?"":s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

/* ============================ CALCULO ============================ */
function compute(p){
  var ptax = num(p.ptax), nVol = num(p.nVolumes);
  var qtd = num(p.qtdPorVolume) * nVol;
  var peso = num(p.pesoPorVolume) * nVol;
  var fobUSD = qtd * num(p.fobUnit);

  var fobBRL = fobUSD * ptax;
  var freteBRL = num(p.freteIntl) * nVol * ptax;
  var seguroBRL = fobUSD * pc(p.seguroPct) * ptax;
  var va = fobBRL + freteBRL + seguroBRL;

  var prefer = Math.max(0, Math.min(100, num(p.preferencia)))/100;
  var iiAliq = pc(p.ii) * (1 - prefer);
  var ii = va * iiAliq;
  var ipiImp = (va + ii) * pc(p.ipiImp);
  var pisImp = va * pc(p.pisImp);
  var cofinsImp = va * pc(p.cofinsImp);
  var adicCofins = va * pc(p.adicCofins);
  var afrmm = freteBRL * pc(p.afrmm);
  var siscomex = num(p.siscomex);
  var antidumping = num(p.antidumping) * peso * ptax;
  var subFed = ii + ipiImp + pisImp + cofinsImp + adicCofins + afrmm + siscomex + antidumping;

  var baseIcms = va + subFed;
  function grossUp(r){ return (r >= 1 || r <= 0) ? (r<=0?0:0) : baseIcms * r / (1 - r); }

  var freteNacTotal = num(p.freteNacional) * nVol;
  // frete do porto ate o cliente, pago por ele direto \u00e0 transportadora:
  // fica fora da base de impostos, do custo e do resultado. Entra s\u00f3 como
  // informa\u00e7\u00e3o de custo unit\u00e1rio para o cliente.
  var freteClienteTotal = num(p.freteCliente) * nVol;
  var freteClienteUnit = qtd ? freteClienteTotal / qtd : 0;
  var armazTotal = num(p.armazenagem) * nVol;

  var icmsImpD = grossUp(pc(p.icmsImp));
  var despLocaisD = num(p.despachante) + armazTotal + num(p.outras) + freteNacTotal;
  var desembolsadoD = va + subFed + icmsImpD + despLocaisD;
  var credIcmsD = icmsImpD * num(p.icmsImpCreditavel);
  var custoLiqD = desembolsadoD - ipiImp - pisImp - cofinsImp - credIcmsD;

  var inclusas = num(p.despesasInclusas) === 1;
  var servicoTrading = va * pc(p.tradingPct) + num(p.tradingFixo) * nVol;   // taxa fixa por conteiner
  // quando o cliente paga a trading direto, a taxa sai do custo, da base de
  // impostos e do resultado, exatamente como o frete pago por ele
  var tradingCli = num(p.tradingPagaCliente) === 1;
  var servicoEmpresa = tradingCli ? 0 : servicoTrading;
  var despachanteCO = inclusas ? 0 : num(p.despachante);
  var armazCO = inclusas ? 0 : armazTotal;
  var outrasCO = inclusas ? 0 : num(p.outras);
  var despLocaisCO = servicoEmpresa + despachanteCO + armazCO + outrasCO + freteNacTotal;
  var icmsImpCO = grossUp(pc(p.icmsImpCO));
  var credIcmsCO = icmsImpCO * num(p.icmsImpCOCreditavel);
  var credServico = servicoEmpresa * (pc(p.pisVenda) + pc(p.cofinsVenda)) * num(p.creditarServico);
  var desembolsadoCO = va + subFed + icmsImpCO + despLocaisCO;
  var custoLiqCO = desembolsadoCO - ipiImp - pisImp - cofinsImp - credIcmsCO - credServico;

  var preco = num(p.preco);
  var receita = preco * qtd;
  var ipiNF = receita * pc(p.ipiSaida);
  var totalCliente = receita + ipiNF;
  var comissao = receita * pc(p.comissao);
  var freteVendaTotal = num(p.freteVenda) * qtd;
  var dedut = num(p.despDedutiveis);
  var tema69 = num(p.tema69) === 1;

  function venda(aliqIcms, custoLiq, credIcms){
    var icms = receita * aliqIcms;
    var basePC = tema69 ? (receita - icms) : receita;
    var pis = basePC * pc(p.pisVenda);
    var cofins = basePC * pc(p.cofinsVenda);
    var impostos = icms + pis + cofins;
    var lair = receita - impostos - custoLiq - comissao - freteVendaTotal;
    var base = Math.max(0, lair - dedut);
    var ir = base * pc(p.irpjCsll);
    var liquido = lair - dedut - ir;
    var fatorPC = (tema69 ? (1 - aliqIcms) : 1) * (pc(p.pisVenda) + pc(p.cofinsVenda));
    var denom = 1 - aliqIcms - fatorPC - pc(p.comissao);
    var be = (qtd === 0 || denom <= 0) ? 0 : (custoLiq + freteVendaTotal) / (qtd * denom);
    var beFix = (qtd === 0 || denom <= 0) ? 0 : (custoLiq + freteVendaTotal + dedut) / (qtd * denom);
    var dAlvo = denom - pc(p.margemAlvo);
    var sug = (qtd === 0 || dAlvo <= 0) ? 0 : (custoLiq + freteVendaTotal) / (qtd * dAlvo);
    return { icms:icms, pis:pis, cofins:cofins, impostos:impostos, basePC:basePC,
      lair:lair, base:base, ir:ir, liquido:liquido, be:be, beFixos:beFix,
      sugerido:sug, sugeridoComIpi:sug*(1+pc(p.ipiSaida)), denom:denom,
      margemOp: receita? lair/receita : 0, margemLiq: receita? liquido/receita : 0,
      lucroUnit: qtd? liquido/qtd : 0, lucroVolume: nVol? liquido/nVol : 0,
      markup: custoLiq? receita/custoLiq : 0,
      custoUnitVenda: (qtd? custoLiq/qtd : 0) + (qtd? impostos/qtd : 0) + (qtd? comissao/qtd : 0) + num(p.freteVenda),
      credIcms: credIcms, saldoCredorIcms: Math.max(0, credIcms - icms) };
  }

  var D = venda(pc(p.icmsVenda), custoLiqD, credIcmsD);
  var CO = venda(pc(p.icmsVendaCO), custoLiqCO, credIcmsCO);

  function precoPara(margem, aliqIcms, custoLiq){
    var fatorPC = (tema69 ? (1 - aliqIcms) : 1) * (pc(p.pisVenda) + pc(p.cofinsVenda));
    var d = 1 - aliqIcms - fatorPC - pc(p.comissao) - margem;
    return (qtd === 0 || d <= 0) ? 0 : (custoLiq + freteVendaTotal) / (qtd * d);
  }

  return { qtd:qtd, peso:peso, fobUSD:fobUSD, nVol:nVol, ptax:ptax,
    va:va, fobBRL:fobBRL, freteBRL:freteBRL, seguroBRL:seguroBRL,
    ii:ii, iiAliq:iiAliq, prefer:prefer, ipiImp:ipiImp, pisImp:pisImp, cofinsImp:cofinsImp,
    adicCofins:adicCofins, afrmm:afrmm, siscomex:siscomex, antidumping:antidumping, subFed:subFed,
    baseIcms:baseIcms, freteNacTotal:freteNacTotal, armazTotal:armazTotal,
    freteClienteTotal:freteClienteTotal, freteClienteUnit:freteClienteUnit,
    receita:receita, ipiNF:ipiNF, totalCliente:totalCliente, comissao:comissao,
    freteVendaTotal:freteVendaTotal, preco:preco, tema69:tema69,
    ipiSaldoCredor: Math.max(0, ipiImp - ipiNF), ipiLiquido: ipiNF - ipiImp,
    direta: Object.assign({ icmsImp:icmsImpD, despLocais:despLocaisD, desembolsado:desembolsadoD,
      credIcms:credIcmsD, custoLiq:custoLiqD, credServico:0,
      custoDesembUnit: qtd? desembolsadoD/qtd : 0, custoLiqUnit: qtd? custoLiqD/qtd : 0,
      custoLiqTon: peso? custoLiqD/peso : 0, custoLiqVolume: nVol? custoLiqD/nVol : 0,
      despachante:num(p.despachante), armazenagem:armazTotal, outras:num(p.outras),
      servicoTrading:0 }, D),
    tradingCli:tradingCli, servicoTradingTotal:servicoTrading,
    co: Object.assign({ icmsImp:icmsImpCO, servicoTrading:servicoEmpresa, servicoTotal:servicoTrading, despachante:despachanteCO,
      armazenagem:armazCO, outras:outrasCO, despLocais:despLocaisCO, desembolsado:desembolsadoCO,
      credIcms:credIcmsCO, credServico:credServico, custoLiq:custoLiqCO,
      custoDesembUnit: qtd? desembolsadoCO/qtd : 0, custoLiqUnit: qtd? custoLiqCO/qtd : 0,
      custoLiqTon: peso? custoLiqCO/peso : 0, custoLiqVolume: nVol? custoLiqCO/nVol : 0 }, CO),
    precoPara: precoPara };
}

/* ============================ HELPERS DE HTML ============================ */
function sec(letter, title, note){
  return '<div class="sec"><h3>' + (letter? '<b>'+letter+'</b>':'') + esc(title) + '</h3>'
    + (note? '<p>'+esc(note)+'</p>' : '') + '</div>';
}
function row(l, v, o){
  o = o || {};
  return '<div class="r' + (o.strong?' strong':'') + (o.sub?' sub':'') + '">'
    + '<span class="r-l">' + esc(l) + '</span>'
    + '<span class="r-v' + (o.tone? ' t-'+o.tone : '') + '">' + v + '</span>'
    + (o.note? '<span class="r-n">'+esc(o.note)+'</span>' : '') + '</div>';
}
function fld(key, label, o){
  o = o || {};
  var v = esc(S.p[key] !== undefined ? S.p[key] : S.prop[key]);
  var cls = 'fld' + (o.wide?' wide':'');
  var input;
  if (o.options){
    input = '<select data-k="' + key + '" data-store="' + (o.store||'p') + '">'
      + o.options.map(function(op){
          return '<option value="'+esc(op[0])+'"'+(String(S.p[key])===String(op[0])?' selected':'')+'>'+esc(op[1])+'</option>';
        }).join('') + '</select>';
  } else {
    input = '<span class="in"><input data-k="' + key + '" data-store="' + (o.store||'p') + '"'
      + (o.numeric? ' data-num="'+(o.dec===undefined?2:o.dec)+'" inputmode="decimal"':'')
      + ' value="' + v + '" spellcheck="false"></span>';
  }
  return '<div class="'+cls+'"><label>'+esc(label)+'</label>'+input
    + (o.hint? '<span class="hint">'+esc(o.hint)+'</span>' : '') + '</div>';
}
function fldSuf(key, label, suffix, o){
  o = o || {}; o.numeric = true;
  var dec = (o.dec === undefined) ? (NUMF[key] === undefined ? 2 : NUMF[key]) : o.dec;
  var v = esc(fmtNum(S.p[key], dec));
  return '<div class="fld'+(o.wide?' wide':'')+'"><label>'+esc(label)+'</label>'
    + '<span class="in"><input data-k="'+key+'" data-store="p" data-num="'+dec+'" inputmode="decimal" value="'+v+'" spellcheck="false">'
    + (suffix? '<em>'+esc(suffix)+'</em>' : '') + '</span>'
    + (o.hint? '<span class="hint">'+esc(o.hint)+'</span>' : '') + '</div>';
}
function head(title, sub){
  return '<div class="sheet-head"><img src="'+LOGO_DARK+'" alt="EPIC"><div>'
    + '<strong>'+esc(title)+'</strong><span>'+esc(sub)+'</span></div></div>';
}

/* ============================ ABAS ============================ */
var TABS = [["resumo","Resumo"],["parametros","Par\u00e2metros"],["nacionalizacao","Nacionaliza\u00e7\u00e3o"],
  ["venda","Venda"],["contaordem","Conta e ordem"],["precoalvo","Pre\u00e7o-alvo"],
  ["fornecedores","Fornecedores"],["demonstrativo","Demonstrativo"],["fontes","Fontes"]];

function ctx(c){
  var p = S.p;
  return (p.produto||"Produto") + " \u00b7 NCM " + (p.ncm||"\u2014") + " \u00b7 " + qty(c.qtd) + " " + u()
    + " \u00b7 " + qty(c.nVol) + (num(p.nVolumes)===1?" cont\u00eainer":" cont\u00eaineres")
    + " \u00b7 " + (S.modo==="direta"?"Importa\u00e7\u00e3o direta":"Conta e ordem");
}
function u(){ return S.p.unidade || "un"; }
function M(c){ return S.modo === "direta" ? c.direta : c.co; }

function viewResumo(c){
  var d = c.direta, o = c.co, un = u();
  var linhas = [
    ["Custo l\u00edquido total da mercadoria", money(d.custoLiq), money(o.custoLiq), o.custoLiq-d.custoLiq, true, false],
    ["Custo l\u00edquido por "+un, money(d.custoLiqUnit,4), money(o.custoLiqUnit,4), o.custoLiqUnit-d.custoLiqUnit, true, false],
    ["Receita bruta (s/ IPI)", money(c.receita), money(c.receita), 0, false, false],
    ["Valor total a pagar pelo cliente", money(c.totalCliente), money(c.totalCliente), 0, false, false],
    ["LAIR \u2014 lucro antes do IR", money(d.lair), money(o.lair), o.lair-d.lair, false, false],
    ["Lucro l\u00edquido da opera\u00e7\u00e3o", money(d.liquido), money(o.liquido), o.liquido-d.liquido, false, false],
    ["Margem l\u00edquida sobre a receita", perc(d.margemLiq), perc(o.margemLiq), o.margemLiq-d.margemLiq, false, true],
    ["Ponto de equil\u00edbrio (R$/"+un+")", money(d.be,4), money(o.be,4), o.be-d.be, true, false],
    ["Saldo credor de ICMS acumulado", money(d.saldoCredorIcms), money(o.saldoCredorIcms), o.saldoCredorIcms-d.saldoCredorIcms, true, false]
  ];
  var impacto = o.liquido - d.liquido - o.saldoCredorIcms;
  var h = head("Resumo executivo", ctx(c));
  h += '<div class="hero"><div class="hero-main">'
    + '<span class="hero-lb">Valor total a pagar pelo cliente</span>'
    + '<strong class="hero-v">' + money(c.totalCliente) + '</strong>'
    + '<span class="hero-sub">' + qty(c.qtd) + ' ' + esc(un) + ' \u00d7 ' + money(c.preco,4)
    + (num(S.p.ipiSaida)>0 ? ' + IPI destacado ' + money(c.ipiNF) : ' \u00b7 sem IPI destacado') + '</span></div>'
    + '<div class="hero-side">'
    + '<div><span>Pre\u00e7o por '+esc(un)+' com IPI</span><strong>' + money(c.qtd? c.totalCliente/c.qtd : 0,4) + '</strong></div>'
    + '<div><span>Custo l\u00edquido por '+esc(un)+'</span><strong>' + money(M(c).custoLiqUnit,4) + '</strong></div>'
    + '<div><span>Lucro l\u00edquido</span><strong>' + money(M(c).liquido) + '</strong></div>'
    + '</div></div>';
  h += sec("1","Comparativo entre modalidades","Mesma carga, mesmo pre\u00e7o de venda. O que muda \u00e9 a modalidade de importa\u00e7\u00e3o.");
  h += '<div class="tbl"><div class="h"><span>Indicador</span><span>Direta</span><span>Conta e ordem</span><span>Diferen\u00e7a</span></div>';
  linhas.forEach(function(L){
    var delta = L[3], menorMelhor = L[4], isPerc = L[5];
    var tone = Math.abs(delta) < 1e-9 ? "" : ((menorMelhor ? delta < 0 : delta > 0) ? "pos" : "neg");
    var dtxt = Math.abs(delta) > 1e-9 ? ((delta>0?"+":"") + (isPerc? perc(delta) : money(delta))) : "\u2014";
    h += '<div class="row"><span>'+esc(L[0])+'</span><span class="num">'+L[1]+'</span>'
      + '<span class="num">'+L[2]+'</span><span class="num t-'+tone+'">'+dtxt+'</span></div>';
  });
  h += '</div>';
  h += '<div class="call'+(impacto>=0?'':' neg')+'"><span>Impacto total de caixa ao migrar para conta e ordem</span>'
    + '<strong>'+(impacto>0?"+":"")+money(impacto)+'</strong>'
    + '<p>\u0394 lucro l\u00edquido menos o saldo credor de ICMS. Negativo significa que conta e ordem custa caixa.</p></div>';
  h += sec("2","Pontos de aten\u00e7\u00e3o");
  h += '<div class="notes">'
    + '<div><b>ICMS em conta e ordem</b><p>STF Tema 520 (ARE 665.134): o ICMS-importa\u00e7\u00e3o \u00e9 devido ao estado do adquirente. Benef\u00edcio de Rond\u00f4nia n\u00e3o se aproveita se a empresa n\u00e3o estiver estabelecida em RO.</p></div>'
    + '<div><b>Saldo credor de ICMS</b><p>Se o ICMS de entrada superar o da sa\u00edda, o cr\u00e9dito n\u00e3o \u00e9 absorvido e vira caixa parado, sem prazo de realiza\u00e7\u00e3o.</p></div>'
    + '<div><b>IPI \u00e9 neutro</b><p>Tratado por fora: n\u00e3o \u00e9 receita, custo nem despesa. A apura\u00e7\u00e3o fica em memorando'
    + (c.ipiSaldoCredor>0 ? '. Aten\u00e7\u00e3o: h\u00e1 ' + money(c.ipiSaldoCredor) + ' de cr\u00e9dito de IPI que a sa\u00edda n\u00e3o absorve.' : '.') + '</p></div>'
    + '<div><b>Validar antes de fechar</b><p>II no Classif e preferência do acordo de origem, IPI na TIPI, antidumping por produtor, taxa Siscomex e o termo do benef\u00edcio de ICMS.</p></div>'
    + '</div>';
  return h;
}

function calcbarHTML(c){
  var un = u();
  return '<div class="calcbar" id="calcbar">'
    + '<span>Quantidade total<b>' + qty(c.qtd) + ' ' + esc(un) + '</b></span>'
    + '<span>Peso total<b>' + brl(c.peso,2) + ' t</b></span>'
    + '<span>FOB total<b>US$ ' + brl(c.fobUSD) + '</b></span>'
    + '<span>Valor aduaneiro<b>' + money(c.va) + '</b></span></div>';
}

function viewParametros(c){
  var un = u();
  var SN = [["1","Sim"],["0","N\u00e3o"]];
  var h = head("Par\u00e2metros da simula\u00e7\u00e3o", ctx(c));
  h += sec(null, "Preencha os campos amarelos", "Os resultados das outras abas recalculam na hora. Use v\u00edrgula ou ponto \u2014 o campo se reformata sozinho ao sair dele, mostrando exatamente o valor que foi entendido.");
  h += sec("1","Identifica\u00e7\u00e3o e carga");
  h += '<div class="grid">'
    + fld("produto","Produto / descri\u00e7\u00e3o",{wide:true})
    + fld("ncm","NCM")
    + fld("unidade","Unidade de medida",{hint:"m\u00b2, kg, t, un, p\u00e7"})
    + fld("origem","Pa\u00eds de origem")
    + fldSuf("preferencia","Prefer\u00eancia tarif\u00e1ria do acordo","% do II",{hint:"100 = II zerado com certificado de origem. ACE 58 (Mercosul\u2013Peru) desgrava quase todo o universo tarif\u00e1rio",dec:0})
    + fldSuf("ptax","C\u00e2mbio PTAX","R$/US$",{hint:"Usar a PTAX do registro da DI/DUIMP",dec:4})
    + fldSuf("nVolumes","N\u00ba de cont\u00eaineres / volumes","",{dec:0})
    + fldSuf("qtdPorVolume","Quantidade por volume ("+un+")","",{dec:0})
    + fldSuf("pesoPorVolume","Peso por volume","t",{hint:"Alimenta o antidumping em US$/t",dec:3})
    + fldSuf("fobUnit","FOB por "+un,"US$",{dec:4})
    + '</div>';
  h += calcbarHTML(c);
  h += sec("2","Fretes e seguro");
  h += '<div class="grid">'
    + fldSuf("freteIntl","Frete internacional por cont\u00eainer","US$",{hint:"Base do AFRMM"})
    + fldSuf("seguroPct","Seguro internacional","% do FOB",{hint:"Mercado usual 0,15% a 0,50%"})
    + fldSuf("freteNacional","Frete nacional porto \u2192 dep\u00f3sito","R$/cont.")
    + fldSuf("freteVenda","Frete de venda dep\u00f3sito \u2192 cliente","R$/"+un,{dec:4,hint:"Pago por voc\u00ea: entra no custo e reduz o resultado"})
    + fldSuf("freteCliente","Frete porto \u2192 cliente, pago pelo cliente","R$/cont.",{hint:"Pago direto \u00e0 transportadora. Fica fora da base de impostos, do seu custo e do resultado \u2014 aparece no demonstrativo s\u00f3 como informa\u00e7\u00e3o"})
    + '</div>';
  h += sec("3","Tributos de nacionaliza\u00e7\u00e3o");
  h += '<div class="grid">'
    + fldSuf("ii","II \u2014 Imposto de Importa\u00e7\u00e3o","%",{hint:"Al\u00edquota cheia da TEC. A prefer\u00eancia do bloco 1 reduz sobre esta"})
    + fldSuf("ipiImp","IPI importa\u00e7\u00e3o","%",{hint:"Base = VA + II. Recuper\u00e1vel"})
    + fldSuf("pisImp","PIS-Importa\u00e7\u00e3o","%",{hint:"Regra geral 2,10%"})
    + fldSuf("cofinsImp","COFINS-Importa\u00e7\u00e3o","%",{hint:"Regra geral 9,65%, sem o adicional"})
    + fldSuf("adicCofins","Adicional COFINS-Importa\u00e7\u00e3o","%",{hint:"\u00a721-A: 0,8% em 2025, 0,6% em 2026, 0,4% em 2027. N\u00e3o gera cr\u00e9dito (STF Tema 1047)"})
    + fldSuf("afrmm","AFRMM sobre o frete mar\u00edtimo","%",{hint:"8% em longo curso"})
    + fldSuf("siscomex","Taxa Siscomex/DUIMP","R$")
    + fldSuf("antidumping","Antidumping","US$/t",{hint:"Varia por produtor e origem",dec:4})
    + fldSuf("icmsImp","ICMS-importa\u00e7\u00e3o \u2014 al\u00edquota","%",{hint:"Calculado por dentro (gross-up)"})
    + fld("icmsImpCreditavel","ICMS-importa\u00e7\u00e3o \u00e9 credit\u00e1vel?",{options:SN,hint:"Em regime incentivado normalmente n\u00e3o"})
    + '</div>';
  h += sec("4","Despesas aduaneiras e locais");
  h += '<div class="grid">'
    + fldSuf("despachante","Despachante aduaneiro","R$/import.")
    + fldSuf("armazenagem","Armazenagem / THC / capatazia","R$/cont.")
    + fldSuf("outras","Outras despesas","R$/import.",{hint:"Lacres, demurrage, taxas banc\u00e1rias"})
    + '</div>';
  h += sec("5","Venda");
  h += '<div class="grid">'
    + fldSuf("preco","Pre\u00e7o de venda por "+un+" (sem IPI)","R$",{dec:4})
    + fldSuf("icmsVenda","ICMS sobre a venda","%",{hint:"4% interestadual para importado \u2014 Res. Senado 13/2012"})
    + fldSuf("pisVenda","PIS sobre a venda","%")
    + fldSuf("cofinsVenda","COFINS sobre a venda","%")
    + fld("tema69","Excluir o ICMS da base de PIS/COFINS?",{options:SN,hint:"STF Tema 69 (RE 574.706). Manter Sim"})
    + fldSuf("ipiSaida","IPI na sa\u00edda","%",{hint:"Cobrado do cliente por fora"})
    + fldSuf("comissao","Comiss\u00e3o sobre venda","%")
    + fldSuf("irpjCsll","IRPJ + CSLL sobre o lucro","%",{hint:"Simplifica\u00e7\u00e3o: 15% + adicional 10% + CSLL 9%"})
    + fldSuf("despDedutiveis","Despesas dedut\u00edveis alocadas","R$",{hint:"Reduzem a base do IRPJ/CSLL, n\u00e3o entram no custo"})
    + fldSuf("margemAlvo","Margem operacional alvo","%",{hint:"Usada no c\u00e1lculo do pre\u00e7o sugerido"})
    + '</div>';
  h += sec("6","Conta e ordem \u2014 par\u00e2metros espec\u00edficos","Usados apenas na aba Conta e ordem.");
  h += '<div class="grid">'
    + fld("ufAdquirente","UF do adquirente")
    + fldSuf("tradingPct","Taxa de servi\u00e7o da trading","% do VA",{hint:"Mercado usual 0,5% a 2,0%"})
    + fldSuf("tradingFixo","Taxa fixa da trading","R$/cont.",{hint:"Cobrada por cont\u00eainer, multiplicada pela quantidade de volumes"})
    + fldSuf("icmsImpCO","ICMS-importa\u00e7\u00e3o no estado do adquirente","%")
    + fld("icmsImpCOCreditavel","ICMS-importa\u00e7\u00e3o \u00e9 credit\u00e1vel?",{options:SN})
    + fldSuf("icmsVendaCO","ICMS sobre a venda em conta e ordem","%")
    + fld("tradingPagaCliente","Quem paga a taxa da trading?",
          {options:[["0","A empresa \u2014 entra no custo"],["1","O cliente, direto \u00e0 trading"]],
           wide:true,
           hint:"Pago pelo cliente, a taxa sai do seu custo, da base de impostos e do resultado, e aparece no demonstrativo como valor que ele desembolsa"})
    + fld("creditarServico","Creditar PIS/COFINS sobre o servi\u00e7o?",{options:SN,hint:"Posi\u00e7\u00e3o discut\u00edvel. Default conservador: n\u00e3o. S\u00f3 vale se a empresa pagar a taxa"})
    + fld("despesasInclusas","Despesas j\u00e1 inclusas na taxa da trading?",{options:SN,hint:"Sim evita contar despachante e armazenagem duas vezes"})
    + '</div>';
  h += '<div class="actions no-print"><button class="btn ghost" id="btnReset">Restaurar valores padr\u00e3o</button></div>';
  h += '<p class="foot">Os par\u00e2metros ficam salvos neste navegador. Restaurar apaga o que foi digitado.</p>';
  return h;
}

function viewNacionalizacao(c){
  var co = S.modo === "co", m = M(c), un = u(), p = S.p;
  var h = head("Custo de nacionaliza\u00e7\u00e3o", ctx(c));
  h += sec(null, co? "Conta e ordem \u2014 tributos recolhidos pela trading, \u00f4nus econ\u00f4mico do adquirente"
                   : "Importa\u00e7\u00e3o direta \u2014 em nome pr\u00f3prio, com recursos pr\u00f3prios");
  h += sec("A","Valor aduaneiro");
  h += row("FOB total (R$)", money(c.fobBRL), {note:"US$ "+brl(c.fobUSD)+" \u00d7 "+brl(c.ptax,4)});
  h += row("Frete internacional (R$)", money(c.freteBRL));
  h += row("Seguro internacional (R$)", money(c.seguroBRL));
  h += row("Valor aduaneiro \u2014 VA (CIF)", money(c.va), {strong:true, note:"Base do II e do PIS/COFINS-Importa\u00e7\u00e3o"});
  h += sec("B","Tributos federais e taxas");
  h += row("II \u2014 Imposto de Importa\u00e7\u00e3o", money(c.ii),
      {note: c.prefer>0 ? "Al\u00edquota efetiva "+perc(c.iiAliq)+" ap\u00f3s prefer\u00eancia de "+perc(c.prefer,0)+" ("+esc(p.origem)+"). N\u00e3o recuper\u00e1vel"
                        : "N\u00e3o recuper\u00e1vel \u2014 vira custo"});
  h += row("IPI importa\u00e7\u00e3o", money(c.ipiImp), {note:"Base = VA + II. Recuper\u00e1vel"});
  h += row("PIS-Importa\u00e7\u00e3o", money(c.pisImp), {note:"Recuper\u00e1vel"});
  h += row("COFINS-Importa\u00e7\u00e3o", money(c.cofinsImp), {note:"Recuper\u00e1vel"});
  h += row("Adicional COFINS-Importa\u00e7\u00e3o", money(c.adicCofins), {note:"N\u00e3o gera cr\u00e9dito \u2014 STF Tema 1047"});
  h += row("AFRMM", money(c.afrmm));
  h += row("Taxa Siscomex/DUIMP", money(c.siscomex));
  h += row("Direito antidumping", money(c.antidumping));
  h += row("Subtotal federais + taxas", money(c.subFed), {strong:true});
  h += sec("C","ICMS importa\u00e7\u00e3o", co? "Devido ao estado do adquirente ("+p.ufAdquirente+") \u2014 STF Tema 520."
                                              : "Calculado por dentro sobre VA + federais.");
  h += row("Base do ICMS-importa\u00e7\u00e3o (sem gross-up)", money(c.baseIcms));
  h += row("ICMS-importa\u00e7\u00e3o (por dentro)", money(m.icmsImp), {strong:true});
  h += row("\u00c9 credit\u00e1vel?", num(co? p.icmsImpCOCreditavel : p.icmsImpCreditavel)===1 ? "Sim \u2014 vira cr\u00e9dito" : "N\u00e3o \u2014 vira custo");
  h += sec("D","Servi\u00e7o e despesas locais");
  if (co) h += row("Servi\u00e7o da trading (% \u00d7 VA + fixo por cont\u00eainer)", money(c.co.servicoTrading),
      {note:"Taxa fixa de " + money(num(p.tradingFixo)) + " \u00d7 " + qty(c.nVol) + " cont\u00eainer(es). Receita da trading \u00e9 o servi\u00e7o \u2014 IN SRF 247/2002"});
  h += row("Despachante aduaneiro", money(m.despachante));
  h += row("Armazenagem / THC / capatazia", money(m.armazenagem));
  h += row("Outras despesas", money(m.outras));
  h += row("Frete nacional porto \u2192 dep\u00f3sito", money(c.freteNacTotal));
  h += row("Subtotal", money(m.despLocais), {strong:true});
  h += sec("E","Custo total e custo l\u00edquido");
  h += row("Custo total desembolsado (caixa)", money(m.desembolsado), {strong:true});
  h += row("(\u2212) Cr\u00e9dito IPI-importa\u00e7\u00e3o", money(-c.ipiImp), {sub:true});
  h += row("(\u2212) Cr\u00e9dito PIS-Importa\u00e7\u00e3o", money(-c.pisImp), {sub:true});
  h += row("(\u2212) Cr\u00e9dito COFINS-Importa\u00e7\u00e3o", money(-c.cofinsImp), {sub:true});
  h += row("(\u2212) Cr\u00e9dito ICMS-importa\u00e7\u00e3o", money(-m.credIcms), {sub:true});
  if (co) h += row("(\u2212) Cr\u00e9dito PIS/COFINS sobre o servi\u00e7o", money(-c.co.credServico), {sub:true});
  h += row("Custo l\u00edquido da mercadoria (cont\u00e1bil)", money(m.custoLiq), {strong:true, tone:"key", note:"Base de forma\u00e7\u00e3o de pre\u00e7o"});
  h += sec("F","Custo unit\u00e1rio");
  h += row("Custo desembolsado por "+un, money(m.custoDesembUnit,4));
  h += row("Custo l\u00edquido por "+un, money(m.custoLiqUnit,4), {strong:true, tone:"key"});
  h += row("Custo l\u00edquido por tonelada", money(m.custoLiqTon));
  h += row("Custo l\u00edquido por cont\u00eainer", money(m.custoLiqVolume));
  h += '<div class="warn"><b>Base do ICMS</b>A base usada aqui \u00e9 valor aduaneiro mais tributos federais. A LC 87/96, art. 13, V, manda incluir tamb\u00e9m as demais despesas aduaneiras. Confirme com a contabilidade se capatazia, THC e despachante entram na base no estado de desembara\u00e7o.</div>';
  return h;
}

function viewVenda(c){
  var d = c.direta, un = u(), p = S.p;
  var h = head("Resultado da venda \u2014 importa\u00e7\u00e3o direta", ctx(c));
  h += sec("A","Receita e valor cobrado do cliente");
  h += row("Receita bruta de venda (s/ IPI)", money(c.receita));
  h += row("(+) IPI destacado na sa\u00edda (por fora)", money(c.ipiNF));
  h += row("Valor total a pagar pelo cliente", money(c.totalCliente), {strong:true, tone:"key"});
  h += row("Valor por "+un+" com IPI", money(c.qtd? c.totalCliente/c.qtd : 0, 4));
  h += sec("B","Impostos que reduzem o resultado");
  h += row("ICMS sobre a venda", money(d.icms));
  h += row("Base de PIS/COFINS", money(d.basePC), {sub:true, note: c.tema69? "Receita menos o ICMS destacado \u2014 STF Tema 69" : "Receita cheia \u2014 sem a exclus\u00e3o do Tema 69"});
  h += row("PIS sobre a venda", money(d.pis));
  h += row("COFINS sobre a venda", money(d.cofins));
  h += row("Total de impostos sobre a venda", money(d.impostos), {strong:true});
  h += sec("C","Custos e despesas");
  h += row("(\u2212) Custo l\u00edquido da mercadoria vendida", money(d.custoLiq));
  h += row("(\u2212) Comiss\u00e3o sobre venda", money(c.comissao));
  h += row("(\u2212) Frete de venda", money(c.freteVendaTotal));
  h += sec("D","Resultado");
  h += row("Lucro operacional antes do IR (LAIR)", money(d.lair), {strong:true, tone: d.lair>=0?"pos":"neg"});
  h += row("(\u2212) Despesas dedut\u00edveis da empresa", money(num(p.despDedutiveis)), {sub:true});
  h += row("Base tribut\u00e1vel IRPJ/CSLL", money(d.base), {sub:true});
  h += row("(\u2212) IRPJ + CSLL", money(d.ir), {sub:true});
  h += row("Lucro l\u00edquido da opera\u00e7\u00e3o", money(d.liquido), {strong:true, tone: d.liquido>=0?"pos":"neg"});
  h += sec("E","Custo unit\u00e1rio de venda (R$/"+un+") ao pre\u00e7o indicado");
  h += row("Custo de nacionaliza\u00e7\u00e3o l\u00edquido", money(d.custoLiqUnit,4));
  h += row("(+) ICMS da venda", money(c.qtd? d.icms/c.qtd : 0, 4), {sub:true});
  h += row("(+) PIS da venda", money(c.qtd? d.pis/c.qtd : 0, 4), {sub:true});
  h += row("(+) COFINS da venda", money(c.qtd? d.cofins/c.qtd : 0, 4), {sub:true});
  h += row("(+) Comiss\u00e3o", money(c.qtd? c.comissao/c.qtd : 0, 4), {sub:true});
  h += row("(+) Frete de venda", money(num(p.freteVenda),4), {sub:true});
  h += row("Custo unit\u00e1rio de venda", money(d.custoUnitVenda,4), {strong:true});
  h += row("Pre\u00e7o de venda indicado", money(c.preco,4));
  h += row("Lucro por unidade antes do IR", money(c.preco - d.custoUnitVenda, 4), {tone: (c.preco-d.custoUnitVenda)>=0?"pos":"neg"});
  h += sec("F","Apura\u00e7\u00e3o do IPI \u2014 memorando fiscal","O IPI \u00e9 cobrado por fora e \u00e9 neutro: n\u00e3o \u00e9 receita, custo nem despesa.");
  h += row("IPI d\u00e9bito na sa\u00edda", money(c.ipiNF));
  h += row("(\u2212) IPI cr\u00e9dito da importa\u00e7\u00e3o", money(-c.ipiImp));
  h += row("IPI l\u00edquido a recolher", money(Math.max(0, c.ipiLiquido)), {strong:true});
  h += row("Saldo credor de IPI acumulado", money(c.ipiSaldoCredor),
      {tone: c.ipiSaldoCredor>0?"neg":"pos", note: c.ipiSaldoCredor>0? "O cr\u00e9dito de IPI da importa\u00e7\u00e3o supera o d\u00e9bito da sa\u00edda. Caixa parado." : "A sa\u00edda absorve todo o cr\u00e9dito de entrada."});
  h += sec("G","Indicadores");
  h += row("Margem operacional sobre a receita", perc(d.margemOp));
  h += row("Margem l\u00edquida sobre a receita", perc(d.margemLiq), {strong:true, tone:"key"});
  h += row("Lucro l\u00edquido por "+un, money(d.lucroUnit,4));
  h += row("Lucro l\u00edquido por cont\u00eainer", money(d.lucroVolume));
  h += row("Markup sobre o custo l\u00edquido", brl(d.markup,4)+"\u00d7");
  h += row("Ponto de equil\u00edbrio \u2014 pre\u00e7o m\u00ednimo por "+un, money(d.be,4), {strong:true, note:"Piso absoluto. Abaixo disto a opera\u00e7\u00e3o destr\u00f3i valor"});
  h += row("Pre\u00e7o m\u00ednimo cobrindo os fixos", money(d.beFixos,4));
  h += row("Saldo credor de ICMS acumulado", money(d.saldoCredorIcms), {tone: d.saldoCredorIcms>0?"neg":""});
  return h;
}

function viewContaOrdem(c){
  var o = c.co, d = c.direta, un = u(), p = S.p;
  var h = head("Importa\u00e7\u00e3o por conta e ordem", ctx(c));
  h += sec(null, null, "A empresa \u00e9 o adquirente e dona da mercadoria; a trading \u00e9 importadora de direito e mera prestadora de servi\u00e7o. Mesma carga e mesmo pre\u00e7o da aba Venda. Base legal: IN RFB 1.861/2018; Lei 10.865/2004 art. 18; RIPI art. 9\u00ba, IX; STF Tema 520.");
  h += sec("A","Custo");
  h += row("Valor aduaneiro (CIF)", money(c.va));
  h += row("Tributos federais + taxas", money(c.subFed));
  h += row("ICMS-importa\u00e7\u00e3o \u2014 estado do adquirente ("+esc(p.ufAdquirente)+")", money(o.icmsImp), {note:"Benef\u00edcio de RO n\u00e3o se aproveita aqui se a empresa n\u00e3o estiver em RO"});
  h += row("Servi\u00e7o da trading", money(o.servicoTrading));
  h += row("Despesas locais", money(o.despLocais - o.servicoTrading));
  h += row("Custo total desembolsado", money(o.desembolsado), {strong:true});
  h += row("(\u2212) Cr\u00e9ditos IPI, PIS, COFINS, ICMS e servi\u00e7o", money(-(c.ipiImp + c.pisImp + c.cofinsImp + o.credIcms + o.credServico)), {sub:true});
  h += row("Custo l\u00edquido da mercadoria", money(o.custoLiq), {strong:true, tone:"key"});
  h += row("Custo l\u00edquido por "+un, money(o.custoLiqUnit,4), {strong:true});
  h += sec("B","Resultado da venda");
  h += row("Receita bruta (s/ IPI)", money(c.receita));
  h += row("Valor total a pagar pelo cliente", money(c.totalCliente), {strong:true, tone:"key"});
  h += row("ICMS sobre a venda", money(o.icms));
  h += row("PIS sobre a venda", money(o.pis));
  h += row("COFINS sobre a venda", money(o.cofins));
  h += row("(\u2212) Custo l\u00edquido da mercadoria vendida", money(o.custoLiq));
  h += row("(\u2212) Comiss\u00e3o e frete de venda", money(c.comissao + c.freteVendaTotal));
  h += row("LAIR \u2014 lucro antes do IR", money(o.lair), {strong:true, tone:o.lair>=0?"pos":"neg"});
  h += row("(\u2212) IRPJ + CSLL", money(o.ir), {sub:true});
  h += row("Lucro l\u00edquido da opera\u00e7\u00e3o", money(o.liquido), {strong:true, tone:o.liquido>=0?"pos":"neg"});
  h += sec("C","Apura\u00e7\u00e3o de ICMS \u2014 memorando","N\u00e3o entra no resultado, mas define o caixa.");
  h += row("ICMS cr\u00e9dito da importa\u00e7\u00e3o", money(o.credIcms));
  h += row("ICMS d\u00e9bito na venda", money(o.icms));
  h += row("ICMS l\u00edquido a recolher", money(o.icms - o.credIcms));
  h += row("Saldo credor acumulado (caixa parado)", money(o.saldoCredorIcms), {strong:true, tone:o.saldoCredorIcms>0?"neg":"pos", note:"Cr\u00e9dito que a venda n\u00e3o absorve. N\u00e3o \u00e9 perda cont\u00e1bil, mas \u00e9 caixa preso sem prazo de realiza\u00e7\u00e3o"});
  h += sec("D","Compara\u00e7\u00e3o com a importa\u00e7\u00e3o direta");
  h += row("\u0394 custo l\u00edquido por "+un, money(o.custoLiqUnit - d.custoLiqUnit, 4), {tone:(o.custoLiqUnit-d.custoLiqUnit)<=0?"pos":"neg", note:"Positivo = conta e ordem \u00e9 mais cara"});
  h += row("\u0394 LAIR", money(o.lair - d.lair), {tone:(o.lair-d.lair)>=0?"pos":"neg"});
  h += row("\u0394 lucro l\u00edquido", money(o.liquido - d.liquido), {tone:(o.liquido-d.liquido)>=0?"pos":"neg"});
  h += row("\u0394 lucro l\u00edquido menos saldo credor (impacto de caixa)", money(o.liquido - d.liquido - o.saldoCredorIcms), {strong:true, tone:(o.liquido-d.liquido-o.saldoCredorIcms)>=0?"pos":"neg"});
  return h;
}

function viewPrecoAlvo(c){
  var un = u(), p = S.p, m = M(c);
  var aliq = pc(S.modo==="co" ? p.icmsVendaCO : p.icmsVenda);
  var alvo = num(p.margemAlvo)/100;
  var sug = c.precoPara(alvo, aliq, m.custoLiq);
  var margens = [0.05,0.10,0.15,0.20,0.25,0.30,0.35];
  var h = head("Pre\u00e7o-alvo e pisos de pre\u00e7o", ctx(c));
  h += sec(null, null, "C\u00e1lculo reverso: a partir do custo l\u00edquido e das al\u00edquotas, qual pre\u00e7o entrega a margem desejada.");
  h += '<div class="hero"><div class="hero-main">'
    + '<span class="hero-lb">Pre\u00e7o sugerido para margem operacional de '+perc(alvo,1)+'</span>'
    + '<strong class="hero-v">'+money(sug,4)+'</strong>'
    + '<span class="hero-sub">por '+esc(un)+', sem IPI \u00b7 com IPI: '+money(sug*(1+pc(p.ipiSaida)),4)+'</span></div>'
    + '<div class="hero-side">'
    + '<div><span>Ponto de equil\u00edbrio</span><strong>'+money(m.be,4)+'</strong></div>'
    + '<div><span>Piso cobrindo os fixos</span><strong>'+money(m.beFixos,4)+'</strong></div>'
    + '<div><span>Pre\u00e7o atual praticado</span><strong>'+money(c.preco,4)+'</strong></div>'
    + '</div></div>';
  h += sec("1","Pre\u00e7o por margem-alvo","Receita e resultado projetados para a mesma carga.");
  h += '<div class="tbl"><div class="h"><span>Margem operacional</span><span>Pre\u00e7o por '+esc(un)+'</span><span>Receita total</span><span>Diferen\u00e7a vs. pre\u00e7o atual</span></div>';
  margens.forEach(function(mg){
    var pr = c.precoPara(mg, aliq, m.custoLiq);
    var delta = pr - c.preco;
    h += '<div class="row'+(Math.abs(mg-alvo)<1e-9?' on':'')+'"><span>'+perc(mg,0)+'</span>'
      + '<span class="num">'+(pr>0? money(pr,4) : "invi\u00e1vel")+'</span>'
      + '<span class="num">'+(pr>0? money(pr*c.qtd) : "\u2014")+'</span>'
      + '<span class="num t-'+(delta>0?"neg":"pos")+'">'+(pr>0? (delta>0?"+":"")+money(delta,4) : "\u2014")+'</span></div>';
  });
  h += '</div>';
  h += '<p class="foot">A margem-alvo entra no denominador junto com ICMS, PIS, COFINS e comiss\u00e3o. Se a soma passar de 100%, o pre\u00e7o fica matematicamente invi\u00e1vel e a linha aparece como tal.</p>';
  h += sec("2","Resultado ao pre\u00e7o atual");
  h += row("Pre\u00e7o praticado por "+un, money(c.preco,4));
  h += row("Custo unit\u00e1rio de venda por "+un, money(m.custoUnitVenda,4));
  h += row("Margem operacional obtida", perc(m.margemOp), {strong:true, tone:m.margemOp>=alvo?"pos":"neg"});
  h += row("Dist\u00e2ncia at\u00e9 a margem-alvo", perc(m.margemOp - alvo), {tone:m.margemOp>=alvo?"pos":"neg"});
  h += row("Folga sobre o ponto de equil\u00edbrio", money(c.preco - m.be, 4), {tone:(c.preco-m.be)>=0?"pos":"neg"});
  return h;
}

/* ---------------------- DEMONSTRATIVO ---------------------- */
function docHTML(c){
  var p = S.p, pr = S.prop, un = u(), m = M(c);
  var precoComIpi = c.qtd ? c.totalCliente / c.qtd : 0;

  // taxa da trading: aparece nas duas vers\u00f5es, aberta em total e por unidade
  var servTrading = (S.modo === "co") ? c.servicoTradingTotal : 0;
  var temTrading = servTrading > 0;
  var tradingDoCliente = temTrading && c.tradingCli;      // pago direto pelo cliente
  var servTradingUn = (temTrading && c.qtd) ? servTrading / c.qtd : 0;
  var totalOperacao = c.totalCliente + (tradingDoCliente ? 0 : servTrading);
  var custoUnitTotal = c.qtd ? totalOperacao / c.qtd : 0;
  var temFreteCli = c.freteClienteTotal > 0;
  var porForaTotal = c.freteClienteTotal + (tradingDoCliente ? servTrading : 0);
  var temPorFora = porForaTotal > 0;
  var postoUnit = custoUnitTotal + (c.qtd ? porForaTotal / c.qtd : 0);
  var fixoTotal = num(p.tradingFixo) * c.nVol;
  var pctTotal = servTrading - fixoTotal;
  var detalheTrading = "";
  if (temTrading){
    var partes = [];
    if (fixoTotal > 0) partes.push(money(num(p.tradingFixo)) + " \u00d7 " + qty(c.nVol) + " cont.");
    if (pctTotal > 0.005) partes.push(brl(num(p.tradingPct), 2) + "% do valor aduaneiro");
    if (partes.length) detalheTrading = ' <span style="font-weight:400;color:#5a6a7a">(' + partes.join(" + ") + ')</span>';
  }
  var inclui = ["Frete internacional e seguro at\u00e9 o porto de destino",
    "Imposto de Importa\u00e7\u00e3o, PIS/COFINS-Importa\u00e7\u00e3o, AFRMM e taxa Siscomex",
    "Desembara\u00e7o aduaneiro, despachante, armazenagem, THC e capatazia",
    "ICMS destacado na nota fiscal de venda"];
  if (num(p.freteNacional) > 0) inclui.push("Frete rodovi\u00e1rio do porto at\u00e9 o dep\u00f3sito");
  if (num(p.freteVenda) > 0) inclui.push("Entrega no endere\u00e7o do cliente");
  if (num(p.freteCliente) > 0) inclui.push("N\u00c3O inclui o frete do porto at\u00e9 o seu endere\u00e7o, detalhado adiante");
  if (S.modo === "co" && num(p.tradingPagaCliente) === 1 && num(p.tradingFixo) + num(p.tradingPct) > 0)
    inclui.push("N\u00c3O inclui a taxa da trading, paga por voc\u00ea diretamente e detalhada adiante");

  var h = '<article class="doc" id="doc">';
  h += '<header class="doc-h"><div><img src="'+LOGO_DARK+'" alt="EPIC">'
    + '<strong>' + (S.versaoCliente ? "Proposta comercial" : "Demonstrativo interno da opera\u00e7\u00e3o") + '</strong>'
    + '<span class="meta">' + esc(pr.emitente) + (pr.emitenteCnpj? " \u00b7 CNPJ " + esc(pr.emitenteCnpj) : "")
    + '<br>N\u00ba ' + esc(pr.numero) + ' \u00b7 ' + esc(pr.data) + '</span></div>'
    + '<div class="doc-h-r"><span>Validade</span><b>' + esc(pr.validade) + '</b></div></header>';
  h += '<div class="doc-id">'
    + '<div><span>Cliente</span><b>' + (esc(pr.cliente) || "\u2014") + '</b></div>'
    + '<div><span>CNPJ</span><b>' + (esc(pr.cnpj) || "\u2014") + '</b></div>'
    + '<div><span>Produto</span><b>' + esc(p.produto) + '</b></div>'
    + '<div><span>NCM</span><b>' + esc(p.ncm) + '</b></div>'
    + '<div><span>Quantidade</span><b>' + qty(c.qtd) + ' ' + esc(un) + '</b></div>'
    + '<div><span>Cont\u00eaineres</span><b>' + qty(c.nVol) + '</b></div>'
    + '<div><span>Porto de destino</span><b>' + esc(pr.porto) + '</b></div>'
    + '<div><span>Origem</span><b>' + esc(p.origem) + '</b></div>'
    + '<div><span>C\u00e2mbio PTAX</span><b>R$ ' + brl(c.ptax, 4) + ' / US$ 1,00</b></div>'
    + '<div><span>Modalidade</span><b>' + (S.modo === "co" ? "Conta e ordem" : "Importa\u00e7\u00e3o direta") + '</b></div>'
    + '</div>';
  h += '<table class="doc-t"><tbody>'
    + '<tr><td>Pre\u00e7o unit\u00e1rio sem IPI</td><td class="num">' + money(c.preco,4) + ' / ' + esc(un) + '</td></tr>'
    + '<tr><td>Quantidade</td><td class="num">' + qty(c.qtd) + ' ' + esc(un) + '</td></tr>'
    + '<tr><td>Valor da mercadoria</td><td class="num">' + money(c.receita) + '</td></tr>'
    + (temTrading && !tradingDoCliente
        ? '<tr><td>Taxa de servi\u00e7o da trading' + detalheTrading + '</td><td class="num">' + money(servTrading) + '</td></tr>'
        : '')
    + '<tr><td>IPI destacado (' + brl(num(p.ipiSaida),2) + '%)</td><td class="num">' + money(c.ipiNF) + '</td></tr>'
    + '<tr class="tot"><td>' + (temTrading && !tradingDoCliente ? "Valor total da opera\u00e7\u00e3o" : "Valor total da nota fiscal")
      + '</td><td class="num">' + money(totalOperacao) + '</td></tr>'
    + '</tbody></table>';

  // composi\u00e7\u00e3o do custo unit\u00e1rio, somada linha a linha
  h += '<table class="doc-t doc-unit"><tbody>'
    + '<tr class="sec"><td colspan="2">Custo unit\u00e1rio final por ' + esc(un) + '</td></tr>'
    + '<tr><td>Pre\u00e7o unit\u00e1rio com IPI</td><td class="num">' + money(precoComIpi, 4) + '</td></tr>'
    + (temTrading
        ? '<tr><td>(+) Taxa da trading, diluída em ' + qty(c.qtd) + ' ' + esc(un) + '</td><td class="num">'
          + money(servTradingUn, 4) + '</td></tr>'
        : '')
    + (temFreteCli
        ? '<tr><td>(+) Frete do porto at\u00e9 o seu endere\u00e7o, diluído em ' + qty(c.qtd) + ' ' + esc(un) + '</td>'
          + '<td class="num">' + money(c.freteClienteUnit, 4) + '</td></tr>'
        : '')
    + '<tr class="tot"><td>Custo unit\u00e1rio final</td><td class="num">'
      + money(postoUnit, 4) + ' / ' + esc(un) + '</td></tr>'
    + '</tbody></table>';
  if (temPorFora){
    h += '<table class="doc-t doc-frete"><tbody>'
      + '<tr class="sec"><td colspan="2">Valores pagos por voc\u00ea diretamente \u2014 fora da nota fiscal</td></tr>';
    if (tradingDoCliente){
      h += '<tr><td>Taxa de servi\u00e7o da trading' + detalheTrading + '</td><td class="num">'
        + money(servTrading) + '</td></tr>'
        + '<tr class="dil"><td>dilu\u00edda em ' + qty(c.qtd) + ' ' + esc(un) + '</td><td class="num">'
        + money(servTradingUn, 4) + ' / ' + esc(un) + '</td></tr>';
    }
    if (temFreteCli){
      h += '<tr><td>Frete rodovi\u00e1rio do porto at\u00e9 seu endere\u00e7o, ' + qty(c.nVol) + ' cont\u00eainer(es)</td>'
        + '<td class="num">' + money(c.freteClienteTotal) + '</td></tr>'
        + '<tr class="dil"><td>dilu\u00eddo em ' + qty(c.qtd) + ' ' + esc(un) + '</td><td class="num">'
        + money(c.freteClienteUnit, 4) + ' / ' + esc(un) + '</td></tr>';
    }
    h += '<tr><td>Subtotal fora da nota fiscal</td><td class="num">' + money(porForaTotal) + '</td></tr>'
      + '<tr class="tot"><td>Desembolso total da opera\u00e7\u00e3o</td><td class="num">'
      + money(c.totalCliente + porForaTotal) + '</td></tr>'
      + '</tbody></table>';
    var quem = [];
    if (tradingDoCliente) quem.push("a taxa da trading");
    if (temFreteCli) quem.push("o frete rodovi\u00e1rio");
    h += '<p class="doc-nota"><b>Sem incid\u00eancia de impostos.</b> ' + quem.join(" e ") + ': contratado' + (quem.length > 1 ? "s" : "")
      + ' e pago' + (quem.length > 1 ? "s" : "") + ' por voc\u00ea diretamente ao prestador. '
      + 'N\u00e3o \u00e9' + (quem.length > 1 ? "m" : "") + ' faturado' + (quem.length > 1 ? "s" : "")
      + ' por n\u00f3s, n\u00e3o comp\u00f5e' + (quem.length > 1 ? "m" : "")
      + ' a base de c\u00e1lculo dos impostos e n\u00e3o entra' + (quem.length > 1 ? "m" : "")
      + ' no valor da nota fiscal. Est\u00e1' + (quem.length > 1 ? "\u00e3o" : "")
      + ' aqui, rateado' + (quem.length > 1 ? "s" : "") + ' pela quantidade importada, para voc\u00ea enxergar o desembolso total e o custo final por ' + esc(un) + '.</p>';
  }
  h += '<div class="doc-cols"><section><h4>O pre\u00e7o inclui</h4><ul>'
    + inclui.map(function(i){ return '<li>'+esc(i)+'</li>'; }).join('') + '</ul></section>'
    + '<section><h4>Condi\u00e7\u00f5es</h4>'
    + '<p><b>Prazo de entrega</b><br>' + esc(pr.prazo) + '</p>'
    + '<p><b>Pagamento</b><br>' + esc(pr.pagamento) + '</p>'
    + '<p><b>ICMS na venda</b><br>' + brl(num(S.modo==="co"? p.icmsVendaCO : p.icmsVenda),2) + '% destacado na nota fiscal</p>'
    + (pr.contato? '<p><b>Contato</b><br>'+esc(pr.contato)+'</p>' : '')
    + '</section></div>';
  if (!S.versaoCliente){
    var q = c.qtd || 1;
    var un_ = esc(un);
    function ln(rot, total, porUn, o){
      o = o || {};
      var cls = o.tot ? ' class="tot"' : (o.sub ? ' class="sub"' : '');
      return '<tr' + cls + '><td>' + esc(rot) + '</td>'
        + '<td class="num">' + (total === null ? "" : money(total)) + '</td>'
        + '<td class="num">' + (porUn === null ? "" : money(porUn, 4)) + '</td></tr>';
    }
    function sec_(rot){
      return '<tr class="sec"><td colspan="3">' + esc(rot) + '</td></tr>';
    }
    var credTotal = c.ipiImp + c.pisImp + c.cofinsImp + m.credIcms + (m.credServico || 0);

    h += '<div class="doc-int"><h4>Resultado da opera\u00e7\u00e3o \u2014 uso interno</h4>';
    h += '<table class="doc-t doc-det"><thead><tr><th>Composi\u00e7\u00e3o</th>'
      + '<th class="num">Total</th><th class="num">Por ' + un_ + '</th></tr></thead><tbody>';

    h += sec_("A. Valor aduaneiro \u00b7 c\u00e2mbio PTAX R$ " + brl(c.ptax, 4) + " / US$ 1,00");
    h += '<tr class="sub"><td>FOB em d\u00f3lar</td><td class="num">US$ ' + brl(c.fobUSD)
       + '</td><td class="num">US$ ' + brl(c.qtd ? c.fobUSD / c.qtd : 0, 4) + '</td></tr>';
    h += ln("FOB convertido", c.fobBRL, c.fobBRL / q, {sub:true});
    h += '<tr class="sub"><td>Frete internacional em d\u00f3lar</td><td class="num">US$ '
       + brl(num(p.freteIntl) * c.nVol) + '</td><td class="num">US$ '
       + brl(c.qtd ? (num(p.freteIntl) * c.nVol) / c.qtd : 0, 4) + '</td></tr>';
    h += ln("Frete internacional convertido", c.freteBRL, c.freteBRL / q, {sub:true});
    h += ln("Seguro internacional", c.seguroBRL, c.seguroBRL / q, {sub:true});
    h += ln("Valor aduaneiro (CIF)", c.va, c.va / q, {tot:true});
    h += ln("Sensibilidade: cada R$ 0,10 de c\u00e2mbio move o CIF em",
            c.ptax ? c.va * (0.10 / c.ptax) : 0,
            (c.ptax && q) ? (c.va * (0.10 / c.ptax)) / q : 0, {sub:true});

    h += sec_("B. Tributos de importa\u00e7\u00e3o e taxas");
    h += ln("Imposto de Importa\u00e7\u00e3o" + (c.prefer > 0 ? " (prefer\u00eancia de " + perc(c.prefer,0) + ")" : ""),
            c.ii, c.ii / q, {sub:true});
    h += ln("IPI importa\u00e7\u00e3o", c.ipiImp, c.ipiImp / q, {sub:true});
    h += ln("PIS-Importa\u00e7\u00e3o", c.pisImp, c.pisImp / q, {sub:true});
    h += ln("COFINS-Importa\u00e7\u00e3o", c.cofinsImp, c.cofinsImp / q, {sub:true});
    h += ln("Adicional COFINS-Importa\u00e7\u00e3o", c.adicCofins, c.adicCofins / q, {sub:true});
    h += ln("AFRMM", c.afrmm, c.afrmm / q, {sub:true});
    h += ln("Taxa Siscomex/DUIMP", c.siscomex, c.siscomex / q, {sub:true});
    h += ln("Direito antidumping", c.antidumping, c.antidumping / q, {sub:true});
    h += ln("ICMS-importa\u00e7\u00e3o", m.icmsImp, m.icmsImp / q, {sub:true});
    h += ln("Subtotal de tributos", c.subFed + m.icmsImp, (c.subFed + m.icmsImp) / q, {tot:true});

    h += sec_("C. Despesas locais");
    if (temTrading && !tradingDoCliente){
      h += ln("Taxa de servi\u00e7o da trading", servTrading, servTradingUn, {sub:true});
      h += ln("Demais despesas locais", m.despLocais - servTrading, (m.despLocais - servTrading) / q, {sub:true});
    } else {
      h += ln("Despachante aduaneiro", m.despachante, m.despachante / q, {sub:true});
      h += ln("Armazenagem, THC e capatazia", m.armazenagem, m.armazenagem / q, {sub:true});
      h += ln("Outras despesas", m.outras, m.outras / q, {sub:true});
      h += ln("Frete nacional porto \u2192 dep\u00f3sito", c.freteNacTotal, c.freteNacTotal / q, {sub:true});
    }
    h += ln("Subtotal de despesas", m.despLocais, m.despLocais / q, {tot:true});

    h += sec_("D. Cr\u00e9ditos tribut\u00e1rios recuper\u00e1veis");
    h += ln("Cr\u00e9dito de IPI-importa\u00e7\u00e3o", -c.ipiImp, -c.ipiImp / q, {sub:true});
    h += ln("Cr\u00e9dito de PIS-Importa\u00e7\u00e3o", -c.pisImp, -c.pisImp / q, {sub:true});
    h += ln("Cr\u00e9dito de COFINS-Importa\u00e7\u00e3o", -c.cofinsImp, -c.cofinsImp / q, {sub:true});
    h += ln("Cr\u00e9dito de ICMS-importa\u00e7\u00e3o", -m.credIcms, -m.credIcms / q, {sub:true});
    if (m.credServico) h += ln("Cr\u00e9dito de PIS/COFINS sobre o servi\u00e7o", -m.credServico, -m.credServico / q, {sub:true});
    h += ln("Total de cr\u00e9ditos", -credTotal, -credTotal / q, {tot:true});

    h += sec_("E. Custo");
    h += ln("Custo total desembolsado (caixa)", m.desembolsado, m.desembolsado / q, {sub:true});
    h += ln("Custo l\u00edquido da mercadoria", m.custoLiq, m.custoLiqUnit, {tot:true});
    h += ln("Custo l\u00edquido por tonelada", c.peso ? m.custoLiq / c.peso : 0, null, {sub:true});
    h += ln("Custo l\u00edquido por cont\u00eainer", m.custoLiqVolume, null, {sub:true});

    h += sec_("F. Venda");
    h += ln("Receita bruta (sem IPI)", c.receita, c.preco, {sub:true});
    h += ln("ICMS sobre a venda", -m.icms, -m.icms / q, {sub:true});
    h += ln("PIS sobre a venda", -m.pis, -m.pis / q, {sub:true});
    h += ln("COFINS sobre a venda", -m.cofins, -m.cofins / q, {sub:true});
    h += ln("Comiss\u00e3o sobre venda", -c.comissao, -c.comissao / q, {sub:true});
    h += ln("Frete de venda", -c.freteVendaTotal, -c.freteVendaTotal / q, {sub:true});
    h += ln("Custo l\u00edquido da mercadoria vendida", -m.custoLiq, -m.custoLiqUnit, {sub:true});

    h += sec_("G. Resultado");
    h += ln("LAIR \u2014 lucro antes do IR", m.lair, m.lair / q, {tot:true});
    h += ln("Despesas dedut\u00edveis alocadas", -num(p.despDedutiveis), -num(p.despDedutiveis) / q, {sub:true});
    h += ln("IRPJ + CSLL", -m.ir, -m.ir / q, {sub:true});
    h += ln("Lucro l\u00edquido da opera\u00e7\u00e3o", m.liquido, m.lucroUnit, {tot:true});

    if (temTrading && !tradingDoCliente){
      h += sec_("H. Valor total da opera\u00e7\u00e3o");
      h += ln("Valor da nota fiscal, com IPI", c.totalCliente, precoComIpi, {sub:true});
      h += ln("Taxa da trading, paga pela empresa", servTrading, servTradingUn, {sub:true});
      h += ln("Total com IPI e taxa da trading", totalOperacao, custoUnitTotal, {tot:true});
    }
    if (temPorFora){
      h += sec_((temTrading && !tradingDoCliente ? "I" : "H")
                + ". Pago pelo cliente diretamente \u2014 fora do resultado e da base de impostos");
      if (tradingDoCliente)
        h += ln("Taxa de servi\u00e7o da trading", servTrading, servTradingUn, {sub:true});
      if (temFreteCli)
        h += ln("Frete porto \u2192 cliente, " + qty(c.nVol) + " cont\u00eainer(es)",
                c.freteClienteTotal, c.freteClienteUnit, {sub:true});
      h += ln("Subtotal fora da nota fiscal", porForaTotal, c.qtd ? porForaTotal / c.qtd : 0, {sub:true});
      h += ln("Desembolso total do cliente", c.totalCliente + porForaTotal, postoUnit, {tot:true});
    }
    h += '</tbody></table>';

    var letra = (temTrading && !tradingDoCliente) ? (temPorFora ? "J" : "I") : (temPorFora ? "I" : "H");
    h += '<table class="doc-t doc-det" style="margin-top:14px"><tbody>';
    h += sec_(letra + ". Custo unit\u00e1rio final para o cliente");
    h += ln("Pre\u00e7o unit\u00e1rio com IPI", null, precoComIpi, {sub:true});
    if (temTrading) h += ln("(+) Taxa da trading dilu\u00edda em " + qty(c.qtd) + " " + un_, servTrading, servTradingUn, {sub:true});
    if (temFreteCli) h += ln("(+) Frete dilu\u00eddo em " + qty(c.qtd) + " " + un_, c.freteClienteTotal, c.freteClienteUnit, {sub:true});
    h += ln("Desembolso total do cliente e custo unit\u00e1rio final",
            c.totalCliente + porForaTotal, postoUnit, {tot:true});
    h += '</tbody></table>';

    h += '<table class="doc-t doc-ind"><tbody>'
      + '<tr><td>Margem operacional sobre a receita</td><td class="num">' + perc(m.margemOp) + '</td>'
      + '<td>Margem l\u00edquida</td><td class="num">' + perc(m.margemLiq) + '</td></tr>'
      + '<tr><td>Markup sobre o custo l\u00edquido</td><td class="num">' + brl(m.markup,4) + '\u00d7</td>'
      + '<td>Ponto de equil\u00edbrio por ' + un_ + '</td><td class="num">' + money(m.be,4) + '</td></tr>'
      + '<tr><td>Lucro l\u00edquido por cont\u00eainer</td><td class="num">' + money(m.lucroVolume) + '</td>'
      + '<td>Pre\u00e7o m\u00ednimo cobrindo os fixos</td><td class="num">' + money(m.beFixos,4) + '</td></tr>'
      + '<tr><td>Saldo credor de ICMS</td><td class="num">' + money(m.saldoCredorIcms) + '</td>'
      + '<td>Saldo credor de IPI</td><td class="num">' + money(c.ipiSaldoCredor) + '</td></tr>'
      + '</tbody></table>';

    h += '<p class="foot">Comparativo: lucro l\u00edquido em importa\u00e7\u00e3o direta ' + money(c.direta.liquido)
      + ' \u00b7 em conta e ordem ' + money(c.co.liquido)
      + ' \u00b7 diferen\u00e7a ' + money(c.co.liquido - c.direta.liquido) + '.</p></div>';
  }

  if (pr.obs) h += '<p class="doc-obs">' + esc(pr.obs) + '</p>';
  h += '<footer class="doc-f"><p style="float:right;font-size:9px;color:#9aa4ae">v' + VERSAO + '</p><p>Pre\u00e7os calculados com a taxa de c\u00e2mbio PTAX de R$ ' + brl(c.ptax, 4) + ' por US$ 1,00. Proposta sujeita \u00e0 confirma\u00e7\u00e3o de disponibilidade e \u00e0 varia\u00e7\u00e3o cambial at\u00e9 a data do fechamento. Tributos calculados com a legisla\u00e7\u00e3o vigente na data desta proposta; altera\u00e7\u00f5es de al\u00edquota, c\u00e2mbio ou frete internacional podem exigir revis\u00e3o de pre\u00e7o.</p>'
    + '<div class="doc-sign"><span class="line"></span><b>Assinatura e carimbo</b></div></footer></article>';
  return h;
}

function viewDemonstrativo(c){
  var h = head("Demonstrativo da opera\u00e7\u00e3o", ctx(c));
  h += '<div class="dem-ctl no-print">';
  h += sec(null, null, "Preencha os dados comerciais e gere o documento. A vers\u00e3o do cliente mostra apenas pre\u00e7o, tributos destacados e condi\u00e7\u00f5es; a vers\u00e3o interna acrescenta custo, margem e comparativo de modalidades.");
  h += '<div class="grid">'
    + pfld("cliente","Cliente",true) + pfld("cnpj","CNPJ")
    + pfld("numero","Proposta n\u00ba", false,
           jaEmitida(S.prop.numero) ? "J\u00e1 emitida \u2014 use Nova proposta para o pr\u00f3ximo n\u00famero"
                                    : "Pr\u00f3ximo da sequ\u00eancia, ainda n\u00e3o emitido")
    + pfld("data","Data", false, "Preenchida com a data de hoje")
    + pfld("validade","Validade da proposta") + pfld("porto","Porto de destino")
    + pfld("emitente","Raz\u00e3o social do emitente",true)
    + pfld("emitenteCnpj","CNPJ do emitente") + pfld("contato","Contato comercial")
    + pfld("prazo","Prazo de entrega",true)
    + pfld("pagamento","Condi\u00e7\u00f5es de pagamento",true)
    + pfld("obs","Observa\u00e7\u00f5es",true)
    + '</div>';
  var taxaInformada = num(S.p.tradingFixo) > 0 || num(S.p.tradingPct) > 0;
  if (taxaInformada && S.modo === "direta"){
    h += '<div class="warn"><b>A taxa da trading n\u00e3o entra nesta modalidade</b>'
      + 'Voc\u00ea informou taxa de trading nos par\u00e2metros, mas o demonstrativo est\u00e1 em '
      + '<b>Importa\u00e7\u00e3o direta</b>, onde n\u00e3o h\u00e1 trading e o valor \u00e9 zero. '
      + 'Troque para <b>Conta e ordem</b> no seletor do topo da tela para que a taxa apare\u00e7a no documento.'
      + '<div class="actions" style="margin-top:10px"><button class="btn alt" data-act="irContaOrdem">'
      + 'Mudar para conta e ordem</button></div></div>';
  }
  var nCli = contarDoCliente(S.prop.cliente);
  h += '<div class="calcbar" style="margin-top:14px">'
    + '<span>Proposta<b>' + esc(S.prop.numero || "\u2014") + '</b></span>'
    + '<span>Data<b>' + esc(S.prop.data) + '</b></span>'
    + '<span>Situa\u00e7\u00e3o<b>' + (jaEmitida(S.prop.numero) ? "emitida" : "em aberto") + '</b></span>'
    + '<span>Emitidas no ano<b>' + S.num.seq + '</b></span>'
    + (S.prop.cliente ? '<span>Para este cliente<b>' + nCli + '</b></span>' : '')
    + '</div>';
  h += '<div class="actions no-print">'
    + '<button class="btn alt" data-act="novaProposta">Nova proposta</button>'
    + (S.num.historico.length
        ? '<button class="btn ghost" data-act="verHistorico">'
          + (S.verHistorico ? "Ocultar" : "Ver") + ' hist\u00f3rico (' + S.num.historico.length + ')</button>'
        : '')
    + '</div>';

  if (S.verHistorico && S.num.historico.length){
    h += '<div class="tbl"><div class="h"><span>N\u00famero</span><span>Cliente</span>'
      + '<span>Data</span><span>Valor</span></div>';
    S.num.historico.slice(0, 30).forEach(function(x){
      h += '<div class="row"><span>' + esc(x.numero) + '</span>'
        + '<span>' + esc(x.cliente) + '</span>'
        + '<span class="num">' + esc(x.data) + '</span>'
        + '<span class="num">' + esc(x.valor) + '</span></div>';
    });
    h += '</div>';
    h += '<p class="foot">Hist\u00f3rico gravado neste navegador. Ele s\u00f3 registra o que foi gerado em PDF, '
      + 'ent\u00e3o simula\u00e7\u00e3o de rascunho n\u00e3o consome n\u00famero.</p>';
  }

  h += '<div class="actions">'
    + '<div class="switch" id="verSwitch">'
    + '<button data-ver="cliente" class="'+(S.versaoCliente?"on":"")+'">Vers\u00e3o do cliente</button>'
    + '<button data-ver="interna" class="'+(!S.versaoCliente?"on":"")+'">Vers\u00e3o interna</button></div>'
    + '<button class="btn" data-act="pdfCliente">Salvar em PDF \u2014 vers\u00e3o do cliente</button>'
    + '<button class="btn alt" data-act="pdfInterna">Salvar em PDF \u2014 vers\u00e3o interna</button>'
    + '<button class="btn alt" id="btnCopy">Copiar como texto</button>'
    + '</div>';
  h += '<p class="foot">O bot\u00e3o abre a caixa de impress\u00e3o do navegador. Para gerar o arquivo, escolha '
    + '<b>Destino</b> ou <b>Impressora</b> e selecione <b>Salvar como PDF</b>. O nome do arquivo j\u00e1 vem '
    + 'preenchido com o n\u00famero da proposta e o nome do cliente.</p>';
  h += '<p class="foot" id="copyMsg"></p>';
  h += '</div>';
  h += docHTML(c);
  return h;
}
function storeOf(nome){
  if (nome === "prop") return S.prop;
  if (nome === "forn") return S.forn[S.fornAtivo];
  return S.p;
}

/* Campo ligado ao fornecedor em edicao. */
function ffld(key, label, suffix, o){
  o = o || {};
  var f = S.forn[S.fornAtivo];
  if (o.texto){
    return '<div class="fld'+(o.wide?" wide":"")+'"><label>'+esc(label)+'</label>'
      + '<span class="in"><input data-k="'+key+'" data-store="forn" value="'+esc(f[key])+'" spellcheck="false"></span>'
      + (o.hint? '<span class="hint">'+esc(o.hint)+'</span>' : '') + '</div>';
  }
  if (o.options){
    return '<div class="fld'+(o.wide?" wide":"")+'"><label>'+esc(label)+'</label>'
      + '<select data-k="'+key+'" data-store="forn">'
      + o.options.map(function(op){
          return '<option value="'+esc(op[0])+'"'+(String(f[key])===String(op[0])?" selected":"")+'>'+esc(op[1])+'</option>';
        }).join('')
      + '</select>'
      + (o.hint? '<span class="hint">'+esc(o.hint)+'</span>' : '') + '</div>';
  }
  var dec = (o.dec === undefined) ? (NUMF[key] === undefined ? 2 : NUMF[key]) : o.dec;
  return '<div class="fld'+(o.wide?" wide":"")+'"><label>'+esc(label)+'</label>'
    + '<span class="in"><input data-k="'+key+'" data-store="forn" data-num="'+dec+'" inputmode="decimal" value="'
    + esc(fmtNum(f[key], dec)) + '" spellcheck="false">'
    + (suffix? '<em>'+esc(suffix)+'</em>' : '') + '</span>'
    + (o.hint? '<span class="hint">'+esc(o.hint)+'</span>' : '') + '</div>';
}

function pfld(key, label, wide, extra){
  return '<div class="fld'+(wide?" wide":"")+'"><label>'+esc(label)+'</label>'
    + '<span class="in"><input data-k="'+key+'" data-store="prop"'
    + (key === "cliente" ? ' id="campoCliente"' : '')
    + ' value="'+esc(S.prop[key])+'" spellcheck="false"></span>'
    + (extra ? '<span class="hint">'+esc(extra)+'</span>' : '') + '</div>';
}

function viewFornecedores(c){
  var SN = [["1","Sim"],["0","N\u00e3o"]];
  var un = u(), ativo = S.fornAtivo;
  var ids = ["A","B","C"];
  var res = {};
  ids.forEach(function(id){
    var cc = compute(paramsForn(id));
    res[id] = { c: cc, m: (S.modo === "direta" ? cc.direta : cc.co), nome: S.forn[id].nome || ("Fornecedor " + id) };
  });

  // menor custo liquido por unidade vence
  var melhor = ids[0];
  ids.forEach(function(id){ if (res[id].m.custoLiqUnit < res[melhor].m.custoLiqUnit) melhor = id; });
  var piores = ids.filter(function(id){ return id !== melhor; });

  var h = head("Comparativo de fornecedores", ctx(c));
  h += sec(null, null, "Tr\u00eas cen\u00e1rios de importa\u00e7\u00e3o com todas as vari\u00e1veis abertas. O pre\u00e7o de venda, as al\u00edquotas da sa\u00edda e o IRPJ vêm da aba Par\u00e2metros e s\u00e3o iguais nos tr\u00eas, porque o produto entregue ao cliente \u00e9 o mesmo. Modalidade em uso: " + (S.modo === "direta" ? "importa\u00e7\u00e3o direta" : "conta e ordem") + ".");

  // ---- veredito ----
  var mB = res[melhor], dif1 = res[piores[0]].m.custoLiqUnit - mB.m.custoLiqUnit,
      dif2 = res[piores[1]].m.custoLiqUnit - mB.m.custoLiqUnit;
  h += '<div class="hero"><div class="hero-main">'
    + '<span class="hero-lb">Menor custo l\u00edquido por ' + esc(un) + '</span>'
    + '<strong class="hero-v">' + esc(mB.nome) + '</strong>'
    + '<span class="hero-sub">' + money(mB.m.custoLiqUnit, 4) + ' por ' + esc(un)
    + ' \u00b7 ' + money(mB.m.custoLiq) + ' na opera\u00e7\u00e3o inteira</span></div>'
    + '<div class="hero-side">'
    + '<div><span>vs. ' + esc(res[piores[0]].nome) + '</span><strong>' + money(dif1, 4) + ' / ' + esc(un) + '</strong></div>'
    + '<div><span>vs. ' + esc(res[piores[1]].nome) + '</span><strong>' + money(dif2, 4) + ' / ' + esc(un) + '</strong></div>'
    + '<div><span>Lucro l\u00edquido no melhor</span><strong>' + money(mB.m.liquido) + '</strong></div>'
    + '</div></div>';

  // ---- tabela comparativa ----
  /* menorMelhor: true = menor vence, false = maior vence, null = nao marca.
     Linhas que crescem junto com o volume ficam neutras: mais quantidade nao
     significa melhor negocio, e marcar la confundiria a leitura. */
  function linha(rot, fn, menorMelhor, nota){
    var vals = ids.map(function(id){ return fn(res[id].c, res[id].m); });
    var alvo = (menorMelhor === null) ? null
             : (menorMelhor ? Math.min.apply(null, vals) : Math.max.apply(null, vals));
    var out = '<div class="row"><span>' + esc(rot) + (nota ? ' <em style="color:#5a6a7a;font-style:normal">' + esc(nota) + '</em>' : '') + '</span>';
    vals.forEach(function(v){
      var win = (alvo !== null && Math.abs(v - alvo) < 1e-9);
      out += '<span class="num' + (win ? ' best' : '') + '">' + fmtCel(rot, v) + '</span>';
    });
    return out + '</div>';
  }
  function fmtCel(rot, v){
    if (rot.indexOf("Margem") === 0) return perc(v);
    if (rot.indexOf("Quantidade") === 0) return qty(v) + " " + un;
    if (rot.indexOf("Peso") === 0) return brl(v, 2) + " t";
    if (rot.indexOf("por " + un) > 0 || rot.indexOf("equil\u00edbrio") > 0
        || rot.indexOf("por tonelada") > 0) return money(v, 4);
    return money(v);
  }

  h += sec("1", "Custo de nacionaliza\u00e7\u00e3o");
  h += '<div class="tbl"><div class="h"><span>Indicador</span>'
    + ids.map(function(id){ return '<span>' + esc(res[id].nome) + '</span>'; }).join('') + '</div>';
  h += linha("Quantidade total", function(c){ return c.qtd; }, null);
  h += linha("Peso total", function(c){ return c.peso; }, null);
  h += linha("Valor aduaneiro (CIF)", function(c){ return c.va; }, null);
  h += linha("Imposto de Importa\u00e7\u00e3o", function(c){ return c.ii; }, null);
  h += linha("Demais federais e taxas", function(c){ return c.subFed - c.ii; }, null);
  h += linha("ICMS-importa\u00e7\u00e3o", function(c, m){ return m.icmsImp; }, null);
  h += linha("Despesas locais", function(c, m){ return m.despLocais; }, null);
  h += linha("Custo total desembolsado", function(c, m){ return m.desembolsado; }, null);
  h += linha("Cr\u00e9ditos recuper\u00e1veis", function(c, m){ return c.ipiImp + c.pisImp + c.cofinsImp + m.credIcms + (m.credServico || 0); }, null);
  h += linha("Custo l\u00edquido da mercadoria", function(c, m){ return m.custoLiq; }, null);
  h += linha("Custo l\u00edquido por " + un, function(c, m){ return m.custoLiqUnit; }, true);
  h += linha("Custo l\u00edquido por tonelada", function(c, m){ return m.custoLiqTon; }, true);
  h += '</div>';

  h += sec("2", "Composi\u00e7\u00e3o do custo por " + un, "Cada componente dividido pela quantidade. \u00c9 aqui que d\u00e1 para comparar variavel por variavel, sem o efeito do volume de cada carga.");
  h += '<div class="tbl"><div class="h"><span>Componente</span>'
    + ids.map(function(id){ return '<span>' + esc(res[id].nome) + '</span>'; }).join('') + '</div>';
  function porUn(fn){ return function(c, m){ return c.qtd ? fn(c, m) / c.qtd : 0; }; }
  h += linha("FOB por " + un, porUn(function(c){ return c.fobBRL; }), true);
  h += linha("Frete internacional por " + un, porUn(function(c){ return c.freteBRL; }), true);
  h += linha("Seguro por " + un, porUn(function(c){ return c.seguroBRL; }), true);
  h += linha("II por " + un, porUn(function(c){ return c.ii; }), true);
  h += linha("Antidumping por " + un, porUn(function(c){ return c.antidumping; }), true);
  h += linha("Demais federais por " + un, porUn(function(c){ return c.subFed - c.ii - c.antidumping; }), true);
  h += linha("ICMS-importa\u00e7\u00e3o por " + un, porUn(function(c, m){ return m.icmsImp; }), true);
  h += linha("Despesas locais por " + un, porUn(function(c, m){ return m.despLocais; }), true);
  h += linha("Cr\u00e9ditos por " + un, porUn(function(c, m){ return -(c.ipiImp + c.pisImp + c.cofinsImp + m.credIcms + (m.credServico || 0)); }), false);
  h += linha("Custo l\u00edquido por " + un, function(c, m){ return m.custoLiqUnit; }, true);
  h += '</div>';

  h += sec("3", "Resultado ao pre\u00e7o de venda de " + money(c.preco, 4) + " por " + un);
  h += '<div class="tbl"><div class="h"><span>Indicador</span>'
    + ids.map(function(id){ return '<span>' + esc(res[id].nome) + '</span>'; }).join('') + '</div>';
  h += linha("Receita bruta", function(c){ return c.receita; }, null);
  h += linha("Impostos sobre a venda", function(c, m){ return m.impostos; }, null);
  h += linha("LAIR", function(c, m){ return m.lair; }, false);
  h += linha("Lucro l\u00edquido", function(c, m){ return m.liquido; }, false);
  h += linha("Margem l\u00edquida", function(c, m){ return m.margemLiq; }, false);
  h += linha("Ponto de equil\u00edbrio por " + un, function(c, m){ return m.be; }, true);
  h += linha("Saldo credor de ICMS", function(c, m){ return m.saldoCredorIcms; }, true);
  h += '</div>';
  h += '<p class="foot">Verde marca o melhor n\u00famero de cada linha. Quantidades diferentes entre fornecedores s\u00e3o normais: por isso a compara\u00e7\u00e3o que decide \u00e9 o custo l\u00edquido por ' + esc(un) + ', n\u00e3o o total da opera\u00e7\u00e3o.</p>';

  // ---- editor ----
  h += sec("4", "Vari\u00e1veis de cada fornecedor", "Escolha o fornecedor e edite. Cada um tem seu pr\u00f3prio c\u00e2mbio, frete, tributos e despesas.");
  h += '<div class="actions no-print"><div class="switch" id="fornSwitch">'
    + ids.map(function(id){
        return '<button data-forn="' + id + '"' + (ativo === id ? ' class="on"' : '') + '>' + esc(res[id].nome) + '</button>'; }).join('')
    + '</div>'
    + '<button class="btn alt" data-act="fornCopiar">Copiar dos Par\u00e2metros</button>'
    + '<button class="btn alt" data-act="fornAplicar">Aplicar aos Par\u00e2metros</button></div>';

  h += sec(null, "Identifica\u00e7\u00e3o e carga");
  h += '<div class="grid">'
    + ffld("nome", "Nome do fornecedor", null, {texto:true, wide:true})
    + ffld("origem", "Pa\u00eds de origem", null, {texto:true})
    + ffld("preferencia", "Prefer\u00eancia tarif\u00e1ria do acordo", "% do II", {hint:"100 = II zerado com certificado de origem"})
    + ffld("ptax", "C\u00e2mbio PTAX", "R$/US$")
    + ffld("nVolumes", "N\u00ba de cont\u00eaineres / volumes", "")
    + ffld("qtdPorVolume", "Quantidade por volume (" + un + ")", "")
    + ffld("pesoPorVolume", "Peso por volume", "t")
    + ffld("fobUnit", "FOB por " + un, "US$")
    + '</div>';
  h += sec(null, "Fretes e seguro");
  h += '<div class="grid">'
    + ffld("freteIntl", "Frete internacional por cont\u00eainer", "US$")
    + ffld("seguroPct", "Seguro internacional", "% do FOB")
    + ffld("freteNacional", "Frete nacional porto \u2192 dep\u00f3sito", "R$/cont.")
    + '</div>';
  h += sec(null, "Tributos de nacionaliza\u00e7\u00e3o");
  h += '<div class="grid">'
    + ffld("ii", "II \u2014 Imposto de Importa\u00e7\u00e3o", "%")
    + ffld("ipiImp", "IPI importa\u00e7\u00e3o", "%")
    + ffld("pisImp", "PIS-Importa\u00e7\u00e3o", "%")
    + ffld("cofinsImp", "COFINS-Importa\u00e7\u00e3o", "%")
    + ffld("adicCofins", "Adicional COFINS-Importa\u00e7\u00e3o", "%", {hint:"N\u00e3o gera cr\u00e9dito"})
    + ffld("afrmm", "AFRMM sobre o frete mar\u00edtimo", "%")
    + ffld("siscomex", "Taxa Siscomex/DUIMP", "R$")
    + ffld("antidumping", "Antidumping", "US$/t", {hint:"Varia por produtor e origem"})
    + ffld("icmsImp", "ICMS-importa\u00e7\u00e3o \u2014 al\u00edquota", "%")
    + ffld("icmsImpCreditavel", "ICMS-importa\u00e7\u00e3o \u00e9 credit\u00e1vel?", null, {options:SN})
    + '</div>';
  h += sec(null, "Despesas aduaneiras e locais");
  h += '<div class="grid">'
    + ffld("despachante", "Despachante aduaneiro", "R$/import.")
    + ffld("armazenagem", "Armazenagem / THC / capatazia", "R$/cont.")
    + ffld("outras", "Outras despesas", "R$/import.")
    + '</div>';
  return h;
}

function viewFontes(c){
  var itens = [
    ["Vers\u00e3o deste simulador", "v" + VERSAO + ". Se o n\u00famero aqui n\u00e3o bate com o da vers\u00e3o que voc\u00ea recebeu, o navegador est\u00e1 abrindo um arquivo antigo: baixe de novo e recarregue com Ctrl+Shift+R."],
    ["Estrutura da carga","Uma importa\u00e7\u00e3o = um produto. Informa-se n\u00ba de cont\u00eaineres, quantidade e peso por cont\u00eainer e FOB por unidade; os totais s\u00e3o calculados. Frete internacional, frete nacional e armazenagem s\u00e3o por cont\u00eainer. Siscomex, despachante e outras despesas s\u00e3o por importa\u00e7\u00e3o."],
    ["II e prefer\u00eancia de origem","A al\u00edquota cheia vem da TEC do NCM. Acordos de complementa\u00e7\u00e3o econ\u00f4mica podem reduzir ou zerar o II mediante certificado de origem. No ACE 58 (Mercosul\u2013Peru) quase todo o universo tarif\u00e1rio est\u00e1 desgravado, com exce\u00e7\u00e3o de 12 c\u00f3digos de a\u00e7\u00facar, \u00e1lcool, pneus e artefatos t\u00eaxteis. Confirmar o c\u00f3digo e a regra de origem antes de aplicar a prefer\u00eancia."],
    ["PIS/COFINS-Importa\u00e7\u00e3o","Lei 10.865/2004, art. 8\u00ba. Regra geral 2,10% e 9,65% sobre o valor aduaneiro. Cr\u00e9dito integral no Lucro Real, art. 15."],
    ["Adicional da COFINS-Importa\u00e7\u00e3o","\u00a721 do art. 8\u00ba, com o cronograma do \u00a721-A: 0,8% em 2025, 0,6% em 2026 e 0,4% em 2027. N\u00e3o gera cr\u00e9dito \u2014 art. 15, \u00a71\u00ba-A, e STF Tema 1047. Verificar se o NCM consta da lista."],
    ["PIS/COFINS sobre a venda","STF Tema 69 (RE 574.706): o ICMS destacado n\u00e3o comp\u00f5e a base. O simulador aplica a exclus\u00e3o por padr\u00e3o."],
    ["AFRMM","Lei 14.301/2022 \u2014 8% na navega\u00e7\u00e3o de longo curso, sobre o frete mar\u00edtimo internacional. A n\u00e3o incid\u00eancia para o Norte e Nordeste alcan\u00e7a cabotagem e navega\u00e7\u00e3o interior, n\u00e3o o longo curso."],
    ["Taxa Siscomex","Valor por DI/DUIMP. Confirmar o n\u00famero de adi\u00e7\u00f5es com o despachante."],
    ["Antidumping","Aplicado em US$ por tonelada e definido por produtor e origem. A prefer\u00eancia tarif\u00e1ria do acordo n\u00e3o afasta o direito antidumping."],
    ["ICMS importa\u00e7\u00e3o","LC 87/96, art. 13, V: base formada por valor aduaneiro, II, IPI, IOF, demais despesas aduaneiras e o pr\u00f3prio imposto, por dentro. Confirmar quais despesas locais o estado exige na base."],
    ["ICMS venda 4%","Resolu\u00e7\u00e3o do Senado 13/2012 \u2014 al\u00edquota interestadual para importado revendido sem industrializa\u00e7\u00e3o. Venda interna usa a al\u00edquota do estado."],
    ["IPI na revenda","Importador revendedor \u00e9 equiparado a industrial pelo RIPI (Decreto 7.212/2010): credita na entrada e destaca na sa\u00edda. Quando o cr\u00e9dito de entrada supera o d\u00e9bito de sa\u00edda forma-se saldo credor, monitorado na aba Venda."],
    ["IRPJ/CSLL","Simplifica\u00e7\u00e3o de 15% + adicional de 10% + CSLL 9%. O adicional s\u00f3 incide sobre o que exceder R$ 20 mil por m\u00eas de lucro, ent\u00e3o em opera\u00e7\u00f5es pequenas a al\u00edquota linear superestima o imposto."],
    ["Taxa da trading","A remunera\u00e7\u00e3o tem duas partes: um percentual sobre o valor aduaneiro, que acompanha o tamanho da carga, e uma taxa fixa por cont\u00eainer, multiplicada pela quantidade de volumes. Confira no contrato se a taxa fixa \u00e9 mesmo por cont\u00eainer ou por processo: em algumas tradings ela \u00e9 por DUIMP, e a\u00ed basta informar o valor total no campo e deixar apenas um volume."],
    ["Conta e ordem \u2014 enquadramento","IN RFB 1.861/2018. A trading promove o despacho em seu nome, mas a mercadoria \u00e9 do adquirente. N\u00e3o h\u00e1 compra e venda entre as duas, apenas presta\u00e7\u00e3o de servi\u00e7o."],
    ["Conta e ordem \u2014 PIS/COFINS","IN SRF 247/2002, art. 12, \u00a71\u00ba: a receita bruta da importadora \u00e9 apenas o valor dos servi\u00e7os. Lei 10.865/2004, art. 18: os cr\u00e9ditos de PIS/COFINS-Importa\u00e7\u00e3o s\u00e3o do adquirente."],
    ["Conta e ordem \u2014 IPI","RIPI art. 9\u00ba, IX: o adquirente equipara-se a estabelecimento industrial. \u00c9 ele quem credita o IPI da importa\u00e7\u00e3o e destaca o IPI na sa\u00edda."],
    ["Conta e ordem \u2014 ICMS (Tema 520)","STF, ARE 665.134: o sujeito ativo do ICMS-importa\u00e7\u00e3o \u00e9 o estado do destinat\u00e1rio legal. Em conta e ordem cabe ao estado do adquirente, de modo que benef\u00edcio fiscal do estado da trading n\u00e3o se aproveita se o adquirente estiver em outra UF."],
    ["Saldo credor de ICMS","Quando o ICMS-importa\u00e7\u00e3o \u00e9 pago \u00e0 al\u00edquota interna e a revenda sai a 4% interestadual, o cr\u00e9dito de entrada supera o d\u00e9bito de sa\u00edda e forma saldo credor. N\u00e3o \u00e9 perda cont\u00e1bil, mas \u00e9 caixa imobilizado sem prazo de realiza\u00e7\u00e3o."],
    ["Dois pisos de pre\u00e7o","Ponto de equil\u00edbrio cobre custo da mercadoria, impostos e vari\u00e1veis. O pre\u00e7o m\u00ednimo cobrindo os fixos inclui as despesas dedut\u00edveis rateadas."],
    ["O que o modelo n\u00e3o cobre","ICMS-ST, DIFAL em venda para n\u00e3o contribuinte, varia\u00e7\u00e3o cambial entre o pagamento e o registro da DUIMP, custo financeiro do adiantamento, demurrage e ap\u00f3lice calculada sobre CIF \u00d7 110%."],
    ["Reforma tribut\u00e1ria","LC 214/2025: 2026 \u00e9 ano-teste, com al\u00edquotas de 0,9% de CBS e 0,1% de IBS destacadas nos documentos fiscais e compensadas em PIS/COFINS, sem custo adicional. A estrutura vale para 2026; refazer o modelo a partir de 2027."]
  ];
  var h = head("Fontes, premissas e pontos a validar", ctx(c));
  h += sec(null, null, "Os n\u00fameros carregados s\u00e3o exemplos. Substituir pelos dados reais antes de decidir.");
  h += '<div class="src">' + itens.map(function(i){
    return '<div><b>'+esc(i[0])+'</b><p>'+esc(i[1])+'</p></div>'; }).join('') + '</div>';
  return h;
}

/* ============================ RENDER ============================ */
function render(){
  var boot = document.getElementById("boot");
  if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  var c = compute(S.p);
  document.getElementById("tabs").innerHTML = TABS.map(function(t){
    return '<button data-tab="'+t[0]+'" class="'+(S.tab===t[0]?"on":"")+'">'+esc(t[1])+'</button>'; }).join("");
  var v = { resumo:viewResumo, parametros:viewParametros, nacionalizacao:viewNacionalizacao,
            venda:viewVenda, contaordem:viewContaOrdem, precoalvo:viewPrecoAlvo,
            fornecedores:viewFornecedores, demonstrativo:viewDemonstrativo,
            fontes:viewFontes }[S.tab];
  document.getElementById("sheet").innerHTML = v(c);
  var m = M(c), un = u();
  document.getElementById("kpis").innerHTML =
      kpi("Custo l\u00edquido / "+un, money(m.custoLiqUnit,4))
    + kpi("Pre\u00e7o de venda / "+un, money(c.preco,4))
    + kpi("Margem l\u00edquida", perc(m.margemLiq))
    + kpi("Lucro l\u00edquido", money(m.liquido))
    + '<div class="mode">'+(S.modo==="direta"?"Direta":"Conta e ordem")+' \u00b7 v'+VERSAO+'</div>';
  document.querySelectorAll("#modeSwitch button").forEach(function(b){
    b.className = (b.getAttribute("data-mode")===S.modo) ? "on" : ""; });
  save();
}
function kpi(l,v){ return '<div><span>'+esc(l)+'</span><strong>'+v+'</strong></div>'; }

/* ============================ EVENTOS ============================ */
document.addEventListener("click", function(e){
  var t = e.target.closest ? e.target.closest("button") : null;
  if (!t) return;
  if (t.hasAttribute("data-tab")){ S.tab = t.getAttribute("data-tab"); render(); window.scrollTo(0,0); return; }
  if (t.hasAttribute("data-mode")){ S.modo = t.getAttribute("data-mode"); render(); return; }
  if (t.hasAttribute("data-ver")){ S.versaoCliente = (t.getAttribute("data-ver")==="cliente"); render(); return; }
  if (t.hasAttribute("data-forn")){ S.fornAtivo = t.getAttribute("data-forn"); render(); return; }
  if (t.getAttribute("data-act") === "fornCopiar"){
    var alvo = S.forn[S.fornAtivo];
    for (var i = 0; i < FORN_KEYS.length; i++){
      var k = FORN_KEYS[i];
      if (k !== "nome" && S.p[k] !== undefined) alvo[k] = S.p[k];
    }
    render(); return;
  }
  if (t.getAttribute("data-act") === "fornAplicar"){
    if (confirm("Levar as vari\u00e1veis de " + (S.forn[S.fornAtivo].nome || S.fornAtivo) + " para a aba Par\u00e2metros?")){
      var de = S.forn[S.fornAtivo];
      for (var j = 0; j < FORN_KEYS.length; j++){
        var kk = FORN_KEYS[j];
        if (kk !== "nome" && de[kk] !== undefined) S.p[kk] = de[kk];
      }
      S.tab = "parametros"; render(); window.scrollTo(0,0);
    }
    return;
  }
  if (t.id === "btnReset"){
    if (confirm("Restaurar todos os par\u00e2metros para os valores padr\u00e3o?")){
      S.p = Object.assign({}, DEFAULTS); render(); }
    return; }
  if (t.getAttribute("data-act") === "irContaOrdem"){ S.modo = "co"; render(); window.scrollTo(0,0); return; }
  if (t.getAttribute("data-act") === "novaProposta"){
    S.prop.numero = proximoNumero();
    S.prop.data = hojeBR();
    render(); return;
  }
  if (t.getAttribute("data-act") === "verHistorico"){ S.verHistorico = !S.verHistorico; render(); return; }
  if (t.getAttribute("data-act") === "pdfCliente"){ imprimirVersao(true); return; }
  if (t.getAttribute("data-act") === "pdfInterna"){ imprimirVersao(false); return; }
  if (t.id === "btnCopy"){ copyDoc(); return; }
});
document.addEventListener("input", function(e){
  var el = e.target;
  if (!el.hasAttribute || !el.hasAttribute("data-k")) return;
  var store = storeOf(el.getAttribute("data-store"));
  var chave = el.getAttribute("data-k");
  if (el.hasAttribute("data-num")){
    store[chave] = String(parseField(el.value, parseInt(el.getAttribute("data-num"), 10)));
  } else {
    store[chave] = el.value;
  }
  if (el.tagName === "SELECT") { render(); return; }
  // mudou o cliente numa proposta ja emitida: a proxima ganha numero novo
  if (el.getAttribute("data-store") === "prop" && chave === "cliente" && jaEmitida(S.prop.numero)){
    S.prop.numero = proximoNumero();
    render();
    var campo = document.getElementById("campoCliente");
    if (campo){ campo.focus(); try{ campo.setSelectionRange(campo.value.length, campo.value.length); }catch(e){} }
    return;
  }
  softRefresh();
});
document.addEventListener("blur", function(e){
  var el = e.target;
  if (!el.hasAttribute || !el.hasAttribute("data-num")) return;
  var d = parseInt(el.getAttribute("data-num"), 10);
  var val = Number(parseField(el.value, d).toFixed(d));   // guarda com a precisao do campo
  storeOf(el.getAttribute("data-store"))[el.getAttribute("data-k")] = String(val);
  el.value = val.toLocaleString("pt-BR", {minimumFractionDigits:0, maximumFractionDigits:d});
  render();
}, true);

var refreshTimer = null;
function softRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(function(){
    var c = compute(S.p), m = M(c), un = u();
    document.getElementById("kpis").innerHTML =
        kpi("Custo l\u00edquido / "+un, money(m.custoLiqUnit,4))
      + kpi("Pre\u00e7o de venda / "+un, money(c.preco,4))
      + kpi("Margem l\u00edquida", perc(m.margemLiq))
      + kpi("Lucro l\u00edquido", money(m.liquido))
      + '<div class="mode">'+(S.modo==="direta"?"Direta":"Conta e ordem")+'</div>';
    var cb = document.getElementById("calcbar");
    if (cb){ var box = document.createElement("div"); box.innerHTML = calcbarHTML(c);
             cb.parentNode.replaceChild(box.firstChild, cb); }
    if (S.tab === "fornecedores"){
      var ativo = document.activeElement;
      var chave = ativo && ativo.getAttribute("data-k");
      var editando = chave && ativo.getAttribute("data-store") === "forn";
      var valor = editando ? ativo.value : "";
      var inicio = editando ? ativo.selectionStart : null;
      var fim = editando ? ativo.selectionEnd : null;
      render();
      if (editando){
        var novo = document.querySelector('[data-store="forn"][data-k="'+chave+'"]');
        if (novo){
          novo.value = valor;
          novo.focus({preventScroll:true});
          if (inicio !== null) novo.setSelectionRange(inicio, fim);
        }
      }
      return;
    }
    if (S.tab === "demonstrativo"){
      var old = document.getElementById("doc");
      if (old){ var wrap = document.createElement("div"); wrap.innerHTML = docHTML(c);
                old.parentNode.replaceChild(wrap.firstChild, old); }
    }
    save();
  }, 250);
}

/* ---------------------- IMPRESSAO ---------------------- */
/* O navegador usa o titulo da pagina como nome do arquivo PDF. */
function nomeArquivoDoc(){
  var partes = [S.versaoCliente ? "Proposta" : "Demonstrativo-interno",
                String(S.prop.numero || "").replace(/[\/\\]/g, "-")];
  if (S.prop.cliente) partes.push(String(S.prop.cliente).replace(/[^\w\u00C0-\u017F]+/g, "-").slice(0, 40));
  return partes.filter(Boolean).join("_").replace(/-+/g, "-").replace(/_+/g, "_");
}

/* Imprime a propria pagina. A folha de estilo de impressao esconde tudo
   menos o documento. Abrir janela nova era fragil: bloqueador de pop-up
   cancelava sem avisar. */
/* Imprime a versao pedida, independentemente da que esta na tela,
   e devolve a tela ao estado anterior. */
function imprimirVersao(cliente){
  var antes = S.versaoCliente;
  S.versaoCliente = cliente;
  registrarProposta(compute(S.p));   // consome o n\u00famero: o pr\u00f3ximo ser\u00e1 novo
  render();
  printDoc(function(){
    if (antes !== cliente){ S.versaoCliente = antes; render(); }
  });
}

function printDoc(aoTerminar){
  var titulo = document.title;
  document.title = nomeArquivoDoc();
  document.body.classList.add("imprimindo");
  function restaurar(){
    document.body.classList.remove("imprimindo");
    document.title = titulo;
    if (window.removeEventListener) window.removeEventListener("afterprint", restaurar);
    if (typeof aoTerminar === "function"){ var fn = aoTerminar; aoTerminar = null; fn(); }
  }
  if (window.addEventListener) window.addEventListener("afterprint", restaurar);
  setTimeout(function(){
    try { window.print(); } catch(e){}
    setTimeout(restaurar, 1500);   // navegadores que nao disparam afterprint
  }, 60);
}

function copyDoc(){
  var c = compute(S.p), p = S.p, pr = S.prop, un = u();
  var linhas = [
    "PROPOSTA COMERCIAL N\u00ba " + pr.numero,
    pr.emitente + (pr.emitenteCnpj ? " \u2014 CNPJ " + pr.emitenteCnpj : ""),
    "Cliente: " + (pr.cliente || "\u2014") + (pr.cnpj ? "   CNPJ: " + pr.cnpj : ""),
    "Data: " + pr.data + "   Validade: " + pr.validade, "",
    "Produto: " + p.produto + "   NCM: " + p.ncm + "   Origem: " + p.origem,
    "C\u00e2mbio PTAX: R$ " + brl(c.ptax, 4) + " por US$ 1,00",
    "Quantidade: " + qty(c.qtd) + " " + un + " (" + qty(c.nVol) + " cont\u00eainer(es))",
    "Porto de destino: " + pr.porto, "",
    "Pre\u00e7o unit\u00e1rio sem IPI: " + money(c.preco,4) + " por " + un,
    "IPI (" + brl(num(p.ipiSaida),2) + "%): " + money(c.ipiNF),
    "Pre\u00e7o unit\u00e1rio com IPI: " + money(c.qtd? c.totalCliente/c.qtd : 0, 4)
  ];
  var servT = (S.modo === "co" && !c.tradingCli) ? c.co.servicoTrading : 0;
  var porForaT = c.freteClienteTotal + ((S.modo === "co" && c.tradingCli) ? c.servicoTradingTotal : 0);
  if (servT > 0){
    linhas.push("Taxa de servi\u00e7o da trading: " + money(servT));
    linhas.push("Taxa da trading por " + un + ": " + money(c.qtd ? servT / c.qtd : 0, 4));
    linhas.push("VALOR TOTAL DA OPERA\u00c7\u00c3O: " + money(c.totalCliente + servT));
    linhas.push("Custo unit\u00e1rio total, com IPI e taxa: "
                + money(c.qtd ? (c.totalCliente + servT) / c.qtd : 0, 4) + " por " + un);
  } else {
    linhas.push("VALOR TOTAL: " + money(c.totalCliente));
  }
  if (porForaT > 0){
    linhas.push("");
    linhas.push("PAGO POR VOC\u00ca DIRETAMENTE, FORA DA NOTA FISCAL:");
    if (S.modo === "co" && c.tradingCli)
      linhas.push("  Taxa de servi\u00e7o da trading: " + money(c.servicoTradingTotal)
                  + "  (" + money(c.qtd ? c.servicoTradingTotal / c.qtd : 0, 4) + " por " + un + ")");
    if (c.freteClienteTotal > 0)
      linhas.push("  Frete porto \u2192 seu endere\u00e7o: " + money(c.freteClienteTotal)
                  + "  (" + money(c.freteClienteUnit, 4) + " por " + un + ")");
    linhas.push("  Subtotal: " + money(porForaT));
    linhas.push("DESEMBOLSO TOTAL DA OPERA\u00c7\u00c3O: " + money(c.totalCliente + servT + porForaT));
    linhas.push("Custo total por " + un + " posto no seu endere\u00e7o: "
                + money(c.qtd ? (c.totalCliente + servT + porForaT) / c.qtd : 0, 4));
  }
  linhas.push("");
  linhas.push("Prazo de entrega: " + pr.prazo);
  linhas.push("Condi\u00e7\u00f5es de pagamento: " + pr.pagamento);
  if (pr.contato) linhas.push("Contato: " + pr.contato);
  if (pr.obs) linhas.push("", "Observa\u00e7\u00f5es: " + pr.obs);
  var txt = linhas.join("\n");
  var msg = document.getElementById("copyMsg");
  function ok(){ if (msg) msg.textContent = "Demonstrativo copiado para a \u00e1rea de transfer\u00eancia."; }
  function fail(){ if (msg) msg.textContent = "N\u00e3o foi poss\u00edvel copiar automaticamente. Use o bot\u00e3o de imprimir."; }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(ok, fallback);
  } else { fallback(); }
  function fallback(){
    try{
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var done = document.execCommand("copy");
      document.body.removeChild(ta);
      done ? ok() : fail();
    }catch(err){ fail(); }
  }
}

/* aplica a logo nos elementos da casca, evitando duplicar a imagem no build */
(function(){
  var b = document.getElementById("brandLogo"); if (b) b.src = LOGO_LIGHT;
  var f = document.getElementById("favicon");   if (f) f.href = LOGO_DARK;

  // a data \u00e9 sempre a do dia em que a simula\u00e7\u00e3o est\u00e1 sendo feita
  S.prop.data = hojeBR();
  // se o n\u00famero em uso j\u00e1 foi emitido, ou nunca existiu, puxa o pr\u00f3ximo
  if (!S.prop.numero || jaEmitida(S.prop.numero)) S.prop.numero = proximoNumero();
})();

render();
