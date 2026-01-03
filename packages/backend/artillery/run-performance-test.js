#!/usr/bin/env node
/**
 * Performance Test Script (Alternative zu Artillery)
 *
 * Dieses Script führt Load Tests gegen das Backend aus und sammelt
 * p50, p95, p99 und Max Response Times für alle Endpoints.
 *
 * Verwendung:
 *   node artillery/run-performance-test.js
 *
 * Voraussetzungen:
 *   - Backend läuft auf localhost:3091
 *   - Node.js 18+
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Configuration
const CONFIG = {
  target: 'http://localhost:3091',
  warmupDuration: 30, // 30 seconds
  testDuration: 60, // 60 seconds
  warmupRPS: 5,
  testRPS: 20,
  resultsPath: path.join(__dirname, 'results', 'results.json'),
};

// Scenarios with weights (total = 100)
// Note: API uses /api/v-alpha/ prefix (NestJS versioning format)
const SCENARIOS = [
  { name: 'Create Einsatz', weight: 20, method: 'POST', path: '/api/v-alpha/einsatz' },
  { name: 'Get All Einsätze', weight: 30, method: 'GET', path: '/api/v-alpha/einsatz?page=1&limit=10' },
  { name: 'Dashboard Query', weight: 20, method: 'GET', path: '/api/v-alpha/einsatz/active-with-counts' },
  { name: 'Get Einsatz Details', weight: 15, method: 'GET', path: '/api/v-alpha/einsatz/:id/details' },
  { name: 'Add ETB Eintrag', weight: 10, method: 'POST', path: '/api/v-alpha/etb/:etbId/eintrag' },
  { name: 'Complete Einsatz', weight: 5, method: 'POST', path: '/api/v-alpha/einsatz/:id/complete' },
];

// Metrics storage
const metrics = {
  scenarios: {},
  aggregate: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
  },
};

// Initialize metrics for each scenario
SCENARIOS.forEach((s) => {
  metrics.scenarios[s.name] = {
    requests: 0,
    successes: 0,
    failures: 0,
    responseTimes: [],
    errors: [],
  };
});

// Auth state
let authCookies = null;
const createdEinsatzIds = [];

// Test payloads
const ALARMSTICHWÖRTER = ['B1 Kleinbrand', 'B2 Brand klein', 'B3 Brand mittel', 'TH1 Technische Hilfe', 'RD Rettungsdienst'];
const ORTE = ['Teststadt', 'Musterheim', 'Beispieldorf'];
const ETB_TEXTE = ['Einsatzkräfte eingetroffen', 'Lage erkundet', 'Einsatz beendet'];
const ETB_KATEGORIEN = ['INFORMATION', 'LAGEMELDUNG', 'EINSATZBEFEHL'];

/**
 * Perform HTTP request with timing
 */
