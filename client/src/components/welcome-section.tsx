import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeSectionProps {
  user: {
    firstName: string;
  };
  weeklyProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  onStartLesson: () => void;
}

export function WelcomeSection({ user, weeklyProgress, onStartLesson }: WelcomeSectionProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <section className="mb-8">
      <div className="primary-gradient rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h2 className="text-2xl font-bold mb-2">
              {getGreeting()}, {user.firstName}!
            </h2>
            <p className="text-blue-100 mb-4">Ready for today's 5-minute business lesson?</p>
            
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path 
                    className="text-blue-300" 
                    stroke="currentColor" 
                    strokeWidth="3" 
                    fill="none" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path 
                    className="text-white" 
                    stroke="currentColor" 
                    strokeWidth="3" 
                    fill="none" 
                    strokeDasharray={`${weeklyProgress.percentage}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold">{weeklyProgress.percentage}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Weekly Progress</p>
                <p className="text-xs text-blue-100">
                  {weeklyProgress.completed} of {weeklyProgress.total} lessons completed
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <Button 
              onClick={onStartLesson}
              className="bg-white text-primary px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Today's Lesson
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
