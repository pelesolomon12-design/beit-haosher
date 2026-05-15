import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  SelectDailyNote, 
  InsertDailyNote, 
  UpdateDailyNote 
} from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { formatJerusalemDate } from '@/lib/utils';

// Hook to fetch daily note for a specific date
export function useDailyNote(date: string) {
  return useQuery<SelectDailyNote | null>({
    queryKey: ['/api/daily-notes', date],
    queryFn: async (): Promise<SelectDailyNote | null> => {
      try {
        const res = await fetch(`/api/daily-notes/${date}`);
        if (res.status === 404) {
          // No note exists for this date - this is normal
          return null;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch daily note');
        }
        return await res.json();
      } catch (error) {
        // Return null for not found cases, throw for other errors
        if (error instanceof TypeError || (error as any)?.status !== 404) {
          throw error;
        }
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to create or update a daily note
export function useCreateOrUpdateDailyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDailyNote): Promise<SelectDailyNote> => {
      const res = await apiRequest('POST', '/api/daily-notes', {
        ...data,
        date: formatJerusalemDate(data.date), // Format as YYYY-MM-DD in Jerusalem timezone
      });
      return res.json();
    },
    onSuccess: (result, variables) => {
      // Invalidate and refetch the specific daily note
      const dateString = formatJerusalemDate(variables.date);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/daily-notes', dateString], 
        exact: true 
      });
      
      // No toast notification for auto-save - too noisy
      // Only show toast for manual saves or errors
    },
    onError: (error) => {
      console.error('Save note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בשמירת ההערה היומית',
        variant: 'destructive',
      });
    },
  });
}

// Hook to delete a daily note
export function useDeleteDailyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (date: string): Promise<{ success: boolean }> => {
      const res = await apiRequest('DELETE', `/api/daily-notes/${date}`);
      return res.json();
    },
    onSuccess: (result, variables) => {
      // Invalidate and refetch the specific daily note
      queryClient.invalidateQueries({ 
        queryKey: ['/api/daily-notes', variables], 
        exact: true 
      });
      toast({
        title: 'הערה נמחקה',
        description: 'ההערה היומית נמחקה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Delete note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה במחיקת ההערה',
        variant: 'destructive',
      });
    },
  });
}

// Hook for manual save with toast notification
export function useManualSaveDailyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDailyNote): Promise<SelectDailyNote> => {
      const res = await apiRequest('POST', '/api/daily-notes', {
        ...data,
        date: formatJerusalemDate(data.date), // Format as YYYY-MM-DD in Jerusalem timezone
      });
      return res.json();
    },
    onSuccess: (result, variables) => {
      // Invalidate and refetch the specific daily note
      const dateString = formatJerusalemDate(variables.date);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/daily-notes', dateString], 
        exact: true 
      });
      
      // Show success toast for manual saves
      toast({
        title: 'הערה נשמרה',
        description: 'ההערה היומית נשמרה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Manual save note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בשמירת ההערה היומית',
        variant: 'destructive',
      });
    },
  });
}