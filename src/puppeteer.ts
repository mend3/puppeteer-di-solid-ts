import fs from "fs";
import path from "path";
import puppeteer, {
  type Cookie,
  type Browser,
  type ConnectOptions,
  type GoToOptions,
  type Page,
  type PuppeteerLaunchOptions,
} from "puppeteer";

export type CrawlingState = Array<unknown>;

const getFullPath = (filePath: string) =>
  path.join(process.cwd(), "output", filePath);

function saveToFile(filePath: string, content: string | unknown): void {
  try {
    fs.writeFileSync(
      filePath,
      typeof content === "string" ? content : JSON.stringify(content)
    );
    console.log(`Content saved to file: ${filePath}`);
  } catch (error) {
    console.error(`Error saving content to file: ${(error as Error).message}`);
  }
}

export abstract class PageService {
  constructor(protected page: Page, protected _state: CrawlingState) {
    console.log(`Service [${this.constructor.name}] created.`);
  }

  protected statePush(msg: string, ...data: any[]) {
    this._state.push({ [this.constructor.name]: data });
    this.debug(msg);
  }

  protected debug(msg: string) {
    console.debug(this.constructor.name, msg);
  }
}

export class ScreenshotService extends PageService {
  async screenshot(path: string) {
    const screenshot = await this.page.screenshot({
      fullPage: true,
      path,
    });

    const size = screenshot.byteLength;

    this.statePush("screenshot taken", { path, size });
  }
}

export class CookiesService extends PageService {
  async loadCookiesFromStorage(path: string) {
    let cookies: Cookie[] = [];
    await import(path, { with: { type: "json" } })
      .then((output) => {
        for (const log of output.default) {
          if (typeof log === "object" && "CookiesService" in log) {
            cookies = log["CookiesService"] as Cookie[];
            break;
          }
        }
      })
      .catch(() => []);

    return cookies;
  }
  async setCookies(input?: Cookie[]) {
    if (input?.length) {
      this.debug("setting cookies");
      await this.page.setCookie(...input);
    }
  }

  async getCookies() {
    const cookies = await this.page.cookies();
    this.statePush("cookies intercepted", ...cookies);
  }

  async close(id = "close-cookies") {
    this.debug(`trying to close #${id}`);
    const closeContent = await this.page
      .waitForSelector(`#${id}`, { timeout: 5000 })
      .catch(() => null);
    if (closeContent)
      await this.page.evaluate((value) => {
        const closeCookiesButton = document.getElementById(value);

        if (closeCookiesButton) closeCookiesButton.click();
      }, id);
  }
}

export class ClickService extends PageService {
  async click(selector: string) {
    this.statePush(`new click on ${selector}`, selector);
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }
}

export class PaginationService extends PageService {
  async discover() {
    const pages = await this.page.evaluate(() => {
      function _extractParams(url: string | URL) {
        try {
          const urlObj = new URL(url);
          const params = new URLSearchParams(urlObj.search);
          const paramsObj = {} as Record<string, string>;

          // Loop through each parameter and store it in the object
          params.forEach((value, key) => {
            paramsObj[key.toLocaleLowerCase()] = value;
          });

          return paramsObj;
        } catch {
          return null;
        }
      }

      const dummy = {
        page: 5,
        href: "https://www.myjob.mu/ShowResults.aspx?Keywords=&Location=&Category=39&Recruiter=Company&SortBy=MostRecent&Page=5",
        pos: 7,
        props: {
          keywords: "",
          location: "",
          category: "39",
          recruiter: "Company",
          sortby: "MostRecent",
          page: "5",
        },
      };

      return Array.from(
        document.querySelectorAll<HTMLLinkElement>("#pagination a")
      )
        .map((_hrefElement, i, elements) => {
          const { textContent, href } = _hrefElement;

          const pos = elements.indexOf(_hrefElement);

          const props = _extractParams(href);

          return {
            page: parseInt(textContent?.trim() ?? "0", 10),
            href,
            pos,
            props,
          } as typeof dummy;
        })
        .filter(({ page, href }) => page >= 0 && href.trim() !== "")
        .sort((v) => v.pos);
    });

    const links = await this.page.evaluate(() => {
      const currentDomainLinks = Array.from(document.querySelectorAll("a"))
        .map((link) => link.href)
        .filter(
          (href) =>
            href.startsWith(window.location.origin) && href.endsWith(".aspx")
        )
        .reduce((set, href) => set.add(href), new Set<string>());

      return Array.from(currentDomainLinks);
    });

    this.statePush("links discovered", { links, pages });
  }
}

