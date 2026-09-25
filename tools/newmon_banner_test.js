/* regression test: 新規29体の実装予定を告知するホーム画面バナー(お知らせ画面にリンク)。
   まだ実装されていないキャラの立ち絵アセットではなく、告知用に別枠で用意した
   ICON_DATA.banner_newmon29 を使う(SPRITES/MONSTERSは一切触っていない = 実装は
   まだ始まっていないことの確認も兼ねる)。
   注意: harness.js は icon-data/sprite-data を常に空の{}にスタブする(バトルロジックの
   テストに実データは不要なため)。よって実アセットの存在確認はindex.htmlを直接読んで
   行い、バナー生成ロジック自体はICON_DATAへダミー値を差し込んでテストする。 */
const fs = require('fs');
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, ICON_DATA, NOTICES,
  homeBanners, renderBannerCarousel, MONSTERS,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// --- 1. 実アセット: index.html本体にbanner_newmon29が実際に埋め込まれているか(harnessを介さず直接確認) ---
const html = fs.readFileSync('../index.html', 'utf8');
const m = html.match(/<script id="icon-data"[^>]*>([\s\S]*?)<\/script>/);
const realIconData = JSON.parse(m[1]);
ok('index.html本体にbanner_newmon29の画像データが実際に埋め込まれている', typeof realIconData.banner_newmon29 === 'string' && realIconData.banner_newmon29.length > 1000, realIconData.banner_newmon29 && realIconData.banner_newmon29.length);
ok('base64はdata-URIプレフィックス無しの生データ(既存のegg_*と同じ約束事)', realIconData.banner_newmon29 && !realIconData.banner_newmon29.startsWith('data:'));

// --- 2. 新規29体はまだMONSTERSに実装されていない(告知だけが先行している) ---
api.STATE = E.DEFAULT_STATE();
ok('新規30体がMONSTERSに実装されている(α0.1)', E.MONSTERS.length === 135, E.MONSTERS.length);

// --- 3. バナー生成ロジック: ICON_DATAにアセットがある時だけ告知バナーが出る ---
delete E.ICON_DATA.banner_newmon29;
const bannersWithout = E.homeBanners();
ok('アセットが無い時は告知バナーを出さない(壊れた画像を表示しない安全策)', !bannersWithout.find(b => b.tag === '新登場'));

E.ICON_DATA.banner_newmon29 = 'RkFLRV9CQVNFNjRfRk9SX1RFU1Q'; // ダミーのbase64
const banners = E.homeBanners();
const promo = banners.find(b => b.tag === '新登場');
ok('アセットがある時はホーム画面のバナー一覧に「新登場」バナーが含まれる', !!promo);
ok('タイトルに新モンスター30体と入っている', promo && promo.title.includes('30体'));
ok('お知らせ画面へのリンクになっている', promo && promo.attr.includes('data-overlay="notices"'));
ok('独自の画像(rawImg)を使い、実在しないモンスターIDをimgSrc()に渡さない', promo && !!promo.rawImg && !promo.img);

// --- 4. 実際にレンダリングされたHTMLにも出る ---
const carouselHtml = E.renderBannerCarousel();
ok('カルーセルのHTMLにバナーのタイトルが出る', carouselHtml.includes('新モンスター30体、参戦'));
ok('カルーセルのHTMLに告知用画像(base64)が埋め込まれている', carouselHtml.includes(E.ICON_DATA.banner_newmon29));

// --- 5. お知らせ一覧(NOTICES)にも同じ告知が載っている ---
const notice = E.NOTICES.find(n => n.title.includes('29体'));
ok('NOTICESにも同じ告知が載っている(バナーをタップした先で詳細が読める)', !!notice, notice);

console.log('done');
