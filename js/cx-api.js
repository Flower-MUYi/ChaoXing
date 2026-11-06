/**
 * Chaoxing Web Sign - 超星网络请求与签到 API 核心模块
 * 还原原 Android 项目所有核心签到业务逻辑
 */

class ChaoxingApi {
  constructor(cookieJar, proxyConfig = {}) {
    this.cookieJar = cookieJar;
    this.proxyConfig = Object.assign({
      mode: 'corsproxy', // 'worker', 'corsproxy', 'direct'
      workerUrl: '',     // 例如 'https://my-cf-worker.workers.dev'
      customProxy: ''    // 自定义代理前缀
    }, proxyConfig);

    this.deviceCode = localStorage.getItem('cx_device_code') || window.CxCrypto.generateDeviceCode();
    localStorage.setItem('cx_device_code', this.deviceCode);
  }

  setProxyConfig(config) {
    this.proxyConfig = Object.assign(this.proxyConfig, config);
  }

  /**
   * 将目标超星 URL 转换为通过代理或直连的请求 URL 与 Headers
   */
  buildRequest(targetUrl, options = {}) {
    let finalUrl = targetUrl;
    const headers = new Headers(options.headers || {});

    const cookieStr = this.cookieJar.toCookieHeader();
    if (cookieStr) {
      headers.set('x-target-cookie', cookieStr);
      try { headers.set('Cookie', cookieStr); } catch (e) {}
    }

    if (this.proxyConfig.mode === 'local') {
      finalUrl = `http://127.0.0.1:8787/?url=${encodeURIComponent(targetUrl)}`;
    } else if (this.proxyConfig.mode === 'worker' && this.proxyConfig.workerUrl) {
      const base = this.proxyConfig.workerUrl.replace(/\/+$/, '');
      finalUrl = `${base}/?url=${encodeURIComponent(targetUrl)}`;
    } else if (this.proxyConfig.mode === 'corsproxy') {
      finalUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
    } else if (this.proxyConfig.mode === 'custom' && this.proxyConfig.customProxy) {
      const prefix = this.proxyConfig.customProxy.trim();
      finalUrl = prefix.includes('?') ? `${prefix}${encodeURIComponent(targetUrl)}` : `${prefix}/${targetUrl}`;
    }

    return {
      url: finalUrl,
      options: {
        ...options,
        headers
      }
    };
  }

  /**
   * 发送统一请求并处理 Cookie 和跨域返回
   */
  async request(targetUrl, options = {}) {
    const { url, options: reqOpts } = this.buildRequest(targetUrl, options);
    const resp = await fetch(url, reqOpts);

    // 从响应中提取 Set-Cookie 并存入本地 CookieJar
    const customSetCookie = resp.headers.get('x-set-cookie');
    if (customSetCookie) {
      this.cookieJar.parseAndSave(customSetCookie);
    }

    const setCookie = resp.headers.get('set-cookie');
    if (setCookie) {
      this.cookieJar.parseAndSave(setCookie);
    }

    return resp;
  }

