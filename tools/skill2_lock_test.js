/* regression test: ★1-3のキャラ(スキル2がまだ解放されていない)は、以前はスキル2の
   カードが一切表示されず「★4に昇格するとスキル2「name」が使えます」という一行だけ
   だった。性能(説明文・威力・対象・CT)は見えるようにしつつ、レベル上げボタン
   (data-skill-up)だけは出さない - 未解放のスキルを強化できてしまう抜け道を作らない。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID, MONSTERS,
  kitLinesHtml, kitOf, SECOND_SKILL_STAR,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();

// ★1-3のモンスターを1体選ぶ(native rarityが4未満)
const lowStarMon = E.MONSTERS.find(m => m.rarity < 4);
const kit = E.kitOf(lowStarMon);
const skill2 = kit.skill2 || kit.skill1;

// --- ★3(未解放)の状態: 性能は見えるが強化ボタンは出ない ---
const htmlLocked = E.kitLinesHtml(lowStarMon, 3, null, null);
ok('スキル2の名前が表示される', htmlLocked.includes(skill2.name), skill2.name);
ok('スキル2の説明文が表示される(以前は出ていなかった)', skill2.desc ? htmlLocked.includes(skill2.desc) : true, skill2.desc);
ok(`★${E.SECOND_SKILL_STAR}で解放されるロックメッセージが出る`, htmlLocked.includes(`★${E.SECOND_SKILL_STAR}に昇格すると使えるようになります`));
ok('未解放スキル2にレベル上げボタン(data-skill-up)は出ない', !htmlLocked.includes('data-skill-up'));
ok('ロック中のカードにlockedクラスが付く', /class="skill-card k-skill locked"/.test(htmlLocked), htmlLocked.match(/class="skill-card[^"]*"/g));

// --- ★4(解放済み)の状態: 通常のスキル2カードになる ---
const htmlUnlocked = E.kitLinesHtml(lowStarMon, 4, null, null);
ok('★4になるとロックメッセージは出ない', !htmlUnlocked.includes('に昇格すると使えるようになります'));
ok('★4になるとスキル2の説明文がそのまま表示される', skill2.desc ? htmlUnlocked.includes(skill2.desc) : true);

// --- 所持済み(showMonsterDetail相当)でも同じ振る舞い: 強化ボタンはo.skill2Lvに関わらず出ない ---
const ownedLowStar = { star: 3, souls: 0, level: 10, skillLv: 3, skill2Lv: 3, ultLv: 3, passiveLv: 3 };
const htmlOwnedLocked = E.kitLinesHtml(lowStarMon, 3, ownedLowStar,
  { skill1: '<div class="skill-upgrade">DUMMY_SKILL1_UPGRADE</div>', skill2: '<div class="skill-upgrade">DUMMY_SKILL2_UPGRADE</div>' });
ok('所持済みでも★3なら性能は見えるが強化UIは出ない(skill2Lvが入っていても無視)', !htmlOwnedLocked.includes('DUMMY_SKILL2_UPGRADE') && htmlOwnedLocked.includes(skill2.name));
ok('スキル1の強化UIは通常通り出る(スキル2だけロック)', htmlOwnedLocked.includes('DUMMY_SKILL1_UPGRADE'));

console.log('done');
