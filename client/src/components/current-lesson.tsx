import { Play, Bookmark, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lesson } from '@/lib/types';

interface CurrentLessonProps {
  lesson: Lesson;
  onStartLesson: () => void;
  onBookmarkLesson: () => void;
}

export function CurrentLesson({ lesson, onStartLesson, onBookmarkLesson }: CurrentLessonProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <section className="mb-8">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-900">Today's Focus</h3>
            <Badge className="bg-secondary/10 text-secondary px-3 py-1 rounded-full">
              {Math.ceil(lesson.duration / 60)} min
            </Badge>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h4 className="text-xl font-bold text-neutral-900 mb-3">{lesson.title}</h4>
              <p className="text-neutral-600 mb-4">{lesson.description}</p>
              
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-accent" />
                  <span className="text-sm text-neutral-600 capitalize">{lesson.difficulty}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm text-neutral-600">
                    {lesson.enrolledCount.toLocaleString()} enrolled
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{lesson.category}</Badge>
                {lesson.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              {lesson.imageUrl ? (
                <img 
                  src={lesson.imageUrl} 
                  alt={lesson.title}
                  className="rounded-xl shadow-md w-full h-48 object-cover"
                />
              ) : (
                <div className="rounded-xl shadow-md w-full h-48 bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-2">
                      <Play className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm text-neutral-600">Business Lesson</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={onStartLesson}
              className="flex-1 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Lesson
            </Button>
            
            <Button 
              variant="outline"
              onClick={onBookmarkLesson}
              className="px-6 py-3 border-2 border-neutral-200 text-neutral-700 rounded-xl font-semibold hover:border-neutral-300"
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Save for Later
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
