/**
 * Chaoxing Web Sign - Vue 3 前端应用主逻辑
 */

const { createApp, ref, reactive, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {
    // 状态管理
    const currentUser = ref(null);
    const savedAccounts = ref([]);
    const selectedPhone = ref('');
    const courses = ref([]);
    const loadingCourses = ref(false);
    const ongoingSigns = ref([]);
    const isScanning = ref(false);

    // 模态框显隐控制
    const showLoginModal = ref(false);
    const showCookieImportModal = ref(false);
    const showQuickSignModal = ref(false);
    const showLocationPresetModal = ref(false);
    const showProxyModal = ref(false);

    // 24小时守护与自动挂机状态
    const isGuardianActive = ref(false);
    const guardianIntervalMinutes = ref(2);
    const guardianCountdown = ref(120);
    const guardianStats = reactive({ rounds: 0, successSigns: 0, lastCheckTime: '' });
    const guardianLogs = ref([]);
    const isAutoSigningBatch = ref(false);
    let guardianTimer = null;
    let countdownTimer = null;

    function addGuardianLog(text, type = 'info') {
      const pad = (n) => String(n).padStart(2, '0');
      const now = new Date();
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      guardianLogs.value.unshift({ time: timeStr, text, type });
      if (guardianLogs.value.length > 80) guardianLogs.value.pop();
    }

    // 开启/关闭 24 小时挂机守护
    function toggleGuardian() {
      if (isGuardianActive.value) {
        isGuardianActive.value = false;
        clearInterval(guardianTimer);
        clearInterval(countdownTimer);
        addGuardianLog('⏸ 挂机守护已手动停止', 'info');
      } else {
        if (!currentUser.value) {
          alert('请先登录账号后再开启挂机守护');
          return;
        }
        // 请求浏览器通知权限
        if ('Notification' in window && Notification.permission !== 'granted') {
          Notification.requestPermission();
        }

        isGuardianActive.value = true;
        addGuardianLog(`▶ 24小时挂机守护已开启！每 ${guardianIntervalMinutes.value} 分钟自动巡检一次全部课程`, 'success');
        startGuardianLoop();
      }
    }

    function startGuardianLoop() {
      const intervalSec = guardianIntervalMinutes.value * 60;
      guardianCountdown.value = intervalSec;

      // 启动立即执行一次
      runGuardianCheck();

      clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        if (guardianCountdown.value > 0) {
          guardianCountdown.value--;
        } else {
          guardianCountdown.value = intervalSec;
          runGuardianCheck();
        }
      }, 1000);
    }

    async function runGuardianCheck() {
      if (!isGuardianActive.value || !currentUser.value) return;
      guardianStats.rounds++;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      guardianStats.lastCheckTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      addGuardianLog(`[第 ${guardianStats.rounds} 轮] 正在巡检全部已选课程...`, 'info');

      try {
        if (courses.value.length === 0) {
          await loadCourses();
        }
        const activeList = await api.scanAllActiveSigns(courses.value);
        ongoingSigns.value = activeList;

        if (activeList.length === 0) {
          addGuardianLog(`✓ 巡检完成，当前共 ${courses.value.length} 门课程，暂无未签到活动`, 'info');
        } else {
          addGuardianLog(`🎯 发现 ${activeList.length} 个正在进行的签到活动！正在执行全自动打卡...`, 'success');

          for (const act of activeList) {
            await autoSignSingle(act, true);
          }
        }
      } catch (err) {
        addGuardianLog(`❌ 巡检过程出现异常: ${err.message}`, 'error');
      }
    }

    // 单个活动一键自动签到 (位置自动获取、手势/密码自动破解)
    async function autoSignSingle(act, isFromGuardian = false) {
      addGuardianLog(`开始自动处理签到: [${act.courseName || ''} - ${act.name}] (类型: ${act.typeName})`, 'info');

      try {
        const res = await api.autoSign(act, currentUser.value, (msg) => {
          addGuardianLog(`  ➜ ${msg}`, 'info');
        });

        if (res.success) {
          guardianStats.successSigns++;
          addGuardianLog(`🎉 成功自动打卡: [${act.courseName || ''} - ${act.name}]！${res.message}`, 'success');

          // 发送系统级浏览器桌面通知
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('【随地大小签】自动打卡成功！', {
              body: `已为您完成 [${act.courseName || ''} - ${act.name}] ${act.typeName}！`,
              icon: 'favicon.svg'
            });
          }

          if (!isFromGuardian) {
            alert(`🎉 自动打卡成功！\n${res.message}`);
          }
          // 从列表中移除已签活动
          ongoingSigns.value = ongoingSigns.value.filter(a => a.id !== act.id);
        } else {
          addGuardianLog(`⚠️ 自动打卡返回: ${res.message}`, 'error');
          if (!isFromGuardian) alert(res.message);
        }
      } catch (e) {
        addGuardianLog(`❌ 自动打卡失败: ${e.message}`, 'error');
        if (!isFromGuardian) alert(`❌ 自动打卡失败: ${e.message}`);
      }
    }

    // 一键全部自动签到
    async function autoSignAllOngoing() {
      if (ongoingSigns.value.length === 0) return;
      isAutoSigningBatch.value = true;
      for (const act of ongoingSigns.value) {
        await autoSignSingle(act);
      }
      isAutoSigningBatch.value = false;
    }
    const isLoggingIn = ref(false);
    const cookieInput = ref('');
    const quickSignActiveId = ref('');

    // 课程与签到弹窗
    const currentSelectedCourse = ref(null);
    const selectedCourseActivities = ref(null);
    const loadingActivities = ref(false);
    const currentSignActivity = ref(null);
    const isSubmittingSign = ref(false);
    const courseSearchKeyword = ref('');
    const scanProgressText = ref('');

    const signForm = reactive({
      address: '综合教学楼',
      latitude: 39.908722,
      longitude: 116.397496,
      qrContent: '',
      qrParsedEnc: '',
      qrParsedAid: null,
      gestureCode: '',
      signCode: ''
    });

    let gestureLockInstance = null;

    // 预设常用位置
    const presetLocations = ref([
      { name: '北京天安门广场', lat: 39.908722, lng: 116.397496 },
      { name: '大学主教学楼', lat: 31.230416, lng: 121.473701 },
      { name: '图书馆新馆', lat: 23.129110, lng: 113.264385 },
      { name: '实验实训中心', lat: 30.572815, lng: 104.066801 }
    ]);
    const newPreset = reactive({ name: '', lat: '', lng: '' });

    // 强制迁移旧缓存中的失效公用代理到用户专属 Worker
    let currentSavedProxy = localStorage.getItem('cx_proxy_mode');
    if (!currentSavedProxy || currentSavedProxy === 'corsproxy') {
      currentSavedProxy = 'worker';
      localStorage.setItem('cx_proxy_mode', 'worker');
    }
    let currentWorkerUrl = localStorage.getItem('cx_worker_url');
    if (!currentWorkerUrl || currentWorkerUrl.includes('your-worker')) {
      currentWorkerUrl = 'https://chaoxing.flowermuyi.me';
      localStorage.setItem('cx_worker_url', currentWorkerUrl);
    }

    const proxyMode = ref(currentSavedProxy);
    const customWorkerUrl = ref(currentWorkerUrl);
    const testingProxy = ref(false);

    // 初始化 API 客户端
    const cookieJar = new CookieJar('default');
    const api = new ChaoxingApi(cookieJar, {
      mode: proxyMode.value,
      workerUrl: customWorkerUrl.value
    });

    // 挂载初始化
    onMounted(async () => {
      loadSavedAccounts();
      loadSavedPresets();

      // 自动侦测本机服务与已激活会话
      try {
        const resp = await fetch('http://127.0.0.1:8787/api/current-session', { method: 'GET' });
        const res = await resp.json();
        if (res && res.session) {
          proxyMode.value = 'local';
          api.setProxyConfig({ mode: 'local' });

          // 自动导入已激活的杨松同学账号
          const s = res.session;
          cookieJar.setAccountKey(s.phoneNumber);
          cookieJar.importRawString(s.cookies);
          AccountStorage.save(s);
          AccountStorage.setCurrentPhone(s.phoneNumber);
          currentUser.value = s;
          selectedPhone.value = s.phoneNumber;
          loadSavedAccounts();
          loadCourses();
          console.log(`✓ 已自动激活用户: ${s.name} (${s.school})`);
        }
      } catch (e) {
        // 本地服务未启动，保持用户配置
      }

      const currentPhone = AccountStorage.getCurrentPhone();
      if (currentPhone) {
        switchAccount(currentPhone);
      }
    });

    // 账号管理
    function loadSavedAccounts() {
      savedAccounts.value = AccountStorage.getAll();
    }

    function switchAccount(phone) {
      selectedPhone.value = phone;
      AccountStorage.setCurrentPhone(phone);
      cookieJar.setAccountKey(phone);

      const found = savedAccounts.value.find(a => a.phoneNumber === phone);
      if (found) {
        currentUser.value = found;
        loadCourses();
      } else {
        currentUser.value = null;
      }
    }

    // 登录处理
    async function handleLogin() {
      if (!loginForm.phone || !loginForm.password) {
        alert('请输入完整的手机号和密码');
        return;
      }

      isLoggingIn.value = true;
      try {
        cookieJar.setAccountKey(loginForm.phone);
        const info = await api.login(loginForm.phone, loginForm.password);
        
        const accountData = {
          phoneNumber: loginForm.phone,
          ...info
        };
        AccountStorage.save(accountData);
        AccountStorage.setCurrentPhone(loginForm.phone);
        
        currentUser.value = accountData;
        selectedPhone.value = loginForm.phone;
        loadSavedAccounts();
        showLoginModal.value = false;
        loginForm.password = '';

        alert(`🎉 登录成功！欢迎您，${info.name}`);
        loadCourses();
      } catch (err) {
        alert(`❌ 登录失败: ${err.message}`);
      } finally {
        isLoggingIn.value = false;
      }
    }

    // Cookie 导入登录
    async function handleImportCookie() {
      if (!cookieInput.value.trim()) {
        alert('请输入 Cookie 内容');
        return;
      }
      try {
        const tempKey = 'cookie_user_' + Date.now().toString().slice(-4);
        cookieJar.setAccountKey(tempKey);
        cookieJar.importRawString(cookieInput.value);

        const info = await api.getUserInfo();
        const accountData = {
          phoneNumber: tempKey,
          ...info
        };
        AccountStorage.save(accountData);
        AccountStorage.setCurrentPhone(tempKey);
        
        currentUser.value = accountData;
        selectedPhone.value = tempKey;
        loadSavedAccounts();
        showCookieImportModal.value = false;
        cookieInput.value = '';

        alert(`🎉 Cookie 验证成功！已登录为: ${info.name}`);
        loadCourses();
      } catch (e) {
        alert(`❌ Cookie 无效或已过期: ${e.message}`);
      }
    }

    function logout() {
      if (!confirm('确定要退出当前账号吗？')) return;
      if (currentUser.value) {
        AccountStorage.remove(currentUser.value.phoneNumber);
      }
      currentUser.value = null;
      courses.value = [];
      ongoingSigns.value = [];
      loadSavedAccounts();
      if (savedAccounts.value.length > 0) {
        switchAccount(savedAccounts.value[0].phoneNumber);
      }
    }

    // 加载课程列表
    async function loadCourses() {
      if (!currentUser.value) return;
      loadingCourses.value = true;
      try {
        courses.value = await api.getCourses();
      } catch (err) {
        console.error('Failed to load courses', err);
      } finally {
        loadingCourses.value = false;
      }
    }

    // 查看单个课程的签到活动 (即点即开，绝无延迟)
    async function selectCourse(course) {
      currentSelectedCourse.value = course;
      selectedCourseActivities.value = [];
      loadingActivities.value = true;

      try {
        const { activities } = await api.getActivities(course.courseId, course.classId);
        selectedCourseActivities.value = activities;
      } catch (e) {
        alert(`获取课程签到活动失败: ${e.message}`);
      } finally {
        loadingActivities.value = false;
      }
    }

    // 智能全局扫描所有进行中的签到 (8 并发极速流)
    async function scanOngoingSigns() {
      if (courses.value.length === 0) {
        await loadCourses();
      }
      if (courses.value.length === 0) {
        alert('暂无课程可扫描');
        return;
      }

      isScanning.value = true;
      scanProgressText.value = `0/${courses.value.length}`;

      try {
        const list = await api.scanAllActiveSigns(courses.value, (done, total) => {
          scanProgressText.value = `${done}/${total}`;
        });
        ongoingSigns.value = list;
        if (list.length === 0) {
          alert('🔍 扫描完成：当前所有 55 门课程均无未签到活动');
        } else {
          alert(`🎯 扫描完成！共发现 ${list.length} 个正在进行的签到活动！`);
        }
      } catch (e) {
        alert(`扫描失败: ${e.message}`);
      } finally {
        isScanning.value = false;
        scanProgressText.value = '';
      }
    }

    // 打开签到执行弹窗
    function openSignModal(act) {
      currentSignActivity.value = act;
      signForm.signCode = '';
      signForm.gestureCode = '';
      signForm.qrContent = '';
      signForm.qrParsedEnc = '';

      if (act.otherId === '3') {
        // 手势签到，初始化 Canvas
        nextTick(() => {
          const canvas = document.getElementById('gestureCanvas');
          if (canvas) {
            gestureLockInstance = new GestureLock(canvas, {
              onComplete: (code) => {
                signForm.gestureCode = code;
              }
            });
          }
        });
      }
    }

    function resetGesture() {
      signForm.gestureCode = '';
      if (gestureLockInstance) {
        gestureLockInstance.reset();
      }
    }

    // 获取当前地理位置
    function fetchCurrentGPS() {
      if (!navigator.geolocation) {
        alert('您的浏览器不支持 Geolocation 定位API');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          signForm.latitude = parseFloat(pos.coords.latitude.toFixed(6));
          signForm.longitude = parseFloat(pos.coords.longitude.toFixed(6));
          signForm.address = '当前GPS定位位置';
          alert(`✓ 成功获取当前定位: ${signForm.latitude}, ${signForm.longitude}`);
        },
        err => {
          alert(`获取位置失败: ${err.message}，您可以手动输入经纬度`);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    // 二维码输入解析
    function onQRInput() {
      const parsed = ChaoxingApi.parseQRCodeString(signForm.qrContent);
      if (parsed && parsed.enc) {
        signForm.qrParsedEnc = parsed.enc;
        signForm.qrParsedAid = parsed.aid;
      } else {
        signForm.qrParsedEnc = '';
      }
    }

    // 二维码图片识别上传
    function handleQRImageUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          if (typeof jsQR !== 'undefined') {
            const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
            if (qrCode && qrCode.data) {
              signForm.qrContent = qrCode.data;
              onQRInput();
              alert(`✓ 成功识别二维码！`);
            } else {
              alert('未能从该图片中识别到清晰的二维码，请尝试截图裁剪后重试');
            }
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // 提交执行签到
    async function executeSign() {
      if (!currentSignActivity.value) return;
      const act = currentSignActivity.value;
      const user = currentUser.value;

      isSubmittingSign.value = true;
      try {
        let result;
        const targetActiveId = signForm.qrParsedAid || act.activeId;
        if (!targetActiveId || targetActiveId === 0 || targetActiveId === '0') {
          alert('请先输入有效的活动 ID 或扫描二维码');
          isSubmittingSign.value = false;
          return;
        }

        const baseParams = {
          activeId: targetActiveId,
          courseId: act.courseId || 0,
          classId: act.classId || 0,
          uid: user.puid || user.uid,
          name: user.name,
          fid: user.fid || 0
        };

        if (act.otherId === '4') {
          // 位置签到
          result = await api.signLocation({
            ...baseParams,
            latitude: parseFloat(signForm.latitude),
            longitude: parseFloat(signForm.longitude),
            address: signForm.address,
            enableRandomize: true
          });
        } else if (act.otherId === '2') {
          // 二维码签到
          if (!signForm.qrParsedEnc) {
            alert('请先输入或识别有效的二维码以解析 enc 参数');
            isSubmittingSign.value = false;
            return;
          }
          result = await api.signQRCode({
            ...baseParams,
            enc: signForm.qrParsedEnc
          });
        } else if (act.otherId === '3') {
          // 手势签到
          if (!signForm.gestureCode) {
            alert('请先在九宫格中绘制手势连线');
            isSubmittingSign.value = false;
            return;
          }
          result = await api.signGesture({
            ...baseParams,
            gestureCode: signForm.gestureCode
          });
        } else if (act.otherId === '5') {
          // 签到码签到
          if (!signForm.signCode.trim()) {
            alert('请输入签到码');
            isSubmittingSign.value = false;
            return;
          }
          result = await api.signPassword({
            ...baseParams,
            signCode: signForm.signCode.trim()
          });
        } else {
          // 普通/拍照签到
          result = await api.signGeneral(baseParams);
        }

        alert(result.message);
        if (result.success) {
          currentSignActivity.value = null;
        }
      } catch (err) {
        alert(`❌ 签到异常: ${err.message}`);
      } finally {
        isSubmittingSign.value = false;
      }
    }

    // 快捷通过 activeId 签到
    async function handleQuickSignFetch() {
      if (!quickSignActiveId.value.trim()) {
        alert('请输入活动 ID');
        return;
      }
      try {
        const detail = await api.getSignDetail(quickSignActiveId.value.trim());
        const act = {
          id: quickSignActiveId.value.trim(),
          activeId: quickSignActiveId.value.trim(),
          name: detail.name || '快捷活动签到',
          otherId: String(detail.otherId ?? '0'),
          typeName: ['普通/拍照', '', '二维码', '手势', '位置', '签到码'][detail.otherId] || '签到',
          courseId: detail.courseId || 0,
          classId: detail.classId || 0
        };
        showQuickSignModal.value = false;
        openSignModal(act);
      } catch (e) {
        alert(`获取活动失败: ${e.message}`);
      }
    }

    // 预设位置管理
    function loadSavedPresets() {
      try {
        const data = localStorage.getItem('cx_preset_locs');
        if (data) presetLocations.value = JSON.parse(data);
      } catch (e) {}
    }

    function savePresets() {
      localStorage.setItem('cx_preset_locs', JSON.stringify(presetLocations.value));
    }

    function addPresetLocation() {
      if (!newPreset.name || !newPreset.lat || !newPreset.lng) {
        alert('请填全名称与经纬度');
        return;
      }
      presetLocations.value.push({
        name: newPreset.name,
        lat: parseFloat(newPreset.lat),
        lng: parseFloat(newPreset.lng)
      });
      savePresets();
      newPreset.name = ''; newPreset.lat = ''; newPreset.lng = '';
    }

    function deletePresetLocation(idx) {
      presetLocations.value.splice(idx, 1);
      savePresets();
    }

    function usePresetLocation(loc) {
      signForm.address = loc.name;
      signForm.latitude = loc.lat;
      signForm.longitude = loc.lng;
      showLocationPresetModal.value = false;
      alert(`已填入: ${loc.name}`);
    }

    function applyPresetLocation() {
      showLocationPresetModal.value = true;
    }

    // 代理测试与保存
    async function testProxyConnection() {
      testingProxy.value = true;
      const start = Date.now();
      try {
        api.setProxyConfig({
          mode: proxyMode.value,
          workerUrl: customWorkerUrl.value
        });
        const resp = await api.request('https://mobilelearn.chaoxing.com/pptSign/analysis?vs=1&aid=0', { method: 'GET' });
        const latency = Date.now() - start;
        if (resp.status >= 200 && resp.status < 500) {
          alert(`⚡ 代理连通正常！网络延迟: ${latency} ms`);
        } else {
          alert(`⚠️ 代理返回异常状态码: ${resp.status}`);
        }
      } catch (e) {
        alert(`❌ 代理测试失败: ${e.message}`);
      } finally {
        testingProxy.value = false;
      }
    }

    function saveProxySettings() {
      localStorage.setItem('cx_proxy_mode', proxyMode.value);
      localStorage.setItem('cx_worker_url', customWorkerUrl.value);
      api.setProxyConfig({
        mode: proxyMode.value,
        workerUrl: customWorkerUrl.value
      });
      showProxyModal.value = false;
      alert('✓ 代理设置已保存生效！');
    }

    function onAvatarError(e) {
      e.target.src = 'favicon.svg';
    }

    function formatTime(timestamp) {
      return window.CxCrypto.formatTime(timestamp);
    }

    // 课程实时过滤搜索
    const filteredCourses = Vue.computed(() => {
      const kw = courseSearchKeyword.value.trim().toLowerCase();
      if (!kw) return courses.value;
      return courses.value.filter(c => {
        return (c.name && c.name.toLowerCase().includes(kw)) ||
               (c.teacher && c.teacher.toLowerCase().includes(kw));
      });
    });

    return {
      // 挂机守护相关
      isGuardianActive,
      guardianIntervalMinutes,
      guardianCountdown,
      guardianStats,
      guardianLogs,
      isAutoSigningBatch,
      toggleGuardian,
      autoSignSingle,
      autoSignAllOngoing,
      currentUser,
      savedAccounts,
      selectedPhone,
      courses,
      filteredCourses,
      courseSearchKeyword,
      scanProgressText,
      loadingActivities,
      loadingCourses,
      ongoingSigns,
      isScanning,
      showLoginModal,
      showCookieImportModal,
      showQuickSignModal,
      showLocationPresetModal,
      showProxyModal,
      loginForm,
      isLoggingIn,
      cookieInput,
      quickSignActiveId,
      currentSelectedCourse,
      selectedCourseActivities,
      currentSignActivity,
      isSubmittingSign,
      signForm,
      presetLocations,
      newPreset,
      proxyMode,
      customWorkerUrl,
      testingProxy,
      handleLogin,
      handleImportCookie,
      logout,
      switchAccount,
      loadCourses,
      selectCourse,
      scanOngoingSigns,
      openSignModal,
      resetGesture,
      fetchCurrentGPS,
      onQRInput,
      handleQRImageUpload,
      executeSign,
      openQuickSignModal: () => { showQuickSignModal.value = true; },
      openScanQRModal: () => {
        currentSignActivity.value = {
          activeId: 0,
          otherId: '2',
          typeName: '二维码签到',
          name: '快捷二维码签到'
        };
      },
      handleQuickSignFetch,
      usePresetLocation,
      applyPresetLocation,
      addPresetLocation,
      deletePresetLocation,
      testProxyConnection,
      saveProxySettings,
      onAvatarError,
      formatTime
    };
  }
});

app.mount('#app');
