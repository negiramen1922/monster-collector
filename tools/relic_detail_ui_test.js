/* regression test: 遺物の詳細画面をキャラの詳細画面と同じ構成(見た目・名前→レベル上げ→
   基礎ステータス→スキル→覚醒→装着してるキャラ)に並び替え、スキルのレベルアップは
   キャラと同じく確認モーダル(消費素材・入手方法つき)を挟んでから確定するように変更した。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, RELICS, MON_BY_ID,
  grantRelic, equipRelic, openRelicUpgrade,
  openRelicSkillUpModal, renderRelicSkillUpModal,
  get relicSkillUpShort(){ return relicSkillUpShort }, set relicSkillUpShort(v){ relicSkillUpShort = v },
  upgradeRelicSkill, relicSkillCost, relicMatSourceHint, relicMatHasBase, relicMatShopTab,
  getItem, addItem, addGold,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// document.getElementById('modal-layer') is looked up fresh on every call (not captured in a
// closure), so we can swap it for a tracking stub anytime after load() (same trick as
// monster_preview_test.js).
let modalHtml = '';
const modalStub = { innerHTML: '', classList: { add(){ modalHtml = modalStub.innerHTML; }, remove(){} }, querySelector: () => null };
const realGetById = global.document.getElementById;
global.document.getElementById = id => id === 'modal-layer' ? modalStub : realGetById(id);

api.STATE = E.DEFAULT_STATE();
const relicId = 'rel_flame_ember';
E.grantRelic(E.RELICS[relicId]);
E.equipRelic(relicId, 'm06');

// --- 1. 詳細画面の並び順: 見た目/名前(head) → レベル → 基礎ステータス → スキル → 覚醒 → 装着してるキャラ ---
modalHtml = '';
E.openRelicUpgrade(relicId, null);
const idxHead = modalHtml.indexOf('relic-detail-head');
const idxLevel = modalHtml.indexOf('レベル</div>');
const idxBase = modalHtml.indexOf('基礎ステータス');
const idxSkill = modalHtml.indexOf('>スキル</div>');
const idxAwaken = modalHtml.indexOf('>覚醒</div>');
const idxEquip = modalHtml.indexOf('装着してるキャラ');
ok('見た目/名前(head)が一番上に来る', idxHead >= 0 && idxHead < idxLevel, [idxHead, idxLevel]);
ok('レベル上げが基礎ステータスより先に来る', idxLevel >= 0 && idxLevel < idxBase, [idxLevel, idxBase]);
ok('基礎ステータスがスキルより先に来る', idxBase >= 0 && idxBase < idxSkill, [idxBase, idxSkill]);
ok('スキルが覚醒より先に来る', idxSkill >= 0 && idxSkill < idxAwaken, [idxSkill, idxAwaken]);
ok('覚醒が装着してるキャラより先に来る', idxAwaken >= 0 && idxAwaken < idxEquip, [idxAwaken, idxEquip]);
ok('装着してるキャラの名前が表示される(m06 = ' + E.MON_BY_ID.m06.name + ')', modalHtml.includes(E.MON_BY_ID.m06.name));
ok('凸の折りたたみトグル(+/−)はもう無い(常時表示化)', !modalHtml.includes('relic-dupe-toggle'));
ok('スキルのアップボタンはあるが、もう即座には上げない(モーダルを開くだけ)', modalHtml.includes(`data-relic-skillup="${relicId}"`));

// --- 2. 確認モーダルの中身: 消費素材(ゴールド+コア)と入手方法が出る ---
const st0 = api.STATE.relics[relicId];
const skillLvBefore = st0.skillLv || 1;
const cost = E.relicSkillCost(skillLvBefore);

modalHtml = '';
E.openRelicSkillUpModal(relicId);
ok('モーダルを開いた直後はまだスキルLvは上がっていない', (api.STATE.relics[relicId].skillLv || 1) === skillLvBefore);
ok('確認モーダルにゴールドの必要数が出る', modalHtml.includes(cost.gold.toLocaleString()));
ok('確認モーダルにコア素材の必要数が出る', modalHtml.includes(`/ ${cost.coreN}`));
ok('入手方法はまだ閉じている(タップするまで出ない)', !modalHtml.includes('鍛冶屋') && !modalHtml.includes('ショップ'));

// 素材チップをタップした状態を模す
E.relicSkillUpShort = true;
modalHtml = '';
E.renderRelicSkillUpModal();
ok('入手方法をタップで開くと説明文が出る', /鍛冶屋|ショップ/.test(modalHtml));
ok('入手方法の説明文がrelicMatSourceHintの内容と一致する', modalHtml.includes(E.relicMatSourceHint(`relic_core_${cost.coreTier}`)));

// --- 3. 素材が足りない場合はレベルアップボタンが無効(disabled) ---
api.STATE.gold = 0;
Object.keys(api.STATE.items || {}).forEach(k => { if(/^relic_core_/.test(k)) api.STATE.items[k] = 0; });
modalHtml = '';
E.renderRelicSkillUpModal();
ok('素材が足りない時はレベルアップするボタンがdisabledになる', /data-confirm-relic-skill-up="1"[^>]*disabled/.test(modalHtml));

// --- 4. 素材を十分に用意してから確定すると、実際にスキルLvが上がる ---
api.STATE.gold = 999999;
const coreKey = `relic_core_${cost.coreTier}`;
E.addItem(coreKey, 99);
const upped = E.upgradeRelicSkill(relicId);
ok('確定後、実際にスキルLvが上がる', upped && api.STATE.relics[relicId].skillLv === skillLvBefore + 1, api.STATE.relics[relicId].skillLv);

// --- 5. relicMatSourceHint: tierごとに入手先が異なることを明記している ---
ok('relic_scrapは鍛冶屋とゴールドショップ', /鍛冶屋/.test(E.relicMatSourceHint('relic_scrap')) && /ゴールドショップ/.test(E.relicMatSourceHint('relic_scrap')));
ok('relic_core_1は鍛冶屋でも手に入る', E.relicMatHasBase('relic_core_1'));
ok('relic_core_2・3は鍛冶屋では手に入らない(PVPショップのみ)', !E.relicMatHasBase('relic_core_2') && !E.relicMatHasBase('relic_core_3') && /PVPポイントショップ/.test(E.relicMatSourceHint('relic_core_2')));
ok('relicMatShopTab: scrap/core1はgold、core2/3はpvp', E.relicMatShopTab('relic_scrap') === 'gold' && E.relicMatShopTab('relic_core_1') === 'gold' && E.relicMatShopTab('relic_core_2') === 'pvp' && E.relicMatShopTab('relic_core_3') === 'pvp');

console.log('done');
