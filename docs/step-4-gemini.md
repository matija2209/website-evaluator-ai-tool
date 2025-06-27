Perfect! Those clarifications help a lot. Let me update the implementation plan with these specifics.

## **Phase 4: AI Analysis Module (`analyzeWebsite.ts`) - Final Implementation Plan**

### **Step 4.1: Environment Setup**

#### **4.1.1: Install Dependencies**
```bash
pnpm add @google/genai sharp  # sharp for image compression
```

### **Step 4.2: Define Response Schema Structure**

#### **4.2.1: Enhanced TypeScript Interfaces**
```typescript
// Input interface
interface AnalysisInput {
  mobileScreenshotPath: string;    // Primary - mobile first
  desktopScreenshotPath: string;   // Secondary 
  websiteUrl: string;              // Used as ID and context
  companyDescription: string;      // Business context for AI
}

// Enhanced output interface with token tracking
interface WebsiteAnalysisResult {
  // Separate scores for mobile and desktop
  mobileScore: {
    overall: number;               // 0-100
    visualDesign: number;          // 0-40  
    technical: number;             // 0-30
    content: number;               // 0-20
    userExperience: number;        // 0-10
  };
  desktopScore: {
    overall: number;
    visualDesign: number;
    technical: number; 
    content: number;
    userExperience: number;
  };
  // Combined assessment (mobile weighted higher)
  combinedScore: number;           // Mobile 70% + Desktop 30%
  sophisticationLevel: 'SUPER_OUTDATED' | 'QUITE_OUTDATED' | 'COULD_IMPROVE' | 'GOOD_ENOUGH' | 'EXCELLENT';
  opportunityLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  
  // Separate insights
  mobileIssues: string[];
  desktopIssues: string[];
  mobileRecommendations: string[];
  desktopRecommendations: string[];
  
  // Overall assessment
  primaryConcerns: string[];       // Top 3-5 issues across both
  quickWins: string[];            // Easy improvements
  majorUpgrades: string[];        // Significant changes needed
  
  confidence: number;             // 0-100
  reasoning: string;              // Brief explanation
  
  // Token usage tracking
  tokensUsed: {
    mobileAnalysis: number;
    desktopAnalysis: number;
    total: number;
  };
}
```

### **Step 4.3: Image Preprocessing Module**

#### **4.3.1: Screenshot Compression Function**
```typescript
// Function planning
async function compressScreenshot(
  inputPath: string, 
  maxWidth: number = 1200,
  quality: number = 80
): Promise<string> // Returns base64 string
```

**Tasks:**
- Use Sharp library to resize and compress
- Target max width: 1200px for desktop, 800px for mobile
- JPEG quality: 80% to balance file size vs clarity
- Convert to base64 for Gemini API
- Handle compression errors gracefully

#### **4.3.2: Image Validation**
- Check file exists and is readable
- Validate image format (PNG, JPEG, WebP)
- Ensure minimum dimensions (avoid tiny/corrupted images)
- Log compression ratios for monitoring

### **Step 4.4: Dual Analysis Strategy**

#### **4.4.1: Mobile Analysis Function**
```typescript
async function analyzeMobileScreenshot(
  mobileScreenshot: string,     // base64
  websiteUrl: string,
  companyDescription: string
): Promise<MobileAnalysisResult>
```

**Mobile-Specific Prompt Focus:**
```
You are analyzing the MOBILE version of a website for redesign opportunities.

COMPANY CONTEXT: [companyDescription]
WEBSITE: [websiteUrl]

MOBILE-SPECIFIC EVALUATION CRITERIA:

Visual Design (0-40):
- Mobile-first design approach vs desktop-cramming
- Touch-friendly button sizes and spacing
- Mobile typography readability
- Responsive image handling
- Mobile-appropriate navigation patterns

Technical Implementation (0-30):
- True mobile responsiveness vs scaled desktop
- Touch interactions and gestures
- Mobile loading performance indicators
- Mobile-specific UI components
- Thumb-friendly navigation zones

Content Quality (0-20):
- Mobile content hierarchy and scanability
- Appropriate content density for mobile
- Mobile-optimized forms and inputs
- Readable font sizes without zooming

User Experience (0-10):
- Mobile navigation ease (hamburger, bottom nav, etc.)
- One-handed usability
- Mobile conversion path clarity
- Touch target accessibility

Focus on mobile-first design principles and mobile user behavior patterns.
```

#### **4.4.2: Desktop Analysis Function**
```typescript
async function analyzeDesktopScreenshot(
  desktopScreenshot: string,    // base64
  websiteUrl: string,
  companyDescription: string
): Promise<DesktopAnalysisResult>
```

**Desktop-Specific Prompt Focus:**
```
You are analyzing the DESKTOP version of a website for redesign opportunities.

COMPANY CONTEXT: [companyDescription]  
WEBSITE: [websiteUrl]

DESKTOP-SPECIFIC EVALUATION CRITERIA:

Visual Design (0-40):
- Desktop layout sophistication and use of space
- Desktop typography hierarchy and readability
- Desktop-specific design patterns
- Multi-column layouts and information density
- Desktop branding and visual consistency

Technical Implementation (0-30):
- Desktop browser compatibility indicators
- Hover states and desktop interactions
- Desktop-specific navigation patterns
- Form design and desktop usability
- Desktop performance optimization signs

Content Quality (0-20):
- Desktop content organization and structure
- Desktop-appropriate information density
- Professional presentation for desktop viewing
- Desktop-optimized media and imagery

User Experience (0-10):
- Desktop navigation efficiency
- Desktop conversion funnel design
- Desktop-specific call-to-action placement
- Overall desktop user workflow

Consider desktop user behavior patterns and expectations for professional websites.
```

