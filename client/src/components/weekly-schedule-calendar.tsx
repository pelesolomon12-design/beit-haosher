import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Eye, 
  EyeOff,
  Users,
  UserPlus,
  Briefcase,
  Trash2,
  Loader2,
  Check,
  Maximize2,
  Minimize2,
  X,
  Pencil,
  Copy
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { SelectStaffMember, SelectScheduleEvent, STAFF_PASTEL_COLORS } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const UNASSIGNED_COLOR = '#d1d5db'; // Gray-300 for unassigned shifts
const UNASSIGNED_BORDER = '#9ca3af'; // Gray-400 for border

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface ScheduleEventWithStaff extends SelectScheduleEvent {
  staffMember?: SelectStaffMember;
  staffMembers?: SelectStaffMember[];
}

const scheduleEventFormSchema = z.object({
  title: z.string().optional(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה"),
  endDateOffset: z.number().min(0).max(2).default(0), // 0 = same day, 1 = tomorrow, 2 = day after tomorrow
  staffMemberIds: z.array(z.string()).optional(),
  note: z.string().optional(),
});

type ScheduleEventFormData = z.infer<typeof scheduleEventFormSchema>;

export function WeeklyScheduleCalendar() {
  const { toast } = useToast();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 0 });
  });
  
  const [activeLayer, setActiveLayer] = useState<'staff' | 'management'>('staff');
  
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEventWithStaff | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogLayer, setDialogLayer] = useState<'staff' | 'management'>('staff');
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  
  // Track clicked cell for visual indicator
  const [clickedCell, setClickedCell] = useState<{ dayIdx: number; hour: number } | null>(null);
  
  // Drag and drop state with pointer threshold
  const [draggedEvent, setDraggedEvent] = useState<ScheduleEventWithStaff | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [resizingEvent, setResizingEvent] = useState<ScheduleEventWithStaff | null>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  
  // Pointer tracking for click vs drag distinction
  const pointerStartRef = useRef<{ x: number; y: number; event: ScheduleEventWithStaff | null; time: number; pointerId?: number } | null>(null);
  const [isPotentialDrag, setIsPotentialDrag] = useState(false);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ top: number; dayIdx: number } | null>(null);
  const DRAG_THRESHOLD = 8; // pixels before drag starts
  
  const [newStaffName, setNewStaffName] = useState('');
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<string>('');
  const [newOtherName, setNewOtherName] = useState('');
  const [addOtherPopoverOpen, setAddOtherPopoverOpen] = useState(false);
  const [addManagerPopoverOpen, setAddManagerPopoverOpen] = useState(false);
  
  // Management event editing state
  const [mgmtEditingEvent, setMgmtEditingEvent] = useState<ScheduleEventWithStaff | null>(null);
  const [managementCellDialog, setManagementCellDialog] = useState<{
    open: boolean;
    managerId: string;
    managerName: string;
    date: Date;
    events: ScheduleEventWithStaff[];
  } | null>(null);
  
  // Inline form state for management cell dialog
  const [mgmtFormTitle, setMgmtFormTitle] = useState('');
  const [mgmtFormStartTime, setMgmtFormStartTime] = useState('09:00');
  const [mgmtFormEndTime, setMgmtFormEndTime] = useState('17:00');
  const [mgmtFormNote, setMgmtFormNote] = useState('');

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  
  // Expanded/full-screen mode state
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Duplicate week mode state
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [sourceWeekStart, setSourceWeekStart] = useState<Date | null>(null);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  
  // Mobile detection - disable drag/resize on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  

  const form = useForm<ScheduleEventFormData>({
    resolver: zodResolver(scheduleEventFormSchema),
    defaultValues: {
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      endDateOffset: 0,
      staffMemberIds: [],
      note: ''
    },
  });

  // Auto-select "tomorrow" when end time is less than start time (overnight shift)
  const watchStartTime = form.watch('startTime');
  const watchEndTime = form.watch('endTime');
  const watchEndDateOffset = form.watch('endDateOffset');
  
  useEffect(() => {
    if (watchStartTime && watchEndTime) {
      const [startHour, startMin] = watchStartTime.split(':').map(Number);
      const [endHour, endMin] = watchEndTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      // If end time is less than start time, it's an overnight shift - auto-select tomorrow
      // Only auto-select if user hasn't manually selected a higher value (day after tomorrow)
      if (endMinutes < startMinutes && (watchEndDateOffset === 0 || watchEndDateOffset === undefined)) {
        form.setValue('endDateOffset', 1);
      }
    }
  }, [watchStartTime, watchEndTime, watchEndDateOffset, form]);

  const weekEnd = useMemo(() => endOfDay(addDays(currentWeekStart, 6)), [currentWeekStart]);

  const { data: staffMembers = [], isLoading: staffLoading } = useQuery<SelectStaffMember[]>({
    queryKey: ['/api/staff-members'],
  });

  const { data: scheduleEvents = [], isLoading: eventsLoading } = useQuery<SelectScheduleEvent[]>({
    queryKey: ['/api/schedule-events', currentWeekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const response = await fetch(
        `/api/schedule-events?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`
      );
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return await apiRequest('POST', '/api/schedule-events', eventData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      toast({ title: 'האירוע נוצר בהצלחה' });
      closeEventDialog();
    },
    onError: () => {
      toast({ title: 'שגיאה ביצירת האירוע', variant: 'destructive' });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PATCH', `/api/schedule-events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      toast({ title: 'האירוע עודכן בהצלחה' });
      closeEventDialog();
    },
    onError: () => {
      toast({ title: 'שגיאה בעדכון האירוע', variant: 'destructive' });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/schedule-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      toast({ title: 'האירוע נמחק בהצלחה' });
      closeEventDialog();
    },
    onError: () => {
      toast({ title: 'שגיאה במחיקת האירוע', variant: 'destructive' });
    },
  });

  const duplicateWeekMutation = useMutation({
    mutationFn: async (data: { sourceWeekStart: string; targetWeekStart: string; overwrite: boolean }) => {
      return await apiRequest('POST', '/api/schedule-events/duplicate-management-week', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      toast({ title: data.message || 'השבוע שוכפל בהצלחה' });
      setDuplicateConfirmOpen(false);
      setOverwriteExisting(false);
      setTimeout(() => {
        setIsDuplicateMode(false);
        setSourceWeekStart(null);
      }, 100);
    },
    onError: (error: any) => {
      const errorData = error?.response?.data || error?.data || {};
      toast({ 
        title: errorData.error || 'שגיאה בשכפול השבוע', 
        description: errorData.message,
        variant: 'destructive' 
      });
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: { name: string; role?: 'staff' | 'management' | 'other' }) => {
      return await apiRequest('POST', '/api/staff-members', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-members'] });
      toast({ title: 'נוסף בהצלחה' });
      setNewStaffName('');
    },
    onError: () => {
      toast({ title: 'שגיאה בהוספה', variant: 'destructive' });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/staff-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-members'] });
      toast({ title: 'עובד נמחק בהצלחה' });
    },
    onError: () => {
      toast({ title: 'שגיאה במחיקת עובד', variant: 'destructive' });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; role: 'staff' | 'management' | 'other' }> }) => {
      return await apiRequest('PATCH', `/api/staff-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-members'] });
      toast({ title: 'העובד עודכן בהצלחה' });
    },
    onError: () => {
      toast({ title: 'שגיאה בעדכון העובד', variant: 'destructive' });
    },
  });

  const eventsWithStaff = useMemo<ScheduleEventWithStaff[]>(() => {
    return scheduleEvents.map((event: any) => {
      const eventStaffMembers = event.staffMembers || [];
      const legacyStaff = event.staffMemberId ? staffMembers.find(s => s.id === event.staffMemberId) : null;
      return {
        ...event,
        staffMember: legacyStaff || eventStaffMembers[0] || null,
        staffMembers: eventStaffMembers.length > 0 ? eventStaffMembers : (legacyStaff ? [legacyStaff] : []),
      };
    });
  }, [scheduleEvents, staffMembers]);

  const timeRangeHours = useMemo(() => {
    return { minHour: 9, maxHour: 8 }; // 9 AM to 9 AM next day (24 hours starting from 9)
  }, []);

  const hoursToShow = useMemo(() => {
    // Create hours array from 9 AM to 8 AM (next day): 9, 10, 11, ..., 23, 0, 1, 2, ..., 8
    const hours = [];
    for (let h = 9; h <= 23; h++) {
      hours.push(h);
    }
    for (let h = 0; h <= 8; h++) {
      hours.push(h);
    }
    return hours;
  }, []);
  
  // Helper to get the visual index of an hour (for positioning)
  const getHourIndex = useCallback((hour: number) => {
    if (hour >= 9) {
      return hour - 9; // 9->0, 10->1, ..., 23->14
    } else {
      return hour + 15; // 0->15, 1->16, ..., 8->23
    }
  }, []);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  // Filter managers for management calendar (role = 'management' or 'other')
  const managers = useMemo(() => {
    return staffMembers.filter(m => m.role === 'management' || m.role === 'other');
  }, [staffMembers]);

  // Get management events for a specific manager on a specific date
  const getManagerEventsForDay = useCallback((managerId: string, date: Date) => {
    return eventsWithStaff.filter(event => {
      if (event.layer !== 'management') return false;
      
      // Check if this manager is assigned to the event
      const isManagerAssigned = event.staffMembers?.some(s => s.id === managerId) || 
                                event.staffMemberId === managerId;
      if (!isManagerAssigned) return false;
      
      const eventDate = new Date(event.date);
      return isSameDay(eventDate, date);
    });
  }, [eventsWithStaff]);

  const getEventsForDay = useCallback((date: Date, layer: 'staff' | 'management') => {
    return eventsWithStaff.filter(event => {
      if (event.layer !== layer) return false;
      
      const eventDate = new Date(event.date);
      const eventEndDate = event.endDate ? new Date(event.endDate) : null;
      
      // Event starts on this day
      if (isSameDay(eventDate, date)) {
        return true;
      }
      
      // Multi-day event: check if date falls within the range
      if (eventEndDate) {
        // Normalize dates to compare just the date part
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const startOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        const endOnly = new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate());
        
        // Check if date is between start and end (inclusive of end, exclusive of start since we already checked it)
        if (dateOnly > startOnly && dateOnly <= endOnly) {
          return true;
        }
      }
      
      return false;
    });
  }, [eventsWithStaff]);

  // Check if this is a continuation part of a multi-day event (any day after start date)
  const isEventContinuation = useCallback((event: ScheduleEventWithStaff, date: Date) => {
    const eventDate = new Date(event.date);
    // If this is not the start date, it's a continuation
    return !isSameDay(eventDate, date);
  }, []);
  
  // Check if this is the final day of a multi-day event
  const isEventFinalDay = useCallback((event: ScheduleEventWithStaff, date: Date) => {
    const eventEndDate = event.endDate ? new Date(event.endDate) : null;
    return eventEndDate && isSameDay(eventEndDate, date);
  }, []);

  // Check if event spans midnight (endTime < startTime)
  const isEventCrossMidnight = useCallback((event: ScheduleEventWithStaff) => {
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = event.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes < startMinutes;
  }, []);

  const getEventPosition = useCallback((event: ScheduleEventWithStaff, partOfDay?: 'first' | 'second', currentDate?: Date) => {
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = event.endTime.split(':').map(Number);
    
    const hourHeight = 60;
    
    // Check if this is a multi-day event
    const eventStartDate = new Date(event.date);
    const eventEndDate = event.endDate ? new Date(event.endDate) : null;
    
    // For multi-day events
    if (eventEndDate && currentDate) {
      const isOnStartDate = isSameDay(eventStartDate, currentDate);
      const isOnEndDate = isSameDay(eventEndDate, currentDate);
      
      if (isOnStartDate) {
        // On start date: show from startTime to end of visible range (8:59 next day = index 23)
        const startMinutes = getHourIndex(startH) * 60 + startM;
        const endMinutes = 24 * 60 - 1; // End of visible range
        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
        return { top, height };
      } else if (isOnEndDate) {
        // On end date: show from start of visible range to endTime
        const startMinutes = 0;
        const endMinutes = getHourIndex(endH) * 60 + endM;
        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
        return { top, height };
      } else {
        // Middle day: show full visible range
        const startMinutes = 0;
        const endMinutes = 24 * 60 - 1;
        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
        return { top, height };
      }
    }
    
    // Legacy cross-midnight handling (for old events without endDate)
    const crossesMidnight = isEventCrossMidnight(event);
    
    if (crossesMidnight) {
      if (partOfDay === 'first') {
        // First part: from start time to end of visible range
        const startMinutes = getHourIndex(startH) * 60 + startM;
        const endMinutes = 24 * 60 - 1;
        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
        return { top, height };
      } else if (partOfDay === 'second') {
        // Second part: from start of visible range to end time
        const startMinutes = 0;
        const endMinutes = getHourIndex(endH) * 60 + endM;
        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
        return { top, height };
      }
    }
    
    // Normal non-crossing event
    const startMinutes = getHourIndex(startH) * 60 + startM;
    const endMinutes = getHourIndex(endH) * 60 + endM;
    
    const top = (startMinutes / 60) * hourHeight;
    const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 20);
    
    return { top, height };
  }, [getHourIndex, isEventCrossMidnight]);

  const openCreateDialog = useCallback((date: Date, layer: 'staff' | 'management', hour?: number, dayIdx?: number) => {
    setSelectedEvent(null);
    setDialogMode('create');
    setDialogLayer(layer);
    setDialogDate(date);
    setSelectedStaffIds([]);
    
    // Set clicked cell for visual indicator
    if (dayIdx !== undefined && hour !== undefined) {
      setClickedCell({ dayIdx, hour });
    }
    
    // Auto-populate time based on clicked hour
    const startHour = hour !== undefined ? hour.toString().padStart(2, '0') : '09';
    const endHour = hour !== undefined ? ((hour + 1) % 24).toString().padStart(2, '0') : '10';
    
    form.reset({
      title: '',
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      endDateOffset: 0,
      staffMemberIds: [],
      note: ''
    });
    setEventDialogOpen(true);
  }, [form]);

  const openEditDialog = useCallback((event: ScheduleEventWithStaff) => {
    setSelectedEvent(event);
    setDialogMode('edit');
    setDialogLayer(event.layer as 'staff' | 'management');
    setDialogDate(new Date(event.date));
    const staffIds = event.staffMembers?.map(s => s.id) || (event.staffMemberId ? [event.staffMemberId] : []);
    setSelectedStaffIds(staffIds);
    
    // Calculate endDateOffset from endDate
    let endDateOffset = 0;
    if (event.endDate) {
      const startDate = new Date(event.date);
      const endDate = new Date(event.endDate);
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      endDateOffset = Math.min(Math.max(diffDays, 0), 2);
    }
    
    form.reset({
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      endDateOffset,
      staffMemberIds: staffIds,
      note: event.note || ''
    });
    setEventDialogOpen(true);
  }, [form]);

  const closeEventDialog = useCallback(() => {
    setEventDialogOpen(false);
    setSelectedEvent(null);
    setSelectedStaffIds([]);
    setClickedCell(null);
    form.reset();
  }, [form]);

  // Pointer down handler - tracks start position, doesn't immediately start drag
  const handlePointerDown = useCallback((event: ScheduleEventWithStaff, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    pointerStartRef.current = {
      x: clientX,
      y: clientY,
      event: event,
      time: Date.now()
    };
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setIsPotentialDrag(true);
  }, []);

  const handleResizeStart = useCallback((event: ScheduleEventWithStaff, edge: 'top' | 'bottom', e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizingEvent(event);
    setIsResizing(edge);
  }, []);

  // Use useEffect to add global mouse/touch listeners for potential drag, drag, and resize
  useEffect(() => {
    if (!isPotentialDrag && !isDragging && !isResizing) return;
    
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      
      // Check if we should transition from potential drag to actual drag
      if (isPotentialDrag && pointerStartRef.current && !isDragging) {
        const deltaX = Math.abs(clientX - pointerStartRef.current.x);
        const deltaY = Math.abs(clientY - pointerStartRef.current.y);
        
        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          // Start actual drag
          setDraggedEvent(pointerStartRef.current.event);
          setIsDragging(true);
          setIsPotentialDrag(false);
        }
        return;
      }
      
      // Handle actual drag movement - update preview position
      if (isDragging && draggedEvent) {
        const calendarGrid = calendarGridRef.current;
        if (!calendarGrid) return;
        
        const gridRect = calendarGrid.getBoundingClientRect();
        const relativeY = clientY - gridRect.top - dragOffset.y;
        const relativeX = clientX - gridRect.left;
        
        // Calculate day from X position (accounting for RTL)
        const columnWidth = gridRect.width / 8;
        const adjustedX = gridRect.width - relativeX;
        const dayColumn = Math.floor(adjustedX / columnWidth) - 1;
        const clampedDay = Math.max(0, Math.min(6, dayColumn));
        
        // Management layer snaps to whole hours (60min), staff layer snaps to 15min
        const hourHeight = 60;
        const snapInterval = draggedEvent.layer === 'management' ? 60 : 15;
        const snappedY = Math.round(relativeY / snapInterval) * snapInterval;
        
        // Update preview position for visual feedback
        setDragPreviewPos({
          top: Math.max(0, snappedY),
          dayIdx: clampedDay
        });
      }
    };
    
    const handleGlobalEnd = async (e: MouseEvent | TouchEvent) => {
      // Handle click (pointer up without drag)
      if (isPotentialDrag && !isDragging && pointerStartRef.current?.event) {
        const clickedEvent = pointerStartRef.current.event;
        pointerStartRef.current = null;
        setIsPotentialDrag(false);
        // Open edit dialog for the clicked event
        openEditDialog(clickedEvent);
        return;
      }
      
      pointerStartRef.current = null;
      setIsPotentialDrag(false);
      
      // Use preview position if available, otherwise calculate from pointer
      if (isDragging && draggedEvent && dragPreviewPos) {
        // Calculate time from preview top position
        const hourHeight = 60;
        const isManagement = draggedEvent.layer === 'management';
        const totalMinutes = Math.floor(dragPreviewPos.top / hourHeight) * 60 + 
                            Math.round((dragPreviewPos.top % hourHeight) / hourHeight * 60);
        const newStartHour = Math.max(0, Math.min(23, Math.floor(totalMinutes / 60)));
        // Management snaps to whole hours (minutes = 0), staff snaps to 15-minute increments
        const newStartMinutes = isManagement ? 0 : Math.max(0, Math.min(45, Math.round((totalMinutes % 60) / 15) * 15));
        const newDayIdx = dragPreviewPos.dayIdx;
        
        // Calculate duration of original event
        const [origStartH, origStartM] = draggedEvent.startTime.split(':').map(Number);
        const [origEndH, origEndM] = draggedEvent.endTime.split(':').map(Number);
        const durationMinutes = (origEndH * 60 + origEndM) - (origStartH * 60 + origStartM);
        
        // Calculate new times
        const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMinutes.toString().padStart(2, '0')}`;
        const endMinutesTotal = newStartHour * 60 + newStartMinutes + durationMinutes;
        const newEndHour = Math.floor(endMinutesTotal / 60) % 24;
        const newEndMin = endMinutesTotal % 60;
        const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
        
        // Calculate new date
        const newDate = weekDays[newDayIdx];
        
        // Format date for API
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}T12:00:00.000Z`;
        };
        
        try {
          await updateEventMutation.mutateAsync({
            id: draggedEvent.id,
            data: {
              date: formatLocalDate(newDate),
              startTime: newStartTime,
              endTime: newEndTime,
            }
          });
        } catch (error) {
          console.error('Failed to update event position:', error);
        }
      }
      
      if (isResizing && resizingEvent) {
        const calendarGrid = calendarGridRef.current;
        if (!calendarGrid) {
          setIsResizing(null);
          setResizingEvent(null);
          return;
        }
        
        const gridRect = calendarGrid.getBoundingClientRect();
        const clientY = 'changedTouches' in e ? (e as TouchEvent).changedTouches[0].clientY : (e as MouseEvent).clientY;
        const relativeY = clientY - gridRect.top;
        
        const hourHeight = 60;
        const isManagement = resizingEvent.layer === 'management';
        
        const [origStartH] = resizingEvent.startTime.split(':').map(Number);
        const [origEndH] = resizingEvent.endTime.split(':').map(Number);
        
        if (isResizing === 'top') {
          // For management: snap to nearest hour; for staff: snap to 15-min
          let newStartHour: number;
          let newStartMinutes: number;
          
          if (isManagement) {
            // Round to nearest hour boundary
            newStartHour = Math.round(relativeY / hourHeight);
            newStartMinutes = 0;
          } else {
            newStartHour = Math.floor(relativeY / hourHeight);
            newStartMinutes = Math.round((relativeY % hourHeight) / hourHeight * 60 / 15) * 15;
            if (newStartMinutes === 60) {
              newStartHour += 1;
              newStartMinutes = 0;
            }
          }
          
          newStartHour = Math.max(0, Math.min(origEndH - 1, newStartHour));
          newStartMinutes = Math.max(0, Math.min(45, newStartMinutes));
          const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMinutes.toString().padStart(2, '0')}`;
          
          try {
            await updateEventMutation.mutateAsync({
              id: resizingEvent.id,
              data: { startTime: newStartTime }
            });
          } catch (error) {
            console.error('Failed to resize event:', error);
          }
        } else if (isResizing === 'bottom') {
          // For management: snap to nearest hour; for staff: snap to 15-min
          let newEndHour: number;
          let newEndMinutes: number;
          
          if (isManagement) {
            // Round to nearest hour boundary
            newEndHour = Math.round(relativeY / hourHeight);
            newEndMinutes = 0;
          } else {
            newEndHour = Math.floor(relativeY / hourHeight);
            newEndMinutes = Math.round((relativeY % hourHeight) / hourHeight * 60 / 15) * 15;
            if (newEndMinutes === 60) {
              newEndHour += 1;
              newEndMinutes = 0;
            }
          }
          
          newEndHour = Math.max(origStartH + 1, Math.min(24, newEndHour));
          newEndMinutes = Math.max(0, Math.min(45, newEndMinutes));
          const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMinutes.toString().padStart(2, '0')}`;
          
          try {
            await updateEventMutation.mutateAsync({
              id: resizingEvent.id,
              data: { endTime: newEndTime }
            });
          } catch (error) {
            console.error('Failed to resize event:', error);
          }
        }
      }
      
      setIsDragging(false);
      setDraggedEvent(null);
      setIsResizing(null);
      setResizingEvent(null);
      setDragPreviewPos(null);
    };
    
    // Add global listeners
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalEnd);
    
    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isPotentialDrag, isDragging, isResizing, dragOffset, draggedEvent, dragPreviewPos, resizingEvent, weekDays, updateEventMutation, openEditDialog, DRAG_THRESHOLD]);

  const onSubmit = useCallback((data: ScheduleEventFormData) => {
    // Require at least one staff member for all shifts (both staff and management)
    if (selectedStaffIds.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לפחות עובד אחד למשמרת',
        variant: 'destructive'
      });
      return;
    }
    
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T12:00:00.000Z`;
    };
    
    // Calculate endDate based on endDateOffset
    let endDate = null;
    if (dialogDate && data.endDateOffset && data.endDateOffset > 0) {
      endDate = formatLocalDate(addDays(dialogDate, data.endDateOffset));
    }
    
    const eventData = {
      date: dialogDate ? formatLocalDate(dialogDate) : undefined,
      endDate,
      title: data.title?.trim() || 'משמרת',
      startTime: data.startTime,
      endTime: data.endTime,
      layer: dialogLayer,
      staffMemberIds: selectedStaffIds,
      note: data.note?.trim() || ''
    };

    if (dialogMode === 'create') {
      createEventMutation.mutate(eventData);
    } else if (selectedEvent) {
      updateEventMutation.mutate({ id: selectedEvent.id, data: eventData });
    }
  }, [dialogDate, dialogLayer, dialogMode, selectedEvent, selectedStaffIds, createEventMutation, updateEventMutation, toast]);

  const handleDeleteEvent = useCallback(() => {
    if (selectedEvent) {
      deleteEventMutation.mutate(selectedEvent.id);
    }
  }, [selectedEvent, deleteEventMutation]);

  const goToPrevWeek = useCallback(() => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  }, []);

  const getEventColor = useCallback((event: ScheduleEventWithStaff): { 
    bg: string; 
    border: string; 
    text: string; 
    isGradient?: boolean;
    gradientColors?: string[];
  } => {
    // Both staff and management shifts use the same color logic based on assigned staff members
    
    // Multi-staff color gradient - vertical bands from top to bottom
    if (event.staffMembers && event.staffMembers.length > 1) {
      const colors = event.staffMembers.map(s => s.color);
      // Create CSS linear gradient for vertical split colors (180deg = top to bottom)
      const gradientStops = colors.map((color, idx) => {
        const startPercent = (idx / colors.length) * 100;
        const endPercent = ((idx + 1) / colors.length) * 100;
        return `${color} ${startPercent}%, ${color} ${endPercent}%`;
      }).join(', ');
      return { 
        bg: `linear-gradient(180deg, ${gradientStops})`, 
        border: colors[0], 
        text: '#1a1a1a',
        isGradient: true,
        gradientColors: colors
      };
    }
    
    // Single staff member color
    if (event.staffMembers && event.staffMembers.length === 1) {
      return { bg: event.staffMembers[0].color, border: event.staffMembers[0].color, text: '#1a1a1a' };
    }
    
    // Legacy single staff member
    if (event.staffMember) {
      return { bg: event.staffMember.color, border: event.staffMember.color, text: '#1a1a1a' };
    }
    
    // Unassigned shift - darker white/gray color
    return { bg: UNASSIGNED_COLOR, border: UNASSIGNED_BORDER, text: '#374151' };
  }, []);

  const isLoading = staffLoading || eventsLoading;

  // Handle ESC key to exit expanded mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const calendarContent = (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isExpanded ? 'bg-background' : ''}`} dir="rtl">
      {/* Header - Two rows */}
      <div className={`flex flex-col ${isExpanded ? 'gap-1 p-2' : 'gap-2 p-2 sm:p-4'} border-b bg-background`}>
        {/* Row 1 - Title and navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <h2 className={`font-bold ${isExpanded ? 'text-base sm:text-lg' : 'text-base sm:text-xl'}`}>לוח שבועי</h2>
            <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today" className="h-7 px-1.5 sm:px-2 text-xs">
              היום
            </Button>
            <div className="flex items-center gap-0">
              <Button variant="ghost" size="icon" onClick={goToPrevWeek} data-testid="button-prev-week" className="h-7 w-7">
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <span className="font-medium text-xs sm:text-sm text-center whitespace-nowrap">
                {format(currentWeekStart, 'd/M', { locale: he })} - {format(weekEnd, 'd/M', { locale: he })}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextWeek} data-testid="button-next-week" className="h-7 w-7">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Row 2 - Action buttons */}
        <div className="flex items-center justify-between">
          {/* Right side - Action buttons based on layer */}
          <div className="flex items-center gap-1">
            {/* Staff layer - Staff management button */}
            {activeLayer === 'staff' && !isExpanded && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-manage-staff">
                        <Users className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>ניהול עובדים</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-80 z-[200]" align="start" dir="rtl">
                  <div className="space-y-4">
                    <h4 className="font-medium">רשימת עובדים</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {staffMembers.filter(m => m.role !== 'other').map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border" data-testid={`staff-member-${member.id}`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: member.color }}
                            />
                            <span>{member.name}</span>
                            {member.role === 'management' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">הנהלה</Badge>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => deleteStaffMutation.mutate(member.id)}
                            data-testid={`button-delete-staff-${member.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {staffMembers.filter(m => m.role !== 'other').length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">אין עובדים עדיין</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="שם עובד חדש..." 
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newStaffName.trim()) {
                            createStaffMutation.mutate({ name: newStaffName.trim(), role: 'staff' });
                          }
                        }}
                        data-testid="input-new-staff-name"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (newStaffName.trim()) {
                            createStaffMutation.mutate({ name: newStaffName.trim(), role: 'staff' });
                          }
                        }}
                        disabled={!newStaffName.trim() || createStaffMutation.isPending}
                        data-testid="button-add-staff"
                      >
                        {createStaffMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Management layer - Reversed order: Plus, UserPlus, Copy */}
            {activeLayer === 'management' && !isExpanded && (
              <>
                {/* Add other button */}
                <Popover open={addOtherPopoverOpen} onOpenChange={setAddOtherPopoverOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-add-other-to-table">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>הוסף אירוע אחר</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-64 z-[200]" align="start" dir="rtl">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">הוסף אירוע אחר</h4>
                      <Input
                        placeholder="שם האירוע..."
                        value={newOtherName}
                        onChange={(e) => setNewOtherName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newOtherName.trim()) {
                            createStaffMutation.mutate({ name: newOtherName.trim(), role: 'other' });
                            setNewOtherName('');
                            setAddOtherPopoverOpen(false);
                          }
                        }}
                        data-testid="input-new-other-name"
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (newOtherName.trim()) {
                            createStaffMutation.mutate({ name: newOtherName.trim(), role: 'other' });
                            setNewOtherName('');
                            setAddOtherPopoverOpen(false);
                          }
                        }}
                        disabled={!newOtherName.trim() || createStaffMutation.isPending}
                        data-testid="button-confirm-add-other"
                      >
                        {createStaffMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'הוסף'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Add manager button */}
                <Popover open={addManagerPopoverOpen} onOpenChange={setAddManagerPopoverOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-add-manager-to-table">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>הוסף מנהל לטבלה</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-64 z-[200]" align="start" dir="rtl">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">הוסף מנהל לטבלה</h4>
                      <Select value={selectedStaffToAdd} onValueChange={setSelectedStaffToAdd}>
                        <SelectTrigger className="w-full" data-testid="select-manager-to-add">
                          <SelectValue placeholder="בחר עובד..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staffMembers.filter(s => s.role !== 'management' && s.role !== 'other').map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          if (selectedStaffToAdd) {
                            const staff = staffMembers.find(s => s.id === selectedStaffToAdd);
                            if (staff) {
                              await updateStaffMutation.mutateAsync({ id: staff.id, data: { role: 'management' } });
                              setSelectedStaffToAdd('');
                              setAddManagerPopoverOpen(false);
                            }
                          }
                        }}
                        disabled={!selectedStaffToAdd || updateStaffMutation.isPending}
                        data-testid="button-confirm-add-manager"
                      >
                        {updateStaffMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'הוסף'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Duplicate Week Button */}
                {!isDuplicateMode ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          setIsDuplicateMode(true);
                          setSourceWeekStart(currentWeekStart);
                        }}
                        data-testid="button-duplicate-week"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>שכפל שבוע</TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={() => setDuplicateConfirmOpen(true)}
                      data-testid="button-set-target-week"
                    >
                      יעד
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setIsDuplicateMode(false);
                        setSourceWeekStart(null);
                      }}
                      data-testid="button-cancel-duplicate"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Left side - Layer toggle + expand */}
          <div className="flex items-center gap-1">
            {/* Layer toggle buttons */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <Button 
                variant={activeLayer === 'staff' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveLayer('staff')}
                data-testid="button-staff-layer"
                className="h-7 px-2 sm:px-3 text-xs sm:text-sm gap-1"
              >
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">משמרות צוות</span>
                <span className="sm:hidden">צוות</span>
              </Button>
              <Button 
                variant={activeLayer === 'management' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveLayer('management')}
                data-testid="button-management-layer"
                className="h-7 px-2 sm:px-3 text-xs sm:text-sm gap-1"
              >
                <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">משמרות הנהלה</span>
                <span className="sm:hidden">הנהלה</span>
              </Button>
            </div>
            
            {/* Expand/Collapse button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsExpanded(!isExpanded)}
                  data-testid="button-expand-calendar"
                  className="h-7 w-7 sm:w-auto sm:gap-1 p-0 sm:px-2"
                >
                  {isExpanded ? (
                    <>
                      <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">צמצם</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">הרחבה</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isExpanded ? 'צמצם תצוגה (ESC)' : 'הרחב למסך מלא'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : activeLayer === 'management' ? (
        /* Management Calendar - Manager-based table view */
        <div className={`flex-1 relative overflow-auto ${isDuplicateMode ? 'ring-4 ring-blue-500 ring-inset rounded-lg' : ''}`}>
          <div className="min-w-[800px]">
            {/* Header row with days */}
            <div className="grid border-b sticky top-0 bg-background z-[100] shadow-sm" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
              <div className="p-2 border-l border-l-muted-foreground/30 text-center font-bold bg-muted/50">
                מנהלים
              </div>
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div 
                    key={idx} 
                    className={`p-2 border-l border-l-muted-foreground/30 text-center ${isToday ? 'bg-primary/10' : ''}`}
                  >
                    <div className="font-bold text-sm">{HEBREW_DAYS[idx]}</div>
                    <div className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, 'd/M')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manager rows */}
            {managers.map((manager) => (
              <div key={manager.id} className="grid border-b hover:bg-muted/5" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
                {/* Manager name cell */}
                <div className="p-2 border-l border-l-muted-foreground/30 bg-muted/20">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" 
                        style={{ backgroundColor: manager.color }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm leading-tight break-words">{manager.name}</span>
                        {manager.role === 'other' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 w-fit">אחר</Badge>
                        )}
                      </div>
                    </div>
                    {!isExpanded && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Change role to 'staff' to remove from management view (don't delete the staff member)
                          updateStaffMutation.mutate({ id: manager.id, data: { role: 'staff' } });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Day cells for this manager */}
                {weekDays.map((day, dayIdx) => {
                  const isToday = isSameDay(day, new Date());
                  const managerEvents = getManagerEventsForDay(manager.id, day);
                  
                  return (
                    <div 
                      key={dayIdx}
                      className={`p-2 border-l border-l-muted-foreground/30 transition-colors min-h-[70px] ${isToday ? 'bg-primary/5' : ''} ${!isExpanded ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                      onClick={() => {
                        // Only allow clicking when not in expanded mode
                        if (isExpanded) return;
                        // Open dialog to add/edit hours for this manager on this day
                        setManagementCellDialog({
                          open: true,
                          managerId: manager.id,
                          managerName: manager.name,
                          date: day,
                          events: managerEvents
                        });
                      }}
                      data-testid={`management-cell-${manager.id}-${dayIdx}`}
                    >
                      {managerEvents.map(event => (
                        <div 
                          key={event.id}
                          className="text-sm px-2 py-1.5 rounded mb-1.5 font-medium"
                          style={{ backgroundColor: manager.color, color: '#1a1a1a' }}
                        >
                          <div className="font-semibold">{event.title || 'משמרת'}</div>
                          <div className="text-xs opacity-80">{event.startTime}-{event.endTime}</div>
                          {event.note && <div className="text-xs opacity-70 mt-0.5 whitespace-pre-wrap">{event.note}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}

            {managers.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                אין מנהלים עדיין. הוסף מנהל חדש למעלה.
              </div>
            )}
          </div>

          {/* Management Cell Dialog - for setting hours */}
          <Dialog 
            open={managementCellDialog?.open || false} 
            onOpenChange={(open) => {
              if (!open) {
                setManagementCellDialog(null);
                setMgmtFormTitle('');
                setMgmtFormStartTime('09:00');
                setMgmtFormEndTime('17:00');
                setMgmtFormNote('');
                setMgmtEditingEvent(null);
              }
            }}
          >
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>
                  {managementCellDialog?.managerName} - {managementCellDialog?.date ? format(managementCellDialog.date, 'EEEE d/M', { locale: he }) : ''}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Show existing events */}
                {managementCellDialog?.events && managementCellDialog.events.length > 0 && !mgmtEditingEvent && (
                  <div className="space-y-2">
                    <Label>משמרות קיימות:</Label>
                    {managementCellDialog.events.map(event => (
                      <div key={event.id} className="flex items-center justify-between p-3 rounded border bg-muted/20">
                        <div className="flex-1">
                          <div className="font-medium">{event.title || 'משמרת'}</div>
                          <div className="text-sm text-muted-foreground">{event.startTime} - {event.endTime}</div>
                          {event.note && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{event.note}</div>}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                              setMgmtEditingEvent(event);
                              setMgmtFormTitle(event.title || '');
                              setMgmtFormStartTime(event.startTime);
                              setMgmtFormEndTime(event.endTime);
                              setMgmtFormNote(event.note || '');
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              deleteEventMutation.mutate(event.id);
                              setManagementCellDialog(null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Inline form to add/edit event */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-base font-semibold">
                    {mgmtEditingEvent ? 'עריכת משמרת' : 'הוסף משמרת חדשה'}
                  </Label>
                  
                  <div className="space-y-2">
                    <Label>כותרת (אופציונלי)</Label>
                    <Input
                      value={mgmtFormTitle}
                      onChange={(e) => setMgmtFormTitle(e.target.value)}
                      placeholder="כותרת המשמרת..."
                      data-testid="input-mgmt-title"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>שעת התחלה</Label>
                      <Input
                        type="time"
                        value={mgmtFormStartTime}
                        onChange={(e) => setMgmtFormStartTime(e.target.value)}
                        data-testid="input-mgmt-start-time"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>שעת סיום</Label>
                      <Input
                        type="time"
                        value={mgmtFormEndTime}
                        onChange={(e) => setMgmtFormEndTime(e.target.value)}
                        data-testid="input-mgmt-end-time"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>הערה (אופציונלי)</Label>
                    <Input
                      value={mgmtFormNote}
                      onChange={(e) => setMgmtFormNote(e.target.value)}
                      placeholder="הערות נוספות..."
                      data-testid="input-mgmt-note"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {mgmtEditingEvent && (
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setMgmtEditingEvent(null);
                          setMgmtFormTitle('');
                          setMgmtFormStartTime('09:00');
                          setMgmtFormEndTime('17:00');
                          setMgmtFormNote('');
                        }}
                      >
                        ביטול
                      </Button>
                    )}
                    <Button 
                      className="flex-1"
                      disabled={(mgmtEditingEvent ? updateEventMutation.isPending : createEventMutation.isPending) || !mgmtFormStartTime || !mgmtFormEndTime}
                      onClick={async () => {
                        if (!managementCellDialog) return;
                        
                        // Validate times
                        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                        if (!timeRegex.test(mgmtFormStartTime) || !timeRegex.test(mgmtFormEndTime)) {
                          toast({
                            title: 'שגיאה',
                            description: 'יש להזין שעות תקינות',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        try {
                          if (mgmtEditingEvent) {
                            // Update existing event
                            await updateEventMutation.mutateAsync({
                              id: mgmtEditingEvent.id,
                              data: {
                                title: mgmtFormTitle.trim() || 'משמרת',
                                startTime: mgmtFormStartTime,
                                endTime: mgmtFormEndTime,
                                note: mgmtFormNote.trim() || ''
                              }
                            });
                          } else {
                            // Create new event
                            const formatLocalDate = (date: Date) => {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}T12:00:00.000Z`;
                            };
                            
                            await createEventMutation.mutateAsync({
                              date: formatLocalDate(managementCellDialog.date),
                              title: mgmtFormTitle.trim() || 'משמרת',
                              startTime: mgmtFormStartTime,
                              endTime: mgmtFormEndTime,
                              layer: 'management',
                              staffMemberIds: [managementCellDialog.managerId],
                              note: mgmtFormNote.trim() || ''
                            });
                          }
                          
                          // Reset form only on success
                          setMgmtFormTitle('');
                          setMgmtFormStartTime('09:00');
                          setMgmtFormEndTime('17:00');
                          setMgmtFormNote('');
                          setMgmtEditingEvent(null);
                          setManagementCellDialog(null);
                        } catch (error) {
                          // Error is already handled by mutation's onError
                        }
                      }}
                      data-testid="button-add-mgmt-event"
                    >
                      {(mgmtEditingEvent ? updateEventMutation.isPending : createEventMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin ml-1" />
                      ) : mgmtEditingEvent ? (
                        <Check className="h-4 w-4 ml-1" />
                      ) : (
                        <Plus className="h-4 w-4 ml-1" />
                      )}
                      {mgmtEditingEvent ? 'שמור שינויים' : 'הוסף משמרת'}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className={`flex-1 relative ${isExpanded ? 'overflow-hidden' : 'overflow-auto'}`}>
          <div className={isExpanded ? 'h-full' : 'min-w-[800px]'}>
            <div className={`grid grid-cols-8 border-b ${isExpanded ? '' : 'sticky top-0'} bg-background z-[100] shadow-sm`}>
              <div className={`${isExpanded ? 'p-1 text-xs' : 'p-2 text-base'} border-l border-l-muted-foreground/30 text-center font-bold bg-muted/50`}>
                שעות
              </div>
              {weekDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div 
                    key={idx} 
                    className={`${isExpanded ? 'p-1' : 'p-2'} border-l border-l-muted-foreground/30 text-center ${isToday ? 'bg-primary/10' : ''}`}
                  >
                    <div className={`font-bold ${isExpanded ? 'text-sm' : 'text-base'}`}>{HEBREW_DAYS[idx]}</div>
                    <div className={`${isExpanded ? 'text-xs' : 'text-sm'} font-medium ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, 'd/M')}
                    </div>
                  </div>
                );
              })}
            </div>

            <div 
              className="relative overflow-hidden isolate"
              ref={calendarGridRef}
              data-calendar-grid
              style={isExpanded ? { height: 'calc(100% - 50px)' } : undefined}
            >
              {hoursToShow.map(hour => (
                <div 
                  key={hour} 
                  className="grid grid-cols-8 border-b" 
                  style={{ height: isExpanded ? `${100 / 24}%` : '60px' }}
                >
                  <div className={`border-l border-l-muted-foreground/30 flex items-start justify-center pt-0.5 ${isExpanded ? 'text-[10px]' : 'text-sm'} font-semibold text-muted-foreground bg-muted/30`}>
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const isToday = isSameDay(day, new Date());
                    const isClickedCell = clickedCell?.dayIdx === dayIdx && clickedCell?.hour === hour;
                    return (
                      <div 
                        key={dayIdx} 
                        className={`border-l border-l-muted-foreground/30 relative cursor-pointer hover:bg-muted/20 transition-colors ${isToday ? 'bg-primary/5' : ''} ${isClickedCell ? 'bg-primary/20 ring-2 ring-primary ring-inset' : ''}`}
                        onClick={() => {
                          openCreateDialog(day, activeLayer, hour, dayIdx);
                        }}
                        data-testid={`calendar-cell-${dayIdx}-${hour}`}
                      />
                    );
                  })}
                </div>
              ))}

              <TooltipProvider delayDuration={200}>
              {weekDays.map((day, dayIdx) => {
                // Staff calendar - only show staff events
                const staffEvents = getEventsForDay(day, 'staff');
                const allDayEvents = staffEvents;
                
                // Also get cross-midnight events from the previous day that continue into this day
                const prevDay = dayIdx > 0 ? weekDays[dayIdx - 1] : null;
                const prevDayStaffEvents = prevDay ? getEventsForDay(prevDay, 'staff') : [];
                const crossMidnightEvents = prevDayStaffEvents.filter(e => isEventCrossMidnight(e));

                const getOverlappingGroups = (events: ScheduleEventWithStaff[]) => {
                  const timeToMinutes = (time: string) => {
                    const [h, m] = time.split(':').map(Number);
                    return h * 60 + m;
                  };
                  
                  const sortedEvents = [...events].sort((a, b) => 
                    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                  );
                  
                  const eventPositions: Map<string, { column: number; totalColumns: number }> = new Map();
                  
                  sortedEvents.forEach(event => {
                    const eventStart = timeToMinutes(event.startTime);
                    const eventEnd = timeToMinutes(event.endTime);
                    
                    const overlapping = sortedEvents.filter(other => {
                      if (other.id === event.id) return false;
                      const otherStart = timeToMinutes(other.startTime);
                      const otherEnd = timeToMinutes(other.endTime);
                      return !(eventEnd <= otherStart || eventStart >= otherEnd);
                    });
                    
                    const usedColumns = new Set<number>();
                    overlapping.forEach(other => {
                      const pos = eventPositions.get(other.id);
                      if (pos) usedColumns.add(pos.column);
                    });
                    
                    let column = 0;
                    while (usedColumns.has(column)) column++;
                    
                    const totalColumns = Math.max(overlapping.length + 1, 
                      ...Array.from(overlapping).map(o => eventPositions.get(o.id)?.totalColumns || 1)
                    );
                    
                    eventPositions.set(event.id, { column, totalColumns });
                    
                    overlapping.forEach(other => {
                      const pos = eventPositions.get(other.id);
                      if (pos && pos.totalColumns < totalColumns) {
                        eventPositions.set(other.id, { ...pos, totalColumns });
                      }
                    });
                  });
                  
                  return eventPositions;
                };
                
                const eventPositions = getOverlappingGroups(allDayEvents);

                return allDayEvents.map(event => {
                  // Check if this is a continuation of a multi-day event
                  const isContinuation = isEventContinuation(event, day);
                  // For cross-midnight events (legacy), show the first part (start to midnight)
                  const crossesMidnight = isEventCrossMidnight(event) && !event.endDate;
                  const { top, height } = getEventPosition(event, crossesMidnight ? 'first' : undefined, day);
                  const colors = getEventColor(event);
                  const position = eventPositions.get(event.id) || { column: 0, totalColumns: 1 };
                  const hasOverlap = position.totalColumns > 1;
                  
                  // Base column width (full day column width)
                  const baseColumnWidth = 12.5;
                  let columnWidth = hasOverlap ? (baseColumnWidth / position.totalColumns) : baseColumnWidth;
                  let columnOffset = position.column * columnWidth;
                  
                  const staffNames = event.staffMembers?.map(s => s.name).join(', ') || event.staffMember?.name || '';
                  const isFinalDay = isEventFinalDay(event, day);
                  const displayName = isContinuation ? `(המשך) ${staffNames || event.title}` : (staffNames || event.title);
                  
                  // For multi-day events, show appropriate times
                  let displayStartTime = event.startTime;
                  let displayEndTime = event.endTime;
                  if (event.endDate) {
                    if (isContinuation && isFinalDay) {
                      // Final day: 00:00 to endTime
                      displayStartTime = '00:00';
                      displayEndTime = event.endTime;
                    } else if (isContinuation) {
                      // Middle day: full day
                      displayStartTime = '00:00';
                      displayEndTime = '23:59';
                    } else {
                      // Start day: startTime to 23:59
                      displayStartTime = event.startTime;
                      displayEndTime = '23:59';
                    }
                  }
                  
                  const isBeingDragged = isDragging && draggedEvent?.id === event.id;
                  const previewDayIdx = isBeingDragged && dragPreviewPos ? dragPreviewPos.dayIdx : dayIdx;
                  const previewTop = isBeingDragged && dragPreviewPos ? dragPreviewPos.top : top;
                  
                  // In expanded mode, convert pixel positions to percentages
                  const totalGridHeight = 24 * 60; // 1440px in normal mode
                  const topPercent = (previewTop / totalGridHeight) * 100;
                  const heightPercent = (height / totalGridHeight) * 100;
                  
                  return (
                    <Tooltip key={event.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute ${isExpanded ? 'rounded px-1 py-0.5' : 'rounded-md px-1.5 py-1'} ${isExpanded ? 'cursor-default' : 'cursor-pointer'} shadow-md border border-white/30 select-none
                            ${isBeingDragged 
                              ? 'opacity-80 cursor-grabbing scale-[1.02] shadow-xl ring-2 ring-primary/50' 
                              : isExpanded ? '' : 'hover:opacity-90 hover:scale-[1.02] hover:shadow-lg transition-all duration-200 ease-out'}`}
                          style={{
                            top: isExpanded ? `${topPercent}%` : `${previewTop}px`,
                            height: isExpanded ? `${heightPercent}%` : `${height}px`,
                            right: `calc(${previewDayIdx * 12.5 + 12.5 + (isBeingDragged ? 0 : columnOffset)}%)`,
                            width: `calc(${isBeingDragged ? 12.5 : columnWidth}% - 2px)`,
                            marginRight: '1px',
                            backgroundImage: colors.isGradient ? colors.bg : 'none',
                            backgroundColor: colors.isGradient ? 'transparent' : colors.bg,
                            borderRight: isExpanded ? `3px solid ${colors.border}` : `4px solid ${colors.border}`,
                            color: colors.text,
                            zIndex: isBeingDragged ? 100 : 10 + position.column,
                            overflow: 'hidden',
                            transition: isBeingDragged ? 'none' : 'all 0.2s ease-out',
                          }}
                          onMouseDown={(isExpanded || isMobile) ? undefined : (e) => handlePointerDown(event, e)}
                          onTouchStart={(isExpanded || isMobile) ? undefined : (e) => handlePointerDown(event, e)}
                          onClick={isMobile && !isExpanded ? () => openEditDialog(event) : undefined}
                          data-testid={`schedule-event-${event.id}`}
                        >
                          {/* Resize handles - only in normal mode on desktop */}
                          {!isExpanded && !isMobile && (
                            <>
                              <div 
                                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10"
                                onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(event, 'top', e); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(event, 'top', e); }}
                              />
                              <div 
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10"
                                onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(event, 'bottom', e); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(event, 'bottom', e); }}
                              />
                            </>
                          )}
                          {isExpanded ? (
                            /* Expanded mode - compact text for mobile, prominent for desktop */
                            <div className="h-full flex flex-col justify-start overflow-hidden px-0.5 sm:px-1 pt-[2%] sm:pt-[8%]">
                              {/* Show staff names prominently near top - same for both staff and management shifts */}
                              <div className="flex flex-col gap-0 overflow-hidden">
                                {event.staffMembers && event.staffMembers.length > 1 ? (
                                  /* Multiple staff - show each name separately */
                                  event.staffMembers.map((staff, i) => (
                                    <div key={staff.id} className="text-[9px] sm:text-base font-black leading-none sm:leading-tight truncate">
                                      {staff.name}
                                    </div>
                                  ))
                                ) : (
                                  /* Single staff or no staff */
                                  <div className="text-[10px] sm:text-lg font-black leading-none sm:leading-tight truncate sm:break-words sm:whitespace-normal" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {staffNames || 'לא משובץ'}
                                  </div>
                                )}
                              </div>
                              {/* Mobile: show times on separate lines, Desktop: single line */}
                              <div className="sm:hidden text-[8px] font-bold opacity-90 mt-0.5">{event.startTime}</div>
                              <div className="sm:hidden text-[8px] font-bold opacity-90">{event.endTime}</div>
                              <div className="hidden sm:block text-sm font-bold opacity-90 mt-1 flex-shrink-0">
                                {event.startTime}-{event.endTime}
                              </div>
                            </div>
                          ) : hasOverlap ? (
                            <div className="h-full flex flex-col justify-center overflow-hidden">
                              <div className="font-black text-xs sm:text-base leading-tight break-words whitespace-normal overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{displayName}</div>
                              <div className="text-[8px] sm:text-[10px] font-medium opacity-90 flex-shrink-0">{event.startTime}-{event.endTime}</div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col overflow-hidden">
                              {staffNames && (
                                <div className="text-sm sm:text-lg font-black break-words whitespace-normal overflow-hidden flex-shrink-0 leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {staffNames}
                                </div>
                              )}
                              <div className="text-[9px] sm:text-[11px] font-semibold opacity-70 flex-shrink-0 mt-0.5">
                                {event.startTime} - {event.endTime}
                              </div>
                              {event.title && (
                                <div className="text-[10px] sm:text-xs mt-0.5 font-medium opacity-80 break-words whitespace-normal overflow-hidden flex-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {event.title}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]" dir="rtl">
                        <div className="space-y-1">
                          <div className="font-bold text-base">{event.title}</div>
                          <div className="text-sm font-medium">{event.startTime} - {event.endTime}</div>
                          {crossesMidnight && (
                            <div className="text-xs text-amber-600 font-medium">
                              ממשיך ליום הבא
                            </div>
                          )}
                          {event.staffMembers && event.staffMembers.length > 0 && (
                            <div className="text-sm">
                              <span className="font-semibold">עובדים: </span>
                              {event.staffMembers.map(s => s.name).join(', ')}
                            </div>
                          )}
                          {!event.staffMembers?.length && event.staffMember && (
                            <div className="text-sm">עובד: {event.staffMember.name}</div>
                          )}
                          {event.note && (
                            <div className="text-sm text-muted-foreground">{event.note}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">לחץ לעריכה</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                });
              })}
              {/* Render cross-midnight continuation events from previous day (legacy - for events without endDate) */}
              {weekDays.map((day, dayIdx) => {
                // Skip first day (Sunday) - no previous day in current week view
                if (dayIdx === 0) return null;
                
                // Safely get previous day index (dayIdx - 1 since we already checked dayIdx > 0)
                const prevDayIndex = dayIdx - 1;
                const prevDay = weekDays[prevDayIndex];
                if (!prevDay) return null; // Safety check
                
                // Staff calendar - only show staff events for cross-midnight continuation
                const prevDayStaffEvents = getEventsForDay(prevDay, 'staff');
                // Only handle legacy cross-midnight events (ones without endDate that cross midnight based on time)
                const crossMidnightEvents = prevDayStaffEvents.filter(e => isEventCrossMidnight(e) && !e.endDate);
                
                return crossMidnightEvents.map(event => {
                  const { top, height } = getEventPosition(event, 'second', day);
                  const colors = getEventColor(event);
                  
                  const staffNames = event.staffMembers?.map(s => s.name).join(', ') || event.staffMember?.name || '';
                  
                  // Full width for all events
                  const columnWidth = 12.5;
                  const columnOffset = 0;
                  
                  // In expanded mode, convert pixel positions to percentages
                  const totalGridHeight = 24 * 60; // 1440px in normal mode
                  const topPercent = (top / totalGridHeight) * 100;
                  const heightPercent = (height / totalGridHeight) * 100;
                  
                  return (
                    <Tooltip key={`${event.id}-continuation`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute ${isExpanded ? 'rounded px-1 py-0.5 cursor-default' : 'rounded-md px-1.5 py-1 cursor-pointer hover:opacity-90 hover:scale-[1.02]'} transition-all shadow-md border border-white/30 border-t-4 border-t-dashed`}
                          style={{
                            top: isExpanded ? `${topPercent}%` : `${top}px`,
                            height: isExpanded ? `${heightPercent}%` : `${height}px`,
                            right: `calc(${(dayIdx) * 12.5 + 12.5 + columnOffset}%)`,
                            width: `calc(${columnWidth}% - 2px)`,
                            marginRight: '1px',
                            backgroundImage: colors.isGradient ? colors.bg : 'none',
                            backgroundColor: colors.isGradient ? 'transparent' : colors.bg,
                            borderRight: isExpanded ? `3px solid ${colors.border}` : `4px solid ${colors.border}`,
                            color: colors.text,
                            zIndex: 10,
                            overflow: 'hidden',
                            opacity: 0.85,
                          }}
                          onClick={isExpanded ? undefined : (e) => {
                            e.stopPropagation();
                            openEditDialog(event);
                          }}
                          data-testid={`schedule-event-${event.id}-continuation`}
                        >
                          {isExpanded ? (
                            /* Expanded mode - compact text for mobile (same as regular events) */
                            <div className="h-full flex flex-col justify-start overflow-hidden px-0.5 sm:px-1 pt-[2%] sm:pt-[8%]">
                              <div className="text-[7px] sm:text-[10px] font-bold opacity-70 flex-shrink-0 truncate">המשך</div>
                              <div className="flex flex-col gap-0 overflow-hidden">
                                {event.staffMembers && event.staffMembers.length > 1 ? (
                                  event.staffMembers.map((staff, i) => (
                                    <div key={staff.id} className="text-[8px] sm:text-base font-black leading-tight truncate">
                                      {staff.name}
                                    </div>
                                  ))
                                ) : (
                                  <div 
                                    className="text-[8px] sm:text-lg font-black leading-tight break-words"
                                    style={{ 
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    {staffNames || 'לא משובץ'}
                                  </div>
                                )}
                              </div>
                              {/* Mobile: compact times, Desktop: single line */}
                              <div className="sm:hidden text-[6px] font-bold opacity-90 leading-tight">00:00</div>
                              <div className="sm:hidden text-[6px] font-bold opacity-90 leading-tight">{event.endTime}</div>
                              <div className="hidden sm:block text-sm font-bold opacity-90 mt-0.5 flex-shrink-0">00:00-{event.endTime}</div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col overflow-hidden">
                              <div className="text-[8px] sm:text-[10px] font-bold opacity-70 flex-shrink-0">המשך מאתמול</div>
                              <div className="text-[9px] sm:text-[11px] font-semibold opacity-70 flex-shrink-0 mt-0.5">
                                00:00 - {event.endTime}
                              </div>
                              {staffNames && (
                                <div className="text-sm sm:text-lg font-black break-words whitespace-normal overflow-hidden flex-shrink-0 leading-tight mt-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {staffNames}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]" dir="rtl">
                        <div className="space-y-1">
                          <div className="font-bold text-base">{event.title} (המשך)</div>
                          <div className="text-sm font-medium">00:00 - {event.endTime}</div>
                          <div className="text-xs text-muted-foreground">משמרת שהתחילה אתמול ב-{event.startTime}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                });
              })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dialogMode === 'create' ? 'הוספת אירוע' : 'עריכת אירוע'}
                <Badge variant={dialogLayer === 'staff' ? 'default' : 'secondary'}>
                  {dialogLayer === 'staff' ? 'צוות' : 'הנהלה'}
                </Badge>
              </div>
              {dialogDate && (
                <span className="text-sm font-normal text-muted-foreground">
                  {HEBREW_DAYS[dialogDate.getDay()]} {format(dialogDate, 'dd/MM', { locale: he })}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>כותרת (אופציונלי)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="ברירת מחדל: משמרת"
                        data-testid="input-event-title"
                        autoFocus={false}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שעת התחלה</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="time"
                          data-testid="input-event-start-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שעת סיום</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="time"
                          data-testid="input-event-end-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="endDateOffset"
                render={({ field }) => {
                  const currentValue = Number(field.value) || 0;
                  return (
                    <FormItem>
                      <FormLabel>{dialogLayer === 'management' ? 'האירוע מסתיים בעוד:' : 'סיום המשמרת ביום'}</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={currentValue === 0 ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange(0)}
                            data-testid="button-end-same-day"
                          >
                            היום
                          </Button>
                          <Button
                            type="button"
                            variant={currentValue === 1 ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange(1)}
                            data-testid="button-end-tomorrow"
                          >
                            למחרת
                          </Button>
                          <Button
                            type="button"
                            variant={currentValue === 2 ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange(2)}
                            data-testid="button-end-day-after"
                          >
                            מחרתיים
                          </Button>
                        </div>
                      </FormControl>
                      {currentValue > 0 && dialogDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {dialogLayer === 'management' ? 'האירוע יסתיים ב-' : 'המשמרת תסתיים ב-'}{format(addDays(dialogDate, currentValue), 'EEEE dd/MM', { locale: he })}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormItem>
                <FormLabel className="text-base font-bold">עובדים מוקצים</FormLabel>
                  <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                    {staffMembers.filter(m => m.role !== 'other').length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">אין עובדים זמינים</p>
                    ) : (
                      staffMembers.filter(m => m.role !== 'other').map(member => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                          data-testid={`checkbox-staff-${member.id}`}
                        >
                          <Checkbox
                            checked={selectedStaffIds.includes(member.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStaffIds(prev => [...prev, member.id]);
                              } else {
                                setSelectedStaffIds(prev => prev.filter(id => id !== member.id));
                              }
                            }}
                          />
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: member.color }}
                          />
                          <span className="font-medium text-sm">{member.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedStaffIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedStaffIds.map(id => {
                        const member = staffMembers.find(m => m.id === id);
                        return member ? (
                          <Badge 
                            key={id} 
                            variant="secondary"
                            className="flex items-center gap-1"
                            style={{ backgroundColor: member.color, color: '#1a1a1a' }}
                          >
                            {member.name}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              onClick={() => setSelectedStaffIds(prev => prev.filter(i => i !== id))}
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
              </FormItem>

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>הערה</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="הערה נוספת..."
                        rows={3}
                        data-testid="input-event-note"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex justify-between gap-2">
                {dialogMode === 'edit' && (
                  <Button 
                    type="button"
                    variant="destructive" 
                    onClick={handleDeleteEvent}
                    disabled={deleteEventMutation.isPending}
                    data-testid="button-delete-event"
                  >
                    {deleteEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 ml-1" />}
                    מחק
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeEventDialog}>
                    ביטול
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createEventMutation.isPending || updateEventMutation.isPending}
                    data-testid="button-save-event"
                  >
                    {(createEventMutation.isPending || updateEventMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'שמור'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Week Confirmation Dialog */}
      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שכפול שבוע</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">שבוע מקור:</p>
              <p className="text-sm text-muted-foreground">
                {sourceWeekStart && format(sourceWeekStart, 'dd/MM/yyyy', { locale: he })} - {sourceWeekStart && format(addDays(sourceWeekStart, 6), 'dd/MM/yyyy', { locale: he })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">שבוע יעד:</p>
              <p className="text-sm text-muted-foreground">
                {format(currentWeekStart, 'dd/MM/yyyy', { locale: he })} - {format(addDays(currentWeekStart, 6), 'dd/MM/yyyy', { locale: he })}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox 
                id="overwrite-existing"
                checked={overwriteExisting}
                onCheckedChange={(checked) => setOverwriteExisting(checked === true)}
              />
              <label htmlFor="overwrite-existing" className="text-sm cursor-pointer">
                דרוס אירועים קיימים בשבוע היעד (אם לא מסומן - האירועים יתווספו לקיימים)
              </label>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDuplicateConfirmOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={() => {
                if (sourceWeekStart) {
                  const sourceStr = format(sourceWeekStart, 'yyyy-MM-dd');
                  const targetStr = format(currentWeekStart, 'yyyy-MM-dd');
                  duplicateWeekMutation.mutate({
                    sourceWeekStart: sourceStr,
                    targetWeekStart: targetStr,
                    overwrite: overwriteExisting
                  });
                }
              }}
              disabled={duplicateWeekMutation.isPending || !sourceWeekStart || sourceWeekStart.getTime() === currentWeekStart.getTime()}
              data-testid="button-confirm-duplicate"
            >
              {duplicateWeekMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שכפל'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Return wrapped in full-screen overlay when expanded
  if (isExpanded) {
    return (
      <TooltipProvider>
        <div 
          className="fixed inset-0 z-[9999] bg-background"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {calendarContent}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      {calendarContent}
    </TooltipProvider>
  );
}
