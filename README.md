# Murmur 🌙

> 一个优雅的自托管 ASMR 音频与视频平台。自定义播放器，极简 SPA，丰富的社区功能，支持异步转码、多存储后端、内容审核与播放统计。
>
> A self-hosted ASMR audio & video platform with a custom-built player, clean SPA frontend, async transcoding, multi-storage backends, content moderation, and play analytics.

---

## 预览

| 首页 | 音频播放 | 管理面板 |
|------|---------|---------|
| 分类+网格展示 + 精选推荐 + 热门排序 | 自定义播放器 + 歌词字幕 + 评论区 | 数据仪表盘 + 转码队列 + 举报审核 |

Murmur 是一个轻量级的 ASMR 媒体管理平台，后端 Python (FastAPI)，前端原生 JS，无需任何前端框架。从 MVP 逐步演进为具备 21 个 PRD 的完整内容平台。

## 功能 ✨

### 🎵 核心播放
- **音频播放** — 自定义 UI 播放器：进度条点击跳转、音量控制、倍速切换（0.5x~2x）、静音、睡眠定时器
- **视频播放** — 自定义控件覆盖层，3 秒自动隐藏，支持全屏、进度跳转、双击手势
- **播放队列** — 支持加入队列，连续播放，多种播放模式（单曲循环/列表循环/随机）
- **播放历史** — 自动记录播放进度，支持断点续播，跨设备同步
- **字幕支持** — VTT/SRT 字幕上传与管理，CC 按钮切换
- **媒体会话** — Media Session API，锁屏/通知栏控制
- **键盘快捷键** — 空格播放/暂停、←/→ 快进快退、↑/↓ 音量、F 全屏、M 静音、N 下一首
- **PWA 离线** — Service Worker 应用壳缓存，可安装到桌面/主屏

### 📤 内容管理
- **上传** — 支持拖拽上传，进度条显示，断点续传，自动 ffmpeg 压缩大文件，视频自动生成封面，可自定义封面帧
- **异步转码** — 后台线程池异步转码，上传立即返回，状态轮询，失败自动重试 3 次，30 分钟超时保护
- **编辑** — 创作者可编辑自己的内容（标题/描述/分类/标签/封面）
- **分类管理** — 预设 8 个 ASMR 分类，可增删改
- **标签系统** — 多标签支持，标签搜索，按标签浏览，热门标签排序
- **精选推荐** — 管理员可加精/取消精，首页精选运营位
- **重复检测** — 基于内容哈希的重复上传检测，避免重复上传自动拒绝
- **敏感词过滤** — 上传标题/描述敏感词检测，可配置敏感词列表

### 👥 用户与社区
- **用户角色** — 三级权限：普通用户 / 创作者 / 管理员
- **用户状态** — 支持封禁/解禁，封禁用户无法登录
- **收藏功能** — 一键收藏，收藏列表管理
- **评论系统** — 登录用户可发表评论，支持删除（本人/管理员）
- **播放列表** — 创建个人歌单，公开/私密，添加/移除歌曲
- **相关推荐** — 基于分类+标签共现算法，详情页底部推荐
- **举报系统** — 内容/评论举报，管理员审核队列，联动删除/封禁
- **数据导出** — 一键导出个人数据（收藏/历史/歌单/上传内容）ZIP 包
- **RSS 订阅** — 全站内容 RSS Feed，可在播客客户端订阅

### 📊 后台管理
- **数据仪表盘** — 用户数/内容数/播放量/收藏数趋势图，热门内容排行，分类分布
- **完播率统计** — 播放会话追踪，完播率 Top 排行，播放时长趋势
- **转码队列** — 转码状态监控，失败重试，队列列表
- **举报管理** — 举报队列，处理（通过/驳回/删除内容/封禁用户）
- **用户管理** — 用户列表，角色调整，状态管理，重置密码
- **系统设置** — 站点名称/描述/页脚，注册开关，上传大小限制，允许的文件格式，存储后端配置，S3 配置，敏感词配置，RSS 开关
- **内容管理** — 全平台内容编辑/删除，加精/取消精

