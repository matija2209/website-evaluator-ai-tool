
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSearch() {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  // If config.ts uses the same key for CX, let's see if that works (unlikely but possible if misconfigured)
  const cx = process.env.GOOGLE_CLOUD_API_KEY; 

  console.log('Testing Google Custom Search API...');
  console.log(`API Key: ${apiKey?.substring(0, 5)}...`);
  console.log(`CX: ${cx?.substring(0, 5)}...`);

  const customsearch = google.customsearch('v1');

  try {
    const res = await customsearch.cse.list({
      cx: cx,
      q: 'Google',
      auth: apiKey,
    });

    console.log('✅ Search successful!');
    console.log(`Results found: ${res.data.searchInformation?.totalResults}`);
    if (res.data.items && res.data.items.length > 0) {
      console.log('First result:', res.data.items[0].title, '-', res.data.items[0].link);
    }
  } catch (error: any) {
    console.error('❌ Search failed!');
    console.error('Error message:', error.message);
    if (error.response && error.response.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n--- Recommendation ---');
    if (error.message.includes('400') || error.message.includes('invalid')) {
      console.log('It seems the Search Engine ID (CX) is invalid. You likely need a separate CX ID from programmableweb.com');
    }
  }
}

testSearch().catch(console.error);
