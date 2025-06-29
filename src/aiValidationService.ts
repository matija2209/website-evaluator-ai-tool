import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config';
import { AIValidationRequest, AIValidationResult, SearchResult } from './types';

export class AIValidationService {
  private genAI: GoogleGenerativeAI;
  private lastRequestTime: number = 0;

  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is required for AI validation');
    }
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  /**
   * Main validation method - analyzes search results and selects the best company website match
   */
  async validateSearchResults(request: AIValidationRequest): Promise<AIValidationResult> {
    try {
      // Rate limiting - ensure minimum delay between requests
      await this.enforceRateLimit();

      const model = this.genAI.getGenerativeModel({ 
        model: config.gemini.model,
        generationConfig: {
          temperature: config.gemini.temperature,
          responseMimeType: "application/json",
          responseSchema: this.getValidationSchema()
        }
      });

      const prompt = this.buildValidationPrompt(request);
      
      console.log(`🤖 AI Validation: Analyzing ${request.searchResults.length} search results for "${request.companyName}"`);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      // Extract token usage for cost tracking
      const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
      console.log(`🪙 Tokens used: ${tokensUsed}`);

      const aiResponse = this.parseAIResponse(response.text(), tokensUsed);
      
      // Log the AI decision
      this.logValidationResult(request.companyName, aiResponse, request.searchResults);
      
      return aiResponse;

    } catch (error) {
      console.error('❌ AI Validation failed:', error);
      
      // Return a fallback result indicating failure
      return {
        selectedResultIndex: null,
        confidence: 0,
        reasoning: `AI validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isMatch: false,
        tokensUsed: 0,
        multipleValidFound: false
      };
    }
  }

  /**
   * Build the AI prompt for validating search results
   */
  private buildValidationPrompt(request: AIValidationRequest): string {
    const location = request.location;
    const businessActivity = request.businessActivity ? `\nBusiness Activity: ${request.businessActivity}` : '';
    
    let searchResultsText = '';
    request.searchResults.forEach((result, index) => {
      searchResultsText += `[${index}] Title: ${result.title}\n`;
      searchResultsText += `    URL: ${result.link}\n`;
      searchResultsText += `    Description: ${result.snippet}\n`;
      searchResultsText += `    Domain: ${result.displayLink}\n\n`;
    });

    return `You are validating Google search results to find the official company website.

Company Information:
Name: ${request.companyName}
Location: ${location}${businessActivity}

Search Results:
${searchResultsText}

VALIDATION CRITERIA:
✅ PREFER: 
- Official company domains (company name in domain)
- Business descriptions matching the company's activity
- Corporate websites with company information
- Professional business websites

❌ AVOID:
- News articles about the company
- Business directories (Yellow Pages, etc.)
- Job boards and recruitment sites
- Social media profiles (LinkedIn, Facebook, etc.)
- Review sites (Google Reviews, Yelp, etc.)
- Competitor websites
- Generic industry portals

INSTRUCTIONS:
1. Analyze each search result carefully
2. Select the INDEX (0-based) of the best official company website
3. If NO suitable official website is found, return null for selectedResultIndex
4. Provide confidence score (0.0 to 1.0) based on how certain you are
5. Explain your reasoning clearly
6. Set multipleValidFound to true if you found multiple good candidates

Return your response as JSON with the exact structure specified in the schema.`;
  }

  /**
   * Define the JSON schema for structured AI response
   */
  private getValidationSchema() {
    return {
      type: SchemaType.OBJECT,
      properties: {
        selectedResultIndex: {
          type: SchemaType.NUMBER,
          nullable: true,
          description: "0-based index of the selected result, or null if no suitable result"
        },
        confidence: {
          type: SchemaType.NUMBER,
          minimum: 0,
          maximum: 1,
          description: "Confidence score from 0.0 to 1.0"
        },
        reasoning: {
          type: SchemaType.STRING,
          description: "Explanation for the selection decision"
        },
        isMatch: {
          type: SchemaType.BOOLEAN,
          description: "Whether any suitable result was found"
        },
        multipleValidFound: {
          type: SchemaType.BOOLEAN, 
          description: "Whether multiple valid candidates were found"
        }
      },
      required: ["selectedResultIndex", "confidence", "reasoning", "isMatch", "multipleValidFound"]
    };
  }

  /**
   * Parse and validate the AI response
   */
  private parseAIResponse(responseText: string, tokensUsed: number): AIValidationResult {
    try {
      const parsed = JSON.parse(responseText);
      
      return {
        selectedResultIndex: parsed.selectedResultIndex,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // Clamp to 0-1
        reasoning: parsed.reasoning || 'No reasoning provided',
        isMatch: Boolean(parsed.isMatch),
        tokensUsed,
        multipleValidFound: Boolean(parsed.multipleValidFound)
      };
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      console.error('Raw response:', responseText);
      
      return {
        selectedResultIndex: null,
        confidence: 0,
        reasoning: 'Failed to parse AI response',
        isMatch: false,
        tokensUsed,
        multipleValidFound: false
      };
    }
  }

  /**
   * Enforce rate limiting - 2 requests per second maximum
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < config.gemini.rateLimitDelay) {
      const delayNeeded = config.gemini.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${delayNeeded}ms`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Log the validation result in a user-friendly format
   */
  private logValidationResult(
    companyName: string, 
    result: AIValidationResult, 
    searchResults: SearchResult[]
  ): void {
    const confidencePercent = Math.round(result.confidence * 100);
    
    if (result.isMatch && result.selectedResultIndex !== null) {
      const selectedResult = searchResults[result.selectedResultIndex];
      const serpPosition = result.selectedResultIndex + 1; // Convert to 1-based
      
      console.log(`🤖 AI Validation: ${companyName} → Result #${result.selectedResultIndex} (confidence: ${confidencePercent}%) [TOKENS: ${result.tokensUsed}]`);
      console.log(`✅ Selected: ${selectedResult.link} (SERP position: ${serpPosition}/${searchResults.length})`);
      console.log(`💡 Reasoning: ${result.reasoning}`);
      
      if (result.multipleValidFound) {
        console.log(`🔍 Note: Multiple valid results found, selected the best match`);
      }
    } else {
      console.log(`🤖 AI Validation: ${companyName} → No suitable results found [TOKENS: ${result.tokensUsed}]`);
      console.log(`❌ Reasoning: ${result.reasoning}`);
    }
  }
} 