/**
 * FILE PATH: backend/services/nlpService.js
 * * Natural Language Processing service AND **STUDY ANALYTICS AGGREGATION**
 * (Refactored to include calculateFinalMetrics for session end processing)
 */

import natural from 'natural';
import compromise from 'compromise';
import Session from '../models/Session.js'; // ⭐️ Import Session model to fetch raw data

// (Existing imports and extensions are kept for full functionality)
import compromiseDates from 'compromise-dates';
import compromiseNumbers from 'compromise-numbers';
compromise.extend(compromiseDates);
compromise.extend(compromiseNumbers);

// Initialize NLP tools
const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const sentenceTokenizer = new natural.SentenceTokenizer();
const stemmer = natural.PorterStemmer;
const analyzer = new natural.SentimentAnalyzer('English', stemmer, 'afinn');

// Define constants used for metric calculation
const IDEAL_BLINK_RATE_MIN = 15;
const IDEAL_BLINK_RATE_MAX = 25;
const ENGAGEMENT_WEIGHTS = {
    attentionRate: 0.5,
    postureScore: 0.3,
    blinkRateCompliance: 0.2,
};


/**
 * NLP Service Class
 * * Includes statistical aggregation methods (e.g., calculateFinalMetrics)
 */
class NLPService {
  constructor() {
    // (Existing constructor content remains)
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    this.subjectKeywords = {
      mathematics: ['equation', 'theorem', 'proof', 'calculus', 'algebra', 'geometry', 'function', 'derivative', 'integral'],
      physics: ['force', 'energy', 'momentum', 'velocity', 'acceleration', 'quantum', 'particle', 'wave', 'motion'],
      chemistry: ['molecule', 'atom', 'reaction', 'compound', 'element', 'bond', 'solution', 'acid', 'base'],
      biology: ['cell', 'organism', 'dna', 'protein', 'evolution', 'species', 'tissue', 'gene', 'enzyme'],
      computerScience: ['algorithm', 'data', 'structure', 'function', 'variable', 'loop', 'array', 'class', 'object'],
      history: ['century', 'war', 'revolution', 'empire', 'dynasty', 'civilization', 'period', 'era', 'ancient'],
      literature: ['novel', 'poem', 'character', 'theme', 'narrative', 'author', 'plot', 'metaphor', 'symbolism'],
      economics: ['market', 'supply', 'demand', 'price', 'trade', 'economy', 'inflation', 'gdp', 'investment']
    };
  }

  // =======================================================
  // ⭐️ NEW METHOD: STATISTICAL AGGREGATION FOR SESSION END
  // =======================================================

  /**
   * Calculates a score (0-100) based on how compliant the blink rate is with the ideal range.
   * @param {number} blinkRate Average blink rate in BPM.
   * @returns {number} Compliance score (0 to 100).
   */
  _calculateBlinkCompliance(blinkRate) {
    if (blinkRate >= IDEAL_BLINK_RATE_MIN && blinkRate <= IDEAL_BLINK_RATE_MAX) {
        return 100;
    }
    const distanceToIdeal = Math.min(
        Math.abs(blinkRate - IDEAL_BLINK_RATE_MIN),
        Math.abs(blinkRate - IDEAL_BLINK_RATE_MAX)
    );
    const MAX_DISTANCE = 50;
    const penalty = Math.min(distanceToIdeal / MAX_DISTANCE, 1);
    return Math.max(0, 100 * (1 - penalty));
  };


