import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

// Enhanced Type Definitions for AI Analysis
export interface AnalysisInput {
  mobileScreenshotPath: string;   // path to section-1.jpeg in mobile folder
  desktopScreenshotPath: string;  // path to section-1.jpeg in desktop folder  
  websiteUrl: string;
  companyActivity: string;        // from CSV Activity field
  companyName: string;            // for context
}

export interface ScoreBreakdown {
  overall: number;         // 0-100
  visualDesign: number;    // 0-40
  technical: number;       // 0-30  
  content: number;         // 0-20
  userExperience: number;  // 0-10
}

export interface WebsiteAnalysisResult {
  // Individual scores
  mobileScore: ScoreBreakdown;
  desktopScore: ScoreBreakdown;
  
  // Combined results (mobile 70% + desktop 30%)
  combinedScore: number;
  sophisticationLevel: 'SUPER_OUTDATED' | 'QUITE_OUTDATED' | 'COULD_IMPROVE' | 'GOOD_ENOUGH' | 'EXCELLENT';
  opportunityLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  
  // Recommendations
  mobileIssues: string[];
  desktopIssues: string[];
  quickWins: string[];           // Easy improvements
  majorUpgrades: string[];       // Significant changes needed
  
  // Metadata
  confidence: number;            // 0-100
  reasoning: string;
  tokensUsed: {
    mobileAnalysis: number;
    desktopAnalysis: number;
    total: number;
  };
  analysisStatus: 'SUCCESS' | 'PARTIAL_MOBILE_ONLY' | 'PARTIAL_DESKTOP_ONLY' | 'FAILED';
}

export type SophisticationLevel = 'SUPER_OUTDATED' | 'QUITE_OUTDATED' | 'COULD_IMPROVE' | 'GOOD_ENOUGH' | 'EXCELLENT';
export type OpportunityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// Analysis Configuration
export const analysisConfig = {
  imageCompression: {
    maxWidthDesktop: 1200,
    maxWidthMobile: 800,
    jpegQuality: 80
  },
  scoring: {
    mobileWeight: 0.7,
    desktopWeight: 0.3
  },
  gemini: {
    model: 'gemini-2.0-flash-exp',
    temperature: 0.1,
    maxTokensPerAnalysis: 1000,
    rateLimitDelay: 500
  },
  processing: {
    batchSize: 1,  // conservative for image analysis
    maxRetries: 2
  }
};

// Image Processing Functions
export async function compressImageForAnalysis(
  imagePath: string, 
  targetType: 'mobile' | 'desktop'
): Promise<string> {
  try {
    // Check if file exists
    await fs.access(imagePath);
    
    const maxWidth = targetType === 'mobile' 
      ? analysisConfig.imageCompression.maxWidthMobile 
      : analysisConfig.imageCompression.maxWidthDesktop;
    
    // Compress and convert to base64
    const compressedBuffer = await sharp(imagePath)
      .resize({
        width: maxWidth,
        height: undefined,
        withoutEnlargement: true
      })
      .jpeg({
        quality: analysisConfig.imageCompression.jpegQuality
      })
      .toBuffer();
    
    return compressedBuffer.toString('base64');
  } catch (error) {
    console.error(`Error compressing image ${imagePath}:`, error);
    throw new Error(`Failed to compress image: ${imagePath}`);
  }
}

export async function validateScreenshotFiles(input: AnalysisInput): Promise<{
  mobileExists: boolean;
  desktopExists: boolean;
  canProceed: boolean; // true if at least one exists
}> {
  const mobileExists = fs.access(input.mobileScreenshotPath).then(() => true).catch(() => false);
  const desktopExists = fs.access(input.desktopScreenshotPath).then(() => true).catch(() => false);
  
  const [mobile, desktop] = await Promise.all([mobileExists, desktopExists]);
  
  return {
    mobileExists: mobile,
    desktopExists: desktop,
    canProceed: mobile || desktop
  };
}

// Score Combination & Assessment Functions
export function calculateCombinedScore(mobileScore: number, desktopScore: number): number {
  return Math.round(mobileScore * analysisConfig.scoring.mobileWeight + desktopScore * analysisConfig.scoring.desktopWeight);
}

export function assessSophisticationLevel(score: number): SophisticationLevel {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD_ENOUGH'; 
  if (score >= 50) return 'COULD_IMPROVE';
  if (score >= 30) return 'QUITE_OUTDATED';
  return 'SUPER_OUTDATED';
}

