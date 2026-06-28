const API = '';
const TK = 'asmr_token';
const TT = 'asmr_theme';
const TA = 'asmr_accent';
const $ = id => document.getElementById(id);
const qs = (s, p) => (p || document).querySelector(s);

// ─── Theme ───
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initTheme() {
  const saved = localStorage.getItem(TT);
  const t = saved || getSystemTheme();
  const a = localStorage.getItem(TA) || 'purple';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-accent', a);
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (!localStorage.getItem(TT)) {
      applyTheme(e.matches ? 'light' : 'dark', false);
    }
  });
}

function applyTheme(t, animate = true) {
  if (animate) {
    document.documentElement.classList.add('theme-transitioning');
  }
  document.documentElement.setAttribute('data-theme', t);
  if (animate) {
    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 450);
  }
}

function setTheme(t) {
  localStorage.setItem(TT, t);
  applyTheme(t);
  updateUI();
}

function toggleTheme() {
  const cur = localStorage.getItem(TT) || getSystemTheme();
  // If using system default, clear it so we lock to the toggled value
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(TT, next);
  applyTheme(next);
  updateUI();
}

function setAccent(a) {
  localStorage.setItem(TA, a);
  document.documentElement.setAttribute('data-accent', a);
  updateUI();
}
initTheme();


function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function dur(s) { if(!s||s<=0) return ''; const m=Math.floor(s/60),s2=Math.floor(s%60); return `${m}:${String(s2).padStart(2,'0')}`; }
function fs(b) { if(!b) return ''; if(b<1024) return `${b}B`; if(b<1048576) return `${(b/1024).toFixed(0)}KB`; return `${(b/1048576).toFixed(1)}MB`; }
function dt(d) { if(!d) return ''; const t=new Date(d),n=new Date(),diff=n-t; if(diff<6e4) return '刚刚'; if(diff<36e5) return `${Math.floor(diff/6e4)}分钟前`; if(diff<864e5) return `${Math.floor(diff/36e5)}小时前`; return `${t.getMonth()+1}/${t.getDate()}`; }

let state = { view:'home', postId:null, cat:null, sort:'latest', search:'', page:1, user:null };

function toast(msg, t='info') {
  const el = document.createElement('div'); el.className = `toast ${t}`;
  el.innerHTML = msg; document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }, 3000);
}

function getToken() { return localStorage.getItem(TK); }

async function api(path, opts={}) {
  const h = { ...opts.headers }; const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) h['Content-Type'] = 'application/json';
  try {
    const r = await fetch(`${API}${path}`, { ...opts, headers: h });
    if (r.status === 401 && !['/api/login','/api/register','/api/me'].includes(path)) {
      localStorage.removeItem(TK); state.user = null; updateUI();
      toast('⛔ 登录已过期，请重新登录', 'error');
      if (state.view !== 'home') navigate('home'); showLogin(); return null;
    }
    return await r.json();
  } catch { toast('🌐 网络错误', 'error'); return null; }
}

// ─── Auth ───
function checkAuth() {
  const t = getToken();
  if (t) {
    api('/api/me').then(u => {
      if (u) { state.user = u; }
      else { localStorage.removeItem(TK); state.user = null; }
      updateUI();
    });
  } else {
    updateUI();
  }
}

