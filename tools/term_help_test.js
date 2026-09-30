/* 説明文の中の用語(やけど・延焼・シールドなど)を押せるようにしたぶんの検証。
   - 用語が <b class="term"> に包まれる / HTMLは必ず逃がす
   - 同じ用語は1つの説明文につき1回だけ光る(全部光ると読みにくい)
   - 長い言葉が短い言葉に食われない
   - 説明文の数字は定数から作る(BURN_TURNS などを変えたら説明も追従する)

   使い方: python3 tools/extract.py してから  cd tools && node term_help_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  GAME_TERMS, TERM_BY_NAME, markTerms, MONSTERS, kitOf, RELICS, STATUS_LABEL, BUFF_LABEL,
  BURN_TURNS, BURN_STR_RATIO, SPREAD_RATIO, SPREAD_MAX_PER_TURN, POISON_TURNS, CUT_CAP, RATIO_CAP,
  BASE_CRIT_RATE, BASE_CRIT_MULT, NEW_STATUS_TURNS, shieldCapRatio,
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
api.STATE = E.DEFAULT_STATE();

/* ---- 1. 用語集 ---- */
console.log('--- 1. 用語集 ---');
ok('用語がひととおりある', E.GAME_TERMS.length >= 20, E.GAME_TERMS.length);
ok('キーが重複していない', new Set(E.GAME_TERMS.map(t => t.key)).size === E.GAME_TERMS.length);
ok('どの用語にも説明がある', E.GAME_TERMS.every(t => typeof t.text === 'function' && t.text().length > 5),
   E.GAME_TERMS.filter(t => typeof t.text !== 'function').map(t => t.key));
// 状態異常はぜんぶ載っていること(新しいのを足したときに載せ忘れないように)
const missing = Object.entries(E.STATUS_LABEL).filter(([k]) => !E.GAME_TERMS.some(t => t.key === k));
ok('STATUS_LABEL の状態異常はぜんぶ用語集にある', missing.length === 0, missing.map(x => x[1]));

/* ---- 2. 説明文の数字は定数から作る ---- */
console.log('\n--- 2. 数字は定数から作っている ---');
const textOf = k => E.GAME_TERMS.find(t => t.key === k).text();
ok(`やけど: STRの${Math.round(E.BURN_STR_RATIO * 100)}%・${E.BURN_TURNS}ターン`,
   textOf('burn').includes(String(Math.round(E.BURN_STR_RATIO * 100))) && textOf('burn').includes(String(E.BURN_TURNS)), textOf('burn'));
ok(`延焼: ${Math.round(E.SPREAD_RATIO * 100)}%・1ターン${E.SPREAD_MAX_PER_TURN}回まで`,
   textOf('spread').includes(String(Math.round(E.SPREAD_RATIO * 100))) && textOf('spread').includes(String(E.SPREAD_MAX_PER_TURN)), textOf('spread'));
ok(`毒: ${E.POISON_TURNS}ターン`, textOf('poison').includes(String(E.POISON_TURNS)));
ok(`シールド: 最大HPの${Math.round(E.shieldCapRatio() * 100)}%まで`, textOf('shield').includes(String(Math.round(E.shieldCapRatio() * 100))), textOf('shield'));
ok(`会心: ${Math.round(E.BASE_CRIT_RATE * 100)}% / ${E.BASE_CRIT_MULT}倍`,
   textOf('crit').includes(String(Math.round(E.BASE_CRIT_RATE * 100))) && textOf('crit').includes(String(E.BASE_CRIT_MULT)));
ok(`防御貫通: ${Math.round(E.RATIO_CAP * 100)}%まで`, textOf('pierce').includes(String(Math.round(E.RATIO_CAP * 100))));

/* ---- 3. markTerms ---- */
console.log('\n--- 3. 用語を包む ---');
const wrap = (s, key) => new RegExp(`<b class="term" data-term="${key}"[^>]*>`).test(s);
ok('やけどが包まれる', wrap(E.markTerms('50%でやけど'), 'burn'), E.markTerms('50%でやけど'));
ok('毒とやけどが両方包まれる', (() => { const s = E.markTerms('敵 やけど・毒にかからない'); return wrap(s, 'burn') && wrap(s, 'poison'); })());
ok('同じ用語は1つの説明文で1回だけ',
   (E.markTerms('やけど状態の敵を攻撃すると、そのやけどの残りターン+1').match(/data-term="burn"/g) || []).length === 1);
ok('用語が無ければ何も包まない', !/class="term"/.test(E.markTerms('威力190%(魔法)')), E.markTerms('威力190%(魔法)'));
ok('空でも落ちない', E.markTerms('') === '' && E.markTerms(null) === '' && E.markTerms(undefined) === '');
// 長い言葉が短い言葉に食われない
ok('「被ダメージ軽減」が「被ダメージアップ」と混ざらない', (() => {
  const s = E.markTerms('被ダメージ軽減と被ダメージアップ');
  return wrap(s, 'cut') && wrap(s, 'vuln');
})(), E.markTerms('被ダメージ軽減と被ダメージアップ'));

/* ---- 4. HTMLを逃がす ---- */
console.log('\n--- 4. HTMLを必ず逃がす ---');
const bad = E.markTerms('<script>alert(1)</script>やけど');
ok('タグは文字として出る', bad.includes('&lt;script&gt;') && !bad.includes('<script>'), bad.slice(0, 40));
ok('用語の包みだけがタグになる', (bad.match(/<b class="term"/g) || []).length === 1);
ok('引用符も逃がす', E.markTerms('a"b\'c').includes('&quot;'), E.markTerms('a"b\'c'));

/* ---- 5. 実際の説明文に効いているか ---- */
console.log('\n--- 5. 実際のキットで ---');
{
  let total = 0, marked = 0;
  const sample = [];
  E.MONSTERS.forEach(m => {
    const k = E.kitOf(m);
    ['normal', 'skill1', 'skill2', 'ult', 'passive'].forEach(n => {
      const a = k[n];
      if(!a || !a.desc) return;
      total++;
      const s = E.markTerms(a.desc);
      if(/class="term"/.test(s)){ marked++; if(sample.length < 3) sample.push(m.name + ': ' + s.replace(/<[^>]*>/g, '|')); }
    });
  });
  console.log('   説明文 ' + total + '件 のうち ' + marked + '件 に用語がある');
  sample.forEach(x => console.log('   ' + x));
  ok('半分近くの説明文で用語が光る', marked / total >= 0.3, +(marked / total).toFixed(2));
  // 用語集に載っているのに1度も説明文に出てこないものは、載せる意味が薄い(気づくために出す)
  const unused = E.GAME_TERMS.filter(t => !E.MONSTERS.some(m => {
    const k = E.kitOf(m);
    return ['normal', 'skill1', 'skill2', 'ult', 'passive'].some(n => k[n] && k[n].desc && /class="term"/.test(E.markTerms(k[n].desc)) && E.markTerms(k[n].desc).includes(`data-term="${t.key}"`));
  }));
  console.log('   キットの説明文に出てこない用語: ' + (unused.length ? unused.map(t => t.name).join('・') : 'なし'));
}

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
