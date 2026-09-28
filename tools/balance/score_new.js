/* 新キャラ4体の技を、既存と同じ採点(power_lib.js)で測って予算と比べる。
   使い方: cd tools/balance && node score_new.js */
const { score } = require('./power_lib.js');
const BUDGET = { ct2:18, ct3:22, ct4:27, ct5:32, sp80:45, sp90:50, sp100:55, sp110:62, sp120:70 };
const STAR = { 1:0.85, 2:0.9, 3:1.0, 4:1.1, 5:1.2 };

const NEW = [
 ['ハティ', 4, [
  ['スキル1 (CT3)','月追いの遠吠え','ct3', { tgt:'all', pow:0.9, bonusIf:[{}] }],
  ['スキル2 (CT4)','月喰らいの牙','ct4', { tgt:'back', pow:2.0, onHit:[{ debuff:'vuln', v:0.2, turns:2 }] }],
  ['必殺技 (SP100)','月蝕','sp100', { tgt:'all', pow:2.0, onHit:[{ debuff:'spdDown', v:0.15, turns:2 }] }],
 ]],
 ['スコル(サポーター)', 4, [
  ['スキル1 (CT3)','陽を遮る','ct3', { tgt:'all', pow:0.6, onHit:[{ debuff:'spdDown', v:0.1, turns:2 }] }],
  ['スキル2 (CT4)','兄弟の狼煙','ct4', { tgt:'allies', effects:[{ to:'allies', buff:'strUp', v:0.2, turns:3 }] }],
  ['必殺技 (SP100)','太陽を呑む','sp100', { tgt:'all', pow:0.8, onHit:[{ debuff:'spdDown', v:0.15, turns:2 }, { debuff:'pdefDown', v:0.15, turns:2 }, { st:'burn', chance:1, turns:2 }] }],
 ]],
 ['黙示の蝗', 4, [
  ['スキル1 (CT3)','群れの羽音','ct3', { tgt:'allies', effects:[{ to:'allies', buff:'critUp', v:0.2, turns:3 }] }],
  ['スキル2 (CT4)','尾の一撃','ct4', { tgt:'single', pow:2.0, onHit:[{ debuff:'pdefDown', v:0.25, turns:3 }] }],
  ['必殺技 (SP100)','黙示の群れ','sp100', { tgt:'allies', effects:[{ to:'allies', buff:'critUp', v:0.35, turns:4 }, { to:'allies', spGain:20 }] }],
 ]],
 ['硫黄の騎兵', 4, [
  ['スキル1 (CT3)','火と煙と硫黄','ct3', { tgt:'all', pow:0.6, onHit:[{ st:'burn', chance:0.3, turns:3 }] }],
  ['スキル2 (CT4)','蛇の尾','ct4', { tgt:'back', pow:2.5, onHit:[{ st:'poison', chance:0.5, turns:5 }] }],
  ['必殺技 (SP100)','淵より湧く軍勢','sp100', { tgt:'all', pow:2.0, onHit:[{ st:'poison', chance:1, turns:5 }] }],
 ]],
];

console.log('新キャラ4体の採点(★4は予算×1.1)。必殺技は予算の100〜130%が目安。\n');
console.log('キャラ        枠              名前              点数  予算  比率');
NEW.forEach(([name, star, rows]) => {
  rows.forEach(([slot, sname, cost, act], i) => {
    const s = score(act);
    const b = Math.round(BUDGET[cost] * STAR[star] * 10) / 10;
    const pct = Math.round(s.p / b * 100);
    const mark = /必殺/.test(slot)
      ? (pct >= 100 && pct <= 130 ? '' : pct < 100 ? '  ← 予算割れ' : '  ← 出しすぎ')
      : (pct >= 85 && pct <= 115 ? '' : pct < 85 ? '  ← 予算割れ' : '  ← 出しすぎ');
    console.log((i ? '' : name).padEnd(13, '　').slice(0, 13) +
      slot.padEnd(16) + sname.padEnd(16, '　').slice(0, 16) +
      String(s.p).padStart(4) + String(b).padStart(6) + String(pct + '%').padStart(6) + mark);
  });
});