### 🔐 安全加固
- **密码哈希** — bcrypt（cost=12），旧 SHA256 哈希登录时自动迁移，用户无感知
- **JWT 认证** — 登录/注册，视频内容仅登录用户可看，密钥环境变量优先
- **CORS 白名单** — 环境变量 `ASMR_CORS_ORIGINS` 控制允许的来源，不再使用 `*`
- **文件类型校验** — magic bytes 文件头校验（13 种音视频格式），防止伪装文件上传
- **路径遍历防护** — 四层校验：拒绝 `..`、realpath 校验、isfile 校验、路由层规范化
- **速率限制** — 登录 5 次/5 分钟，注册 3 次/小时，改密 3 次/5 分钟，防止暴力破解
- **密码强度** — 最少 8 位，必须包含字母 + 数字
- **流式上传** — 1MB 分块流式写入，避免大文件全量读入内存导致 OOM
- **线程安全** — 全局状态（速率限制、浏览计数、设置缓存）均加锁保护
- **搜索与排序** — 按标题/描述搜索，按最新/热门（加权算法）排序，分页
- **加权热门排序** — `score = views×0.4 + favorites×0.3 + completion_ratio×0.3`
- **主题系统** — 深色/浅色模式 + 4 种强调色（紫/蓝/绿/暖橙），跟随系统主题自动切换
- **播放量防刷** — 同一 IP 5 分钟内不重复计数
- **自动数据库迁移** — 版本升级自动迁移表结构，无需手动操作
- **Range 请求流式传输** — 音视频支持 HTTP Range 请求，支持拖动进度跳转与大文件流式播放
- **国际化 i18n** — 内置中文/英文双语，可扩展更多语言

## 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Python 3.13, FastAPI, SQLAlchemy, SQLite |
| **前端** | Vanilla JS SPA, CSS Variables 主题系统, Service Worker PWA |
| **媒体处理** | ffmpeg（压缩/缩略图/转码/封面帧提取） |
| **认证** | JWT (python-jose), bcrypt (password hashing) |
| **权限** | RBAC 三级角色（user / creator / admin） |
| **异步转码** | ThreadPoolExecutor（无 Redis 依赖） |
| **存储后端** | Local 本地存储 / S3 兼容存储（可切换） |
| **缓存策略** | Service Worker stale-while-revalidate |
| **代码质量** | ruff (lint + format), pytest (63 tests) |

## 快速开始

### 前置条件

- Python 3.10+（推荐 3.13）
- ffmpeg（用于媒体压缩、封面生成、转码）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/SEYYl/murmur.git
cd murmur

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（生产环境必填）
cp .env.example .env
# 编辑 .env 填入 ASMR_SECRET_KEY 等配置

# 启动
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

访问 **http://localhost:8000**

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

> **⚠️ 生产环境请务必：**
> 1. 修改默认管理员密码
> 2. 设置 `ASMR_SECRET_KEY` 环境变量（`python -c "import secrets; print(secrets.token_urlsafe(32))"`）
> 3. 配置 `ASMR_CORS_ORIGINS` 为你的实际域名

### 开发环境

```bash
# 安装开发依赖（含测试 + lint）
pip install -r requirements-dev.txt

# 运行测试
python -m pytest tests/ -v

# 代码检查
ruff check backend/
```

### 初始化示例数据

媒体文件（音频、封面）和数据库文件不会提交到 Git。首次部署后可使用内置脚本快速生成示例内容：

```bash
# 启动服务器后，在另一个终端运行
python scripts/setup_audio.py
```

脚本会自动完成：
1. 清除现有内容（如有）
2. 优先使用 `sample_audio/` 目录下预生成的 16 个 MP3 示例音频
3. 如无示例文件，则自动合成 ASMR 音频（白噪音、棕噪音、双耳节拍、敲击音、正弦波等）
4. 按 8 个分类各上传 2 个内容（共 16 个）

> **注意**：示例音频为合成/演示用途，正式使用请上传真实的 ASMR 内容。

## 环境变量

