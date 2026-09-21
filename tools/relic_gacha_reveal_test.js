/* regression test: the relic gacha used to jump straight from a single chest-open to
   the full result grid all at once (no suspense). It now goes through the same
   egg-crack/cut-in reveal sequence as the character gacha (showGachaEggs), just reading
   {def, isNew} shaped results instead of grantMonster()'s {mon, isNew, ...}. This checks
   the kind-aware accessors and that doRelicPullAndShow actually drives that shared engine
   with kind:'relic', rather than re-testing the (already-covered) timing/animation itself. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  doRelicPullAndShow, doRelicPull, get gachaSeq(){ return gachaSeq; },
  pullRarity, eggClass, PULL_COST, PULL10_COST, RELICS, currentBanner, exclusiveRelicForMon, pullBannerTitle,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
S.crystals = 100000;

// --- pullRarity/eggClass: relic results read r.def.star, and map to the same
// blue(low)/gold(mid)/rainbow(★5) egg coloring the character gacha uses ---
const relicResult1 = { def: E.RELICS.rel_flame_ember, isNew: true };
ok('pullRarityはrelic結果のdef.starを読む', E.pullRarity('relic', relicResult1) === E.RELICS.rel_flame_ember.star, E.pullRarity('relic', relicResult1));
ok('★1-2はegg-blue', E.eggClass(1) === 'egg-blue' && E.eggClass(2) === 'egg-blue');
ok('★3-4はegg-gold', E.eggClass(3) === 'egg-gold' && E.eggClass(4) === 'egg-gold');
ok('★5はegg-rainbow(おおあたり演出)', E.eggClass(5) === 'egg-rainbow');

// --- doRelicPullAndShow: drives the shared reveal engine with kind:'relic', not the old
// instant chest-grid path ---
S.crystals = 100000;
E.doRelicPullAndShow(10, E.PULL10_COST);
ok('gachaSeqが遺物けんの結果で開始する', !!E.gachaSeq && E.gachaSeq.kind === 'relic' && E.gachaSeq.results.length === 10, E.gachaSeq && E.gachaSeq.kind);
ok('演出開始時点でコストが引かれている', S.crystals === 100000 - E.PULL10_COST, S.crystals);
ok('演出はsummonフェーズから始まる(卵が飛び出す前)', E.gachaSeq.phase === 'summon', E.gachaSeq.phase);
ok('結果は{def, isNew}の形(mon結果と混同していない)', E.gachaSeq.results.every(r => r.def && typeof r.isNew === 'boolean' && !r.mon), E.gachaSeq.results[0]);

// --- pullBannerTitle: the reveal header shows the banner's exclusive relic name for
// 'relic' pulls, not the pickup character's own name ---
const bannerPickupRelic = E.exclusiveRelicForMon(E.currentBanner().pickup);
if(bannerPickupRelic){
  ok('遺物バナーのタイトルはピックアップ遺物名', E.pullBannerTitle('relic') === bannerPickupRelic.name, E.pullBannerTitle('relic'));
}

// --- insufficient crystals: no pull, no gachaSeq started ---
S.crystals = 0;
const beforeSeq = E.gachaSeq;
E.doRelicPullAndShow(1, E.PULL_COST);
ok('結晶不足だと演出は始まらない', E.gachaSeq === beforeSeq, [!!beforeSeq, !!E.gachaSeq]);

console.log('done');
