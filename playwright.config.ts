import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3200";
const launchOptions = {
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: BASE_URL, trace: "off", launchOptions },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: "npx next start -p 3200", url: BASE_URL, reuseExistingServer: true, timeout: 120_000 },
});
