import { request } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  raw: string;
}

function parseProxyEntry(entry: string): ProxyConfig {
  const trimmed = entry.trim();
  if (!trimmed) {
    throw new Error('Empty proxy entry');
  }

  const authParts = trimmed.split('|');
  if (authParts.length === 3) {
    const [server, username, password] = authParts.map((part) => part.trim());
    if (!server || !username || !password) {
      throw new Error(`Invalid auth proxy entry: ${entry}`);
    }
    return {
      server,
      username,
      password,
      raw: `${server}|${username}|${password}`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      const server = `${parsed.protocol}//${parsed.host}`;
      return {
        server,
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        raw: trimmed,
      };
    }
  } catch {
    // Fallback to plain server-style parsing below.
  }

  return {
    server: trimmed,
    raw: trimmed,
  };
}

function parseProxyList(value?: string): ProxyConfig[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseProxyEntry(entry));
}

async function testProxy(proxy?: ProxyConfig) {
  const context = await request.newContext({
    proxy: proxy
      ? {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      }
      : undefined,
  });

  try {
    const response = await context.get('https://api.ipify.org?format=json', { timeout: 10000 });
    const data = await response.json();
    console.log(`[INFO] Proxy: ${proxy?.raw || 'Local Machine (No proxy)'} -> Public IP: ${data.ip}`);
  } catch (error) {
    console.error(`[ERROR] Proxy: ${proxy?.raw || 'Local Machine (No proxy)'} -> Failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.dispose();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let proxies: ProxyConfig[] = [];

  const proxiesArgIndex = args.indexOf('--proxies');
  if (proxiesArgIndex !== -1 && args[proxiesArgIndex + 1]) {
    proxies = parseProxyList(args[proxiesArgIndex + 1]);
  } else {
    proxies = parseProxyList(process.env.SCRAPER_PROXIES_AUTH || process.env.SCRAPER_PROXIES);
  }

  const proxyList: (ProxyConfig | undefined)[] = [undefined, ...proxies];

  console.log(`[INFO] Testing ${proxyList.length} configurations (${proxies.length} proxy/proxies + local machine)...\n`);

  for (const proxy of proxyList) {
    await testProxy(proxy);
  }
}

main().catch(console.error);
