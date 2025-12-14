/**
 * FILE PATH: backend/services/aiService.js
 * AI Service (SAFE INITIALIZATION)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import natural from 'natural';
import compromise from 'compromise';
import Session from '../models/Session.js';
import nlpService from './nlpService.js';

// =======================================
// SAFE AI CLIENT INITIALIZATION
// =======================================

let openai = null;
let anthropic = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI initialized');
} else {
  console.warn('⚠️ OpenAI disabled (OPENAI_API_KEY missing)');
}

if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('✅ Anthropic initialized');
} else {
  console.warn('⚠️ Anthropic disabled (ANTHROPIC_API_KEY missing)');
}

// =======================================
// NLP UTILITIES
// =======================================

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

// =======================================
// AI SERVICE CLASS
// =======================================

class AIService {
  constructor() {
    this.defaultModel = process.env.AI_MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = 2000;
  }

  // -------------------------------------------------------
  // SAFETY CHECK
  // -------------------------------------------------------
  ensureOpenAI() {
    if (!openai) {
      throw new Error('AI service not configured');
    }
  }

  // -------------------------------------------------------
  // POST SESSION ANALYSIS
  // -------------------------------------------------------
  async runPostSessionAnalysis(sessionId) {
    try {
      if (!openai) {
        console.warn('[AI] Skipping post-session analysis (AI disabled)');
        return;
      }

      const session = await Session.findById(sessionId);
      if (!session || session.is_active) return;

      const highlights = session.interactions
        .filter(i => i.type === 'highlight')
        .map(h => h.data.text)
        .join('\n');

      let summary = 'No highlights recorded';

      if (highlights.length > 0) {
        const result = await this.generateSummary(highlights);
        summary = result.summary;
      }

      session.ai_summary = summary;
      await session.save();

      console.log(`✅ AI analysis completed for ${sessionId}`);
    } catch (err) {
      console.error('❌ AI post-session analysis failed:', err.message);
    }
  }

  // -------------------------------------------------------
  // GENERATE QUESTIONS
  // -------------------------------------------------------
  async generateQuestions(text, difficulty = 'medium', count = 5) {
    this.ensureOpenAI();

    const response = await openai.chat.completions.create({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: 'You are an educational assistant.' },
        { role: 'user', content: text.substring(0, 3000) },
      ],
      max_tokens: this.maxTokens,
    });

    return response.choices[0].message.content;
  }

  // -------------------------------------------------------
  // GENERATE SUMMARY
  // -------------------------------------------------------
  async generateSummary(text) {
    this.ensureOpenAI();

    const response = await openai.chat.completions.create({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: 'Summarize the content.' },
        { role: 'user', content: text.substring(0, 4000) },
      ],
      max_tokens: 1500,
    });

    return { summary: response.choices[0].message.content };
  }
}

// =======================================
// EXPORTS
// =======================================

const aiService = new AIService();

export const runPostSessionAnalysis =
  aiService.runPostSessionAnalysis.bind(aiService);

export default aiService;
