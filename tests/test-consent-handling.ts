import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

async function startFixtureServer(fixturesDir: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    const requestPath = req.url === '/' ? '/consent-main.html' : req.url || '/consent-main.html';
    const normalizedPath = path
      .normalize(requestPath)
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^[/\\]+/, '');
    const filePath = path.join(fixturesDir, normalizedPath);

    if (!await fs.pathExists(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await fs.readFile(filePath, 'utf8'));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fixture server');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  };
}

async function run(): Promise<void> {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'consent-cache-'));
  process.env.CONSENT_CACHE_DIR = cacheDir;
  process.env.DISABLE_CONSENT_EXTENSION = 'true';
  process.env.CONSENT_SETTLE_TIMEOUT_MS = '300';

  const fixtureRoot = path.join(__dirname, 'fixtures', 'consent');
  const { PlaywrightSessionManager } = require('../src/playwrightSession') as typeof import('../src/playwrightSession');
  const {
    evaluateConsentCandidateText,
    evaluatePopupCandidateText,
    isSafeConsentAction,
    isSafePopupCloseAction
  } = require('../src/pagePreparation') as typeof import('../src/pagePreparation');

  assert.ok(evaluateConsentCandidateText('Ta stran uporablja piškotke za zasebnost.').score >= 3);
  assert.equal(isSafeConsentAction('Sprejmi vse'), true);
  assert.equal(isSafeConsentAction('Nastavitve'), false);
  assert.ok(evaluatePopupCandidateText('Subscribe to our newsletter for a discount coupon.').score >= 3);
  assert.equal(isSafePopupCloseAction('No thanks'), true);
  assert.equal(isSafePopupCloseAction('Log in'), false);

  const server = await startFixtureServer(fixtureRoot);
  const manager = new PlaywrightSessionManager();

  try {
    const consentSession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/consent-main.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-main-consent'
    });

    try {
      assert.equal(consentSession.pagePreparation.consentOutcome, 'accepted_fallback');
      assert.equal(await consentSession.page.locator('#cookie-banner').count(), 0);
      assert.equal(await consentSession.page.evaluate(() => (window as any).unrelatedAcceptClicked === true), false);
    } finally {
      await consentSession.close();
    }

    const iframeSession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/consent-iframe-host.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-iframe-consent'
    });

    try {
      assert.equal(iframeSession.pagePreparation.consentOutcome, 'accepted_fallback');
      assert.equal(await iframeSession.page.locator('#consent-frame').count(), 0);
    } finally {
      await iframeSession.close();
    }

    const germanSession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/consent-german.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-german-consent'
    });

    try {
      assert.equal(germanSession.pagePreparation.consentOutcome, 'accepted_fallback');
      assert.equal(await germanSession.page.locator('#german-banner').count(), 0);
    } finally {
      await germanSession.close();
    }

    const popupSession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/newsletter-popup.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-popup'
    });

    try {
      assert.equal(popupSession.pagePreparation.popupOutcome, 'closed');
      assert.equal(await popupSession.page.locator('#newsletter-popup').count(), 0);
    } finally {
      await popupSession.close();
    }

    const riskySession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/risky-login-modal.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-risky-popup'
    });

    try {
      assert.equal(riskySession.pagePreparation.popupOutcome, 'skipped_unsafe');
      assert.equal(await riskySession.page.locator('#login-modal').count(), 1);
    } finally {
      await riskySession.close();
    }

    const cacheWarmSession = await manager.openPreparedDesktopSession({
      url: `${server.baseUrl}/consent-main.html`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-cache-desktop'
    });
    await cacheWarmSession.close();

    const mobileReuseSession = await manager.openPreparedMobileSession({
      url: `${server.baseUrl}/consent-main.html`,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      waitUntil: 'networkidle',
      timeoutMs: 10000,
      purpose: 'test-cache-mobile',
      viewport: { width: 390, height: 844 },
      isMobile: true
    });

    try {
      assert.equal(mobileReuseSession.pagePreparation.consentOutcome, 'accepted_extension_or_preexisting');
      assert.equal(mobileReuseSession.pagePreparation.consentMethod, 'preexisting_storage_state');
      assert.equal(await mobileReuseSession.page.locator('#cookie-banner').count(), 0);
    } finally {
      await mobileReuseSession.close();
    }
  } finally {
    await server.close();
    await fs.remove(cacheDir);
  }

  console.log('✅ Consent handling tests passed');
}

run().catch((error) => {
  console.error('❌ Consent handling tests failed');
  console.error(error);
  process.exit(1);
});
