import { useState } from 'react';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, MapPin, CreditCard, Shield, Users, Edit3, Trash2, Star, User, Heart, Package, AlertCircle, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SelectOccupant, UiOccupant, Room, SelectPurchaseTransaction, SelectDepositHistory } from '@shared/schema';
import { ClientRegistration } from './client-registration';
import { BorrowedItemsDialog } from './borrowed-items-dialog';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface OccupantDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  occupants: UiOccupant[];
  rooms: Room[];
  onEdit: (occupant: UiOccupant) => void;
  onDelete: (occupantId: string) => void;
  initialOccupantId?: string;
}

export function OccupantDetails({ 
  isOpen, 
  onClose, 
  occupants, 
  rooms,
  onEdit,
  onDelete,
  initialOccupantId
}: OccupantDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOccupant, setSelectedOccupant] = useState<UiOccupant | null>(null);

  // Helper functions for medical data visibility
  const canShowMedical = (occ: UiOccupant, isAuth: boolean) => 
    isAuth || !!occ.hasMedicalTreatment || !!(occ.medicalTreatment && occ.medicalTreatment.trim());
  
  const canShowNotes = (occ: UiOccupant) => 
    !!occ.hasNotes || !!(occ.notes && occ.notes.trim());
  
  const canShowContact = (occ: UiOccupant, isAuth: boolean) => 
    isAuth || !!occ.hasContactInfo || !!(occ.contactName || occ.contactPhone);
  const [showBorrowedItems, setShowBorrowedItems] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [borrowedItemsDialog, setBorrowedItemsDialog] = useState(false);
  const [showMedicalPinDialog, setShowMedicalPinDialog] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showMedicalTreatment, setShowMedicalTreatment] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // State for adding deposit
  const [addDepositAmount, setAddDepositAmount] = useState('');
  const [addDepositNote, setAddDepositNote] = useState('');
  const [showAddDepositForm, setShowAddDepositForm] = useState(false);

  // Fetch purchase transactions for selected occupant
  const { data: purchaseTransactions = [], isLoading: loadingTransactions } = useQuery<SelectPurchaseTransaction[]>({
    queryKey: ['/api/purchase-transactions', selectedOccupant?.id],
    enabled: !!selectedOccupant?.id && showPurchaseHistory,
  });

  // Fetch deposit history for selected occupant
  const { data: depositHistory = [], isLoading: loadingDepositHistory } = useQuery<SelectDepositHistory[]>({
    queryKey: ['/api/deposit-history', selectedOccupant?.id],
    enabled: !!selectedOccupant?.id && showPurchaseHistory,
  });

  // Add deposit mutation
  const addDepositMutation = useMutation({
    mutationFn: async (data: { patientId: string; patientName: string; amount: number; note: string }) => {
      const response = await fetch('/api/deposit-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to add deposit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deposit-history', selectedOccupant?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
      setAddDepositAmount('');
      setAddDepositNote('');
      setShowAddDepositForm(false);
      toast({ title: 'הפיקדון נוסף בהצלחה' });
    },
    onError: () => {
      toast({ title: 'שגיאה בהוספת הפיקדון', variant: 'destructive' });
    },
  });

  // Calculate total purchases from transactions
  const totalPurchases = purchaseTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  
  // Calculate total deposits added
  const totalDepositsAdded = depositHistory.reduce((sum, d) => sum + d.amount, 0);

  // Reset selected occupant if it's deleted
  React.useEffect(() => {
    if (selectedOccupant && !occupants.find(o => o.id === selectedOccupant.id)) {
      setSelectedOccupant(null);
    }
  }, [occupants, selectedOccupant]);

  // Update selected occupant when data changes
  React.useEffect(() => {
    if (selectedOccupant) {
      const updatedOccupant = occupants.find(o => o.id === selectedOccupant.id);
      if (updatedOccupant) {
        setSelectedOccupant(updatedOccupant);
      }
    }
  }, [occupants, selectedOccupant?.id]);

  // Auto-select occupant when initialOccupantId is provided
  React.useEffect(() => {
    if (initialOccupantId && occupants.length > 0 && !selectedOccupant) {
      const occupantToSelect = occupants.find(o => o.id === initialOccupantId);
      if (occupantToSelect) {
        setSelectedOccupant(occupantToSelect);
      }
    }
  }, [initialOccupantId, occupants, selectedOccupant]);

  // Reset selectedOccupant when dialog is closed or initialOccupantId changes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedOccupant(null);
    }
  }, [isOpen]);

  const getRoomInfo = (roomId: string) => {
    return rooms.find(room => room.id === roomId);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStayingProbabilityColor = (probability: string) => {
    switch (probability) {
      case 'בטוח':
        return 'bg-green-100 text-green-800 border-green-200 text-xs';
      case 'אולי':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'בטוח שלא':
        return 'bg-red-100 text-red-800 border-red-200 text-xs';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200 text-xs';
    }
  };

  const getRemainingTime = (endDateTime: Date | string) => {
    const now = new Date();
    const end = new Date(endDateTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff < 0) {
      return 'תקופת השהייה הסתיימה';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      return `${days} ${days === 1 ? 'יום' : 'ימים'}`;
    } else {
      return 'פחות מיום';
    }
  };

  const hasPaymentIssue = (occupant: UiOccupant) => {
    // בדיקה אם לא שילם על כמות החודשים שמתוכנן
    // מציג סימן אי תשלום לכל מטופל שלא שילם במלואו, ללא קשר לכמות החודשים או ההסתברות
    const paidMonths = occupant.paidMonths || 0;
    const plannedMonths = occupant.plannedMonths || 1;
    
    return paidMonths < plannedMonths;
  };

  // Mutation for updating borrowed items
  const updateOccupantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UiOccupant> }) => {
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

  const handleUpdateBorrowedItems = async (updatedItems: string) => {
    if (!selectedOccupant) return;
    
    try {
      await updateOccupantMutation.mutateAsync({
        id: selectedOccupant.id,
        data: { borrowedItems: updatedItems }
      });
      
      toast({
        title: "פריטים עודכנו בהצלחה",
        description: "רשימת החפצים המושאלים עודכנה"
      });
    } catch (error) {
      toast({
        title: "שגיאה בעדכון פריטים",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive"
      });
    }
  };

  // Check authentication status on component mount
  React.useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth-status', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
      }
    };
    checkAuthStatus();
  }, []);

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setPinError('יש להזין 4 ספרות');
      return;
    }

    setIsVerifyingPin(true);
    setPinError('');

    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticated(true);
        setShowMedicalPinDialog(false);
        setShowMedicalTreatment(true);
        setPin('');
        setPinError('');
        setRemainingAttempts(null);
        
        // Refetch occupants to get full medical data after authentication
        await queryClient.invalidateQueries({ queryKey: ['/api/occupants'] });
        
        toast({
          title: "אימות בוצע בהצלחה",
          description: "גישה לטיפול התרופתי אושרה"
        });
      } else {
        setPinError(data.error || 'PIN שגוי');
        setPin('');
        
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        
        if (data.lockedOut) {
          toast({
            title: "חשבון נחסם זמנית",
            description: data.error,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setPinError('שגיאה בתקשורת עם השרת');
      setPin('');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setShowMedicalTreatment(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const resetMedicalDialog = () => {
    setShowMedicalPinDialog(false);
    setShowMedicalTreatment(false);
    setPin('');
    setPinError('');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-7xl max-w-[95vw] max-h-[90vh] sm:max-h-[95vh] overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50" dir="rtl">
        <DialogHeader className="pb-4 sm:pb-6">
          <DialogTitle className="text-right text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <Users className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
            פרטי המטופלים
          </DialogTitle>
          <div className="text-gray-600 text-right mt-1 sm:mt-2 text-sm sm:text-base">מידע מפורט על כל המטופלים במערכת</div>
        </DialogHeader>

        {/* Mobile Layout */}
        <div className="block sm:hidden h-[calc(90vh-100px)]">
          {selectedOccupant ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedOccupant(null)}
                    className="text-xs"
                  >
                    ← חזור לרשימה
                  </Button>
                  <h3 className="font-bold text-lg">{selectedOccupant.name}</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditFormOpen(true)}
                  className="flex items-center gap-1 text-xs bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-800"
                  data-testid="button-edit-mobile"
                >
                  <Edit3 className="w-3 h-3" />
                  עריכה
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-4 pb-6">
                  {/* Basic Info Card */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="font-medium text-gray-700 mb-2 text-right">פרטים בסיסיים</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{selectedOccupant.name}</span>
                        <span className="text-gray-600">שם:</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`font-medium ${selectedOccupant.gender === 'זכר' ? 'text-blue-600' : 'text-pink-600'}`}>
                          {selectedOccupant.gender}
                        </span>
                        <span className="text-gray-600">מין:</span>
                      </div>
                      {selectedOccupant.isReligious && (
                        <div className="flex justify-between">
                          <span className="font-medium text-purple-600">דתי</span>
                          <span className="text-gray-600">דתיות:</span>
                        </div>
                      )}
                      {selectedOccupant.clientPhone && (
                        <div className="flex justify-between">
                          <span className="font-medium text-blue-600 direction-ltr">{selectedOccupant.clientPhone}</span>
                          <span className="text-gray-600">טלפון:</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Professional Treatment */}
                  {(selectedOccupant.addictionType || canShowMedical(selectedOccupant, isAuthenticated) || selectedOccupant.plannedExitStart || selectedOccupant.plannedExitEnd || selectedOccupant.privateConsultation || canShowNotes(selectedOccupant)) && (
                    <div className="bg-white p-3 rounded-lg shadow-sm border">
                      <h4 className="font-medium text-gray-700 mb-2 text-right">טיפול מקצועי</h4>
                      <div className="space-y-2 text-sm">
                        {selectedOccupant.addictionType && (
                          <div className="flex justify-between">
                            <span className="font-medium text-orange-600">{selectedOccupant.addictionType}</span>
                            <span className="text-gray-600">התמכרות:</span>
                          </div>
                        )}
                        {(selectedOccupant.plannedExitStart || selectedOccupant.plannedExitEnd) && (
                          <div className="space-y-1">
                            <div className="text-gray-600 text-xs mb-1 text-right">יציאות מתוכננות:</div>
                            <div className="text-sm">
                              {selectedOccupant.plannedExitStart && (
                                <div className="text-blue-600 font-medium">מתחיל: {new Date(selectedOccupant.plannedExitStart).toLocaleDateString('he-IL')}</div>
                              )}
                              {selectedOccupant.plannedExitEnd && (
                                <div className="text-blue-600 font-medium">עד: {new Date(selectedOccupant.plannedExitEnd).toLocaleDateString('he-IL')}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {selectedOccupant.privateConsultation && (
                          <div className="flex justify-between">
                            <span className="font-medium text-purple-600">{new Date(selectedOccupant.privateConsultation).toLocaleDateString('he-IL')}</span>
                            <span className="text-gray-600">שיחה פרטנית:</span>
                          </div>
                        )}
                        {canShowNotes(selectedOccupant) && (
                          <div className="border-t pt-2">
                            <div className="text-gray-600 text-xs mb-1 text-right">הערות:</div>
                            <div className="text-gray-800 text-sm bg-gray-50 p-2 rounded text-right whitespace-pre-wrap leading-relaxed">
                              {selectedOccupant.notes || 'אין הערות'}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* כפתור טיפול תרופתי */}
                      {canShowMedical(selectedOccupant, isAuthenticated) && (
                        <div className="mt-3 flex justify-center">
                          <Button
                            onClick={() => setShowMedicalPinDialog(true)}
                            variant="outline"
                            size="sm"
                            className="w-32 text-xs bg-green-50 border-green-300 hover:bg-green-100 text-green-800"
                          >
                            טיפול תרופתי
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Room Info */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="font-medium text-gray-700 mb-2 text-right">חדר</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{getRoomInfo(selectedOccupant.roomId)?.name}</span>
                        <span className="text-gray-600">חדר:</span>
                      </div>
                      <div className="flex justify-between">
                        <Badge className={getStayingProbabilityColor(selectedOccupant.stayingProbability)}>
                          {selectedOccupant.stayingProbability}
                        </Badge>
                        <span className="text-gray-600">סבירות:</span>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="font-medium text-gray-700 mb-2 text-right">תאריכים</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{formatDate(selectedOccupant.joinDate)}</span>
                        <span className="text-gray-600">הצטרפות:</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">{formatDateTime(selectedOccupant.endDateTime)}</span>
                        <span className="text-gray-600">עזיבה צפויה:</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="font-medium text-gray-700 mb-2 text-right">תשלומים</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {(selectedOccupant.plannedMonths || 1) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.plannedMonths || 1}
                        </span>
                        <span className="text-gray-600">מתוכנן:</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {(selectedOccupant.paidMonths || 0) >= (selectedOccupant.plannedMonths || 1) ? (
                            <div className="flex items-center text-green-600">
                              <svg className="w-4 h-4 text-green-500 font-bold" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium mr-1">שולם במלואו</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-500">
                              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium mr-1">
                                שולם {(selectedOccupant.paidMonths || 0) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.paidMonths || 0} מתוך {(selectedOccupant.plannedMonths || 1) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.plannedMonths || 1}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-gray-600">תשלום:</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposits Info */}
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <h4 className="font-medium text-gray-700 mb-2 text-right">פקדונות</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${(selectedOccupant.deposits || 0) < 0 ? 'text-red-600' : (selectedOccupant.deposits || 0) > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {(selectedOccupant.deposits || 0).toLocaleString()}₪
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                            onClick={() => setShowPurchaseHistory(true)}
                            title="היסטוריית רכישות"
                            data-testid="button-purchase-history"
                          >
                            ₪
                          </Button>
                        </div>
                        <span className="text-gray-600">ערבונות:</span>
                      </div>
                      {selectedOccupant.safeItems && (
                        <div>
                          <span className="text-gray-600 text-xs text-right block">חפצים בכספת:</span>
                          <div className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto text-right">
                            {selectedOccupant.safeItems}
                          </div>
                        </div>
                      )}
                      {/* כפתורי ניהול */}
                      <div className="space-y-2">
                        <Button
                          onClick={() => setBorrowedItemsDialog(true)}
                          variant="outline"
                          size="sm"
                          className="w-full text-xs bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-800"
                        >
                          <Package className="w-3 h-3 ml-1" />
                          ניהול חפצים מושאלים
                        </Button>
                        {canShowMedical(selectedOccupant, isAuthenticated) && (
                          <Button
                            onClick={() => setShowMedicalPinDialog(true)}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs bg-green-50 border-green-300 hover:bg-green-100 text-green-800"
                          >
                            טיפול תרופתי
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {canShowContact(selectedOccupant, isAuthenticated) && (
                    <div className="bg-white p-3 rounded-lg shadow-sm border">
                      <h4 className="font-medium text-gray-700 mb-2 text-right">איש קשר</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{selectedOccupant.contactName}</span>
                          <span className="text-gray-600">שם:</span>
                        </div>
                        {selectedOccupant.contactPhone && (
                          <div className="flex justify-between">
                            <span className="font-medium text-blue-600">{selectedOccupant.contactPhone}</span>
                            <span className="text-gray-600">טלפון:</span>
                          </div>
                        )}
                        {selectedOccupant.contactRelationship && (
                          <div className="flex justify-between">
                            <span className="font-medium">{selectedOccupant.contactRelationship}</span>
                            <span className="text-gray-600">קרבה:</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full">
              <h3 className="font-medium text-gray-700 mb-3">רשימת מטופלים ({occupants.length})</h3>
              <ScrollArea className="h-[calc(90vh-150px)]">
                <div className="space-y-2">
                  {occupants.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <div className="text-base font-medium">אין מטופלים רשומים</div>
                    </div>
                  ) : (
                    occupants.map((occupant) => {
                      const room = getRoomInfo(occupant.roomId);
                      return (
                        <div
                          key={occupant.id}
                          className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => setSelectedOccupant(occupant)}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              {hasPaymentIssue(occupant) && (
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              )}
                              <span className="font-medium text-sm">{occupant.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {occupant.gender}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">{room?.name}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <Badge className={`text-xs ${getStayingProbabilityColor(occupant.stayingProbability)}`}>
                              {occupant.stayingProbability}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {getRemainingTime(occupant.endDateTime)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(95vh-140px)]">
          {/* Occupants List */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="text-xl text-right flex items-center gap-2">
                  <User className="h-5 w-5" />
                  רשימת מטופלים ({occupants.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(95vh-240px)]">
                  <div className="space-y-3 p-6">
                    {occupants.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">
                        <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <div className="text-lg font-medium">אין מטופלים רשומים</div>
                        <div className="text-sm">נתונים יופיעו כאן לאחר רישום מטופלים</div>
                      </div>
                    ) : (
                      occupants.map((occupant) => {
                        const room = getRoomInfo(occupant.roomId);
                        const isSelected = selectedOccupant?.id === occupant.id;
                        return (
                          <div
                            key={occupant.id}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
                              isSelected 
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border-2 border-blue-300' 
                                : 'bg-white border border-gray-200 hover:bg-gray-50 shadow-md'
                            }`}
                            onClick={() => setSelectedOccupant(occupant)}
                          >
                            <div className="text-right">
                              <div className={`font-bold text-lg flex items-center gap-2 mb-2 ${
                                isSelected ? 'text-white' : 'text-gray-900'
                              }`}>
                                {hasPaymentIssue(occupant) && (
                                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" title="טרם שילם על החודשים המתוכננים"></div>
                                )}
                                <div className={`p-1.5 rounded-full ${
                                  isSelected ? 'bg-white/20' : 'bg-blue-100'
                                }`}>
                                  <User className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                                </div>
                                {occupant.name}
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  isSelected 
                                    ? occupant.gender === 'זכר' 
                                      ? 'bg-blue-200 text-blue-800' 
                                      : 'bg-pink-200 text-pink-800'
                                    : occupant.gender === 'זכר' 
                                      ? 'bg-blue-100 text-blue-600' 
                                      : 'bg-pink-100 text-pink-600'
                                }`}>
                                  {occupant.gender}
                                </span>
                              </div>
                              <div className={`text-sm flex items-center gap-2 mb-3 ${
                                isSelected ? 'text-blue-100' : 'text-gray-600'
                              }`}>
                                <MapPin className="h-4 w-4" />
                                {room?.name}
                                {room?.isWomenOnly && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    isSelected ? 'bg-pink-200 text-pink-800' : 'text-pink-600 bg-pink-100'
                                  }`}>
                                    נשים
                                  </span>
                                )}
                                <span className={`font-bold ${
                                  isSelected ? 'text-green-200' : 'text-green-600'
                                }`}>
                                  {room?.pricePerBed?.toLocaleString()}₪
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <Badge 
                                  className={`text-xs font-medium ${
                                    isSelected 
                                      ? 'bg-white/20 text-white border-white/30' 
                                      : getStayingProbabilityColor(occupant.stayingProbability)
                                  }`}
                                >
                                  {occupant.stayingProbability}
                                </Badge>
                                <div className={`text-xs flex items-center gap-1 ${
                                  isSelected ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  <Clock className="h-3 w-3" />
                                  {getRemainingTime(occupant.endDateTime)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Occupant Details */}
          <div className="lg:col-span-2">
            {selectedOccupant ? (
              <Card className="h-full shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-right flex items-center gap-3">
                      {hasPaymentIssue(selectedOccupant) && (
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" title="טרם שילם על החודשים המתוכננים"></div>
                      )}
                      <div className="p-2 bg-white/20 rounded-xl">
                        <User className="h-6 w-6" />
                      </div>
                      פרטי המטופל - {selectedOccupant.name}
                    </CardTitle>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditFormOpen(true)}
                        className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                      >
                        <Edit3 className="h-4 w-4" />
                        ערוך פרטים
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onDelete(selectedOccupant.id);
                          setSelectedOccupant(null);
                        }}
                        className="flex items-center gap-2 bg-red-500/20 border-red-300/20 text-red-100 hover:bg-red-500/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        מחק מטופל
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-[calc(95vh-300px)]">
                    <div className="space-y-4">
                      {/* Payment Status Alert */}
                      {hasPaymentIssue(selectedOccupant) && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-3 justify-end">
                            <div>
                              <div className="text-red-800 font-bold text-right">דרושה תשומת לב - חסר תשלום</div>
                              <div className="text-red-600 text-sm text-right mt-1">
                                המטופל מתכנן להישאר {selectedOccupant.plannedMonths} חודשים אך שילם רק ל-{selectedOccupant.paidMonths} חודשים
                              </div>
                            </div>
                            <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      )}

                      {/* Compact Information Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Stay Info */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">מידע שהייה</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={`text-xs ${getStayingProbabilityColor(selectedOccupant.stayingProbability)}`}>
                                  {selectedOccupant.stayingProbability}
                                </Badge>
                                {(selectedOccupant.stayingProbability === 'בטוח' || selectedOccupant.stayingProbability === 'אולי') && selectedOccupant.stayingDuration && (
                                  <span className="text-xs text-gray-500">
                                    ל-{selectedOccupant.stayingDuration === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.stayingDuration}
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-600">סבירות:</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-orange-600 text-xs">
                                {getRemainingTime(selectedOccupant.endDateTime)}
                              </span>
                              <span className="text-gray-600">זמן נותר:</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="font-medium text-blue-600">
                                  {(selectedOccupant.plannedMonths || 1) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.plannedMonths || 1}
                                </span>
                                <span className="text-gray-600">מתוכנן:</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  {(selectedOccupant.paidMonths || 0) >= (selectedOccupant.plannedMonths || 1) ? (
                                    <div className="flex items-center text-green-600">
                                      <svg className="w-5 h-5 text-green-500 font-bold" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      <span className="font-medium mr-1">שולם במלואו</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-red-500">
                                      <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                      </svg>
                                      <span className="font-medium mr-1">
                                        שולם {(selectedOccupant.paidMonths || 0) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.paidMonths || 0} מתוך {(selectedOccupant.plannedMonths || 1) === 1 ? 'חודש' : 'חודשים'} {selectedOccupant.plannedMonths || 1}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-gray-600">תשלום:</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Room Info */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">מידע חדר</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{getRoomInfo(selectedOccupant.roomId)?.name}</span>
                              <span className="text-gray-600">חדר:</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-green-600">
                                {getRoomInfo(selectedOccupant.roomId)?.pricePerBed?.toLocaleString()}₪
                              </span>
                              <span className="text-gray-600">מחיר:</span>
                            </div>
                            {getRoomInfo(selectedOccupant.roomId)?.isWomenOnly && (
                              <div className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded text-center">
                                חדר לנשים בלבד
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Personal Info */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">פרטים אישיים</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{selectedOccupant.name}</span>
                              <span className="text-gray-600">שם:</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-medium ${
                                selectedOccupant.gender === 'זכר' ? 'text-blue-600' : 'text-pink-600'
                              }`}>{selectedOccupant.gender}</span>
                              <span className="text-gray-600">מין:</span>
                            </div>
                            {selectedOccupant.isReligious && (
                              <div className="flex justify-between">
                                <span className="font-medium text-purple-600">דתי</span>
                                <span className="text-gray-600">דתיות:</span>
                              </div>
                            )}
                            {selectedOccupant.clientPhone && (
                              <div className="flex justify-between">
                                <span className="font-medium text-blue-600 direction-ltr">{selectedOccupant.clientPhone}</span>
                                <span className="text-gray-600">טלפון המטופל:</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Professional Treatment */}
                      {(selectedOccupant.addictionType || selectedOccupant.medicalTreatment || selectedOccupant.plannedExitStart || selectedOccupant.plannedExitEnd || selectedOccupant.privateConsultation || selectedOccupant.notes) && (
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">טיפול מקצועי</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            {selectedOccupant.addictionType && (
                              <div className="flex justify-between">
                                <span className="font-medium text-orange-600">{selectedOccupant.addictionType}</span>
                                <span className="text-gray-600">סוג התמכרות:</span>
                              </div>
                            )}
                            {(selectedOccupant.plannedExitStart || selectedOccupant.plannedExitEnd) && (
                              <div className="space-y-1">
                                <div className="text-gray-600 text-xs mb-1 text-right">יציאות מתוכננות:</div>
                                <div className="flex justify-between text-sm">
                                  <div className="space-y-1">
                                    {selectedOccupant.plannedExitStart && (
                                      <div className="text-blue-600 font-medium">מתחיל: {new Date(selectedOccupant.plannedExitStart).toLocaleDateString('he-IL')}</div>
                                    )}
                                    {selectedOccupant.plannedExitEnd && (
                                      <div className="text-blue-600 font-medium">עד: {new Date(selectedOccupant.plannedExitEnd).toLocaleDateString('he-IL')}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {selectedOccupant.privateConsultation && (
                              <div className="flex justify-between">
                                <span className="font-medium text-purple-600">
                                  {isAuthenticated && selectedOccupant.privateConsultation 
                                    ? new Date(selectedOccupant.privateConsultation).toLocaleDateString('he-IL')
                                    : 'יש שיחה פרטנית - דרוש אימות'
                                  }
                                </span>
                                <span className="text-gray-600">שיחה פרטנית:</span>
                              </div>
                            )}
                            {canShowNotes(selectedOccupant) && (
                              <div className="border-t pt-2">
                                <div className="text-gray-600 text-xs mb-1 text-right">הערות:</div>
                                <div className="text-gray-800 text-sm bg-gray-50 p-2 rounded text-right whitespace-pre-wrap leading-relaxed">
                                  {selectedOccupant.notes || 'אין הערות'}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* כפתור טיפול תרופתי */}
                          {canShowMedical(selectedOccupant, isAuthenticated) && (
                            <div className="mt-3 flex justify-center">
                              <Button
                                onClick={() => setShowMedicalPinDialog(true)}
                                variant="outline"
                                size="sm"
                                className="w-32 text-xs bg-green-50 border-green-300 hover:bg-green-100 text-green-800"
                                data-testid="button-medical-treatment-desktop"
                              >
                                טיפול תרופתי
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <Separator className="my-4" />

                      {/* Dates Section */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">תאריכים</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {new Date(selectedOccupant.joinDate).toLocaleDateString('he-IL')}
                              </span>
                              <span className="text-gray-600">הצטרפות:</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {new Date(selectedOccupant.endDateTime).toLocaleDateString('he-IL')}
                              </span>
                              <span className="text-gray-600">עזיבה צפויה:</span>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">איש קשר</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            {selectedOccupant.contactName ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="font-medium">{selectedOccupant.contactName}</span>
                                  <span className="text-gray-600">שם:</span>
                                </div>
                                {selectedOccupant.contactPhone && (
                                  <div className="flex justify-between">
                                    <span className="font-medium text-blue-600 direction-ltr">{selectedOccupant.contactPhone}</span>
                                    <span className="text-gray-600">טלפון:</span>
                                  </div>
                                )}
                                {selectedOccupant.contactRelationship && (
                                  <div className="flex justify-between">
                                    <span className="font-medium text-purple-600">{selectedOccupant.contactRelationship}</span>
                                    <span className="text-gray-600">קרבה:</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-gray-400 text-center py-2">
                                לא הוגדר איש קשר
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Financial Info */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border">
                          <div className="flex justify-end mb-2">
                            <div className="text-sm font-medium text-gray-600">פקדונות</div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="text-center flex items-center justify-center gap-2">
                              <span className={`font-medium text-lg ${(selectedOccupant.deposits || 0) < 0 ? 'text-red-600' : (selectedOccupant.deposits || 0) > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {(selectedOccupant.deposits || 0).toLocaleString()}₪
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-100 text-lg font-bold"
                                onClick={() => setShowPurchaseHistory(true)}
                                title="היסטוריית רכישות"
                                data-testid="button-purchase-history-desktop"
                              >
                                ₪
                              </Button>
                            </div>
                            {selectedOccupant.safeItems && (
                              <div>
                                <span className="text-gray-600 text-xs text-right block">חפצים בכספת:</span>
                                <div className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto text-right">
                                  {selectedOccupant.safeItems}
                                </div>
                              </div>
                            )}
                            {/* כפתור חפצים שהושאלו */}
                            <div className="space-y-2">
                              <Button
                                onClick={() => setBorrowedItemsDialog(true)}
                                variant="outline"
                                size="sm"
                                className="w-full text-xs bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-800"
                              >
                                <Package className="w-3 h-3 ml-1" />
                                ניהול חפצים מושאלים
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>


                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent>
                  <div className="text-center text-gray-500 py-20">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full opacity-20 animate-pulse"></div>
                      <Users className="h-24 w-24 mx-auto text-gray-300 relative z-10" />
                    </div>
                    <div className="text-2xl font-bold text-gray-700 mb-2">בחר מטופל מהרשימה</div>
                    <div className="text-lg text-gray-500">כדי לראות את פרטיו המלאים ולנהל את המידע</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* Edit Form */}
      <ClientRegistration
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        editingOccupant={selectedOccupant}
        onSuccess={async () => {
          setIsEditFormOpen(false);
          // Refresh the selected occupant data after successful edit
          if (selectedOccupant) {
            try {
              const response = await fetch('/api/occupants');
              const occupants = await response.json();
              const updatedOccupant = occupants.find((occ: any) => occ.id === selectedOccupant.id);
              if (updatedOccupant) {
                setSelectedOccupant(updatedOccupant);
              }
            } catch (error) {
              console.error('Error refreshing occupant data:', error);
            }
          }
        }}
      />

      {/* Borrowed Items Dialog */}
      {selectedOccupant && (
        <BorrowedItemsDialog
          isOpen={borrowedItemsDialog}
          onClose={() => setBorrowedItemsDialog(false)}
          occupant={selectedOccupant}
          onUpdate={handleUpdateBorrowedItems}
        />
      )}

      {/* PIN Entry Dialog */}
      <Dialog open={showMedicalPinDialog} onOpenChange={resetMedicalDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">הזנת קוד גישה לטיפול תרופתי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 mb-4">הזן קוד בן 4 ספרות לצפייה בטיפול התרופתי</p>
              <Input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPin(value);
                  setPinError('');
                }}
                className="text-center text-2xl tracking-widest"
                placeholder="• • • •"
                dir="ltr"
                disabled={isVerifyingPin}
                autoComplete="off"
                data-testid="input-medical-pin"
              />
              {pinError && (
                <div className="text-red-600 text-sm mt-2 font-medium flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {pinError}
                </div>
              )}
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <div className="text-yellow-600 text-sm mt-2 font-medium text-center">
                  נותרו {remainingAttempts} ניסיונות
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePinSubmit}
                disabled={pin.length !== 4 || isVerifyingPin}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-submit-pin"
              >
                {isVerifyingPin ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    מאמת...
                  </>
                ) : (
                  'אמת'
                )}
              </Button>
              <Button
                onClick={() => resetMedicalDialog()}
                variant="outline"
                className="flex-1"
                disabled={isVerifyingPin}
                data-testid="button-cancel-pin"
              >
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medical Treatment Display Dialog */}
      <Dialog open={showMedicalTreatment} onOpenChange={() => setShowMedicalTreatment(false)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-green-600">
              טיפול תרופתי - {selectedOccupant?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-right whitespace-pre-wrap text-gray-800 leading-relaxed">
                {selectedOccupant?.medicalTreatment || 'לא צוין טיפול תרופתי'}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowMedicalTreatment(false)}
                className="bg-green-600 hover:bg-green-700"
              >
                סגור
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={showPurchaseHistory} onOpenChange={setShowPurchaseHistory}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] w-[95vw] sm:w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-lg sm:text-xl text-purple-600">
              היסטוריית רכישות - {selectedOccupant?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 p-1">
              {/* Deposit Calculation */}
              {selectedOccupant && (
                <div className="bg-purple-50 p-3 sm:p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-800 mb-2 text-right">חישוב פיקדון</h4>
                  <div className={`text-lg font-bold text-center ${(selectedOccupant.deposits || 0) < 0 ? 'text-red-600' : 'text-purple-700'}`}>
                    {(() => {
                      const initial = selectedOccupant.initialDeposit || 0;
                      const current = selectedOccupant.deposits || 0;
                      const spent = initial + totalDepositsAdded - current;
                      if (initial > 0 || totalDepositsAdded > 0) {
                        return `₪${(initial + totalDepositsAdded).toLocaleString()} - ₪${spent.toLocaleString()} = ₪${current.toLocaleString()}`;
                      } else {
                        return `₪${current.toLocaleString()}`;
                      }
                    })()}
                  </div>
                  <div className={`text-sm text-center mt-1 ${(selectedOccupant.deposits || 0) < 0 ? 'text-red-500' : 'text-purple-600'}`}>
                    יתרת פיקדון נוכחית: ₪{(selectedOccupant.deposits || 0).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Add Deposit Form - Shows when button is clicked */}
              {showAddDepositForm && (
                <div className="bg-green-50 rounded-lg border border-green-200 p-3">
                  <h4 className="font-medium text-green-800 mb-2 text-right">הפקדה חדשה</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="number"
                      placeholder="סכום ₪"
                      value={addDepositAmount}
                      onChange={(e) => setAddDepositAmount(e.target.value)}
                      className="text-right flex-1"
                      data-testid="input-add-deposit-amount"
                    />
                    <Input
                      placeholder="הערה (אופציונלי)"
                      value={addDepositNote}
                      onChange={(e) => setAddDepositNote(e.target.value)}
                      className="text-right flex-1"
                      data-testid="input-add-deposit-note"
                    />
                    <Button
                      onClick={() => {
                        if (selectedOccupant && addDepositAmount) {
                          addDepositMutation.mutate({
                            patientId: selectedOccupant.id,
                            patientName: selectedOccupant.name,
                            amount: Number(addDepositAmount),
                            note: addDepositNote,
                          });
                        }
                      }}
                      disabled={!addDepositAmount || addDepositMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                      data-testid="button-add-deposit"
                    >
                      {addDepositMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 ml-1" />}
                      הוסף
                    </Button>
                  </div>
                </div>
              )}

              {/* Deposit History */}
              {depositHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-green-700 text-right">הפקדות</h4>
                  {depositHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-green-50 p-2 sm:p-3 rounded-lg border border-green-100"
                    >
                      <div className="flex flex-row-reverse justify-between items-start gap-2">
                        <span className="text-xs sm:text-sm text-gray-500 text-left">
                          {new Date(entry.createdAt).toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="font-bold text-green-600 text-right">
                          +₪{entry.amount.toLocaleString()}
                        </span>
                      </div>
                      {entry.note && (
                        <div className="text-xs text-gray-600 mt-1 text-right">{entry.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Purchase Transactions List */}
              {loadingTransactions || loadingDepositHistory ? (
                <div className="text-center py-8 text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  טוען היסטוריה...
                </div>
              ) : purchaseTransactions.length === 0 && depositHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  אין היסטוריה
                </div>
              ) : purchaseTransactions.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  <h4 className="font-medium text-gray-700 text-right">רכישות</h4>
                  {purchaseTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="bg-white p-2 sm:p-3 rounded-lg border shadow-sm"
                    >
                      <div className="flex flex-row-reverse justify-between items-start gap-2 mb-2">
                        <span className="text-xs sm:text-sm text-gray-500 text-left">
                          {new Date(transaction.purchaseDate).toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="font-bold text-red-600 text-right">
                          -₪{transaction.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        <div className="font-medium mb-1">פריטים:</div>
                        <ul className="list-disc list-inside text-xs space-y-0.5 max-h-20 overflow-y-auto text-right" style={{ direction: 'rtl' }}>
                          {transaction.items.split('\n').filter(item => item.trim()).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="bg-gray-100 p-2 sm:p-3 rounded-lg">
                    <div className="flex flex-row-reverse justify-between font-bold">
                      <span className="text-gray-700">סה"כ רכישות:</span>
                      <span className="text-red-600">-₪{totalPurchases.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="flex justify-between pt-2">
            <Button
              onClick={() => setShowPurchaseHistory(false)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              סגור
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDepositForm(!showAddDepositForm)}
              className="text-green-700 border-green-300 hover:bg-green-50"
              data-testid="button-toggle-add-deposit"
            >
              <Plus className="h-3 w-3 ml-1" />
              הפקדה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}