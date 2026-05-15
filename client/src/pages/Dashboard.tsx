import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Calendar, 
  CalendarDays, 
  ShoppingCart, 
  Pill, 
  ClipboardList,
  LogOut
} from "lucide-react";
import logoPath from "@/assets/beit-haosher-logo.png";

interface NavigationCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
  hoverGradient: string;
}

const navigationCards: NavigationCard[] = [
  {
    title: "ניהול חדרים ומטופלים",
    description: "צפייה ועריכת תפוסת החדרים והמטופלים",
    icon: <Home className="h-8 w-8" />,
    path: "/rooms",
    gradient: "from-blue-500 to-blue-600",
    hoverGradient: "hover:from-blue-600 hover:to-blue-700",
  },
  {
    title: "לוח זמנים",
    description: "ניהול אירועים ומשימות יומיות",
    icon: <Calendar className="h-8 w-8" />,
    path: "/calendar",
    gradient: "from-purple-500 to-purple-600",
    hoverGradient: "hover:from-purple-600 hover:to-purple-700",
  },
  {
    title: "לוח משמרות",
    description: "תכנון וצפייה במשמרות השבועיות",
    icon: <CalendarDays className="h-8 w-8" />,
    path: "/weekly-schedule",
    gradient: "from-indigo-500 to-indigo-600",
    hoverGradient: "hover:from-indigo-600 hover:to-indigo-700",
  },
  {
    title: "רשימת קניות",
    description: "צפייה ברשימת הקניות הנדרשת",
    icon: <ShoppingCart className="h-8 w-8" />,
    path: "/shopping-list",
    gradient: "from-orange-500 to-orange-600",
    hoverGradient: "hover:from-orange-600 hover:to-orange-700",
  },
  {
    title: "ניהול תרופות",
    description: "הוספה ועריכת תרופות למטופלים",
    icon: <Pill className="h-8 w-8" />,
    path: "/medications",
    gradient: "from-teal-500 to-teal-600",
    hoverGradient: "hover:from-teal-600 hover:to-teal-700",
  },
  {
    title: "קניות מטופלים",
    description: "רשימות קניות אישיות למטופלים",
    icon: <ClipboardList className="h-8 w-8" />,
    path: "/patient-shopping",
    gradient: "from-pink-500 to-pink-600",
    hoverGradient: "hover:from-pink-600 hover:to-pink-700",
  },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-lg shadow-black/30 border-2 border-white/20">
              <img 
                src={logoPath} 
                alt="בית האושר לוגו"
                className="w-full h-full object-cover"
                data-testid="img-logo"
              />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white" data-testid="text-dashboard-title">
                בית האושר
              </h1>
              <p className="text-slate-400 text-sm sm:text-base" data-testid="text-dashboard-subtitle">
                מערכת ניהול
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            יציאה
          </Button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {navigationCards.map((card, index) => (
            <button
              key={card.path}
              onClick={() => setLocation(card.path)}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} ${card.hoverGradient} p-6 text-right transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/50`}
              data-testid={`card-nav-${card.path.replace(/\//g, '-').slice(1) || 'home'}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="absolute top-0 left-0 w-full h-full bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
              
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              
              <div className="relative z-10">
                <div className="mb-4 p-3 rounded-xl bg-white/20 w-fit backdrop-blur-sm">
                  <div className="text-white">
                    {card.icon}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">
                  {card.title}
                </h3>
                
                <p className="text-white/80 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
              
              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="p-2 rounded-full bg-white/20">
                  <svg className="h-5 w-5 text-white rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
