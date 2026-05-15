export const shareToLinkedIn = (text: string, url?: string) => {
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url || window.location.href)}`;
  window.open(shareUrl, '_blank', 'width=600,height=400');
};

export const shareToTwitter = (text: string, url?: string) => {
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url || window.location.href)}`;
  window.open(shareUrl, '_blank', 'width=600,height=400');
};

export const shareToFacebook = (url?: string) => {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url || window.location.href)}`;
  window.open(shareUrl, '_blank', 'width=600,height=400');
};

export const generateShareText = (lessonTitle: string, achievement?: string) => {
  if (achievement) {
    return `🎉 Just unlocked "${achievement}" on SkillBoost! Learning business skills 5 minutes at a time. #BusinessLearning #Entrepreneurship #SkillBoost`;
  }
  
  return `📚 Just completed "${lessonTitle}" on SkillBoost! Building my business skills one 5-minute lesson at a time. #BusinessLearning #Entrepreneurship #SkillBoost`;
};
