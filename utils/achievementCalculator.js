// FILE PATH: backend/utils/achievementCalculator.js
// ✅ COMPLETE Achievement Calculator System

export const calculateAchievements = (sessions, metrics) => {
  const achievements = [];
  
  const totalHours = sessions.reduce((sum, s) => 
    sum + (s.duration_seconds || 0), 0
  ) / 3600;
  
  const avgEngagement = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / sessions.length
    : 0;
  
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  
  // Study Time Achievements
  if (totalHours >= 100) {
    achievements.push({
      id: 'century_scholar',
      icon: '🏆',
      title: 'Century Scholar',
      description: '100+ hours of focused study',
      category: 'time',
      level: 'gold',
      unlockedAt: new Date()
    });
  } else if (totalHours >= 50) {
    achievements.push({
      id: 'dedicated_learner',
      icon: '⭐',
      title: 'Dedicated Learner',
      description: '50+ hours of study time',
      category: 'time',
      level: 'silver',
      unlockedAt: new Date()
    });
  } else if (totalHours >= 10) {
    achievements.push({
      id: 'getting_started',
      icon: '📚',
      title: 'Getting Started',
      description: 'Completed 10 hours of study',
      category: 'time',
      level: 'bronze',
      unlockedAt: new Date()
    });
  }
  
  // Engagement Achievements
  if (avgEngagement >= 90) {
    achievements.push({
      id: 'excellence',
      icon: '🔥',
      title: 'Excellence',
      description: '90%+ average engagement',
      category: 'engagement',
      level: 'gold',
      unlockedAt: new Date()
    });
  } else if (avgEngagement >= 80) {
    achievements.push({
      id: 'high_performer',
      icon: '💪',
      title: 'High Performer',
      description: '80%+ average engagement',
      category: 'engagement',
      level: 'silver',
      unlockedAt: new Date()
    });
  }
  
  // Consistency Achievements
  if (completedSessions >= 50) {
    achievements.push({
      id: 'consistency_king',
      icon: '👑',
      title: 'Consistency King',
      description: '50+ sessions completed',
      category: 'consistency',
      level: 'gold',
      unlockedAt: new Date()
    });
  } else if (completedSessions >= 20) {
    achievements.push({
      id: 'regular_student',
      icon: '✅',
      title: 'Regular Student',
      description: '20+ sessions completed',
      category: 'consistency',
      level: 'silver',
      unlockedAt: new Date()
    });
  }
  
  // Streak Achievement
  const streak = calculateStreak(sessions);
  if (streak >= 7) {
    achievements.push({
      id: 'weekly_warrior',
      icon: '⚡',
      title: `${streak}-Day Streak`,
      description: 'Studied consistently every day',
      category: 'streak',
      level: streak >= 30 ? 'gold' : streak >= 14 ? 'silver' : 'bronze',
      unlockedAt: new Date()
    });
  }
  
  // Focus Achievement (low distractions)
  if (metrics && metrics.distraction_rate < 0.1) {
    achievements.push({
      id: 'laser_focus',
      icon: '🎯',
      title: 'Laser Focus',
      description: 'Less than 10% distraction rate',
      category: 'focus',
      level: 'gold',
      unlockedAt: new Date()
    });
  }
  
  return achievements;
};

const calculateStreak = (sessions) => {
  const dates = [...new Set(sessions.map(s => 
    new Date(s.start_time).toDateString()
  ))].sort((a, b) => new Date(b) - new Date(a));
  
  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.floor((prevDate - currDate) / 86400000);
      if (diffDays === 1) streak++;
      else break;
    }
  }
  
  return streak;
};