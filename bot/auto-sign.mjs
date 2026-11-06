/**
 * Chaoxing 24H 云端挂机自动巡检与签到机器人 (Node.js)
 * 支持 GitHub Actions 定时任务与本地后台持续运行
 */

import crypto from 'crypto';

const TRANSFER_KEY = "u2oh6Vu^HWe4_AES";

function encryptByAES(text) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(TRANSFER_KEY), Buffer.from(TRANSFER_KEY));
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// 常见 4 位签到码与手势字典
const COMMON_SIGN_CODES = [
  '1234', '0000', '1111', '6666', '8888', '9999', '2222', '3333', '4444', '5555', '7777',
  '4321', '2345', '3456', '5678', '6789', '9876', '8765', '0123',
  '2026', '2025', '2024', '2023', '2022', '2021', '2020',
  '0101', '0102', '0202', '0303', '0404', '0505', '0606', '0707', '0808', '0909', '1010', '1111', '1212',
  '0520', '1314', '1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000',
  '1122', '2233', '3344', '4455', '5566', '6677', '7788', '8899', '9900',
  '1212', '1313', '1414', '1515', '1616', '1717', '1818', '1919', '2020', '2121', '2323'
];

const COMMON_GESTURES = [
  '14789', '12369', '74123', '78963', '98741', '32147', '96321', '36987',
  '1235789', '3215987', '7895123', '9875321', '12357', '32159',
  '159', '357', '15987', '35741', '75321', '95123',
  '123', '456', '789', '147', '258', '369', '321', '654', '987',
  '12369874', '14789632', '1478963', '3698741', '1236987', '3214789',
  '12589', '32587', '14569', '74563', '123654', '456321', '123456789'
];

// 位置微抖动
function randomize(lat, lng) {
  const range = 0.00005;
  const dLat = (Math.random() * 2 - 1) * range;
  const dLng = (Math.random() * 2 - 1) * range;
  return {
    latitude: parseFloat((lat + dLat).toFixed(6)),
    longitude: parseFloat((lng + dLng).toFixed(6))
  };
}

// 微信 PushPlus 消息推送 (选填)
async function sendPushNotification(title, content, token) {
  if (!token) return;
  try {
    await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        title: title,
        content: content,
        template: 'markdown'
      })
    });
    console.log('[推送] 微信通知发送成功！');
  } catch (e) {
    console.warn('[推送] 发送失败:', e.message);
  }
}

class AutoSignBot {
  constructor(phoneNumber, password, initialCookies = '', pushToken = '') {
    this.phoneNumber = phoneNumber;
    this.password = password;
    this.cookies = initialCookies;
    this.pushToken = pushToken;
    this.userInfo = null;
    this.deviceCode = crypto.createHash('sha256').update(phoneNumber + 'chaoxing').digest('base64');
  }

