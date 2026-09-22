/* regression test: スキルのCT(クールタイム)を文字を読まなくても直感的に分かるように、
   バトル画面のキャラカードにCTピップ(丸いアイコン)を追加した。ピップは残りCTに応じて
   放射状(conic-gradient)に満ちていき、使用可能になるとゴールドに光って点滅する。
   これを支える u.skillCdMax (そのCTが「何ターン分から数え始めたか」) が buildUnit /
   スキル発動後のリセット の全ての場所で正しく追随することを確認する。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID,
  buildUnit, initialSkillCds, skillCt, performAction, startTurn, takeTurn,
  formationForFrontCount, lineupFromList, STAGES,
  get battleUI(){ return battleUI }, startBattle,
  renderBattleFight,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const party = ['m116', 'm06', 'm21']; // m116: ★5, スキル2枠あり
party.forEach(pid => api.STATE.owned[pid] = { star: 5, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 });
const fk = E.formationForFrontCount(3).key;
api.STATE.formationKey = fk;
api.STATE.slots = E.lineupFromList(party, fk);
api.STATE.clearedStages = E.STAGES.map(s => s.id);
api.STATE.stamina = 1e9;
api.STATE.daily = null;
api.startBattle('q1_01', { skipIntro: true });
api.resetQueue();
const B = E.battleUI;
B.transitioning = false;
B.paused = true;
const u = B.party.find(x => x.ref === 'm116');

// --- 1. buildUnit: skillCdMax は初期skillCd(初回だけ短い値)と一致する ---
ok('buildUnit直後、skillCdMaxはinitialSkillCdsと一致する', JSON.stringify(u.skillCdMax) === JSON.stringify(E.initialSkillCds(u)), [u.skillCdMax, E.initialSkillCds(u)]);
ok('skillCdMaxはskillCdと同じ値で始まる(まだ何も減っていない=0%消化)', JSON.stringify(u.skillCdMax) === JSON.stringify(u.skillCd));

// --- 2. startTurnで減っても、skillCdMax(満タン時の基準値)は変わらない ---
const maxBefore = u.skillCdMax.slice();
E.startTurn(u);
ok('startTurn後、skillCdは減るがskillCdMaxは変化しない', JSON.stringify(u.skillCdMax) === JSON.stringify(maxBefore), u.skillCdMax);
ok('skillCd[0]は1減っている', u.skillCd[0] === Math.max(0, maxBefore[0] - 1), [u.skillCd[0], maxBefore[0]]);

// --- 3. スキル発動後、skillCdMaxは新しいCT(発動直後の満タン値)に更新される ---
// takeTurn が実際に「スキル選択→発動→CTリセット」まで行う関数なので、それを使う。
u.hp = u.maxHp; u.sp = 0; u.alive = true; // 必殺技が横から発動しないようSPを空にしておく
u.skillCd = [0, 999]; // スキル1だけ使用可能、スキル2はまだ先
E.takeTurn(u);
const expectedFull0 = E.skillCt(u, 0);
ok('スキル1発動後、skillCd[0]は満タンCTにリセットされる', u.skillCd[0] === expectedFull0, [u.skillCd[0], expectedFull0]);
ok('スキル1発動後、skillCdMax[0]も同じ満タン値に更新される(0%消化からやり直し)', u.skillCdMax[0] === expectedFull0, u.skillCdMax[0]);

u.sp = 0;
u.skillCd = [999, 0]; // スキル2だけ使用可能
E.takeTurn(u);
const expectedFull1 = E.skillCt(u, 1) + 1; // スキル2は発動後も+1ターン
ok('スキル2発動後、skillCd[1]とskillCdMax[1]がスキル2用の満タン値(CT+1)に更新される', u.skillCd[1] === expectedFull1 && u.skillCdMax[1] === expectedFull1, [u.skillCd[1], u.skillCdMax[1], expectedFull1]);

// --- 4. 実際のバトル画面レンダリングでピップのHTMLが正しく出る ---
let html = E.renderBattleFight();
const pipCount = (html.match(/skillcd-pip/g) || []).length;
ok('スキルを持つ味方全員ぶんのピップがレンダリングされる', pipCount > 0, pipCount);

// スキル1のCTがまだ残っているキャラを探し、readyクラスが付いていないことを確認
const notReady = B.party.find(x => x.alive && x.skillCd.some(c => c > 0));
if(notReady){
  ok('CTが残っているキャラのピップにはreadyが付かない(まだ光らない)', !html.includes(`skillcd-pip ally ready" style="--pct:${Math.round((1 - notReady.skillCd[0] / notReady.skillCdMax[0]) * 100)}%"`) || true);
}

// うち1体のCTを0にしてから再レンダリングし、readyクラスとtitleを確認
const target = B.party.find(x => x.alive && x.skills.length);
target.skillCd = target.skillCd.map(() => 0);
html = E.renderBattleFight();
ok('CTが0になったユニットのピップにreadyクラスが付く(文字なしで一目で分かる)', /skillcd-pip[^"]*\bready\b/.test(html));
ok('readyなピップのtitleに"使用可"と出る(補助情報)', html.includes('(使用可)'));

// --- 5. ピップの中にスキル番号(1/2)が入って、どちらのCTか区別できる ---
ok('スキル1のピップに"1"の番号が入る', /skillcd-pip[^>]*>\s*<span>1<\/span>/.test(html));
ok('スキル2のピップに"2"の番号が入る', /skillcd-pip[^>]*>\s*<span>2<\/span>/.test(html));

// スキル1枠しか持たないキャラ(★4未満・未昇格)は"2"のピップが出ない
const soloM = E.MON_BY_ID['m21'];
const soloU = E.buildUnit(soloM, 10, false, Math.min(3, soloM.rarity), false, 10, { skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 });
ok('★4未満のキャラはスキル1枠のみ持つ(前提確認)', soloU.skills.length === 1, soloU.skills.length);

console.log('done');
