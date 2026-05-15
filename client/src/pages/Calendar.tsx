import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, ViewMountArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
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
  AlertCircle,
  Printer,
  ChevronDown,
  Star,
  Copy,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { useDailyTasks, useUpdateDailyTask, useOccupants, transformOccupantsToProfileEvents, ProfileEvent, useEvents, useUpdateEvent } from '@/hooks/use-daily-tasks';
import { useWeeklyNote, useCreateOrUpdateWeeklyNote, useManualSaveWeeklyNote } from '@/hooks/use-weekly-notes';
import { TaskDialog } from '@/components/task-dialog';
import { EventDialog } from '@/components/event-dialog';
import { BulkTaskDialog } from '@/components/bulk-task-dialog';
import { BulkEventDialog } from '@/components/bulk-event-dialog';
import { ProfileEventDialog } from '@/components/profile-event-dialog';
import { DailyTasksDialog } from '../components/daily-tasks-dialog';
import { DuplicateScheduleDialog } from '@/components/duplicate-schedule-dialog';
import { OccupantDetails } from '@/components/occupant-details';
import { SelectDailyTask, SelectEvent, Room } from '@shared/schema';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatJerusalemDate, getTodayJerusalem, createJerusalemDate, addDaysToJerusalemDate, createJerusalemDateTime, toStorageFromDisplay, extractTimeFromDate, getJerusalemOffset } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import logoPath from '@/assets/beit-haosher-logo.png';

// Task color mapping for visual indicators - Green/Red system for better distinction
const TASK_COLORS = {
  default: { bg: 'hsl(0, 65%, 55%)', border: 'hsl(0, 65%, 50%)' }, // Red for unassigned tasks (בלי דייר)
  withOccupant: { bg: 'hsl(120, 60%, 45%)', border: 'hsl(120, 60%, 40%)' }, // Green for assigned tasks (עם דייר)
};

// Event color mapping for visual indicators - Multiple color options
const EVENT_COLORS: Record<string, { bg: string; border: string }> = {
  purple: { bg: 'hsl(271, 81%, 56%)', border: 'hsl(271, 81%, 50%)' }, // Purple (#8B5CF6)
  blue: { bg: 'hsl(217, 91%, 60%)', border: 'hsl(217, 91%, 50%)' }, // Blue (#3B82F6)
  orange: { bg: 'hsl(30, 100%, 70%)', border: 'hsl(30, 100%, 60%)' }, // Light orange
  gold: { bg: 'hsl(45, 93%, 47%)', border: 'hsl(45, 93%, 40%)' }, // Gold (#EAB308)
  default: { bg: 'hsl(271, 81%, 56%)', border: 'hsl(271, 81%, 50%)' }, // Fallback to purple
};

// Helper function to get the week start date (Sunday) from any date
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  d.setDate(d.getDate() - day); // Go back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to get week start in Jerusalem timezone string format
function getWeekStartJerusalem(date?: Date): string {
  const d = date || new Date();
  const weekStart = getWeekStartDate(d);
  return formatJerusalemDate(weekStart);
}

