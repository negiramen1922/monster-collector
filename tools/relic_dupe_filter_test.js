/* regression test: 遺物に「覚醒(凸)」フィルターを追加し、遺物一覧(図鑑)・遺物図鑑の
   セル・キャラの装備遺物選択(relicPicker)のどこでも、覚醒(凸)で★が上がっている時は
   その分の★も(色を変えて)見えるようにした。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, RELICS,
  grantRelic, useRelicDupe, equipRelic,
  relicStarRowHtml, relicCell, matchesRelicFilter, relicFilterCount,
  openRelicPicker, renderRelicPicker, closeRelicPicker,
  RELIC_MAX_DUPE_USE,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// document.getElementById('modal-layer') needs the same tracking-stub trick used elsewhere,
// since renderRelicPicker writes into it via a fresh getElementById() call each time.
let modalHtml = '';
const modalStub = { innerHTML: '', classList: { add(){ modalHtml = modalStub.innerHTML; }, remove(){} }, querySelector: () => null };
const realGetById = global.document.getElementById;
global.document.getElementById = id => id === 'modal-layer' ? modalStub : realGetById(id);

api.STATE = E.DEFAULT_STATE();
const relicId = 'rel_flame_ember';
const def = E.RELICS[relicId];
E.grantRelic(def);
// 覚醒(凸)を2回分使えるように、重複所持数(dupe)を確保してから使う
api.STATE.relics[relicId].dupe = 2;
E.useRelicDupe(relicId);
E.useRelicDupe(relicId);
const st = api.STATE.relics[relicId];
ok('準備: dupeUsedが2になっている', st.dupeUsed === 2, st.dupeUsed);

// --- 1. relicStarRowHtml: 基礎★+覚醒分の★が色分けして出る ---
const starHtml = E.relicStarRowHtml(def, st);
const baseStars = '★'.repeat(def.star);
const dupeStars = '★'.repeat(st.dupeUsed);
ok('基礎の★がそのまま出る', starHtml.startsWith(baseStars));
ok('覚醒分の★がrelic-dupe-starで色分けされて追加される', starHtml.includes(`<span class="relic-dupe-star">${dupeStars}</span>`));

// 未覚醒(dupeUsedなし)の遺物は追加★が出ない
const otherId = Object.keys(E.RELICS).find(id => id !== relicId);
const otherDef = E.RELICS[otherId];
ok('未覚醒の遺物は基礎の★だけになる', E.relicStarRowHtml(otherDef, null) === '★'.repeat(otherDef.star));

// --- 2. 遺物図鑑のセル(relicCell)にも覚醒分の★が出る ---
const cellHtml = E.relicCell(relicId);
ok('遺物図鑑のセルにも覚醒分の★が表示される', cellHtml.includes(`<span class="relic-dupe-star">${dupeStars}</span>`));

// --- 3. キャラの装備遺物選択(relicPicker)にも覚醒分の★が出る ---
api.STATE.owned['m06'] = { star: 5, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
modalHtml = '';
E.openRelicPicker('m06');
ok('装備遺物選択の一覧にも覚醒分の★が表示される', modalHtml.includes(`<span class="relic-dupe-star">${dupeStars}</span>`));

// --- 4. 「覚醒(凸)」フィルター: dupeUsedの値で絞り込める ---
ok('覚醒2の遺物はdupe:["2"]フィルターに一致する', E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: ['2'] }));
ok('覚醒2の遺物はdupe:["0"]フィルター(未覚醒)には一致しない', !E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: ['0'] }));
ok('未覚醒の遺物はdupe:["0"]フィルターに一致する', E.matchesRelicFilter(otherId, { star: [], channel: [], dupe: ['0'] }));
ok('dupeフィルターが空なら誰にでも一致する(フィルターなし扱い)', E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: [] }));
ok('relicFilterCountがdupeの選択数も数える', E.relicFilterCount({ star: [], channel: [], dupe: ['1', '2'] }) === 2);

console.log('done');