### **Step 4.5: Combined Analysis Logic**

#### **4.5.1: Score Combination Function**
```typescript
function calculateCombinedScore(
  mobileScore: number,
  desktopScore: number
): number {
  // Mobile-first weighting: 70% mobile, 30% desktop
  return Math.round(mobileScore * 0.7 + desktopScore * 0.3);
}
```

#### **4.5.2: Opportunity Assessment**
```typescript
function assessOpportunity(
  combinedScore: number,
  mobileScore: number,
  desktopScore: number
): {
  level: OpportunityLevel;
  reasoning: string;
  priority: 'MOBILE_FIRST' | 'DESKTOP_FIRST' | 'BOTH_EQUAL';
}
```

**Logic:**
- If mobile score < 40: HIGH opportunity, MOBILE_FIRST priority
- If desktop significantly better than mobile: MOBILE_FIRST priority
- If both scores similar and low: BOTH_EQUAL priority

### **Step 4.6: Enhanced Gemini Integration**

#### **4.6.1: Token Usage Tracking**
```typescript
// Capture token usage from Gemini response
interface GeminiResponse {
  text: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
```

#### **4.6.2: API Call with Token Tracking**
```typescript
async function callGeminiWithTracking(
  prompt: string,
  image: string,
  analysisType: 'mobile' | 'desktop'
): Promise<{
  result: any;
  tokensUsed: number;
}>
```

### **Step 4.7: Main Analysis Orchestrator**

#### **4.7.1: Master Analysis Function**
```typescript
async function analyzeWebsiteComplete(
  input: AnalysisInput
): Promise<WebsiteAnalysisResult> {
  
  // Step 1: Compress and prepare images
  // Step 2: Analyze mobile (priority)
  // Step 3: Analyze desktop 
  // Step 4: Combine results
  // Step 5: Generate final recommendations
  // Step 6: Calculate token usage
  
  return result;
}
```

#### **4.7.2: Processing Flow**
1. **Image Preprocessing**: Compress both screenshots
2. **Mobile Analysis**: Primary analysis with mobile-focused prompt
3. **Desktop Analysis**: Secondary analysis with desktop-focused prompt  
4. **Result Combination**: Merge scores with mobile priority
5. **Recommendation Synthesis**: Generate unified recommendations
6. **Quality Validation**: Check confidence and consistency
7. **Token Aggregation**: Sum up token usage from both calls

### **Step 4.8: Recommendation Engine Enhancement**

#### **4.8.1: Context-Aware Recommendations**
Use `companyDescription` to tailor recommendations:
- B2B companies: Focus on professionalism, lead generation
- E-commerce: Focus on conversion, mobile shopping experience
- Service businesses: Focus on contact forms, local optimization
- Creative agencies: Focus on portfolio presentation, visual impact

#### **4.8.2: Recommendation Prioritization**
```typescript
interface RecommendationSet {
  quickWins: string[];        // Easy, high-impact changes
  majorUpgrades: string[];    // Significant investments needed
  mobileFirst: string[];      // Mobile-specific priorities
  desktopEnhancements: string[]; // Desktop-specific improvements
}
```

### **Step 4.9: Error Handling & Validation**

#### **4.9.1: Enhanced Error Handling**
- Separate error handling for mobile vs desktop analysis
- Continue with single analysis if one fails
- Graceful degradation: Use single score if dual analysis fails
- Detailed error logging with context

#### **4.9.2: Result Validation**
- Cross-check mobile vs desktop scores for major discrepancies
- Flag suspicious results (e.g., mobile much better than desktop)
- Validate recommendation relevance to company description
- Ensure token counts are reasonable

### **Step 4.10: Integration Specifications**

#### **4.10.1: File Path Handling**
```typescript
// Expected input from Phase 3
interface ScreenshotPaths {
  mobile: string;    // runs/[RUN_ID]/screenshots/mobile/[slug]-mobile.png
  desktop: string;   // runs/[RUN_ID]/screenshots/desktop/[slug]-desktop.png
}
```

#### **4.10.2: CSV Output Mapping**
Map `WebsiteAnalysisResult` to CSV columns:
- `Mobile_Score` → `mobileScore.overall`
- `Desktop_Score` → `desktopScore.overall`  
- `Combined_Score` → `combinedScore`
- `Opportunity_Level` → `opportunityLevel`
- `Mobile_Issues` → `mobileIssues.join('; ')`
- `Desktop_Issues` → `desktopIssues.join('; ')`
- `Primary_Recommendations` → `quickWins.join('; ')`
- `Tokens_Used` → `tokensUsed.total`

---

## **Implementation Steps Priority:**

1. **Image Processing** (Step 4.3) - Get compression working first
2. **Single Analysis Function** (Step 4.4.1) - Start with mobile only
3. **Gemini Integration** (Step 4.6) - With token tracking
4. **Dual Analysis** (Step 4.4.2) - Add desktop analysis
5. **Result Combination** (Step 4.5) - Merge logic
6. **Testing & Validation** (Step 4.9) - With real screenshots
7. **Context Enhancement** (Step 4.8.1) - Company description integration

## **Next Questions:**

1. **Company Description Format**: Should this be free-form text, or do you want structured fields (industry, size, target market)?

2. **Token Budget**: Any rough target for tokens per analysis? (This affects prompt length and detail level)

3. **Failure Handling**: If mobile analysis fails but desktop succeeds, should we still proceed with just desktop results?

