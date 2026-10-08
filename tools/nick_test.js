/* モンスターの名前付け・NGワード・通報・運営の対処(moderation)の確認(α0.5.002)。
   純粋な関数(正規化・NG・入力の整え方・受け取り側の検査)と、公開スナップショット・戦闘のユニット名・
   通報の1日の上限・伏せ字・moderation の適用を、偽のバックエンドで見る。
   使い方: cd tools && python3 extract.py && node nick_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, setAccount: a => { ACCOUNT = a; }, get ACCOUNT(){ return ACCOUNT; },
  ngNormalize, hasNgWord, cleanNickInput, sanitizeNick, monName, otherMonName, setMonNick, NICK_MAX, REPORTED_LABEL,
  sanitizeSupport, sanitizeDefense, buildDefenseSnapshot, publishProfile, profileState, friendEntryFromProfile,
  submitReport, reportBlockReason, isReported, otherPlayerName, otherBio, REPORT_DAILY_MAX, buildReportDoc, unhideReported,
  applyModeration, defaultPlayerName, startPvpBattle, buildPvpEnemyParty, formationForFrontCount, lineupFromList,
  HELP_SLOT_ID, syncHelperMon, MON_BY_ID, STAGES, get pvpOpponents(){ return pvpOpponents; }, set pvpOpponents(v){ pvpOpponents = v; },
  reportTargetOf, sanitizeBio,
};`);
const E = global.__e;
let bad = 0;
const ok = (name, cond, info) => { if(!cond) bad++; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

(async () => {
  // ---- 1. 正規化と NG ----
  ok('カタカナ・全角/半角・空白を正規化', E.ngNormalize('チ ン　ｺ') === 'ちんこ', E.ngNormalize('チ ン　ｺ'));
  ok('大文字/全角英字を小文字に', E.ngNormalize('ＦｕＣｋ') === 'fuck');
  ok('記号を挟む書き方を詰める', E.ngNormalize('ち.ん-こ!') === 'ちんこ');
  ok('小さい文字は大きい文字に', E.ngNormalize('ファック') === E.ngNormalize('ふぁっく'));
  ['ちんこ', 'ﾁﾝｺ', 'チ・ン・コ', 'f u c k', 'ＳＨＩＴ', '死ね', 'しね', 'シネ', 'ちーんこ', 'おまえしね' /* しね は全体一致だけ */]
    .forEach((w, i) => { const expect = i !== 9; ok(`NG判定 「${w}」 → ${expect}`, E.hasNgWord(w) === expect); });
  ['ぴよ丸', 'よしねこ', 'grape', 'Sussex', 'ポチ', 'クラッシュ', 'class', 'エース'].forEach(w => ok(`誤爆しない 「${w}」`, E.hasNgWord(w) === false));

  // ---- 2. 入力の整え方 ----
  const c = E.cleanNickInput;
  ok('前後の空白を削る・改行と制御文字を落とす', c('  ぴよ\n丸\t ').nick === 'ぴよ丸' && !c('  ぴよ\n丸\t ').err);
  ok('8文字はOK', !c('12345678').err && c('12345678').nick === '12345678');
  ok('9文字はだめ', /8文字/.test(c('123456789').err || ''));
  ok('絵文字などサロゲートは1文字で数える', !c('あいうえおかき😀').err);
  ok('HTMLの記号はだめ', !!c('<b>x').err && !!c('a&b').err && !!c('"x').err);
  ok('NGワードはだめ(理由つき)', /使えない言葉/.test(c('チンコ').err || ''));
  ok('空なら元に戻す(nick="")', c('   ').nick === '' && !c('   ').err);
  ok('図鑑名と同じなら付けない', c(E.MON_BY_ID.m06.name, 'm06').nick === '');
  ok('ゼロ幅文字は落とす', c('ab​c').nick === 'abc');

  // ---- 3. 受け取り側の検査 ----
  const s = E.sanitizeNick;
  ok('正しい名前は通る', s('ぴよ丸') === 'ぴよ丸');
  ok('9文字は図鑑名(空)', s('123456789') === '');
  ok('NGは空', s('ﾁﾝｺ') === '');
  ok('制御文字は空', s('ab\nc') === '' && s('ab‮c') === '');
  ok('前後の空白つきは空', s(' ab') === '');
  ok('記号つきは空', s('<img>') === '' && s("a'b") === '');
  ok('文字列でなければ空', s(12345) === '' && s(null) === '' && s({}) === '');
  const sup = E.sanitizeSupport({ id: 'm06', nick: 'ぴよ丸', star: 3, level: 10 });
  ok('sanitizeSupport が nick を通す', sup.nick === 'ぴよ丸');
  ok('sanitizeSupport が悪い nick を落とす', E.sanitizeSupport({ id: 'm06', nick: '<script>', star: 3 }).nick === '');
  const def = E.sanitizeDefense({ formationKey: 'f1', slots: [{ id: 'm06', nick: 'ぽち' }, { id: 'm21', nick: 'しね' }, null, null, null] });
  ok('sanitizeDefense のスロットに nick(NGは空)', def.slots[0].nick === 'ぽち' && def.slots[1].nick === '', def.slots.map(x => x && x.nick));

  // ---- 4. 自分のモンスターに付ける・公開 ----
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  E.setAccount({ uid: 'me', playerId: 'ME12-3456-7890', name: 'わたし', provider: 'google' });
  let published = null;
  global.window.__authBackend = { kind: 'mock', async cloudProfile(uid, p){ published = p; }, reports: [],
    async submitReport(d){ this.reports.push(d); }, async fetchModeration(){ return this.mod || null; } };
  ok('付ける前は図鑑名', E.monName('m06') === E.MON_BY_ID.m06.name);
  let r = E.setMonNick('m06', 'ぴよ丸');
  ok('付けられる', !r.err && S.owned.m06.nick === 'ぴよ丸' && E.monName('m06') === 'ぴよ丸');
  r = E.setMonNick('m06', 'ちんこ');
  ok('NGは保存しない(前の名前のまま)', !!r.err && S.owned.m06.nick === 'ぴよ丸');
  r = E.setMonNick('m06', '123456789');
  ok('9文字は保存しない', !!r.err && S.owned.m06.nick === 'ぴよ丸');
  E.setMonNick('m21', 'ぽち');
  E.setMonNick('m21', '');
  ok('元に戻すで消える', !('nick' in S.owned.m21) && E.monName('m21') === E.MON_BY_ID.m21.name);
  E.setMonNick('m21', 'ぽち');

  E.profileState().favorites = ['m06'];
  S.pvpDefenseSlots = E.lineupFromList(['m06', 'm21'], S.formationKey);
  S.pvpDefenseFormation = S.formationKey;
  await E.publishProfile();
  ok('お助け(support)に nick が載る', published && published.support && published.support.nick === 'ぴよ丸', published && published.support);
  const dslots = published.defense.slots.filter(Boolean);
  ok('PVPの防衛に nick が載る', dslots.some(x => x.id === 'm06' && x.nick === 'ぴよ丸') && dslots.some(x => x.id === 'm21' && x.nick === 'ぽち'), dslots.map(x => [x.id, x.nick]));
  ok('nick のないモンスターは空文字(undefinedを送らない)', Object.values(published.support).every(v => v !== undefined));

  // ---- 5. 戦闘のユニット名とログ ----
  S.formationKey = E.formationForFrontCount(1).key;
  S.slots = E.lineupFromList(['m06', 'm21', 'm03'], S.formationKey);
  S.clearedStages = E.STAGES.map(x => x.id); S.stamina = 1e9; S.autoUlt = true;
  api.resetQueue();
  api.startBattle('q1_01', { skipIntro: true });
  const names = api.battleUI.party.map(u => u.name);
  ok('戦闘のユニット名が付けた名前', names.includes('ぴよ丸') && names.includes('ぽち') && names.includes(E.MON_BY_ID.m03.name), names);
  api.drainQueue();
  ok('戦闘ログに付けた名前が出る', api.battleUI.log.some(l => l.includes('ぴよ丸')));

  // お助け: 貸してくれた人の付けた名前
  S.friends = [E.friendEntryFromProfile({ uid: 'u-f', playerId: 'FFFF-FFFF-FFFF', name: 'フレンド', level: 5, support: { id: 'm54', nick: 'かしたこ', star: 3, level: 10 } })];
  S.borrowed = { uid: 'u-f', name: 'フレンド', mon: { ...S.friends[0].support } };
  E.syncHelperMon();
  ok('お助けの表示名は相手の nick', E.monName(E.HELP_SLOT_ID) === 'かしたこ');

  // PVP の相手: 受け取った nick(検査ずみ)。だめなものは図鑑名
  const oppDef = E.sanitizeDefense({ formationKey: S.formationKey, slots: [{ id: 'm06', nick: 'あいて' }, { id: 'm21', nick: 'ﾁﾝｺ' }, null, null, null] });
  const enemies = E.buildPvpEnemyParty(oppDef, 'u-opp');
  ok('PVPの相手ユニット名は相手の nick、NGは図鑑名', enemies[0].name === 'あいて' && enemies[1].name === E.MON_BY_ID.m21.name, enemies.map(u => u.name));

  // ---- 6. 通報 ----
  E.pvpOpponents = [{ uid: 'u-opp', playerId: 'OPPO-0000-0000', name: 'あいてさん', title: '', level: 9, defense: oppDef }];
  const tgt = E.reportTargetOf('pvp', 'u-opp');
  ok('PVPの相手から通報の対象を作れる', tgt && tgt.name === 'あいてさん' && tgt.mons.length === 2);
  const doc = E.buildReportDoc(tgt, 'nick', 'ひどい\nなまえ' + 'x'.repeat(200));
  ok('通報の中身(形)', doc.reporter === 'me' && doc.target === 'u-opp' && doc.targetPlayerId === 'OPPO-0000-0000' && doc.reason === 'nick'
    && doc.note.length <= 100 && typeof doc.at === 'number' && typeof doc.version === 'string', doc);
  ok('snapshot に名前・自己紹介・モンスターの名前', doc.snapshot.name === 'あいてさん' && doc.snapshot.bio === '' && /あいて/.test(doc.snapshot.monsters), doc.snapshot);
  ok('snapshot の項目は3つだけ(rules の hasOnly と同じ)', Object.keys(doc.snapshot).sort().join() === 'bio,monsters,name');
  ok('通報の項目は rules の hasOnly と同じ', Object.keys(doc).sort().join() === 'at,note,reason,reporter,snapshot,target,targetPlayerId,version');
  ok('知らない理由は other', E.buildReportDoc(tgt, 'zzz', '').reason === 'other');

  ok('通報前は伏せない', E.otherPlayerName('あいてさん', 'u-opp') === 'あいてさん');
  let rr = await E.submitReport(tgt, 'nick', '');
  ok('通報できる', rr.ok && global.window.__authBackend.reports.length === 1);
  ok('通報した相手は伏せる(名前)', E.isReported('u-opp') && E.otherPlayerName('あいてさん', 'u-opp') === E.REPORTED_LABEL);
  ok('通報した相手は伏せる(自己紹介)', E.otherBio('こんにちは', 'u-opp') === '');
  ok('通報した相手のモンスターは図鑑名', E.otherMonName({ id: 'm06', nick: 'あいて' }, 'u-opp') === E.MON_BY_ID.m06.name);
  rr = await E.submitReport(tgt, 'name', '');
  ok('同じ相手は1日1回', !rr.ok && /本日すでに/.test(rr.err) && global.window.__authBackend.reports.length === 1);
  for(let i = 0; i < 12; i++) await E.submitReport({ uid: 'u-x' + i, playerId: '', name: 'x' + i, bio: '', mons: [] }, 'other', '');
  ok(`全体で1日${E.REPORT_DAILY_MAX}件まで`, global.window.__authBackend.reports.length === E.REPORT_DAILY_MAX, global.window.__authBackend.reports.length);
  ok('上限の理由', /1日10件/.test(E.reportBlockReason('u-new')));
  ok('自分は通報できない', /自分/.test(E.reportBlockReason('me')));
  S.reportDaily.key = 'old-day';
  ok('日が変わると送れる', E.reportBlockReason('u-new') === '');
  E.unhideReported();
  ok('伏せ字を元に戻せる', !E.isReported('u-opp'));
  // 送れなかったら伏せない・数えない
  const fail = global.window.__authBackend.submitReport;
  global.window.__authBackend.submitReport = async () => { throw new Error('offline'); };
  rr = await E.submitReport({ uid: 'u-fail', name: 'f' }, 'other', '');
  ok('送信に失敗したら伏せない', !rr.ok && !E.isReported('u-fail'));
  global.window.__authBackend.submitReport = fail;
  E.setAccount({ uid: 'local-abc', playerId: 'X', name: 'ろーかる' });
  ok('ログインしていない(端末だけのゲスト)は通報できない', /ログイン/.test(E.reportBlockReason('u-opp')));
  E.setAccount({ uid: 'me', playerId: 'ME12-3456-7890', name: 'わたし', provider: 'google' });

  // ---- 7. 運営の対処(moderation) ----
  E.profileState().bio = 'わるいことば';
  global.window.__authBackend.mod = { resetName: true, resetBio: true, resetNicks: true, at: 1000 };
  let done = await E.applyModeration();
  ok('moderation で名前・自己紹介・モンスターの名前が初期に戻る', done.length === 3 && E.ACCOUNT.name === E.defaultPlayerName()
    && E.profileState().bio === '' && !Object.values(S.owned).some(o => o.nick), done);
  ok('初期の名前は テイマーXXXX', /^テイマー[0-9A-Z]{4}$/.test(E.ACCOUNT.name), E.ACCOUNT.name);
  E.setAccount({ ...E.ACCOUNT, name: 'つけなおし' });
  S.owned.m06.nick = 'またつけた';
  done = await E.applyModeration();
  ok('同じ at では2回目は何もしない', done.length === 0 && E.ACCOUNT.name === 'つけなおし' && S.owned.m06.nick === 'またつけた');
  global.window.__authBackend.mod = { resetNicks: true, at: 2000 };
  done = await E.applyModeration();
  ok('新しい at で、指定したものだけ戻す', done.join() === 'モンスターの名前' && E.ACCOUNT.name === 'つけなおし' && !S.owned.m06.nick, done);
  global.window.__authBackend.mod = null;
  ok('moderation が無ければ何もしない', (await E.applyModeration()).length === 0);

  console.log(bad ? `❌ ${bad}件 失敗` : '全部OK');
  process.exitCode = bad ? 1 : 0;
})();
