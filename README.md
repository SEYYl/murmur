# Murmur 🌙

> 一个优雅的自托管 ASMR 音频与视频平台。自定义播放器，极简 SPA，丰富的社区功能。
>
> A self-hosted ASMR audio & video platform with a custom-built player, clean SPA frontend, and rich community features.

---

## 预览

| 首页 | 音频播放 | 管理面板 |
|------|---------|---------|
| 分类+网格展示 + 精选推荐 | 自定义播放器 + 评论区 | 数据仪表盘 + 用户管理 |

Murmur 是一个轻量级的 ASMR 媒体管理平台，后端 Python (FastAPI)，前端原生 JS，无需任何前端框架。支持标签、歌单、评论、收藏、播放历史等丰富功能。

## 功能 ✨

### 🎵 核心播放
- **音频播放** — 自定义 UI 播放器：进度条点击跳转、音量控制、倍速切换（0.5x~2x）、静音、睡眠定时器
- **视频播放** — 自定义控件覆盖层，3 秒自动隐藏，支持全屏、进度跳转
- **播放队列** — 支持加入队列，连续播放
- **播放历史** — 自动记录播放进度，支持断点续播

### 📤 内容管理
- **上传** — 支持拖拽上传，自动 ffmpeg 压缩大文件，视频自动生成封面
- **编辑** — 创作者可编辑自己的内容（标题/描述/分类/标签/封面）
- **分类管理** — 预设 8 个 ASMR 分类（耳语、触发音、角色扮演、白噪音、咀嚼音、冥想、纯音乐、综合），可增删改
- **标签系统** — 多标签支持，标签搜索，按标签浏览，热门标签排序
- **精选推荐** — 管理员可加精/取消精，首页精选运营位

### 👥 用户与社区
- **用户角色** — 三级权限：普通用户 / 创作者 / 管理员
- **用户状态** — 支持封禁/解禁，封禁用户无法登录
- **收藏功能** — 一键收藏，收藏列表管理
- **评论系统** — 登录用户可发表评论，支持删除（本人/管理员）
- **播放列表** — 创建个人歌单，公开/私密，添加/移除歌曲
- **相关推荐** — 基于分类+标签共现算法，详情页底部推荐

### 📊 后台管理
- **数据仪表盘** — 用户数/内容数/播放量/收藏数趋势图，热门内容排行，分类分布
- **用户管理** — 用户列表，角色调整，状态管理，重置密码
- **系统设置** — 站点名称/描述/页脚，注册开关，上传大小限制，允许的文件格式
- **内容管理** — 全平台内容编辑/删除，加精/取消精

### 🔐 安全与体验
- **JWT 认证** — 登录/注册，视频内容仅登录用户可看
- **搜索与排序** — 按标题/描述搜索，按最新/热门排序，分页
- **主题系统** — 深色/浅色模式 + 4 种强调色（紫/蓝/绿/暖橙），跟随系统主题自动切换
- **播放量防刷** — 同一 IP 5 分钟内不重复计数
- **自动数据库迁移** — 版本升级自动迁移表结构，无需手动操作

## 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Python 3, FastAPI, SQLAlchemy, SQLite |
| **前端** | Vanilla JS SPA, CSS Variables 主题系统 |
| **媒体** | ffmpeg（压缩/缩略图/转码） |
| **认证** | JWT (python-jose) |
| **权限** | RBAC 三级角色（user / creator / admin） |

## 快速开始

### 前置条件

- Python 3.10+
- ffmpeg（用于媒体压缩与封面生成）

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

# 启动
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

访问 **http://localhost:8000**

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

> **⚠️ 生产环境请务必修改密码，并设置环境变量：**
> ```bash
> export ASMR_SECRET_KEY="your-secret-key-here"
> ```

## 项目结构

```
murmur/
├── backend/
│   ├── main.py        # FastAPI 主入口，API 路由
│   ├── models.py      # SQLAlchemy 数据模型 + 自动迁移
│   └── auth.py        # JWT 认证、密码哈希、权限依赖
├── frontend/
│   ├── index.html     # SPA 入口
│   ├── js/app.js      # 前端逻辑（~2200 行）
│   └── css/style.css  # 主题系统 + 完整 UI 样式
├── media/             # 音频/视频/封面存储
│   ├── audio/
│   ├── video/
│   └── covers/
├── data/              # SQLite 数据库
├── uploads/           # 临时上传目录
├── requirements.txt
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
| `/api/posts` | POST | 上传内容 | 创作者+ |
| `/api/posts/:id` | PUT | 编辑内容 | 创作者（本人）/管理员 |
| `/api/posts/:id` | DELETE | 删除内容 | 创作者（本人）/管理员 |
| `/api/posts/:id/favorite` | POST | 收藏/取消收藏 | ✅ |
| `/api/posts/:id/comments` | GET | 评论列表（分页） | — |
| `/api/posts/:id/comments` | POST | 发表评论 | ✅ |
| `/api/posts/:id/heartbeat` | POST | 播放进度上报 | ✅ |
| `/api/posts/:id/resume` | GET | 获取断点续播位置 | ✅ |

### 评论

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/comments/:id` | DELETE | 删除评论 | 本人/管理员 |

### 我的

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/me/favorites` | GET | 我的收藏列表 | ✅ |
| `/api/me/history` | GET | 我的播放历史 | ✅ |
| `/api/me/history/:id` | DELETE | 删除单条历史 | ✅ |
| `/api/me/history` | DELETE | 清空全部历史 | ✅ |

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
| `/api/admin/posts/:id/featured` | PUT | 设置/取消精选 | 管理员 |

## 部署

### 使用 systemd（推荐）

```ini
[Unit]
Description=Murmur ASMR
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/murmur
Environment=ASMR_SECRET_KEY="your-secret-key"
ExecStart=/usr/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 使用 Docker

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 版本历史

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
