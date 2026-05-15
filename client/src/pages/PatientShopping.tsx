import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Check, Trash2, User, ShoppingCart, RefreshCw, X, CreditCard, LogIn, Building } from "lucide-react";
import type { Occupant, SelectPatientShoppingList } from "@shared/schema";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const getLatestList = (listId: string): SelectPatientShoppingList | undefined => {
  const lists = queryClient.getQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"]);
  return lists?.find(l => l.id === listId);
};

export default function PatientShopping() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [duplicatePatient, setDuplicatePatient] = useState<string | null>(null);
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);
  const [purchaseConfirmation, setPurchaseConfirmation] = useState(false);

  const isGuestMode = useMemo(() => {
    const mode = sessionStorage.getItem('patient_shopping_mode');
    return mode === 'guest';
  }, []);

  const { data: patients = [], isLoading: loadingPatients } = useQuery<Occupant[]>({
    queryKey: ["/api/occupants"],
  });

  const { data: shoppingLists = [], isLoading: loadingLists } = useQuery<SelectPatientShoppingList[]>({
    queryKey: ["/api/patient-shopping"],
  });

  const sortedShoppingLists = useMemo(() => {
    return [...shoppingLists].sort((a, b) => a.id.localeCompare(b.id));
  }, [shoppingLists]);

  const addPatientMutation = useMutation({
    mutationFn: async (patient: Occupant) => {
      return await apiRequest("POST", "/api/patient-shopping", {
        patientId: patient.id,
        patientName: patient.name,
        items: "",
        checkedItems: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
      setShowPatientSelector(false);
      toast({ title: "המטופל נוסף לרשימת הקניות" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const addBusinessMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/patient-shopping", {
        patientId: "business",
        patientName: "קניות לעסק",
        items: "",
        checkedItems: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
      setShowPatientSelector(false);
      toast({ title: "רשימת קניות לעסק נוספה" });
    },
    onError: (error: any) => {
      if (error.message?.includes("already exists")) {
        toast({ title: "רשימת קניות לעסק כבר קיימת", variant: "destructive" });
      } else {
        toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleAddBusiness = () => {
    const existingBusiness = shoppingLists.find(list => list.patientId === "business");
    if (existingBusiness) {
      toast({ title: "רשימת קניות לעסק כבר קיימת", variant: "destructive" });
      return;
    }
    addBusinessMutation.mutate();
  };

  const updateListMutation = useMutation({
    mutationFn: async ({ id, items, checkedItems, totalAmount, paymentMethod }: { 
      id: string; 
      items?: string; 
      checkedItems?: string[];
      totalAmount?: string;
      paymentMethod?: string;
    }) => {
      const updates: any = {};
      if (items !== undefined) updates.items = items;
      if (checkedItems !== undefined) updates.checkedItems = checkedItems;
      if (totalAmount !== undefined) updates.totalAmount = totalAmount;
      if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
      const response = await apiRequest("PATCH", `/api/patient-shopping/${id}`, updates);
      return response.json() as Promise<SelectPatientShoppingList>;
    },
    onMutate: async ({ id, items, checkedItems, totalAmount, paymentMethod }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/patient-shopping"] });
      const previousLists = queryClient.getQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"]);
      queryClient.setQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"], (old) => {
        if (!old) return old;
        return old.map(list => {
          if (list.id !== id) return list;
          const updated = { ...list };
          if (items !== undefined) updated.items = items;
          if (checkedItems !== undefined) updated.checkedItems = checkedItems;
          if (totalAmount !== undefined) updated.totalAmount = totalAmount;
          if (paymentMethod !== undefined) updated.paymentMethod = paymentMethod;
          return updated;
        });
      });
      return { previousLists };
    },
    onSuccess: (updatedList) => {
      queryClient.setQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"], (old) => {
        if (!old) return old;
        return old.map(list => 
          list.id === updatedList.id ? updatedList : list
        );
      });
    },
    onError: (error: any, _, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["/api/patient-shopping"], context.previousLists);
      }
      toast({ title: "שגיאה בשמירה", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/patient-shopping/${id}`);
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/patient-shopping"] });
      const previousLists = queryClient.getQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"]);
      queryClient.setQueryData<SelectPatientShoppingList[]>(["/api/patient-shopping"], (old) => {
        if (!old) return old;
        return old.filter(list => list.id !== deletedId);
      });
      return { previousLists };
    },
    onSuccess: () => {
      toast({ title: "הרשימה נמחקה" });
    },
    onError: (error: any, _, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["/api/patient-shopping"], context.previousLists);
      }
      toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/patient-shopping/reset-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
      setResetDialogOpen(false);
      setResetPassword("");
      toast({ title: "כל הרשימות אופסו בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה באיפוס", description: error.message, variant: "destructive" });
    },
  });

  const handlePatientSelect = (patient: Occupant) => {
    const existing = shoppingLists.find(l => l.patientId === patient.id);
    if (existing) {
      setDuplicatePatient(patient.name);
      return;
    }
    addPatientMutation.mutate(patient);
  };

  const getItemsArray = (items: string) => {
    return items.split('\n').filter(item => item.trim() !== '');
  };

  const handleAddItem = (listId: string) => {
    const newItem = newItemInputs[listId]?.trim();
    if (!newItem) return;
    
    const currentList = getLatestList(listId);
    if (!currentList) return;
    
    const updatedItems = currentList.items ? `${currentList.items}\n${newItem}` : newItem;
    updateListMutation.mutate({ id: listId, items: updatedItems, checkedItems: currentList.checkedItems });
    setNewItemInputs(prev => ({ ...prev, [listId]: "" }));
  };

  const handleDeleteItem = (listId: string, itemIndex: number) => {
    const currentList = getLatestList(listId);
    if (!currentList) return;
    
    const itemsArray = getItemsArray(currentList.items);
    itemsArray.splice(itemIndex, 1);
    const updatedItems = itemsArray.join('\n');
    
    const newCheckedItems = currentList.checkedItems
      .map(i => parseInt(i))
      .filter(i => i !== itemIndex)
      .map(i => (i > itemIndex ? i - 1 : i).toString());
    
    updateListMutation.mutate({ id: listId, items: updatedItems, checkedItems: newCheckedItems });
  };

  const handleToggleItem = (listId: string, itemIndex: number) => {
    const currentList = getLatestList(listId);
    if (!currentList) return;
    
    const itemKey = itemIndex.toString();
    const newCheckedItems = currentList.checkedItems.includes(itemKey)
      ? currentList.checkedItems.filter(i => i !== itemKey)
      : [...currentList.checkedItems, itemKey];
    
    updateListMutation.mutate({ id: listId, items: currentList.items, checkedItems: newCheckedItems });
  };

  const handleKeyDown = (e: React.KeyboardEvent, listId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem(listId);
    }
  };

  const completePurchaseMutation = useMutation({
    mutationFn: async (purchases: { patientId: string; patientName: string; items: string; totalAmount: number; listId: string }[]) => {
      return await apiRequest("POST", "/api/complete-purchase", { purchases });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-shopping"] });
      queryClient.invalidateQueries({ queryKey: ["/api/occupants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-transactions"] });
      setPurchaseConfirmation(false);
      toast({ title: "הרכישה בוצעה בהצלחה", description: "הסכומים הורדו מהפיקדונות" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בביצוע הרכישה", description: error.message, variant: "destructive" });
    },
  });

  const getCheckedItemsText = (list: SelectPatientShoppingList) => {
    const itemsArray = getItemsArray(list.items);
    const checkedItems = list.checkedItems
      .map(i => parseInt(i))
      .filter(i => i >= 0 && i < itemsArray.length)
      .map(i => itemsArray[i]);
    return checkedItems.join(', ');
  };

  const handleCompletePurchase = () => {
    // Get lists that have cash payment, a total amount, AND at least one checked item
    // Exclude business shopping from deposit deduction
    const cashPurchases = sortedShoppingLists
      .filter(list => 
        list.patientId !== "business" &&
        list.paymentMethod === "מזומן" && 
        list.totalAmount && 
        parseFloat(list.totalAmount) > 0 &&
        list.checkedItems.length > 0
      )
      .map(list => ({
        patientId: list.patientId,
        patientName: list.patientName,
        items: getCheckedItemsText(list),
        totalAmount: parseFloat(list.totalAmount || "0"),
        listId: list.id,
      }));
    
    if (cashPurchases.length === 0) {
      toast({ 
        title: "אין רכישות במזומן", 
        description: "רק רכישות שסומנו כמזומן עם סכום ופריטים מסומנים יופחתו מהפיקדון",
        variant: "destructive" 
      });
      return;
    }
    
    completePurchaseMutation.mutate(cashPurchases);
  };

  const getCashPurchasesCount = () => {
    return sortedShoppingLists.filter(
      list => 
        list.patientId !== "business" &&
        list.paymentMethod === "מזומן" && 
        list.totalAmount && 
        parseFloat(list.totalAmount) > 0 &&
        list.checkedItems.length > 0
    ).length;
  };

  const handleReset = async () => {
    if (resetPassword !== "2026") {
      toast({ title: "סיסמה שגויה", variant: "destructive" });
      return;
    }
    resetAllMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8 text-purple-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-purple-800" data-testid="text-title">
              קניות למטופלים
            </h1>
          </div>
          {isGuestMode ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 self-start sm:self-auto"
              onClick={() => {
                sessionStorage.removeItem('patient_shopping_mode');
                setLocation("/");
              }}
              data-testid="button-login"
            >
              <LogIn className="h-5 w-5 ml-1" />
              להתחברות
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 self-start sm:self-auto"
              onClick={() => setLocation("/main")}
              data-testid="button-back"
            >
              <ArrowRight className="h-5 w-5 ml-1" />
              לתפריט
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
          <Button
            size="sm"
            className="bg-purple-500 hover:bg-purple-600 text-white gap-1 sm:gap-2 text-sm"
            onClick={() => setShowPatientSelector(true)}
            data-testid="button-add-patient"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            בחירת מטופל
          </Button>
          {!isGuestMode && sortedShoppingLists.length > 0 && (
            <>
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white gap-1 sm:gap-2 text-sm"
                onClick={() => setPurchaseConfirmation(true)}
                data-testid="button-complete-purchase"
              >
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                רכישה בוצעה
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1 sm:gap-2 text-sm"
                onClick={() => setResetDialogOpen(true)}
                data-testid="button-reset-all"
              >
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
                איפוס
              </Button>
            </>
          )}
        </div>

        {loadingLists ? (
          <div className="text-center py-12 text-gray-500">טוען...</div>
        ) : sortedShoppingLists.length === 0 ? (
          <Card className="border-2 border-dashed border-purple-300 bg-white/60">
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-purple-400 mb-4" />
              <p className="text-purple-600 text-lg mb-4">אין רשימות קניות פעילות</p>
              <Button
                className="bg-purple-500 hover:bg-purple-600 text-white"
                onClick={() => setShowPatientSelector(true)}
              >
                <Plus className="h-5 w-5 ml-2" />
                הוסף מטופל ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedShoppingLists.map(list => {
              const itemsArray = getItemsArray(list.items);
              return (
                <Card
                  key={list.id}
                  className={`border-2 bg-white/90 ${
                    list.patientId === "business" 
                      ? "border-blue-200" 
                      : "border-purple-200"
                  }`}
                  data-testid={`card-patient-${list.patientId}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className={`flex items-center gap-2 ${
                          list.patientId === "business" 
                            ? "text-blue-700" 
                            : "text-purple-800"
                        }`}>
                          {list.patientId === "business" ? (
                            <Building className="h-5 w-5" />
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                          {list.patientName}
                        </CardTitle>
                        {!isGuestMode && list.patientId !== "business" && (() => {
                          const patient = patients.find(p => p.id === list.patientId);
                          const deposit = patient?.deposits ?? 0;
                          return (
                            <div className={`text-sm mt-1 mr-7 ${deposit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              יתרה: ₪{deposit.toLocaleString()}
                            </div>
                          );
                        })()}
                      </div>
                      {!isGuestMode && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                          onClick={() => setDeleteConfirmation({ id: list.id, name: list.patientName })}
                          data-testid={`button-delete-${list.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newItemInputs[list.id] || ""}
                        onChange={(e) => setNewItemInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                        onKeyDown={(e) => handleKeyDown(e, list.id)}
                        placeholder="הוסף מוצר..."
                        className="text-sm flex-1"
                        data-testid={`input-new-item-${list.id}`}
                      />
                      <Button
                        size="sm"
                        className={`px-3 ${
                          list.patientId === "business"
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-purple-500 hover:bg-purple-600"
                        }`}
                        onClick={() => handleAddItem(list.id)}
                        disabled={!newItemInputs[list.id]?.trim()}
                        data-testid={`button-add-item-${list.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {itemsArray.length > 0 && (
                      <div className="space-y-1 border-t pt-3">
                        {itemsArray.map((item, index) => {
                          const isChecked = list.checkedItems.includes(index.toString());
                          return (
                            <div
                              key={`${list.id}-item-${index}`}
                              className={`flex items-center gap-2 p-2 rounded transition-all ${
                                isChecked
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-50'
                              }`}
                              data-testid={`item-${list.id}-${index}`}
                            >
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                                onClick={() => handleToggleItem(list.id, index)}
                              >
                                {isChecked && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className={`flex-1 ${isChecked ? 'line-through' : ''}`}>
                                {item}
                              </span>
                              <button
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                onClick={() => handleDeleteItem(list.id, index)}
                                data-testid={`button-delete-item-${list.id}-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 whitespace-nowrap">סה"כ:</span>
                        <Input
                          value={amountInputs[list.id] !== undefined ? amountInputs[list.id] : (list.totalAmount || "")}
                          onChange={(e) => setAmountInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value !== (list.totalAmount || "")) {
                              updateListMutation.mutate({ id: list.id, totalAmount: value });
                            }
                            setAmountInputs(prev => {
                              const next = { ...prev };
                              delete next[list.id];
                              return next;
                            });
                          }}
                          placeholder="סכום"
                          className="text-sm flex-1"
                          data-testid={`input-total-amount-${list.id}`}
                        />
                        <span className="text-sm text-gray-500">₪</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 whitespace-nowrap">תשלום:</span>
                        <Select
                          value={list.paymentMethod || ""}
                          onValueChange={(value) => updateListMutation.mutate({ 
                            id: list.id, 
                            paymentMethod: value 
                          })}
                        >
                          <SelectTrigger 
                            className="flex-1 text-sm"
                            data-testid={`select-payment-method-${list.id}`}
                          >
                            <SelectValue placeholder="בחר אמצעי תשלום" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="מזומן">מזומן</SelectItem>
                            <SelectItem value="אשראי">אשראי</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={showPatientSelector} onOpenChange={setShowPatientSelector}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-600" />
                בחירת מטופל
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-blue-300 cursor-pointer hover:bg-blue-50 transition-all bg-blue-50/50"
                onClick={handleAddBusiness}
                data-testid="select-business-shopping"
              >
                <div className="p-2 bg-blue-100 rounded-full">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium text-blue-700">קניות לעסק</span>
              </div>
              <div className="border-t my-2 pt-2">
                <p className="text-sm text-gray-500 mb-2">בחר מטופל:</p>
              </div>
              {loadingPatients ? (
                <p className="text-center py-4 text-gray-500">טוען מטופלים...</p>
              ) : patients.length === 0 ? (
                <p className="text-center py-4 text-gray-500">אין מטופלים במערכת</p>
              ) : (
                patients.map(patient => (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-purple-50 transition-all"
                    onClick={() => handlePatientSelect(patient)}
                    data-testid={`select-patient-${patient.id}`}
                  >
                    <div className="p-2 bg-purple-100 rounded-full">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-medium">{patient.name}</span>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPatientSelector(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!duplicatePatient} onOpenChange={() => setDuplicatePatient(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle>מטופל כבר קיים</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              {duplicatePatient} כבר נמצא ברשימת הקניות
            </p>
            <DialogFooter>
              <Button onClick={() => setDuplicatePatient(null)}>
                הבנתי
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                מחיקת רשימה
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">
              האם אתה בטוח שברצונך למחוק את רשימת הקניות של {deleteConfirmation?.name}?
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmation(null)}>
                ביטול
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (deleteConfirmation) {
                    deleteListMutation.mutate(deleteConfirmation.id);
                    setDeleteConfirmation(null);
                  }
                }}
                disabled={deleteListMutation.isPending}
                data-testid="button-confirm-delete"
              >
                מחק
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <RefreshCw className="h-5 w-5" />
                איפוס כל הרשימות
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-600">
                פעולה זו תמחק את כל רשימות הקניות של המטופלים.
                יש להזין סיסמה לאישור.
              </p>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="סיסמה"
                onKeyPress={(e) => e.key === "Enter" && handleReset()}
                data-testid="input-reset-password"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                onClick={handleReset}
                disabled={resetAllMutation.isPending}
                data-testid="button-confirm-reset"
              >
                אפס הכל
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={purchaseConfirmation} onOpenChange={setPurchaseConfirmation}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CreditCard className="h-5 w-5" />
                אישור רכישה
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-600">
                פעולה זו תוריד מהפיקדון את הסכום הנקוב עבור המוצרים המסומנים בלבד.
              </p>
              <p className="text-amber-600 font-medium">
                שים לב: רק רכישות במזומן עם פריטים מסומנים יעובדו!
              </p>
              {getCashPurchasesCount() > 0 ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-green-700 font-medium">
                    {getCashPurchasesCount()} רכישות במזומן יעודכנו
                  </p>
                  <ul className="mt-2 text-sm text-green-600 space-y-2">
                    {sortedShoppingLists
                      .filter(list => list.paymentMethod === "מזומן" && list.totalAmount && parseFloat(list.totalAmount) > 0 && list.checkedItems.length > 0)
                      .map(list => (
                        <li key={list.id} className="border-b border-green-200 pb-1">
                          <div className="font-medium">{list.patientName}: ₪{parseFloat(list.totalAmount || "0").toLocaleString()}</div>
                          <div className="text-xs text-green-500">{getCheckedItemsText(list)}</div>
                        </li>
                      ))
                    }
                  </ul>
                </div>
              ) : (
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-amber-700">אין רכישות במזומן עם סכום ופריטים מסומנים</p>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPurchaseConfirmation(false)}>
                ביטול
              </Button>
              <Button
                className="bg-green-500 hover:bg-green-600"
                onClick={handleCompletePurchase}
                disabled={completePurchaseMutation.isPending || getCashPurchasesCount() === 0}
                data-testid="button-confirm-purchase"
              >
                {completePurchaseMutation.isPending ? "מעבד..." : "אשר רכישה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
