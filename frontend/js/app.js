/* ═══════════════════════════════════════════════════════
   SocialNet — Frontend Application
   ═══════════════════════════════════════════════════════ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : (window.API_URL || '');

// ── State ──
let currentUser = null;
let token = localStorage.getItem('token');

// ── API Helper ──
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──
function setAuth(data) {
  token = data.access_token;
  currentUser = data.user;
  localStorage.setItem('token', token);
  renderHeader();
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  renderHeader();
  router.go('login');
}

async function loadCurrentUser() {
  if (!token) return;
  try {
    currentUser = await api('/api/auth/me');
    renderHeader();
  } catch {
    logout();
  }
}

// ── Router ──
const router = {
  go(page, data = {}) {
    window.history.pushState({ page, data }, '', `#${page}${data.username ? '/' + data.username : ''}`);
    this.render(page, data);
  },
  render(page, data = {}) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loader"><div class="spinner"></div>Завантаження...</div>';
    switch (page) {
      case 'login': renderLogin(app); break;
      case 'register': renderRegister(app); break;
      case 'feed': renderFeed(app); break;
      case 'explore': renderExplore(app); break;
      case 'profile': renderProfile(app, data.username); break;
      case 'post': renderPostPage(app, data.postId); break;
      case 'search': renderSearch(app, data.query); break;
      default: renderFeed(app);
    }
  },
  init() {
    window.addEventListener('popstate', (e) => {
      const s = e.state || this.parseHash();
      this.render(s.page, s.data || {});
    });
    const s = this.parseHash();
    this.render(s.page, s.data || {});
  },
  parseHash() {
    const hash = location.hash.slice(1);
    if (!hash) return { page: token ? 'feed' : 'login' };
    const parts = hash.split('/');
    if (parts[0] === 'profile' && parts[1]) return { page: 'profile', data: { username: parts[1] } };
    if (parts[0] === 'post' && parts[1]) return { page: 'post', data: { postId: parts[1] } };
    return { page: parts[0], data: {} };
  }
};

// ── Header ──
function renderHeader() {
  const area = document.getElementById('header-auth-area');
  if (currentUser) {
    area.innerHTML = `
      <button class="btn-ghost btn-sm" onclick="router.go('explore')">🔍 Пошук</button>
      <button class="btn-ghost btn-sm" onclick="router.go('profile', {username:'${currentUser.username}'})">👤 ${escHtml(currentUser.display_name)}</button>
      <button class="btn-ghost btn-sm" onclick="logout()">Вийти</button>
    `;
  } else {
    area.innerHTML = `
      <button class="btn-ghost btn-sm" onclick="router.go('login')">Увійти</button>
      <button class="btn-primary btn-sm" onclick="router.go('register')">Реєстрація</button>
    `;
  }
}

// ── Helpers ──
function escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'щойно';
  if (diff < 3600) return Math.floor(diff / 60) + ' хв';
  if (diff < 86400) return Math.floor(diff / 3600) + ' год';
  if (diff < 604800) return Math.floor(diff / 86400) + ' дн';
  return d.toLocaleDateString('uk');
}
function avatarHtml(user, size = 44) {
  if (user.avatar_url) {
    return `<div class="avatar" style="width:${size}px;height:${size}px"><img src="${escHtml(user.avatar_url)}" alt=""></div>`;
  }
  const letter = (user.display_name || user.username || '?')[0].toUpperCase();
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.4}px">${letter}</div>`;
}

// ── SVG Icons ──
const icons = {
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

// ── Login Page ──
function renderLogin(app) {
  app.innerHTML = `
    <div class="auth-container page">
      <div class="auth-card">
        <h2>Вхід</h2>
        <p>Раді бачити вас знову!</p>
        <div id="login-error" class="error-msg hidden"></div>
        <div class="form-group">
          <label>Ім'я користувача</label>
          <input type="text" id="login-username" placeholder="username">
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input type="password" id="login-password" placeholder="••••••••">
        </div>
        <button class="btn-primary btn-block" onclick="doLogin()" style="padding:12px;font-size:1rem;margin-top:8px">Увійти</button>
        <div class="auth-switch">Немає акаунту? <a onclick="router.go('register')">Зареєструватися</a></div>
      </div>
    </div>
  `;
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Заповніть усі поля'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setAuth(data);
    router.go('feed');
  } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

// ── Register Page ──
function renderRegister(app) {
  app.innerHTML = `
    <div class="auth-container page">
      <div class="auth-card">
        <h2>Реєстрація</h2>
        <p>Створіть свій акаунт в SocialNet</p>
        <div id="reg-error" class="error-msg hidden"></div>
        <div class="form-group">
          <label>Ім'я користувача</label>
          <input type="text" id="reg-username" placeholder="username">
        </div>
        <div class="form-group">
          <label>Ваше ім'я</label>
          <input type="text" id="reg-displayname" placeholder="Ваше повне ім'я">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="reg-email" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input type="password" id="reg-password" placeholder="Мінімум 6 символів">
        </div>
        <button class="btn-primary btn-block" onclick="doRegister()" style="padding:12px;font-size:1rem;margin-top:8px">Зареєструватися</button>
        <div class="auth-switch">Вже є акаунт? <a onclick="router.go('login')">Увійти</a></div>
      </div>
    </div>
  `;
  document.getElementById('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const display_name = document.getElementById('reg-displayname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  if (!username || !display_name || !email || !password) { errEl.textContent = 'Заповніть усі поля'; errEl.classList.remove('hidden'); return; }
  if (password.length < 6) { errEl.textContent = 'Пароль має бути мінімум 6 символів'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, display_name, email, password }) });
    setAuth(data);
    router.go('feed');
  } catch (e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

// ── Feed Page ──
async function renderFeed(app) {
  if (!currentUser) { router.go('login'); return; }
  app.innerHTML = `
    <div class="page">
      <div class="tabs">
        <button class="tab-btn active" id="tab-feed" onclick="switchFeedTab('feed')">Моя стрічка</button>
        <button class="tab-btn" id="tab-all" onclick="switchFeedTab('all')">Усі пости</button>
      </div>
      <div class="composer">
        <textarea id="post-content" placeholder="Що у вас нового?" maxlength="1000"></textarea>
        <div class="composer-actions">
          <span class="char-count" id="char-count">0/1000</span>
          <button class="btn-primary btn-sm" onclick="createPost()">Опублікувати</button>
        </div>
      </div>
      <div id="posts-list">
        <div class="loader"><div class="spinner"></div>Завантаження...</div>
      </div>
    </div>
  `;
  document.getElementById('post-content').addEventListener('input', e => {
    document.getElementById('char-count').textContent = `${e.target.value.length}/1000`;
  });
  loadFeedPosts('feed');
}

let feedMode = 'feed';
function switchFeedTab(mode) {
  feedMode = mode;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${mode}`).classList.add('active');
  loadFeedPosts(mode);
}

async function loadFeedPosts(mode) {
  const list = document.getElementById('posts-list');
  list.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  try {
    const endpoint = mode === 'feed' ? '/api/feed' : '/api/posts';
    const posts = await api(endpoint);
    if (posts.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>${mode === 'feed' ? 'Стрічка порожня' : 'Ще немає постів'}</h3>
          <p>${mode === 'feed' ? 'Підпишіться на когось або створіть свій перший пост!' : 'Будьте першим, хто опублікує щось!'}</p>
        </div>
      `;
    } else {
      list.innerHTML = posts.map(p => postCardHtml(p)).join('');
    }
  } catch (e) {
    list.innerHTML = `<div class="error-msg">${escHtml(e.message)}</div>`;
  }
}

async function createPost() {
  const textarea = document.getElementById('post-content');
  const content = textarea.value.trim();
  if (!content) return;
  try {
    await api('/api/posts', { method: 'POST', body: JSON.stringify({ content }) });
    textarea.value = '';
    document.getElementById('char-count').textContent = '0/1000';
    loadFeedPosts(feedMode);
  } catch (e) { alert(e.message); }
}

// ── Explore / Search ──
async function renderExplore(app) {
  app.innerHTML = `
    <div class="page">
      <h2 style="margin-bottom:16px">Пошук людей</h2>
      <div class="search-bar">
        <input type="text" id="search-input" placeholder="Пошук за іменем або username..." oninput="debounceSearch()">
      </div>
      <div id="search-results">
        <div class="loader"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  const users = await api('/api/users');
  renderUserList(users, 'search-results');
}

let searchTimer;
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = document.getElementById('search-input').value.trim();
    const users = await api(`/api/users?q=${encodeURIComponent(q)}`);
    renderUserList(users, 'search-results');
  }, 300);
}

function renderUserList(users, containerId) {
  const container = document.getElementById(containerId);
  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Нікого не знайдено</h3></div>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="user-item" onclick="router.go('profile',{username:'${escHtml(u.username)}'})">
      ${avatarHtml(u, 40)}
      <div class="user-item-info">
        <div class="display-name">${escHtml(u.display_name)}</div>
        <div class="username">@${escHtml(u.username)}</div>
      </div>
      <span style="color:var(--text2);font-size:0.8rem">${u.followers_count} підписників</span>
    </div>
  `).join('');
}

// ── Profile Page ──
async function renderProfile(app, username) {
  if (!username) { router.go('feed'); return; }
  try {
    const user = await api(`/api/users/${username}`);
    const isMe = currentUser && currentUser.id === user.id;
    app.innerHTML = `
      <div class="page">
        <div class="profile-header">
          ${avatarHtml(user, 96).replace('class="avatar"', 'class="avatar profile-avatar"')}
          <h2>${escHtml(user.display_name)}</h2>
          <div class="username" style="color:var(--text2)">@${escHtml(user.username)}</div>
          ${user.bio ? `<div class="bio">${escHtml(user.bio)}</div>` : ''}
          <div class="profile-stats">
            <div class="stat" onclick="showFollowers('${escHtml(user.username)}')" style="cursor:pointer">
              <div class="stat-num">${user.followers_count}</div>
              <div class="stat-label">Підписники</div>
            </div>
            <div class="stat" onclick="showFollowing('${escHtml(user.username)}')" style="cursor:pointer">
              <div class="stat-num">${user.following_count}</div>
              <div class="stat-label">Підписки</div>
            </div>
          </div>
          <div class="profile-actions">
            ${isMe
              ? `<button class="btn-ghost btn-sm" onclick="openEditModal()">Редагувати профіль</button>`
              : currentUser
                ? `<button class="btn-primary btn-sm" id="follow-btn" onclick="toggleFollow('${escHtml(user.username)}')">${user.is_following ? 'Відписатися' : 'Підписатися'}</button>`
                : ''
            }
          </div>
        </div>
        <div id="profile-content">
          <div class="loader"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const posts = await api(`/api/users/${username}/posts`);
    const content = document.getElementById('profile-content');
    if (posts.length === 0) {
      content.innerHTML = '<div class="empty-state"><h3>Ще немає постів</h3></div>';
    } else {
      content.innerHTML = posts.map(p => postCardHtml(p)).join('');
    }
  } catch (e) {
    app.innerHTML = `<div class="error-msg">${escHtml(e.message)}</div>`;
  }
}

async function toggleFollow(username) {
  const btn = document.getElementById('follow-btn');
  const isFollowing = btn.textContent.trim() === 'Відписатися';
  try {
    if (isFollowing) {
      await api(`/api/users/${username}/follow`, { method: 'DELETE' });
      btn.textContent = 'Підписатися';
    } else {
      await api(`/api/users/${username}/follow`, { method: 'POST' });
      btn.textContent = 'Відписатися';
    }
    renderProfile(document.getElementById('app'), username);
  } catch (e) { alert(e.message); }
}

async function showFollowers(username) {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  const users = await api(`/api/users/${username}/followers`);
  if (users.length === 0) {
    content.innerHTML = '<div class="empty-state"><h3>Ще немає підписників</h3></div>';
  } else {
    content.innerHTML = '<h3 style="margin-bottom:12px">Підписники</h3>' + users.map(u => `
      <div class="user-item" onclick="router.go('profile',{username:'${escHtml(u.username)}'})">
        ${avatarHtml(u, 40)}
        <div class="user-item-info">
          <div class="display-name">${escHtml(u.display_name)}</div>
          <div class="username">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
  }
}

async function showFollowing(username) {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  const users = await api(`/api/users/${username}/following`);
  if (users.length === 0) {
    content.innerHTML = '<div class="empty-state"><h3>Ще нікого не підписано</h3></div>';
  } else {
    content.innerHTML = '<h3 style="margin-bottom:12px">Підписки</h3>' + users.map(u => `
      <div class="user-item" onclick="router.go('profile',{username:'${escHtml(u.username)}'})">
        ${avatarHtml(u, 40)}
        <div class="user-item-info">
          <div class="display-name">${escHtml(u.display_name)}</div>
          <div class="username">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
  }
}

// ── Edit Profile Modal ──
function openEditModal() {
  document.getElementById('edit-display-name').value = currentUser.display_name || '';
  document.getElementById('edit-bio').value = currentUser.bio || '';
  document.getElementById('edit-avatar').value = currentUser.avatar_url || '';
  document.getElementById('edit-profile-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-profile-modal').classList.add('hidden');
}

async function saveProfile() {
  try {
    const data = {
      display_name: document.getElementById('edit-display-name').value.trim(),
      bio: document.getElementById('edit-bio').value.trim(),
      avatar_url: document.getElementById('edit-avatar').value.trim(),
    };
    currentUser = await api('/api/users/me', { method: 'PUT', body: JSON.stringify(data) });
    closeEditModal();
    renderHeader();
    renderProfile(document.getElementById('app'), currentUser.username);
  } catch (e) { alert(e.message); }
}

// ── Post Card ──
function postCardHtml(post) {
  const isOwner = currentUser && currentUser.id === post.author.id;
  return `
    <div class="post-card" id="post-${post.id}">
      <div class="post-header">
        ${avatarHtml(post.author)}
        <div class="post-user-info" onclick="router.go('profile',{username:'${escHtml(post.author.username)}'})" style="cursor:pointer">
          <div class="display-name">${escHtml(post.author.display_name)}</div>
          <div class="username">@${escHtml(post.author.username)}</div>
        </div>
        <span class="post-time">${timeAgo(post.created_at)}</span>
        ${isOwner ? `<button class="post-action-btn" onclick="deletePost(${post.id})" title="Видалити">${icons.trash}</button>` : ''}
      </div>
      <div class="post-content">${escHtml(post.content)}</div>
      ${post.image_url ? `<div class="post-image"><img src="${escHtml(post.image_url)}" alt="Post image"></div>` : ''}
      <div class="post-actions">
        <button class="post-action-btn ${post.is_liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
          ${post.is_liked ? icons.heartFilled : icons.heart}
          <span>${post.likes_count}</span>
        </button>
        <button class="post-action-btn" onclick="toggleComments(${post.id})">
          ${icons.comment}
          <span>${post.comments_count}</span>
        </button>
      </div>
      <div class="comments-section hidden" id="comments-${post.id}"></div>
    </div>
  `;
}

async function toggleLike(postId) {
  if (!currentUser) { router.go('login'); return; }
  const card = document.getElementById(`post-${postId}`);
  const btn = card.querySelector('.post-action-btn');
  const isLiked = btn.classList.contains('liked');
  try {
    if (isLiked) {
      await api(`/api/posts/${postId}/like`, { method: 'DELETE' });
      btn.classList.remove('liked');
      btn.innerHTML = `${icons.heart}<span>${parseInt(btn.querySelector('span').textContent) - 1}</span>`;
    } else {
      await api(`/api/posts/${postId}/like`, { method: 'POST' });
      btn.classList.add('liked');
      btn.innerHTML = `${icons.heartFilled}<span>${parseInt(btn.querySelector('span').textContent) + 1}</span>`;
    }
  } catch (e) { /* ignore duplicate errors */ }
}

