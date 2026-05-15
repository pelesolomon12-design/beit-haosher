import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Package, AlertTriangle, Edit } from "lucide-react";
import { SelectShoppingList, SelectTargetInventory, SelectCustomCategory } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

const DEFAULT_CATEGORIES = [
  { value: 'אוכל ושתייה', icon: '🍎' },
  { value: 'מוצרי נקיון', icon: '🧽' },
  { value: 'מוצרים נלווים', icon: '' },
  { value: 'מוצרים רפואיים', icon: '💉' },
];

export default function ShoppingList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [productName, setProductName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [inventoryMode, setInventoryMode] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<string>("");
  const [pendingCurrentQty, setPendingCurrentQty] = useState<number>(0);
  const [neededQuantityInput, setNeededQuantityInput] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SelectShoppingList | null>(null);
  const [showSufficientQuantityDialog, setShowSufficientQuantityDialog] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Fetch custom categories from database (shared across all users)
  const { data: customCategoriesData = [] } = useQuery<SelectCustomCategory[]>({
    queryKey: ["/api/inventory-categories"],
  });

  // Transform custom categories from DB format to UI format
  const customCategories = customCategoriesData.map(c => ({ value: c.name, icon: c.icon }));

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/inventory/status", {
          credentials: "same-origin"
        });
        const data = await response.json();
        
        if (data.authenticated) {
          setInventoryMode(data.mode);
        } else {
          setInventoryMode(null);
          setLocation("/");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setInventoryMode(null);
        setLocation("/");
      }
    };

    checkAuth();
  }, [setLocation]);

  const { data: shoppingList = [], isLoading } = useQuery<SelectShoppingList[]>({
    queryKey: ["/api/shopping-list"],
  });

  const { data: targetInventory = [] } = useQuery<SelectTargetInventory[]>({
    queryKey: ["/api/target-inventory"],
    enabled: inventoryMode !== null,
  });

  const autocompleteSuggestions = useMemo(() => {
    if (!productName.trim() || productName.length < 1) return [];
    const searchTerm = productName.trim().toLowerCase();
    return targetInventory.filter(item => {
      const hebrewName = (item.productNameHebrew || '').toLowerCase();
      const englishName = (item.productName || '').toLowerCase();
      return hebrewName.startsWith(searchTerm) || englishName.startsWith(searchTerm);
    }).slice(0, 10);
  }, [productName, targetInventory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: SelectTargetInventory) => {
    setProductName(item.productNameHebrew || item.productName || "");
    setShowAutocomplete(false);
  };

  const addMutation = useMutation({
    mutationFn: async (data: { 
      productName: string; 
      productNameHebrew: string | null;
      category?: string | null;
      currentQuantity: number;
      targetQuantity: number | null;
      neededQuantity: number | null;
      isFromTargetList: boolean;
    }) => {
      return apiRequest("POST", "/api/shopping-list", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      setProductName("");
      setCurrentQuantity("");
      toast({
        title: "הצלחה",
        description: "המוצר נוסף לרשימה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן להוסיף מוצר",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/shopping-list/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן להסיר מוצר",
        variant: "destructive",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/shopping-list");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      toast({
        title: "הצלחה",
        description: "הרשימה נוקתה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן לנקות רשימה",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { 
      id: string;
      productName: string; 
      productNameHebrew: string | null;
      category?: string | null;
      currentQuantity: number;
      targetQuantity: number | null;
      neededQuantity: number | null;
      isFromTargetList: boolean;
    }) => {
      return apiRequest("PATCH", `/api/shopping-list/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
    },
    onError: (error: any, variables) => {
      console.error("Failed to reconcile item:", variables.id, error);
      toast({
        title: "שגיאה בעדכון",
        description: error.message || "לא ניתן לעדכן את פרטי המוצר",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (inventoryMode !== "full" || !shoppingList.length || !targetInventory.length) {
      return;
    }

    const itemsToUpdate = shoppingList.filter(item => {
      const itemNameLower = item.productName?.trim().toLowerCase() || '';
      const itemNameHeLower = item.productNameHebrew?.trim().toLowerCase() || '';

      const targetItem = targetInventory.find(target => {
        const targetNameEn = target.productName?.trim().toLowerCase() || '';
        const targetNameHe = target.productNameHebrew?.trim().toLowerCase() || '';
        return (itemNameLower && (targetNameEn === itemNameLower || targetNameHe === itemNameLower)) ||
               (itemNameHeLower && (targetNameEn === itemNameHeLower || targetNameHe === itemNameHeLower));
      });

      if (!targetItem) return false;

      // Check if item needs update
      const hasChanges = 
        !item.isFromTargetList || 
        item.category !== targetItem.category || 
        item.targetQuantity !== targetItem.targetQuantity ||
        item.productName !== targetItem.productName ||
        item.productNameHebrew !== targetItem.productNameHebrew;

      return hasChanges;
    });

    if (itemsToUpdate.length > 0) {
      itemsToUpdate.forEach(item => {
        const itemNameLower = item.productName?.trim().toLowerCase() || '';
        const itemNameHeLower = item.productNameHebrew?.trim().toLowerCase() || '';

        const targetItem = targetInventory.find(target => {
          const targetNameEn = target.productName?.trim().toLowerCase() || '';
          const targetNameHe = target.productNameHebrew?.trim().toLowerCase() || '';
          return (itemNameLower && (targetNameEn === itemNameLower || targetNameHe === itemNameLower)) ||
                 (itemNameHeLower && (targetNameEn === itemNameHeLower || targetNameHe === itemNameHeLower));
        });

        if (targetItem) {
          const neededQty = Math.max(0, targetItem.targetQuantity - item.currentQuantity);
          updateMutation.mutate({
            id: item.id,
            productName: targetItem.productName,
            productNameHebrew: targetItem.productNameHebrew,
            category: targetItem.category,
            currentQuantity: item.currentQuantity,
            targetQuantity: targetItem.targetQuantity,
            neededQuantity: neededQty,
            isFromTargetList: true,
          });
        }
      });
    }
  }, [shoppingList, targetInventory, inventoryMode]);

  const handleAdd = () => {
    if (!productName || !currentQuantity) {
      toast({
        title: "שגיאה",
        description: "יש למלא את כל השדות",
        variant: "destructive",
      });
      return;
    }

    const currentQty = parseInt(currentQuantity);
    const trimmedProductName = productName.trim().toLowerCase();
    
    // Check if product already exists in shopping list
    const existingItem = shoppingList.find(item => {
      const itemNameEn = item.productName?.trim().toLowerCase() || '';
      const itemNameHe = item.productNameHebrew?.trim().toLowerCase() || '';
      return itemNameEn === trimmedProductName || itemNameHe === trimmedProductName;
    });

    if (existingItem) {
      toast({
        title: "שגיאה",
        description: "מוצר זה כבר קיים ברשימת הקניות",
        variant: "destructive",
      });
      return;
    }
    
    // Check if product exists in target inventory
    const targetItem = targetInventory.find(item => {
      const itemNameEn = item.productName?.trim().toLowerCase() || '';
      const itemNameHe = item.productNameHebrew?.trim().toLowerCase() || '';
      return itemNameEn === trimmedProductName || itemNameHe === trimmedProductName;
    });

    if (targetItem) {
      // Product found in target inventory
      const neededQty = Math.max(0, targetItem.targetQuantity - currentQty);
      
      addMutation.mutate({
        productName: targetItem.productName,
        productNameHebrew: targetItem.productNameHebrew,
        category: targetItem.category,
        currentQuantity: currentQty,
        targetQuantity: targetItem.targetQuantity,
        neededQuantity: neededQty,
        isFromTargetList: true,
      });
    } else {
      // Product not in target inventory - ask for quantity
      setPendingProduct(productName);
      setPendingCurrentQty(currentQty);
      setShowQuantityDialog(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleClearList = () => {
    if (clearPassword !== "2026") {
      toast({
        title: "שגיאה",
        description: "סיסמה שגויה",
        variant: "destructive",
      });
      return;
    }

    clearAllMutation.mutate();
    setShowClearDialog(false);
    setClearPassword("");
  };

  const handleDialogKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClearList();
    }
  };

  const handleConfirmQuantity = () => {
    if (!neededQuantityInput) {
      toast({
        title: "שגיאה",
        description: "יש להזין כמות",
        variant: "destructive",
      });
      return;
    }

    const neededQty = parseInt(neededQuantityInput);
    
    addMutation.mutate({
      productName: pendingProduct,
      productNameHebrew: pendingProduct,
      category: 'לא ברשימת היעד',
      currentQuantity: pendingCurrentQty,
      targetQuantity: null,
      neededQuantity: neededQty,
      isFromTargetList: false,
    });

    setShowQuantityDialog(false);
    setNeededQuantityInput("");
    setPendingProduct("");
    setPendingCurrentQty(0);
  };

  const handleQuantityKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirmQuantity();
    }
  };

  const handleEditUpdate = () => {
    if (!editingItem) return;

    // Check if current quantity is enough (>= target quantity)
    if (editingItem.targetQuantity && editingItem.currentQuantity >= editingItem.targetQuantity) {
      deleteMutation.mutate(editingItem.id, {
        onSuccess: () => {
          setShowSufficientQuantityDialog(true);
        }
      });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      return;
    }

    const neededQty = editingItem.targetQuantity 
      ? Math.max(0, editingItem.targetQuantity - editingItem.currentQuantity)
      : (editingItem.neededQuantity || 0);

    updateMutation.mutate({
      id: editingItem.id,
      productName: editingItem.productName,
      productNameHebrew: editingItem.productNameHebrew,
      category: editingItem.category,
      currentQuantity: editingItem.currentQuantity,
      targetQuantity: editingItem.targetQuantity,
      neededQuantity: neededQty,
      isFromTargetList: editingItem.isFromTargetList,
    });

    setIsEditDialogOpen(false);
    setEditingItem(null);
    
    toast({
      title: "הצלחה",
      description: "המוצר עודכן בהצלחה",
    });
  };

  return (
    <div className="min-h-screen bg-sky-100 dark:bg-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">
              רשימת קניות
            </h1>
          </div>
          {inventoryMode === "full" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setLocation("/target-inventory")}
                data-testid="button-inventory"
              >
                מלאי יעד
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/main")}
                data-testid="button-menu"
              >
                תפריט
              </Button>
            </div>
          )}
          {inventoryMode === "shortages" && (
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-back-to-login"
            >
              חזרה להתחברות
            </Button>
          )}
        </div>

        <Card className="mb-4" data-testid="card-add-item">
          <CardHeader className="py-2">
            <CardTitle className="text-base">הוסף מוצר לקניה</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="relative">
                <Input
                  ref={inputRef}
                  placeholder="שם המוצר"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setShowAutocomplete(e.target.value.length > 0);
                  }}
                  onFocus={() => productName.length > 0 && setShowAutocomplete(true)}
                  onKeyPress={handleKeyPress}
                  data-testid="input-product-name"
                  className="h-8 text-sm"
                  dir="rtl"
                  autoComplete="off"
                />
                {showAutocomplete && autocompleteSuggestions.length > 0 && (
                  <div 
                    ref={autocompleteRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-y-auto"
                    dir="rtl"
                  >
                    {autocompleteSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b last:border-b-0"
                        onClick={() => handleSelectSuggestion(item)}
                        data-testid={`autocomplete-item-${item.id}`}
                      >
                        <div className="font-medium">{item.productNameHebrew || item.productName}</div>
                        {item.productNameHebrew && item.productName && (
                          <div className="text-xs text-slate-500">{item.productName}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                type="number"
                placeholder="כמות קיימת"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                onKeyPress={handleKeyPress}
                data-testid="input-current-quantity"
                className="h-8 text-sm"
                dir="rtl"
              />
              <Button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                data-testid="button-add-item"
                className="h-8 text-sm"
              >
                <Plus className="h-3.5 w-3.5 ml-1.5" />
                הוסף
              </Button>
            </div>
          </CardContent>
        </Card>

        {shoppingList.length > 0 && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ...allCategories.map(cat => ({ category: cat.value, icon: cat.icon, label: undefined })),
              { category: 'לא ברשימת היעד', icon: '⚠️', label: 'לא ברשימת היעד' },
              { category: null, icon: '', label: 'ללא קטגוריה' }
            ].map(({ category, icon, label }) => {
              const items = shoppingList.filter(item => item.category === category);
              if (items.length === 0) return null;
              
              return (
                <Card key={category || 'uncategorized'} data-testid={`card-category-${category || 'uncategorized'}`} className="border-primary/20">
                  <CardHeader className="pb-2 bg-gradient-to-l from-primary/5 to-transparent">
                    <CardTitle className="text-base flex items-center gap-2">
                      {icon && <span>{icon}</span>}
                      <span>{label || category}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">({items.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">אין מוצרים</p>
                    ) : (
                      <div className="space-y-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-start justify-between p-1.5 rounded-lg ${
                              item.isFromTargetList
                                ? "bg-slate-50 dark:bg-slate-800"
                                : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                            }`}
                            data-testid={`item-shopping-${item.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold text-sm truncate ${
                                item.isFromTargetList 
                                  ? "text-slate-900 dark:text-white" 
                                  : "text-red-900 dark:text-red-100"
                              }`}>
                                {item.productNameHebrew || item.productName}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs flex-nowrap">
                                <span className={`font-bold text-base whitespace-nowrap ${
                                  item.isFromTargetList ? "text-primary" : "text-red-600 dark:text-red-400"
                                }`}>
                                  לקנות: {item.neededQuantity || 0}
                                </span>
                                {item.category !== null && (
                                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    קיים: {item.currentQuantity}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsEditDialogOpen(true);
                                }}
                                data-testid={`button-edit-${item.id}`}
                                className="hover:bg-blue-50 dark:hover:bg-blue-950/20 h-7 w-7 p-0"
                              >
                                <Edit className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(item.id, {
                                  onSuccess: () => {
                                    toast({
                                      title: "הצלחה",
                                      description: "המוצר הוסר מהרשימה",
                                    });
                                  }
                                })}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${item.id}`}
                                className="hover:bg-red-50 dark:hover:bg-red-950/20 h-7 w-7 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {shoppingList.length === 0 && !isLoading && (
          <Card data-testid="card-empty-state">
            <CardContent className="py-12">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>אין פריטים ברשימת הקניות</p>
              </div>
            </CardContent>
          </Card>
        )}

        {shoppingList.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              data-testid="button-clear-all"
            >
              נקה את כל הרשימה
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-quantity">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              מוצר לא ברשימת היעד
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              המוצר "{pendingProduct}" לא נמצא ברשימת היעד.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              כמה יחידות ברצונך לקנות?
            </label>
            <Input
              type="number"
              value={neededQuantityInput}
              onChange={(e) => setNeededQuantityInput(e.target.value)}
              onKeyPress={handleQuantityKeyPress}
              placeholder="הזן כמות"
              data-testid="input-needed-quantity"
              className="text-center text-2xl font-bold"
              autoFocus
              dir="rtl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowQuantityDialog(false);
                setNeededQuantityInput("");
                setPendingProduct("");
                setPendingCurrentQty(0);
              }}
              data-testid="button-cancel-quantity"
            >
              ביטול
            </Button>
            <Button
              onClick={handleConfirmQuantity}
              disabled={!neededQuantityInput || addMutation.isPending}
              data-testid="button-confirm-quantity"
            >
              הוסף לרשימה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-clear-list">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              אישור מחיקת רשימה
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              פעולה זו תמחק את כל הפריטים ברשימת הקניות ולא ניתן לשחזרם.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              אנא הזן סיסמה לאישור המחיקה:
            </label>
            <Input
              type="password"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              onKeyPress={handleDialogKeyPress}
              placeholder="הזן סיסמה"
              data-testid="input-clear-password"
              className="text-center text-lg tracking-widest"
              autoFocus
              dir="rtl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowClearDialog(false);
                setClearPassword("");
              }}
              data-testid="button-cancel-clear"
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearList}
              disabled={!clearPassword || clearAllMutation.isPending}
              data-testid="button-confirm-clear"
            >
              מחק את הרשימה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-item">
          <DialogHeader>
            <DialogTitle>ערוך מוצר</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">שם המוצר</label>
                <Input
                  value={editingItem.productNameHebrew || editingItem.productName}
                  disabled
                  data-testid="input-edit-product-name"
                  className="bg-slate-100 dark:bg-slate-800"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">כמות קיימת</label>
                <Input
                  type="number"
                  value={editingItem.currentQuantity}
                  onChange={(e) => setEditingItem({ 
                    ...editingItem, 
                    currentQuantity: parseInt(e.target.value) || 0 
                  })}
                  data-testid="input-edit-current-quantity"
                  dir="rtl"
                />
              </div>
              {!editingItem.isFromTargetList && (
                <div>
                  <label className="text-sm font-medium">כמות לקנייה</label>
                  <Input
                    type="number"
                    value={editingItem.neededQuantity || 0}
                    onChange={(e) => setEditingItem({ 
                      ...editingItem, 
                      neededQuantity: parseInt(e.target.value) || 0 
                    })}
                    data-testid="input-edit-needed-quantity"
                    dir="rtl"
                  />
                </div>
              )}
              {editingItem.isFromTargetList && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">כמות יעד:</span>
                    <span className="text-sm font-bold">{editingItem.targetQuantity}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium">לקנות:</span>
                    <span className="text-lg font-bold text-primary">
                      {Math.max(0, (editingItem.targetQuantity || 0) - editingItem.currentQuantity)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingItem(null);
              }} 
              data-testid="button-cancel-edit"
            >
              ביטול
            </Button>
            <Button 
              onClick={handleEditUpdate} 
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSufficientQuantityDialog} onOpenChange={setShowSufficientQuantityDialog}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-sufficient-quantity">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">✓</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-lg font-medium">יש כמות מספיקה מהמוצר</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button 
              onClick={() => setShowSufficientQuantityDialog(false)}
              data-testid="button-close-sufficient"
              className="w-full sm:w-auto"
            >
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