  async request(url, options = {}) {
    const headers = {
      'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; SM-N9006 Build/8aba9e4.0) (schild:2d97f7b9439f21333c946878fc4d6ccb) (device:SM-N9006) Language/zh_CN com.chaoxing.mobile/ChaoXingStudy_3_6.7.5_android_phone_10941_314 (@Kalimdor)_68f184fd763546c1a04ab3a09b3deebb',
      ...(options.headers || {})
    };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const res = await fetch(url, { ...options, headers });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies && setCookies.length > 0) {
      this.updateCookies(setCookies);
    }
    return res;
  }

  updateCookies(setCookieList) {
    const map = {};
    if (this.cookies) {
      this.cookies.split(';').forEach(p => {
        const [k, ...v] = p.trim().split('=');
        if (k) map[k.trim()] = v.join('=').trim();
      });
    }
    setCookieList.forEach(c => {
      const part = c.split(';')[0];
      const [k, ...v] = part.trim().split('=');
      if (k) map[k.trim()] = v.join('=').trim();
    });
    this.cookies = Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async login() {
    console.log(`[登录] 正在登录账号: ${this.phoneNumber}...`);
    const form = new URLSearchParams();
    form.append('fid', '-1');
    form.append('uname', encryptByAES(this.phoneNumber));
    form.append('password', encryptByAES(this.password));
    form.append('refer', 'https://i.chaoxing.com');
    form.append('t', 'true');
    form.append('forbidotherlogin', '0');
    form.append('validate', '');
    form.append('doubleFactorLogin', '0');
    form.append('independentId', '0');
    form.append('independentNameId', '0');

    const res = await this.request('https://passport2.chaoxing.com/fanyalogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    const data = await res.json();
    if (!data.status) {
      throw new Error(data.msg2 || data.msg || '登录失败，请检查账号密码');
    }
    console.log('[登录] 登录成功！');
    await this.fetchUserInfo();
  }

  async fetchUserInfo() {
    const res = await this.request('https://sso.chaoxing.com/apis/login/userLogin4Uname.do');
    const data = await res.json();
    if (data && data.result === 1 && data.msg) {
      this.userInfo = {
        name: data.msg.name,
        puid: data.msg.puid,
        uid: data.msg.uid,
        fid: data.msg.fid,
        school: data.msg.schoolname
      };
      console.log(`[用户] 欢迎您，${this.userInfo.name} (${this.userInfo.school || '学习通用户'})`);
    } else {
      throw new Error('获取用户信息失败');
    }
  }

  async getCourses() {
    const res = await this.request('https://mooc1-api.chaoxing.com/mycourse/backclazzdata?view=json&rss=1');
    const data = await res.json();
    if (!data || data.result === 0 || !data.channelList) return [];

    const courses = [];
    for (const item of data.channelList) {
      const content = item.content;
      if (!content || !content.course || !item.cataName) continue;
      const courseData = content.course.data && content.course.data[0];
      if (!courseData) continue;
      courses.push({
        classId: content.id,
        courseId: courseData.id,
        name: courseData.name,
        teacher: courseData.teacherfactor || '未知'
      });
    }
    return courses;
  }

  async getActivities(courseId, classId) {
    const url = `https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist?fid=0&showNotStartedActive=0&courseId=${courseId}&classId=${classId}`;
    const res = await this.request(url);
    const data = await res.json();
    if (!data || !data.data || !data.data.activeList) return [];

    return data.data.activeList
      .filter(act => (act.type === 2 || act.type === 74) && act.status === 1)
      .map(act => ({
        id: act.id,
        activeId: act.id,
        name: act.nameOne || '课程签到',
        otherId: String(act.otherId),
        startTime: act.startTime,
        endTime: act.endTime,
        courseId,
        classId
      }));
  }

  async preSign(courseId, classId, activeId, uid) {
    const url = `https://mobilelearn.chaoxing.com/newsign/preSign?courseId=${courseId}&classId=${classId}&activePrimaryId=${activeId}&general=1&sys=1&ls=1&appType=15&uid=${uid}&isTeacherViewOpen=0`;
    await this.request(url, { method: 'POST' });
    // analysis 防作弊
    try {
      const res = await this.request(`https://mobilelearn.chaoxing.com/pptSign/analysis?vs=1&DB_STRATEGY=RANDOM&aid=${activeId}`);
      const text = await res.text();
      const code = text.match(/code='\+'([a-f0-9]+)'/)?.[1];
      if (code) {
        await this.request(`https://mobilelearn.chaoxing.com/pptSign/analysis2?DB_STRATEGY=RANDOM&code=${code}`);
      }
    } catch (e) {}
  }

  async submitSign(params) {
    const url = new URL('https://mobilelearn.chaoxing.com/pptSign/stuSignajax');
    url.searchParams.set('appType', '15');
    url.searchParams.set('ifTiJiao', '1');
    url.searchParams.set('vpProbability', '-1');
    url.searchParams.set('vpStrategy', '');
    url.searchParams.set('clientip', '');
    url.searchParams.set('deviceCode', this.deviceCode);

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const res = await this.request(url.toString());
    const text = (await res.text()).trim();

    if (text === 'success') return { success: true, message: '签到成功！' };
    if (text === '您已签到过了') return { success: true, message: '已经签到过了' };
    return { success: false, message: text };
  }

  async checkSignCode(activeId, code) {
    const url = `https://mobilelearn.chaoxing.com/widget/sign/pcStuSignController/checkSignCode?activeId=${activeId}&signCode=${encodeURIComponent(code)}`;
    const res = await this.request(url);
    const data = await res.json();
    return data && data.result === 1;
  }

  async crackCandidates(activeId, candidates) {
    for (const code of candidates) {
      try {
        const ok = await this.checkSignCode(activeId, code);
        if (ok) return code;
      } catch (e) {}
    }
    return null;
  }

  async autoSign(act, courseName) {
    console.log(`\n[打卡] 发现未签到活动: 《${courseName}》- ${act.name} (类型: ${act.otherId})`);
    const activeId = act.activeId || act.id;
    await this.preSign(act.courseId, act.classId, activeId, this.userInfo.puid || this.userInfo.uid);

    const baseParams = {
      activeId,
      courseId: act.courseId,
      classId: act.classId,
      uid: this.userInfo.puid || this.userInfo.uid,
      name: this.userInfo.name,
      fid: this.userInfo.fid || 0
    };

    // 1. 位置签到：自动嗅探教师目标坐标
    if (act.otherId === '4') {
      const res = await this.request(`https://mobilelearn.chaoxing.com/v2/apis/active/getPPTActiveInfo?activeId=${activeId}`);
      const info = (await res.json())?.data || {};
      const lat = info.locationLatitude;
      const lng = info.locationLongitude;
      const addr = info.locationText || '教师指定打卡位置';

      if (lat && lng && lat !== -1 && lng !== -1) {
        const safeLoc = randomize(lat, lng);
        console.log(`[位置] 获取到教师目标位置: (${lat}, ${lng})，注入安全微抖动坐标: (${safeLoc.latitude}, ${safeLoc.longitude})`);
        const locJson = JSON.stringify({
          result: 1,
          latitude: safeLoc.latitude,
          longitude: safeLoc.longitude,
          address: addr,
          mockData: '{"strategy":0,"probability":-1}'
        });
        const signRes = await this.submitSign({
          ...baseParams,
          latitude: safeLoc.latitude,
          longitude: safeLoc.longitude,
          address: addr,
          location: locJson,
          locationResult: locJson
        });
        return signRes;
      }
    }

    // 2. 签到码签到：自动并发爆破
    if (act.otherId === '5') {
      console.log('[爆破] 正在自动并发爆破 4 位高频签到码...');
      const code = await this.crackCandidates(activeId, COMMON_SIGN_CODES);
      if (code) {
        console.log(`[爆破] 🎉 成功破解签到码: 【${code}】！`);
        return await this.submitSign({ ...baseParams, signCode: code, latitude: '-1', longitude: '-1' });
      } else {
        return { success: false, message: '未能从常用字典中破解出签到码' };
      }
    }

    // 3. 手势签到：自动遍历 60+ 常见手势
    if (act.otherId === '3') {
      console.log('[手势] 正在自动遍历常见九宫格手势连线...');
      const gesture = await this.crackCandidates(activeId, COMMON_GESTURES);
      if (gesture) {
        console.log(`[手势] 🎉 成功破解手势密码: 【${gesture}】！`);
        return await this.submitSign({ ...baseParams, signCode: gesture, latitude: '-1', longitude: '-1' });
      } else {
        return { success: false, message: '未能从常用字典中破解出手势' };
      }
    }

    // 4. 普通/拍照签到
    console.log('[普通] 提交日常点击签到...');
    return await this.submitSign({ ...baseParams, latitude: '-1', longitude: '-1' });
  }

  async runOnce() {
    if (!this.userInfo) {
      if (this.cookies) {
        try {
          await this.fetchUserInfo();
        } catch (e) {
          console.log('[会话] 预置 Cookie 已过期，使用账号密码重新登录...');
          await this.login();
        }
      } else {
        await this.login();
      }
    }

    console.log('[巡检] 正在扫描全部课程...');
    const courses = await this.getCourses();
    console.log(`[巡检] 共找到 ${courses.length} 门课程`);

    let totalSigned = 0;
    for (const c of courses) {
      try {
        const activities = await this.getActivities(c.courseId, c.classId);
        for (const act of activities) {
          const res = await this.autoSign(act, c.name);
          console.log(`[结果] ${c.name} - ${act.name} => ${res.message}`);
          if (res.success) {
            totalSigned++;
            await sendPushNotification(
              `【随地大小签】打卡成功！`,
              `### 课程：${c.name}\n- 活动：${act.name}\n- 结果：${res.message}\n- 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
              this.pushToken
            );
          }
        }
      } catch (e) {
        console.warn(`[错误] 课程 ${c.name} 检查异常: ${e.message}`);
      }
    }

    if (totalSigned === 0) {
      console.log('[巡检] 当前所有课程均无未签到活动，巡检完成。');
    } else {
      console.log(`[完成] 本轮巡检共自动完成 ${totalSigned} 次打卡！`);
    }
  }
}

// 脚本入口
async function main() {
  const phone = process.env.CX_PHONE || "18650828531";
  const password = process.env.CX_PASSWORD || "muyi690.";
  const pushToken = process.env.PUSH_PLUS_TOKEN || "";

  console.log("==================================================");
  console.log("       超星 24H 云端挂机自动打卡机器人启动        ");
  console.log("==================================================");

  const bot = new AutoSignBot(phone, password, '', pushToken);
  await bot.runOnce();
}

main().catch(err => {
  console.error('[严重错误]', err);
  process.exit(1);
});
