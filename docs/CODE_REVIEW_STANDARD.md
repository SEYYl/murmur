# Murmur 代码审查标准与流程

> 项目：Murmur — 自托管 ASMR 音视频平台  
> 技术栈：FastAPI (Python) + 原生 HTML/CSS/JS  
> 版本：v1.0 | 生效日期：2026-07-06

---

## 目录

1. [审查标准](#一审查标准)
2. [项目专属检查清单](#二项目专属检查清单)
3. [审查流程](#三审查流程)
4. [PR 模板](#四pr-模板)
5. [自动化工具链](#五自动化工具链)

---

## 一、审查标准

审查维度按 **严重程度** 分为三级，按 **关注领域** 分为四类。每条标准都附有项目真实代码示例。

### 分级定义

| 级别 | 标记 | 含义 | 合并影响 |
|------|------|------|----------|
| 🔴 Blocker | 必须修复 | 安全漏洞、数据丢失、崩溃风险 | **阻止合并** |
| 🟡 Suggestion | 应当修复 | 可维护性、性能、缺失验证 | **建议修复后合并**，可记录为后续 issue |
| 💭 Nit | 建议改进 | 命名、风格、文档 | 不阻止合并，作者自行决定 |

### 1.1 安全性（Security）

#### 🔴 S-01：密码存储必须使用慢哈希算法

**问题**：`auth.py:15` 使用 `hashlib.sha256` 进行密码哈希。SHA256 是快速哈希，GPU 每秒可计算数亿次，盐值无法弥补算法本身的速度缺陷。

```python
# ❌ 当前实现 — SHA256 快速哈希
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"

# ✅ 应使用 bcrypt 或 argon2
import bcrypt
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

**审查要点**：任何涉及密码存储/验证的改动，必须确认使用 `bcrypt`/`argon2`/`scrypt`。

---

#### 🔴 S-02：密钥不得硬编码或使用弱默认值

**问题**：`auth.py:8` 的 `SECRET_KEY` 有硬编码弱默认值 `"asmr-secret-key-change-me"`。如果部署时未设置环境变量，JWT 签名密钥就是公开已知的，攻击者可伪造任意用户的 token。

```python
# ❌ 当前实现
SECRET_KEY = os.getenv("ASMR_SECRET_KEY", "asmr-secret-key-change-me")

# ✅ 启动时强制校验
SECRET_KEY = os.getenv("ASMR_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("ASMR_SECRET_KEY 环境变量未设置，拒绝启动")
```

**审查要点**：所有 `os.getenv()` 调用，若用于安全敏感场景（密钥、密码、连接串），不得提供弱默认值。

---

#### 🔴 S-03：CORS 配置不得同时开放全域和凭证

**问题**：`main.py:311` 配置了 `allow_origins=["*"]` + `allow_credentials=True`。这违反浏览器安全规范——浏览器会忽略此组合下的凭证发送，但更危险的是某些非浏览器客户端不受此限制。

```python
# ❌ 当前实现
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, ...)

# ✅ 白名单模式
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:8000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, ...)
```

**审查要点**：CORS 配置变更必须审查 `allow_origins` 是否包含 `"*"`。

---

#### 🔴 S-04：用户输入必须经过 HTML 转义后才能插入 DOM

**问题**：前端大量使用 `innerHTML` 拼接模板字符串。虽然存在 `esc()` 转义函数，但并非所有用户可控数据都经过了转义。

```javascript
// esc() 函数定义 — 正确的转义方式
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ❌ 危险：用户输入直接拼入 innerHTML（XSS）
el.innerHTML = `<div class="title">${post.title}</div>`;

// ✅ 安全：用户输入经过 esc() 转义
el.innerHTML = `<div class="title">${esc(post.title)}</div>`;
```

**审查要点**：每处 `innerHTML =` 赋值，检查插入的变量是否来自用户输入（标题、描述、评论、用户名、标签名等），若是则必须包裹 `esc()`。**ICO 图标常量是可信的，无需转义。**

---

#### 🔴 S-05：文件上传必须校验文件类型，不得信任 Content-Type

**问题**：`main.py:675` 通过文件扩展名判断类型，未校验文件实际内容。攻击者可上传 `.mp3` 后缀的恶意脚本。

```python
# 当前实现 — 仅校验扩展名
ext = os.path.splitext(file.filename or "")[1].lower()
file_type = next((ft for ft, exts in ALLOWED_EXTS.items() if ext in exts), None)

# 建议 — 增加文件头魔数校验
MAGIC_BYTES = {
    'audio': {b'\xff\xfb', b'\xff\xf3', b'\xff\xf2', b'fLaC', b'OggS', b'ID3'},
    'video': {b'\x00\x00\x00', b'1A\x45\xdf\xa3'},  # MP4, MKV
}
file_head = content[:16]
# 校验文件头是否匹配声明的类型
```

**审查要点**：任何新增文件上传端点，必须验证扩展名 + 文件头魔数 + 大小限制。

---

#### 🔴 S-06：大文件上传不得全量读入内存

**问题**：`main.py:683` 执行 `content = await file.read()`，对最大 500MB 的文件直接全量读入内存。多用户并发上传时会导致 OOM。

```python
# ❌ 当前实现
content = await file.read()  # 500MB 全部进内存

# ✅ 分块写入磁盘
CHUNK = 1024 * 1024  # 1MB
with open(save_path, "wb") as f:
    total = 0
    while chunk := await file.read(CHUNK):
        total += len(chunk)
        if total > max_size_mb * 1024 * 1024:
            os.remove(save_path)
            raise HTTPException(413, "文件过大")
        f.write(chunk)
```

**审查要点**：任何 `await file.read()` 无 size 参数的调用，审查是否有可能接收大文件。

---

### 1.2 正确性（Correctness）

#### 🔴 C-01：API 返回值必须处理 null/undefined

**问题**：前端 `api()` 函数在错误时返回 `null`，但调用处并非都检查了 null。

```javascript
// ❌ 危险：未检查 api() 返回值
async function loadPost(id) {
    const data = await api(`/api/posts/${id}`);
    renderPost(data.post);  // data 为 null 时崩溃
}

// ✅ 安全：检查 null
async function loadPost(id) {
    const data = await api(`/api/posts/${id}`);
    if (!data) return;  // toast 已由 api() 弹出
    renderPost(data.post);
}
```

**审查要点**：所有 `await api(...)` 调用处，确认后续代码能安全处理 `null` 返回值。

---

#### 🔴 C-02：后端端点必须有权限校验依赖

**问题**：FastAPI 依赖注入是权限控制的核心。新增端点必须声明 `Depends(require_creator)` / `Depends(require_admin)` 等。

```python
# ❌ 缺失权限校验 — 任意用户可调用
@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: int, db: Session = Depends(get_db)):
    ...

# ✅ 声明权限依赖
@app.delete("/api/posts/{post_id}")
async def delete_post(post: Post, user: User = Depends(require_post_owner_or_admin)):
    ...
```

**审查要点**：每个新增 `@app.xxx` 路由，确认 `Depends()` 中是否包含合适的权限校验。公开端点（首页列表、登录注册）除外。

---

#### 🟡 C-03：数据库查询必须处理关联对象为 None 的情况

**问题**：`fmt_post` 中 `p.category` 和 `p.user` 可能为 None（`user_id` 可为空，`category_id` 可为空）。

```python
# ❌ 潜在崩溃
"category": {"id": p.category.id, "name": p.category.name, "icon": p.category.icon}

# ✅ 已正确处理（当前代码）
"category": {...} if p.category else None,
```

**审查要点**：任何 `p.xxx.yyy` 链式属性访问，确认 `p.xxx` 不会为 None。

---

### 1.3 可维护性（Maintainability）

#### 🟡 M-01：后端单文件不超过 500 行

**问题**：`main.py` 当前 **2292 行**，包含路由定义、业务逻辑、转码任务、存储辅助、设置缓存等职责，严重违反单一职责原则。

```python
# 建议拆分结构
backend/
  main.py          # FastAPI app 初始化 + 路由注册 (<100行)
  routers/
    posts.py       # 内容相关路由
    auth.py        # 认证路由
    admin.py       # 管理后台路由
    playlists.py   # 歌单路由
    comments.py    # 评论路由
    settings.py    # 系统设置路由
  services/
    transcode.py   # 转码任务
    settings.py    # 设置缓存
  models.py        # 数据模型 (保持现状)
  auth.py          # 认证逻辑 (保持现状)
  storage.py       # 存储抽象 (保持现状)
```

**审查要点**：新增功能时，若 `main.py` 超过 2500 行，必须拆分到对应 router 文件。新功能优先写入 router 而非 main.py。

---

#### 🟡 M-02：前端单文件不超过 2000 行

**问题**：`app.js` 当前 **4249 行**，包含路由、渲染、播放器、上传、管理后台等所有逻辑。

```javascript
// 建议拆分结构
frontend/js/
  app.js           # 入口 + 路由 + 全局状态 (<500行)
  ico.js           // ICO 图标常量 (~200行)
  api.js           // API 请求封装
  render.js        // 页面渲染函数
  player.js        // 播放器逻辑
  upload.js        // 上传/编辑表单
  admin.js         // 管理后台
  utils.js         // esc/dur/fs/debounce 等工具
```

**审查要点**：新增功能时，评估是否应放入独立模块文件而非继续追加到 app.js。

---

#### 🟡 M-03：CSS 变量使用前必须在 `:root` 中定义

**问题**：此前 `--rs` 变量被使用 27 次但从未定义，导致所有相关圆角失效。类似地 `--radius` 也缺失定义。

```css
/* ❌ 使用未定义变量 */
.card { border-radius: var(--rs); }

/* ✅ 先定义后使用 */
:root {
  --rs: 10px;          /* 标准圆角 */
  --radius: 10px;      /* 别名 */
}
.card { border-radius: var(--rs); }
```

**审查要点**：任何新增 `var(--xxx)`，确认 `--xxx` 已在 `:root` 中定义。可运行 `grep -oP 'var\(--[a-z0-9-]+' style.css | sort -u` 对比定义列表。

---

#### 🟡 M-04：重复代码超过 3 处必须提取为函数

**问题**：此前的 spinner SVG 在 4 处重复定义、内联 style 大量重复，均已通过提取 ICO 常量和 CSS class 解决。保持这一原则。

```javascript
// ❌ 重复
el1.innerHTML = '<div class="spinner">...20行SVG...</div>';
el2.innerHTML = '<div class="spinner">...20行SVG...</div>';

// ✅ 提取
el1.innerHTML = ICO.spinner;
```

**审查要点**：审查中发现相同代码块出现 3 次以上，标记为 Suggestion 要求提取。

---

#### 🟡 M-05：内联 style 仅用于 JS 动态计算的值

**原则**：静态样式走 CSS class，内联 `style=""` 仅保留以下场景：
- JS 动态计算的值（如 `display:none` 切换、`width: xx%` 进度条）
- 需要覆盖样式的极少数临时场景

```html
<!-- ❌ 静态样式内联 -->
<button style="margin-right:4px;display:flex;align-items:center;gap:6px">

<!-- ✅ 使用 CSS class -->
<button class="btn btn-primary">
```

**审查要点**：新增内联 style 中若仅含静态属性（margin/display/flex 等非动态值），标记为 Suggestion 要求提取为 CSS class。

---

### 1.4 性能（Performance）

#### 🟡 P-01：列表查询必须避免 N+1

**问题**：`fmt_post()` 对每条 post 执行 4 次独立查询（favorite_count、comment_count、subtitle_count、tags）。首页 20 条 post = 80+ 次查询。

```python
# ❌ 当前实现 — N+1 查询
def fmt_post(p, user=None, db=None):
    favorite_count = db.query(UserFavorite).filter(...).count()
    comment_count = db.query(Comment).filter(...).count()
    subtitle_count = db.query(Subtitle).filter(...).count()
    # 每条 post 3 次 count + 1 次 tags 查询

# ✅ 批量查询优化
def fmt_posts_batch(posts, user=None, db=None):
    post_ids = [p.id for p in posts]
    fav_counts = dict(db.query(UserFavorite.post_id, func.count())
                      .filter(UserFavorite.post_id.in_(post_ids))
                      .group_by(UserFavorite.post_id).all())
    # 类似处理 comment/subtitle counts...
```

**审查要点**：列表渲染函数中，确认没有对每个 item 单独发起数据库查询。可用 `in_()` 批量查询 + 字典映射。

---

#### 🟡 P-02：全局可变状态需考虑线程安全

**问题**：`_view_history`、`_settings_cache`、`_transcode_starts` 等全局字典在多线程环境下访问。`_transcode_starts` 已用 `_transcode_lock` 保护，但 `_view_history` 和 `_settings_cache` 未保护。

```python
# ❌ 无锁保护的全局字典
_view_history = {}
def should_count_view(post_id, ip):
    _view_history[(post_id, ip)] = time.time()  # 竞态条件

# ✅ 加锁或使用线程安全结构
import threading
_view_lock = threading.Lock()
_view_history = {}
def should_count_view(post_id, ip):
    with _view_lock:
        ...
```

**审查要点**：新增模块级 `dict`/`list` 可变对象，确认是否需要 `threading.Lock()` 保护。

---

#### 💭 P-03：前端事件监听需避免内存泄漏

**问题**：动态创建的 DOM 元素绑定事件后若被移除，需确保事件监听被清理。当前使用 `onclick` 内联属性不会泄漏，但若改用 `addEventListener` 需注意。

**审查要点**：新增 `addEventListener` 时，确认对应元素的生命周期，必要时在移除时调用 `removeEventListener`。

---

### 1.5 前端专属（Frontend）

#### 🟡 F-01：交互元素必须满足键盘可访问性

**标准**：`role="button"` 的元素必须支持 Enter/Space 键激活，`tabindex="0"` 的元素必须有 focus 样式。

```javascript
// ❌ role="button" 但无键盘事件
card.setAttribute('role', 'button');
card.setAttribute('tabindex', '0');
card.onclick = () => navigate('post', p.id);

// ✅ 全局委托式处理器已解决（当前代码已有）
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && target.getAttribute('role') === 'button') {
    e.preventDefault();
    target.click();
  }
});
```

**审查要点**：新增 `role="button"` 元素，确认全局 keydown 委托处理器能覆盖，或单独添加 keydown 监听。

---

#### 🟡 F-02：渲染方式必须与内容类型匹配

**问题**：`textContent` 无法渲染 HTML/SVG，`innerHTML` 可渲染但需注意 XSS。此前 emoji 替换为 SVG 时多处遗漏了此问题。

```javascript
// ❌ textContent 渲染 SVG — 不生效
btn.textContent = ICO.play;  // 显示原始 SVG 字符串文本