async function deletePost(postId) {
  if (!confirm('Видалити пост?')) return;
  try {
    await api(`/api/posts/${postId}`, { method: 'DELETE' });
    document.getElementById(`post-${postId}`)?.remove();
  } catch (e) { alert(e.message); }
}

// ── Comments ──
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section.classList.contains('hidden')) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  section.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  try {
    const comments = await api(`/api/posts/${postId}/comments`);
    let html = comments.map(c => `
      <div class="comment">
        ${avatarHtml(c.author, 32)}
        <div class="comment-body">
          <span class="display-name" onclick="router.go('profile',{username:'${escHtml(c.author.username)}'})" style="cursor:pointer">${escHtml(c.author.display_name)}</span>
          <div class="comment-text">${escHtml(c.content)}</div>
          <div class="comment-time">${timeAgo(c.created_at)}</div>
        </div>
      </div>
    `).join('');
    if (!html) html = '<p style="color:var(--text2);font-size:0.85rem;padding:8px 0">Ще немає коментарів</p>';
    html += `
      <div class="comment-form">
        <input type="text" id="comment-input-${postId}" placeholder="Написати коментар..." onkeydown="if(event.key==='Enter')submitComment(${postId})">
        <button class="btn-primary btn-sm" onclick="submitComment(${postId})">→</button>
      </div>
    `;
    section.innerHTML = html;
  } catch (e) {
    section.innerHTML = `<div class="error-msg">${escHtml(e.message)}</div>`;
  }
}

async function submitComment(postId) {
  if (!currentUser) { router.go('login'); return; }
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    input.value = '';
    toggleComments(postId);
    toggleComments(postId);
  } catch (e) { alert(e.message); }
}

// ── Single Post Page ──
async function renderPostPage(app, postId) {
  try {
    const post = await api(`/api/posts/${postId}`);
    app.innerHTML = `
      <div class="page">
        <button class="btn-ghost btn-sm" onclick="router.go('feed')" style="margin-bottom:16px">← Назад</button>
        ${postCardHtml(post)}
      </div>
    `;
    setTimeout(() => toggleComments(postId), 100);
  } catch (e) {
    app.innerHTML = `<div class="error-msg">${escHtml(e.message)}</div>`;
  }
}

// ── Init ──
(async () => {
  await loadCurrentUser();
  router.init();
})();