  /**
   * ⭐️ Main function to process raw interactions into final, aggregate metrics.
   * Called by sessions.js when a session ends.
   * @param {string} sessionId The ID of the completed session.
   * @returns {Promise<object>} The final metrics object.
   */
  async calculateFinalMetrics(sessionId) {
    const session = await Session.findById(sessionId);
    if (!session) {
      console.warn(`[Metrics] Session ${sessionId} not found for final calculation.`);
      return {};
    }

    const interactions = session.interactions || [];
    const webcamMetrics = interactions.filter(i => i.type === 'webcam');
    
    if (webcamMetrics.length === 0) {
      return {
        engagementScore: 0,
        attentionRate: 0,
        avgBlinkRate: 0,
        distractionCount: 0,
        durationSeconds: session.duration_seconds || 0,
        totalMetricsRecorded: 0
      };
    }

    // --- Aggregation ---
    let totalMetrics = webcamMetrics.length;
    let focusedCount = 0;
    let postureScoreSum = 0;
    let totalBlinkRateSum = 0;
    let distractionCount = 0;
    let phoneDetectedFlag = false; 

    webcamMetrics.forEach(metric => {
        const data = metric.data;
        
        // 1. Attention
        if (data.lookingAtScreen) {
            focusedCount++;
        }

        // 2. Posture
        postureScoreSum += data.postureScore || 0; 
        
        // 3. Blink Rate (Use average of BPM values)
        totalBlinkRateSum += data.blinkRate || 0;
        
        // 4. Distractions (simple phone detection count)
        if (data.hasPhone && !phoneDetectedFlag) {
            distractionCount++;
            phoneDetectedFlag = true;
        } else if (!data.hasPhone) {
            phoneDetectedFlag = false;
        }
    });

    // --- Final Metric Calculation ---
    
    const attentionRate = Math.round((focusedCount / totalMetrics) * 100);
    const avgPostureScore = postureScoreSum / totalMetrics;
    const avgBlinkRate = Math.round(totalBlinkRateSum / totalMetrics); 
    const blinkComplianceScore = this._calculateBlinkCompliance(avgBlinkRate);

    // Composite Engagement Score
    const engagementScore = Math.round(
        (attentionRate * ENGAGEMENT_WEIGHTS.attentionRate) +
        (avgPostureScore * ENGAGEMENT_WEIGHTS.postureScore) +
        (blinkComplianceScore * ENGAGEMENT_WEIGHTS.blinkRateCompliance)
    );

    // --- Additional Interaction Metrics ---
    const highlights = interactions.filter(i => i.type === 'highlight');
    const pageTurns = interactions.filter(i => i.type === 'page_turn');

    const finalMetrics = {
      engagementScore: Math.min(100, Math.max(0, engagementScore)),
      attentionRate: attentionRate,
      avgPostureScore: Math.round(avgPostureScore),
      avgBlinkRate: avgBlinkRate,
      distractionCount: distractionCount,
      durationSeconds: session.duration_seconds || 0,
      totalMetricsRecorded: totalMetrics,
      
      // Document Interaction Metrics
      totalHighlights: highlights.length,
      pageTimeAnalytics: session.getPageTimeAnalytics(), // Use the schema method
      pagesVisited: Object.keys(session.getPageTimeAnalytics()).length,
    };

    return finalMetrics;
  }

  // =======================================================
  // (EXISTING NLP METHODS START HERE)
  // =======================================================

  /**
   * Extract keywords from text using TF-IDF
   */
  extractKeywords(text, count = 20) {
      // ... (Existing code) ...
      const tfidf = new TfIdf();
      
      // Preprocess text
      const cleanText = this.preprocessText(text);
      tfidf.addDocument(cleanText);

      // Get terms with their TF-IDF scores
      const keywords = [];
      tfidf.listTerms(0).forEach(item => {
        if (
          item.term.length > 2 && 
          !this.stopWords.has(item.term.toLowerCase()) &&
          !/^\d+$/.test(item.term) // Exclude pure numbers
        ) {
          keywords.push({
            term: item.term,
            score: item.tfidf.toFixed(4),
            importance: this.calculateImportance(item.tfidf)
          });
        }
      });

      return keywords.slice(0, count);
  }

  // ... (All other existing NLP methods: extractKeyPhrases, categorizeSubject, 
  // analyzeComplexity, extractEntities, analyzeSentiment, generateSummary, 
  // identifyTopics, calculateSimilarity, and all helper methods remain the same) ...
  
  extractKeyPhrases(text, count = 15) { /* ... */ }
  categorizeSubject(text) { /* ... */ }
  analyzeComplexity(text) { /* ... */ }
  extractEntities(text) { /* ... */ }
  analyzeSentiment(text) { /* ... */ }
  generateSummary(text, sentenceCount = 3) { /* ... */ }
  identifyTopics(text, topicCount = 5) { /* ... */ }
  calculateSimilarity(text1, text2) { /* ... */ }
  preprocessText(text) { /* ... */ }
  calculateImportance(score) { /* ... */ }
  isStopPhrase(phrase) { /* ... */ }
  classifyPhrase(phrase) { /* ... */ }
  countSyllables(text) { /* ... */ }
  countWordSyllables(word) { /* ... */ }
  getReadingLevel(gradeLevel) { /* ... */ }
  identifyTechnicalTerms(text) { /* ... */ }
  assessVocabularySophistication(diversity, complexRatio) { /* ... */ }
  getSentimentLabel(score) { /* ... */ }
  analyzeTone(text) { /* ... */ }
  calculateConfidence(score, totalWords) { /* ... */ }
  formatSubjectName(subject) { /* ... */ }
  getSimilarityLevel(score) { /* ... */ }
}

// Export the primary function directly for sessions.js to import
export const calculateFinalMetrics = new NLPService().calculateFinalMetrics;

// Export the default NLPService instance for other components
export default new NLPService();