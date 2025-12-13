/**
 * Analytics Processor Utility for Backend
 * Processes session data and generates analytics/reports
 */

/**
 * Generate overall analytics for dashboard
 * Used by: routes/interactions.js - GET /api/interactions/analytics/overall
 */
export const generateOverallAnalytics = (completedSessions) => {
  if (!completedSessions || completedSessions.length === 0) {
    return {
      totalHours: 0,
      thisWeek: 0,
      avgEngagement: 0,
      completedSessions: 0,
      streak: 0,
      rank: 0,
    };
  }

  // Calculate total study hours
  const totalSeconds = completedSessions.reduce((sum, session) => {
    return sum + (session.duration_seconds || 0);
  }, 0);
  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

  // Calculate this week's study time
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const thisWeekSessions = completedSessions.filter(session => 
    new Date(session.start_time) >= oneWeekAgo
  );
  
  const thisWeekSeconds = thisWeekSessions.reduce((sum, session) => {
    return sum + (session.duration_seconds || 0);
  }, 0);
  const thisWeekHours = Math.round((thisWeekSeconds / 3600) * 10) / 10;

  // Calculate average engagement
  const engagementScores = completedSessions
    .map(s => s.metrics?.engagementScore || 0)
    .filter(score => score > 0);
  
  const avgEngagement = engagementScores.length > 0
    ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length)
    : 0;

  // Calculate study streak (consecutive days with at least one session)
  const streak = calculateStudyStreak(completedSessions);

  return {
    totalHours,
    thisWeek: thisWeekHours,
    avgEngagement,
    completedSessions: completedSessions.length,
    streak,
    rank: 0, // Implement leaderboard logic if needed
  };
};

/**
 * Calculate consecutive study days streak
 */
const calculateStudyStreak = (sessions) => {
  if (!sessions || sessions.length === 0) return 0;

  // Sort sessions by date (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.start_time) - new Date(a.start_time)
  );

  // Get unique study dates
  const studyDates = [...new Set(
    sortedSessions.map(s => new Date(s.start_time).toDateString())
  )].sort((a, b) => new Date(b) - new Date(a));

  if (studyDates.length === 0) return 0;

  // Check if studied today or yesterday (to maintain streak)
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (studyDates[0] !== today && studyDates[0] !== yesterday) {
    return 0; // Streak broken
  }

  let streak = 0;
  let expectedDate = new Date();

  for (const dateStr of studyDates) {
    const date = new Date(dateStr);
    const expectedDateStr = expectedDate.toDateString();

    if (dateStr === expectedDateStr) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break; // Streak broken
    }
  }

  return streak;
};

/**
 * Generate HTML report content for email
 * Used by: routes/interactions.js - POST /api/interactions/share-report
 */
export const generateReportContent = (session, aiInsights = null) => {
  const duration = session.duration_seconds 
    ? Math.round(session.duration_seconds / 60) 
    : 0;
  
  const metrics = session.metrics || {};
  const summary = session.summary || {};

  // Format dates
  const startTime = new Date(session.start_time).toLocaleString();
  const endTime = session.end_time 
    ? new Date(session.end_time).toLocaleString() 
    : 'Ongoing';

  // Build HTML report
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 10px;
          margin-bottom: 30px;
        }
        .section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 15px;
        }
        .metric-card {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #667eea;
        }
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
        }
        .metric-label {
          font-size: 14px;
          color: #666;
          margin-top: 5px;
        }
        .insights {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin-top: 20px;
        }
        .footer {
          text-align: center;
          color: #666;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Study Session Report</h1>
        <p><strong>Student:</strong> ${session.student_id?.name || 'Unknown'}</p>
        <p><strong>Subject:</strong> ${session.room_id?.title || session.subject || 'Self-Study'}</p>
        <p><strong>Date:</strong> ${startTime}</p>
      </div>

      <div class="section">
        <h2>Session Overview</h2>
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${duration} min</div>
            <div class="metric-label">Study Duration</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${metrics.engagementScore || 0}%</div>
            <div class="metric-label">Engagement Score</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${metrics.focusScore || 0}%</div>
            <div class="metric-label">Focus Score</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${summary.total_interactions || 0}</div>
            <div class="metric-label">Total Interactions</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Activity Breakdown</h2>
        <ul>
          <li><strong>Highlights:</strong> ${summary.highlights_count || 0}</li>
          <li><strong>Annotations:</strong> ${summary.annotations_count || 0}</li>
          <li><strong>Pages Viewed:</strong> ${summary.pages_viewed?.length || 0}</li>
          <li><strong>Active Time:</strong> ${summary.active_time_seconds ? Math.round(summary.active_time_seconds / 60) : 0} minutes</li>
        </ul>
      </div>

      ${aiInsights ? `
        <div class="insights">
          <h2>🤖 AI Insights</h2>
          <p>${aiInsights}</p>
        </div>
      ` : ''}

      ${session.ai_summary ? `
        <div class="section">
          <h2>Session Summary</h2>
          <p>${session.ai_summary}</p>
        </div>
      ` : ''}

      ${session.ai_recommendations && session.ai_recommendations.length > 0 ? `
        <div class="section">
          <h2>💡 Recommendations</h2>
          <ul>
            ${session.ai_recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="footer">
        <p>Generated by studyguardian Analytics System</p>
        <p><em>This report was automatically generated based on session data and AI analysis.</em></p>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
};

export default {
  generateOverallAnalytics,
  generateReportContent,
};