/* ガチャ演出(第2弾)の宝箱の色の予告: 本当の結果より上の色にならない・最後は必ず本当の色・昇格の起こる割合 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, MONSTERS, summonSteps, summonTarget, pullOneForced, currentBanner, MON_BY_ID, SUMMON_COLORS };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = E.DEFAULT_STATE();
const mon = r => E.MONSTERS.find(m => m.rarity === r && m.id !== E.currentBanner().pickup);
const pull = r => E.pullOneForced(mon(r));
const set = top => [pull(top), ...Array.from({ length: 9 }, () => pull(2))];
const run = (rs, n) => Array.from({ length: n }, () => E.summonSteps('mon', rs));
const cases = [[3, 'blue'], [4, 'purple'], [5, 'gold']];
cases.forEach(([top, col]) => {
  const all = run(set(top), 2000);
  const idx = E.SUMMON_COLORS.indexOf(col);
  ok(`最高★${top}: 最後の色は必ず${col}、途中で上の色は出ない`, all.every(st => st[st.length - 1] === col && st.every(c => E.SUMMON_COLORS.indexOf(c) <= idx)));
  if(top >= 4){
    const up = all.filter(st => st.length > 1).length / all.length;
    ok(`最高★${top}: 昇格が起こる割合`, Math.abs(up - (top === 4 ? 0.3 : 0.45)) < 0.05, up.toFixed(3));
  }
});
const pu = E.MON_BY_ID[E.currentBanner().pickup];
const rsPu = [E.pullOneForced(pu), ...Array.from({ length: 9 }, () => pull(2))];
ok('ピックアップ★5なら最後は虹', run(rsPu, 300).every(st => st[st.length - 1] === 'rainbow') && E.summonTarget('mon', rsPu) === 3);
const blueStart = run(set(5), 3000).filter(st => st[0] === 'blue').length / 3000;
ok('★5なのに青から始まる(2段昇格)こともある', blueStart > 0.1 && blueStart < 0.22, blueStart.toFixed(3));
console.log(fails ? `${fails}件失敗` : 'すべて通過');
