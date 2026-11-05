# ChaoXing Web Sign (随地大小签 Web 版)

[![Deploy to GitHub Pages](https://github.com/Flower-MUYi/ChaoXing/actions/workflows/deploy.yml/badge.svg)](https://github.com/Flower-MUYi/ChaoXing/actions/workflows/deploy.yml)
[![GitHub License](https://img.shields.io/badge/license-AGPLv3-blue.svg)](LICENSE)

> 本项目将开源 Android 应用 [aquamarine5/ChaoxingSignFaker](https://github.com/aquamarine5/ChaoxingSignFaker)（随地大小签）的核心签到与课程交互逻辑移植为**纯前端现代化网页版**。无需安装任何安卓客户端或修改手机环境，无论是在 iPhone、iPad、Android 手机还是 Mac、Windows 电脑上，打开浏览器即可随时随地完成签到！

---

## 🌟 在线体验 (GitHub Pages)

网页版已配置 GitHub Pages 自动部署，直接访问即可使用：  
👉 **https://flower-muyi.github.io/ChaoXing/**

---

## 🚀 核心功能特性

- **多端通用**：无需下载 APK，iOS (iPhone / iPad)、Android、PC 网页浏览器全面兼容。
- **全类型签到支持**：
  - 📍 **位置签到**：自定义经纬度坐标与详细地址名称，内置原版同款 **坐标微抖动算法（约5米随机扰动）**，规避同坐标聚集异常检测。
  - 📷 **二维码签到**：支持直接粘贴二维码解析出的链接/参数（`SIGNIN:...` 或 `enc=...`），或上传二维码截图自动识别。
  - ✍️ **手势签到**：还原移动端 3x3 九宫格连线解锁交互，触摸/鼠标连线直观流畅。
  - 🔢 **签到码 / 密码签到**：支持输入教师发布的数字或文字签到码提交签到。
  - 👆 **普通点击签到 / 拍照签到**：一键完成日常点击签到。
- **智能一键全课扫描**：一键自动扫描所有已加入课程中正在进行的签到活动，防止遗漏。
- **多账号管理与一键代签**：支持本地保存多个账号（宿舍/朋友账号），一键无缝切换代签。
- **安全与隐私保护**：本网页为纯静态前端运行，**所有密码、Cookie 和账号凭证仅保存在您本地浏览器的 localStorage 中**，绝不会上传至任何未授权第三方服务器。

---

## 🌐 跨域与网络代理说明

由于浏览器的同源策略（CORS）与安全限制，前端纯静态网页向超星服务器发送请求时需要解决跨域限制：

1. **已内置专属 Cloudflare Worker 代理（默认开启，极速畅通）**：
   - 您的专属节点域名：**`https://chaoxing.flowermuyi.me`**
   - 享有独立纯净 IP 与 Cloudflare 全球边缘 CDN 加速，**账号密码登录 100% 畅通**，支持全部签到动作。
2. **本地代理模式**：
   - 双击运行项目中的 `启动随地大小签.bat` 即可启动本地代理（`127.0.0.1:8787`）。
3. **插件直连模式**：
   - 若电脑浏览器已安装 `Allow CORS` 等跨域扩展插件，也可直接开启直连模式。

---

## 🛠️ 如何在 GitHub Pages 启用本网页

如果您将代码 Fork 或推送到了自己的仓库，请按以下步骤启用 GitHub Pages：

1. 打开 GitHub 仓库页面，进入 **Settings**（设置）选项卡。
2. 在左侧菜单中找到 **Pages**。
3. 在 **Build and deployment** 下方的 **Source** 中：
   - 推荐选择：**GitHub Actions**（本仓库已内置 `.github/workflows/deploy.yml` 自动化工作流，每次 push 自动完成发布）。
   - 或者选择：**Deploy from a branch** -> 分支选择 `main`，目录选择 `/ (root)`，点击 **Save**。
4. 等待 1~2 分钟，即可通过 `https://<你的用户名>.github.io/<仓库名>/` 访问！

---

## ⚠️ 免责声明

1. 本项目仅供前端开发、网络协议逆向研究以及 Web 开发学习交流使用。
2. 请勿将本项目用于任何违反学校纪律、考试规程或破坏教学秩序等违法违规用途。
3. 任何个人或组织因不正当使用本程序所产生的一切后果和法律责任，均由使用者本人承担，原作者与开发者不承担任何责任。

---

## 📄 开源许可证

本项目基于 [GNU AGPLv3](LICENSE) 开源。原版 Android 客户端代码源自 [aquamarine5/ChaoxingSignFaker](https://github.com/aquamarine5/ChaoxingSignFaker)。
