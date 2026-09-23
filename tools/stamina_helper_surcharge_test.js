/* regression test: お助けキャラ(借りたフレンドの支援キャラ)を編成に入れると、ステージの
   スタミナ消費に+5のサーチャージがかかる(stageStaminaCost)。ところが一部の画面が生の
   stage.staminaをそのまま表示・判定に使っていたため、ホーム画面の「次のステージ」カードや
   バトル結果画面の「次のステージへ/再挑戦」ボタンのガード処理だけサーチャージ抜きの値に
   なり、画面によってスタミナの必要量が違って見える(増えたり減ったりする)不具合があった。
   全ての表示・判定がstageStaminaCost()で統一されていることを確認する。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, STAGES,
  stageStaminaCost, HELP_SLOT_ID, HELP_STAMINA_SURCHARGE, nextAction, findStage, claimMissions,
  helperSurchargeNote, renderStageRow,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const stage = E.STAGES.find(st => st.type === 'main' && st.stamina);

// --- お助けキャラなし: サーチャージは付かない ---
api.STATE.slots = api.STATE.slots.map(() => null);
ok('お助けキャラがいない時はstageStaminaCostは元の値のまま', E.stageStaminaCost(stage) === stage.stamina, [E.stageStaminaCost(stage), stage.stamina]);

// --- お助けキャラを編成に入れる: +5される ---
api.STATE.slots[0] = E.HELP_SLOT_ID;
ok('お助けキャラを編成に入れるとサーチャージがかかる', E.stageStaminaCost(stage) === stage.stamina + E.HELP_STAMINA_SURCHARGE, E.stageStaminaCost(stage));

// --- ホーム画面の「次のステージ」カード: stageStaminaCost基準で統一されているか ---
// (受け取り待ちのミッションがあると別のカードが返るので、先に全部受け取っておく。
//  また「次」がチュートリアルだと初回無料でCT=0のまま検証できないので、対象ステージ
//  以外を全部クリア済み扱いにして、確実にサーチャージが乗る通常ステージを「次」にする)
api.STATE.clearedStages = E.STAGES.filter(st => st.id !== stage.id).map(st => st.id);
E.claimMissions(() => true); // クリア扱いにしたことで新たに受け取り待ちが出ることがあるので後でも呼ぶ
const action = E.nextAction();
ok('「次のステージ」に選ばれたのは検証対象のサーチャージ対象ステージ', action.main.stage === stage.id, action.main.stage);
const expectedCost = E.stageStaminaCost(stage); // お助けキャラ込みで stage.stamina + 5 のはず
ok('サーチャージが実際に乗っている(0ではない)', expectedCost === stage.stamina + E.HELP_STAMINA_SURCHARGE, expectedCost);
ok('ホーム画面の必要スタミナ表示がサーチャージ込みの値と一致する(以前は生のstage.staminaを表示していた)', new RegExp(`⚡${expectedCost}(?!\\d)`).test(action.sub), [action.sub, expectedCost, stage.stamina]);
api.STATE.stamina = expectedCost - 1; // サーチャージ込みでは足りないが、生の値(stage.stamina)なら足りてしまう量
const actionShort = E.nextAction();
ok('サーチャージ込みで足りない時は出撃ボタンがdisabledになる(以前は生の値で判定し、押せてしまっていた)', actionShort.main.disabled === true, actionShort.main);

// --- なぜ増えているか見えるように: helperSurchargeNote()とその表示箇所 ---
ok('お助けキャラがいない時は注記が出ない', (() => { api.STATE.slots = api.STATE.slots.map(() => null); return E.helperSurchargeNote() === ''; })());
api.STATE.slots[0] = E.HELP_SLOT_ID;
ok('お助けキャラがいる時は理由の注記が出る', E.helperSurchargeNote().includes(`+${E.HELP_STAMINA_SURCHARGE}`));
ok('ホーム画面のサブテキストにもお助けキャラの注記が出る', E.nextAction().sub.includes('お助けキャラ'));
const rowHtml = E.renderStageRow(stage);
ok('ステージ一覧の行にもお助けキャラの注記が出る', rowHtml.includes('お助けキャラ') && rowHtml.includes(`⚡${expectedCost}`));

// --- 初回無料チュートリアルはお助けキャラがいてもサーチャージが乗らない(0のまま)ので、
//     誤って「(お助けキャラ+5)」という注記を出してはいけない ---
const tu1 = E.findStage('tu1');
api.STATE.clearedStages = []; // tu1が未クリア = 初回無料の状態
ok('未クリアのチュートリアルはお助けキャラがいてもコストが0のまま', E.stageStaminaCost(tu1) === 0, E.stageStaminaCost(tu1));
ok('未クリアのチュートリアルでは誤った注記(お助けキャラ+5)を出さない', E.helperSurchargeNote(tu1) === '', E.helperSurchargeNote(tu1));
// クリア済み(2回目以降は定額10)でも、チュートリアルはそもそもサーチャージの対象外
// (stageStaminaCostがtier:'tu'を専用ルールで扱い、お助けキャラの有無を見ない)
api.STATE.clearedStages = [tu1.id];
ok('クリア済みチュートリアルは定額10になる(サーチャージは乗らない)', E.stageStaminaCost(tu1) === 10, E.stageStaminaCost(tu1));
ok('クリア済みチュートリアルでも誤った注記は出さない', E.helperSurchargeNote(tu1) === '', E.helperSurchargeNote(tu1));

console.log('done');
