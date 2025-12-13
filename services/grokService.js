// backend/services/grokService.js

import axios from 'axios';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = 'grok-beta';

class GrokService {
  constructor() {
    this.apiKey = GROK_API_KEY;
    this.model = GROK_MODEL;
    
    if (!this.apiKey) {
      console.warn('⚠️  GROK_API_KEY not found. AI features will be disabled.');
    }
  }

  async makeRequest(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Grok API key not configured');
    }

    try {
      const response = await axios.post(
        GROK_API_URL,
        {
          model: options.model || this.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Grok API Error:', error.response?.data || error.message);
      throw new Error('Failed to get AI response');
    }
  }

  async generateSessionSummary(sessionData) {
    const { 
      duration, 
      presence_percentage, 
      average_posture_score, 
      total_highlights, 
      pages_visited, 
      total_distractions,
      engagement_score 
    } = sessionData;

    const messages = [
      {
        role: 'system',
        content: 'You are an educational AI assistant analyzing student study sessions. Provide concise, encouraging feedback.'
      },
      {
        role: 'user',
        content: `Generate a brief study session summary (2-3 sentences) based on:
- Duration: ${Math.round(duration / 60)} minutes
- Presence: ${presence_percentage}%
- Posture Score: ${average_posture_score}/100
- Highlights: ${total_highlights}
- Pages Visited: ${pages_visited}
- Distractions: ${total_distractions}
- Engagement: ${engagement_score}/100

Focus on strengths and one improvement suggestion.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 150 });
  }

  async generateRoutineRecommendations(routineData) {
    const { 
      subjects, 
      overall_progress, 
      total_target_hours, 
      total_actual_hours 
    } = routineData;

    const subjectDetails = subjects.map(s => 
      `${s.name}: ${s.actual_hours}/${s.target_hours}h (${s.progress_percentage}%)`
    ).join(', ');

    const messages = [
      {
        role: 'system',
        content: 'You are a study planning assistant. Provide practical, actionable study recommendations.'
      },
      {
        role: 'user',
        content: `Analyze this study routine and provide 2-3 brief recommendations:
- Overall Progress: ${overall_progress}%
- Total Hours: ${total_actual_hours}/${total_target_hours}
- Subjects: ${subjectDetails}

Suggest time management improvements or focus areas.`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 200 });
  }

  async categorizeHighlights(highlights) {
    if (!highlights || highlights.length === 0) {
      return { categories: [], summary: 'No highlights to analyze' };
    }

    const highlightText = highlights.slice(0, 50).join(', ');

    const messages = [
      {
        role: 'system',
        content: 'You are an AI that categorizes study highlights into topics. Return a JSON array of categories.'
      },
      {
        role: 'user',
        content: `Categorize these study highlights into 3-5 main topics: ${highlightText}
Return ONLY a JSON array like: ["Topic 1", "Topic 2", "Topic 3"]`
      }
    ];

    try {
      const response = await this.makeRequest(messages, { 
        temperature: 0.3,
        maxTokens: 100 
      });
      
      const categories = JSON.parse(response);
      return {
        categories: Array.isArray(categories) ? categories : [],
        summary: `Identified ${categories.length} key topics`
      };
    } catch (error) {
      console.error('Failed to parse categories:', error);
      return { categories: ['General Study'], summary: 'Unable to categorize' };
    }
  }

  async predictEngagement(webcamMetrics) {
    if (!webcamMetrics || webcamMetrics.length === 0) {
      return { prediction: 'insufficient_data', confidence: 0 };
    }

    const recentMetrics = webcamMetrics.slice(-10);
    const avgPresence = recentMetrics.filter(m => m.presence).length / recentMetrics.length;
    const avgAttention = recentMetrics.reduce((sum, m) => sum + (m.attention_score || 50), 0) / recentMetrics.length;

    const messages = [
      {
        role: 'system',
        content: 'You are an AI analyzing student engagement patterns. Predict engagement trend.'
      },
      {
        role: 'user',
        content: `Based on recent metrics:
- Presence Rate: ${(avgPresence * 100).toFixed(1)}%
- Avg Attention: ${avgAttention.toFixed(1)}/100

Predict engagement for next 10 minutes: "improving", "stable", or "declining". 
Return JSON: {"prediction": "...", "confidence": 0-100, "reason": "brief explanation"}`
      }
    ];

    try {
      const response = await this.makeRequest(messages, { 
        temperature: 0.5,
        maxTokens: 100 
      });
      
      return JSON.parse(response);
    } catch (error) {
      return { 
        prediction: 'stable', 
        confidence: 50, 
        reason: 'Using baseline prediction' 
      };
    }
  }

  async generateStudyTips(subject, performance) {
    const messages = [
      {
        role: 'system',
        content: 'You are a study coach providing personalized learning tips.'
      },
      {
        role: 'user',
        content: `Give 3 specific study tips for ${subject} based on ${performance}% progress. Keep it motivating and practical (max 100 words).`
      }
    ];

    return await this.makeRequest(messages, { maxTokens: 150 });
  }

  async suggestOptimalStudyTime(pastRoutines) {
    if (!pastRoutines || pastRoutines.length === 0) {
      return { 
        suggested_time: '18:00-20:00', 
        reason: 'Evening is typically productive for most students' 
      };
    }

    const routineData = pastRoutines.map(r => 
      `${r.study_times.start}-${r.study_times.end} (${r.overall_progress}% progress)`
    ).join(', ');

    const messages = [
      {
        role: 'system',
        content: 'You are a time management AI analyzing study patterns.'
      },
      {
        role: 'user',
        content: `Based on past study times: ${routineData}
Suggest optimal study time window. Return JSON: {"suggested_time": "HH:MM-HH:MM", "reason": "brief explanation"}`
      }
    ];

    try {
      const response = await this.makeRequest(messages, { 
        temperature: 0.4,
        maxTokens: 100 
      });
      
      return JSON.parse(response);
    } catch (error) {
      return { 
        suggested_time: '18:00-20:00', 
        reason: 'Default evening slot recommended' 
      };
    }
  }

  async suggestStrongPassword() {
    const messages = [
      {
        role: 'system',
        content: 'You are a security assistant.'
      },
      {
        role: 'user',
        content: 'Suggest one brief tip for creating a strong password (max 20 words).'
      }
    ];

    try {
      return await this.makeRequest(messages, { maxTokens: 50 });
    } catch (error) {
      return 'Use a mix of uppercase, lowercase, numbers, and symbols.';
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

// Create singleton instance
const grokService = new GrokService();

// Export individual methods for easy importing
export const generateSessionSummary = (data) => grokService.generateSessionSummary(data);
export const generateRoutineRecommendations = (data) => grokService.generateRoutineRecommendations(data);
export const categorizeHighlights = (highlights) => grokService.categorizeHighlights(highlights);
export const predictEngagement = (metrics) => grokService.predictEngagement(metrics);
export const generateStudyTips = (subject, performance) => grokService.generateStudyTips(subject, performance);
export const suggestOptimalStudyTime = (routines) => grokService.suggestOptimalStudyTime(routines);
export const suggestPassword = () => grokService.suggestStrongPassword();

// Also export the service instance as default
export default grokService;