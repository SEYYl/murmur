# 部署实战指南

## 方案 A：Cloudflare Pages + 后端分离（低成本尝鲜）⭐

> **综合体验评级：中等偏下 ⭐⭐⭐☆☆**
>
> 免费能跑，但有几个硬伤：Render 冷启动慢、转码靠服务器弱 CPU、大文件上传体验差。适合尝鲜和个人小规模使用，追求稳定体验建议走方案 B（VPS）。

---

### 总体架构

```
用户浏览器
    │
    ├── 前端页面 ──── Cloudflare Pages（免费，全球 CDN）
    │                    │
    │                    └── GET /api/* 请求
    │                         │
    └── 后端 API ──── Render Web Service（免费，fly.io 替代也可）
                             │
                             ├── SQLite 数据库（/app/data，需挂载 Disk 否则重启丢失）
                             │
                             └── Cloudflare R2（大文件存储，替代服务器本地磁盘）
```

**费用**：
| 项目 | 免费额度 | 实际花费 |
|------|---------|---------|
| Cloudflare Pages | 无限带宽/请求 | $0 |
| Render (Web Service) | 750h/月 + 冷休眠 | $0（+$0.25/月 Disk）|
| Cloudflare R2 | 10GB 存储 + 1000万次读 | $0 |

**总额：$0.25/月（仅 Render Disk 费用，不挂 Disk 则 $0）**

---

### 第 1 步：部署后端到 Render

#### 1.1 准备工作

> ⚠️ 务必加 Disk，否则 Render 重启后 SQLite 数据库和媒体文件全部消失。

仓库里已经配好了 [render.yaml](render.yaml)，Render 会自动识别。你需要手动做的：

