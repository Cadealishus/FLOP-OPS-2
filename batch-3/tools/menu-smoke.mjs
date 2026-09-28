#!/usr/bin/env node
import { chromium } from 'playwright';

const port = Number(process.argv[2] ?? 5173);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${port}/?q=low&prewarm=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 120000 });

  const tabs = await page.locator('.fo-tab').allTextContents();
  if (tabs.length !== 4) throw new Error(`expected 4 front-end tabs, found ${tabs.length}`);
  await page.getByRole('button', { name: 'LOADOUT / ARMORY' }).click();
  if ((await page.locator('.fo-weapon-button').count()) !== 4) throw new Error('armory is not showing all four live weapons');
  await page.locator('.fo-weapon-button').nth(2).click();
  await page.getByRole('button', { name: 'EQUIP & DEPLOY' }).click();
  await page.waitForFunction(() => window.FLOP?.state?.mode === 'play' && window.FLOP?.state?.job === 'charlie');
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => {
    const engine = window.__ENGINE__;
    return engine?.ctx?.peek?.('weapons')?.getHudState?.().lethalCount === 1 &&
      engine?.ctx?.peek?.('ai')?._grenades?.length > 0;
  });

  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({
    ok: true,
    tabs,
    state: await page.evaluate(() => window.FLOP.state),
    grenadesRemaining: await page.evaluate(() => window.__ENGINE__.ctx.peek('weapons').getHudState().lethalCount),
  }, null, 2));
} finally {
  await browser.close();
}