所有环境变量详见 [`.env.example`](.env.example)，关键项：

| 变量 | 必填 | 说明 |
|------|------|------|
| `ASMR_SECRET_KEY` | 生产必填 | JWT 签名密钥，未设置时启动会告警并生成临时密钥 |
| `ASMR_CORS_ORIGINS` | 按需 | 允许的前端来源，逗号分隔，默认 `http://127.0.0.1:8000` |
| `MURMUR_STORAGE_BACKEND` | 可选 | `local`（默认）或 `s3` |
| `MURMUR_S3_*` | S3 必填 | S3 存储配置（endpoint/bucket/access_key/secret_key/region） |

## 系统配置

所有配置均可在管理后台「系统设置」页可视化修改，以下为关键配置说明：

### 基础配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `site_name` | Murmur | 站点名称 |
| `site_description` | 自托管 ASMR 内容平台 | 站点描述 |
| `footer_text` | Murmur · Self-hosted ASMR Platform | 页脚文字 |
| `registration_enabled` | true | 是否开放注册 |
| `default_user_role` | user | 新用户默认角色（user/creator） |
| `max_upload_size_mb` | 500 | 单文件最大上传大小（MB） |
| `allowed_audio_exts` | mp3,wav,flac,m4a,aac,ogg | 允许的音频格式 |
| `allowed_video_exts` | mp4,webm,mov,mkv | 允许的视频格式 |
| `rss_enabled` | true | 是否启用 RSS 订阅 |
| `sensitive_words` | （空） | 敏感词列表，逗号分隔 |

### 存储后端配置

#### 本地存储（默认）

无需额外配置，文件存储在 `media/` 目录下。

#### S3 兼容存储

| 配置项 | 说明 |
|--------|------|
| `storage_backend` | 设置为 `s3` 启用 S3 存储 |
| `s3_endpoint` | S3 服务端点 URL（如 `https://s3.amazonaws.com` 或 MinIO 地址） |
| `s3_bucket` | 存储桶名称 |
| `s3_access_key` | Access Key |
| `s3_secret_key` | Secret Key |

> **注意**：启用 S3 存储需要安装 `boto3` 依赖：
> ```bash
> pip install boto3
> ```
> 切换存储后端后，已有的本地文件不会自动迁移。建议在首次部署时确定存储策略。

### 转码配置

转码使用内置 `ThreadPoolExecutor`，无需额外安装。可在代码中调整以下参数：

| 参数 | 默认值 | 位置 | 说明 |
|------|--------|------|------|
| 并发数 | 2 | `_transcode_executor` | 同时转码的文件数 |
| 单任务超时 | 30 分钟 | `_TRANSCODE_TIMEOUT_SECONDS` | 单个转码任务最大时长 |
| 重试次数 | 3 次 | `transcode_task` | 失败自动重试次数 |
| 音频压缩阈值 | 10 MB | `compress_media` | 大于此大小的音频才压缩 |
| 视频压缩阈值 | 20 MB | `compress_media` | 大于此大小的视频才压缩 |
| 音频目标码率 | 128k AAC | `compress_media` | 音频压缩目标 |
| 视频目标质量 | CRF 23 h264 | `compress_media` | 视频压缩目标 |

> 调整并发数和超时时间请修改 [backend/utils.py](backend/utils.py) 中的常量。

## 项目结构

