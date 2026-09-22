/* regression test: the relic gacha's pickup panel used to link "性能を見る" to the
   FEATURED CHARACTER's monster detail (data-preview-mon), which was confusing - tapping it
   while checking the pickup RELIC showed the character's stats instead of the relic's own
   effects. It must link to the relic itself (showRelicDetail via data-preview-relic),
   independent of whether the tied-to character happens to be owned. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  renderRelicGacha, currentBanner, exclusiveRelicForMon, MON_BY_ID,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
const banner = E.currentBanner();
const rel = E.exclusiveRelicForMon(banner.pickup);

if(!rel){
  console.log('(このバナーにはピックアップ専用遺物が無いためスキップ)');
  console.log('done');
}else{
  // --- キャラ未所持の状態 ---
  let html = E.renderRelicGacha();
  ok('ピックアップ遺物のプレビューボタンが遺物IDにリンクする', html.includes(`data-preview-relic="${rel.id}"`), rel.id);
  ok('キャラの詳細/プレビューにリンクするボタンは無い(data-preview-mon不使用)', !html.includes('data-preview-mon='));

  // --- キャラだけ所持している状態でも、遺物プレビューへのリンクは変わらない(ユーザー報告の再現) ---
  S.owned[banner.pickup] = { star: E.MON_BY_ID[banner.pickup].rarity, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
  html = E.renderRelicGacha();
  ok('キャラを所持していても遺物プレビューへのリンクのまま(キャラ詳細に化けない)', html.includes(`data-preview-relic="${rel.id}"`) && !html.includes('data-preview-mon='), rel.id);

  console.log('done');
}