// ✅ innerHTML 渲染 SVG
btn.innerHTML = ICO.play;
```

**审查要点**：变量值包含 HTML 标签（如 `ICO.xxx`、模板字符串含 `<svg>`/`<span>`），必须使用 `innerHTML`。

---

#### 🟡 F-03：资源版本号必须同步更新

**问题**：CSS/JS 修改后若不更新 `?v=xx` 版本号，浏览器会使用 Service Worker 缓存的旧版本。

**三个文件必须同步更新**：
1. `index.html` → `style.css?v=XX` 和 `app.js?v=XX`
2. `sw.js` → `SW_CACHE = 'murmur-vXX'`

**审查要点**：任何修改 `style.css` 或 `app.js` 的 PR，确认版本号已递增。

---

## 二、项目专属检查清单

以下清单基于当前代码库的实际审查发现，按优先级排序。审查新 PR 时，优先检查这些问题是否在新代码中重现。

### 🔴 立即修复（技术债）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | 密码哈希使用 SHA256 | `auth.py:15` | 用户密码可被暴力破解 |
| 2 | SECRET_KEY 弱默认值 | `auth.py:8` | JWT 可被伪造 |
| 3 | CORS `*` + credentials | `main.py:311` | 跨域安全失效 |
| 4 | 文件上传全量读入内存 | `main.py:683` | 并发上传 OOM |
| 5 | 文件类型仅校验扩展名 | `main.py:675` | 可上传恶意文件 |

### 🟡 计划修复（架构债）

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 6 | main.py 2292 行上帝文件 | `backend/main.py` | 拆分为 routers/ |
| 7 | app.js 4249 行单体文件 | `frontend/js/app.js` | 按功能拆分模块 |
| 8 | fmt_post N+1 查询 | `main.py:103` | 批量查询优化 |
| 9 | 零单元测试 | 全项目 | 添加 pytest 测试 |
| 10 | 无 linter 配置 | 全项目 | 添加 ruff + eslint |
| 11 | 全局状态线程安全 | `main.py:91,260` | 加锁保护 |
| 12 | 无 .env 管理 | 全项目 | 添加 .env.example |

### 💭 持续改进

| # | 问题 | 建议 |
|---|------|------|
| 13 | 内联 style 清理 | 剩余 124 处逐步提取为 CSS class |
| 14 | API 错误码覆盖 | 前端 api() 增加 403/404/500 区分处理 |
| 15 | 类型注解 | 后端函数添加 Python type hints |
| 16 | API 文档 | FastAPI 自动文档补充 response schema |

---

## 三、审查流程

### 3.1 审查角色

| 角色 | 职责 | 资质要求 |
|------|------|----------|
| **提交者** | 编写代码、提交 PR、响应审查意见 | 任何开发者 |
| **审查者** | 审查代码质量、批准/拒绝合并 | 熟悉项目架构 |
| **安全审查者** | 专注安全相关改动 | 审查者中指定 1 人轮值 |

> 小团队场景：提交者 + 审查者可由 2 人覆盖。安全审查者在涉及认证/上传/权限改动时介入。

### 3.2 PR 工作流

```
开发者提交 PR
     │
     ▼
  自动检查 ──────失败──────→ 通知提交者修复
     │                          │
   通过                         │
     │ ◄────────────────────────┘
     ▼
  人工审查 ◄─────需要修改──────┐
     │                          │
   通过                         │
     │                          │
     ▼                          │
  合并到 main              提交者修改后重新请求审查