export class NavigationService extends PageService {
  async navigate(
    url: string,
    options: GoToOptions = {
      waitUntil: "networkidle2",
      timeout: 30000,
    }
  ) {
    this.statePush("new navigation", { url, options });
    await this.page.goto(url, options);
  }
}

export class MetricsService extends PageService {
  async getResults() {
    const title = await this.page.title();
    const url = this.page.url();
    const meta = await this.page.evaluate(
      "Array.from(document.getElementsByTagName('meta')).map(({content, name}) => ({name, content})).filter(({name}) => name.length > 0)"
    );

    const metadata = {
      title,
      url,
      meta,
    };

    const metrics = await this.page.metrics();

    this.statePush("extracted metadata", { metadata, metrics });
  }
}

export class ScrollService extends PageService {
  async scroll(
    selector: string,
    direction: "vertical" | "horizontal" | "both" = "vertical"
  ) {
    this.statePush("scrolling to element", { selector, direction });
    await this.page.waitForSelector(selector, { timeout: 60000 });
    let previousSize = 0; // Keeps track of the last known size
    let currentSize = await this.page.evaluate(
      (sel, dir) => {
        const element = document.querySelector(sel);
        if (!element) throw new Error(`Element not found: ${sel}`);

        return dir === "horizontal" || dir === "both"
          ? element.scrollWidth
          : element.scrollHeight;
      },
      selector,
      direction
    );

    while (currentSize !== previousSize) {
      previousSize = currentSize;

      // Smoothly scroll the element
      await this.page.evaluate(
        async (sel, dir) => {
          const element = document.querySelector(sel);
          if (!element) throw new Error(`Element not found: ${sel}`);

          if (dir === "horizontal" || dir === "both") {
            await new Promise((resolve) => {
              element.scrollTo({
                left: element.scrollWidth,
                behavior: "smooth",
              });
              setTimeout(resolve, 500); // Wait for smooth scrolling to finish
            });
          }
          if (dir === "vertical" || dir === "both") {
            await new Promise((resolve) => {
              element.scrollTo({
                top: element.scrollHeight,
                behavior: "smooth",
              });
              setTimeout(resolve, 500); // Wait for smooth scrolling to finish
            });
          }
        },
        selector,
        direction
      );

      // Wait for new content to load
      await this.page.waitForNavigation({ waitUntil: "networkidle0" });

      // Update the size after scrolling
      currentSize = await this.page.evaluate(
        (sel, dir) => {
          const element = document.querySelector(sel);
          if (!element) throw new Error(`Element not found: ${sel}`);

          return dir === "horizontal" || dir === "both"
            ? element.scrollWidth
            : element.scrollHeight;
        },
        selector,
        direction
      );

      await this.page.evaluate(() => {
        const delay = Math.floor(Math.random() * 1000) + 1000;
        return new Promise((resolve) => setTimeout(resolve, delay));
      });
    }
  }
}

export class ContentService extends PageService {
  async getContent() {
    const body = await this.page.evaluate(() => document.body.outerHTML);

    this.statePush(`getting page content`, body);
  }
}

export abstract class RequestListener implements PageListener, StateHandler {
  abstract attach(page: Page): Promise<void>;
  constructor(protected page: Page, protected _state: CrawlingState) {}
  async onInitialize() {
    console.log(`Attaching listener [${this.constructor.name}]`);
    await this.attach(this.page);
  }

  statePush(...data: any[]) {
    this._state.push({ [this.constructor.name]: data });
  }
}

