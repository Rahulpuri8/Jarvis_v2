const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\283f9b55-16b8-47e6-b895-0edb0a00e597';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVisualQATest() {
  console.log('====================================================');
  console.log('🚀 LAUNCHING VISUAL BROWSER QA TEST (HEADLESS: FALSE)');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--window-size=1600,1000',
      '--window-position=40,40'
    ]
  });

  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: 1536, height: 900 });

  console.log('🌐 Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await sleep(2000);

  // Check if we are on the Home Page boot diagnostic screen
  const engageBtnSelector = 'button';
  console.log('🔍 Checking for ENGAGE J.A.R.V.I.S boot screen...');
  try {
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const engage = btns.find(b => b.textContent && b.textContent.includes('ENGAGE J.A.R.V.I.S'));
      const textarea = document.querySelector('textarea');
      return engage || textarea;
    }, { timeout: 15000 });

    const isEngage = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const engage = btns.find(b => b.textContent && b.textContent.includes('ENGAGE J.A.R.V.I.S'));
      if (engage) {
        engage.click();
        return true;
      }
      return false;
    });

    if (isEngage) {
      console.log('⚡ Clicked ENGAGE J.A.R.V.I.S button!');
      await sleep(1500);
    }
  } catch (e) {
    console.log('ℹ️ Boot button wait skipped or not needed:', e.message);
  }

  // Wait for the chat textarea
  const textareaSelector = 'textarea';
  await page.waitForSelector(textareaSelector, { visible: true, timeout: 20000 });
  console.log('✅ BuildOS UI loaded successfully with Chat interface visible on screen.');

  const testCases = [
    {
      name: 'TEST 1: TIER-1 INSTANT APP LAUNCH',
      prompt: 'open calculator',
      expectedDesc: 'Should match Tier-1 allowlist (calc.exe) and launch immediately without approval'
    },
    {
      name: 'TEST 2: FALSE POSITIVE GUARD',
      prompt: 'can you calculate 45 * 12',
      expectedDesc: 'Should answer 540 directly in chat, without launching the calculator app'
    },
    {
      name: 'TEST 3: TIER-2 DESTRUCTIVE CONFIRMATION GUARD',
      prompt: 'shutdown computer',
      expectedDesc: 'Should trigger AWAITING_CONFIRMATION safety guard and ask for confirmation'
    },
    {
      name: 'TEST 4: TIER-2 SAFE CANCELLATION',
      prompt: 'no, cancel shutdown',
      expectedDesc: 'Should cancel the shutdown safely'
    },
    {
      name: 'TEST 5: GENERAL DISAMBIGUATION POLICY',
      prompt: 'can you search about the ddr5 ram 32 gb price',
      expectedDesc: 'Should NOT return PC RAM telemetry. Should ask clarifying questions (desktop/laptop, region)'
    },
    {
      name: 'TEST 6: MULTI-TURN CONVERSATION FOLLOW-UP',
      prompt: 'desktop gaming PC, Pakistan',
      expectedDesc: 'Should synthesize with previous DDR5 query and perform targeted web search'
    },
    {
      name: 'TEST 7: UNAMBIGUOUS PC HARDWARE TELEMETRY',
      prompt: 'what is my ram usage',
      expectedDesc: 'Should directly query system_get_telemetry and display host RAM & CPU load'
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n----------------------------------------------------`);
    console.log(`▶️ RUNNING: ${tc.name}`);
    console.log(`💬 PROMPT: "${tc.prompt}"`);
    console.log(`🎯 EXPECTATION: ${tc.expectedDesc}`);

    // Count existing assistant messages before sending
    const initialMsgCount = await page.evaluate(() => {
      return document.querySelectorAll('article.hud-boot').length;
    });

    // Clear textarea and type with human visible speed
    await page.click(textareaSelector);
    await page.evaluate(() => {
      const el = document.querySelector('textarea');
      if (el) el.value = '';
    });
    await page.type(textareaSelector, tc.prompt, { delay: 45 });
    await sleep(600);

    // Find and click the transmit button
    const transmitBtn = await page.$('button[type="submit"]');
    if (transmitBtn) {
      await transmitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log('⏳ Awaiting J.A.R.V.I.S response on screen...');

    // Wait for a new message to appear and for streaming to finish
    let responseText = '';
    let hasPendingAlert = false;
    let maxWait = 40; // up to 40 seconds for Ollama LLM response
    let waitInterval = 1000;

    for (let w = 0; w < maxWait; w++) {
      await sleep(waitInterval);

      const status = await page.evaluate((prevCount) => {
        const articles = Array.from(document.querySelectorAll('article.hud-boot'));
        const pendingBox = document.querySelector('.border-amber-400\\/60');
        const latestArticle = articles[articles.length - 1];
        const isNew = articles.length > prevCount;
        const text = latestArticle ? latestArticle.innerText : '';
        return {
          articleCount: articles.length,
          isNew,
          latestText: text,
          hasPending: !!pendingBox
        };
      }, initialMsgCount);

      if (status.isNew && status.latestText.length > 5) {
        // Wait an extra 2 seconds for any trailing tool card or markdown update
        await sleep(2500);
        const finalStatus = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article.hud-boot'));
          const pendingBox = document.querySelector('.border-amber-400\\/60');
          const latest = articles[articles.length - 1];
          return {
            latestText: latest ? latest.innerText : '',
            hasPending: !!pendingBox
          };
        });
        responseText = finalStatus.latestText;
        hasPendingAlert = finalStatus.hasPending;
        break;
      }
    }

    console.log(`\n🤖 J.A.R.V.I.S RESPONSE VISIBLE ON SCREEN:`);
    console.log(responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''));
    if (hasPendingAlert) {
      console.log('⚠️ [HUD ALERT]: Confirmation / Authorization Gate card is rendered on screen.');
    }

    // Take screenshot of this visual state
    const screenshotPath = path.join(ARTIFACTS_DIR, `visual_qa_step_${i + 1}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot captured: ${screenshotPath}`);

    // Pause visibly so user watching the screen can comfortably read the interface
    await sleep(4000);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL VISUAL TESTS COMPLETED LIVE ON SCREEN!');
  console.log('Keeping browser open for 15 seconds so you can inspect the UI state...');
  console.log('====================================================');
  await sleep(15000);

  await browser.close();
  console.log('🏁 Browser closed. Test run complete.');
}

runVisualQATest().catch((err) => {
  console.error('❌ Visual QA Test encountered an error:', err);
  process.exit(1);
});