```

### 3.3 审查频次与时效

| 场景 | 时效要求 |
|------|----------|
| 紧急修复（线上 Bug） | 审查者在 **2 小时** 内响应 |
| 常规功能开发 | 审查者在 **1 个工作日** 内响应 |
| 大型重构（>500 行变更） | 审查者在 **2 个工作日** 内响应，可多人交叉审查 |

### 3.4 审查步骤（审查者操作指南）

**Step 1：全局浏览**
- 阅读 PR 描述，理解改动目的
- 浏览文件变更列表，评估改动范围

**Step 2：安全扫描**
- 搜索 `innerHTML`、`os.getenv`、`Depends(get_db)`（无权限依赖）
- 检查新增端点是否有权限校验
- 检查文件上传相关改动

**Step 3：逐文件审查**
- 按标准检查每个文件的改动
- 用 🔴/🟡/💭 标记问题
- 对好的代码给予肯定

**Step 4：运行验证**
- 确认 PR 通过自动检查（如有）
- 必要时本地拉取分支运行验证

**Step 5：提交审查意见**
- 汇总所有问题，按优先级排序
- 给出明确的 Approve / Request Changes / Comment 结论

### 3.5 合并规则

| PR 类型 | 审查者数量 | 额外要求 |
|---------|-----------|----------|
| 文档/注释修改 | 1 | — |
| 常规功能/Bug修复 | 1 | 自动检查通过 |
| 安全相关改动 | 2 | 其中 1 人为安全审查者 |
| 架构重构 | 2 | 附设计说明 |
| 紧急热修复 | 1 | 合并后补审查记录 |

### 3.6 审查意见书写规范

```markdown
🔴 **[安全] 密码使用 SHA256 哈希**
auth.py:15

