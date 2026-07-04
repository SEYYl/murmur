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

let state = { view:'home', postId:null, cat:null, sort:'latest', search:'', page:1, user:null, params:{} };
let _deferredPrompt = null;

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
  const isStaff = state.user && (state.user.role === 'admin' || state.user.role === 'creator');
  const installBtn = `<button class="btn btn-ghost install-btn${_deferredPrompt?' visible':''}" id="install-btn" onclick="promptInstall()" title="安装应用">📲 安装</button>`;
  if (state.user) {
    nav.innerHTML = `<span style="color:var(--text2);font-size:.85rem;font-weight:500">${esc(state.user.username)}</span>
      <button class="btn btn-ghost" onclick="navigate('history')">🕒 历史</button>
      <button class="btn btn-ghost" onclick="navigate('favorites')">❤️ 收藏</button>
      ${isStaff ? `<button class="btn btn-ghost" onclick="navigate('upload')">📤 上传</button>` : ''}
      ${isStaff ? `<button class="btn btn-ghost" onclick="navigate('admin')">📋 管理</button>` : ''}
      ${installBtn}
      <button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}">${effective==='dark'?'☀️':'🌙'}</button>
      <button class="btn btn-icon btn-ghost" onclick="navigate('settings')" title="设置">⚙️</button>
      <button class="btn btn-ghost" onclick="logout()" style="color:var(--text3)">退出</button>`;
  } else {
    nav.innerHTML = `${installBtn}
      <button class="btn btn-icon btn-ghost" onclick="toggleTheme()" title="${effective==='dark'?'切换到白天':'切换到黑夜'}">${effective==='dark'?'☀️':'🌙'}</button>
      <button class="btn btn-primary" onclick="showLogin()" style="padding:6px 14px;font-size:.8rem">登录</button>`;
  }
}


// ─── Navigation ───
function navigate(view, data) {
  closeSidebar();
  state.view = view||'home';
  state.params = {};
  if (typeof data === 'object' && data !== null) {
    state.params = { ...data };
    if (data.postId !== undefined) state.postId = data.postId;
  } else if (data !== undefined) {
    state.postId = data;
  }
  const c = $('content'); if (!c) return;
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  if (view==='upload') renderUpload();
  else if (view==='edit') renderEdit();
  else if (view==='post') renderPost();
  else if (view==='settings') renderSettings();
  else if (view==='admin') renderAdmin();
  else if (view==='admin-dashboard') renderAdminDashboard();
  else if (view==='admin-users') renderAdminUsers();
  else if (view==='admin-settings') renderAdminSettings();
  else if (view==='favorites') renderFavorites();
  else if (view==='history') renderHistory();
  else if (view==='tag-posts') renderTagPosts();
  else if (view==='playlists') renderPlaylists();
  else if (view==='playlist-detail') renderPlaylistDetail();
  else renderHome();
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

  const sidebar = $('sidebar');
  if (sidebar && state.user) {
    let plSection = sidebar.querySelector('.playlist-section');
    if (!plSection) {
      plSection = document.createElement('div');
      plSection.className = 'sidebar-section playlist-section';
      sidebar.appendChild(plSection);
    }
    plSection.innerHTML = `<h3>🎵 我的歌单</h3>
      <div class="cat-list">
        <button class="cat-item" onclick="navigate('playlists')">📋 全部歌单</button>
      </div>`;
  }
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
  <div id="featured-section" style="display:none;margin-bottom:20px">
    <h2 style="font-size:1rem;margin-bottom:10px">✨ 编辑推荐</h2>
    <div id="featured-scroll" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px"><div class="loading"><div class="spinner"></div></div></div>
  </div>
  <div class="sort-tabs">
    <button class="sort-tab ${state.sort==='latest'?'active':''}" onclick="state.sort='latest';state.page=1;navigate('home')">最新</button>
    <button class="sort-tab ${state.sort==='popular'?'active':''}" onclick="state.sort='popular';state.page=1;navigate('home')">最多播放</button>
  </div>
  <div id="posts"><div class="loading"><div class="spinner"></div></div></div>`;
  if (!state.cat && !state.search) {
    loadFeatured();
  }
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
    const rp = getResumePos(p.id);
    const isFav = p.is_favorited || false;
    const favCount = p.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
      <div class="overlay"><div class="play">▶</div></div>
      <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
      ${p.featured?'<div class="badge" style="right:auto;left:8px;top:8px;background:var(--accent)">✨ 精选</div>':''}
      ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      ${rp?`<div class="resume-badge">▶ ${dur(rp.currentTime)}</div>`:''}
      <button class="fav-btn-card ${isFav?'active':''}" onclick="event.stopPropagation();toggleCardFavorite(this,${p.id})" title="收藏">
        ${isFav?'❤️':'🤍'}
      </button>
    </div><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="meta"><span>👁 ${p.views}</span><span>❤️ ${favCount}</span><span>💬 ${p.comment_count||0}</span></div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
        ${p.category?`<div class="tag">${p.category.icon} ${esc(p.category.name)}</div>`:''}
        ${(p.tags||[]).slice(0,3).map(t=>`<div class="tag" style="cursor:pointer" onclick="event.stopPropagation();navigate('tag-posts',{tagId:${t.id}})">#${esc(t.name)}</div>`).join('')}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${p.id},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})">＋</button>
      </div>
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
  const rssLink = document.createElement('div');
  rssLink.style.cssText = 'text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid var(--border)';
  rssLink.innerHTML = `<a href="${API}/api/rss.xml" target="_blank" style="display:inline-flex;align-items:center;gap:6px;color:var(--text3);text-decoration:none;font-size:.85rem;padding:8px 16px;border-radius:var(--rs);background:var(--bg2);border:1px solid var(--border);transition:all .2s" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text3)'">📡 RSS 订阅</a>`;
  con.appendChild(rssLink);
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
  localStorage.setItem('asmr_volume', a.volume);
}
function amute(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  a.muted = !a.muted;
  localStorage.setItem('asmr_muted', a.muted ? '1' : '0');
  const btn = document.getElementById(`avb-${id}`);
  if (btn) btn.textContent = a.muted ? '🔇' : '🔊';
}
function aspeed(id) {
  const a = document.getElementById(`ael-${id}`);
  if (!a) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const idx = speeds.indexOf(a.playbackRate);
  a.playbackRate = speeds[(idx + 1) % speeds.length];
  localStorage.setItem('asmr_speed', a.playbackRate);
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
  localStorage.setItem('asmr_volume', v.volume);
}
function vmute(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  v.muted = !v.muted;
  localStorage.setItem('asmr_muted', v.muted ? '1' : '0');
  const btn = document.getElementById(`vvb-${id}`);
  if (btn) btn.textContent = v.muted ? '🔇' : '🔊';
}
function vspeed(id) {
  const v = document.getElementById(`vel-${id}`);
  if (!v) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const idx = speeds.indexOf(v.playbackRate);
  v.playbackRate = speeds[(idx + 1) % speeds.length];
  localStorage.setItem('asmr_speed', v.playbackRate);
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
  const hasSubs = p.subtitle_count > 0;
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
            ${hasSubs ? `<button class="video-btn" id="vcc-${pid}" onclick="event.stopPropagation();toggleSubtitle('${pid}',true)" title="字幕">CC</button>` : ''}
            <span class="timer-indicator" style="display:none;font-size:.75rem;color:var(--accent);cursor:pointer;margin-right:2px" onclick="event.stopPropagation();showTimer('${pid}')">⏱ 0:00</span>
            <button class="video-btn" onclick="event.stopPropagation();showTimer('${pid}')">⏱</button>
            <button class="video-btn" id="vpm-${pid}" onclick="event.stopPropagation();cyclePlayMode('${pid}')" title="播放模式">🔁</button>
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
          ${hasSubs ? `<button class="audio-btn" id="acc-${pid}" onclick="toggleSubtitle('${pid}',false)" title="字幕">CC</button>` : ''}
          <span class="timer-indicator" style="display:none;font-size:.75rem;color:var(--accent);cursor:pointer" onclick="showTimer('${pid}')">⏱ 0:00</span>
          <button class="audio-btn" onclick="showTimer('${pid}')">⏱</button>
          <button class="audio-btn" id="apm-${pid}" onclick="cyclePlayMode('${pid}')" title="播放模式">🔁</button>
          <div class="audio-volume-wrap">
            <button class="audio-btn" id="avb-${pid}" onclick="amute('${pid}')">🔊</button>
            <input type="range" class="audio-volume-slider" id="avs-${pid}" min="0" max="1" step="0.05" value="1" oninput="avolume(event,'${pid}')">
          </div>
        </div>
      </div>
      <audio id="ael-${pid}" src="${esc(src)}" preload="metadata" style="display:none"></audio>
    </div>`;
  }

  let serverResume = null;
  if(state.user){
    const r = await api(`/api/posts/${pid}/resume`);
    if(r && r.position > 0 && r.duration > 0 && r.position / r.duration < 0.95){
      serverResume = { currentTime: r.position, duration: r.duration };
    }
  }
  const localResume = getResumePos(pid);
  const resume = serverResume || localResume;

  const isAdmin = state.user && state.user.role === 'admin';
  const isOwner = state.user && p.user && p.user.id === state.user.id;
  const canEdit = isAdmin || isOwner;
  const favCount = p.favorite_count || 0;
  const isFav = p.is_favorited || false;
  const commentCount = p.comment_count || 0;

  let html = `<button class="back" onclick="navigate()">← 返回</button>
    <div id="queue-bar" class="queue-bar"></div>
    <div class="detail">${playerHTML}
      <div class="info">
        <h1>${esc(p.title)} ${p.featured?'<span style="font-size:.8rem;background:var(--accent);color:#fff;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle">✨ 精选</span>':''}</h1>
        <div class="meta">
          ${p.category?`<span>${p.category.icon} ${esc(p.category.name)}</span>`:''}
          ${p.duration>0?`<span>⏱ ${dur(p.duration)}</span>`:''}
          ${p.file_size?`<span>📦 ${fs(p.file_size)}</span>`:''}
          <span>👁 ${p.views}</span>
          <span>❤️ ${favCount}</span>
          <span>💬 ${commentCount}</span>
          <span>📅 ${dt(p.created_at)}</span>
          ${p.updated_at && p.updated_at !== p.created_at ? `<span>✏️ ${dt(p.updated_at)} 更新</span>` : ''}
          ${p.user?`<span>👤 ${esc(p.user.username)}</span>`:''}
        </div>
        ${p.tags && p.tags.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${p.tags.map(t=>`<span class="tag" style="cursor:pointer" onclick="navigate('tag-posts',{tagId:${t.id}})">#${esc(t.name)}</span>`).join('')}
        </div>` : ''}
        ${p.description?`<div class="desc">${esc(p.description)}</div>`:''}
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn ${isFav?'btn-primary':'btn-secondary'}" id="fav-btn" onclick="toggleFavorite(${pid})">
            ${isFav?'❤️ 已收藏':'🤍 收藏'} <span id="fav-count">${favCount}</span>
          </button>
          <button class="btn btn-secondary" onclick="addToQueue({id:${pid},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})">➕ 加入队列</button>
          ${state.user?`<button class="btn btn-secondary" onclick="showAddToPlaylist(${pid})">🎵 加到歌单</button>`:''}
          ${isAdmin?`<button class="btn ${p.featured?'btn-primary':'btn-secondary'}" id="feat-btn" onclick="toggleFeatured(${pid},${p.featured})">
            ${p.featured?'⭐ 已精选':'☆ 加精'}
          </button>`:''}
          ${canEdit?`<button class="btn btn-secondary" onclick="navigate('edit',${pid})">✏️ 编辑</button>`:''}
          ${canEdit?`<button class="btn btn-secondary" style="color:#f87171" onclick="deletePost(${pid})">🗑 删除</button>`:''}
        </div>
      </div>
    </div>
    <div id="related-section" style="margin-top:24px;display:none">
      <h2 style="font-size:1rem;margin-bottom:12px">🔗 相关推荐</h2>
      <div id="related-scroll" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px"></div>
    </div>
    <div id="comments-section" style="margin-top:24px">
      <h2 style="font-size:1rem;margin-bottom:12px">💬 评论 <span style="color:var(--text3);font-weight:400;font-size:.85rem">(${commentCount})</span></h2>
      ${state.user ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:16px">
        <textarea id="comment-input" placeholder="写下你的评论..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:10px 12px;color:var(--text);font-size:.85rem;resize:vertical;min-height:80px;font-family:inherit"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-primary" onclick="submitComment(${pid})">发布评论</button>
        </div>
      </div>` : `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:16px;text-align:center;margin-bottom:16px">
        <p style="color:var(--text3);margin-bottom:8px">登录后可以发表评论</p>
        <button class="btn btn-primary" onclick="showLogin()">去登录</button>
      </div>`}
      <div id="comments-list"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  con.innerHTML = html;
  updateQueueBar();
  setupMediaSession(p, cover);

  // Bind audio/video events
  let heartbeatTimer = null;
  let lastHeartbeat = 0;
  function sendHeartbeat(pos, dur) {
    if(!state.user) return;
    const now = Date.now();
    if(now - lastHeartbeat < 3000) return;
    lastHeartbeat = now;
    api(`/api/posts/${pid}/heartbeat`, {
      method:'POST',
      body: JSON.stringify({position: pos, duration: dur})
    });
  }
  function startHeartbeat(getPos, getDur) {
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      const pos = getPos(), dur = getDur();
      if(pos && dur){
        sendHeartbeat(pos, dur);
      }
    }, 10000);
  }
  function stopHeartbeat() {
    if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function showResumeOverlay(startPlay) {
    if(!resume) return;
    const overlay = document.createElement('div');
    overlay.className = 'resume-overlay';
    overlay.innerHTML = `<div class="resume-box">
      <div class="resume-title">继续播放</div>
      <div class="resume-sub">上次看到 ${dur(resume.currentTime)}</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-secondary" id="resume-cancel">从头开始</button>
        <button class="btn btn-primary" id="resume-btn">▶ 继续播放</button>
      </div>
      <div class="resume-countdown" id="resume-cd">3 秒后自动播放...</div>
    </div>`;
    const playerWrap = isV ? $(`vpw-${pid}`) : qs('.audio-player-card');
    if(playerWrap){
      playerWrap.style.position = 'relative';
      playerWrap.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }
    let count = 3;
    const cdEl = $('resume-cd');
    const timer = setInterval(() => {
      count--;
      if(cdEl) cdEl.textContent = `${count} 秒后自动播放...`;
      if(count <= 0){
        clearInterval(timer);
        overlay.remove();
        startPlay();
      }
    }, 1000);
    $('resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(timer);
      overlay.remove();
      startPlay();
    });
    $('resume-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(timer);
      overlay.remove();
    });
  }

  if (isV) {
    const v = document.getElementById(`vel-${pid}`);
    if (v) {
      applySavedMediaSettings(v, pid, true);
      let resumed = false;
      v.addEventListener('timeupdate', () => {
        vupdateUI(pid);
        savePosition(pid, v.currentTime, v.duration);
      });
      v.addEventListener('loadedmetadata', () => {
        vupdateUI(pid);
        if (resume && v.duration && serverResume) {
          showResumeOverlay(() => {
            v.currentTime = Math.min(resume.currentTime, v.duration - 5);
            v.play();
          });
        } else if (resume && v.duration) {
          v.currentTime = Math.min(resume.currentTime, v.duration - 5);
        }
      });
      v.addEventListener('play', () => {
        vupdateUI(pid);
        startHeartbeat(()=>v.currentTime, ()=>v.duration);
        updateMediaSessionState(true);
      });
      v.addEventListener('pause', () => {
        vupdateUI(pid);
        stopHeartbeat();
        sendHeartbeat(v.currentTime, v.duration);
        updateMediaSessionState(false);
      });
      v.addEventListener('ended', () => {
        vupdateUI(pid);
        stopHeartbeat();
        clearPosition(pid);
        handlePlaybackEnded(pid, v);
      });
    }
    const vov = document.getElementById(`vov-${pid}`);
    if (vov) { vov.classList.add('visible'); setTimeout(() => { if (v && !v.paused) vov.classList.remove('visible'); }, 3000); }
    attachVideoGestures(pid);
  } else {
    const a = document.getElementById(`ael-${pid}`);
    if (a) {
      applySavedMediaSettings(a, pid, false);
      a.addEventListener('timeupdate', () => {
        aupdateUI(pid);
        savePosition(pid, a.currentTime, a.duration);
      });
      a.addEventListener('loadedmetadata', () => {
        aupdateUI(pid);
        if (resume && a.duration && serverResume) {
          showResumeOverlay(() => {
            a.currentTime = Math.min(resume.currentTime, a.duration - 5);
            a.play();
          });
        } else if (resume && a.duration) {
          a.currentTime = Math.min(resume.currentTime, a.duration - 5);
        }
      });
      a.addEventListener('play', () => {
        aupdateUI(pid);
        startHeartbeat(()=>a.currentTime, ()=>a.duration);
        updateMediaSessionState(true);
      });
      a.addEventListener('pause', () => {
        aupdateUI(pid);
        stopHeartbeat();
        sendHeartbeat(a.currentTime, a.duration);
        updateMediaSessionState(false);
      });
      a.addEventListener('ended', () => {
        aupdateUI(pid);
        stopHeartbeat();
        clearPosition(pid);
        handlePlaybackEnded(pid, a);
      });
      const apo = document.getElementById(`apo-${pid}`);
      if (apo) apo.style.display = 'flex';
    }
  }

  if (hasSubs) {
    loadAndSetupSubtitles(pid, isV);
  }
  loadRelated(pid);
  loadComments(pid);
}
async function loadAndSetupSubtitles(pid, isVideo) {
  const subs = await api(`/api/posts/${pid}/subtitles`) || [];
  if (!subs.length) return;
  const media = document.getElementById(isVideo ? `vel-${pid}` : `ael-${pid}`);
  if (!media) return;
  subs.forEach((s, i) => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = s.language || `字幕 ${i+1}`;
    track.srclang = s.language || 'zh';
    track.src = `${API}${s.file_path || s.url || ''}`;
    media.appendChild(track);
  });
  const ccBtn = document.getElementById(isVideo ? `vcc-${pid}` : `acc-${pid}`);
  if (ccBtn) {
    ccBtn.style.opacity = '0.5';
    ccBtn.dataset.on = '0';
  }
}
function toggleSubtitle(id, isV) {
  const m = document.getElementById(isV ? `vel-${id}` : `ael-${id}`);
  const btn = document.getElementById(isV ? `vcc-${id}` : `acc-${id}`);
  if (!m) return;
  const isOn = btn?.dataset.on === '1';
  const newState = !isOn;
  for (let i = 0; i < m.textTracks.length; i++) {
    m.textTracks[i].mode = newState ? 'showing' : 'hidden';
  }
  if (btn) {
    btn.dataset.on = newState ? '1' : '0';
    btn.style.opacity = newState ? '1' : '0.5';
    btn.style.color = newState ? 'var(--accent)' : '';
  }
}

