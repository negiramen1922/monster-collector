# 素材の元ファイル

ゲームからは参照していません。加工後のものが `index.html` と `assets/bgm/` に入っています。

| ファイル | 加工後 | 加工内容 |
|---|---|---|
| `PerituneMaterial_*.mp3` | `assets/bgm/{home,battle,boss}.mp3` | モノラル96kbps、末尾のフェードを切ってループの継ぎ目をなくす |
| `icon_*.png` | `index.html` の `icon-data` の `elem_*` | マゼンタ背景を抜き、左上のAIバッジを消し、余白を詰めて96px角(`tools/make_icons.py`) |

BGMの元素材は [Peritune](https://peritune.com/) の素材です。利用規約に沿ってクレジットを表示してください。
