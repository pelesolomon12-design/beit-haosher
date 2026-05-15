import { Home, Search, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BottomNavigationProps {
  activeTab: 'home' | 'explore' | 'progress' | 'profile';
  onNavigate: (tab: 'home' | 'explore' | 'progress' | 'profile') => void;
}

export function BottomNavigation({ activeTab, onNavigate }: BottomNavigationProps) {
  const navItems = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'explore' as const, icon: Search, label: 'Explore' },
    { id: 'progress' as const, icon: TrendingUp, label: 'Progress' },
    { id: 'profile' as const, icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-2 md:hidden">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center space-y-1 p-2 ${
                isActive ? 'text-primary' : 'text-neutral-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