**问题**：SHA256 是快速哈希，GPU 每秒可计算数亿次，盐值无法弥补速度缺陷。

**建议**：改用 bcrypt，`pip install bcrypt` 后替换实现。

**示例**：
```python
import bcrypt
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
```
```

**要点**：
- 指明文件和行号
- 解释 **为什么** 是问题（不是只说"有问题"）
- 提供 **可执行的** 修复建议
- 区分 **必须修复** 和 **建议改进**

---

## 四、PR 模板

提交 PR 时，提交者需填写以下模板（保存为 `.github/pull_request_template.md` 或项目内 `docs/PR_TEMPLATE.md`）：

```markdown
## 变更说明

<!-- 简述本次改了什么、为什么改 -->

## 变更类型

- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能
- [ ] ♻️ 重构
- [ ] 🎨 UI/样式
- [ ] 📚 文档
- [ ] 🔒 安全修复
- [ ] ⚡ 性能优化

## 自查清单

- [ ] 代码通过本地运行测试
- [ ] 新增 innerHTML 调用已用 esc() 转义用户输入
- [ ] 新增 API 端点已添加权限校验 Depends()
- [ ] 新增 CSS 变量已在 :root 中定义
- [ ] 修改了 style.css/app.js 时已更新版本号
- [ ] 无硬编码密钥/密码/连接串
- [ ] 无 console.log / print 调试残留