function showLogin() {
  if (qs('.auth-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal';
  let mode = 'login';
  const render = () => {
    o.innerHTML = `<div class="auth-box">
      <h2>${mode==='login'?'👋 欢迎回来':'✨ 创建账号'}</h2>
      <p class="sub">${mode==='login'?'登录即可播放视频':'注册一个账号开始探索'}</p>
      <div class="input-group"><label>用户名</label><input id="au" placeholder="输入用户名"></div>
      <div class="input-group"><label>密码</label><input id="ap" type="password" placeholder="${mode==='login'?'输入密码':'至少4位'}" onkeydown="if(event.key==='Enter') document.querySelector('.auth-primary').click()"></div>
      <div class="auth-actions">
        <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
        <button class="btn btn-ghost" onclick="mode=mode==='login'?'register':'login';render()">${mode==='login'?'注册':'登录'}</button>
        <button class="btn btn-primary auth-primary" onclick="submitAuth('${mode}')">${mode==='login'?'登录':'注册'}</button>
      </div>
    </div>`;
  };
  render(); document.body.appendChild(o); setTimeout(() => $('au')?.focus(), 100);
}

async function submitAuth(mode) {
  const u = $('au')?.value.trim(), p = $('ap')?.value;
  if (!u||!p) { toast('请填写完整', 'error'); return; }
  if (mode==='register' && p.length<4) { toast('密码至少4位', 'error'); return; }
  const r = await api(`/api/${mode}`, { method:'POST', body: JSON.stringify({username:u,password:p}) });
  if (r?.token) {
    localStorage.setItem(TK, r.token); state.user = r.user; updateUI();
    qs('.auth-modal')?.remove();
    toast(`✅ ${mode==='login'?'登录成功':'注册成功'} 🎉`, 'success');
    if (state.view === 'post') renderPost();
  } else toast(r?.detail || '操作失败', 'error');
}

function resetTheme() {
  localStorage.removeItem(TT);
  applyTheme(getSystemTheme());
  updateUI();
  toast('已跟随系统主题', 'info');
}

function logout() {
  localStorage.removeItem(TK); state.user = null; updateUI();
  navigate('home'); toast('已退出', 'info');
}

function updateUI() {
  const nav = qs('header nav'); if (!nav) return;
  const saved = localStorage.getItem(TT);
  const effective = saved || getSystemTheme();
  if (state.user) {
    nav.innerHTML = `<span style="color:var(--text2);font-size:.85rem;font-weight:500">${esc(state.user.username)}</span>
      <button class="btn btn-ghost" onclick="navigate('upload')">📤 上传</button>
      <button class="btn btn-ghost" onclick="navigate('admin')">📋 管理</button>
      <button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}">${effective==='dark'?'☀️':'🌙'}</button>
      <button class="btn btn-icon btn-ghost" onclick="navigate('settings')" title="设置">⚙️</button>
      <button class="btn btn-ghost" onclick="logout()" style="color:var(--text3)">退出</button>`;
  } else {
    nav.innerHTML = `<button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}">${effective==='dark'?'☀️':'🌙'}</button>
      <button class="btn btn-primary" onclick="showLogin()" style="padding:6px 14px;font-size:.8rem">登录</button>`;
  }
}


// ─── Navigation ───
function navigate(view, data) {
  state.view = view||'home'; if (data!==undefined) state.postId = data;
  const c = $('content'); if (!c) return;
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  if (view==='upload') renderUpload(); else if (view==='post') renderPost(); else if (view==='settings') renderSettings(); else if (view==='admin') renderAdmin(); else renderHome();
  window.scrollTo({top:0,behavior:'smooth'});
}

// ─── Sidebar ───
async function loadCats() {
  const cats = await api('/api/categories')||[];
  const list = $('cat-list'); if(!list) return;
  let html = `<button class="cat-item ${!state.cat?'active':''}" data-cat="">🌐 全部 <span class="count">${cats.reduce((a,c)=>a+c.post_count,0)}</span></button>`;
  for(const c of cats)
    html += `<button class="cat-item ${state.cat===c.id?'active':''}" data-cat="${c.id}">${c.icon} ${esc(c.name)} <span class="count">${c.post_count}</span></button>`;
  list.innerHTML = html;
  list.querySelectorAll('.cat-item').forEach(b => b.addEventListener('click',()=>{
    state.cat = b.dataset.cat ? parseInt(b.dataset.cat) : null; state.page = 1;
    list.querySelectorAll('.cat-item').forEach(x => x.classList.toggle('active', x===b));
    navigate('home');
  }));
}

// ─── Home ───
async function renderHome() {
  const c = $('content'); let catName = '全部';
  if (state.cat) {
    const cats = await api('/api/categories')||[];
    const f = cats.find(x=>x.id===state.cat);
    if(f) catName = `${f.icon} ${f.name}`;
  }
  c.innerHTML = `<div class="page-header">
    <div><h1>${state.search ? `🔍 "${esc(state.search)}"` : `🎧 ${catName}`}</h1><div class="sub">${state.search?'':'发现最放松的声音'}</div></div>
  </div>
  <div class="search-bar">
    <input id="si" placeholder="搜索音频、视频..." value="${esc(state.search)}" onkeydown="if(event.key==='Enter'){state.search=this.value;state.page=1;navigate('home')}">
    <button onclick="state.search=$('si').value;state.page=1;navigate('home')">🔍</button>
  </div>
  <div class="sort-tabs">
    <button class="sort-tab ${state.sort==='latest'?'active':''}" onclick="state.sort='latest';state.page=1;navigate('home')">最新</button>
    <button class="sort-tab ${state.sort==='popular'?'active':''}" onclick="state.sort='popular';state.page=1;navigate('home')">最多播放</button>
  </div>
  <div id="posts"><div class="loading"><div class="spinner"></div></div></div>`;
  await loadPosts();
}

async function loadPosts() {
  const con = $('posts'); if(!con) return;
  let url = `/api/posts?page=${state.page}&sort=${state.sort}`;
  if(state.cat) url+=`&category_id=${state.cat}`;
  if(state.search) url+=`&search=${encodeURIComponent(state.search)}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon">🎧</div><p>还没有内容</p></div>'; return; }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of data.items) {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',p.id); };
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
      <div class="overlay"><div class="play">▶</div></div>
      <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
      ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
    </div><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="meta"><span>👁 ${p.views}</span></div>
      ${p.category?`<div class="tag">${p.category.icon} ${esc(p.category.name)}</div>`:''}
    </div>`;
    grid.appendChild(card);
  }
  con.innerHTML = ''; con.appendChild(grid);
  if(data.total_pages>1) {
    const pg = document.createElement('div'); pg.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:24px';
    if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="state.page=${data.page-1};loadPosts()">← 上一页</button>`;
    if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="state.page=${data.page+1};loadPosts()">下一页 →</button>`;
    con.appendChild(pg);
  }
}

// ─── Custom Audio Player ───
function atoggle(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  if (a.paused) a.play(); else a.pause();
}
function aupdateUI(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  const playing = !a.paused;
  const bigBtn = document.getElementById(`apb-${id}`);
  const smallBtn = document.getElementById(`aps-${id}`);
  const overlay = document.getElementById(`apo-${id}`);
  if (bigBtn) bigBtn.textContent = playing ? '⏸' : '▶';
  if (smallBtn) smallBtn.textContent = playing ? '⏸' : '▶';
  if (overlay) overlay.style.display = playing ? 'none' : 'flex';
  if (a.duration) {
    const pct = (a.currentTime / a.duration) * 100;
    const fill = document.getElementById(`apf-${id}`);
    if (fill) fill.style.width = `${pct}%`;
    const cur = document.getElementById(`acur-${id}`);
    if (cur) cur.textContent = dur(a.currentTime);
  }
}
function aseek(e, id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a || !a.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
}
function avolume(e, id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  a.volume = parseFloat(e.target.value);
}
function amute(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  a.muted = !a.muted;
  const btn = document.getElementById(`avb-${id}`);
  if (btn) btn.textContent = a.muted ? '🔇' : '🔊';
}
function aspeed(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const idx = speeds.indexOf(a.playbackRate);
  a.playbackRate = speeds[(idx + 1) % speeds.length];
  const el = document.getElementById(`aspd-${id}`);
  if (el) el.textContent = `${a.playbackRate}x`;
}

// ─── Custom Video Player ───
function vtoggle(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  if (v.paused) v.play(); else v.pause();
}
function vupdateUI(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  const playing = !v.paused;
  const centerBtn = document.getElementById(`vcp-${id}`);
  const smallBtn = document.getElementById(`vpb-${id}`);
  if (centerBtn) centerBtn.textContent = playing ? '⏸' : '▶';
  if (smallBtn) smallBtn.textContent = playing ? '⏸' : '▶';
  if (v.duration) {
    const pct = (v.currentTime / v.duration) * 100;
    const fill = document.getElementById(`vpf-${id}`);
    if (fill) fill.style.width = `${pct}%`;
    const cur = document.getElementById(`vcur-${id}`);
    const durEl = document.getElementById(`vdur-${id}`);
    if (cur) cur.textContent = dur(v.currentTime);
    if (durEl) durEl.textContent = dur(v.duration);
  }
  const overlay = document.getElementById(`vcp-${id}`);
  if (overlay) overlay.style.display = playing ? 'none' : 'flex';
}
function vseek(e, id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v || !v.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
}
function vvolume(e, id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  v.volume = parseFloat(e.target.value);
}
function vmute(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  v.muted = !v.muted;
  const btn = document.getElementById(`vvb-${id}`);
  if (btn) btn.textContent = v.muted ? '🔇' : '🔊';
}
function vfs(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else v.parentElement.requestFullscreen();
}
function vshow(id) {
  const overlay = document.getElementById(`vov-${id}`);
  if (!overlay) return;
  overlay.classList.add('visible');
  clearTimeout(overlay._hideTimer);
  overlay._hideTimer = setTimeout(() => {
    const v = document.getElementById(`vel-${id}`);
    if (v && !v.paused) overlay.classList.remove('visible');
  }, 3000);
}

// ─── Post Detail ───
async function renderPost() {
  const con = $('content'); con.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const p = await api(`/api/posts/${state.postId}`);
  if(!p) { con.innerHTML='<div class="empty"><p>找不到了</p><button class="btn btn-primary" onclick="navigate()">返回</button></div>'; return; }
  const isV = p.file_type==='video';
  if(isV && !state.user) {
    con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
      <div class="empty"><div class="icon">🔒</div><p style="font-size:1.1rem;margin-bottom:4px">观看视频需要登录</p>
      <p style="color:var(--text3);font-size:.85rem;margin-bottom:16px">登录后即可播放所有视频内容</p>
      <button class="btn btn-primary" onclick="showLogin()">去登录</button></div>`;
    return;
  }
  const pid = state.postId;
  const src = `${API}/${p.file_path}`, cover = p.cover_image?`${API}/${p.cover_image}`:'';
  const catText = p.category ? `${p.category.icon} ${esc(p.category.name)}` : '';

  let playerHTML = '';
  if (isV) {
    playerHTML = `<div class="video-player-wrap" id="vpw-${pid}" onmousemove="vshow('${pid}')" onclick="vtoggle('${pid}')">
      <video id="vel-${pid}" src="${esc(src)}" preload="metadata" poster="${esc(cover)}"></video>
      <div class="video-controls-overlay" id="vov-${pid}">
        <div class="video-center-play" id="vcp-${pid}" onclick="event.stopPropagation();vtoggle('${pid}')">▶</div>
        <div class="video-bottom-bar">
          <div class="video-progress-wrap" onclick="event.stopPropagation();vseek(event,'${pid}')">
            <div class="video-progress-fill" id="vpf-${pid}" style="width:0%">
              <div class="video-progress-thumb"></div>
            </div>
          </div>
          <div class="video-time-row">
            <span id="vcur-${pid}">0:00</span>
            <span id="vdur-${pid}">0:00</span>
          </div>
          <div class="video-btn-row">
            <button class="video-play-btn" id="vpb-${pid}" onclick="event.stopPropagation();vtoggle('${pid}')">▶</button>
            <div class="video-volume-wrap">
              <button class="video-btn" id="vvb-${pid}" onclick="event.stopPropagation();vmute('${pid}')">🔊</button>
              <input type="range" class="video-volume-slider" id="vvs-${pid}" min="0" max="1" step="0.05" value="1" oninput="event.stopPropagation();vvolume(event,'${pid}')">
            </div>
            <button class="video-btn video-fullscreen-btn" onclick="event.stopPropagation();vfs('${pid}')">⛶</button>
          </div>
        </div>
      </div>
    </div>`;
  } else {
    playerHTML = `<div class="audio-player-card">
      <div class="audio-visual" onclick="atoggle('${pid}')">
        <div class="audio-play-overlay" id="apo-${pid}">
          <button class="audio-play-btn-big" id="apb-${pid}">▶</button>
        </div>
        <div class="audio-info-overlay">
          <div class="audio-info-title">${esc(p.title)}</div>
          <div class="audio-info-sub">${catText} · ${dur(p.duration)}</div>
        </div>
      </div>
      <div class="audio-controls">
        <div class="audio-progress-wrap" onclick="aseek(event,'${pid}')">
          <div class="audio-progress-fill" id="apf-${pid}" style="width:0%">
            <div class="audio-progress-thumb"></div>
          </div>
        </div>
        <div class="audio-time-row">
          <span id="acur-${pid}">0:00</span>
          <span id="adur-${pid}">${dur(p.duration)}</span>
        </div>
        <div class="audio-btn-row">
          <button class="audio-play-btn-small" id="aps-${pid}" onclick="event.stopPropagation();atoggle('${pid}')">▶</button>
          <span id="aspd-${pid}" style="font-size:.75rem;color:var(--text3);cursor:pointer" onclick="aspeed('${pid}')">1x</span>
          <div class="audio-volume-wrap">
            <button class="audio-btn" id="avb-${pid}" onclick="amute('${pid}')">🔊</button>
            <input type="range" class="audio-volume-slider" id="avs-${pid}" min="0" max="1" step="0.05" value="1" oninput="avolume(event,'${pid}')">
          </div>
        </div>
      </div>
      <audio id="ael-${pid}" src="${esc(src)}" preload="metadata" style="display:none"></audio>
    </div>`;
  }

  let html = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="detail">${playerHTML}
      <div class="info">
        <h1>${esc(p.title)}</h1>
        <div class="meta">
          ${p.category?`<span>${p.category.icon} ${esc(p.category.name)}</span>`:''}
          <span>👁 ${p.views}</span>
          ${p.duration>0?`<span>⏱ ${dur(p.duration)}</span>`:''}
          ${p.file_size?`<span>📦 ${fs(p.file_size)}</span>`:''}
          <span>📅 ${dt(p.created_at)}</span>
        </div>
        ${p.description?`<div class="desc">${esc(p.description)}</div>`:''}
      </div>
    </div>`;
  con.innerHTML = html;

  // Bind audio/video events
  if (isV) {
    const v = document.getElementById(`vel-${pid}`);
    if (v) {
      v.addEventListener('timeupdate', () => vupdateUI(pid));
      v.addEventListener('loadedmetadata', () => vupdateUI(pid));
      v.addEventListener('play', () => vupdateUI(pid));
      v.addEventListener('pause', () => vupdateUI(pid));
      v.addEventListener('ended', () => vupdateUI(pid));
    }
    // Show controls briefly on load
    const vov = document.getElementById(`vov-${pid}`);
    if (vov) { vov.classList.add('visible'); setTimeout(() => { if (v && !v.paused) vov.classList.remove('visible'); }, 3000); }
  } else {
    const a = document.getElementById(`ael-${pid}`);
    if (a) {
      a.addEventListener('timeupdate', () => aupdateUI(pid));
      a.addEventListener('loadedmetadata', () => aupdateUI(pid));
      a.addEventListener('play', () => aupdateUI(pid));
      a.addEventListener('pause', () => aupdateUI(pid));
      a.addEventListener('ended', () => aupdateUI(pid));
      // Show play overlay initially
      const apo = document.getElementById(`apo-${pid}`);
      if (apo) apo.style.display = 'flex';
    }
  }
}

// ─── Upload ───
let _file = null, _cover = null, _selCat = null;

async function renderUpload() {
  if(!state.user) { showLogin(); return; }
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>📤 上传新内容</h1><div class="sub">支持音频和视频文件</div></div>
    <div class="upload-form">
      <div class="drop" id="drop"><div class="icon">📂</div><p>点击选择文件 或 拖拽到此处</p><div class="hint">支持 MP3, WAV, FLAC, OGG, AAC, MP4, WebM, MOV</div></div>
      <input type="file" id="fi" accept=".mp3,.wav,.flac,.ogg,.aac,.m4a,.mp4,.webm,.mov,.mkv" onchange="hf(event)">
      <div id="ds" style="display:none">
        <div class="form-group"><label>📝 标题</label><input id="title" placeholder="给你的 ASMR 取个名字..."></div>
        <div class="form-group"><label>📖 描述</label><textarea id="desc" placeholder="简单描述一下这个内容..."></textarea></div>
        <div class="form-group"><label>🏷️ 分类</label>
          <div class="cat-picker" id="cat-picker">${cats.map(c=>`<div class="cat-option" data-id="${c.id}" onclick="selectCat(${c.id})"><div class="cg-icon">${c.icon}</div>${esc(c.name)}</div>`).join('')}</div>
        </div>
        <div class="form-group"><label>🖼️ 封面（可选）</label><button class="btn btn-secondary" onclick="$('ci').click()">选择封面图片</button>
          <input type="file" id="ci" accept="image/*" onchange="hc(event)" style="display:none">
          <div id="cp" style="display:none;margin-top:10px"><img id="cpi" style="max-width:180px;border-radius:8px;border:1px solid var(--border)"></div></div>
        <div class="form-actions"><button class="btn btn-primary" onclick="submitUpload()">📤 上传</button></div>
      </div>
    </div>`;
  const drop = $('drop'); drop.onclick = () => $('fi').click();
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('active');if(e.dataTransfer.files.length){$('fi').files=e.dataTransfer.files;hf({target:{files:e.dataTransfer.files}})}});
}

function selectCat(id) {
  _selCat = id;
  document.querySelectorAll('.cat-option').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.id)===id));
}

function hf(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _file = f; _selCat = null;
  const isV = f.type.startsWith('video/');
  $('drop').innerHTML = `<div class="icon">${isV?'🎬':'🎵'}</div><div class="file-info"><strong>${esc(f.name)}</strong></div>
    <div class="hint">${isV?'视频':'音频'} · ${fs(f.size)}${isV?'':' · 可直接公开播放'}</div>`;
  $('ds').style.display = 'block';
  // Auto-select first category
  const firstCat = qs('.cat-option');
  if(firstCat) { _selCat = parseInt(firstCat.dataset.id); firstCat.classList.add('selected'); }
}

function hc(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _cover = f; const r = new FileReader();
  r.onload = e => { $('cp').style.display='block'; $('cpi').src=e.target.result; };
  r.readAsDataURL(f);
}

async function submitUpload() {
  const title = $('title')?.value.trim();
  if(!title) { toast('请输入标题', 'error'); return; }
  if(!_file) { toast('请选择文件', 'error'); return; }
  if(!_selCat) { toast('请选择分类', 'error'); return; }
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', ($('desc')?.value||'').trim());
  fd.append('category_id', _selCat);
  fd.append('file', _file);
  if(_cover) fd.append('cover', _cover);
  const btn = qs('.btn-primary'); if(btn){btn.disabled=true;btn.innerHTML='⏳ 上传中...'}
  const r = await api('/api/posts', { method:'POST', body:fd });
  if(btn){btn.disabled=false;btn.innerHTML='📤 上传'}
  if(r?.id) { toast('✅ 上传成功！', 'success'); navigate('post', r.id); }
  else toast(r?.detail||'上传失败', 'error');
}

// ─── Settings ───
function renderSettings() {
  if(!state.user) { showLogin(); return; }
  const savedTheme = localStorage.getItem(TT);
  $('content').innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>⚙️ 设置</h1></div>
    <div class="settings-card">
      <h2>👤 账号信息</h2>
      <div class="form-group"><label>用户名</label><input value="${esc(state.user.username)}" disabled style="opacity:.6"></div>
      <hr class="settings-divider">
      <h2>🔑 修改密码</h2>
      <div class="form-group"><label>原密码</label><input type="password" id="op" placeholder="输入当前密码"></div>
      <div class="form-group"><label>新密码</label><input type="password" id="np" placeholder="输入新密码（至少4位）"></div>
      <div class="form-group"><label>确认新密码</label><input type="password" id="cp2" placeholder="再次输入新密码"></div>
      <div class="form-actions" style="border:none;padding:0;margin-top:8px"><button class="btn btn-primary" onclick="changePw()">💾 保存修改</button></div>
      <hr class="settings-divider">
      <h2>🎨 主题设置</h2>
      <div class="form-group"><label>界面主题</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ${!savedTheme?'btn-primary':'btn-secondary'}" onclick="resetTheme()">🔄 跟随系统</button>
          <button class="btn ${savedTheme==='dark'?'btn-primary':'btn-secondary'}" onclick="setTheme('dark')">🌙 黑夜</button>
          <button class="btn ${savedTheme==='light'?'btn-primary':'btn-secondary'}" onclick="setTheme('light')">☀️ 白天</button>
        </div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:6px">当前：${!savedTheme ? '跟随系统 ('+getSystemTheme()+')' : savedTheme==='dark'?'黑夜':'白天'}</div>
      </div>
      <div class="form-group"><label>强调色</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ${(localStorage.getItem(TA)||'purple')==='purple'?'btn-primary':'btn-secondary'}" onclick="setAccent('purple')" style="border-left:4px solid #a78bfa">紫色</button>
          <button class="btn ${localStorage.getItem(TA)==='blue'?'btn-primary':'btn-secondary'}" onclick="setAccent('blue')" style="border-left:4px solid #3b82f6">蓝色</button>
          <button class="btn ${localStorage.getItem(TA)==='green'?'btn-primary':'btn-secondary'}" onclick="setAccent('green')" style="border-left:4px solid #10b981">绿色</button>
          <button class="btn ${localStorage.getItem(TA)==='warm'?'btn-primary':'btn-secondary'}" onclick="setAccent('warm')" style="border-left:4px solid #f97316">暖橙</button>
        </div>
      </div>
    </div>`;
}


async function changePw() {
  const op=$('op')?.value, np=$('np')?.value, cp=$('cp2')?.value;
  if(!op||!np||!cp){toast('请填写完整','error');return;}
  if(np!==cp){toast('两次新密码不一致','error');return;}
  if(np.length<4){toast('新密码至少4位','error');return;}
  const r = await api('/api/change-password',{method:'POST',body:JSON.stringify({old_password:op,new_password:np})});
  if(r?.ok){toast('✅ 密码修改成功','success');$('op').value='';$('np').value='';$('cp2').value='';}
  else toast(r?.detail||'修改失败','error');
}

// ─── Admin ───
let _adminCat = null;

async function renderAdmin() {
  if(!state.user){showLogin();return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>📋 内容管理</h1><div class="sub">管理所有上传的音频和视频</div></div>`;
  
  // Stats bar
  const cats = await api('/api/categories')||[];
  const stats = await api('/api/posts?page_size=1')||{};
  const total = stats.total||0;
  con.innerHTML += `<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:14px 20px;min-width:120px"><div style="font-size:1.5rem;font-weight:700">${total}</div><div style="font-size:.75rem;color:var(--text3)">全部内容</div></div>
    ${cats.map(c=>`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:14px 20px;min-width:100px"><div style="font-size:.9rem;font-weight:600">${c.icon} ${c.name}</div><div style="font-size:.75rem;color:var(--text3)">${c.post_count} 个</div></div>`).join('')}
  </div>`;
  
  // Category filter
  con.innerHTML += `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn ${!_adminCat?'btn-primary':'btn-secondary'}" onclick="_adminCat=null;renderAdmin()">🌐 全部</button>
    ${cats.map(c=>`<button class="btn ${_adminCat===c.id?'btn-primary':'btn-secondary'}" onclick="_adminCat=${c.id};renderAdmin()">${c.icon} ${c.name}</button>`).join('')}
  </div>`;
  
  // Content list
  con.innerHTML += `<div id="admin-list"><div class="loading"><div class="spinner"></div></div></div>`;
  
  // Load posts
  let url = `/api/posts?page_size=100&sort=latest`;
  if(_adminCat) url += `&category_id=${_adminCat}`;
  const data = await api(url);
  const list = $('admin-list');
  if(!data||!data.items||!data.items.length){
    list.innerHTML='<div class="empty"><div class="icon">📦</div><p>还没有内容</p></div>';
    return;
  }
  
  let html = '';
  for(const p of data.items){
    const isV = p.file_type==='video';
    html += `<div style="display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px 16px;margin-bottom:8px">
      <div style="font-size:1.5rem;opacity:.5;flex-shrink:0">${isV?'🎬':'🎵'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:2px">
          ${p.category?`${p.category.icon} ${esc(p.category.name)}`:'未分类'} · ${p.duration>0?dur(p.duration):'?'} · 👁${p.views} · ${dt(p.created_at)}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost" onclick="navigate('post',${p.id})">👁 查看</button>
        <button class="btn btn-ghost" style="color:#f87171" onclick="deleteItem(${p.id})">🗑 删除</button>
      </div>
    </div>`;
  }
  html += `<div style="text-align:center;margin-top:12px;font-size:.8rem;color:var(--text3)">共 ${data.total} 条内容</div>`;
  list.innerHTML = html;
  
  // ─── 分类管理区 ───
  con.innerHTML += `<hr style="border:none;border-top:1px solid var(--border);margin:32px 0">
    <div class="page-header" style="margin-bottom:16px"><h2>🏷️ 分类管理</h2></div>
    <div id="cat-mgr"><div class="loading"><div class="spinner"></div></div></div>`;
  
  // Load fresh cats
  const cats2 = await api('/api/categories')||[];
  let ch = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:16px">`;
  for(const c of cats2){
    ch += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px 16px;display:flex;align-items:center;gap:10px">
      <span style="font-size:1.3rem">${c.icon}</span>
      <span style="flex:1;font-size:.9rem;font-weight:500">${esc(c.name)}</span>
      <span style="font-size:.75rem;color:var(--text3)">${c.post_count}个</span>
      <button class="btn btn-ghost btn-icon" onclick="editCat(${c.id},'${esc(c.name)}','${c.icon}')" title="编辑">✏️</button>
      <button class="btn btn-ghost btn-icon" style="color:#f87171" onclick="deleteCat(${c.id})" title="删除" ${c.post_count>0?'disabled':''}>🗑</button>
    </div>`;
  }
  ch += `</div>`;
  
  // Add new category form
  ch += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:16px">
    <h3 style="font-size:.9rem;margin-bottom:12px">➕ 添加新分类</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input id="new-cat-icon" value="🎵" style="width:48px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px;color:var(--text);font-size:1.1rem;text-align:center">
      <input id="new-cat-name" placeholder="分类名称" style="flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem">
      <button class="btn btn-primary" onclick="addCat()">添加</button>
    </div>
  </div>`;
  $('cat-mgr').innerHTML = ch;
}

async function deleteItem(id) {
  if(!confirm('确定要删除这条内容吗？')) return;
  const r = await api(`/api/posts/${id}`,{method:'DELETE'});
  if(r?.ok){toast('✅ 已删除','success');renderAdmin();}
  else toast(r?.detail||'删除失败','error');
}

async function addCat() {
  const name = $('new-cat-name')?.value.trim();
  const icon = $('new-cat-icon')?.value.trim();
  if(!name){toast('请输入分类名称','error');return;}
  const r = await api('/api/categories',{method:'POST',body:JSON.stringify({name,icon})});
  if(r?.id){toast('✅ 分类已添加','success');renderAdmin();}
  else toast(r?.detail||'添加失败','error');
}

let _editCatId = null;
function editCat(id, name, icon) {
  _editCatId = id;
  $('new-cat-name').value = name;
  $('new-cat-icon').value = icon;
  // Change add button to save button
  const actions = document.querySelector('#cat-mgr .btn-primary');
  if(actions) {
    actions.textContent = '💾 保存';
    actions.onclick = saveCat;
  }
}

async function saveCat() {
  if(!_editCatId) return;
  const name = $('new-cat-name')?.value.trim();
  const icon = $('new-cat-icon')?.value.trim();
  if(!name){toast('请输入分类名称','error');return;}
  const r = await api(`/api/categories/${_editCatId}`,{method:'PUT',body:JSON.stringify({name,icon})});
  if(r?.id){toast('✅ 分类已更新','success');_editCatId=null;renderAdmin();}
  else toast(r?.detail||'更新失败','error');
}

async function deleteCat(id) {
  if(!confirm('确定删除这个分类吗？')) return;
  const r = await api(`/api/categories/${id}`,{method:'DELETE'});
  if(r?.ok){toast('✅ 分类已删除','success');renderAdmin();}
  else toast(r?.detail||'删除失败','error');
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => { checkAuth(); loadCats(); navigate('home'); });