  /**
   * 账号密码登录
   */
  async login(phoneNumber, password) {
    const unameEnc = window.CxCrypto.encryptByAES(phoneNumber);
    const pwdEnc = window.CxCrypto.encryptByAES(password);

    const formData = new URLSearchParams();
    formData.append('fid', '-1');
    formData.append('uname', unameEnc);
    formData.append('password', pwdEnc);
    formData.append('refer', 'https://i.chaoxing.com');
    formData.append('t', 'true');
    formData.append('forbidotherlogin', '0');
    formData.append('validate', '');
    formData.append('doubleFactorLogin', '0');
    formData.append('independentId', '0');
    formData.append('independentNameId', '0');

    let respText = '';
    try {
      const resp = await this.request('https://passport2.chaoxing.com/fanyalogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      respText = await resp.text();
      let data;
      try {
        data = JSON.parse(respText);
      } catch (parseErr) {
        if (resp.status === 403 || respText.includes('Attention Required') || respText.includes('blocked')) {
          throw new Error('当前公用代理节点被拦截 (Cloudflare 403)。建议在设置中填入自建 Cloudflare Worker 代理，或使用下方的【Cookie 登录】直接进入！');
        }
        throw new Error(`代理节点返回异常 (${resp.status}): ${respText.substring(0, 100)}`);
      }

      if (!data.status) {
        throw new Error(data.msg2 || data.msg || '超星返回: 账号或密码错误');
      }

      // 登录成功后获取用户信息
      const userInfo = await this.getUserInfo();
      return userInfo;
    } catch (err) {
      throw err;
    }
  }

  /**
   * 获取当前登录用户信息
   */
  async getUserInfo() {
    const resp = await this.request('https://sso.chaoxing.com/apis/login/userLogin4Uname.do', {
      method: 'GET'
    });
    const res = await resp.json();
    if (!res || res.result !== 1 || !res.msg) {
      throw new Error('获取用户信息失败，会话可能已过期');
    }

    const msg = res.msg;
    return {
      uid: msg.uid,
      puid: msg.puid,
      name: msg.name,
      uname: msg.uname,
      fid: msg.fid,
      pic: (msg.pic || '').replace('http://', 'https://'),
      avatar: `https://photo.chaoxing.com/p/${msg.puid}_120?flag=1&psize=120_120c&ext=jpg`
    };
  }

  /**
   * 获取所有加入的班级课程列表
   */
  async getCourses() {
    const resp = await this.request('https://mooc1-api.chaoxing.com/mycourse/backclazzdata?view=json&rss=1', {
      method: 'GET'
    });
    const res = await resp.json();
    if (!res || res.result === 0 || !res.channelList) {
      throw new Error('获取课程列表失败或会话已失效');
    }

    const courses = [];
    for (const item of res.channelList) {
      const content = item.content;
      if (!content || !content.course || !item.cataName) continue;
      const courseData = content.course.data && content.course.data[0];
      if (!courseData) continue;

      courses.push({
        classId: content.id,
        courseId: courseData.id,
        name: courseData.name,
        teacher: courseData.teacherfactor || '未知教师',
        school: courseData.schools || '',
        cover: courseData.imageurl || 'https://p.ananas.chaoxing.com/star3/270_160c/669ca80d6a0c5f74835bb936a41aabca.jpg'
      });
    }

    return courses;
  }

  /**
   * 获取单个课程的签到活动列表
   */
  async getActivities(courseId, classId) {
    const url = `https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist?fid=0&showNotStartedActive=0&courseId=${courseId}&classId=${classId}`;
    const resp = await this.request(url, { method: 'GET' });
    const res = await resp.json();

    if (!res || !res.data || !res.data.activeList) {
      return { ext: '', activities: [] };
    }

    const signActivities = res.data.activeList
      .filter(act => act.type === 2 || act.type === 74)
      .map(act => {
        let typeName = '普通签到';
        const otherId = String(act.otherId);
        if (otherId === '2') typeName = '二维码签到';
        else if (otherId === '3') typeName = '手势签到';
        else if (otherId === '4') typeName = '位置签到';
        else if (otherId === '5') typeName = '签到码签到';
        else if (otherId === '0') typeName = '拍照/普通签到';

        return {
          id: act.id,
          activeId: act.id,
          name: act.nameOne || '课堂签到',
          subTitle: act.nameFour || '',
          startTime: act.startTime,
          endTime: act.endTime,
          status: act.status, // 1 表示进行中，2 表示已结束
          isOver: act.status !== 1 || (act.endTime && Date.now() > act.endTime),
          userStatus: act.userStatus, // 是否已签到等
          otherId: otherId,
          typeName: typeName,
          courseId,
          classId
        };
      });

    return {
      ext: JSON.stringify(res.data.ext || {}),
      activities: signActivities
    };
  }

  /**
   * 智能并发全量扫描所有课程正在进行的签到活动 (8 并发极速池)
   */
  async scanAllActiveSigns(courses, progressCallback = null) {
    const activeList = [];
    const concurrency = 8;
    let completed = 0;
    const total = courses.length;

    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (index < courses.length) {
        const curIdx = index++;
        const course = courses[curIdx];

        try {
          const { activities } = await this.getActivities(course.courseId, course.classId);
          const ongoing = activities.filter(a => !a.isOver);
          ongoing.forEach(act => {
            activeList.push({
              ...act,
              courseName: course.name,
              teacher: course.teacher
            });
          });
        } catch (e) {
          console.warn(`Scan error for course ${course.name}`, e);
        } finally {
          completed++;
          if (progressCallback) {
            progressCallback(completed, total, course.name);
          }
        }
      }
    });

