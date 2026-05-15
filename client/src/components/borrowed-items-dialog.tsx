import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface BorrowedItemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  occupant: {
    id: string;
    name: string;
    borrowedItems?: string;
  };
  onUpdate: (updatedItems: string) => void;
}

export function BorrowedItemsDialog({ 
  isOpen, 
  onClose, 
  occupant, 
  onUpdate 
}: BorrowedItemsDialogProps) {
  const { toast } = useToast();
  const [itemsToReturn, setItemsToReturn] = useState<Set<number>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState('');
  
  // Touch/swipe handling for mobile
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Check if it's a swipe left (deltaX < 0) and not a vertical swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // Swipe left - close dialog (go back)
        onClose();
      }
    }
  };
  
  // Parse borrowed items into array
  const borrowedItems = occupant.borrowedItems || '';
  const itemsList = borrowedItems
    .split('\n')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  const toggleItemReturn = (index: number) => {
    const newItemsToReturn = new Set(itemsToReturn);
    if (newItemsToReturn.has(index)) {
      newItemsToReturn.delete(index);
    } else {
      newItemsToReturn.add(index);
    }
    setItemsToReturn(newItemsToReturn);
  };

  const handleReturnItems = async () => {
    if (itemsToReturn.size === 0) {
      toast({
        title: "לא נבחרו פריטים",
        description: "יש לבחור לפחות פריט אחד להחזרה",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create updated list without returned items
      const remainingItems = itemsList
        .filter((_, index) => !itemsToReturn.has(index))
        .join('\n');
      const updatedItemsString = remainingItems.trim();
      
      // Update the occupant with new borrowed items list
      await onUpdate(updatedItemsString);
      
      toast({
        title: "פריטים הוחזרו בהצלחה",
        description: `${itemsToReturn.size} פריטים סומנו כהוחזרו`
      });
      
      // Reset selection but keep dialog open
      setItemsToReturn(new Set());
    } catch (error) {
      toast({
        title: "שגיאה בהחזרת פריטים",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    setItemsToReturn(new Set());
    setShowAddForm(false);
    setNewItem('');
    onClose();
  };

  const handleAddItem = async () => {
    if (!newItem.trim()) {
      toast({
        title: "שדה ריק",
        description: "יש להזין שם של פריט להוספה",
        variant: "destructive"
      });
      return;
    }

    try {
      const currentItems = borrowedItems.trim();
      const updatedItems = currentItems 
        ? `${currentItems}\n${newItem.trim()}`
        : newItem.trim();
      
      await onUpdate(updatedItems);
      
      toast({
        title: "פריט נוסף בהצלחה",
        description: `"${newItem.trim()}" נוסף לרשימת החפצים המושאלים`
      });
      
      setNewItem('');
      setShowAddForm(false);
    } catch (error) {
      toast({
        title: "שגיאה בהוספת פריט",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive"
      });
    }
  };

  if (itemsList.length === 0 && !showAddForm) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="sm:max-w-md" 
          dir="rtl"
          ref={dialogRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogHeader>
            <DialogTitle className="text-right">
              <div>חפצים מושאלים - {occupant.name}</div>
              <div className="text-xs text-gray-500 font-normal mt-1 md:hidden">החלק שמאלה לחזור</div>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">אין חפצים מושאלים כרגע</p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-first-item"
            >
              <Plus className="w-4 h-4 ml-1" />
              הוסף פריט חדש
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Handle case when no items but add form is open
  if (itemsList.length === 0 && showAddForm) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="sm:max-w-md" 
          dir="rtl"
          ref={dialogRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogHeader>
            <DialogTitle className="text-right">
              <div>חפצים מושאלים - {occupant.name}</div>
              <div className="text-xs text-gray-500 font-normal mt-1 md:hidden">החלק שמאלה לחזור</div>
            </DialogTitle>
          </DialogHeader>
          
          {/* Add Item Form */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <div className="space-y-3">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="שם הפריט החדש (לדוגמה: חלוק, מגבת, כרית)"
                className="text-right"
                dir="rtl"
                data-testid="input-new-item-first"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  } else if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewItem('');
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddItem}
                  disabled={!newItem.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-confirm-add-first-item"
                >
                  הוסף פריט
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem('');
                  }}
                  className="flex-1"
                  data-testid="button-cancel-add-first-item"
                >
                  ביטול
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">הוסף פריט ראשון לרשימת החפצים המושאלים</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md" 
        dir="rtl"
        ref={dialogRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <DialogHeader>
          <DialogTitle className="text-right flex items-center justify-between">
            <div>
              <div>חפצים מושאלים - {occupant.name}</div>
              <div className="text-xs text-gray-500 font-normal mt-1 md:hidden">החלק שמאלה לחזור</div>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-800"
              data-testid="button-add-item-toggle"
            >
              <Plus className="w-4 h-4 ml-1" />
              הוסף פריט
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Add Item Form */}
        {showAddForm && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <div className="space-y-3">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="שם הפריט החדש (לדוגמה: חלוק, מגבת, כרית)"
                className="text-right"
                dir="rtl"
                data-testid="input-new-item-existing"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  } else if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewItem('');
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddItem}
                  disabled={!newItem.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-confirm-add-existing-item"
                >
                  הוסף פריט
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem('');
                  }}
                  className="flex-1"
                  data-testid="button-cancel-add-existing-item"
                >
                  ביטול
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {itemsList.map((item, index) => (
            <div 
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                itemsToReturn.has(index) 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleItemReturn(index)}
                  className={`w-8 h-8 p-0 ${
                    itemsToReturn.has(index)
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white'
                  }`}
                  data-testid={`button-toggle-return-${index}`}
                >
                  {itemsToReturn.has(index) ? (
                    <Check className="w-4 h-4" />
                  ) : null}
                </Button>
                {itemsToReturn.has(index) && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                    להחזרה
                  </Badge>
                )}
              </div>
              <span className="text-sm font-medium text-right" data-testid={`text-item-name-${index}`}>{item}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            onClick={handleReturnItems}
            disabled={itemsToReturn.size === 0}
            className="flex-1 bg-green-600 hover:bg-green-700"
            data-testid="button-return-items"
          >
            החזר פריטים ({itemsToReturn.size})
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
            data-testid="button-cancel-dialog"
          >
            <X className="w-4 h-4 ml-1" />
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}