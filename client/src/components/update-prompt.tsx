import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Check for updates every 30 seconds
        setInterval(() => {
          reg.update();
        }, 30000);
        
        // Listen for new service worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                setUpdateAvailable(true);
              }
            });
          }
        });
      });
      
      // Listen for controller change (new SW took control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // If no waiting worker, just reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <Card className="shadow-lg border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3" dir="rtl">
            <div className="p-2 bg-green-100 rounded-lg">
              <RefreshCw className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 text-right">
              <h3 className="font-semibold text-gray-900 mb-1">
                עדכון זמין
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                יש גרסה חדשה של האפליקציה. רענן כדי לקבל את העדכונים החדשים
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdate}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  רענן עכשיו
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                  className="text-gray-600"
                >
                  לא עכשיו
                </Button>
              </div>
            </div>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}