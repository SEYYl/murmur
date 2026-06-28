# Murmur 🌙

> 一个优雅的 ASMR 音频与视频托管平台。自定义播放器，极简 SPA，自部署。
>
> A self-hosted ASMR audio & video platform with a custom-built player and clean SPA frontend.

---

## 预览

| 首页 | 音频播放 | 管理面板 |
|------|---------|---------|
| 分类+网格展示 | 自定义播放器 | 内容+分类管理 |

Murmur 是一个轻量级的 ASMR 媒体管理平台，后端 Python (FastAPI)，前端原生 JS，无需任何前端框架。

## 功能 ✨

- **🎵 音频播放** — 自定义 UI 播放器：进度条点击跳转、音量控制、倍速切换（1x~2x）、静音
- **🎬 视频播放** — 自定义控件覆盖层，3 秒自动隐藏，支持全屏、进度跳转
- **📤 上传** — 支持拖拽上传，自动 ffmpeg 压缩大文件，视频自动生成封面
- **🏷️ 分类管理** — 预设 8 个 ASMR 分类（耳语、触发音、角色扮演、白噪音、咀嚼音、冥想、纯音乐、综合），可增删改
- **🔐 认证** — JWT 登录/注册，视频内容仅登录用户可看
- **🔍 搜索与排序** — 按标题/描述搜索，按最新/热门排序，分页
- **🎨 主题** — 深色/浅色模式 + 4 种强调色（紫/蓝/绿/暖橙），跟随系统主题自动切换
- **📋 管理面板** — 内容列表管理 + 分类编辑，统计概览
- **🛡️ 播放量防刷** — 同一 IP 5 分钟内不重复计数

## 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Python 3, FastAPI, SQLAlchemy, SQLite |
| **前端** | Vanilla JS SPA, CSS Variables 主题系统 |
| **媒体** | ffmpeg（压缩/缩略图/转码） |
| **认证** | JWT (python-jose) |

## 快速开始

### 前置条件

- Python 3.10+
- ffmpeg（用于媒体压缩与封面生成）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/SEYYl/murmur.git
cd murmur

# 创建虚拟环境（可选）
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动
bash start.sh
```

访问 **http://localhost:8000**

### 默认账号

| 用户名 | 密码 |
|--------|------|
| admin | admin123 |

> **⚠️ 生产环境请务必修改密码，并设置环境变量：**
> ```bash
> export ASMR_SECRET_KEY="***"
> ```

## 项目结构

```
murmur/
├── backend/
│   ├── main.py        # FastAPI 主入口，API 路由
│   ├── models.py      # SQLAlchemy 数据模型
│   └── auth.py        # JWT 认证、密码哈希
├── frontend/
│   ├── index.html     # SPA 入口
│   ├── js/app.js      # 前端逻辑（~700 行）
│   └── css/style.css  # 主题系统 + 完整 UI 样式
├── media/             # 音频/视频/封面存储
│   ├── audio/
│   ├── video/
│   └── covers/
├── data/              # SQLite 数据库
├── uploads/           # 临时上传目录
├── start.sh           # 启动脚本
├── requirements.txt
└── README.md
```

## API 概览

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/register` | POST | 注册 | — |
| `/api/login` | POST | 登录 | — |
| `/api/me` | GET | 当前用户 | ✅ |
| `/api/change-password` | POST | 修改密码 | ✅ |
| `/api/categories` | GET | 分类列表 | — |
| `/api/categories` | POST | 创建分类 | ✅ |
| `/api/categories/:id` | PUT | 更新分类 | ✅ |
| `/api/categories/:id` | DELETE | 删除分类 | ✅ |
| `/api/posts` | GET | 内容列表（搜索/分页/排序） | — |
| `/api/posts/:id` | GET | 内容详情（+1 播放量） | — |
| `/api/posts` | POST | 上传内容 | ✅ |
| `/api/posts/:id` | DELETE | 删除内容 | ✅ |

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
Environment=ASMR_SECRET_KEY="***"
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

## LICENSE

MIT
