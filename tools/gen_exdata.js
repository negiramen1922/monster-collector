/* EXステージの各ウェーブの中身とBPを出す。
   使い方: node gen_exdata.js [waves.json]  (既定: ../docs/design/次回イベントのEXステージ_ウェーブ.json) */
const path = require('path');
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__e={buildUnit,MONSTERS,skillSlotsFor};');
const E = global.__e;
const by = Object.fromEntries(E.MONSTERS.map(m => [m.name, m]));
/* まだゲームに入っていない新★4は、設計資料の素ステータスを使う */
const NEW4 = require(path.join(__dirname, '..', 'docs', 'design', '次回イベントの★4.json'));
for (const c of NEW4.chars) by[c.n] = Object.assign({ rarity: 4, name: c.n, role: c.role }, c.st);
/* ゲーム内の battlePower() と同じ式(gen_eventdata.js と同じ物差し) */
const bpOf = (u, star, sk) => Math.round((u.hp * 0.6 + u.str * 4 + (u.pdef + u.mdef) * 4 + u.spd * 1.5)
  * (1 + (sk - 1) * 0.04 * 3 + (sk - 1) * 0.05 + (E.skillSlotsFor(star) - 1) * 0.10));
const src = process.argv[2] || path.join(__dirname, '..', 'docs', 'design', '次回イベントのEXステージ_ウェーブ.json');
const D = require(src);
const ENEMY_SKILL = { 1: 8, 2: 10, 3: 12 };   // EXの敵スキルLv
const out = {};
for (const key of Object.keys(D.stages || D)) {
  const st = (D.stages || D)[key];
  out[key] = { name: st.name, tiers: [] };
  console.log(`\n### ${st.name} (${key})`);
  for (const t of st.tiers) {
    const sk = ENEMY_SKILL[t.ex];
    const rows = [];
    console.log(` EX${t.ex}  推奨Lv${t.lv}  ボス★${t.bossStar} / 雑魚★${t.mobStar}  敵スキルLv${sk}`);
    t.waves.forEach((w, i) => {
      let bp = 0; const names = [];
      for (const raw of w) {
        const boss = raw.endsWith('*'), nm = raw.replace('*', '');
        const m = by[nm], star = boss ? t.bossStar : t.mobStar;
        const u = E.buildUnit(m, t.lv, true, star, boss, 1, { skillLv: sk, ultLv: sk, passiveLv: sk });
        bp += bpOf(u, star, sk);
        names.push(`${nm}(★${star}${boss ? '/ボス' : ''})`);
      }
      rows.push({ w: i + 1, names, bp: Math.round(bp) });
      console.log(`   W${i + 1} ${String(w.length)}体 BP ${String(Math.round(bp)).padStart(7)}  ${names.join(' ')}`);
    });
    out[key].tiers.push({ ex: t.ex, lv: t.lv, bossStar: t.bossStar, mobStar: t.mobStar, enemySkill: sk, waves: rows,
      bpTotal: rows.reduce((s, r) => s + r.bp, 0) });
  }
}
require('fs').writeFileSync(path.join(__dirname, 'ex_bp.json'), JSON.stringify(out, null, 1));
