# 検証ツール

`python3 tools/extract.py` で、リポジトリ直下の `index.html` から `game.js` と `mons.json` を書き出してから使います
(別のHTMLを見る場合は `python3 tools/extract.py path/to/file.html`)。
詳しくは `docs/開発引き継ぎ書_ClaudeCode向け.md` の6章を参照してください。

```bash
python3 tools/extract.py          # game.js と mons.json を生成(.gitignore 済み)
cd tools && node mech19.js        # 以降の node スクリプトは tools/ で実行
```

| ファイル | 内容 |
|---|---|
| harness.js | DOMなしでゲームのJSを動かす土台。`api.run(パーティ, ステージID, レベル, オプション)` |
| crash19.js | 全モンスターで630戦のクラッシュテスト |
| mech19.js / mech22.js / mech54.js | 戦闘の仕組みの検証(70項目) |
| econ26.js | 育成の検証(32項目) |
| sweep27.js | クリアランクと周回の検証(14項目) |
| gimmick28.js | ボスの仕掛けの検証(現在は未使用の機能) |
| check33.js | 全ステージの勝率測定(`N=60 node check33.js`) |
| base54.js | 調整なしの勝率測定(`POWER=1.15 node base54.js`) |
| tune54.js | 調整値の自動探索(`ONLY=q1_01 node tune54.js q1`) |
| dump33.js | 全ステージ構成のMarkdown出力 |
| recruit_sim.js | クリアでモンスターが仲間になるまでの周回数を測る(`N=200 node recruit_sim.js q1_01`) |
| smoke.py | 起動スモークテスト(主要7画面のJSエラー・横スクロールと、BGMの読み込みを確認) |
| auth_test.py | ログイン・プレイヤーID・端末間のデータ引き継ぎの検証(30項目) |
| ux_test.py | 図鑑の絞り込み・並び替えと、詳細画面の操作性の検証(16項目) |
| mock_auth.js | テスト用の偽Firebase(認証とFirestoreの代役)。`window.__authBackend` に入る |
| make_icons.py | 素材のPNGをアイコンに変換して `icon-data` に書き込む(マゼンタ抜き・バッジ除去・96px化) |
| make_branding.py | favicon(64/180)とOGP画像(1200×630)を `assets/` に書き出す |
| _serve.py | 画面テスト用のローカルHTTPサーバ(BGMの `fetch` は `file://` では通らないため) |
| shot*.py | playwrightの画面テスト |
| alpha01_kit_test.js | α0.1: 新キャラ30体のキットと新しい状態異常(麻痺・石化・拘束・混乱・魅了)の回帰テスト(30項目) |
| mission_test.js | デイリー・ウィークリーの追加分と、はじめてガイド2(旧版を終えた人にも続きで出る)の回帰テスト |
| tamer_level_test.js | テイマーのレベルアップでスタミナ+300(さかのぼらない・上限超えはプレゼントボックス)と周回XP |
| abyss_test.js | 深淵回廊(階の作り・持ち越し・チェックポイント・リセット・報酬)とスタミナの実・時渡りの砂 |
| abyss_ui_test.py | 深淵回廊のタブ・戦闘・結果画面の「次の階へ」・アイテムの使用を画面で確かめる |
| share_test.py | ガチャ結果のSNS共有ボタン(結晶+10は1日1回・キャンセルは報酬なし・結果画像の添付・共有シートが無い端末はXの投稿画面) |
| gacha_reveal_ui_test.py | ガチャ演出(タップで割る・まとめて開く・予兆・★5の3段階・スキップ・宝箱の昇格・ピックアップ演出)を画面で確かめる |
| gacha_forecast_test.js | 宝箱の色の予告(本当の結果より上の色にならない・昇格の割合・ピックアップは虹) |
| material_tier_test.js | 育成素材のTierの出方(難易度ごとの上限・ボス/ハードも超えない・帯ごとに全素材・錬金術の先回りは15個→1個・集める場所の案内) |
| item_detail_ui_test.py | アイテム詳細(スキル強化の素材・持ち物から開く・入手手段と移動・選択BOX・元の画面に戻る)を画面で確かめる |
| alchemy_ui_test.py | 錬金術の画面(拠点はボタンだけ・作りたい素材を選ぶと必要な素材とゴールド・個数・先回りは15個→1個・絞り込み)を画面で確かめる |
| nav_back_ui_test.py | 画面の中のボタンで移ったときの「‹ 〇〇に戻る」(編成→図鑑・プロフィール→図鑑・拠点→ショップ、下のメニューでは出ない)を画面で確かめる |
| formation_sets_test.js | 複数編成(編成1〜5): 以前のセーブの移行・切り替え・編成ごとの遺物(同じ編成の中だけ重複不可)・PVPが使う遺物の編成 |
| formation_sets_ui_test.py | 編成画面の「編成1〜5」タブ、ステージ詳細・育成クエストの「使う編成」、遺物を選ぶ画面の説明、PVP編成の遺物の参照先を画面で確かめる |
| rune_test.js | ルーン: レアリティ(サブの数)とTier(数値の桁、最大Ⅹ)、合成(同じ効果・同じTier3つでTier+1、レア度は平均の切り捨て)、編成ごとの装備(同じ編成の中だけ重複不可)、ステータス・BPへの反映、分解・上限、ルーン採掘の出方、PVP防衛への反映と不正値の丸め |
| rune_ui_test.py | キャラ → ルーン の一覧・絞り込み、ルーン詳細(合成・ロック)、キャラ詳細の4枠から装備・付け替え、まとめて分解、育成クエストのルーン採掘(6段階・いっぱいだと出られない)を画面で確かめる |
| social_ui_test.py | フレンド画面(フレンドリスト・追加・おすすめ・フォロワー)と自己紹介を画面で確かめる |
| alpha01_ui_test.py | α0.1: 新キャラ・新遺物を画面で開き、新キャラだけの編成で戦闘を最後まで回す |

## playwright(画面テスト)

```bash
pip install playwright && playwright install chromium
python3 tools/smoke.py
```

- 対象のHTMLは `GAME_HTML` 環境変数で差し替えられます(既定はリポジトリ直下の `index.html`)。
- `smoke.py` と `shot33.py` は `_serve.py` のローカルサーバ経由で開きます(BGMをWebAudioで読むため)。他の `shot*.py` は `file://` のままです。
- 画面テストは `mock_auth.js` を差し込んでゲストで開始します(本番のFirebaseには接続しません)。
- chromium をplaywright経由で入れられない環境では、`CHROMIUM_PATH` に実行ファイルのパスを指定してください
  (例: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome python3 tools/smoke.py`)。

**注意:** 時間のかかる処理(`tune54.js` など)は `setsid nohup ... &` で切り離し、ログをポーリングしてください。
