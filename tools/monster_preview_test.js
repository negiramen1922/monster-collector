/* regression test: ガチャのピックアップキャラなど、未所持のモンスターでも性能(基礎
   ステータス・スキル構成)を確認できる。所持済みなら今まで通りshowMonsterDetail(育成
   状況込み)を開き、未所持ならshowMonsterPreview(Lv1基礎ステータスの読み取り専用)を
   開く、というopenMonsterDetailOrPreviewの振り分けを確認する。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID,
  showMonsterPreview, showMonsterDetail, openMonsterDetailOrPreview,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// document.getElementById('modal-layer') is looked up fresh on every call (not captured in a
// closure like `storage` is), so we can swap it for a tracking stub anytime after load().
let modalHtml = '';
const modalStub = { innerHTML: '', classList: { add(){ modalHtml = modalStub.innerHTML; }, remove(){} }, querySelector: () => null };
const realGetById = global.document.getElementById;
global.document.getElementById = id => id === 'modal-layer' ? modalStub : realGetById(id);

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- 未所持: showMonsterPreviewはLv1の基礎ステータスとスキル名を表示する ---
modalHtml = '';
E.showMonsterPreview('m54'); // タイタン、確認用に所持していない状態で呼ぶ
ok('未所持キャラのプレビューが名前を表示する', modalHtml.includes(E.MON_BY_ID.m54.name), modalHtml.slice(0, 80));
ok('未所持キャラのプレビューはLv1基礎ステータスの断り書きを表示する', modalHtml.includes('未所持'));
ok('未所持キャラのプレビューにスキルカードが含まれる', modalHtml.includes('skill-card'));
ok('レベル上げ・昇格・遺物などの育成UIは出さない(読み取り専用)', !modalHtml.includes('data-levelup') && !modalHtml.includes('data-promote') && !modalHtml.includes('data-relic-slot'));

// --- 存在しないIDを渡しても何も書き換えず、例外も投げない ---
modalHtml = '';
let threw = false;
try{ E.showMonsterPreview('not-a-real-monster'); }catch(e){ threw = true; }
ok('存在しないIDでは例外を投げない', !threw);
ok('存在しないIDではモーダルを書き換えない', modalHtml === '');

// --- openMonsterDetailOrPreview: 未所持ならプレビュー、所持済みなら通常の詳細を開く ---
modalHtml = '';
E.openMonsterDetailOrPreview('m54');
ok('未所持ならプレビュー(育成UIなし)が開く', modalHtml.includes(E.MON_BY_ID.m54.name) && !modalHtml.includes('data-promote'), modalHtml.slice(0, 60));

S.owned.m54 = { star: 5, souls: 0, level: 30, exp: 0, skillLv: 3, skill2Lv: 3, ultLv: 3, passiveLv: 3 };
modalHtml = '';
E.openMonsterDetailOrPreview('m54');
ok('所持済みなら通常の詳細(育成UIあり)が開く', modalHtml.includes('data-promote') && modalHtml.includes('data-relic-slot="m54"'), modalHtml.slice(0, 60));

global.document.getElementById = realGetById;
console.log('done');
