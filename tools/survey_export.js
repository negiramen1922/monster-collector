/* アンケートの答えを Firestore から読んで、CSV と集計を出す(α0.5〜)。
   プレイヤーからは読めないルールなので、Firebase の管理用の鍵(サービスアカウント)で読む。
   鍵はリポジトリに入れないこと。

   使い方:
     npm install firebase-admin        (このフォルダでなくてもよい)
     GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node tools/survey_export.js [アンケートのid] [出力先.csv]
   アンケートのidの既定は tutorial_2026_10 */
const fs = require('fs');
let admin;
try{ admin = require('firebase-admin'); }catch(e){
  console.error('firebase-admin がありません。npm install firebase-admin してください');
  process.exit(1);
}
const SURVEY_ID = process.argv[2] || 'tutorial_2026_10';
const OUT = process.argv[3] || `survey_${SURVEY_ID}.csv`;
const Q3 = { flow: '戦闘の流れ', wave: 'ウェーブ', ult: '奥義', formation: '陣形', element: '属性と種族', gacha: 'ガチャと星刻', relic: '遺物とルーン', none: 'とくになし' };
const Q2 = { short: '短い', good: 'ちょうどよい', long: '長い' };

(async () => {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const snap = await admin.firestore().collection('surveys').doc(SURVEY_ID).collection('answers').get();
  const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['送った日時', 'プレイヤーID', 'テイマーLv', 'クリア数', '★5の数', '版', 'Q1分かりやすさ', 'Q2長さ', 'Q3分かりにくかったところ', 'Q4', 'Q5バトル', 'Q6直してほしいこと', 'Q7'];
  const lines = [head.join(',')].concat(rows.map(r => [
    new Date(r.at).toISOString(), r.playerId, r.tamerLv, r.cleared, r.star5, r.version,
    r.q1, Q2[r.q2] || r.q2, (r.q3 || []).map(k => Q3[k] || k).join('・'), r.q4, r.q5, r.q6, r.q7,
  ].map(esc).join(',')));
  fs.writeFileSync(OUT, '﻿' + lines.join('\n'));   // Excel で文字化けしないように BOM を付ける

  const avg = k => rows.length ? (rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length).toFixed(2) : '-';
  const count = (k, map) => Object.keys(map).map(v => `${map[v]} ${rows.filter(r => Array.isArray(r[k]) ? r[k].includes(v) : r[k] === v).length}`).join(' / ');
  console.log(`${SURVEY_ID}: ${rows.length}件 → ${OUT}`);
  console.log(`Q1 分かりやすさ 平均 ${avg('q1')}(5段階)`);
  console.log(`Q2 長さ  ${count('q2', Q2)}`);
  console.log(`Q3 分かりにくかったところ  ${count('q3', Q3)}`);
  console.log(`Q5 バトル 平均 ${avg('q5')}(5段階)`);
})().catch(e => { console.error(e); process.exit(1); });
