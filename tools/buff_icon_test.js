/* regression test: バフ/デバフ/状態異常アイコン。BUFF_ICON/STATUS_ICONは絵文字だった
   ものを、ELEM_ICON/CURRENCY_ICON/ITEM_ICONと同じ「ICON_DATA[key]があれば本物の画像、
   なければ手描きSVG」というdataIcon()の仕組みに合わせて作り直した。実際のドット絵に
   差し替える時はICON_DATAにキーを追加するだけで済む、という前提を固定する。 */
const fs = require('fs');
const path = require('path');
const load = require('./harness.js');

// ICON_DATAはdocument.getElementById('icon-data').textContentから読み込み時に1回だけ
// 構築される(ELEM_ICON等と同じ)ので、load()より前にicon-dataだけ差し替えておく。
const fakeIconData = { buff_strUp: 'RkFLRV9TVFJVUA==' }; // 'strUp'だけ実画像がある想定のフェイク
const origGetById = global.document.getElementById;
global.document.getElementById = key => key === 'icon-data'
  ? { textContent: JSON.stringify(fakeIconData) }
  : origGetById(key);

const api = load('game.js', src => src + `;global.__e = {
  STATUS_ICON, BUFF_ICON, BUFF_LABEL, STATUS_LABEL, ICON_DATA,
};`);
global.document.getElementById = origGetById;
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// --- ICON_DATAに実画像がある(strUp)ものはbase64画像を使い、無いものは手描きSVGにフォールバックする ---
ok('ICON_DATAに登録したキーは本物の画像(base64 PNG)を使う', E.BUFF_ICON.strUp.includes('data:image/png;base64,RkFLRV9TVFJVUA=='), E.BUFF_ICON.strUp.slice(0, 60));
ok('ICON_DATAに無いキーは手描きSVG(data:image/svg+xml)にフォールバックする', E.BUFF_ICON.strDown.includes('data:image/svg+xml'), E.BUFF_ICON.strDown.slice(0, 60));
ok('STATUS_ICONも同じ仕組み(未登録なのでSVGフォールバック)', E.STATUS_ICON.burn.includes('data:image/svg+xml'));

// --- 全部<img class="ico ico-buff">の形になっている ---
const allIcons = { ...E.STATUS_ICON, ...E.BUFF_ICON };
const badShape = Object.entries(allIcons).filter(([k, html]) => !/^<img class="ico ico-buff"/.test(html));
ok('全アイコンが<img class="ico ico-buff">の形式', badShape.length === 0, badShape.map(([k]) => k));

// --- ゲーム内で実際に使われているバフ/デバフキーが、全部アイコンを持っている(抜け漏れの回帰) ---
const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const usedKeys = new Set();
[...gameSrc.matchAll(/\bbuff:'([a-zA-Z]+)'/g)].forEach(m => usedKeys.add(m[1]));
[...gameSrc.matchAll(/\bdebuff:'([a-zA-Z]+)'/g)].forEach(m => usedKeys.add(m[1]));
[...gameSrc.matchAll(/addBuff\([^,]+,\s*'([a-zA-Z]+)'/g)].forEach(m => usedKeys.add(m[1]));
const missing = [...usedKeys].filter(k => !E.BUFF_ICON[k]);
ok('実際に使われているバフ/デバフキーは全てBUFF_ICONにある(抜け漏れなし)', missing.length === 0, missing);
ok('少なくとも20種類以上のバフ/デバフアイコンがある', Object.keys(E.BUFF_ICON).length >= 20, Object.keys(E.BUFF_ICON).length);

// --- ラベルとの対応も欠けていない ---
const noLabel = Object.keys(E.BUFF_ICON).filter(k => !E.BUFF_LABEL[k]);
ok('全アイコンに対応するBUFF_LABELがある', noLabel.length === 0, noLabel);

console.log('done');