```
murmur/
├── backend/
│   ├── main.py              # FastAPI app 工厂（CORS + 路由注册 + SPA fallback）
│   ├── utils.py             # 共享工具函数（格式化、安全校验、转码、媒体服务）
│   ├── deps.py              # 依赖注入（optional_user）
│   ├── models.py            # SQLAlchemy 数据模型 + 自动迁移
│   ├── auth.py              # JWT 认证、bcrypt 密码哈希、权限依赖
│   ├── storage.py           # 存储抽象层（LocalStorage / S3Storage）
│   └── routers/             # API 路由模块（13 个）
│       ├── media.py         # 媒体文件服务（Range 请求 / 流式传输）
│       ├── auth.py          # 注册 / 登录 / 改密
│       ├── categories.py    # 分类 CRUD
│       ├── posts.py         # 内容列表 / 详情 / 上传 / 相关推荐
│       ├── favorites.py     # 收藏
│       ├── playback.py      # 播放记录 / 心跳 / 续播
│       ├── comments.py      # 评论
│       ├── subtitles.py     # 字幕
│       ├── tags.py          # 标签
│       ├── playlists.py     # 歌单
│       ├── settings.py      # 系统设置
│       ├── admin.py         # 管理后台（用户 / 统计 / 转码 / 举报）
│       └── misc.py          # 举报 / 导出 / RSS / SPA fallback
├── frontend/
│   ├── index.html           # SPA 入口
│   ├── manifest.json        # PWA 应用清单
│   ├── sw.js                # Service Worker（离线缓存）
│   ├── js/
│   │   ├── app.js           # 前端主逻辑
│   │   └── i18n.js          # 国际化引擎
│   │   └── i18n/            # 语言包（zh-CN.json, en-US.json）
│   └── css/style.css        # 主题系统 + 完整 UI 样式
├── tests/                   # 单元测试（pytest）
│   ├── conftest.py          # 测试 fixture + 临时数据库
│   ├── test_auth.py         # 密码哈希 / JWT 测试
│   ├── test_security.py     # magic bytes / 路径遍历 / 速率限制测试
│   └── test_fmt_batch.py    # 批量查询 / N+1 消除验证
├── scripts/                 # 工具脚本
│   ├── setup_audio.py       # 示例音频批量生成与上传
│   └── check_css_vars.sh    # CSS 变量完整性检查
├── docs/                    # 文档
│   ├── CODE_REVIEW_STANDARD.md  # 代码审查标准
│   └── PR_TEMPLATE.md       # PR 提交模板
├── sample_audio/            # 预生成的示例MP3音频（8分类x2=16个）
├── media/                   # 媒体文件存储（运行时生成，不进Git）
│   ├── audio/               # 音频文件
│   ├── video/               # 视频文件
│   ├── covers/              # 封面图
│   └── subtitles/           # 字幕文件
├── data/                    # SQLite 数据库
├── uploads/                 # 临时上传目录
├── pyproject.toml           # ruff + pytest 配置
├── requirements.txt         # 生产依赖
├── requirements-dev.txt     # 开发依赖（测试 + lint）
├── .env.example             # 环境变量模板
└── README.md
```

## API 概览

### 认证

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/register` | POST | 注册（受系统设置控制） | — |
| `/api/login` | POST | 登录 | — |
| `/api/me` | GET | 当前用户信息 | ✅ |
| `/api/change-password` | POST | 修改密码 | ✅ |

### 分类

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/categories` | GET | 分类列表（含内容数） | — |
| `/api/categories` | POST | 创建分类 | 管理员 |
| `/api/categories/:id` | PUT | 更新分类 | 管理员 |
| `/api/categories/:id` | DELETE | 删除分类 | 管理员 |

### 标签

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/tags` | GET | 标签列表（搜索/排序） | — |
| `/api/tags/:id/posts` | GET | 按标签获取内容列表 | — |

### 内容

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/posts` | GET | 内容列表（搜索/分页/排序/分类） | — |
| `/api/posts/featured` | GET | 精选内容列表 | — |
| `/api/posts/:id` | GET | 内容详情（+1 播放量） | — |
| `/api/posts/:id/related` | GET | 相关推荐 | — |
| `/api/posts` | POST | 上传内容（异步转码） | 创作者+ |
| `/api/posts/:id` | PUT | 编辑内容 | 创作者（本人）/管理员 |
| `/api/posts/:id` | DELETE | 删除内容 | 创作者（本人）/管理员 |
| `/api/posts/:id/favorite` | POST | 收藏/取消收藏 | ✅ |
| `/api/posts/:id/comments` | GET | 评论列表（分页） | — |
| `/api/posts/:id/comments` | POST | 发表评论 | ✅ |
| `/api/posts/:id/heartbeat` | POST | 播放进度上报 | ✅ |
| `/api/posts/:id/resume` | GET | 获取断点续播位置 | ✅ |
| `/api/posts/:id/cover-frame` | POST | 设置视频封面帧时间点 | 创作者（本人）/管理员 |
| `/api/posts/:id/subtitles` | GET | 字幕列表 | — |
| `/api/posts/:id/subtitles` | POST | 上传字幕 | 创作者（本人）/管理员 |
| `/api/posts/:id/play-session` | POST | 播放会话（start/update/end） | ✅ |

