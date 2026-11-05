/**
 * Chaoxing Web Sign - 加密与工具函数模块
 * 对应原 Android 项目 ChaoxingHttpClient 与 ChaoxingDeviceInfoHelper 逻辑
 */

// 超星 passport2 登录的标准密钥 (AES-128-CBC)
const CX_TRANSFER_KEY = "u2oh6Vu^HWe4_AES";

/**
 * 超星密码 & 手机号 AES-128-CBC 加密
 * 原版: Cipher.getInstance("AES/CBC/PKCS5Padding"), key = TRANSFER_KEY, iv = TRANSFER_KEY
 */
function encryptByAES(message, key = CX_TRANSFER_KEY) {
  if (typeof CryptoJS === 'undefined') {
    throw new Error('CryptoJS library not loaded.');
  }
  const keyBytes = CryptoJS.enc.Utf8.parse(key);
  const ivBytes = CryptoJS.enc.Utf8.parse(key);
  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(message), keyBytes, {
    iv: ivBytes,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(); // Base64
}

/**
 * 随机设备码生成
 * 对应原版 randomizedDeviceCode: 64 字节 SHA-256 哈希拼接转 Base64
 */
function generateDeviceCode() {
  const randomStr = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
  if (typeof CryptoJS !== 'undefined') {
    const rawData = CryptoJS.SHA256(randomStr() + randomStr()).toString(CryptoJS.enc.Base64);
    return rawData;
  }
  return btoa(randomStr() + randomStr() + randomStr()).substring(0, 44);
}

/**
 * 位置随机微抖动算法 (与原版 ChaoxingLocationSignEntity 完全一致)
 * 默认在 +-0.00005 (约5米左右) 浮动，避免同一个账号或不同账号提交完全相同的坐标
 */
function randomizeLocation(latitude, longitude, isTightened = false) {
  const range = isTightened ? 0.00001 : 0.00005;
  const deltaLat = (Math.random() * 2 - 1) * range;
  const deltaLng = (Math.random() * 2 - 1) * range;
  return {
    latitude: parseFloat((latitude + deltaLat).toFixed(6)),
    longitude: parseFloat((longitude + deltaLng).toFixed(6))
  };
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp) {
  if (!timestamp) return '未知时间';
  const date = new Date(Number(timestamp));
  const pad = (n) => String(n).padStart(2, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${month}-${day} ${hours}:${minutes}`;
}

window.CxCrypto = {
  CX_TRANSFER_KEY,
  encryptByAES,
  generateDeviceCode,
  randomizeLocation,
  formatTime
};
