import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Edit2, Plus, Settings } from 'lucide-react';
import { Room } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

const roomFormSchema = z.object({
  name: z.string().min(1, "יש להזין שם חדר"),
  pricePerBed: z.number().min(1000, "מחיר מינימלי הוא 1,000₪"),
  maxCapacity: z.number().min(1, "קיבולת חייבת להיות לפחות 1").max(10, "קיבולת מקסימלית 10"),
  isWomenOnly: z.boolean().optional(),
});

type RoomFormValues = z.infer<typeof roomFormSchema>;

// No floor options needed anymore

interface RoomManagementProps {
  rooms: Room[];
  occupantsByRoom: { [roomId: string]: any[] };
}

export function RoomManagement({ rooms, occupantsByRoom }: RoomManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      name: '',
      pricePerBed: 25000,
      maxCapacity: 1,
      isWomenOnly: false,
    },
  });

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: (data: RoomFormValues) => apiRequest('POST', '/api/rooms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: "חדר נוצר בהצלחה",
        description: "החדר החדש נוסף למערכת",
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "שגיאה ביצירת חדר",
        description: "אירעה שגיאה ביצירת החדר החדש",
        variant: "destructive",
      });
    },
  });

  // Update room mutation
  const updateRoomMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoomFormValues }) => 
      apiRequest('PUT', `/api/rooms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: "חדר עודכן בהצלחה",
        description: "פרטי החדר עודכנו במערכת",
      });
      setIsFormOpen(false);
      setEditingRoom(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "שגיאה בעדכון חדר",
        description: "אירעה שגיאה בעדכון פרטי החדר",
        variant: "destructive",
      });
    },
  });

  // Delete room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: "חדר נמחק בהצלחה",
        description: "החדר הוסר מהמערכת",
      });
      setDeletingRoom(null);
    },
    onError: () => {
      toast({
        title: "שגיאה במחיקת חדר",
        description: "לא ניתן למחוק חדר עם מטופלים פעילים",
        variant: "destructive",
      });
    },
  });

  const handleAddRoom = () => {
    setEditingRoom(null);
    form.reset({
      name: '',
      pricePerBed: 25000,
      maxCapacity: 1,
      isWomenOnly: false,
    });
    setIsFormOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    form.reset({
      name: room.name,
      pricePerBed: room.pricePerBed,
      maxCapacity: room.maxCapacity,
      isWomenOnly: room.isWomenOnly || false,
    });
    setIsFormOpen(true);
  };

  const handleDeleteRoom = (room: Room) => {
    const occupants = occupantsByRoom[room.id] || [];
    if (occupants.length > 0) {
      toast({
        title: "לא ניתן למחוק חדר",
        description: "החדר מכיל מטופלים פעילים. יש לפנות את החדר תחילה.",
        variant: "destructive",
      });
      return;
    }
    setDeletingRoom(room);
  };

  const handleSubmit = (data: RoomFormValues) => {
    if (editingRoom) {
      updateRoomMutation.mutate({ id: editingRoom.id, data });
    } else {
      createRoomMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (deletingRoom) {
      deleteRoomMutation.mutate(deletingRoom.id);
    }
  };

  // No floor grouping needed anymore

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300 p-2"
        title="ניהול חדרים"
      >
        <Settings className="h-4 w-4" />
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-right">ניהול חדרים</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex justify-start">
              <Button onClick={handleAddRoom} className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף חדר חדש
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const occupants = occupantsByRoom[room.id] || [];
                return (
                  <div key={room.id} className={`border rounded-lg p-4 space-y-3 ${room.isWomenOnly ? 'border-pink-200 bg-pink-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          {room.name}
                          {room.isWomenOnly && <span className="text-xs text-pink-600 bg-pink-100 px-2 py-1 rounded">נשים בלבד</span>}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {room.pricePerBed.toLocaleString()}₪ למיטה
                        </p>
                        <p className="text-sm text-gray-600">
                          תפוסה: {occupants.length}/{room.maxCapacity}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRoom(room)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRoom(room)}
                          disabled={occupants.length > 0}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Room Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">
              {editingRoom ? 'עריכת חדר' : 'הוספת חדר חדש'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם החדר</FormLabel>
                    <FormControl>
                      <Input placeholder="הזן שם החדר" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pricePerBed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מחיר למיטה (₪)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1000"
                        placeholder="25000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 25000)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isWomenOnly"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        חדר לנשים בלבד
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">חדר מיועד לנשים בלבד
</p>
                    </div>
                    <FormControl>
                      <input 
                        type="checkbox" 
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>קיבולת מקסימלית</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        placeholder="הזן קיבולת מקסימלית"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={createRoomMutation.isPending || updateRoomMutation.isPending}>
                  {editingRoom ? 'עדכן חדר' : 'הוסף חדר'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRoom} onOpenChange={() => setDeletingRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקת חדר</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את החדר "{deletingRoom?.name}"?
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteRoomMutation.isPending}
            >
              מחק חדר
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}