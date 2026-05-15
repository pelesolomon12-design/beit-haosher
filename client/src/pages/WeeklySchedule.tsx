import { Button } from '@/components/ui/button';
import { Home, CalendarDays } from 'lucide-react';
import { useLocation } from 'wouter';
import { WeeklyScheduleCalendar } from '@/components/weekly-schedule-calendar';

export default function WeeklySchedule() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">לוח משמרות שבועי</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/calendar')}
              data-testid="link-calendar"
            >
              <CalendarDays className="h-4 w-4 ml-1" />
              לוח משימות
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/main')}
              data-testid="link-home"
            >
              <Home className="h-4 w-4 ml-1" />
              ראשי
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-56px)]">
        <WeeklyScheduleCalendar />
      </main>
    </div>
  );
}
