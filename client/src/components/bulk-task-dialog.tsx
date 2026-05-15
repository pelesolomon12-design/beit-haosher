import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useOccupants } from '@/hooks/use-daily-tasks';
import { getTodayJerusalem, createJerusalemDate, addDaysToJerusalemDate, formatJerusalemDate } from '@/lib/utils';

// Form schema for bulk task creation
const bulkTaskFormSchema = z.object({
  name: z.string().min(1, "יש להזין שם משימה"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  startDate: z.date(),
  numberOfDays: z.number().min(1, "יש להזין מספר ימים תקין").max(365, "מספר ימים לא יכול להיות יותר מ-365"),
  occupantId: z.string().nullable().optional(),
  note: z.string().default(''),
});

type BulkTaskFormData = z.infer<typeof bulkTaskFormSchema>;

interface BulkTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkTaskDialog({ open, onOpenChange }: BulkTaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: occupants, isLoading: occupantsLoading } = useOccupants();

  const form = useForm<BulkTaskFormData>({
    resolver: zodResolver(bulkTaskFormSchema),
    defaultValues: {
      name: '',
      time: null,
      startDate: createJerusalemDate(getTodayJerusalem()),
      numberOfDays: 1,
      occupantId: null,
      note: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        time: null,
        startDate: createJerusalemDate(getTodayJerusalem()),
        numberOfDays: 1,
        occupantId: null,
        note: '',
      });
    }
  }, [open, form]);

  // Mutation for creating bulk tasks
  const createBulkTasksMutation = useMutation({
    mutationFn: async (data: BulkTaskFormData) => {
      const tasks = [];
      const startDateStr = formatJerusalemDate(data.startDate);
      
      // Create tasks for consecutive days
      for (let i = 0; i < data.numberOfDays; i++) {
        const taskDate = addDaysToJerusalemDate(startDateStr, i);
        const taskData = {
          name: data.name,
          time: data.time,
          date: taskDate,
          occupantId: data.occupantId,
          note: data.note,
        };
        
        const response = await apiRequest('POST', '/api/daily-tasks', taskData);
        const task = await response.json();
        tasks.push(task);
      }
      
      return tasks;
    },
    onSuccess: (tasks) => {
      // Invalidate and refetch daily tasks
      queryClient.invalidateQueries({ queryKey: ['/api/daily-tasks'] });
      
      toast({
        title: "משימות נוצרו בהצלחה!",
        description: `נוצרו ${tasks.length} משימות בהצלחה`,
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error creating bulk tasks:', error);
      toast({
        variant: "destructive",
        title: "שגיאה ביצירת המשימות",
        description: error.message || "אירעה שגיאה בלתי צפויה",
      });
    },
  });

  const onSubmit = async (data: BulkTaskFormData) => {
    createBulkTasksMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-right">
            יצירת משימות רצופות
          </DialogTitle>
          <DialogDescription className="text-right">
            צור משימה למספר ימים רצופים בקלות
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם המשימה *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="הזן שם המשימה..."
                      {...field}
                      data-testid="input-bulk-task-name"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שעה</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      placeholder="בחר שעה (אופציונלי)"
                      {...field}
                      value={field.value || ''}
                      data-testid="input-bulk-task-time"
                    />
                  </FormControl>
                  <FormDescription>
                    שעה לביצוע המשימות (אופציונלי) - כל המשימות הרצופות יקבלו את אותה השעה
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>תאריך התחלה *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-bulk-task-date"
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: he })
                          ) : (
                            <span>בחר תאריך</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const checkDate = new Date(date);
                          checkDate.setHours(0, 0, 0, 0);
                          return checkDate < today;
                        }}
                        locale={he}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    התאריך שבו תתחיל המשימה הראשונה
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numberOfDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר ימים רצופים *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      data-testid="input-bulk-task-days"
                    />
                  </FormControl>
                  <FormDescription>
                    כמה ימים רצופים ליצור את המשימה (מקסימום 365)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occupantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>דייר (אופציונלי)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value || 'none'}
                    disabled={occupantsLoading}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-bulk-task-occupant">
                        <SelectValue placeholder="בחר דייר (אופציונלי)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">ללא דייר</SelectItem>
                      {occupants?.map((occupant) => (
                        <SelectItem key={occupant.id} value={occupant.id}>
                          {occupant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    קשר את המשימה לדייר ספציפי (אופציונלי)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="הערות נוספות על המשימה..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-bulk-task-note"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-bulk-task"
              >
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={createBulkTasksMutation.isPending}
                data-testid="button-submit-bulk-task"
              >
                {createBulkTasksMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    יוצר משימות...
                  </>
                ) : (
                  'צור משימות'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}