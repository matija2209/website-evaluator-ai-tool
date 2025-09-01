import dotenv from 'dotenv';
import { GoogleSearchService } from '../src/googleSearch';
import { CompanySearchInput } from '../src/types';

// Load environment variables
dotenv.config();

async function testAIValidation() {
  console.log('🧪 Testing AI-Powered Website Validation\n');

  // Check if required environment variables are set
  if (!process.env.GOOGLE_CLOUD_API_KEY || !process.env.GOOGLE_CLOUD_API_KEY || !process.env.GOOGLE_CLOUD_API_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   - GOOGLE_CLOUD_API_KEY:', process.env.GOOGLE_CLOUD_API_KEY ? '✓' : '❌');
    console.error('   - GOOGLE_CLOUD_API_KEY:', process.env.GOOGLE_CLOUD_API_KEY ? '✓' : '❌');
    console.error('   - GOOGLE_CLOUD_API_KEY:', process.env.GOOGLE_CLOUD_API_KEY ? '✓' : '❌');
    process.exit(1);
  }

  const searchService = new GoogleSearchService();

  // Test cases with different complexity levels
  const testCases: CompanySearchInput[] = [
    {
      companyName: 'Petrol d.d.',
      city: 'Ljubljana',
      country: 'Slovenia',
      businessActivity: 'Retail of automotive fuel in specialised stores'
    },
    {
      companyName: 'Telekom Slovenije',
      city: 'Ljubljana', 
      country: 'Slovenia',
      businessActivity: 'Telecommunications'
    },
    {
      companyName: 'Mercator d.d.',
      city: 'Ljubljana',
      country: 'Slovenia', 
      businessActivity: 'Non-specialised store retail'
    }
  ];

  let totalTokens = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n=== Test Case ${i + 1}/3 ===`);
    console.log(`🏢 Company: ${testCase.companyName}`);
    console.log(`📍 Location: ${testCase.city}, ${testCase.country}`);
    console.log(`💼 Business: ${testCase.businessActivity}\n`);

    try {
      const startTime = Date.now();
      const result = await searchService.searchCompanyWebsite(testCase);
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (result.success && result.results.length > 0) {
        console.log(`✅ SUCCESS (${duration}ms)`);
        console.log(`🌐 Website: ${result.results[0].link}`);
        
        if (result.serpPosition) {
          console.log(`📊 SERP Position: ${result.serpPosition}`);
        }
        
        if (result.aiValidation) {
          const confidence = Math.round(result.aiValidation.confidence * 100);
          console.log(`🤖 AI Confidence: ${confidence}%`);
          console.log(`💡 AI Reasoning: ${result.aiValidation.reasoning}`);
          console.log(`🪙 Tokens Used: ${result.aiValidation.tokensUsed}`);
          totalTokens += result.aiValidation.tokensUsed;
          
          if (result.aiValidation.multipleValidFound) {
            console.log(`🔍 Multiple valid results found (AI selected best match)`);
          }
        }
      } else {
        console.log(`❌ FAILED (${duration}ms)`);
        console.log(`💥 Error: ${result.errorMessage}`);
      }

      // Add delay between requests to respect rate limits
      if (i < testCases.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`💥 Test failed:`, error);
    }
  }

  console.log(`\n📊 === Test Summary ===`);
  console.log(`🪙 Total tokens used: ${totalTokens}`);
  console.log(`💰 Estimated cost: ~$${(totalTokens * 0.000075).toFixed(4)} USD`);
  console.log(`✅ AI validation implementation test complete!`);
}

// Run the test
testAIValidation().catch(console.error); 