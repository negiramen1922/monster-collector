"""テスト用の簡易HTTPサーバ。

`file://` では fetch がブロックされ、BGMが要素再生のフォールバックに落ちるため、
BGMまで含めて本番と同じ経路で確認したいスクリプトはこれ経由で開く。
GAME_HTML を指定した場合はそのファイルを `file://` で開く(サーバは立てない)。
"""
import contextlib, functools, http.server, os, pathlib, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@contextlib.contextmanager
def serve(root=ROOT, page='index.html'):
    handler = functools.partial(_Quiet, directory=str(root))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        yield f'http://127.0.0.1:{srv.server_address[1]}/{page}'
    finally:
        srv.shutdown()
        srv.server_close()


@contextlib.contextmanager
def game_url(http=True):
    """開く対象のURL。既定はローカルサーバ経由、http=False なら file://。

    対象のHTMLは GAME_HTML 環境変数で差し替えられる(既定はリポジトリ直下の index.html)。
    """
    target = pathlib.Path(os.environ.get('GAME_HTML', ROOT / 'index.html')).resolve()
    if not http:
        yield 'file://' + str(target)
        return
    with serve(root=target.parent, page=target.name) as url:
        yield url


MOCK_AUTH = (pathlib.Path(__file__).resolve().parent / 'mock_auth.js').read_text(encoding='utf-8')


async def use_mock_auth(pg):
    """本番のFirebaseに触らずにログインできるよう、偽バックエンドを仕込む(goto の前に呼ぶ)。"""
    await pg.add_init_script(MOCK_AUTH)


async def start_as_guest(pg, wait=900):
    """タイトル画面が出ていればゲストで開始して、ゲーム画面まで進める。"""
    if await pg.evaluate("() => !!document.getElementById('title')"):
        await pg.click('[data-auth="guest"]')
        await pg.wait_for_timeout(wait)
