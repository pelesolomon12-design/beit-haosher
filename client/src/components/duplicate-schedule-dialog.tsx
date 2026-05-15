import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Clock,
  ChevronRight,
  CheckSquare,
  CalendarDays,
  Repeat
} from 'lucide-react';
import { format, addDays, isSameDay, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { useDuplicateSchedule, useDailyTasksAndEventsByDate, useDatesAvailability } from '@/hooks/use-daily-tasks';
import { 
  formatJerusalemDate, 
  getHebrewDayName,
  isPastDate
} from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DuplicateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDate?: Date;
  currentWeekStart?: Date;
  onSuccess?: (targetDate: Date) => void;
}

export function DuplicateScheduleDialog({
  open,
  onOpenChange,
  sourceDate,
  currentWeekStart,
  onSuccess,
}: DuplicateScheduleDialogProps) {
  const { toast } = useToast();
  
  // Step state: source -> target -> confirm -> continuousTarget (optional)
  const [step, setStep] = useState<'source' | 'target' | 'confirm' | 'continuousTarget'>('source');
  const [selectedSourceDate, setSelectedSourceDate] = useState<Date | undefined>(sourceDate);
  const [selectedTargetDate, setSelectedTargetDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [isContinuousDuplicating, setIsContinuousDuplicating] = useState(false);
  
  // Get current week days for source day selection
  const weekDays = useMemo(() => {
    if (!currentWeekStart) return [];
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);
  
  // Fetch daily tasks and events for each day in the week
  const weekDatesFormatted = useMemo(() => {
    return weekDays.map(day => formatJerusalemDate(day));
  }, [weekDays]);
  
  // Use availability hook to check which days have content
  const { data: datesAvailability = {}, isLoading: availabilityLoading } = useDatesAvailability(weekDatesFormatted);
  
  // Days with content (where availability is false means has content)
  const daysWithContent = useMemo(() => {
    const contentDays = new Set<string>();
    Object.entries(datesAvailability).forEach(([date, available]) => {
      if (!available) { // Not available means has content
        contentDays.add(date);
      }
    });
    return contentDays;
  }, [datesAvailability]);
  
  // Fetch daily tasks and events for selected source date
  const selectedSourceDateStr = selectedSourceDate ? formatJerusalemDate(selectedSourceDate) : '';
  const { data: sourceData, isLoading: sourceDataLoading } = useDailyTasksAndEventsByDate(selectedSourceDateStr);
  
  const sourceTasks = sourceData?.tasks || [];
  const sourceEvents = sourceData?.events || [];
  const totalSourceItems = sourceTasks.length + sourceEvents.length;
  
  // Check target date availability
  const targetDateStr = selectedTargetDate ? formatJerusalemDate(selectedTargetDate) : '';
  const { data: targetAvailability = {}, isLoading: checkingTarget } = useDatesAvailability(
    targetDateStr ? [targetDateStr] : []
  );
  const isTargetEmpty = targetDateStr ? targetAvailability[targetDateStr] : undefined;
  
  // Duplication mutation
  const duplicateMutation = useDuplicateSchedule();
  
  // Reset state when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setStep('source');
      setSelectedSourceDate(undefined);
      setSelectedTargetDate(undefined);
      setSelectedEndDate(undefined);
      setIsContinuousDuplicating(false);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);
  
  // When dialog opens with a sourceDate prop, set it and skip to target step
  useEffect(() => {
    if (open && sourceDate) {
      console.log('🔄 Dialog opened with sourceDate:', sourceDate);
      setSelectedSourceDate(sourceDate);
      // Skip directly to target step since source is already selected
      setStep('target');
    } else if (open && !sourceDate) {
      // Dialog opened without sourceDate - start at source step
      setStep('source');
      setSelectedSourceDate(undefined);
    }
  }, [open, sourceDate]);
  
  // Handle source day selection
  const handleSourceSelect = useCallback((date: Date) => {
    setSelectedSourceDate(date);
  }, []);
  
  // Proceed to target selection
  const goToTargetSelection = useCallback(() => {
    if (selectedSourceDate && totalSourceItems > 0) {
      setStep('target');
    }
  }, [selectedSourceDate, totalSourceItems]);
  
  // Handle target date selection
  const handleTargetSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    if (isPastDate(date)) {
      toast({
        title: 'לא ניתן לבחור תאריך בעבר',
        variant: 'destructive'
      });
      return;
    }
    setSelectedTargetDate(date);
    setStep('confirm');
  }, [toast]);
  
  // Handle continuous end date selection
  const handleEndDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    if (!selectedTargetDate) return;
    if (date <= selectedTargetDate) {
      toast({
        title: 'יש לבחור תאריך אחרי תאריך היעד הראשון',
        variant: 'destructive'
      });
      return;
    }
    setSelectedEndDate(date);
  }, [selectedTargetDate, toast]);

  // Go to continuous target selection
  const goToContinuousSelection = useCallback(() => {
    setStep('continuousTarget');
  }, []);

  // Calculate number of days in range
  const daysInRange = useMemo(() => {
    if (!selectedTargetDate || !selectedEndDate) return 0;
    return differenceInDays(selectedEndDate, selectedTargetDate) + 1;
  }, [selectedTargetDate, selectedEndDate]);

  // Confirm duplication
  const handleConfirmDuplicate = useCallback(async () => {
    if (!selectedSourceDate || !selectedTargetDate) return;
    
    const sourceDateFormatted = formatJerusalemDate(selectedSourceDate);
    const targetDateFormatted = formatJerusalemDate(selectedTargetDate);
    
    try {
      const result = await duplicateMutation.mutateAsync({
        sourceDate: sourceDateFormatted,
        targetDate: targetDateFormatted,
      });
      
      toast({
        title: 'השכפול הושלם בהצלחה!',
        description: `${result.copiedTasks} משימות ו-${result.copiedEvents} אירועים שוכפלו`,
      });
      
      handleOpenChange(false);
      if (onSuccess) {
        onSuccess(selectedTargetDate);
      }
    } catch (error: any) {
      console.error('Duplication error:', error);
      toast({
        title: 'שגיאה בשכפול',
        description: error?.message || 'אנא נסה שוב',
        variant: 'destructive'
      });
    }
  }, [selectedSourceDate, selectedTargetDate, duplicateMutation, toast, handleOpenChange, onSuccess]);

  // Confirm continuous duplication (to range of dates)
  const handleConfirmContinuousDuplicate = useCallback(async () => {
    if (!selectedSourceDate || !selectedTargetDate || !selectedEndDate) return;
    
    setIsContinuousDuplicating(true);
    const sourceDateFormatted = formatJerusalemDate(selectedSourceDate);
    
    let totalTasks = 0;
    let totalEvents = 0;
    let currentDate = selectedTargetDate;
    
    try {
      // Duplicate to each day in the range
      while (currentDate <= selectedEndDate) {
        const targetDateFormatted = formatJerusalemDate(currentDate);
        
        const result = await duplicateMutation.mutateAsync({
          sourceDate: sourceDateFormatted,
          targetDate: targetDateFormatted,
        });
        
        totalTasks += result.copiedTasks;
        totalEvents += result.copiedEvents;
        
        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
      
      toast({
        title: 'השכפול הרציף הושלם בהצלחה!',
        description: `${totalTasks} משימות ו-${totalEvents} אירועים שוכפלו ל-${daysInRange} ימים`,
      });
      
      handleOpenChange(false);
      if (onSuccess) {
        onSuccess(selectedEndDate);
      }
    } catch (error: any) {
      console.error('Continuous duplication error:', error);
      toast({
        title: 'שגיאה בשכפול',
        description: error?.message || 'אנא נסה שוב',
        variant: 'destructive'
      });
    } finally {
      setIsContinuousDuplicating(false);
    }
  }, [selectedSourceDate, selectedTargetDate, selectedEndDate, daysInRange, duplicateMutation, toast, handleOpenChange, onSuccess]);
  
  // Back navigation
  const goBack = useCallback(() => {
    if (step === 'target') {
      setStep('source');
      setSelectedTargetDate(undefined);
    } else if (step === 'confirm') {
      setStep('target');
    } else if (step === 'continuousTarget') {
      setStep('confirm');
      setSelectedEndDate(undefined);
    }
  }, [step]);
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Copy className="w-5 h-5" />
            שכפול לוח זמנים
          </DialogTitle>
          <DialogDescription>
            {step === 'source' && 'בחר את היום שברצונך לשכפל'}
            {step === 'target' && 'בחר את היום שאליו לשכפל'}
            {step === 'confirm' && 'אשר את השכפול'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
          <Badge variant={step === 'source' ? 'default' : 'secondary'} className="gap-1">
            1. יום מקור
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant={step === 'target' ? 'default' : 'secondary'} className="gap-1">
            2. יום יעד
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <Badge variant={step === 'confirm' ? 'default' : 'secondary'} className="gap-1">
            3. אישור
          </Badge>
        </div>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* Step 1: Source day selection */}
        {step === 'source' && (
          <div className="space-y-4">
            {!currentWeekStart ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>לא נבחר שבוע לשכפול</p>
              </div>
            ) : availabilityLoading ? (
              <div className="space-y-2">
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {weekDays.map((day, idx) => {
                    const dateStr = formatJerusalemDate(day);
                    const hasContent = daysWithContent.has(dateStr);
                    const isSelected = selectedSourceDate && isSameDay(selectedSourceDate, day);
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSourceSelect(day)}
                        disabled={!hasContent}
                        className={`w-full p-3 rounded-lg border text-right transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                            : hasContent 
                              ? 'border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer' 
                              : 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
                        }`}
                        data-testid={`source-day-${idx}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-base">{getHebrewDayName(idx)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(day, 'dd/MM/yyyy', { locale: he })}
                            </div>
                          </div>
                          <div className="text-left">
                            {hasContent ? (
                              <Badge variant="secondary" className="gap-1">
                                יש תוכן
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">ריק</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Show preview of items when selected */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t">
                            {sourceDataLoading ? (
                              <div className="space-y-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                              </div>
                            ) : totalSourceItems > 0 ? (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">תצוגה מקדימה:</div>
                                
                                {/* Tasks */}
                                {sourceTasks.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
                                      <CheckSquare className="w-3 h-3" />
                                      משימות ({sourceTasks.length})
                                    </div>
                                    {sourceTasks.slice(0, 3).map((task: any, tIdx: number) => (
                                      <div key={tIdx} className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                                        <span className="font-medium text-blue-700 dark:text-blue-300 flex-shrink-0">{task.time || '--:--'}</span>
                                        <span className="text-gray-900 dark:text-gray-100">{task.name}</span>
                                      </div>
                                    ))}
                                    {sourceTasks.length > 3 && (
                                      <div className="text-xs text-muted-foreground pr-2">
                                        ועוד {sourceTasks.length - 3} משימות...
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Events */}
                                {sourceEvents.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                                      <CalendarDays className="w-3 h-3" />
                                      אירועים ({sourceEvents.length})
                                    </div>
                                    {sourceEvents.slice(0, 3).map((event: any, eIdx: number) => (
                                      <div key={eIdx} className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/30 rounded px-2 py-1">
                                        <span className="font-medium text-green-700 dark:text-green-300 flex-shrink-0">{event.time || '--:--'}</span>
                                        <span className="text-gray-900 dark:text-gray-100">{event.name}</span>
                                      </div>
                                    ))}
                                    {sourceEvents.length > 3 && (
                                      <div className="text-xs text-muted-foreground pr-2">
                                        ועוד {sourceEvents.length - 3} אירועים...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground text-center py-2">
                                אין משימות או אירועים ביום זה
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
        
        {/* Step 2: Target day selection */}
        {step === 'target' && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-sm text-muted-foreground">משכפל מ:</div>
              <div className="font-bold">
                {selectedSourceDate && (
                  <>
                    {getHebrewDayName(selectedSourceDate.getDay())}, {format(selectedSourceDate, 'dd/MM/yyyy', { locale: he })}
                  </>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <Badge variant="secondary" className="gap-1">
                  <CheckSquare className="w-3 h-3" />
                  {sourceTasks.length} משימות
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {sourceEvents.length} אירועים
                </Badge>
              </div>
            </div>
            
            <Calendar
              mode="single"
              selected={selectedTargetDate}
              onSelect={handleTargetSelect}
              locale={he}
              dir="rtl"
              disabled={(date) => {
                if (isPastDate(date)) return true;
                if (selectedSourceDate && isSameDay(date, selectedSourceDate)) return true;
                return false;
              }}
              className="rounded-md border"
              data-testid="target-calendar"
            />
          </div>
        )}
        
        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Source */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">יום מקור</div>
                <div className="font-bold text-lg">
                  {selectedSourceDate && getHebrewDayName(selectedSourceDate.getDay())}
                </div>
                <div className="text-sm">
                  {selectedSourceDate && format(selectedSourceDate, 'dd/MM/yyyy', { locale: he })}
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckSquare className="w-3 h-3" />
                    {sourceTasks.length}
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CalendarDays className="w-3 h-3" />
                    {sourceEvents.length}
                  </Badge>
                </div>
              </div>
              
              {/* Target */}
              <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary">
                <div className="text-sm text-muted-foreground mb-1">יום יעד</div>
                <div className="font-bold text-lg">
                  {selectedTargetDate && getHebrewDayName(selectedTargetDate.getDay())}
                </div>
                <div className="text-sm">
                  {selectedTargetDate && format(selectedTargetDate, 'dd/MM/yyyy', { locale: he })}
                </div>
                {checkingTarget ? (
                  <Skeleton className="h-5 w-20 mt-2" />
                ) : isTargetEmpty ? (
                  <Badge variant="outline" className="mt-2 gap-1 text-green-600 border-green-600 text-xs">
                    <CheckCircle className="w-3 h-3" />
                    יום ריק
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="mt-2 gap-1 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    יש תוכן קיים
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Items preview */}
            <div className="border rounded-lg p-3">
              <div className="text-sm font-semibold mb-2">פריטים שישוכפלו:</div>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {/* Tasks */}
                  {sourceTasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-blue-600 sticky top-0 bg-background py-1">
                        <CheckSquare className="w-3 h-3" />
                        משימות ({sourceTasks.length})
                      </div>
                      {sourceTasks.map((task: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5">
                          <span className="font-medium text-blue-700 dark:text-blue-300 flex-shrink-0">{task.time || '--:--'}</span>
                          <span className="text-gray-900 dark:text-gray-100">{task.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Events */}
                  {sourceEvents.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-green-600 sticky top-0 bg-background py-1">
                        <CalendarDays className="w-3 h-3" />
                        אירועים ({sourceEvents.length})
                      </div>
                      {sourceEvents.map((event: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/30 rounded px-2 py-1.5">
                          <span className="font-medium text-green-700 dark:text-green-300 flex-shrink-0">{event.time || '--:--'}</span>
                          <span className="text-gray-900 dark:text-gray-100">{event.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {!isTargetEmpty && !checkingTarget && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">שים לב!</div>
                  <div>יש תוכן קיים ביום היעד. הפריטים החדשים יתווספו לצד הקיימים.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Continuous target selection (optional) */}
        {step === 'continuousTarget' && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-sm text-muted-foreground">משכפל מ:</div>
              <div className="font-bold">
                {selectedSourceDate && (
                  <>
                    {getHebrewDayName(selectedSourceDate.getDay())}, {format(selectedSourceDate, 'dd/MM/yyyy', { locale: he })}
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-2">מתאריך:</div>
              <div className="font-bold text-primary">
                {selectedTargetDate && (
                  <>
                    {getHebrewDayName(selectedTargetDate.getDay())}, {format(selectedTargetDate, 'dd/MM/yyyy', { locale: he })}
                  </>
                )}
              </div>
              {selectedEndDate && (
                <>
                  <div className="text-sm text-muted-foreground mt-2">עד תאריך:</div>
                  <div className="font-bold text-primary">
                    {getHebrewDayName(selectedEndDate.getDay())}, {format(selectedEndDate, 'dd/MM/yyyy', { locale: he })}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {daysInRange} ימים
                  </Badge>
                </>
              )}
            </div>
            
            <div className="text-center text-sm font-medium">בחר תאריך סיום לשכפול רציף:</div>
            
            <Calendar
              mode="single"
              selected={selectedEndDate}
              onSelect={handleEndDateSelect}
              locale={he}
              dir="rtl"
              disabled={(date) => {
                if (!selectedTargetDate) return true;
                if (date <= selectedTargetDate) return true;
                return false;
              }}
              className="rounded-md border"
              data-testid="end-date-calendar"
            />
          </div>
        )}
        </div>
        
        <DialogFooter className="flex-row-reverse justify-between sm:justify-between flex-shrink-0">
          {step !== 'source' && (
            <Button variant="outline" onClick={goBack} className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              חזרה
            </Button>
          )}
          
          {step === 'source' && (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                ביטול
              </Button>
              <Button 
                onClick={goToTargetSelection}
                disabled={!selectedSourceDate || totalSourceItems === 0 || sourceDataLoading}
                className="gap-1"
              >
                {sourceDataLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    טוען...
                  </>
                ) : (
                  <>
                    המשך
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </Button>
            </div>
          )}
          
          {step === 'target' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              ביטול
            </Button>
          )}
          
          {step === 'confirm' && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={goToContinuousSelection}
                disabled={duplicateMutation.isPending || checkingTarget}
                className="gap-1"
              >
                <Repeat className="w-4 h-4" />
                רציף
              </Button>
              <Button 
                onClick={handleConfirmDuplicate}
                disabled={duplicateMutation.isPending || checkingTarget}
                className="gap-1"
              >
                {duplicateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    משכפל...
                  </>
                ) : checkingTarget ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    בודק זמינות...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    שכפל {totalSourceItems} פריטים
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'continuousTarget' && (
            <Button 
              onClick={handleConfirmContinuousDuplicate}
              disabled={!selectedEndDate || isContinuousDuplicating}
              className="gap-1"
            >
              {isContinuousDuplicating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  משכפל...
                </>
              ) : (
                <>
                  <Repeat className="w-4 h-4" />
                  שכפל ל-{daysInRange || '?'} ימים
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
