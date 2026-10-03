// 奥義を撃っているあいだは、撃った本人にSPが入らない(撃破・パッシブ・被弾・回復のSP)。
// 例: アバドンの全体奥義で3体倒しても、パッシブ「敵を倒すとSP+20」や撃破SPで、撃ったそばから溜まらない。
// 奥義そのものの効果(アバドン★10の「SPの半分が戻る」など)は入る
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__t={takeTurn,advanceWave,get battleUI(){return battleUI},gainSp,get lab(){return lab},labLoad,labFill,labStart,MONSTERS};');
const T = global.__t;
let bad = 0; const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = api.DEFAULT_STATE(); api.STATE.autoUlt = true;
T.MONSTERS.forEach(m => { api.STATE.owned[m.id] = { star: m.rarity, souls: 0, level: 200, skillLv: 1, ultLv: 1, passiveLv: 1 }; });
T.labLoad();
function ultOnce(star){
  T.lab.tower = 'ten'; T.lab.floor = 1;
  const slots = T.labFill('アバドン', 1); slots[0].star = star;
  T.lab.parties = [slots, T.lab.parties[1]];
  api.resetQueue(); T.labStart(0, true);
  const b = T.battleUI, u = b.party[0];
  b.transitioning = false;
  b.enemies.forEach(e => { e.hp = 1; });   // 全員1発で倒れる
  u.sp = u.spCost;
  const before = b.enemies.filter(e => e.alive).length;
  T.takeTurn(u);
  return { killed: before - b.enemies.filter(e => e.alive).length, sp: u.sp, cost: u.spCost, lock: !!u.ultLock };
}
const r = ultOnce(5);
ok('アバドン(★5)が全体奥義で3体倒しても、SPは0のまま(撃破・パッシブのSPが入らない)', r.killed >= 3 && r.sp === 0 && !r.lock, r);
const r10 = ultOnce(10);
ok('アバドン★10の「奥義で倒したらSPの半分が戻る」は奥義の効果なので入る', r10.killed >= 3 && r10.sp === Math.round(r10.cost * 0.5), r10);
// 奥義以外(通常攻撃・スキル)の撃破SPはこれまでどおり入る
T.lab.parties = [T.labFill('アバドン', 1), T.lab.parties[1]];
api.resetQueue(); T.labStart(0, true);
const b = T.battleUI, u = b.party[0];
b.transitioning = false; b.enemies.forEach(e => { e.hp = 1; }); u.sp = 0;
T.takeTurn(u);
ok('奥義以外で倒したときのSPは入る', u.sp > 0, u.sp);
// 奥義でWAVEを終えたとき、次のWAVEのSP(+30)は撃った本人には入らず、ほかの味方には入る
T.lab.parties = [T.labFill('アバドン・シルバーナイト', 1), T.lab.parties[1]];
api.resetQueue(); T.labStart(0, true);
{ const b = T.battleUI, u = b.party.find(x => x.ref === 'm139'), o = b.party.find(x => x.ref !== 'm139');
  b.transitioning = false; b.enemies.forEach(e => { e.hp = 1; }); u.sp = u.spCost; o.sp = 0;
  T.takeTurn(u); T.advanceWave();
  ok('奥義でWAVEを終えても、撃った本人にはウェーブのSPが入らない(ほかの味方には入る)', u.sp === 0 && o.sp > 0, { ult: u.sp, other: o.sp }); }
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
