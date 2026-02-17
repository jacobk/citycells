/**
 * Smoke Test Script
 * 
 * Verifies that the CityCells application starts and renders without crashing.
 * Uses Playwright for headless browser automation.
 * 
 * WHY: Catches runtime errors that build/lint won't detect:
 * - React hydration errors
 * - Client-side JavaScript crashes
 * - Missing environment variables at runtime
 * - Map component rendering issues
 * 
 * See ADR 020 for testing strategy rationale.
 * See TICKET-025 for implementation requirements.
 * 
 * Usage:
 *   npm run smoke-test
 * 
 * @module scripts/smoke-test
 */

import { chromium, Browser, Page, ConsoleMessage } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';

// Configuration
const DEV_SERVER_PORT = 3000;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const STARTUP_TIMEOUT_MS = 60000; // 60 seconds to start dev server
const PAGE_LOAD_TIMEOUT_MS = 30000; // 30 seconds for page to load

// Console message severity levels to treat as errors
const ERROR_LEVELS = ['error'] as const;

interface TestResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Wait for the dev server to be ready.
 */
async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet, keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  return false;
}

/**
 * Start the Next.js dev server.
 */
function startDevServer(): ChildProcess {
  console.log('[Smoke Test] Starting dev server...');
  
  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: false,
  });
  
  // Log server output for debugging
  server.stdout?.on('data', (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[Dev Server] ${output}`);
    }
  });
  
  server.stderr?.on('data', (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`[Dev Server Error] ${output}`);
    }
  });
  
  return server;
}

/**
 * Run smoke test on the home page.
 */
async function testHomePage(page: Page): Promise<TestResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Collect console messages
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    const text = msg.text();
    
    // Ignore known benign messages
    if (text.includes('Download the React DevTools')) return;
    if (text.includes('Compiled successfully')) return;
    
    if ((ERROR_LEVELS as readonly string[]).includes(type)) {
      errors.push(`Console ${type}: ${text}`);
    } else if (type === 'warning') {
      warnings.push(`Console warning: ${text}`);
    }
  });
  
  // Catch page errors (uncaught exceptions)
  page.on('pageerror', (error: Error) => {
    errors.push(`Page error: ${error.message}`);
  });
  
  console.log('[Smoke Test] Loading home page...');
  
  try {
    await page.goto(DEV_SERVER_URL, {
      waitUntil: 'networkidle',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
    
    // Wait for key elements to be visible
    console.log('[Smoke Test] Checking for map container...');
    
    // WHY: The map is the core UI element - if it renders, the app is working
    // Look for Leaflet map container or React-Leaflet wrapper
    const mapSelector = '.leaflet-container, [data-testid="map"]';
    
    try {
      await page.waitForSelector(mapSelector, { timeout: 10000 });
      console.log('[Smoke Test] Map container found!');
    } catch {
      // Map might not be visible without auth, check for login button instead
      console.log('[Smoke Test] Map not found, checking for auth UI...');
      
      const authSelector = 'button, [data-testid="connect-strava"]';
      try {
        await page.waitForSelector(authSelector, { timeout: 5000 });
        console.log('[Smoke Test] Auth UI found!');
      } catch {
        errors.push('Neither map nor auth UI found - page may not have rendered correctly');
      }
    }
    
    // Take a screenshot for debugging (optional)
    // await page.screenshot({ path: 'smoke-test-screenshot.png' });
    
  } catch (error) {
    errors.push(`Navigation error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Main smoke test runner.
 */
async function runSmokeTest(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[Smoke Test] CityCells Smoke Test');
  console.log('='.repeat(60));
  
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  
  try {
    // Start dev server
    server = startDevServer();
    
    // Wait for server to be ready
    console.log('[Smoke Test] Waiting for dev server to start...');
    const serverReady = await waitForServer(DEV_SERVER_URL, STARTUP_TIMEOUT_MS);
    
    if (!serverReady) {
      console.error('[Smoke Test] FAILED: Dev server did not start within timeout');
      process.exit(1);
    }
    
    console.log('[Smoke Test] Dev server is ready!');
    
    // Launch browser
    console.log('[Smoke Test] Launching headless browser...');
    browser = await chromium.launch({
      headless: true,
    });
    
    const page = await browser.newPage();
    
    // Run tests
    const result = await testHomePage(page);
    
    // Report results
    console.log('\n' + '='.repeat(60));
    console.log('[Smoke Test] Results');
    console.log('='.repeat(60));
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((w) => console.log(`  - ${w}`));
    }
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }
    
    if (result.passed) {
      console.log('\n[Smoke Test] PASSED: Application rendered without critical errors');
      process.exit(0);
    } else {
      console.error('\n[Smoke Test] FAILED: Application had critical errors');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('[Smoke Test] FAILED: Unexpected error');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (server) {
      console.log('[Smoke Test] Stopping dev server...');
      server.kill('SIGTERM');
      // Give it a moment to clean up
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Run the smoke test
runSmokeTest();
