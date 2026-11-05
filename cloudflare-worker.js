/**
 * Cloudflare Worker 跨域代理脚本 (用于部署超星签到网页版后端反代)
 * 
 * 部署步骤:
 * 1. 登录 Cloudflare 控制台 -> Workers & Pages -> Create Application -> Create Worker
 * 2. 将此文件的全部代码复制粘贴到 Worker 代码编辑器中并点击 Save and Deploy
 * 3. 复制生成的 Worker 域名（例如: https://your-worker-name.your-subdomain.workers.dev）
 * 4. 在超星签到网页版的「网络与代理设置」中填入该 Worker 地址即可！
 */

export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    // 目标 URL 支持从查询参数 url 或 target 获取，也支持通过 X-Target-Url 头
    let targetUrl = url.searchParams.get('url') || url.searchParams.get('target') || request.headers.get('x-target-url');

    if (!targetUrl) {
      // 如果没有目标，返回服务状态
      return new Response(JSON.stringify({
        status: 'online',
        message: 'Chaoxing Web Sign CORS Proxy Worker is running!',
        usage: `${url.origin}/?url=https://mobilelearn.chaoxing.com/...`
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const target = new URL(targetUrl);
      const reqHeaders = new Headers(request.headers);

      // 清理代理专属 headers
      reqHeaders.delete('host');
      reqHeaders.delete('x-target-url');

      // 从自定义头或原始头取出 Cookie
      const customCookie = reqHeaders.get('x-target-cookie') || reqHeaders.get('x-cookie');
      if (customCookie) {
        reqHeaders.set('Cookie', customCookie);
        reqHeaders.delete('x-target-cookie');
        reqHeaders.delete('x-cookie');
      }

      // 伪装浏览器/移动端请求头
      reqHeaders.set('Origin', target.origin);
      reqHeaders.set('Referer', target.origin + '/');
      if (!reqHeaders.get('User-Agent') || reqHeaders.get('User-Agent').includes('Cloudflare')) {
        reqHeaders.set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; 23127PN0CC Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 com.chaoxing.mobile/ChaoXingStudy_3_6.2.2_android_phone_1079_189 (@Kalimdor)_9eeef3f15c7e4ff698cbfa2b9d214695');
      }

      const forwardInit = {
        method: request.method,
        headers: reqHeaders,
        redirect: 'follow',
      };

      if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
        forwardInit.body = await request.clone().arrayBuffer();
      }

      const response = await fetch(targetUrl, forwardInit);
      const respHeaders = new Headers(response.headers);

      // 允许跨域
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
      respHeaders.set('Access-Control-Allow-Headers', '*');
      respHeaders.set('Access-Control-Expose-Headers', 'Set-Cookie, x-set-cookie, content-type, content-length');

      // 将 Set-Cookie 复制到 x-set-cookie，方便前端 JavaScript 读取
      const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      if (setCookies && setCookies.length > 0) {
        respHeaders.set('x-set-cookie', JSON.stringify(setCookies));
      } else if (response.headers.get('set-cookie')) {
        respHeaders.set('x-set-cookie', JSON.stringify([response.headers.get('set-cookie')]));
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Proxy Error',
        message: err.message,
        target: targetUrl
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
