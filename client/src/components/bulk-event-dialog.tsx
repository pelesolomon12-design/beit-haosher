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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Loader2, Clock, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getTodayJerusalem, createJerusalemDate, addDaysToJerusalemDate, formatJerusalemDate } from '@/lib/utils';
import { EVENT_COLORS, EventColor } from '@shared/schema';

const EVENT_COLOR_OPTIONS: { value: EventColor; label: string; bgClass: string; borderClass: string }[] = [
  { value: 'purple', label: 'סגול', bgClass: 'bg-purple-500', borderClass: 'border-purple-600' },
  { value: 'blue', label: 'כחול', bgClass: 'bg-blue-500', borderClass: 'border-blue-600' },
  { value: 'orange', label: 'כתום', bgClass: 'bg-orange-300', borderClass: 'border-orange-400' },
  { value: 'gold', label: 'זהב', bgClass: 'bg-yellow-400', borderClass: 'border-yellow-500' },
];

// Form schema for bulk event creation
const bulkEventFormSchema = z.object({
  name: z.string().min(1, "יש להזין שם אירוע"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  startDate: z.date(),
  numberOfDays: z.number().min(1, "יש להזין מספר ימים תקין").max(365, "מספר ימים לא יכול להיות יותר מ-365"),
  note: z.string().default(''),
  color: z.enum(EVENT_COLORS).default('purple'),
});

type BulkEventFormData = z.infer<typeof bulkEventFormSchema>;

interface BulkEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkEventDialog({ open, onOpenChange }: BulkEventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BulkEventFormData>({
    resolver: zodResolver(bulkEventFormSchema),
    defaultValues: {
      name: '',
      time: null,
      startDate: createJerusalemDate(getTodayJerusalem()),
      numberOfDays: 1,
      note: '',
      color: 'purple',
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
        note: '',
        color: 'purple',
      });
    }
  }, [open, form]);

  // Mutation for creating bulk events
  const createBulkEventsMutation = useMutation({
    mutationFn: async (data: BulkEventFormData) => {
      const events = [];
      const startDateStr = formatJerusalemDate(data.startDate);
      
      // Create events for consecutive days
      for (let i = 0; i < data.numberOfDays; i++) {
        const eventDate = addDaysToJerusalemDate(startDateStr, i);
        const eventData = {
          name: data.name,
          time: data.time,
          date: eventDate,
          note: data.note,
          color: data.color,
        };
        
        const response = await apiRequest('POST', '/api/events', eventData);
        const event = await response.json();
        events.push(event);
      }
      
      return events;
    },
    onSuccess: (events) => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      
      toast({
        title: "אירועים נוצרו בהצלחה!",
        description: `נוצרו ${events.length} אירועים רצופים החל מ-${format(form.getValues('startDate'), 'dd/MM/yyyy', { locale: he })}`,
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Bulk events creation error:', error);
      toast({
        title: "שגיאה ביצירת אירועים",
        description: "שגיאה בלתי צפויה אירעה. נסה שוב.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BulkEventFormData) => {
    createBulkEventsMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-bulk-event">
        <DialogHeader>
          <DialogTitle className="text-right">יצירת אירועים קבועים</DialogTitle>
          <DialogDescription className="text-right">
            יצירת אירועים זהים במספר ימים רצופים
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Event Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right">שם האירוע</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="הזן שם אירוע" 
                      className="text-right"
                      data-testid="input-event-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time - Using time picker instead of text input */}
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    שעה (אופציונלי)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      type="time"
                      value={field.value || ''}
                      className="text-right"
                      data-testid="input-event-time"
                    />
                  </FormControl>
                  <FormDescription className="text-right text-sm text-gray-600">
                    השאר ריק עבור אירוע ללא שעה קבועה
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-right">תאריך התחלה</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "pl-3 text-right font-normal justify-end",
                            !field.value && "text-muted-foreground"
                          )}
                          data-testid="button-start-date-picker"
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy", { locale: he })
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Number of Days */}
            <FormField
              control={form.control}
              name="numberOfDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right">מספר ימים רצופים</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="365"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      className="text-right"
                      data-testid="input-number-of-days"
                    />
                  </FormControl>
                  <FormDescription className="text-right text-sm text-gray-600">
                    האירוע יווצר בכל אחד מהימים הרצופים החל מתאריך ההתחלה
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right">הערות</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="הערות נוספות (אופציונלי)"
                      className="text-right resize-none"
                      rows={3}
                      data-testid="textarea-event-note"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-right">צבע האירוע</FormLabel>
                  <FormControl>
                    <div className="flex gap-3 mt-2 justify-end">
                      {EVENT_COLOR_OPTIONS.map((colorOption) => (
                        <button
                          key={colorOption.value}
                          type="button"
                          onClick={() => field.onChange(colorOption.value)}
                          className={`w-10 h-10 rounded-full ${colorOption.bgClass} flex items-center justify-center transition-all border-2 ${
                            field.value === colorOption.value 
                              ? `${colorOption.borderClass} ring-2 ring-offset-2 ring-gray-400` 
                              : 'border-transparent hover:scale-110'
                          }`}
                          title={colorOption.label}
                          data-testid={`button-color-${colorOption.value}`}
                        >
                          {field.value === colorOption.value && (
                            <Check className="w-5 h-5 text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex-row-reverse">
              <Button 
                type="submit" 
                disabled={createBulkEventsMutation.isPending}
                data-testid="button-create-events"
              >
                {createBulkEventsMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                צור אירועים
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                ביטול
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}