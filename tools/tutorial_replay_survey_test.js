/* チュートリアルの遊び直しとアンケート(α0.5)の回帰テスト。
   使い方: cd tools && node tutorial_replay_survey_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  DEFAULT_STATE, normalizeState, startTutorialReplay, endTutorialReplay, finishTutorialReplay, tutorialNextStage,
  stageStaminaCost, STAGE_BY_ID, TUT_STAGES, surveyCheck, surveyNeedsQ4, submitSurvey, surveyEligible, surveyOpen,
  surveyAnswered, SURVEY, TUT_CAMPAIGN,
  get STATE(){ return STATE }, set STATE(v){ STATE = v },
  setBackend(f){ authBackend = f; }, setAccount(a){ ACCOUNT = a; },
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { if(!cond){ ng++; console.log('❌ ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } };
const realNow = Date.now;
const at = iso => { Date.now = () => new Date(iso).getTime(); };
at('2026-10-09T12:00:00+09:00');

// 前からいる人(チュートリアルを終えている・お礼の印がない)
const old = () => { api.STATE = E.DEFAULT_STATE(); const S = api.STATE; delete S.tutReplayRewarded; S.clearedStages = ['tu1', 'tu2', 'tu3', 'tu4', 'tu5', 'q1_01']; E.normalizeState(); return S; };
let S = old();
ok('前からいる人はお礼の対象', S.tutReplayRewarded === false);
ok('遊び直す前はアンケートに答えられない', !E.surveyEligible());
S.autoUlt = true;
E.startTutorialReplay();
ok('遊び直しは0-1から', E.tutorialNextStage() === 'tu1' && S.tutReplay && S.tutReplay.at === 0, S.tutReplay);
ok('遊び直しの今の1本はスタミナ0', E.stageStaminaCost(E.STAGE_BY_ID.tu1) === 0);
ok('遊び直しの今の1本でないチュートリアルは通常のコスト', E.stageStaminaCost(E.STAGE_BY_ID.tu3) > 0);
S.tutReplay.at = 3;
ok('進み具合で次の1本が決まる', E.tutorialNextStage() === 'tu4');
S.autoUlt = false;   // 0-3 で切られた
const gifts = S.presentBox.length;
E.finishTutorialReplay();
ok('最後まで遊ぶと星結晶360が1回届く', S.presentBox.length === gifts + 1 && S.presentBox[S.presentBox.length - 1].reward[0].n === 360, S.presentBox.slice(-1));
ok('奥義オートはもとに戻る', S.autoUlt === true);
ok('遊び直しは終わる', !S.tutReplay);
ok('アンケートに答えられる', E.surveyEligible());
E.startTutorialReplay(); E.finishTutorialReplay();
ok('2回目はお礼が出ない', S.presentBox.length === gifts + 1, S.presentBox.length);

// お披露目の前は、お礼を出さない
S = old(); at('2026-10-07T11:00:00+09:00');
E.startTutorialReplay(); E.finishTutorialReplay();
ok('10/7 12:00 より前はお礼を出さない', S.presentBox.length === 0 && S.tutReplayRewarded === false);
at('2026-10-09T12:00:00+09:00');

// 新しく始めた人はお礼の対象外
api.STATE = E.DEFAULT_STATE(); E.normalizeState();
ok('新しく始めた人は遊び直しのお礼の対象外', api.STATE.tutReplayRewarded === true);

// アンケートの入力チェック
const good = { q1: 4, q2: 'good', q3: ['ult'], q4: '奥義のボタンの場所がしばらく分からなかったです', q5: 5, q6: '星刻で何が強くなるのかを、★を上げる前に一覧で見たいです', q7: '' };
ok('全部答えれば送れる', Object.values(E.surveyCheck(good)).every(Boolean), E.surveyCheck(good));
ok('Q6が20文字未満だと送れない', !E.surveyCheck({ ...good, q6: '短い' }).q6);
ok('とくになしならQ4はいらない', E.surveyCheck({ ...good, q3: ['none'], q4: '' }).q4);
ok('ほかを選んだらQ4は20文字以上', !E.surveyCheck({ ...good, q4: 'みじかい' }).q4);
ok('Q1を答えないと送れない', !E.surveyCheck({ ...good, q1: null }).q1);

// 送信(サーバーはにせもの)
(async () => {
  S = old(); E.startTutorialReplay(); E.finishTutorialReplay();
  const sent = [];
  E.setAccount({ uid: 'u1', playerId: 'P1', provider: 'guest' });
  E.setBackend(() => ({ async submitSurvey(id, uid, data){ sent.push({ id, uid, data }); } }));
  const before = S.presentBox.length;
  ok('答えが足りないと送らない', (await E.submitSurvey({ ...good, q6: '' })) === false && sent.length === 0);
  ok('送れる', (await E.submitSurvey(good)) === true);
  ok('surveys/tutorial_2026_10/answers/{uid} に送る', sent.length === 1 && sent[0].id === 'tutorial_2026_10' && sent[0].uid === 'u1', sent);
  ok('名前・メールは送らない', !('name' in sent[0].data) && !('email' in sent[0].data));
  ok('召喚券10枚が届く', S.presentBox.length === before + 1 && S.presentBox[S.presentBox.length - 1].reward[0].key === 'gacha_char' && S.presentBox[S.presentBox.length - 1].reward[0].n === 10);
  ok('2回目は送れない', (await E.submitSurvey(good)) === false && sent.length === 1);
  // 失敗したらお礼を出さず、もう一度送れる
  S = old(); E.startTutorialReplay(); E.finishTutorialReplay();
  E.setBackend(() => ({ async submitSurvey(){ throw Object.assign(new Error('offline'), { code: 'unavailable' }); } }));
  const b2 = S.presentBox.length;
  ok('送れなかったらお礼は出ない', (await E.submitSurvey(good)) === false && S.presentBox.length === b2 && !E.surveyAnswered());
  // 期間外
  at('2026-10-23T00:00:00+09:00');
  E.setBackend(() => ({ async submitSurvey(){} }));
  ok('期間が過ぎたら送れない', (await E.submitSurvey(good)) === false && !E.surveyOpen());
  Date.now = realNow;
  console.log(ng ? `❌${ng}` : 'すべて通過');
})();
