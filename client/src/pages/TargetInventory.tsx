import { useState, useEffect } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Package, Edit, ShoppingCart, FolderPlus, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectTargetInventory, SelectCustomCategory } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CATEGORIES = [
  { value: 'אוכל ושתייה', icon: '🍎' },
  { value: 'מוצרי נקיון', icon: '🧽' },
  { value: 'מוצרים נלווים', icon: '' },
  { value: 'מוצרים רפואיים', icon: '💉' },
];

export default function TargetInventory() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [productNameHebrew, setProductNameHebrew] = useState("");
  const [productName, setProductName] = useState("");
  const [productNameOther, setProductNameOther] = useState("");
  const [category, setCategory] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState("");
  const [editingItem, setEditingItem] = useState<SelectTargetInventory | null>(null);
  const [editOtherLanguage, setEditOtherLanguage] = useState<string>("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showEnglishField, setShowEnglishField] = useState(false);
  const [showOtherField, setShowOtherField] = useState(false);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);
  const [showRenameCategoryDialog, setShowRenameCategoryDialog] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameCategoryInput, setRenameCategoryInput] = useState("");

  // Fetch custom categories from database (shared across all users)
  const { data: customCategoriesData = [] } = useQuery<SelectCustomCategory[]>({
    queryKey: ["/api/inventory-categories"],
  });

  // Transform custom categories from DB format to UI format
  const customCategories = customCategoriesData.map(c => ({ value: c.name, icon: c.icon, id: c.id }));

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.map(c => ({ value: c.value, icon: c.icon }))];

  // Create custom category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string }) => {
      return apiRequest("POST", "/api/inventory-categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-categories"] });
    },
  });

  // Delete custom category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/inventory-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-categories"] });
      toast({
        title: "הצלחה",
        description: "הקטגוריה נמחקה",
      });
    },
    onError: () => {
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את הקטגוריה",
        variant: "destructive",
      });
    },
  });

  // Update custom category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/inventory-categories/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-categories"] });
    },
  });

  const handleDeleteCategory = (categoryValue: string) => {
    const categoryItems = targetInventory.filter(item => item.category === categoryValue);
    if (categoryItems.length > 0) {
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק קטגוריה שיש בה מוצרים. יש להסיר תחילה את כל המוצרים.",
        variant: "destructive",
      });
      return;
    }
    
    const customCat = customCategories.find(c => c.value === categoryValue);
    if (customCat) {
      deleteCategoryMutation.mutate(customCat.id);
    }
  };

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldCategory, newCategory, categoryId }: { oldCategory: string; newCategory: string; categoryId?: string }) => {
      // First update all items with this category
      await apiRequest("PATCH", "/api/target-inventory/rename-category", { oldCategory, newCategory });
      // Then update the custom category name in DB if it's a custom category
      if (categoryId) {
        await apiRequest("PATCH", `/api/inventory-categories/${categoryId}`, { name: newCategory });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-categories"] });
      
      setShowRenameCategoryDialog(false);
      setRenamingCategory(null);
      setRenamingCategoryId(null);
      setRenameCategoryInput("");
      toast({
        title: "הצלחה",
        description: "שם הקטגוריה שונה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן לשנות את שם הקטגוריה",
        variant: "destructive",
      });
    },
  });

  const handleRenameCategory = () => {
    if (!renamingCategory || !renameCategoryInput.trim()) return;
    if (renameCategoryInput.trim() === renamingCategory) {
      setShowRenameCategoryDialog(false);
      return;
    }
    renameCategoryMutation.mutate({ 
      oldCategory: renamingCategory, 
      newCategory: renameCategoryInput.trim(),
      categoryId: renamingCategoryId || undefined
    });
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/inventory/status", {
          credentials: "same-origin"
        });
        const data = await response.json();
        
        if (!data.authenticated || data.mode !== "full") {
          setLocation("/");
          return;
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setLocation("/");
      }
    };

    checkAuth();
  }, [setLocation]);

  const { data: targetInventory = [], isLoading } = useQuery<SelectTargetInventory[]>({
    queryKey: ["/api/target-inventory"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { productName: string; productNameHebrew: string | null; category: string; targetQuantity: number }) => {
      return apiRequest("POST", "/api/target-inventory", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-inventory"] });
      setProductNameHebrew("");
      setProductName("");
      setProductNameOther("");
      setCategory('');
      setTargetQuantity("");
      setShowEnglishField(false);
      setShowOtherField(false);
      toast({
        title: "הצלחה",
        description: "המוצר נוסף למלאי יעד",
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; productName: string; productNameHebrew: string | null; category: string; targetQuantity: number }) => {
      return apiRequest("PATCH", `/api/target-inventory/${data.id}`, {
        productName: data.productName,
        productNameHebrew: data.productNameHebrew,
        category: data.category,
        targetQuantity: data.targetQuantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-inventory"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "הצלחה",
        description: "המוצר עודכן",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן לעדכן מוצר",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/target-inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-inventory"] });
      toast({
        title: "הצלחה",
        description: "המוצר הוסר ממלאי יעד",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן להסיר מוצר",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if ((!productNameHebrew && !productName && !productNameOther) || !targetQuantity || !category) {
      toast({
        title: "שגיאה",
        description: "יש למלא לפחות שפה אחת, קטגוריה וכמות יעד",
        variant: "destructive",
      });
      return;
    }

    const finalProductName = productName || productNameOther || productNameHebrew || "";
    const finalProductNameHebrew = productNameHebrew || null;
    
    addMutation.mutate({
      productName: finalProductName,
      productNameHebrew: finalProductNameHebrew,
      category,
      targetQuantity: parseInt(targetQuantity),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleEdit = (item: SelectTargetInventory) => {
    setEditingItem(item);
    setEditOtherLanguage("");
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingItem) return;

    updateMutation.mutate({
      id: editingItem.id,
      productName: editingItem.productName,
      productNameHebrew: editingItem.productNameHebrew,
      category: editingItem.category,
      targetQuantity: editingItem.targetQuantity,
    });
  };

  return (
    <div className="min-h-screen bg-sky-100 dark:bg-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">
              מלאי יעד
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/shopping-list")}
              data-testid="button-shopping-list"
            >
              <ShoppingCart className="h-4 w-4 ml-2" />
              רשימת קניות
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/main")}
              data-testid="button-menu"
            >
              תפריט
            </Button>
          </div>
        </div>

        <Card className="mb-4" data-testid="card-add-item">
          <CardHeader className="py-2">
            <CardTitle className="text-base">הוסף מוצר למלאי יעד</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                placeholder="שם המוצר"
                value={productNameHebrew}
                onChange={(e) => setProductNameHebrew(e.target.value)}
                onKeyPress={handleKeyPress}
                data-testid="input-product-name-hebrew"
                className="h-8 text-sm"
                dir="rtl"
              />
              <Select 
                value={category} 
                onValueChange={(value: any) => setCategory(value)}
                open={categorySelectOpen}
                onOpenChange={setCategorySelectOpen}
              >
                <SelectTrigger data-testid="select-category" className="h-8 text-sm" dir="rtl">
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon && `${cat.icon} `}{cat.value}
                    </SelectItem>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCategorySelectOpen(false);
                        setShowNewCategoryDialog(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
                      data-testid="button-add-category"
                    >
                      <FolderPlus className="h-3 w-3" />
                      הוסף קטגוריה חדשה
                    </button>
                  </div>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="כמות יעד"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                onKeyPress={handleKeyPress}
                data-testid="input-target-quantity"
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

        {targetInventory.length === 0 && !isLoading ? (
          <Card data-testid="card-empty-state">
            <CardContent className="text-center text-slate-500 dark:text-slate-400 py-12">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>אין מוצרים במלאי יעד</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {allCategories.map(({ value: category, icon }) => {
              const items = targetInventory.filter(item => item.category === category);
              return (
                <Card key={category} data-testid={`card-category-${category}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {icon && <span>{icon}</span>}
                        <span>{category}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">({items.length})</span>
                      </div>
                      <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`button-edit-category-${category}`}>
                              <Settings className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="end">
                            {items.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  const customCat = customCategories.find(c => c.value === category);
                                  setRenamingCategory(category);
                                  setRenamingCategoryId(customCat?.id || null);
                                  setRenameCategoryInput(category);
                                  setShowRenameCategoryDialog(true);
                                }}
                                data-testid={`button-rename-category-${category}`}
                              >
                                <Edit className="h-3.5 w-3.5 ml-1" />
                                שנה שם קטגוריה
                              </Button>
                            ) : customCategories.some(c => c.value === category) ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="w-full"
                                onClick={() => handleDeleteCategory(category)}
                                data-testid={`button-delete-category-${category}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 ml-1" />
                                מחק קטגוריה
                              </Button>
                            ) : (
                              <p className="text-sm text-slate-500 text-center py-2">אין אפשרויות זמינות</p>
                            )}
                          </PopoverContent>
                        </Popover>
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
                            className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            data-testid={`item-inventory-${item.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                {item.productNameHebrew || item.productName}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                יעד: {item.targetQuantity}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                data-testid={`button-edit-${item.id}`}
                                className="h-7 w-7 p-0"
                              >
                                <Edit className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${item.id}`}
                                className="h-7 w-7 p-0"
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
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-item">
          <DialogHeader>
            <DialogTitle>ערוך מוצר</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              {editingItem.productNameHebrew !== null && (
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-sm font-medium">שם המוצר (עברית)</label>
                    <Input
                      value={editingItem.productNameHebrew || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, productNameHebrew: e.target.value || null })}
                      data-testid="input-edit-product-name-hebrew"
                      dir="rtl"
                    />
                  </div>
                  {!editingItem.productName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingItem({ ...editingItem, productName: "" })}
                      className="mt-6"
                      data-testid="button-add-english-edit"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {editingItem.productName !== null && editingItem.productName !== undefined && (
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-sm font-medium">שם המוצר (אנגלית)</label>
                    <Input
                      value={editingItem.productName}
                      onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                      data-testid="input-edit-product-name"
                      dir="rtl"
                    />
                  </div>
                  {!editOtherLanguage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOtherLanguage(" ")}
                      className="mt-6"
                      data-testid="button-add-other-edit"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {editOtherLanguage && (
                <div>
                  <label className="text-sm font-medium">שם המוצר (שפה נוספת)</label>
                  <Input
                    value={editOtherLanguage}
                    onChange={(e) => setEditOtherLanguage(e.target.value)}
                    data-testid="input-edit-product-name-other"
                    dir="rtl"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">קטגוריה</label>
                <Select 
                  value={editingItem.category} 
                  onValueChange={(value: any) => setEditingItem({ ...editingItem, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-category" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon && `${cat.icon} `}{cat.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">כמות יעד</label>
                <Input
                  type="number"
                  value={editingItem.targetQuantity}
                  onChange={(e) => setEditingItem({ ...editingItem, targetQuantity: parseInt(e.target.value) || 0 })}
                  data-testid="input-edit-target-quantity"
                  dir="rtl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              ביטול
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-save-edit">
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              הוספת קטגוריה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">שם הקטגוריה *</label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="שם הקטגוריה"
                data-testid="input-new-category-name"
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">אייקון (אופציונלי)</label>
              <Input
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="🛒"
                data-testid="input-new-category-icon"
                className="text-center"
              />
              <p className="text-xs text-gray-500 mt-1">הוסף אמוג'י כמו: 🍎 🧽 💊</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewCategoryDialog(false);
                setNewCategoryName("");
                setNewCategoryIcon("");
              }}
            >
              ביטול
            </Button>
            <Button
              onClick={() => {
                if (!newCategoryName.trim()) {
                  toast({
                    title: "שגיאה",
                    description: "יש להזין שם קטגוריה",
                    variant: "destructive",
                  });
                  return;
                }
                const exists = allCategories.some(c => c.value === newCategoryName.trim());
                if (exists) {
                  toast({
                    title: "שגיאה",
                    description: "קטגוריה זו כבר קיימת",
                    variant: "destructive",
                  });
                  return;
                }
                createCategoryMutation.mutate(
                  { name: newCategoryName.trim(), icon: newCategoryIcon.trim() },
                  {
                    onSuccess: () => {
                      setCategory(newCategoryName.trim());
                      setShowNewCategoryDialog(false);
                      setNewCategoryName("");
                      setNewCategoryIcon("");
                      toast({
                        title: "הצלחה",
                        description: "הקטגוריה נוספה בהצלחה",
                      });
                    },
                    onError: () => {
                      toast({
                        title: "שגיאה",
                        description: "לא ניתן להוסיף את הקטגוריה",
                        variant: "destructive",
                      });
                    }
                  }
                );
              }}
              data-testid="button-save-category"
            >
              הוסף קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameCategoryDialog} onOpenChange={setShowRenameCategoryDialog}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-rename-category">
          <DialogHeader>
            <DialogTitle>שינוי שם קטגוריה</DialogTitle>
            <DialogDescription>
              הזן שם חדש לקטגוריה "{renamingCategory}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameCategoryInput}
              onChange={(e) => setRenameCategoryInput(e.target.value)}
              placeholder="שם חדש לקטגוריה"
              data-testid="input-rename-category"
              dir="rtl"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRenameCategoryDialog(false);
                setRenamingCategory(null);
                setRenamingCategoryId(null);
                setRenameCategoryInput("");
              }}
              data-testid="button-cancel-rename"
            >
              ביטול
            </Button>
            <Button 
              onClick={handleRenameCategory}
              disabled={renameCategoryMutation.isPending || !renameCategoryInput.trim()}
              data-testid="button-confirm-rename"
            >
              שנה שם
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
