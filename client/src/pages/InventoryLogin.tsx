import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pill, ShoppingBag, ScanFace } from "lucide-react";
const backgroundImageDesktop = "/assets/login-bg.png";
const backgroundImageMobile = "/assets/login-bg.png";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

export default function InventoryLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasFaceId, setHasFaceId] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Show Face ID button only if this device has logged in before AND credentials exist on server
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
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }

      const vapidResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: enteredPassword,
          subscription: subscription.toJSON(),
        }),
      });

      toast({ title: "התראות SOS הופעלו", description: "תקבל התראות על מתן תרופות SOS" });
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      toast({
        title: "שגיאה",
        description: "יש להזין סיסמה",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Check if password is for cash flow
    if (password === "4573") {
      try {
        const response = await fetch("/api/cashflow/auth", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (response.ok) {
          setPassword("");
          setLocation("/cashflow");
          return;
        } else {
          toast({ title: "שגיאה", description: "סיסמה שגויה", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "שגיאה", description: "שגיאה בהתחברות", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await fetch("/api/inventory/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, mode: "full" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (data.enableNotifications) {
        subscribeToNotifications("1913");
      }

      // Mark that this device has logged in with password
      localStorage.setItem('hasLoggedInWithPassword', 'true');

      // On mobile without Face ID - show registration option before navigating
      if (isMobile && !hasFaceId) {
        setIsLoggedIn(true);
        // Navigate after a short delay to allow Face ID registration
        return;
      }

      setLocation("/main");
    } catch (error: any) {
      toast({
        title: "שגיאת התחברות",
        description: error.message || "סיסמה שגויה",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShoppingListOnly = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/inventory/auth-shortages", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setLocation("/shopping-list");
    } catch (error: any) {
      toast({
        title: "שגיאת התחברות",
        description: error.message || "שגיאה בכניסה לרשימת קניות",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password) {
      handleLogin();
    }
  };

  const handleFaceIdLogin = async () => {
    setIsLoading(true);
    try {
      const optionsRes = await fetch('/api/webauthn/auth-options');
      if (!optionsRes.ok) throw new Error('לא נמצאו אישורי Face ID');
      const options = await optionsRes.json();

      const assertion = await startAuthentication({ optionsJSON: options, useBrowserAutofill: false });

      const verifyRes = await fetch('/api/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'אימות נכשל');
      }

      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterFaceId = async () => {
    setIsLoading(true);
    try {
      const optionsRes = await fetch('/api/webauthn/register-options');
      if (!optionsRes.ok) throw new Error('נדרשת הזדהות קודם');
      const options = await optionsRes.json();

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'רישום נכשל');
      }

      setHasFaceId(true);
      toast({ title: 'Face ID הופעל!', description: 'בפעם הבאה תוכל להיכנס עם Face ID' });
      setLocation('/main');
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background Image - Desktop */}
      <div 
        className="hidden md:block absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImageDesktop})`, backgroundColor: '#0a1929' }}
        data-testid="bg-image-desktop"
      />
      {/* Background Image - Mobile */}
      <div 
        className="md:hidden absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImageMobile})`, backgroundColor: '#0a1929' }}
        data-testid="bg-image-mobile"
      />

      
      {/* Content - Logo visible above buttons */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center pb-12 p-4">
        <div className="w-full max-w-md mx-auto space-y-6 mt-auto" style={{ marginTop: 'auto', paddingTop: '55vh' }}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="הזן סיסמה ולחץ Enter"
                className="text-center text-lg bg-white/95 backdrop-blur-sm border-2 border-white/50 h-14 shadow-xl"
                disabled={isLoading}
                data-testid="input-password"
                autoFocus
                dir="rtl"
              />
            </div>

            <Button
              className="w-full h-16 text-lg bg-white/95 hover:bg-white text-slate-900 backdrop-blur-sm border-2 border-white/50 shadow-xl font-bold"
              onClick={handleShoppingListOnly}
              disabled={isLoading}
              data-testid="button-shopping-only"
            >
              <div className="text-center">
                <div className="font-bold">צריך לקנות בלבד</div>
                <div className="text-sm opacity-70">כניסה לרשימת קניות בלבד</div>
              </div>
            </Button>

            <Button
              className="w-full h-16 text-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white backdrop-blur-sm border-2 border-white/30 shadow-xl font-bold"
              onClick={() => {
                sessionStorage.setItem('medication_access', 'distribution');
                setLocation("/medications/distribution");
              }}
              disabled={isLoading}
              data-testid="button-take-medications"
            >
              <div className="flex items-center justify-center gap-3">
                <Pill className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-bold">לקיחת תרופות</div>
                  <div className="text-sm opacity-80">סימון תרופות שנלקחו</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full h-16 text-lg bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white backdrop-blur-sm border-2 border-white/30 shadow-xl font-bold"
              onClick={() => {
                sessionStorage.setItem('patient_shopping_mode', 'guest');
                setLocation("/patient-shopping");
              }}
              disabled={isLoading}
              data-testid="button-patient-shopping-guest"
            >
              <div className="flex items-center justify-center gap-3">
                <ShoppingBag className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-bold">קניות למטופלים</div>
                  <div className="text-sm opacity-80">צפייה ברשימות קניות</div>
                </div>
              </div>
            </Button>

            {/* Face ID login button - shown on mobile when credentials exist */}
            {isMobile && hasFaceId && (
              <Button
                className="w-full h-16 text-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white backdrop-blur-sm border-2 border-white/30 shadow-xl font-bold"
                onClick={handleFaceIdLogin}
                disabled={isLoading}
              >
                <div className="flex items-center justify-center gap-3">
                  <ScanFace className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-bold">כניסה עם Face ID</div>
                    <div className="text-sm opacity-80">אימות ביומטרי מהיר</div>
                  </div>
                </div>
              </Button>
            )}

            {/* Face ID registration dialog */}
            <Dialog open={isMobile && isLoggedIn && !hasFaceId} onOpenChange={() => setLocation("/main")}>
              <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                    <ScanFace className="h-6 w-6 text-indigo-600" />
                    הפעל Face ID
                  </DialogTitle>
                </DialogHeader>
                <div className="py-2 text-center text-gray-600">
                  רוצה להיכנס בפעם הבאה עם Face ID במקום סיסמה?
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12"
                    onClick={handleRegisterFaceId}
                    disabled={isLoading}
                  >
                    <ScanFace className="h-5 w-5 ml-2" />
                    כן, הפעל Face ID
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setLocation("/main")}
                  >
                    דלג
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </div>

    </div>
  );
}
