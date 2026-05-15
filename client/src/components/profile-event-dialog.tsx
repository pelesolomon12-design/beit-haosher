import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar,
  MapPin, 
  User,
  Edit3,
  X,
  Clock,
  UserCheck,
  UserX,
  LogOut,
  LogIn,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { createJerusalemDate } from '@/lib/utils';

interface ProfileEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventData: {
    eventType: 'admission' | 'discharge' | 'exit-start' | 'exit-end' | 'consultation';
    occupantId: string;
    occupantName: string;
    roomId: string;
    eventDate: string;
  } | null;
  roomName?: string;
  onEditPatient: (occupantId: string) => void;
}

export function ProfileEventDialog({ 
  isOpen, 
  onClose, 
  eventData,
  roomName,
  onEditPatient 
}: ProfileEventDialogProps) {
  if (!eventData) return null;

  // Event type configurations
  const eventTypeConfig = {
    admission: {
      title: 'קליטה',
      icon: UserCheck,
      color: 'bg-green-100 text-green-800 border-green-200',
      bgColor: 'bg-green-50',
      description: 'הצטרפות למרכז השיקום'
    },
    discharge: {
      title: 'שחרור מתוכנן',
      icon: UserX,
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      bgColor: 'bg-orange-50',
      description: 'יציאה מתוכננת מהמרכז'
    },
    'exit-start': {
      title: 'יציאה זמנית',
      icon: LogOut,
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      bgColor: 'bg-purple-50',
      description: 'התחלת יציאה זמנית'
    },
    'exit-end': {
      title: 'חזרה מיציאה זמנית',
      icon: LogIn,
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      bgColor: 'bg-blue-50',
      description: 'סיום יציאה זמנית וחזרה למרכז'
    },
    consultation: {
      title: 'ייעוץ פרטי',
      icon: MessageSquare,
      color: 'bg-teal-100 text-teal-800 border-teal-200',
      bgColor: 'bg-teal-50',
      description: 'שיחה טיפולית פרטנית'
    }
  };

  const config = eventTypeConfig[eventData.eventType];
  const IconComponent = config.icon;

  const formatEventDate = (dateString: string) => {
    try {
      // Use Jerusalem timezone-aware date creation to prevent day shifts
      const date = createJerusalemDate(dateString);
      return format(date, 'dd/MM/yyyy', { locale: he });
    } catch {
      return dateString;
    }
  };

  const handleEditClick = () => {
    onEditPatient(eventData.occupantId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="pb-3 sm:pb-4">
          <DialogTitle className="text-right text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${config.bgColor} border-2 ${config.color.replace('text', 'border').replace('bg', 'border')}`}>
              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            פרטי אירוע פרופיל
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Event Type Badge */}
          <div className="flex justify-center">
            <Badge className={`${config.color} px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium`}>
              {config.title}
            </Badge>
          </div>

          {/* Event Information Card */}
          <Card className={`${config.bgColor} border-2 ${config.color.replace('text', 'border').replace('bg', 'border')}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-2.5 sm:space-y-3">
                {/* Patient Name */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                    <span className="text-xs sm:text-sm text-gray-600 font-medium">שם המטופל:</span>
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-gray-900" data-testid="text-patient-name">
                    {eventData.occupantName}
                  </span>
                </div>

                {/* Room Information */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                    <span className="text-xs sm:text-sm text-gray-600 font-medium">חדר:</span>
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-gray-900" data-testid="text-room-name">
                    {roomName || eventData.roomId}
                  </span>
                </div>

                {/* Event Date */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                    <span className="text-xs sm:text-sm text-gray-600 font-medium">תאריך:</span>
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-gray-900" data-testid="text-event-date">
                    {formatEventDate(eventData.eventDate)}
                  </span>
                </div>

                {/* Event Description */}
                <div className="border-t pt-2.5 sm:pt-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                    <span className="text-xs sm:text-sm text-gray-600 font-medium">תיאור:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 bg-white/70 p-2 rounded text-right leading-relaxed">
                    {config.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-3 sm:pt-4">
          <Button
            onClick={handleEditClick}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2.5 sm:py-2 text-sm sm:text-base min-h-[44px] order-2 sm:order-1 w-full sm:w-auto"
            data-testid="button-edit-patient"
          >
            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="font-medium">ערוך פרטי מטופל</span>
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-2 text-sm sm:text-base min-h-[44px] order-1 sm:order-2 w-full sm:w-auto"
            data-testid="button-close-dialog"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="font-medium">סגור</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}