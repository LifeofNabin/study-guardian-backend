/**
 * FILE PATH: backend/services/aiService.js
 * * AI Service for generating intelligent insights and content, 
 * including the post-session analysis workflow.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import natural from 'natural';
import compromise from 'compromise';
import Session from '../models/Session.js'; // ⭐️ NEW IMPORT: To fetch session data
import nlpService from './nlpService.js'; // ⭐️ NEW IMPORT: To use its aggregation and NLP features


// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// NLP utilities
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

/**
 * AI Service for generating intelligent insights and content
 */
class AIService {
  constructor() {
    this.defaultModel = process.env.AI_MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = 2000;
  }

  // =======================================================
  // ⭐️ NEW METHOD: POST-SESSION ANALYSIS WORKFLOW
  // =======================================================
  
  /**
   * Runs non-blocking, comprehensive analysis on a completed study session.
   * This is called by sessions.js/:sessionId/end.
   * @param {string} sessionId The ID of the session to analyze.
   */
  async runPostSessionAnalysis(sessionId) {
      console.log(`[AI Analysis] Starting post-session analysis for ${sessionId}`);
      
      try {
          const session = await Session.findById(sessionId);
          if (!session || session.is_active) {
              console.warn(`[AI Analysis] Session ${sessionId} not found or is still active.`);
              return;
          }

          // 1. Compile User-Generated Content (Highlights/Annotations)
          const highlightInteractions = session.interactions.filter(i => i.type === 'highlight');
          const studentHighlights = highlightInteractions
              .map(h => h.data.text)
              .filter(text => text && text.length > 0)
              .join('\n');
          
          // Fallback content for AI analysis (In a real system, you'd fetch the PDF content)
          // For now, we only use student highlights and notes for summary generation.
          
          let aiSummaryText = "The student completed a study session with no significant highlights or notes recorded.";

          if (studentHighlights.length > 0) {
              // 2. Generate Summary based on student's focus (highlights)
              const summaryResult = await this.generateSummary(studentHighlights, 'detailed');
              aiSummaryText = summaryResult.summary;
          }

          // 3. Generate Personalized Recommendations
          // The recommendations require both the final metrics and user preferences (which we must fetch)
          const userPreferences = { // ⭐️ Placeholder: In a full app, this comes from UserPreferences model
              learningStyle: 'visual',
              weakAreas: ['calculus', 'thermodynamics'],
              goals: 'score 90% on next exam',
          };
          
          const sessionDataForRecommendations = {
              engagementScore: session.metrics?.engagementScore || 0,
              studyDuration: (session.duration_seconds || 0) / 60,
              distractionCount: session.metrics?.distractionCount || 0,
              contentType: session.room_id ? 'Group Study' : 'Self Study',
          };

          const recommendations = await this.generateRecommendations(
              sessionDataForRecommendations,
              userPreferences
          );

          // 4. Update the Session model with results
          session.ai_summary = aiSummaryText;
          session.ai_recommendations = recommendations; // Assuming the Session model is updated to include this field
          
          await session.save();

          console.log(`✅ [AI Analysis] Session ${sessionId} successfully analyzed and updated.`);

      } catch (error) {
          console.error(`❌ [AI Analysis] Critical error during post-session analysis for ${sessionId}:`, error.message);
          // Non-critical failures are simply logged, as the main HTTP response already succeeded.
      }
  }


  // =======================================================
  // (EXISTING AI METHODS START HERE)
  // =======================================================

  /**
   * Generate study questions from PDF content
   */
  async generateQuestions(text, difficulty = 'medium', count = 5) {
      // ... (Existing code remains the same) ...
    try {
      const prompt = `Based on the following educational content, generate ${count} ${difficulty} difficulty questions that test comprehension and critical thinking.

Content:
${text.substring(0, 3000)}

Generate questions in the following JSON format:
{
  "questions": [
    {
      "question": "question text",
      "type": "multiple-choice|short-answer|true-false",
      "options": ["A", "B", "C", "D"], // only for multiple-choice
      "correctAnswer": "answer",
      "explanation": "why this is the answer",
      "difficulty": "${difficulty}",
      "topic": "main topic covered"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are an educational assistant that creates high-quality study questions.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.questions;
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error('Failed to generate questions');
    }
  }

  /**
   * Generate comprehensive summary of content
   */
  async generateSummary(text, summaryType = 'detailed') {
    // ... (Existing code remains the same) ...
    try {
      const summaryPrompts = {
        brief: 'Provide a brief 2-3 sentence summary',
        detailed: 'Provide a comprehensive summary with key points and main ideas',
        bullet: 'Provide a bullet-point summary of the main concepts',
        executive: 'Provide an executive summary suitable for quick review'
      };

      const prompt = `${summaryPrompts[summaryType] || summaryPrompts.detailed}:

Content:
${text.substring(0, 4000)}

Format your response as JSON:
{
  "summary": "summary text",
  "keyPoints": ["point 1", "point 2", ...],
  "mainTopics": ["topic 1", "topic 2", ...],
  "readingLevel": "beginner|intermediate|advanced",
  "estimatedReadTime": "X minutes"
}`;

      const response = await openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: 'You are an expert at summarizing educational content.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate summary');
    }
  }
  
  // ... (All other existing methods remain unchanged) ...
  async generateConceptMap(text) { /* ... */ }
  async analyzeDifficulty(text) { /* ... */ }
  async generateRecommendations(sessionData, userProfile) { /* ... */ }
  async generateFlashcards(text, count = 10) { /* ... */ }
  async generateSessionInsights(sessionMetrics) { /* ... */ }
  async generateFallbackInsights(sessionMetrics) { /* ... */ }
  extractKeyTerms(text) { /* ... */ }
  async generateStudyGuide(text, highlights, annotations) { /* ... */ }

}

// Export singleton instance and the required function
export const runPostSessionAnalysis = new AIService().runPostSessionAnalysis;

export default new AIService();