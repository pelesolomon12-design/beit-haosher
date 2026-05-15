import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
// Use proper event handler types from the plugins
import type { DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, DatesSetArg, ViewMountArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Calendar as CalendarIcon, 
  CalendarDays,
  ChevronLeft, 
  ChevronRight, 
  Home,
  Plus,
  Clock,
  Grid3x3,
  Columns,
  Loader2,
  CheckCircle,
  FileText,
  Save,
  Edit3,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useDailyTasks, useUpdateDailyTask, useOccupants, transformOccupantsToProfileEvents, ProfileEvent } from '@/hooks/use-daily-tasks';
import { useDailyNote, useCreateOrUpdateDailyNote, useManualSaveDailyNote } from '@/hooks/use-daily-notes';
import { TaskDialog } from '@/components/task-dialog';
import { BulkTaskDialog } from '@/components/bulk-task-dialog';
import { ProfileEventDialog } from '@/components/profile-event-dialog';
import { SelectDailyTask, Room } from '@shared/schema';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatJerusalemDate, getTodayJerusalem, createJerusalemDate, addDaysToJerusalemDate } from '@/lib/utils';

// Task color mapping for visual indicators - Green/Red system for better distinction
const TASK_COLORS = {
  default: { bg: 'hsl(0, 65%, 55%)', border: 'hsl(0, 65%, 50%)' }, // Red for unassigned tasks (בלי דייר)
  withOccupant: { bg: 'hsl(120, 60%, 45%)', border: 'hsl(120, 60%, 40%)' }, // Green for assigned tasks (עם דייר)
  completed: { bg: 'hsl(142, 76%, 36%)', border: 'hsl(142, 76%, 31%)' }, // Darker green for completed tasks
};

