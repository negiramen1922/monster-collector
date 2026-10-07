/* 公開日まで隠す仕組み(releaseAt / isReleased / releasedMonsters)のテスト。
   Date.now を差し替えて、公開時刻の前とあとで、プレイヤーに見える一覧に新キャラ・新遺物が出るかを確かめる。
   releaseAt を書いたモンスター・遺物が index.html にあればそれを使い、なければ既存の数体に仮の releaseAt を付けて試す。 */
const load = require('./harness.js');
const persistent = {};
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MONSTERS, MON_BY_ID, RELICS,
  isReleased, releasedMonsters, releasedRelicIds, pickMonsterOfRarity, doBeginnerGacha, relicsOfStar, relicFilterPool,
  renderBag, renderDex, renderSelectPickupPanel, renderSelectPickerSheet, abyssStage, pullRelicOne, AVG_BASE_HP,
  setBagTicket(v){ bagTicket = v; }, setSelectPicker(v){ selectPicker = v; },
  setFilterTarget(v){ filterTarget = v; }, filterPool,
  setPullOne(f){ pullOne = f; }, setPullOneForced(f){ pullOneForced = f; },
  get pullOne(){ return pullOne; }, get pullOneForced(){ return pullOneForced; },
};`);
const E = global.__e;
let fails = 0;
const ok = (name, cond, info) => { if(!cond) fails++; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

// 試験場の判定(?lab=)はテストでは location が無いので false のはず
ok('location が無いときは試験場扱いにならない', E.isReleased({ releaseAt: '2999-01-01T00:00:00+09:00' }) === false);
ok('releaseAt が無いものはいつでも公開', E.isReleased({}) && E.isReleased(null));

// --- 対象を決める ---
let NEW = E.MONSTERS.filter(m => m.releaseAt);
let synthetic = false;
if(NEW.length === 0){
  synthetic = true;
  const pickLast = r => E.MONSTERS.filter(m => m.rarity === r && m.element !== 'none').slice(-1)[0];
  NEW = [pickLast(5), pickLast(4), pickLast(3)];
  NEW.forEach(m => { m.releaseAt = '2030-01-01T15:00:00+09:00'; });
}
let NEW_RELICS = Object.values(E.RELICS).filter(r => r.releaseAt);
if(NEW_RELICS.length === 0){
  const r5 = Object.values(E.RELICS).filter(r => r.star === 5 && r.channel !== 'distributed').slice(-1)[0];
  r5.releaseAt = '2030-01-01T15:00:00+09:00';
  NEW_RELICS = [r5];
}
console.log(`対象: ${synthetic ? '(仮) ' : ''}${NEW.map(m => m.id + m.name).join(' ')} / 遺物 ${NEW_RELICS.map(r => r.id).join(' ')}`);
const times = NEW.concat(NEW_RELICS).map(x => new Date(x.releaseAt).getTime());
const BEFORE = Math.min(...times) - 3600e3;
const AFTER = Math.max(...times) + 3600e3;
const NEW_IDS = new Set(NEW.map(m => m.id));
const realNow = Date.now;
const OLD_ID = E.MONSTERS.find(m => !m.releaseAt && m.rarity === 5).id;
const hasNew = arr => arr.some(id => NEW_IDS.has(id));
const idsInHtml = html => [...html.matchAll(/="(m\d+)"/g)].map(x => x[1]);

// AVG_BASE_HP は全部のモンスターで計算したまま(公開時刻をまたいで値が変わらない)
const avgKeysBefore = JSON.stringify(E.AVG_BASE_HP);

function survey(label){
  const r = {};
  // ガチャ(常設バナー): そのレアリティ全体
  E.STATE = E.DEFAULT_STATE();
  const pulled = new Set();
  for(const rar of [3, 4, 5]) for(let i = 0; i < 1500; i++) pulled.add(E.pickMonsterOfRarity(rar).id);
  r.gacha = [...pulled];
  // ビギナーガチャの★5確定枠
  const realPull = E.pullOne, realForced = E.pullOneForced;
  const forced = new Set();
  const notFive = E.MONSTERS.find(m => m.rarity === 3);
  E.setPullOne(() => ({ mon: notFive, isNew: false }));
  E.setPullOneForced(mon => { forced.add(mon.id); return { mon, isNew: true }; });
  for(let i = 0; i < 400; i++){
    E.STATE = E.DEFAULT_STATE(); E.STATE.crystals = 1e9;
    E.STATE.beginnerGachaCount = 2;
    try { E.doBeginnerGacha(); } catch(e){ /* 画面まわりの例外は無視(引いた結果だけ見る) */ }
  }
  E.setPullOne(realPull); E.setPullOneForced(realForced);
  r.beginner = [...forced];
  // セレクトピックアップ(属性ごとの選択シート)
  r.select = [];
  const layer = { innerHTML: '', querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }, style:{} };
  const realGet = document.getElementById;
  document.getElementById = id => id === 'modal-layer' ? layer : realGet(id);
  // 選択チケット
  E.STATE = E.DEFAULT_STATE();
  r.ticket = [];
  for(const star of [3, 4, 5]){
    E.setBagTicket({ key: `mon_sel_${star}`, elem: '' });
    layer.innerHTML = '';
    try { const h = E.renderBag(); r.ticket.push(...idsInHtml(typeof h === 'string' ? h : layer.innerHTML)); } catch(e){ r.ticketErr = String(e); }
  }
  E.setBagTicket(null);
  for(const elem of ['fire', 'water', 'wind', 'earth', 'thunder', 'grass', 'light', 'dark']){
    E.setSelectPicker({ elem });
    try { E.renderSelectPickerSheet(); r.select.push(...idsInHtml(layer.innerHTML)); } catch(e){ r.selectErr = String(e); }
  }
  document.getElementById = realGet;
  E.setSelectPicker(null);
  // 図鑑
  E.STATE = E.DEFAULT_STATE();
  E.setFilterTarget('dex');
  r.dexPool = E.filterPool().map(m => m.id);
  const dexHtml = E.renderDex();
  r.dexHtml = idsInHtml(dexHtml);
  const m = /(\d+) \/ (\d+) 体/.exec(dexHtml);
  r.dexDenom = m ? Number(m[2]) : null;
  r.released = E.releasedMonsters().length;
  // 深淵回廊の敵
  const abyss = new Set();
  for(let season = 0; season < 30; season++) for(let floor = 1; floor <= 100; floor++){
    E.abyssStage(floor, season).waves.flat().forEach(e => abyss.add(e.ref));
  }
  r.abyss = [...abyss];
  // 遺物ガチャ・遺物図鑑
  r.relicGacha = [];
  for(const s of [1, 2, 3, 4, 5]) r.relicGacha.push(...E.relicsOfStar(s).map(x => x.id));
  E.STATE = E.DEFAULT_STATE();
  r.relicDex = E.relicFilterPool();
  r.relicDenom = E.releasedRelicIds().length;
  return r;
}

Date.now = () => BEFORE;
const pre = survey('pre');
Date.now = () => AFTER;
const post = survey('post');
Date.now = realNow;

if(pre.ticketErr || pre.selectErr) console.log('render error', pre.ticketErr, pre.selectErr);

ok('公開前: ガチャ(★3〜★5を各1500回)に新キャラが出ない', !hasNew(pre.gacha));
ok('公開後: ガチャに新キャラが出る', NEW.every(m => post.gacha.includes(m.id)), NEW.filter(m => !post.gacha.includes(m.id)).map(m => m.id));
ok('公開前: ビギナーガチャの★5確定枠に新キャラが出ない', pre.beginner.length > 0 && !hasNew(pre.beginner), pre.beginner.length);
const new5 = NEW.filter(m => m.rarity === 5);
ok('公開後: ビギナーガチャの★5確定枠に新★5が出る', new5.every(m => post.beginner.includes(m.id)));
ok('公開前: 選択チケットに新キャラが出ない', pre.ticket.length > 0 && !hasNew(pre.ticket), pre.ticket.length);
ok('公開後: 選択チケットに新キャラが出る', NEW.every(m => post.ticket.includes(m.id)));
ok('公開前: セレクトピックアップに新キャラ(★4/★5)が出ない', pre.select.length > 0 && !hasNew(pre.select), pre.select.length);
ok('公開後: セレクトピックアップに新★4/★5が出る', NEW.filter(m => m.rarity >= 4).every(m => post.select.includes(m.id)));
ok('公開前: 図鑑に新キャラが出ない', !hasNew(pre.dexPool) && !hasNew(pre.dexHtml));
ok('公開後: 図鑑に新キャラが出る', NEW.every(m => post.dexPool.includes(m.id)));
ok('図鑑の分母: 公開前は今の数', pre.dexDenom === E.MONSTERS.length - NEW.length, { pre: pre.dexDenom, all: E.MONSTERS.length });
ok(`図鑑の分母: 公開後は${NEW.length}体ぶん増える`, post.dexDenom === pre.dexDenom + NEW.length, { post: post.dexDenom });
ok('公開前: 深淵回廊の敵に新キャラが出ない', !hasNew(pre.abyss));
ok('公開後: 深淵回廊の敵に新キャラ(★3以上・無属性以外)が出る', NEW.filter(m => m.rarity >= 3 && m.element !== 'none').some(m => post.abyss.includes(m.id)));
const NEW_R = new Set(NEW_RELICS.map(r => r.id));
const gachaRelics = NEW_RELICS.filter(r => r.channel !== 'distributed');
ok('公開前: 遺物ガチャに新遺物が出ない', !pre.relicGacha.some(id => NEW_R.has(id)));
ok('公開後: 遺物ガチャに(ガチャ用の)新遺物が出る', gachaRelics.every(r => post.relicGacha.includes(r.id)));
ok('公開前: 遺物図鑑に新遺物が出ない', !pre.relicDex.some(id => NEW_R.has(id)));
ok('公開後: 遺物図鑑に新遺物が出る', NEW_RELICS.every(r => post.relicDex.includes(r.id)));
ok('遺物図鑑の分母が新遺物ぶん増える', post.relicDenom === pre.relicDenom + NEW_RELICS.length, [pre.relicDenom, post.relicDenom]);
ok('releaseAt の無い既存キャラは公開前もガチャ・図鑑に出る', pre.gacha.includes(OLD_ID) && pre.dexPool.includes(OLD_ID));
ok('公開前に新遺物を(配布などで)持っていれば、遺物図鑑には出る', (() => {
  Date.now = () => BEFORE; E.STATE = E.DEFAULT_STATE(); E.STATE.relics = { [NEW_RELICS[0].id]: { level: 1 } };
  const r = E.relicFilterPool().includes(NEW_RELICS[0].id); Date.now = realNow; return r;
})());
ok('ID から引く表(MON_BY_ID)は全部のまま', NEW.every(m => E.MON_BY_ID[m.id] === m));
ok('AVG_BASE_HP は公開時刻をまたいでも変わらない', JSON.stringify(E.AVG_BASE_HP) === avgKeysBefore);

console.log(fails ? `FAIL ${fails}` : 'all ok');
process.exitCode = fails ? 1 : 0;
