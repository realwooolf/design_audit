  const SUPABASE_URL = 'https://pbhhzbqtnttymlsjbrcy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0C8qU-G50pbTPXqJBI6AIg_wd8uz4lt';
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let currentProjectId = null;
  let currentUserId = null;
  let authMode = 'login'; // 'login' or 'signup'

  function toggleAuthMode(e) {
    e.preventDefault();
    authMode = authMode === 'login' ? 'signup' : 'login';
    document.getElementById('authSubmit').textContent = authMode === 'login' ? '登录' : '注册';
    document.getElementById('authToggleText').textContent = authMode === 'login' ? '还没有账号？' : '已有账号？';
    document.getElementById('authToggleLink').textContent = authMode === 'login' ? '注册' : '登录';
    document.getElementById('authError').classList.add('hidden');
    // 忘记密码仅在登录模式显示
    document.getElementById('forgotPasswordSection').classList.toggle('hidden', authMode !== 'login');
    // 切换时隐藏忘记密码表单
    document.getElementById('forgotPasswordForm').classList.add('hidden');
  }

  async function handleAuth() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('authError');
    errEl.classList.add('hidden');

    if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; errEl.classList.remove('hidden'); return; }
    if (password.length < 6) { errEl.textContent = '密码至少 6 位'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('authSubmit');
    btn.disabled = true; btn.textContent = '处理中…';

    try {
      let result;
      if (authMode === 'signup') {
        result = await sb.auth.signUp({ email, password });
      } else {
        result = await sb.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;

      if (authMode === 'signup' && result.data.user && !result.data.session) {
        errEl.textContent = '注册成功！请查收验证邮件后登录。';
        errEl.style.color = '#22A34A'; errEl.style.background = 'rgba(34,163,74,.06)';
        errEl.classList.remove('hidden');
        authMode = 'login';
        btn.textContent = '登录'; btn.disabled = false;
        return;
      }

      // 记住邮箱（不存储密码，避免安全风险）
      if (document.getElementById('authRememberMe').checked) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      currentUserId = result.data.user.id;
      enterApp();
    } catch (err) {
      errEl.textContent = err.message === 'Invalid login credentials' ? '邮箱或密码错误' : err.message;
      errEl.style.color = ''; errEl.style.background = '';
      errEl.classList.remove('hidden');
      btn.textContent = authMode === 'login' ? '登录' : '注册';
      btn.disabled = false;
    }
  }

  function enterApp() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('page-auth').style.display = 'none';
    document.getElementById('page-home').classList.add('active');
    // 设置用户名和头像（取邮箱首字母）
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user && user.email) {
        const initial = user.email.charAt(0).toUpperCase();
        document.getElementById('userAvatar').textContent = initial;
        document.getElementById('userName').textContent = user.email;
      }
    });
    // 不显示默认角色标签（切换按钮已足够）
    // 触发项目加载
    if (typeof loadProjectsFromDB === 'function') loadProjectsFromDB();
  }

  // 头像浮层
  function toggleAvatarMenu(e) {
    e.stopPropagation();
    document.getElementById('avatarMenu').classList.toggle('hidden');
  }
  document.addEventListener('click', () => {
    const menu = document.getElementById('avatarMenu');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
  });

  async function handleLogout() {
    await sb.auth.signOut();
    currentUserId = null;
    currentProjectId = null;
    document.getElementById('page-home').classList.remove('active');
    document.getElementById('page-auth').style.display = '';
    document.getElementById('page-auth').classList.add('active');
    // 清空项目列表
    const grid = document.getElementById('projectGrid');
    if (grid) grid.innerHTML = '';
    renderHome();
  }

  // ---- 忘记密码 ----
  function showForgotPassword(e) {
    e.preventDefault();
    document.getElementById('forgotPasswordForm').classList.remove('hidden');
    document.getElementById('forgotPasswordSection').classList.add('hidden');
    document.getElementById('authSubmit').classList.add('hidden');
    document.getElementById('authToggleRow').classList.add('hidden');
    document.getElementById('resetEmail').value = document.getElementById('authEmail').value;
  }
  function hideForgotPassword(e) {
    e.preventDefault();
    document.getElementById('forgotPasswordForm').classList.add('hidden');
    document.getElementById('forgotPasswordSection').classList.remove('hidden');
    document.getElementById('authSubmit').classList.remove('hidden');
    document.getElementById('authToggleRow').classList.remove('hidden');
    document.getElementById('resetMsg').classList.add('hidden');
  }
  async function sendResetEmail() {
    const email = document.getElementById('resetEmail').value.trim();
    const msgEl = document.getElementById('resetMsg');
    const btn = document.getElementById('resetBtn');
    if (!email) { msgEl.textContent = '请输入邮箱'; msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-red-500 bg-red-50'; msgEl.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = '发送中…';
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '?type=recovery'
      });
      if (error) throw error;
      msgEl.textContent = '重置链接已发送，请查收邮箱（含垃圾箱）';
      msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-green-600 bg-green-50';
      msgEl.classList.remove('hidden');
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-red-500 bg-red-50';
      msgEl.classList.remove('hidden');
    }
    btn.disabled = false; btn.textContent = '发送';
  }
  async function submitNewPassword() {
    const pw = document.getElementById('newPassword').value;
    const pw2 = document.getElementById('newPasswordConfirm').value;
    const msgEl = document.getElementById('newPwdMsg');
    const btn = document.getElementById('newPwdBtn');
    if (!pw || pw.length < 6) { msgEl.textContent = '密码至少 6 位'; msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-red-500 bg-red-50'; msgEl.classList.remove('hidden'); return; }
    if (pw !== pw2) { msgEl.textContent = '两次密码不一致'; msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-red-500 bg-red-50'; msgEl.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = '重置中…';
    try {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      msgEl.textContent = '密码重置成功！正在进入…';
      msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-green-600 bg-green-50';
      msgEl.classList.remove('hidden');
      setTimeout(() => {
        // 清除 URL hash
        history.replaceState(null, '', window.location.pathname);
        const sess = sb.auth.getSession();
        sess.then(({ data: { session } }) => {
          if (session) { currentUserId = session.user.id; enterApp(); }
        });
      }, 1000);
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'text-xs rounded-lg px-3 py-2 mt-2 text-red-500 bg-red-50';
      msgEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = '确认重置';
    }
  }

  // 检测 URL 是否为密码重置回调（Supabase 会在 hash 里带 type=recovery）
  function checkPasswordRecovery() {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Supabase 自动从 hash 恢复 session，显示新密码表单
      setTimeout(() => {
        document.getElementById('authSubmit').classList.add('hidden');
        document.getElementById('forgotPasswordSection').classList.add('hidden');
        document.getElementById('authToggleRow').classList.add('hidden');
        document.getElementById('newPasswordForm').classList.remove('hidden');
        // 隐藏邮箱和密码输入
        document.querySelectorAll('#page-auth .field').forEach(f => f.classList.add('hidden'));
      }, 500);
    }
  }

  // 恢复记住的邮箱（等 DOM 就绪后执行）
  document.addEventListener('DOMContentLoaded', function restoreRemembered() {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) { const el = document.getElementById('authEmail'); if (el) el.value = savedEmail; }
    // 清理旧版本可能残留的密码存储
    localStorage.removeItem('rememberedPassword');
  });

  // 检查已有登录状态
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      currentUserId = session.user.id;
      enterApp();
    }
    // 检查是否为密码重置回调
    checkPasswordRecovery();
  });
