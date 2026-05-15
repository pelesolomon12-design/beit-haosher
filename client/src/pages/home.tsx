import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/header';
import { RoomCard } from '@/components/room-card';
import { OccupantForm } from '@/components/occupant-form';
import { ClientRegistration } from '@/components/client-registration';
import { OccupantDetails } from '@/components/occupant-details';
import { ExpiredStayAlert } from '@/components/expired-stay-alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Room, Occupant } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isOccupantDetailsOpen, setIsOccupantDetailsOpen] = useState(false);
  const [editingOccupant, setEditingOccupant] = useState<Occupant | null>(null);
  const [preSelectedRoomId, setPreSelectedRoomId] = useState<string | undefined>();
  const [initialOccupantId, setInitialOccupantId] = useState<string | undefined>();
  const [moveConfirmation, setMoveConfirmation] = useState<{
    occupantId: string;
    targetRoomId: string;
    occupantName: string;
    sourceRoomName: string;
    targetRoomName: string;
  } | null>(null);

  // Fetch occupants and rooms
  const { data: occupants = [], isLoading: occupantsLoading } = useQuery<Occupant[]>({
    queryKey: ['/api/occupants'],
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
  });

  const isLoading = occupantsLoading || roomsLoading;

  // Group occupants by room
  const occupantsByRoom = occupants.reduce((acc: { [key: string]: Occupant[] }, occupant: Occupant) => {
    if (!acc[occupant.roomId]) {
      acc[occupant.roomId] = [];
    }
    acc[occupant.roomId].push(occupant);
    return acc;
  }, {});

  // Handle URL parameters for direct occupant access from calendar
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const editOccupantId = urlParams.get('editOccupant');
    const shouldEdit = urlParams.get('edit') === 'true';
    
    if (editOccupantId && occupants.length > 0) {
      // Find the occupant to edit
      const occupantToEdit = occupants.find(o => o.id === editOccupantId);
      if (occupantToEdit) {
        if (shouldEdit) {
          // Close any open dialogs first
          setIsOccupantDetailsOpen(false);
          setInitialOccupantId(undefined);
          
          // Open edit form directly
          setEditingOccupant(occupantToEdit);
          setIsFormOpen(true);
          
          // Clear the URL parameter to avoid re-triggering
          navigate('/rooms', { replace: true });
          
          // Show toast notification
          toast({
            title: `עורך פרטי מטופל: ${occupantToEdit.name}`,
            description: 'נפתח טופס עריכת פרטי המטופל',
            variant: 'default',
          });
        } else {
          // Close edit form if open
          setIsFormOpen(false);
          setEditingOccupant(null);
          
          // Set the occupant to be initially selected
          setInitialOccupantId(editOccupantId);
          // Open occupant details dialog
          setIsOccupantDetailsOpen(true);
          
          // Clear the URL parameter to avoid re-triggering
          navigate('/rooms', { replace: true });
          
          // Show toast notification
          toast({
            title: `פותח פרטי מטופל: ${occupantToEdit.name}`,
            description: 'נעבר לצפייה ועריכת פרטי המטופל',
            variant: 'default',
          });
        }
      } else {
        // Occupant not found
        toast({
          title: 'מטופל לא נמצא',
          description: 'המטופל שנבחר לא נמצא במערכת',
          variant: 'destructive',
        });
        navigate('/', { replace: true });
      }
    }
  }, [location, occupants, navigate, toast]);

  // Calculate totals
  const totalOccupants = occupants.length;
  const totalCapacity = rooms.reduce((sum, room) => sum + room.maxCapacity, 0);

  // Mutations
  const createOccupantMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      roomId: string; 
      joinDate: Date;
      endDateTime: Date;
      stayingProbability: 'בטוח' | 'אולי' | 'בטוח שלא';
      deposits: number;
      safeItems: string;
    }) => {
      const response = await fetch('/api/occupants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create occupant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
    },
  });

  const updateOccupantMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: string; 
      data: Partial<{ 
        name: string; 
        roomId: string; 
        joinDate: Date;
        endDateTime: Date;
        stayingProbability: 'בטוח' | 'אולי' | 'בטוח שלא';
        deposits: number;
        safeItems: string;
      }> 
    }) => {
      const response = await fetch(`/api/occupants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update occupant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
    },
  });

  const deleteOccupantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/occupants/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete occupant');
      // Handle 204 No Content responses (don't try to parse JSON)
      if (response.status === 204) return null;
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
    },
  });

  // Mutation for moving occupants between rooms
  const moveOccupantMutation = useMutation({
    mutationFn: async ({ occupantId, targetRoomId }: { occupantId: string, targetRoomId: string }) => {
      const response = await fetch(`/api/occupants/${occupantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: targetRoomId }),
      });
      if (!response.ok) throw new Error('Failed to move occupant');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
    },
  });

  // Handlers
  const handleUpdateOccupant = async (occupantId: string, updates: Partial<Occupant>) => {
    try {
      // Clean up the updates object to match the mutation type
      const cleanUpdates: any = {};
      Object.keys(updates).forEach(key => {
        const value = (updates as any)[key];
        if (value !== null && value !== undefined) {
          cleanUpdates[key] = value;
        }
      });
      
      await updateOccupantMutation.mutateAsync({ id: occupantId, data: cleanUpdates });
    } catch (error) {
      toast({
        title: "שגיאה בעדכון מטופל",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive"
      });
    }
  };

  const handleEditOccupant = (occupant: Occupant) => {
    setEditingOccupant(occupant);
    setPreSelectedRoomId(undefined);
    setIsFormOpen(true);
  };

  const handleDeleteOccupant = async (occupantId: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק את המטופל?')) {
      try {
        await deleteOccupantMutation.mutateAsync(occupantId);
        toast({
          title: 'המטופל נמחק בהצלחה',
          description: 'המטופל הוסר מהמערכת',
        });
      } catch (error) {
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה במחיקת המטופל',
          variant: 'destructive',
        });
      }
    }
  };

  const handleMoveOccupant = async (occupantId: string, targetRoomId: string) => {
    const occupant = occupants.find(o => o.id === occupantId);
    const sourceRoom = rooms.find(r => r.id === occupant?.roomId);
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    
    if (!occupant || !sourceRoom || !targetRoom) {
      toast({
        title: 'שגיאה',
        description: 'מטופל או חדר לא נמצאו',
        variant: 'destructive',
      });
      return;
    }

    // Show confirmation dialog
    setMoveConfirmation({
      occupantId,
      targetRoomId,
      occupantName: occupant.name,
      sourceRoomName: sourceRoom.name,
      targetRoomName: targetRoom.name,
    });
  };

  const confirmMoveOccupant = async () => {
    if (!moveConfirmation) return;

    try {
      await moveOccupantMutation.mutateAsync({ 
        occupantId: moveConfirmation.occupantId, 
        targetRoomId: moveConfirmation.targetRoomId 
      });
      
      toast({
        title: 'המטופל הועבר בהצלחה',
        description: `${moveConfirmation.occupantName} הועבר מחדר ${moveConfirmation.sourceRoomName} לחדר ${moveConfirmation.targetRoomName}`,
      });
      
      setMoveConfirmation(null);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בהעברת המטופל',
        variant: 'destructive',
      });
    }
  };

  const handleFormSubmit = async (data: { 
    name: string; 
    roomId: string; 
    joinDate: Date;
    endDateTime: Date;
    stayingProbability: 'בטוח' | 'אולי' | 'בטוח שלא';
    deposits: number;
    safeItems: string;
  }) => {
    try {
      if (editingOccupant) {
        await updateOccupantMutation.mutateAsync({
          id: editingOccupant.id,
          data,
        });
      } else {
        await createOccupantMutation.mutateAsync(data);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingOccupant(null);
    setPreSelectedRoomId(undefined);
  };

  const handleCloseRegistration = () => {
    setIsRegistrationOpen(false);
    setEditingOccupant(null);
    setPreSelectedRoomId(undefined);
  };

  const handleOpenRegistration = (roomId?: string) => {
    setPreSelectedRoomId(roomId);
    setIsRegistrationOpen(true);
  };

  const handleOpenOccupantDetails = () => {
    setIsOccupantDetailsOpen(true);
  };

  const handleCloseOccupantDetails = () => {
    setIsOccupantDetailsOpen(false);
    setEditingOccupant(null);
    setInitialOccupantId(undefined);
  };

  const handleEditFromDetails = (occupant: Occupant) => {
    setEditingOccupant(occupant);
    setIsOccupantDetailsOpen(false);
    setIsRegistrationOpen(true);
  };

  const handleEditOccupantInRegistration = (occupant: Occupant) => {
    setEditingOccupant(occupant);
    setIsRegistrationOpen(true);
  };

  const handleViewOccupantFromAlert = (occupantId: string) => {
    setInitialOccupantId(occupantId);
    setIsOccupantDetailsOpen(true);
  };

  // No floor grouping needed anymore - display all rooms directly

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sky-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-100" dir="rtl">
      <ExpiredStayAlert
        occupants={occupants}
        rooms={rooms}
        onViewOccupant={handleViewOccupantFromAlert}
      />
      <Header 
        totalOccupants={totalOccupants} 
        totalCapacity={totalCapacity}
        rooms={rooms}
        occupantsByRoom={occupantsByRoom}
        onOpenRegistration={handleOpenRegistration}
        onOpenOccupantDetails={handleOpenOccupantDetails}
      />
      
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">ניהול תפוסת חדרים</h2>
          <p className="text-sm sm:text-base text-gray-600">מעקב אחר מטופלים בחדרים השונים במרכז השיקום</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              occupants={occupantsByRoom[room.id] || []}
              onEditOccupant={handleEditOccupantInRegistration}
              onDeleteOccupant={handleDeleteOccupant}
              onMoveOccupant={handleMoveOccupant}
            />
          ))}
        </div>
      </main>

      <OccupantForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        rooms={rooms}
        editingOccupant={editingOccupant}
        preSelectedRoomId={preSelectedRoomId}
      />

      <ClientRegistration
        isOpen={isRegistrationOpen}
        onClose={handleCloseRegistration}
        editingOccupant={editingOccupant}
        preSelectedRoomId={preSelectedRoomId}
      />

      <OccupantDetails
        isOpen={isOccupantDetailsOpen}
        onClose={handleCloseOccupantDetails}
        occupants={occupants}
        rooms={rooms}
        onEdit={handleEditFromDetails}
        onDelete={handleDeleteOccupant}
        initialOccupantId={initialOccupantId}
      />

      {/* Move Confirmation Dialog */}
      <Dialog open={!!moveConfirmation} onOpenChange={() => setMoveConfirmation(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold text-gray-900">
              אישור העברת מטופל
            </DialogTitle>
          </DialogHeader>
          
          {moveConfirmation && (
            <div className="py-4">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3 text-sm text-gray-600">
                  <div className="bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    <span className="font-medium text-red-800">{moveConfirmation.sourceRoomName}</span>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                  <div className="bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <span className="font-medium text-green-800">{moveConfirmation.targetRoomName}</span>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-blue-900 font-medium text-center">
                    {moveConfirmation.occupantName}
                  </p>
                  <p className="text-blue-700 text-sm mt-1 text-center">
                    האם להעביר את המטופל לחדר חדש?
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              onClick={() => setMoveConfirmation(null)}
              className="px-6"
            >
              ביטול
            </Button>
            <Button 
              onClick={confirmMoveOccupant}
              className="px-6 bg-blue-600 hover:bg-blue-700"
              disabled={moveOccupantMutation.isPending}
            >
              {moveOccupantMutation.isPending ? 'מעביר...' : 'אישור העברה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
