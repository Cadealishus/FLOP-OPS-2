#!/usr/bin/env node
import { chromium } from 'playwright';

const port = Number(process.argv[2] ?? 4173);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const messages = [];
page.on('console', (message) => {
  const line = `[${message.type()}] ${message.text()}`;
  messages.push(line);
  console.error(line);
});
page.on('pageerror', (error) => {
  const line = `[pageerror] ${error.stack ?? error.message}`;
  messages.push(line);
  console.error(line);
});
page.on('requestfailed', (request) => console.error(`[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ''}`));
page.on('response', (response) => {
  if (response.url().includes('/assets/')) console.error(`[response] ${response.status()} ${response.url()}`);
});

try {
  const started = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?map=airport&q=low&prewarm=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 120000 });
  console.log(JSON.stringify({
    ok: true,
    elapsedMs: Date.now() - started,
    mode: await page.evaluate(() => window.FLOP?.state?.mode),
    map: await page.evaluate(() => window.__FLOP_MAPS__?.active),
    messages,
  }, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  console.error(messages.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
