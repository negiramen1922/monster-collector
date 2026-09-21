/* ad-hoc check for the present box (プレゼントボックス): stamina-overflow gifts past
   STAMINA_HARD_CAP, compensation gifts granted once per save, and claim/claim-all. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  grantStamina, grantRewards, addPresentBoxGift, claimGift, claimAllGifts,
  grantCompensationGifts, COMPENSATION_GIFTS,
  STAMINA_MAX, STAMINA_HARD_CAP,
  DAILY_MISSIONS, WEEKLY_MISSIONS,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- daily/weekly mission changes ---
const dUpgrade = E.DAILY_MISSIONS.find(m => m.id === 'd_upgrade');
ok('デイリー「モンスターを1回強化する」は80スタミナ', dUpgrade.reward.length === 1 && dUpgrade.reward[0].type === 'stamina' && dUpgrade.reward[0].n === 80, dUpgrade.reward);
const wGacha = E.WEEKLY_MISSIONS.find(m => m.id === 'w_gacha');
ok('ウィークリー「ガチャ」は10回', wGacha.goal === 10, wGacha.goal);

// --- grantStamina: normal case, no overflow ---
S.stamina = 100;
E.grantStamina(50);
ok('通常時はそのまま加算される', S.stamina === 150, S.stamina);

// --- grantStamina: pushes above STAMINA_MAX but under STAMINA_HARD_CAP, no present box entry ---
S.stamina = E.STAMINA_MAX - 10;
E.grantStamina(80); // 290 -> 370, well under 999
ok('STAMINA_MAXを超えて入る', S.stamina === E.STAMINA_MAX + 70, S.stamina);
ok('999未満なら箱には入らない', S.presentBox.length === 0, S.presentBox);

// --- grantStamina: overflow past STAMINA_HARD_CAP goes to present box ---
S.presentBox = [];
S.stamina = E.STAMINA_HARD_CAP - 20;
E.grantStamina(80); // only 20 fits, 60 should go to the present box
ok('999で頭打ちになる', S.stamina === E.STAMINA_HARD_CAP, S.stamina);
ok('あふれた分がプレゼントボックスに入る', S.presentBox.length === 1 && S.presentBox[0].reward[0].type === 'stamina' && S.presentBox[0].reward[0].n === 60, S.presentBox);

// --- grantStamina: already at hard cap, everything overflows ---
S.presentBox = [];
S.stamina = E.STAMINA_HARD_CAP;
E.grantStamina(80);
ok('既に999ならスタミナは動かず全部箱へ', S.stamina === E.STAMINA_HARD_CAP && S.presentBox.length === 1 && S.presentBox[0].reward[0].n === 80, [S.stamina, S.presentBox]);

// --- claimGift / claimAllGifts ---
S.presentBox = [];
S.crystals = 0;
E.addPresentBoxGift('ギフト1', [{ type:'crystal', n:100 }]);
E.addPresentBoxGift('ギフト2', [{ type:'crystal', n:200 }]);
ok('2件届く', S.presentBox.length === 2, S.presentBox);
const id1 = S.presentBox[0].id;
const g1 = E.claimGift(id1);
ok('個別に受け取れる', !!g1 && S.crystals === 100 && S.presentBox.length === 1, [S.crystals, S.presentBox]);
const got = E.claimAllGifts();
ok('まとめて受け取れる', got.length === 1 && S.crystals === 300 && S.presentBox.length === 0, [S.crystals, S.presentBox]);
ok('存在しないIDはnullを返す', E.claimGift(9999) === null);

// --- grantRewards with type:'stamina' routes through the same overflow-safe path ---
S.presentBox = [];
S.stamina = E.STAMINA_HARD_CAP - 5;
E.grantRewards([{ type:'stamina', n: 30 }]);
ok('grantRewards経由でもオーバーフローが箱に入る', S.stamina === E.STAMINA_HARD_CAP && S.presentBox.length === 1 && S.presentBox[0].reward[0].n === 25, [S.stamina, S.presentBox]);

// --- compensation gifts: granted once, never duplicated on a second call ---
E.COMPENSATION_GIFTS.length = 0;
E.COMPENSATION_GIFTS.push({ id: 'test_apology', label: 'テストお詫び', reward: [{ type:'crystal', n:500 }] });
S.presentBox = [];
S.giftsGranted = {};
E.grantCompensationGifts();
ok('コンペンセーションギフトが1回届く', S.presentBox.length === 1 && S.presentBox[0].label === 'テストお詫び', S.presentBox);
E.grantCompensationGifts();
ok('2回目は届かない(重複しない)', S.presentBox.length === 1, S.presentBox);
