import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Not available, using div instead
import { 
  Plus, 
  Edit3, 
  Clock, 
  User,
  CalendarDays,
  StickyNote,
  X,
  Copy,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { SelectDailyTask, SelectEvent } from '@shared/schema';
import { ProfileEvent } from '@/hooks/use-daily-tasks';

interface DailyTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  tasks: SelectDailyTask[];
  events: SelectEvent[];
  profileEvents: ProfileEvent[];
  onEditTask: (task: SelectDailyTask) => void;
  onEditEvent: (event: SelectEvent) => void;
  onCreateTask: () => void;
  onCreateEvent: () => void;
  onDuplicateSchedule?: () => void;
  onDeleteSchedule?: () => void;
  getOccupantName: (occupantId: string | null) => string;
  isPastDate: boolean;
  isMobile?: boolean;
}

export function DailyTasksDialog({
  open,
  onOpenChange,
  selectedDate,
  tasks,
  events,
  profileEvents,
  onEditTask,
  onEditEvent,
  onCreateTask,
  onCreateEvent,
  onDuplicateSchedule,
  onDeleteSchedule,
  getOccupantName,
  isPastDate,
  isMobile = false
}: DailyTasksDialogProps) {
  if (!selectedDate) return null;

  const dateTitle = format(selectedDate, 'dd/MM/yyyy - EEEE', { locale: he });

  // Helper function to parse time string to minutes for sorting
  const parseTimeToMinutes = (timeString: string | null): number => {
    if (!timeString) return 9999; // Put items without time at the end
    
    try {
      // Clean the time string from RTL/LTR control characters and normalize digits
      let cleanTime = timeString.trim()
        // Remove RTL/LTR control characters
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
        // Normalize Arabic digits (٠-٩) to ASCII (0-9)
        .replace(/[\u0660-\u0669]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0x0660 + 0x30))
        // Normalize Persian digits (۰-۹) to ASCII (0-9)
        .replace(/[\u06F0-\u06F9]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0x06F0 + 0x30))
        // Keep only digits and colons
        .replace(/[^0-9:]/g, '');
      
      // Validate format: HH:MM or H:MM (24-hour format)
      const timeRegex = /^([0-1]?\d|2[0-3]):[0-5]\d$/;
      if (!timeRegex.test(cleanTime)) {
        console.debug('Invalid time format after cleaning:', timeString, '→', cleanTime);
        return 9999;
      }
      
      const [hours, minutes] = cleanTime.split(':').map(Number);
      
      // Double-check for valid numbers
      if (isNaN(hours) || isNaN(minutes)) {
        console.debug('NaN detected in time parsing:', timeString, '→', { hours, minutes });
        return 9999;
      }
      
      const result = hours * 60 + minutes;
      
      // Log normalization if it changed the string
      if (cleanTime !== timeString) {
        console.debug('Time string normalized:', timeString, '→', cleanTime, '→', result);
      }
      
      return result;
    } catch (error) {
      console.debug('Error parsing time:', timeString, error);
      return 9999;
    }
  };

  // Create a unified chronological list of all items
  type CalendarItem = {
    type: 'task' | 'event' | 'profile';
    time: string | null;
    timeInMinutes: number;
    data: any;
    id: string;
  };

  const allItems: CalendarItem[] = [
    // Add tasks
    ...tasks.map(task => ({
      type: 'task' as const,
      time: task.time,
      timeInMinutes: parseTimeToMinutes(task.time),
      data: task,
      id: task.id
    })),
    // Add events
    ...events.map(event => ({
      type: 'event' as const,
      time: event.time,
      timeInMinutes: parseTimeToMinutes(event.time),
      data: event,
      id: event.id
    })),
    // Add profile events (they usually don't have time, so they'll be at the end)
    ...profileEvents.map(event => ({
      type: 'profile' as const,
      time: null, // Profile events typically don't have time
      timeInMinutes: parseTimeToMinutes(null),
      data: event,
      id: event.id
    }))
  ];

  // Sort all items chronologically
  const sortedAllItems = allItems.sort((a, b) => {
    return a.timeInMinutes - b.timeInMinutes;
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 gap-0" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            {dateTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            אירועים ומשימות עבור תאריך {dateTitle}
          </DialogDescription>
          <div className="space-y-2 mt-2">
            {/* Create new buttons - only for non-past dates */}
            {!isPastDate && (
              <div className="flex gap-2">
                <Button
                  onClick={onCreateTask}
                  className="flex-1"
                  variant="default"
                  size="lg"
                  data-testid="button-create-task"
                >
                  <Plus className="h-5 w-5 ml-2" />
                  משימה חדשה
                </Button>
                <Button
                  onClick={onCreateEvent}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  size="lg"
                  data-testid="button-create-event"
                >
                  <Plus className="h-5 w-5 ml-2" />
                  אירוע חדש
                </Button>
              </div>
            )}
            
            {/* Duplicate and Delete buttons - show for mobile when there's content */}
            {isMobile && sortedAllItems.length > 0 && (
              <div className="flex gap-2 w-full">
                {onDuplicateSchedule && (
                  <Button
                    onClick={onDuplicateSchedule}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    size="lg"
                    variant="secondary"
                    data-testid="button-duplicate-schedule"
                  >
                    <Copy className="h-5 w-5 ml-2" />
                    שכפל
                  </Button>
                )}
                {onDeleteSchedule && (
                  <Button
                    onClick={onDeleteSchedule}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    size="lg"
                    variant="secondary"
                    data-testid="button-delete-schedule"
                  >
                    <Trash2 className="h-5 w-5 ml-2" />
                    מחק לוז
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
          {sortedAllItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">אין אירועים ליום זה</p>
              {!isPastDate && (
                <p className="text-sm">
                  לחץ על "משימה חדשה" או "אירוע חדש" כדי להוסיף פריט
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Unified chronological list */}
              <div className="space-y-3">
                {sortedAllItems.map((item, index) => {
                  if (item.type === 'profile') {
                    const event = item.data;
                    return (
                      <Card key={item.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: event.borderColor }}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg leading-tight flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: event.backgroundColor }}
                            />
                            {event.title}
                          </CardTitle>
                          {event.extendedProps.roomId && (
                            <Badge variant="secondary" className="w-fit">
                              חדר: {event.extendedProps.roomId}
                            </Badge>
                          )}
                        </CardHeader>
                      </Card>
                    );
                  }
                  
                  if (item.type === 'event') {
                    const event = item.data;
                    const hasNote = event.note && event.note.trim() !== '';
                    
                    return (
                      <Card key={item.id} className="overflow-hidden border-l-4 border-purple-600">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg leading-tight mb-2 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-600" />
                                {event.name}
                              </CardTitle>
                              
                              <div className="flex flex-wrap gap-2 text-sm">
                                {/* Time Badge */}
                                {event.time && (
                                  <Badge variant="outline" className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.time}
                                  </Badge>
                                )}
                                
                                {/* Note Badge */}
                                {hasNote && (
                                  <Badge variant="outline" className="flex items-center gap-1 text-purple-600 border-purple-200">
                                    <StickyNote className="h-3 w-3" />
                                    יש הערה
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => onEditEvent(event)}
                              className="shrink-0 h-10 w-10"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>

                        {/* Event Note */}
                        {hasNote && (
                          <CardContent className="pt-0">
                            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 border-r-4 border-purple-400">
                              <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                {event.note}
                              </p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  }
                  
                  if (item.type === 'task') {
                    const task = item.data;
                    const hasOccupant = task.occupantId !== null;
                    const occupantName = hasOccupant ? getOccupantName(task.occupantId) : null;
                    const hasNote = task.note && task.note.trim() !== '';

                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg leading-tight mb-2 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-600" />
                                {task.name}
                              </CardTitle>
                              
                              <div className="flex flex-wrap gap-2 text-sm">
                                {/* Time Badge */}
                                {task.time && (
                                  <Badge variant="outline" className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {task.time}
                                  </Badge>
                                )}
                                
                                {/* Occupant Badge */}
                                {hasOccupant && occupantName ? (
                                  <Badge variant="default" className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white">
                                    <User className="h-3 w-3" />
                                    {occupantName}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    כללי
                                  </Badge>
                                )}

                                {/* Note Badge */}
                                {hasNote && (
                                  <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-200">
                                    <StickyNote className="h-3 w-3" />
                                    יש הערה
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => onEditTask(task)}
                              className="shrink-0 h-10 w-10"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>

                        {/* Task Note */}
                        {hasNote && (
                          <CardContent className="pt-0">
                            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border-r-4 border-blue-400">
                              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                {task.note}
                              </p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  }
                  
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}