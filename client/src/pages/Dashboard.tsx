import { useLocation } from "wouter";
import logoPath from "@/assets/logo-square.png";
import "./dashboard.css";

const tiles = [
  {
    id: "shifts",
    path: "/weekly-schedule",
    title: "לוח משמרות",
    sub: "תכנון וצפייה במשמרות השבועיות",
    cta: "פתיחת לוח",
    colorClass: "t-shifts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h2v2H8z"/>
      </svg>
    ),
  },
  {
    id: "calendar",
    path: "/calendar",
    title: "לוח זמנים",
    sub: "ניהול אירועים ומשימות יומיות",
    cta: "פתיחת לוח",
    colorClass: "t-schedule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <circle cx="12" cy="16" r="2.4"/>
        <path d="M12 14.4V16l1.1 1.1"/>
      </svg>
    ),
  },
  {
    id: "rooms",
    path: "/rooms",
    title: "ניהול חדרים ומטופלים",
    sub: "צפייה ועריכת תפוסת החדרים והמטופלים",
    cta: "ניהול",
    colorClass: "t-rooms",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11 L12 4 L21 11 V20 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 Z"/>
        <path d="M9 21 V13 h6 v8"/>
      </svg>
    ),
  },
  {
    id: "patient-shopping",
    path: "/patient-shopping",
    title: "קניות מטופלים",
    sub: "רשימות קניות אישיות למטופלים",
    cta: "רשימות",
    colorClass: "t-personal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="4" width="12" height="18" rx="2"/>
        <path d="M9 4 V3 a1 1 0 0 1 1 -1 h4 a1 1 0 0 1 1 1 v1"/>
        <line x1="9" y1="10" x2="15" y2="10"/>
        <line x1="9" y1="14" x2="15" y2="14"/>
        <line x1="9" y1="18" x2="13" y2="18"/>
      </svg>
    ),
  },
  {
    id: "medications",
    path: "/medications",
    title: "ניהול תרופות",
    sub: "הוספה ועריכת תרופות למטופלים",
    cta: "ניהול",
    colorClass: "t-meds",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)"/>
        <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
      </svg>
    ),
  },
  {
    id: "shopping",
    path: "/shopping-list",
    title: "רשימת קניות",
    sub: "צפייה ברשימת הקניות הנדרשת",
    cta: "צפייה",
    colorClass: "t-shopping",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.4"/>
        <circle cx="17" cy="20" r="1.4"/>
        <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6"/>
      </svg>
    ),
  },
];

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ExitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

export default function Dashboard() {
  const [, setLocation] = useLocation();

  return (
    <div className="db-root" dir="rtl">
      <main className="db-page">

        {/* Header */}
        <header className="db-header">
          <div className="db-brand">
            <div className="db-brand-logo">
              <img src={logoPath} alt="בית האושר" data-testid="img-logo" />
            </div>
            <div className="db-brand-text">
              <h1 className="db-brand-title" data-testid="text-dashboard-title">בית האושר</h1>
              <p className="db-brand-sub" data-testid="text-dashboard-subtitle">מערכת ניהול</p>
            </div>
          </div>

          <button className="db-btn-exit" type="button" onClick={() => setLocation("/")} data-testid="button-logout">
            <ExitIcon />
            <span>יציאה</span>
          </button>
        </header>

        {/* Tiles */}
        <section className="db-grid" aria-label="פעולות מהירות">
          {tiles.map((tile) => (
            <article
              key={tile.id}
              className={`db-tile ${tile.colorClass}`}
              tabIndex={0}
              onClick={() => setLocation(tile.path)}
              onKeyDown={(e) => e.key === "Enter" && setLocation(tile.path)}
              data-testid={`card-nav-${tile.id}`}
            >
              <div className="db-tile-head">
                <div className="db-tile-icon">{tile.icon}</div>
              </div>
              <div className="db-tile-body">
                <h3 className="db-tile-title">{tile.title}</h3>
                <p className="db-tile-sub">{tile.sub}</p>
              </div>
              <span className="db-tile-cta">
                {tile.cta}
                <ChevronLeft />
              </span>
            </article>
          ))}
        </section>

        {/* Footer */}
        <footer className="db-foot">
          <span><span className="db-foot-dot"></span>המערכת פעילה</span>
          <span>בית האושר · גרסה 2.4</span>
        </footer>

      </main>
    </div>
  );
}