### 评论

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/comments/:id` | DELETE | 删除评论 | 本人/管理员 |

### 举报

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/reports` | POST | 创建举报 | ✅ |

### 我的

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/me/favorites` | GET | 我的收藏列表 | ✅ |
| `/api/me/history` | GET | 我的播放历史 | ✅ |
| `/api/me/history/:id` | DELETE | 删除单条历史 | ✅ |
| `/api/me/history` | DELETE | 清空全部历史 | ✅ |
| `/api/me/export` | GET | 导出个人数据 ZIP | ✅ |

### 播放列表

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/playlists` | GET | 歌单列表（公开/我的） | — |
| `/api/playlists` | POST | 创建歌单 | ✅ |
| `/api/playlists/:id` | GET | 歌单详情（含歌曲） | —（公开）/ ✅（私人） |
| `/api/playlists/:id` | PUT | 更新歌单 | ✅（本人） |
| `/api/playlists/:id` | DELETE | 删除歌单 | ✅（本人） |
| `/api/playlists/:id/items/:post_id` | POST | 添加歌曲到歌单 | ✅（本人） |
| `/api/playlists/:id/items/:post_id` | DELETE | 从歌单移除歌曲 | ✅（本人） |

### 系统设置

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/settings/public` | GET | 公开设置（站点信息等） | — |
| `/api/admin/settings` | GET | 全部设置列表 | 管理员 |
| `/api/admin/settings` | PUT | 批量更新设置 | 管理员 |

### 管理 - 用户

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/admin/users` | GET | 用户列表（搜索/分页） | 管理员 |
| `/api/admin/users/:id/role` | PUT | 修改用户角色 | 管理员 |
| `/api/admin/users/:id/status` | PUT | 修改用户状态（封禁/解禁） | 管理员 |
| `/api/admin/users/:id/reset-password` | POST | 重置用户密码 | 管理员 |

### 管理 - 数据

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/admin/stats` | GET | 总览统计数据 | 管理员 |
| `/api/admin/stats/timeseries` | GET | 时序数据（用户/内容/播放量） | 管理员 |
| `/api/admin/stats/top-posts` | GET | 热门内容排行 | 管理员 |
| `/api/admin/stats/category-distribution` | GET | 分类分布统计 | 管理员 |
| `/api/admin/stats/top-completion` | GET | 完播率 Top 排行 | 管理员 |
| `/api/admin/stats/play-time-trend` | GET | 播放时长趋势 | 管理员 |
| `/api/admin/posts/:id/featured` | PUT | 设置/取消精选 | 管理员 |

### 管理 - 转码

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/admin/transcode/status` | GET | 转码状态统计 | 管理员 |
| `/api/admin/transcode/list` | GET | 转码任务列表 | 管理员 |
| `/api/admin/transcode/:id/retry` | POST | 重试失败的转码任务 | 管理员 |

### 管理 - 举报

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/admin/reports` | GET | 举报队列列表 | 管理员 |
| `/api/admin/reports/:id` | PUT | 处理举报 | 管理员 |

### RSS

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/rss` | GET | RSS 2.0 Feed | — |

## 部署

### 方案 A：Cloudflare Pages + 后端分离（低成本尝鲜）⭐

> **综合体验评级：中等偏下** — 免费能跑，但有冷启动、转码慢等硬伤。详细实战经验见 [DEPLOY.md](DEPLOY.md)。

