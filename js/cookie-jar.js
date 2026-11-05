/**
 * Chaoxing Web Sign - 前端持久化 CookieJar 与多账号管理
 */

class CookieJar {
  constructor(accountKey = 'default') {
    this.accountKey = accountKey;
    this.cookies = new Map();
    this.load();
  }

  setAccountKey(accountKey) {
    this.save();
    this.accountKey = accountKey;
    this.cookies.clear();
    this.load();
  }

  getStorageKey() {
    return `cx_cookie_${this.accountKey}`;
  }

  load() {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (data) {
        const parsed = JSON.parse(data);
        for (const [k, v] of Object.entries(parsed)) {
          this.cookies.set(k, v);
        }
      }
    } catch (e) {
      console.warn('Failed to load cookies from localStorage', e);
    }
  }

  save() {
    try {
      const obj = {};
      for (const [k, v] of this.cookies.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(this.getStorageKey(), JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to save cookies to localStorage', e);
    }
  }

  clear() {
    this.cookies.clear();
    try {
      localStorage.removeItem(this.getStorageKey());
    } catch (e) {}
  }

  set(name, value) {
    if (!name) return;
    this.cookies.set(name.trim(), value ? value.trim() : '');
    this.save();
  }

  get(name) {
    return this.cookies.get(name) || '';
  }

  /**
   * 将多条 Set-Cookie 头字符串或数组合并入 CookieJar
   */
  parseAndSave(setCookieHeader) {
    if (!setCookieHeader) return;
    let list = [];
    if (Array.isArray(setCookieHeader)) {
      list = setCookieHeader;
    } else if (typeof setCookieHeader === 'string') {
      try {
        const jsonList = JSON.parse(setCookieHeader);
        if (Array.isArray(jsonList)) {
          list = jsonList;
        } else {
          list = [setCookieHeader];
        }
      } catch (e) {
        list = setCookieHeader.split(/,(?=[^;]+=[^;]+)/g);
      }
    }

    list.forEach(cookieStr => {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name && !['path', 'domain', 'expires', 'max-age', 'samesite', 'httponly', 'secure'].includes(name.toLowerCase())) {
          this.cookies.set(name, value);
        }
      }
    });

    this.save();
  }

  /**
   * 从标准 document.cookie 或抓包字符串批量导入
   */
  importRawString(rawStr) {
    if (!rawStr) return;
    const items = rawStr.split(';');
    items.forEach(item => {
      const parts = item.split('=');
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join('=').trim();
        if (k) this.cookies.set(k, v);
      }
    });
    this.save();
  }

  /**
   * 获取发送给超星服务端的 Cookie 字符串
   */
  toCookieHeader() {
    const list = [];
    for (const [k, v] of this.cookies.entries()) {
      list.push(`${k}=${v}`);
    }
    return list.join('; ');
  }

  getPuid() {
    return this.get('_uid') || this.get('UID') || this.get('cx_user_puid') || '';
  }
}

/**
 * 本地多账号存储器
 */
const AccountStorage = {
  KEY: 'cx_saved_accounts',
  CURRENT_KEY: 'cx_current_phone',

  getAll() {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  getCurrentPhone() {
    return localStorage.getItem(this.CURRENT_KEY) || '';
  },

  setCurrentPhone(phone) {
    localStorage.setItem(this.CURRENT_KEY, phone);
  },

  save(account) {
    const list = this.getAll();
    const index = list.findIndex(a => a.phoneNumber === account.phoneNumber);
    if (index >= 0) {
      list[index] = { ...list[index], ...account, updatedAt: Date.now() };
    } else {
      list.push({ ...account, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },

  remove(phoneNumber) {
    const list = this.getAll().filter(a => a.phoneNumber !== phoneNumber);
    localStorage.setItem(this.KEY, JSON.stringify(list));
    try {
      localStorage.removeItem(`cx_cookie_${phoneNumber}`);
    } catch (e) {}
  }
};

window.CookieJar = CookieJar;
window.AccountStorage = AccountStorage;
