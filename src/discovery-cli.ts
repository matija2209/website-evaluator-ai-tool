import { WebsiteDiscoveryService } from './websiteDiscovery';
import path from 'path';

async function main() {
  const inputCsvPath = process.argv[2];
  
  if (!inputCsvPath) {
    console.error('Usage: ts-node src/discovery-cli.ts <input_csv_path>');
    process.exit(1);
  }

  const absolutePath = path.resolve(inputCsvPath);
  console.log(`🧪 Starting Website Discovery CLI`);
  console.log(`📂 Input file: ${absolutePath}`);
  
  try {
    const discoveryService = new WebsiteDiscoveryService();
    console.log(`⚙️  Starting website discovery...`);
    
    const result = await discoveryService.runDiscoveryPhase(absolutePath);
    
    console.log(`\n🎉 Discovery completed!`);
    console.log(`📊 Results:`);
    console.log(`   Run ID: ${result.runId}`);
    console.log(`   Run Dir: ${result.runDir}`);
    console.log(`   Total companies: ${result.stats.total}`);
    console.log(`   Websites discovered: ${result.stats.discovered}`);
    console.log(`   Failed: ${result.stats.failed}`);
    console.log(`   Success rate: ${result.stats.successRate}%`);
    
  } catch (error) {
    console.error(`❌ Discovery failed:`, error);
    process.exit(1);
  }
}

main().catch(console.error);
