import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  SelectDailyTask, 
  InsertDailyTask, 
  UpdateDailyTask,
  SelectEvent,
  InsertEvent,
  UpdateEvent,
  Occupant,
  DuplicateScheduleRequest
} from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { formatJerusalemDate, extractDateWithoutTimezoneShift } from '@/lib/utils';

// Hook to fetch daily tasks (optionally by date)
export function useDailyTasks(date?: string) {
  return useQuery<SelectDailyTask[]>({
    queryKey: date ? ['/api/daily-tasks', { date }] : ['/api/daily-tasks'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to create a new daily task
export function useCreateDailyTask() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDailyTask): Promise<SelectDailyTask> => {
      const res = await apiRequest('POST', '/api/daily-tasks', {
        ...data,
        date: formatJerusalemDate(data.date), // Format as YYYY-MM-DD in Jerusalem timezone
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch daily tasks (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'], exact: false });
      toast({
        title: 'משימה נוספה',
        description: 'המשימה היומית נוספה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Create task error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה ביצירת המשימה',
        variant: 'destructive',
      });
    },
  });
}

// Hook to update a daily task
export function useUpdateDailyTask() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: UpdateDailyTask 
    }): Promise<SelectDailyTask> => {
      const requestData = {
        ...data,
        ...(data.date && { date: formatJerusalemDate(data.date) }),
      };
      const res = await apiRequest('PUT', `/api/daily-tasks/${id}`, requestData);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch daily tasks (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'], exact: false });
      toast({
        title: 'משימה עודכנה',
        description: 'המשימה היומית עודכנה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Update task error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בעדכון המשימה',
        variant: 'destructive',
      });
    },
  });
}