    await Promise.all(workers);
    return activeList;
  }

  /**
   * 获取签到具体参数详情
   */
  async getSignDetail(activeId) {
    const url = `https://mobilelearn.chaoxing.com/v2/apis/active/getPPTActiveInfo?activeId=${activeId}`;
    const resp = await this.request(url, { method: 'GET' });
    const res = await resp.json();
    return res.data || {};
  }

  /**
   * 预签到请求 (对应原版 preSign)
   */
  async preSign(courseId, classId, activeId, uid, ext = '') {
    const url = `https://mobilelearn.chaoxing.com/newsign/preSign?courseId=${courseId}&classId=${classId}&activePrimaryId=${activeId}&general=1&sys=1&ls=1&appType=15&uid=${uid}&isTeacherViewOpen=0`;
    const formData = new URLSearchParams();
    formData.append('ext', ext);

    const resp = await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const bodyText = await resp.text();
    // 触发 analysis 防作弊流程
    await this.postAnalysis(activeId).catch(err => console.warn('postAnalysis error', err));
    return bodyText;
  }

  /**
   * 触发签到前置行为分析 (对应原版 postAnalysis & postAfterAnalysis)
   */
  async postAnalysis(activeId) {
    const url = `https://mobilelearn.chaoxing.com/pptSign/analysis?vs=1&DB_STRATEGY=RANDOM&aid=${activeId}`;
    const resp = await this.request(url, { method: 'GET' });
    const text = await resp.text();
    const match = text.match(/code='\+'([a-f0-9]+)'/);
    if (match && match[1]) {
      const code = match[1];
      const url2 = `https://mobilelearn.chaoxing.com/pptSign/analysis2?DB_STRATEGY=RANDOM&code=${code}`;
      await this.request(url2, { method: 'GET' });
    }
  }

  /**
   * 预校验签到码或手势 (对应原版 checkSignCode / checkSignGesture)
   */
  async checkSignCode(activeId, signCode) {
    const url = `https://mobilelearn.chaoxing.com/widget/sign/pcStuSignController/checkSignCode?activeId=${activeId}&signCode=${encodeURIComponent(signCode)}`;
    const resp = await this.request(url, { method: 'GET' });
    const res = await resp.json();
    return res && res.result === 1;
  }

  /**
   * 统一提交签到基础方法
   */
  async submitSign(params) {
    const urlObj = new URL('https://mobilelearn.chaoxing.com/pptSign/stuSignajax');
    urlObj.searchParams.set('appType', '15');
    urlObj.searchParams.set('ifTiJiao', '1');
    urlObj.searchParams.set('vpProbability', '-1');
    urlObj.searchParams.set('vpStrategy', '');
    urlObj.searchParams.set('clientip', '');
    urlObj.searchParams.set('deviceCode', this.deviceCode);

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        urlObj.searchParams.set(k, String(v));
      }
    }

    const resp = await this.request(urlObj.toString(), { method: 'GET' });
    const result = (await resp.text()).trim();

    return this.parseSignResult(result);
  }

  /**
   * 解析签到响应结果状态
   */
  parseSignResult(result) {
    if (result === 'success') {
      return { success: true, message: '🎉 签到成功！' };
    }
    if (result === '您已签到过了') {
      return { success: true, message: '✅ 您已经签到过了，无需重复签到' };
    }
    if (result === 'success2') {
      return { success: false, message: '❌ 迟到或签到已截止' };
    }
    if (result.startsWith('errorLocation')) {
      const dist = result.split('_')[1];
      return { success: false, message: `❌ 位置不在设置范围内${dist ? ` (距离约 ${dist} 米)` : ''}` };
    }
    if (result === '签到失败，请重新扫描。') {
      return { success: false, message: '❌ 二维码已失效，请获取最新二维码后重试' };
    }
    if (result.includes('同一设备不允许重复签到')) {
      return { success: false, message: '⚠️ 同一设备不允许重复签到，建议在设置中重新生成随机设备码' };
    }
    return { success: false, message: `签到响应: ${result}` };
  }

  /**
   * 自动探测并破解签到码 (4位数字)
   */
  async crackPassword(activeId, onProgress = null) {
    const list = window.COMMON_SIGN_CODES || [];
    const testFn = async (code) => {
      return await this.checkSignCode(activeId, code);
    };
    return await window.SignCracker.crackWithCandidates(list, testFn, 8, onProgress);
  }

  /**
   * 自动探测并破解手势密码 (九宫格连线)
   */
  async crackGesture(activeId, onProgress = null) {
    const list = window.COMMON_GESTURES || [];
    const testFn = async (code) => {
      return await this.checkSignCode(activeId, code);
    };
    return await window.SignCracker.crackWithCandidates(list, testFn, 8, onProgress);
  }

  /**
   * 全自动智能签到 (一键搞定位置自动嗅探、手势/密码自动爆破、普通秒签)
   */
  async autoSign(activity, userInfo, logCallback = console.log) {
    const activeId = activity.activeId || activity.id;
    const baseParams = {
      activeId,
      courseId: activity.courseId || 0,
      classId: activity.classId || 0,
      uid: userInfo.puid || userInfo.uid,
      name: userInfo.name,
      fid: userInfo.fid || 0
    };

    const otherId = String(activity.otherId);

    // 1. 位置签到：自动从接口获取教师设定的真实坐标与范围
    if (otherId === '4') {
      logCallback(`[${activity.name}] 正在自动嗅探教师设定的目标位置...`);
      const detail = await this.getSignDetail(activeId);
      
      let lat = detail.locationLatitude;
      let lng = detail.locationLongitude;
      const range = detail.locationRange || 500;
      const addr = detail.locationText || detail.address || '教师指定签到区域';

      if (!lat || !lng || lat === -1 || lng === -1) {
        throw new Error('未获取到教师指定的位置坐标，请手动设置位置');
      }

      logCallback(`[${activity.name}] 成功获取教师目标坐标: (${lat}, ${lng})，允许范围: ${range}米`);
      logCallback(`[${activity.name}] 正在注入微抖动安全坐标并提交签到...`);

      return await this.signLocation({
        ...baseParams,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        address: addr,
        enableRandomize: true
      });
    }

    // 2. 签到码签到：自动并发爆破
    if (otherId === '5') {
      logCallback(`[${activity.name}] 正在并发智能爆破签到码...`);
      const crackedCode = await this.crackPassword(activeId, (cur, total, code) => {
        if (cur % 20 === 0) logCallback(`爆破进度: ${cur}/${total} (测试: ${code})`);
      });

      if (!crackedCode) {
        throw new Error('未能从高频字典中破解出签到码，教师可能设置了罕见密码');
      }

      logCallback(`🎉 成功破解签到码: 【${crackedCode}】！正在提交签到...`);
      return await this.signPassword({
        ...baseParams,
        signCode: crackedCode
      });
    }

    // 3. 手势签到：自动遍历常见九宫格手势
    if (otherId === '3') {
      logCallback(`[${activity.name}] 正在自动遍历常见九宫格手势...`);
      const crackedGesture = await this.crackGesture(activeId, (cur, total, code) => {
        if (cur % 15 === 0) logCallback(`手势测试进度: ${cur}/${total} (测试路径: ${code})`);
      });

      if (!crackedGesture) {
        throw new Error('未能从高频手势字典中破解出有效手势');
      }

      logCallback(`🎉 成功破解手势路径: 【${crackedGesture}】！正在提交签到...`);
      return await this.signGesture({
        ...baseParams,
        gestureCode: crackedGesture
      });
    }

    // 4. 普通/拍照签到：直接提交
    logCallback(`[${activity.name}] 正在提交普通签到...`);
    return await this.signGeneral(baseParams);
  }
  async signGeneral({ activeId, courseId, classId, uid, name, fid, objectId = null }) {
    await this.preSign(courseId, classId, activeId, uid);
    const params = {
      activeId,
      courseId,
      uid,
      name,
      fid: fid || '0',
      latitude: '-1',
      longitude: '-1'
    };
    if (objectId) {
      params.objectId = objectId;
    }
    return await this.submitSign(params);
  }

  /**
   * 2. 位置签到 (支持自动微抖动)
   */
  async signLocation({ activeId, courseId, classId, uid, name, fid, latitude, longitude, address, enableRandomize = true }) {
    await this.preSign(courseId, classId, activeId, uid);

    let finalLat = latitude;
    let finalLng = longitude;
    if (enableRandomize) {
      const r = window.CxCrypto.randomizeLocation(latitude, longitude);
      finalLat = r.latitude;
      finalLng = r.longitude;
    }

    const locJson = JSON.stringify({
      result: 1,
      latitude: finalLat,
      longitude: finalLng,
      address: address || '当前设定位置',
      mockData: '{"strategy":0,"probability":-1}'
    });

    const params = {
      activeId,
      courseId,
      uid,
      name,
      fid: fid || '0',
      latitude: finalLat,
      longitude: finalLng,
      address: address || '当前设定位置',
      location: locJson,
      locationResult: locJson
    };

    return await this.submitSign(params);
  }

  /**
   * 3. 二维码签到
   */
  async signQRCode({ activeId, courseId, classId, uid, name, fid, enc, position = null }) {
    await this.preSign(courseId, classId, activeId, uid);

    const params = {
      activeId,
      courseId,
      uid,
      name,
      fid: fid || '0',
      enc,
      latitude: position ? position.latitude : '-1',
      longitude: position ? position.longitude : '-1'
    };

    if (position) {
      const locJson = JSON.stringify({
        result: 1,
        latitude: position.latitude,
        longitude: position.longitude,
        address: position.address || '签到位置'
      });
      params.location = locJson;
      params.locationResult = locJson;
    }

    return await this.submitSign(params);
  }

  /**
   * 4. 签到码 / 密码签到
   */
  async signPassword({ activeId, courseId, classId, uid, name, fid, signCode, position = null }) {
    await this.preSign(courseId, classId, activeId, uid);

    const params = {
      activeId,
      courseId,
      uid,
      name,
      fid: fid || '0',
      signCode,
      latitude: position ? position.latitude : '-1',
      longitude: position ? position.longitude : '-1'
    };

    if (position) {
      const locJson = JSON.stringify({
        result: 1,
        latitude: position.latitude,
        longitude: position.longitude,
        address: position.address || '签到位置'
      });
      params.location = locJson;
      params.locationResult = locJson;
    }

    return await this.submitSign(params);
  }

  /**
   * 5. 手势签到
   */
  async signGesture({ activeId, courseId, classId, uid, name, fid, gestureCode, position = null }) {
    return await this.signPassword({
      activeId,
      courseId,
      classId,
      uid,
      name,
      fid,
      signCode: gestureCode,
      position
    });
  }

  /**
   * 解析二维码文本内容
   * 严格对应原版 ChaoxingQRCodeSigner.parseQRCode
   */
  static parseQRCodeString(rawStr) {
    if (!rawStr) return null;
    const str = rawStr.trim();

    // 格式一: SIGNIN:id=123456&c=...&enc=ABCDEF
    if (str.startsWith('SIGNIN:')) {
      const content = str.substring(7).split('-')[0];
      const encMatch = content.match(/&enc=([^&]+)/);
      const enc = encMatch ? encMatch[1] : '';
      const idMatch = content.match(/id=([^&]+)/) || content.match(/aid=([^&]+)/);
      const aid = idMatch ? idMatch[1] : null;
      const cMatch = content.match(/c=([^&]+)/);
      const c = cMatch ? cMatch[1] : null;
      return { aid, enc, c };
    }

    // 格式二: URL 链接形式
    try {
      const url = new URL(str);
      const enc = url.searchParams.get('enc');
      const aid = url.searchParams.get('id') || url.searchParams.get('aid');
      const c = url.searchParams.get('c');
      if (enc) {
        return { aid, enc, c };
      }
    } catch (e) {}

    // 格式三: 直接提取 enc=xxx 和 id=xxx
    const encMatch = str.match(/[?&]enc=([^&]+)/);
    const idMatch = str.match(/[?&](?:id|aid)=([^&]+)/);
    if (encMatch) {
      return {
        aid: idMatch ? idMatch[1] : null,
        enc: encMatch[1],
        c: null
      };
    }

    return null;
  }
}

window.ChaoxingApi = ChaoxingApi;
