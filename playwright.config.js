// Playwright config for the Bali Itinerary Planner test suite.
// acceptDownloads is required so that blob-driven downloads (ICS export) are tracked.
module.exports = {
  testDir: "./tests",
  workers: 1,
  retries: 1,
  timeout: 90000,
  use: {
    baseURL: "http://localhost:8000",
    acceptDownloads: true,
    viewport: { width: 1280, height: 800 },
    trace: "off",
  },
};
