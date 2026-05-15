import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, Edit, Trash2, Plus, UserPlus } from 'lucide-react';
import type { Room, Occupant } from '@shared/schema';

const clientRegistrationSchema = z.object({
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  roomId: z.string().min(1, 'חובה לבחור חדר'),
  gender: z.enum(['זכר', 'נקבה'], {
    required_error: 'חובה לבחור מין',
  }),
  isReligious: z.boolean().default(false),
  addictionType: z.enum(['סמים', 'תרופות', 'הימורים', 'מין', 'אלכוהול']).optional(),
  joinDate: z.string().min(1, 'חובה לבחור תאריך הצטרפות'),
  endDate: z.string().min(1, 'חובה לבחור תאריך עזיבה'),
  stayingProbability: z.enum(['בטוח', 'אולי', 'בטוח שלא'], {
    required_error: 'חובה לבחור סבירות להישאר',
  }),
  stayingDuration: z.number().min(1, "מינימום חודש אחד").max(2, "מקסימום 2 חודשים").optional(),
  plannedMonths: z.string().min(1, 'חובה לבחור מספר חודשים'),
  paidMonths: z.string().min(1, 'חובה לבחור מספר חודשים ששולמו'),
  deposits: z.string().optional(),
  safeItems: z.string().default(''),
  borrowedItems: z.string().default(''),
  medicalTreatment: z.string().default(''),
  plannedExitStart: z.string().default(''),
  plannedExitEnd: z.string().default(''),
  privateConsultation: z.string().default(''),
  clientPhone: z.string().optional(),
  // Contact information
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactRelationship: z.enum(['אמא', 'אבא', 'אחות', 'אח', 'בן', 'בת', 'בן/בת זוג', 'חבר/ה', 'אחר']).optional(),
  // Notes
  notes: z.string().optional(),
});

type ClientRegistrationForm = z.infer<typeof clientRegistrationSchema>;

interface ClientRegistrationProps {
  isOpen: boolean;
  onClose: () => void;
  editingOccupant?: Occupant | null;
  preSelectedRoomId?: string;
  onSuccess?: () => void; // Optional callback for after successful edit
}

