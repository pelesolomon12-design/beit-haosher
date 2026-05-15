export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  streakCount: number;
  totalLessonsCompleted: number;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration: number; // in seconds
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  imageUrl?: string;
  enrolledCount: number;
}

export interface SkillTrack {
  id: string;
  title: string;
  description: string;
  totalLessons: number;
  completedLessons: number;
  progress: number; // percentage
  color: 'primary' | 'secondary' | 'accent';
  icon: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  requirement: number;
  progress?: number;
}

export interface UserProgress {
  lessonId: string;
  trackId?: string;
  completed: boolean;
  progress: number;
  completedAt?: Date;
}

export interface LessonTimer {
  duration: number;
  timeRemaining: number;
  isRunning: boolean;
  progress: number;
}
