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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Plus, 
  Minus, 
  ArrowLeft, 
  Calendar,
  CreditCard,
  Wallet,
  Filter,
  Edit,
  Trash2,
  Settings,
  FileText
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId?: string;
  categoryLabel: string;
  paymentMethod: string;
  description: string;
  status: 'completed' | 'pending';
  creditCardId?: string;
  creditCardName?: string;
  checkChargeDate?: string;
  year: number;
  month: number;
  recurringGroupId?: string | null;
  isRecurring?: boolean;
}

interface CashFlowSettings {
  activeYear: number;
  categories: {
    income: string[];
    expense: string[];
  };
  creditCards: { id: string; name: string; lastFour?: string; chargeDay: number; issuer?: string }[];
}

interface Balances {
  openingBalance: number;
  bankBalance: number;
  expectedBalance: number;
}

type ViewMode = 'main' | 'dashboard' | 'add-income' | 'add-expense' | 'manage-cards' | 'manage-categories';

interface CreditCardForm {
  id?: string;
  name: string;
  lastFour: string;
  chargeDay: string;
  issuer: string;
}

export default function CashFlow() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [balanceAtDate, setBalanceAtDate] = useState<number | null>(null);
  const [creditCardForm, setCreditCardForm] = useState<CreditCardForm>({
    name: "",
    lastFour: "",
    chargeDay: "10",
    issuer: ""
  });
  const [editingCreditCard, setEditingCreditCard] = useState<string | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDayModal, setSelectedDayModal] = useState<{ date: string; transactions: Transaction[]; balance: number } | null>(null);

  const [incomeForm, setIncomeForm] = useState({
    amount: "",
    description: "",
    category: "",
    paymentMethod: "immediate",
    scheduledDate: "",
    isRecurring: false,
    frequency: "monthly",
    numPayments: "1"
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    description: "",
    category: "",
    paymentMethod: "immediate",
    creditCard: "",
    checkChargeDate: "",
    isRecurring: false,
    frequency: "monthly",
    chargeDay: "1"
  });

  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/cashflow/status", { credentials: "same-origin" });
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await apiRequest("POST", "/api/cashflow/auth", { password });
      if (response.ok) {
        setIsAuthenticated(true);
        setPassword("");
        toast({ title: "התחברות הצליחה" });
      }
    } catch (error: any) {
      toast({ title: "שגיאה", description: "סיסמה שגויה", variant: "destructive" });
    }
  };

  const { data: settings } = useQuery<CashFlowSettings>({
    queryKey: ["/api/cashflow/settings"],
    enabled: isAuthenticated,
  });

  const { data: balances } = useQuery<Balances>({
    queryKey: ["/api/cashflow/balances"],
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);

  const { data: transactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/cashflow/transactions", selectedYear, selectedMonth],
    queryFn: async () => {
      const monthParam = selectedMonth === 'all' ? '' : `&month=${selectedMonth}`;
      const response = await fetch(`/api/cashflow/transactions?year=${selectedYear}${monthParam}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: isAuthenticated && viewMode === 'dashboard',
    staleTime: 30000,
  });

  const { data: calendarTransactions = [], refetch: refetchCalendar } = useQuery<Transaction[]>({
    queryKey: ["/api/cashflow/transactions", "calendar", calendarYear],
    queryFn: async () => {
      const response = await fetch(`/api/cashflow/transactions?year=${calendarYear}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: isAuthenticated && calendarModalOpen,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: calendarBalances, refetch: refetchCalendarBalances } = useQuery<Balances>({
    queryKey: ["/api/cashflow/balances", "calendar", calendarYear],
    queryFn: async () => {
      const response = await fetch(`/api/cashflow/balances?year=${calendarYear}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error('Failed to fetch balances');
      return response.json();
    },
    enabled: isAuthenticated && calendarModalOpen,
    staleTime: 0,
  });

  useEffect(() => {
    if (calendarModalOpen && isAuthenticated) {
      refetchCalendar();
      refetchCalendarBalances();
    }
  }, [calendarModalOpen, isAuthenticated, calendarYear]);

  const addTransactionMutation = useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id'>) => {
      return apiRequest("POST", "/api/cashflow/transactions", transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      toast({ title: "הצלחה", description: "התנועה נוספה בהצלחה" });
      setViewMode('main');
      resetForms();
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה בהוספת התנועה", variant: "destructive" });
    }
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      return apiRequest("PATCH", `/api/cashflow/transactions/${transaction.id}`, transaction);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      setEditingTransaction(null);
      toast({ title: "הצלחה", description: "התנועה עודכנה בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה בעדכון התנועה", variant: "destructive" });
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      return apiRequest("DELETE", `/api/cashflow/transactions/${transaction.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      toast({ title: "הצלחה", description: "התנועה נמחקה בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה במחיקת התנועה", variant: "destructive" });
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: 'income' | 'expense' | 'both' }) => {
      return apiRequest("POST", "/api/cashflow/categories", { name, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/settings"] });
      toast({ title: "הצלחה", description: "הקטגוריה נוספה בהצלחה" });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: 'income' | 'expense' }) => {
      return apiRequest("DELETE", `/api/cashflow/categories/${encodeURIComponent(name)}?type=${type}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/settings"] });
      toast({ title: "הצלחה", description: "הקטגוריה נמחקה בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה במחיקת קטגוריה", variant: "destructive" });
    }
  });

  const [newCategoryForManage, setNewCategoryForManage] = useState("");

  const addCreditCardMutation = useMutation({
    mutationFn: async (card: { name: string; lastFour?: string; chargeDay: number; issuer?: string }) => {
      return apiRequest("POST", "/api/cashflow/credit-cards", card);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/settings"], refetchType: 'all' });
      resetCreditCardForm();
      toast({ title: "הצלחה", description: "כרטיס האשראי נוסף בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה בהוספת כרטיס אשראי", variant: "destructive" });
    }
  });

  const updateCreditCardMutation = useMutation({
    mutationFn: async (card: { id: string; name: string; lastFour?: string; chargeDay: number; issuer?: string }) => {
      return apiRequest("PATCH", `/api/cashflow/credit-cards/${card.id}`, card);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/settings"], refetchType: 'all' });
      resetCreditCardForm();
      setEditingCreditCard(null);
      toast({ title: "הצלחה", description: "כרטיס האשראי עודכן בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה בעדכון כרטיס אשראי", variant: "destructive" });
    }
  });

  const deleteCreditCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return apiRequest("DELETE", `/api/cashflow/credit-cards/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/settings"], refetchType: 'all' });
      toast({ title: "הצלחה", description: "כרטיס האשראי נמחק בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message || "שגיאה במחיקת כרטיס אשראי", variant: "destructive" });
    }
  });

  const resetCreditCardForm = () => {
    setCreditCardForm({ name: "", lastFour: "", chargeDay: "10", issuer: "" });
    setEditingCreditCard(null);
  };

  const resetForms = () => {
    setIncomeForm({ amount: "", description: "", category: "", paymentMethod: "immediate", scheduledDate: "", isRecurring: false, frequency: "monthly", numPayments: "1" });
    setExpenseForm({ amount: "", description: "", category: "", paymentMethod: "immediate", creditCard: "", checkChargeDate: "", isRecurring: false, frequency: "monthly", chargeDay: "1" });
    setIsNewCategory(false);
    setNewCategoryName("");
  };

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleAddIncome = async () => {
    if (!incomeForm.amount || !incomeForm.description) {
      toast({ title: "שגיאה", description: "יש למלא את כל השדות", variant: "destructive" });
      return;
    }

    const today = new Date();
    const isScheduled = incomeForm.paymentMethod === "scheduled";

    if (incomeForm.isRecurring && isScheduled && !incomeForm.scheduledDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריך להכנסה הראשונה", variant: "destructive" });
      return;
    }

    // For recurring scheduled income, create multiple transactions
    if (incomeForm.isRecurring && isScheduled && incomeForm.scheduledDate) {
      const numPayments = parseInt(incomeForm.numPayments) || 1;
      const monthIncrement = incomeForm.frequency === 'bimonthly' ? 2 : 1;
      const recurringGroupId = crypto.randomUUID();
      const firstDate = new Date(incomeForm.scheduledDate);
      
      for (let i = 0; i < numPayments; i++) {
        const paymentDate = new Date(firstDate);
        paymentDate.setMonth(paymentDate.getMonth() + (i * monthIncrement));
        
        const transactionDate = formatLocalDate(paymentDate);
        const month = paymentDate.getMonth() + 1;
        const year = paymentDate.getFullYear();
        const isPending = paymentDate > today;

        await apiRequest("POST", "/api/cashflow/transactions", {
          date: transactionDate,
          type: 'income',
          amount: parseFloat(incomeForm.amount),
          categoryLabel: 'כללי',
          paymentMethod: "העברה מתוזמנת",
          description: incomeForm.description,
          status: isPending ? 'pending' : 'completed',
          month,
          year,
          recurringGroupId,
          isRecurring: true
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      toast({ title: "הצלחה", description: `נוספו ${numPayments} הכנסות עתידיות` });
      setViewMode('main');
      resetForms();
      return;
    }

    // Single transaction
    const transactionDate = isScheduled && incomeForm.scheduledDate 
      ? incomeForm.scheduledDate 
      : formatLocalDate(today);
    
    const scheduledDate = isScheduled && incomeForm.scheduledDate ? new Date(incomeForm.scheduledDate) : null;
    const isPending = scheduledDate && scheduledDate > today;

    const parsedDate = new Date(transactionDate);
    const month = parsedDate.getMonth() + 1;
    const year = parsedDate.getFullYear();

    addTransactionMutation.mutate({
      date: transactionDate,
      type: 'income',
      amount: parseFloat(incomeForm.amount),
      categoryLabel: 'כללי',
      paymentMethod: incomeForm.paymentMethod === "immediate" ? "העברה מיידית" : "העברה מתוזמנת",
      description: incomeForm.description,
      status: isPending ? 'pending' : 'completed',
      month,
      year
    });
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.category) {
      toast({ title: "שגיאה", description: "יש למלא סכום וקטגוריה", variant: "destructive" });
      return;
    }
    
    if (expenseForm.category === 'אחר' && !expenseForm.description) {
      toast({ title: "שגיאה", description: "כשבוחרים 'אחר' חובה לכתוב סיבה", variant: "destructive" });
      return;
    }

    if (expenseForm.isRecurring && expenseForm.paymentMethod === "credit" && !expenseForm.creditCard) {
      toast({ title: "שגיאה", description: "יש לבחור כרטיס אשראי להוצאה קבועה", variant: "destructive" });
      return;
    }

    if (expenseForm.isRecurring && expenseForm.paymentMethod === "check" && !expenseForm.checkChargeDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריך פירעון לצ'ק הראשון", variant: "destructive" });
      return;
    }

    // Save the new category if it doesn't exist
    if (settings?.categories?.expense && !settings.categories.expense.includes(expenseForm.category)) {
      try {
        await addCategoryMutation.mutateAsync({ name: expenseForm.category, type: 'expense' });
      } catch (error) {
        console.error('Error adding category:', error);
      }
    }

    const today = new Date();
    let creditCardId: string | undefined;
    let creditCardName: string | undefined;
    let card: any = null;

    if (expenseForm.paymentMethod === "credit" && expenseForm.creditCard && settings?.creditCards) {
      card = settings.creditCards.find(c => c.id === expenseForm.creditCard);
      if (card) {
        creditCardId = card.id;
        creditCardName = card.name + (card.lastFour ? ` (${card.lastFour})` : '');
      }
    }

    // For recurring expenses, create multiple transactions with same recurring group ID
    if (expenseForm.isRecurring && card) {
      const numCharges = parseInt(expenseForm.chargeDay) || 12;
      const monthIncrement = expenseForm.frequency === 'bimonthly' ? 2 : 1;
      const recurringGroupId = crypto.randomUUID();
      
      for (let i = 0; i < numCharges; i++) {
        const chargeDate = new Date(today.getFullYear(), today.getMonth() + (i * monthIncrement), card.chargeDay);
        if (i === 0 && chargeDate <= today) {
          chargeDate.setMonth(chargeDate.getMonth() + monthIncrement);
        }
        
        const transactionDate = formatLocalDate(chargeDate);
        const month = chargeDate.getMonth() + 1;
        const year = chargeDate.getFullYear();
        const isPending = chargeDate > today;

        await apiRequest("POST", "/api/cashflow/transactions", {
          date: transactionDate,
          type: 'expense',
          amount: parseFloat(expenseForm.amount),
          categoryLabel: expenseForm.category,
          paymentMethod: "אשראי",
          description: expenseForm.description || expenseForm.category,
          status: isPending ? 'pending' : 'completed',
          creditCardId,
          creditCardName,
          month,
          year,
          recurringGroupId,
          isRecurring: true
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      toast({ title: "הצלחה", description: `נוספו ${numCharges} תנועות עתידיות` });
      setViewMode('main');
      resetForms();
      return;
    }

    // For recurring check expenses, create multiple transactions with same recurring group ID
    if (expenseForm.isRecurring && expenseForm.paymentMethod === "check" && expenseForm.checkChargeDate) {
      const numCharges = parseInt(expenseForm.chargeDay) || 12;
      const monthIncrement = expenseForm.frequency === 'bimonthly' ? 2 : 1;
      const recurringGroupId = crypto.randomUUID();
      const firstCheckDate = new Date(expenseForm.checkChargeDate);
      
      for (let i = 0; i < numCharges; i++) {
        const chargeDate = new Date(firstCheckDate);
        chargeDate.setMonth(chargeDate.getMonth() + (i * monthIncrement));
        
        const transactionDate = formatLocalDate(chargeDate);
        const month = chargeDate.getMonth() + 1;
        const year = chargeDate.getFullYear();
        const isPending = chargeDate > today;

        await apiRequest("POST", "/api/cashflow/transactions", {
          date: transactionDate,
          type: 'expense',
          amount: parseFloat(expenseForm.amount),
          categoryLabel: expenseForm.category,
          paymentMethod: "צ'ק",
          description: expenseForm.description || expenseForm.category,
          status: isPending ? 'pending' : 'completed',
          checkChargeDate: transactionDate,
          month,
          year,
          recurringGroupId,
          isRecurring: true
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/balances"] });
      toast({ title: "הצלחה", description: `נוספו ${numCharges} צ'קים עתידיים` });
      setViewMode('main');
      resetForms();
      return;
    }

    // Single transaction
    let transactionDate = formatLocalDate(today);
    let isPending = false;
    let paymentMethodLabel = "מזומן";
    let checkChargeDate: string | undefined;

    if (expenseForm.paymentMethod === "check") {
      paymentMethodLabel = "צ'ק";
      if (expenseForm.checkChargeDate) {
        checkChargeDate = expenseForm.checkChargeDate;
        transactionDate = expenseForm.checkChargeDate;
        const checkDate = new Date(expenseForm.checkChargeDate);
        isPending = checkDate > today;
      }
    } else if (card) {
      paymentMethodLabel = "אשראי";
      const chargeDate = new Date(today.getFullYear(), today.getMonth(), card.chargeDay);
      if (chargeDate <= today) {
        chargeDate.setMonth(chargeDate.getMonth() + 1);
      }
      transactionDate = formatLocalDate(chargeDate);
      isPending = chargeDate > today;
    }

    const parsedDate = new Date(transactionDate);
    const month = parsedDate.getMonth() + 1;
    const year = parsedDate.getFullYear();

    addTransactionMutation.mutate({
      date: transactionDate,
      type: 'expense',
      amount: parseFloat(expenseForm.amount),
      categoryLabel: expenseForm.category,
      paymentMethod: paymentMethodLabel,
      description: expenseForm.description,
      status: isPending ? 'pending' : 'completed',
      creditCardId,
      creditCardName,
      checkChargeDate,
      month,
      year
    });
  };

  const checkBalanceAtDate = async () => {
    if (!selectedDate) return;
    try {
      const response = await fetch(`/api/cashflow/balance-at-date?date=${selectedDate}`, { credentials: "same-origin" });
      const data = await response.json();
      setBalanceAtDate(data.balance);
    } catch (error) {
      toast({ title: "שגיאה", description: "שגיאה בטעינת היתרה", variant: "destructive" });
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.categoryLabel !== filterCategory) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4 overflow-hidden" dir="rtl">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <DollarSign className="h-16 w-16 text-white" />
          </div>
        </div>
        
        <Card className="w-full max-w-sm bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader className="text-center py-4">
            <CardTitle className="text-xl text-white">
              תזרים מזומנים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
                placeholder="סיסמה"
                data-testid="input-cashflow-password"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full bg-green-600 hover:bg-green-700"
              data-testid="button-cashflow-login"
            >
              כניסה
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/main")}
              className="w-full text-white/70 hover:text-white"
              data-testid="button-back-main"
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              חזרה לתפריט
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewMode === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <Eye className="h-6 w-6 text-indigo-600" />
                תצוגת תנועות
              </h1>
              <Button variant="ghost" onClick={() => setViewMode('main')} className="hover:bg-indigo-50">
                <ArrowLeft className="h-4 w-4 ml-1" />
                חזרה
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-24 bg-white border-indigo-200">
                  <SelectValue placeholder="שנה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(v === 'all' ? 'all' : parseInt(v))}>
                <SelectTrigger className="w-32 bg-white border-indigo-200">
                  <Calendar className="h-4 w-4 ml-1 text-indigo-500" />
                  <SelectValue placeholder="חודש" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השנה</SelectItem>
                  <SelectItem value="1">ינואר</SelectItem>
                  <SelectItem value="2">פברואר</SelectItem>
                  <SelectItem value="3">מרץ</SelectItem>
                  <SelectItem value="4">אפריל</SelectItem>
                  <SelectItem value="5">מאי</SelectItem>
                  <SelectItem value="6">יוני</SelectItem>
                  <SelectItem value="7">יולי</SelectItem>
                  <SelectItem value="8">אוגוסט</SelectItem>
                  <SelectItem value="9">ספטמבר</SelectItem>
                  <SelectItem value="10">אוקטובר</SelectItem>
                  <SelectItem value="11">נובמבר</SelectItem>
                  <SelectItem value="12">דצמבר</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-indigo-100">
                <Button 
                  variant={filterType === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilterType('all'); setFilterCategory('all'); }}
                  className={filterType === 'all' ? 'bg-indigo-500 hover:bg-indigo-600' : 'hover:bg-indigo-50'}
                >
                  הכל
                </Button>
                <Button 
                  variant={filterType === 'income' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilterType('income'); setFilterCategory('all'); }}
                  className={filterType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : 'hover:bg-emerald-50 text-emerald-700'}
                >
                  <TrendingUp className="h-4 w-4 ml-1" />
                  הכנסות
                </Button>
                <Button 
                  variant={filterType === 'expense' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType('expense')}
                  className={filterType === 'expense' ? 'bg-rose-500 hover:bg-rose-600' : 'hover:bg-rose-50 text-rose-700'}
                >
                  <TrendingDown className="h-4 w-4 ml-1" />
                  הוצאות
                </Button>
              </div>
              
              {filterType === 'expense' && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40 bg-white border-rose-200">
                    <Filter className="h-4 w-4 ml-1 text-rose-500" />
                    <SelectValue placeholder="קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל הקטגוריות</SelectItem>
                    {(settings?.categories?.expense || []).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {transactionsLoading ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 text-center text-indigo-600">
                טוען תנועות...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-8 text-center text-slate-400">
                אין תנועות להצגה
              </div>
            ) : (
              <>
                {/* Summary Row - moved to top */}
                <div className="bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-2xl shadow-sm p-3 md:p-5 border border-white/50">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
                    <span className="font-bold text-base md:text-lg text-indigo-800">סיכום:</span>
                    <div className="flex flex-wrap justify-center gap-2 md:gap-6 text-sm md:text-base font-semibold w-full md:w-auto">
                      <div className="flex items-center gap-1 md:gap-2 bg-white/60 px-2 md:px-4 py-1.5 md:py-2 rounded-lg">
                        <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                        <span className="text-emerald-700">
                          {formatCurrency(filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2 bg-white/60 px-2 md:px-4 py-1.5 md:py-2 rounded-lg">
                        <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-rose-600" />
                        <span className="text-rose-700">
                          {formatCurrency(filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2 bg-white/80 px-2 md:px-4 py-1.5 md:py-2 rounded-lg shadow-sm">
                        <span className={`font-bold ${
                          filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) - 
                          filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) >= 0 
                            ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          נטו: {formatCurrency(
                            filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) - 
                            filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {filteredTransactions.map(transaction => (
                  <div 
                    key={transaction.id} 
                    className={`bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-3 md:p-4 transition-all hover:shadow-md ${
                      transaction.status === 'pending' ? 'opacity-70 border-2 border-dashed border-amber-300' : 'border border-slate-100'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-start md:items-center gap-2 md:gap-3">
                        <div className={`p-2 md:p-2.5 rounded-xl shrink-0 ${
                          transaction.type === 'income' 
                            ? 'bg-gradient-to-br from-emerald-100 to-green-100' 
                            : 'bg-gradient-to-br from-rose-100 to-red-100'
                        }`}>
                          {transaction.type === 'income' ? (
                            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-rose-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 text-sm md:text-base truncate">{transaction.description}</p>
                          <div className="flex flex-wrap gap-x-1.5 md:gap-x-2 gap-y-1 text-xs md:text-sm text-slate-500">
                            <span className="bg-slate-100 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">{new Date(transaction.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="bg-indigo-50 text-indigo-600 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">{transaction.categoryLabel}</span>
                            <span className="text-slate-400 text-[10px] md:text-xs">{transaction.paymentMethod}</span>
                            {transaction.status === 'pending' && (
                              <span className="bg-amber-100 text-amber-700 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs">עתידי</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-2 mr-8 md:mr-0">
                        <span className={`text-base md:text-lg font-bold ${
                          transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingTransaction(transaction)}
                            className="hover:bg-indigo-50 h-8 w-8 md:h-10 md:w-10"
                          >
                            <Edit className="h-4 w-4 text-indigo-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteTransactionMutation.mutate(transaction)}
                            className="hover:bg-rose-50 h-8 w-8 md:h-10 md:w-10"
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                עריכת תנועה
              </DialogTitle>
            </DialogHeader>
            {editingTransaction && (
              <div className="space-y-4">
                {/* Income Edit Fields */}
                {editingTransaction.type === 'income' && (
                  <>
                    <div className="p-2 bg-emerald-50 rounded-lg text-center">
                      <span className="text-emerald-700 font-medium flex items-center justify-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        עריכת הכנסה
                      </span>
                    </div>
                    <div>
                      <Label>פירוט *</Label>
                      <Input
                        value={editingTransaction.description}
                        onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                        data-testid="input-edit-description"
                      />
                    </div>
                    <div>
                      <Label>סכום *</Label>
                      <Input
                        type="number"
                        value={editingTransaction.amount}
                        onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                        data-testid="input-edit-amount"
                      />
                    </div>
                    <div>
                      <Label>אמצעי תשלום</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          variant={editingTransaction.paymentMethod === "העברה מיידית" ? "default" : "outline"}
                          onClick={() => {
                            const today = new Date();
                            const todayStr = formatLocalDate(today);
                            setEditingTransaction({
                              ...editingTransaction, 
                              paymentMethod: "העברה מיידית",
                              status: 'completed',
                              date: todayStr,
                              year: today.getFullYear(),
                              month: today.getMonth() + 1
                            });
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          <Wallet className="h-4 w-4 ml-1" />
                          מיידי
                        </Button>
                        <Button
                          type="button"
                          variant={editingTransaction.paymentMethod === "העברה מתוזמנת" ? "default" : "outline"}
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = formatLocalDate(tomorrow);
                            setEditingTransaction({
                              ...editingTransaction, 
                              paymentMethod: "העברה מתוזמנת",
                              status: 'pending',
                              date: tomorrowStr,
                              year: tomorrow.getFullYear(),
                              month: tomorrow.getMonth() + 1
                            });
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          <Calendar className="h-4 w-4 ml-1" />
                          מתוזמן
                        </Button>
                      </div>
                    </div>
                    {editingTransaction.status === 'pending' && (
                      <div>
                        <Label>תאריך צפוי</Label>
                        <Input
                          type="date"
                          value={editingTransaction.date?.split('T')[0] || ''}
                          onChange={(e) => {
                            const selectedDate = new Date(e.target.value);
                            setEditingTransaction({
                              ...editingTransaction, 
                              date: e.target.value,
                              year: selectedDate.getFullYear(),
                              month: selectedDate.getMonth() + 1
                            });
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Expense Edit Fields */}
                {editingTransaction.type === 'expense' && (
                  <>
                    <div className="p-2 bg-rose-50 rounded-lg text-center">
                      <span className="text-rose-700 font-medium flex items-center justify-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        עריכת הוצאה
                      </span>
                    </div>
                    <div>
                      <Label>סכום *</Label>
                      <Input
                        type="number"
                        value={editingTransaction.amount}
                        onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                        data-testid="input-edit-amount"
                      />
                    </div>
                    <div>
                      <Label>סיבה/פירוט</Label>
                      <Input
                        value={editingTransaction.description}
                        onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                        data-testid="input-edit-description"
                      />
                    </div>
                    <div>
                      <Label>קטגוריה</Label>
                      <Select 
                        value={editingTransaction.categoryLabel} 
                        onValueChange={(v) => setEditingTransaction({...editingTransaction, categoryLabel: v})}
                      >
                        <SelectTrigger data-testid="select-edit-category">
                          <SelectValue placeholder="בחר קטגוריה" />
                        </SelectTrigger>
                        <SelectContent>
                          {(settings?.categories?.expense || ['כללי']).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>אמצעי תשלום</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          variant={editingTransaction.paymentMethod !== "אשראי" && editingTransaction.paymentMethod !== "צ'ק" ? "default" : "outline"}
                          onClick={() => {
                            const today = new Date();
                            const todayStr = formatLocalDate(today);
                            setEditingTransaction({
                              ...editingTransaction, 
                              paymentMethod: "מזומן",
                              creditCardId: null,
                              creditCardName: null,
                              checkChargeDate: null,
                              status: 'completed',
                              date: todayStr,
                              year: today.getFullYear(),
                              month: today.getMonth() + 1
                            } as any);
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          <Wallet className="h-4 w-4 ml-1" />
                          מיידי
                        </Button>
                        <Button
                          type="button"
                          variant={editingTransaction.paymentMethod === "צ'ק" ? "default" : "outline"}
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = formatLocalDate(tomorrow);
                            setEditingTransaction({
                              ...editingTransaction, 
                              paymentMethod: "צ'ק",
                              creditCardId: null,
                              creditCardName: null,
                              status: 'pending',
                              date: tomorrowStr,
                              year: tomorrow.getFullYear(),
                              month: tomorrow.getMonth() + 1
                            } as any);
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          <FileText className="h-4 w-4 ml-1" />
                          צ'ק
                        </Button>
                        <Button
                          type="button"
                          variant={editingTransaction.paymentMethod === "אשראי" ? "default" : "outline"}
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = formatLocalDate(tomorrow);
                            setEditingTransaction({
                              ...editingTransaction, 
                              paymentMethod: "אשראי",
                              checkChargeDate: null,
                              status: 'pending',
                              date: tomorrowStr,
                              year: tomorrow.getFullYear(),
                              month: tomorrow.getMonth() + 1
                            } as any);
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          <CreditCard className="h-4 w-4 ml-1" />
                          אשראי
                        </Button>
                      </div>
                    </div>
                    {editingTransaction.paymentMethod === "צ'ק" && (
                      <div>
                        <Label>תאריך פירעון הצ'ק</Label>
                        <Input
                          type="date"
                          value={(editingTransaction as any).checkChargeDate || ''}
                          onChange={(e) => setEditingTransaction({
                            ...editingTransaction,
                            checkChargeDate: e.target.value,
                            date: e.target.value,
                            year: new Date(e.target.value).getFullYear(),
                            month: new Date(e.target.value).getMonth() + 1
                          } as any)}
                          data-testid="input-check-charge-date"
                        />
                      </div>
                    )}
                    {editingTransaction.paymentMethod === "אשראי" && settings?.creditCards && settings.creditCards.length > 0 && (
                      <div>
                        <Label>כרטיס אשראי</Label>
                        <Select 
                          value={editingTransaction.creditCardId || ''} 
                          onValueChange={(v) => {
                            const card = settings.creditCards.find(c => c.id === v);
                            if (card) {
                              const today = new Date();
                              const chargeDate = new Date(today.getFullYear(), today.getMonth(), card.chargeDay);
                              if (chargeDate <= today) {
                                chargeDate.setMonth(chargeDate.getMonth() + 1);
                              }
                              const chargeDateStr = formatLocalDate(chargeDate);
                              setEditingTransaction({
                                ...editingTransaction, 
                                creditCardId: v,
                                creditCardName: `${card.name}${card.lastFour ? ` (${card.lastFour})` : ''}`,
                                date: chargeDateStr,
                                year: chargeDate.getFullYear(),
                                month: chargeDate.getMonth() + 1
                              } as any);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר כרטיס" />
                          </SelectTrigger>
                          <SelectContent>
                            {settings.creditCards.map(card => (
                              <SelectItem key={card.id} value={card.id}>
                                {card.name}{card.lastFour ? ` (${card.lastFour})` : ''} - חיוב ב-{card.chargeDay}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                {/* Status section - only show for income OR for expense with immediate payment */}
                {(editingTransaction.type === 'income' || 
                  (editingTransaction.type === 'expense' && 
                   editingTransaction.paymentMethod !== "אשראי" && 
                   editingTransaction.paymentMethod !== "צ'ק")) && (
                  <>
                    <div>
                      <Label>סטטוס</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          variant={editingTransaction.status === "completed" ? "default" : "outline"}
                          onClick={() => {
                            const today = new Date();
                            const todayStr = formatLocalDate(today);
                            setEditingTransaction({
                              ...editingTransaction, 
                              status: 'completed',
                              paymentMethod: editingTransaction.type === 'income' ? 'מזומן' : editingTransaction.paymentMethod,
                              date: todayStr,
                              year: today.getFullYear(),
                              month: today.getMonth() + 1
                            });
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          הושלם (העבר להיום)
                        </Button>
                        <Button
                          type="button"
                          variant={editingTransaction.status === "pending" ? "default" : "outline"}
                          onClick={() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowStr = formatLocalDate(tomorrow);
                            if (editingTransaction.type === 'expense') {
                              // For expense, switch to credit card payment
                              setEditingTransaction({
                                ...editingTransaction, 
                                status: 'pending',
                                paymentMethod: 'אשראי',
                                checkChargeDate: null,
                                date: tomorrowStr,
                                year: tomorrow.getFullYear(),
                                month: tomorrow.getMonth() + 1
                              } as any);
                            } else {
                              setEditingTransaction({
                                ...editingTransaction, 
                                status: 'pending',
                                paymentMethod: 'מתוזמן',
                                date: tomorrowStr,
                                year: tomorrow.getFullYear(),
                                month: tomorrow.getMonth() + 1
                              });
                            }
                          }}
                          className="flex-1"
                          size="sm"
                        >
                          עתידי
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                {editingTransaction.isRecurring && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!(editingTransaction as any).convertToOneTime}
                        onCheckedChange={(checked) => setEditingTransaction({
                          ...editingTransaction, 
                          convertToOneTime: !!checked
                        } as any)}
                      />
                      <Label className="text-amber-800">המר להוצאה חד-פעמית (ימחק כל התנועות העתידיות)</Label>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditingTransaction(null)}>ביטול</Button>
              <Button 
                onClick={() => {
                  if (editingTransaction) {
                    const dataToSend: any = { ...editingTransaction };
                    updateTransactionMutation.mutate(dataToSend);
                  }
                }}
                disabled={updateTransactionMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateTransactionMutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (viewMode === 'add-income') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4" dir="rtl">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Plus className="h-6 w-6" />
                הוספת הכנסה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>סכום *</Label>
                <Input
                  type="number"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({...incomeForm, amount: e.target.value})}
                  placeholder="הזן סכום"
                  data-testid="input-income-amount"
                />
              </div>
              <div>
                <Label>פירוט *</Label>
                <Input
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({...incomeForm, description: e.target.value})}
                  placeholder="למה נכנס הכסף?"
                  data-testid="input-income-description"
                />
              </div>
              <div>
                <Label>אמצעי תשלום</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={incomeForm.paymentMethod === "immediate" ? "default" : "outline"}
                    onClick={() => setIncomeForm({...incomeForm, paymentMethod: "immediate"})}
                    className="flex-1"
                  >
                    <Wallet className="h-4 w-4 ml-1" />
                    מיידי
                  </Button>
                  <Button
                    type="button"
                    variant={incomeForm.paymentMethod === "scheduled" ? "default" : "outline"}
                    onClick={() => setIncomeForm({...incomeForm, paymentMethod: "scheduled"})}
                    className="flex-1"
                  >
                    <Calendar className="h-4 w-4 ml-1" />
                    מתוזמן
                  </Button>
                </div>
              </div>
              {incomeForm.paymentMethod === "scheduled" && (
                <>
                  <div>
                    <Label>תאריך כניסת הכסף</Label>
                    <Input
                      type="date"
                      value={incomeForm.scheduledDate}
                      onChange={(e) => setIncomeForm({...incomeForm, scheduledDate: e.target.value})}
                      data-testid="input-income-scheduled-date"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={incomeForm.isRecurring}
                      onCheckedChange={(checked) => setIncomeForm({
                        ...incomeForm, 
                        isRecurring: !!checked
                      })}
                    />
                    <Label>הכנסה קבועה</Label>
                  </div>
                  {incomeForm.isRecurring && (
                    <>
                      <div>
                        <Label>תדירות</Label>
                        <Select value={incomeForm.frequency} onValueChange={(v) => setIncomeForm({...incomeForm, frequency: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">כל חודש</SelectItem>
                            <SelectItem value="bimonthly">כל חודשיים</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>מספר תשלומים</Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={incomeForm.numPayments}
                          onChange={(e) => setIncomeForm({...incomeForm, numPayments: e.target.value})}
                          placeholder="כמה פעמים?"
                        />
                        <p className="text-xs text-slate-500 mt-1">יצור {incomeForm.numPayments || 1} הכנסות עתידיות</p>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setViewMode('main'); resetForms(); }} className="flex-1">
                  ביטול
                </Button>
                <Button 
                  onClick={handleAddIncome}
                  disabled={addTransactionMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-submit-income"
                >
                  {addTransactionMutation.isPending ? "מוסיף..." : "הוסף הכנסה"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'add-expense') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4" dir="rtl">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Minus className="h-6 w-6" />
                הוספת הוצאה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>סכום *</Label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  placeholder="הזן סכום"
                  data-testid="input-expense-amount"
                />
              </div>
              <div>
                <Label>סיבה/פירוט {expenseForm.category === 'אחר' ? '*' : '(אופציונלי)'}</Label>
                <Input
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  placeholder={expenseForm.category === 'אחר' ? "חובה לפרט כשבוחרים אחר" : "על מה ההוצאה? (אופציונלי)"}
                  data-testid="input-expense-description"
                />
              </div>
              <div>
                <Label>קטגוריה *</Label>
                <Select 
                  value={expenseForm.category} 
                  onValueChange={(v) => {
                    if (v === "__manage__") {
                      setViewMode('manage-categories');
                    } else {
                      setExpenseForm({...expenseForm, category: v});
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.categories?.expense?.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__manage__" className="text-slate-500 font-medium border-t mt-1 pt-2">
                      <Settings className="h-3 w-3 inline ml-1" />
                      ניהול קטגוריות
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>אמצעי תשלום</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={expenseForm.paymentMethod === "immediate" ? "default" : "outline"}
                    onClick={() => setExpenseForm({...expenseForm, paymentMethod: "immediate", creditCard: "", checkChargeDate: "", isRecurring: false})}
                    className="flex-1"
                  >
                    <Wallet className="h-4 w-4 ml-1" />
                    מיידי
                  </Button>
                  <Button
                    type="button"
                    variant={expenseForm.paymentMethod === "check" ? "default" : "outline"}
                    onClick={() => setExpenseForm({...expenseForm, paymentMethod: "check", creditCard: ""})}
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 ml-1" />
                    צ'ק
                  </Button>
                  <Button
                    type="button"
                    variant={expenseForm.paymentMethod === "credit" ? "default" : "outline"}
                    onClick={() => setExpenseForm({...expenseForm, paymentMethod: "credit", checkChargeDate: ""})}
                    className="flex-1"
                  >
                    <CreditCard className="h-4 w-4 ml-1" />
                    אשראי
                  </Button>
                </div>
              </div>
              {expenseForm.paymentMethod === "check" && (
                <div>
                  <Label>תאריך פירעון הצ'ק</Label>
                  <Input
                    type="date"
                    value={expenseForm.checkChargeDate}
                    onChange={(e) => setExpenseForm({...expenseForm, checkChargeDate: e.target.value})}
                    data-testid="input-check-date"
                  />
                </div>
              )}
              {expenseForm.paymentMethod === "credit" && settings?.creditCards && settings.creditCards.length > 0 && (
                <div>
                  <Label>כרטיס אשראי</Label>
                  <Select value={expenseForm.creditCard} onValueChange={(v) => setExpenseForm({...expenseForm, creditCard: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר כרטיס" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.creditCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}{card.lastFour ? ` (${card.lastFour})` : ''} - חיוב ב-{card.chargeDay}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(expenseForm.paymentMethod === "credit" || expenseForm.paymentMethod === "check") && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={expenseForm.isRecurring}
                    onCheckedChange={(checked) => setExpenseForm({
                      ...expenseForm, 
                      isRecurring: !!checked
                    })}
                  />
                  <Label>הוצאה קבועה ({expenseForm.paymentMethod === "credit" ? "באשראי" : "בצ'ק"})</Label>
                </div>
              )}
              {expenseForm.isRecurring && (
                <>
                  <div>
                    <Label>תדירות</Label>
                    <Select value={expenseForm.frequency} onValueChange={(v) => setExpenseForm({...expenseForm, frequency: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">כל חודש</SelectItem>
                        <SelectItem value="bimonthly">כל חודשיים</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>מספר חיובים עתידיים</Label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={expenseForm.chargeDay}
                      onChange={(e) => setExpenseForm({...expenseForm, chargeDay: e.target.value})}
                      placeholder="כמה פעמים לחייב?"
                    />
                    <p className="text-xs text-slate-500 mt-1">יצור {expenseForm.chargeDay || 1} תנועות עתידיות</p>
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setViewMode('main'); resetForms(); }} className="flex-1">
                  ביטול
                </Button>
                <Button 
                  onClick={handleAddExpense}
                  disabled={addTransactionMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  data-testid="button-submit-expense"
                >
                  {addTransactionMutation.isPending ? "מוסיף..." : "הוסף הוצאה"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'manage-cards') {
    const handleSaveCreditCard = () => {
      if (!creditCardForm.name) {
        toast({ title: "שגיאה", description: "יש למלא את שם הכרטיס", variant: "destructive" });
        return;
      }
      
      const cardData = {
        name: creditCardForm.name,
        lastFour: creditCardForm.lastFour || undefined,
        chargeDay: parseInt(creditCardForm.chargeDay) || 10,
        issuer: creditCardForm.issuer || undefined
      };

      if (editingCreditCard) {
        updateCreditCardMutation.mutate({ id: editingCreditCard, ...cardData });
      } else {
        addCreditCardMutation.mutate(cardData);
      }
    };

    const handleEditCard = (card: { id: string; name: string; lastFour?: string; chargeDay: number; issuer?: string }) => {
      setCreditCardForm({
        id: card.id,
        name: card.name,
        lastFour: card.lastFour || "",
        chargeDay: card.chargeDay.toString(),
        issuer: card.issuer || ""
      });
      setEditingCreditCard(card.id);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4" dir="rtl">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <CreditCard className="h-6 w-6" />
                ניהול כרטיסי אשראי
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border rounded-lg p-4 bg-white/50">
                <h3 className="font-medium mb-4">{editingCreditCard ? "עריכת כרטיס" : "הוספת כרטיס חדש"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>שם הכרטיס *</Label>
                    <Input
                      value={creditCardForm.name}
                      onChange={(e) => setCreditCardForm({...creditCardForm, name: e.target.value})}
                      placeholder="לדוגמה: ויזה כאל"
                      data-testid="input-card-name"
                    />
                  </div>
                  <div>
                    <Label>4 ספרות אחרונות</Label>
                    <Input
                      value={creditCardForm.lastFour}
                      onChange={(e) => setCreditCardForm({...creditCardForm, lastFour: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                      placeholder="1234"
                      maxLength={4}
                      data-testid="input-card-last-four"
                    />
                  </div>
                  <div>
                    <Label>יום חיוב בחודש</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={creditCardForm.chargeDay}
                      onChange={(e) => setCreditCardForm({...creditCardForm, chargeDay: e.target.value})}
                      placeholder="10"
                      data-testid="input-card-charge-day"
                    />
                  </div>
                  <div>
                    <Label>מנפיק (אופציונלי)</Label>
                    <Input
                      value={creditCardForm.issuer}
                      onChange={(e) => setCreditCardForm({...creditCardForm, issuer: e.target.value})}
                      placeholder="לדוגמה: כאל, מקס, ישראכרט"
                      data-testid="input-card-issuer"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleSaveCreditCard}
                    disabled={addCreditCardMutation.isPending || updateCreditCardMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-save-card"
                  >
                    {addCreditCardMutation.isPending || updateCreditCardMutation.isPending ? "שומר..." : editingCreditCard ? "עדכן" : "הוסף כרטיס"}
                  </Button>
                  {editingCreditCard && (
                    <Button variant="outline" onClick={resetCreditCardForm}>
                      ביטול עריכה
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">כרטיסים קיימים ({settings?.creditCards?.length || 0})</h3>
                {!settings?.creditCards?.length ? (
                  <p className="text-slate-500 text-sm">אין כרטיסי אשראי מוגדרים</p>
                ) : (
                  <div className="space-y-2">
                    {settings.creditCards.map(card => (
                      <Card key={card.id} className="bg-white">
                        <CardContent className="py-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{card.name}{card.lastFour ? ` (${card.lastFour})` : ''}</p>
                            <p className="text-sm text-slate-500">
                              יום חיוב: {card.chargeDay}
                              {card.issuer && ` • ${card.issuer}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCard(card)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteCreditCardMutation.mutate(card.id)}
                              disabled={deleteCreditCardMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                onClick={() => { setViewMode('main'); resetCreditCardForm(); }}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 ml-1" />
                חזרה לתפריט תזרים
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'manage-categories') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4" dir="rtl">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <Settings className="h-6 w-6" />
                ניהול קטגוריות הוצאה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>הוספת קטגוריה חדשה</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newCategoryForManage}
                    onChange={(e) => setNewCategoryForManage(e.target.value)}
                    placeholder="שם קטגוריה"
                    data-testid="input-new-category-manage"
                  />
                  <Button
                    onClick={() => {
                      if (newCategoryForManage.trim()) {
                        addCategoryMutation.mutate({ name: newCategoryForManage.trim(), type: 'expense' });
                        setNewCategoryForManage("");
                      }
                    }}
                    disabled={addCategoryMutation.isPending || !newCategoryForManage.trim()}
                    data-testid="button-add-category"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-3 block">קטגוריות קיימות ({settings?.categories?.expense?.length || 0})</Label>
                {!settings?.categories?.expense?.length ? (
                  <p className="text-slate-500 text-sm">אין קטגוריות מוגדרות</p>
                ) : (
                  <div className="space-y-2">
                    {settings.categories.expense.map((cat: string) => (
                      <div key={cat} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                        <span className="font-medium">{cat}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCategoryMutation.mutate({ name: cat, type: 'expense' })}
                          disabled={deleteCategoryMutation.isPending}
                          data-testid={`button-delete-category-${cat}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                onClick={() => setViewMode('add-expense')}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 ml-1" />
                חזרה להוספת הוצאה
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign className="h-10 w-10" />
            תזרים מזומנים
          </h1>
          <Button variant="ghost" onClick={() => setLocation("/main")} className="text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4 ml-1" />
            חזרה לתפריט
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-400 to-blue-600 border-0 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">יתרה בבנק</p>
                  <p className="text-3xl font-bold">{formatCurrency(balances?.bankBalance || 0)}</p>
                </div>
                <Wallet className="h-12 w-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card 
            className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 text-white cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => setCalendarModalOpen(true)}
            data-testid="card-expected-balance"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold flex items-center gap-2">
                    יתרה צפויה
                    <Calendar className="h-5 w-5" />
                  </p>
                </div>
                <TrendingUp className="h-12 w-12 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:scale-105 transition-transform bg-white/10 backdrop-blur-lg border-white/20"
            onClick={() => setViewMode('dashboard')}
            data-testid="card-dashboard"
          >
            <CardContent className="pt-6 text-center">
              <Eye className="h-16 w-16 mx-auto mb-4 text-white" />
              <h2 className="text-xl font-bold text-white">תצוגה</h2>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:scale-105 transition-transform bg-gradient-to-br from-green-400 to-green-600 border-0"
            onClick={() => setViewMode('add-income')}
            data-testid="card-add-income"
          >
            <CardContent className="pt-6 text-center">
              <Plus className="h-16 w-16 mx-auto mb-4 text-white" />
              <h2 className="text-xl font-bold text-white">הוספת הכנסה</h2>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:scale-105 transition-transform bg-gradient-to-br from-red-400 to-red-600 border-0"
            onClick={() => setViewMode('add-expense')}
            data-testid="card-add-expense"
          >
            <CardContent className="pt-6 text-center">
              <Minus className="h-16 w-16 mx-auto mb-4 text-white" />
              <h2 className="text-xl font-bold text-white">הוספת הוצאה</h2>
            </CardContent>
          </Card>
        </div>

        <Button 
          variant="ghost" 
          size="sm"
          className="text-white/50 hover:text-white/70 text-xs"
          onClick={() => setViewMode('manage-cards')}
          data-testid="button-manage-cards"
        >
          <CreditCard className="h-3 w-3 ml-1" />
          ניהול כרטיסי אשראי
        </Button>
      </div>

      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                לוח יתרות יומי
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                >
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </Button>
                <span className="min-w-[120px] text-center">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                </span>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => (
                  <div key={day} className="text-xs font-medium text-slate-500 py-2">{day}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
              {(() => {
                const firstDay = new Date(calendarYear, calendarMonth, 1);
                const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDay = firstDay.getDay();
                
                const openingBalance = calendarBalances?.openingBalance || 0;
                
                const priorMonthsTransactions = calendarTransactions.filter(t => {
                  const tDateStr = typeof t.date === 'string' ? t.date.split('T')[0] : new Date(t.date).toISOString().split('T')[0];
                  const tDate = new Date(tDateStr);
                  return tDate < firstDay;
                });
                const priorIncome = priorMonthsTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                const priorExpense = priorMonthsTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                const startingBalance = openingBalance + priorIncome - priorExpense;
                
                const dailyData: { [key: number]: { income: number; expense: number; balance: number } } = {};
                let cumulativeBalance = startingBalance;
                
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const dayTransactions = calendarTransactions.filter(t => {
                    const tDateStr = typeof t.date === 'string' ? t.date.split('T')[0] : new Date(t.date).toISOString().split('T')[0];
                    return tDateStr === dateStr;
                  });
                  const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                  const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                  cumulativeBalance += income - expense;
                  dailyData[d] = { income, expense, balance: cumulativeBalance };
                }
                
                const cells = [];
                
                for (let i = 0; i < startDay; i++) {
                  cells.push(<div key={`empty-${i}`} className="min-h-[80px] md:min-h-[100px] bg-slate-50 rounded" />);
                }
                
                for (let day = 1; day <= daysInMonth; day++) {
                  const data = dailyData[day];
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayTransactions = calendarTransactions.filter(t => {
                    const tDateStr = typeof t.date === 'string' ? t.date.split('T')[0] : new Date(t.date).toISOString().split('T')[0];
                    return tDateStr === dateStr;
                  });
                  const isToday = new Date().getDate() === day && 
                                  new Date().getMonth() === calendarMonth && 
                                  new Date().getFullYear() === calendarYear;
                  const hasTransactions = data.income > 0 || data.expense > 0;
                  const netChange = data.income - data.expense;
                  
                  // Format balance compactly
                  const formatCompact = (amount: number) => {
                    if (Math.abs(amount) >= 10000) {
                      return `${Math.round(amount / 1000)}K`;
                    } else if (Math.abs(amount) >= 1000) {
                      return `${(amount / 1000).toFixed(1)}K`;
                    }
                    return Math.round(amount).toString();
                  };
                  
                  cells.push(
                    <div 
                      key={day} 
                      className={`min-h-[80px] md:min-h-[100px] p-1.5 md:p-2 rounded border ${isToday ? 'border-blue-500 border-2 bg-blue-50' : 'border-slate-200 bg-white'} flex flex-col ${hasTransactions ? 'cursor-pointer hover:bg-slate-50 active:bg-slate-100' : ''}`}
                      onClick={() => {
                        if (hasTransactions) {
                          setSelectedDayModal({ date: dateStr, transactions: dayTransactions, balance: data.balance });
                        }
                      }}
                      data-testid={`calendar-day-${day}`}
                    >
                      <div className="text-sm md:text-base font-bold text-slate-700">{day}</div>
                      <div className={`text-xs md:text-sm font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCompact(data.balance)} ₪
                      </div>
                      {hasTransactions && (
                        <div className="flex flex-col mt-auto text-xs md:text-sm leading-tight">
                          {data.income > 0 && <span className="text-green-600 font-medium">+{formatCompact(data.income)}</span>}
                          {data.expense > 0 && <span className="text-red-600 font-medium">-{formatCompact(data.expense)}</span>}
                        </div>
                      )}
                    </div>
                  );
                }
                
                return cells;
              })()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Details Modal */}
      <Dialog open={!!selectedDayModal} onOpenChange={(open) => !open && setSelectedDayModal(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                פירוט יום {selectedDayModal?.date ? new Date(selectedDayModal.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedDayModal && (
            <div className="space-y-4">
              {/* Day Summary */}
              <div className="p-3 bg-slate-100 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">יתרה מצטברת:</span>
                  <span className={`text-lg font-bold ${selectedDayModal.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(selectedDayModal.balance)}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">
                      +{selectedDayModal.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0).toLocaleString()} ₪
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">
                      -{selectedDayModal.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toLocaleString()} ₪
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">תנועות ({selectedDayModal.transactions.length})</h4>
                {selectedDayModal.transactions.map(tx => (
                  <div 
                    key={tx.id} 
                    className={`p-3 rounded-lg border ${tx.type === 'income' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tx.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                          {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} ₪
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTransaction(tx);
                            setSelectedDayModal(null);
                          }}
                          data-testid={`button-edit-day-tx-${tx.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('האם למחוק את התנועה?')) {
                              deleteTransactionMutation.mutate(tx);
                              setSelectedDayModal(null);
                            }
                          }}
                          data-testid={`button-delete-day-tx-${tx.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">{tx.categoryLabel}</span>
                      {tx.description && <span className="mr-2">• {tx.description}</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                      <span>{tx.paymentMethod}</span>
                      {tx.creditCardName && <span>• {tx.creditCardName}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tx.status === 'completed' ? 'הושלם' : 'ממתין'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Global Edit Transaction Dialog - for editing from calendar */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              עריכת תנועה
            </DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4">
              {editingTransaction.type === 'income' && (
                <>
                  <div className="p-2 bg-emerald-50 rounded-lg text-center">
                    <span className="text-emerald-700 font-medium flex items-center justify-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      עריכת הכנסה
                    </span>
                  </div>
                  <div>
                    <Label>פירוט *</Label>
                    <Input
                      value={editingTransaction.description}
                      onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>סכום *</Label>
                    <Input
                      type="number"
                      value={editingTransaction.amount}
                      onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </>
              )}
              {editingTransaction.type === 'expense' && (
                <>
                  <div className="p-2 bg-rose-50 rounded-lg text-center">
                    <span className="text-rose-700 font-medium flex items-center justify-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      עריכת הוצאה
                    </span>
                  </div>
                  <div>
                    <Label>סכום *</Label>
                    <Input
                      type="number"
                      value={editingTransaction.amount}
                      onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>תיאור</Label>
                    <Input
                      value={editingTransaction.description}
                      onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>קטגוריה</Label>
                    <Select
                      value={editingTransaction.categoryLabel} 
                      onValueChange={(v) => setEditingTransaction({...editingTransaction, categoryLabel: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(settings?.categories?.expense || ['כללי']).map((cat: string) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>תאריך</Label>
                <Input
                  type="date"
                  value={editingTransaction.date?.split('T')[0] || ''}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setEditingTransaction({
                      ...editingTransaction, 
                      date: formatLocalDate(newDate),
                      year: newDate.getFullYear(),
                      month: newDate.getMonth() + 1
                    });
                  }}
                />
              </div>
              <div>
                <Label>סטטוס</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={editingTransaction.status === "completed" ? "default" : "outline"}
                    onClick={() => {
                      const today = new Date();
                      setEditingTransaction({
                        ...editingTransaction, 
                        status: 'completed',
                        date: formatLocalDate(today),
                        year: today.getFullYear(),
                        month: today.getMonth() + 1
                      });
                    }}
                    className="flex-1"
                    size="sm"
                  >
                    הושלם
                  </Button>
                  <Button
                    type="button"
                    variant={editingTransaction.status === "pending" ? "default" : "outline"}
                    onClick={() => setEditingTransaction({...editingTransaction, status: 'pending'})}
                    className="flex-1"
                    size="sm"
                  >
                    ממתין
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingTransaction(null)}>ביטול</Button>
            <Button 
              onClick={() => {
                if (editingTransaction) {
                  updateTransactionMutation.mutate(editingTransaction);
                }
              }}
              disabled={updateTransactionMutation.isPending}
            >
              {updateTransactionMutation.isPending ? "שומר..." : "שמור שינויים"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