// ─── Upload ───
let _file = null, _cover = null, _subtitle = null, _selCat = null, _tagSuggestions = [];

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
        <div class="form-group"><label>🏷️ 标签（逗号分隔）</label>
          <div style="position:relative">
            <input id="tags" placeholder="例如：助眠, 雨声, 放松" oninput="onTagInput(this)" onblur="setTimeout(()=>{const s=$('tag-suggest');if(s)s.style.display='none'},200)" autocomplete="off">
            <div id="tag-suggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);margin-top:4px;max-height:160px;overflow-y:auto;z-index:10"></div>
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:4px">多个标签用英文或中文逗号分隔</div>
        </div>
        <div class="form-group"><label>🖼️ 封面（可选）</label><button class="btn btn-secondary" onclick="$('ci').click()">选择封面图片</button>
          <input type="file" id="ci" accept="image/*" onchange="hc(event)" style="display:none">
          <div id="cp" style="display:none;margin-top:10px"><img id="cpi" style="max-width:180px;border-radius:8px;border:1px solid var(--border)"></div></div>
        <div class="form-group"><label>💬 字幕（可选，.srt/.vtt）</label><button class="btn btn-secondary" onclick="$('si').click()">选择字幕文件</button>
          <input type="file" id="si" accept=".srt,.vtt" onchange="hs(event)" style="display:none">
          <div id="sp" style="display:none;margin-top:10px;font-size:.85rem;color:var(--text3)"></div></div>
        <div id="upload-progress" style="display:none;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--text3);margin-bottom:4px">
            <span id="up-status">上传中...</span><span id="up-percent">0%</span>
          </div>
          <div style="background:var(--bg3);border-radius:4px;height:8px;overflow:hidden">
            <div id="up-bar" style="background:var(--accent);height:100%;width:0%;transition:width .2s"></div>
          </div>
        </div>
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
function hs(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _subtitle = f;
  const sp = $('sp'); if(sp){sp.style.display='block';sp.textContent=`📄 ${esc(f.name)} (${fs(f.size)})`;}
}

function submitUpload() {
  const title = $('title')?.value.trim();
  if(!title) { toast('请输入标题', 'error'); return; }
  if(!_file) { toast('请选择文件', 'error'); return; }
  if(!_selCat) { toast('请选择分类', 'error'); return; }
  const tagStr = ($('tags')?.value||'').trim();
  const tagList = tagStr ? tagStr.split(/[,，]/).map(t=>t.trim()).filter(t=>t) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', ($('desc')?.value||'').trim());
  fd.append('category_id', _selCat);
  if (tagList.length) fd.append('tags', JSON.stringify(tagList));
  fd.append('file', _file);
  if(_cover) fd.append('cover', _cover);
  const btn = qs('.btn-primary');
  const up = $('upload-progress');
  const upBar = $('up-bar');
  const upPercent = $('up-percent');
  const upStatus = $('up-status');
  if(btn){btn.disabled=true;btn.innerHTML='⏳ 上传中...'}
  if(up){up.style.display='block';}
  if(upBar) upBar.style.width='0%';
  if(upPercent) upPercent.textContent='0%';
  if(upStatus) upStatus.textContent='上传中...';
  let lastUpdate = 0;
  const maxRetries = 3;
  let retryCount = 0;
  function doUpload() {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/posts`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      if (now - lastUpdate < 200) return;
      lastUpdate = now;
      const pct = Math.round((e.loaded / e.total) * 100);
      if(upBar) upBar.style.width = `${pct}%`;
      if(upPercent) upPercent.textContent = `${pct}%`;
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem(TK); state.user = null; updateUI();
        toast('⛔ 登录已过期，请重新登录', 'error');
        if (state.view !== 'home') navigate('home'); showLogin();
        resetBtn(); return;
      }
      let r = null;
      try { r = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && r?.id) {
        resetBtn();
        toast('✅ 上传成功！', 'success');
        if (_subtitle) {
          uploadSubtitleAfterCreate(r.id);
        } else {
          navigate('post', r.id);
        }
      } else {
        handleError(r);
      }
    };
    xhr.onerror = () => handleError(null);
    xhr.send(fd);
  }
  function handleError(r) {
    if (retryCount < maxRetries) {
      retryCount++;
      if(upStatus) upStatus.textContent = `上传失败，重试中 (${retryCount}/${maxRetries})...`;
      setTimeout(doUpload, 1000);
    } else {
      resetBtn();
      toast(r?.detail || '上传失败', 'error');
    }
  }
  function resetBtn() {
    if(btn){btn.disabled=false;btn.innerHTML='📤 上传'}
    if(up){setTimeout(()=>{up.style.display='none';}, 1000);}
  }
  function uploadSubtitleAfterCreate(postId) {
    const sfd = new FormData();
    sfd.append('file', _subtitle);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/posts/${postId}/subtitles`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      navigate('post', postId);
    };
    xhr.onerror = () => { navigate('post', postId); };
    xhr.send(sfd);
  }
  doUpload();
}

let _editCover = null, _editSubtitle = null;

