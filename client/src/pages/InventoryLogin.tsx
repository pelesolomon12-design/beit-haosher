import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import logoPath from "@/assets/beit-haosher-logo.png";

const CSS = `
  .il-scope {
    all: initial;
    display: block;
    font-family: 'Heebo', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .il-scope *, .il-scope *::before, .il-scope *::after {
    box-sizing: border-box;
  }
  .il-scope {
    --navy:        #173a78;
    --navy-deep:   #0f2956;
    --sky:         #2ea8d8;
    --sky-soft:    #cfeaf6;
    --cream-bg:    #f1f8fd;
    --ink:         #14223e;
    --ink-2:       #3a4a68;
    --ink-mute:    #6c7894;
    --rule:        rgba(20,40,80,0.10);
    --rule-strong: rgba(20,40,80,0.18);
    --c-teal-1:    #29b89b;
    --c-teal-2:    #1f8d77;
    --c-magenta-1: #e84ea2;
    --c-magenta-2: #9c39c7;
  }
  .il-scope .page-wrap {
    position: fixed;
    inset: 0;
    min-height: 100vh;
    color: var(--ink);
    background: var(--cream-bg);
    overflow-x: hidden;
    overflow-y: auto;
  }
  .il-scope .bg-scene {
    position: fixed; inset: 0;
    z-index: 0;
    overflow: hidden;
    background:
      radial-gradient(900px 600px at 10% 10%, #e7f3fb 0%, transparent 60%),
      radial-gradient(900px 600px at 90% 90%, #e7f3fb 0%, transparent 60%),
      linear-gradient(180deg, #f5fafe 0%, #e7f1fa 100%);
    pointer-events: none;
  }
  .il-scope .bubble {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(closest-side, #d2e8f4 0%, transparent 70%);
    opacity: 0.7;
  }
  .il-scope .b1 { width: 320px; height: 320px; top: -60px; left: -90px; }
  .il-scope .b2 { width: 220px; height: 220px; top: 18%; right: -60px; }
  .il-scope .b3 { width: 380px; height: 380px; bottom: -120px; right: 12%; opacity: 0.45; }
  .il-scope .b4 { width: 180px; height: 180px; bottom: 18%; left: 8%; opacity: 0.5; }
  .il-scope .wave {
    position: absolute; width: 120%; height: auto;
    opacity: 0.55; pointer-events: none;
  }
  .il-scope .wave-top    { top: -40px;    left: -10%; transform: scaleY(0.7); }
  .il-scope .wave-bottom { bottom: -60px; left: -10%; transform: scaleY(-0.9); }
  .il-scope .page {
    position: relative; z-index: 1;
    min-height: 100vh;
    display: grid; place-items: center;
    padding: 40px 24px 40px;
  }
  .il-scope .wrap {
    width: 100%; max-width: 680px;
    margin: 0 auto;
    display: flex; flex-direction: column;
    align-items: stretch; gap: 40px;
  }
  .il-scope .logo {
    display: flex; justify-content: center;
    margin-top: 8px; margin-bottom: 4px;
  }
  .il-scope .logo img {
    width: 100%; max-width: 560px; height: auto; display: block;
    filter: drop-shadow(0 8px 18px rgba(23,58,120,0.10));
  }
  .il-scope .card {
    background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.42) 100%);
    backdrop-filter: blur(22px) saturate(160%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.55);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.65) inset,
      0 0 0 1px rgba(23,58,120,0.04),
      0 40px 80px -40px rgba(15,41,86,0.28),
      0 16px 32px -24px rgba(15,41,86,0.18);
    border-radius: 32px;
    padding: 44px 44px 40px;
    position: relative;
  }
  .il-scope .card::before {
    content: "";
    position: absolute; inset: 0; border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 30%);
    pointer-events: none;
  }
  .il-scope .field { position: relative; display: block; }
  .il-scope .field-label {
    display: block; padding: 0 4px 10px;
    color: var(--ink-2); font-size: 13px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
  }
  .il-scope .field-wrap { position: relative; }
  .il-scope .field-input {
    width: 100%; padding: 22px 24px;
    font: 500 18px/1.2 'Heebo', sans-serif;
    color: var(--ink);
    background: rgba(255,255,255,0.75);
    border: 1px solid rgba(23,58,120,0.14);
    border-radius: 16px; outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    text-align: right;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
  }
  .il-scope .field-input::placeholder { color: var(--ink-mute); font-weight: 400; }
  .il-scope .field-input:focus {
    border-color: var(--navy); background: #fff;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 0 0 4px rgba(23,58,120,0.12);
  }
  .il-scope .field-input.has-faceid { padding-left: 64px; }
  .il-scope .faceid-btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    left: 8px; width: 46px; height: 46px;
    border-radius: 12px; border: 1px solid rgba(23,58,120,0.16);
    background: linear-gradient(160deg, #ffffff 0%, #eef5fc 100%);
    color: var(--navy);
    display: grid; place-items: center;
    cursor: pointer;
    transition: transform 0.18s ease, background 0.18s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 12px -6px rgba(23,58,120,0.22);
  }
  .il-scope .faceid-btn:active {
    transform: translateY(-50%) scale(0.94);
    background: var(--navy); color: #fff;
  }
  .il-scope .faceid-btn svg { width: 26px; height: 26px; stroke-width: 1.7; display: block; }
  .il-scope .field-affix {
    position: absolute; top: 50%; left: 14px; transform: translateY(-50%);
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--ink-mute); font-size: 11px;
    letter-spacing: 0.06em; font-weight: 500; pointer-events: none;
  }
  .il-scope .kbd {
    display: inline-grid; place-items: center;
    min-width: 34px; height: 24px; padding: 0 8px;
    border-radius: 6px;
    background: linear-gradient(180deg, #ffffff 0%, #f0f4fa 100%);
    border: 1px solid var(--rule-strong);
    box-shadow: 0 1px 0 #fff inset, 0 1.5px 0 rgba(20,40,80,0.07);
    font: 600 11px/1 'Heebo', sans-serif;
    color: var(--ink-2); letter-spacing: 0;
  }
  .il-scope .divider {
    display: flex; align-items: center; gap: 16px;
    margin: 30px 0 22px;
    color: var(--ink-mute); font-size: 12px;
    letter-spacing: 0.24em; text-transform: uppercase; font-weight: 500;
  }
  .il-scope .divider::before, .il-scope .divider::after {
    content: ""; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(23,58,120,0.18), transparent);
  }
  .il-scope .quick { display: flex; flex-direction: column; gap: 14px; }
  .il-scope .qbtn {
    --bg-1: rgba(255,255,255,0.78);
    --bg-2: rgba(255,255,255,0.55);
    --fg:   var(--navy);
    --sub:  var(--ink-mute);
    --icon-bg: var(--sky-soft);
    --icon-fg: var(--navy);
    --border: rgba(23,58,120,0.12);
    display: flex; align-items: center; gap: 18px;
    width: 100%; padding: 20px 22px;
    background: linear-gradient(160deg, var(--bg-1) 0%, var(--bg-2) 100%);
    border: 1px solid var(--border); border-radius: 18px;
    cursor: pointer; text-align: right;
    transition: transform 0.18s ease, box-shadow 0.2s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
    position: relative; overflow: hidden;
    font-family: 'Heebo', sans-serif; color: var(--fg);
  }
  .il-scope .qbtn:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 14px 24px -16px rgba(23,58,120,0.25);
  }
  .il-scope .qbtn:active { transform: scale(0.985); }
  .il-scope .qbtn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .il-scope .qbtn-icon {
    flex: 0 0 auto; width: 56px; height: 56px;
    border-radius: 16px; display: grid; place-items: center;
    background: var(--icon-bg); color: var(--icon-fg);
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 14px -6px rgba(23,58,120,0.22);
  }
  .il-scope .qbtn-icon svg { width: 28px; height: 28px; stroke-width: 1.9; display: block; }
  .il-scope .qbtn-text { flex: 1; min-width: 0; text-align: right; }
  .il-scope .qbtn-title {
    font-weight: 700; font-size: 20px; line-height: 1.15;
    color: var(--fg); margin: 0 0 4px; display: block;
  }
  .il-scope .qbtn-sub {
    font-weight: 400; font-size: 14.5px;
    color: var(--sub); margin: 0; display: block;
  }
  .il-scope .qbtn-meds {
    --bg-1: var(--c-teal-1); --bg-2: var(--c-teal-2);
    --fg: #ffffff; --sub: rgba(255,255,255,0.82);
    --icon-bg: rgba(255,255,255,0.20); --icon-fg: #ffffff;
    --border: rgba(255,255,255,0.18); color: #fff;
    box-shadow: 0 1px 0 rgba(255,255,255,0.28) inset, 0 12px 24px -14px rgba(31,141,119,0.55);
  }
  .il-scope .qbtn-meds:hover {
    box-shadow: 0 1px 0 rgba(255,255,255,0.28) inset, 0 18px 28px -14px rgba(31,141,119,0.65);
  }
  .il-scope .qbtn-patshop {
    --bg-1: var(--c-magenta-1); --bg-2: var(--c-magenta-2);
    --fg: #ffffff; --sub: rgba(255,255,255,0.85);
    --icon-bg: rgba(255,255,255,0.20); --icon-fg: #ffffff;
    --border: rgba(255,255,255,0.18); color: #fff;
    box-shadow: 0 1px 0 rgba(255,255,255,0.28) inset, 0 12px 24px -14px rgba(156,57,199,0.55);
  }
  .il-scope .qbtn-patshop:hover {
    box-shadow: 0 1px 0 rgba(255,255,255,0.28) inset, 0 18px 28px -14px rgba(156,57,199,0.65);
  }
  @media (max-width: 520px) {
    .il-scope .page  { padding: 20px 16px; }
    .il-scope .wrap  { gap: 24px; }
    .il-scope .card  { padding: 24px 20px 22px; border-radius: 22px; }
    .il-scope .logo img { max-width: 300px; }
    .il-scope .field-input { padding: 18px 18px 18px 64px; font-size: 16px; border-radius: 14px; }
    .il-scope .field-label { font-size: 12px; padding-bottom: 8px; }
    .il-scope .field-affix { display: none; }
    .il-scope .divider { margin: 22px 0 16px; font-size: 11px; }
    .il-scope .quick { gap: 12px; }
    .il-scope .qbtn  { padding: 14px; gap: 12px; border-radius: 14px; }
    .il-scope .qbtn-icon { width: 46px; height: 46px; border-radius: 13px; }
    .il-scope .qbtn-icon svg { width: 22px; height: 22px; }
    .il-scope .qbtn-title { font-size: 16px; }
    .il-scope .qbtn-sub   { font-size: 12.5px; }
  }
  @media (min-width: 521px) {
    .il-scope .faceid-btn { display: none; }
    .il-scope .field-input { padding-left: 24px !important; }
  }
`;

const FaceIdIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 10 V7 a2 2 0 0 1 2 -2 h3"/>
    <path d="M22 5 h3 a2 2 0 0 1 2 2 v3"/>
    <path d="M27 22 v3 a2 2 0 0 1 -2 2 h-3"/>
    <path d="M10 27 h-3 a2 2 0 0 1 -2 -2 v-3"/>
    <line x1="12" y1="13" x2="12" y2="15.5"/>
    <line x1="20" y1="13" x2="20" y2="15.5"/>
    <path d="M16 13 V17 h-1.5"/>
    <path d="M12.5 20.5 c1.2 1.2 2.4 1.8 3.5 1.8 s2.3 -0.6 3.5 -1.8"/>
  </svg>
);

export default function InventoryLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasFaceId, setHasFaceId] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const hasLoggedInBefore = localStorage.getItem('hasLoggedInWithPassword') === 'true';
    if (hasLoggedInBefore) {
      fetch('/api/webauthn/has-credentials')
        .then(r => r.json())
        .then(d => setHasFaceId(d.hasCredentials))
        .catch(() => {});
    }
  }, []);

  const subscribeToNotifications = async (enteredPassword: string) => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.ready;
      if (await reg.pushManager.getSubscription()) return;
      if (await Notification.requestPermission() !== 'granted') return;
      const { publicKey } = await (await fetch('/api/push/vapid-public-key')).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enteredPassword, subscription: sub.toJSON() }),
      });
    } catch {}
  };

  const handleLogin = async () => {
    if (!password) {
      toast({ title: "שגיאה", description: "יש להזין סיסמה", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    if (password === "4573") {
      try {
        const r = await fetch("/api/cashflow/auth", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        if (r.ok) { setPassword(""); setLocation("/cashflow"); return; }
        toast({ title: "שגיאה", description: "סיסמה שגויה", variant: "destructive" });
      } catch { toast({ title: "שגיאה", description: "שגיאה בהתחברות", variant: "destructive" }); }
      finally { setIsLoading(false); }
      return;
    }
    try {
      const r = await fetch("/api/inventory/auth", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, mode: "full" }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Authentication failed");
      if (data.enableNotifications) subscribeToNotifications("1913");
      localStorage.setItem('hasLoggedInWithPassword', 'true');
      if (isMobile && !hasFaceId) { setIsLoggedIn(true); return; }
      setLocation("/main");
    } catch (error: any) {
      toast({ title: "שגיאת התחברות", description: error.message || "סיסמה שגויה", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleShoppingListOnly = async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/inventory/auth-shortages", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Authentication failed");
      setLocation("/shopping-list");
    } catch (error: any) {
      toast({ title: "שגיאת התחברות", description: error.message || "שגיאה", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleFaceIdLogin = async () => {
    setIsLoading(true);
    try {
      const optRes = await fetch('/api/webauthn/auth-options');
      if (!optRes.ok) throw new Error('לא נמצאו אישורי Face ID');
      const assertion = await startAuthentication({ optionsJSON: await optRes.json(), useBrowserAutofill: false });
      const verRes = await fetch('/api/webauthn/auth-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assertion) });
      if (!verRes.ok) { const e = await verRes.json(); throw new Error(e.error || 'אימות נכשל'); }
      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleRegisterFaceId = async () => {
    setIsLoading(true);
    try {
      const optRes = await fetch('/api/webauthn/register-options');
      if (!optRes.ok) throw new Error('נדרשת הזדהות קודם');
      const attResp = await startRegistration({ optionsJSON: await optRes.json() });
      const verRes = await fetch('/api/webauthn/register-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attResp) });
      if (!verRes.ok) { const e = await verRes.json(); throw new Error(e.error || 'רישום נכשל'); }
      setHasFaceId(true);
      toast({ title: 'Face ID הופעל!' });
      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      else setLocation('/main');
    } finally { setIsLoading(false); }
  };

  if (isLoggedIn && isMobile && !hasFaceId) {
    return (
      <div className="il-scope" dir="rtl">
        <style>{CSS}</style>
        <div className="page-wrap">
          <div className="bg-scene" aria-hidden="true">
            <span className="bubble b1"/><span className="bubble b2"/>
            <span className="bubble b3"/><span className="bubble b4"/>
          </div>
          <div className="page">
            <div className="wrap">
              <div className="logo"><img src={logoPath} alt="בית האושר בקהילה"/></div>
              <section className="card">
                <div style={{ textAlign:'center', marginBottom:28 }}>
                  <h2 style={{ fontSize:22, fontWeight:700, margin:'0 0 8px', color:'#173a78', fontFamily:'Heebo,sans-serif' }}>הפעל Face ID</h2>
                  <p style={{ color:'#6c7894', fontSize:15, margin:0, fontFamily:'Heebo,sans-serif' }}>רוצה להיכנס בפעם הבאה עם Face ID?</p>
                </div>
                <div className="quick">
                  <button className="qbtn qbtn-meds" onClick={handleRegisterFaceId} disabled={isLoading}>
                    <span className="qbtn-icon"><FaceIdIcon /></span>
                    <span className="qbtn-text">
                      <span className="qbtn-title">כן, הפעל Face ID</span>
                    </span>
                  </button>
                  <button className="qbtn" onClick={() => setLocation('/main')} style={{ justifyContent:'center' }}>
                    <span className="qbtn-title" style={{ margin:0 }}>דלג</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="il-scope" dir="rtl">
      <style>{CSS}</style>
      <div className="page-wrap">
        <div className="bg-scene" aria-hidden="true">
          <span className="bubble b1"/>
          <span className="bubble b2"/>
          <span className="bubble b3"/>
          <span className="bubble b4"/>
          <svg className="wave wave-top" viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
            <path d="M0 100 C 240 20, 480 180, 720 100 S 1200 20, 1440 100 L 1440 200 L 0 200 Z" fill="#dceefc"/>
            <path d="M0 130 C 240 60, 480 200, 720 130 S 1200 60, 1440 130 L 1440 200 L 0 200 Z" fill="#cee7f8" opacity="0.55"/>
          </svg>
          <svg className="wave wave-bottom" viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
            <path d="M0 100 C 240 20, 480 180, 720 100 S 1200 20, 1440 100 L 1440 200 L 0 200 Z" fill="#dceefc"/>
            <path d="M0 130 C 240 60, 480 200, 720 130 S 1200 60, 1440 130 L 1440 200 L 0 200 Z" fill="#cee7f8" opacity="0.55"/>
          </svg>
        </div>

        <div className="page">
          <div className="wrap">
            <div className="logo">
              <img src={logoPath} alt="בית האושר בקהילה"/>
            </div>

            <section className="card" aria-label="כניסה למערכת">
              <label className="field">
                <span className="field-label">סיסמה</span>
                <span className="field-wrap">
                  <input
                    className={`field-input${isMobile && hasFaceId ? ' has-faceid' : ''}`}
                    type="password"
                    autoComplete="current-password"
                    placeholder="הזן סיסמה ולחץ Enter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && password && handleLogin()}
                    disabled={isLoading}
                    autoFocus
                    data-testid="input-password"
                  />
                  {isMobile && hasFaceId && (
                    <button className="faceid-btn" type="button" onClick={handleFaceIdLogin} disabled={isLoading} aria-label="כניסה עם Face ID">
                      <FaceIdIcon />
                    </button>
                  )}
                  <span className="field-affix">
                    <kbd className="kbd">Enter</kbd>
                  </span>
                </span>
              </label>

              <div className="divider"><span>או כניסה מהירה</span></div>

              <div className="quick">
                <button className="qbtn qbtn-meds" type="button" disabled={isLoading} data-testid="button-take-medications"
                  onClick={() => { sessionStorage.setItem('medication_access','distribution'); setLocation("/medications/distribution"); }}>
                  <span className="qbtn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)"/>
                      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
                    </svg>
                  </span>
                  <span className="qbtn-text">
                    <span className="qbtn-title">לקיחת תרופות</span>
                    <span className="qbtn-sub">סימון תרופות שנלקחו</span>
                  </span>
                </button>

                <button className="qbtn qbtn-patshop" type="button" disabled={isLoading} data-testid="button-patient-shopping-guest"
                  onClick={() => { sessionStorage.setItem('patient_shopping_mode','guest'); setLocation("/patient-shopping"); }}>
                  <span className="qbtn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 7h12l-1 13a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z"/>
                      <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
                    </svg>
                  </span>
                  <span className="qbtn-text">
                    <span className="qbtn-title">קניות למטופלים</span>
                    <span className="qbtn-sub">צפייה ברשימות קניות</span>
                  </span>
                </button>

                <button className="qbtn" type="button" disabled={isLoading} data-testid="button-shopping-only" onClick={handleShoppingListOnly}>
                  <span className="qbtn-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="20" r="1.4"/>
                      <circle cx="17" cy="20" r="1.4"/>
                      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6"/>
                    </svg>
                  </span>
                  <span className="qbtn-text">
                    <span className="qbtn-title">צריך לקנות</span>
                    <span className="qbtn-sub">כניסה לרשימת קניות</span>
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
