/* regression test: 図鑑(モンスター)で未入手のキャラをタップしても何も起きなかった
   (data-detailはowned限定だった)。data-preview-monに切り替え、openMonsterDetailOrPreview
   に振り分けることで、未入手でも性能(Lv1基礎ステータス・スキル)を確認できるように
   なった。ただし未入手なのでレベル上げ・昇格・遺物装着などの強化UIは一切出さない
   (showMonsterPreviewの既存の安全設計をそのまま使う)。
   遺物図鑑(relicCell/data-relic-dex-row)は元々所持有無に関わらずshowRelicDetailに
   リンクしていて、未所持なら効果一覧のプレビューのみ(強化UIなし)なので既に対応済み
   - ここではその前提が崩れていないことだけ軽く確認する。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID, MONSTERS,
  renderDex, renderRelicsScreen, RELICS,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
const unownedId = E.MONSTERS.find(m => !S.owned[m.id]).id;
const html1 = E.renderDex();
ok('未入手キャラのセルにdata-preview-monが付く', html1.includes(`data-preview-mon="${unownedId}"`), unownedId);
ok('未入手キャラのセルにdata-detail(旧方式・タップ無反応の原因)は付かない', !new RegExp(`data-detail="${unownedId}"`).test(html1));

// 所持後もdata-preview-mon経由になる(openMonsterDetailOrPreviewが内部でshowMonsterDetailに振り分ける)
S.owned[unownedId] = { star: E.MON_BY_ID[unownedId].rarity, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
const html2 = E.renderDex();
ok('所持後もdata-preview-monでタップできる(内部でshowMonsterDetailに振り分ける)', html2.includes(`data-preview-mon="${unownedId}"`), unownedId);

// 遺物図鑑: 元々所持有無に関わらずshowRelicDetailにリンクしている前提の確認
const unownedRelicId = Object.keys(E.RELICS).find(id => !(S.relics && S.relics[id]));
const relicHtml = E.renderRelicsScreen();
ok('未所持の遺物もdata-relic-dex-rowでタップできる(既存仕様)', relicHtml.includes(`data-relic-dex-row="${unownedRelicId}"`), unownedRelicId);

console.log('done');
