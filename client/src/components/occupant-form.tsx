import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Room, Occupant } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, Calendar } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, "יש להזין שם"),
  roomId: z.string().min(1, "יש לבחור חדר"),
  joinDate: z.string().min(1, 'יש לבחור תאריך הצטרפות'),
  endDate: z.string().min(1, 'יש לבחור תאריך עזיבה'),
  plannedMonths: z.string().min(1, "יש לבחור מספר חודשים מתוכננים"),
  paidMonths: z.string().min(0, "יש לבחור מספר חודשים ששולמו"),
  stayingProbability: z.enum(['בטוח', 'אולי', 'בטוח שלא']),
  stayingDuration: z.number().min(1, "מינימום חודש אחד").max(2, "מקסימום 2 חודשים").optional(),
  deposits: z.string().transform((val) => parseInt(val) || 0),
  safeItems: z.string().default(''),
});

type FormData = z.infer<typeof formSchema>;

interface OccupantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { 
    name: string; 
    roomId: string; 
    joinDate: Date;
    endDateTime: Date;
    plannedMonths: number;
    paidMonths: number;
    stayingProbability: 'בטוח' | 'אולי' | 'בטוח שלא';
    stayingDuration?: number;
    deposits: number;
    safeItems: string;
  }) => Promise<void>;
  rooms: Room[];
  editingOccupant?: Occupant | null;
  preSelectedRoomId?: string;
}

