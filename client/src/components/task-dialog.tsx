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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, Calendar as CalendarIcon, User, Trash2, Clock } from 'lucide-react';
import { 
  useCreateDailyTask, 
  useUpdateDailyTask, 
  useDeleteDailyTask,
  useOccupants 
} from '@/hooks/use-daily-tasks';
import { insertDailyTaskSchema, SelectDailyTask } from '@shared/schema';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

// Form schema based on insertDailyTaskSchema but with proper validation messages
const taskFormSchema = insertDailyTaskSchema.extend({
  name: z.string().min(1, "יש להזין שם משימה"),
  time: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "יש להזין שעה תקינה בפורמט HH:mm").nullable().optional()
  ),
  note: z.string().optional(),
  occupantId: z.string().nullable().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: SelectDailyTask | null;
  selectedDate?: Date;
  mode: 'create' | 'edit';
}

export function TaskDialog({ 
  open, 
  onOpenChange, 
  task, 
  selectedDate,
  mode 
}: TaskDialogProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<SelectDailyTask | null>(null);
  
  const createMutation = useCreateDailyTask();
  const updateMutation = useUpdateDailyTask();
  const deleteMutation = useDeleteDailyTask();
  const { data: occupants, isLoading: occupantsLoading } = useOccupants();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: '',
      time: null,
      note: '',
      occupantId: null,
      date: selectedDate || new Date(),
    },
  });

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (!open) return;
    
    try {
      if (task && mode === 'edit') {
        // Edit mode - populate with existing task data
        form.reset({
          name: task.name || '',
          time: task.time || null,
          note: task.note || '',
          occupantId: task.occupantId || null,
          date: task.date ? new Date(task.date) : new Date(),
        });
      } else if (mode === 'create') {
        // Create mode - populate with default values
        form.reset({
          name: '',
          time: null,
          note: '',
          occupantId: null,
          date: selectedDate || new Date(),
        });
      }
    } catch (error) {
      console.error('Error resetting form:', error);
      // Fallback to empty form
      form.reset({
        name: '',
        time: null,
        note: '',
        occupantId: null,
        date: selectedDate || new Date(),
      });
    }
  }, [open, task, mode, selectedDate, form]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      // Ensure note is always a string
      const taskData = {
        ...data,
        note: data.note || '',
      };

      if (mode === 'create') {
        await createMutation.mutateAsync(taskData);
      } else if (task) {
        await updateMutation.mutateAsync({
          id: task.id,
          data: taskData,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Task operation error:', error);
    }
  };

  const handleDeleteClick = () => {
    if (!task) return;
    // Store the task to delete, close edit dialog, then show delete confirmation
    setTaskToDelete(task);
    onOpenChange(false);
    // Use setTimeout to ensure edit dialog closes first
    setTimeout(() => {
      setShowDeleteDialog(true);
    }, 100);
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(taskToDelete.id);
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Delete task error:', error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              {mode === 'create' ? 'משימה חדשה' : 'עריכת משימה'}
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
                    <FormLabel>שם המשימה *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="הזן שם המשימה..."
                        {...field}
                        data-testid="input-task-name"
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
                        data-testid="input-task-time"
                      />
                    </FormControl>
                    <FormDescription>
                      שעה לביצוע המשימה (אופציונלי)
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
                    <FormLabel>שיוך לדייר</FormLabel>
                    <Select
                      value={field.value === null ? 'none' : field.value || undefined}
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      disabled={occupantsLoading}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-occupant">
                          <SelectValue placeholder="בחר דייר (אופציונלי)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">ללא שיוך לדייר</SelectItem>
                        {occupants?.map((occupant) => (
                          <SelectItem 
                            key={occupant.id} 
                            value={occupant.id}
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {occupant.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      ניתן לשייך את המשימה לדייר ספציפי
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
                        placeholder="הוסף הערות נוספות..."
                        className="resize-none"
                        {...field}
                        value={field.value || ''}
                        data-testid="textarea-task-note"
                      />
                    </FormControl>
                    <FormDescription>
                      פרטים נוספים על המשימה (אופציונלי)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <div className="flex justify-between w-full">
                  {mode === 'edit' && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteClick}
                      disabled={isLoading || deleteMutation.isPending}
                      data-testid="button-delete-task"
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      מחק
                    </Button>
                  )}
                  
                  <div className="flex gap-2 mr-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isLoading}
                      data-testid="button-cancel-task"
                    >
                      ביטול
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      data-testid="button-save-task"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                      {mode === 'create' ? 'צור משימה' : 'שמור שינויים'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setTaskToDelete(null);
      }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת משימה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את המשימה "{taskToDelete?.name}"? 
              פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              )}
              מחק משימה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}