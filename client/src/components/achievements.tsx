import { Flame, GraduationCap, Share, Trophy } from 'lucide-react';
import { Achievement } from '@/lib/types';

interface AchievementsProps {
  achievements: Achievement[];
}

export function Achievements({ achievements }: AchievementsProps) {
  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case 'fire': return <Flame className="w-6 h-6" />;
      case 'graduation-cap': return <GraduationCap className="w-6 h-6" />;
      case 'share': return <Share className="w-6 h-6" />;
      case 'trophy': return <Trophy className="w-6 h-6" />;
      default: return <Trophy className="w-6 h-6" />;
    }
  };

  const getAchievementColor = (color: string, unlocked: boolean) => {
    if (!unlocked) return 'bg-neutral-100 text-neutral-400';
    
    switch (color) {
      case 'accent': return 'bg-accent/10 text-accent';
      case 'primary': return 'bg-primary/10 text-primary';
      case 'secondary': return 'bg-secondary/10 text-secondary';
      default: return 'bg-neutral-100 text-neutral-500';
    }
  };

  return (
    <section className="mb-8">
      <h3 className="text-xl font-bold text-neutral-900 mb-6">Recent Achievements</h3>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((achievement) => (
          <div 
            key={achievement.id}
            className={`bg-white rounded-xl p-4 shadow-sm border border-neutral-100 text-center ${
              !achievement.unlocked ? 'opacity-50' : ''
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              getAchievementColor(achievement.color, achievement.unlocked)
            }`}>
              {getAchievementIcon(achievement.icon)}
            </div>
            <h4 className={`font-semibold text-sm ${
              achievement.unlocked ? 'text-neutral-900' : 'text-neutral-500'
            }`}>
              {achievement.title}
            </h4>
            <p className={`text-xs mt-1 ${
              achievement.unlocked ? 'text-neutral-600' : 'text-neutral-400'
            }`}>
              {achievement.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
