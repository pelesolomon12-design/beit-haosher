import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Minus, Edit, Trash2, Pill, User, Clock, CalendarDays, Save, X, Loader2, AlertTriangle, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Occupant, SelectMedication, SpecificTimesMap, SelectSosMedication } from "@shared/schema";

const TIME_OPTIONS = [
  { id: "morning", label: "בוקר", icon: "🌅", hours: ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00"] },
  { id: "noon", label: "צהריים", icon: "☀️", hours: ["12:00", "13:00", "14:00"] },
  { id: "afternoon", label: "אחה״צ", icon: "🌤️", hours: ["15:00", "16:00", "17:00", "18:00", "19:00"] },
  { id: "night", label: "לילה", icon: "🌙", hours: ["20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00", "04:00"] },
];


const DAYS_OF_WEEK = [
  { id: "ראשון", label: "א׳" },
  { id: "שני", label: "ב׳" },
  { id: "שלישי", label: "ג׳" },
  { id: "רביעי", label: "ד׳" },
  { id: "חמישי", label: "ה׳" },
  { id: "שישי", label: "ו׳" },
  { id: "שבת", label: "שבת" },
];

const getInitialFormData = () => ({
  name: "",
  dosage: "",
  timeOfDay: [] as string[],
  specificTimes: {} as SpecificTimesMap,
  scheduledDays: null as string[] | null,
  startDate: new Date().toISOString().split('T')[0],
  endDate: "",
  note: "",
  isActive: true,
});

export default function MedicationPatients() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<Occupant | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<SelectMedication | null>(null);
  const [deleteConfirmMed, setDeleteConfirmMed] = useState<SelectMedication | null>(null);
  const [nurseConfirmOpen, setNurseConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [nursePassword, setNursePassword] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [formModified, setFormModified] = useState(false);
  const [showTimeError, setShowTimeError] = useState(false);

  const [formData, setFormData] = useState(getInitialFormData());
  
  // SOS Catalog State
  const [sosCatalogOpen, setSosCatalogOpen] = useState(false);
  const [sosDialogOpen, setSosDialogOpen] = useState(false);
  const [editingSosMed, setEditingSosMed] = useState<SelectSosMedication | null>(null);
  const [deleteSosConfirm, setDeleteSosConfirm] = useState<SelectSosMedication | null>(null);
  const [sosFormData, setSosFormData] = useState({ name: "", description: "", cooldownHours: 0 });
  const [sosAllergiesOpen, setSosAllergiesOpen] = useState(false);
  const [showSosAuditLog, setShowSosAuditLog] = useState(false);

  // Track form modifications
  const updateFormData = useCallback((updater: (prev: typeof formData) => typeof formData) => {
    setFormData(prev => {
      const newData = updater(prev);
      setFormModified(true);
      return newData;
    });
  }, []);

  const { data: patients = [], isLoading: loadingPatients } = useQuery<Occupant[]>({
    queryKey: ["/api/occupants"],
  });

  const { data: patientMedications = [], isLoading: loadingMeds } = useQuery<SelectMedication[]>({
    queryKey: ["/api/medications/patient", selectedPatient?.id],
    enabled: !!selectedPatient,
  });
  
  // SOS Medications Catalog Query
  const { data: sosMedications = [], isLoading: loadingSosMeds } = useQuery<SelectSosMedication[]>({
    queryKey: ["/api/sos-medications"],
  });
  
  // Patient SOS Allergies Query
  const { data: patientAllergies = [] } = useQuery<{ id: string; patientId: string; sosMedicationId: string }[]>({
    queryKey: ["/api/patients", selectedPatient?.id, "sos-allergies"],
    enabled: !!selectedPatient,
  });
  
  const patientAllergyIds = patientAllergies.map(a => a.sosMedicationId);
  
  // SOS Audit Logs Query
  const { data: sosAuditLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/sos-medication-logs"],
    enabled: showSosAuditLog,
  });

  const invalidateMedicationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/medications/patient", selectedPatient?.id] });
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === "/api/medications/distribution";
      }
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/medications", data);
    },
    onSuccess: () => {
      invalidateMedicationQueries();
      toast({ title: "התרופה נוספה בהצלחה" });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בהוספת תרופה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/medications/${id}`, data);
    },
    onSuccess: () => {
      invalidateMedicationQueries();
      toast({ title: "התרופה עודכנה בהצלחה" });
      resetForm();
      setEditingMedication(null);
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בעדכון תרופה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/medications/${id}`);
    },
    onSuccess: () => {
      invalidateMedicationQueries();
      toast({ title: "התרופה נמחקה בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה במחיקת תרופה", description: error.message, variant: "destructive" });
    },
  });
  
  // SOS Medication Mutations
  const createSosMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; cooldownHours: number }) => {
      return await apiRequest("POST", "/api/sos-medications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medications"] });
      toast({ title: "תרופת SOS נוספה בהצלחה" });
      resetSosForm();
      setSosDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בהוספת תרופת SOS", description: error.message, variant: "destructive" });
    },
  });
  
  const updateSosMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; cooldownHours?: number } }) => {
      return await apiRequest("PATCH", `/api/sos-medications/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medications"] });
      toast({ title: "תרופת SOS עודכנה בהצלחה" });
      resetSosForm();
      setEditingSosMed(null);
      setSosDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בעדכון תרופת SOS", description: error.message, variant: "destructive" });
    },
  });
  
  const deleteSosMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sos-medications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medications"] });
      toast({ title: "תרופת SOS נמחקה בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה במחיקת תרופת SOS", description: error.message, variant: "destructive" });
    },
  });
  
  const resetSosForm = () => {
    setSosFormData({ name: "", description: "", cooldownHours: 0 });
  };
  
  const handleSosSubmit = () => {
    if (!sosFormData.name.trim()) {
      toast({ title: "יש להזין שם תרופה", variant: "destructive" });
      return;
    }
    
    // Directly execute - user is already authenticated to access this page
    if (editingSosMed) {
      updateSosMutation.mutate({ id: editingSosMed.id, data: sosFormData });
    } else {
      createSosMutation.mutate(sosFormData);
    }
  };
  
  const handleSosEdit = (med: SelectSosMedication) => {
    setSosFormData({
      name: med.name,
      description: med.description || "",
      cooldownHours: med.cooldownHours || 0,
    });
    setEditingSosMed(med);
    setSosDialogOpen(true);
  };
  
  const handleSosDelete = (med: SelectSosMedication) => {
    // Directly execute - user is already authenticated to access this page
    deleteSosMutation.mutate(med.id);
    setDeleteSosConfirm(null);
  };
  
  // Patient SOS Allergies Mutation
  const setAllergyMutation = useMutation({
    mutationFn: async (sosMedicationIds: string[]) => {
      if (!selectedPatient) return;
      return await apiRequest("PUT", `/api/patients/${selectedPatient.id}/sos-allergies`, { sosMedicationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", selectedPatient?.id, "sos-allergies"] });
      toast({ title: "אלרגיות SOS עודכנו בהצלחה" });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בעדכון אלרגיות", description: error.message, variant: "destructive" });
    },
  });
  
  const toggleAllergy = (sosMedicationId: string) => {
    requireNurseConfirmation(() => {
      const newAllergies = patientAllergyIds.includes(sosMedicationId)
        ? patientAllergyIds.filter(id => id !== sosMedicationId)
        : [...patientAllergyIds, sosMedicationId];
      setAllergyMutation.mutate(newAllergies);
    });
  };

  const resetForm = () => {
    setFormData(getInitialFormData());
    setFormModified(false);
    setShowTimeError(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsAddDialogOpen(true);
    } else {
      // Close requested - check for unsaved changes
      if (formModified) {
        // Close dialog first, then show confirmation
        setIsAddDialogOpen(false);
        setCloseConfirmOpen(true);
      } else {
        setIsAddDialogOpen(false);
        setEditingMedication(null);
        resetForm();
      }
    }
  };

  const handleCancelClick = () => {
    if (formModified) {
      // Close dialog first, then show confirmation
      setIsAddDialogOpen(false);
      setCloseConfirmOpen(true);
    } else {
      setIsAddDialogOpen(false);
      setEditingMedication(null);
      resetForm();
    }
  };

  const confirmCloseDialog = () => {
    // User confirmed - discard changes
    setCloseConfirmOpen(false);
    setFormModified(false);
    setEditingMedication(null);
    resetForm();
  };

  const cancelCloseDialog = () => {
    // User wants to continue editing - reopen the dialog
    setCloseConfirmOpen(false);
    setIsAddDialogOpen(true);
  };

  const handleTimeToggle = (timeId: string) => {
    setFormModified(true);
    setShowTimeError(false);
    setFormData(prev => {
      const isRemoving = prev.timeOfDay.includes(timeId);
      const newTimeOfDay = isRemoving
        ? prev.timeOfDay.filter(t => t !== timeId)
        : [...prev.timeOfDay, timeId];
      
      const newSpecificTimes = { ...prev.specificTimes };
      if (isRemoving) {
        delete newSpecificTimes[timeId as keyof SpecificTimesMap];
      }
      
      return {
        ...prev,
        timeOfDay: newTimeOfDay,
        specificTimes: newSpecificTimes,
      };
    });
  };

  const handleSpecificTimeToggle = (timeId: string, hour: string) => {
    setFormModified(true);
    setFormData(prev => {
      const newSpecificTimes = { ...prev.specificTimes };
      const currentValue = newSpecificTimes[timeId as keyof SpecificTimesMap];
      
      // Convert to array if it's a string (legacy single value)
      let currentHours: string[] = [];
      if (currentValue) {
        currentHours = Array.isArray(currentValue) ? [...currentValue] : [currentValue];
      }
      
      // Toggle the hour
      if (currentHours.includes(hour)) {
        currentHours = currentHours.filter(h => h !== hour);
      } else {
        currentHours.push(hour);
        // Sort by time
        currentHours.sort();
      }
      
      // Update or delete
      if (currentHours.length > 0) {
        newSpecificTimes[timeId as keyof SpecificTimesMap] = currentHours;
      } else {
        delete newSpecificTimes[timeId as keyof SpecificTimesMap];
      }
      
      return {
        ...prev,
        specificTimes: newSpecificTimes,
      };
    });
  };

  const isHourSelected = (timeId: string, hour: string): boolean => {
    const value = formData.specificTimes[timeId as keyof SpecificTimesMap];
    if (!value) return false;
    if (Array.isArray(value)) return value.includes(hour);
    return value === hour;
  };

  const getSelectedHoursDisplay = (timeId: string): string => {
    const value = formData.specificTimes[timeId as keyof SpecificTimesMap];
    if (!value) return "";
    if (Array.isArray(value)) return value.join(", ");
    return value;
  };

  const handleKeyDown = (e: React.KeyboardEvent, timeId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTimeToggle(timeId);
    }
  };
  
  // Get available hours for each time period
  const getHoursForTimeSlot = (timeId: string): string[] => {
    const option = TIME_OPTIONS.find(o => o.id === timeId);
    return option?.hours || [];
  };

  const requireNurseConfirmation = (action: () => void) => {
    setPendingAction(() => action);
    setNursePassword("");
    setNurseConfirmOpen(true);
  };

  const handleNurseConfirm = async () => {
    try {
      const response = await fetch("/api/medications/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nursePassword }),
      });

      if (!response.ok) {
        toast({ title: "סיסמה שגויה", variant: "destructive" });
        return;
      }

      if (pendingAction) {
        pendingAction();
      }
      setNurseConfirmOpen(false);
      setPendingAction(null);
    } catch (error) {
      toast({ title: "שגיאה באימות", variant: "destructive" });
    }
  };

  const handleSubmit = () => {
    if (!selectedPatient) {
      toast({ title: "יש לבחור מטופל", variant: "destructive" });
      return;
    }
    
    if (!formData.name.trim()) {
      toast({ title: "יש להזין שם תרופה", variant: "destructive" });
      return;
    }

    if (formData.timeOfDay.length === 0) {
      setShowTimeError(true);
      return;
    }

    if (formData.endDate && formData.startDate && formData.endDate <= formData.startDate) {
      toast({ title: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", variant: "destructive" });
      return;
    }

    const action = () => {
      const data = {
        patientId: selectedPatient.id,
        name: formData.name.trim(),
        dosage: formData.dosage || '',
        timeOfDay: formData.timeOfDay,
        specificTimes: Object.keys(formData.specificTimes).length > 0
          ? JSON.stringify(formData.specificTimes)
          : null,
        scheduledDays: formData.scheduledDays,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        note: formData.note,
        isActive: formData.isActive,
      };

      if (editingMedication) {
        updateMutation.mutate({ id: editingMedication.id, data });
      } else {
        createMutation.mutate(data);
      }
    };

    requireNurseConfirmation(action);
  };

  const handleEdit = (med: SelectMedication) => {
    let parsedSpecificTimes: SpecificTimesMap = {};
    if ((med as any).specificTimes) {
      try {
        parsedSpecificTimes = JSON.parse((med as any).specificTimes);
      } catch (e) {
        console.error("Error parsing specificTimes:", e);
      }
    }
    
    setFormData({
      name: med.name,
      dosage: med.dosage,
      timeOfDay: med.timeOfDay,
      specificTimes: parsedSpecificTimes,
      scheduledDays: (med as any).scheduledDays || null,
      startDate: new Date(med.startDate).toISOString().split('T')[0],
      endDate: med.endDate ? new Date(med.endDate).toISOString().split('T')[0] : "",
      note: med.note || "",
      isActive: med.isActive,
    });
    setEditingMedication(med);
    setFormModified(false);
    setIsAddDialogOpen(true);
  };

  const handleDelete = (med: SelectMedication) => {
    requireNurseConfirmation(() => {
      deleteMutation.mutate(med.id);
      setDeleteConfirmMed(null);
    });
  };

  const formatTimeOfDay = (times: string[], specificTimesJson?: string | null) => {
    let parsedTimes: SpecificTimesMap = {};
    if (specificTimesJson) {
      try {
        parsedTimes = JSON.parse(specificTimesJson);
      } catch (e) {}
    }
    
    return times.map(t => {
      const option = TIME_OPTIONS.find(o => o.id === t);
      const specificTime = parsedTimes[t as keyof SpecificTimesMap];
      if (option) {
        if (specificTime) {
          const hoursStr = Array.isArray(specificTime) ? specificTime.join(", ") : specificTime;
          return `${option.icon} ${option.label} (${hoursStr})`;
        }
        return `${option.icon} ${option.label}`;
      }
      return t;
    }).join(", ");
  };

  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 p-4 md:p-8" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <User className="h-6 w-6 sm:h-8 sm:w-8 text-teal-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-teal-800" data-testid="text-title">
                בחירת מטופל
              </h1>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => setShowSosAuditLog(true)}
                data-testid="button-sos-audit-log-header"
              >
                <ClipboardList className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">יומן SOS</span>
                <span className="sm:hidden">יומן</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-teal-600 hover:text-teal-800 hover:bg-teal-100"
                onClick={() => setLocation("/medications")}
                data-testid="button-back"
              >
                <ArrowRight className="h-5 w-5 ml-1" />
                חזרה
              </Button>
            </div>
          </div>

          {/* SOS Medications Catalog */}
          <Collapsible open={sosCatalogOpen} onOpenChange={setSosCatalogOpen} className="mb-6">
            <Card className="border-2 border-orange-200 bg-orange-50/50">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-orange-100/50 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-base text-orange-800">קטלוג תרופות SOS</CardTitle>
                      <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                        {sosMedications.length} תרופות
                      </span>
                    </div>
                    {sosCatalogOpen ? (
                      <ChevronUp className="h-5 w-5 text-orange-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-orange-600" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-orange-700">ניהול תרופות לשימוש SOS (חירום)</p>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => {
                        resetSosForm();
                        setEditingSosMed(null);
                        setSosDialogOpen(true);
                      }}
                      data-testid="button-add-sos-medication"
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      הוסף תרופה
                    </Button>
                  </div>
                  
                  {loadingSosMeds ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    </div>
                  ) : sosMedications.length === 0 ? (
                    <div className="text-center py-4 text-orange-600 text-sm">
                      לא הוגדרו תרופות SOS עדיין
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sosMedications.map(med => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-white border-orange-200"
                          data-testid={`sos-medication-${med.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <div>
                              <div className="font-medium">{med.name}</div>
                              {med.description && (
                                <div className="text-xs text-gray-500">{med.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-800"
                              onClick={() => handleSosEdit(med)}
                              data-testid={`button-edit-sos-${med.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              onClick={() => setDeleteSosConfirm(med)}
                              data-testid={`button-delete-sos-${med.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {loadingPatients ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-2" />
              <span>טוען מטופלים...</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {patients.map(patient => (
                <Card
                  key={patient.id}
                  className="cursor-pointer hover:shadow-lg transition-all border-2 border-gray-200 hover:border-teal-400"
                  onClick={() => setSelectedPatient(patient)}
                  data-testid={`card-patient-${patient.id}`}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 bg-teal-100 rounded-full">
                        <User className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-base sm:text-lg">{patient.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500">לחץ לצפייה בתרופות</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {/* SOS Medication Add/Edit Dialog - for patient selection view */}
          <Dialog open={sosDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setSosDialogOpen(false);
              setEditingSosMed(null);
              resetSosForm();
            }
          }}>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  {editingSosMed ? "עריכת תרופת SOS" : "הוספת תרופת SOS"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sos-name-select">שם התרופה *</Label>
                  <Input
                    id="sos-name-select"
                    value={sosFormData.name}
                    onChange={(e) => setSosFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="שם התרופה"
                    data-testid="input-sos-name-select"
                  />
                </div>
                <div>
                  <Label htmlFor="sos-description-select">תיאור</Label>
                  <Textarea
                    id="sos-description-select"
                    value={sosFormData.description}
                    onChange={(e) => setSosFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="תיאור התרופה (אופציונלי)"
                    data-testid="input-sos-description-select"
                  />
                </div>
                <div>
                  <Label htmlFor="sos-cooldown-select">זמן המתנה בין לקיחות (שעות)</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setSosFormData(prev => ({ ...prev, cooldownHours: Math.max(0, prev.cooldownHours - 1) }))}
                      data-testid="button-cooldown-decrease-select"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center bg-gray-50 border rounded-lg py-2 px-4 font-medium text-lg" data-testid="text-cooldown-value-select">
                      {sosFormData.cooldownHours}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setSosFormData(prev => ({ ...prev, cooldownHours: prev.cooldownHours + 1 }))}
                      data-testid="button-cooldown-increase-select"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">0 = ללא הגבלת זמן</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => {
                  setSosDialogOpen(false);
                  setEditingSosMed(null);
                  resetSosForm();
                }}>
                  ביטול
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={handleSosSubmit}
                  disabled={createSosMutation.isPending || updateSosMutation.isPending}
                  data-testid="button-save-sos-medication-select"
                >
                  {(createSosMutation.isPending || updateSosMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  {editingSosMed ? "עדכון" : "שמירה"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* SOS Medication Delete Confirmation - for patient selection view */}
          <AlertDialog open={!!deleteSosConfirm} onOpenChange={() => setDeleteSosConfirm(null)}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת תרופת SOS</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את תרופת SOS "{deleteSosConfirm?.name}"?
                  <br />
                  פעולה זו אינה ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600"
                  onClick={() => deleteSosConfirm && handleSosDelete(deleteSosConfirm)}
                >
                  מחיקה
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {/* SOS Audit Log Dialog - for patient selection view */}
          <Dialog open={showSosAuditLog} onOpenChange={setShowSosAuditLog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-700">
                  <ClipboardList className="h-5 w-5" />
                  יומן חלוקות SOS
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {sosAuditLogs.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">אין רשומות ביומן SOS</p>
                ) : (
                  sosAuditLogs.map((log: any, index: number) => {
                    const patient = patients.find(o => o.id === log.patientId);
                    const isOverridden = log.nurseOverride;
                    return (
                      <div
                        key={log.id || index}
                        className={`p-3 rounded-lg border ${
                          isOverridden 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-orange-50 border-orange-200'
                        }`}
                        data-testid={`sos-audit-log-${index}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{patient?.name || log.patientId}</span>
                          <span className="text-xs text-gray-500">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString('he-IL') : '-'}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className={`font-medium ${isOverridden ? 'text-red-700' : 'text-orange-700'}`}>
                            {log.sosMedicationName}
                          </span>
                          {log.responsibleName && (
                            <span className="mr-2 text-teal-600">
                              | אחות: {log.responsibleName}
                            </span>
                          )}
                        </div>
                        {isOverridden && (
                          <div className="text-xs text-red-700 mt-1 bg-red-100 p-2 rounded font-medium">
                            ⚠️ עקיפת זמן המתנה - אושר על ידי אחות
                          </div>
                        )}
                        {log.reason && (
                          <div className="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded">
                            📝 סיבה: {log.reason}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSosAuditLog(false)}>
                  סגור
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Pill className="h-6 w-6 sm:h-8 sm:w-8 text-teal-600" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-teal-800" data-testid="text-patient-name">
                {selectedPatient.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">ניהול תרופות</p>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Button
              size="sm"
              className="bg-teal-500 hover:bg-teal-600 text-white text-sm"
              onClick={() => {
                resetForm();
                setEditingMedication(null);
                setIsAddDialogOpen(true);
              }}
              data-testid="button-add-medication"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 ml-1" />
              <span className="hidden sm:inline">הוסף תרופה</span>
              <span className="sm:hidden">הוספה</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => setShowSosAuditLog(true)}
              data-testid="button-sos-audit-log-patient"
            >
              <ClipboardList className="h-4 w-4 ml-1" />
              <span className="hidden sm:inline">יומן SOS</span>
              <span className="sm:hidden">יומן</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-teal-300 text-teal-600 text-sm"
              onClick={() => setSelectedPatient(null)}
              data-testid="button-change-patient"
            >
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-1" />
              <span className="hidden sm:inline">החלף מטופל</span>
              <span className="sm:hidden">החלף</span>
            </Button>
          </div>
        </div>
        
        {/* Patient SOS Allergies Section */}
        {sosMedications.length > 0 && (
          <Collapsible open={sosAllergiesOpen} onOpenChange={setSosAllergiesOpen} className="mb-4">
            <Card className="border-2 border-red-200 bg-red-50/50">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-red-100/50 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-base text-red-800">אלרגיות לתרופות SOS</CardTitle>
                      {patientAllergyIds.length > 0 && (
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                          {patientAllergyIds.length} אלרגיות
                        </span>
                      )}
                    </div>
                    {sosAllergiesOpen ? (
                      <ChevronUp className="h-5 w-5 text-red-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  <p className="text-sm text-red-700 mb-3">
                    סמנו תרופות SOS שהמטופל אלרגי אליהן - הן לא יוצגו בחלוקה
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sosMedications.map(med => {
                      const isAllergic = patientAllergyIds.includes(med.id);
                      return (
                        <div
                          key={med.id}
                          role="checkbox"
                          aria-checked={isAllergic}
                          tabIndex={0}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isAllergic
                              ? 'bg-red-100 border-red-300'
                              : 'bg-white border-gray-200 hover:border-red-200'
                          }`}
                          onClick={() => toggleAllergy(med.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllergy(med.id); } }}
                          data-testid={`allergy-toggle-${med.id}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isAllergic ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'
                          }`}>
                            {isAllergic && <span className="text-white text-sm">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{med.name}</div>
                            {med.description && (
                              <div className="text-xs text-gray-500 truncate">{med.description}</div>
                            )}
                          </div>
                          {isAllergic && (
                            <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded flex-shrink-0">
                              אלרגי
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {loadingMeds ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500 mb-2" />
            <span>טוען תרופות...</span>
          </div>
        ) : patientMedications.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="py-12 text-center">
              <Pill className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">אין תרופות רשומות למטופל זה</p>
              <Button
                className="mt-4 bg-teal-500 hover:bg-teal-600 text-white"
                onClick={() => {
                  resetForm();
                  setEditingMedication(null);
                  setIsAddDialogOpen(true);
                }}
              >
                <Plus className="h-5 w-5 ml-2" />
                הוסף תרופה ראשונה
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {patientMedications.map(med => (
              <Card
                key={med.id}
                className={`border-2 ${med.isActive ? 'border-teal-200' : 'border-gray-200 opacity-60'}`}
                data-testid={`card-medication-${med.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${med.isActive ? 'bg-teal-100' : 'bg-gray-100'}`}>
                        <Pill className={`h-5 w-5 ${med.isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{med.name}</CardTitle>
                        <p className="text-sm text-gray-500">{med.dosage}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-teal-600 hover:text-teal-800"
                        onClick={() => handleEdit(med)}
                        data-testid={`button-edit-${med.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteConfirmMed(med)}
                        data-testid={`button-delete-${med.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTimeOfDay(med.timeOfDay, (med as any).specificTimes)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      <span>
                        מ-{new Date(med.startDate).toLocaleDateString('he-IL')}
                        {med.endDate && ` עד ${new Date(med.endDate).toLocaleDateString('he-IL')}`}
                      </span>
                    </div>
                    {(med as any).scheduledDays && (med as any).scheduledDays.length < 7 && (
                      <div className="flex items-center gap-1 text-teal-600">
                        <span>📅</span>
                        <span>{(med as any).scheduledDays.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  {med.note && (
                    <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                      {med.note}
                    </p>
                  )}
                  {!med.isActive && (
                    <div className="mt-2 text-xs text-orange-600 font-medium">
                      תרופה לא פעילה
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent
            className="max-w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto"
            dir="rtl"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-teal-600" />
                {editingMedication ? "עריכת תרופה" : "הוספת תרופה חדשה"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="med-name">שם התרופה *</Label>
                <Input
                  id="med-name"
                  value={formData.name}
                  onChange={(e) => { setFormModified(true); setFormData(prev => ({ ...prev, name: e.target.value })); }}
                  placeholder="לדוגמה: פרקסטין"
                  data-testid="input-medication-name"
                />
              </div>
              <div>
                <Label htmlFor="med-dosage">מינון</Label>
                <Input
                  id="med-dosage"
                  value={formData.dosage}
                  onChange={(e) => { setFormModified(true); setFormData(prev => ({ ...prev, dosage: e.target.value })); }}
                  placeholder="לדוגמה: 20mg (אופציונלי)"
                  data-testid="input-medication-dosage"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>ימי לקיחה</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormModified(true);
                      setFormData(prev => ({
                        ...prev,
                        scheduledDays: prev.scheduledDays === null
                          ? ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
                          : null,
                      }));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      formData.scheduledDays !== null
                        ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                        : "bg-white text-gray-500 border-gray-300 hover:border-teal-400 hover:text-teal-600"
                    }`}
                  >
                    <span>{formData.scheduledDays !== null ? "✓ ימים מוגדרים" : "ימים מוגדרים"}</span>
                  </button>
                </div>
                {formData.scheduledDays === null ? (
                  <p className="text-sm text-gray-400 text-right">כל יום (ברירת מחדל)</p>
                ) : (
                  <div className="flex gap-1.5 flex-wrap mt-1" dir="rtl">
                    {DAYS_OF_WEEK.map(day => {
                      const selected = formData.scheduledDays!.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            setFormModified(true);
                            setFormData(prev => {
                              const current = prev.scheduledDays || [];
                              const updated = current.includes(day.id)
                                ? current.filter(d => d !== day.id)
                                : [...current, day.id];
                              return { ...prev, scheduledDays: updated };
                            });
                          }}
                          className={`w-10 h-10 rounded-full text-sm font-medium transition-all border-2 ${
                            selected
                              ? "bg-teal-500 text-white border-teal-500"
                              : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>זמני מתן</Label>
                  {showTimeError && <span className="text-red-500 text-sm font-medium">יש לבחור לפחות זמן אחד</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {TIME_OPTIONS.map(option => {
                    const isSelected = formData.timeOfDay.includes(option.id);
                    return (
                      <div
                        key={option.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1 ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                        }`}
                        onClick={() => handleTimeToggle(option.id)}
                        onKeyDown={(e) => handleKeyDown(e, option.id)}
                        data-testid={`checkbox-time-${option.id}`}
                      >
                        <div className="flex items-center gap-2 pointer-events-none">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && <span className="text-white text-sm">✓</span>}
                          </div>
                          <span className="text-lg">{option.icon}</span>
                          <span className="text-sm">{option.label}</span>
                        </div>
                        {isSelected && (
                          <div className="mt-2 mr-7" onClick={(e) => e.stopPropagation()}>
                            <div className="text-xs text-gray-500 mb-1">בחר שעות (אופציונלי):</div>
                            <div className="flex flex-wrap gap-1">
                              {getHoursForTimeSlot(option.id).map(hour => {
                                const hourSelected = isHourSelected(option.id, hour);
                                return (
                                  <button
                                    key={hour}
                                    type="button"
                                    className={`px-2 py-1 text-xs rounded pointer-events-auto transition-colors ${
                                      hourSelected
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                    onClick={() => handleSpecificTimeToggle(option.id, hour)}
                                    data-testid={`hour-${option.id}-${hour}`}
                                  >
                                    {hour}
                                  </button>
                                );
                              })}
                            </div>
                            {getSelectedHoursDisplay(option.id) && (
                              <div className="text-xs text-teal-600 mt-1">
                                נבחרו: {getSelectedHoursDisplay(option.id)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="med-start">תאריך התחלה *</Label>
                  <Input
                    id="med-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => { setFormModified(true); setFormData(prev => ({ ...prev, startDate: e.target.value })); }}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="med-end">תאריך סיום</Label>
                  <Input
                    id="med-end"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate ? new Date(new Date(formData.startDate).getTime() + 86400000).toISOString().split('T')[0] : undefined}
                    onChange={(e) => { setFormModified(true); setFormData(prev => ({ ...prev, endDate: e.target.value })); }}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="med-note">הערות</Label>
                <Textarea
                  id="med-note"
                  value={formData.note}
                  onChange={(e) => { setFormModified(true); setFormData(prev => ({ ...prev, note: e.target.value })); }}
                  placeholder="הערות נוספות..."
                  data-testid="input-medication-note"
                />
              </div>
              <div 
                role="checkbox"
                aria-checked={formData.isActive}
                tabIndex={0}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 select-none"
                onClick={() => { setFormModified(true); setFormData(prev => ({ ...prev, isActive: !prev.isActive })); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFormModified(true); setFormData(prev => ({ ...prev, isActive: !prev.isActive })); } }}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  formData.isActive ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'
                }`}>
                  {formData.isActive && <span className="text-white text-sm">✓</span>}
                </div>
                <span>תרופה פעילה</span>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleCancelClick}
              >
                ביטול
              </Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-medication"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                {editingMedication ? "עדכון" : "שמירה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={closeConfirmOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>יש שינויים שלא נשמרו</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך לסגור? השינויים שביצעת יאבדו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={cancelCloseDialog}>המשך עריכה</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCloseDialog} className="bg-red-500 hover:bg-red-600">
                סגור ומחק שינויים
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteConfirmMed} onOpenChange={() => setDeleteConfirmMed(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת תרופה</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את התרופה "{deleteConfirmMed?.name}"?
                <br />
                פעולה זו אינה ניתנת לביטול.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600"
                onClick={() => deleteConfirmMed && handleDelete(deleteConfirmMed)}
              >
                מחיקה
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={nurseConfirmOpen} onOpenChange={setNurseConfirmOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🔐 אישור גישה
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                יש להזין סיסמה לאישור הפעולה
              </p>
              <Input
                type="password"
                value={nursePassword}
                onChange={(e) => setNursePassword(e.target.value)}
                placeholder="סיסמה"
                onKeyPress={(e) => e.key === "Enter" && handleNurseConfirm()}
                data-testid="input-nurse-password"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setNurseConfirmOpen(false)}>
                ביטול
              </Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600"
                onClick={handleNurseConfirm}
                data-testid="button-confirm-nurse"
              >
                אישור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* SOS Medication Add/Edit Dialog */}
        <Dialog open={sosDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setSosDialogOpen(false);
            setEditingSosMed(null);
            resetSosForm();
          }
        }}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                {editingSosMed ? "עריכת תרופת SOS" : "הוספת תרופת SOS"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sos-name">שם התרופה *</Label>
                <Input
                  id="sos-name"
                  value={sosFormData.name}
                  onChange={(e) => setSosFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="שם התרופה"
                  data-testid="input-sos-name"
                />
              </div>
              <div>
                <Label htmlFor="sos-description">תיאור</Label>
                <Textarea
                  id="sos-description"
                  value={sosFormData.description}
                  onChange={(e) => setSosFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="תיאור התרופה (אופציונלי)"
                  data-testid="input-sos-description"
                />
              </div>
              <div>
                <Label htmlFor="sos-cooldown">זמן המתנה בין לקיחות (שעות)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setSosFormData(prev => ({ ...prev, cooldownHours: Math.max(0, prev.cooldownHours - 1) }))}
                    data-testid="button-cooldown-decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center bg-gray-50 border rounded-lg py-2 px-4 font-medium text-lg" data-testid="text-cooldown-value">
                    {sosFormData.cooldownHours}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setSosFormData(prev => ({ ...prev, cooldownHours: prev.cooldownHours + 1 }))}
                    data-testid="button-cooldown-increase"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">0 = ללא הגבלת זמן</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => {
                setSosDialogOpen(false);
                setEditingSosMed(null);
                resetSosForm();
              }}>
                ביטול
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleSosSubmit}
                disabled={createSosMutation.isPending || updateSosMutation.isPending}
                data-testid="button-save-sos-medication"
              >
                {(createSosMutation.isPending || updateSosMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                {editingSosMed ? "עדכון" : "שמירה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* SOS Medication Delete Confirmation */}
        <AlertDialog open={!!deleteSosConfirm} onOpenChange={() => setDeleteSosConfirm(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת תרופת SOS</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את תרופת SOS "{deleteSosConfirm?.name}"?
                <br />
                פעולה זו אינה ניתנת לביטול.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600"
                onClick={() => deleteSosConfirm && handleSosDelete(deleteSosConfirm)}
              >
                מחיקה
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* SOS Audit Log Dialog - for selected patient view */}
        <Dialog open={showSosAuditLog} onOpenChange={setShowSosAuditLog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-700">
                <ClipboardList className="h-5 w-5" />
                יומן חלוקות SOS
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {sosAuditLogs.length === 0 ? (
                <p className="text-center py-8 text-gray-500">אין רשומות ביומן SOS</p>
              ) : (
                sosAuditLogs.map((log: any, index: number) => {
                  const patient = patients.find(o => o.id === log.patientId);
                  const isOverridden = log.nurseOverride;
                  return (
                    <div
                      key={log.id || index}
                      className={`p-3 rounded-lg border ${
                        isOverridden 
                          ? 'bg-red-50 border-red-300' 
                          : 'bg-orange-50 border-orange-200'
                      }`}
                      data-testid={`sos-audit-log-patient-${index}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{patient?.name || log.patientId}</span>
                        <span className="text-xs text-gray-500">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('he-IL') : '-'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className={`font-medium ${isOverridden ? 'text-red-700' : 'text-orange-700'}`}>
                          {log.sosMedicationName}
                        </span>
                        {log.responsibleName && (
                          <span className="mr-2 text-teal-600">
                            | אחות: {log.responsibleName}
                          </span>
                        )}
                      </div>
                      {isOverridden && (
                        <div className="text-xs text-red-700 mt-1 bg-red-100 p-2 rounded font-medium">
                          ⚠️ עקיפת זמן המתנה - אושר על ידי אחות
                        </div>
                      )}
                      {log.reason && (
                        <div className="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded">
                          📝 סיבה: {log.reason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSosAuditLog(false)}>
                סגור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
