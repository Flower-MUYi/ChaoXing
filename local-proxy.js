// local-proxy.js - 本地零依赖全功能 Web 服务 + 代理服务器
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8787;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // 处理跨域头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const targetUrl = reqUrl.searchParams.get('url') || req.headers['x-target-url'];

  // 1. 如果有 targetUrl，执行反向代理
  if (targetUrl) {
    try {
      const target = new URL(targetUrl);
      const client = target.protocol === 'https:' ? https : http;

      const headers = { ...req.headers };
      delete headers.host;
      delete headers['x-target-url'];

      const customCookie = headers['x-target-cookie'] || headers['x-cookie'];
      if (customCookie) {
        headers['cookie'] = customCookie;
        delete headers['x-target-cookie'];
        delete headers['x-cookie'];
      }

      headers['origin'] = target.origin;
      headers['referer'] = target.origin + '/';
      headers['user-agent'] = 'Dalvik/2.1.0 (Linux; U; Android 12; SM-N9006 Build/8aba9e4.0) (schild:2d97f7b9439f21333c946878fc4d6ccb) (device:SM-N9006) Language/zh_CN com.chaoxing.mobile/ChaoXingStudy_3_6.7.5_android_phone_10941_314 (@Kalimdor)_68f184fd763546c1a04ab3a09b3deebb';

      const proxyReq = client.request(target, {
        method: req.method,
        headers: headers
      }, (proxyRes) => {
        const respHeaders = { ...proxyRes.headers };
        respHeaders['access-control-allow-origin'] = '*';
        respHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD';
        respHeaders['access-control-allow-headers'] = '*';
        respHeaders['access-control-expose-headers'] = '*';

        if (proxyRes.headers['set-cookie']) {
          respHeaders['x-set-cookie'] = JSON.stringify(proxyRes.headers['set-cookie']);
        }

        res.writeHead(proxyRes.statusCode, respHeaders);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      req.pipe(proxyReq);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Target URL', message: err.message }));
    }
    return;
  }

  // 2. 没有 targetUrl，作为静态网页服务器提供前端网页
  let pathname = reqUrl.pathname;
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Chaoxing Web & Proxy Server is running on http://127.0.0.1:${PORT}`);
});