async function renderEdit() {
  if(!state.user){showLogin();return;}
  const pid = state.postId;
  const p = await api(`/api/posts/${pid}`);
  if(!p){navigate('home');return;}
  const isAdmin = state.user.role === 'admin';
  const isOwner = p.user && p.user.id === state.user.id;
  if(!isAdmin && !isOwner){navigate('home');toast('⛔ 无权限编辑','error');return;}
  _editCover = null;
  _editSubtitle = null;
  _selCat = p.category_id || null;
  const cats = await api('/api/categories')||[];
  const con = $('content');
  const cover = p.cover_image?`${API}/${p.cover_image}`:'';
  const isV = p.file_type === 'video';
  con.innerHTML = `<button class="back" onclick="navigate('post',${pid})">← 返回</button>
    <div class="page-header"><h1>✏️ 编辑内容</h1><div class="sub">修改内容的标题、描述、分类或封面</div></div>
    <div class="upload-form">
      <div id="ds">
        <div class="form-group"><label>📝 标题</label><input id="etitle" value="${esc(p.title)}" placeholder="给你的 ASMR 取个名字..."></div>
        <div class="form-group"><label>📖 描述</label><textarea id="edesc" placeholder="简单描述一下这个内容...">${esc(p.description||'')}</textarea></div>
        <div class="form-group"><label>🏷️ 分类</label>
          <div class="cat-picker" id="ecat-picker">${cats.map(c=>`<div class="cat-option ${_selCat===c.id?'selected':''}" data-id="${c.id}" onclick="selectEditCat(${c.id})"><div class="cg-icon">${c.icon}</div>${esc(c.name)}</div>`).join('')}</div>
        </div>
        <div class="form-group"><label>🏷️ 标签（逗号分隔）</label>
          <div style="position:relative">
            <input id="etags" value="${esc((p.tags||[]).map(t=>t.name).join(', '))}" placeholder="例如：助眠, 雨声, 放松" oninput="onTagInput(this,'etag-suggest')" onblur="setTimeout(()=>{const s=$('etag-suggest');if(s)s.style.display='none'},200)" autocomplete="off">
            <div id="etag-suggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);margin-top:4px;max-height:160px;overflow-y:auto;z-index:10"></div>
          </div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:4px">多个标签用英文或中文逗号分隔</div>
        </div>
        <div class="form-group"><label>🖼️ 封面（可选，不更换则留空）</label>
          ${cover?`<div style="margin-bottom:10px"><img id="e-cover-img" src="${cover}" style="max-width:180px;border-radius:8px;border:1px solid var(--border)"></div>`:''}
          <button class="btn btn-secondary" onclick="$('eci').click()">${cover?'更换封面':'选择封面图片'}</button>
          <input type="file" id="eci" accept="image/*" onchange="hec(event)" style="display:none">
          <div id="ecp" style="display:none;margin-top:10px"><img id="ecpi" style="max-width:180px;border-radius:8px;border:1px solid var(--border)"></div>
          ${isV?`<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="cover-time" type="number" min="0" step="0.1" placeholder="时间点（秒）" style="width:120px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:6px 10px;color:var(--text);font-size:.85rem">
            <button class="btn btn-secondary" onclick="genCoverFrame(${pid})">🎬 生成封面</button>
          </div>`:''}
        </div>
        <div class="form-group"><label>💬 字幕管理</label>
          <div id="sub-list"><div class="loading"><div class="spinner"></div></div></div>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="$('esi').click()">➕ 上传字幕</button>
            <input type="file" id="esi" accept=".srt,.vtt" onchange="hes(event)" style="display:none">
            <span id="esn" style="font-size:.8rem;color:var(--text3)"></span>
          </div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" onclick="submitEdit(${pid})">💾 保存修改</button></div>
      </div>
    </div>`;
  loadSubtitles(pid);
}

function selectEditCat(id) {
  _selCat = id;
  document.querySelectorAll('#ecat-picker .cat-option').forEach(el=>el.classList.toggle('selected',parseInt(el.dataset.id)===id));
}

function hec(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _editCover = f; const r = new FileReader();
  r.onload = e => { $('ecp').style.display='block'; $('ecpi').src=e.target.result; };
  r.readAsDataURL(f);
}
function hes(e) {
  const f = e.target.files?.[0]; if(!f) return;
  _editSubtitle = f;
  const esn = $('esn'); if(esn) esn.textContent = `📄 ${esc(f.name)} (${fs(f.size)})`;
  uploadEditSubtitle();
}
async function loadSubtitles(pid) {
  const list = $('sub-list'); if(!list) return;
  const subs = await api(`/api/posts/${pid}/subtitles`) || [];
  if(!subs.length){
    list.innerHTML = '<div style="font-size:.85rem;color:var(--text3)">暂无字幕</div>';
    return;
  }
  list.innerHTML = subs.map(s => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg3);border-radius:6px;margin-bottom:4px">
      <span style="font-size:.85rem">💬 ${esc(s.language || '字幕')} · ${esc(s.filename || '')}</span>
      <button class="btn btn-ghost btn-icon" style="margin-left:auto;color:#f87171" onclick="deleteSubtitle(${s.id},${pid})" title="删除">🗑</button>
    </div>
  `).join('');
}
async function uploadEditSubtitle() {
  if(!_editSubtitle || !state.postId) return;
  const pid = state.postId;
  const fd = new FormData();
  fd.append('file', _editSubtitle);
  const r = await api(`/api/posts/${pid}/subtitles`, { method:'POST', body:fd });
  if(r?.id || r?.ok) {
    toast('✅ 字幕上传成功', 'success');
    _editSubtitle = null;
    const esn = $('esn'); if(esn) esn.textContent = '';
    loadSubtitles(pid);
  } else {
    toast(r?.detail || '上传失败', 'error');
  }
}
async function deleteSubtitle(id, pid) {
  if(!confirm('确定删除这个字幕吗？')) return;
  const r = await api(`/api/subtitles/${id}`, { method:'DELETE' });
  if(r?.ok) {
    toast('✅ 已删除', 'success');
    loadSubtitles(pid);
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}
async function genCoverFrame(pid) {
  const t = parseFloat($('cover-time')?.value);
  if(isNaN(t) || t < 0) { toast('请输入有效的时间点（秒）', 'error'); return; }
  const btn = event?.target;
  if(btn){btn.disabled=true;btn.textContent='⏳ 生成中...'}
  const r = await api(`/api/posts/${pid}/cover-frame?time=${t}`, { method:'POST' });
  if(btn){btn.disabled=false;btn.textContent='🎬 生成封面'}
  if(r?.ok) {
    toast('✅ 封面已生成', 'success');
    const img = $('e-cover-img');
    if(img){
      const ts = Date.now();
      const src = img.src.split('?')[0];
      img.src = `${src}?t=${ts}`;
    }
  } else {
    toast(r?.detail || '生成失败', 'error');
  }
}

async function submitEdit(id) {
  const title = $('etitle')?.value.trim();
  if(!title) { toast('请输入标题', 'error'); return; }
  if(!_selCat) { toast('请选择分类', 'error'); return; }
  const tagStr = ($('etags')?.value||'').trim();
  const tagList = tagStr ? tagStr.split(/[,，]/).map(t=>t.trim()).filter(t=>t) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', ($('edesc')?.value||'').trim());
  fd.append('category_id', _selCat);
  if (tagList.length) fd.append('tags', JSON.stringify(tagList));
  if(_editCover) fd.append('cover', _editCover);
  const btn = qs('.btn-primary'); if(btn){btn.disabled=true;btn.innerHTML='⏳ 保存中...'}
  const r = await api(`/api/posts/${id}`, { method:'PUT', body:fd });
  if(btn){btn.disabled=false;btn.innerHTML='💾 保存修改'}
  if(r?.ok) { toast('✅ 保存成功！', 'success'); navigate('post', id); }
  else toast(r?.detail||'保存失败','error');
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
      <hr class="settings-divider">
      <h2>📦 数据导出</h2>
      <div class="form-group">
        <p style="font-size:.85rem;color:var(--text3);margin:0 0 8px">导出你的所有数据（收藏、历史、歌单等）为 ZIP 文件</p>
        <button class="btn btn-secondary" onclick="exportMyData()">📦 导出我的数据</button>
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

async function exportMyData() {
  const token = getToken();
  const r = await fetch(`${API}/api/me/export`, { headers: { Authorization: `Bearer ${token}` }});
  if (!r.ok) { toast('导出失败', 'error'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `murmur-export-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ 数据已导出', 'success');
}

let _favCat = null, _favSort = 'time', _favSearch = '', _favPage = 1;

async function renderFavorites() {
  if(!state.user){showLogin();return;}
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header">
      <div><h1>❤️ 我的收藏</h1><div class="sub">你收藏的所有内容</div></div>
    </div>
    <div class="search-bar">
      <input id="fav-si" placeholder="搜索收藏..." value="${esc(_favSearch)}" onkeydown="if(event.key==='Enter'){_favSearch=this.value;_favPage=1;renderFavorites()}">
      <button onclick="_favSearch=$('fav-si').value;_favPage=1;renderFavorites()">🔍</button>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn ${!_favCat?'btn-primary':'btn-secondary'}" onclick="_favCat=null;_favPage=1;renderFavorites()">🌐 全部</button>
        ${cats.map(c=>`<button class="btn ${_favCat===c.id?'btn-primary':'btn-secondary'}" onclick="_favCat=${c.id};_favPage=1;renderFavorites()">${c.icon} ${c.name}</button>`).join('')}
      </div>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn ${_favSort==='time'?'btn-primary':'btn-secondary'}" onclick="_favSort='time';_favPage=1;renderFavorites()">时间</button>
        <button class="btn ${_favSort==='latest'?'btn-primary':'btn-secondary'}" onclick="_favSort='latest';_favPage=1;renderFavorites()">最新</button>
        <button class="btn ${_favSort==='popular'?'btn-primary':'btn-secondary'}" onclick="_favSort='popular';_favPage=1;renderFavorites()">热门</button>
      </div>
    </div>
    <div id="fav-posts"><div class="loading"><div class="spinner"></div></div></div>`;
  await loadFavPosts();
}

async function loadFavPosts() {
  const con = $('fav-posts'); if(!con) return;
  let url = `/api/me/favorites?page=${_favPage}&sort=${_favSort}`;
  if(_favCat) url+=`&category_id=${_favCat}`;
  if(_favSearch) url+=`&search=${encodeURIComponent(_favSearch)}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon">❤️</div><p>还没有收藏内容</p></div>'; return; }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of data.items) {
    const post = p.post || p;
    const isV = post.file_type==='video', cv = post.cover_image?`${API}/${post.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',post.id); };
    const isFav = true;
    const favCount = post.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
      <div class="overlay"><div class="play">▶</div></div>
      <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
      ${post.duration>0?`<div class="dur">${dur(post.duration)}</div>`:''}
      <button class="fav-btn-card active" onclick="event.stopPropagation();toggleCardFavorite(this,${post.id})" title="取消收藏">❤️</button>
    </div><div class="info">
      <h3>${esc(post.title)}</h3>
      <div class="meta"><span>👁 ${post.views}</span><span>❤️ ${favCount}</span></div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
        ${post.category?`<div class="tag">${post.category.icon} ${esc(post.category.name)}</div>`:''}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${post.id},title:'${esc(post.title)}',file_type:'${post.file_type}',duration:${post.duration||0}})">＋</button>
      </div>
    </div>`;
    grid.appendChild(card);
  }
  con.innerHTML = ''; con.appendChild(grid);
  if(data.total_pages>1) {
    const pg = document.createElement('div'); pg.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:24px';
    if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_favPage=${data.page-1};loadFavPosts()">← 上一页</button>`;
    if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_favPage=${data.page+1};loadFavPosts()">下一页 →</button>`;
    con.appendChild(pg);
  }
}

let _histCat = null, _histPage = 1;

