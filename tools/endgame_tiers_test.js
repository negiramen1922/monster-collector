/* regression test: 超上級/極上級/伝説級/神話級 (q4-q7) and the redesigned HARD_STAR_MAP.
   Design rule (per conversation): normal-mode trash enemies never exceed ★4, normal-mode
   bosses never exceed ★5 - ★6/★7 only ever appear in hard mode. Also locks in the
   sequential unlock chain (q3 -> q4 -> q5 -> q6 -> q7, each tier's hard mode gated on its
   own normal-mode clear) so a future edit can't silently break the progression. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STAGES, QUEST_TIERS, HARD_STAR_MAP, MON_BY_ID,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

const NEW_TIERS = ['q4', 'q5', 'q6', 'q7'];
const NEW_HARD_TIERS = ['q4h', 'q5h', 'q6h', 'q7h'];

// --- all 4 new tiers + their hard counterparts exist, 10 stages each ---
NEW_TIERS.concat(NEW_HARD_TIERS).forEach(key => {
  const stages = E.STAGES.filter(s => s.tier === key);
  ok(`${key}は10ステージある`, stages.length === 10, stages.length);
});

// --- normal mode: trash never exceeds ★4, bosses never exceed ★5 (across ALL tiers, not
// just the new ones - this is a global rule) ---
const normalTierKeys = E.QUEST_TIERS.filter(t => !t.hard && t.key !== 'tu').map(t => t.key);
let trashOverCap = [], bossOverCap = [];
normalTierKeys.forEach(key => {
  E.STAGES.filter(s => s.tier === key).forEach(st => {
    st.waves.forEach(wave => wave.forEach(e => {
      if(e.boss){ if(e.star > 5) bossOverCap.push(`${st.id}:${e.ref}(★${e.star})`); }
      else{ if(e.star > 4) trashOverCap.push(`${st.id}:${e.ref}(★${e.star})`); }
    }));
  });
});
ok('通常モードの雑魚は★4を超えない(全ティア)', trashOverCap.length === 0, trashOverCap);
ok('通常モードのボスは★5を超えない(全ティア)', bossOverCap.length === 0, bossOverCap);

// --- hard mode of the 4 new tiers (q4h-q7h): every enemy is ★5 or higher, since their
// source tiers' trash (★2-4) all map to ★5/★6 under the new HARD_STAR_MAP. (q1h is exempt:
// HARD_STAR_MAP[1] was deliberately left at 4, unchanged from before this redesign.) ---
let hardUnderCap = [];
NEW_HARD_TIERS.forEach(key => {
  E.STAGES.filter(s => s.tier === key).forEach(st => {
    st.waves.forEach(wave => wave.forEach(e => { if(e.star < 5) hardUnderCap.push(`${st.id}:${e.ref}(★${e.star})`); }));
  });
});
ok('超上級〜神話級のハードモードは敵が必ず★5以上', hardUnderCap.length === 0, hardUnderCap);

// --- ★6/★7 only ever appears in hard mode, never in normal mode ---
let star6PlusInNormal = [];
normalTierKeys.forEach(key => {
  E.STAGES.filter(s => s.tier === key).forEach(st => {
    st.waves.forEach(wave => wave.forEach(e => { if(e.star >= 6) star6PlusInNormal.push(`${st.id}:${e.ref}(★${e.star})`); }));
  });
});
ok('★6以上は通常モードに一切出ない', star6PlusInNormal.length === 0, star6PlusInNormal);

// --- HARD_STAR_MAP matches the agreed conversion table ---
ok('HARD_STAR_MAP: ★2,★3は★5に変換される', E.HARD_STAR_MAP[2] === 5 && E.HARD_STAR_MAP[3] === 5, E.HARD_STAR_MAP);
ok('HARD_STAR_MAP: ★4,★5は★6に変換される', E.HARD_STAR_MAP[4] === 6 && E.HARD_STAR_MAP[5] === 6, E.HARD_STAR_MAP);

// --- sequential unlock chain: q3 -> q4 -> q5 -> q6 -> q7, each hard tier gated on its own
// normal tier's last stage (not the previous hard tier, not the next normal tier) ---
ok('超上級の1面はq3_10クリアが条件', E.STAGES.find(s => s.id === 'q4_01').requires === 'q3_10');
ok('極上級の1面はq4_10クリアが条件', E.STAGES.find(s => s.id === 'q5_01').requires === 'q4_10');
ok('伝説級の1面はq5_10クリアが条件', E.STAGES.find(s => s.id === 'q6_01').requires === 'q5_10');
ok('神話級の1面はq6_10クリアが条件', E.STAGES.find(s => s.id === 'q7_01').requires === 'q6_10');
['q4', 'q5', 'q6', 'q7'].forEach(key => {
  const hardFirst = E.STAGES.find(s => s.id === `${key}_01h`);
  ok(`${key}ハードの1面は${key}_10(自分自身の通常クリア)が条件`, hardFirst.requires === `${key}_10`, hardFirst.requires);
});

// --- recommended level bands land where agreed ---
const lvOf = key => E.QUEST_TIERS.find(t => t.key === key).lv;
ok('超上級はLv100-146', JSON.stringify(lvOf('q4')) === JSON.stringify([100, 146]));
ok('極上級はLv150-200(★5上限150から★7上限200まで)', JSON.stringify(lvOf('q5')) === JSON.stringify([150, 200]));
ok('伝説級はLv210-250(★8上限230が真ん中)', JSON.stringify(lvOf('q6')) === JSON.stringify([210, 250]));
ok('神話級はLv260-300(★9上限260から★10上限300まで)', JSON.stringify(lvOf('q7')) === JSON.stringify([260, 300]));
ok('上位3ティアの境目は10レベルずつ空いている',
  lvOf('q6')[0] - lvOf('q5')[1] === 10 && lvOf('q7')[0] - lvOf('q6')[1] === 10,
  [lvOf('q5')[1], lvOf('q6')[0], lvOf('q6')[1], lvOf('q7')[0]]);

// --- every enemy/boss ref used in the 4 new tiers is a real monster ---
let badRefs = [];
NEW_TIERS.forEach(key => {
  E.STAGES.filter(s => s.tier === key).forEach(st => {
    st.waves.forEach(wave => wave.forEach(e => { if(!E.MON_BY_ID[e.ref]) badRefs.push(`${st.id}:${e.ref}`); }));
  });
});
ok('新4ティアの敵はすべて実在するモンスターID', badRefs.length === 0, badRefs);

console.log('done');
