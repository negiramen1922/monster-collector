/* regression test: the お知らせ screen's new アップデート内容/ニュース split.
   UPDATE_LOG is the per-version changelog (kept alongside NOTICES, the curated feature
   news); unreadNotices() must count unseen items across BOTH lists, and opening the
   notices overlay must mark both as seen. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  NOTICES, UPDATE_LOG, liveNotices, liveUpdateLog, unreadNotices, openOverlay, GAME_VERSION,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- UPDATE_LOG data integrity: starts at α0.0.001, ids strictly descending, no dupes ---
const versions = E.UPDATE_LOG.map(n => n.version);
ok('UPDATE_LOGはα0.0.001から始まる', versions[versions.length - 1] === 'α0.0.001', versions[versions.length - 1]);
ok('UPDATE_LOGの先頭は現在のGAME_VERSIONと一致する', versions[0] === E.GAME_VERSION, [versions[0], E.GAME_VERSION]);
const ids = E.UPDATE_LOG.map(n => n.id);
ok('idは新しい順(降順)に並んでいる', ids.every((id, i) => i === 0 || id < ids[i - 1]), ids);
ok('idの重複がない', new Set(ids).size === ids.length);
ok('versionの重複がない', new Set(versions).size === versions.length, versions);

// --- unreadNotices(): counts unseen items from NOTICES + UPDATE_LOG combined ---
S.noticeSeen = 0;
S.updateLogSeen = 0;
// at つきのニュース(掲載時刻より前)は未読に数えない。イベント開始と同時にバッジが出る
ok('未読件数は掲載中のニュース+掲載中のUPDATE_LOGの合計', E.unreadNotices() === E.liveNotices().length + E.liveUpdateLog().length, E.unreadNotices());

S.noticeSeen = Math.max(...E.NOTICES.map(n => n.id)); // all news read(既読は「読んだいちばん大きい id」)
ok('ニュースだけ既読にするとUPDATE_LOG分だけ残る', E.unreadNotices() === E.liveUpdateLog().length, E.unreadNotices());

S.updateLogSeen = E.liveUpdateLog()[0].id; // all updates also read (公開時刻前のものは数えない)
ok('両方既読にすると未読0になる', E.unreadNotices() === 0, E.unreadNotices());
// id は公開時刻(at)の順に大きくする。あとから公開するものの id が小さいと、すでに既読あつかいになって未読にも自動表示にもならない(10/21の遠征48のあとに43〜47を出して起きた)
{ const t = n => n.at ? new Date(n.at).getTime() : 0, bad = [];
  E.NOTICES.forEach(a => E.NOTICES.forEach(b => { if(t(a) > t(b) && a.id < b.id && b.id >= 48) bad.push(a.id + '<' + b.id); }));
  ok('ニュースの id は公開時刻の順に大きい(遠征48以降)', !bad.length, bad); }

// --- openOverlay('notices') marks BOTH lists as seen in one tap, matching the existing
// single-bell-icon UX (no need to visit each tab separately) ---
S.noticeSeen = 0;
S.updateLogSeen = 0;
S.friends = []; // openOverlay('friends') branch not taken here; keep friends-unrelated state sane
window.__authBackend = { kind: 'local' };
E.openOverlay('notices');
ok('お知らせを開くとニュース側が既読になる', S.noticeSeen === E.liveNotices()[0].id, S.noticeSeen);
ok('お知らせを開くとアップデート内容側も既読になる', S.updateLogSeen === E.liveUpdateLog()[0].id, S.updateLogSeen);
ok('開いた直後は未読0になる', E.unreadNotices() === 0, E.unreadNotices());

console.log('done');