async function renderHistory() {
  if(!state.user){showLogin();return;}
  const cats = await api('/api/categories')||[];
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header">
      <div><h1>🕒 播放历史</h1><div class="sub">你看过的所有内容</div></div>
      <button class="btn btn-secondary" style="color:#f87171" onclick="clearAllHistory()">🗑 清空全部</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${!_histCat?'btn-primary':'btn-secondary'}" onclick="_histCat=null;_histPage=1;renderHistory()">🌐 全部</button>
      ${cats.map(c=>`<button class="btn ${_histCat===c.id?'btn-primary':'btn-secondary'}" onclick="_histCat=${c.id};_histPage=1;renderHistory()">${c.icon} ${c.name}</button>`).join('')}
    </div>
    <div id="hist-list"><div class="loading"><div class="spinner"></div></div></div>`;
  await loadHistory();
}

async function loadHistory() {
  const con = $('hist-list'); if(!con) return;
  let url = `/api/me/history?page=${_histPage}`;
  if(_histCat) url+=`&category_id=${_histCat}`;
  const data = await api(url);
  if(!data||!data.items||!data.items.length) {
    con.innerHTML = '<div class="empty"><div class="icon">🕒</div><p>还没有播放历史</p></div>'; return;
  }
  let html = '<div style="display:flex;flex-direction:column;gap:8px">';
  for(const h of data.items) {
    const post = h.post || h;
    const isV = post.file_type==='video';
    const cv = post.cover_image?`${API}/${post.cover_image}`:'';
    const pos = h.position || 0;
    const dur2 = h.duration || post.duration || 0;
    const pct = dur2 > 0 ? Math.min(100, (pos/dur2)*100) : 0;
    html += `<div style="display:flex;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;cursor:pointer" onclick="playFromHistory(${post.id})">
      <div style="width:160px;height:90px;border-radius:8px;overflow:hidden;background:var(--bg3);flex-shrink:0;position:relative">
        ${cv?`<img src="${cv}" style="width:100%;height:100%;object-fit:cover">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:.3">${isV?'🎬':'🎵'}</div>`}
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(0,0,0,.3)">
          <div style="height:100%;background:var(--accent);width:${pct}%"></div>
        </div>
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="font-weight:600;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(post.title)}</div>
          <div style="font-size:.8rem;color:var(--text3);margin-top:2px">
            ${post.category?`${post.category.icon} ${esc(post.category.name)} · `:''}${dur(pos)} / ${dur(dur2)}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:.75rem;color:var(--text3)">${dt(h.played_at)}</div>
          <button class="btn btn-ghost btn-icon" style="color:#f87171" onclick="event.stopPropagation();deleteHistoryItem(${h.id})" title="删除">🗑</button>
        </div>
      </div>
    </div>`;
  }
  html += '</div>';
  if(data.total_pages>1) {
    html += `<div style="display:flex;justify-content:center;gap:8px;margin-top:24px">`;
    if(data.page>1) html += `<button class="btn btn-secondary" onclick="_histPage=${data.page-1};loadHistory()">← 上一页</button>`;
    if(data.page<data.total_pages) html += `<button class="btn btn-secondary" onclick="_histPage=${data.page+1};loadHistory()">下一页 →</button>`;
    html += '</div>';
  }
  con.innerHTML = html;
}

async function playFromHistory(id) {
  navigate('post', id);
}

async function deleteHistoryItem(id) {
  if(!confirm('确定删除这条历史记录吗？')) return;
  const r = await api(`/api/me/history/${id}`,{method:'DELETE'});
  if(r?.ok){toast('✅ 已删除','success');loadHistory();}
  else toast(r?.detail||'删除失败','error');
}

async function clearAllHistory() {
  if(!confirm('确定清空所有播放历史吗？此操作不可撤销。')) return;
  const r = await api('/api/me/history',{method:'DELETE'});
  if(r?.ok){toast('✅ 已清空历史','success');renderHistory();}
  else toast(r?.detail||'操作失败','error');
}

// ─── Admin ───
let _adminCat = null;

function adminTabs(active) {
  if(!state.user || state.user.role !== 'admin') return '';
  return `<div class="admin-tabs" style="display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border);overflow-x:auto">
    <button class="admin-tab ${active==='dashboard'?'active':''}" onclick="navigate('admin-dashboard')" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid ${active==='dashboard'?'var(--accent)':'transparent'};color:${active==='dashboard'?'var(--accent)':'var(--text3)'};cursor:pointer;font-size:.9rem;white-space:nowrap">📊 数据看板</button>
    <button class="admin-tab ${active==='content'?'active':''}" onclick="navigate('admin')" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid ${active==='content'?'var(--accent)':'transparent'};color:${active==='content'?'var(--accent)':'var(--text3)'};cursor:pointer;font-size:.9rem;white-space:nowrap">📦 内容管理</button>
    <button class="admin-tab ${active==='users'?'active':''}" onclick="navigate('admin-users')" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid ${active==='users'?'var(--accent)':'transparent'};color:${active==='users'?'var(--accent)':'var(--text3)'};cursor:pointer;font-size:.9rem;white-space:nowrap">👥 用户管理</button>
    <button class="admin-tab ${active==='settings'?'active':''}" onclick="navigate('admin-settings')" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid ${active==='settings'?'var(--accent)':'transparent'};color:${active==='settings'?'var(--accent)':'var(--text3)'};cursor:pointer;font-size:.9rem;white-space:nowrap">⚙️ 系统设置</button>
  </div>`;
}

async function renderAdmin() {
  if(!state.user){showLogin();return;}
  const isAdmin = state.user.role === 'admin';
  const isCreator = state.user.role === 'creator';
  if(!isAdmin && !isCreator){navigate('home');toast('⛔ 无权限访问','error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>📋 内容管理</h1><div class="sub">${isAdmin?'管理所有上传的音频和视频':'管理我上传的内容'}</div></div>
    ${adminTabs('content')}`;

  const cats = await api('/api/categories')||[];

  if(isAdmin){
    const stats = await api('/api/posts?page_size=1')||{};
    const total = stats.total||0;
    con.innerHTML += `<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:14px 20px;min-width:120px"><div style="font-size:1.5rem;font-weight:700">${total}</div><div style="font-size:.75rem;color:var(--text3)">全部内容</div></div>
      ${cats.map(c=>`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:14px 20px;min-width:100px"><div style="font-size:.9rem;font-weight:600">${c.icon} ${c.name}</div><div style="font-size:.75rem;color:var(--text3)">${c.post_count} 个</div></div>`).join('')}
    </div>`;
  }

  con.innerHTML += `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn ${!_adminCat?'btn-primary':'btn-secondary'}" onclick="_adminCat=null;renderAdmin()">🌐 全部</button>
    ${cats.map(c=>`<button class="btn ${_adminCat===c.id?'btn-primary':'btn-secondary'}" onclick="_adminCat=${c.id};renderAdmin()">${c.icon} ${c.name}</button>`).join('')}
  </div>`;

  con.innerHTML += `<div id="admin-list"><div class="loading"><div class="spinner"></div></div></div>`;
  
  let url = `/api/posts?page_size=100&sort=latest`;
  if(_adminCat) url += `&category_id=${_adminCat}`;
  const data = await api(url);
  const list = $('admin-list');
  if(!data||!data.items||!data.items.length){
    list.innerHTML='<div class="empty"><div class="icon">📦</div><p>还没有内容</p></div>';
  } else {
    let items = data.items;
    if(isCreator){
      items = items.filter(p => p.user && p.user.id === state.user.id);
    }
    if(!items.length){
      list.innerHTML='<div class="empty"><div class="icon">📦</div><p>还没有内容</p></div>';
    } else {
      let html = '';
      for(const p of items){
        const isV = p.file_type==='video';
        const canEdit = isAdmin || (p.user && p.user.id === state.user.id);
        html += `<div style="display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px 16px;margin-bottom:8px">
          <div style="font-size:1.5rem;opacity:.5;flex-shrink:0">${isV?'🎬':'🎵'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</div>
            <div style="font-size:.75rem;color:var(--text3);margin-top:2px">
              ${p.category?`${p.category.icon} ${esc(p.category.name)}`:'未分类'} · ${p.duration>0?dur(p.duration):'?'} · 👁${p.views} · ${dt(p.created_at)}
              ${p.user?` · 👤 ${esc(p.user.username)}`:''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${isAdmin?`<button class="btn btn-ghost btn-icon" onclick="toggleAdminFeatured(${p.id},${p.featured})" title="${p.featured?'取消精选':'设为精选'}">${p.featured?'⭐':'☆'}</button>`:''}
            <button class="btn btn-ghost" onclick="navigate('post',${p.id})">👁 查看</button>
            ${canEdit?`<button class="btn btn-ghost" onclick="navigate('edit',${p.id})">✏️ 编辑</button>`:''}
            ${canEdit?`<button class="btn btn-ghost" style="color:#f87171" onclick="deleteItem(${p.id})">🗑 删除</button>`:''}
          </div>
        </div>`;
      }
      html += `<div style="text-align:center;margin-top:12px;font-size:.8rem;color:var(--text3)">共 ${items.length} 条内容</div>`;
      list.innerHTML = html;
    }
  }
  
  if(isAdmin){
    con.innerHTML += `<hr style="border:none;border-top:1px solid var(--border);margin:32px 0">
      <div class="page-header" style="margin-bottom:16px"><h2>🏷️ 分类管理</h2></div>
      <div id="cat-mgr"><div class="loading"><div class="spinner"></div></div></div>`;
    
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
}

async function deleteItem(id) {
  if(!confirm('确定要删除这条内容吗？')) return;
  const r = await api(`/api/posts/${id}`,{method:'DELETE'});
  if(r?.ok){toast('✅ 已删除','success');renderAdmin();}
  else toast(r?.detail||'删除失败','error');
}

async function deletePost(id) {
  if(!confirm('确定要删除这条内容吗？')) return;
  const r = await api(`/api/posts/${id}`,{method:'DELETE'});
  if(r?.ok){toast('✅ 已删除','success');navigate('home');}
  else toast(r?.detail||'删除失败','error');
}

async function toggleFavorite(id) {
  if(!state.user){showLogin();return;}
  const btn = $('fav-btn');
  const countEl = $('fav-count');
  const wasFav = btn?.classList.contains('btn-primary');
  const newCount = wasFav ? (parseInt(countEl?.textContent||0)-1) : (parseInt(countEl?.textContent||0)+1);
  if(btn){
    btn.classList.toggle('btn-primary', !wasFav);
    btn.classList.toggle('btn-secondary', wasFav);
    btn.innerHTML = `${!wasFav?'❤️ 已收藏':'🤍 收藏'} <span id="fav-count">${Math.max(0,newCount)}</span>`;
  }
  const r = await api(`/api/posts/${id}/favorite`,{method:'POST'});
  if(r?.favorited !== undefined){
    if(btn){
      btn.classList.toggle('btn-primary', r.favorited);
      btn.classList.toggle('btn-secondary', !r.favorited);
      btn.innerHTML = `${r.favorited?'❤️ 已收藏':'🤍 收藏'} <span id="fav-count">${r.count||0}</span>`;
    }
  }
}

async function toggleCardFavorite(btn, id) {
  if(!state.user){showLogin();return;}
  const wasFav = btn.classList.contains('active');
  btn.classList.toggle('active', !wasFav);
  btn.textContent = !wasFav ? '❤️' : '🤍';
  const meta = btn.closest('.card')?.querySelector('.meta span:last-child');
  if(meta){
    const cur = parseInt(meta.textContent.replace(/[^0-9]/g,''))||0;
    meta.textContent = `❤️ ${Math.max(0, wasFav?cur-1:cur+1)}`;
  }
  const r = await api(`/api/posts/${id}/favorite`,{method:'POST'});
  if(r?.favorited !== undefined){
    btn.classList.toggle('active', r.favorited);
    btn.textContent = r.favorited ? '❤️' : '🤍';
    if(meta){
      meta.textContent = `❤️ ${r.count||0}`;
    }
  }
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

// ─── Admin Dashboard (PRD-006) ───
let _dashRange = '7d';
let _dashMetric = 'new_posts';
let _dashDays = 30;

async function renderAdminDashboard() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast('⛔ 无权限','error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>📊 数据看板</h1><div class="sub">站点运营数据总览</div></div>
    ${adminTabs('dashboard')}
    <div id="dash-kpi"><div class="loading"><div class="spinner"></div></div></div>
    <div style="margin:24px 0 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <h2 style="font-size:1rem">📈 趋势</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="dash-metric" onchange="_dashMetric=this.value;loadDashChart()" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:6px 10px;color:var(--text);font-size:.85rem">
          <option value="new_posts">新增内容</option>
          <option value="new_users">新增用户</option>
          <option value="dau">DAU</option>
        </select>
        <select id="dash-days" onchange="_dashDays=parseInt(this.value);loadDashChart()" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:6px 10px;color:var(--text);font-size:.85rem">
          <option value="7">7天</option>
          <option value="30" selected>30天</option>
          <option value="90">90天</option>
        </select>
      </div>
    </div>
    <div id="dash-chart" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:16px;min-height:200px"><div class="loading"><div class="spinner"></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">
      <div>
        <h2 style="font-size:1rem;margin-bottom:12px">🏆 热门内容 Top10</h2>
        <div id="dash-top"><div class="loading"><div class="spinner"></div></div></div>
      </div>
      <div>
        <h2 style="font-size:1rem;margin-bottom:12px">🗂 分类分布</h2>
        <div id="dash-cat"><div class="loading"><div class="spinner"></div></div></div>
      </div>
    </div>`;
  loadDashKpi();
  loadDashChart();
  loadDashTop();
  loadDashCat();
}

async function loadDashKpi() {
  const data = await api(`/api/admin/stats?range=${_dashRange}`)||{};
  const cards = [
    {label:'DAU',value:data.dau||0,icon:'👥'},
    {label:'新增用户',value:data.new_users||0,icon:'🆕'},
    {label:'新增内容',value:data.new_posts||0,icon:'📦'},
    {label:'总用户',value:data.total_users||0,icon:'👤'},
    {label:'总内容',value:data.total_posts||0,icon:'📚'},
    {label:'总播放',value:data.total_views||0,icon:'▶️'},
  ];
  $('dash-kpi').innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">${cards.map(c=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:16px">
      <div style="font-size:.7rem;color:var(--text3)">${c.icon} ${c.label}</div>
      <div style="font-size:1.6rem;font-weight:700;margin-top:4px">${c.value}</div>
    </div>`).join('')}</div>`;
}

async function loadDashChart() {
  const m = $('dash-metric'); if(m) m.value = _dashMetric;
  const d = $('dash-days'); if(d) d.value = String(_dashDays);
  const el = $('dash-chart');
  const data = await api(`/api/admin/stats/timeseries?metric=${_dashMetric}&days=${_dashDays}`)||{};
  const series = data.series||[];
  if(!series.length){el.innerHTML='<div class="empty"><p>暂无数据</p></div>';return;}
  const max = Math.max(1, ...series.map(s=>s.value));
  const w = 100, h = 120;
  const points = series.map((s,i)=>`${(i/(series.length-1||1))*w},${h-(s.value/max)*h}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:160px;display:block">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="0.8"/>
  </svg>
  <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text3);margin-top:6px">
    <span>${series[0].date}</span>
    <span>${series[series.length-1].date}</span>
  </div>
  <div style="font-size:.75rem;color:var(--text3);margin-top:8px;text-align:center">峰值 ${max} · 合计 ${series.reduce((a,s)=>a+s.value,0)}</div>`;
}

async function loadDashTop() {
  const data = await api('/api/admin/stats/top-posts?metric=views&limit=10')||{};
  const items = data.items||[];
  const el = $('dash-top');
  if(!items.length){el.innerHTML='<div class="empty"><p>暂无内容</p></div>';return;}
  el.innerHTML = items.map((p,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);margin-bottom:6px">
      <span style="font-weight:700;color:${i<3?'var(--accent)':'var(--text3)'};width:22px">${i+1}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</div>
        <div style="font-size:.7rem;color:var(--text3)">${p.category?p.category.icon+' '+esc(p.category.name):''} · 👁${p.views} · ❤️${p.favorite_count}</div>
      </div>
    </div>`).join('');
}

async function loadDashCat() {
  const data = await api('/api/admin/stats/category-distribution')||{};
  const items = data.items||[];
  const el = $('dash-cat');
  if(!items.length){el.innerHTML='<div class="empty"><p>暂无分类</p></div>';return;}
  const total = Math.max(1, items.reduce((a,c)=>a+c.post_count,0));
  el.innerHTML = items.map(c=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:3px">
        <span>${c.icon} ${esc(c.name)}</span>
        <span style="color:var(--text3)">${c.post_count} · 👁${c.view_sum}</span>
      </div>
      <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden"><div style="background:var(--accent);height:100%;width:${(c.post_count/total)*100}%"></div></div>
    </div>`).join('');
}

// ─── Admin Users (PRD-005) ───
let _userPage = 1;
let _userFilter = {search:'',role:'',status:''};

async function renderAdminUsers() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast('⛔ 无权限','error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>👥 用户管理</h1><div class="sub">管理用户角色与状态</div></div>
    ${adminTabs('users')}
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input id="user-search" placeholder="🔍 搜索用户名" value="${esc(_userFilter.search)}" onkeyup="if(event.key==='Enter'){_userFilter.search=this.value;_userPage=1;loadUserList()}" style="flex:1;min-width:160px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem">
      <select id="user-role" onchange="_userFilter.role=this.value;_userPage=1;loadUserList()" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:8px 10px;color:var(--text);font-size:.85rem">
        <option value="">全部角色</option>
        <option value="admin">管理员</option>
        <option value="creator">创作者</option>
        <option value="user">普通用户</option>
      </select>
      <select id="user-status" onchange="_userFilter.status=this.value;_userPage=1;loadUserList()" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:8px 10px;color:var(--text);font-size:.85rem">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="banned">封禁</option>
      </select>
    </div>
    <div id="user-list"><div class="loading"><div class="spinner"></div></div></div>`;
  if(_userFilter.role) $('user-role').value = _userFilter.role;
  if(_userFilter.status) $('user-status').value = _userFilter.status;
  loadUserList();
}

async function loadUserList() {
  const params = new URLSearchParams({page:_userPage});
  if(_userFilter.search) params.set('search', _userFilter.search);
  if(_userFilter.role) params.set('role', _userFilter.role);
  if(_userFilter.status) params.set('status', _userFilter.status);
  const data = await api(`/api/admin/users?${params}`)||{};
  const el = $('user-list');
  const users = data.items||[];
  if(!users.length){el.innerHTML='<div class="empty"><div class="icon">👤</div><p>没有用户</p></div>';return;}
  el.innerHTML = users.map(u=>`
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px 16px;margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${u.role==='admin'?'👑':u.role==='creator'?'🎨':'👤'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.9rem">${esc(u.username)} ${u.id===state.user.id?'<span style="font-size:.7rem;color:var(--text3)">（你）</span>':''}</div>
        <div style="font-size:.7rem;color:var(--text3);margin-top:2px">
          <span style="color:${u.role==='admin'?'#f59e0b':u.role==='creator'?'#10b981':'var(--text3)'}">${u.role==='admin'?'管理员':u.role==='creator'?'创作者':'普通用户'}</span>
          · ${u.status==='banned'?'<span style="color:#ef4444">封禁</span>':'正常'}
          · ${u.post_count} 个内容
          · ${u.last_login_at?dt(u.last_login_at)+'登录':'未登录'}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <select onchange="changeUserRole(${u.id},this.value)" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:6px 8px;color:var(--text);font-size:.75rem" ${u.id===state.user.id?'disabled':''}>
          <option value="user" ${u.role==='user'?'selected':''}>普通</option>
          <option value="creator" ${u.role==='creator'?'selected':''}>创作者</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
        </select>
        <button class="btn btn-ghost btn-icon" onclick="toggleUserStatus(${u.id},'${u.status}')" title="${u.status==='banned'?'解封':'封禁'}" ${u.id===state.user.id?'disabled':''}>${u.status==='banned'?'🔓':'🚫'}</button>
        <button class="btn btn-ghost btn-icon" onclick="resetUserPwd(${u.id})" title="重置密码">🔑</button>
      </div>
    </div>`).join('') + `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.8rem;color:var(--text3)">
      <button class="btn btn-secondary" onclick="_userPage--;loadUserList()" ${_userPage<=1?'disabled':''}>上一页</button>
      <span>第 ${data.page} / ${data.total_pages} 页 · 共 ${data.total} 用户</span>
      <button class="btn btn-secondary" onclick="_userPage++;loadUserList()" ${_userPage>=data.total_pages?'disabled':''}>下一页</button>
    </div>`;
}

async function changeUserRole(uid, role) {
  const r = await api(`/api/admin/users/${uid}/role`,{method:'PUT',body:JSON.stringify({role})});
  if(r?.ok){toast(`✅ 角色已更新为 ${role}`,'success');loadUserList();}
  else toast(r?.detail||'更新失败','error');
}

async function toggleUserStatus(uid, cur) {
  const next = cur==='banned'?'active':'banned';
  if(!confirm(`确定${next==='banned'?'封禁':'解封'}该用户吗？`)) return;
  const r = await api(`/api/admin/users/${uid}/status`,{method:'PUT',body:JSON.stringify({status:next})});
  if(r?.ok){toast(`✅ 已${next==='banned'?'封禁':'解封'}`,'success');loadUserList();}
  else toast(r?.detail||'操作失败','error');
}

async function resetUserPwd(uid) {
  if(!confirm('确定重置该用户密码吗？将生成新密码并返回。')) return;
  const r = await api(`/api/admin/users/${uid}/reset-password`,{method:'POST'});
  if(r?.ok){prompt('新密码（请复制并告知用户）：', r.new_password);}
  else toast(r?.detail||'重置失败','error');
}

// ─── Admin Settings (PRD-007) ───
async function renderAdminSettings() {
  if(!state.user || state.user.role !== 'admin'){navigate('home');toast('⛔ 无权限','error');return;}
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header"><h1>⚙️ 系统设置</h1><div class="sub">站点配置（修改后即时生效）</div></div>
    ${adminTabs('settings')}
    <div id="settings-form"><div class="loading"><div class="spinner"></div></div></div>`;
  const s = await api('/api/admin/settings')||{};
  $('settings-form').innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:20px;margin-bottom:16px">
      <h2 style="font-size:.95rem;margin-bottom:14px">🌐 站点信息</h2>
      <label style="display:block;margin-bottom:12px"><span style="font-size:.8rem;color:var(--text3)">站点名称</span>
        <input id="set-site_name" value="${esc(s.site_name||'')}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem;margin-top:4px"></label>
      <label style="display:block;margin-bottom:12px"><span style="font-size:.8rem;color:var(--text3)">站点描述</span>
        <input id="set-site_description" value="${esc(s.site_description||'')}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem;margin-top:4px"></label>
      <label style="display:block"><span style="font-size:.8rem;color:var(--text3)">页脚文字</span>
        <input id="set-footer_text" value="${esc(s.footer_text||'')}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem;margin-top:4px"></label>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:20px;margin-bottom:16px">
      <h2 style="font-size:.95rem;margin-bottom:14px">🔒 注册与权限</h2>
      <label style="display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer">
        <input type="checkbox" id="set-registration_enabled" ${s.registration_enabled==='true'?'checked':''} style="width:18px;height:18px">
        <span style="font-size:.85rem">允许新用户注册</span>
      </label>
      <label style="display:block;margin-bottom:12px"><span style="font-size:.8rem;color:var(--text3)">新用户默认角色</span>
        <select id="set-default_user_role" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem;margin-top:4px">
          <option value="user" ${s.default_user_role==='user'?'selected':''}>普通用户（只能浏览播放）</option>
          <option value="creator" ${s.default_user_role==='creator'?'selected':''}>创作者（可上传内容）</option>
        </select></label>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:20px;margin-bottom:16px">
      <h2 style="font-size:.95rem;margin-bottom:14px">📦 上传限制</h2>
      <label style="display:block;margin-bottom:12px"><span style="font-size:.8rem;color:var(--text3)">单文件最大上传（MB）</span>
        <input id="set-max_upload_size_mb" type="number" min="1" max="10240" value="${esc(s.max_upload_size_mb||'500')}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:.85rem;margin-top:4px"></label>
      <div style="background:var(--bg3);border-radius:var(--rs);padding:10px 12px;font-size:.75rem;color:var(--text3)">
        <div>视频格式: ${esc(s.allowed_video_exts||'')}</div>
        <div>音频格式: ${esc(s.allowed_audio_exts||'')}</div>
      </div>
    </div>
    ${s._secret_key_is_default==='true'?'<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:var(--rs);padding:12px 16px;margin-bottom:16px;font-size:.8rem;color:#92400e">⚠️ 安全提示：当前使用默认 SECRET_KEY，请通过环境变量 <code>MURMUR_SECRET_KEY</code> 修改后再部署到生产环境</div>':''}
    <button class="btn btn-primary" onclick="saveSettings()" style="width:100%">💾 保存设置</button>`;
}

async function saveSettings() {
  const data = {
    site_name: $('set-site_name').value,
    site_description: $('set-site_description').value,
    footer_text: $('set-footer_text').value,
    registration_enabled: $('set-registration_enabled').checked?'true':'false',
    default_user_role: $('set-default_user_role').value,
    max_upload_size_mb: $('set-max_upload_size_mb').value,
  };
  const r = await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(data)});
  if(r?.ok){toast('✅ 设置已保存','success');renderAdminSettings();}
  else toast(r?.detail||'保存失败','error');
}

// ─── Sleep Timer ───
let _timer = { active: false, remaining: 0, total: 0, id: null, interval: null };

function showTimer(id) {
  if ($('tp-bg')) return;
  const bg = document.createElement('div'); bg.id = 'tp-bg'; bg.className = 'timer-bg';
  bg.onclick = () => bg.remove();
  bg.innerHTML = `<div class="timer-sheet" onclick="event.stopPropagation()">
    <h3>⏱ 定时关闭</h3>
    <div class="sub">播放结束后自动停止</div>
    ${_timer.active ? `<div style="margin-bottom:16px;text-align:center"><span class="timer-active-label">⏱ 剩余 ${dur(_timer.remaining)}</span></div>` : ''}
    <div class="timer-grid">
      <div class="timer-opt" onclick="setTimer('${id}',900);$('tp-bg').remove()">15分钟</div>
      <div class="timer-opt" onclick="setTimer('${id}',1800);$('tp-bg').remove()">30分钟</div>
      <div class="timer-opt" onclick="setTimer('${id}',2700);$('tp-bg').remove()">45分钟</div>
      <div class="timer-opt" onclick="setTimer('${id}',3600);$('tp-bg').remove()">60分钟</div>
      <div class="timer-opt" onclick="setTimer('${id}',0);$('tp-bg').remove()">播完为止</div>
      <div class="timer-opt" onclick="setTimer('${id}',-1);$('tp-bg').remove()">取消</div>
    </div>
  </div>`;
  document.body.appendChild(bg);
}

function setTimer(id, seconds) {
  if (_timer.interval) { clearInterval(_timer.interval); _timer.interval = null; }
  if (seconds < 0) {
    _timer.active = false; _timer.id = null;
    updateTimerBtn(); return;
  }
  _timer.active = true;
  _timer.remaining = seconds > 0 ? seconds : 99999;
  _timer.total = _timer.remaining;
  _timer.id = id;
  _timer.interval = setInterval(() => {
    if (_timer.remaining > 0) {
      _timer.remaining--;
      if (_timer.remaining <= 0) {
        clearInterval(_timer.interval); _timer.interval = null; _timer.active = false;
        const a = $(`ael-${id}`), v = $(`vel-${id}`);
        if (a) a.pause(); if (v) v.pause();
        updateTimerBtn();
        toast('⏱ 定时播放已结束', 'info');
      }
      updateTimerBtn();
    }
  }, 1000);
  updateTimerBtn();
}

function updateTimerBtn() {
  document.querySelectorAll('.timer-indicator').forEach(el => {
    if (_timer.active && _timer.remaining > 0) {
      el.textContent = `⏱ ${dur(_timer.remaining)}`;
      el.style.display = 'inline-flex';
    } else el.style.display = 'none';
  });
}

// ─── Playback Position ───
const PP_KEY = 'murmur_pp';
function getPositions() {
  try { return JSON.parse(localStorage.getItem(PP_KEY) || '{}'); } catch { return {}; }
}
function savePosition(id, ct, dur) {
  if (!ct || !dur || dur < 10) return;
  const p = getPositions(); p[id] = { currentTime: ct, duration: dur, updatedAt: Date.now() };
  const keys = Object.keys(p);
  if (keys.length > 50) {
    keys.sort((a, b) => p[b].updatedAt - p[a].updatedAt).slice(50).forEach(k => delete p[k]);
  }
  localStorage.setItem(PP_KEY, JSON.stringify(p));
}
function clearPosition(id) {
  const p = getPositions(); delete p[id]; localStorage.setItem(PP_KEY, JSON.stringify(p));
}
function getResumePos(id) {
  const p = getPositions()[id];
  if (!p || p.currentTime < 15 || (p.duration > 0 && p.currentTime / p.duration > 0.95)) {
    if (p) clearPosition(id);
    return null;
  }
  return p;
}

// ─── Play Queue ───
const Q_KEY = 'murmur_queue';
let _playQueue = [];
function loadQueue() {
  try { _playQueue = JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch { _playQueue = []; }
}
function saveQueue() { localStorage.setItem(Q_KEY, JSON.stringify(_playQueue)); }
function addToQueue(item) {
  if (_playQueue.some(q => q.id === item.id)) return;
  _playQueue.push(item); saveQueue(); updateQueueBar();
  toast('➕ 已加入播放队列', 'info');
}
function removeFromQueue(id) {
  _playQueue = _playQueue.filter(q => q.id !== id);
  saveQueue(); updateQueueBar();
}
function playNext() {
  document.querySelector('.queue-item.active')?.classList.remove('active');
  if (!_playQueue.length) return;
  const next = _playQueue.shift(); saveQueue();
  navigate('post', next.id); updateQueueBar();
}
function updateQueueBar() {
  const bar = $('queue-bar');
  if (!bar) return;
  bar.innerHTML = _playQueue.length
    ? _playQueue.map(q => `<div class="queue-item" onclick="rmFromQ(${q.id})">${q.file_type==='video'?'🎬':'🎵'} ${esc(q.title)}</div>`).join('')
    : '<span style="color:var(--text3);font-size:.75rem">队列为空</span>';
  if (state.postId) {
    const active = bar.querySelector(`[onclick*="${state.postId}"]`);
    if (active) active.classList.add('active');
  }
}
function rmFromQ(id) { removeFromQueue(id); }

// ═══════════════════════════════════════
// ─── V1.3 Features (PRD-008 ~ PRD-012) ───
// ═══════════════════════════════════════

// ─── PRD-008 Tags ───
let _tagPage = 1;

async function onTagInput(input, suggestId) {
  const sid = suggestId || 'tag-suggest';
  const box = $(sid);
  if (!box) return;
  const val = input.value;
  const parts = val.split(/[,，]/);
  const last = parts[parts.length - 1].trim();
  if (!last) { box.style.display = 'none'; return; }
  const data = await api(`/api/tags?q=${encodeURIComponent(last)}&limit=5&sort=hot`);
  const tags = data || [];
  if (!tags.length) { box.style.display = 'none'; return; }
  box.innerHTML = tags.map(t => `<div style="padding:8px 12px;cursor:pointer;font-size:.85rem" onmousedown="pickTag('${input.id}','${sid}','${esc(t.name)}')">#${esc(t.name)} <span style="color:var(--text3);font-size:.75rem">${t.use_count}</span></div>`).join('');
  box.style.display = 'block';
}

function pickTag(inputId, suggestId, name) {
  const input = $(inputId);
  if (!input) return;
  const val = input.value;
  const parts = val.split(/[,，]/);
  parts[parts.length - 1] = ' ' + name + ', ';
  input.value = parts.join(',').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim();
  input.focus();
  const box = $(suggestId);
  if (box) box.style.display = 'none';
}

async function renderTagPosts() {
  const tagId = state.params.tagId;
  if (!tagId) { navigate('home'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div id="tag-header"><div class="loading"><div class="spinner"></div></div></div>
    <div id="tag-posts"><div class="loading"><div class="spinner"></div></div></div>`;
  _tagPage = 1;
  await loadTagPosts(tagId);
}

async function loadTagPosts(tagId) {
  const data = await api(`/api/tags/${tagId}/posts?page=${_tagPage}&sort=latest`);
  const header = $('tag-header');
  const list = $('tag-posts');
  if (!data || !data.tag) {
    if (list) list.innerHTML = '<div class="empty"><p>标签不存在</p><button class="btn btn-primary" onclick="navigate()">返回</button></div>';
    return;
  }
  if (header) {
    header.innerHTML = `<div class="page-header">
      <div><h1>#${esc(data.tag.name)}</h1><div class="sub">${data.tag.use_count || 0} 个内容</div></div>
    </div>
    <div class="sort-tabs">
      <button class="sort-tab active">最新</button>
    </div>`;
  }
  const items = data.items || [];
  if (!items.length) {
    if (list) list.innerHTML = '<div class="empty"><div class="icon">🏷️</div><p>该标签下暂无内容</p></div>';
    return;
  }
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const p of items) {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    const card = document.createElement('div'); card.className = 'card';
    card.onclick = () => { if(isV&&!state.user){showLogin();return;} navigate('post',p.id); };
    const rp = getResumePos(p.id);
    const isFav = p.is_favorited || false;
    const favCount = p.favorite_count || 0;
    card.innerHTML = `<div class="cover">
      ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
      <div class="overlay"><div class="play">▶</div></div>
      <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
      ${p.featured?'<div class="badge" style="right:auto;left:8px;top:8px;background:var(--accent)">✨ 精选</div>':''}
      ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      ${rp?`<div class="resume-badge">▶ ${dur(rp.currentTime)}</div>`:''}
      <button class="fav-btn-card ${isFav?'active':''}" onclick="event.stopPropagation();toggleCardFavorite(this,${p.id})" title="收藏">
        ${isFav?'❤️':'🤍'}
      </button>
    </div><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="meta"><span>👁 ${p.views}</span><span>❤️ ${favCount}</span><span>💬 ${p.comment_count||0}</span></div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
        ${p.category?`<div class="tag">${p.category.icon} ${esc(p.category.name)}</div>`:''}
        ${(p.tags||[]).slice(0,3).map(t=>`<div class="tag" style="cursor:pointer" onclick="event.stopPropagation();navigate('tag-posts',{tagId:${t.id}})">#${esc(t.name)}</div>`).join('')}
        <button class="queue-add-btn" onclick="event.stopPropagation();addToQueue({id:${p.id},title:'${esc(p.title)}',file_type:'${p.file_type}',duration:${p.duration||0}})">＋</button>
      </div>
    </div>`;
    grid.appendChild(card);
  }
  if (list) {
    list.innerHTML = ''; list.appendChild(grid);
    if(data.total_pages>1) {
      const pg = document.createElement('div'); pg.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:24px';
      if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_tagPage=${data.page-1};loadTagPosts(${tagId})">← 上一页</button>`;
      if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_tagPage=${data.page+1};loadTagPosts(${tagId})">下一页 →</button>`;
      list.appendChild(pg);
    }
  }
}

// ─── PRD-009 Playlists ───
let _plTab = 'mine';
let _plPage = 1;

async function renderPlaylists() {
  if (!state.user) { showLogin(); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate()">← 返回</button>
    <div class="page-header">
      <div><h1>🎵 歌单</h1><div class="sub">收集你喜欢的声音</div></div>
      <button class="btn btn-primary" onclick="showCreatePlaylist()">➕ 新建歌单</button>
    </div>
    <div class="sort-tabs">
      <button class="sort-tab ${_plTab==='mine'?'active':''}" onclick="_plTab='mine';_plPage=1;renderPlaylists()">我的歌单</button>
      <button class="sort-tab ${_plTab==='discover'?'active':''}" onclick="_plTab='discover';_plPage=1;renderPlaylists()">发现公开</button>
    </div>
    <div id="playlist-list"><div class="loading"><div class="spinner"></div></div></div>`;
  await loadPlaylistList();
}

async function loadPlaylistList() {
  const list = $('playlist-list');
  if (!list) return;
  let url = `/api/playlists?page=${_plPage}`;
  if (_plTab === 'mine') url += '&mine=1';
  const data = await api(url);
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = `<div class="empty"><div class="icon">🎵</div><p>${_plTab==='mine'?'还没有创建歌单':'暂无公开歌单'}</p></div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px';
  for (const pl of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.onclick = () => navigate('playlist-detail', { playlistId: pl.id });
    const isMine = pl.user && state.user && pl.user.id === state.user.id;
    card.innerHTML = `<div class="cover" style="aspect-ratio:1;background:var(--bg2);display:flex;align-items:center;justify-content:center">
      <span style="font-size:3rem;opacity:.3">🎵</span>
      <div class="overlay"><div class="play">▶</div></div>
      ${pl.is_public?'<div class="badge" style="right:auto;left:8px;top:8px">🌐 公开</div>':'<div class="badge" style="right:auto;left:8px;top:8px">🔒 私密</div>'}
    </div><div class="info">
      <h3>${esc(pl.title)}</h3>
      <div class="meta">
        <span>📦 ${pl.item_count || 0} 首</span>
        ${pl.user?`<span>👤 ${esc(pl.user.username)}</span>`:''}
      </div>
      ${pl.description?`<div style="font-size:.8rem;color:var(--text3);margin-top:4px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(pl.description)}</div>`:''}
      ${isMine ? `<div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();editPlaylist(${pl.id},'${esc(pl.title)}','${esc(pl.description||'')}',${pl.is_public})" title="编辑">✏️</button>
        <button class="btn btn-ghost btn-icon" style="color:#f87171" onclick="event.stopPropagation();deletePlaylist(${pl.id})" title="删除">🗑</button>
      </div>` : ''}
    </div>`;
    grid.appendChild(card);
  }
  list.innerHTML = ''; list.appendChild(grid);
  if (data.total_pages > 1) {
    const pg = document.createElement('div'); pg.style.cssText='display:flex;justify-content:center;gap:8px;margin-top:24px';
    if(data.page>1) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_plPage=${data.page-1};loadPlaylistList()">← 上一页</button>`;
    if(data.page<data.total_pages) pg.innerHTML+=`<button class="btn btn-secondary" onclick="_plPage=${data.page+1};loadPlaylistList()">下一页 →</button>`;
    list.appendChild(pg);
  }
}

function showCreatePlaylist() {
  if (qs('.pl-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('pl-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>➕ 新建歌单</h2>
    <div class="input-group"><label>歌单名称</label><input id="pl-title" placeholder="给歌单取个名字..."></div>
    <div class="input-group"><label>描述（可选）</label><textarea id="pl-desc" placeholder="简单描述一下..." style="min-height:80px"></textarea></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="pl-public" checked>
      <label for="pl-public" style="font-size:.85rem;cursor:pointer">公开歌单（其他人可以看到）</label>
    </div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="createPlaylist()">创建</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => $('pl-title')?.focus(), 100);
}

async function createPlaylist() {
  const title = $('pl-title')?.value.trim();
  if (!title) { toast('请输入歌单名称', 'error'); return; }
  const description = $('pl-desc')?.value.trim() || '';
  const is_public = $('pl-public')?.checked || false;
  const r = await api('/api/playlists', {
    method: 'POST',
    body: JSON.stringify({ title, description, is_public })
  });
  if (r?.id) {
    toast('✅ 歌单创建成功', 'success');
    qs('.pl-modal')?.remove();
    loadPlaylistList();
  } else {
    toast(r?.detail || '创建失败', 'error');
  }
}

function editPlaylist(id, title, desc, isPublic) {
  if (qs('.pl-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('pl-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>✏️ 编辑歌单</h2>
    <div class="input-group"><label>歌单名称</label><input id="epl-title" value="${esc(title)}"></div>
    <div class="input-group"><label>描述（可选）</label><textarea id="epl-desc" style="min-height:80px">${esc(desc)}</textarea></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="epl-public" ${isPublic?'checked':''}>
      <label for="epl-public" style="font-size:.85rem;cursor:pointer">公开歌单</label>
    </div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-primary" onclick="savePlaylistEdit(${id})">保存</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

async function savePlaylistEdit(id) {
  const title = $('epl-title')?.value.trim();
  if (!title) { toast('请输入歌单名称', 'error'); return; }
  const description = $('epl-desc')?.value.trim() || '';
  const is_public = $('epl-public')?.checked || false;
  const r = await api(`/api/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, description, is_public })
  });
  if (r?.ok) {
    toast('✅ 保存成功', 'success');
    qs('.pl-modal')?.remove();
    if (state.view === 'playlists') loadPlaylistList();
    else if (state.view === 'playlist-detail') renderPlaylistDetail();
  } else {
    toast(r?.detail || '保存失败', 'error');
  }
}

async function deletePlaylist(id) {
  if (!confirm('确定删除这个歌单吗？歌单内的内容不会被删除。')) return;
  const r = await api(`/api/playlists/${id}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('✅ 已删除', 'success');
    if (state.view === 'playlists') loadPlaylistList();
    else navigate('playlists');
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}

async function renderPlaylistDetail() {
  const plId = state.params.playlistId;
  if (!plId) { navigate('playlists'); return; }
  const con = $('content');
  con.innerHTML = `<button class="back" onclick="navigate('playlists')">← 返回</button>
    <div id="pl-detail-header"><div class="loading"><div class="spinner"></div></div></div>
    <div id="pl-items"><div class="loading"><div class="spinner"></div></div></div>`;
  const pl = await api(`/api/playlists/${plId}`);
  if (!pl) {
    con.innerHTML = '<div class="empty"><p>歌单不存在</p><button class="btn btn-primary" onclick="navigate(\'playlists\')">返回</button></div>';
    return;
  }
  const isMine = pl.user && state.user && pl.user.id === state.user.id;
  const header = $('pl-detail-header');
  if (header) {
    header.innerHTML = `<div class="page-header">
      <div style="display:flex;gap:20px;align-items:center">
        <div style="width:140px;height:140px;background:var(--bg2);border-radius:var(--rs);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:4rem;opacity:.3">🎵</span>
        </div>
        <div>
          <h1 style="margin:0">${esc(pl.title)} ${pl.is_public?'<span style="font-size:.8rem;background:var(--bg3);color:var(--text3);padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle">🌐 公开</span>':'<span style="font-size:.8rem;background:var(--bg3);color:var(--text3);padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle">🔒 私密</span>'}</h1>
          <div class="sub" style="margin-top:6px">${pl.user?'👤 ' + esc(pl.user.username) + ' · ':''}${pl.item_count || 0} 首内容</div>
          ${pl.description?`<div style="margin-top:8px;color:var(--text2);font-size:.9rem">${esc(pl.description)}</div>`:''}
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="playPlaylistAll(${plId})">▶ 播放全部</button>
            ${isMine?`<button class="btn btn-secondary" onclick="editPlaylist(${pl.id},'${esc(pl.title)}','${esc(pl.description||'')}',${pl.is_public})">✏️ 编辑</button>`:''}
            ${isMine?`<button class="btn btn-secondary" style="color:#f87171" onclick="deletePlaylist(${pl.id})">🗑 删除</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }
  const items = pl.items || [];
  const list = $('pl-items');
  if (list) {
    if (!items.length) {
      list.innerHTML = '<div class="empty"><div class="icon">🎵</div><p>歌单还是空的</p></div>';
    } else {
      let html = '<div style="display:flex;flex-direction:column;gap:8px">';
      items.forEach((item, idx) => {
        const post = item.post || item;
        if (!post) return;
        const isV = post.file_type === 'video';
        const cv = post.cover_image ? `${API}/${post.cover_image}` : '';
        html += `<div style="display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;cursor:pointer" onclick="navigate('post',${post.id})">
          <div style="width:40px;text-align:center;color:var(--text3);font-size:.9rem;flex-shrink:0">${idx + 1}</div>
          <div style="width:120px;height:68px;border-radius:8px;overflow:hidden;background:var(--bg3);flex-shrink:0;position:relative">
            ${cv?`<img src="${cv}" style="width:100%;height:100%;object-fit:cover">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;opacity:.3">${isV?'🎬':'🎵'}</div>`}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(post.title)}</div>
            <div style="font-size:.8rem;color:var(--text3);margin-top:2px">
              ${post.category?post.category.icon + ' ' + esc(post.category.name) + ' · ':''}${dur(post.duration)}
            </div>
          </div>
          ${isMine?`<button class="btn btn-ghost btn-icon" style="color:#f87171;flex-shrink:0" onclick="event.stopPropagation();removeFromPlaylist(${plId},${post.id})" title="从歌单移除">✕</button>`:''}
        </div>`;
      });
      html += '</div>';
      list.innerHTML = html;
    }
  }
}

async function playPlaylistAll(plId) {
  const pl = await api(`/api/playlists/${plId}`);
  const items = pl?.items || [];
  if (!items.length) { toast('歌单是空的', 'error'); return; }
  _playQueue = [];
  items.forEach(item => {
    const post = item.post || item;
    if (post) _playQueue.push({ id: post.id, title: post.title, file_type: post.file_type, duration: post.duration || 0 });
  });
  saveQueue();
  if (_playQueue.length) {
    const first = _playQueue.shift();
    saveQueue();
    navigate('post', first.id);
    toast(`▶ 开始播放歌单（共 ${_playQueue.length + 1} 首）`, 'info');
  }
}

async function removeFromPlaylist(plId, postId) {
  if (!confirm('确定从歌单中移除吗？')) return;
  const r = await api(`/api/playlists/${plId}/items/${postId}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('✅ 已移除', 'success');
    renderPlaylistDetail();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

function showAddToPlaylist(postId) {
  if (!state.user) { showLogin(); return; }
  if (qs('.atp-modal')) return;
  const o = document.createElement('div'); o.className = 'auth-modal'; o.classList.add('atp-modal');
  o.innerHTML = `<div class="auth-box">
    <h2>🎵 添加到歌单</h2>
    <div id="atp-list" style="max-height:300px;overflow-y:auto;margin-bottom:12px"><div class="loading"><div class="spinner"></div></div></div>
    <div class="auth-actions">
      <button class="btn btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
      <button class="btn btn-ghost" onclick="showCreatePlaylistFromAtp()">➕ 新建歌单</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  loadMyPlaylistsForAdd(postId);
}

async function loadMyPlaylistsForAdd(postId) {
  const list = $('atp-list');
  if (!list) return;
  const data = await api('/api/playlists?mine=1&page_size=100');
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = '<div class="empty" style="padding:20px"><p>还没有歌单</p></div>';
    return;
  }
  list.innerHTML = items.map(pl => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);cursor:pointer" onclick="addToPlaylist(${pl.id},${postId})">
      <span style="font-size:1.5rem">🎵</span>
      <div style="flex:1">
        <div style="font-weight:500;font-size:.9rem">${esc(pl.title)}</div>
        <div style="font-size:.75rem;color:var(--text3)">${pl.item_count || 0} 首</div>
      </div>
      <span style="color:var(--accent)">＋</span>
    </div>
  `).join('');
}

function showCreatePlaylistFromAtp() {
  qs('.atp-modal')?.remove();
  showCreatePlaylist();
}

async function addToPlaylist(plId, postId) {
  const r = await api(`/api/playlists/${plId}/items/${postId}`, { method: 'POST' });
  if (r?.ok) {
    toast('✅ 已添加到歌单', 'success');
    qs('.atp-modal')?.remove();
  } else {
    toast(r?.detail || '添加失败', 'error');
  }
}

// ─── PRD-010 Related ───
async function loadRelated(postId) {
  const section = $('related-section');
  const scroll = $('related-scroll');
  if (!section || !scroll) return;
  const data = await api(`/api/posts/${postId}/related?limit=6`);
  const items = data?.items || [];
  if (!items.length) return;
  section.style.display = 'block';
  scroll.innerHTML = items.map(p => {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    return `<div class="card" style="width:200px;flex-shrink:0;cursor:pointer" onclick="navigate('post',${p.id})">
      <div class="cover">
        ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
        <div class="overlay"><div class="play">▶</div></div>
        <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
        ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      </div><div class="info">
        <h3 style="font-size:.85rem">${esc(p.title)}</h3>
        <div class="meta" style="font-size:.75rem"><span>👁 ${p.views}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ─── PRD-011 Featured ───
async function loadFeatured() {
  const section = $('featured-section');
  const scroll = $('featured-scroll');
  if (!section || !scroll) return;
  const data = await api('/api/posts/featured?limit=10');
  const items = data?.items || [];
  if (!items.length) return;
  section.style.display = 'block';
  scroll.innerHTML = items.map(p => {
    const isV = p.file_type==='video', cv = p.cover_image?`${API}/${p.cover_image}`:'';
    return `<div class="card" style="width:220px;flex-shrink:0;cursor:pointer" onclick="if(${isV}&&!state.user){showLogin();return;} navigate('post',${p.id})">
      <div class="cover">
        ${cv?`<img src="${cv}" loading="lazy">`:`<span style="font-size:2.2rem;opacity:.25">${isV?'🎬':'🎵'}</span>`}
        <div class="overlay"><div class="play">▶</div></div>
        <div class="badge">${isV?'🎬 视频':'🎵 音频'}</div>
        <div class="badge" style="right:auto;left:8px;top:8px;background:var(--accent)">✨ 精选</div>
        ${p.duration>0?`<div class="dur">${dur(p.duration)}</div>`:''}
      </div><div class="info">
        <h3 style="font-size:.85rem">${esc(p.title)}</h3>
        <div class="meta" style="font-size:.75rem"><span>👁 ${p.views}</span><span>❤️ ${p.favorite_count||0}</span></div>
      </div>
    </div>`;
  }).join('');
}

async function toggleFeatured(postId, current) {
  const btn = $('feat-btn');
  const r = await api(`/api/admin/posts/${postId}/featured`, {
    method: 'PUT',
    body: JSON.stringify({ featured: !current })
  });
  if (r?.ok) {
    toast(`✅ ${!current ? '已设为精选' : '已取消精选'}`, 'success');
    renderPost();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

async function toggleAdminFeatured(postId, current) {
  const r = await api(`/api/admin/posts/${postId}/featured`, {
    method: 'PUT',
    body: JSON.stringify({ featured: !current })
  });
  if (r?.ok) {
    toast(`✅ ${!current ? '已设为精选' : '已取消精选'}`, 'success');
    renderAdmin();
  } else {
    toast(r?.detail || '操作失败', 'error');
  }
}

// ─── PRD-012 Comments ───
let _commentPage = 1;

async function loadComments(postId) {
  const list = $('comments-list');
  if (!list) return;
  _commentPage = 1;
  const data = await api(`/api/posts/${postId}/comments?page=${_commentPage}`);
  renderCommentList(data, postId);
}

function renderCommentList(data, postId) {
  const list = $('comments-list');
  if (!list) return;
  const items = data?.items || [];
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;font-size:.85rem">暂无评论，来发表第一条吧~</div>';
    return;
  }
  let html = items.map(c => {
    const canDelete = state.user && (state.user.role === 'admin' || (c.user && c.user.id === state.user.id));
    return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">👤</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:600;font-size:.9rem">${esc(c.user?.username || '匿名')}</span>
            ${c.user?.role==='admin'?'<span style="font-size:.7rem;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px">管理员</span>':''}
          </div>
          <span style="font-size:.75rem;color:var(--text3)">${dt(c.created_at)}</span>
        </div>
        <div style="margin-top:6px;font-size:.9rem;line-height:1.5;word-wrap:break-word">${esc(c.content)}</div>
        ${canDelete ? `<div style="margin-top:6px">
          <button class="btn btn-ghost btn-icon" style="color:#f87171;font-size:.8rem;padding:2px 8px" onclick="deleteComment(${c.id},${postId})">🗑 删除</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
  if (data.total_pages > 1) {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.8rem;color:var(--text3)">
      <button class="btn btn-secondary" onclick="_commentPage--;loadMoreComments(${postId})" ${_commentPage<=1?'disabled':''}>上一页</button>
      <span>第 ${data.page} / ${data.total_pages} 页</span>
      <button class="btn btn-secondary" onclick="_commentPage++;loadMoreComments(${postId})" ${_commentPage>=data.total_pages?'disabled':''}>下一页</button>
    </div>`;
  }
  list.innerHTML = html;
}

async function loadMoreComments(postId) {
  const data = await api(`/api/posts/${postId}/comments?page=${_commentPage}`);
  renderCommentList(data, postId);
}

async function submitComment(postId) {
  if (!state.user) { showLogin(); return; }
  const input = $('comment-input');
  const content = input?.value.trim();
  if (!content) { toast('请输入评论内容', 'error'); return; }
  const r = await api(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
  if (r?.id) {
    toast('✅ 评论成功', 'success');
    if (input) input.value = '';
    loadComments(postId);
  } else {
    toast(r?.detail || '评论失败', 'error');
  }
}

async function deleteComment(commentId, postId) {
  if (!confirm('确定删除这条评论吗？')) return;
  const r = await api(`/api/comments/${commentId}`, { method: 'DELETE' });
  if (r?.ok) {
    toast('✅ 已删除', 'success');
    loadComments(postId);
  } else {
    toast(r?.detail || '删除失败', 'error');
  }
}

// ═══════════════════════════════════════
// ─── PRD-013 Player Enhancements ───
// ═══════════════════════════════════════
const PM_KEY = 'asmr_playmode';
const PM_VOL = 'asmr_volume';
const PM_MUTED = 'asmr_muted';
const PM_SPEED = 'asmr_speed';
const PM_ORDER = ['list', 'single', 'random'];
const PM_ICON = { list: '🔁', single: '🔂', random: '🔀' };
const PM_LABEL = { list: '列表循环', single: '单曲循环', random: '随机播放' };

function getPlayMode() { return localStorage.getItem(PM_KEY) || 'list'; }
function getPlayModeIcon() { return PM_ICON[getPlayMode()] || '🔁'; }

function cyclePlayMode(pid) {
  const cur = getPlayMode();
  const next = PM_ORDER[(PM_ORDER.indexOf(cur) + 1) % PM_ORDER.length];
  localStorage.setItem(PM_KEY, next);
  const btn = document.getElementById(`apm-${pid}`) || document.getElementById(`vpm-${pid}`);
  if (btn) { btn.textContent = PM_ICON[next]; btn.title = PM_LABEL[next]; }
  toast(`${PM_ICON[next]} ${PM_LABEL[next]}`, 'info');
}

function applySavedMediaSettings(media, pid, isVideo) {
  const savedVol = parseFloat(localStorage.getItem(PM_VOL));
  if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
    media.volume = savedVol;
    const slider = document.getElementById(isVideo ? `vvs-${pid}` : `avs-${pid}`);
    if (slider) slider.value = savedVol;
  }
  const savedMuted = localStorage.getItem(PM_MUTED) === '1';
  media.muted = savedMuted;
  const muteBtn = document.getElementById(isVideo ? `vvb-${pid}` : `avb-${pid}`);
  if (muteBtn) muteBtn.textContent = savedMuted ? '🔇' : '🔊';
  const savedSpeed = parseFloat(localStorage.getItem(PM_SPEED));
  if (!isNaN(savedSpeed) && savedSpeed > 0) {
    media.playbackRate = savedSpeed;
    if (!isVideo) {
      const sp = document.getElementById(`aspd-${pid}`);
      if (sp) sp.textContent = `${savedSpeed}x`;
    }
  }
  const pmBtn = document.getElementById(isVideo ? `vpm-${pid}` : `apm-${pid}`);
  if (pmBtn) { pmBtn.textContent = getPlayModeIcon(); pmBtn.title = PM_LABEL[getPlayMode()]; }
}

function handlePlaybackEnded(pid, media) {
  const mode = getPlayMode();
  if (mode === 'single') {
    media.currentTime = 0;
    media.play().catch(() => {});
    return;
  }
  if (mode === 'random') {
    playRandomRelated(pid);
    return;
  }
  playNext();
}

async function playRandomRelated(pid) {
  const data = await api(`/api/posts/${pid}/related?limit=10`);
  const items = data?.items || [];
  if (!items.length) { playNext(); return; }
  const pick = items[Math.floor(Math.random() * items.length)];
  toast(`🔀 随机播放：${pick.title}`, 'info');
  navigate('post', pick.id);
}

// ─── Media Session API ───
function setupMediaSession(p, cover) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: p.title || 'Murmur',
      artist: p.user?.username || 'Murmur',
      album: p.category?.name || 'ASMR',
      artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => {
      const m = document.querySelector('audio, video'); if (m) m.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const m = document.querySelector('audio, video'); if (m) m.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      const m = document.querySelector('audio, video');
      if (m) m.currentTime = Math.max(0, m.currentTime - 5);
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      const m = document.querySelector('audio, video');
      if (m) m.currentTime = Math.min(m.duration || 0, m.currentTime + 5);
    });
  } catch (e) {}
}

function updateMediaSessionState(playing) {
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
  }
}

// ─── Keyboard Shortcuts ───
function handleKeydown(e) {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault(); toggleHelpOverlay(); return;
  }
  if (e.key === 'Escape') {
    const help = $('help-overlay');
    if (help) { help.remove(); return; }
    return;
  }
  const m = document.querySelector('audio, video');
  if (!m) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (m.paused) m.play().catch(() => {}); else m.pause();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      m.currentTime = Math.max(0, m.currentTime - (e.shiftKey ? 30 : 5));
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (m.duration) m.currentTime = Math.min(m.duration, m.currentTime + (e.shiftKey ? 30 : 5));
      break;
    case 'ArrowUp':
      e.preventDefault();
      m.volume = Math.min(1, Math.round((m.volume + 0.1) * 100) / 100);
      localStorage.setItem(PM_VOL, m.volume);
      if (m.muted) { m.muted = false; localStorage.setItem(PM_MUTED, '0'); updateMuteBtnVisual(m); }
      break;
    case 'ArrowDown':
      e.preventDefault();
      m.volume = Math.max(0, Math.round((m.volume - 0.1) * 100) / 100);
      localStorage.setItem(PM_VOL, m.volume);
      break;
    case 'm': case 'M':
      e.preventDefault();
      m.muted = !m.muted;
      localStorage.setItem(PM_MUTED, m.muted ? '1' : '0');
      updateMuteBtnVisual(m);
      break;
    case 'f': case 'F':
      e.preventDefault();
      if (m.tagName === 'VIDEO') {
        if (document.fullscreenElement) document.exitFullscreen();
        else m.parentElement?.requestFullscreen?.();
      }
      break;
    case '1': case '2': case '3': case '4': case '5': {
      e.preventDefault();
      const speeds = [1, 1.25, 1.5, 2, 0.5];
      const idx = parseInt(e.key) - 1;
      m.playbackRate = speeds[idx];
      localStorage.setItem(PM_SPEED, speeds[idx]);
      const pid = (m.id || '').split('-').slice(1).join('-');
      const sp = document.getElementById(`aspd-${pid}`);
      if (sp) sp.textContent = `${speeds[idx]}x`;
      toast(`倍速 ${speeds[idx]}x`, 'info');
      break;
    }
  }
}

function updateMuteBtnVisual(m) {
  const pid = (m.id || '').split('-').slice(1).join('-');
  const btn = document.getElementById(`avb-${pid}`) || document.getElementById(`vvb-${pid}`);
  if (btn) btn.textContent = m.muted ? '🔇' : '🔊';
}

function toggleHelpOverlay() {
  const existing = $('help-overlay');
  if (existing) { existing.remove(); return; }
  const o = document.createElement('div');
  o.id = 'help-overlay';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px)';
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  const kbd = 'display:inline-block;padding:2px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;font-size:.75rem;font-family:monospace;min-width:24px;text-align:center';
  const row = 'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)';
  o.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:24px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <h2 style="margin:0 0 16px;font-size:1.1rem">⌨️ 键盘快捷键</h2>
    <div style="font-size:.85rem">
      <div style="${row}"><span>播放 / 暂停</span><span style="${kbd}">Space</span></div>
      <div style="${row}"><span>快退 / 快进 5 秒</span><span><span style="${kbd}">←</span> / <span style="${kbd}">→</span></span></div>
      <div style="${row}"><span>快退 / 快进 30 秒</span><span><span style="${kbd}">Shift</span> + <span style="${kbd}">←/→</span></span></div>
      <div style="${row}"><span>音量增 / 减</span><span><span style="${kbd}">↑</span> / <span style="${kbd}">↓</span></span></div>
      <div style="${row}"><span>静音切换</span><span style="${kbd}">M</span></div>
      <div style="${row}"><span>全屏（视频）</span><span style="${kbd}">F</span></div>
      <div style="${row}"><span>切换倍速 1x/1.25x/1.5x/2x/0.5x</span><span style="${kbd}">1~5</span></div>
      <div style="${row}"><span>显示 / 隐藏此帮助</span><span style="${kbd}">?</span></div>
      <div style="${row};border-bottom:none"><span>关闭浮层</span><span style="${kbd}">Esc</span></div>
    </div>
    <div style="margin-top:16px;text-align:right">
      <button class="btn btn-secondary" onclick="this.closest('#help-overlay').remove()">关闭</button>
    </div>
  </div>`;
  document.body.appendChild(o);
}

// ═══════════════════════════════════════
// ─── PRD-014 Mobile & PWA ───
// ═══════════════════════════════════════

// ─── Mobile Sidebar Menu ───
function openSidebar() {
  const sb = $('sidebar'); const ov = $('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.add('open');
  ov.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  const sb = $('sidebar'); const ov = $('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.remove('open');
  ov.classList.remove('visible');
  document.body.style.overflow = '';
}
function toggleSidebar() {
  const sb = $('sidebar');
  if (!sb) return;
  if (sb.classList.contains('open')) closeSidebar(); else openSidebar();
}

// ─── Video Double-Tap Gestures ───
function attachVideoGestures(pid) {
  const wrap = document.getElementById(`vpw-${pid}`);
  if (!wrap || wrap._gestureBound) return;
  wrap._gestureBound = true;
  let lastTap = 0;
  let lastTapZone = null;
  wrap.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const rect = wrap.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const zone = x < rect.width / 3 ? 'left' : (x > rect.width * 2 / 3 ? 'right' : 'center');
    const now = Date.now();
    const delta = now - lastTap;
    if (delta < 300 && lastTapZone === zone) {
      // Double-tap detected
      e.preventDefault();
      const v = document.getElementById(`vel-${pid}`);
      if (v) {
        if (zone === 'left') {
          // Undo the first tap's play/pause toggle, then rewind 10s
          vtoggle(pid);
          v.currentTime = Math.max(0, v.currentTime - 10);
          showVideoGestureFeedback(wrap, '⏪', 'left');
        } else if (zone === 'right') {
          // Undo the first tap's play/pause toggle, then forward 10s
          vtoggle(pid);
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          showVideoGestureFeedback(wrap, '⏩', 'right');
        } else {
          // Center: first tap already toggled once, which is the expected behavior
          showVideoGestureFeedback(wrap, '⏯', 'center');
        }
      }
      lastTap = 0;
      lastTapZone = null;
    } else {
      lastTap = now;
      lastTapZone = zone;
    }
  }, { passive: false });
}

function showVideoGestureFeedback(wrap, icon, zone) {
  const fb = document.createElement('div');
  fb.className = `video-gesture-fb ${zone}`;
  fb.textContent = icon;
  wrap.appendChild(fb);
  setTimeout(() => fb.remove(), 600);
}

// ─── Offline / Online Banner ───
function showOfflineBanner() {
  if ($('offline-banner')) return;
  const b = document.createElement('div');
  b.id = 'offline-banner';
  b.className = 'offline-banner visible';
  b.textContent = '🌐 网络已断开，部分功能不可用';
  document.body.appendChild(b);
}
function hideOfflineBanner() {
  const b = $('offline-banner');
  if (b) b.remove();
}

// ─── PWA Install Prompt ───
function promptInstall() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(() => {
    _deferredPrompt = null;
    const btn = $('install-btn');
    if (btn) btn.classList.remove('visible');
    updateUI();
  }).catch(() => {});
}

// ─── Init ───
loadQueue();
document.addEventListener('keydown', handleKeydown);
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu
  $('menu-toggle')?.addEventListener('click', toggleSidebar);
  $('sidebar-close')?.addEventListener('click', closeSidebar);
  $('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Online / Offline
  window.addEventListener('online', () => { hideOfflineBanner(); toast('✅ 网络已恢复', 'success'); });
  window.addEventListener('offline', showOfflineBanner);
  if (!navigator.onLine) showOfflineBanner();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    updateUI();
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    const btn = $('install-btn');
    if (btn) btn.classList.remove('visible');
    toast('✅ 安装成功', 'success');
  });

  initI18n().then(() => {
    checkAuth(); loadCats(); navigate('home');
  });
});

// ─── Service Worker Registration ───
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.update());
    });
    navigator.serviceWorker.register('/static/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'activated') navigator.serviceWorker.controller && location.reload();
        });
      });
    }).catch(() => {});
  });
}
