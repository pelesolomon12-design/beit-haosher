import { useState, useEffect } from 'react';
import { X, Clock, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTimer } from '@/hooks/use-timer';
import { Lesson } from '@/lib/types';
import { generateShareText, shareToLinkedIn, shareToTwitter, shareToFacebook } from '@/lib/social-share';

interface LessonModalProps {
  lesson: Lesson | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (lessonId: string) => void;
}

export function LessonModal({ lesson, isOpen, onClose, onComplete }: LessonModalProps) {
  const { timer, start, complete, formatTime } = useTimer(lesson?.duration || 300);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (isOpen && lesson && !hasStarted) {
      start();
      setHasStarted(true);
    }
    
    if (!isOpen) {
      setHasStarted(false);
    }
  }, [isOpen, lesson, start, hasStarted]);

  const handleComplete = () => {
    if (lesson) {
      complete();
      onComplete(lesson.id);
      onClose();
    }
  };

  const handleShare = () => {
    if (lesson) {
      const text = generateShareText(lesson.title);
      shareToTwitter(text);
    }
  };

  if (!isOpen || !lesson) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-neutral-900">{lesson.title}</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <span className="text-2xl font-bold text-primary">
                {formatTime(timer.timeRemaining)}
              </span>
            </div>
            
            <div className="flex-1">
              <Progress value={timer.progress} className="h-2" />
            </div>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-6">
            <div className="bg-neutral-50 rounded-xl p-4">
              <h4 className="font-semibold text-neutral-900 mb-2">Key Takeaway</h4>
              <p className="text-neutral-700">
                {lesson.description}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-neutral-900 mb-3">Lesson Content:</h4>
              <div className="prose text-neutral-700" dangerouslySetInnerHTML={{ __html: lesson.content }} />
            </div>

            {lesson.tags.length > 0 && (
              <div>
                <h4 className="font-semibold text-neutral-900 mb-3">Topics Covered:</h4>
                <div className="flex flex-wrap gap-2">
                  {lesson.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6 border-t border-neutral-200 flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleComplete}
            className="flex-1 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600"
          >
            Complete Lesson
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleShare}
            className="px-6 py-3 border-2 border-neutral-200 text-neutral-700 rounded-xl font-semibold hover:border-neutral-300"
          >
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