export default function Calendar() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [currentTitle, setCurrentTitle] = useState('');
  
  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SelectDailyTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  
  // Bulk task dialog state
  const [bulkTaskDialogOpen, setBulkTaskDialogOpen] = useState(false);
  
  // Profile event dialog state
  const [profileEventDialogOpen, setProfileEventDialogOpen] = useState(false);
  const [selectedProfileEvent, setSelectedProfileEvent] = useState<{
    eventType: 'admission' | 'discharge' | 'exit-start' | 'exit-end' | 'consultation';
    occupantId: string;
    occupantName: string;
    roomId: string;
    eventDate: string;
  } | null>(null);
  
  // Notes state - use Jerusalem date string as source of truth
  const [notesDateString, setNotesDateString] = useState<string>(getTodayJerusalem());
  const [notesContent, setNotesContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesCardRef = useRef<HTMLDivElement>(null);
  
  // Drag and drop functionality now uses immediate save

  // Fetch daily tasks and occupants
  const { data: dailyTasks, isLoading: tasksLoading } = useDailyTasks();
  const { data: occupants = [], isLoading: occupantsLoading } = useOccupants();
  
  // Task update mutation for drag and drop
  const updateTaskMutation = useUpdateDailyTask();
  
  // Get rooms for profile event dialog
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });
  
  // Fetch daily notes for selected date
  const { data: dailyNote, isLoading: noteLoading } = useDailyNote(notesDateString);
  const autoSaveMutation = useCreateOrUpdateDailyNote();
  const manualSaveMutation = useManualSaveDailyNote();

  // Past days and today handling functions
  const isPastDate = useCallback((dateStr: string) => {
    const today = getTodayJerusalem();
    return dateStr < today;
  }, []);

  const isTodayDate = useCallback((dateStr: string) => {
    const today = getTodayJerusalem();
    return dateStr === today;
  }, []);

  // Date allow function - prevent interactions with past dates
  const handleDateAllow = useCallback((dateInfo: any) => {
    const dateStr = formatJerusalemDate(dateInfo.start);
    return !isPastDate(dateStr);
  }, [isPastDate]);

  // Day cell class names for styling past days and today
  const handleDayCellClassNames = useCallback((dateInfo: any) => {
    const dateStr = formatJerusalemDate(dateInfo.date);
    const classes = [];
    
    if (isPastDate(dateStr)) {
      classes.push('fc-past-day');
    } else if (isTodayDate(dateStr)) {
      classes.push('fc-today-highlight');
    }
    
    return classes;
  }, [isPastDate, isTodayDate]);

  // Day cell mount for additional styling
  const handleDayCellDidMount = useCallback((info: any) => {
    const dateStr = formatJerusalemDate(info.date);
    
    if (isPastDate(dateStr)) {
      info.el.style.backgroundColor = 'hsl(220, 13%, 95%)';
      info.el.style.color = 'hsl(220, 8.9%, 70%)';
      info.el.style.cursor = 'not-allowed';
    } else if (isTodayDate(dateStr)) {
      info.el.style.backgroundColor = 'hsl(217, 91%, 97%)';
      info.el.style.borderColor = 'hsl(217, 91%, 60%)';
      info.el.style.borderWidth = '2px';
    }
  }, [isPastDate, isTodayDate]);

  // Handle date click (for adding new tasks and switching notes) - Enhanced with past date blocking
  const handleDateClick = useCallback((info: DateClickArg) => {
    // Use Jerusalem date string directly from FullCalendar (which uses Jerusalem timezone)
    const jerusalemDateString = info.dateStr;
    
    // Block clicks on past dates
    if (isPastDate(jerusalemDateString)) {
      toast({
        title: 'לא ניתן לבחור תאריך עבר',
        description: 'אין אפשרות ליצור משימות או לערוך תאריכים בעבר',
        variant: 'destructive',
      });
      return;
    }
    
    // Switch to notes for this date
    setNotesDateString(jerusalemDateString);
    
    // Also handle task creation - create Date object properly for task dialog
    const clickedDate = createJerusalemDate(jerusalemDateString);
    setSelectedDate(clickedDate);
    setSelectedTask(null);
    setDialogMode('create');
    setTaskDialogOpen(true);
  }, [isPastDate, toast]);

  // Handle task/event click (for editing tasks or viewing profile events)
  const handleEventClick = useCallback((info: EventClickArg) => {
    const eventType = info.event.extendedProps?.type;
    
    if (eventType === 'task') {
      // Handle task click for editing
      const taskId = info.event.id;
      if (taskId && dailyTasks) {
        const task = dailyTasks.find(t => t.id === taskId);
        if (task) {
          setSelectedTask(task);
          setSelectedDate(new Date(task.date));
          setDialogMode('edit');
          setTaskDialogOpen(true);
        }
      }
    } else if (eventType === 'profile') {
      // Handle profile event click - show enhanced dialog
      const { eventType: profileEventType, occupantId, occupantName, roomId } = info.event.extendedProps;
      
      setSelectedProfileEvent({
        eventType: profileEventType,
        occupantId,
        occupantName,
        roomId,
        eventDate: info.event.startStr,
      });
      setProfileEventDialogOpen(true);
    }
    
    // Prevent default navigation
    info.jsEvent.preventDefault();
  }, [dailyTasks]);

  // Navigation handlers
  const goToToday = useCallback(() => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  }, []);

  const goToPrevious = useCallback(() => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
    }
  }, []);

  const goToNext = useCallback(() => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
    }
  }, []);

  // View change handlers
  const changeView = useCallback((viewName: string) => {
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(viewName);
      setCurrentView(viewName);
    }
  }, []);

  // Handle view mount and title update  
  const handleViewDidMount = useCallback((info: ViewMountArg) => {
    setCurrentTitle(info.view.title);
  }, []);


  // Handle event drop (drag and drop) - Enhanced with past date blocking
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const eventType = info.event.extendedProps?.type;
    
    // Only allow dragging tasks, not profile events
    if (eventType !== 'task') {
      info.revert();
      toast({
        title: 'לא ניתן לגרור',
        description: 'רק משימות ניתן לגרור, לא אירועי פרופיל',
        variant: 'destructive',
      });
      return;
    }

    // Block drops to past dates
    const newDateStr = formatJerusalemDate(new Date(info.event.startStr));
    if (isPastDate(newDateStr)) {
      info.revert();
      toast({
        title: 'לא ניתן להעביר לתאריך עבר',
        description: 'אין אפשרות להעביר משימות לתאריכים בעבר',
        variant: 'destructive',
      });
      return;
    }

    const taskId = info.event.id;
    const taskName = info.event.title;
    const originalTask = dailyTasks?.find(task => task.id === taskId);
    
    if (!originalTask) {
      info.revert();
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למצוא את המשימה המקורית',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Determine view type for different behaviors
      const viewType = calendarRef.current?.getApi().view.type;
      const isTimeGridView = viewType?.includes('timeGrid'); // Week/Day views
      const isDayGridView = viewType?.includes('dayGrid'); // Month view
      
      // Parse new date/time from drop event
      const newStartStr = info.event.startStr;
      const newDate = new Date(newStartStr);
      
      // Prepare update data based on view type
      let updateData: { date: Date; time?: string | null } = { date: newDate };
      
      if (isTimeGridView) {
        // TimeGrid: Update both date and time
        if (info.event.allDay) {
          // If dropped on all-day area, remove time
          updateData.time = null;
        } else {
          // Extract time from the new datetime
          const timeStr = `${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`;
          updateData.time = timeStr;
        }
      } else if (isDayGridView) {
        // DayGrid: Update date but preserve existing time
        updateData.time = originalTask.time; // Preserve original time
      }

      // Perform immediate save
      await updateTaskMutation.mutateAsync({
        id: taskId,
        data: updateData
      });

      // Success feedback based on what was updated
      let successMessage: string;
      if (isTimeGridView && updateData.time) {
        successMessage = `המשימה "${taskName}" הועברה ל-${format(newDate, 'dd/MM/yyyy', { locale: he })} בשעה ${updateData.time}`;
      } else if (isTimeGridView && !updateData.time) {
        successMessage = `המשימה "${taskName}" הועברה ל-${format(newDate, 'dd/MM/yyyy', { locale: he })} כמשימה לכל היום`;
      } else {
        successMessage = `המשימה "${taskName}" הועברה ל-${format(newDate, 'dd/MM/yyyy', { locale: he })}`;
      }
      
      toast({
        title: 'המשימה הועברה בהצלחה',
        description: successMessage,
      });

    } catch (error) {
      console.error('Drag and drop error:', error);
      info.revert();
      toast({
        title: 'שגיאה',
        description: 'שגיאה בהעברת המשימה. נסה שוב.',
        variant: 'destructive',
      });
    }
  }, [isPastDate, dailyTasks, updateTaskMutation, toast]);

  // Handle event resize
  const handleEventResize = useCallback(async (info: EventResizeDoneArg) => {
    const eventType = info.event.extendedProps?.type;
    
    if (eventType !== 'task') {
      info.revert();
      return;
    }

    // For now, revert resize as we don't support duration changes
    // Could be enhanced to support time range tasks in the future
    info.revert();
    toast({
      title: 'שינוי גודל לא נתמך',
      description: 'כרגע לא ניתן לשנות את גודל המשימות',
      variant: 'default',
    });
  }, [toast]);

  // Transform task data to FullCalendar events
  const taskEvents = useMemo(() => {
    if (!dailyTasks) return [];
    
    return dailyTasks.map(task => {
      const hasOccupant = task.occupantId !== null;
      let colorScheme = hasOccupant ? TASK_COLORS.withOccupant : TASK_COLORS.default;

      // Create event with time if available
      const eventBase = {
        id: task.id,
        title: task.name,
        date: task.date, // This will be YYYY-MM-DD format from backend
        allDay: !task.time, // If no time, it's an all-day event
        editable: true, // Allow dragging and dropping
        backgroundColor: colorScheme.bg,
        borderColor: colorScheme.border,
        extendedProps: {
          type: 'task',
          task: task,
          hasOccupant,
        },
      };

      // Add time-specific properties if time exists
      if (task.time) {
        const [hours, minutes] = task.time.split(':');
        const taskDate = new Date(task.date);
        taskDate.setHours(parseInt(hours), parseInt(minutes));
        
        return {
          ...eventBase,
          start: taskDate.toISOString(),
          allDay: false,
        };
      }

      return eventBase;
    });
  }, [dailyTasks]);

  // Transform profile events
  const profileEvents = useMemo(() => {
    if (!occupants) return [];
    return transformOccupantsToProfileEvents(occupants);
  }, [occupants]);

  // Combine all events
  const allEvents = useMemo(() => {
    return [...taskEvents, ...profileEvents];
  }, [taskEvents, profileEvents]);

  // Handle notes synchronization
  useEffect(() => {
    if (dailyNote) {
      setNotesContent(dailyNote.content || '');
    } else {
      setNotesContent('');
    }
  }, [dailyNote]);

  // Auto-save notes with debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (notesContent.trim() && dailyNote?.content !== notesContent) {
        autoSaveMutation.mutate({
          date: createJerusalemDate(notesDateString),
          content: notesContent,
        });
      }
    }, 2000); // 2-second debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [notesContent, notesDateString, dailyNote?.content, autoSaveMutation]);

  // Handle manual save
  const handleManualSave = useCallback(async () => {
    if (!notesContent.trim()) {
      toast({
        title: 'אין תוכן לשמירה',
        description: 'נא להזין תוכן לפני השמירה',
        variant: 'default',
      });
      return;
    }

    setIsSaving(true);
    try {
      await manualSaveMutation.mutateAsync({
        date: createJerusalemDate(notesDateString),
        content: notesContent,
      });
      setLastSaved(new Date());
      toast({
        title: 'נשמר בהצלחה',
        description: `הערות ליום ${format(createJerusalemDate(notesDateString), 'dd/MM/yyyy', { locale: he })} נשמרו`,
      });
    } catch (error) {
      toast({
        title: 'שגיאה בשמירה',
        description: 'נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [notesContent, notesDateString, manualSaveMutation, toast]);

  // Loading state
  if (tasksLoading || occupantsLoading || roomsLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">יומן משימות</h1>
          </div>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">יומן משימות</h1>
        </div>
        <Button onClick={() => navigate('/')} variant="outline" size="sm" data-testid="button-home">
          <Home className="h-4 w-4 ml-1" />
          בית
        </Button>
      </div>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={goToPrevious}
                variant="outline"
                size="sm"
                data-testid="button-prev"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={goToNext}
                variant="outline"
                size="sm"
                data-testid="button-next"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={goToToday}
                variant="outline"
                size="sm"
                data-testid="button-today"
              >
                היום
              </Button>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-calendar-title">
                {currentTitle}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => changeView('dayGridMonth')}
                variant={currentView === 'dayGridMonth' ? 'default' : 'outline'}
                size="sm"
                data-testid="button-month-view"
              >
                <Grid3x3 className="h-4 w-4 ml-1" />
                חודש
              </Button>
              <Button
                onClick={() => changeView('timeGridWeek')}
                variant={currentView === 'timeGridWeek' ? 'default' : 'outline'}
                size="sm"
                data-testid="button-week-view"
              >
                <Columns className="h-4 w-4 ml-1" />
                שבוע
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              onClick={() => {
                setSelectedDate(createJerusalemDate(getTodayJerusalem()));
                setSelectedTask(null);
                setDialogMode('create');
                setTaskDialogOpen(true);
              }}
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4 ml-1" />
              משימה חדשה
            </Button>
            <Button
              onClick={() => setBulkTaskDialogOpen(true)}
              variant="outline"
              data-testid="button-bulk-tasks"
            >
              <CalendarDays className="h-4 w-4 ml-1" />
              משימות קבועות
            </Button>
          </div>

          {/* FullCalendar Component */}
          <div className="calendar-container" data-testid="calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={heLocale}
              direction="rtl"
              timeZone="Asia/Jerusalem"
              headerToolbar={false} // We use custom header
              height="auto"
              events={allEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              viewDidMount={handleViewDidMount}
              editable={true}
              droppable={true}
              dayMaxEvents={3}
              moreLinkClick="popover"
              selectAllow={handleDateAllow}
              dayCellClassNames={handleDayCellClassNames}
              dayCellDidMount={handleDayCellDidMount}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              slotDuration="00:15:00"
              slotLabelInterval="01:00:00"
              allDaySlot={true}
              allDayText="כל היום"
              nowIndicator={true}
              businessHours={{
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
                startTime: '08:00',
                endTime: '22:00',
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card ref={notesCardRef}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              הערות יומיות - {format(createJerusalemDate(notesDateString), 'dd/MM/yyyy', { locale: he })}
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-last-saved">
                  <CheckCircle className="h-3 w-3" />
                  נשמר {format(lastSaved, 'HH:mm', { locale: he })}
                </span>
              )}
              <Button
                onClick={handleManualSave}
                disabled={isSaving || !notesContent.trim()}
                size="sm"
                variant="outline"
                data-testid="button-save-notes"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-1" />
                )}
                שמור
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {noteLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Textarea
              ref={notesTextareaRef}
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="הזן הערות ליום זה..."
              className="min-h-32 resize-none"
              data-testid="textarea-notes"
            />
          )}
        </CardContent>
      </Card>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        selectedDate={selectedDate || undefined}
        task={selectedTask}
        mode={dialogMode}
      />

      {/* Bulk Task Dialog */}
      <BulkTaskDialog
        open={bulkTaskDialogOpen}
        onOpenChange={setBulkTaskDialogOpen}
      />

      {/* Profile Event Dialog */}
      <ProfileEventDialog
        isOpen={profileEventDialogOpen}
        onClose={() => setProfileEventDialogOpen(false)}
        eventData={selectedProfileEvent}
        onEditPatient={() => {}} // TODO: Implement if needed
      />
    </div>
  );
}