export class RequestInterceptorListener extends RequestListener {
  async attach(page: Page) {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const headers = request.headers();
      const url = request.url();
      const method = request.method();
      const initiator = request.initiator();
      const resourceType = request.resourceType();

      const aborted =
        (["font", "stylesheet", "other"] as (typeof resourceType)[]).indexOf(
          resourceType
        ) >= 0;

      this.statePush({
        method,
        url,
        resourceType,
        headers,
        initiator,
        aborted,
      });

      if (aborted) return request.abort();

      request.continue();
    });
  }
}
export class ResponseInterceptorListener extends RequestListener {
  async attach(page: Page) {
    page.on("response", async (response) => {
      const headers = response.headers();
      const url = response.url();
      const status = response.status();
      const statusText = response.statusText();
      const ok = response.ok();
      const fromCache = response.fromCache();
      const remoteAddress = response.remoteAddress();
      const content = await response.text().catch(() => null);

      this.statePush({
        ok,
        status,
        statusText,
        url,
        remoteAddress,
        fromCache,
        headers,
        content,
      });
    });
  }
}

const listenersRegistry = {
  RequestInterceptorListener,
  ResponseInterceptorListener,
} as const;

const serviceRegistry = {
  NavigationService,
  ScrollService,
  CookiesService,
  ClickService,
  MetricsService,
  PaginationService,
  ScreenshotService,
  ContentService,
} as const;

export interface StateHandler {
  statePush(...data: any[]): void;
}
export interface PageListener {
  attach(page: Page): Promise<void>;
}
const filterRequestListeners = (
  listener: PageListener
): listener is RequestListener => listener instanceof RequestListener;

export class BrowserManager {
  private _page: Page | undefined;
  private _browser: Browser | undefined;
  protected _state: CrawlingState = [];

  constructor() {}

  public get page() {
    if (!this._page) throw new Error("Missing page instance");
    return this._page;
  }

  public get browser() {
    if (!this._browser) throw new Error("Missing browser instance");
    return this._browser;
  }

  get state() {
    return this._state;
  }

  async initialize(options: PuppeteerLaunchOptions | ConnectOptions) {
    if ("browserWSEndpoint" in options)
      this._browser = await puppeteer.connect(options);
    else if ("executablePath" in options)
      this._browser = await puppeteer.launch(options);

    this._page = await this.browser.newPage();

    const allListeners = Object.values(listenersRegistry).map(
      (listener) => new listener(this.page, this.state)
    );
    for (const instance of allListeners.filter(filterRequestListeners)) {
      await instance.onInitialize();
    }
  }

  async exportState(path: string) {
    saveToFile(path, this.state);
  }

  async close() {
    await this.page.close();
    await this.browser.close();
  }

  get<T extends keyof typeof serviceRegistry>(name: T) {
    const ServiceClass = serviceRegistry[name];
    if (!ServiceClass) throw new Error(`Service '${name}' not found`);

    return new ServiceClass(this.page, this._state) as InstanceType<
      (typeof serviceRegistry)[T]
    >;
  }

  listen<T extends keyof typeof listenersRegistry>(name: T) {
    const ListenerClass = listenersRegistry[name];
    if (!ListenerClass) throw new Error(`Listener '${name}' not found`);

    return new ListenerClass(this.page, this._state) as InstanceType<
      (typeof listenersRegistry)[T]
    >;
  }
}

const run = async () => {
  const outputPath = getFullPath("output.json");
  const screenshotPath = getFullPath("screenshot.png");

  const browserManager = new BrowserManager();

  const browserLoc = process.env.REMOTE_BROWSER
    ? {
        browserWSEndpoint: `http://${process.env.REMOTE_BROWSER}`,
      }
    : {
        executablePath: process.env.EXECUTABLE_PATH ?? "/usr/bin/google-chrome",
      };
  await browserManager.initialize({
    ignoreHTTPSErrors: true,
    ...browserLoc,
  });

  const navigation = browserManager.get("NavigationService");
  const cookies = browserManager.get("CookiesService");

  await cookies
    .loadCookiesFromStorage(outputPath)
    .then((storage) => cookies.setCookies(storage));

  await navigation.navigate(
    "https://www.myjob.mu/ShowResults.aspx?Keywords=&Location=&Category=39&Recruiter=Company&SortBy=MostRecent&Page=2"
  );
  await cookies.close();

  await browserManager.get("PaginationService").discover();

  await browserManager.get("MetricsService").getResults();

  await cookies.getCookies(); // push current cookies to global state

  await browserManager.get("ScreenshotService").screenshot(screenshotPath);

  await browserManager.get("ContentService").getContent();

  await browserManager.exportState(outputPath);

  await browserManager.close();
};

run().catch(console.error);
