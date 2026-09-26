// server.js - Lightweight local development & testing server
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = urlObj.pathname;

  // Handle /api/chat route
  if (pathname === '/api/chat') {
    // Collect body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      // Mock Vercel req/res helpers
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
        console.error('API Error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Handle Clean URLs & routing
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

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 handler
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

server.listen(PORT, () => {
  console.log(`DoraHR server running at http://localhost:${PORT}`);
});
