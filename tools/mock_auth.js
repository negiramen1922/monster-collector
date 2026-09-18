/* テスト用の偽サインインバックエンド。

   本番の Firebase を使わずに、タイトル画面・自動ログイン・引き継ぎ・端末間同期の流れを
   検証するために、playwright の add_init_script で読み込む。
   「クラウド」は localStorage の __mockCloud に置き、操作のたびに読み書きする
   (テスト側が別端末の更新を差し込めるように、メモリに抱え込まない)。
   別端末のシミュレーションでは、テストがその中身を次のブラウザコンテキストへ渡す。 */
(() => {
  const CLOUD_KEY = '__mockCloud';
  const SESSION_KEY = '__mockSession';
  const EMPTY = { users: {}, saves: {}, players: {}, ids: {} };

  const readCloud = () => {
    try{ return JSON.parse(localStorage.getItem(CLOUD_KEY)) || { ...EMPTY }; }
    catch(e){ return { ...EMPTY }; }
  };
  const writeCloud = c => { try{ localStorage.setItem(CLOUD_KEY, JSON.stringify(c)); }catch(e){} };
  const edit = fn => { const c = readCloud(); const out = fn(c); writeCloud(c); return out; };
  if(window.__mockCloudSeed) writeCloud(window.__mockCloudSeed);
  window.__mockCloud = readCloud;
  window.__events = [];

  const session = {
    get(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null; } },
    set(u){ try{ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }catch(e){} return u; },
    clear(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} },
  };
  const err = code => Object.assign(new Error(code), { code });
  const uidFor = email => 'mock-' + String(email || '').replace(/[^a-z0-9]/gi, '');

  window.__authBackend = {
    kind: 'mock',
    async restore(){ return session.get(); },
    async guest(){
      return session.set({ uid: 'mock-guest-' + Math.random().toString(36).slice(2, 8), isAnonymous: true, providerData: [] });
    },
    async google(){
      const u = { uid: 'mock-google-user', email: 'tamer@example.com', displayName: 'グーグル太郎',
                  isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
      edit(c => { c.users[u.uid] = { provider: 'google' }; });
      return session.set(u);
    },
    async emailSignUp(email, password){
      if(!email) throw err('auth/missing-email');
      if(!password || password.length < 6) throw err('auth/weak-password');
      const uid = uidFor(email);
      if(readCloud().users[uid]) throw err('auth/email-already-in-use');
      edit(c => { c.users[uid] = { password, email }; });
      return session.set({ uid, email, isAnonymous: false, providerData: [{ providerId: 'password' }] });
    },
    async emailSignIn(email, password){
      const rec = readCloud().users[uidFor(email)];
      if(!rec) throw err('auth/user-not-found');
      if(rec.password !== password) throw err('auth/invalid-credential');
      // an address created by linking points back at the account it was linked to
      const uid = rec.alias || uidFor(email);
      return session.set({ uid, email, isAnonymous: false, providerData: [{ providerId: 'password' }] });
    },
    async resetPassword(email){ if(!readCloud().users[uidFor(email)]) throw err('auth/user-not-found'); },
    async linkGoogle(){
      const cur = session.get();
      edit(c => { c.users[cur.uid] = { provider: 'google' }; });
      return session.set({ ...cur, isAnonymous: false, email: 'tamer@example.com', displayName: 'グーグル太郎',
                           providerData: [{ providerId: 'google.com' }] });
    },
    async linkEmail(email, password){
      const cur = session.get();
      if(!password || password.length < 6) throw err('auth/weak-password');
      edit(c => { c.users[uidFor(email)] = { password, email, alias: cur.uid }; });   // linking keeps the uid
      return session.set({ ...cur, isAnonymous: false, email, providerData: [{ providerId: 'password' }] });
    },
    async signOut(){ session.clear(); },
    // アナリティクス: テストから中身を見られるように溜めるだけ
    logEvent(name, params){ window.__events.push([name, params || {}]); },
    setUser(uid, props){ window.__gaUser = [uid, props]; },
    async cloudLoad(uid){ return readCloud().saves[uid] || null; },
    async cloudSave(uid, payload, baseAt){
      return edit(c => {
        const remoteAt = (c.saves[uid] && c.saves[uid].savedAt) || 0;
        if(remoteAt > (baseAt || 0)) return false;      // 別端末の方が新しい
        c.saves[uid] = payload;
        return true;
      });
    },
    async cloudProfile(uid, profile){ edit(c => { c.players[uid] = { ...(c.players[uid] || {}), ...profile }; }); },
    async claimPlayerId(code, uid){
      return edit(c => {
        if(c.ids[code] && c.ids[code] !== uid) return false;
        c.ids[code] = uid;
        return true;
      });
    },
  };
})();
