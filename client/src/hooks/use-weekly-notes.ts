import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  SelectWeeklyNote, 
  InsertWeeklyNote, 
} from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { formatJerusalemDate } from '@/lib/utils';

// Hook to fetch weekly note for a specific week start date
export function useWeeklyNote(weekStartDate: string) {
  return useQuery<SelectWeeklyNote | null>({
    queryKey: ['/api/weekly-notes', weekStartDate],
    queryFn: async (): Promise<SelectWeeklyNote | null> => {
      try {
        const res = await fetch(`/api/weekly-notes/${weekStartDate}`);
        if (res.status === 404) {
          return null;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch weekly note');
        }
        return await res.json();
      } catch (error) {
        if (error instanceof TypeError || (error as any)?.status !== 404) {
          throw error;
        }
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to create or update a weekly note (auto-save, no toast)
export function useCreateOrUpdateWeeklyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertWeeklyNote): Promise<SelectWeeklyNote> => {
      const res = await apiRequest('POST', '/api/weekly-notes', {
        ...data,
        weekStartDate: formatJerusalemDate(data.weekStartDate),
      });
      return res.json();
    },
    onSuccess: (result, variables) => {
      const dateString = formatJerusalemDate(variables.weekStartDate);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/weekly-notes', dateString], 
        exact: true 
      });
    },
    onError: (error) => {
      console.error('Save weekly note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בשמירת ההערה השבועית',
        variant: 'destructive',
      });
    },
  });
}

// Hook to delete a weekly note
export function useDeleteWeeklyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (weekStartDate: string): Promise<{ success: boolean }> => {
      const res = await apiRequest('DELETE', `/api/weekly-notes/${weekStartDate}`);
      return res.json();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/weekly-notes', variables], 
        exact: true 
      });
      toast({
        title: 'הערה נמחקה',
        description: 'ההערה השבועית נמחקה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Delete weekly note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה במחיקת ההערה',
        variant: 'destructive',
      });
    },
  });
}

// Hook for manual save with toast notification
export function useManualSaveWeeklyNote() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertWeeklyNote): Promise<SelectWeeklyNote> => {
      const res = await apiRequest('POST', '/api/weekly-notes', {
        ...data,
        weekStartDate: formatJerusalemDate(data.weekStartDate),
      });
      return res.json();
    },
    onSuccess: (result, variables) => {
      const dateString = formatJerusalemDate(variables.weekStartDate);
      queryClient.invalidateQueries({ 
        queryKey: ['/api/weekly-notes', dateString], 
        exact: true 
      });
      
      toast({
        title: 'הערה נשמרה',
        description: 'ההערה השבועית נשמרה בהצלחה',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('Manual save weekly note error:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בשמירת ההערה השבועית',
        variant: 'destructive',
      });
    },
  });
}
