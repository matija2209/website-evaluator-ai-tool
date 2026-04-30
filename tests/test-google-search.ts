
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function verifyGoogleSearch() {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;

  console.log('🚀 Google Custom Search API Verification');
  console.log('----------------------------------------');

  if (!apiKey) {
    console.error('❌ Missing GOOGLE_CLOUD_API_KEY in .env');
    return;
  }

  if (!cx) {
    console.warn('⚠️  Missing GOOGLE_CUSTOM_SEARCH_CX in .env');
    console.log('Note: The project currently defaults CX to your API Key in config.ts, which is likely incorrect.');
  }

  console.log(`🔹 API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
  console.log(`🔹 CX ID:   ${cx ? cx : 'NOT SET (using API Key as fallback)'}`);
  
  const customsearch = google.customsearch('v1');

  try {
    console.log('\n🔍 Attempting test search for "Google"...');
    const res = await customsearch.cse.list({
      cx: cx || apiKey, // Fallback to current behavior to show it fails
      q: 'Google',
      auth: apiKey,
    });

    console.log('✅ API SUCCESS!');
    console.log(`📊 Results found: ${res.data.searchInformation?.totalResults}`);
    
    if (res.data.items && res.data.items.length > 0) {
      console.log('🔝 Top result:', res.data.items[0].title);
      console.log('🔗 Link:', res.data.items[0].link);
    }

    // Check if it can search the entire web
    console.log('\n🔍 Testing "Search the entire web" capability...');
    const webRes = await customsearch.cse.list({
      cx: cx || apiKey,
      q: 'site:wikipedia.org Google',
      auth: apiKey,
    });

    if (webRes.data.items && webRes.data.items.length > 0) {
      console.log('✅ Entire web search appears functional for this CX.');
    } else {
      console.log('⚠️  No results for specific site search. CX might be restricted to specific domains.');
    }

  } catch (error: any) {
    console.error('\n❌ API FAILURE');
    console.error(`Status: ${error.code || 'Unknown'}`);
    console.error(`Message: ${error.message}`);

    if (error.response?.data?.error) {
      const gError = error.response.data.error;
      console.log('\nDetailed Error Information:');
      console.log(JSON.stringify(gError, null, 2));

      if (gError.message.includes('IP address restriction')) {
        console.log('\n💡 RECOMMENDATION: Your API Key has IP restrictions. Go to Google Cloud Console and either add this IP or remove the restriction.');
      } else if (gError.status === 'INVALID_ARGUMENT' && gError.message.includes('cx')) {
        console.log('\n💡 RECOMMENDATION: The Search Engine ID (CX) is invalid. You must create one at https://programmableweb.com and ensure it is set to "Search the entire web" (if available).');
      }
    }
  }
}

verifyGoogleSearch().catch(console.error);
