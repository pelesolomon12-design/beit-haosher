import { useState } from 'react';
import { Clock, Users, Plus, Edit, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Room, Occupant } from '@shared/schema';

interface RoomCardProps {
  room: Room;
  occupants: Occupant[];
  onEditOccupant: (occupant: Occupant) => void;
  onDeleteOccupant: (occupantId: string) => void;
  onMoveOccupant?: (occupantId: string, targetRoomId: string) => void;
}

export function RoomCard({ room, occupants, onEditOccupant, onDeleteOccupant, onMoveOccupant }: RoomCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: string }>({});
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate time remaining for each occupant
  const calculateTimeRemaining = (endDateTime: Date): string => {
    const now = new Date();
    const end = new Date(endDateTime);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return 'זמן הסתיים';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} ימים`;
    } else if (hours > 0) {
      return `${hours} שעות`;
    } else {
      return 'פחות משעה';
    }
  };

  // Check if occupant has payment issues
  const hasPaymentIssue = (occupant: Occupant) => {
    // בדיקה אם לא שילם על כמות החודשים שמתוכנן
    // מציג סימן אי תשלום לכל מטופל שלא שילם במלואו, ללא קשר לכמות החודשים או ההסתברות
    const paidMonths = occupant.paidMonths || 0;
    const plannedMonths = occupant.plannedMonths || 1;
    
    return paidMonths < plannedMonths;
  };

  const currentOccupancy = occupants.length;
  const isAtCapacity = currentOccupancy >= room.maxCapacity;
  const capacityColor = isAtCapacity ? 'text-red-600' : currentOccupancy > room.maxCapacity * 0.7 ? 'text-yellow-600' : 'text-green-600';
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const occupantId = e.dataTransfer.getData('occupantId');
    const sourceRoomId = e.dataTransfer.getData('sourceRoomId');
    
    if (occupantId && sourceRoomId && sourceRoomId !== room.id && onMoveOccupant) {
      // Check if room has capacity
      if (occupants.length >= room.maxCapacity) {
        alert(`החדר ${room.name} מלא - לא ניתן להעביר מטופל נוסף`);
        return;
      }
      onMoveOccupant(occupantId, room.id);
    }
  };



  // Special styling for different rooms
  const getCardClassName = () => {
    let baseClass = "h-full shadow-md hover:shadow-lg transition-all duration-200 border relative overflow-hidden";
    
    if (isDragOver) {
      baseClass += " ring-2 ring-blue-400 ring-opacity-75 bg-blue-50";
    }
    
    if (room.name === 'חדר סולו') {
      return baseClass + " border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50";
    } else if (room.isWomenOnly) {
      return baseClass + " border-pink-200 bg-pink-50";
    } else {
      return baseClass + " border-gray-200";
    }
  };

  // Stars pattern component for Solo room
  const StarPattern = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Star className="absolute top-2 right-3 w-3 h-3 text-yellow-400 opacity-60 fill-current" />
      <Star className="absolute top-8 right-8 w-2 h-2 text-amber-500 opacity-40 fill-current" />
      <Star className="absolute top-4 right-16 w-2.5 h-2.5 text-yellow-500 opacity-50 fill-current" />
      <Star className="absolute top-12 right-2 w-2 h-2 text-yellow-400 opacity-45 fill-current" />
      <Star className="absolute bottom-8 right-6 w-3 h-3 text-amber-400 opacity-55 fill-current" />
      <Star className="absolute bottom-4 right-12 w-2 h-2 text-yellow-500 opacity-40 fill-current" />
      <Star className="absolute bottom-16 right-4 w-2.5 h-2.5 text-amber-500 opacity-50 fill-current" />
      <Star className="absolute top-6 left-4 w-2 h-2 text-yellow-400 opacity-45 fill-current" />
      <Star className="absolute bottom-12 left-3 w-2.5 h-2.5 text-amber-400 opacity-50 fill-current" />
      <Star className="absolute top-14 left-8 w-2 h-2 text-yellow-500 opacity-40 fill-current" />
    </div>
  );

  return (
    <Card 
      className={getCardClassName()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {room.name === 'חדר סולו' && <StarPattern />}
      <CardHeader className="pb-2 sm:pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`text-base sm:text-lg font-bold flex items-center gap-1 sm:gap-2 ${
              room.name === 'חדר סולו' ? 'text-amber-800' : 'text-gray-900'
            }`}>
              {room.name}
              {room.name === 'חדר סולו' && <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-current" />}
              {room.isWomenOnly && <Badge variant="secondary" className="bg-pink-100 text-pink-800 text-xs">נשים בלבד</Badge>}
            </CardTitle>
            <p className={`text-xs sm:text-sm mt-1 ${
              room.name === 'חדר סולו' ? 'text-amber-700 font-medium' : 'text-gray-600'
            }`}>
              {room.pricePerBed.toLocaleString()}₪ למיטה
            </p>
          </div>
          <div className="text-left">
            <div className={`text-xl sm:text-2xl font-bold ${capacityColor}`}>
              {currentOccupancy}/{room.maxCapacity}
            </div>
            <div className="flex items-center text-gray-500 text-xs sm:text-sm">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              <span>תפוסה</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 relative z-10">
        <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3 text-right">
          {room.isWomenOnly ? 'פרטי השוהות בחדר' : 'פרטי השוהים בחדר'}
        </h4>
        {occupants.length === 0 ? (
          <div className="text-center py-4 sm:py-6 text-gray-500">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">החדר ריק</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {occupants.map((occupant) => {
              const handleDragStart = (e: React.DragEvent) => {
                e.dataTransfer.setData('occupantId', occupant.id);
                e.dataTransfer.setData('sourceRoomId', room.id);
                e.dataTransfer.effectAllowed = 'move';
              };

              return (
              <div key={occupant.id} 
                draggable
                onDragStart={handleDragStart}
                className={`rounded-lg p-2 sm:p-3 text-right border cursor-move select-none transition-all duration-200 hover:shadow-md ${
                  room.name === 'חדר סולו' 
                    ? 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100' 
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
                title="לחץ וגרור להעברת המטופל לחדר אחר"
              >
                <div className="flex justify-between items-center mb-1 sm:mb-2">
                  <div className="flex items-center gap-2">
                    {hasPaymentIssue(occupant) && (
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" title="טרם שילם על החודשים המתוכננים"></div>
                    )}
                  </div>
                  <div className={`font-medium text-sm sm:text-lg ${
                    room.name === 'חדר סולו' ? 'text-amber-800' : 'text-gray-800'
                  }`}>
                    {occupant.name}
                    {room.name === 'חדר סולו' && <Star className="inline w-2 h-2 sm:w-3 sm:h-3 text-yellow-500 fill-current mr-1" />}
                  </div>
                </div>
                <div className="text-xs sm:text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                      זמן נותר:
                    </span>
                    <span className={`font-medium ${
                      room.name === 'חדר סולו' ? 'text-amber-700' : 'text-orange-600'
                    }`}>
                      {calculateTimeRemaining(occupant.endDateTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">תכנון:</span>
                    <span className={room.name === 'חדר סולו' ? 'text-amber-600' : 'text-gray-700'}>
                      {occupant.plannedMonths === 1 ? 'חודש' : 'חודשים'} {occupant.plannedMonths}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs">תשלום:</span>
                    <div className="flex items-center gap-1">
                      {(occupant.paidMonths || 0) >= (occupant.plannedMonths || 1) ? (
                        <div className="flex items-center text-green-600">
                          <span className="text-xs ml-1">שולם במלואו</span>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-500">
                          <span className="text-xs ml-1">
                            {occupant.paidMonths || 0}/{occupant.plannedMonths || 1}
                          </span>
                          <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  {occupant.isReligious && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">דתיות:</span>
                      <span className="text-gray-700">דתי</span>
                    </div>
                  )}
                  {/* רמת סבירות לשהייה נוסף */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">יישאר לזמן נוסף:</span>
                    <div className="flex items-center">
                      {occupant.stayingProbability === 'בטוח' && (
                        <span className="text-gray-700 text-xs font-bold">
                          בטוח ✓
                        </span>
                      )}
                      {occupant.stayingProbability === 'אולי' && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs font-bold border-yellow-300">
                          אולי ?
                        </Badge>
                      )}
                      {occupant.stayingProbability === 'בטוח שלא' && (
                        <span className="text-gray-700 text-xs font-bold">
                          בטוח שלא ✗
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* סוג התמכרות */}
                  {occupant.addictionType && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">התמכרות:</span>
                      <span className="text-orange-600 font-medium text-xs">
                        {occupant.addictionType}
                      </span>
                    </div>
                  )}

                </div>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>

    </Card>
  );
}