import puppeteer from "puppeteer-core";
const config = {
  once: true, // one_time browser
  headless: false, // support: true, 'new'
  autoClose: false,
  // remoteDebuggingPort: 9223,
  fingerprint: {
    name: "test-turnstile",
    platform: "windows", // support: windows, mac, linux
    kernel: "chromium", // only support: chromium
    kernelMilestone: "120",
    hardwareConcurrency: 2, // support: 2, 4, 8, 10, 12, 14, 16
    deviceMemory: 8, // support: 2, 4, 8
  },
};

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

let browser = null;
async function getTurnstileToken(api_key, profile_id) {
  const browserWSEndpoint =
    "ws://localhost:8848/devtool/launch/" +
    profile_id +
    "?x-api-key=" +
    api_key +
    "&config=" +
    JSON.stringify(config);
  browser = await puppeteer.connect({
    browserWSEndpoint: browserWSEndpoint,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  let resolveToken = null;
  const tokenPromise = new Promise((resolve) => (resolveToken = resolve));

  // This method is used to monitor whether the Checkbox exists on the page and click it
  const checkbox = async () => {
    while (true) {
      try {
        if (page.isClosed()) return;
        const targetFrameUrl = "cdn-cgi/challenge-platform/";
        const iframe = page
          .frames()
          .find((frame) => frame.url().includes(targetFrameUrl));
        if (iframe) {
          const box_element = await iframe.waitForSelector(
            'input[type="checkbox"]',
            {
              timeout: 1000,
              visible: true,
            }
          );
          await box_element.click();
        }
      } catch (e) {
      } finally {
        await delay(1000);
      }
    }
  };

  // This method is used to monitor whether the token is returned
  const findToken = async () => {
    while (true) {
      if (page.isClosed()) return;
      const response = await page.evaluate(() => {
        const token = window?.turnstile?.getResponse();
        if (token) {
          return { token: token };
        }
      });
      if (response) {
        resolveToken(response);
        return;
      }
      await delay(1000);
    }
  };

  findToken().then();
  checkbox().then();

  await page.goto("https://www.llama2.ai/");
  return tokenPromise;
}

// Test get trunstile token
const CloudflareToken = async (apiKey, profile_id) => {
  const token = await getTurnstileToken(apiKey, profile_id);
  return token;
};

export default CloudflareToken;
