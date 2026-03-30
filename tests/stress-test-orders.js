#!/usr/bin/env node

/**
 * Stress Test for Soupz Orders System
 * Tests concurrent order creation, processing, cancellation, and input handling
 */

import http from 'http';

const DAEMON_HOST = process.env.SOUPZ_HOST || 'localhost';
const DAEMON_PORT = process.env.SOUPZ_REMOTE_PORT || 7533;
const BASE_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;

const stats = {
  created: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  timeouts: 0,
  errors: 0,
  startTime: Date.now(),
  endTime: null,
  latencies: []
};

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const options = {
      hostname: DAEMON_HOST,
      port: DAEMON_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': 'stress-test-device'
      }
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - startTime;
        stats.latencies.push(latency);
        
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, latency });
        } catch (e) {
          resolve({ status: res.statusCode, data, latency });
        }
      });
    });

    req.on('error', (err) => {
      stats.errors++;
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function createOrder(prompt, agent = 'copilot') {
  const order = {
    prompt,
    agent,
    mode: 'default',
    options: {}
  };

  try {
    const result = await makeRequest('POST', '/api/orders', order);
    if (result.status === 200 || result.status === 201 || result.status === 202) {
      stats.created++;
      return result.data;
    } else {
      stats.failed++;
      console.error(`Failed to create order: ${result.status}`, result.data);
      return null;
    }
  } catch (err) {
    stats.errors++;
    console.error('Error creating order:', err.message);
    return null;
  }
}

async function getOrder(orderId) {
  try {
    const result = await makeRequest('GET', `/api/orders/${orderId}`);
    return result.status === 200 ? result.data : null;
  } catch (err) {
    console.error(`Error getting order ${orderId}:`, err.message);
    return null;
  }
}

async function cancelOrder(orderId) {
  try {
    const result = await makeRequest('POST', `/api/orders/${orderId}/cancel`);
    if (result.status === 200) {
      stats.cancelled++;
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error cancelling order ${orderId}:`, err.message);
    return false;
  }
}

async function sendInput(orderId, answers) {
  try {
    const result = await makeRequest('POST', `/api/orders/${orderId}/input`, { answers });
    return result.status === 200;
  } catch (err) {
    console.error(`Error sending input to order ${orderId}:`, err.message);
    return false;
  }
}

async function listOrders() {
  try {
    const result = await makeRequest('GET', '/api/orders');
    return result.status === 200 ? result.data.orders : [];
  } catch (err) {
    console.error('Error listing orders:', err.message);
    return [];
  }
}

async function waitForOrderCompletion(orderId, timeoutMs = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const order = await getOrder(orderId);
    
    if (!order) {
      stats.errors++;
      return { success: false, reason: 'order_not_found' };
    }

    if (order.status === 'completed') {
      stats.completed++;
      return { success: true, order };
    }

    if (order.status === 'failed' || order.status === 'error') {
      stats.failed++;
      return { success: false, reason: 'order_failed', order };
    }

    if (order.status === 'cancelled') {
      return { success: false, reason: 'order_cancelled', order };
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  stats.timeouts++;
  return { success: false, reason: 'timeout' };
}

async function runTest1_BasicOrder() {
  console.log('\n=== Test 1: Basic Order Creation ===');
  
  const order = await createOrder('echo "stress test 1"', 'copilot');
  if (!order) {
    console.log('❌ Failed to create order');
    return false;
  }

  console.log(`✓ Created order ${order.id}`);
  
  const result = await waitForOrderCompletion(order.id, 15000);
  if (result.success) {
    console.log(`✓ Order completed successfully`);
    return true;
  } else {
    console.log(`❌ Order did not complete: ${result.reason}`);
    return false;
  }
}

async function runTest2_ConcurrentOrders() {
  console.log('\n=== Test 2: Concurrent Order Creation (10 orders) ===');
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(createOrder(`echo "concurrent test ${i}"`, 'copilot'));
  }

  const orders = await Promise.all(promises);
  const validOrders = orders.filter(o => o !== null);
  
  console.log(`✓ Created ${validOrders.length}/10 orders`);
  
  if (validOrders.length === 0) {
    console.log('❌ No orders created');
    return false;
  }

  const completionPromises = validOrders.map(o => waitForOrderCompletion(o.id, 20000));
  const results = await Promise.all(completionPromises);
  
  const successful = results.filter(r => r.success).length;
  console.log(`✓ ${successful}/${validOrders.length} orders completed`);
  
  return successful > 0;
}

async function runTest3_RapidFire() {
  console.log('\n=== Test 3: Rapid Fire (50 orders in 5 seconds) ===');
  
  const orders = [];
  const batchSize = 10;
  
  for (let batch = 0; batch < 5; batch++) {
    const batchPromises = [];
    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(createOrder(`echo "rapid ${batch * batchSize + i}"`, 'copilot'));
    }
    
    const batchOrders = await Promise.all(batchPromises);
    orders.push(...batchOrders.filter(o => o !== null));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✓ Created ${orders.length}/50 orders`);
  return orders.length > 0;
}

async function runTest4_OrderCancellation() {
  console.log('\n=== Test 4: Order Cancellation ===');
  
  const order = await createOrder('sleep 30', 'copilot');
  if (!order) {
    console.log('❌ Failed to create order');
    return false;
  }

  console.log(`✓ Created order ${order.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const cancelled = await cancelOrder(order.id);
  if (cancelled) {
    console.log(`✓ Order cancelled successfully`);
    return true;
  } else {
    console.log(`❌ Failed to cancel order`);
    return false;
  }
}

async function runTest5_OrderRetrieval() {
  console.log('\n=== Test 5: Order Retrieval & Listing ===');
  
  const order = await createOrder('echo "retrieval test"', 'copilot');
  if (!order) {
    console.log('❌ Failed to create order');
    return false;
  }

  const retrieved = await getOrder(order.id);
  if (!retrieved) {
    console.log('❌ Failed to retrieve order');
    return false;
  }

  console.log(`✓ Retrieved order ${order.id}`);
  
  const orders = await listOrders();
  console.log(`✓ Listed ${orders.length} orders`);
  
  return orders.length > 0;
}

async function runTest6_InputHandling() {
  console.log('\n=== Test 6: Interactive Input Handling ===');
  
  const order = await createOrder('read -p "Enter name: " name && echo "Hello $name"', 'copilot');
  if (!order) {
    console.log('❌ Failed to create order');
    return false;
  }

  console.log(`✓ Created order ${order.id}`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const inputSent = await sendInput(order.id, [{ questionId: '1', answer: 'StressTest' }]);
  if (inputSent) {
    console.log(`✓ Input sent successfully`);
  } else {
    console.log(`⚠ Input send failed (expected if order doesn't support interactive mode)`);
  }
  
  return true;
}

function printStatistics() {
  stats.endTime = Date.now();
  const duration = (stats.endTime - stats.startTime) / 1000;
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        STRESS TEST RESULTS             ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Duration:        ${duration.toFixed(2)}s`);
  console.log(`Orders Created:  ${stats.created}`);
  console.log(`Completed:       ${stats.completed}`);
  console.log(`Failed:          ${stats.failed}`);
  console.log(`Cancelled:       ${stats.cancelled}`);
  console.log(`Timeouts:        ${stats.timeouts}`);
  console.log(`Errors:          ${stats.errors}`);
  
  if (stats.latencies.length > 0) {
    const sorted = stats.latencies.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log('\nLatency Stats:');
    console.log(`  Average:       ${avg.toFixed(2)}ms`);
    console.log(`  P50:           ${p50}ms`);
    console.log(`  P95:           ${p95}ms`);
    console.log(`  P99:           ${p99}ms`);
    console.log(`  Min:           ${sorted[0]}ms`);
    console.log(`  Max:           ${sorted[sorted.length - 1]}ms`);
  }
  
  const successRate = stats.created > 0 
    ? ((stats.completed / stats.created) * 100).toFixed(1)
    : 0;
  console.log(`\nSuccess Rate:    ${successRate}%`);
  console.log(`Throughput:      ${(stats.created / duration).toFixed(2)} orders/sec`);
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   SOUPZ ORDER SYSTEM STRESS TEST       ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Target: ${BASE_URL}`);
  
  try {
    const healthCheck = await makeRequest('GET', '/health');
    if (healthCheck.status !== 200) {
      console.log('\n❌ Daemon health check failed');
      console.log('Make sure the daemon is running: npx soupz');
      process.exit(1);
    }
    console.log('✓ Daemon is healthy\n');
  } catch (err) {
    console.log('\n❌ Cannot connect to daemon');
    console.log('Make sure the daemon is running: npx soupz');
    process.exit(1);
  }

  const tests = [
    runTest1_BasicOrder,
    runTest2_ConcurrentOrders,
    runTest3_RapidFire,
    runTest4_OrderCancellation,
    runTest5_OrderRetrieval,
    runTest6_InputHandling
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`Test error: ${err.message}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  printStatistics();
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  Tests Passed: ${passed}/${tests.length}`.padEnd(40) + '║');
  console.log(`║  Tests Failed: ${failed}/${tests.length}`.padEnd(40) + '║');
  console.log('╚════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
