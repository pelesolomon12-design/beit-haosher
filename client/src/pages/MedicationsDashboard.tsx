import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, ArrowRight, Pill } from "lucide-react";

export default function MedicationsDashboard() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Pill className="h-10 w-10 text-teal-600" />
            <h1 className="text-3xl font-bold text-teal-800" data-testid="text-title">
              ניהול תרופות
            </h1>
          </div>
          <Button
            variant="ghost"
            className="text-teal-600 hover:text-teal-800 hover:bg-teal-100"
            onClick={() => setLocation("/main")}
            data-testid="button-menu"
          >
            <ArrowRight className="h-5 w-5 ml-2" />
            לתפריט
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-teal-200 hover:border-teal-400 bg-white"
            onClick={() => setLocation("/medications/patients")}
            data-testid="card-patient-medications"
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-teal-100 rounded-xl">
                  <Users className="h-12 w-12 text-teal-600" />
                </div>
                <CardTitle className="text-2xl text-teal-800">
                  תרופות לפי מטופל
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-lg leading-relaxed">
                צפייה ועריכה של תרופות לכל מטופל.
                הוספה, עריכה ומחיקה של תרופות כולל זמני מתן ומינון.
              </p>
              <div className="mt-4 flex items-center text-teal-600 font-medium">
                <span>כניסה</span>
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-cyan-200 hover:border-cyan-400 bg-white"
            onClick={() => {
              sessionStorage.setItem('medication_access', 'full');
              setLocation("/medications/distribution");
            }}
            data-testid="card-distribution"
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-cyan-100 rounded-xl">
                  <ClipboardList className="h-12 w-12 text-cyan-600" />
                </div>
                <CardTitle className="text-2xl text-cyan-800">
                  לוח חלוקה
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-lg leading-relaxed">
                לוח חלוקת תרופות לפי זמנים.
                סימון תרופות שחולקו ומעקב אחר ביצוע.
              </p>
              <div className="mt-4 flex items-center text-cyan-600 font-medium">
                <span>כניסה</span>
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          מודול ניהול תרופות - בית האושר
        </div>
      </div>
    </div>
  );
}
