import { useState } from 'react';
import { AlertTriangle, X, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Occupant, Room } from '@shared/schema';

interface ExpiredStayAlertProps {
  occupants: Occupant[];
  rooms: Room[];
  onViewOccupant: (occupantId: string) => void;
}

export function ExpiredStayAlert({ occupants, rooms, onViewOccupant }: ExpiredStayAlertProps) {
  const [isOpen, setIsOpen] = useState(true);

  const expiredOccupants = occupants.filter(occupant => {
    const endDate = new Date(occupant.endDateTime);
    const now = new Date();
    return endDate < now;
  });

  const getRoomName = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.name || 'חדר לא ידוע';
  };

  const getDaysOverdue = (endDateTime: Date | string) => {
    const end = new Date(endDateTime);
    const now = new Date();
    const diffMs = now.getTime() - end.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleViewOccupant = (occupantId: string) => {
    onViewOccupant(occupantId);
  };

  if (expiredOccupants.length === 0 || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl" data-testid="expired-stay-alert-overlay">
      <Card className="w-full max-w-lg bg-white shadow-2xl border-2 border-red-200 animate-in fade-in slide-in-from-top-4 duration-300" data-testid="card-expired-stay-alert">
        <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">התראה: תקופת שהייה הסתיימה</CardTitle>
                <p className="text-red-100 text-sm mt-1">
                  {expiredOccupants.length} מטופלים עם תקופת שהייה שהסתיימה
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
              data-testid="button-close-expired-alert"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="max-h-[50vh]">
            <div className="divide-y divide-gray-100">
              {expiredOccupants.map((occupant) => {
                const daysOverdue = getDaysOverdue(occupant.endDateTime);
                return (
                  <div
                    key={occupant.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                    data-testid={`row-expired-occupant-${occupant.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                          <User className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900" data-testid={`text-expired-name-${occupant.id}`}>{occupant.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{getRoomName(occupant.roomId)}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {daysOverdue === 0 ? 'הסתיים היום' : 
                                 daysOverdue === 1 ? 'הסתיים אתמול' : 
                                 `לפני ${daysOverdue} ימים`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="destructive" 
                          className="bg-red-100 text-red-700 border-red-200"
                        >
                          {daysOverdue === 0 ? 'היום' : `+${daysOverdue} ימים`}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleViewOccupant(occupant.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid={`button-view-expired-${occupant.id}`}
                      >
                        צפה בפרטים
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-500 text-center">
              ניתן לעדכן את תאריך העזיבה דרך פרטי המטופל
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
