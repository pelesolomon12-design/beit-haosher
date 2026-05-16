import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import logoPath from "@/assets/beit-haosher-logo.png";
import "./inventory-login.css";

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

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
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) return;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enteredPassword, subscription: subscription.toJSON() }),
      });
    } catch {}
  };

  const handleLogin = async () => {
    if (!password) {
      toast({ title: "שגיאה", description: "יש להזין סיסמה", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    // Cash flow password
    if (password === "4573") {
      try {
        const response = await fetch("/api/cashflow/auth", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (response.ok) { setPassword(""); setLocation("/cashflow"); return; }
        else toast({ title: "שגיאה", description: "סיסמה שגויה", variant: "destructive" });
      } catch {
        toast({ title: "שגיאה", description: "שגיאה בהתחברות", variant: "destructive" });
      } finally { setIsLoading(false); }
      return;
    }

    try {
      const response = await fetch("/api/inventory/auth", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, mode: "full" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");
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
      const response = await fetch("/api/inventory/auth-shortages", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");
      setLocation("/shopping-list");
    } catch (error: any) {
      toast({ title: "שגיאת התחברות", description: error.message || "שגיאה בכניסה לרשימת קניות", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const handleFaceIdLogin = async () => {
    setIsLoading(true);
    try {
      const optionsRes = await fetch('/api/webauthn/auth-options');
      if (!optionsRes.ok) throw new Error('לא נמצאו אישורי Face ID');
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options, useBrowserAutofill: false });
      const verifyRes = await fetch('/api/webauthn/auth-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) { const err = await verifyRes.json(); throw new Error(err.error || 'אימות נכשל'); }
      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleRegisterFaceId = async () => {
    setIsLoading(true);
    try {
      const optionsRes = await fetch('/api/webauthn/register-options');
      if (!optionsRes.ok) throw new Error('נדרשת הזדהות קודם');
      const options = await optionsRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });
      if (!verifyRes.ok) { const err = await verifyRes.json(); throw new Error(err.error || 'רישום נכשל'); }
      setHasFaceId(true);
      toast({ title: 'Face ID הופעל!', description: 'בפעם הבאה תוכל להיכנס עם Face ID' });
      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      else setLocation('/main');
    } finally { setIsLoading(false); }
  };

  // After password login on mobile — show Face ID registration prompt
  if (isLoggedIn && isMobile && !hasFaceId) {
    return (
      <div className="il-root" dir="rtl">
        <div className="il-bg" aria-hidden="true">
          <span className="il-bubble il-b1"/><span className="il-bubble il-b2"/>
          <span className="il-bubble il-b3"/><span className="il-bubble il-b4"/>
        </div>
        <div className="il-page">
          <div className="il-wrap">
            <div className="il-logo"><img src={logoPath} alt="בית האושר בקהילה"/></div>
            <section className="il-card" aria-label="הפעלת Face ID">
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}><FaceIdIcon /></div>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--navy)' }}>הפעל Face ID</h2>
                <p style={{ color: 'var(--ink-mute)', fontSize: 15, margin: 0 }}>רוצה להיכנס בפעם הבאה עם Face ID במקום סיסמה?</p>
              </div>
              <div className="il-quick">
                <button className="il-qbtn il-qbtn-meds" onClick={handleRegisterFaceId} disabled={isLoading}>
                  <span className="il-qbtn-icon"><FaceIdIcon /></span>
                  <span className="il-qbtn-text">
                    <span className="il-qbtn-title">כן, הפעל Face ID</span>
                  </span>
                </button>
                <button className="il-qbtn" onClick={() => setLocation('/main')} style={{ justifyContent: 'center' }}>
                  <span className="il-qbtn-title" style={{ margin: 0 }}>דלג</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="il-root" dir="rtl">
      {/* Background */}
      <div className="il-bg" aria-hidden="true">
        <span className="il-bubble il-b1"/>
        <span className="il-bubble il-b2"/>
        <span className="il-bubble il-b3"/>
        <span className="il-bubble il-b4"/>
        <svg className="il-wave il-wave-top" viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
          <path d="M0 100 C 240 20, 480 180, 720 100 S 1200 20, 1440 100 L 1440 200 L 0 200 Z" fill="#dceefc"/>
          <path d="M0 130 C 240 60, 480 200, 720 130 S 1200 60, 1440 130 L 1440 200 L 0 200 Z" fill="#cee7f8" opacity="0.55"/>
        </svg>
        <svg className="il-wave il-wave-bottom" viewBox="0 0 1440 200" preserveAspectRatio="none" fill="none">
          <path d="M0 100 C 240 20, 480 180, 720 100 S 1200 20, 1440 100 L 1440 200 L 0 200 Z" fill="#dceefc"/>
          <path d="M0 130 C 240 60, 480 200, 720 130 S 1200 60, 1440 130 L 1440 200 L 0 200 Z" fill="#cee7f8" opacity="0.55"/>
        </svg>
      </div>

      <div className="il-page">
        <div className="il-wrap">

          {/* Logo */}
          <div className="il-logo">
            <img src={logoPath} alt="בית האושר בקהילה"/>
          </div>

          {/* Card */}
          <section className="il-card" aria-label="כניסה למערכת">

            {/* Password field */}
            <label className="il-field">
              <span className="il-field-label">סיסמה</span>
              <span className="il-field-wrap">
                <input
                  className={`il-field-input${isMobile && hasFaceId ? ' has-faceid' : ''}`}
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
                {/* Face ID button — shown on mobile when credentials exist */}
                {isMobile && hasFaceId && (
                  <button className="il-faceid-btn" type="button" onClick={handleFaceIdLogin} disabled={isLoading} aria-label="כניסה עם Face ID">
                    <FaceIdIcon />
                  </button>
                )}
                {/* Enter hint — desktop only via CSS */}
                <span className="il-field-hint">
                  <kbd className="il-kbd">Enter</kbd>
                </span>
              </span>
            </label>

            {/* Divider */}
            <div className="il-divider"><span>או כניסה מהירה</span></div>

            {/* Quick buttons */}
            <div className="il-quick">

              <button
                className="il-qbtn il-qbtn-meds"
                type="button"
                disabled={isLoading}
                data-testid="button-take-medications"
                onClick={() => { sessionStorage.setItem('medication_access', 'distribution'); setLocation("/medications/distribution"); }}
              >
                <span className="il-qbtn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)"/>
                    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
                  </svg>
                </span>
                <span className="il-qbtn-text">
                  <span className="il-qbtn-title">לקיחת תרופות</span>
                  <span className="il-qbtn-sub">סימון תרופות שנלקחו</span>
                </span>
                <span className="il-qbtn-arrow"><ArrowIcon /></span>
              </button>

              <button
                className="il-qbtn il-qbtn-patshop"
                type="button"
                disabled={isLoading}
                data-testid="button-patient-shopping-guest"
                onClick={() => { sessionStorage.setItem('patient_shopping_mode', 'guest'); setLocation("/patient-shopping"); }}
              >
                <span className="il-qbtn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 7h12l-1 13a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z"/>
                    <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
                  </svg>
                </span>
                <span className="il-qbtn-text">
                  <span className="il-qbtn-title">קניות למטופלים</span>
                  <span className="il-qbtn-sub">צפייה ברשימות קניות</span>
                </span>
                <span className="il-qbtn-arrow"><ArrowIcon /></span>
              </button>

              <button
                className="il-qbtn"
                type="button"
                disabled={isLoading}
                data-testid="button-shopping-only"
                onClick={handleShoppingListOnly}
              >
                <span className="il-qbtn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="20" r="1.4"/>
                    <circle cx="17" cy="20" r="1.4"/>
                    <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6"/>
                  </svg>
                </span>
                <span className="il-qbtn-text">
                  <span className="il-qbtn-title">צריך לקנות</span>
                  <span className="il-qbtn-sub">כניסה לרשימת קניות</span>
                </span>
                <span className="il-qbtn-arrow"><ArrowIcon /></span>
              </button>

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