一键部署：[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

👉 **完整部署教程（含 R2 存储配置、常见问题踩坑）**：[DEPLOY.md](DEPLOY.md)

---

### 方案 B：VPS 服务器（推荐长期运营）

详见下方 systemd / Docker / Nginx 配置。

### 使用 systemd

```ini
[Unit]
Description=Murmur ASMR
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/murmur
Environment=ASMR_SECRET_KEY="your-secret-key"
Environment=ASMR_CORS_ORIGINS="https://your-domain.com"
ExecStart=/usr/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

### 使用 Docker

```dockerfile
FROM python:3.13-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket（如使用的）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 媒体文件建议直接由 Nginx 提供以提升性能
    location /media/ {
        alias /path/to/murmur/media/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 生产环境检查清单

- [ ] 修改默认管理员密码
- [ ] 设置 `ASMR_SECRET_KEY` 环境变量
- [ ] 配置 `ASMR_CORS_ORIGINS` 为实际域名
- [ ] 配置 HTTPS（Let's Encrypt）
- [ ] Nginx 反向代理 + 静态文件加速
- [ ] 限制注册（关闭或审批制）
- [ ] 设置备份策略（数据库 + 媒体文件）
- [ ] 监控 ffmpeg 资源占用
- [ ] 根据服务器配置转码并发数

### 性能与容量规划

| 规模 | 推荐配置 | 并发用户 | 存储空间 |
|------|----------|----------|----------|
| 小型（个人/小团队） | 2 核 4GB | ~100 同时在线 | 按内容大小估算 |
| 中型（社区级） | 4 核 8GB | ~500 同时在线 | 1TB+ |
| 大型（平台级） | 8 核 16GB+ | 1000+ | 按需扩展 |

> SQLite 在万级内容量下性能良好，超过 10 万+ 内容建议迁移到 PostgreSQL。

## 性能基准

> 测试环境：Intel i7 / 16GB RAM / SSD / Windows 11 / Python 3.13 / uvicorn 单进程 / SQLite

### API 响应时间（10 并发）

| 接口 | QPS | 平均(ms) | P50(ms) | P95(ms) | P99(ms) |
|------|-----|----------|---------|---------|---------|
| `GET /api/categories` | 230 | 43 | 44 | 56 | 66 |
| `GET /api/posts/1`（详情） | 247 | 40 | 40 | 50 | 54 |
| `GET /api/posts`（列表 20 条） | 120+ | ~80 | ~80 | ~120 | ~140 |
| `GET /api/posts?search=test` | 173 | 57 | 55 | 101 | 107 |
| `POST /api/login` | 126 | 69 | 37 | 239 | 697 |
| `GET /api/me/favorites` | 191 | 51 | 51 | 64 | 74 |
| `POST /api/posts/1/favorite` | 154 | 60 | 54 | 126 | 193 |
| `GET /api/admin/stats` | 200 | 25 | 24 | 34 | 38 |
| `GET /rss` | 369 | 26 | 14 | 150 | 154 |
| `GET /media/covers/`（静态文件） | 1331 | 7 | 6 | 12 | 13 |

### 性能解读

- **列表接口已优化**：`fmt_posts_batch()` 批量查询将 N+1 问题消除——20 条帖子从 160 次查询降至 8 次固定查询，QPS 从 56 提升至 120+。
- **静态文件极快**：封面图 QPS 1300+，生产环境加 Nginx 可进一步提升。
- **登录接口长尾**：bcrypt 密码哈希导致 P99 偏高（~700ms），这是安全性与性能的正常权衡。
- **RSS 有缓存**：首次 150ms，缓存命中 10ms 以内。
- **SQLite 写入**：单文件串行写入，高并发写入场景建议迁移 PostgreSQL。

### 转码性能（ffmpeg）

| 文件类型 | 大小 | 耗时 |
|---------|------|------|
| 音频 MP3 | 50MB | ~30-60s |
| 视频 MP4 | 200MB | ~2-5min |

> 实际性能取决于 CPU 核心数与 ffmpeg 编码器设置。生产环境建议根据服务器 CPU 核心数调整转码并发数。

## 测试

项目包含 63 个单元测试，覆盖安全修复和性能优化：

| 测试文件 | 测试数 | 覆盖内容 |
|----------|--------|----------|
| `test_auth.py` | 16 | bcrypt 哈希格式、cost=12、旧 SHA256 兼容迁移、JWT token 签发与过期 |
| `test_security.py` | 31 | 密码强度规则、13 种 magic bytes 文件头校验、路径遍历防护、速率限制 |
| `test_fmt_batch.py` | 10 | 批量查询输出一致性、各计数正确性、查询次数恒定验证 |

```bash
# 运行全部测试
python -m pytest tests/ -v

# 运行特定测试文件
python -m pytest tests/test_security.py -v
```

## 代码质量

| 工具 | 配置文件 | 说明 |
|------|----------|------|
| ruff | `pyproject.toml` | Lint + format，78 个问题已清零 |
| pytest | `pyproject.toml` | 63 个测试，覆盖安全修复 |
| 代码审查标准 | `docs/CODE_REVIEW_STANDARD.md` | 四大维度：安全 / 正确性 / 可维护性 / 性能 |
| PR 模板 | `docs/PR_TEMPLATE.md` | 8 项自查清单 |

```bash
# 代码检查
ruff check backend/

# 自动修复
ruff check backend/ --fix
```

## 版本历史

### V2.1 — 安全加固 + 架构优化
- 🔒 bcrypt 密码哈希（cost=12），旧 SHA256 自动迁移
- 🔒 CORS 白名单 + SECRET_KEY 环境变量
- 🔒 magic bytes 文件头校验（13 种格式）
- 🔒 路径遍历四层防护
- 🔒 登录/注册/改密速率限制
- 🔒 密码强度校验（8 位 + 字母 + 数字）
- 🔒 流式文件上传（1MB 分块）
- 🔒 全局状态线程安全（3 把锁）
- ⚡ N+1 查询消除（160 次 → 8 次固定查询）
- 🏗️ main.py 模块化拆分（2610 行 → 80 行 + 13 个路由模块）
- 🧪 pytest 测试框架 + 63 个测试
- 📐 ruff lint 配置 + 78 个问题清零

### V2.0 — 平台化
- ⚡ 异步转码队列（ThreadPoolExecutor，3 次重试，30 分钟超时）
- 💾 多存储后端（Local / S3 兼容，抽象层切换）
- 🚔 内容审核与举报（举报队列，敏感词过滤，内容哈希去重）
- 📈 播放时长与完播率统计（PlaySession 模型，加权热门排序）
- 🎬 字幕上传与管理（VTT/SRT，CC 切换）
- 🖼️ 自定义封面帧（视频任意时间点截取）

### V1.4 — 体验打磨
- 🎛️ 播放器增强（快捷键、播放模式、媒体会话、持久化设置）
- 📱 移动端优化与 PWA（汉堡菜单、视频手势、离线缓存、安装提示）
- 📤 上传体验增强（进度条、重试、字幕、封面帧）
- 🌐 国际化 i18n（中/英双语）
- 📦 数据导出与 RSS（个人数据 ZIP、RSS Feed）

### V1.3 — 社区互动与内容发现
- 🏷️ 标签系统（多标签、标签搜索、按标签浏览）
- 🎵 播放列表（创建/编辑/删除、添加/移除歌曲、公开/私密）
- 💬 评论系统（发表/删除、评论计数）
- ✨ 精选推荐（管理员加精、首页运营位）
- 🔗 相关推荐（基于分类+标签共现算法）
- 🔄 自动数据库迁移

### V1.2 — 后台补全
- 📊 数据仪表盘（统计概览、时序图、热门排行、分类分布）
- 👥 用户管理（角色调整、状态管理、重置密码）
- ⚙️ 系统设置（站点信息、注册开关、上传限制、文件格式）
- 🚫 封禁用户无法登录

### V1.1 — 基础补全
- 👤 用户角色系统（user / creator / admin）
- ❤️ 收藏功能
- 📜 播放历史与断点续播
- ✏️ 内容编辑功能

## LICENSE

MIT
