import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Circle, ChevronLeft, ChevronRight, Pill, Clock, User, LogOut, ClipboardList, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MedicationDistributionItem, SelectSosMedication, Occupant } from "@shared/schema";

const TIME_SLOTS = [
  { id: "morning", label: "בוקר", icon: "🌅", color: "from-amber-100 to-orange-100", borderColor: "border-amber-300" },
  { id: "noon", label: "צהריים", icon: "☀️", color: "from-yellow-100 to-amber-100", borderColor: "border-yellow-400" },
  { id: "afternoon", label: "אחה״צ", icon: "🌤️", color: "from-orange-100 to-red-100", borderColor: "border-orange-300" },
  { id: "night", label: "לילה", icon: "🌙", color: "from-indigo-100 to-purple-100", borderColor: "border-indigo-300" },
];

// Helper to format hours as Hebrew human-readable text (e.g., "שעה ו-24 דקות")
function formatRemainingTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} דקות`;
  } else if (minutes === 0) {
    return hours === 1 ? 'שעה' : `${hours} שעות`;
  } else {
    const hoursText = hours === 1 ? 'שעה' : `${hours} שעות`;
    return `${hoursText} ו-${minutes} דקות`;
  }
}

export default function MedicationDistribution() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(getCurrentTimeSlot());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [responsibleName, setResponsibleName] = useState("");
  const [responsibleNotes, setResponsibleNotes] = useState("");
  const [selectedMedications, setSelectedMedications] = useState<Set<string>>(new Set());
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogDate, setAuditLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [unmarkConfirmOpen, setUnmarkConfirmOpen] = useState(false);
  const [pendingUnmark, setPendingUnmark] = useState<{ medicationId: string; patientId: string; specificHour: string | null } | null>(null);
  
  // SOS Distribution State
  const [sosDialogOpen, setSosDialogOpen] = useState(false);
  const [sosPatientId, setSosPatientId] = useState("");
  const [sosMedicationId, setSosMedicationId] = useState("");
  const [sosReason, setSosReason] = useState("");
  const [sosResponsible, setSosResponsible] = useState("");
  const [cooldownWarningOpen, setCooldownWarningOpen] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<{ lastDose: Date; cooldownHours: number; remainingHours: number } | null>(null);
  const [sosUnmarkOpen, setSosUnmarkOpen] = useState(false);
  const [pendingSosUnmark, setPendingSosUnmark] = useState<{ logId: string; medicationName: string } | null>(null);

  const accessMode = sessionStorage.getItem('medication_access') || 'distribution';
  const isFullAccess = accessMode === 'full';

  function getCurrentTimeSlot(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";      // 05:00 - 11:59 בוקר
    if (hour >= 12 && hour < 15) return "noon";        // 12:00 - 14:59 צהריים
    if (hour >= 15 && hour < 20) return "afternoon";   // 15:00 - 19:59 אחה״צ
    return "night";                                     // 20:00 - 04:59 לילה
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setSelectedTimeSlot(getCurrentTimeSlot());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const dateStr = selectedDate.toISOString().split('T')[0];

  const { data: distribution = [], isLoading, refetch } = useQuery<MedicationDistributionItem[]>({
    queryKey: ["/api/medications/distribution", dateStr, selectedTimeSlot],
  });

  const { data: auditLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/medication-logs/audit"],
    enabled: isFullAccess && showAuditLog,
  });
  
  // SOS Medications Queries
  const { data: occupants = [] } = useQuery<Occupant[]>({
    queryKey: ["/api/occupants"],
    enabled: sosDialogOpen,
  });
  
  const { data: sosMedications = [] } = useQuery<SelectSosMedication[]>({
    queryKey: ["/api/sos-medications"],
    enabled: sosDialogOpen,
  });
  
  const { data: patientSosAllergies = [] } = useQuery<{ id: string; patientId: string; sosMedicationId: string }[]>({
    queryKey: ["/api/patients", sosPatientId, "sos-allergies"],
    enabled: !!sosPatientId && sosDialogOpen,
  });
  
  
  // Query patient's SOS logs for cooldown checking
  const { data: patientSosLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/sos-medication-logs/patient", sosPatientId],
    enabled: !!sosPatientId && sosDialogOpen,
  });
  
  // Query all SOS logs for today to display in patient cards
  const { data: todaySosLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/sos-medication-logs/date", dateStr],
  });
  
  // Group SOS logs by patient ID for quick lookup
  const sosLogsByPatient: Record<string, any[]> = {};
  todaySosLogs.forEach((log: any) => {
    if (!sosLogsByPatient[log.patientId]) {
      sosLogsByPatient[log.patientId] = [];
    }
    sosLogsByPatient[log.patientId].push(log);
  });
  
  // Get available SOS medications for the selected patient (excluding allergies)
  const allergyIds = patientSosAllergies.map(a => a.sosMedicationId);
  const availableSosMeds = sosMedications.filter(m => m.isActive && !allergyIds.includes(m.id));
  
  // Check for cooldown violation when medication is selected
  const checkCooldown = (medicationId: string): { isViolation: boolean; lastDose?: Date; cooldownHours?: number; remainingHours?: number } => {
    const medication = sosMedications.find(m => m.id === medicationId);
    if (!medication || !medication.cooldownHours || medication.cooldownHours === 0) {
      return { isViolation: false };
    }
    
    const recentLog = patientSosLogs.find(log => log.sosMedicationId === medicationId);
    if (!recentLog) {
      return { isViolation: false };
    }
    
    const lastDose = new Date(recentLog.createdAt);
    const now = new Date();
    const hoursSinceLastDose = (now.getTime() - lastDose.getTime()) / (1000 * 60 * 60);
    const remainingHours = medication.cooldownHours - hoursSinceLastDose;
    
    if (hoursSinceLastDose < medication.cooldownHours) {
      return { 
        isViolation: true, 
        lastDose, 
        cooldownHours: medication.cooldownHours, 
        remainingHours: Math.ceil(remainingHours * 10) / 10 
      };
    }
    
    return { isViolation: false };
  };
  
  // SOS Distribution Mutation
  const sosDistributeMutation = useMutation({
    mutationFn: async (data: { patientId: string; sosMedicationId: string; sosMedicationName: string; date: string; reason: string; responsibleName: string; nurseOverride?: boolean }) => {
      return await apiRequest("POST", "/api/sos-medication-logs", data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medication-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medication-logs/patient", sosPatientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medication-logs/date", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/medication-logs/audit"] });
      // Force immediate refetch to show the SOS medication right away
      await refetch();
      toast({ title: "תרופת SOS חולקה בהצלחה" });
      resetSosForm();
      setSosDialogOpen(false);
      setCooldownWarningOpen(false);
      setCooldownInfo(null);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בחלוקת תרופת SOS", description: error.message, variant: "destructive" });
    },
  });
  
  // SOS Unmark (Delete) Mutation
  const sosUnmarkMutation = useMutation({
    mutationFn: async (logId: string) => {
      return await apiRequest("DELETE", `/api/sos-medication-logs/${logId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medication-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sos-medication-logs/date", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/medication-logs/audit"] });
      // Force immediate refetch
      await refetch();
      toast({ title: "לקיחת תרופת SOS בוטלה" });
      setSosUnmarkOpen(false);
      setPendingSosUnmark(null);
    },
    onError: (error: any) => {
      toast({ title: "שגיאה בביטול לקיחת תרופת SOS", description: error.message, variant: "destructive" });
    },
  });
  
  const resetSosForm = () => {
    setSosPatientId("");
    setSosMedicationId("");
    setSosReason("");
    setSosResponsible("");
    setCooldownInfo(null);
  };
  
  const executeSosDistribute = (isOverride: boolean = false) => {
    const medication = sosMedications.find(m => m.id === sosMedicationId);
    const patient = occupants.find(o => o.id === sosPatientId);
    sosDistributeMutation.mutate({
      patientId: sosPatientId,
      sosMedicationId,
      sosMedicationName: medication?.name || "",
      date: new Date().toISOString(),
      reason: sosReason.trim(),
      responsibleName: sosResponsible.trim(),
      nurseOverride: isOverride,
      patientName: patient?.name || "",
    } as any);
  };
  
  const handleSosDistribute = () => {
    if (!sosPatientId) {
      toast({ title: "יש לבחור מטופל", variant: "destructive" });
      return;
    }
    if (!sosMedicationId) {
      toast({ title: "יש לבחור תרופת SOS", variant: "destructive" });
      return;
    }
    if (!sosReason.trim()) {
      toast({ title: "יש להזין סיבה לחלוקה", variant: "destructive" });
      return;
    }
    if (!sosResponsible.trim()) {
      toast({ title: "יש להזין את שמך", variant: "destructive" });
      return;
    }
    
    // Check for cooldown violation
    const cooldownCheck = checkCooldown(sosMedicationId);
    if (cooldownCheck.isViolation && cooldownCheck.lastDose && cooldownCheck.cooldownHours && cooldownCheck.remainingHours) {
      setCooldownInfo({
        lastDose: cooldownCheck.lastDose,
        cooldownHours: cooldownCheck.cooldownHours,
        remainingHours: cooldownCheck.remainingHours,
      });
      setCooldownWarningOpen(true);
      return;
    }
    
    executeSosDistribute(false);
  };
  
  const handleResponsibleOverrideConfirm = () => {
    executeSosDistribute(true);
  };
  
  const closeCooldownWarning = () => {
    setCooldownWarningOpen(false);
    setCooldownInfo(null);
  };

  const markTakenMutation = useMutation({
    mutationFn: async ({ medicationId, patientId, taken, responsibleName, notes, specificHour }: { 
      medicationId: string; 
      patientId: string; 
      taken: boolean;
      responsibleName?: string;
      notes?: string;
      specificHour?: string | null;
    }) => {
      return await apiRequest("POST", "/api/medication-logs", {
        medicationId,
        patientId,
        date: dateStr,
        timeOfDay: selectedTimeSlot,
        specificHour: specificHour || null,
        taken,
        responsibleName,
        notes,
      });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/medication-logs/audit"] });
    },
    onError: (error: any) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const handleToggleMedication = (medicationId: string, patientId: string, currentlyTaken: boolean, specificTime?: string) => {
    if (currentlyTaken) {
      setPendingUnmark({ medicationId, patientId, specificHour: specificTime || null });
      setUnmarkConfirmOpen(true);
    } else {
      const newSelected = new Set(selectedMedications);
      const key = `${medicationId}|${patientId}|${specificTime || ''}`;
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      setSelectedMedications(newSelected);
    }
  };

  const handleOpenConfirmDialog = () => {
    if (selectedMedications.size === 0) {
      toast({ title: "יש לבחור תרופות לסימון", variant: "destructive" });
      return;
    }
    setResponsibleName("");
    setResponsibleNotes("");
    setConfirmOpen(true);
  };

  const handleConfirmMark = async () => {
    if (!responsibleName.trim()) {
      toast({ title: "יש להזין את שמך", variant: "destructive" });
      return;
    }

    const promises = Array.from(selectedMedications).map(key => {
      const parts = key.split('|');
      const medicationId = parts[0];
      const patientId = parts[1];
      const specificHour = parts[2] || null;
      return markTakenMutation.mutateAsync({
        medicationId,
        patientId,
        taken: true,
        responsibleName: responsibleName.trim(),
        notes: responsibleNotes.trim(),
        specificHour,
      });
    });

    try {
      await Promise.all(promises);
      toast({ title: "הצלחה", description: `${selectedMedications.size} תרופות סומנו` });
      setSelectedMedications(new Set());
      setConfirmOpen(false);
    } catch (error: any) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
  };

  const handleConfirmUnmark = () => {
    if (!pendingUnmark) return;

    markTakenMutation.mutate({
      medicationId: pendingUnmark.medicationId,
      patientId: pendingUnmark.patientId,
      taken: false,
      specificHour: pendingUnmark.specificHour,
    });

    setUnmarkConfirmOpen(false);
    setPendingUnmark(null);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[date.getDay()];
    return `יום ${dayName}, ${date.toLocaleDateString('he-IL')}`;
  };

  const handleExit = () => {
    sessionStorage.removeItem('medication_access');
    setLocation("/");
  };

  const handleBack = () => {
    if (isFullAccess) {
      setLocation("/main");
    }
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const currentSlot = TIME_SLOTS.find(s => s.id === selectedTimeSlot);

  const totalMedications = distribution.reduce((acc, p) => acc + p.medications.length, 0);
  const takenMedications = distribution.reduce((acc, p) => acc + p.medications.filter(m => m.taken).length, 0);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentSlot?.color || 'from-gray-100 to-gray-200'} p-4 md:p-8`} dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Pill className="h-6 w-6 sm:h-8 sm:w-8 text-teal-600" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800" data-testid="text-title">
              לוח חלוקת תרופות
            </h1>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            {isFullAccess && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/70 hover:bg-white/90 gap-1 text-sm"
                  onClick={() => setShowAuditLog(true)}
                  data-testid="button-audit-log"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">יומן פעולות</span>
                  <span className="sm:hidden">יומן</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800 hover:bg-white/50"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <ArrowRight className="h-5 w-5 ml-1" />
                  לתפריט
                </Button>
              </>
            )}
            {!isFullAccess && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800 hover:bg-white/50"
                onClick={handleExit}
                data-testid="button-exit"
              >
                <ArrowRight className="h-5 w-5 ml-1" />
                להתחברות
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(-1)}
            className="bg-white/70 h-8 w-8 sm:h-10 sm:w-10"
            data-testid="button-prev-day"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="text-center min-w-0 flex-1 sm:flex-none">
            <div className="text-sm sm:text-lg font-semibold truncate">{formatDate(selectedDate)}</div>
            {isToday && <div className="text-xs sm:text-sm text-teal-600 font-medium">היום</div>}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(1)}
            className="bg-white/70 h-8 w-8 sm:h-10 sm:w-10"
            data-testid="button-next-day"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          {!isToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="bg-white/70 text-xs sm:text-sm"
              data-testid="button-today"
            >
              היום
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 sm:mb-6">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.id}
              onClick={() => setSelectedTimeSlot(slot.id)}
              className={`p-3 sm:p-3 rounded-xl text-center transition-all ${
                selectedTimeSlot === slot.id
                  ? `bg-gradient-to-br ${slot.color} ${slot.borderColor} border-2 shadow-lg scale-105`
                  : 'bg-white/60 border border-gray-200 hover:bg-white/80'
              }`}
              data-testid={`button-time-${slot.id}`}
            >
              <div className="text-xl sm:text-2xl mb-1">{slot.icon}</div>
              <div className="text-sm font-medium">{slot.label}</div>
            </button>
          ))}
        </div>

        <div className="bg-white/80 rounded-xl p-3 mb-6 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {currentSlot?.icon} {currentSlot?.label}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="text-sm flex items-center gap-1">
              <span className="text-gray-400">ניתנו</span>
              <span dir="ltr" className="inline-flex">
                <span className="text-teal-600 font-bold">{takenMedications}</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{totalMedications}</span>
              </span>
            </div>
            <Button
              onClick={() => {
                resetSosForm();
                setSosDialogOpen(true);
              }}
              variant="outline"
              className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 gap-1"
              data-testid="button-sos-distribute"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">חלוקת SOS</span>
              <span className="sm:hidden">SOS</span>
            </Button>
            {selectedMedications.size > 0 && (
              <Button
                onClick={handleOpenConfirmDialog}
                className="bg-teal-500 hover:bg-teal-600 gap-2"
                data-testid="button-confirm-selected"
              >
                <CheckCircle2 className="h-4 w-4" />
                אישור ({selectedMedications.size})
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">טוען...</div>
        ) : distribution.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300 bg-white/60">
            <CardContent className="py-12 text-center">
              <Pill className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">אין תרופות לחלוקה בזמן זה</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {distribution.map(patient => (
              <Card
                key={patient.patientId}
                className={`border-2 bg-white/90 ${currentSlot?.borderColor}`}
                data-testid={`card-patient-${patient.patientId}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200">
                    <div className="p-2 bg-teal-100 rounded-full">
                      <User className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="font-semibold text-lg">{patient.patientName}</div>
                    <div className="text-sm text-gray-500 mr-auto flex items-center gap-1">
                      <span>ניתנו</span>
                      <span dir="ltr">{patient.medications.filter(m => m.taken).length}/{patient.medications.length}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {patient.medications.map((med, medIndex) => {
                      const isSelected = selectedMedications.has(`${med.id}|${patient.patientId}|${med.specificTime || ''}`);
                      const uniqueKey = `${med.id}-${med.specificTime || ''}-${medIndex}`;
                      return (
                        <div
                          key={uniqueKey}
                          className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                            med.taken
                              ? 'bg-green-50 border-green-300'
                              : isSelected
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`medication-${med.id}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`p-1.5 rounded-full flex-shrink-0 ${
                              med.taken ? 'bg-green-100' : isSelected ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <Pill className={`h-4 w-4 ${
                                med.taken ? 'text-green-600' : isSelected ? 'text-blue-600' : 'text-gray-500'
                              }`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm">{med.name}</div>
                              <div className="text-xs text-gray-500">
                                {med.dosage}
                                {med.isSos && med.sosTimestamp ? (
                                  <span className="mr-2 text-orange-600 font-medium">
                                    ⏰ {new Date(med.sosTimestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : med.specificTime && (
                                  <span className="mr-2 text-blue-600 font-medium">⏰ {med.specificTime}</span>
                                )}
                              </div>
                              {med.note && (
                                <div className="text-xs text-amber-600 mt-0.5 truncate" title={med.note}>
                                  📝 {med.note}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (med.isSos) {
                                setPendingSosUnmark({ logId: med.logId || med.id, medicationName: med.name });
                                setSosUnmarkOpen(true);
                              } else {
                                handleToggleMedication(med.id, patient.patientId, med.taken, med.specificTime);
                              }
                            }}
                            className={`p-2 rounded-full transition-all ${
                              med.isSos
                                ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer'
                                : med.taken
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : isSelected
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            disabled={markTakenMutation.isPending || sosUnmarkMutation.isPending}
                            data-testid={`button-toggle-${med.id}`}
                          >
                            {med.isSos ? (
                              <span className="text-sm">🆘</span>
                            ) : med.taken ? (
                              <Check className="h-5 w-5" />
                            ) : isSelected ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                ✍️ רישום אחות - {selectedMedications.size} תרופות
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                יש להזין את שמך כאחות לסימון התרופות שנבחרו
              </p>
              <div>
                <label className="text-sm font-medium mb-1 block">שם האחראי *</label>
                <Input
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="השם שלך"
                  data-testid="input-responsible-name"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">הערות</label>
                <Textarea
                  value={responsibleNotes}
                  onChange={(e) => setResponsibleNotes(e.target.value)}
                  placeholder="הערות נוספות (לא חובה)"
                  className="resize-none"
                  rows={3}
                  data-testid="input-responsible-notes"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                ביטול
              </Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600"
                onClick={handleConfirmMark}
                disabled={markTakenMutation.isPending}
                data-testid="button-confirm"
              >
                אישור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={unmarkConfirmOpen} onOpenChange={setUnmarkConfirmOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                ⚠️ ביטול סימון
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                האם אתה בטוח שברצונך לבטל את סימון לקיחת התרופה?
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setUnmarkConfirmOpen(false)}>
                לא
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                onClick={handleConfirmUnmark}
                disabled={markTakenMutation.isPending}
                data-testid="button-confirm-unmark"
              >
                כן, בטל סימון
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={sosUnmarkOpen} onOpenChange={setSosUnmarkOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                ⚠️ ביטול לקיחת תרופת SOS
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                האם אתה בטוח שברצונך לבטל את לקיחת {pendingSosUnmark?.medicationName}?
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSosUnmarkOpen(false)}>
                לא
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600"
                onClick={() => {
                  if (pendingSosUnmark) {
                    sosUnmarkMutation.mutate(pendingSosUnmark.logId);
                  }
                }}
                disabled={sosUnmarkMutation.isPending}
                data-testid="button-confirm-sos-unmark"
              >
                כן, בטל לקיחה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                יומן פעולות - סימון תרופות
              </DialogTitle>
            </DialogHeader>

            {/* בורר ימים */}
            <div className="space-y-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  const dateStr = d.toISOString().slice(0, 10);
                  const isSelected = auditLogDate === dateStr;
                  const isToday = i === 6;
                  const label = isToday ? "היום" : d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setAuditLogDate(dateStr)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-teal-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                type="date"
                value={auditLogDate}
                onChange={e => setAuditLogDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm text-gray-700"
              />
            </div>

            {/* תיעודים מחולקים לפי שעת היום */}
            <div className="space-y-4 mt-2">
              {(() => {
                const dayLogs = auditLogs.filter((log: any) => {
                  const logDate = log.takenAt
                    ? new Date(log.takenAt).toISOString().slice(0, 10)
                    : log.date?.slice(0, 10);
                  return logDate === auditLogDate;
                });

                if (dayLogs.length === 0) {
                  return <p className="text-center py-8 text-gray-500">אין רשומות ליום זה</p>;
                }

                return TIME_SLOTS.map(slot => {
                  const slotLogs = dayLogs.filter((log: any) => log.timeOfDay === slot.id);
                  if (slotLogs.length === 0) return null;
                  return (
                    <div key={slot.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{slot.icon}</span>
                        <span className="font-semibold text-gray-700">{slot.label}</span>
                        <span className="text-xs text-gray-400">({slotLogs.length} רשומות)</span>
                      </div>
                      <div className="space-y-2">
                        {slotLogs.map((log: any, index: number) => (
                          <div
                            key={log.id || index}
                            className="p-3 bg-gray-50 rounded-lg border"
                            data-testid={`audit-log-${index}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{log.patientName}</span>
                              <span className="text-xs text-gray-500">
                                {log.takenAt ? new Date(log.takenAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">{log.medicationName}</span>
                              {log.specificTime && (
                                <span className="mr-2 text-blue-600">({log.specificTime})</span>
                              )}
                              {log.responsibleName && (
                                <span className="mr-2 text-teal-600">| {log.responsibleName}</span>
                              )}
                            </div>
                            {log.notes && (
                              <div className="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded">
                                📝 {log.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAuditLog(false)}>
                סגור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* SOS Distribution Dialog */}
        <Dialog open={sosDialogOpen} onOpenChange={(open) => {
          if (!open) {
            resetSosForm();
          }
          setSosDialogOpen(open);
        }}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                חלוקת תרופת SOS
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sos-patient">בחר מטופל *</Label>
                <Select value={sosPatientId} onValueChange={(value) => {
                  setSosPatientId(value);
                  setSosMedicationId(""); // Reset medication when patient changes
                }}>
                  <SelectTrigger data-testid="select-sos-patient">
                    <SelectValue placeholder="בחר מטופל" />
                  </SelectTrigger>
                  <SelectContent>
                    {occupants.map(occupant => (
                      <SelectItem key={occupant.id} value={occupant.id}>
                        {occupant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="sos-medication">בחר תרופת SOS *</Label>
                {!sosPatientId ? (
                  <p className="text-sm text-gray-500 italic">יש לבחור מטופל קודם</p>
                ) : availableSosMeds.length === 0 ? (
                  <p className="text-sm text-red-500 italic">
                    אין תרופות SOS זמינות למטופל זה (כולן חסומות עקב אלרגיות)
                  </p>
                ) : (
                  <Select value={sosMedicationId} onValueChange={setSosMedicationId}>
                    <SelectTrigger data-testid="select-sos-medication">
                      <SelectValue placeholder="בחר תרופה" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSosMeds.map(med => (
                        <SelectItem key={med.id} value={med.id}>
                          {med.name} {med.description ? `(${med.description})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {allergyIds.length > 0 && sosPatientId && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ המטופל אלרגי ל-{allergyIds.length} תרופות SOS (מוסתרות מהרשימה)
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="sos-reason">סיבה לחלוקה *</Label>
                <Textarea
                  id="sos-reason"
                  value={sosReason}
                  onChange={(e) => setSosReason(e.target.value)}
                  placeholder="תאר את הסיבה לחלוקת התרופה..."
                  data-testid="input-sos-reason"
                />
              </div>
              
              <div>
                <Label htmlFor="sos-responsible">שם האחראי *</Label>
                <Input
                  id="sos-responsible"
                  value={sosResponsible}
                  onChange={(e) => setSosResponsible(e.target.value)}
                  placeholder="שם מלא"
                  data-testid="input-sos-responsible"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSosDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handleSosDistribute}
                disabled={sosDistributeMutation.isPending}
                data-testid="button-confirm-sos"
              >
                {sosDistributeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 ml-2" />
                )}
                אישור חלוקה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        
        {/* Cooldown Warning Dialog - higher z-index to appear above SOS dialog */}
        <Dialog open={cooldownWarningOpen} onOpenChange={(open) => {
          if (!open) {
            closeCooldownWarning();
          }
        }}>
          <DialogContent className="max-w-sm z-[9999]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                התרופה ניתנה לאחרונה
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {cooldownInfo && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span>⏰</span>
                    <span>המתנה נדרשת: {cooldownInfo.cooldownHours} שעות</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span>📅</span>
                    <span>לקיחה אחרונה: {cooldownInfo.lastDose.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-red-700">
                    <span>⚠️</span>
                    <span>נותרו: {formatRemainingTime(cooldownInfo.remainingHours)}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={closeCooldownWarning}
                className="w-full sm:w-auto"
              >
                הבנתי
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600 w-full sm:w-auto"
                onClick={handleResponsibleOverrideConfirm}
                disabled={sosDistributeMutation.isPending}
                data-testid="button-confirm-override"
              >
                {sosDistributeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 ml-2" />
                )}
                מאושר מהאחות
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
