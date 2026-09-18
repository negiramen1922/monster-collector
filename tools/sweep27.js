const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__s={battleRank,rankRoundLimit,sweepAllowed,runSweep,stageStars,findStage,STAGE_BY_ID,getItem,RECRUIT_CHANCE,RECRUIT_CHANCE_RARE,get b(){return battleUI}};`);
const F=global.__s;
Object.keys(F.RECRUIT_CHANCE).forEach(k => F.RECRUIT_CHANCE[k] = 0);
Object.keys(F.RECRUIT_CHANCE_RARE).forEach(k => F.RECRUIT_CHANCE_RARE[k] = 0);   // 個数を数えるので抽選は止める
const ok=(name, cond, info)=>console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):''));
const st=F.STAGE_BY_ID.q1_01;
ok('★3のラウンド上限: 3ウェーブで12', F.rankRoundLimit(st)===12);
ok('ランク: 誰も倒れず10ラウンド → ★3', F.battleRank({win:true, allyFell:false, round:10, stage:st})===3);
ok('ランク: 誰も倒れず15ラウンド → ★2', F.battleRank({win:true, allyFell:false, round:15, stage:st})===2);
ok('ランク: 誰か倒れた → ★1', F.battleRank({win:true, allyFell:true, round:5, stage:st})===1);
// real battles record the best rank
const strong=['m54','m113','m116','m68','m125'];
let b=api.run(strong,'q1_01',60);
ok('強いパーティで灯り森 → ★3を記録', b.win && b.rank===3 && api.STATE.stageStars.q1_01===3, [b.rank, b.round, b.allyFell]);
const weak=['m06','m21','m03'];
b=api.run(weak,'q1_03',1);
ok('弱いパーティは負けて記録なし', !b.win && !(api.STATE.stageStars||{}).q1_03);
// sweep rules (fresh state inside run(); reuse it)
const S=api.STATE; S.stageStars={q1_01:3, q1_02:2, dg_exp_0:3}; S.clearedStages=['q1_01','q1_02']; S.vip=false; S.stamina=100; S.items={}; S.gold=0;
ok('メインステージの周回: VIPでないと不可', !F.sweepAllowed(F.STAGE_BY_ID.q1_01).ok);
ok('★2のステージは周回不可', !F.sweepAllowed(F.STAGE_BY_ID.q1_02).ok);
ok('育成ダンジョンは★3ならVIPなしで周回可', F.sweepAllowed(F.findStage('dg_exp_0')).ok);
let r=F.runSweep('dg_exp_0', 3);
ok('EXPダンジョン×3: スタミナ60消費・TierI×30', r && r.runs===3 && S.stamina===40 && F.getItem('exp1')===30, [S.stamina, F.getItem('exp1')]);
r=F.runSweep('dg_exp_0', 10);
ok('スタミナの範囲までしか周回しない', r.runs===2 && S.stamina===0);
S.vip=true; S.stamina=300;
r=F.runSweep('q1_01', 10);
ok('VIPならメインステージを周回(ゴールド・素材・ソウル)', r.runs===10 && r.gold===10*F.STAGE_BY_ID.q1_01.gold && Object.keys(r.items).length>0, {gold:r.gold, items:Object.keys(r.items).length, souls:r.souls});
ok('周回もミッションの探索クリアに数える', S.stats.stageClear>=10, S.stats.stageClear);
// sweeping a boss stage gives one soul per run, with no daily cap
S.stageStars.q1_05=3; S.clearedStages=api.STAGES.map(x=>x.id); S.stamina=300; S.daily=null;
r=F.runSweep('q1_05', 10);
const bossSouls=api.STATE.daily.bossSouls.m60;
ok('ボスステージの周回は1回1個(上限なし)', bossSouls===10, bossSouls);