function makeRequest(options, body = null) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    const url = new URL(options.path, CONFIG.target);

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 3091,
      path: url.pathname + url.search,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(authCookies ? { Cookie: authCookies } : {}),
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000; // ms

        // Capture cookies
        if (res.headers['set-cookie']) {
          authCookies = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
        }

        resolve({
          statusCode: res.statusCode,
          data,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', (error) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      resolve({
        statusCode: 0,
        data: error.message,
        duration,
        success: false,
        error: error.message,
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Authenticate a virtual user
 */
async function authenticate(vuId) {
  const username = `perf_test_vu_${vuId}_${Date.now()}`;
  const result = await makeRequest({ method: 'POST', path: '/api/auth/unified' }, { username });
  return result.success;
}

/**
 * Execute a scenario
 */
async function executeScenario(scenario, vuId) {
  const scenarioMetrics = metrics.scenarios[scenario.name];
  scenarioMetrics.requests++;
  metrics.aggregate.totalRequests++;

  let result;

  try {
    switch (scenario.name) {
      case 'Create Einsatz': {
        const payload = {
          alarmstichwort: ALARMSTICHWÖRTER[Math.floor(Math.random() * ALARMSTICHWÖRTER.length)],
          einsatzort: {
            ort: ORTE[Math.floor(Math.random() * ORTE.length)],
            strasse: `Teststraße ${Math.floor(Math.random() * 100)}`,
          },
          beschreibung: `Performance Test VU ${vuId}`,
        };
        result = await makeRequest({ method: 'POST', path: '/api/v-alpha/einsatz' }, payload);
        if (result.success) {
          try {
            const data = JSON.parse(result.data);
            if (data.data?.id) {
              createdEinsatzIds.push(data.data.id);
              if (createdEinsatzIds.length > 100) createdEinsatzIds.shift();
            }
          } catch {}
        }
        break;
      }
      case 'Get All Einsätze': {
        result = await makeRequest({ method: 'GET', path: '/api/v-alpha/einsatz?page=1&limit=10' });
        break;
      }
      case 'Dashboard Query': {
        result = await makeRequest({ method: 'GET', path: '/api/v-alpha/einsatz/active-with-counts' });
        break;
      }
      case 'Get Einsatz Details': {
        if (createdEinsatzIds.length === 0) {
          // First create an einsatz
          const createResult = await makeRequest(
            { method: 'POST', path: '/api/v-alpha/einsatz' },
            {
              alarmstichwort: 'Test',
              beschreibung: 'For details test',
            },
          );
          if (createResult.success) {
            try {
              const data = JSON.parse(createResult.data);
              if (data.data?.id) createdEinsatzIds.push(data.data.id);
            } catch {}
          }
        }
        const einsatzId = createdEinsatzIds[Math.floor(Math.random() * createdEinsatzIds.length)];
        result = await makeRequest({ method: 'GET', path: `/api/v-alpha/einsatz/${einsatzId}/details` });
        break;
      }
      case 'Add ETB Eintrag': {
        if (createdEinsatzIds.length === 0) {
          const createResult = await makeRequest(
            { method: 'POST', path: '/api/v-alpha/einsatz' },
            {
              alarmstichwort: 'Test',
              beschreibung: 'For ETB test',
            },
          );
          if (createResult.success) {
            try {
              const data = JSON.parse(createResult.data);
              if (data.data?.id) createdEinsatzIds.push(data.data.id);
            } catch {}
          }
        }
        const einsatzId = createdEinsatzIds[Math.floor(Math.random() * createdEinsatzIds.length)];
        const payload = {
          text: ETB_TEXTE[Math.floor(Math.random() * ETB_TEXTE.length)],
          kategorie: ETB_KATEGORIEN[Math.floor(Math.random() * ETB_KATEGORIEN.length)],
          einsatzId: einsatzId,
        };
        result = await makeRequest({ method: 'POST', path: `/api/v-alpha/etb/${einsatzId}/eintrag` }, payload);
        break;
      }
      case 'Complete Einsatz': {
        // Create a new einsatz and complete it
        const createResult = await makeRequest(
          { method: 'POST', path: '/api/v-alpha/einsatz' },
          {
            alarmstichwort: 'Test Complete',
            beschreibung: 'For complete test',
          },
        );
        if (createResult.success) {
          try {
            const data = JSON.parse(createResult.data);
            if (data.data?.id) {
              result = await makeRequest({ method: 'POST', path: `/api/v-alpha/einsatz/${data.data.id}/complete` });
            }
          } catch {}
        }
        if (!result) result = { success: false, duration: 0, error: 'Failed to create einsatz' };
        break;
      }
    }

    scenarioMetrics.responseTimes.push(result.duration);
    metrics.aggregate.responseTimes.push(result.duration);

    if (result.success) {
      scenarioMetrics.successes++;
      metrics.aggregate.successfulRequests++;
    } else {
      scenarioMetrics.failures++;
      metrics.aggregate.failedRequests++;
      if (result.error) scenarioMetrics.errors.push(result.error);
    }
  } catch (error) {
    scenarioMetrics.failures++;
    metrics.aggregate.failedRequests++;
    scenarioMetrics.errors.push(error.message);
  }
}

/**
 * Select scenario based on weights
 */
function selectScenario() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const scenario of SCENARIOS) {
    cumulative += scenario.weight;
    if (rand <= cumulative) return scenario;
  }
  return SCENARIOS[0];
}

/**
 * Calculate percentiles
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Run the load test
 */