export default function Calendar() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState<string>('dayGridWeek'); // Default fallback
  const [currentTitle, setCurrentTitle] = useState('');
  const [mobileViewsOpen, setMobileViewsOpen] = useState(false);

  // Update currentView when isMobile is defined for the first time
  useEffect(() => {
    if (isMobile !== undefined) {
      const newView = isMobile ? 'dayGridDay' : 'dayGridWeek';
      console.log('📱 Updating currentView based on isMobile:', { isMobile, newView });
      setCurrentView(newView);
      
      // Update FullCalendar view as well
      if (calendarRef.current) {
        calendarRef.current.getApi().changeView(newView);
      }
    }
  }, [isMobile]);

  // Debug logging for calendar component
  console.log('🗓️ CALENDAR RENDERED - MOBILE CHECK:', {
    isMobile,
    currentView,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'undefined',
    windowInnerWidth: typeof window !== 'undefined' ? window.innerWidth : 'undefined',
    timestamp: new Date().toISOString()
  });
  
  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SelectDailyTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  
  // Event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SelectEvent | null>(null);
  const [eventDialogMode, setEventDialogMode] = useState<'create' | 'edit'>('create');
  
  // Bulk task dialog state
  const [bulkTaskDialogOpen, setBulkTaskDialogOpen] = useState(false);
  
  // Bulk event dialog state
  const [bulkEventDialogOpen, setBulkEventDialogOpen] = useState(false);
  
  // Daily tasks mobile dialog state
  const [dailyTasksDialogOpen, setDailyTasksDialogOpen] = useState(false);
  const [selectedDailyDate, setSelectedDailyDate] = useState<Date | null>(null);
  
  // Duplicate schedule dialog state (mobile)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateSourceDate, setDuplicateSourceDate] = useState<Date | null>(null);
  
  // Desktop duplicate schedule dialog state
  const [desktopDuplicateDialogOpen, setDesktopDuplicateDialogOpen] = useState(false);
  
  // Delete schedule mode state (inline selection on calendar)
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteDates, setSelectedDeleteDates] = useState<Set<string>>(new Set());
  
  // Duplicate schedule mode state (inline selection on calendar)
  const [duplicateMode, setDuplicateMode] = useState(false);
  
  // Profile event dialog state
  const [profileEventDialogOpen, setProfileEventDialogOpen] = useState(false);
  const [selectedProfileEvent, setSelectedProfileEvent] = useState<{
    eventType: 'admission' | 'discharge' | 'exit-start' | 'exit-end' | 'consultation';
    occupantId: string;
    occupantName: string;
    roomId: string;
    eventDate: string;
  } | null>(null);
  
  // Occupant details dialog state
  const [occupantDetailsOpen, setOccupantDetailsOpen] = useState(false);
  const [selectedOccupantForDetails, setSelectedOccupantForDetails] = useState<string | null>(null);
  
  // Choice dialog state for selecting task or event creation
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [choiceDialogDate, setChoiceDialogDate] = useState<Date | null>(null);
  const [choiceDialogDateString, setChoiceDialogDateString] = useState<string | null>(null);
  
  // Fixed task/event choice dialog state
  const [fixedChoiceDialogOpen, setFixedChoiceDialogOpen] = useState(false);
  
  // Print dialog state
  const [printDatePickerOpen, setPrintDatePickerOpen] = useState(false);
  const [selectedPrintDate, setSelectedPrintDate] = useState<Date | undefined>(new Date());
  const [originalView, setOriginalView] = useState<string>('');
  
  // Tooltip state for task notes
  const [tooltipState, setTooltipState] = useState<{
    show: boolean;
    x: number;
    y: number;
    content: string;
    taskTitle: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    content: '',
    taskTitle: '',
  });
  
  // Weekly Notes state - use week start date string as source of truth
  const [notesWeekStartDate, setNotesWeekStartDate] = useState<string>(getWeekStartJerusalem());
  const [notesContent, setNotesContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesCardRef = useRef<HTMLDivElement>(null);
  
  // Touch/swipe navigation state for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch daily tasks, events, and occupants
  const { data: dailyTasks, isLoading: tasksLoading } = useDailyTasks();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: occupants = [], isLoading: occupantsLoading } = useOccupants();
  
  // Task and Event update mutations for drag and drop
  const updateTaskMutation = useUpdateDailyTask();
  const updateEventMutation = useUpdateEvent();
  
  // Get rooms for profile event dialog
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });
  
  // Fetch weekly notes for current week
  const { data: weeklyNote, isLoading: noteLoading } = useWeeklyNote(notesWeekStartDate);
  const autoSaveMutation = useCreateOrUpdateWeeklyNote();
  const manualSaveMutation = useManualSaveWeeklyNote();

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
    
    // Delete mode - add selection overlay
    if (deleteMode) {
      info.el.style.cursor = 'pointer';
      info.el.style.position = 'relative';
      
      // Check if this date is selected for deletion
      const isSelected = selectedDeleteDates.has(dateStr);
      
      // Find or create the selection overlay
      let overlay = info.el.querySelector('.delete-selection-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'delete-selection-overlay';
        overlay.style.cssText = `
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 2px solid hsl(0, 65%, 55%);
          background: ${isSelected ? 'hsl(0, 65%, 55%)' : 'transparent'};
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          pointer-events: none;
          transition: background 0.2s;
        `;
        
        if (isSelected) {
          overlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        }
        
        info.el.appendChild(overlay);
      } else {
        // Update existing overlay
        overlay.style.background = isSelected ? 'hsl(0, 65%, 55%)' : 'transparent';
        overlay.innerHTML = isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '';
      }
      
      // Add selected date highlight
      if (isSelected) {
        info.el.style.backgroundColor = 'hsla(0, 65%, 55%, 0.1)';
        info.el.style.borderColor = 'hsl(0, 65%, 55%)';
        info.el.style.borderWidth = '2px';
      }
    } else {
      // Remove delete mode overlays
      const overlay = info.el.querySelector('.delete-selection-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
    
    // Note: Duplicate mode and delete mode styling is handled via CSS classes on the
    // calendar container (.duplicate-mode and .delete-mode) rather than here, because
    // dayCellDidMount only runs when cells mount, not when state changes.
  }, [isPastDate, isTodayDate, deleteMode, selectedDeleteDates]);

  // Toggle date selection in delete mode
  const toggleDeleteDate = useCallback((dateString: string) => {
    setSelectedDeleteDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateString)) {
        newSet.delete(dateString);
      } else {
        newSet.add(dateString);
      }
      return newSet;
    });
  }, []);

  // Handle date click (for adding new tasks and switching notes) - Enhanced with past date blocking
  const handleDateClick = useCallback((info: DateClickArg) => {
    try {
      // Use Jerusalem date string directly from FullCalendar (which uses Jerusalem timezone)
      const jerusalemDateString = info.dateStr;
      
      const clickedDate = createJerusalemDate(jerusalemDateString);
      
      console.log('🔍 DATE CLICK DEBUG:', {
        isMobile,
        currentView,
        jerusalemDateString,
        clickedDate,
        isPastDate: isPastDate(jerusalemDateString),
        deleteMode,
        timestamp: new Date().toISOString()
      });
      
      // Handle delete mode - toggle date selection
      if (deleteMode) {
        toggleDeleteDate(jerusalemDateString);
        return;
      }
      
      // Handle duplicate mode - select source date and open dialog
      if (duplicateMode) {
        console.log('🔄 DUPLICATE MODE - Selected source date:', jerusalemDateString);
        // Exit duplicate mode
        setDuplicateMode(false);
        // Set source date and open dialog
        setDuplicateSourceDate(clickedDate);
        setDesktopDuplicateDialogOpen(true);
        return;
      }
      
      // On mobile daily view: Show choice dialog for task or event creation (same as desktop)
      if (isMobile === true && currentView === 'dayGridDay') {
        console.log('📱 Mobile daily view detected - showing choice dialog');
        // Block clicks on past dates for mobile daily view task creation
        if (isPastDate(jerusalemDateString)) {
          toast({
            title: 'לא ניתן לבחור תאריך עבר',
            description: 'אין אפשרות ליצור משימות או לערוך תאריכים בעבר',
            variant: 'destructive',
          });
          return;
        }
        
        // Mobile daily view: Show choice dialog for task or event creation
        setChoiceDialogDate(clickedDate);
        setChoiceDialogDateString(jerusalemDateString);
        setChoiceDialogOpen(true);
        return;
      }
      
      // On mobile monthly view: Allow ALL date clicks with different behaviors
      if (isMobile === true && currentView === 'dayGridMonth') {
        // Check if this date has any tasks or events
        const dayTasks = dailyTasks?.filter(task => {
          const taskDateStr = typeof task.date === 'string' ? task.date : formatJerusalemDate(new Date(task.date));
          return taskDateStr === jerusalemDateString;
        }) || [];
        
        const dayEvents = events?.filter(event => {
          const eventDateStr = typeof event.date === 'string' ? event.date : formatJerusalemDate(new Date(event.date));
          return eventDateStr === jerusalemDateString;
        }) || [];
        
        const hasContent = dayTasks.length > 0 || dayEvents.length > 0;
        
        console.log('📱 MOBILE MONTHLY VIEW - DATE CLICK CHECK:', {
          clickedDate,
          jerusalemDateString,
          isPastDate: isPastDate(jerusalemDateString),
          dayTasksCount: dayTasks.length,
          dayEventsCount: dayEvents.length,
          hasContent,
          timestamp: new Date().toISOString()
        });
        
        // Close any previously open dialogs before opening new one
        setDailyTasksDialogOpen(false);
        setChoiceDialogOpen(false);
        
        if (hasContent) {
          // Date has content (past or future) - open daily tasks dialog
          console.log('📱 OPENING DAILY TASKS DIALOG - HAS CONTENT!');
          // Use setTimeout to ensure state updates happen in order
          setTimeout(() => {
            setSelectedDailyDate(clickedDate);
            setDailyTasksDialogOpen(true);
          }, 50);
          return;
        } else {
          // Date has no content
          if (isPastDate(jerusalemDateString)) {
            // Past date with no content - open daily dialog to show empty state with informative message
            console.log('📱 PAST DATE NO CONTENT - OPENING DAILY DIALOG WITH EMPTY STATE');
            // Use setTimeout to ensure state updates happen in order
            setTimeout(() => {
              setSelectedDailyDate(clickedDate);
              setDailyTasksDialogOpen(true);
            }, 50);
            // Show informative toast as well
            toast({
              title: 'תאריך בעבר ללא תוכן',
              description: 'תאריך זה בעבר אינו מכיל משימות או אירועים',
              variant: 'default',
            });
            return;
          } else {
            // Future date with no content - show choice dialog for task creation
            console.log('📱 FUTURE DATE NO CONTENT - SHOWING CHOICE DIALOG');
            // Use setTimeout to ensure state updates happen in order
            setTimeout(() => {
              setSelectedDailyDate(clickedDate);
              setChoiceDialogDate(clickedDate);
              setChoiceDialogDateString(jerusalemDateString);
              setChoiceDialogOpen(true);
            }, 50);
            return;
          }
        }
      }
      
      // Block clicks on past dates for desktop task creation
      if (isPastDate(jerusalemDateString)) {
        toast({
          title: 'לא ניתן לבחור תאריך עבר',
          description: 'אין אפשרות ליצור משימות או לערוך תאריכים בעבר',
          variant: 'destructive',
        });
        return;
      }
      
      // Desktop behavior: Show choice dialog for task or event creation
      setChoiceDialogDate(clickedDate);
      setChoiceDialogDateString(jerusalemDateString);
      setChoiceDialogOpen(true);
    } catch (error) {
      // Silently ignore errors - don't show any dialog or toast
      console.error('Error in handleDateClick (silently handled):', error);
      return;
    }
  }, [isPastDate, isMobile, currentView, toast, deleteMode, toggleDeleteDate, duplicateMode]);

  // Handle day header click (for mobile day header clicks) - Open daily tasks dialog
  const handleDayHeaderDidMount = useCallback((info: any) => {
    // Only add click handler for mobile
    if (isMobile) {
      const dayHeaderEl = info.el;
      
      console.log('📱 Setting up day header click for mobile', {
        date: info.date,
        isMobile,
        currentView
      });
      
      // Add click handler to day header
      const handleHeaderClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          // Get the date from the day header
          const dateStr = formatJerusalemDate(info.date);
          const clickedDate = createJerusalemDate(dateStr);
          
          console.log('📱 Day header clicked!', {
            dateStr,
            clickedDate,
            tasksCount: dailyTasks?.length || 0,
            eventsCount: events?.length || 0
          });
          
          // Open daily tasks dialog
          setSelectedDailyDate(clickedDate);
          setDailyTasksDialogOpen(true);
        } catch (error) {
          console.error('Error in handleHeaderClick (silently handled):', error);
        }
      };
      
      // Add click event listener
      dayHeaderEl.addEventListener('click', handleHeaderClick);
      
      // Add cursor pointer to indicate clickability
      dayHeaderEl.style.cursor = 'pointer';
      dayHeaderEl.style.userSelect = 'none';
      
      // Optional: Add hover effect for better UX
      const handleMouseEnter = () => {
        dayHeaderEl.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      };
      
      const handleMouseLeave = () => {
        dayHeaderEl.style.backgroundColor = '';
      };
      
      dayHeaderEl.addEventListener('mouseenter', handleMouseEnter);
      dayHeaderEl.addEventListener('mouseleave', handleMouseLeave);
      
      // Cleanup function - though FullCalendar handles this automatically
      return () => {
        dayHeaderEl.removeEventListener('click', handleHeaderClick);
        dayHeaderEl.removeEventListener('mouseenter', handleMouseEnter);
        dayHeaderEl.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [isMobile]);

  // Handle task/event click (for editing tasks, events, or viewing profile events)
  const handleEventClick = useCallback((info: EventClickArg) => {
    const eventType = info.event.extendedProps?.type;
    
    // In delete mode, clicking on events/tasks should select the day instead
    if (deleteMode) {
      const eventDate = info.event.startStr.split('T')[0]; // Get YYYY-MM-DD format
      toggleDeleteDate(eventDate);
      info.jsEvent.preventDefault();
      info.jsEvent.stopPropagation();
      return;
    }
    
    // In duplicate mode, clicking on events/tasks should select the day as source
    if (duplicateMode) {
      const eventDate = info.event.startStr.split('T')[0]; // Get YYYY-MM-DD format
      console.log('🔄 DUPLICATE MODE - Selected source date from event:', eventDate);
      // Exit duplicate mode
      setDuplicateMode(false);
      // Set source date and open dialog
      setDuplicateSourceDate(createJerusalemDate(eventDate));
      setDesktopDuplicateDialogOpen(true);
      info.jsEvent.preventDefault();
      info.jsEvent.stopPropagation();
      return;
    }
    
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
    } else if (eventType === 'event') {
      // Handle event click for editing
      const eventId = info.event.id;
      if (eventId && events) {
        const event = events.find(e => e.id === eventId);
        if (event) {
          setSelectedEvent(event);
          setSelectedDate(new Date(event.date));
          setEventDialogMode('edit');
          setEventDialogOpen(true);
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
  }, [dailyTasks, events, deleteMode, toggleDeleteDate, duplicateMode]);

  // Handle choice dialog - Task creation
  const handleChoiceTask = useCallback(() => {
    if (choiceDialogDate && choiceDialogDateString) {
      setSelectedDate(choiceDialogDate);
      setSelectedTask(null);
      setDialogMode('create');
      setChoiceDialogOpen(false);
      setTaskDialogOpen(true);
    }
  }, [choiceDialogDate, choiceDialogDateString]);

  // Handle choice dialog - Event creation
  const handleChoiceEvent = useCallback(() => {
    if (choiceDialogDate && choiceDialogDateString) {
      setSelectedDate(choiceDialogDate);
      setSelectedEvent(null);
      setEventDialogMode('create');
      setChoiceDialogOpen(false);
      setEventDialogOpen(true);
    }
  }, [choiceDialogDate, choiceDialogDateString]);

  // Handle creating new event (moved from header)
  const handleCreateNewEvent = useCallback(() => {
    setSelectedDate(createJerusalemDate(getTodayJerusalem()));
    setSelectedEvent(null);
    setEventDialogMode('create');
    setEventDialogOpen(true);
  }, []);

  // Handle fixed choice dialog - Fixed Task
  const handleFixedChoiceTask = useCallback(() => {
    setFixedChoiceDialogOpen(false);
    setBulkTaskDialogOpen(true);
  }, []);

  // Handle fixed choice dialog - Fixed Event
  const handleFixedChoiceEvent = useCallback(() => {
    setFixedChoiceDialogOpen(false);
    setBulkEventDialogOpen(true);
  }, []);

  // Handle desktop duplicate schedule - toggle duplicate mode
  const handleDesktopDuplicate = useCallback(() => {
    // Exit delete mode if active
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedDeleteDates(new Set());
    }
    setDuplicateMode(prev => !prev);
  }, [deleteMode]);

  // Handle desktop duplicate success
  const handleDesktopDuplicateSuccess = useCallback((targetDate: Date) => {
    // Navigate to the target week
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(targetDate);
    }
    toast({
      title: 'שכפול הושלם בהצלחה',
      description: 'לוח הזמנים שוכפל לשבועות הנבחרים',
      variant: 'default',
    });
  }, [toast]);

  // Toggle delete mode
  const handleToggleDeleteMode = useCallback(() => {
    // Exit duplicate mode if active
    if (duplicateMode) {
      setDuplicateMode(false);
    }
    setDeleteMode(prev => !prev);
    setSelectedDeleteDates(new Set());
  }, [duplicateMode]);

  // Confirm delete of selected dates
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleConfirmDelete = useCallback(async () => {
    if (selectedDeleteDates.size === 0) return;
    
    setIsDeleting(true);
    try {
      const dates = Array.from(selectedDeleteDates);
      const response = await apiRequest('DELETE', '/api/schedule-events/bulk', { dates });
      const result = await response.json();
      
      // Invalidate all related queries with correct keys
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/events'] }),
      ]);
      
      // Force refetch to ensure UI is updated
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/daily-tasks'] }),
        queryClient.refetchQueries({ queryKey: ['/api/events'] }),
      ]);
      
      // Refetch calendar events
      if (calendarRef.current) {
        calendarRef.current.getApi().refetchEvents();
      }
      
      toast({
        title: 'לוח זמנים נמחק בהצלחה',
        description: `נמחקו ${result.totalDeleted} פריטים מ-${dates.length} ימים`,
        variant: 'default',
        duration: 3000,
      });
      
      // Exit delete mode
      setDeleteMode(false);
      setSelectedDeleteDates(new Set());
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'שגיאה במחיקה',
        description: error?.message || 'אנא נסה שוב',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDeleteDates, toast]);

  // Cancel delete mode
  const handleCancelDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedDeleteDates(new Set());
  }, []);

  // Tooltip event handlers
  const handleEventMouseEnter = useCallback((info: any) => {
    const eventType = info.event.extendedProps?.type;
    
    // Show tooltip for both task and event types (not profile events)
    if (eventType !== 'task' && eventType !== 'event') {
      return;
    }
    
    const note = info.event.extendedProps?.note;
    const eventTitle = info.event.title;
    
    // Only show tooltip if there's a note
    if (!note || note.trim() === '') {
      return;
    }
    
    // Get mouse position relative to viewport
    const rect = info.el.getBoundingClientRect();
    const x = rect.left + rect.width / 2; // Center horizontally on the event
    const y = rect.top - 10; // Position above the event
    
    setTooltipState({
      show: true,
      x,
      y,
      content: note,
      taskTitle: eventTitle,
    });
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    setTooltipState(prev => ({
      ...prev,
      show: false,
    }));
  }, []);

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

  // Touch/swipe navigation for mobile daily view
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only handle swipe in mobile daily view
    if (!isMobile || currentView !== 'dayGridDay') return;
    
    setTouchEnd(null);
    setTouchEndY(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  }, [isMobile, currentView]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Only handle swipe in mobile daily view
    if (!isMobile || currentView !== 'dayGridDay') return;
    
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  }, [isMobile, currentView]);

  const handleTouchEnd = useCallback(() => {
    // Only handle swipe in mobile daily view
    if (!isMobile || currentView !== 'dayGridDay') return;
    if (!touchStart || !touchEnd || !touchStartY || !touchEndY) return;
    
    const distanceX = touchStart - touchEnd;
    const distanceY = touchStartY - touchEndY;
    
    // Check if this is primarily a horizontal swipe
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const isSwipe = Math.abs(distanceX) > 50; // Minimum swipe distance
    
    // Only trigger navigation for horizontal swipes (not vertical scrolling)
    if (isSwipe && isHorizontalSwipe) {
      if (distanceX > 0) {
        // Swiped left -> go to next day (RTL: left = next)
        goToNext();
      } else {
        // Swiped right -> go to previous day (RTL: right = previous)
        goToPrevious();
      }
    }
  }, [touchStart, touchEnd, touchStartY, touchEndY, isMobile, currentView, goToNext, goToPrevious]);

  // View change handlers
  const changeView = useCallback((viewName: string) => {
    try {
      console.log('Changing calendar view to:', viewName);
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        console.log('Calendar API available:', !!calendarApi);
        
        calendarApi.changeView(viewName);
        setCurrentView(viewName);
        console.log('View changed successfully to:', viewName);
      } else {
        console.error('Calendar ref not available');
      }
    } catch (error) {
      console.error('Error changing view to', viewName, ':', error);
      toast({
        title: 'שגיאה בהחלפת תצוגה',
        description: `לא ניתן להחליף לתצוגת ${viewName === 'dayGridWeek' ? 'שבוע' : 'חודש'}`,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Handle view mount and title update - remove year only from week views  
  const handleViewDidMount = useCallback((info: ViewMountArg) => {
    if (info.view.type === 'dayGridWeek') {
      // Remove year from title for week view only (assuming format like "December 2024" or "דצמבר 2024")
      const titleWithoutYear = info.view.title.replace(/\s+\d{4}/g, '');
      setCurrentTitle(titleWithoutYear);
    } else {
      // Keep year for month view and other views
      setCurrentTitle(info.view.title);
    }
  }, []);

  // Handle dates change to update title during navigation
  const handleDatesSet = useCallback((info: any) => {
    // Update weekly notes based on the current view's start date
    const viewStart = new Date(info.start);
    const weekStart = getWeekStartDate(viewStart);
    const weekStartStr = formatJerusalemDate(weekStart);
    setNotesWeekStartDate(weekStartStr);
    
    if (info.view.type === 'dayGridWeek') {
      // Format week range title in Hebrew - without year for week view
      const start = new Date(info.start);
      const end = new Date(info.end);
      // Subtract one day from end since FullCalendar gives us the day after the week
      end.setDate(end.getDate() - 1);
      
      const startFormatted = format(start, 'dd/MM', { locale: he });
      const endFormatted = format(end, 'dd/MM', { locale: he }); // No year for week view
      
      const weekTitle = `${startFormatted} - ${endFormatted}`;
      setCurrentTitle(weekTitle);
    } else {
      // Keep year for month view and other views
      setCurrentTitle(info.view.title);
    }
  }, []);

  // Handle event rendering to ensure colors are correct
  const handleEventDidMount = useCallback((info: any) => {
    const eventType = info.event.extendedProps?.type;
    
    // Handle task events
    if (eventType === 'task') {
      const hasOccupant = info.event.extendedProps?.hasOccupant;
      const colorScheme = hasOccupant ? TASK_COLORS.withOccupant : TASK_COLORS.default;
      
      // Apply colors to the event element with !important to override any defaults
      info.el.style.setProperty('background-color', colorScheme.bg, 'important');
      info.el.style.setProperty('border-color', colorScheme.border, 'important');
      info.el.style.setProperty('color', '#fff', 'important');
      
      // Add data attribute for CSS targeting
      info.el.setAttribute('data-task-type', 'task');
      
      // Also apply to nested elements that might have different styling
      const titleEl = info.el.querySelector('.fc-event-title');
      if (titleEl) {
        titleEl.style.setProperty('color', '#fff', 'important');
      }
      
      const mainEl = info.el.querySelector('.fc-event-main');
      if (mainEl) {
        mainEl.style.setProperty('color', '#fff', 'important');
      }
    }
    // Handle regular events (not tasks or profile events)
    else if (eventType === 'event') {
      const eventColor = info.event.extendedProps?.color || 'purple';
      const colorScheme = EVENT_COLORS[eventColor] || EVENT_COLORS.default;
      
      // Apply colors to the event element with !important to override any defaults
      info.el.style.setProperty('background-color', colorScheme.bg, 'important');
      info.el.style.setProperty('border-color', colorScheme.border, 'important');
      info.el.style.setProperty('color', '#fff', 'important');
      
      // Add data attribute for CSS targeting
      info.el.setAttribute('data-event-type', 'event');
      
      // Also apply to nested elements that might have different styling
      const titleEl = info.el.querySelector('.fc-event-title');
      if (titleEl) {
        titleEl.style.setProperty('color', '#fff', 'important');
      }
      
      const mainEl = info.el.querySelector('.fc-event-main');
      if (mainEl) {
        mainEl.style.setProperty('color', '#fff', 'important');
      }
    }
    // Handle profile events (keep their individual colors but add data attribute)
    else if (eventType === 'profile') {
      // Add data attribute for CSS targeting - colors are already set by the event creation
      info.el.setAttribute('data-event-type', 'profile');
      
      // Ensure text is white for readability
      info.el.style.setProperty('color', '#fff', 'important');
      
      // Also apply to nested elements that might have different styling
      const titleEl = info.el.querySelector('.fc-event-title');
      if (titleEl) {
        titleEl.style.setProperty('color', '#fff', 'important');
      }
      
      const mainEl = info.el.querySelector('.fc-event-main');
      if (mainEl) {
        mainEl.style.setProperty('color', '#fff', 'important');
      }
    }
  }, []);

  // Handle event drop (drag and drop) - Enhanced with past date blocking
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    console.log('HandleEventDrop called:', info);
    const eventType = info.event.extendedProps?.type;
    
    // Only allow dragging tasks and events, not profile events
    if (eventType !== 'task' && eventType !== 'event') {
      info.revert();
      toast({
        title: 'לא ניתן לגרור',
        description: 'רק משימות ואירועים ניתן לגרור',
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
        description: 'אין אפשרות להעביר פריטים לתאריכים בעבר',
        variant: 'destructive',
      });
      return;
    }

    const itemId = info.event.id;
    const itemName = info.event.title;
    const isTask = eventType === 'task';
    
    // Find the original item (task or event)
    const originalTask = isTask ? dailyTasks?.find(task => task.id === itemId) : null;
    const originalEvent = !isTask ? events?.find(evt => evt.id === itemId) : null;
    const originalItem = originalTask || originalEvent;
    
    if (!originalItem) {
      info.revert();
      toast({
        title: 'שגיאה',
        description: `לא ניתן למצוא את ה${isTask ? 'משימה' : 'אירוע'} המקורי`,
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
      let updateData: { date: Date; time?: string | null };
      
      if (isTimeGridView) {
        // TimeGrid: Update both date and time
        if (info.event.allDay) {
          // If dropped on all-day area, remove time and just update date
          updateData = {
            date: newDate,
            time: null
          };
        } else {
          // Extract display time and convert back to storage time
          // This handles the critical bug where display time (+3 hours) was saved directly
          const displayTime = extractTimeFromDate(newDate);
          const { storageDate, storageTime } = toStorageFromDisplay(newDate, displayTime);
          
          updateData = {
            date: createJerusalemDate(storageDate), // Use the corrected date (handles day crossing)
            time: storageTime // Use the corrected time (3 hours subtracted)
          };
        }
      } else if (isDayGridView) {
        // DayGrid: Update date but preserve existing time
        updateData = {
          date: newDate,
          time: originalItem.time // Preserve original time
        };
      } else {
        // Fallback for other views
        updateData = { date: newDate };
      }

      // Perform immediate save based on item type
      if (isTask) {
        await updateTaskMutation.mutateAsync({
          id: itemId,
          data: updateData
        });
      } else {
        await updateEventMutation.mutateAsync({
          id: itemId,
          data: updateData
        });
      }

      // Success feedback based on what was updated
      const itemTypeHebrew = isTask ? 'המשימה' : 'האירוע';
      let successMessage: string;
      if (isTimeGridView && updateData.time) {
        // Show the actual stored time and date (handles day crossing correctly)
        const actualDate = updateData.date;
        successMessage = `${itemTypeHebrew} "${itemName}" הועבר ל-${format(actualDate, 'dd/MM/yyyy', { locale: he })} בשעה ${updateData.time}`;
      } else if (isTimeGridView && !updateData.time) {
        successMessage = `${itemTypeHebrew} "${itemName}" הועבר ל-${format(updateData.date, 'dd/MM/yyyy', { locale: he })} כפריט לכל היום`;
      } else {
        successMessage = `${itemTypeHebrew} "${itemName}" הועבר ל-${format(updateData.date, 'dd/MM/yyyy', { locale: he })}`;
      }
      
      toast({
        title: `${itemTypeHebrew} הועבר בהצלחה`,
        description: successMessage,
      });

    } catch (error) {
      console.error('Drag and drop error:', error);
      info.revert();
      toast({
        title: 'שגיאה',
        description: `שגיאה בהעברת ה${isTask ? 'משימה' : 'אירוע'}. נסה שוב.`,
        variant: 'destructive',
      });
    }
  }, [isPastDate, dailyTasks, events, updateTaskMutation, updateEventMutation, toast]);

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

  // Helper function to get occupant name by ID
  const getOccupantName = useCallback((occupantId: string | null): string => {
    if (!occupantId || !occupants) return '';
    const occupant = occupants.find(o => o.id === occupantId);
    return occupant ? occupant.name : '';
  }, [occupants]);

  // Transform task data to FullCalendar events - Enhanced with occupant names
  const taskEvents = useMemo(() => {
    if (!dailyTasks) return [];
    
    return dailyTasks.map(task => {
      const hasOccupant = task.occupantId !== null;
      let colorScheme = hasOccupant ? TASK_COLORS.withOccupant : TASK_COLORS.default;

      // Build title with occupant name if assigned
      let title = task.name;
      if (hasOccupant) {
        const occupantName = getOccupantName(task.occupantId);
        if (occupantName) {
          title = `${task.name} (${occupantName})`;
        }
      } else {
        title = `${task.name} (כללי)`;
      }

      // Create event with time if available
      const hasNote = task.note && task.note.trim() !== '';
      
      // Normalize event structure - always use 'start' and 'allDay'
      let eventStart;
      let isAllDay = !task.time;
      
      if (task.time) {
        // Timed event - create proper Date object for reliable timezone handling
        // Add Jerusalem offset (2 in winter, 3 in summer) to display time only
        try {
          const [hours, minutes] = task.time.split(':').map(num => parseInt(num));
          const taskDate = new Date(task.date);
          const offset = getJerusalemOffset();
          // Add Jerusalem offset to display time for calendar view
          taskDate.setHours(hours + offset, minutes, 0, 0);
          eventStart = taskDate.toISOString();
        } catch (error) {
          console.error('Error creating timed event, falling back:', error);
          // Also add offset in the fallback path for consistency
          const [hours, minutes] = task.time.split(':').map(num => parseInt(num));
          const offset = getJerusalemOffset();
          const adjustedTime = `${(hours + offset).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          const dateString = typeof task.date === 'string' ? task.date : formatJerusalemDate(new Date(task.date));
          eventStart = createJerusalemDateTime(dateString, adjustedTime);
        }
      } else {
        // All-day event - use YYYY-MM-DD format
        eventStart = typeof task.date === 'string' ? task.date : formatJerusalemDate(new Date(task.date));
      }

      return {
        id: task.id,
        title: title, // Enhanced title with occupant name
        start: eventStart, // Always use 'start' instead of 'date'
        allDay: isAllDay,
        editable: true, // Allow dragging and dropping
        backgroundColor: colorScheme.bg,
        borderColor: colorScheme.border,
        textColor: '#fff', // Ensure text is readable on colored backgrounds
        // Add visual indicator for events with notes and data attribute for CSS targeting
        className: hasNote ? 'fc-event-with-note' : '',
        'data-task-type': 'task', // Add data attribute for CSS targeting
        extendedProps: {
          type: 'task',
          task: task,
          hasOccupant,
          occupantName: hasOccupant ? getOccupantName(task.occupantId) : null,
          note: task.note || '', // Add task note for tooltip display
          hasNote, // Flag to indicate if task has notes
        },
      };
    });
  }, [dailyTasks, getOccupantName]);

  // Transform event data to FullCalendar events - Similar to tasks but simpler (no occupants)
  const eventEvents = useMemo(() => {
    if (!events) return [];
    
    return events.map(event => {
      const eventColor = event.color || 'purple';
      const colorScheme = EVENT_COLORS[eventColor] || EVENT_COLORS.default;

      // Event title is just the event name
      const title = event.name;

      // Create event with time if available (same logic as tasks, with +3 hours)
      const hasNote = event.note && event.note.trim() !== '';
      
      // Normalize event structure - always use 'start' and 'allDay'
      let eventStart;
      let isAllDay = !event.time;
      
      if (event.time) {
        // Timed event - create proper Date object for reliable timezone handling
        // Add Jerusalem offset (2 in winter, 3 in summer) to display time only
        try {
          const [hours, minutes] = event.time.split(':').map(num => parseInt(num));
          const eventDate = new Date(event.date);
          const offset = getJerusalemOffset();
          // Add Jerusalem offset to display time for calendar view
          eventDate.setHours(hours + offset, minutes, 0, 0);
          eventStart = eventDate.toISOString();
        } catch (error) {
          console.error('Error creating timed event, falling back:', error);
          // Also add offset in the fallback path for consistency
          const [hours, minutes] = event.time.split(':').map(num => parseInt(num));
          const offset = getJerusalemOffset();
          const adjustedTime = `${(hours + offset).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          const dateString = typeof event.date === 'string' ? event.date : formatJerusalemDate(new Date(event.date));
          eventStart = createJerusalemDateTime(dateString, adjustedTime);
        }
      } else {
        // All-day event - use YYYY-MM-DD format
        eventStart = typeof event.date === 'string' ? event.date : formatJerusalemDate(new Date(event.date));
      }

      return {
        id: event.id,
        title: title,
        start: eventStart, // Always use 'start' instead of 'date'
        allDay: isAllDay,
        editable: true, // Allow dragging and dropping
        backgroundColor: colorScheme.bg,
        borderColor: colorScheme.border,
        textColor: '#fff', // Ensure text is readable on colored backgrounds
        // Add visual indicator for events with notes and data attribute for CSS targeting
        className: hasNote ? 'fc-event-with-note' : '',
        'data-event-type': 'event', // Add data attribute for CSS targeting
        extendedProps: {
          type: 'event',
          event: event,
          note: event.note || '', // Add event note for tooltip display
          hasNote, // Flag to indicate if event has notes
          color: eventColor, // Store color for eventDidMount handler
        },
      };
    });
  }, [events]);

  // Transform profile events
  const profileEvents = useMemo(() => {
    if (!occupants) return [];
    return transformOccupantsToProfileEvents(occupants);
  }, [occupants]);

  // Combine all events
  const allEvents = useMemo(() => {
    return [...taskEvents, ...eventEvents, ...profileEvents];
  }, [taskEvents, eventEvents, profileEvents]);

  // Clear notes content immediately when week changes to prevent showing old week's notes
  useEffect(() => {
    setNotesContent('');
    setLastSaved(null);
  }, [notesWeekStartDate]);

  // Handle weekly notes synchronization - populate with fetched content
  useEffect(() => {
    if (weeklyNote) {
      setNotesContent(weeklyNote.content || '');
    }
  }, [weeklyNote]);

  // Auto-save weekly notes with debouncing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (notesContent.trim() && weeklyNote?.content !== notesContent) {
        autoSaveMutation.mutate({
          weekStartDate: createJerusalemDate(notesWeekStartDate),
          content: notesContent,
        });
      }
    }, 2000); // 2-second debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [notesContent, notesWeekStartDate, weeklyNote?.content, autoSaveMutation]);

  // Effect to update calendar cells visually when delete mode dates change
  useEffect(() => {
    if (!calendarRef.current) return;
    
    // Get all day cells
    const dayCells = document.querySelectorAll('.fc-daygrid-day');
    
    dayCells.forEach((cell: Element) => {
      const dateAttr = cell.getAttribute('data-date');
      if (!dateAttr) return;
      
      const cellEl = cell as HTMLElement;
      
      // Remove any existing delete mode styling first
      const existingOverlay = cellEl.querySelector('.delete-selection-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Reset cell styling
      if (!deleteMode) {
        // Only reset if we're not in a special state (past/today)
        const isPast = cellEl.classList.contains('fc-past-day');
        const isToday = cellEl.classList.contains('fc-day-today');
        if (!isPast && !isToday) {
          cellEl.style.backgroundColor = '';
          cellEl.style.borderColor = '';
          cellEl.style.borderWidth = '';
        }
        return;
      }
      
      // In delete mode - add selection indicators
      cellEl.style.position = 'relative';
      cellEl.style.cursor = 'pointer';
      
      const isSelected = selectedDeleteDates.has(dateAttr);
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'delete-selection-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        border: 2px solid ${isSelected ? 'hsl(0, 65%, 50%)' : 'hsl(0, 0%, 70%)'};
        background: ${isSelected ? 'hsl(0, 65%, 55%)' : 'white'};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        pointer-events: none;
        transition: all 0.15s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      `;
      
      if (isSelected) {
        overlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        // Highlight the cell
        cellEl.style.backgroundColor = 'hsla(0, 65%, 55%, 0.15)';
        cellEl.style.borderColor = 'hsl(0, 65%, 55%)';
        cellEl.style.borderWidth = '2px';
      } else {
        // Reset cell to normal state if not selected
        const isPast = cellEl.classList.contains('fc-past-day');
        const isToday = cellEl.classList.contains('fc-day-today');
        if (!isPast && !isToday) {
          cellEl.style.backgroundColor = '';
          cellEl.style.borderColor = '';
          cellEl.style.borderWidth = '';
        }
      }
      
      cellEl.appendChild(overlay);
    });
  }, [deleteMode, selectedDeleteDates]);

  // Mobile more-link handler - Use DailyTasksDialog instead of popover
  const handleMoreLinkMount = useCallback((info: any) => {
    // Only for mobile - prevent default popover and open DailyTasksDialog
    if (isMobile) {
      const linkEl = info.el;
      const dateEnv = info.date;
      
      const handleClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the date from the more link
        const clickedDate = createJerusalemDate(formatJerusalemDate(dateEnv));
        
        // Open DailyTasksDialog with all events for this date
        setSelectedDailyDate(clickedDate);
        setDailyTasksDialogOpen(true);
      };
      
      linkEl.addEventListener('click', handleClick);
      
      // Cleanup
      return () => {
        linkEl.removeEventListener('click', handleClick);
      };
    }
  }, [isMobile]);

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
        weekStartDate: createJerusalemDate(notesWeekStartDate),
        content: notesContent,
      });
      setLastSaved(new Date());
      // Calculate week end date for display
      const weekStart = createJerusalemDate(notesWeekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      toast({
        title: 'נשמר בהצלחה',
        description: `הערות לשבוע ${format(weekStart, 'dd/MM', { locale: he })} - ${format(weekEnd, 'dd/MM', { locale: he })} נשמרו`,
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
  }, [notesContent, notesWeekStartDate, manualSaveMutation, toast]);


  // Print functionality
  const handleWeeklyPrint = useCallback(async () => {
    if (!calendarRef.current) return;

    try {
      // Store current view
      const currentView = calendarRef.current.getApi().view.type;
      setOriginalView(currentView);

      // Switch to week view to show full week
      calendarRef.current.getApi().changeView('dayGridWeek');

      // Wait a moment for view to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Add print classes to body to hide UI elements and set landscape orientation
      document.body.classList.add('print-mode');
      document.body.classList.add('weekly-print-mode');

      // Print
      window.print();

      // Clean up
      document.body.classList.remove('print-mode');
      document.body.classList.remove('weekly-print-mode');

      // Restore original view
      if (originalView || currentView !== 'dayGridWeek') {
        calendarRef.current.getApi().changeView(originalView || currentView);
      }

      toast({
        title: 'הדפסה הושלמה',
        description: 'הלוח השבועי נשלח להדפסה',
      });
    } catch (error) {
      console.error('Print error:', error);
      document.body.classList.remove('print-mode');
      document.body.classList.remove('weekly-print-mode');
      if (originalView) {
        calendarRef.current?.getApi().changeView(originalView);
      }
      toast({
        title: 'שגיאה בהדפסה',
        description: 'נסה שוב',
        variant: 'destructive',
      });
    }
  }, [originalView, toast]);

  const handleDailyPrint = useCallback(async (printDate?: Date) => {
    try {
      const dateToUse = printDate || selectedPrintDate;
      if (!dateToUse) {
        console.error('No date selected for printing');
        toast({
          title: 'שגיאה בהדפסה',
          description: 'לא נבחר תאריך להדפסה',
          variant: 'destructive',
        });
        return;
      }

      console.log('Starting daily print for date:', dateToUse);

      // Get the date string for filtering events
      const targetDateString = formatJerusalemDate(dateToUse);
      
      // Filter events for the selected date
      const dayEvents = allEvents.filter(event => {
        const eventDateString = event.allDay 
          ? event.start // All-day events use YYYY-MM-DD format
          : formatJerusalemDate(new Date(event.start)); // Extract date from datetime
        return eventDateString === targetDateString;
      });

      // Sort events chronologically from top to bottom - Pure chronological order
      dayEvents.sort((a, b) => {
        // First: All-day events come before timed events
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        
        // For all-day events, sort by priority: tasks with occupants first, then by type, then alphabetically
        if (a.allDay && b.allDay) {
          // For tasks, prioritize those with occupants
          if (a.extendedProps?.type === 'task' && b.extendedProps?.type === 'task') {
            const aHasOccupant = (a.extendedProps?.type === 'task' && 'hasOccupant' in a.extendedProps) ? a.extendedProps.hasOccupant : false;
            const bHasOccupant = (b.extendedProps?.type === 'task' && 'hasOccupant' in b.extendedProps) ? b.extendedProps.hasOccupant : false;
            if (aHasOccupant !== bHasOccupant) {
              return aHasOccupant ? -1 : 1; // Tasks with occupants first
            }
          }
          
          // Sort by type priority for all-day events
          const getTypePriority = (event: any) => {
            if (event.extendedProps?.type === 'task') return 1;
            if (event.extendedProps?.type === 'event') return 2;
            if (event.extendedProps?.type === 'profile') return 3;
            return 4;
          };
          
          const typeDiff = getTypePriority(a) - getTypePriority(b);
          if (typeDiff !== 0) return typeDiff;
          
          // Finally, sort alphabetically by title for all-day events
          return a.title.localeCompare(b.title, 'he');
        }
        
        // For timed events, sort purely by time chronologically
        if (!a.allDay && !b.allDay) {
          const timeA = new Date(a.start).getTime();
          const timeB = new Date(b.start).getTime();
          if (timeA !== timeB) return timeA - timeB;
          
          // If same time, sort by title
          return a.title.localeCompare(b.title, 'he');
        }
        
        return 0;
      });

      // Create custom print HTML structure - Clean list format with compact layout for printing
      const printHTML = `
        <div id="daily-print-container" style="font-family: 'Heebo', sans-serif; direction: rtl; padding: 0; margin: 0; line-height: 1.4;">
          <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            <h1 style="font-size: 22px; font-weight: bold; margin: 0; color: #1f2937;">
              יומן יומי
            </h1>
            <h2 style="font-size: 16px; font-weight: 600; margin: 8px 0 0 0; color: #4b5563;">
              ${format(dateToUse, 'dd/MM/yyyy - EEEE', { locale: he })}
            </h2>
          </div>
          <div style="max-width: 100%; margin: 0;">
            ${dayEvents.length === 0 
              ? `<div style="text-align: center; color: #9ca3af; font-size: 16px; padding: 30px 10px;">
                   אין משימות או אירועים ליום זה
                 </div>`
              : dayEvents.map(event => {
                  const isTask = event.extendedProps?.type === 'task';
                  const isEvent = event.extendedProps?.type === 'event';
                  const isProfile = event.extendedProps?.type === 'profile';
                  
                  // Format time display
                  let timeDisplay = '';
                  if (!event.allDay) {
                    const eventTime = new Date(event.start);
                    // Subtract Jerusalem offset to show original time (reverse the display offset)
                    const offset = getJerusalemOffset();
                    eventTime.setHours(eventTime.getHours() - offset);
                    timeDisplay = format(eventTime, 'HH:mm', { locale: he });
                  }
                  
                  // Get appropriate colors - Green for tasks, Purple for events
                  let color = '#6b7280'; // Default gray
                  if (isTask) {
                    color = '#059669'; // Green for tasks
                  } else if (isEvent) {
                    color = '#7c3aed'; // Purple for events  
                  } else if (isProfile) {
                    color = '#3b82f6'; // Blue for profile events
                  }
                  
                  return `
                    <div style="
                      margin-bottom: 6px; 
                      padding: 6px 10px; 
                      border: 1px solid #e5e7eb;
                      border-radius: 6px;
                      background-color: #fafafa;
                      display: flex;
                      align-items: flex-start;
                      gap: 8px;
                      page-break-inside: avoid;
                    ">
                      <div style="
                        font-size: 11px; 
                        font-weight: 700; 
                        min-width: 55px;
                        text-align: center;
                        background-color: ${color};
                        color: white;
                        padding: 4px 6px;
                        border-radius: 4px;
                        flex-shrink: 0;
                      ">
                        ${timeDisplay || 'כל היום'}
                      </div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="
                          font-size: 13px; 
                          font-weight: 600; 
                          color: #1f2937; 
                          line-height: 1.2;
                        ">
                          ${event.title}
                        </div>
                        ${(event.extendedProps && 'note' in event.extendedProps && event.extendedProps.note) ? `
                          <div style="
                            font-size: 11px; 
                            color: #6b7280; 
                            font-style: italic;
                            line-height: 1.3;
                            margin-top: 2px;
                            word-wrap: break-word;
                          ">
                            ${event.extendedProps.note}
                          </div>
                        ` : ''}
                        ${isTask && event.extendedProps && 'hasOccupant' in event.extendedProps && event.extendedProps.hasOccupant ? `
                          <div style="
                            font-size: 10px; 
                            color: #059669; 
                            font-weight: 500;
                            margin-top: 2px;
                          ">
                            ✓ עם דייר
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')
            }
          </div>
        </div>
      `;

      // Remove any existing print container
      const existingContainer = document.getElementById('daily-print-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create and append the print container
      const printContainer = document.createElement('div');
      printContainer.innerHTML = printHTML;
      document.body.appendChild(printContainer);

      // Add print class to body to hide UI elements and show custom content
      document.body.classList.add('daily-print-mode');

      // Show print confirmation
      toast({
        title: 'מכין להדפסה',
        description: `מציג את הרשימה היומית ל-${format(dateToUse, 'dd/MM/yyyy', { locale: he })}`,
      });

      // Wait a moment for content to render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Print
      window.print();

      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.classList.remove('daily-print-mode');
        
        // Remove the print container
        const container = document.getElementById('daily-print-container');
        if (container) {
          container.remove();
        }

        toast({
          title: 'הדפסה הושלמה',
          description: `הרשימה היומית ל-${format(dateToUse, 'dd/MM/yyyy', { locale: he })} נשלחה להדפסה`,
        });
      }, 1000);

    } catch (error) {
      console.error('Print error:', error);
      
      // Ensure cleanup on error
      document.body.classList.remove('daily-print-mode');
      
      // Remove any print container
      const container = document.getElementById('daily-print-container');
      if (container) {
        container.remove();
      }
      
      toast({
        title: 'שגיאה בהדפסה',
        description: 'נסה שוב. אם הבעיה נמשכת, נסה לרענן את העמוד.',
        variant: 'destructive',
      });
    }
  }, [selectedPrintDate, allEvents, toast]);

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
    <div className={`${isMobile ? 'p-2 pb-20 space-y-3' : 'container mx-auto p-4 space-y-6'}`}>
      {/* Header */}
      {isMobile ? (
        // Mobile Layout - Logo, Title, and Actions
        <div className="space-y-2 px-1">
          {/* Top row - Title, Logo, and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <h1 className="text-lg font-bold">יומן משימות</h1>
            </div>
            
            <img 
              src={logoPath} 
              alt="בית האושר לוגו" 
              className="w-12 h-10 object-contain"
            />
            
            <div className="flex items-center gap-2">
              {/* Weekly Schedule Button */}
              <Button 
                onClick={() => navigate('/weekly-schedule')} 
                variant="outline" 
                size="default"
                className="min-h-[44px]"
                data-testid="button-weekly-schedule-mobile"
              >
                <Clock className="h-5 w-5" />
              </Button>
              {/* Menu Button */}
              <Button 
                onClick={() => navigate('/main')} 
                variant="outline" 
                size="default"
                className="min-h-[44px]"
                data-testid="button-menu"
              >
                <Home className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Desktop Layout - Logo centered like in Header component
        <div className="flex items-center justify-between relative">
          {/* Title on the left */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">יומן משימות</h1>
          </div>

          {/* Logo in center - positioned absolutely like in Header component */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center">
            <img 
              src={logoPath} 
              alt="בית האושר לוגו" 
              className="w-20 h-16 object-contain mb-1"
            />
          </div>

          {/* Actions on the right */}
          <div className="flex items-center gap-2">
            {/* Print Button with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-print"
                >
                  <Printer className="h-4 w-4 ml-1" />
                  הדפס
                  <ChevronDown className="h-3 w-3 mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleWeeklyPrint} data-testid="menu-print-weekly">
                  <CalendarDays className="h-4 w-4 ml-2" />
                  הדפס לוח שבועי
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setPrintDatePickerOpen(true)} 
                  data-testid="menu-print-daily"
                >
                  <CalendarIcon className="h-4 w-4 ml-2" />
                  הדפס לוח יומי
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Weekly Schedule Button */}
            <Button 
              onClick={() => navigate('/weekly-schedule')} 
              variant="outline" 
              size="sm"
              data-testid="button-weekly-schedule"
            >
              <Clock className="h-4 w-4 ml-1" />
              משמרות
            </Button>

            {/* Menu Button */}
            <Button 
              onClick={() => navigate('/main')} 
              variant="outline" 
              size="sm"
              data-testid="button-menu"
            >
              <Home className="h-4 w-4 ml-1" />
              תפריט
            </Button>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <Card className="task-board-floating">
        <CardHeader className={`${isMobile ? 'pb-2 px-3 pt-3' : 'pb-4'}`}>
          {isMobile ? (
            // Mobile Layout
            <div className="space-y-3">
              {/* Mobile Navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={goToPrevious}
                    variant="outline"
                    size="default"
                    className="min-h-[44px] px-3"
                    data-testid="button-prev"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={goToNext}
                    variant="outline"
                    size="default"
                    className="min-h-[44px] px-3"
                    data-testid="button-next"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </div>
                <Button
                  onClick={goToToday}
                  variant="outline"
                  size="default"
                  className="min-h-[44px]"
                  data-testid="button-today"
                >
                  היום
                </Button>
              </div>
              
              {/* Mobile Title */}
              <h2 className="text-lg font-semibold text-center" data-testid="text-calendar-title">
                {currentTitle}
              </h2>
              
              {/* Mobile View Selector - Day and Month views for mobile */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => changeView('dayGridDay')}
                  variant={currentView === 'dayGridDay' ? 'default' : 'outline'}
                  size="default"
                  className="min-h-[44px] flex-1"
                  data-testid="button-day-view"
                >
                  <CalendarDays className="h-4 w-4 ml-1" />
                  יום
                </Button>
                <Button
                  onClick={() => changeView('dayGridMonth')}
                  variant={currentView === 'dayGridMonth' ? 'default' : 'outline'}
                  size="default"
                  className="min-h-[44px] flex-1"
                  data-testid="button-month-view"
                >
                  <Grid3x3 className="h-4 w-4 ml-1" />
                  חודש
                </Button>
              </div>
            </div>
          ) : (
            // Desktop Layout
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
                  onClick={() => changeView('dayGridWeek')}
                  variant={currentView === 'dayGridWeek' ? 'default' : 'outline'}
                  size="sm"
                  data-testid="button-week-view"
                >
                  <Columns className="h-4 w-4 ml-1" />
                  שבוע
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
          {/* Action Buttons */}
          <div className={`${isMobile ? 'flex flex-col gap-2 mb-3' : 'flex items-center gap-2 mb-4'}`}>
            <Button
              onClick={() => {
                // In mobile daily view, use the currently viewed date instead of today
                let targetDate: Date;
                if (isMobile && currentView === 'dayGridDay' && calendarRef.current) {
                  // Get the currently viewed date from FullCalendar
                  const calendarApi = calendarRef.current.getApi();
                  targetDate = calendarApi.getDate();
                } else {
                  // For all other cases (desktop, mobile monthly/weekly view), use today
                  targetDate = createJerusalemDate(getTodayJerusalem());
                }
                
                setSelectedDate(targetDate);
                setSelectedTask(null);
                setDialogMode('create');
                setTaskDialogOpen(true);
              }}
              size={isMobile ? "default" : "default"}
              className={`${isMobile ? 'min-h-[44px] w-full' : ''}`}
              data-testid="button-add-task"
            >
              <Plus className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} ml-1`} />
              משימה חדשה
            </Button>
            <Button
              onClick={handleCreateNewEvent}
              variant="default"
              size={isMobile ? "default" : "default"}
              className={`${isMobile ? 'min-h-[44px] w-full' : ''} bg-purple-600 hover:bg-purple-700 text-white`}
              data-testid="button-new-event"
            >
              <Star className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} ml-1`} />
              אירוע חדש
            </Button>
            <Button
              onClick={() => setFixedChoiceDialogOpen(true)}
              variant="outline"
              size={isMobile ? "default" : "default"}
              className={`${isMobile ? 'min-h-[44px] w-full' : ''}`}
              data-testid="button-fixed-tasks"
            >
              <CalendarDays className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} ml-1`} />
              משימה/אירוע קבוע
            </Button>
            
            {/* Desktop Duplicate Button - Show in desktop week and month views */}
            {!isMobile && (currentView === 'dayGridWeek' || currentView === 'dayGridMonth') && (
              <Button
                onClick={handleDesktopDuplicate}
                variant={duplicateMode ? "default" : "outline"}
                size="default"
                className={`flex items-center gap-2 ${duplicateMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                data-testid="button-duplicate-weekly"
              >
                <Copy className="h-4 w-4" />
                {duplicateMode ? 'בחר יום מקור' : 'שכפל לוז'}
              </Button>
            )}
            
            {/* Desktop Delete Schedule Button */}
            {!isMobile && (
              <Button
                onClick={handleToggleDeleteMode}
                variant={deleteMode ? "destructive" : "outline"}
                size="default"
                className="flex items-center gap-2"
                data-testid="button-delete-schedule"
              >
                <Trash2 className="h-4 w-4" />
                {deleteMode ? 'בטל מחיקה' : 'מחק לוז'}
              </Button>
            )}
          </div>

          {/* FullCalendar Component */}
          <div 
            ref={calendarContainerRef}
            className={`calendar-container ${isMobile ? 'mobile-calendar' : ''} ${duplicateMode ? 'duplicate-mode' : ''} ${deleteMode ? 'delete-mode' : ''}`} 
            data-testid="calendar-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={isMobile ? 'dayGridDay' : 'dayGridWeek'}
              locale={heLocale}
              direction="rtl"
              timeZone="Asia/Jerusalem"
              firstDay={0} // Start week on Sunday
              headerToolbar={false} // We use custom header
              height={currentView === 'dayGridWeek' ? "auto" : (isMobile ? "auto" : "auto")}
              contentHeight={currentView === 'dayGridWeek' ? "auto" : undefined}
              aspectRatio={currentView === 'dayGridWeek' ? (isMobile ? 1.0 : 1.2) : (isMobile ? 0.75 : 1.1)}
              expandRows={currentView === 'dayGridWeek'}
              events={allEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventMouseEnter={isMobile ? undefined : handleEventMouseEnter}
              eventMouseLeave={isMobile ? undefined : handleEventMouseLeave}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              viewDidMount={handleViewDidMount}
              datesSet={handleDatesSet}
              eventDidMount={handleEventDidMount}
              editable={true}
              droppable={true}
              dayMaxEvents={
                currentView === 'dayGridWeek' || (isMobile && currentView === 'dayGridDay') 
                  ? false 
                  : (isMobile ? 5 : 5)
              }
              dayMaxEventRows={
                currentView === 'dayGridWeek' || (isMobile && currentView === 'dayGridDay') 
                  ? false 
                  : (isMobile ? 5 : 6)
              }
              moreLinkClick={isMobile ? undefined : "popover"}
              moreLinkDidMount={isMobile ? handleMoreLinkMount : undefined}
              fixedWeekCount={false}
              showNonCurrentDates={false}
              selectAllow={handleDateAllow}
              dayCellClassNames={handleDayCellClassNames}
              dayCellDidMount={handleDayCellDidMount}
              dayHeaderDidMount={handleDayHeaderDidMount}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              slotDuration={isMobile ? "00:30:00" : "00:15:00"}
              slotLabelInterval={isMobile ? "02:00:00" : "01:00:00"}
              allDaySlot={true}
              allDayText="כל היום"
              nowIndicator={true}
              eventDisplay={currentView === 'dayGridWeek' ? "block" : (isMobile ? "block" : "auto")}
              eventMinHeight={currentView === 'dayGridWeek' ? 20 : (isMobile ? 28 : 15)}
              eventOrder={(a: any, b: any) => {
                // Apply chronological sorting for both week and day views
                if (currentView === 'dayGridWeek' || currentView === 'dayGridDay') {
                  // Sort by all-day status first (all-day events at top)
                  if (a.allDay && !b.allDay) return -1;
                  if (!a.allDay && b.allDay) return 1;
                  
                  // For timed events, sort by start time (chronological)
                  if (!a.allDay && !b.allDay) {
                    const timeA = a.start ? new Date(a.start).getTime() : 0;
                    const timeB = b.start ? new Date(b.start).getTime() : 0;
                    return timeA - timeB;
                  }
                  
                  // For all-day events, sort by title alphabetically
                  return a.title.localeCompare(b.title, 'he');
                }
                
                // Default sorting for other views
                return 0;
              }}
              businessHours={{
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
                startTime: '08:00',
                endTime: '22:00',
              }}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false, // Use 24-hour format
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false, // Use 24-hour format
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Notes Section */}
      <Card ref={notesCardRef} className={isMobile ? 'mb-4' : ''}>
        <CardHeader className={`${isMobile ? 'pb-2 px-3 pt-3' : 'pb-3'}`}>
          {isMobile ? (
            // Mobile Notes Header
            <div className="space-y-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                הערות שבועיות
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const weekStart = createJerusalemDate(notesWeekStartDate);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  return `${format(weekStart, 'dd/MM', { locale: he })} - ${format(weekEnd, 'dd/MM', { locale: he })}`;
                })()}
              </div>
              <div className="flex items-center justify-between">
                {lastSaved && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-saved">
                    <CheckCircle className="h-3 w-3" />
                    נשמר {format(lastSaved, 'HH:mm', { locale: he })}
                  </span>
                )}
                <Button
                  onClick={handleManualSave}
                  disabled={isSaving || !notesContent.trim()}
                  size="default"
                  variant="outline"
                  className="min-h-[44px] px-4"
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
          ) : (
            // Desktop Notes Header
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                הערות שבועיות - {(() => {
                  const weekStart = createJerusalemDate(notesWeekStartDate);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  return `${format(weekStart, 'dd/MM', { locale: he })} - ${format(weekEnd, 'dd/MM', { locale: he })}`;
                })()}
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
          )}
        </CardHeader>
        <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
          {noteLoading ? (
            <Skeleton className={`${isMobile ? 'h-24' : 'h-32'} w-full`} />
          ) : (
            <Textarea
              ref={notesTextareaRef}
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="הזן הערות לשבוע זה..."
              className={`${isMobile ? 'min-h-24 text-base' : 'min-h-32'} resize-none`}
              data-testid="textarea-notes"
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Mode Floating Action Bar - Responsive for mobile and desktop */}
      {deleteMode && (
        <div 
          className={`fixed left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded-xl shadow-2xl z-[400] ${
            isMobile 
              ? 'bottom-20 p-3 flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm' 
              : 'bottom-4 p-4 flex items-center gap-4'
          }`}
          style={{ maxWidth: isMobile ? undefined : '90vw' }}
        >
          {/* Header row */}
          <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-2'}`}>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
              <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>מצב מחיקה</span>
            </div>
            
            {!isMobile && <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />}
            
            <div className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {selectedDeleteDates.size === 0 ? (
                <span>לחץ על ימים בלוח</span>
              ) : (
                <span className="font-medium text-red-600 dark:text-red-400">
                  נבחרו {selectedDeleteDates.size} ימים
                </span>
              )}
            </div>
          </div>
          
          {!isMobile && <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />}
          
          {/* Action buttons */}
          <div className={`flex items-center ${isMobile ? 'gap-2 w-full' : 'gap-2'}`}>
            <Button
              onClick={handleCancelDeleteMode}
              variant="outline"
              size={isMobile ? 'default' : 'sm'}
              disabled={isDeleting}
              className={`flex items-center gap-1 ${isMobile ? 'flex-1 min-h-[44px]' : ''}`}
            >
              <X className="h-4 w-4" />
              ביטול
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={selectedDeleteDates.size === 0 || isDeleting}
              size={isMobile ? 'default' : 'sm'}
              className={`bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 ${isMobile ? 'flex-1 min-h-[44px]' : ''}`}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              אישור
            </Button>
          </div>
        </div>
      )}

      {/* Duplicate Mode Floating Action Bar - Shows when in duplicate mode */}
      {duplicateMode && (
        <div 
          className={`fixed left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded-xl shadow-2xl z-[400] ${
            isMobile 
              ? 'bottom-20 p-3 flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm' 
              : 'bottom-4 p-4 flex items-center gap-4'
          }`}
          style={{ maxWidth: isMobile ? undefined : '90vw' }}
        >
          {/* Header row */}
          <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-2'}`}>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Copy className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
              <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>מצב שכפול</span>
            </div>
            
            {!isMobile && <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />}
            
            <div className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              <span>לחץ על יום מקור לשכפול</span>
            </div>
          </div>
          
          {!isMobile && <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />}
          
          {/* Cancel button */}
          <div className={`flex items-center ${isMobile ? 'gap-2 w-full' : 'gap-2'}`}>
            <Button
              onClick={() => setDuplicateMode(false)}
              variant="outline"
              size={isMobile ? 'default' : 'sm'}
              className={`flex items-center gap-1 ${isMobile ? 'flex-1 min-h-[44px]' : ''}`}
              data-testid="button-cancel-duplicate-mode"
            >
              <X className="h-4 w-4" />
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Daily Tasks Mobile Dialog */}
      <DailyTasksDialog
        open={dailyTasksDialogOpen}
        onOpenChange={setDailyTasksDialogOpen}
        selectedDate={selectedDailyDate}
        tasks={selectedDailyDate && dailyTasks ? dailyTasks.filter(task => {
          const taskDateStr = task.date instanceof Date ? formatJerusalemDate(task.date) : String(task.date).split('T')[0];
          const selectedDateStr = formatJerusalemDate(selectedDailyDate);
          return taskDateStr === selectedDateStr;
        }) : []}
        events={selectedDailyDate && events ? events.filter(event => {
          const eventDateStr = event.date instanceof Date ? formatJerusalemDate(event.date) : String(event.date).split('T')[0];
          const selectedDateStr = formatJerusalemDate(selectedDailyDate);
          return eventDateStr === selectedDateStr;
        }) : []}
        profileEvents={selectedDailyDate && profileEvents ? profileEvents.filter(event => {
          const eventDateStr = event.start.split('T')[0];
          const selectedDateStr = formatJerusalemDate(selectedDailyDate);
          return eventDateStr === selectedDateStr;
        }) : []}
        onEditTask={(task: SelectDailyTask) => {
          setSelectedTask(task);
          setSelectedDate(new Date(task.date));
          setDialogMode('edit');
          setTaskDialogOpen(true);
          setDailyTasksDialogOpen(false);
        }}
        onEditEvent={(event: SelectEvent) => {
          setSelectedEvent(event);
          setSelectedDate(new Date(event.date));
          setEventDialogMode('edit');
          setEventDialogOpen(true);
          setDailyTasksDialogOpen(false);
        }}
        onCreateTask={() => {
          if (selectedDailyDate) {
            setSelectedDate(selectedDailyDate);
            setSelectedTask(null);
            setDialogMode('create');
            setTaskDialogOpen(true);
            setDailyTasksDialogOpen(false);
          }
        }}
        onCreateEvent={() => {
          if (selectedDailyDate) {
            setSelectedDate(selectedDailyDate);
            setSelectedEvent(null);
            setEventDialogMode('create');
            setEventDialogOpen(true);
            setDailyTasksDialogOpen(false);
          }
        }}
        onDuplicateSchedule={() => {
          if (selectedDailyDate) {
            setDuplicateSourceDate(selectedDailyDate);
            setDailyTasksDialogOpen(false);
            setDuplicateDialogOpen(true);
          }
        }}
        onDeleteSchedule={() => {
          setDailyTasksDialogOpen(false);
          setDeleteMode(true);
          setSelectedDeleteDates(new Set());
        }}
        getOccupantName={getOccupantName}
        isPastDate={selectedDailyDate ? isPastDate(formatJerusalemDate(selectedDailyDate)) : false}
        isMobile={isMobile}
      />

      {/* Duplicate Schedule Dialog */}
      <DuplicateScheduleDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        sourceDate={duplicateSourceDate || new Date()}
        currentWeekStart={calendarRef.current ? calendarRef.current.getApi().view.currentStart : new Date()}
        onSuccess={(targetDate) => {
          // Navigate to the duplicated target date after successful duplication
          if (targetDate && calendarRef.current) {
            // Force refresh of calendar data
            const api = calendarRef.current.getApi();
            api.refetchEvents();
            
            // Navigate to the target date (where the schedule was duplicated to)
            api.gotoDate(targetDate);
            
            // Switch to mobile daily view for better visualization of duplicated content
            if (isMobile) {
              api.changeView('dayGridDay');
            }
            
            const targetDateString = format(targetDate, 'dd/MM/yyyy - EEEE', { locale: he });
            toast({
              title: 'לוח זמנים שוכפל בהצלחה',
              description: `מעבר לתאריך היעד: ${targetDateString}`,
              variant: 'default',
            });
          }
        }}
      />


      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        selectedDate={selectedDate || undefined}
        task={selectedTask}
        mode={dialogMode}
      />

      {/* Event Dialog */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        selectedDate={selectedDate || undefined}
        event={selectedEvent}
        mode={eventDialogMode}
      />

      {/* Choice Dialog - Select Task or Event Creation */}
      <AlertDialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
        <AlertDialogContent dir="rtl" className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              מה תרצה להוסיף?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {choiceDialogDate && (
                <span className="text-sm text-muted-foreground">
                  {format(choiceDialogDate, 'EEEE, dd MMMM yyyy', { locale: he })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row justify-center">
            <AlertDialogCancel data-testid="button-cancel-choice">
              ביטול
            </AlertDialogCancel>
            <Button
              onClick={handleChoiceTask}
              variant="default"
              className="flex items-center gap-2"
              data-testid="button-choice-task"
            >
              <CheckCircle className="w-4 h-4" />
              הוספת משימה
            </Button>
            <Button
              onClick={handleChoiceEvent}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="button-choice-event"
            >
              <Star className="w-4 h-4" />
              הוספת אירוע
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fixed Task/Event Choice Dialog */}
      <AlertDialog open={fixedChoiceDialogOpen} onOpenChange={setFixedChoiceDialogOpen}>
        <AlertDialogContent dir="rtl" className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              איזה סוג תרצה להוסיף?
            </AlertDialogTitle>
            <AlertDialogDescription>
              בחר אם אתה רוצה ליצור משימה קבועה או אירוע קבוע.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row justify-center">
            <AlertDialogCancel data-testid="button-cancel-fixed-choice">
              ביטול
            </AlertDialogCancel>
            <Button
              onClick={handleFixedChoiceTask}
              variant="default"
              className="flex items-center gap-2"
              data-testid="button-fixed-choice-task"
            >
              <CheckCircle className="w-4 h-4" />
              משימה קבועה
            </Button>
            <Button
              onClick={handleFixedChoiceEvent}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="button-fixed-choice-event"
            >
              <Star className="w-4 h-4" />
              אירוע קבוע
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Task Dialog */}
      <BulkTaskDialog
        open={bulkTaskDialogOpen}
        onOpenChange={setBulkTaskDialogOpen}
      />

      {/* Bulk Event Dialog */}
      <BulkEventDialog
        open={bulkEventDialogOpen}
        onOpenChange={setBulkEventDialogOpen}
      />
      
      {/* Desktop Duplicate Schedule Dialog */}
      {!isMobile && (
        <DuplicateScheduleDialog
          open={desktopDuplicateDialogOpen}
          onOpenChange={(open) => {
            setDesktopDuplicateDialogOpen(open);
            // Clear source date when dialog is closed
            if (!open) {
              setDuplicateSourceDate(null);
            }
          }}
          sourceDate={duplicateSourceDate || undefined}
          currentWeekStart={calendarRef.current ? calendarRef.current.getApi().view.currentStart : new Date()}
          onSuccess={handleDesktopDuplicateSuccess}
        />
      )}

      {/* Profile Event Dialog */}
      <ProfileEventDialog
        isOpen={profileEventDialogOpen}
        onClose={() => setProfileEventDialogOpen(false)}
        eventData={selectedProfileEvent}
        onEditPatient={(occupantId: string) => {
          // Use the specific occupant ID from the event
          setSelectedOccupantForDetails(occupantId);
          setOccupantDetailsOpen(true);
          setProfileEventDialogOpen(false);
        }}
      />

      {/* Occupant Details Dialog */}
      <OccupantDetails
        isOpen={occupantDetailsOpen}
        onClose={() => {
          setOccupantDetailsOpen(false);
          setSelectedOccupantForDetails(null); // Reset selected occupant
        }}
        occupants={occupants}
        rooms={rooms || []}
        onEdit={() => {}} // Not needed for calendar context
        onDelete={() => {}} // Not needed for calendar context
        initialOccupantId={selectedOccupantForDetails || undefined}
      />

      {/* Daily Print Date Picker Dialog */}
      <AlertDialog open={printDatePickerOpen} onOpenChange={setPrintDatePickerOpen}>
        <AlertDialogContent dir="rtl" className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              בחר תאריך להדפסה יומית
            </AlertDialogTitle>
            <AlertDialogDescription>
              בחר את התאריך שברצונך להדפיס את הרשימה היומית שלו
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center py-4">
            <CalendarPicker
              mode="single"
              selected={selectedPrintDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedPrintDate(date);
                }
              }}
              initialFocus
              locale={he}
              dir="rtl"
              className="border-0"
            />
          </div>
          <AlertDialogFooter className="gap-2 flex-row justify-center">
            <AlertDialogCancel data-testid="button-cancel-print">
              ביטול
            </AlertDialogCancel>
            <Button
              onClick={() => {
                if (selectedPrintDate) {
                  setPrintDatePickerOpen(false);
                  handleDailyPrint(selectedPrintDate);
                }
              }}
              variant="default"
              className="flex items-center gap-2"
              data-testid="button-confirm-print"
            >
              <Printer className="w-4 h-4" />
              הדפס
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Notes Tooltip */}
      {tooltipState.show && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 max-w-xs pointer-events-none task-tooltip"
          style={{
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
            transform: 'translate(-50%, -100%)', // Center horizontally, position above
          }}
          data-testid="tooltip-task-note"
        >
          <div className="font-semibold mb-1 text-right" dir="rtl">
            {tooltipState.taskTitle}
          </div>
          <div className="text-gray-200 text-right break-words" dir="rtl">
            {tooltipState.content}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 top-full transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}