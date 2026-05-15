import { Facebook, Linkedin, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shareToLinkedIn, shareToTwitter, shareToFacebook, generateShareText } from '@/lib/social-share';

interface SocialSharingProps {
  user: {
    firstName: string;
    streakCount: number;
    totalLessonsCompleted: number;
  };
}

export function SocialSharing({ user }: SocialSharingProps) {
  const handleShareToLinkedIn = () => {
    const text = generateShareText(`${user.totalLessonsCompleted} business lessons completed!`);
    shareToLinkedIn(text);
  };

  const handleShareToTwitter = () => {
    const text = generateShareText(`${user.totalLessonsCompleted} business lessons completed!`);
    shareToTwitter(text);
  };

  const handleShareToFacebook = () => {
    shareToFacebook();
  };

  return (
    <section className="mb-8">
      <div className="secondary-gradient rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-bold mb-2">Share Your Progress</h3>
            <p className="text-emerald-100">
              Inspire other entrepreneurs by sharing your learning journey!
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              onClick={handleShareToLinkedIn}
              className="bg-white text-secondary px-4 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn
            </Button>
            
            <Button 
              onClick={handleShareToTwitter}
              className="bg-white text-secondary px-4 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors"
            >
              <Twitter className="w-4 h-4 mr-2" />
              Twitter
            </Button>
            
            <Button 
              onClick={handleShareToFacebook}
              className="bg-white text-secondary px-4 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors"
            >
              <Facebook className="w-4 h-4 mr-2" />
              Facebook
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
