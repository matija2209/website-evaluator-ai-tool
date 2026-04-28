import { request } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

async function testProxy(proxyUrl?: string) {
  const context = await request.newContext({
    proxy: proxyUrl ? { server: proxyUrl } : undefined,
  });

  try {
    const response = await context.get('https://api.ipify.org?format=json', { timeout: 10000 });
    const data = await response.json();
    console.log(`[INFO] Proxy: ${proxyUrl || 'Local Machine (No proxy)'} -> Public IP: ${data.ip}`);
  } catch (error) {
    console.error(`[ERROR] Proxy: ${proxyUrl || 'Local Machine (No proxy)'} -> Failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.dispose();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let proxies: string[] = [];

  const proxiesArgIndex = args.indexOf('--proxies');
  if (proxiesArgIndex !== -1 && args[proxiesArgIndex + 1]) {
    proxies = args[proxiesArgIndex + 1].split(',').map(p => p.trim()).filter(Boolean);
  } else if (process.env.SCRAPER_PROXIES) {
    proxies = process.env.SCRAPER_PROXIES.split(',').map(p => p.trim()).filter(Boolean);
  }

  const proxyList: (string | undefined)[] = [undefined, ...proxies];

  console.log(`[INFO] Testing ${proxyList.length} configurations (${proxies.length} proxy/proxies + local machine)...\n`);

  for (const proxy of proxyList) {
    await testProxy(proxy);
  }
}

main().catch(console.error);
