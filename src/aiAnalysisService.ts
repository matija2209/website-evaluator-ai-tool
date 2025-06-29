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

export type DesignEra = 'EARLY_2000S' | 'MID_2000S' | 'LATE_2000S' | 'EARLY_2010S' | 'MID_2010S' | 'LATE_2010S' | 'EARLY_2020S' | 'MODERN_2020S';

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
  
  // Design age analysis
  designAge: {
    era: DesignEra;
    reasoning: string;
  };
  
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
    model: 'gemini-2.5-flash-lite-preview-06-17',
    temperature: 0.1,
    maxTokensPerAnalysis: 1500,
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

export function determineDesignEra(
  mobileAnalysis: any, 
  desktopAnalysis: any
): { era: DesignEra; reasoning: string } {
  const reasoningParts: string[] = [];
  let eraScore = 0; // Score to determine era (0-7 mapping to our 8 eras)
  
  // Extract design indicators with mobile priority (70%) and desktop (30%)
  const mobileWeight = 0.7;
  const desktopWeight = 0.3;
  
  // Analyze mobile indicators
  if (mobileAnalysis?.designIndicators) {
    const mobile = mobileAnalysis.designIndicators;
    
    // Layout approach scoring
    if (mobile.layoutApproach?.toLowerCase().includes('table')) {
      eraScore += 0 * mobileWeight;
      reasoningParts.push('table-based mobile layout suggests early 2000s approach');
    } else if (mobile.layoutApproach?.toLowerCase().includes('float')) {
      eraScore += 1 * mobileWeight;
      reasoningParts.push('float-based mobile layout indicates mid-2000s techniques');
    } else if (mobile.layoutApproach?.toLowerCase().includes('responsive') && !mobile.layoutApproach?.toLowerCase().includes('mobile-first')) {
      eraScore += 3 * mobileWeight;
      reasoningParts.push('responsive design without mobile-first suggests early 2010s');
    } else if (mobile.layoutApproach?.toLowerCase().includes('mobile-first')) {
      eraScore += 5 * mobileWeight;
      reasoningParts.push('mobile-first approach indicates mid-2010s or later');
    } else if (mobile.layoutApproach?.toLowerCase().includes('grid') || mobile.layoutApproach?.toLowerCase().includes('flexbox')) {
      eraScore += 6 * mobileWeight;
      reasoningParts.push('modern CSS Grid/Flexbox layout suggests 2020s design');
    }
    
    // Typography scoring
    if (mobile.typography?.toLowerCase().includes('web-safe')) {
      eraScore += 1 * mobileWeight;
      reasoningParts.push('web-safe fonts suggest early web design era');
    } else if (mobile.typography?.toLowerCase().includes('custom') || mobile.typography?.toLowerCase().includes('web font')) {
      eraScore += 4 * mobileWeight;
      reasoningParts.push('custom web fonts indicate 2010s design evolution');
    } else if (mobile.typography?.toLowerCase().includes('variable') || mobile.typography?.toLowerCase().includes('modern')) {
      eraScore += 7 * mobileWeight;
      reasoningParts.push('modern typography suggests contemporary design');
    }
    
    // Button style scoring
    if (mobile.buttonStyle?.toLowerCase().includes('basic') || mobile.buttonStyle?.toLowerCase().includes('simple')) {
      eraScore += 1 * mobileWeight;
      reasoningParts.push('basic button design suggests early web era');
    } else if (mobile.buttonStyle?.toLowerCase().includes('rounded') || mobile.buttonStyle?.toLowerCase().includes('gradient')) {
      eraScore += 3 * mobileWeight;
      reasoningParts.push('rounded/gradient buttons indicate 2010s design trends');
    } else if (mobile.buttonStyle?.toLowerCase().includes('flat')) {
      eraScore += 5 * mobileWeight;
      reasoningParts.push('flat button design suggests mid-2010s minimalist approach');
    } else if (mobile.buttonStyle?.toLowerCase().includes('interactive') || mobile.buttonStyle?.toLowerCase().includes('modern')) {
      eraScore += 7 * mobileWeight;
      reasoningParts.push('modern interactive buttons indicate contemporary design');
    }
  }
  
  // Analyze desktop indicators (similar logic with desktop weight)
  if (desktopAnalysis?.designIndicators) {
    const desktop = desktopAnalysis.designIndicators;
    
    // Layout approach scoring
    if (desktop.layoutApproach?.toLowerCase().includes('table')) {
      eraScore += 0 * desktopWeight;
      reasoningParts.push('table-based desktop layout confirms early 2000s era');
    } else if (desktop.layoutApproach?.toLowerCase().includes('float')) {
      eraScore += 1 * desktopWeight;
      reasoningParts.push('float-based desktop layout indicates CSS evolution period');
    } else if (desktop.layoutApproach?.toLowerCase().includes('framework') || desktop.layoutApproach?.toLowerCase().includes('bootstrap')) {
      eraScore += 4 * desktopWeight;
      reasoningParts.push('CSS framework usage suggests 2010s development');
    } else if (desktop.layoutApproach?.toLowerCase().includes('grid') || desktop.layoutApproach?.toLowerCase().includes('flexbox')) {
      eraScore += 6 * desktopWeight;
      reasoningParts.push('modern CSS Grid/Flexbox on desktop confirms 2020s approach');
    }
    
    // Overall aesthetic scoring
    if (desktop.overallAesthetic?.toLowerCase().includes('skeuomorphic')) {
      eraScore += 2 * desktopWeight;
      reasoningParts.push('skeuomorphic design elements suggest late 2000s era');
    } else if (desktop.overallAesthetic?.toLowerCase().includes('flat')) {
      eraScore += 5 * desktopWeight;
      reasoningParts.push('flat design aesthetic indicates 2010s design philosophy');
    } else if (desktop.overallAesthetic?.toLowerCase().includes('material')) {
      eraScore += 6 * desktopWeight;
      reasoningParts.push('material design elements suggest mid-2010s Google influence');
    } else if (desktop.overallAesthetic?.toLowerCase().includes('minimalist') || desktop.overallAesthetic?.toLowerCase().includes('modern')) {
      eraScore += 7 * desktopWeight;
      reasoningParts.push('modern minimalist aesthetic indicates contemporary design');
    }
  }
  
  // Fallback to analysis scores if no design indicators
  if (reasoningParts.length === 0) {
    const mobileScore = mobileAnalysis?.overall || 0;
    const desktopScore = desktopAnalysis?.overall || 0;
    const combinedScore = mobileScore * 0.7 + desktopScore * 0.3;
    
    if (combinedScore < 30) {
      eraScore = 1; // Likely outdated
      reasoningParts.push('very low design scores suggest outdated design era');
    } else if (combinedScore < 50) {
      eraScore = 3; // Early 2010s
      reasoningParts.push('moderate design scores suggest early 2010s era');
    } else if (combinedScore < 70) {
      eraScore = 5; // Mid 2010s
      reasoningParts.push('good design scores suggest mid-2010s era');
    } else {
      eraScore = 6; // Modern
      reasoningParts.push('high design scores suggest modern design era');
    }
  }
  
  // Map score to era
  const eras: DesignEra[] = [
    'EARLY_2000S',    // 0
    'MID_2000S',      // 1
    'LATE_2000S',     // 2
    'EARLY_2010S',    // 3
    'MID_2010S',      // 4
    'LATE_2010S',     // 5
    'EARLY_2020S',    // 6
    'MODERN_2020S'    // 7
  ];
  
  const eraIndex = Math.min(7, Math.max(0, Math.round(eraScore)));
  const era = eras[eraIndex];
  
  return {
    era,
    reasoning: reasoningParts.join('. ') || 'Design era estimated based on overall analysis quality'
  };
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

5. DESIGN ERA INDICATORS:
- Layout approach (table-based, float-based, flexbox, grid, mobile-first vs responsive)
- Typography style (web-safe fonts vs custom fonts vs modern typography)
- Color scheme sophistication (basic colors vs gradients vs modern palettes)
- Button design (basic buttons vs rounded vs flat vs modern interactive)
- Overall aesthetic (skeuomorphic vs flat vs material vs modern minimalist)
- Mobile responsiveness approach (separate mobile site vs responsive vs mobile-first)

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
  "reasoning": "brief explanation",
  "designIndicators": {
    "layoutApproach": "description of layout technique used",
    "typography": "description of typography choices", 
    "colorScheme": "description of color usage and sophistication",
    "buttonStyle": "description of button design approach",
    "overallAesthetic": "description of overall design philosophy",
    "responsivenessApproach": "description of mobile responsiveness implementation"
  }
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

5. DESIGN ERA INDICATORS:
- Layout approach (table-based, float-based, flexbox, grid, CSS frameworks)
- Typography style (web-safe fonts vs custom fonts vs modern typography)
- Color scheme sophistication (basic colors vs gradients vs modern palettes)
- Button design (basic buttons vs rounded vs flat vs modern interactive)
- Overall aesthetic (skeuomorphic vs flat vs material vs modern minimalist)
- Framework usage (bootstrap, custom CSS, modern frameworks)

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
  "reasoning": "brief explanation",
  "designIndicators": {
    "layoutApproach": "description of layout technique used",
    "typography": "description of typography choices", 
    "colorScheme": "description of color usage and sophistication",
    "buttonStyle": "description of button design approach",
    "overallAesthetic": "description of overall design philosophy",
    "frameworkUsage": "description of CSS framework or custom approach"
  }
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
  
  // Step 8.5: Determine design age
  const designAge = determineDesignEra(mobileAnalysis, desktopAnalysis);
  
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
    analysisStatus,
    designAge
  };
  
  console.log(`Analysis completed for ${input.companyName}. Combined score: ${combinedScore}/100, Status: ${analysisStatus}`);
  
  return result;  
} 