// Hook to delete a daily task
export function useDeleteDailyTask() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const res = await apiRequest('DELETE', `/api/daily-tasks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch daily tasks (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'], exact: false });
      toast({
        title: 'משימה נמחקה',
        description: 'המשימה היומית נמחקה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Delete task error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה במחיקת המשימה',
        variant: 'destructive',
      });
    },
  });
}

// Hook to fetch occupants for task assignment and profile events
export function useOccupants() {
  return useQuery<Occupant[]>({
    queryKey: ['/api/occupants'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Event hooks (similar to daily task hooks but for events)
// Hook to fetch events (optionally by date)
export function useEvents(date?: string) {
  return useQuery<SelectEvent[]>({
    queryKey: date ? ['/api/events', { date }] : ['/api/events'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to create a new event
export function useCreateEvent() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertEvent): Promise<SelectEvent> => {
      const res = await apiRequest('POST', '/api/events', {
        ...data,
        date: formatJerusalemDate(data.date), // Format as YYYY-MM-DD in Jerusalem timezone
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch events (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
      toast({
        title: 'אירוע נוסף',
        description: 'האירוע נוסף בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Create event error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה ביצירת האירוע',
        variant: 'destructive',
      });
    },
  });
}

// Hook to update an event
export function useUpdateEvent() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: UpdateEvent 
    }): Promise<SelectEvent> => {
      const requestData = {
        ...data,
        ...(data.date && { date: formatJerusalemDate(data.date) }),
      };
      const res = await apiRequest('PUT', `/api/events/${id}`, requestData);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch events (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
      toast({
        title: 'אירוע עודכן',
        description: 'האירוע עודכן בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Update event error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בעדכון האירוע',
        variant: 'destructive',
      });
    },
  });
}

// Hook to delete an event
export function useDeleteEvent() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const res = await apiRequest('DELETE', `/api/events/${id}`);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch events (all related queries)
      queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
      toast({
        title: 'אירוע נמחק',
        description: 'האירוע נמחק בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Delete event error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה במחיקת האירוע',
        variant: 'destructive',
      });
    },
  });
}

// Define profile event types
export type ProfileEventType = 'admission' | 'discharge' | 'exit-start' | 'exit-end' | 'consultation';

export interface ProfileEvent {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  editable: false; // Profile events are always non-draggable
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    type: 'profile';
    eventType: ProfileEventType;
    occupantId: string;
    occupantName: string;
    roomId: string;
  };
}

// Colors for different profile events
const PROFILE_EVENT_COLORS = {
  admission: { bg: 'hsl(142, 76%, 50%)', border: 'hsl(142, 76%, 45%)' }, // Green for admissions
  discharge: { bg: 'hsl(38, 92%, 50%)', border: 'hsl(38, 92%, 45%)' }, // Orange for discharges
  'exit-start': { bg: 'hsl(262, 83%, 58%)', border: 'hsl(262, 83%, 53%)' }, // Purple for exit start
  'exit-end': { bg: 'hsl(231, 48%, 48%)', border: 'hsl(231, 48%, 43%)' }, // Navy/indigo for return (not bright blue)
  consultation: { bg: 'hsl(173, 58%, 39%)', border: 'hsl(173, 58%, 34%)' }, // Teal for consultations
};

// Transform occupant data into profile calendar events
export function transformOccupantsToProfileEvents(occupants: Occupant[]): ProfileEvent[] {
  const events: ProfileEvent[] = [];

  occupants.forEach(occupant => {
    // Admission event (joinDate)
    if (occupant.joinDate) {
      events.push({
        id: `profile-admission-${occupant.id}`,
        title: `קליטה: ${occupant.name}`,
        start: extractDateWithoutTimezoneShift(new Date(occupant.joinDate)),
        allDay: true,
        editable: false, // Profile events are non-draggable
        backgroundColor: PROFILE_EVENT_COLORS.admission.bg,
        borderColor: PROFILE_EVENT_COLORS.admission.border,
        extendedProps: {
          type: 'profile',
          eventType: 'admission',
          occupantId: occupant.id,
          occupantName: occupant.name,
          roomId: occupant.roomId,
        },
      });
    }

    // Planned discharge event (endDateTime)
    if (occupant.endDateTime) {
      events.push({
        id: `profile-discharge-${occupant.id}`,
        title: `שחרור מתוכנן: ${occupant.name}`,
        start: extractDateWithoutTimezoneShift(new Date(occupant.endDateTime)),
        allDay: true,
        editable: false, // Profile events are non-draggable
        backgroundColor: PROFILE_EVENT_COLORS.discharge.bg,
        borderColor: PROFILE_EVENT_COLORS.discharge.border,
        extendedProps: {
          type: 'profile',
          eventType: 'discharge',
          occupantId: occupant.id,
          occupantName: occupant.name,
          roomId: occupant.roomId,
        },
      });
    }

    // Temporary exit start (plannedExitStart)
    if (occupant.plannedExitStart) {
      events.push({
        id: `profile-exit-start-${occupant.id}`,
        title: `יציאה זמנית: ${occupant.name}`,
        start: extractDateWithoutTimezoneShift(new Date(occupant.plannedExitStart)),
        allDay: true,
        editable: false, // Profile events are non-draggable
        backgroundColor: PROFILE_EVENT_COLORS['exit-start'].bg,
        borderColor: PROFILE_EVENT_COLORS['exit-start'].border,
        extendedProps: {
          type: 'profile',
          eventType: 'exit-start',
          occupantId: occupant.id,
          occupantName: occupant.name,
          roomId: occupant.roomId,
        },
      });
    }

    // Return from temporary exit (plannedExitEnd)
    if (occupant.plannedExitEnd) {
      events.push({
        id: `profile-exit-end-${occupant.id}`,
        title: `חזרה: ${occupant.name}`,
        start: extractDateWithoutTimezoneShift(new Date(occupant.plannedExitEnd)),
        allDay: true,
        editable: false, // Profile events are non-draggable
        backgroundColor: PROFILE_EVENT_COLORS['exit-end'].bg,
        borderColor: PROFILE_EVENT_COLORS['exit-end'].border,
        extendedProps: {
          type: 'profile',
          eventType: 'exit-end',
          occupantId: occupant.id,
          occupantName: occupant.name,
          roomId: occupant.roomId,
        },
      });
    }

    // Private consultation (privateConsultation)
    if (occupant.privateConsultation) {
      events.push({
        id: `profile-consultation-${occupant.id}`,
        title: `ייעוץ פרטי: ${occupant.name}`,
        start: extractDateWithoutTimezoneShift(new Date(occupant.privateConsultation)),
        allDay: true,
        editable: false, // Profile events are non-draggable
        backgroundColor: PROFILE_EVENT_COLORS.consultation.bg,
        borderColor: PROFILE_EVENT_COLORS.consultation.border,
        extendedProps: {
          type: 'profile',
          eventType: 'consultation',
          occupantId: occupant.id,
          occupantName: occupant.name,
          roomId: occupant.roomId,
        },
      });
    }
  });

  return events;
}

// Hook to check if a date is empty (no tasks and no events, profile events allowed)
export function useCheckDateEmpty(date: string) {
  return useQuery<boolean>({
    queryKey: ['/api/check-date-empty', date],
    queryFn: async () => {
      // Check if date has tasks or events by fetching both
      const [tasksRes, eventsRes] = await Promise.all([
        apiRequest('GET', `/api/daily-tasks?date=${date}`),
        apiRequest('GET', `/api/events?date=${date}`)
      ]);
      
      const tasks = await tasksRes.json();
      const events = await eventsRes.json();
      
      // Date is empty if it has no tasks AND no events
      return tasks.length === 0 && events.length === 0;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - shorter stale time for validation
    enabled: !!date, // Only run if date is provided
  });
}

// Hook to check availability for multiple dates at once (for calendar picker optimization)
export function useDatesAvailability(dates: string[]) {
  return useQuery<{ [date: string]: boolean }>({
    queryKey: ['/api/check-dates-availability', dates.sort().join(',')],
    queryFn: async () => {
      if (dates.length === 0) return {};
      
      const res = await apiRequest('GET', `/api/check-dates-availability?dates=${dates.join(',')}`);
      const results = await res.json();
      
      // Convert array response to object for easier lookup
      const availability: { [date: string]: boolean } = {};
      results.forEach((result: { date: string; available: boolean }) => {
        availability[result.date] = result.available;
      });
      
      return availability;
    },
    staleTime: 30 * 1000, // 30 seconds - fresh data for UI interactions
    enabled: dates.length > 0, // Only run if dates are provided
  });
}

// Hook to fetch daily tasks and events by date (for duplicate dialog preview)
export function useDailyTasksAndEventsByDate(date: string) {
  return useQuery<{ tasks: SelectDailyTask[]; events: SelectEvent[] }>({
    queryKey: ['/api/daily-data', date],
    queryFn: async () => {
      if (!date) return { tasks: [], events: [] };
      
      const [tasksRes, eventsRes] = await Promise.all([
        apiRequest('GET', `/api/daily-tasks?date=${date}`),
        apiRequest('GET', `/api/events?date=${date}`)
      ]);
      
      const tasks = await tasksRes.json();
      const events = await eventsRes.json();
      
      return { tasks, events };
    },
    staleTime: 1 * 60 * 1000,
    enabled: !!date,
  });
}

// Hook to fetch schedule events by date range (for weekly schedule calendar)
// Accepts dates in YYYY-MM-DD format (from formatJerusalemDate)
export function useScheduleEventsByDateRange(startDate: string, endDate: string) {
  return useQuery<any[]>({
    queryKey: ['/api/schedule-events', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      // Convert YYYY-MM-DD to ISO format with proper time range
      const startISO = `${startDate}T00:00:00.000Z`;
      const endISO = `${endDate}T23:59:59.999Z`;
      const response = await fetch(`/api/schedule-events?start=${startISO}&end=${endISO}`);
      if (!response.ok) throw new Error('Failed to fetch schedule events');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!startDate && !!endDate,
  });
}

// Hook to check availability for schedule events (not daily tasks/events)
export function useScheduleEventsAvailability(dates: string[]) {
  return useQuery<{ [date: string]: boolean }>({
    queryKey: ['/api/schedule-events-availability', dates.sort().join(',')],
    queryFn: async () => {
      if (dates.length === 0) return {};
      
      const availability: { [date: string]: boolean } = {};
      
      // Check each date for schedule events
      await Promise.all(dates.map(async (date) => {
        try {
          const response = await fetch(`/api/schedule-events?start=${date}T00:00:00.000Z&end=${date}T23:59:59.999Z`);
          if (!response.ok) throw new Error('Failed to fetch');
          const events = await response.json();
          availability[date] = events.length === 0; // true if empty/available
        } catch {
          availability[date] = false; // Assume not available on error
        }
      }));
      
      return availability;
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: dates.length > 0,
  });
}

// Hook to duplicate a schedule from source date to target date
export function useDuplicateSchedule() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: DuplicateScheduleRequest): Promise<{
      success: boolean;
      copiedTasks: number;
      copiedEvents: number;
      totalCopied: number;
      message: string;
    }> => {
      const res = await apiRequest('POST', '/api/duplicate-schedule', data);
      return res.json();
    },
    onSuccess: (result) => {
      // Invalidate and refetch related queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
      
      toast({
        title: 'לוח זמנים שוכפל בהצלחה',
        description: `הועתקו ${result.copiedTasks} משימות ו-${result.copiedEvents} אירועים`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      console.error('Duplicate schedule error:', error);
      let errorMessage = 'שגיאה בשכפול לוח הזמנים';
      
      // Try to parse JSON error message for more specific error handling
      try {
        // Check if error message is JSON with Hebrew error
        const errorText = error?.message || '';
        if (errorText.includes('400:')) {
          // Extract JSON part from "400: {json message}"
          const jsonPart = errorText.substring(errorText.indexOf('{'));
          const errorObj = JSON.parse(jsonPart);
          if (errorObj.error && errorObj.error.includes('ריק')) {
            errorMessage = 'התאריך הנבחר אינו ריק - לא ניתן לשכפל אליו';
          } else if (errorObj.message) {
            errorMessage = errorObj.message;
          }
        } else {
          // Handle specific error cases from text
          if (errorText.includes('not empty')) {
            errorMessage = 'התאריך הנבחר אינו ריק - לא ניתן לשכפל אליו';
          } else if (errorText.includes('Target date')) {
            errorMessage = 'התאריך הנבחר אינו זמין לשכפול';
          }
        }
      } catch (parseError) {
        // If parsing fails, use original error handling
        if (error?.message?.includes('not empty')) {
          errorMessage = 'התאריך הנבחר אינו ריק - לא ניתן לשכפל אליו';
        } else if (error?.message?.includes('Target date')) {
          errorMessage = 'התאריך הנבחר אינו זמין לשכפול';
        }
      }
      
      toast({
        title: 'שגיאה',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}