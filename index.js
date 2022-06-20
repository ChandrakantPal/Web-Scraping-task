// We'll use Puppeteer is our browser automation framework.
fs = require("fs")
const puppeteer = require("puppeteer-extra")
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
puppeteer.use(StealthPlugin())
// to avoid puppeteer being detected

// to avoid 403 error
const preparePageForTests = async (page) => {
  const userAgent =
    "Mozilla/5.0 (X11; Linux x86_64)" +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36"
  await page.setUserAgent(userAgent)

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    })
  })

  await page.evaluateOnNewDocument(() => {
    window.navigator.chrome = {
      runtime: {},
    }
  })

  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query
    return (window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters))
  })

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    })
  })

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    })
  })
}

;(async () => {
  // Launch the browser in headless mode and set up a page.
  const browser = await puppeteer.launch({
    devtools: true,
    // cors issue
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins",
      "--disable-site-isolation-trials",
    ],
    headless: true,
    defaultViewport: false,
  })
  const page = await browser.newPage()
  await preparePageForTests(page)
  const coords = []
  await page.on("response", async (response) => {
    const url = response.url()
    try {
      const req = response.request()
      const orig = req.url()
      const text = await response.text()
      const status = response.status()
      console.log({ orig, status, text: text.length })
      if (orig === "https://portal.grab.com/foodweb/v2/search") {
        const data = await response.json()
        coords.push(...data.searchResult.searchMerchants)
        console.log("DATA", data.searchResult.searchMerchants)
      }
    } catch (err) {
      console.error(`Failed getting data from: ${url}`)
      console.error(err)
    }
  })

  const testUrl = "https://food.grab.com/sg/en/"
  await page.goto(testUrl)
  await page.screenshot({ path: "1.png" })
  // searching singapore
  await page.type("#location-input", "Singapore")
  await page.screenshot({ path: "2.png" })
  await page.click('[class="ant-btn submitBtn___2roqB ant-btn-primary"]')

  // load more
  await load(page)

  // saving data in json file
  console.log({ coords })
  const data = coords.map((item) => ({
    name: item.address.name,
    latlng: item.latlng,
  }))
  const json = JSON.stringify({ data })
  fs.writeFile("data.json", json, "utf8", (err) => {
    if (err) {
      console.log("Error writing file", err)
    } else {
      console.log("Successfully wrote file")
    }
  })
  // Clean up.
  await browser.close()
})()

const load = async (page) => {
  await Promise.all([
    await page.waitForSelector('[class="ant-btn ant-btn-block"]', {
      visible: true,
    }),
    await page.click('[class="ant-btn ant-btn-block"]'),
  ])
  try {
    if (
      (await page.waitForSelector('[class="ant-btn ant-btn-block"]', {
        visible: true,
      })) !== null
    ) {
      await load(page)
    }
  } catch (error) {
    return
  }
}
