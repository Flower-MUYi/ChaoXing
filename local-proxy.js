// local-proxy.js - 本地零依赖全功能 Web 服务 + 自动免密登录代理
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8787;

// 预存已验证成功的会话数据
let activeSession = {
  phoneNumber: "18650828531",
  name: "杨松",
  school: "井冈山大学",
  uname: "2307106004",
  puid: 293229202,
  uid: 246667203,
  fid: 1264,
  avatar: "https://photo.chaoxing.com/p/293229202_120?flag=1&psize=120_120c&ext=jpg",
  cookies: "JSESSIONID=C2197994E22E44FDA92755DACF4ED7AB; fid=1264; _uid=293229202; _d=1793910065759; UID=293229202; vc3=b4saRz%2BsHzAuTGAtibQ4nw8ihgwUqLeCzdszmEBCbpLtWyMn2wmO3aR5VwIPqPjNxNw%2BhcIwMIHtfmKsGwoDWT7N9bfZ%2FtPqX0JvzinRIAvRAMXPdnYxNbQrEsVnZc1WW87L2%2F9WtT1NtRQk7UNkmg%2FfKmBoFvPDUYZil3SSnLI%3D43958cd024b1ab4b01ffde19829aef7a; uf=b2d2c93beefa90dcd3bd18cf1d9ac5837d2e650a22d3c653e997605a150451365934c1d1e23b63048509d9310e0ea87481a6c9ddee30899fd807a544f7930b6aed1e6c11a143bb563b0339d97cdac4baa7000e8371c8054d713028f1ec42bf71b1188854805578ccd29b4c664b2bc417d0812e9e8f5f1c12ef595a01d26d223816f7c0667fc6931d480ff42a0f4aadf14df7ff280fcb29d10d8a4c92b12beb4ba5c798ff8eda40962c6b0b5f1aa7bc0c560d457d8c24c6dfe7fafd565af53bf2; cx_p_token=ce3cc17f17504d1c424be9a86c8a35e5; p_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIyOTMyMjkyMDIiLCJsb2dpblRpbWUiOjE3OTM5MTAwNjU3NjAsImV4cCI6MTc5NDUxNDg2NX0.9iA5yWRm91NZFqeXlaW5F-qlzsN1LQYXkoHhRd80Z_4; xxtenc=65687a8a0997f167e454f980f7ecf68b; DSSTASH_LOG=C_38-UN_1213-US_293229202-T_1793910065760; route=2763694f69e41d34a4f731c4671ac18e"
};

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

  // 1. 获取预设自动登录 Session 接口
  if (reqUrl.pathname === '/api/current-session') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', session: activeSession }));
    return;
  }

  // 2. 代理请求逻辑
  const targetUrl = reqUrl.searchParams.get('url') || req.headers['x-target-url'];
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

  // 3. 静态前端资源分发
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