1. 把代码推送到你自己的 GitHub 仓库
2. 登录 [Render Dashboard](https://dashboard.render.com)
3. 点 "New" → "Web Service" → 连接你的 GitHub 仓库
4. Render 会自动读取 `render.yaml` 的配置

**关键设置核对**：

| 设置项 | 值 | 说明 |
|--------|----|-----|
| Runtime | Docker | 自动识别 `Dockerfile` |
| Disk | 1 GB, `/app/data` | **必须挂！不挂数据库重启就没了** |
| Port | 8000 | Dockerfile 暴露的端口 |

> **关于 Disk 费的说明**：Render Disk 最低 $0.25/GB/月。1GB 对 SQLite + 少量媒体文件够用。如果改用 R2 做存储、本地只放数据库，甚至可以 512MB 就够了。

#### 1.2 环境变量

在 Render 的 Environment 里可以不用加什么，`ASMR_SECRET_KEY` 和 `PORT` 已经在 `render.yaml` 里自动生成了。

如果需要自定义，加：
```
ASMR_SECRET_KEY = 随便一串随机字符
```

#### 1.3 部署完成

部署完成后你会得到一个后端地址，例如：
```
https://murmur-wnk8.onrender.com
```

记下来，后面前端要用。此时可以访问 `https://你的地址/api/settings/public` 验证后端是否正常。

> ⚠️ 如果返回 502 或连接超时，等 2-5 分钟再试，免费版首次构建 Docker 镜像比较慢。

---

### 第 2 步：部署前端到 Cloudflare Pages

#### 2.1 配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers 和 Pages
2. 点 "创建应用程序" → "Pages" → "连接到 Git"
3. 选择同一个 GitHub 仓库
4. 配置构建：

| 设置 | 值 |
|------|----|
| **构建命令** | `python scripts/build_pages.py` |
| **输出目录** | `dist` |

5. 环境变量：

| 变量名 | 值 |
|--------|----|
| `API_BASE_URL` | `https://你的Render后端地址`（注意**不要**末尾加 `/`）|
| `PYTHON_VERSION` | `3.11` |

6. 点 "保存并部署"

#### 2.2 部署验证

部署完你会得到一个 `*.pages.dev` 域名。打开后确认：
- 首页能看到分类列表
- 能正常登录（默认账号 admin / admin123）
- 点一个内容进去能正常播放

---

### 第 3 步：配置 Cloudflare R2 存储（推荐）

#### 3.1 为什么需要 R2

Render 免费版的磁盘空间有限（收费 $0.25/GB/月），而且服务器和你的用户不在同一地区，文件要经过 Render 中转，播放体验差。

R2 是 Cloudflare 的对象存储，和 Pages 在同一网络里，**价格极低且全球加速**。

#### 3.2 创建 R2 存储桶

1. Cloudflare Dashboard → R2 → 创建存储桶
2. 桶名任意，如 `murmur-media`
3. 记下你的 **Account ID**（R2 概览页右上角可复制）

#### 3.3 创建 API 令牌

1. R2 → 管理 API 令牌 → 创建 API 令牌
2. 权限选 **「管理员读和写」**（只读不够！）
3. 创建后会显示两个值，**立即复制保存**（只显示一次）：
   - **访问密钥 ID** → 就是 Access Key
   - **机密访问密钥** → 就是 Secret Key

#### 3.4 在后台配置 R2

在网站后台 → 系统设置 → 存储设置：

| 字段 | 填什么 | 易错点 |
|------|--------|--------|
| 存储后端 | S3 兼容存储 | |
| 存储服务提供商 | Cloudflare R2 | |
| Region | **Cloudflare Account ID** | ⚠️ 不是 `auto`！是你的 Account ID |
| Endpoint | **留空，不填** | ⚠️ 系统会自动拼接 |
| Bucket | 你的桶名（如 `murmur-media`） | |
| Access Key | 令牌的「访问密钥 ID」 | |
| Secret Key | 令牌的「机密访问密钥」 | ⚠️ 仔细复制，很容易多复制空格 |

填好后点 **🔌 测试连接**，显示 ✅ 就是对了。点 **💾 保存设置**。

> 常见报错及解决见下文「常见问题」章节。

#### 3.5 迁移已有本地文件（可选）

如果之前已经用本地存储上传了一些内容，点 **📤 迁移现有文件到 S3** 按钮，系统会自动把本地 `media/` 下的文件全部上传到 R2。

---

### 第 4 步：大文件——跳过服务器直接传 R2（进阶技巧）

#### 4.1 问题

30 分钟的视频，直接通过后台上传有三个瓶颈：
1. 文件要先传到 Render 服务器（免费版带宽慢）
2. Render 免费版弱 CPU 跑 ffmpeg 转码，一个视频能转半小时
3. 转码完成后才同步到 R2

上传一个视频可能要等 40 分钟以上。

#### 4.2 解决：手动添加

代码已经内置了「手动添加」功能，操作流程：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 → 你的存储桶
2. 直接点「上传」把视频/音频文件传上去（走 Cloudflare 骨干网，很快）
3. 上传成功后，复制文件路径。比如文件叫 `myvideo.mp4`，上传到根目录就填 `myvideo.mp4`；如果放进 `video` 文件夹就是 `video/myvideo.mp4`
4. 打开网站后台 → 内容管理 → **➕ 手动添加**
5. 填写标题、分类、R2 文件路径、文件类型等 → **✅ 保存**
6. 几秒搞定，内容直接可用

封面同理：先把封面图上传到 R2 的 `covers/` 目录，然后在手动添加表单里填 `covers/mycover.jpg`。

---

### 常见问题与解决

#### ❌ 点音频进去显示「🌐 网络错误」

**原因**：后端缺少某个 API 端点，前端发请求返回了 HTML 而不是 JSON。

**解决**：这是代码 bug，已在新版本修复。重新部署后端即可。

#### ❌ 页面打开，CSS/JS 加载不出来

**原因**：Cloudflare Pages 构建时静态资源路径没替换干净。

**已修复**：`scripts/build_pages.py` 会自动处理。如果还有问题，检查 `dist/` 目录下的 `index.html` 是否把 `/static/` 替换成了 `/`。

#### ❌ R2 连接失败：Could not connect to the endpoint URL

**原因**：Region 字段填了 `https://` 开头的完整 URL 或填了 `auto`。

**解决**：Region 字段只填 **Cloudflare Account ID**（32位十六进制字符串）。Endpoint 字段留空。

#### ❌ R2 连接失败：Unauthorized

**原因**：API 令牌权限不够。

**解决**：重新创建令牌，权限必须选「管理员读和写」。

#### ❌ R2 连接失败：SignatureDoesNotMatch

**原因**：Secret Key 复制错了，常见是多了空格或少了字符。

**解决**：重新创建令牌，仔细复制 Secret Key。

#### ❌ 网站打开很慢，要等 30 秒以上

**原因**：Render 免费版 15 分钟无流量就休眠，第一个请求要"唤醒"服务器。

**缓解**：这个没法根本解决，是 Render 免费版的限制。可以：
- 用 [UptimeRobot](https://uptimerobot.com) 之类的免费监控每隔 5 分钟 ping 一次你的后端，保持不睡
- 换付费版 Render（$7/月）就没有冷启动
- 换方案 B（VPS 自己托管）

#### ❌ 上传文件报 413 错误

**原因**：文件超过了上传大小限制。

**解决**：后台 → 系统设置 → 上传限制，调大 `max_upload_size_mb`（默认 500MB）。但注意 Render 免费版内存有限，太大可能 OOM。

---

### 体验总结

**优点** ✅
- 零成本起步，$0.25/月就能跑
- Cloudflare 全球 CDN，前端加载飞快
- R2 存储便宜且快，文件播放走 Cloudflare 网络
- 部署不算复杂，10 分钟就能跑起来

**硬伤** ❌
- Render 冷启动：15 分钟没人访问就"睡着"，再打开要等 30 秒。用户体验很差
- 转码瓶颈：CPU 弱，大视频能转半小时以上。文中的"手动添加"可以绕过这个
- 磁盘绑定：不加 $0.25/月的 Disk，重启数据库就清零
- 小内存：免费版 512MB，上传大文件有 OOM 风险
- 网络延迟：Render 机房可能在美东，亚洲访问延迟较高

**适合谁**
- 想尝鲜看看效果的个人开发者
- 只有几个朋友内部使用的小圈子
- 预算极其有限（每月 $1 以下）

**不适合谁**
- 想认真运营、追求用户体验
- 需要稳定 24/7 在线
- 需要经常上传大视频

---

### 方案 B：VPS 自行托管（推荐）

如果想长期运营，建议直接上 VPS。几十块钱一个月的云服务器：

- 2 核 4GB 的 VPS，装好 Python + ffmpeg + Nginx
- 开箱即跑，没有冷启动问题
- 可以绑定自己的域名
- 配合 R2 做大文件存储，服务器只跑数据库和 API

可以参考 [README.md](README.md) 底部的 systemd / Docker / Nginx 配置。

---

### 方案 C：其他 Serverless 组合

#### C1：Railway 替代 Render

[Railway](https://railway.app) 免费额度更大，且**不会冷休眠**。缺点是没有 Disk（数据库只能用外部 Postgres），费用可能略高于 Render。

#### C2：Fly.io 替代 Render

[Fly.io](https://fly.io) 免费额度可跑 3 个小实例，全球多区域部署。需要自己写 `fly.toml`，稍复杂。

#### C3：全静态（放弃后端）

如果只是展示内容、不需要用户系统/评论/收藏等功能，可以把前端改成纯静态，数据硬编码在 JSON 里，部署到 Cloudflare Pages 完全免费。