async function runTest() {
  console.log('🚀 Starting Performance Test');
  console.log(`   Target: ${CONFIG.target}`);
  console.log(`   Warmup: ${CONFIG.warmupDuration}s @ ${CONFIG.warmupRPS} RPS`);
  console.log(`   Test: ${CONFIG.testDuration}s @ ${CONFIG.testRPS} RPS`);
  console.log('');

  // Authenticate first
  console.log('🔐 Authenticating...');
  await authenticate(0);
  console.log('   ✅ Authentication successful');
  console.log('');

  // Warmup phase
  console.log('🔥 Warmup Phase...');
  const warmupEnd = Date.now() + CONFIG.warmupDuration * 1000;
  const warmupInterval = 1000 / CONFIG.warmupRPS;

  while (Date.now() < warmupEnd) {
    const scenario = selectScenario();
    executeScenario(scenario, Math.floor(Math.random() * 1000));
    await new Promise((r) => setTimeout(r, warmupInterval));
  }
  console.log('   ✅ Warmup complete');
  console.log('');

  // Clear warmup metrics
  Object.keys(metrics.scenarios).forEach((k) => {
    metrics.scenarios[k] = {
      requests: 0,
      successes: 0,
      failures: 0,
      responseTimes: [],
      errors: [],
    };
  });
  metrics.aggregate = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
  };

  // Test phase
  console.log('⚡ Test Phase (collecting metrics)...');
  const testEnd = Date.now() + CONFIG.testDuration * 1000;
  const testInterval = 1000 / CONFIG.testRPS;
  let progressDots = 0;

  while (Date.now() < testEnd) {
    const scenario = selectScenario();
    executeScenario(scenario, Math.floor(Math.random() * 1000));

    // Progress indicator
    progressDots++;
    if (progressDots % 100 === 0) {
      process.stdout.write('.');
    }

    await new Promise((r) => setTimeout(r, testInterval));
  }
  console.log('');
  console.log('   ✅ Test complete');
  console.log('');

  // Calculate results
  const results = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    aggregate: {
      totalRequests: metrics.aggregate.totalRequests,
      successfulRequests: metrics.aggregate.successfulRequests,
      failedRequests: metrics.aggregate.failedRequests,
      successRate: ((metrics.aggregate.successfulRequests / metrics.aggregate.totalRequests) * 100).toFixed(2),
      rps: (metrics.aggregate.totalRequests / CONFIG.testDuration).toFixed(2),
      latency: {
        min: Math.min(...metrics.aggregate.responseTimes).toFixed(2),
        max: Math.max(...metrics.aggregate.responseTimes).toFixed(2),
        p50: percentile(metrics.aggregate.responseTimes, 50).toFixed(2),
        p95: percentile(metrics.aggregate.responseTimes, 95).toFixed(2),
        p99: percentile(metrics.aggregate.responseTimes, 99).toFixed(2),
      },
    },
    scenarios: {},
  };

  // Per-scenario results
  for (const [name, data] of Object.entries(metrics.scenarios)) {
    if (data.requests > 0) {
      results.scenarios[name] = {
        requests: data.requests,
        successes: data.successes,
        failures: data.failures,
        successRate: ((data.successes / data.requests) * 100).toFixed(2),
        latency: {
          min: data.responseTimes.length > 0 ? Math.min(...data.responseTimes).toFixed(2) : '0',
          max: data.responseTimes.length > 0 ? Math.max(...data.responseTimes).toFixed(2) : '0',
          p50: percentile(data.responseTimes, 50).toFixed(2),
          p95: percentile(data.responseTimes, 95).toFixed(2),
          p99: percentile(data.responseTimes, 99).toFixed(2),
        },
        nfr4Status: percentile(data.responseTimes, 95) < 200 ? 'PASS' : 'FAIL',
      };
    }
  }

  // Save results
  fs.mkdirSync(path.dirname(CONFIG.resultsPath), { recursive: true });
  fs.writeFileSync(CONFIG.resultsPath, JSON.stringify(results, null, 2));

  // Print summary
  console.log('═'.repeat(60));
  console.log('📊 PERFORMANCE TEST RESULTS');
  console.log('═'.repeat(60));
  console.log('');
  console.log('AGGREGATE METRICS:');
  console.log(`   Total Requests:    ${results.aggregate.totalRequests}`);
  console.log(`   Success Rate:      ${results.aggregate.successRate}%`);
  console.log(`   Throughput:        ${results.aggregate.rps} RPS`);
  console.log(`   p50 Latency:       ${results.aggregate.latency.p50}ms`);
  console.log(`   p95 Latency:       ${results.aggregate.latency.p95}ms`);
  console.log(`   p99 Latency:       ${results.aggregate.latency.p99}ms`);
  console.log(`   Max Latency:       ${results.aggregate.latency.max}ms`);
  console.log('');
  console.log('PER-SCENARIO METRICS:');
  console.log('─'.repeat(60));

  for (const [name, data] of Object.entries(results.scenarios)) {
    const nfr4Color = data.nfr4Status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
    console.log(`\n${name}:`);
    console.log(`   Requests: ${data.requests} (${data.successRate}% success)`);
    console.log(`   p50: ${data.latency.p50}ms | p95: ${data.latency.p95}ms | p99: ${data.latency.p99}ms`);
    console.log(`   NFR-4 (<200ms p95): ${nfr4Color}${data.nfr4Status}\x1b[0m`);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`Results saved to: ${CONFIG.resultsPath}`);

  // NFR-4 Overall Assessment
  const overallP95 = parseFloat(results.aggregate.latency.p95);
  const nfr4Pass = overallP95 < 200;
  console.log('');
  console.log(`NFR-4 OVERALL: ${nfr4Pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} (p95: ${overallP95}ms)`);

  return results;
}

// Run
runTest().catch(console.error);
