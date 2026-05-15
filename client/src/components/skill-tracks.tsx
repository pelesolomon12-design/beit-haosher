import { ChevronRight, TrendingUp, DollarSign, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SkillTrack } from '@/lib/types';

interface SkillTracksProps {
  tracks: SkillTrack[];
  onContinueTrack: (trackId: string) => void;
  onViewAll: () => void;
}

export function SkillTracks({ tracks, onContinueTrack, onViewAll }: SkillTracksProps) {
  const getTrackIcon = (icon: string) => {
    switch (icon) {
      case 'chart-line': return <TrendingUp className="w-5 h-5" />;
      case 'dollar-sign': return <DollarSign className="w-5 h-5" />;
      case 'users': return <Users className="w-5 h-5" />;
      default: return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getTrackGradient = (color: string) => {
    switch (color) {
      case 'primary': return 'from-primary to-blue-500';
      case 'secondary': return 'from-secondary to-emerald-500';
      case 'accent': return 'from-accent to-yellow-500';
      default: return 'from-primary to-blue-500';
    }
  };

  const getTrackBgColor = (color: string) => {
    switch (color) {
      case 'primary': return 'bg-primary/10 text-primary';
      case 'secondary': return 'bg-secondary/10 text-secondary';
      case 'accent': return 'bg-accent/10 text-accent';
      default: return 'bg-primary/10 text-primary';
    }
  };

  const getTrackButtonColor = (color: string) => {
    switch (color) {
      case 'primary': return 'bg-primary/10 text-primary hover:bg-primary/20';
      case 'secondary': return 'bg-secondary/10 text-secondary hover:bg-secondary/20';
      case 'accent': return 'bg-accent/10 text-accent hover:bg-accent/20';
      default: return 'bg-primary/10 text-primary hover:bg-primary/20';
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-neutral-900">Your Learning Tracks</h3>
        <Button 
          variant="ghost" 
          onClick={onViewAll}
          className="text-primary font-semibold text-sm hover:text-blue-600"
        >
          View All
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tracks.map((track) => (
          <div 
            key={track.id}
            className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className={`h-2 bg-gradient-to-r ${getTrackGradient(track.color)}`}></div>
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTrackBgColor(track.color)}`}>
                  {getTrackIcon(track.icon)}
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900">{track.title}</h4>
                  <p className="text-sm text-neutral-500">{track.totalLessons} lessons</p>
                </div>
              </div>
              
              <p className="text-neutral-600 text-sm mb-4">{track.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-neutral-500">Progress</span>
                <span className="text-sm font-medium text-neutral-900">
                  {track.completedLessons}/{track.totalLessons}
                </span>
              </div>
              
              <Progress value={track.progress} className="mb-4" />
              
              <Button 
                onClick={() => onContinueTrack(track.id)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${getTrackButtonColor(track.color)}`}
              >
                {track.progress > 0 ? 'Continue Learning' : 'Start Track'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
