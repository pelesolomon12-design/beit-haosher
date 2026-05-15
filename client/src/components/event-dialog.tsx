import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Calendar as CalendarIcon, Trash2, Clock, Star, Check } from 'lucide-react';
import { 
  useCreateEvent, 
  useUpdateEvent, 
  useDeleteEvent
} from '@/hooks/use-daily-tasks';
import { insertEventSchema, SelectEvent, EVENT_COLORS, EventColor } from '@shared/schema';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const EVENT_COLOR_OPTIONS: { value: EventColor; label: string; bgClass: string; borderClass: string }[] = [
  { value: 'purple', label: 'סגול', bgClass: 'bg-purple-500', borderClass: 'border-purple-600' },
  { value: 'blue', label: 'כחול', bgClass: 'bg-blue-500', borderClass: 'border-blue-600' },
  { value: 'orange', label: 'כתום', bgClass: 'bg-orange-300', borderClass: 'border-orange-400' },
  { value: 'gold', label: 'זהב', bgClass: 'bg-yellow-400', borderClass: 'border-yellow-500' },
];

// Form schema based on insertEventSchema but with proper validation messages
const eventFormSchema = insertEventSchema.extend({
  name: z.string().min(1, "יש להזין שם אירוע"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  note: z.string().optional(),
  color: z.enum(EVENT_COLORS).default('purple'),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: SelectEvent | null;
  selectedDate?: Date;
  mode: 'create' | 'edit';
}

export function EventDialog({ 
  open, 
  onOpenChange, 
  event, 
  selectedDate,
  mode 
}: EventDialogProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SelectEvent | null>(null);
  
  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      time: null,
      note: '',
      date: selectedDate || new Date(),
      color: 'purple',
    },
  });

  // Reset form when dialog opens/closes or event changes
  useEffect(() => {
    if (!open) return;
    
    try {
      if (event && mode === 'edit') {
        // Edit mode - populate with existing event data
        form.reset({
          name: event.name || '',
          time: event.time || null,
          note: event.note || '',
          date: event.date ? new Date(event.date) : new Date(),
          color: (event.color as EventColor) || 'purple',
        });
      } else if (mode === 'create') {
        // Create mode - populate with default values
        form.reset({
          name: '',
          time: null,
          note: '',
          date: selectedDate || new Date(),
          color: 'purple',
        });
      }
    } catch (error) {
      console.error('Error resetting form:', error);
      // Fallback to empty form
      form.reset({
        name: '',
        time: null,
        note: '',
        date: selectedDate || new Date(),
        color: 'purple',
      });
    }
  }, [open, event, mode, selectedDate, form]);

  const onSubmit = async (data: EventFormData) => {
    try {
      // Ensure note is always a string
      const eventData = {
        ...data,
        note: data.note || '',
      };

      if (mode === 'create') {
        await createMutation.mutateAsync(eventData);
      } else if (event) {
        await updateMutation.mutateAsync({
          id: event.id,
          data: eventData,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Event operation error:', error);
    }
  };

  const handleDeleteClick = () => {
    if (!event) return;
    // Store the event to delete, close edit dialog, then show delete confirmation
    setEventToDelete(event);
    onOpenChange(false);
    // Use setTimeout to ensure edit dialog closes first
    setTimeout(() => {
      setShowDeleteDialog(true);
    }, 100);
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(eventToDelete.id);
      setShowDeleteDialog(false);
      setEventToDelete(null);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Delete event error:', error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-600" />
              {mode === 'create' ? 'אירוע חדש' : 'עריכת אירוע'}
            </DialogTitle>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: he })}
              </p>
            )}
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם האירוע *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="הזן שם האירוע..."
                        {...field}
                        data-testid="input-event-name"
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
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      שעה
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        placeholder="HH:mm"
                        {...field}
                        value={field.value || ''}
                        data-testid="input-event-time"
                      />
                    </FormControl>
                    <FormDescription>
                      אופציונלי - הזן שעה בפורמט HH:mm (למשל: 09:30)
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
                        placeholder="הוסף הערות לאירוע..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ''}
                        data-testid="textarea-event-note"
                      />
                    </FormControl>
                    <FormDescription>
                      הערות נוספות או פרטים על האירוע
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>צבע האירוע</FormLabel>
                    <FormControl>
                      <div className="flex gap-3 mt-2">
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

              <DialogFooter className="flex gap-2">
                <div className="flex w-full justify-between">
                  <div>
                    {mode === 'edit' && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteClick}
                        disabled={isLoading || deleteMutation.isPending}
                        data-testid="button-delete-event"
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        מחק
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isLoading}
                      data-testid="button-cancel-event"
                    >
                      ביטול
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      data-testid="button-save-event"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                      {mode === 'create' ? 'צור אירוע' : 'שמור שינויים'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setEventToDelete(null);
      }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת אירוע</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את האירוע "{eventToDelete?.name}"?
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-event">
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-event"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}