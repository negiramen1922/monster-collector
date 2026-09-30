/* 魔法ステージ(q5_08 精霊の坩堝)が狙いどおりになっているかの回帰テスト。

   背景: q5 は敵の攻撃が 82% 物理で、魔法防御を配る遺物(石符ラピス・聖冠アイテール・
   機殻アウトマタ・月環ニュンペー・蒼貝アクアリス)がほぼ無意味だった。魔法防御+25%を
   積んでも被ダメージが1%しか減らない、という実測がこのステージを作った理由。

   見るもの:
   1. q5_08 の敵の攻撃がほぼ魔法であること
   2. そのステージでは魔法防御のほうが物理防御より効くこと(物理ステージでは逆)
   3. 難度が前後のステージから浮いていないこと

   使い方: python3 tools/extract.py してから  cd tools && node mag_stage_test.js
           N=200 node mag_stage_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src.replace('battleV2: true,', 'battleV2: (global.__V2 !== false),') + `;global.__e={STAGE_BY_ID,MON_BY_ID,kitOf};
const __o = buildUnit;
buildUnit = function(){
  const u = __o.apply(this, arguments);
  if(global.__tb && !u.isEnemy) applyStatBonus(u, global.__tb);
  return u;
};`);
const E = global.__e;
const N = Number(process.env.N || 200);
const LV = Number(process.env.LV || 165);
const PARTY = ['m24', 'm44', 'm23', 'm52', 'm104'];
const UP = { star: 5, skillLv: 5, ultLv: 5, passiveLv: 5 };
const V = 8;   // 防御は「ポイント加算」= そのまま%カット。+8で被ダメージ8%減
const ok = (name, cond, info) => {
  console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  if(!cond) process.exitCode = 1;
};

/* そのステージに出る敵の攻撃のうち、魔法が占める割合(威力×ヒット数で重みづけ) */
function magShare(stageId){
  const refs = E.STAGE_BY_ID[stageId].waves.flat().map(e => e.ref);
  let mag = 0, tot = 0;
  refs.forEach(r => {
    const k = E.kitOf(E.MON_BY_ID[r]);
    ['normal', 'skill1', 'skill2', 'ult'].forEach(n => {
      const o = k[n]; if(!o || !o.pow) return;
      const w = o.pow * (o.hits || 1);
      tot += w;
      if(o.atk === 'mag') mag += w;
    });
  });
  return tot ? mag / tot : 0;
}

/* 被ダメージは「1ラウンドあたり」で見る。総量で見ると、防御を積んで長く生き残るほど
   総被ダメージが増えてしまい、効いているのに悪化したように出る。 */
function measure(stageId, bonus){
  let win = 0, taken = 0, rounds = 0;
  for(let i = 0; i < N; i++){
    global.__tb = bonus;
    const ui = api.run(PARTY, stageId, LV, UP);
    global.__tb = null;
    if(ui.win) win++;
    taken += (ui.party || []).reduce((a, u) => a + ((u.report && u.report.taken) || 0), 0);
    rounds += ui.round || 1;
  }
  return { wr: win / N, taken: taken / Math.max(1, rounds) };
}

console.log('--- 1. ステージの攻撃属性 ---');
const magic = magShare('q5_08');
ok('q5_08(精霊の坩堝)はほぼ魔法攻撃', magic >= 0.9, Math.round(magic * 100) + '%');
ok('q5_08の名前が入れ替わっている', E.STAGE_BY_ID['q5_08'].name === '精霊の坩堝', E.STAGE_BY_ID['q5_08'].name);
ok('ハード側にも同じ編成が入っている', magShare('q5_08h') >= 0.9, Math.round(magShare('q5_08h') * 100) + '%');
const phys = magShare('q5_04');
ok('比較対象の q5_04(骨の玉座)は物理のまま', phys <= 0.1, Math.round(phys * 100) + '%');

/* 防御の効きは「旧バトルシステム」で測る。
   新バトルシステムはHPが2倍で味方が落ちにくく、防御を積むほど奥のウェーブまで進むので、
   「1ラウンドあたりの被ダメージ」も勝率も、25%ぶんの防御の差より試行ごとのブレのほうが
   大きくなってしまう(実測で符号すら安定しない)。
   ここで見たいのは「このステージの敵編成なら魔防のほうが効くか」という編成の性質で、
   それは新旧で変わらない。新バトルシステム側でも測れるようにするには、
   戦闘をシミュレートせず1発ぶんのダメージを直接計算する作りに書き直す必要がある(やり残し参照)。 */
global.__V2 = false;
console.log('\n--- 2. 魔法防御が効くか(旧バトルシステムで測定・各' + N + '戦・Lv' + LV + ') ---');
[['q5_08', '精霊の坩堝(魔法)', true], ['q5_04', '骨の玉座(物理)', false]].forEach(([id, ja, wantMdef]) => {
  const base = measure(id, null);
  const p = measure(id, { pdef: V });
  const m = measure(id, { mdef: V });
  const cutP = (1 - p.taken / base.taken) * 100;
  const cutM = (1 - m.taken / base.taken) * 100;
  console.log(`   ${ja}  基準 1ラウンドあたり${Math.round(base.taken)}  物防+8→${cutP >= 0 ? '-' : '+'}${Math.abs(cutP).toFixed(1)}%  魔防+8→${cutM >= 0 ? '-' : '+'}${Math.abs(cutM).toFixed(1)}%`);
  if(wantMdef){
    /* 削減率の絶対値は試行ごとに 3〜16% とブレるので、同じ条件で測った物防との差で見る。
       見たいのは「このステージでは魔防のほうが価値がある」という関係であって、絶対値ではない。 */
    ok('  魔法ステージでは魔法防御のほうが効く', cutM > cutP, [cutM.toFixed(1), cutP.toFixed(1)]);
    ok('  魔法防御が物理防御より3ポイント以上効く', cutM - cutP >= 3, (cutM - cutP).toFixed(1) + 'pt');
  }else{
    ok('  物理ステージでは物理防御のほうが効く', cutP > cutM, [cutP.toFixed(1), cutM.toFixed(1)]);
  }
});

/* 見たいのは「難度が浮いていないか」なので、勝率で判定する。
   1ラウンドあたりの被ダメージは参考値として出すだけにした。
   新バトルシステムでは、敵が開幕からワザを撃つぶんキャスター編成のこのステージだけ
   被ダメージが倍近くになる(約540 → 約1000)。それでも勝率は近隣と並んでいるので、
   被ダメの絶対値で見ると「壊れている」と誤検知する。 */
global.__V2 = true;   // 難度は今の(新)システムで見る
console.log('\n--- 3. 難度が前後から浮いていないか(新バトルシステム) ---');
const around = ['q5_06', 'q5_08', 'q5_09'].map(id => ({ id, r: measure(id, null) }));
around.forEach(x => console.log(`   ${x.id}  勝率${Math.round(x.r.wr * 100)}%  1ラウンドあたり被ダメ${Math.round(x.r.taken)}`));
const me = around.find(x => x.id === 'q5_08').r;
const others = around.filter(x => x.id !== 'q5_08').map(x => x.r.wr);
ok('勝率が近隣ステージの一番低いものから25ポイント以上は落ちない',
  me.wr >= Math.min(...others) - 0.25,
  [Math.round(me.wr * 100) + '%', others.map(w => Math.round(w * 100) + '%')]);

console.log('\ndone');
