# Murmur 代码 Wiki

> 一份关于 Murmur 项目仓库的结构化代码文档，涵盖整体架构、模块职责、关键类与函数、依赖关系及运行方式。

---

## 目录

1. [项目概述](#1-项目概述)
2. [项目整体架构](#2-项目整体架构)
3. [项目目录结构](#3-项目目录结构)
4. [主要模块职责](#4-主要模块职责)
5. [关键类与函数说明](#5-关键类与函数说明)
   - 5.1 [后端 backend/models.py](#51-后端-backendmodelspy)
   - 5.2 [后端 backend/auth.py](#52-后端-backendifauthpy)
   - 5.3 [后端 backend/main.py](#53-后端-backendmainpy)
   - 5.4 [前端 frontend/index.html](#54-前端-frontendindexhtml)
   - 5.5 [前端 frontend/js/app.js](#55-前端-frontendjsappjs)
   - 5.6 [前端 frontend/css/style.css](#56-前端-frontendcssstylecss)
   - 5.7 [脚本 scripts/gen-favicon.py](#57-脚本-scriptsgen-faviconpy)
6. [依赖关系](#6-依赖关系)
7. [API 接口文档](#7-api-接口文档)
8. [项目运行方式](#8-项目运行方式)
9. [部署说明](#9-部署说明)
10. [安全注意事项](#10-安全注意事项)

---

## 1. 项目概述

**Murmur** 🌙 是一个优雅的、自托管的 ASMR（自发性知觉经络反应）音频与视频托管平台。

- **后端**：Python 3 + FastAPI + SQLAlchemy + SQLite
- **前端**：原生 JS 单页应用（SPA），CSS Variables 主题系统，**不依赖任何前端框架**
- **媒体处理**：使用 ffmpeg 进行音频/视频压缩、视频缩略图生成
- **认证**：基于 JWT（python-jose）的轻量级身份认证

**核心特性**：
- 自定义音频/视频播放器，支持进度跳转、倍速、静音、全屏
- 拖拽上传，自动压缩大文件，视频自动生成封面
- 8 个预设 ASMR 分类，支持增删改
- JWT 登录/注册，视频内容仅登录用户可观看
- 搜索、排序、分页
- 深色/浅色主题 + 4 种强调色，跟随系统主题
- 播放量防刷：同一 IP 5 分钟内不重复计数
- 播放队列、断点续播、定时关闭

---

## 2. 项目整体架构

Murmur 采用**前后端一体化**的轻量级架构，由 FastAPI 同时承担 API 服务与前端静态文件托管。

```
┌─────────────────────────────────────────────────────────────────┐
│                          浏览器（SPA）                            │
│   index.html  +  js/app.js  +  css/style.css                     │
│   ──────────────────────────────────────────────────────────    │
│   · 视图路由（hash-free SPA state）                              │
│   · 自定义 audio/video 播放器                                     │
│   · 主题切换 / 播放队列 / 断点续播 / 定时器                        │
└─────────────────────────────────────────────────────────────────┘
                              │ fetch + Bearer JWT
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Application                          │
│                     backend/main.py                              │
│   ──────────────────────────────────────────────────────────    │
│   · /api/*          业务 API（auth / categories / posts）        │
│   · /media/*        媒体文件流式分发（支持 Range）                │
│   · /static/*       前端静态资源（StaticFiles 挂载）              │
│   · /{full_path}    SPA 兜底路由，返回 index.html                 │
└─────────────────────────────────────────────────────────────────┘
        │            │               │                │
        ▼            ▼               ▼                ▼
   ┌────────┐  ┌──────────┐    ┌──────────┐    ┌────────────┐
   │ SQLite │  │ ffmpeg/  │    │ media/   │    │ uploads/   │
   │ asmr.db│  │ ffprobe  │    │ audio/   │    │ (临时上传) │
   │        │  │ 子进程   │    │ video/   │    │            │
   └────────┘  └──────────┘    │ covers/  │    └────────────┘
                               └──────────┘
```

### 请求生命周期示例（上传一个音频）

1. 用户登录后在前端 `renderUpload()` 选择文件并填写信息
2. `submitUpload()` 通过 `FormData` 调用 `POST /api/posts`
3. `create_post` 端点：
   - 校验扩展名是否在 `ALLOWED_EXTS` 内
   - 写入 `uploads/`，调用 `get_media_info`（ffprobe）获取时长/大小
   - 移动到 `media/audio/`，调用 `compress_media`（ffmpeg）压缩大文件
   - 若上传了封面，调用 `compress_image` 压缩；视频若无封面则 `gen_thumb` 生成缩略图
   - 写入 `Post` 表，返回新 post id
4. 前端跳转到 `navigate('post', id)` 渲染播放页

---

## 3. 项目目录结构

```
murmur/
├── backend/                       # 后端 FastAPI 应用
│   ├── main.py                    # FastAPI 主入口，API 路由 + 媒体流分发
│   ├── models.py                  # SQLAlchemy 数据模型 + DB 初始化
│   └── auth.py                    # JWT 认证、密码哈希/校验
├── frontend/                      # 前端 SPA
│   ├── index.html                 # SPA 入口（最小骨架）
│   ├── js/
│   │   └── app.js                 # 全部前端逻辑（~870 行）
│   ├── css/
│   │   └── style.css              # 主题系统 + 完整 UI 样式
│   ├── favicon.svg / favicon.ico  # 多尺寸站点图标
│   ├── favicon-{16..512}x{16..512}.png
│   ├── apple-touch-icon.png
│   └── site.webmanifest           # PWA 元数据
├── media/                         # 持久化媒体存储
│   ├── audio/                     # 音频文件
│   ├── video/                     # 视频文件
│   └── covers/                    # 封面/缩略图
├── uploads/                       # 临时上传目录（处理后被移走）
├── data/                          # SQLite 数据库目录（运行时生成 asmr.db）
├── scripts/
│   └── gen-favicon.py             # 用 Pillow 生成多尺寸 favicon
├── test_content/                  # 测试用 ASMR 素材（mp3）
├── start.sh                       # 启动脚本
├── requirements.txt               # Python 依赖
├── .gitignore
└── README.md
```

---

## 4. 主要模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| **后端入口** | `backend/main.py` | FastAPI 应用、所有 API 路由、媒体流式分发、ffmpeg 调用、播放量防刷 |
| **数据模型** | `backend/models.py` | SQLAlchemy ORM 模型（User/Category/Post）、DB 引擎、初始化（默认分类与 admin 账号）、`get_db` 会话工厂 |
| **认证模块** | `backend/auth.py` | 密码哈希（salt + sha256）、JWT 签发与解析、`get_current_user` 依赖注入 |
| **前端入口** | `frontend/index.html` | SPA 最小 HTML 骨架，引用 `app.js` 与 `style.css` |
| **前端逻辑** | `frontend/js/app.js` | 路由、API 调用、自定义播放器、主题、队列、断点续播、定时器、上传、管理面板 |
| **前端样式** | `frontend/css/style.css` | CSS Variables 双主题 + 4 强调色、响应式布局、播放器 UI |
| **PWA 配置** | `frontend/site.webmanifest` | PWA 元数据，支持"添加到主屏幕" |
| **图标生成** | `scripts/gen-favicon.py` | 用 Pillow 程序化生成多尺寸 PNG/ICO/SVG favicon |
| **启动脚本** | `start.sh` | 创建媒体目录并启动 uvicorn 开发服务器（带 --reload） |

---

## 5. 关键类与函数说明

### 5.1 后端 [backend/models.py](file:///c:/Users/Administrator/Downloads/murmur-main/backend/models.py)

#### 常量与配置

| 名称 | 类型 | 说明 |
|------|------|------|
| `BASE_DIR` | str | 项目根目录绝对路径 |
| `DATABASE_URL` | str | SQLite 连接串 `sqlite:///{BASE_DIR}/data/asmr.db` |
| `MEDIA_DIR` | str | 媒体存储根目录 `{BASE_DIR}/media` |
| `UPLOAD_DIR` | str | 临时上传目录 `{BASE_DIR}/uploads` |
| `ALLOWED_EXTS` | dict | 允许的文件扩展名白名单，分三类：`audio` / `video` / `image` |
| `engine` | Engine | SQLAlchemy 引擎，`check_same_thread=False` 以兼容 FastAPI 异步线程 |
| `Base` | declarative_base | ORM 模型基类 |

#### ORM 模型

**`User`**（用户表）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 用户 ID |
| `username` | String(50) | 唯一用户名，索引 |
| `password_hash` | String(255) | `salt$hash` 格式的密码哈希 |
| `created_at` | DateTime | UTC 创建时间 |

**`Category`**（分类表）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 分类 ID |
| `name` | String(100) | 唯一分类名 |
| `icon` | String(10) | Emoji 图标，默认 🎵 |
| `sort_order` | Integer | 排序权重 |
| `posts` | relationship | 反向关联的 Post 列表 |

**`Post`**（内容表）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 内容 ID |
| `title` | String(200) | 标题 |
| `description` | Text | 描述 |
| `file_path` | String(255) | 相对媒体路径，如 `media/audio/xxx.mp3` |
| `file_type` | String(10) | `audio` / `video` |
| `file_size` | Integer | 文件字节数 |
| `duration` | Float | 时长（秒） |
| `cover_image` | String(255) | 封面相对路径 |
| `category_id` | Integer FK | 关联 `categories.id` |
| `views` | Integer | 播放量 |
| `created_at` | DateTime | UTC 创建时间 |
| `category` | relationship | 反向关联的 Category 对象 |

#### 关键函数

- **`init_db()`**：启动时调用。`create_all` 建表；若 `Category` 表为空，则插入 8 个预设分类（耳语/触发音/角色扮演/白噪音/咀嚼音/冥想/纯音乐/综合）；若不存在 `admin` 用户则创建默认管理员（密码 `admin123`）。
- **`get_db()`**：FastAPI 依赖注入用的会话工厂，`yield` 一个 Session 并在 finally 中关闭。

---

### 5.2 后端 [backend/auth.py](file:///c:/Users/Administrator/Downloads/murmur-main/backend/auth.py)

#### 配置

| 名称 | 默认值 | 说明 |
|------|--------|------|
| `SECRET_KEY` | 环境变量 `ASMR_SECRET_KEY` 或 `"asmr-secret-key-change-me"` | JWT 签名密钥 |
| `ALGORITHM` | `"HS256"` | JWT 签名算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60 * 24 * 30`（30 天） | Token 过期时间 |

#### 关键函数

- **`hash_password(password: str) -> str`**：生成 16 字节随机 salt，返回 `salt$sha256(salt+password)` 字符串。
- **`verify_password(plain_password, hashed) -> bool`**：拆出 salt 重新哈希后比对。
- **`create_access_token(data: dict) -> str`**：构造 `{"sub": user_id, "exp": now+30d}` 并 `jwt.encode`。
- **`get_token(request) -> str`**：从 `Authorization: Bearer xxx` 头中提取 token。
- **`get_current_user(request, db) -> User`**：FastAPI 依赖。解析 token，校验 `sub`，从 DB 查 User；失败抛 `401`。

> ⚠️ 安全提示：当前使用 `sha256(salt+password)` 而非 PBKDF2/bcrypt/argon2，强度较弱，详见 [第 10 节](#10-安全注意事项)。

---

### 5.3 后端 [backend/main.py](file:///c:/Users/Administrator/Downloads/murmur-main/backend/main.py)

#### 应用初始化

```python
app = FastAPI(title="ASMR")
# CORS：全开（allow_origins=["*"]）
# 启动时确保 media/{audio,video,covers} 与 uploads/ 目录存在
# 挂载 /static → frontend/ 静态目录
```

#### 全局状态与辅助

- **`_view_history`**：内存字典 `{(post_id, ip): timestamp}`，记录最近一次播放时间。
- **`should_count_view(post_id, ip) -> bool`**：5 分钟内同一 IP 对同一 post 不重复计数。

#### ffmpeg 辅助函数

- **`get_media_info(fp) -> dict`**：调用 `ffprobe` 获取 `duration` 与 `size`。
- **`gen_thumb(video_path, output_path, t=5) -> bool`**：在 `t` 秒处截取一帧 JPG 作为视频封面。
- **`compress_media(input_path, file_type) -> str`**：
  - 音频 > 10MB：转 AAC 128k
  - 视频 > 20MB：转 H.264 CRF 23 + AAC 128k
  - 成功后原地替换，失败则保留原文件
- **`compress_image(input_path, max_size=800)`**：等比缩放至最大 800px。

#### 媒体流式分发

- **`stream_file(file_path, request, content_type)`**：核心函数。解析 `Range` 请求头，返回 `StreamingResponse`：
  - 有 Range → `206 Partial Content` + `Content-Range`
  - 无 Range → `200 OK` 全量分块（8192*16 字节）
  - 统一加上 `Accept-Ranges: bytes` 与 1 天缓存头

#### 路由端点

**媒体服务（带 Range 支持）**
| 路由 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/media/audio/{filename}` | GET | 公开 | 音频流 |
| `/media/video/{filename}` | GET | **需登录** | 视频流（受 `get_current_user` 保护） |
| `/media/covers/{filename}` | GET | 公开 | 封面图 |

**认证**
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/register` | POST | 注册（用户名 ≥2 字符，密码 ≥4 字符），返回 token |
| `/api/login` | POST | 登录，返回 token |
| `/api/me` | GET | 获取当前用户（鉴权） |
| `/api/change-password` | POST | 修改密码（鉴权） |

**分类**
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/categories` | GET | 列表（含每分类 post 数） |
| `/api/categories` | POST | 创建（鉴权，自动追加 sort_order） |
| `/api/categories/{cid}` | PUT | 更新（鉴权） |
| `/api/categories/{cid}` | DELETE | 删除（鉴权，若有 post 则拒绝） |

**内容**
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/posts` | GET | 列表，支持 `category_id` / `search` / `sort=latest\|popular` / `page`，每页 20 条 |
| `/api/posts/{post_id}` | GET | 详情，自动 +1 播放量（受防刷控制） |
| `/api/posts` | POST | 上传（鉴权，multipart：title/description/category_id/file/cover?） |
| `/api/posts/{post_id}` | DELETE | 删除（鉴权，同时删除磁盘文件） |

**SPA 兜底**
- `GET /{full_path:path}` → 返回 `frontend/index.html`，让前端处理所有非 API/媒体路径。

#### `create_post` 端点处理流程（关键）

```
1. 从扩展名推断 file_type（audio/video），拒绝 image
2. uuid 生成唯一文件名，写入 uploads/
3. ffprobe 取 duration/size
4. 移动到 media/{audio|video}/
5. compress_media() 压缩大文件
6. 重新 ffprobe 取压缩后信息
7. 处理封面：
   - 用户上传封面 → compress_image()
   - 视频且无封面 → gen_thumb() 在 30% 时长处截帧
8. 写入 Post 表，返回 {id, title, file_type}
```

---

### 5.4 前端 [frontend/index.html](file:///c:/Users/Administrator/Downloads/murmur-main/frontend/index.html)

极简 SPA 骨架，仅包含：
- `<header>` 顶栏：logo + 空 `<nav>`（由 `updateUI()` 动态填充）
- `<div class="main">`：左侧分类侧边栏 + 右侧 `#content` 主区
- 引入 `style.css?v=5` 与 `js/app.js?v=5`（版本号用于缓存破坏）
- 内联一行 `<style>` 防止首屏主题闪烁

所有视图由 `app.js` 动态渲染到 `#content`。

---

### 5.5 前端 [frontend/js/app.js](file:///c:/Users/Administrator/Downloads/murmur-main/frontend/js/app.js)

#### 全局常量与状态

```javascript
const API = '';                       // 同源 API 前缀
const TK = 'asmr_token';              // localStorage token key
const TT = 'asmr_theme';              // 主题 key
const TA = 'asmr_accent';             // 强调色 key
const PP_KEY = 'murmur_pp';           // 断点续播 key
const Q_KEY = 'murmur_queue';         // 播放队列 key

let state = { view:'home', postId:null, cat:null, sort:'latest', search:'', page:1, user:null };
let _playQueue = [];
let _timer = { active:false, remaining:0, total:0, id:null, interval:null };
```

#### 主题系统

- `getSystemTheme()`：通过 `matchMedia('prefers-color-scheme')` 获取系统主题。
- `initTheme()`：读取 localStorage，回退到系统主题；监听系统主题变化（仅当用户未手动设置时跟随）。
- `applyTheme(t, animate)`：设置 `data-theme` 属性，带 450ms 过渡动画。
- `setTheme(t)` / `toggleTheme()` / `resetTheme()`：写入或清除 localStorage。
- `setAccent(a)`：设置 `data-accent`，支持 `purple` / `blue` / `green` / `warm`。

#### 工具函数

- `esc(s)`：HTML 转义，防 XSS。
- `dur(s)`：秒 → `m:ss` 格式。
- `fs(b)`：字节 → 人类可读大小。
- `dt(d)`：相对时间（刚刚/N 分钟前/N 小时前/M/D）。
- `toast(msg, t)`：右上角浮层提示。

#### API 调用

- **`api(path, opts)`**：统一 fetch 封装。
  - 自动注入 `Authorization: Bearer <token>`
  - FormData 不设置 `Content-Type`
  - 401 自动清 token + 弹登录框（排除 login/register/me 三个路径）
  - 网络异常 toast 提示并返回 `null`

#### 视图渲染

由 `navigate(view, data)` 统一调度，更新 `state.view` 并清空 `#content` 后分发：

| 视图 | 渲染函数 | 说明 |
|------|----------|------|
| `home` | `renderHome()` + `loadPosts()` | 首页：分类、搜索栏、排序 tabs、网格列表、分页 |
| `post` | `renderPost()` | 详情页：自定义播放器 + 元信息 + 加入队列 |
| `upload` | `renderUpload()` | 上传页：拖拽区 + 表单（标题/描述/分类/封面） |
| `settings` | `renderSettings()` | 设置页：账号、改密、主题、强调色 |
| `admin` | `renderAdmin()` | 管理面板：统计、内容列表（含删除）、分类管理 |

#### 自定义播放器（核心）

**音频播放器**（前缀 `a`）：
| 函数 | 作用 |
|------|------|
| `atoggle(id)` | 播放/暂停 |
| `aupdateUI(id)` | 同步进度条 / 时间 / 按钮图标 |
| `aseek(e, id)` | 点击进度条跳转 |
| `avolume(e, id)` | 音量滑块 |
| `amute(id)` | 静音切换 |
| `aspeed(id)` | 倍速循环 [1, 1.25, 1.5, 2, 0.5] |

**视频播放器**（前缀 `v`）：
| 函数 | 作用 |
|------|------|
| `vtoggle(id)` | 播放/暂停 |
| `vupdateUI(id)` | 同步 UI |
| `vseek(e, id)` | 进度跳转 |
| `vvolume(e, id)` | 音量 |
| `vmute(id)` | 静音 |
| `vfs(id)` | 全屏切换 |
| `vshow(id)` | 控件可见，3 秒后自动隐藏（播放中） |

播放器 DOM ID 约定：
- 音频：`ael-{id}`（audio 元素）、`apb-{id}`（大播放按钮）、`apf-{id}`（进度填充）、`acur-{id}`（当前时间）等
- 视频：`vel-{id}`、`vov-{id}`（控件层）、`vpf-{id}`、`vcur-{id}`、`vdur-{id}` 等

#### 播放位置记忆（断点续播）

- `getPositions()`：从 localStorage 解析 `{id: {currentTime, duration, updatedAt}}`。
- `savePosition(id, ct, dur)`：仅当 `dur >= 10` 时保存；超过 50 条按 `updatedAt` 淘汰最旧。
- `clearPosition(id)`：播放结束清除。
- `getResumePos(id)`：仅当 `currentTime >= 15` 且进度 < 95% 时返回；否则清除并返回 `null`。

#### 播放队列

- `loadQueue()` / `saveQueue()`：localStorage 持久化。
- `addToQueue(item)`：去重后追加。
- `removeFromQueue(id)` / `rmFromQ(id)`：移除。
- `playNext()`：当前播放结束（`ended` 事件）时取队首播放。
- `updateQueueBar()`：渲染 `#queue-bar` 横条。

#### 定时关闭

- `showTimer(id)`：弹出底部 sheet，选项 15/30/45/60 分钟 / 播完为止 / 取消。
- `setTimer(id, seconds)`：启动 `setInterval` 每秒倒计时，到 0 暂停播放器并 toast。
- `updateTimerBtn()`：更新所有 `.timer-indicator` 显示。

#### 上传

- `renderUpload()`：渲染拖拽区，绑定 `dragover` / `dragleave` / `drop` 事件。
- `hf(e)`：处理文件选择，更新 UI 并默认选中第一个分类。
- `hc(e)`：封面预览（FileReader → dataURL）。
- `submitUpload()`：构造 FormData 调 `POST /api/posts`，成功后跳转到详情页。

#### 管理面板

- `renderAdmin()`：渲染统计卡片 + 内容列表（带分类筛选）+ 分类管理（编辑/删除/新增）。
- `deleteItem(id)` / `addCat()` / `editCat()` / `saveCat()` / `deleteCat(id)`：对应 CRUD 操作。

#### 初始化

```javascript
loadQueue();
document.addEventListener('DOMContentLoaded', () => {
  checkAuth(); loadCats(); navigate('home');
});
```

---

### 5.6 前端 [frontend/css/style.css](file:///c:/Users/Administrator/Downloads/murmur-main/frontend/css/style.css)

基于 **CSS Variables** 的双主题 + 多强调色系统。

#### 主题变量块

| 选择器 | 说明 |
|--------|------|
| `:root, [data-theme="dark"]` | 深色主题默认（`--bg #0a0a0c` 等） |
| `[data-theme="light"]` | 浅色主题（`--bg #f0f0f5` 等） |
| `[data-accent="blue"]` | 蓝色强调色 |
| `[data-accent="green"]` | 绿色强调色 |
| `[data-accent="warm"]` | 暖橙强调色 |
| 默认（无 data-accent） | 紫色（`--accent #a78bfa`） |

变量类别：`--bg*`（5 级背景）、`--border*`、`--text*`（3 级文字）、`--accent*`、`--grad` / `--grad2`（渐变）、`--shadow*`、`--header-bg`、`--modal-overlay` 等。

#### 样式分区（按注释分段）

| 区段 | 行号 | 内容 |
|------|------|------|
| Theme Variables | 1 | 主题变量定义 |
| Base | 77 | 全局重置、body、滚动条 |
| Header | 91 | 顶栏（sticky + backdrop-filter） |
| Layout | 108 | 主网格布局 + 移动端单列 |
| Sidebar | 112 | 分类侧边栏 |
| Page Header | 130 | 页面标题 |
| Search | 135 | 搜索框 |
| Sort Tabs | 149 | 排序切换 |
| Grid | 155 | 卡片网格 |
| Custom Player | 207 | 播放器总入口 |
| Audio Player | 209 | 音频播放器全套 UI |
| Video Player | 442 | 视频播放器全套 UI（含全屏、控件自动隐藏） |
| Detail / Player | 650 | 详情页布局 |
| Buttons | 657 | 按钮变体（primary/secondary/ghost/icon） |
| Loading / Empty | 674 | 加载 spinner、空状态 |
| Upload | 681 | 上传区与表单 |
| Settings | 713 | 设置卡片 |
| Toast | 717 | 浮层提示 |
| Auth Modal | 728 | 登录/注册弹窗 |
| Timer Picker | 746 | 定时器底部弹层 |
| Queue Indicator | 773 | 播放队列横条 |
| Resume Badge | 796 | 断点续播徽标 |
| Mobile Responsive | 805 | ≤480px 响应式适配 |

#### 全局过渡

```css
*, *::before, *::after {
  transition: background-color .35s ease, color .35s ease,
              border-color .25s ease, box-shadow .25s ease;
}
```

切换主题时所有元素颜色平滑过渡。

---

### 5.7 脚本 [scripts/gen-favicon.py](file:///c:/Users/Administrator/Downloads/murmur-main/scripts/gen-favicon.py)

使用 Pillow 程序化生成全站 favicon，不依赖任何外部图片素材。

#### 关键常量

- `OUT_DIR`：输出目录 = `frontend/`
- `SIZES`：`[16, 32, 48, 64, 96, 128, 180, 192, 512]`
- `C1 = (167, 139, 250)` 紫色 `#a78bfa`
- `C2 = (244, 114, 182)` 粉色 `#f472b6`

#### 关键函数

- **`lerp_color(a, b, t)`**：线性插值两个 RGB 颜色。
- **`draw_moon(...)`**：未实际使用（占位）。
- **`gen_png(size, path)`**：
  - 逐像素绘制圆形渐变背景（C1 → C2）
  - 边缘 0.7 之外做暗化
  - 绘制白色月牙（外圆 + 内偏移圆 carve-out 形成新月）
  - 添加 4 个星点
  - 大尺寸（≥48）添加底部声波弧线（呼应"Murmur 低语"主题）
- **`gen_ico(sizes_list, path)`**：合并多尺寸 PNG 为单个 ICO。
- **`gen_svg(path)`**：手写 SVG（渐变圆 + 月牙路径 + 星点 + 声波路径）。
- **`__main__`**：生成 SVG、ICO（16/32/48/64）、9 个 PNG、Apple Touch Icon。

---

## 6. 依赖关系

### 6.1 Python 运行时依赖（[requirements.txt](file:///c:/Users/Administrator/Downloads/murmur-main/requirements.txt)）

| 包 | 版本要求 | 用途 |
|----|----------|------|
| `fastapi` | ≥0.115.0 | Web 框架 |
| `uvicorn[standard]` | ≥0.20.0 | ASGI 服务器 |
| `sqlalchemy` | ≥2.0.0 | ORM |
| `python-jose[cryptography]` | ≥3.3.0 | JWT 编解码 |
| `python-multipart` | ≥0.0.5 | multipart 表单解析（文件上传） |
| `aiofiles` | ≥24.0.0 | 异步文件支持（uvicorn standard 已含） |
| `Pillow` | ≥10.0.0 | 仅 favicon 脚本使用 |

### 6.2 系统外部依赖

- **Python 3.10+**
- **ffmpeg / ffprobe**：媒体压缩、信息探测、缩略图生成（必须在 `PATH` 中）

### 6.3 前端依赖

**零依赖**。纯原生 JS + CSS，无 npm、无打包步骤。

### 6.4 模块间依赖图

```
backend/main.py
   ├── imports → backend/models.py  (init_db, get_db, Category, Post, User, MEDIA_DIR, UPLOAD_DIR, ALLOWED_EXTS)
   └── imports → backend/auth.py    (hash_password, verify_password, create_access_token, get_current_user)

backend/auth.py
   └── imports → backend/models.py  (User, get_db)

backend/models.py
   └── imports → backend/auth.py    (hash_password —— 仅在 init_db() 内延迟导入，避免循环依赖)

frontend/index.html
   ├── /static/css/style.css
   └── /static/js/app.js
```

> 注：`models.py` 与 `auth.py` 存在循环引用，通过 `init_db()` 内部局部 `from backend.auth import hash_password` 延迟导入来规避。

---

## 7. API 接口文档

### 7.1 认证

| 端点 | 方法 | 鉴权 | 请求体 | 返回 |
|------|------|------|--------|------|
| `/api/register` | POST | — | `{username, password}` | `{token, user:{id, username}}` |
| `/api/login` | POST | — | `{username, password}` | `{token, user:{id, username}}` |
| `/api/me` | GET | ✅ | — | `{id, username}` |
| `/api/change-password` | POST | ✅ | `{old_password, new_password}` | `{ok, message}` |

### 7.2 分类

| 端点 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/categories` | GET | — | 返回 `[{id, name, icon, post_count}]`，按 `sort_order` 升序 |
| `/api/categories` | POST | ✅ | body `{name, icon?}`，自动追加 `sort_order` |
| `/api/categories/{cid}` | PUT | ✅ | body `{name?, icon?, sort_order?}` |
| `/api/categories/{cid}` | DELETE | ✅ | 若分类下有 post 则返回 400 |

### 7.3 内容

| 端点 | 方法 | 鉴权 | Query / Body | 说明 |
|------|------|------|--------------|------|
| `/api/posts` | GET | — | `category_id?`, `search?`, `sort=latest\|popular`, `page≥1` | 分页（每页 20），返回 `{items, total, page, total_pages}` |
| `/api/posts/{id}` | GET | — | — | 详情，自动 +1 播放量（5 分钟/IP 防刷） |
| `/api/posts` | POST | ✅ | multipart: `title, description, category_id, file, cover?` | 上传，自动压缩与生成封面 |
| `/api/posts/{id}` | DELETE | ✅ | — | 删除数据库记录 + 磁盘文件 |

### 7.4 媒体

| 端点 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/media/audio/{filename}` | GET | — | 支持 Range，`Content-Type` 由 mimetypes 推断 |
| `/media/video/{filename}` | GET | ✅ | 同上，需登录 |
| `/media/covers/{filename}` | GET | — | 同上 |

### 7.5 静态与 SPA

| 端点 | 方法 | 说明 |
|------|------|------|
| `/static/*` | GET | StaticFiles 挂载，前端 JS/CSS/图标 |
| `/{full_path:path}` | GET | SPA 兜底，返回 `index.html` |

---

## 8. 项目运行方式

### 8.1 前置条件

- Python 3.10+
- ffmpeg（包含 ffprobe），并在系统 `PATH` 中可执行

### 8.2 安装

```bash
# 克隆
git clone https://github.com/SEYYi/murmur.git
cd murmur

# 创建虚拟环境（可选但推荐）
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 8.3 启动开发服务器

```bash
bash start.sh
# 等价于
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

启动脚本会：
1. `cd` 到脚本所在目录
2. 创建 `media/{audio,video,covers}` 目录
3. 启动 uvicorn，监听 `0.0.0.0:8000`，开启 `--reload`

访问 **http://localhost:8000**

### 8.4 默认账号

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

> 首次启动时由 `init_db()` 自动创建。

### 8.5 数据存储位置

| 路径 | 内容 |
|------|------|
| `data/asmr.db` | SQLite 数据库（首次启动自动生成） |
| `media/audio/` | 持久化音频文件 |
| `media/video/` | 持久化视频文件 |
| `media/covers/` | 封面与视频缩略图 |
| `uploads/` | 临时上传目录（文件处理后会被移走） |

### 8.6 重新生成 favicon（可选）

```bash
python3 scripts/gen-favicon.py
```

依赖 `Pillow`，会覆写 `frontend/` 下所有 `favicon*.{png,ico,svg}` 与 `apple-touch-icon.png`。

---

## 9. 部署说明

### 9.1 systemd（推荐）

```ini
[Unit]
Description=Murmur ASMR
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/murmur
Environment=ASMR_SECRET_KEY="***"
ExecStart=/usr/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 9.2 Docker

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

构建与运行：

```bash
docker build -t murmur .
docker run -d -p 8000:8000 -v $(pwd)/data:/app/data -v $(pwd)/media:/app/media --name murmur murmur
```

### 9.3 反向代理（生产建议）

推荐在前面加 Nginx/Caddy：
- 终结 TLS
- 直接托管 `/static/*` 与 `/media/*` 静态资源（绕过 uvicorn）
- 代理 `/api/*` 到 uvicorn
- 调大 `client_max_body_size` 以支持大文件上传

---

## 10. 安全注意事项

> 部署到公网前**务必**处理以下事项：

1. **修改默认管理员密码** — 登录后通过"设置"页修改。
2. **设置 `ASMR_SECRET_KEY` 环境变量** — 否则 JWT 使用硬编码默认密钥，可被伪造。
   ```bash
   export ASMR_SECRET_KEY="$(openssl rand -hex 32)"
   ```
3. **密码哈希算法较弱** — 当前 `sha256(salt+password)` 抗暴破能力有限，生产环境建议替换为 `passlib` 的 bcrypt/argon2。
4. **CORS 全开** — `allow_origins=["*"]` 适合开发，生产应收敛为前端实际域名。
5. **`/media/video/*` 鉴权仅校验登录态** — 任何登录用户都能访问任意视频文件名，若需细粒度权限需扩展。
6. **`_view_history` 为内存字典** — 多进程/多实例部署时防刷失效，需替换为 Redis 等。
7. **无速率限制** — 注册/登录/上传未做 rate-limit，建议在反向代理层加 `limit_req`。
8. **上传文件名安全** — 已使用 `uuid4().hex` 重命名，避免目录穿越；但扩展名白名单较宽（含 `.mkv` 等），按需收紧。

---

## 附录：核心数据流图

```
                  ┌─────────────────┐
                  │  浏览器 localStorage │
                  │  ───────────────  │
                  │  asmr_token       │ ← JWT
                  │  asmr_theme       │ ← 'dark'/'light'
                  │  asmr_accent      │ ← 'purple'/'blue'/'green'/'warm'
                  │  murmur_pp        │ ← 断点续播 {id:{ct,dur,updatedAt}}
                  │  murmur_queue     │ ← 播放队列 [{id,title,...}]
                  └────────┬──────────┘
                           │
                           │ fetch + Bearer
                           ▼
        ┌──────────────────────────────────────┐
        │      FastAPI  (backend/main.py)       │
        │  ┌────────────────────────────────┐  │
        │  │  /api/login   →  create_access_token
        │  │  /api/posts   →  compress_media  →  media/
        │  │  /api/posts/{id} → should_count_view → SQLite
        │  │  /media/*     →  stream_file (Range)
        │  └────────────────────────────────┘  │
        └──────┬───────────────────┬────────────┘
               │                   │
               ▼                   ▼
        ┌────────────┐      ┌──────────────┐
        │  SQLite    │      │  ffmpeg 子进程 │
        │  asmr.db   │      │  压缩/缩略图  │
        └────────────┘      └──────────────┘
```

---

*本文档基于 Murmur 仓库源码生成，覆盖架构、模块、关键 API、依赖与部署。如代码有更新，请同步修订本文。*
