import { useState, useEffect } from 'react';

export function useTimer() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return {
    time: currentTime.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit' 
    }),
    timeShort: currentTime.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    date: currentTime.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }),
    dateShort: currentTime.toLocaleDateString('he-IL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    })
  };
}