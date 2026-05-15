import { Users, Clock, UserPlus, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import logoPath from '@/assets/beit-haosher-logo.jpg';
import { RoomManagement } from '@/components/room-management';

import { Room, Occupant } from '@shared/schema';

interface HeaderProps {
  totalOccupants: number;
  totalCapacity: number;
  rooms: Room[];
  occupantsByRoom: { [roomId: string]: Occupant[] };
  onOpenRegistration: () => void;
  onOpenOccupantDetails: () => void;
}

export function Header({ totalOccupants, totalCapacity, rooms, occupantsByRoom, onOpenRegistration, onOpenOccupantDetails }: HeaderProps) {
  const [location, navigate] = useLocation();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200" dir="rtl">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        {/* Mobile Layout */}
        <div className="block sm:hidden">
          {/* Top row - Logo and Stats */}
          <div className="flex justify-between items-center h-14 px-2">
            <Button
              onClick={() => navigate('/main')}
              variant="outline"
              size="sm"
              className="text-slate-700 border-slate-300 hover:bg-slate-50"
              data-testid="button-main-menu"
            >
              <Home className="w-4 h-4 ml-1" />
              תפריט
            </Button>
            
            <img 
              src={logoPath} 
              alt="בית האושר לוגו" 
              className="w-12 h-10 object-contain"
            />
            
            <div className="flex items-center space-x-1 space-x-reverse bg-blue-50 px-2 py-1 rounded">
              <Users className="w-4 h-4 text-blue-600" />
              <div className="text-right">
                <div className="text-sm font-bold text-blue-900">
                  {totalOccupants}/{totalCapacity}
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom row - Action Buttons */}
          <div className="flex justify-center items-center gap-2 pb-3 px-2">
            <Button
              onClick={onOpenOccupantDetails}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 flex-1"
              data-testid="button-occupant-details"
            >
              <Users className="w-4 h-4 ml-2" />
              רשימת מטופלים
            </Button>
            <Button
              onClick={onOpenRegistration}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex-1"
              data-testid="button-registration"
            >
              <UserPlus className="w-4 h-4 ml-2" />
              הוספת מטופל
            </Button>
            <RoomManagement rooms={rooms} occupantsByRoom={occupantsByRoom} />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center h-16 gap-4">
          {/* Right side - Menu Button */}
          <Button
            onClick={() => navigate('/main')}
            variant="outline"
            size="sm"
            className="text-slate-700 border-slate-300 hover:bg-slate-50"
            data-testid="button-main-menu"
          >
            <Home className="w-4 h-4 ml-1" />
            תפריט
          </Button>

          {/* Logo */}
          <div className="flex-1 flex justify-center">
            <img 
              src={logoPath} 
              alt="בית האושר לוגו" 
              className="w-16 h-12 object-contain"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onOpenOccupantDetails}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-occupant-details"
            >
              <Users className="w-4 h-4 ml-1" />
              רשימת מטופלים
            </Button>
            <Button
              onClick={onOpenRegistration}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-registration"
            >
              <UserPlus className="w-4 h-4 ml-1" />
              הוספת מטופל
            </Button>
          </div>
          
          {/* Left side - Stats and Room Management */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-900">
                {totalOccupants}/{totalCapacity}
              </span>
            </div>
            <RoomManagement rooms={rooms} occupantsByRoom={occupantsByRoom} />
          </div>
        </div>
      </div>
    </header>
  );
}