## 测试方式

<!-- 描述如何验证本次改动 -->

## 截图（如涉及 UI 改动）

<!-- 附上改动前后的截图 -->
```

---

## 五、自动化工具链

### 5.1 推荐工具配置

#### Python 后端 — Ruff（Linter + Formatter）

```toml
# pyproject.toml
[tool.ruff]
line-length = 120
target-version = "py311"

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "B",    # flake8-bugbear (常见 bug 模式)
    "S",    # flake8-bandit (安全)
    "UP",   # pyupgrade
]
ignore = ["E501"]  # 行长由 formatter 管

[tool.ruff.lint.per-file-ignores]
"scripts/*" = ["S"]
```

安装：`pip install ruff`  
运行：`ruff check backend/ && ruff format --check backend/`

#### 前端 — ESLint（如引入构建工具后）

当前为原生 JS 无构建步骤，暂以人工审查 + 以下 grep 脚本辅助：

```bash
# 检查未转义的 innerHTML（可能 XSS）
grep -n 'innerHTML.*${.*}' frontend/js/app.js | grep -v 'esc(' | grep -v 'ICO\.'

# 检查未定义的 CSS 变量
comm -23 \
  <(grep -oP 'var\(--[a-z0-9-]+' frontend/css/style.css | sort -u) \
  <(grep -oP '^\s*--[a-z0-9-]+\s*:' frontend/css/style.css | sed 's/://' | sort -u)

