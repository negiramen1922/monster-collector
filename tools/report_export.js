/* 通報(reports)を Firestore から読んで、CSV と「相手ごとの件数」を出す(α0.5.002〜)。
   プレイヤーからは読めないルールなので、Firebase の管理用の鍵(サービスアカウント)で読む。
   鍵はリポジトリに入れないこと。

   使い方:
     npm install firebase-admin        (このフォルダでなくてもよい)
     GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node tools/report_export.js [何日前から(既定 30)] [出力先.csv]
   出力: 1件1行の CSV(既定 reports_YYYYMMDD.csv)と、相手ごとの件数(多い順)を画面に出す。
         相手ごとの件数は <出力先>_by_target.csv にも書く。

   対処のしかた(運営): 直す必要があれば、Firebase コンソールの Firestore で
     moderation/{相手のuid} に { resetName: true, resetBio: true, resetNicks: true, at: <いまのミリ秒> } を書く
   (要るものだけ true にする。at は前より大きい数にする。相手が次にログインしたときに初期に戻り、お知らせが出る)。
   いまのミリ秒は  node -e "console.log(Date.now())"  で出せる。 */
const fs = require('fs');
let admin;
try{ admin = require('firebase-admin'); }catch(e){
  console.error('firebase-admin がありません。npm install firebase-admin してください');
  process.exit(1);
}
const DAYS = Number(process.argv[2]) || 30;
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const OUT = process.argv[3] || `reports_${stamp}.csv`;
const OUT_BY = OUT.replace(/(\.csv)?$/, '_by_target.csv');
const REASON = { name: '不適切なプレイヤー名', nick: '不適切なモンスターの名前', bio: '不適切な自己紹介', other: 'その他' };

(async () => {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const since = Date.now() - DAYS * 86400000;
  const snap = await admin.firestore().collection('reports').where('at', '>=', since).get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at || 0) - (b.at || 0));
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const s = r => r.snapshot || {};
  const head = ['送った日時', '通報ID', '通報した人uid', '相手uid', '相手プレイヤーID', '理由', 'ひとこと', '相手の名前', '相手の自己紹介', 'モンスターの名前', '版'];
  const lines = [head.join(',')].concat(rows.map(r => [
    r.at ? new Date(r.at).toISOString() : '', r.id, r.reporter, r.target, r.targetPlayerId, REASON[r.reason] || r.reason, r.note,
    s(r).name, s(r).bio, s(r).monsters, r.version,
  ].map(esc).join(',')));
  fs.writeFileSync(OUT, '﻿' + lines.join('\n'));   // Excel で文字化けしないように BOM を付ける

  // 相手ごと: 件数・通報した人の数(同じ人の重複を除く)・理由の内訳・最後に見えていた名前
  const by = {};
  rows.forEach(r => {
    const t = by[r.target] || (by[r.target] = { uid: r.target, playerId: r.targetPlayerId, n: 0, reporters: new Set(), reasons: {}, last: null });
    t.n += 1;
    t.reporters.add(r.reporter);
    t.reasons[r.reason] = (t.reasons[r.reason] || 0) + 1;
    t.last = r;
  });
  const list = Object.values(by).sort((a, b) => b.reporters.size - a.reporters.size || b.n - a.n);
  const headBy = ['相手uid', '相手プレイヤーID', '件数', '通報した人の数', '理由の内訳', '最後に見えていた名前', '自己紹介', 'モンスターの名前', '最後の通報'];
  const linesBy = [headBy.join(',')].concat(list.map(t => [
    t.uid, t.playerId, t.n, t.reporters.size,
    Object.keys(t.reasons).map(k => `${REASON[k] || k} ${t.reasons[k]}`).join('・'),
    s(t.last).name, s(t.last).bio, s(t.last).monsters, t.last.at ? new Date(t.last.at).toISOString() : '',
  ].map(esc).join(',')));
  fs.writeFileSync(OUT_BY, '﻿' + linesBy.join('\n'));

  console.log(`ここ${DAYS}日の通報: ${rows.length}件 → ${OUT}`);
  console.log(`相手ごと: ${list.length}人 → ${OUT_BY}`);
  list.slice(0, 20).forEach(t => console.log(`  ${t.playerId || '-'} (${t.uid})  ${t.n}件・${t.reporters.size}人  「${s(t.last).name || ''}」`));
})().catch(e => { console.error(e); process.exit(1); });