export function OccupantForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  rooms, 
  editingOccupant,
  preSelectedRoomId 
}: OccupantFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      roomId: preSelectedRoomId || '',
      joinDate: '',
      endDate: '',
      plannedMonths: '1',
      paidMonths: '0',
      stayingProbability: 'אולי' as const,
      stayingDuration: undefined,
      deposits: 0 as any,
      safeItems: '',
    }
  });

  const selectedRoomId = watch('roomId');

  useEffect(() => {
    if (editingOccupant) {
      const joinDate = new Date(editingOccupant.joinDate);
      const endDate = new Date(editingOccupant.endDateTime);
      
      setValue('name', editingOccupant.name);
      setValue('roomId', editingOccupant.roomId);
      setValue('joinDate', joinDate.toISOString().split('T')[0]);
      setValue('endDate', endDate.toISOString().split('T')[0]);
      setValue('plannedMonths', editingOccupant.plannedMonths.toString());
      setValue('paidMonths', editingOccupant.paidMonths.toString());
      setValue('stayingProbability', editingOccupant.stayingProbability);
      setValue('stayingDuration', editingOccupant.stayingDuration);
      setValue('deposits', editingOccupant.deposits || 0 as any);
      setValue('safeItems', editingOccupant.safeItems || '');


    } else if (preSelectedRoomId) {
      setValue('roomId', preSelectedRoomId);
      // Set default join date to today
      const today = new Date();
      setValue('joinDate', today.toISOString().split('T')[0]);
      // Set default end date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setValue('endDate', tomorrow.toISOString().split('T')[0]);
    }
  }, [editingOccupant, preSelectedRoomId, setValue]);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const joinDate = new Date(`${data.joinDate}T00:00:00`);
      const endDateTime = new Date(`${data.endDate}T23:59:59`);
      
      const submitData = {
        name: data.name,
        roomId: data.roomId,
        joinDate,
        endDateTime,
        plannedMonths: parseInt(data.plannedMonths),
        paidMonths: parseInt(data.paidMonths),
        stayingProbability: data.stayingProbability,
        stayingDuration: data.stayingDuration,
        deposits: typeof data.deposits === 'string' ? parseInt(data.deposits) || 0 : data.deposits,
        safeItems: data.safeItems || ''
      };
      
      await onSubmit(submitData);

      toast({
        title: editingOccupant ? 'המטופל עודכן בהצלחה' : 'המטופל נוסף בהצלחה',
        description: editingOccupant 
          ? `פרטי ${data.name} עודכנו`
          : `${data.name} נוסף לחדר`,
      });

      onClose();
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בשמירת הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoom = rooms.find(room => room.id === selectedRoomId);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editingOccupant ? 'עריכת מטופל' : 'הוספת מטופל חדש'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-4" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-right block">שם מלא</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="הכנס שם מלא"
              className="text-right"
              dir="rtl"
            />
            {errors.name && (
              <p className="text-sm text-red-600 text-right">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomId" className="text-right block">חדר</Label>
            <Select onValueChange={(value) => setValue('roomId', value)} value={selectedRoomId}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="בחר חדר" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roomId && (
              <p className="text-sm text-red-600 text-right">{errors.roomId.message}</p>
            )}
            {selectedRoom && (
              <p className="text-sm text-gray-600 text-right">
                קיבולת מקסימלית: {selectedRoom.maxCapacity} מטופלים
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-right block">תאריך סיום</Label>
            <Input
              id="endDate"
              type="date"
              {...register('endDate')}
              className="text-right"
              dir="rtl"
            />
            {errors.endDate && (
              <p className="text-sm text-red-600 text-right">{errors.endDate.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plannedMonths" className="text-right block">חודשים מתוכננים</Label>
              <Select onValueChange={(value) => setValue('plannedMonths', value)} value={watch('plannedMonths')}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר מספר חודשים" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="1">חודש אחד</SelectItem>
                  <SelectItem value="2">שני חודשים</SelectItem>
                  <SelectItem value="3">שלושה חודשים</SelectItem>
                </SelectContent>
              </Select>
              {errors.plannedMonths && (
                <p className="text-sm text-red-600 text-right">{errors.plannedMonths.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidMonths" className="text-right block">חודשים ששולמו</Label>
              <Select onValueChange={(value) => setValue('paidMonths', value)} value={watch('paidMonths')}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר מספר חודשים" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="0">לא שילם עדיין</SelectItem>
                  <SelectItem value="1">חודש אחד</SelectItem>
                  <SelectItem value="2">שני חודשים</SelectItem>
                  <SelectItem value="3">שלושה חודשים</SelectItem>
                </SelectContent>
              </Select>
              {errors.paidMonths && (
                <p className="text-sm text-red-600 text-right">{errors.paidMonths.message}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Staying Probability Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-end">
              <h3 className="text-sm font-medium">סבירות להישאר</h3>
              <Calendar className="h-4 w-4" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stayingProbability" className="text-right block">
                {parseInt(watch('plannedMonths')) === parseInt(watch('paidMonths')) ? 
                  'סבירות להוספת חודש נוסף' : 
                  'סבירות להישאר עוד חודש'}
              </Label>
              <Select onValueChange={(value) => {
                setValue('stayingProbability', value as 'בטוח' | 'אולי' | 'בטוח שלא');
                if (value === 'בטוח שלא') {
                  setValue('stayingDuration', undefined);
                }
              }} value={watch('stayingProbability')}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר סבירות" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="בטוח">בטוח - להישאר</SelectItem>
                  <SelectItem value="אולי">אולי - לא בטוח</SelectItem>
                  <SelectItem value="בטוח שלא">בטוח שלא - יעזוב</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(watch('stayingProbability') === 'בטוח' || watch('stayingProbability') === 'אולי') && (
              <div className="space-y-2">
                <Label htmlFor="stayingDuration" className="text-right block">
                  {watch('stayingProbability') === 'בטוח' ? 'לכמה זמן רוצה להישאר?' : 'לכמה זמן מתלבט?'}
                </Label>
                <Select onValueChange={(value) => setValue('stayingDuration', parseInt(value))} value={watch('stayingDuration')?.toString() || ''}>
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue placeholder="בחר מספר חודשים" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="1">עוד חודש</SelectItem>
                    <SelectItem value="2">עוד חודשיים</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Deposits Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-end">
              <h3 className="text-sm font-medium">פקדונות</h3>
              <User className="h-4 w-4" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposits" className="text-right block">כסף בפיקדונות (₪)</Label>
                <Input
                  id="deposits"
                  type="number"
                  min="0"
                  {...register('deposits')}
                  placeholder="0"
                  className="text-right"
                  dir="rtl"
                />
                {errors.deposits && (
                  <p className="text-sm text-red-600 text-right">{errors.deposits.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="safeItems" className="text-right block">חפצים בכספת</Label>
                <textarea
                  id="safeItems"
                  {...register('safeItems')}
                  placeholder="רשימת חפצים (לדוגמה: מפתחות, תכשיטים, מסמכים)"
                  className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-right resize-vertical"
                  dir="rtl"
                />
                {errors.safeItems && (
                  <p className="text-sm text-red-600 text-right">{errors.safeItems.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'שומר...' : editingOccupant ? 'עדכן' : 'הוסף'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}