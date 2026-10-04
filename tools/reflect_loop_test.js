// シールドが割れたときの反射(カーバンクルの宝石)が、反射のダメージでまた反射して止まらなくならないこと。
// 味方と敵の両方にカーバンクルがいるバベル天の塔10階・後半で、何度戦ってもスタックがあふれない
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__h={get hitHp(){return hitHp}};global.__b={get lab(){return lab},labLoad,labFill,labStart,get battleUI(){return battleUI},MONSTERS};');
const B = global.__b;
let bad = 0; const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = api.DEFAULT_STATE(); api.STATE.autoUlt = true;
B.MONSTERS.forEach(m => { api.STATE.owned[m.id] = { star: m.rarity, souls: 0, level: 200, skillLv: 1, ultLv: 1, passiveLv: 1 }; });
B.labLoad();
B.lab.tower = 'ten'; B.lab.floor = 10;
B.lab.parties = [B.labFill('ブルーウィスプ・セイレーン・シルバーナイト・アグニ・バンシー', 2), B.labFill('カーバンクル・ノーム・ブロック・オーガ・ユニコーン', 2)];
let err = null, done = 0;
for(let k = 0; k < 15 && !err; k++){
  try{ api.resetQueue(); B.labStart(1, true); api.drainQueue(); done++; }catch(e){ err = String(e).slice(0, 120); }
}
ok('味方と敵のカーバンクルのシールドが割れあっても、戦闘が最後まで進む(15戦)', !err && done === 15, err || done);
// 直接: 両方に「反射つきのシールド」を持たせて殴る(割れたシールドが列に残っているあいだに反射が往復していた)
B.lab.floor = 1; B.lab.parties = [B.labFill('カーバンクル・シルバーナイト', 0), B.lab.parties[1]];
api.resetQueue(); B.labStart(0, true);
const g = global.__h, b = B.battleUI, a = b.party.find(u => u.passive && u.passive.reflectOnBreak), e = b.enemies[0];
e.passive = { ...e.passive, reflectOnBreak: a.passive.reflectOnBreak };
a.shields = [{ amt: 1, caster: a }]; e.shields = [{ amt: 30, caster: e }];
let err2 = null;
try{ g.hitHp(e, 100, a, {}); }catch(x){ err2 = String(x).slice(0, 80); }
ok('反射つきのシールドどうしでも、反射は往復しない', !err2, err2);
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