export function ClientRegistration({ 
  isOpen, 
  onClose, 
  editingOccupant, 
  preSelectedRoomId,
  onSuccess
}: ClientRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDeleteOccupant = async () => {
    if (deletePassword !== '2026') {
      setDeleteError('סיסמה שגויה');
      return;
    }
    
    if (!editingOccupant) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/occupants/${editingOccupant.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete occupant');
      
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
      toast({
        title: 'המטופל נמחק בהצלחה',
        description: 'המטופל הוסר מהמערכת',
      });
      setShowDeleteDialog(false);
      setDeletePassword('');
      setDeleteError('');
      onClose();
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה במחיקת המטופל',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to calculate end date based on join date and planned months
  // Uses proper month addition that handles month-end dates correctly
  // (e.g., Jan 31 + 1 month = Feb 28, not Mar 2)
  const calculateEndDate = (joinDate: string, months: number): string => {
    if (!joinDate) return '';
    
    const startDate = new Date(joinDate);
    const endDate = new Date(startDate);
    
    // Store original day before modifying month
    const originalDay = startDate.getDate();
    
    // Add months
    endDate.setMonth(endDate.getMonth() + months);
    
    // Check if the day changed due to month overflow
    // (e.g., Jan 31 + 1 month would become Mar 3 because Feb doesn't have 31 days)
    // If so, set to last day of the target month
    if (endDate.getDate() !== originalDay) {
      // Go back to the last day of the previous month
      endDate.setDate(0);
    }
    
    return endDate.toISOString().split('T')[0];
  };

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });

  const { data: occupants = [] } = useQuery<Occupant[]>({
    queryKey: ['/api/occupants'],
  });

  // Calculate room occupancy and filter available rooms
  const roomOccupancy = rooms.map(room => {
    const currentOccupants = occupants.filter(occ => occ.roomId === room.id);
    const availableSpots = room.maxCapacity - currentOccupants.length;
    const isFullySacupied = availableSpots === 0;
    const isAlmostFull = availableSpots === 1 && room.maxCapacity > 1;
    
    return {
      ...room,
      currentOccupants: currentOccupants.length,
      availableSpots,
      isFullySacupied,
      isAlmostFull
    };
  });

  // Show all rooms but mark full rooms as disabled for new registrations
  const displayRooms = roomOccupancy.map(room => ({
    ...room,
    isDisabled: !editingOccupant && room.isFullySacupied // Disable full rooms for new registrations only
  }));

  // Sort rooms - available rooms first, then almost full, then full rooms
  const sortedDisplayRooms = displayRooms.sort((a, b) => {
    // Available rooms first
    if (!a.isFullySacupied && b.isFullySacupied) return -1;
    if (a.isFullySacupied && !b.isFullySacupied) return 1;
    
    // Among available rooms, almost full rooms first
    if (!a.isFullySacupied && !b.isFullySacupied) {
      if (a.isAlmostFull && !b.isAlmostFull) return -1;
      if (!a.isAlmostFull && b.isAlmostFull) return 1;
    }
    
    return 0;
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClientRegistrationForm>({
    resolver: zodResolver(clientRegistrationSchema),
    defaultValues: {
      name: '',
      roomId: preSelectedRoomId || '',
      gender: undefined,
      isReligious: false,
      addictionType: undefined,
      joinDate: '',
      endDate: '',
      stayingProbability: undefined,
      plannedMonths: '1',
      paidMonths: '0',
      deposits: '',
      safeItems: '',
      borrowedItems: '',
      medicalTreatment: '',
      plannedExitStart: '',
      plannedExitEnd: '',
      privateConsultation: '',
      clientPhone: ''
    },
  });

  const selectedRoomId = watch('roomId');

  // Reset form when dialog opens/closes or editing changes
  useEffect(() => {
    if (isOpen) {
      if (editingOccupant) {
        const joinDate = new Date(editingOccupant.joinDate);
        const endDate = new Date(editingOccupant.endDateTime);
        
        setValue('name', editingOccupant.name);
        setValue('roomId', editingOccupant.roomId);
        setValue('gender', editingOccupant.gender);
        setValue('isReligious', editingOccupant.isReligious || false);
        setValue('addictionType', editingOccupant.addictionType || undefined);
        setValue('joinDate', joinDate.toISOString().split('T')[0]);
        setValue('endDate', endDate.toISOString().split('T')[0]);
        setValue('stayingProbability', editingOccupant.stayingProbability);
        setValue('stayingDuration', editingOccupant.stayingDuration || undefined);
        setValue('plannedMonths', editingOccupant.plannedMonths?.toString() || '1');
        setValue('paidMonths', editingOccupant.paidMonths?.toString() || '0');
        setValue('deposits', editingOccupant.deposits?.toString() || '');
        setValue('safeItems', editingOccupant.safeItems || '');
        setValue('borrowedItems', editingOccupant.borrowedItems || '');
        setValue('medicalTreatment', editingOccupant.medicalTreatment || '');
        setValue('plannedExitStart', editingOccupant.plannedExitStart ? new Date(editingOccupant.plannedExitStart).toISOString().split('T')[0] : '');
        setValue('plannedExitEnd', editingOccupant.plannedExitEnd ? new Date(editingOccupant.plannedExitEnd).toISOString().split('T')[0] : '');
        setValue('privateConsultation', editingOccupant.privateConsultation ? new Date(editingOccupant.privateConsultation).toISOString().split('T')[0] : '');
        setValue('clientPhone', editingOccupant.clientPhone || '');
        // Contact information
        setValue('contactName', editingOccupant.contactName || '');
        setValue('contactPhone', editingOccupant.contactPhone || '');
        setValue('contactRelationship', editingOccupant.contactRelationship || undefined);
        setValue('notes', editingOccupant.notes || '');
      } else if (preSelectedRoomId) {
        setValue('roomId', preSelectedRoomId);
        // Set default join date to today
        const today = new Date().toISOString().split('T')[0];
        setValue('joinDate', today);
      }
    } else {
      reset();
    }
  }, [isOpen, editingOccupant, preSelectedRoomId, setValue, reset]);

  const handleFormSubmit = async (data: ClientRegistrationForm) => {
    setIsSubmitting(true);
    
    try {
      const joinDate = new Date(`${data.joinDate}T00:00:00`);
      const endDateTime = new Date(`${data.endDate}T23:59:59`);
      
      // Validate that end date is after join date
      if (endDateTime <= joinDate) {
        toast({
          title: 'שגיאה בתאריכים',
          description: 'תאריך הסיום חייב להיות אחרי תאריך ההצטרפות',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      
      const submitData = {
        name: data.name,
        roomId: data.roomId,
        gender: data.gender,
        isReligious: data.isReligious,
        addictionType: data.addictionType || undefined,
        joinDate,
        endDateTime,
        stayingProbability: data.stayingProbability,
        stayingDuration: data.stayingDuration || undefined,
        plannedMonths: parseInt(data.plannedMonths),
        paidMonths: parseInt(data.paidMonths),
        deposits: data.deposits ? parseInt(data.deposits) : undefined,
        safeItems: data.safeItems,
        borrowedItems: data.borrowedItems,
        medicalTreatment: data.medicalTreatment,
        plannedExitStart: data.plannedExitStart && data.plannedExitStart.trim() !== '' ? new Date(`${data.plannedExitStart}T00:00:00`) : undefined,
        plannedExitEnd: data.plannedExitEnd && data.plannedExitEnd.trim() !== '' ? new Date(`${data.plannedExitEnd}T00:00:00`) : undefined,
        privateConsultation: data.privateConsultation && data.privateConsultation.trim() !== '' ? new Date(`${data.privateConsultation}T00:00:00`) : undefined,
        clientPhone: data.clientPhone || undefined,
        // Contact information
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        contactRelationship: data.contactRelationship || undefined,
        // Notes
        notes: data.notes || ''
      };

      const url = editingOccupant ? `/api/occupants/${editingOccupant.id}` : '/api/occupants';
      const method = editingOccupant ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });
      
      if (!response.ok) throw new Error('Failed to save occupant');

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
      
      // If this was a new patient registration with medical data, also invalidate auth status
      if (!editingOccupant && (data.medicalTreatment || data.notes)) {
        await queryClient.invalidateQueries({ queryKey: ['/api/auth-status'] });
      }

      toast({
        title: editingOccupant ? 'המטופל עודכן בהצלחה' : 'המטופל נוסף בהצלחה',
        description: editingOccupant 
          ? `פרטי ${data.name} עודכנו`
          : `${data.name} נוסף לחדר`,
      });

      // If editing and onSuccess callback provided, call it instead of onClose
      if (editingOccupant && onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
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

  const selectedRoom = sortedDisplayRooms.find(room => room.id === selectedRoomId);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-2xl font-bold text-blue-600">
            {editingOccupant ? 'עריכת פרטי מטופל' : 'רישום מטופל חדש'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} dir="rtl" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Registration Form */}
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">פרטים אישיים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-right block font-medium">שם מלא *</Label>
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
                    <div className="flex items-center gap-2 justify-start" dir="rtl">
                      <Label htmlFor="isReligious" className="text-right font-medium">דתי</Label>
                      <input
                        type="checkbox"
                        id="isReligious"
                        className="rounded"
                        checked={watch('isReligious')}
                        onChange={(e) => setValue('isReligious', e.target.checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientPhone" className="text-right block font-medium">טלפון המטופל</Label>
                    <Input
                      id="clientPhone"
                      {...register('clientPhone')}
                      placeholder="מספר טלפון של המטופל (אופציונלי)"
                      className="text-right"
                      dir="rtl"
                    />
                    {errors.clientPhone && (
                      <p className="text-sm text-red-600 text-right">{errors.clientPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-right block font-medium">מין *</Label>
                    <Select onValueChange={(value) => setValue('gender', value as 'זכר' | 'נקבה')} value={watch('gender')}>
                      <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר מין" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="זכר">זכר</SelectItem>
                        <SelectItem value="נקבה">נקבה</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && (
                      <p className="text-sm text-red-600 text-right">{errors.gender.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">רישום</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomId" className="text-right block font-medium">חדר *</Label>
                    <Select onValueChange={(value) => setValue('roomId', value)} value={selectedRoomId}>
                      <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר חדר זמין" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {sortedDisplayRooms.map((room) => (
                          <SelectItem 
                            key={room.id} 
                            value={room.id}
                            disabled={room.isDisabled}
                            className={room.isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className={room.isDisabled ? "text-gray-400" : ""}>
                                {room.name} - {room.pricePerBed.toLocaleString()}₪ למיטה
                                {room.isWomenOnly && ' (נשים בלבד)'}
                                <span className="text-xs text-gray-500 mr-2">
                                  ({room.currentOccupants}/{room.maxCapacity} תפוס)
                                </span>
                              </div>
                              <div className="flex gap-1">
                                {room.isFullySacupied && (
                                  <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">
                                    מלא
                                  </Badge>
                                )}
                                {room.isAlmostFull && !room.isFullySacupied && (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                                    כמעט מלא
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.roomId && (
                      <p className="text-sm text-red-600 text-right">{errors.roomId.message}</p>
                    )}
                    {sortedDisplayRooms.filter(room => !room.isDisabled).length === 0 && !editingOccupant && (
                      <p className="text-sm text-orange-600 text-right">אין חדרים זמינים כרגע</p>
                    )}
                    
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="plannedMonths" className="text-right block font-medium">חודשים מתוכנן להישאר *</Label>
                      <Select 
                        onValueChange={(value) => {
                          setValue('plannedMonths', value);
                          
                          // Auto-calculate end date if join date is set
                          const joinDate = watch('joinDate');
                          if (joinDate) {
                            const endDate = calculateEndDate(joinDate, parseInt(value));
                            setValue('endDate', endDate);
                          }
                        }} 
                        value={watch('plannedMonths')}
                      >
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
                      <Label htmlFor="paidMonths" className="text-right block font-medium">חודשים ששולמו *</Label>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="joinDate" className="text-right block font-medium">תאריך הצטרפות *</Label>
                      <Input
                        id="joinDate"
                        type="date"
                        {...register('joinDate')}
                        className="text-right"
                        dir="rtl"
                        onChange={(e) => {
                          const joinDate = e.target.value;
                          setValue('joinDate', joinDate);
                          
                          // Auto-calculate end date if planned months is set
                          const plannedMonths = watch('plannedMonths');
                          if (plannedMonths && joinDate) {
                            const endDate = calculateEndDate(joinDate, parseInt(plannedMonths));
                            setValue('endDate', endDate);
                          }
                        }}
                      />
                      {errors.joinDate && (
                        <p className="text-sm text-red-600 text-right">{errors.joinDate.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate" className="text-right block font-medium">תאריך עזיבה צפוי *</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stayingProbability" className="text-right block font-medium">
                      {parseInt(watch('plannedMonths')) === parseInt(watch('paidMonths')) ? 
                        'סבירות להוספת חודש נוסף *' : 
                        'סבירות להישאר עוד חודש *'}
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
                    {errors.stayingProbability && (
                      <p className="text-sm text-red-600 text-right">{errors.stayingProbability.message}</p>
                    )}
                  </div>

                  {(watch('stayingProbability') === 'בטוח' || watch('stayingProbability') === 'אולי') && (
                    <div className="space-y-2">
                      <Label htmlFor="stayingDuration" className="text-right block font-medium">
                        {watch('stayingProbability') === 'בטוח' ? 'לכמה זמן רוצה להישאר? *' : 'לכמה זמן מתלבט? *'}
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
                      {errors.stayingDuration && (
                        <p className="text-sm text-red-600 text-right">{errors.stayingDuration.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">טיפול מקצועי</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="addictionType" className="text-right block font-medium">סוג התמכרות</Label>
                    <Select onValueChange={(value) => setValue('addictionType', value as 'סמים' | 'תרופות' | 'הימורים' | 'מין' | 'אלכוהול')} value={watch('addictionType') || ''}>
                      <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר סוג התמכרות (אופציונלי)" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="סמים">סמים</SelectItem>
                        <SelectItem value="תרופות">תרופות</SelectItem>
                        <SelectItem value="הימורים">הימורים</SelectItem>
                        <SelectItem value="מין">מין</SelectItem>
                        <SelectItem value="אלכוהול">אלכוהול</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.addictionType && (
                      <p className="text-sm text-red-600 text-right">{errors.addictionType.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medicalTreatment" className="text-right block font-medium">טיפול תרופתי</Label>
                    <Textarea
                      id="medicalTreatment"
                      {...register('medicalTreatment')}
                      placeholder="פרטי טיפול תרופתי (אופציונלי)"
                      className="text-right min-h-[80px]"
                      dir="rtl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const textarea = e.target as HTMLTextAreaElement;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const value = textarea.value;
                          const newValue = value.substring(0, start) + '\n' + value.substring(end);
                          setValue('medicalTreatment', newValue);
                          
                          // Set cursor position after the newline
                          setTimeout(() => {
                            textarea.setSelectionRange(start + 1, start + 1);
                          }, 0);
                        }
                      }}
                    />
                    {errors.medicalTreatment && (
                      <p className="text-sm text-red-600 text-right">{errors.medicalTreatment.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-right block font-medium">יציאות מתוכננות (טווח תאריכים)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="plannedExitStart" className="text-right block text-sm text-gray-600 mb-1">מתחיל</Label>
                        <Input
                          id="plannedExitStart"
                          type="date"
                          {...register('plannedExitStart')}
                          className="text-right"
                          dir="rtl"
                          data-testid="input-plannedexitstart"
                        />
                        {errors.plannedExitStart && (
                          <p className="text-sm text-red-600 text-right">{errors.plannedExitStart.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="plannedExitEnd" className="text-right block text-sm text-gray-600 mb-1">עד</Label>
                        <Input
                          id="plannedExitEnd"
                          type="date"
                          {...register('plannedExitEnd')}
                          className="text-right"
                          dir="rtl"
                          data-testid="input-plannedexitend"
                        />
                        {errors.plannedExitEnd && (
                          <p className="text-sm text-red-600 text-right">{errors.plannedExitEnd.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="privateConsultation" className="text-right block font-medium">שיחה פרטנית</Label>
                    <Input
                      id="privateConsultation"
                      type="date"
                      {...register('privateConsultation')}
                      className="text-right"
                      dir="rtl"
                    />
                    {errors.privateConsultation && (
                      <p className="text-sm text-red-600 text-right">{errors.privateConsultation.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">איש קשר</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="text-right block font-medium">שם איש קשר</Label>
                    <Input
                      id="contactName"
                      {...register('contactName')}
                      placeholder="שם איש הקשר (אופציונלי)"
                      className="text-right"
                      dir="rtl"
                    />
                    {errors.contactName && (
                      <p className="text-sm text-red-600 text-right">{errors.contactName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone" className="text-right block font-medium">טלפון איש קשר</Label>
                    <Input
                      id="contactPhone"
                      {...register('contactPhone')}
                      placeholder="מספר טלפון (אופציונלי)"
                      className="text-right"
                      dir="rtl"
                    />
                    {errors.contactPhone && (
                      <p className="text-sm text-red-600 text-right">{errors.contactPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactRelationship" className="text-right block font-medium">סוג קרבה</Label>
                    <Select onValueChange={(value) => setValue('contactRelationship', value as any)} value={watch('contactRelationship') || ''}>
                      <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר סוג קרבה (אופציונלי)" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אמא">אמא</SelectItem>
                        <SelectItem value="אבא">אבא</SelectItem>
                        <SelectItem value="אחות">אחות</SelectItem>
                        <SelectItem value="אח">אח</SelectItem>
                        <SelectItem value="בן">בן</SelectItem>
                        <SelectItem value="בת">בת</SelectItem>
                        <SelectItem value="בן/בת זוג">בן/בת זוג</SelectItem>
                        <SelectItem value="חבר/ה">חבר/ה</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.contactRelationship && (
                      <p className="text-sm text-red-600 text-right">{errors.contactRelationship.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הערות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-right block font-medium">הערות נוספות</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="הערות נוספות על המטופל (אופציונלי)"
                    className="text-right min-h-24"
                    dir="rtl"
                    rows={3}
                  />
                  {errors.notes && (
                    <p className="text-sm text-red-600 text-right">{errors.notes.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">פקדונות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposits" className="text-right block font-medium">כסף בפיקדונות (₪)</Label>
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
                    <Label htmlFor="safeItems" className="text-right block font-medium">חפצים בכספת</Label>
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

                <div className="space-y-2 mt-4">
                  <Label htmlFor="borrowedItems" className="text-right block font-medium">חפצים שהושאלו מהבית</Label>
                  <textarea
                    id="borrowedItems"
                    {...register('borrowedItems')}
                    placeholder="רשימת חפצים שהושאלו (לדוגמה: חלוק, מגבת, כרית, שמיכה)"
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-right resize-vertical"
                    dir="rtl"
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault();
                        const textarea = e.target as HTMLTextAreaElement;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const currentValue = textarea.value;
                        const newValue = currentValue.substring(0, start) + '\n' + currentValue.substring(end);
                        
                        // Update the form value
                        setValue('borrowedItems', newValue);
                        
                        // Set cursor position after the newline
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1;
                        }, 0);
                      }
                    }}
                  />
                  {errors.borrowedItems && (
                    <p className="text-sm text-red-600 text-right">{errors.borrowedItems.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>

            {/* Summary Panel */}
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">סיכום הרישום</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {watch('name') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">שם המטופל:</div>
                    <div className="font-medium text-right">{watch('name')}</div>
                  </div>
                )}

                {watch('gender') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">מין:</div>
                    <div className="font-medium text-right">{watch('gender')}</div>
                  </div>
                )}

                {watch('isReligious') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">דתיות:</div>
                    <div className="font-medium text-right">דתי</div>
                  </div>
                )}

                {selectedRoom && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">חדר:</div>
                    <div className="font-medium text-right">
                      {selectedRoom.name} - {selectedRoom.pricePerBed.toLocaleString()}₪ למיטה
                      {selectedRoom.isWomenOnly && ' (לנשים בלבד)'}
                    </div>
                  </div>
                )}

                {watch('joinDate') && watch('endDate') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">תקופת השהייה:</div>
                    <div className="font-medium text-right">
                      {new Date(watch('joinDate')).toLocaleDateString('he-IL')} - {new Date(watch('endDate')).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                )}

                {watch('plannedMonths') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">תקופה מתוכננת:</div>
                    <div className="font-medium text-right">
                      {watch('plannedMonths')} {parseInt(watch('plannedMonths')) === 1 ? 'חודש' : 'חודשים'}
                    </div>
                  </div>
                )}

                {watch('paidMonths') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">תשלום:</div>
                    <div className="font-medium text-right">
                      {parseInt(watch('paidMonths')) === 0 ? 'טרם שילם' : 
                       `שילם עבור ${watch('paidMonths')} ${parseInt(watch('paidMonths')) === 1 ? 'חודש' : 'חודשים'}`}
                    </div>
                  </div>
                )}

                {watch('stayingProbability') && (
                  <div>
                    <div className="text-sm text-gray-600 text-right">סבירות להישאר:</div>
                    <div className="mt-1 text-right">
                      <Badge 
                        className={
                          watch('stayingProbability') === 'בטוח' ? 'bg-green-100 text-green-800 border-green-200' :
                          watch('stayingProbability') === 'אולי' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                          'bg-red-100 text-red-800 border-red-200'
                        }
                      >
                        {watch('stayingProbability')}
                      </Badge>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-600 text-right">פרטים נוספים:</div>
                  <div className="space-y-1 mt-1">
                    {watch('deposits') && (
                      <div className="text-sm font-medium text-right">פיקדונות: {parseInt(watch('deposits') || '0').toLocaleString('he-IL')}₪</div>
                    )}
                    {watch('safeItems')?.trim() && (
                      <div className="text-sm text-right">
                        <span className="font-medium">חפצים בכספת:</span>
                        <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap text-right">{watch('safeItems')}</div>
                      </div>
                    )}
                    {watch('borrowedItems')?.trim() && (
                      <div className="text-sm text-right">
                        <span className="font-medium">חפצים שהושאלו:</span>
                        <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap text-right">{watch('borrowedItems')}</div>
                      </div>
                    )}
                    {watch('clientPhone')?.trim() && (
                      <div className="text-sm text-right">
                        <span className="font-medium">טלפון המטופל:</span>
                        <div className="text-xs text-gray-600 mt-1 text-right">{watch('clientPhone')}</div>
                      </div>
                    )}
                    {watch('addictionType') && (
                      <div className="text-sm text-right">
                        <span className="font-medium">סוג התמכרות:</span>
                        <div className="text-xs text-gray-600 mt-1 text-right">{watch('addictionType')}</div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'שומר...' : (editingOccupant ? 'עדכן מטופל' : 'הוסף מטופל')}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              ביטול
            </Button>
            {editingOccupant && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2"
                data-testid="button-delete-occupant"
              >
                <Trash2 className="h-4 w-4" />
                מחק מטופל
              </Button>
            )}
          </div>
        </form>
      </DialogContent>

      {/* Delete Confirmation Dialog with Password */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) {
          setDeletePassword('');
          setDeleteError('');
        }
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-red-600">מחיקת מטופל</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-right text-gray-700">
              האם אתה בטוח שברצונך למחוק את המטופל <strong>{editingOccupant?.name}</strong>?
            </p>
            <p className="text-right text-sm text-gray-500">
              פעולה זו אינה ניתנת לביטול. יש להזין סיסמה לאישור.
            </p>
            <div className="space-y-2">
              <Label htmlFor="deletePassword" className="text-right block">סיסמה</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError('');
                }}
                placeholder="הזן סיסמה"
                className="text-right"
                data-testid="input-delete-password"
              />
              {deleteError && (
                <p className="text-red-500 text-sm text-right">{deleteError}</p>
              )}
            </div>
          </div>
          <div className="flex gap-4 justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletePassword('');
                setDeleteError('');
              }}
            >
              ביטול
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteOccupant}
              disabled={isDeleting || !deletePassword}
              data-testid="button-confirm-delete"
            >
              {isDeleting ? 'מוחק...' : 'מחק מטופל'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}