export function assessOpportunityLevel(score: number): OpportunityLevel {
  if (score < 40) return 'HIGH';
  if (score < 65) return 'MEDIUM';
  if (score < 80) return 'LOW';
  return 'NONE';
}

// Delay utility for rate limiting
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to clean Gemini response and extract JSON
function cleanGeminiResponse(text: string): string {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  
  // Remove ```json and ``` if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  return cleaned.trim();
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(config.google.apiKey);

// Gemini Analysis Functions
export async function analyzeMobileScreenshot(
  imageBase64: string,
  websiteUrl: string, 
  companyActivity: string,
  companyName: string
): Promise<{ analysis: ScoreBreakdown & { issues: string[]; recommendations: string[]; confidence: number; reasoning: string }; tokensUsed: number }> {
  
  const mobileAnalysisPrompt = `
You are analyzing the MOBILE version of a website's header/hero section for redesign opportunities.

COMPANY: ${companyName}
BUSINESS: ${companyActivity}  
WEBSITE: ${websiteUrl}

Analyze this mobile screenshot and provide scores (0-100 scale) for:

1. VISUAL DESIGN (0-40 points):
- Mobile-first design approach vs desktop-cramming
- Touch-friendly button sizes and spacing  
- Mobile typography readability
- Visual hierarchy for small screens
- Brand presentation on mobile

2. TECHNICAL IMPLEMENTATION (0-30 points):
- True mobile responsiveness indicators
- Mobile navigation patterns (hamburger, etc.)
- Touch-optimized interactions
- Mobile loading performance signs
- Mobile-specific UI components

3. CONTENT QUALITY (0-20 points):
- Mobile content hierarchy and scanability
- Appropriate information density
- Clear value proposition on mobile
- Readable text without zooming

4. USER EXPERIENCE (0-10 points):  
- One-handed usability
- Thumb-friendly navigation zones
- Clear mobile call-to-actions
- Mobile conversion path clarity

Respond with valid JSON only:
{
  "visualDesign": <score 0-40>,
  "technical": <score 0-30>, 
  "content": <score 0-20>,
  "userExperience": <score 0-10>,
  "overall": <total score 0-100>,
  "issues": ["issue1", "issue2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "confidence": <0-100>,
  "reasoning": "brief explanation"
}`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: analysisConfig.gemini.model,
      generationConfig: {
        temperature: analysisConfig.gemini.temperature,
        maxOutputTokens: analysisConfig.gemini.maxTokensPerAnalysis
      }
    });

    const result = await model.generateContent([
      mobileAnalysisPrompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean and parse JSON response
    const cleanedText = cleanGeminiResponse(text);
    const analysisData = JSON.parse(cleanedText);
    
    // Validate and structure the response
    const analysis = {
      visualDesign: Math.min(40, Math.max(0, analysisData.visualDesign || 0)),
      technical: Math.min(30, Math.max(0, analysisData.technical || 0)),
      content: Math.min(20, Math.max(0, analysisData.content || 0)),
      userExperience: Math.min(10, Math.max(0, analysisData.userExperience || 0)),
      overall: Math.min(100, Math.max(0, analysisData.overall || 0)),
      issues: Array.isArray(analysisData.issues) ? analysisData.issues : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      confidence: Math.min(100, Math.max(0, analysisData.confidence || 0)),
      reasoning: analysisData.reasoning || 'No reasoning provided'
    };

    // Get token usage from response
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    
    await delay(analysisConfig.gemini.rateLimitDelay);
    
    return { analysis, tokensUsed };
    
  } catch (error) {
    console.error('Error analyzing mobile screenshot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Mobile analysis failed: ${errorMessage}`);
  }
}

export async function analyzeDesktopScreenshot(
  imageBase64: string,
  websiteUrl: string, 
  companyActivity: string,
  companyName: string
): Promise<{ analysis: ScoreBreakdown & { issues: string[]; recommendations: string[]; confidence: number; reasoning: string }; tokensUsed: number }> {
  
  const desktopAnalysisPrompt = `
You are analyzing the DESKTOP version of a website's header/hero section for redesign opportunities.

COMPANY: ${companyName}
BUSINESS: ${companyActivity}  
WEBSITE: ${websiteUrl}

Analyze this desktop screenshot and provide scores (0-100 scale) for:

1. VISUAL DESIGN (0-40 points):
- Modern desktop design principles
- Professional layout and composition
- Typography and visual hierarchy
- Brand consistency and presentation
- Use of whitespace and visual balance

2. TECHNICAL IMPLEMENTATION (0-30 points):
- Desktop navigation usability
- Layout structure and grid systems
- Interactive elements and hover states
- Desktop-specific features utilization
- Technical execution quality

3. CONTENT QUALITY (0-20 points):
- Content organization and structure
- Information architecture clarity
- Value proposition presentation
- Content readability and scanning

4. USER EXPERIENCE (0-10 points):  
- Desktop user flow optimization
- Call-to-action effectiveness
- Navigation intuitiveness
- Desktop conversion optimization

Respond with valid JSON only:
{
  "visualDesign": <score 0-40>,
  "technical": <score 0-30>, 
  "content": <score 0-20>,
  "userExperience": <score 0-10>,
  "overall": <total score 0-100>,
  "issues": ["issue1", "issue2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "confidence": <0-100>,
  "reasoning": "brief explanation"
}`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: analysisConfig.gemini.model,
      generationConfig: {
        temperature: analysisConfig.gemini.temperature,
        maxOutputTokens: analysisConfig.gemini.maxTokensPerAnalysis
      }
    });

    const result = await model.generateContent([
      desktopAnalysisPrompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean and parse JSON response
    const cleanedText = cleanGeminiResponse(text);
    const analysisData = JSON.parse(cleanedText);
    
    // Validate and structure the response
    const analysis = {
      visualDesign: Math.min(40, Math.max(0, analysisData.visualDesign || 0)),
      technical: Math.min(30, Math.max(0, analysisData.technical || 0)),
      content: Math.min(20, Math.max(0, analysisData.content || 0)),
      userExperience: Math.min(10, Math.max(0, analysisData.userExperience || 0)),
      overall: Math.min(100, Math.max(0, analysisData.overall || 0)),
      issues: Array.isArray(analysisData.issues) ? analysisData.issues : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      confidence: Math.min(100, Math.max(0, analysisData.confidence || 0)),
      reasoning: analysisData.reasoning || 'No reasoning provided'
    };

    // Get token usage from response
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    
    await delay(analysisConfig.gemini.rateLimitDelay);
    
    return { analysis, tokensUsed };
    
  } catch (error) {
    console.error('Error analyzing desktop screenshot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Desktop analysis failed: ${errorMessage}`);
  }
}

// Main Analysis Orchestrator
export async function analyzeWebsiteComplete(input: AnalysisInput): Promise<WebsiteAnalysisResult> {
  console.log(`Starting analysis for ${input.companyName} (${input.websiteUrl})`);
  
  // Step 1: Validate screenshot files exist
  const validation = await validateScreenshotFiles(input);
  
  if (!validation.canProceed) {
    throw new Error(`No screenshots found for analysis. Mobile: ${input.mobileScreenshotPath}, Desktop: ${input.desktopScreenshotPath}`);
  }
  
  let mobileAnalysis: any = null;
  let desktopAnalysis: any = null;
  let mobileTokens = 0;
  let desktopTokens = 0;
  let analysisStatus: 'SUCCESS' | 'PARTIAL_MOBILE_ONLY' | 'PARTIAL_DESKTOP_ONLY' | 'FAILED' = 'FAILED';
  
  // Step 2: Analyze mobile screenshot (if exists)
  if (validation.mobileExists) {
    try {
      console.log('Compressing mobile screenshot...');
      const mobileBase64 = await compressImageForAnalysis(input.mobileScreenshotPath, 'mobile');
      
      console.log('Analyzing mobile screenshot...');
      const mobileResult = await analyzeMobileScreenshot(
        mobileBase64,
        input.websiteUrl,
        input.companyActivity,
        input.companyName
      );
      
      mobileAnalysis = mobileResult.analysis;
      mobileTokens = mobileResult.tokensUsed;
      console.log(`Mobile analysis completed. Score: ${mobileAnalysis.overall}/100`);
      
    } catch (error) {
      console.error('Mobile analysis failed:', error);
      mobileAnalysis = null;
    }
  }
  
  // Step 3: Analyze desktop screenshot (if exists)
  if (validation.desktopExists) {
    try {
      console.log('Compressing desktop screenshot...');
      const desktopBase64 = await compressImageForAnalysis(input.desktopScreenshotPath, 'desktop');
      
      console.log('Analyzing desktop screenshot...');
      const desktopResult = await analyzeDesktopScreenshot(
        desktopBase64,
        input.websiteUrl,
        input.companyActivity,
        input.companyName
      );
      
      desktopAnalysis = desktopResult.analysis;
      desktopTokens = desktopResult.tokensUsed;
      console.log(`Desktop analysis completed. Score: ${desktopAnalysis.overall}/100`);
      
    } catch (error) {
      console.error('Desktop analysis failed:', error);
      desktopAnalysis = null;
    }
  }
  
  // Step 4: Determine analysis status
  if (mobileAnalysis && desktopAnalysis) {
    analysisStatus = 'SUCCESS';
  } else if (mobileAnalysis && !desktopAnalysis) {
    analysisStatus = 'PARTIAL_MOBILE_ONLY';
  } else if (!mobileAnalysis && desktopAnalysis) {
    analysisStatus = 'PARTIAL_DESKTOP_ONLY';
  } else {
    analysisStatus = 'FAILED';
    throw new Error('Both mobile and desktop analysis failed');
  }
  
  // Step 5: Create fallback scores for missing analyses
  const fallbackScore: ScoreBreakdown = {
    visualDesign: 0,
    technical: 0,
    content: 0,
    userExperience: 0,
    overall: 0
  };
  
  const mobileScore: ScoreBreakdown = mobileAnalysis ? {
    visualDesign: mobileAnalysis.visualDesign,
    technical: mobileAnalysis.technical,
    content: mobileAnalysis.content,
    userExperience: mobileAnalysis.userExperience,
    overall: mobileAnalysis.overall
  } : fallbackScore;
  
  const desktopScore: ScoreBreakdown = desktopAnalysis ? {
    visualDesign: desktopAnalysis.visualDesign,
    technical: desktopAnalysis.technical,
    content: desktopAnalysis.content,
    userExperience: desktopAnalysis.userExperience,
    overall: desktopAnalysis.overall
  } : fallbackScore;
  
  // Step 6: Calculate combined score
  const combinedScore = calculateCombinedScore(mobileScore.overall, desktopScore.overall);
  
  // Step 7: Generate unified recommendations
  const allMobileIssues = mobileAnalysis?.issues || [];
  const allDesktopIssues = desktopAnalysis?.issues || [];
  const allMobileRecs = mobileAnalysis?.recommendations || [];
  const allDesktopRecs = desktopAnalysis?.recommendations || [];
  
  // Categorize recommendations
  const quickWins: string[] = [];
  const majorUpgrades: string[] = [];
  
  // Simple categorization based on keywords
  [...allMobileRecs, ...allDesktopRecs].forEach(rec => {
    const lowerRec = rec.toLowerCase();
    if (lowerRec.includes('color') || lowerRec.includes('font') || lowerRec.includes('spacing') || 
        lowerRec.includes('button') || lowerRec.includes('text')) {
      quickWins.push(rec);
    } else {
      majorUpgrades.push(rec);
    }
  });
  
  // Step 8: Calculate overall confidence
  let confidence = 0;
  let confidenceCount = 0;
  
  if (mobileAnalysis) {
    confidence += mobileAnalysis.confidence;
    confidenceCount++;
  }
  if (desktopAnalysis) {
    confidence += desktopAnalysis.confidence;
    confidenceCount++;
  }
  
  confidence = confidenceCount > 0 ? Math.round(confidence / confidenceCount) : 0;
  
  // Reduce confidence for partial analyses
  if (analysisStatus.includes('PARTIAL')) {
    confidence = Math.round(confidence * 0.8);
  }
  
  // Step 9: Generate reasoning
  const reasoning = `Analysis based on ${analysisStatus === 'SUCCESS' ? 'both mobile and desktop' : 
    analysisStatus === 'PARTIAL_MOBILE_ONLY' ? 'mobile only' : 'desktop only'} screenshots. ` +
    `Combined score: ${combinedScore}/100. ${mobileAnalysis?.reasoning || desktopAnalysis?.reasoning || ''}`;
  
  const result: WebsiteAnalysisResult = {
    mobileScore,
    desktopScore,
    combinedScore,
    sophisticationLevel: assessSophisticationLevel(combinedScore),
    opportunityLevel: assessOpportunityLevel(combinedScore),
    mobileIssues: allMobileIssues,
    desktopIssues: allDesktopIssues,
    quickWins: [...new Set(quickWins)], // Remove duplicates
    majorUpgrades: [...new Set(majorUpgrades)], // Remove duplicates
    confidence,
    reasoning,
    tokensUsed: {
      mobileAnalysis: mobileTokens,
      desktopAnalysis: desktopTokens,
      total: mobileTokens + desktopTokens
    },
    analysisStatus
  };
  
  console.log(`Analysis completed for ${input.companyName}. Combined score: ${combinedScore}/100, Status: ${analysisStatus}`);
  
  return result;  
} 