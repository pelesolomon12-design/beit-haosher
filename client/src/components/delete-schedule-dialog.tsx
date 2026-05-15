import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DeleteScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  onSuccess?: () => void;
}

export function DeleteScheduleDialog({
  open,
  onOpenChange,
  initialDate,
  onSuccess
}: DeleteScheduleDialogProps) {
  const { toast } = useToast();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (dates: string[]) => {
      const response = await apiRequest('DELETE', '/api/schedule-events/bulk', { dates });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    }
  });

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelectedDates([]);
      setStep('select');
      setIsDeleting(false);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const toggleDate = useCallback((date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDates(prev => {
      const exists = prev.some(d => isSameDay(d, date));
      if (exists) {
        return prev.filter(d => !isSameDay(d, date));
      } else {
        return [...prev, date];
      }
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selectedDates.length === 0) return;
    
    setIsDeleting(true);
    try {
      const dateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
      await deleteMutation.mutateAsync(dateStrings);
      
      toast({
        title: 'לוח זמנים נמחק בהצלחה',
        description: `נמחקו ${selectedDates.length} ימים`,
        variant: 'default'
      });
      
      handleOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'שגיאה במחיקה',
        description: error?.message || 'אנא נסה שוב',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedDates, deleteMutation, toast, handleOpenChange, onSuccess]);

  const sortedSelectedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  }, [selectedDates]);

  const modifiers = useMemo(() => ({
    selected: selectedDates
  }), [selectedDates]);

  const modifiersStyles = useMemo(() => ({
    selected: {
      backgroundColor: 'hsl(0, 84%, 60%)',
      color: 'white',
      borderRadius: '6px'
    }
  }), []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        dir="rtl" 
        className="sm:max-w-[500px] max-h-[90vh] flex flex-col"
        style={{ zIndex: 400 }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            מחיקת לוח זמנים
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'בחר את הימים שברצונך למחוק את הלוח זמנים שלהם'
              : 'אשר את מחיקת הימים הנבחרים'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === 'select' ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={undefined}
                  onSelect={toggleDate}
                  locale={he}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  className="rounded-md border"
                  dir="rtl"
                />
              </div>

              {selectedDates.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    ימים נבחרים למחיקה ({selectedDates.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sortedSelectedDates.map(date => (
                      <div
                        key={date.toISOString()}
                        className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 rounded-md text-sm"
                      >
                        <span>{format(date, 'dd/MM/yyyy', { locale: he })}</span>
                        <button
                          onClick={() => toggleDate(date)}
                          className="hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-300 dark:border-yellow-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      אזהרה: פעולה זו אינה ניתנת לביטול!
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      כל האירועים והלוח זמנים של הימים הנבחרים יימחקו לצמיתות.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
                <p className="font-medium mb-2">ימים שיימחקו ({selectedDates.length}):</p>
                <div className="space-y-1">
                  {sortedSelectedDates.map(date => (
                    <div
                      key={date.toISOString()}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>{format(date, 'EEEE, dd/MM/yyyy', { locale: he })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          {step === 'select' ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                ביטול
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={selectedDates.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                המשך למחיקה ({selectedDates.length})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                disabled={isDeleting}
              >
                חזור
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <>מוחק...</>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 ml-2" />
                    אשר מחיקה
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
