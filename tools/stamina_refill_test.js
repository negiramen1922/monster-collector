/* スタミナ回復の値上がり(1日22回・1回目は無料、そのあと同じ値段を3回ずつ)を確かめる */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  DEFAULT_STATE, STAMINA_REFILL_PRICES, STAMINA_REFILL_QTY,
  staminaRefillUsed, staminaRefillLeft, staminaRefillPrice, buyStaminaRefill,
  STATE_set: s => { STATE = s; },
};`);
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
S.crystals = 100000;
S.stamina = 0;

ok('値段は 無料/50×3/100×3/150×3/200×3/300×3/400×3/500×3', JSON.stringify(E.STAMINA_REFILL_PRICES) === '[0,50,50,50,100,100,100,150,150,150,200,200,200,300,300,300,400,400,400,500,500,500]', E.STAMINA_REFILL_PRICES);
ok('1回目は無料', E.staminaRefillPrice() === 0, E.staminaRefillPrice());
ok('本日あと22回', E.staminaRefillLeft() === 22, E.staminaRefillLeft());

const spent = [];
for(let i = 0; i < 22; i++){
  const before = S.crystals;
  E.buyStaminaRefill();
  spent.push(before - S.crystals);
}
ok('22回ぶんの支払いが3回ずつの階段になる', JSON.stringify(spent) === '[0,50,50,50,100,100,100,150,150,150,200,200,200,300,300,300,400,400,400,500,500,500]', spent);
ok('合計5,100結晶', spent.reduce((a, b) => a + b, 0) === 5100, spent.reduce((a, b) => a + b, 0));
ok('22回で打ち止め', E.staminaRefillPrice() === null && E.staminaRefillLeft() === 0, [E.staminaRefillPrice(), E.staminaRefillLeft()]);

const c9 = S.crystals, st9 = S.stamina;
E.buyStaminaRefill();
ok('23回目は買えない', S.crystals === c9 && S.stamina === st9, [S.crystals - c9, S.stamina - st9]);
ok('1回150スタミナ回復する', E.STAMINA_REFILL_QTY === 150, E.STAMINA_REFILL_QTY);

// 日付が変わるとリセット
S.daily = null;
ok('日付が変わると22回に戻る', E.staminaRefillLeft() === 22 && E.staminaRefillPrice() === 0, [E.staminaRefillLeft(), E.staminaRefillPrice()]);
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exitCode = bad ? 1 : 0;
