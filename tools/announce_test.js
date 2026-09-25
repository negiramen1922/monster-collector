/* レベルアップ・コンテンツ解放のお知らせ: 起きたことを1回だけキューに積む、の回帰テスト */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, checkTamerLevelUp, checkUnlocks, track, tamerLevel, unlockDefs, TAMER_LEVELUP_STAMINA };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
const Q = () => api.STATE.announceQueue || [];

// 既存のセーブ: 今開いているものは黙って「お知らせ済み」にする
api.STATE = E.DEFAULT_STATE();
let S = api.STATE;
S.clearedStages = ['tu1', 'tu2', 'tu3', 'q1_01', 'q1_02', 'q1_03', 'q1_04', 'q1_05'];
E.checkUnlocks();
ok('既存のセーブでは今開いている分をさかのぼって知らせない', Q().length === 0 && S.unlocksSeen.speed && S.unlocksSeen.fac_lab, Object.keys(S.unlocksSeen));

// 新しく解放されたら1回だけ積む
S.clearedStages.push('q1_06', 'q1_07', 'q1_08', 'q1_09', 'q1_10');
E.checkUnlocks();
const keys = Q().map(a => a.key);
ok('初級10クリアで工房・施設Lv3・育成段階2・中級が解放のお知らせ', ['fac_smithy', 'faclv_3', 'dg_2', 'tier_q2'].every(k => keys.includes(k)), keys);
const n = Q().length;
E.checkUnlocks();
ok('同じ解放は2回知らせない', Q().length === n);

// 新規プレイヤー: チュートリアルクリアで育成クエスト・イベントが解放
api.STATE = E.DEFAULT_STATE(); S = api.STATE;
E.checkUnlocks();
S.clearedStages = ['tu1', 'tu2', 'tu3'];
E.checkUnlocks();
ok('チュートリアルクリアで「育成クエスト・イベントが解放」', Q().some(a => a.key === 'tutorial') && Q().some(a => a.key === 'tier_q1'), Q().map(a => a.key));

// レベルアップ: スタミナの額つきで積む。続けて上がったら1件にまとめる
api.STATE = E.DEFAULT_STATE(); S = api.STATE;
S.clearedStages = ['tu1', 'tu2', 'tu3']; S.stamina = 0;
E.checkTamerLevelUp();
for(let i = 0; i < 40; i++) E.track('exploreClear');
E.checkTamerLevelUp();
for(let i = 0; i < 80; i++) E.track('exploreClear');
E.checkTamerLevelUp();
const lvA = Q().filter(a => a.kind === 'level');
ok('レベルアップのお知らせは1件にまとまり、スタミナは合計', lvA.length === 1 && lvA[0].stamina >= 2 * E.TAMER_LEVELUP_STAMINA && lvA[0].stamina % E.TAMER_LEVELUP_STAMINA === 0 && lvA[0].title.includes(`Lv.${E.tamerLevel().lv}`), lvA);
ok('解放の定義はキーが重複しない', new Set(E.unlockDefs().map(d => d.key)).size === E.unlockDefs().length);
console.log(fails ? `${fails}件失敗` : 'すべて通過');
