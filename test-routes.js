// test-routes.js - Automated route & functionality test
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3456;

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = urlObj.pathname;

  if (pathname === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      req.body = body;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };

      try {
        await chatHandler(req, res);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let filePath = '';
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/chat') {
    filePath = path.join(__dirname, 'chat.html');
  } else if (pathname === '/about') {
    filePath = path.join(__dirname, 'about.html');
  } else {
    filePath = path.join(__dirname, pathname);
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const notFoundPath = path.join(__dirname, '404.html');
      fs.readFile(notFoundPath, (err404, data404) => {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.end(data404 || '<h1>404 Not Found</h1>');
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        res.end('Server Error');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.end(content);
    });
  });
});

async function runTests() {
  server.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
      try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
      } catch (e) {
        console.error(`❌ FAIL: ${name}:`, e.message);
        failed++;
      }
    }

    // Helper fetch
    const get = async (path) => {
      const res = await fetch(`http://localhost:${PORT}${path}`);
      const text = await res.text();
      return { status: res.status, headers: res.headers, text };
    };

    const post = async (path, body) => {
      const res = await fetch(`http://localhost:${PORT}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    // Test 1: Homepage GET /
    await test('GET / returns 200 and contains DoraHR links', async () => {
      const res = await get('/');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('DoraHR MBA Assistant')) throw new Error('Missing title');
      if (!res.text.includes('href="/chat"')) throw new Error('Missing /chat link');
      if (!res.text.includes('Start Chatting')) throw new Error('Missing Start Chatting button');
      if (res.text.includes('YOUR_POE_LINK')) throw new Error('Found broken YOUR_POE_LINK!');
    });

    // Test 2: Chat page GET /chat
    await test('GET /chat returns 200 and contains chat interface', async () => {
      const res = await get('/chat');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes("Hi! I'm DoraHR")) throw new Error('Missing DoraHR welcome message');
      if (!res.text.includes('Explain HR analytics')) throw new Error('Missing suggested questions');
      if (!res.text.includes('Ask DoraHR anything...')) throw new Error('Missing input placeholder');
      if (!res.text.includes('New Chat')) throw new Error('Missing New Chat button');
      if (!res.text.includes('Clear')) throw new Error('Missing Clear Chat button');
    });

    // Test 3: About page GET /about
    await test('GET /about returns 200 and contains about details', async () => {
      const res = await get('/about');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('About DoraHR')) throw new Error('Missing About title');
      if (!res.text.includes('not an official product')) throw new Error('Missing disclaimer');
    });

    // Test 4: 404 Page on invalid route
    await test('GET /invalid-page-test returns 404 with Back button', async () => {
      const res = await get('/invalid-page-test');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
      if (!res.text.includes('Page Not Found')) throw new Error('Missing 404 title');
      if (!res.text.includes('Back to DoraHR')) throw new Error('Missing Back button');
    });

    // Test 5: POST /api/chat when no key configured
    await test('POST /api/chat returns friendly unavailable message when no key configured', async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await post('/api/chat', {
        messages: [{ role: 'user', content: 'What is HR analytics?' }]
      });
      if (res.status !== 503) throw new Error(`Expected 503, got ${res.status}`);
      if (!res.data.error.includes('temporarily unavailable')) throw new Error('Expected friendly unavailable notice');
    });

    // Test 6: POST /api/chat validation
    await test('POST /api/chat validates empty messages', async () => {
      const res = await post('/api/chat', { messages: [] });
      if (res.status !== 400) throw new Error(`Expected 400 for empty messages, got ${res.status}`);
    });

    console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}

runTests();
