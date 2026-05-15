import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import WeeklySchedule from "@/pages/WeeklySchedule";
import InventoryLogin from "@/pages/InventoryLogin";
import ShoppingList from "@/pages/ShoppingList";
import TargetInventory from "@/pages/TargetInventory";
import MedicationsDashboard from "@/pages/MedicationsDashboard";
import MedicationPatients from "@/pages/MedicationPatients";
import MedicationDistribution from "@/pages/MedicationDistribution";
import PatientShopping from "@/pages/PatientShopping";
import CashFlow from "@/pages/CashFlow";
import NotFound from "@/pages/not-found";
import InstallPrompt from "@/components/install-prompt";
import UpdatePrompt from "@/components/update-prompt";
import { useRealtime } from "@/hooks/use-realtime";

function Router() {
  return (
    <Switch>
      <Route path="/" component={InventoryLogin} />
      <Route path="/login" component={InventoryLogin} />
      <Route path="/main" component={Dashboard} />
      <Route path="/rooms" component={Home} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/weekly-schedule" component={WeeklySchedule} />
      <Route path="/shopping-list" component={ShoppingList} />
      <Route path="/target-inventory" component={TargetInventory} />
      <Route path="/medications" component={MedicationsDashboard} />
      <Route path="/medications/patients" component={MedicationPatients} />
      <Route path="/medications/distribution" component={MedicationDistribution} />
      <Route path="/patient-shopping" component={PatientShopping} />
      <Route path="/cashflow" component={CashFlow} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  // Initialize real-time updates
  useRealtime();
  
  return (
    <>
      <Toaster />
      <Router />
      <InstallPrompt />
      <UpdatePrompt />
    </>
  );
}

export default App;