# 检查无权限依赖的端点
grep -n '@app\.\(get\|post\|put\|delete\)' backend/main.py | grep -v 'Depends'
```

### 5.2 Git Pre-commit Hook（可选）

```bash
# .git/hooks/pre-commit
#!/bin/bash
echo "Running pre-commit checks..."

# Python 语法检查
python -m py_compile backend/*.py || exit 1

# Ruff（如已安装）
if command -v ruff &> /dev/null; then
    ruff check backend/ || exit 1
fi

# CSS 变量定义检查
cd frontend/css && bash ../../scripts/check_css_vars.sh || exit 1

echo "✓ Pre-commit checks passed"
```

### 5.3 持续集成检查清单（CI/CD 接入后）

| 检查项 | 工具 | 阻断合并 |
|--------|------|----------|
| Python 语法 + Lint | ruff | ✅ |
| Python 单元测试 | pytest | ✅ |
| 安全扫描 | bandit / ruff S 规则 | ✅ |
| 前端 JS 语法 | node --check | ✅ |
| 前端 Lint | eslint（引入后） | ✅ |
| CSS 变量完整性 | 自定义脚本 | ⚠️ 警告 |
| 版本号同步检查 | 自定义脚本 | ⚠️ 警告 |

---

## 附录：审查速查卡

> 审查时快速参考，无需逐条阅读全文。

```
┌─────────────────────────────────────────────┐
│           🔴 必查项（阻止合并）               │
├─────────────────────────────────────────────┤
│ □ innerHTML 中用户输入是否 esc() 转义        │
│ □ 新增端点是否有 Depends 权限校验            │
│ □ 密码/密钥是否硬编码                        │
│ □ 文件上传是否校验类型 + 大小                │
│ □ api() 返回值是否处理 null                  │
│ □ CORS 配置是否安全                          │
├─────────────────────────────────────────────┤
│           🟡 应查项（建议修复）               │
├─────────────────────────────────────────────┤
│ □ CSS 变量是否已定义                         │
│ □ 列表查询是否有 N+1                         │
│ □ 重复代码是否超 3 处                        │
│ □ 内联 style 是否可提取为 class              │
│ □ role=button 是否有键盘支持                 │
│ □ 版本号是否已更新                           │
│ □ 全局可变状态是否线程安全                   │
├─────────────────────────────────────────────┤
│           💭 可查项（建议改进）               │
├─────────────────────────────────────────────┤
│ □ 命名是否清晰                               │
│ □ 是否有调试代码残留                         │
│ □ 文件是否过大需拆分                         │
│ □ 是否缺少必要注释                           │
└─────────────────────────────────────────────┘
```

---

*本标准随项目演进持续更新。每次更新需在团队内同步告知。*
