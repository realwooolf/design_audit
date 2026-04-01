// ── HTML escape utility (XSS prevention) ──────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Dropdown toggle ────────────────────────────────────────────
function toggleDropdown(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const willOpen = el.classList.contains('hidden');
  // 关闭所有下拉并恢复卡片层级
  document.querySelectorAll('.issue-dd').forEach(d => {
    d.classList.add('hidden');
    const card = d.closest('.issue-card');
    if (card) card.style.zIndex = '';
  });
  if (willOpen) {
    // 动态填充状态下拉选项
    if (id.startsWith('sd-')) {
      const statuses = currentRole === 'dev'
        ? [{ key:'已修改', label:'已修改', dot:'bg-blue-500' }, { key:'暂不修改', label:'暂不修改', dot:'bg-yellow-500' }, { key:'请求说明', label:'请求说明', dot:'bg-indigo-500' }]
        : getStatuses();
      el.innerHTML = statuses.map(s =>
        `<div class="issue-dd-item" onclick="event.stopPropagation();selectStatusItem(this)"><span class="w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0"></span>${s.label}</div>`
      ).join('');
    }
    // 动态填充人员下拉 — 飞书风格
    if (id.startsWith('ad-')) {
      el.classList.add('feishu-picker');
      renderFeishuPicker(el, '');
    }
    el.classList.remove('hidden');
    // 提升当前卡片层级，防止下拉被后续卡片遮挡
    const card = el.closest('.issue-card');
    if (card) card.style.zIndex = '10';
    setTimeout(() => {
      const close = () => {
        el.classList.add('hidden');
        if (card) card.style.zIndex = '';
        document.removeEventListener('click', close);
      };
      document.addEventListener('click', close);
    }, 0);
  }
}

// ── Workbench state ────────────────────────────────────────────
let selectedIssueId = null;

function renderWorkbenchRole() {
  const isDev = currentRole === 'dev';
  const avatar = document.getElementById('wbUserAvatar');
  const uname = document.getElementById('wbUserName');
  const urole = document.getElementById('wbUserRole');
  if (avatar) {
    avatar.textContent = isDev ? '开' : '设';
    avatar.className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ' + (isDev ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700');
  }
  // 工作台用户名 — 用邮箱用户名，不写死
  // (enterApp 已设好 userName，这里不覆盖)
  if (urole) urole.textContent = isDev ? '开发工程师' : '设计师';

  // Toggle role-specific action buttons only (4,5,6,7 have real role actions)
  ['4','5','6','7','8'].forEach(n => {
    const da = document.getElementById(`actions-designer-issue-${n}`);
    const dv = document.getElementById(`actions-dev-issue-${n}`);
    if (da) { if (isDev) da.classList.add('hidden'); else da.classList.remove('hidden'); }
    if (dv) { if (!isDev) dv.classList.add('hidden'); else dv.classList.remove('hidden'); }
  });

  // Toggle AI blocks
  document.querySelectorAll('.dev-only').forEach(el => {
    el.style.display = isDev ? 'block' : 'none';
  });
  // Toggle designer-only elements (delete buttons)
  document.querySelectorAll('.designer-only').forEach(el => {
    el.style.display = isDev ? 'none' : '';
  });
  // Sync status tabs and card labels to current role
  renderStatusTabs();
  syncStatusLabels();
  rebuildList();
}

function selectIssue(id) {
  if (selectedIssueId) {
    const prev = document.getElementById(selectedIssueId);
    if (prev) prev.classList.remove('selected');
  }
  selectedIssueId = id;
  const el = document.getElementById(id);
  if (el) el.classList.add('selected');
  // Dim all annotations, highlight matching ones
  document.querySelectorAll('.issue-anno').forEach(a => {
    a.classList.add('dimmed');
    a.classList.remove('anno-active');
    a.style.boxShadow = '';
  });
  const matchingAnnos = document.querySelectorAll(`.issue-anno[data-issue-id="${id}"], .issue-anno[onclick*="${id}"]`);
  matchingAnnos.forEach(a => {
    a.classList.remove('dimmed');
    a.classList.add('anno-active');
    a.style.boxShadow = '0 0 0 3px rgba(198,93,59,.3)';
  });
  // 高亮模式下重绘 canvas，突出选中区域
  if (currentAnnoMode === 'spotlight') refreshSpotlightCanvas();
}

function deselectIssue() {
  if (selectedIssueId) {
    const prev = document.getElementById(selectedIssueId);
    if (prev) prev.classList.remove('selected');
    selectedIssueId = null;
  }
  // Restore all annotations
  document.querySelectorAll('.issue-anno').forEach(a => {
    a.classList.remove('dimmed');
    a.classList.remove('anno-active');
    a.style.boxShadow = '';
  });
  // 高亮模式下恢复 canvas
  if (currentAnnoMode === 'spotlight') refreshSpotlightCanvas();
}

function highlightIssue(id) {
  const card = document.getElementById(id);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('highlighted');
    setTimeout(() => card.classList.remove('highlighted'), 2000);
    selectIssue(id);
  }
}

function assignIssue(id) {
  showToast('已分配给开发 · 张伟');
  const card = document.getElementById(id);
  if (card) {
    const badges = card.querySelectorAll('.status-badge');
    // move to assigned section visually via toast
  }
}

function ignoreIssue(id) {
  const card = document.getElementById(id);
  if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
  showToast('已标记为忽略');
}

function devProcess(id) {
  showToast('已标记为处理中');
}

function approveIssue(id) {
  const card = document.getElementById(id);
  if (card) { card.style.opacity = '0.5'; }
  showToast('复核通过，问题已关闭 ✓');
}

function rejectIssue(id) {
  showToast('已退回，通知开发重新修改');
}

function reopenIssue(id) {
  const card = document.getElementById(id);
  if (card) {
    card.style.opacity = '';
    card.classList.remove('opacity-60');
    card.dataset.status = '待分配';
  }
  showToast('已撤销关闭，问题重新打开');
  rebuildList();
  if (currentProjectId) {
    const num = parseInt(id.replace('issue-', ''));
    sb.from('issues').update({ status: '待分配', updated_at: new Date().toISOString() })
      .eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
  }
}

let verifyTargetId = null;
let verifySelectedFile = null;
const VERIFY_FAIL_REASONS = [
  '颜色仍有细微偏差（差异约 5%）',
  '间距与设计稿不一致，差异约 2px',
  '字重不匹配，实际为 Regular，设计稿要求 Medium',
  '圆角值偏小，实际 6px，预期 8px',
  '元素位置偏移，水平方向偏差约 4px',
];

function uploadVerify(id) {
  verifyTargetId = id;
  verifySelectedFile = null;
  const fi = document.getElementById('verifyFileInput');
  if (fi) fi.value = '';
  document.getElementById('uploadArea').innerHTML = `
    <svg class="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
    <div class="text-sm text-gray-400">点击上传修改后截图</div>
    <div class="text-xs text-gray-300 mt-1">PNG / JPG，建议同等分辨率</div>
  `;
  openWBDialog('dialog-verify');
}

function handleVerifyFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  verifySelectedFile = file;
  const url = URL.createObjectURL(file);
  document.getElementById('uploadArea').innerHTML = `
    <img src="${url}" style="max-height:120px;max-width:100%;border-radius:8px;margin:0 auto 8px;display:block;">
    <div class="text-green-500 text-sm font-medium">✓ ${escHtml(file.name)}</div>
    <div class="text-xs text-gray-400 mt-1">点击可重新选择 · 点击「提交校验」开始 AI 校验</div>
  `;
}

function requestExplain(id) { showToast('已向设计师发送说明请求'); }

function getOrCreateVerifySlot(card) {
  const id = card.id;
  let slot = document.getElementById(`verify-slot-${id}`);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = `verify-slot-${id}`;
    const metaGrid = card.querySelector('.meta-grid');
    if (metaGrid) card.insertBefore(slot, metaGrid);
    else card.appendChild(slot);
  }
  return slot;
}

// File → base64 (返回纯 base64，不含 data:... 前缀)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    // 先缩放到合理尺寸再转 base64
    const img = new Image();
    img.onload = () => {
      const maxW = 1500;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('图片加载失败')); };
    img.src = URL.createObjectURL(file);
  });
}

// 从 issue ID 定位画布上的设计稿图片和标注区域
function findDesignImageForIssue(issueId) {
  const anno = document.querySelector(`.issue-anno[data-issue-id="${issueId}"]`);
  if (!anno) return null;
  const pair = anno.closest('.canvas-pair');
  if (!pair) return null;
  const designWrap = pair.querySelector('[data-type="design"]');
  if (!designWrap) return null;
  const img = designWrap.querySelector('img');
  const area = anno.style.cssText ? {
    left: anno.style.left, top: anno.style.top,
    width: anno.style.width, height: anno.style.height
  } : null;
  return { img, area };
}

function renderVerifyPass(slot, card, summary) {
  slot.className = 'bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 mb-2 flex items-center gap-2';
  slot.innerHTML = `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#22c55e" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> 已上传核验图 · AI 校验通过${summary ? ' · ' + escHtml(summary) : ''} · 等待设计师验收`;
}

function renderVerifyFail(slot, card, reason) {
  const cid = card.id;
  slot.className = 'bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 mb-2';
  slot.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#dc2626" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      <span class="font-medium">AI 校验未通过</span>
    </div>
    <div class="text-red-500 mt-1">${escHtml(reason)}</div>
    <button onclick="event.stopPropagation();uploadVerify('${cid}')" class="mt-2 text-xs text-blue-500 hover:underline cursor-pointer bg-transparent border-none p-0">重新上传核验图</button>
  `;
}

function submitVerifyMock(slot, card) {
  const pass = Math.random() > 0.3;
  setTimeout(() => {
    if (pass) {
      renderVerifyPass(slot, card, '');
      showToast('AI 校验通过，已通知设计师确认');
    } else {
      const reason = VERIFY_FAIL_REASONS[Math.floor(Math.random() * VERIFY_FAIL_REASONS.length)];
      renderVerifyFail(slot, card, reason);
      showToast('AI 校验未通过，请检查修改');
    }
    verifyTargetId = null;
  }, 2000);
}

async function submitVerify() {
  if (!verifySelectedFile) {
    showToast('请先选择截图文件');
    return;
  }
  closeWBDialog('dialog-verify');
  const id = verifyTargetId;
  if (!id) return;
  const card = document.getElementById(id);
  if (!card) return;

  const slot = getOrCreateVerifySlot(card);
  slot.className = 'rounded-lg px-3 py-2 text-xs text-gray-500 mb-2 flex items-center gap-2 bg-gray-100';
  slot.innerHTML = `<div style="width:12px;height:12px;border:2px solid #C65D3B;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div> AI 校验中…`;

  // 查找设计稿图片
  const designInfo = findDesignImageForIssue(id);
  if (!designInfo || !designInfo.img) {
    // 无真实设计稿图片，fallback mock
    submitVerifyMock(slot, card);
    return;
  }

  try {
    const [verifyB64, designB64] = await Promise.all([
      fileToBase64(verifySelectedFile),
      Promise.resolve(imgToBase64(designInfo.img))
    ]);
    const issueTitle = card.querySelector('.text-xs.font-medium')?.textContent || '';

    const _verifyAC = new AbortController();
    const _verifyTimeout = setTimeout(() => _verifyAC.abort(), 120000);
    const resp = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        designImage: designB64,
        verifyImage: verifyB64,
        issueArea: designInfo.area,
        issueTitle: issueTitle
      }),
      signal: _verifyAC.signal,
    });
    clearTimeout(_verifyTimeout);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || '校验服务异常');
    }
    const data = await resp.json();
    if (data.pass) {
      renderVerifyPass(slot, card, data.summary || '');
      showToast('AI 校验通过，已通知设计师确认');
    } else {
      renderVerifyFail(slot, card, data.details || data.summary || '修改未达到设计稿要求');
      showToast('AI 校验未通过，请检查修改');
    }
    verifyTargetId = null;
  } catch (err) {
    // API 不可用或超时，fallback mock
    showToast(err.name === 'AbortError' ? '校验请求超时，使用模拟校验' : 'API 不可用，使用模拟校验');
    submitVerifyMock(slot, card);
  }
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  if (body.style.display === 'none') {
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    icon.style.transform = '';
  } else {
    body.style.display = 'none';
    icon.style.transform = 'rotate(-90deg)';
  }
}

/* ── Status switch + sub-filters ──────────────────────────── */
let currentStatus = '';
let allIssueCards = []; // persistent reference to all cards
const DESIGNER_STATUSES = [
  { key:'待分配', label:'待分配', color:'text-gray-500', bg:'bg-gray-100 text-gray-500', dot:'bg-gray-400' },
  { key:'待修改', label:'待修改', color:'text-blue-500', bg:'bg-blue-50 text-blue-500', dot:'bg-blue-500' },
  { key:'待验收', label:'待验收', color:'text-purple-600', bg:'bg-purple-50 text-purple-600', dot:'bg-purple-500' },
  { key:'验收通过', label:'验收通过', color:'text-green-500', bg:'bg-green-50 text-green-500', dot:'bg-green-500' },
  { key:'继续修改', label:'继续修改', color:'text-orange-500', bg:'bg-orange-50 text-orange-500', dot:'bg-orange-500' },
  { key:'暂不修改', label:'暂不修改', color:'text-yellow-600', bg:'bg-yellow-50 text-yellow-600', dot:'bg-yellow-500' },
  { key:'请求说明', label:'请求说明', color:'text-indigo-500', bg:'bg-indigo-50 text-indigo-500', dot:'bg-indigo-500' },
];
const DEV_STATUSES = [
  { key:'待修改', label:'待修改', color:'text-gray-500', bg:'bg-gray-100 text-gray-500', dot:'bg-gray-400' },
  { key:'已修改', label:'已修改', color:'text-blue-500', bg:'bg-blue-50 text-blue-500', dot:'bg-blue-500' },
  { key:'验收通过', label:'验收通过', color:'text-green-500', bg:'bg-green-50 text-green-500', dot:'bg-green-500' },
  { key:'继续修改', label:'继续修改', color:'text-orange-500', bg:'bg-orange-50 text-orange-500', dot:'bg-orange-500' },
  { key:'暂不修改', label:'暂不修改', color:'text-yellow-600', bg:'bg-yellow-50 text-yellow-600', dot:'bg-yellow-500' },
  { key:'请求说明', label:'请求说明', color:'text-indigo-500', bg:'bg-indigo-50 text-indigo-500', dot:'bg-indigo-500' },
];
function getStatuses() { return currentRole === 'dev' ? DEV_STATUSES : DESIGNER_STATUSES; }
// Active statuses for current role
let STATUS_SECTIONS = DESIGNER_STATUSES;

// Canonical (designer) status → dev display label
const STATUS_TO_DEV = {
  '待分配': '待修改',
  '待验收': '已修改', '验收通过': '验收通过', '继续修改': '继续修改',
  '暂不修改': '暂不修改', '请求说明': '请求说明',
};
// Dev selection → canonical status
const DEV_TO_CANONICAL = {
  '待修改': '待修改', '已修改': '待验收',
  '验收通过': '验收通过', '继续修改': '继续修改',
  '暂不修改': '暂不修改', '请求说明': '请求说明',
};
function getDisplayStatus(canonical) {
  return currentRole === 'dev' ? (STATUS_TO_DEV[canonical] || canonical) : canonical;
}
// 根据角色更新每张卡片「修改进展」下拉选项
function syncStatusDropdowns() {
  document.querySelectorAll('[id^="sd-"]').forEach(dd => {
    if (currentRole === 'dev') {
      dd.innerHTML = [{ key:'已修改', dot:'bg-blue-500' }, { key:'暂不修改', dot:'bg-yellow-500' }, { key:'请求说明', dot:'bg-indigo-500' }].map(s =>
        `<div class="issue-dd-item" onclick="event.stopPropagation();selectStatusItem(this)"><span class="w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0"></span>${s.key}</div>`
      ).join('');
    } else {
      dd.innerHTML = DESIGNER_STATUSES.map(s =>
        `<div class="issue-dd-item" onclick="event.stopPropagation();selectStatusItem(this)"><span class="w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0"></span>${s.label}</div>`
      ).join('');
    }
  });
}

function syncStatusLabels() {
  const allStatuses = [...DESIGNER_STATUSES, ...DEV_STATUSES];
  document.querySelectorAll('.issue-card').forEach(card => {
    const canonical = card.dataset.status;
    const display = getDisplayStatus(canonical);
    const s = allStatuses.find(x => x.key === display);
    const sdEl = card.querySelector('[id^="sd-"]');
    if (!sdEl) return;
    const trigger = sdEl.previousElementSibling;
    if (!trigger) return;
    const dot = trigger.querySelector('span.rounded-full');
    const label = trigger.querySelector('span.flex-1');
    if (dot && s) dot.className = `w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0`;
    if (label && s) { label.textContent = display; label.className = 'flex-1 ' + s.color; }
  });
}

function updateStatusCounts() {
  if (!allIssueCards.length) return;
  const statuses = getStatuses();
  const counts = { '':allIssueCards.length };
  statuses.forEach(g => { counts[g.key] = allIssueCards.filter(c => getDisplayStatus(c.dataset.status) === g.key).length; });
  document.querySelectorAll('#statusTabs .status-tab').forEach(btn => {
    const val = btn.getAttribute('onclick').match(/'([^']*)'/)[1];
    const span = btn.querySelector('.status-tab-count');
    if (span) span.textContent = counts[val] || 0;
  });
}

function renderStatusTabs() {
  const container = document.getElementById('statusTabs');
  if (!container) return;
  const statuses = getStatuses();
  let html = `<button onclick="switchStatus('')" class="status-tab active">全部 <span class="status-tab-count">0</span></button>`;
  statuses.forEach(s => {
    html += `<button onclick="switchStatus('${s.key}')" class="status-tab">${s.label} <span class="status-tab-count">0</span></button>`;
  });
  container.innerHTML = html;
  currentStatus = '';
  updateStatusCounts();
}

function switchStatus(status) {
  currentStatus = status;
  document.querySelectorAll('#statusTabs .status-tab').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('#statusTabs .status-tab');
  btns.forEach(b => {
    const val = b.getAttribute('onclick').match(/'([^']*)'/)[1];
    if (val === status) b.classList.add('active');
  });
  rebuildList();
}

function rebuildList() {
  const list = document.getElementById('issueList');
  // First call: collect all cards into persistent array
  if (!allIssueCards.length) {
    allIssueCards = Array.from(list.querySelectorAll('.issue-card'));
  }
  // 按编号排序（从 id 提取数字 issue-N）
  allIssueCards.sort((a, b) => {
    const na = parseInt(a.id.replace('issue-', '')) || 0;
    const nb = parseInt(b.id.replace('issue-', '')) || 0;
    return na - nb;
  });
  // Detach all cards, then clear wrappers
  allIssueCards.forEach(c => c.remove());
  while (list.firstChild) list.removeChild(list.firstChild);

  if (currentStatus) {
    // Single status: flat list, no section headers
    const body = document.createElement('div');
    body.className = 'space-y-1.5';
    allIssueCards.filter(c => getDisplayStatus(c.dataset.status) === currentStatus).forEach(c => { c.style.display = ''; body.appendChild(c); });
    list.appendChild(body);
  } else {
    // "全部": flat list, no section headers
    const body = document.createElement('div');
    body.className = 'space-y-1.5';
    allIssueCards.forEach(c => { c.style.display = ''; body.appendChild(c); });
    list.appendChild(body);
  }
  applyFilters();
  updateStatusCounts();
  renderStats();
}

function applyFilters() {
  const type = document.getElementById('filterType').value;
  const priority = document.getElementById('filterPriority').value;
  document.querySelectorAll('#issueList .issue-card').forEach(card => {
    const ok = (!type || card.dataset.type === type) && (!priority || card.dataset.priority === priority);
    card.style.display = ok ? '' : 'none';
  });
  // Update section counts and hide empty sections (only in "全部" view)
  document.querySelectorAll('#issueList > .mb-1').forEach(section => {
    const body = section.querySelector('.section-body');
    if (!body) return;
    const visible = body.querySelectorAll('.issue-card:not([style*="display: none"])');
    const badge = section.querySelector('.rounded-full.font-medium');
    if (badge) badge.textContent = visible.length;
    section.style.display = visible.length ? '' : 'none';
  });
  // Empty state
  const list = document.getElementById('issueList');
  let empty = list.querySelector('.empty-state');
  const visibleCards = list.querySelectorAll('.issue-card:not([style*="display: none"])');
  if (visibleCards.length === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'empty-state text-center py-16 text-gray-400 text-xs';
      empty.textContent = '当前条件下暂无内容';
      list.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}


function openWBDialog(id) { document.getElementById(id).classList.add('open'); }
function closeWBDialog(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'dialog-feishu') {
    document.getElementById('feishu-search-input').value = '';
    document.getElementById('feishu-results').innerHTML = '<div class="text-xs text-gray-400 text-center py-6">输入姓名开始搜索</div>';
  }
}

// ── Feishu member search simulation ────────────────────────────
// ── 飞书通讯录成员（项目组 + 扩展搜索） ──
const FEISHU_TEAM = [
  { name: '张伟', dept: '前端工程部', role: '前端工程师', initials: '张', bg: '#16a34a', online: true },
  { name: '李明', dept: '前端工程部', role: '前端工程师', initials: '李', bg: '#2563eb', online: true },
  { name: '王芳', dept: '后端工程部', role: '后端工程师', initials: '王', bg: '#d97706', online: false },
  { name: '小雨', dept: 'UX 设计部', role: 'UI 设计师', initials: '雨', bg: '#9333ea', online: true },
];
const FEISHU_USERS = [
  { name: '陈明', dept: '产品设计部', role: '产品经理', initials: '陈', bg: '#C65D3B', tag: '外部' },
  { name: '刘洋', dept: '前端工程部', role: '前端工程师', initials: '刘', bg: '#7c3aed', tag: '内部' },
  { name: '赵婷', dept: 'UX 设计部', role: 'UX 设计师', initials: '赵', bg: '#db2777', tag: '外部' },
  { name: '孙浩', dept: '后端工程部', role: '后端工程师', initials: '孙', bg: '#d97706', tag: '内部' },
  { name: '吴静', dept: '测试部', role: 'QA 工程师', initials: '吴', bg: '#059669', tag: '外部' },
  { name: '周磊', dept: '移动开发部', role: 'iOS 工程师', initials: '周', bg: '#dc2626', tag: '内部' },
];
let feishuSearchTimer = null;
let feishuTargetAssigneeDropdown = null;

// ── Card inline comment handler ─────────────────────────────────
function sendCardComment(inputId, timelineId) {
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;
  const tl = document.getElementById(timelineId);
  const now = new Date();
  const h = now.getHours(), m = String(now.getMinutes()).padStart(2,'0');
  const timeStr = `今天 ${h}:${m} ${h < 12 ? 'AM' : 'PM'}`;
  const item = document.createElement('div');
  item.className = 'flex items-start gap-2 fade-in';
  item.innerHTML = `<div class="timeline-avatar bg-blue-100 text-blue-700">我</div><div class="flex-1 min-w-0"><div class="text-xs text-gray-800">${escHtml(text)}</div><div class="text-xs text-gray-400 mt-0.5">${escHtml(timeStr)}</div></div>`;
  tl.appendChild(item);
  input.value = '';
  // 保存评论到 Supabase
  if (currentProjectId) {
    const card = tl.closest('.issue-card');
    if (card) {
      const num = parseInt(card.id.replace('issue-', ''));
      sb.from('issues').select('id').eq('project_id', currentProjectId).eq('issue_number', num).single()
        .then(({ data }) => { if (data) return sb.from('comments').insert({ issue_id: data.id, text: text }); })
        .then(res => { if (res && res.error) console.error('Comment save failed:', res.error); });
    }
  }
  // Update toggle label to show comment count
  const count = tl.querySelectorAll('.flex.items-start').length;
  const toggle = tl.closest('.card-timeline-section').previousElementSibling;
  if (toggle) {
    const arrow = toggle.querySelector('.tl-arrow');
    toggle.innerHTML = '';
    if (arrow) toggle.appendChild(arrow);
    toggle.appendChild(document.createTextNode(` 评论 · ${count}条`));
  }
}


// ── 评论输入框 Enter 键支持（事件委托） ──────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const input = e.target;
  if (!input.matches || !input.matches('.card-timeline-section input[type="text"]')) return;
  const sendBtn = input.parentElement.querySelector('.comment-send');
  if (sendBtn) sendBtn.click();
});

// ── Dropdown selection handlers ─────────────────────────────────
function selectStatusItem(el) {
  const dd = el.closest('.issue-dd');
  const text = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim()).join('').trim();
  dd.classList.add('hidden');

  // 「继续修改」需要填写备注
  if (text === '继续修改') {
    const mask = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = '继续修改';
    document.getElementById('confirmDesc').innerHTML = '<textarea id="remarkInput" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 mt-1" rows="3" placeholder="请填写问题及修改建议…"></textarea>';
    document.getElementById('confirmBtn').textContent = '确认提交';
    document.getElementById('confirmBtn').className = 'btn-primary';
    mask.classList.add('open');
    _confirmCb = function() {
      applyStatusChange(el, text);
      closeConfirm();
    };
    return;
  }
  // 「暂不修改」需要填写原因
  if (text === '暂不修改') {
    const mask = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = '暂不修改';
    document.getElementById('confirmDesc').innerHTML = '<textarea id="remarkInput" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 mt-1" rows="3" placeholder="请填写暂不修改的原因…"></textarea>';
    document.getElementById('confirmBtn').textContent = '确认提交';
    document.getElementById('confirmBtn').className = 'btn-primary';
    mask.classList.add('open');
    _confirmCb = function() {
      applyStatusChange(el, text);
      closeConfirm();
    };
    return;
  }
  // 「请求说明」需要填写内容
  if (text === '请求说明') {
    const mask = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = '请求说明';
    document.getElementById('confirmDesc').innerHTML = '<textarea id="remarkInput" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 mt-1" rows="3" placeholder="请描述需要设计师说明的内容…"></textarea>';
    document.getElementById('confirmBtn').textContent = '确认提交';
    document.getElementById('confirmBtn').className = 'btn-primary';
    mask.classList.add('open');
    _confirmCb = function() {
      applyStatusChange(el, text);
      closeConfirm();
    };
    return;
  }
  // 「验收通过」需要确认
  if (text === '验收通过') {
    const mask = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = '确定验收通过？';
    document.getElementById('confirmDesc').textContent = '验收通过后问题将标记为已解决。';
    document.getElementById('confirmBtn').textContent = '确认通过';
    document.getElementById('confirmBtn').className = 'btn-primary';
    mask.classList.add('open');
    _confirmCb = function() {
      applyStatusChange(el, text);
      closeConfirm();
    };
    return;
  }
  applyStatusChange(el, text);
}

function applyStatusChange(el, text) {
  const dd = el.closest('.issue-dd');
  // 校验：切到「待修改」时必须先分配人员
  if (text === '待修改') {
    const card = el.closest('.issue-card');
    if (card) {
      const adTrigger = card.querySelector('[id^="ad-"]')?.previousElementSibling;
      const assigneeLabel = adTrigger?.querySelector('span.flex-1');
      if (assigneeLabel && assigneeLabel.textContent.trim() === '未分配') {
        showToast('请先分配修改人员');
        return;
      }
    }
  }
  const trigger = dd.previousElementSibling;
  const dot = el.querySelector('span.rounded-full');
  const colorMap = {
    '待分配':'text-gray-500', '待修改':'text-blue-500', '待验收':'text-purple-600',
    '验收通过':'text-green-500', '继续修改':'text-orange-500',
    '已修改':'text-blue-500', '暂不修改':'text-yellow-600', '请求说明':'text-indigo-500'
  };
  const triggerDot = trigger.querySelector('span.rounded-full');
  if (triggerDot && dot) triggerDot.className = dot.className;
  const triggerLabel = trigger.querySelector('span.flex-1');
  if (triggerLabel) { triggerLabel.textContent = text; triggerLabel.className = 'flex-1 ' + (colorMap[text] || 'text-gray-600'); }
  const card = el.closest('.issue-card');
  const canonical = currentRole === 'dev' ? (DEV_TO_CANONICAL[text] || text) : text;
  if (card) {
    card.dataset.status = canonical;
    if (canonical === '验收通过') card.classList.add('opacity-60');
    else card.classList.remove('opacity-60');

    // dev 切到「已修改」/「继续修改」时更新 verify-slot
    if (currentRole === 'dev') {
      const slot = getOrCreateVerifySlot(card);
      if (canonical === '待验收') {
        slot.className = '';
        slot.innerHTML = `<button onclick="event.stopPropagation();uploadVerify('${card.id}')" class="w-full text-xs border border-dashed border-gray-300 text-gray-500 py-2 px-3 rounded-lg hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5 mb-2 mt-1">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          上传修改截图，AI 将自动校验是否还原正确
        </button>`;
      } else if (canonical === '继续修改') {
        slot.className = '';
        slot.innerHTML = `<button onclick="event.stopPropagation();uploadVerify('${card.id}')" class="w-full text-xs border border-dashed border-orange-300 text-orange-500 py-2 px-3 rounded-lg hover:bg-orange-50 transition-all flex items-center justify-center gap-1.5 mb-2 mt-1">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          重新上传修改截图，AI 将再次校验
        </button>`;
      } else {
        slot.className = '';
        slot.innerHTML = '';
      }
    }
  }
  // 保存状态到 Supabase
  if (card && currentProjectId) {
    const num = parseInt(card.id.replace('issue-', ''));
    sb.from('issues').update({ status: canonical, updated_at: new Date().toISOString() })
      .eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
  }
  rebuildList();
}

function selectAssigneeItem(el) {
  const dd = el.closest('.issue-dd');
  const trigger = dd.previousElementSibling;
  const srcAvatar = el.querySelector('div.rounded-full');
  // Only get plain text nodes, excluding child element text
  const name = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim()).join('').trim();
  trigger.classList.remove('text-gray-400');
  let triggerAvatar = trigger.querySelector('div.rounded-full');
  if (srcAvatar) {
    if (!triggerAvatar) {
      triggerAvatar = document.createElement('div');
      trigger.insertBefore(triggerAvatar, trigger.firstChild);
    }
    triggerAvatar.className = srcAvatar.className.replace('w-5 h-5', 'w-4 h-4');
    triggerAvatar.style.fontSize = '9px';
    triggerAvatar.textContent = srcAvatar.textContent;
  }
  const triggerLabel = trigger.querySelector('span.flex-1');
  if (triggerLabel) { triggerLabel.textContent = name; triggerLabel.className = 'flex-1 text-gray-700'; }
  dd.classList.add('hidden');

  // 保存分配人员到 Supabase
  const card = dd.closest('.issue-card');
  if (card && currentProjectId) {
    const num = parseInt(card.id.replace('issue-', ''));
    const avatar = trigger.querySelector('div.rounded-full');
    sb.from('issues').update({
      assignee_name: name, assignee_initials: avatar ? avatar.textContent : '', assignee_bg: avatar ? avatar.style.background : '',
      updated_at: new Date().toISOString()
    }).eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
  }

  // 分配人员后，若当前进展为「待分配」则自动变更为「待修改」
  if (card && card.dataset.status === '待分配') {
    const sdId = dd.id.replace('ad-', 'sd-');
    const statusDd = document.getElementById(sdId);
    if (statusDd) {
      const sTrigger = statusDd.previousElementSibling;
      const sDot = sTrigger.querySelector('span.rounded-full');
      if (sDot) sDot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0';
      const sLabel = sTrigger.querySelector('span.flex-1');
      if (sLabel) { sLabel.textContent = '待修改'; sLabel.className = 'flex-1 text-blue-500'; }
    }
    card.dataset.status = '待修改';
    updateStatusCounts();
  }
}

function feishuAddFromDropdown(el) {
  const dd = el.closest('.issue-dd');
  openFeishuDialog(dd ? dd.id : null);
}

function renderFeishuPicker(el, query) {
  const q = (query || '').trim().toLowerCase();
  // 合并项目组 + 扩展成员
  const allMembers = FEISHU_TEAM.map(u => ({ ...u, tag: '项目组' })).concat(
    FEISHU_USERS.map(u => ({ ...u, online: false }))
  );
  const filtered = q ? allMembers.filter(u => u.name.includes(q) || u.dept.includes(q) || u.role.includes(q)) : FEISHU_TEAM.map(u => ({ ...u, tag: '项目组' }));
  const ddId = el.id;
  const itemsHtml = filtered.length
    ? filtered.map(u => {
        const onlineDot = u.online ? `<div class="online-dot" style="background:#22c55e"></div>` : `<div class="online-dot" style="background:#d1d5db"></div>`;
        const tagHtml = u.tag === '项目组'
          ? `<span class="utag" style="background:#eff6ff;color:#3b82f6;">项目组</span>`
          : u.tag === '外部'
          ? `<span class="utag" style="background:#fff7ed;color:#f97316;">外部</span>`
          : `<span class="utag" style="background:#eff6ff;color:#3b82f6;">内部</span>`;
        return `<div class="feishu-picker-item" onclick="event.stopPropagation();feishuPickerSelect(this,'${ddId}','${u.name}','${u.role}','${u.initials}','${u.bg}')">
          <div class="feishu-picker-avatar"><div class="avatar-circle" style="background:${u.bg}">${u.initials}</div>${onlineDot}</div>
          <div class="feishu-picker-info"><div class="name-row"><span class="uname">${u.name}</span>${tagHtml}</div><div class="udept">${u.role} · ${u.dept}</div></div>
        </div>`;
      }).join('')
    : `<div class="feishu-picker-empty">未找到匹配成员</div>`;

  el.innerHTML = `
    <div class="feishu-picker-search">
      <input type="text" placeholder="搜索成员..." value="${query || ''}" oninput="event.stopPropagation();feishuPickerFilter(this)" onclick="event.stopPropagation();" />
    </div>
    <div class="feishu-picker-list">${itemsHtml}</div>
    <div class="feishu-picker-footer" onclick="event.stopPropagation();feishuAddFromDropdown(this)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3370FF" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
      <span>搜索更多飞书成员</span>
    </div>`;
}

function feishuPickerFilter(input) {
  const dd = input.closest('.issue-dd');
  if (dd) renderFeishuPicker(dd, input.value);
  // 重新聚焦搜索框并恢复光标
  setTimeout(() => {
    const newInput = dd.querySelector('.feishu-picker-search input');
    if (newInput) { newInput.focus(); newInput.setSelectionRange(newInput.value.length, newInput.value.length); }
  }, 0);
}

function feishuPickerSelect(el, ddId, name, role, initials, bg) {
  const dd = document.getElementById(ddId);
  if (!dd) return;
  const trigger = dd.previousElementSibling;
  trigger.classList.remove('text-gray-400');
  let triggerAvatar = trigger.querySelector('div.rounded-full');
  if (!triggerAvatar) { triggerAvatar = document.createElement('div'); trigger.insertBefore(triggerAvatar, trigger.firstChild); }
  triggerAvatar.className = 'w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold';
  triggerAvatar.style.cssText = `background:${bg};font-size:9px`;
  triggerAvatar.textContent = initials;
  const triggerLabel = trigger.querySelector('span.flex-1');
  if (triggerLabel) { triggerLabel.textContent = name; triggerLabel.className = 'flex-1 text-gray-700'; }
  dd.classList.add('hidden');
  // 保存到 Supabase
  const card = dd.closest('.issue-card');
  if (card && currentProjectId) {
    const num = parseInt(card.id.replace('issue-', ''));
    sb.from('issues').update({ assignee_name: name, assignee_initials: initials, assignee_bg: bg, updated_at: new Date().toISOString() })
      .eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
  }
  // 自动变更状态
  if (card && card.dataset.status === '待分配') {
    const sdId = dd.id.replace('ad-', 'sd-');
    const statusDd = document.getElementById(sdId);
    if (statusDd) {
      const sTrigger = statusDd.previousElementSibling;
      const sDot = sTrigger.querySelector('span.rounded-full');
      if (sDot) sDot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0';
      const sLabel = sTrigger.querySelector('span.flex-1');
      if (sLabel) { sLabel.textContent = '待修改'; sLabel.className = 'flex-1 text-blue-500'; }
    }
    card.dataset.status = '待修改';
    updateStatusCounts();
  }
}

function openFeishuDialog(assigneeDropdownId) {
  feishuTargetAssigneeDropdown = assigneeDropdownId;
  document.querySelectorAll('.issue-dd').forEach(d => d.classList.add('hidden'));
  document.getElementById('dialog-feishu').classList.add('open');
  setTimeout(() => document.getElementById('feishu-search-input').focus(), 100);
}

function feishuSearch(q) {
  clearTimeout(feishuSearchTimer);
  const spinner = document.getElementById('feishu-search-spinner');
  const results = document.getElementById('feishu-results');
  if (!q.trim()) {
    spinner.classList.add('hidden');
    results.innerHTML = '<div class="text-xs text-gray-400 text-center py-6">输入姓名开始搜索</div>';
    return;
  }
  spinner.classList.remove('hidden');
  results.innerHTML = '';
  feishuSearchTimer = setTimeout(() => {
    spinner.classList.add('hidden');
    const matched = FEISHU_USERS.filter(u => u.name.includes(q) || u.role.includes(q) || u.dept.includes(q));
    if (!matched.length) {
      results.innerHTML = '<div class="text-xs text-gray-400 text-center py-6">未找到匹配成员</div>';
      return;
    }
    results.innerHTML = matched.map(u => `
      <div onclick="feishuSelectUser('${u.name}','${u.role}','${u.initials}','${u.bg}')"
           class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style="background:${u.bg}">${u.initials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium text-gray-900">${u.name}</span>
            <span class="text-xs px-1.5 py-0.5 rounded-full font-medium ${u.tag === '外部' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}">${u.tag}</span>
          </div>
          <div class="text-xs text-gray-400 truncate">${u.role} · ${u.dept}</div>
        </div>
        <div class="w-5 h-5 rounded-full border-2 border-gray-200 group-hover:border-blue-400 flex items-center justify-center transition-colors flex-shrink-0">
          <svg class="w-3 h-3 text-blue-500 hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        </div>
      </div>`).join('');
  }, 550);
}

function feishuSelectUser(name, role, initials, bg) {
  closeWBDialog('dialog-feishu');
  showToast(`已添加 ${name} (${role}) 为协作成员`);

  // 将新成员加入项目组列表（去重），后续下拉渲染可见
  if (!FEISHU_TEAM.some(u => u.name === name)) {
    FEISHU_TEAM.push({ name, dept: FEISHU_USERS.find(u => u.name === name)?.dept || '', role, initials, bg, online: false });
  }

  if (feishuTargetAssigneeDropdown) {
    const dd = document.getElementById(feishuTargetAssigneeDropdown);
    if (dd) {
      // 更新 trigger 显示选中的人
      const trigger = dd.previousElementSibling;
      if (trigger) {
        trigger.classList.remove('text-gray-400');
        let triggerAvatar = trigger.querySelector('div.rounded-full');
        if (!triggerAvatar) { triggerAvatar = document.createElement('div'); trigger.insertBefore(triggerAvatar, trigger.firstChild); }
        triggerAvatar.className = 'w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold';
        triggerAvatar.style.cssText = `background:${bg};font-size:9px`;
        triggerAvatar.textContent = initials;
        const triggerLabel = trigger.querySelector('span.flex-1');
        if (triggerLabel) { triggerLabel.textContent = name; triggerLabel.className = 'flex-1 text-gray-700'; }
      }
      // 保存到 Supabase
      const card = dd.closest('.issue-card');
      if (card && currentProjectId) {
        const num = parseInt(card.id.replace('issue-', ''));
        sb.from('issues').update({ assignee_name: name, assignee_initials: initials, assignee_bg: bg, updated_at: new Date().toISOString() })
          .eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
      }
      // 自动变更状态：待分配 → 待修改
      if (card && card.dataset.status === '待分配') {
        const sdId = dd.id.replace('ad-', 'sd-');
        const statusDd = document.getElementById(sdId);
        if (statusDd) {
          const sTrigger = statusDd.previousElementSibling;
          const sDot = sTrigger.querySelector('span.rounded-full');
          if (sDot) sDot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0';
          const sLabel = sTrigger.querySelector('span.flex-1');
          if (sLabel) { sLabel.textContent = '待修改'; sLabel.className = 'flex-1 text-blue-500'; }
        }
        card.dataset.status = '待修改';
        updateStatusCounts();
      }
    }
    feishuTargetAssigneeDropdown = null;
  }
}

// Init AI blocks visibility
document.querySelectorAll('.dev-only').forEach(el => el.style.display = 'none');

// ── Canvas: precise Figma-style interaction ────────────────────
(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 8;
  // Approximate world content bounding box (set once, used for fit)
  const WORLD_W = 980;
  const WORLD_H = 1220;

  // ── Mutable state (all in one object for clarity) ─────────────
  const S = {
    tx: 0, ty: 0, scale: 1,
    panning: false,
    panStartX: 0, panStartY: 0,
    panStartTx: 0, panStartTy: 0,
    spaceDown: false,
    active: false,
    bound: false,
    // Rolling window of recent |deltaY| values — used to detect mouse wheel
    // (discrete large steps) vs trackpad (continuous small values).
    _wheelSamples: [],
  };

  // ── DOM helpers ───────────────────────────────────────────────
  const vp    = () => document.getElementById('canvasViewport');
  const world = () => document.getElementById('canvasWorld');
  const zoomLabel = () => document.getElementById('zoomPct');

  // ── Core transform ────────────────────────────────────────────
  // Writes S.tx / S.ty / S.scale → CSS transform on the world element.
  // Everything (frames, annotations, labels) lives inside #canvasWorld,
  // so ONE transform keeps everything in sync — no drift possible.
  function commit() {
    const w = world();
    if (!w) return;
    w.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${S.scale})`;
    const lbl = zoomLabel();
    if (lbl) lbl.textContent = Math.round(S.scale * 100) + '%';
  }

  // ── Zoom around a viewport-relative point (vx, vy) ───────────
  // Correct derivation:
  //   world-point under cursor = (vx - tx) / scale  (invariant)
  //   after zoom: newTx = vx - worldX * newScale
  function zoomAt(vx, vy, newScale) {
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    if (newScale === S.scale) return;
    const wx = (vx - S.tx) / S.scale;
    const wy = (vy - S.ty) / S.scale;
    S.tx = vx - wx * newScale;
    S.ty = vy - wy * newScale;
    S.scale = newScale;
    commit();
  }

  // ── Public API ────────────────────────────────────────────────
  // Fit all content to the visible viewport (called on page enter)
  window.canvasFit = function () {
    const v = vp();
    if (!v) return;
    const PAD = 60;
    const sx = (v.clientWidth  - PAD * 2) / WORLD_W;
    const sy = (v.clientHeight - PAD * 2) / WORLD_H;
    S.scale = Math.min(sx, sy, 1);
    S.tx = (v.clientWidth  - WORLD_W * S.scale) / 2;
    S.ty = PAD;
    commit();
  };

  // Step-zoom from buttons (around viewport centre)
  window.canvasZoom = function (factor) {
    const v = vp();
    if (!v) return;
    zoomAt(v.clientWidth / 2, v.clientHeight / 2, S.scale * (1 + factor));
  };

  // Scroll canvas so a group element is centred in the viewport.
  // Called from left-panel page nav; keeps current scale unchanged.
  window.scrollCanvas = function (groupId) {
    const v  = vp();
    const el = document.getElementById('canvas-' + groupId);
    if (!v || !el) return;
    const elX = parseFloat(el.style.left)  || 0;
    const elY = parseFloat(el.style.top)   || 0;
    // Use actual rendered size if available, otherwise fallback
    const elW = el.offsetWidth  || WORLD_W;
    const elH = el.offsetHeight || 300;
    S.tx = v.clientWidth  / 2 - (elX + elW / 2) * S.scale;
    S.ty = v.clientHeight / 2 - (elY + elH / 2) * S.scale;
    commit();
    // After jump, interaction must continue normally — no state reset needed.
  };

  // ── Wheel handler (bound to viewport, NOT document) ───────────
  // This is the key: by binding to the viewport element with passive:false,
  // we intercept all wheel events that originate inside it before the browser
  // can scroll the page, while leaving sidebar/right-panel scroll untouched.
  function onWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const rect = vp().getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    // ── Branch 1: pinch gesture ─────────────────────────────────
    // macOS reports ctrlKey=true for trackpad pinch. Also fires for
    // Ctrl/Cmd + mouse-wheel, which users naturally expect to zoom.
    if (e.ctrlKey) {
      let factor;
      if (e.deltaMode === 0) {
        // Pixel mode (trackpad pinch): deltaY ~1–15 per frame.
        // Clamp to prevent a single large frame from jumping too far.
        const clamped = Math.max(-30, Math.min(30, e.deltaY));
        factor = 1 - clamped * 0.01;
      } else {
        // Line/page mode (Ctrl + mouse wheel)
        factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      }
      zoomAt(vx, vy, S.scale * factor);
      return;
    }

    // ── Branch 2: no modifier key ────────────────────────────────
    // Distinguish mouse scroll wheel (→ zoom) from trackpad two-finger
    // scroll (→ pan). Strategy:
    //
    //  a) deltaMode !== 0  → LINE or PAGE mode → definitively a mouse wheel
    //  b) deltaMode === 0, deltaX !== 0  → has horizontal component → trackpad
    //  c) deltaMode === 0, deltaX === 0  → could be either; use rolling-window:
    //       mouse wheels send identical large discrete steps each tick
    //       (100–120 px in Chrome/Safari, multiples of 40 in Firefox);
    //       trackpads send continuous varying values.

    if (e.deltaMode !== 0) {
      // Definitively a mouse wheel
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(vx, vy, S.scale * factor);
      return;
    }

    // pixel mode (deltaMode === 0) from here
    if (e.deltaX !== 0) {
      // Has horizontal component → trackpad → pan both axes
      S.tx -= e.deltaX;
      S.ty -= e.deltaY;
      commit();
      return;
    }

    // Purely vertical pixel mode: use rolling window to decide.
    const absY = Math.abs(e.deltaY);
    S._wheelSamples.push(absY);
    if (S._wheelSamples.length > 5) S._wheelSamples.shift();

    // Mouse wheel on macOS pixel mode: large value AND all recent
    // samples are identical (discrete fixed-step hardware ticks).
    // Trackpad: values vary smoothly and are usually small.
    const allSame    = S._wheelSamples.length >= 2 &&
                       S._wheelSamples.every(v => v === S._wheelSamples[0]);
    const isDiscrete = absY >= 40 && (absY % 8 === 0 || absY % 10 === 0);

    if (isDiscrete && allSame) {
      // Mouse wheel → zoom around pointer position
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(vx, vy, S.scale * factor);
    } else {
      // Trackpad two-finger scroll → pan
      S.tx -= e.deltaX;
      S.ty -= e.deltaY;
      commit();
    }
  }

  // ── Mouse drag pan ────────────────────────────────────────────
  // Triggers on: middle-button drag, or Space + left-button drag.
  // The handler is on the viewport so it only fires inside the canvas area.
  function onMouseDown(e) {
    // Let drag system handle left-click on draft labels (unless Space is held for pan)
    if (e.button === 0 && !S.spaceDown && e.target.closest('.draft-label')) return;
    const isSpacePan   = e.button === 0 && S.spaceDown;
    const isMiddleBtn  = e.button === 1;
    if (!isSpacePan && !isMiddleBtn) return;

    e.preventDefault();
    S.panning    = true;
    S.panStartX  = e.clientX;
    S.panStartY  = e.clientY;
    S.panStartTx = S.tx;
    S.panStartTy = S.ty;
    vp().classList.add('panning');
  }

  // mousemove / mouseup go on window so drag continues outside viewport
  function onMouseMove(e) {
    if (!S.panning) return;
    S.tx = S.panStartTx + (e.clientX - S.panStartX);
    S.ty = S.panStartTy + (e.clientY - S.panStartY);
    commit();
  }

  function onMouseUp() {
    if (!S.panning) return;
    S.panning = false;
    const v = vp();
    if (!v) return;
    v.classList.remove('panning');
    if (S.spaceDown) v.classList.add('pan-mode'); // restore grab cursor
  }

  // ── Keyboard ──────────────────────────────────────────────────
  function onKeyDown(e) {
    if (!S.active) return;
    if (e.target.matches('input,textarea,select')) return;

    if (e.code === 'Space') {
      e.preventDefault();
      S.spaceDown = true;
      vp()?.classList.add('pan-mode');
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === '0')                     { e.preventDefault(); canvasFit(); }
    if (mod && (e.key === '=' || e.key === '+'))  { e.preventDefault(); canvasZoom( 0.25); }
    if (mod && e.key === '-')                     { e.preventDefault(); canvasZoom(-0.25); }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') {
      S.spaceDown = false;
      if (!S.panning) vp()?.classList.remove('pan-mode');
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  function bind() {
    if (S.bound) return;
    S.bound = true;
    const v = vp();
    // Wheel on viewport only (passive:false is REQUIRED to call preventDefault)
    v.addEventListener('wheel',     onWheel,     { passive: false });
    v.addEventListener('mousedown', onMouseDown);
    // Move/up on window so drag works when cursor leaves viewport
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    // Keyboard on document (needs to catch events anywhere)
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
  }

  function activate() {
    bind();          // no-op after first call
    S.active = true;
    canvasFit();
    // 应用默认标注模式
    if (typeof setAnnoMode === 'function') setAnnoMode(currentAnnoMode);
  }

  function deactivate() {
    S.active         = false;
    S.panning        = false;
    S.spaceDown      = false;
    S._wheelSamples  = [];
    const v = vp();
    if (v) v.classList.remove('pan-mode', 'panning');
  }

  // ── Expose lifecycle to global showPage ──────────────────────
  // showPage is defined in a later <script> block, so we cannot wrap it
  // here (it would be overwritten). Instead, export named hooks that
  // showPage calls explicitly.
  window.canvasActivate   = function () { requestAnimationFrame(activate); };
  window.canvasDeactivate = deactivate;

// ── State ──────────────────────────────────────────────────────
let currentRole = 'designer'; // 'designer' | 'dev'
// ── 首页渲染 ────────────────────────────────────────────────
function renderHome() {
  const proj = document.getElementById('hasProjects');
  const grid = document.getElementById('projectGrid');
  if (!proj || !grid) return;
  if (grid.children.length > 0) {
    proj.classList.remove('hidden');
  } else {
    proj.classList.add('hidden');
  }
}

// ── 上传预览 ────────────────────────────────────────────────────
// 存储每个上传区的所有文件 URL（因为 input.files 在重新选择时会被替换）
const uploadedFiles = {};

function handleUploadPreview(input, previewId) {
  const preview = document.getElementById(previewId);
  const placeholder = preview.previousElementSibling;
  const zone = input.closest('.upload-zone');
  if (!input.files.length) return;

  // 累加文件（支持多次添加）
  if (!uploadedFiles[previewId]) uploadedFiles[previewId] = [];
  Array.from(input.files).forEach(f => {
    uploadedFiles[previewId].push({ name: f.name, url: URL.createObjectURL(f), file: f });
  });

  renderUploadPreview(previewId, input.id);
  placeholder.classList.add('hidden');
  preview.classList.remove('hidden');
  zone.classList.add('has-files');
  updateStartButtons();
}

function renderUploadPreview(previewId, inputId) {
  const preview = document.getElementById(previewId);
  const files = uploadedFiles[previewId] || [];
  const showMax = 3;
  let html = '';

  files.slice(0, showMax).forEach((f, i) => {
    html += `<img src="${f.url}" class="thumb" alt="${escHtml(f.name)}" onclick="event.stopPropagation();openImageViewer('${previewId}')" />`;
  });

  if (files.length > showMax) {
    html += `<div class="thumb-more" onclick="event.stopPropagation();openImageViewer('${previewId}')">+${files.length - showMax}</div>`;
  }

  html += `<div class="upload-info">`;
  html += `<span class="text-xs text-gray-500">${files.length} 张图片</span>`;
  html += `<span class="add-more" onclick="event.stopPropagation();document.getElementById('${inputId}').click()">+ 继续添加</span>`;
  html += `<span class="text-xs text-gray-400 cursor-pointer hover:text-red-500" onclick="event.stopPropagation();clearUpload('${inputId}','${previewId}')">清除</span>`;
  html += `</div>`;
  preview.innerHTML = html;
}

function clearUpload(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const placeholder = preview.previousElementSibling;
  const zone = input.closest('.upload-zone');
  input.value = '';
  // 释放 URL
  (uploadedFiles[previewId] || []).forEach(f => URL.revokeObjectURL(f.url));
  delete uploadedFiles[previewId];
  preview.innerHTML = '';
  preview.classList.add('hidden');
  placeholder.classList.remove('hidden');
  zone.classList.remove('has-files');
  updateStartButtons();
}

// ── Figma 导入 ──────────────────────────────────────────────────

// 页面加载时恢复已保存的 Token
// Figma 状态：记录待导入信息
let figmaPendingImport = null; // { fileKey, nodeIds, token } — Frame 链接时暂存，开始比对时自动导入

(function initFigmaToken() {
  const saved = localStorage.getItem('dc_figma_token');
  if (saved) {
    const el = document.getElementById('figmaTokenInput');
    if (el) el.value = saved;
  }
})();

// 粘贴 Figma 链接或输入 Token 后自动检测
(function initFigmaLinkDetect() {
  const linkInput = document.getElementById('figmaLinkInput');
  const tokenInput = document.getElementById('figmaTokenInput');
  if (!linkInput) return;
  let debounceTimer;
  function triggerDetect(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => autoDetectFigmaLink(), delay);
  }
  linkInput.addEventListener('input', function() { triggerDetect(500); });
  linkInput.addEventListener('paste', function() { triggerDetect(100); });
  if (tokenInput) {
    tokenInput.addEventListener('input', function() { triggerDetect(500); });
    tokenInput.addEventListener('paste', function() { triggerDetect(100); });
  }
})();

async function autoDetectFigmaLink() {
  const linkVal = document.getElementById('figmaLinkInput').value.trim();
  const token = document.getElementById('figmaTokenInput').value.trim();
  figmaPendingImport = null;

  if (!linkVal) { setFigmaStatus('', ''); document.getElementById('figmaFrameList').classList.add('hidden'); return; }

  const parsed = parseFigmaUrl(linkVal);
  if (!parsed) { setFigmaStatus('链接格式不正确', 'error'); return; }
  if (!token) { setFigmaStatus('请输入 Token 后自动检测', 'info'); return; }

  // 保存 Token
  if (document.getElementById('figmaRememberToken').checked) {
    localStorage.setItem('dc_figma_token', token);
  } else {
    localStorage.removeItem('dc_figma_token');
  }

  setFigmaStatus('正在检测链接类型...', 'info');

  try {
    const _figmaListAC = new AbortController();
    const _figmaListTimeout = setTimeout(() => _figmaListAC.abort(), 60000);
    const listResp = await fetch('/api/figma-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', fileKey: parsed.fileKey, nodeId: parsed.nodeId, token }),
      signal: _figmaListAC.signal,
    });
    clearTimeout(_figmaListTimeout);
    const listData = await listResp.json();

    if (!listResp.ok) {
      setFigmaStatus(listData.error || '获取节点信息失败', 'error');
      return;
    }

    if (listData.frames && listData.frames.length > 0) {
      // Section/Page — 显示 Frame 列表让用户勾选
      setFigmaStatus(`找到 ${listData.frames.length} 个 Frame，勾选后点击「开始比对」`, 'success');
      showFigmaFrameList(listData.frames, parsed, token);
    } else {
      // 单个 Frame — 暂存，等开始比对时自动导入
      figmaPendingImport = { fileKey: parsed.fileKey, nodeIds: [parsed.nodeId], token };
      setFigmaStatus('✓ Frame 链接已识别，上传开发稿后即可比对', 'success');
      document.getElementById('figmaFrameList').classList.add('hidden');
    }
  } catch (e) {
    setFigmaStatus('检测失败，请检查网络', 'error');
  }
}

function switchDesignTab(tab) {
  const uploadTab = document.getElementById('designTabUpload');
  const figmaTab = document.getElementById('designTabFigma');
  const uploadBtn = document.getElementById('designTabUploadBtn');
  const figmaBtn = document.getElementById('designTabFigmaBtn');

  if (tab === 'upload') {
    uploadTab.style.display = '';
    uploadTab.classList.remove('hidden');
    figmaTab.style.display = 'none';
    uploadBtn.classList.add('design-tab-active');
    figmaBtn.classList.remove('design-tab-active');
  } else {
    uploadTab.style.display = 'none';
    figmaTab.style.display = '';
    figmaTab.classList.remove('hidden');
    figmaBtn.classList.add('design-tab-active');
    uploadBtn.classList.remove('design-tab-active');
  }
}

// Token 教程弹窗
function showFigmaTokenHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'figma-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="figma-modal">
      <div class="flex items-center justify-between mb-4">
        <h3 style="margin:0;">如何获取 Figma Token</h3>
        <span class="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none" onclick="this.closest('.figma-modal-overlay').remove()">&times;</span>
      </div>
      <div class="step"><div class="step-num">1</div><div class="step-text">点击 Figma 左上角 <b>头像</b> → <b>Settings</b></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">切换到 <b>Security</b> 标签页</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">找到 <b>Personal access tokens</b> → 点击 <b>Generate new token</b></div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">填写 Token 名称，设置有效期</div></div>
      <div class="step"><div class="step-num">5</div><div class="step-text">Scopes 必选 <b>file_content:read</b></div></div>
      <div class="step"><div class="step-num">6</div><div class="step-text">点击 <b>Generate token</b>，复制并保存</div></div>
      <div class="tip-box">⚠️ Token 只会显示一次，请立即复制保存。</div>
    </div>`;
  document.body.appendChild(overlay);
}

// 如何复制 Figma 链接教程弹窗
function showFigmaImportHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'figma-modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="figma-modal">
      <div class="flex items-center justify-between mb-4">
        <h3 style="margin:0;">如何导入设计稿</h3>
        <span class="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none" onclick="this.closest('.figma-modal-overlay').remove()">&times;</span>
      </div>
      <div class="step"><div class="step-num">1</div><div class="step-text"><b>为什么上传 Figma 链接</b><br>在 Figma 中复制的页面链接，粘贴后即可自动拉取设计稿图片，无需手动截图。</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><b>不同链接的导入范围</b><br>• <b>Frame 链接</b> → 导入 1 个画板<br>• <b>Section 链接</b> → 导入该分区下所有 Frame<br>• <b>Page 链接</b> → 导入该页面下所有顶层 Frame
        <div style="margin-top:12px;border-radius:8px;">
          <img src="figma-structure.png" alt="Figma 层级结构：Page → Section → Frame" style="width:100%;max-width:480px;border-radius:8px;border:1px solid #e8e5df;display:block;" />
        </div>
      </div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><b>如何复制链接</b><br>• <b>Frame / Section</b>：选中 → 右键 → Copy link<br>• <b>Page</b>：左上角页面列表 → 右键 → Copy link to page</div></div>
    </div>`;
  document.body.appendChild(overlay);
}

function parseFigmaUrl(url) {
  try {
    const match = url.trim().match(/figma\.com\/(?:design|file|proto)\/([a-zA-Z0-9]+)(?:\/[^?]*)?/);
    if (!match) return null;
    const fileKey = match[1];
    const urlObj = new URL(url.trim());
    const nodeIdRaw = urlObj.searchParams.get('node-id');
    if (!nodeIdRaw) return null;
    const nodeId = nodeIdRaw.replace(/-/g, ':');
    return { fileKey, nodeId };
  } catch (e) {
    return null;
  }
}

function setFigmaStatus(msg, type) {
  const el = document.getElementById('figmaImportStatus');
  if (!msg) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.className = 'mt-2 text-xs text-center ' + (type === 'error' ? 'text-red-500' : type === 'success' ? 'text-green-600' : 'text-gray-500');
  el.textContent = msg;
}

// setFigmaBtnLoading 已移除，导入按钮已删除

function toggleFigmaSelectAll(checked) {
  document.querySelectorAll('#figmaFrameItems input[type=checkbox]').forEach(cb => cb.checked = checked);
}

// importFromFigma 已移除，Figma 导入在 startCompare 中自动触发

function showFigmaFrameList(frames, parsed, token) {
  const container = document.getElementById('figmaFrameItems');
  const listWrap = document.getElementById('figmaFrameList');
  const title = document.getElementById('figmaFrameListTitle');
  title.textContent = `选择要导入的 Frame（共 ${frames.length} 个）`;

  let html = '';
  frames.forEach((f, i) => {
    const sectionLabel = f.section ? `<span class="text-gray-400 mr-1">${escHtml(f.section)} /</span>` : '';
    html += `<label class="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-100 cursor-pointer select-none">
      <input type="checkbox" checked data-node-id="${escHtml(f.id)}" class="accent-[var(--color-terracotta)]" />
      <span class="text-xs text-gray-600">${sectionLabel}${escHtml(f.name)}</span>
    </label>`;
  });
  container.innerHTML = html;
  listWrap.classList.remove('hidden');

  // 存储 pending 信息，开始比对时根据勾选状态导入
  figmaPendingImport = { fileKey: parsed.fileKey, nodeIds: null, token, isFrameList: true };
}

// 获取 Frame 列表中勾选的 nodeIds
function getSelectedFigmaFrameIds() {
  const container = document.getElementById('figmaFrameItems');
  const selected = [];
  container.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
    selected.push(cb.dataset.nodeId);
  });
  return selected;
}

async function exportFigmaImages(fileKey, nodeIds, token) {
  try {
    const _figmaExportAC = new AbortController();
    const _figmaExportTimeout = setTimeout(() => _figmaExportAC.abort(), 120000);
    const resp = await fetch('/api/figma-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', fileKey, nodeIds, token, scale: 2 }),
      signal: _figmaExportAC.signal,
    });
    clearTimeout(_figmaExportTimeout);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || '导出失败');
    }

    const successImages = (data.images || []).filter(img => img.image);
    if (successImages.length === 0) {
      throw new Error('没有成功导出任何图片，请检查链接');
    }

    // 清除已有上传的设计稿
    clearUpload('uploadDesign', 'previewDesign');

    // 将 base64 图片转为 File 对象并写入 uploadedFiles
    uploadedFiles['previewDesign'] = [];
    for (const img of successImages) {
      const byteChars = atob(img.image);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const fileName = `figma-${img.nodeId.replace(':', '-')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      uploadedFiles['previewDesign'].push({ name: fileName, url: URL.createObjectURL(blob), file });
    }

    // 渲染预览
    const preview = document.getElementById('previewDesign');
    const placeholder = document.getElementById('placeholderDesign');
    const zone = document.getElementById('uploadDesign').closest('.upload-zone');
    renderUploadPreview('previewDesign', 'uploadDesign');
    placeholder.classList.add('hidden');
    preview.classList.remove('hidden');
    zone.classList.add('has-files');
    updateStartButtons();

    // 导入成功后在 Figma Tab 下显示成功状态，不切换 tab
    setFigmaStatus(`✓ 成功导入 ${successImages.length} 张设计稿`, 'success');
    figmaPendingImport = null;

  } catch (e) {
    throw e; // 让调用方处理错误
  }
}

// ── 按钮状态：两边都上传才可提交 ──────────────────────────────────
function updateStartButtons() {
  // 冷启动版（Figma 待导入也算有设计稿）
  const coldDesign = (uploadedFiles['previewDesign'] || []).length > 0 || !!figmaPendingImport;
  const coldDev = (uploadedFiles['previewDev'] || []).length > 0;
  setBtnEnabled(document.getElementById('btnStartCold'), coldDesign && coldDev);
  updateStartBtnTip('btnStartColdTip', coldDesign, coldDev);
  const taskNameBlockCold = document.getElementById('taskNameBlockCold');
  if (taskNameBlockCold) taskNameBlockCold.classList.toggle('hidden', !(coldDesign && coldDev));
  // 已有项目版
  const hasDesign = (uploadedFiles['previewDesignC'] || []).length > 0;
  const hasDev = (uploadedFiles['previewDevC'] || []).length > 0;
  setBtnEnabled(document.getElementById('btnStartHas'), hasDesign && hasDev);
  const taskNameBlockHas = document.getElementById('taskNameBlockHas');
  if (taskNameBlockHas) taskNameBlockHas.classList.toggle('hidden', !(hasDesign && hasDev));
}

function updateStartBtnTip(tipId, hasDesign, hasDev) {
  const tip = document.getElementById(tipId);
  if (!tip) return;
  if (hasDesign && hasDev) {
    tip.textContent = '';
    tip.parentElement.onmouseenter = null;
    tip.parentElement.onmouseleave = null;
  } else {
    let msg = '';
    if (!hasDesign && !hasDev) msg = '请先上传设计稿和开发稿';
    else if (!hasDesign) msg = '请先上传设计稿';
    else msg = '请先上传开发稿';
    tip.textContent = msg;
    tip.parentElement.onmouseenter = () => tip.classList.remove('hidden');
    tip.parentElement.onmouseleave = () => tip.classList.add('hidden');
  }
}

function setBtnEnabled(btn, enabled) {
  if (!btn) return;
  btn.dataset.ready = enabled ? '1' : '0';
  btn.disabled = !enabled;
}

// ── 图片转 base64 ──────────────────────────────────────────────
function waitForImgLoad(imgEl) {
  if (imgEl.complete && imgEl.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    imgEl.onload = resolve;
    imgEl.onerror = () => reject(new Error('图片加载失败'));
    setTimeout(() => reject(new Error('图片加载超时')), 10000);
  });
}

function imgToBase64(imgEl) {
  const canvas = document.createElement('canvas');
  const w = imgEl.naturalWidth || imgEl.width || imgEl.offsetWidth;
  const h = imgEl.naturalHeight || imgEl.height || imgEl.offsetHeight;
  if (!w || !h) {
    throw new Error('图片尺寸为 0，无法转换');
  }
  const maxW = 1200;
  const scale = Math.min(1, maxW / w);
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
  const b64 = dataUrl.split(',')[1];
  if (b64.length < 100) {
    throw new Error('图片转换异常，base64 数据过短');
  }
  return b64;
}

// ── 用真实上传图片填充画布 ──────────────────────────────────────
function populateCanvasWithUploads(designKey, devKey, projectName) {
  const world = document.getElementById('canvasWorld');
  world.innerHTML = '';
  _analyzeCounter = 0;
  const name = projectName || '走查任务';

  const designFiles = uploadedFiles[designKey] || [];
  const devFiles = uploadedFiles[devKey] || [];
  const maxLen = Math.max(designFiles.length, devFiles.length);

  const group = document.createElement('div');
  group.id = 'canvas-' + name;
  group.style.cssText = 'position:absolute; left:60px; top:60px; width:860px;';
  group.innerHTML = '<div class="canvas-label" style="color:#C65D3B; margin-bottom:10px;">\u25cf ' + name + ' &nbsp;\xb7&nbsp; ' + maxLen + '个页面</div>';

  for (let i = 0; i < maxLen; i++) {
    const pageWrapper = document.createElement('div');
    pageWrapper.style.marginBottom = '24px';

    pageWrapper.innerHTML = '<div style="color:#9A9A90;font-size:11px;margin-bottom:8px;">页面 ' + (i + 1) + '</div>' +
      '<div class="pair-col-header" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">' +
      '<span style="font-size:10px;font-weight:600;color:#9A9A90;letter-spacing:.05em;">设计稿</span>' +
      '<span style="font-size:10px;font-weight:600;color:#9A9A90;letter-spacing:.05em;">开发稿</span></div>';

    const pair = document.createElement('div');
    pair.className = 'canvas-pair';
    pair.style.position = 'relative';

    // Design image
    const dWrap = document.createElement('div');
    dWrap.className = 'canvas-img-wrap';
    dWrap.dataset.type = 'design';
    if (designFiles[i]) {
      const img = document.createElement('img');
      img.src = designFiles[i].url;
      img.style.cssText = 'width:100%;display:block;border-radius:8px;';
      dWrap.appendChild(img);
    } else {
      dWrap.innerHTML = '<div style="height:200px;background:#EAE7E0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9A9A90;font-size:12px;">无对应设计稿</div>';
    }
    pair.appendChild(dWrap);

    // Analyze button
    const btn = document.createElement('div');
    btn.className = 'pair-analyze-btn visible';
    btn.setAttribute('onclick', 'analyzePair(this)');
    btn.title = '分析差异';
    btn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>';
    pair.appendChild(btn);

    // Dev image
    const vWrap = document.createElement('div');
    vWrap.className = 'canvas-img-wrap';
    vWrap.dataset.type = 'dev';
    if (devFiles[i]) {
      const img = document.createElement('img');
      img.src = devFiles[i].url;
      img.style.cssText = 'width:100%;display:block;border-radius:8px;';
      vWrap.appendChild(img);
    } else {
      vWrap.innerHTML = '<div style="height:200px;background:#EAE7E0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9A9A90;font-size:12px;">无对应开发稿</div>';
    }
    pair.appendChild(vWrap);

    pageWrapper.appendChild(pair);
    group.appendChild(pageWrapper);
  }

  world.appendChild(group);

  // Clear existing issue list and reset cache
  allIssueCards = [];
  const issueList = document.getElementById('issueList');
  if (issueList) issueList.innerHTML = `
    <div class="text-center" style="padding-top:40vh;" id="analyzeHint">
      <div class="text-xs text-gray-400 mb-3">AI 正在分析中，请稍候...</div>
      <div class="analyze-panel-progress" style="margin:0 24px;">
        <div style="height:3px;background:rgba(209,209,201,.3);border-radius:4px;overflow:hidden;">
          <div id="panelProgressFill" style="height:100%;width:0%;background:#C65D3B;border-radius:4px;transition:width .4s ease;"></div>
        </div>
        <div class="text-[10px] text-gray-400 mt-1.5 text-center" id="panelProgressText">准备分析...</div>
      </div>
    </div>`;

  // Update breadcrumb
  const bc = document.getElementById('breadcrumbProject');
  if (bc) bc.textContent = name;
}

async function startCompare(btn) {
  const mode = btn.dataset.mode;
  const designKey = mode === 'cold' ? 'previewDesign' : 'previewDesignC';
  const devKey = mode === 'cold' ? 'previewDev' : 'previewDevC';
  let hasDesign = (uploadedFiles[designKey] || []).length > 0;
  const hasDev = (uploadedFiles[devKey] || []).length > 0;

  // Figma 自动导入：如果设计稿未上传但有 Figma 待导入信息
  if (!hasDesign && figmaPendingImport && mode === 'cold') {
    const pending = figmaPendingImport;
    let nodeIds = pending.nodeIds;

    // Section/Page 链接：从勾选列表获取 nodeIds
    if (pending.isFrameList) {
      nodeIds = getSelectedFigmaFrameIds();
      if (nodeIds.length === 0) { showToast('请在 Figma 导入中勾选要导入的 Frame'); return; }
    }

    // 显示导入状态（在 Figma tab 内显示提取进度）
    btn.disabled = true;
    btn.querySelector('.btn-arrow').classList.add('hidden');
    btn.querySelector('.btn-spinner').classList.remove('hidden');
    btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '导入设计稿… '; });
    setFigmaStatus('正在从 Figma 提取图片，请稍候…', 'loading');

    try {
      await exportFigmaImages(pending.fileKey, nodeIds, pending.token);
      hasDesign = (uploadedFiles[designKey] || []).length > 0;
      figmaPendingImport = null;
    } catch (e) {
      showToast('Figma 导入失败，请检查网络后重试');
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.querySelector('.btn-arrow').classList.remove('hidden');
      btn.querySelector('.btn-spinner').classList.add('hidden');
      btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '开始比对 '; });
      return;
    }
  }

  if (!hasDesign && !hasDev) { showToast('请先上传设计稿和开发页面'); return; }
  if (!hasDev) { showToast('还需要上传开发页面'); return; }
  if (!hasDesign) { showToast('还需要上传设计稿'); return; }

  // 获取项目名称
  const nameInput = document.getElementById(mode === 'cold' ? 'taskNameCold' : 'taskNameHas');
  const projectName = (nameInput && nameInput.value.trim()) || '未命名项目';

  const designFiles = uploadedFiles[designKey] || [];
  const devFiles = uploadedFiles[devKey] || [];

  // Loading 态
  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-arrow').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');
  btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '比对中… '; });

  // AI 自动配对（多图时）
  if (designFiles.length > 1 && devFiles.length > 1) {
    btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = 'AI 配对中… '; });
    try {
      const designB64s = await Promise.all(designFiles.map(f => fileToBase64(f.file)));
      const devB64s = await Promise.all(devFiles.map(f => fileToBase64(f.file)));

      const matchResp = await fetch('/api/match-pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designImages: designB64s, devImages: devB64s })
      });
      const matchData = await matchResp.json();

      if (matchResp.ok && matchData.pairs?.length > 0) {
        // 按配对结果重排文件
        const reorderedDesign = [];
        const reorderedDev = [];
        const usedDesign = new Set();
        const usedDev = new Set();

        for (const [di, vi] of matchData.pairs) {
          if (di < designFiles.length && vi < devFiles.length) {
            reorderedDesign.push(designFiles[di]);
            reorderedDev.push(devFiles[vi]);
            usedDesign.add(di);
            usedDev.add(vi);
          }
        }
        // 未配对的追加到末尾
        designFiles.forEach((f, i) => { if (!usedDesign.has(i)) reorderedDesign.push(f); });
        devFiles.forEach((f, i) => { if (!usedDev.has(i)) reorderedDev.push(f); });

        uploadedFiles[designKey] = reorderedDesign;
        uploadedFiles[devKey] = reorderedDev;
      }
    } catch (e) {
      console.warn('AI 配对失败，使用默认顺序:', e);
    }
    btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '比对中… '; });
  }

  _analyzeCounter = 0;
  populateCanvasWithUploads(designKey, devKey, projectName);
  btn.querySelector('.btn-arrow').classList.remove('hidden');
  btn.querySelector('.btn-spinner').classList.add('hidden');
  btn.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '开始比对 '; });
  btn.classList.remove('loading');
  btn.disabled = false;
  // 在首页新增项目卡片并保存到 Supabase
  const card = addProjectCard(projectName);
  showPage('workbench');
  setTimeout(() => canvasFit(), 300);
  // 自动触发所有 pair 的 AI 分析（依次执行，避免并发）
  setTimeout(() => autoAnalyzeAll(), 500);

  // 异步保存到 Supabase
  (async () => {
    try {
      const savedDesignFiles = uploadedFiles[designKey] || [];
      const savedDevFiles = uploadedFiles[devKey] || [];
      const { data: proj } = await sb.from('projects').insert({ name: projectName, user_id: currentUserId, review_status: '进行中' }).select().single();
      if (!proj) return;
      currentProjectId = proj.id;
      if (card) {
        card.dataset.projectId = proj.id;
        const clickArea = card.querySelector('[onclick]');
        if (clickArea) clickArea.setAttribute('onclick', `loadProject('${proj.id}')`);
      }
      for (let i = 0; i < savedDesignFiles.length; i++) {
        const p = `${proj.id}/design_${i}_${Date.now()}`;
        await sb.storage.from('review-images').upload(p, savedDesignFiles[i].file);
        const { data: { publicUrl } } = sb.storage.from('review-images').getPublicUrl(p);
        await sb.from('images').insert({ project_id: proj.id, slot: 'design', page_index: i, file_name: savedDesignFiles[i].name, storage_path: p, public_url: publicUrl, user_id: currentUserId });
      }
      for (let i = 0; i < savedDevFiles.length; i++) {
        const p = `${proj.id}/dev_${i}_${Date.now()}`;
        await sb.storage.from('review-images').upload(p, savedDevFiles[i].file);
        const { data: { publicUrl } } = sb.storage.from('review-images').getPublicUrl(p);
        await sb.from('images').insert({ project_id: proj.id, slot: 'dev', page_index: i, file_name: savedDevFiles[i].name, storage_path: p, public_url: publicUrl, user_id: currentUserId });
      }
    } catch (e) { console.error('Supabase save error:', e); }
  })();
}

// ── 提交走查申请 ──────────────────────────────────────────────────
function submitReviewRequest() {
  // 统计"已修改"（canonical=待验收）的问题数量
  const readyCount = allIssueCards.filter(c => c.dataset.status === '待验收').length;
  if (readyCount === 0) {
    showToast('没有已修改的问题可提交');
    return;
  }
  const mask = document.getElementById('confirmDialog');
  document.getElementById('confirmTitle').textContent = '提交走查申请';
  document.getElementById('confirmDesc').textContent = `本次提交 ${readyCount} 条验收申请`;
  document.getElementById('confirmBtn').textContent = '确认提交';
  document.getElementById('confirmBtn').className = 'btn-primary';
  mask.classList.add('open');
  _confirmCb = function() {
    closeConfirm();
    // 更新项目 review_status
    if (currentProjectId) {
      sb.from('projects').update({ review_status: '待设计验收' }).eq('id', currentProjectId).then(() => {});
    }
    const remainingCount = allIssueCards.filter(c => c.dataset.status === '待修改').length;
    if (remainingCount === 0) {
      showToast(`已全部提交，共 ${readyCount} 条验收申请`);
    } else {
      showToast(`已提交 ${readyCount} 条验收申请`);
    }
  };
}

// ── 时间工具 ──────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '刚刚创建';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + ' 分钟前';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' 小时前';
  const days = Math.floor(hours / 24);
  return days + ' 天前';
}

// ── 在首页新增项目卡片 ──────────────────────────────────────────
function addProjectCard(name, reviewStatus, createdAt) {
  const grid = document.getElementById('projectGrid');
  if (!grid) return;

  // 随机图标颜色
  const colors = [
    { bg: 'rgba(198,93,59,.1)', stroke: 'var(--color-terracotta)' },
    { bg: 'rgba(107,75,175,.1)', stroke: '#6B4BAF' },
    { bg: 'rgba(34,163,74,.1)', stroke: '#22A34A' },
    { bg: 'rgba(59,130,246,.1)', stroke: '#3B82F6' },
  ];
  const c = colors[Math.floor(Math.random() * colors.length)];

  const card = document.createElement('div');
  card.className = 'project-card project-card-new';
  card.innerHTML = `
    <div class="p-5">
      <div class="flex items-start justify-between cursor-pointer" onclick="showPage('workbench')">
        <div class="flex items-center gap-3">
          <div class="project-icon" style="background:${c.bg}">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="${c.stroke}" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="project-name-label font-semibold text-gray-900 text-sm" ondblclick="event.stopPropagation();startRenameProject(this)">${escHtml(name)}</h3>
              ${reviewStatus === '待设计验收' ? '<span class="status-badge badge-review">待设计验收</span>' : reviewStatus === '已通过' ? '<span class="status-badge badge-passed">已通过</span>' : '<span class="status-badge badge-active">进行中</span>'}
            </div>
            <p class="text-xs text-gray-400 mt-0.5">${timeAgo(createdAt)}</p>
          </div>
        </div>
        <svg class="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </div>
      <div class="flex items-center flex-nowrap whitespace-nowrap gap-4 mt-4 pt-3 border-t border-gray-50 -mx-1 px-1">
        <div class="text-xs text-gray-500">共 <span class="font-semibold text-gray-800 issue-count-num">0</span> 个问题</div>
        <div class="ml-auto flex -space-x-1.5">
          <div class="w-6 h-6 rounded-full bg-blue-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-blue-700">设</div>
          <div class="w-6 h-6 rounded-full bg-green-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-green-700">开</div>
        </div>
        <div class="text-xs text-gray-400">更新于${timeAgo(createdAt)}</div>
      </div>
    </div>`;

  // 插入到网格最前面
  grid.insertBefore(card, grid.firstChild);

  // 更新项目数量 & 显示项目列表
  updateProjectCount();
  renderHome();
  return card;
}

function updateProjectCount() {
  const grid = document.getElementById('projectGrid');
  const countEl = document.getElementById('projectCountLabel');
  if (countEl && grid) {
    const count = grid.querySelectorAll('.project-card').length;
    countEl.textContent = '已有项目 · ' + count + ' 个';
  }
}

// 显示右侧筛选区
function showFilterSection() {
  const sec = document.getElementById('filterSection');
  if (sec) sec.style.display = '';
  // 分析完成后显示线框/高亮切换
  const vmt = document.getElementById('viewModeToggle');
  if (vmt) vmt.style.display = '';
}

// 同步问题数量到首页项目卡片
function syncIssueCountToCard() {
  const grid = document.getElementById('projectGrid');
  if (!grid) return;
  // 优先匹配当前项目 ID 的卡片，fallback 到第一个卡片
  let card = currentProjectId
    ? grid.querySelector(`.project-card[data-project-id="${currentProjectId}"]`)
    : null;
  if (!card) card = grid.querySelector('.project-card');
  if (!card) return;
  const countSpan = card.querySelector('.issue-count-num');
  if (countSpan) {
    countSpan.textContent = allIssueCards.length;
  }
}

// ── 项目卡片重命名 ──────────────────────────────────────────────
function startRenameProject(label) {
  const oldName = label.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.className = 'font-semibold text-gray-900 text-sm bg-white border border-blue-400 rounded px-1 py-0.5 outline-none';
  input.style.width = Math.max(80, oldName.length * 14) + 'px';

  const finish = () => {
    const newName = input.value.trim() || '未命名项目';
    label.textContent = newName;
    label.style.display = '';
    input.remove();
    // 同步更新 breadcrumb（如果当前就是这个项目）
    const bc = document.getElementById('breadcrumbProject');
    if (bc && (bc.textContent === oldName || bc.textContent === '走查任务')) {
      bc.textContent = newName;
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });

  label.style.display = 'none';
  label.parentElement.insertBefore(input, label);
  input.focus();
  input.select();
}

async function autoAnalyzeAll() {
  const btns = document.querySelectorAll('.pair-analyze-btn.visible');
  for (const btn of btns) {
    await analyzePair(btn);
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:32px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.15);opacity:0;transition:opacity .2s;';
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = '1');
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2000);
}

// ── 图片查看弹窗 ────────────────────────────────────────────────
function openImageViewer(previewId) {
  const files = uploadedFiles[previewId] || [];
  if (!files.length) return;
  let viewer = document.getElementById('imageViewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'imageViewer';
    viewer.className = 'img-viewer-mask';
    viewer.onclick = function(e) { if (e.target === this) closeImageViewer(); };
    document.body.appendChild(viewer);
  }
  const label = previewId.toLowerCase().includes('design') ? '设计稿' : '开发稿';
  viewer.innerHTML = `
    <button class="img-viewer-close" onclick="closeImageViewer()">✕</button>
    <div class="img-viewer-title">${label} · ${files.length} 张图片</div>
    <div class="img-viewer-grid">
      ${files.map(f => `<img src="${f.url}" alt="${escHtml(f.name)}" />`).join('')}
    </div>
  `;
  viewer.classList.add('open');
}

function closeImageViewer() {
  const viewer = document.getElementById('imageViewer');
  if (viewer) viewer.classList.remove('open');
}


// ── Workbench sidebar collapse ──────────────────────────────────
function toggleWbSidebar() {
  const sb   = document.getElementById('wbSidebar');
  const icon = document.getElementById('wbCollapseIcon');
  if (!sb || !icon) return;
  const collapsed = sb.classList.toggle('collapsed');
  // Flip arrow direction
  icon.innerHTML = collapsed
    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>';
  // Canvas needs to recalc fit after sidebar width change
  setTimeout(() => window.canvasFit?.(), 220);
}

// ── Right panel drag resize ─────────────────────────────────────
(function () {
  let dragging = false, startX = 0, startW = 0;

  document.addEventListener('DOMContentLoaded', function () {
    const resizer = document.getElementById('panelResizer');
    const panel   = document.getElementById('rightPanel');
    if (!resizer || !panel) return;

    resizer.addEventListener('mousedown', function (e) {
      dragging = true;
      startX   = e.clientX;
      startW   = panel.offsetWidth;
      resizer.classList.add('dragging');
      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      // Dragging left → panel grows; right → panel shrinks
      const delta  = startX - e.clientX;
      const minW   = parseInt(getComputedStyle(panel).minWidth) || 260;
      const maxW   = parseInt(getComputedStyle(panel).maxWidth) || 600;
      const newW   = Math.max(minW, Math.min(maxW, startW + delta));
      panel.style.width = newW + 'px';
    });

    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    });
  });
})();

// ── Navigation ─────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const map = { home: 'page-home', workbench: 'page-workbench' };
  const id = map[name] || 'page-' + name;
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  // Activate / deactivate canvas interaction (defined in earlier script block)
  if (name === 'workbench') {
    window.canvasActivate?.();
    showOnboardingGuide();
  } else {
    window.canvasDeactivate?.();
  }
}

// ── 首次教学引导 ──────────────────────────────────────────────
function showOnboardingGuide() {
  if (localStorage.getItem('dc_onboarded')) return;
  localStorage.setItem('dc_onboarded', '1');

  // 延迟显示，等页面渲染完成
  setTimeout(() => {
    // 定位到划区按钮上方
    const boxBtn = document.getElementById('modeBtn-box');
    if (!boxBtn) return;
    const rect = boxBtn.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - 140; // 气泡宽280，居中对齐按钮
    const bottom = window.innerHeight - rect.top + 12; // 按钮上方12px

    const guide = document.createElement('div');
    guide.id = 'onboardingGuide';
    guide.style.cssText = 'position:fixed;inset:0;z-index:200;pointer-events:none;';
    guide.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.4);pointer-events:auto;" onclick="dismissGuide()"></div>
      <div style="position:fixed;bottom:${bottom}px;left:${left}px;pointer-events:auto;width:280px;">
        <div style="background:#fff;border-radius:12px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,.18);position:relative;">
          <div style="font-size:14px;font-weight:600;color:#1F1F1F;margin-bottom:6px;">如何新增走查问题</div>
          <div style="font-size:12px;color:#6B6B64;line-height:1.6;">
            「<span style="color:#C65D3B;font-weight:600;">线框</span>」模式下，在设计稿或者开发稿上拖拽画框，即可手动添加走查问题。
          </div>
          <button onclick="dismissGuide()" style="margin-top:12px;width:100%;padding:7px 0;background:#C65D3B;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">我知道了</button>
          <div style="position:absolute;bottom:-8px;left:${rect.left + rect.width / 2 - left - 8}px;width:16px;height:16px;background:#fff;transform:rotate(45deg);box-shadow:4px 4px 8px rgba(0,0,0,.06);"></div>
        </div>
      </div>
    `;
    document.body.appendChild(guide);
  }, 1500);
}

function dismissGuide() {
  const g = document.getElementById('onboardingGuide');
  if (g) g.remove();
}


// ── Role switch ────────────────────────────────────────────────
function setRole(role) {
  currentRole = role;
  const isDesigner = role === 'designer';
  document.getElementById('roleDesigner').className = 'flex-1 text-xs py-1 rounded-md font-medium transition-all ' + (isDesigner ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500');
  document.getElementById('roleDev').className = 'flex-1 text-xs py-1 rounded-md font-medium transition-all ' + (!isDesigner ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500');
  // 头像显示邮箱首字母，颜色跟随角色
  document.getElementById('userAvatar').className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:ring-2 transition-all ' + (isDesigner ? 'bg-blue-100 text-blue-700 hover:ring-blue-300' : 'bg-green-100 text-green-700 hover:ring-green-300');
  // 角色标签不再显示文字（切换按钮已指示当前角色）
  renderStats();
  // update workbench role if visible
  if (typeof renderWorkbenchRole === 'function') renderWorkbenchRole();
  // update status tabs and list for new role
  STATUS_SECTIONS = getStatuses();
  renderStatusTabs();
  rebuildList();
  syncStatusDropdowns();
  syncStatusLabels();
}

// ── Stats panel ────────────────────────────────────────────────
function renderStats() {
  const panel = document.getElementById('statsPanel');
  if (!panel) return;
  const total = allIssueCards.length;
  const countByStatus = (s) => allIssueCards.filter(c => c.dataset.status === s).length;
  const items = currentRole === 'dev' ? [
    { label: '总问题数', value: total, sub: '分配给我的', color: 'text-gray-900' },
    { label: '待修改', value: countByStatus('待修改'), sub: '需要你处理', color: 'text-orange-500' },
    { label: '验收通过', value: countByStatus('验收通过'), sub: '', color: 'text-green-600' },
    { label: '已修改', value: countByStatus('待验收'), sub: '', color: 'text-blue-600' },
  ] : [
    { label: '总问题数', value: total, sub: '', color: 'text-gray-900' },
    { label: '待验收', value: countByStatus('待验收'), sub: '需要你确认', color: 'text-purple-600' },
    { label: '继续修改', value: countByStatus('继续修改'), sub: '等待开发重改', color: 'text-orange-500' },
    { label: '验收通过', value: countByStatus('验收通过'), sub: '', color: 'text-green-600' },
  ];
  panel.innerHTML = items.map(s => `
    <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div class="text-xs text-gray-400 mb-1">${s.label}</div>
      <div class="text-2xl font-bold ${s.color}">${s.value}</div>
      <div class="text-xs text-gray-400 mt-1">${s.sub}</div>
    </div>
  `).join('');
}

// ── Project task toggle ────────────────────────────────────────
function toggleTasks(card, id) {
  const el = document.getElementById(id);
  const icon = card.querySelector('.stats-row .expand-icon');
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    icon && (icon.style.transform = 'rotate(180deg)');
  } else {
    el.classList.add('hidden');
    icon && (icon.style.transform = '');
  }
}

// ── 时间线折叠 ──────────────────────────────────────────────────
function toggleTimeline(btn, e) {
  (e || event).stopPropagation();
  const card = btn.closest('.issue-card');
  if (card) card.classList.toggle('timeline-open');
}

// ── 删除卡片 ────────────────────────────────────────────────────
let _confirmCb = null;
function deleteIssue(id, e) {
  (e || event).stopPropagation();
  const mask = document.getElementById('confirmDialog');
  document.getElementById('confirmTitle').textContent = '确定删除此问题？';
  document.getElementById('confirmDesc').textContent = '删除后将无法恢复，画布上的标注也会同时移除。';
  document.getElementById('confirmBtn').textContent = '确认删除';
  document.getElementById('confirmBtn').className = 'btn-danger';
  mask.classList.add('open');
  _confirmCb = function() {
    const card = document.getElementById(id);
    if (card) card.remove();
    // 从 allIssueCards 数组中移除
    allIssueCards = allIssueCards.filter(c => c.id !== id);
    // 移除画布上对应标注
    document.querySelectorAll(`.issue-anno[data-issue-id="${id}"], .issue-anno[onclick*="${id}"]`).forEach(a => a.remove());
    closeConfirm();
    showToast('问题已删除');
    rebuildList();
    syncIssueCountToCard();
    // 从 Supabase 删除
    if (currentProjectId) {
      const num = parseInt(id.replace('issue-', ''));
      sb.from('issues').update({ deleted: true, updated_at: new Date().toISOString() }).eq('project_id', currentProjectId).eq('issue_number', num).then(() => {});
    }
  };
}
function confirmAction() { if (_confirmCb) _confirmCb(); }
function closeConfirm() {
  document.getElementById('confirmDialog').classList.remove('open');
  _confirmCb = null;
}

// ── 从 Supabase 加载已有项目 ──────────────────────────────────
async function loadProjectsFromDB() {
  try {
    const { data: projects } = await sb.from('projects').select('id, name, status, created_at, review_status').order('created_at', { ascending: false });
    if (projects && projects.length) {
      // 批量查询每个项目的 issue 数量
      const projectIds = projects.map(p => p.id);
      const { data: issues } = await sb.from('issues').select('project_id').in('project_id', projectIds).or('deleted.is.null,deleted.eq.false');
      const issueCountMap = {};
      (issues || []).forEach(i => { issueCountMap[i.project_id] = (issueCountMap[i.project_id] || 0) + 1; });

      projects.forEach(p => {
        const card = addProjectCard(p.name, p.review_status || '进行中', p.created_at);
        if (card) {
          card.dataset.projectId = p.id;
          // 显示真实 issue 数量
          const countSpan = card.querySelector('.issue-count-num');
          if (countSpan) countSpan.textContent = issueCountMap[p.id] || 0;
        }
        const clickArea = card.querySelector('[onclick]');
        if (clickArea) clickArea.setAttribute('onclick', `loadProject('${p.id}')`);
      });
    }
  } catch (e) { console.error('Load projects error:', e); }
}

// 加载单个项目完整数据
async function loadProject(projectId) {
  currentProjectId = projectId;
  // 清理旧上传状态，避免项目间数据污染
  Object.keys(uploadedFiles).forEach(k => {
    (uploadedFiles[k] || []).forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
    delete uploadedFiles[k];
  });
  figmaPendingImport = null;
  try {
    // 获取项目名称（从卡片 DOM 读取，避免额外请求）
    const projCard = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
    const projectName = projCard?.querySelector('.project-name-label')?.textContent?.trim() || '走查任务';

    // 加载图片
    const { data: images } = await sb.from('images').select('*').eq('project_id', projectId).order('page_index');
    const designImgs = (images || []).filter(i => i.slot === 'design');
    const devImgs = (images || []).filter(i => i.slot === 'dev');

    if (designImgs.length || devImgs.length) {
      // 构建画布（与 populateCanvasWithUploads 一致的 DOM 结构）
      const canvasWorld = document.getElementById('canvasWorld');
      if (canvasWorld) canvasWorld.innerHTML = '';
      const maxLen = Math.max(designImgs.length, devImgs.length);

      const group = document.createElement('div');
      group.id = 'canvas-' + projectName;
      group.style.cssText = 'position:absolute; left:60px; top:60px; width:860px;';
      group.innerHTML = '<div class="canvas-label" style="color:#C65D3B; margin-bottom:10px;">\u25cf ' + escHtml(projectName) + ' &nbsp;\xb7&nbsp; ' + maxLen + '个页面</div>';

      for (let i = 0; i < maxLen; i++) {
        const dUrl = designImgs[i]?.public_url || '';
        const vUrl = devImgs[i]?.public_url || '';

        const pageWrapper = document.createElement('div');
        pageWrapper.style.marginBottom = '24px';
        pageWrapper.innerHTML = '<div style="color:#9A9A90;font-size:11px;margin-bottom:8px;">页面 ' + (i + 1) + '</div>' +
          '<div class="pair-col-header" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">' +
          '<span style="font-size:10px;font-weight:600;color:#9A9A90;letter-spacing:.05em;">设计稿</span>' +
          '<span style="font-size:10px;font-weight:600;color:#9A9A90;letter-spacing:.05em;">开发稿</span></div>';

        const pair = document.createElement('div');
        pair.className = 'canvas-pair';
        pair.style.position = 'relative';

        // Design image
        const dWrap = document.createElement('div');
        dWrap.className = 'canvas-img-wrap';
        dWrap.dataset.type = 'design';
        if (dUrl) {
          const img = document.createElement('img');
          img.src = dUrl;
          img.crossOrigin = 'anonymous';
          img.style.cssText = 'width:100%;display:block;border-radius:8px;';
          dWrap.appendChild(img);
        } else {
          dWrap.innerHTML = '<div style="height:200px;background:#EAE7E0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9A9A90;font-size:12px;">无对应设计稿</div>';
        }
        pair.appendChild(dWrap);

        // Analyze button
        const btn = document.createElement('div');
        btn.className = 'pair-analyze-btn visible';
        btn.setAttribute('onclick', 'analyzePair(this)');
        btn.title = '分析差异';
        btn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>';
        pair.appendChild(btn);

        // Dev image
        const vWrap = document.createElement('div');
        vWrap.className = 'canvas-img-wrap';
        vWrap.dataset.type = 'dev';
        if (vUrl) {
          const img = document.createElement('img');
          img.src = vUrl;
          img.crossOrigin = 'anonymous';
          img.style.cssText = 'width:100%;display:block;border-radius:8px;';
          vWrap.appendChild(img);
        } else {
          vWrap.innerHTML = '<div style="height:200px;background:#EAE7E0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9A9A90;font-size:12px;">无对应开发稿</div>';
        }
        pair.appendChild(vWrap);

        pageWrapper.appendChild(pair);
        group.appendChild(pageWrapper);
      }

      if (canvasWorld) canvasWorld.appendChild(group);
    }

    // 更新 breadcrumb
    const bc = document.getElementById('breadcrumbProject');
    if (bc) bc.textContent = projectName;

    // 加载问题
    const { data: issues } = await sb.from('issues').select('*').eq('project_id', projectId).or('deleted.is.null,deleted.eq.false').order('issue_number');
    allIssueCards = [];
    _analyzeCounter = 0;
    const issueList = document.getElementById('issueList');
    if (issueList) issueList.innerHTML = '';

    if (issues && issues.length) {
      const analyzeHint = document.getElementById('analyzeHint');
      if (analyzeHint) analyzeHint.remove();

      for (const issue of issues) {
        _analyzeCounter = Math.max(_analyzeCounter, issue.issue_number);
        const issueId = 'issue-' + issue.issue_number;
        const pClass = { '高': 'priority-high', '中': 'priority-mid', '低': 'priority-low' }[issue.priority] || 'priority-mid';
        const adId = 'ad-' + issue.issue_number, sdId = 'sd-' + issue.issue_number;
        const tlId = 'tl-' + issue.issue_number, ciId = 'ci-' + issue.issue_number;
        const assigneeHtml = issue.assignee_name
          ? `<div class="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold" style="background:${issue.assignee_bg || '#6B6B64'};font-size:9px">${escHtml(issue.assignee_initials || '')}</div><span class="flex-1 text-gray-700">${escHtml(issue.assignee_name)}</span>`
          : `<span class="flex-1">未分配</span>`;
        const statusColor = { '待分配':'gray', '待修改':'blue', '待验收':'purple', '验收通过':'green', '继续修改':'orange' }[issue.status] || 'gray';

        const card = document.createElement('div');
        card.className = 'issue-card p-3 fade-in';
        card.id = issueId;
        card.dataset.type = issue.type;
        card.dataset.priority = issue.priority;
        card.dataset.status = issue.status;
        card.setAttribute('onclick', `selectIssue('${issueId}')`);
        card.innerHTML = `
          <button class="card-delete-btn designer-only" onclick="deleteIssue('${issueId}', event)" title="删除问题"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
          <div class="flex items-center gap-1.5 mb-1.5">
            <span class="status-badge ${PRIORITY_BADGE[issue.priority]} text-xs flex-shrink-0">${escHtml(issue.priority)}优先级</span>
            <span class="tag-type">${escHtml(issue.type)}</span>
          </div>
          <div class="text-xs font-medium text-gray-900 mb-0.5 leading-snug"><span class="text-[10px] text-gray-400 font-mono mr-1">#${issue.issue_number}</span>${escHtml(issue.title)}</div>
          <div class="text-[10px] text-gray-400 mb-2">${new Date(issue.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <div class="compare-left"><div class="text-xs text-gray-500 mb-1.5">设计稿预期</div><span class="font-mono text-xs text-gray-900">${escHtml(issue.expected_val || '')}</span></div>
            <div class="compare-right"><div class="flex items-center justify-between mb-1.5"><span class="text-xs text-gray-400">实际</span><span class="text-xs text-red-500 font-medium">✕ 不匹配</span></div><span class="font-mono text-xs text-red-500">${escHtml(issue.actual_val || '')}</span></div>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 meta-grid">
            <div><div class="meta-label mb-1">修改人员</div><div class="relative"><div onclick="event.stopPropagation();toggleDropdown('${adId}')" class="issue-select ${issue.assignee_name ? '' : 'text-gray-400'}">${assigneeHtml}<svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg></div><div id="${adId}" class="issue-dd hidden"></div></div></div>
            <div><div class="meta-label mb-1">修改进展</div><div class="relative"><div onclick="event.stopPropagation();toggleDropdown('${sdId}')" class="issue-select"><span class="w-1.5 h-1.5 rounded-full bg-${statusColor}-500 flex-shrink-0"></span><span class="flex-1 text-${statusColor}-500">${escHtml(issue.status)}</span><svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg></div><div id="${sdId}" class="issue-dd hidden"></div></div></div>
          </div>
          <div class="timeline-toggle text-xs font-medium text-gray-400" onclick="toggleTimeline(this, event)"><span class="tl-arrow">▸</span> 添加评论</div>
          <div class="card-timeline-section"><div class="space-y-2 mt-2" id="${tlId}"></div><div class="flex items-center gap-1.5 mt-2" onclick="event.stopPropagation()"><input id="${ciId}" type="text" placeholder="留言..." class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white" /><button onclick="sendCardComment('${ciId}','${tlId}')" class="comment-send">发送</button></div></div>
        `;
        allIssueCards.push(card);
        if (issueList) issueList.appendChild(card);

        // 添加画布标注（只加到对应 page 的 pair）
        if (issue.area_left != null) {
          const pageIdx = issue.page_index || 0;
          const pairs = document.querySelectorAll('.canvas-pair');
          const targetPair = pairs[pageIdx];
          if (targetPair) {
            targetPair.querySelectorAll('.canvas-img-wrap').forEach(wrap => {
              const anno = document.createElement('div');
              anno.className = 'issue-anno ' + pClass;
              anno.dataset.issueId = issueId;
              anno.style.cssText = `left:${issue.area_left};top:${issue.area_top};width:${issue.area_width};height:${issue.area_height};`;
              anno.setAttribute('onclick', `highlightIssue('${issueId}')`);
              anno.innerHTML = wrap.dataset.type === 'dev'
                ? `<div class="issue-anno-label">#${issue.issue_number} ${escHtml(issue.title)}</div>`
                : `<div class="issue-anno-label">#${issue.issue_number}</div>`;
              wrap.appendChild(anno);
            });
          }
        }
      }

      // 加载评论
      const issueIds = issues.map(i => i.id);
      const { data: comments } = await sb.from('comments').select('*').in('issue_id', issueIds).order('created_at');
      if (comments) {
        for (const c of comments) {
          const issue = issues.find(i => i.id === c.issue_id);
          if (!issue) continue;
          const tl = document.getElementById('tl-' + issue.issue_number);
          if (!tl) continue;
          const time = new Date(c.created_at);
          const timeStr = time.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const item = document.createElement('div');
          item.className = 'flex items-start gap-2';
          const authorName = c.author || '匿名';
          item.innerHTML = `<div class="timeline-avatar bg-blue-100 text-blue-700">${escHtml(authorName.charAt(0))}</div><div class="flex-1 min-w-0"><div class="text-xs text-gray-800">${escHtml(c.text || '')}</div><div class="text-xs text-gray-400 mt-0.5">${escHtml(timeStr)}</div></div>`;
          tl.appendChild(item);
        }
      }

      showFilterSection();
    }

    rebuildList();
    syncIssueCountToCard();
    showPage('workbench');
    setTimeout(() => canvasFit(), 300);
  } catch (e) { console.error('Load project error:', e); }
}

// ── Init ───────────────────────────────────────────────────────
rebuildList();
renderStats();
renderHome();
// 初始化按钮 tooltip
updateStartBtnTip('btnStartColdTip', false, false);

// ── 标注预览模式切换 ──────────────────────────────────────────
let currentAnnoMode = 'box';

// 获取元素相对于 canvasWorld 的偏移坐标
function getWorldOffset(el) {
  const world = document.getElementById('canvasWorld');
  let x = 0, y = 0, cur = el;
  while (cur && cur !== world && cur !== document.body) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent;
  }
  return { x, y };
}

// ── 拖拽系统 ────────────────────────────────────────────────────
let dragState = null;
const DRAG_HOLD_MS = 250;
const DRAG_THRESHOLD = 5;

function initDragSystem() {
  const vp = document.getElementById('canvasViewport');
  if (!vp) return;
  vp.addEventListener('mousedown', onImgMouseDown);
}

function onImgMouseDown(e) {
  if (e.button !== 0) return;
  // Only trigger drag from draft-label (设计稿/开发稿 tag)
  const label = e.target.closest('.draft-label');
  if (!label) return;
  const wrap = label.closest('.canvas-img-wrap');
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();
  dragState = {
    el: wrap,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    ghost: null,
    timer: null,
    started: false,
    sourceGroup: wrap.closest('[id^="canvas-"]'),
    sourcePair: wrap.closest('.canvas-pair')
  };

  dragState.timer = setTimeout(() => {
    if (dragState) startDrag();
  }, DRAG_HOLD_MS);

  window.addEventListener('mousemove', onDragMoveOrCancel);
  window.addEventListener('mouseup', onDragEnd);
}

function startDrag() {
  if (!dragState || dragState.started) return;
  dragState.started = true;

  // Make original translucent
  dragState.el.classList.add('dragging');

  // Create ghost element
  const ghost = dragState.el.cloneNode(true);
  ghost.className = 'drag-ghost';
  const w = Math.min(dragState.el.offsetWidth, 160);
  const scale = w / dragState.el.offsetWidth;
  ghost.style.width = w + 'px';
  ghost.style.height = (dragState.el.offsetHeight * scale) + 'px';
  ghost.style.left = (dragState.startX - dragState.offsetX * scale) + 'px';
  ghost.style.top = (dragState.startY - dragState.offsetY * scale) + 'px';
  ghost.dataset.scale = scale;
  // Remove annotations from ghost
  ghost.querySelectorAll('.issue-anno').forEach(a => a.remove());
  document.body.appendChild(ghost);
  dragState.ghost = ghost;
}

function onDragMoveOrCancel(e) {
  if (!dragState) return;

  // Before drag started, check if mouse moved too much → cancel timer and start immediately
  if (!dragState.started) {
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      clearTimeout(dragState.timer);
      startDrag();
    }
    if (!dragState.started) return;
  }

  // Move ghost
  const scale = parseFloat(dragState.ghost.dataset.scale);
  dragState.ghost.style.left = (e.clientX - dragState.offsetX * scale) + 'px';
  dragState.ghost.style.top = (e.clientY - dragState.offsetY * scale) + 'px';

  // Highlight target group
  document.querySelectorAll('.canvas-group-block.drag-over').forEach(g => g.classList.remove('drag-over'));
  const target = findDropTarget(e.clientX, e.clientY);
  if (target && target !== dragState.sourceGroup) {
    target.classList.add('drag-over');
  }

  // Show analyze icon near unpaired complementary images when dragging close
  showProximityAnalyzeIcon(e.clientX, e.clientY);
}

function findDropTarget(cx, cy) {
  const groups = document.querySelectorAll('[id^="canvas-"]');
  for (const g of groups) {
    const r = g.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
      return g;
    }
  }
  return null;
}

// ── Proximity analyze icon during drag ──
let proximityIcon = null;
let proximityTarget = null;
const PROXIMITY_THRESHOLD = 80; // px distance to trigger

function showProximityAnalyzeIcon(cx, cy) {
  if (!dragState) return;
  const dragType = dragState.el.dataset.type; // 'design' or 'dev'
  const complement = dragType === 'design' ? 'dev' : 'design';

  // Find all unpaired complementary images (not the one being dragged)
  const candidates = document.querySelectorAll(`.canvas-img-wrap.unpaired[data-type="${complement}"]`);
  let closest = null, closestDist = Infinity;

  for (const c of candidates) {
    if (c === dragState.el) continue;
    const r = c.getBoundingClientRect();
    const ccx = r.left + r.width / 2;
    const ccy = r.top + r.height / 2;
    const dist = Math.hypot(cx - ccx, cy - ccy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = c;
    }
  }

  // Also check paired complements in target groups (drop would create new pair)
  if (!closest || closestDist > PROXIMITY_THRESHOLD) {
    const target = findDropTarget(cx, cy);
    if (target && target !== dragState.sourceGroup) {
      const complements = target.querySelectorAll(`.canvas-img-wrap.unpaired[data-type="${complement}"]`);
      for (const c of complements) {
        const r = c.getBoundingClientRect();
        const ccx = r.left + r.width / 2;
        const ccy = r.top + r.height / 2;
        const dist = Math.hypot(cx - ccx, cy - ccy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = c;
        }
      }
    }
  }

  if (closest && closestDist <= PROXIMITY_THRESHOLD) {
    if (proximityTarget === closest) return; // already showing
    clearProximityAnalyzeIcon();
    proximityTarget = closest;
    // Create a floating analyze icon between ghost and target
    const r = closest.getBoundingClientRect();
    const icon = document.createElement('div');
    icon.className = 'pair-analyze-btn visible';
    icon.style.cssText = 'position:fixed;z-index:10000;pointer-events:none;';
    icon.style.left = (r.left + r.width / 2 - 16) + 'px';
    icon.style.top = (r.top + r.height / 2 - 16) + 'px';
    icon.style.transform = 'none';
    icon.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>';
    document.body.appendChild(icon);
    proximityIcon = icon;
    // Highlight the target image
    closest.style.outline = '2px solid #C65D3B';
    closest.style.outlineOffset = '2px';
  } else {
    clearProximityAnalyzeIcon();
  }
}

function clearProximityAnalyzeIcon() {
  if (proximityIcon) {
    proximityIcon.remove();
    proximityIcon = null;
  }
  if (proximityTarget) {
    proximityTarget.style.outline = '';
    proximityTarget.style.outlineOffset = '';
    proximityTarget = null;
  }
}

function onDragEnd(e) {
  window.removeEventListener('mousemove', onDragMoveOrCancel);
  window.removeEventListener('mouseup', onDragEnd);

  if (!dragState) return;
  clearTimeout(dragState.timer);

  if (!dragState.started) {
    dragState = null;
    return;
  }

  // Clean up ghost and proximity icon
  if (dragState.ghost) dragState.ghost.remove();
  dragState.el.classList.remove('dragging');
  clearProximityAnalyzeIcon();

  // Find drop target
  const target = findDropTarget(e.clientX, e.clientY);
  if (target && target !== dragState.sourceGroup) {
    // Move the image element to target group
    moveImageToGroup(dragState.el, dragState.sourceGroup, target);
  }

  // Clear highlight
  document.querySelectorAll('.canvas-group-block.drag-over').forEach(g => g.classList.remove('drag-over'));
  dragState = null;
}

function moveImageToGroup(imgWrap, fromGroup, toGroup) {
  // Remove from source pair
  const sourcePair = imgWrap.closest('.canvas-pair');
  imgWrap.remove();

  // Check if source pair has remaining image
  if (sourcePair) {
    const remaining = sourcePair.querySelectorAll('.canvas-img-wrap');
    const analyzeBtn = sourcePair.querySelector('.pair-analyze-btn');
    if (remaining.length === 0) {
      // Empty pair, remove it and its page wrapper
      const pageWrapper = sourcePair.closest('div[style*="margin-bottom"]') || sourcePair.parentElement;
      if (pageWrapper && pageWrapper !== fromGroup) {
        // Only remove wrapper if it only contains the pair
        const otherPairs = pageWrapper.querySelectorAll('.canvas-pair');
        if (otherPairs.length <= 1) pageWrapper.remove();
        else sourcePair.remove();
      } else {
        sourcePair.remove();
      }
    } else if (remaining.length === 1) {
      // Only one image left - add unpaired style, remove analyze btn
      remaining[0].classList.add('unpaired');
      if (analyzeBtn) analyzeBtn.remove();
    }
  }

  // Find or create a place in target group
  const targetType = imgWrap.dataset.type;
  const complement = targetType === 'design' ? 'dev' : 'design';

  // Look for an unpaired complementary image in target group
  const unpairedComplement = toGroup.querySelector(`.canvas-img-wrap.unpaired[data-type="${complement}"]`);

  if (unpairedComplement) {
    // Create a new pair with the complement
    unpairedComplement.classList.remove('unpaired');
    imgWrap.classList.remove('unpaired');
    const newPair = document.createElement('div');
    newPair.className = 'canvas-pair';
    newPair.style.position = 'relative';

    // Design always on left
    const designEl = targetType === 'design' ? imgWrap : unpairedComplement;
    const devEl = targetType === 'dev' ? imgWrap : unpairedComplement;

    // Replace the unpaired element with the new pair
    unpairedComplement.parentElement.replaceChild(newPair, unpairedComplement);
    newPair.appendChild(designEl);
    // Add analyze button via insertAdjacentHTML to preserve existing DOM nodes
    const analyzeDiv = document.createElement('div');
    analyzeDiv.className = 'pair-analyze-btn visible';
    analyzeDiv.setAttribute('onclick', 'analyzePair(this)');
    analyzeDiv.title = '分析差异';
    analyzeDiv.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>';
    newPair.appendChild(analyzeDiv);
    newPair.appendChild(devEl);
  } else {
    // No complement found, add as unpaired
    imgWrap.classList.add('unpaired');
    // Create a wrapper for the single image
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '16px';
    wrapper.appendChild(imgWrap);
    // Insert before the last child or at the end of the group
    const label = toGroup.querySelector('.canvas-label');
    if (label && label.nextSibling) {
      toGroup.insertBefore(wrapper, label.nextSibling);
    } else {
      toGroup.appendChild(wrapper);
    }
  }

  // Update group labels
  updateGroupLabel(fromGroup);
  updateGroupLabel(toGroup);

  // Recalculate group positions
  recalcGroupPositions();

  // Refresh annotation mode
  if (currentAnnoMode === 'spotlight') {
    setAnnoMode('spotlight');
  }

  showToast('已移动到 ' + toGroup.querySelector('.canvas-label').textContent.replace(/●\s*/, '').split('·')[0].trim());
}

function updateGroupLabel(group) {
  const label = group.querySelector('.canvas-label');
  if (!label) return;
  const pairs = group.querySelectorAll('.canvas-pair');
  const singles = group.querySelectorAll('.canvas-img-wrap.unpaired');
  const pageCount = pairs.length + singles.length;
  const annos = group.querySelectorAll('.issue-anno');
  const issueCount = new Set([...annos].map(a => a.dataset.issueId || a.getAttribute('onclick'))).size;
  const color = label.style.color || '#888';
  const name = label.textContent.replace(/●\s*/, '').split('·')[0].trim();
  label.innerHTML = `● ${name} &nbsp;·&nbsp; ${pageCount}个页面 &nbsp;·&nbsp; ${issueCount}个问题`;
}

function recalcGroupPositions() {
  const groups = document.querySelectorAll('[id^="canvas-"]');
  let currentTop = 60;
  groups.forEach(g => {
    g.style.top = currentTop + 'px';
    // Force layout recalculation
    currentTop += g.offsetHeight + 40;
  });
}

// ── AI 提示条 ─────────────────────────────────────────────────────
function insertAIReviewTip(count) {
  const issueList = document.getElementById('issueList');
  if (!issueList) return;
  // 移除旧提示条
  const old = issueList.querySelector('.ai-review-tip');
  if (old) old.remove();
  const tip = document.createElement('div');
  tip.className = 'ai-review-tip';
  tip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>AI 生成了 ${count} 个问题，建议检查后再分配给开发。误报可点击卡片右上角删除。</span><button onclick="this.parentElement.remove()" style="margin-left:auto;padding:2px 8px;border:none;background:none;color:#92400e;font-size:12px;cursor:pointer;white-space:nowrap">知道了</button>`;
  issueList.insertBefore(tip, issueList.firstChild);
}

// ── 分析功能 ────────────────────────────────────────────────────
let _analyzeCounter = 100; // ID counter for new issues

const ISSUE_POOL = [
  { title: '颜色偏差', desc: '色值与设计稿不一致，存在明显色差', type: '视觉', priority: '高', area: {left:'10%',top:'20%',width:'80%',height:'30%'} },
  { title: '间距不一致', desc: '元素间距与设计稿存在偏差', type: '布局', priority: '中', area: {left:'5%',top:'55%',width:'90%',height:'25%'} },
  { title: '字号偏差', desc: '字体大小与设计稿规范不符', type: '视觉', priority: '低', area: {left:'15%',top:'8%',width:'70%',height:'18%'} },
  { title: '圆角差异', desc: '圆角半径与设计稿不匹配', type: '视觉', priority: '中', area: {left:'8%',top:'35%',width:'84%',height:'22%'} },
  { title: '字重不匹配', desc: 'font-weight 与设计稿规范不一致', type: '视觉', priority: '低', area: {left:'12%',top:'12%',width:'76%',height:'15%'} },
  { title: '对齐偏移', desc: '元素水平/垂直对齐存在像素级偏移', type: '布局', priority: '中', area: {left:'3%',top:'40%',width:'94%',height:'20%'} },
  { title: '阴影缺失', desc: '设计稿中的投影效果未实现', type: '视觉', priority: '低', area: {left:'10%',top:'30%',width:'80%',height:'35%'} },
  { title: '图标尺寸偏差', desc: '图标大小与设计规范不一致', type: '视觉', priority: '中', area: {left:'20%',top:'5%',width:'25%',height:'20%'} },
];

const PRIORITY_BADGE = { '高': 'badge-high', '中': 'badge-mid', '低': 'badge-low' };

// 处理重叠标注的标签错开显示
function staggerOverlappingLabels(container) {
  const wraps = container.querySelectorAll('.canvas-img-wrap');
  wraps.forEach(wrap => {
    const annos = [...wrap.querySelectorAll('.issue-anno')];
    if (annos.length < 2) return;
    // 按 top 值排序分组，相近的需要错开
    const labelInfos = annos.map(a => {
      const label = a.querySelector('.issue-anno-label');
      const top = parseFloat(a.style.top) || 0;
      const left = parseFloat(a.style.left) || 0;
      return { anno: a, label, top, left };
    }).sort((a, b) => a.top - b.top || a.left - b.left);

    // 检测标签是否会重叠（top 值差距 < 12%）
    for (let i = 0; i < labelInfos.length; i++) {
      let offset = 0;
      for (let j = 0; j < i; j++) {
        if (Math.abs(labelInfos[i].top - labelInfos[j].top) < 12) {
          offset++;
        }
      }
      if (offset > 0 && labelInfos[i].label) {
        labelInfos[i].label.style.top = (-18 - offset * 18) + 'px';
      }
    }
  });
}

async function analyzePair(btnEl) {
  if (btnEl.classList.contains('analyzing') || btnEl.classList.contains('analyzed')) return;
  const pair = btnEl.closest('.canvas-pair');
  if (!pair) return;

  const design = pair.querySelector('[data-type="design"]');
  const dev = pair.querySelector('[data-type="dev"]');
  if (!design || !dev) {
    showToast('需要设计稿和开发稿配对后才能分析');
    return;
  }

  const designImg = design.querySelector('img');
  const devImg = dev.querySelector('img');

  // 如果没有真实图片，使用 mock 模式
  if (!designImg || !devImg) {
    analyzePairMock(btnEl, pair, dev);
    return;
  }

  btnEl.classList.add('analyzing');
  btnEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path stroke-linecap="round" d="M12 3a9 9 0 1 1-6.36 2.64"/></svg>';

  // 添加扫描动画（仅动画，不含进度条）
  const scanHtmlTpl = `<div class="scan-overlay"><div class="scan-line"></div><div class="scan-grid"></div></div><div class="analyzing-mask"></div>`;
  design.insertAdjacentHTML('beforeend', scanHtmlTpl);
  dev.insertAdjacentHTML('beforeend', scanHtmlTpl);

  // 右侧面板进度条
  const panelFill = document.getElementById('panelProgressFill');
  const panelText = document.getElementById('panelProgressText');
  let progress = 0;
  const progressTimer = setInterval(() => {
    progress += (95 - progress) * 0.06;
    if (panelFill) panelFill.style.width = progress + '%';
    if (panelText) panelText.textContent = `正在分析... ${Math.round(progress)}%`;
  }, 200);

  try {
    // 确保图片加载完成
    await Promise.all([waitForImgLoad(designImg), waitForImgLoad(devImg)]);
    const designB64 = imgToBase64(designImg);
    const devB64 = imgToBase64(devImg);

    const _analyzeAC = new AbortController();
    const _analyzeTimeout = setTimeout(() => _analyzeAC.abort(), 120000); // 2 分钟超时
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designImage: designB64, devImage: devB64 }),
      signal: _analyzeAC.signal,
    });

    clearTimeout(_analyzeTimeout);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || '分析服务异常');
    }

    const data = await resp.json();
    const picked = data.issues || [];

    // 完成进度条动画
    clearInterval(progressTimer);
    if (panelFill) panelFill.style.width = '100%';
    if (panelText) panelText.textContent = '分析完成';
    await new Promise(r => setTimeout(r, 400));

    // 移除扫描动画
    pair.querySelectorAll('.scan-overlay, .analyzing-mask').forEach(el => el.remove());

    if (picked.length === 0) {
      btnEl.classList.remove('analyzing');
      btnEl.classList.add('analyzed');
      btnEl.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
      showToast('未发现还原问题，设计还原度良好！');
      return;
    }

    // 清除提示文字和进度条
    const issueList = document.getElementById('issueList');
    if (issueList) {
      const hint = document.getElementById('analyzeHint');
      if (hint) hint.remove();
    }

    const annoColor = '#C65D3B';
    const priorityClass = { '高': 'priority-high', '中': 'priority-mid', '低': 'priority-low' };

    // 计算当前 pair 在 canvas 中的页码索引
    const pairGroup = pair.closest('[id^="canvas-"]');
    const pairPageIndex = pairGroup ? Array.from(pairGroup.querySelectorAll('.canvas-pair')).indexOf(pair) : 0;

    picked.forEach((issue, i) => {
      _analyzeCounter++;
      const issueId = 'issue-' + _analyzeCounter;
      const pClass = priorityClass[issue.priority] || 'priority-mid';

      // 在开发稿上添加标注框
      const anno = document.createElement('div');
      anno.className = 'issue-anno ' + pClass;
      anno.dataset.issueId = issueId;
      anno.style.cssText = `left:${issue.area.left};top:${issue.area.top};width:${issue.area.width};height:${issue.area.height};`;
      anno.setAttribute('onclick', `highlightIssue('${issueId}')`);
      anno.innerHTML = `<div class="issue-anno-label">#${_analyzeCounter} ${escHtml(issue.title)}</div>`;
      dev.appendChild(anno);

      // 同时在设计稿上添加标注框（仅编号，不显示标题）
      const annoDesign = document.createElement('div');
      annoDesign.className = 'issue-anno ' + pClass;
      annoDesign.dataset.issueId = issueId;
      annoDesign.style.cssText = `left:${issue.area.left};top:${issue.area.top};width:${issue.area.width};height:${issue.area.height};`;
      annoDesign.setAttribute('onclick', `highlightIssue('${issueId}')`);
      annoDesign.innerHTML = `<div class="issue-anno-label">#${_analyzeCounter}</div>`;
      design.appendChild(annoDesign);

      // 构建问题卡片
      const adId = 'ad-' + _analyzeCounter;
      const sdId = 'sd-' + _analyzeCounter;
      const tlId = 'tl-' + _analyzeCounter;
      const ciId = 'ci-' + _analyzeCounter;

      // 判断是否是颜色值（#开头）
      const isColor = (v) => /^#[0-9a-fA-F]{3,8}$/.test((v||'').trim());
      const expectedVal = issue.expected || '';
      const actualVal = issue.actual || '';

      let compareHtml = '';
      if (expectedVal || actualVal) {
        compareHtml = `<div class="grid grid-cols-2 gap-2 mb-2">
          <div class="compare-left">
            <div class="text-xs text-gray-500 mb-1.5">设计稿预期</div>
            <div class="flex items-center gap-1.5">${isColor(expectedVal) ? `<div class="w-5 h-5 rounded flex-shrink-0" style="background:${escHtml(expectedVal)}"></div>` : ''}<span class="font-mono text-xs text-gray-900">${escHtml(expectedVal)}</span></div>
          </div>
          <div class="compare-right">
            <div class="flex items-center justify-between mb-1.5"><span class="text-xs text-gray-400">实际</span><span class="text-xs text-red-500 font-medium">\u2715 不匹配</span></div>
            <div class="flex items-center gap-1.5">${isColor(actualVal) ? `<div class="w-5 h-5 rounded flex-shrink-0" style="background:${escHtml(actualVal)}"></div>` : ''}<span class="font-mono text-xs text-red-500">${escHtml(actualVal)}</span></div>
          </div>
        </div>`;
      }

      const card = document.createElement('div');
      card.className = 'issue-card p-3 fade-in';
      card.id = issueId;
      card.dataset.type = issue.type;
      card.dataset.priority = issue.priority;
      card.dataset.status = '待分配';
      card.setAttribute('onclick', `selectIssue('${issueId}')`);
      card.innerHTML = `
        <button class="card-delete-btn designer-only" onclick="deleteIssue('${issueId}', event)" title="删除问题"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="status-badge ${PRIORITY_BADGE[issue.priority]} text-xs flex-shrink-0">${escHtml(issue.priority)}优先级</span>
          <span class="tag-type">${escHtml(issue.type)}</span>
        </div>
        <div class="text-xs font-medium text-gray-900 mb-0.5 leading-snug"><span class="text-[10px] text-gray-400 font-mono mr-1">#${_analyzeCounter}</span>${escHtml(issue.title)}</div>
        <div class="text-[10px] text-gray-400 mb-1">刚刚 · AI 自动检测</div>
        <div class="text-[10px] text-gray-400 mb-2">${escHtml(issue.desc)}</div>
        ${compareHtml}
        <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 meta-grid">
          <div>
            <div class="meta-label mb-1">修改人员</div>
            <div class="relative">
              <div onclick="event.stopPropagation();toggleDropdown('${adId}')" class="issue-select text-gray-400">
                <span class="flex-1">未分配</span>
                <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="${adId}" class="issue-dd hidden"></div>
            </div>
          </div>
          <div>
            <div class="meta-label mb-1">修改进展</div>
            <div class="relative">
              <div onclick="event.stopPropagation();toggleDropdown('${sdId}')" class="issue-select">
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span class="flex-1">待分配</span>
                <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="${sdId}" class="issue-dd hidden"></div>
            </div>
          </div>
        </div>
        <div class="timeline-toggle text-xs font-medium text-gray-400" onclick="toggleTimeline(this, event)"><span class="tl-arrow">▸</span> 添加评论</div>
        <div class="card-timeline-section">
          <div class="space-y-2 mt-2" id="${tlId}"></div>
          <div class="flex items-center gap-1.5 mt-2" onclick="event.stopPropagation()">
            <input id="${ciId}" type="text" placeholder="留言..." class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white" />
            <button onclick="sendCardComment('${ciId}','${tlId}')" class="comment-send">发送</button>
          </div>
        </div>
      `;
      allIssueCards.push(card);
      if (issueList) {
        issueList.appendChild(card);
      }

      // 保存 AI 发现的问题到 Supabase
      if (currentProjectId) {
        sb.from('issues').insert({
          project_id: currentProjectId, issue_number: _analyzeCounter,
          title: issue.title, type: issue.type, priority: issue.priority, status: '待分配',
          description: issue.desc, expected_val: issue.expected || '', actual_val: issue.actual || '',
          area_left: issue.area?.left, area_top: issue.area?.top, area_width: issue.area?.width, area_height: issue.area?.height,
          source: 'ai', page_index: pairPageIndex, user_id: currentUserId
        }).then(({ error }) => { if (error) console.error('Issue save failed:', error); });
      }
    });

    btnEl.classList.remove('analyzing');
    btnEl.classList.add('analyzed');
    btnEl.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

    const group = pair.closest('[id^="canvas-"]');
    if (group) updateGroupLabel(group);
    if (currentAnnoMode === 'spotlight') setAnnoMode('spotlight');

    showToast(`AI 发现 ${picked.length} 个还原问题`);
    rebuildList();
    syncIssueCountToCard();
    showFilterSection();
    staggerOverlappingLabels(pair);
    // AI 提示条
    insertAIReviewTip(picked.length);

  } catch (err) {
    clearInterval(progressTimer);
    pair.querySelectorAll('.scan-overlay, .analyzing-mask').forEach(el => el.remove());
    btnEl.classList.remove('analyzing');
    const errMsg = err.name === 'AbortError' ? '分析请求超时，请检查网络后重试' : (err.message || '分析失败');
    showToast(errMsg);
    console.error('分析失败详情:', err);
    // 重置按钮为可重新点击状态
    btnEl.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-2.64-6.36"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 3v6h-6"/></svg>';

    // 将分析提示区替换为失败提示 + 重试按钮
    const analyzeHint = document.getElementById('analyzeHint');
    if (analyzeHint) {
      analyzeHint.innerHTML = `
        <div class="text-xs text-gray-400 mb-4">分析失败，请重试</div>
        <button onclick="retryAnalyze(this)" style="display:inline-flex;align-items:center;gap:6px;padding:8px 20px;font-size:12px;font-weight:500;border:none;border-radius:8px;background:#C65D3B;color:#fff;cursor:pointer;">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-2.64-6.36"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 3v6h-6"/></svg>
          重新分析
        </button>
      `;
    } else {
      // 如果 hint 已被移除，在 issueList 中插入失败提示
      const issueList = document.getElementById('issueList');
      if (issueList) {
        issueList.innerHTML = `
          <div class="text-center" style="padding-top:40vh;" id="analyzeHint">
            <div class="text-xs text-gray-400 mb-4">分析失败，请重试</div>
            <button onclick="retryAnalyze(this)" style="display:inline-flex;align-items:center;gap:6px;padding:8px 20px;font-size:12px;font-weight:500;border:none;border-radius:8px;background:#C65D3B;color:#fff;cursor:pointer;">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-2.64-6.36"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 3v6h-6"/></svg>
              重新分析
            </button>
          </div>`;
      }
    }
    showToast('分析失败，请重试');
  }
}

// 重试分析：找到当前画布的分析按钮重新触发
function retryAnalyze(retryBtn) {
  const analyzeBtn = document.querySelector('.pair-analyze-btn:not(.analyzed)');
  if (analyzeBtn) {
    analyzeBtn.classList.remove('analyzing', 'analyzed');
    analyzePair(analyzeBtn);
  }
}

// Mock fallback（画布上没有真实图片时使用）
function analyzePairMock(btnEl, pair, dev) {
  const design = pair.querySelector('[data-type="design"]');
  btnEl.classList.add('analyzing');
  btnEl.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path stroke-linecap="round" d="M12 3a9 9 0 1 1-6.36 2.64"/></svg>';

  // 添加扫描动画（仅动画，不含进度条）
  const scanHtmlTpl = `<div class="scan-overlay"><div class="scan-line"></div><div class="scan-grid"></div></div><div class="analyzing-mask"></div>`;
  if (design) design.insertAdjacentHTML('beforeend', scanHtmlTpl);
  dev.insertAdjacentHTML('beforeend', scanHtmlTpl);
  const panelFill = document.getElementById('panelProgressFill');
  const panelText = document.getElementById('panelProgressText');
  let mockProgress = 0;
  const mockProgressTimer = setInterval(() => {
    mockProgress += (95 - mockProgress) * 0.08;
    if (panelFill) panelFill.style.width = mockProgress + '%';
    if (panelText) panelText.textContent = `正在分析... ${Math.round(mockProgress)}%`;
  }, 100);

  setTimeout(() => {
    clearInterval(mockProgressTimer);
    if (panelFill) panelFill.style.width = '100%';
    if (panelText) panelText.textContent = '分析完成';

    setTimeout(() => {
    pair.querySelectorAll('.scan-overlay, .analyzing-mask').forEach(el => el.remove());

    // 清除提示文字和进度条
    const analyzeHint = document.getElementById('analyzeHint');
    if (analyzeHint) analyzeHint.remove();

    const picked = [...ISSUE_POOL];
    const count = picked.length;
    const priorityClass = { '高': 'priority-high', '中': 'priority-mid', '低': 'priority-low' };

    picked.forEach((issue, i) => {
      _analyzeCounter++;
      const issueId = 'issue-' + _analyzeCounter;
      const pClass = priorityClass[issue.priority] || 'priority-mid';

      const anno = document.createElement('div');
      anno.className = 'issue-anno ' + pClass;
      anno.dataset.issueId = issueId;
      anno.style.cssText = `left:${issue.area.left};top:${issue.area.top};width:${issue.area.width};height:${issue.area.height};`;
      anno.setAttribute('onclick', `highlightIssue('${issueId}')`);
      anno.innerHTML = `<div class="issue-anno-label">#${_analyzeCounter} ${escHtml(issue.title)}</div>`;
      dev.appendChild(anno);

      // 同时在设计稿上添加标注框（仅编号）
      if (design) {
        const annoDesign = document.createElement('div');
        annoDesign.className = 'issue-anno ' + pClass;
        annoDesign.dataset.issueId = issueId;
        annoDesign.style.cssText = `left:${issue.area.left};top:${issue.area.top};width:${issue.area.width};height:${issue.area.height};`;
        annoDesign.setAttribute('onclick', `highlightIssue('${issueId}')`);
        annoDesign.innerHTML = `<div class="issue-anno-label">#${_analyzeCounter}</div>`;
        design.appendChild(annoDesign);
      }

      const card = document.createElement('div');
      card.className = 'issue-card p-3 fade-in';
      card.id = issueId;
      card.dataset.type = issue.type;
      card.dataset.priority = issue.priority;
      card.dataset.status = '待分配';
      card.setAttribute('onclick', `selectIssue('${issueId}')`);
      const adId = 'ad-' + _analyzeCounter;
      const sdId = 'sd-' + _analyzeCounter;
      const tlId = 'tl-' + _analyzeCounter;
      const ciId = 'ci-' + _analyzeCounter;
      // 对比数据从 ISSUE_POOL 取值
      const pool = issue.expected ? { expect: issue.expected, actual: issue.actual || '—', label: '' } : null;
      const compareHtml = pool ? `
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div class="compare-left">
            <div class="text-xs text-gray-500 mb-1.5">设计稿预期</div>
            <span class="font-mono text-xs text-gray-900">${escHtml(pool.expect)}</span>
          </div>
          <div class="compare-right">
            <div class="flex items-center justify-between mb-1.5"><span class="text-xs text-gray-400">实际</span><span class="text-xs text-red-500 font-medium">✕ 不匹配</span></div>
            <span class="font-mono text-xs text-red-500">${escHtml(pool.actual)}</span>
          </div>
        </div>` : '';
      card.innerHTML = `
        <button class="card-delete-btn designer-only" onclick="deleteIssue('${issueId}', event)" title="删除问题"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="status-badge ${PRIORITY_BADGE[issue.priority]} text-xs flex-shrink-0">${escHtml(issue.priority)}优先级</span>
          <span class="tag-type">${escHtml(issue.type)}</span>
        </div>
        <div class="text-xs font-medium text-gray-900 mb-0.5 leading-snug"><span class="text-[10px] text-gray-400 font-mono mr-1">#${_analyzeCounter}</span>${escHtml(issue.title)}</div>
        <div class="text-[10px] text-gray-400 mb-1">刚刚 · AI 自动检测</div>
        <div class="text-[10px] text-gray-400 mb-2">${escHtml(issue.desc)}</div>
        ${compareHtml}
        <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 meta-grid">
          <div>
            <div class="meta-label mb-1">修改人员</div>
            <div class="relative">
              <div onclick="event.stopPropagation();toggleDropdown('${adId}')" class="issue-select text-gray-400">
                <span class="flex-1">未分配</span>
                <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="${adId}" class="issue-dd hidden"></div>
            </div>
          </div>
          <div>
            <div class="meta-label mb-1">修改进展</div>
            <div class="relative">
              <div onclick="event.stopPropagation();toggleDropdown('${sdId}')" class="issue-select">
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span class="flex-1">待分配</span>
                <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div id="${sdId}" class="issue-dd hidden"></div>
            </div>
          </div>
        </div>
        <div class="timeline-toggle text-xs font-medium text-gray-400" onclick="toggleTimeline(this, event)"><span class="tl-arrow">▸</span> 添加评论</div>
        <div class="card-timeline-section">
          <div class="space-y-2 mt-2" id="${tlId}"></div>
          <div class="flex items-center gap-1.5 mt-2" onclick="event.stopPropagation()">
            <input id="${ciId}" type="text" placeholder="留言..." class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white" />
            <button onclick="sendCardComment('${ciId}','${tlId}')" class="comment-send">发送</button>
          </div>
        </div>
      `;
      allIssueCards.push(card);
      const issueList = document.getElementById('issueList');
      if (issueList && issueList.firstChild) {
        issueList.insertBefore(card, issueList.firstChild);
      } else if (issueList) {
        issueList.appendChild(card);
      }
    });

    btnEl.classList.remove('analyzing');
    btnEl.classList.add('analyzed');
    btnEl.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

    const group = pair.closest('[id^="canvas-"]');
    if (group) updateGroupLabel(group);
    if (currentAnnoMode === 'spotlight') setAnnoMode('spotlight');

    showToast(`发现 ${count} 个还原问题`);
    rebuildList();
    syncIssueCountToCard();
    showFilterSection();
    staggerOverlappingLabels(pair);
    // AI 提示条
    insertAIReviewTip(count);
    }, 300);
  }, 1500);
}

// Init drag system when page loads
document.addEventListener('DOMContentLoaded', () => {
  initDragSystem();
  // Click canvas blank area to deselect issue
  const vp = document.getElementById('canvasViewport');
  if (vp) vp.addEventListener('click', function(e) {
    if (!e.target.closest('.issue-anno') && !e.target.closest('.issue-card') && !e.target.closest('.pair-analyze-btn')) {
      deselectIssue();
    }
  });
});
// Also init if DOM already loaded
if (document.readyState !== 'loading') initDragSystem();

// 重绘 spotlight canvas：选中的标注全亮，未选中的半暗
function refreshSpotlightCanvas() {
  document.querySelectorAll('.spotlight-canvas-overlay').forEach(cvs => {
    const wrap = cvs.parentElement;
    if (!wrap) return;
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w || !h) return;
    const ctx = cvs.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // 画暗层
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);
    const annos = wrap.querySelectorAll('.issue-anno');
    const hasSelection = !!selectedIssueId;
    annos.forEach(anno => {
      const al = (parseFloat(anno.style.left) || 0) / 100 * w;
      const at = (parseFloat(anno.style.top) || 0) / 100 * h;
      const aw = (parseFloat(anno.style.width) || 0) / 100 * w;
      const ah = (parseFloat(anno.style.height) || 0) / 100 * h;
      const isActive = anno.classList.contains('anno-active');
      if (isActive) {
        // 选中：完全透明挖空
        ctx.clearRect(al, at, aw, ah);
      } else if (hasSelection) {
        // 未选中但有选中项：半暗覆盖（挖空后再填半透明）
        ctx.clearRect(al, at, aw, ah);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(al, at, aw, ah);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
      } else {
        // 无选中：正常挖空
        ctx.clearRect(al, at, aw, ah);
      }
    });
  });
  // 更新浮动标签可见性
  document.querySelectorAll('.spotlight-ext-label').forEach(label => {
    if (!selectedIssueId) {
      label.style.opacity = '1';
    } else {
      // 根据标签文本中的编号判断是否为选中问题
      const num = label.textContent.match(/#(\d+)/);
      const issueId = num ? 'issue-' + num[1] : '';
      label.style.opacity = issueId === selectedIssueId ? '1' : '0.3';
    }
  });
}

function setAnnoMode(mode) {
  currentAnnoMode = mode;
  const vp = document.getElementById('canvasViewport');
  if (!vp) return;

  // 清除上次生成的浮动元素
  document.querySelectorAll('.spotlight-full-overlay, .spotlight-canvas-overlay, .spotlight-ext-label').forEach(el => el.remove());

  vp.classList.toggle('anno-spotlight-mode', mode === 'spotlight');
  vp.classList.toggle('anno-box-mode', mode === 'box');
  vp.classList.toggle('draw-enabled', mode === 'box' && currentRole === 'designer');
  document.getElementById('modeBtn-box').classList.toggle('active', mode === 'box');
  document.getElementById('modeBtn-spotlight').classList.toggle('active', mode === 'spotlight');

  if (mode !== 'spotlight') return;

  const world = document.getElementById('canvasWorld');

  document.querySelectorAll('.canvas-img-wrap').forEach(wrap => {
    const annos = wrap.querySelectorAll('.issue-anno');

    // 无标注的图片：全图压暗
    if (!annos.length) {
      const overlay = document.createElement('div');
      overlay.className = 'spotlight-full-overlay';
      wrap.appendChild(overlay);
      return;
    }

    // 有标注的图片：用 canvas 生成暗层，标注区域挖空高亮
    const w = wrap.offsetWidth;
    const h = wrap.offsetHeight;
    if (w && h) {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2; // 2x for retina
      canvas.height = h * 2;
      canvas.className = 'spotlight-canvas-overlay';
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, w, h);
      // 挖空标注区域
      annos.forEach(anno => {
        const al = (parseFloat(anno.style.left) || 0) / 100 * w;
        const at = (parseFloat(anno.style.top) || 0) / 100 * h;
        const aw = (parseFloat(anno.style.width) || 0) / 100 * w;
        const ah = (parseFloat(anno.style.height) || 0) / 100 * h;
        ctx.clearRect(al, at, aw, ah);
      });
      wrap.appendChild(canvas);
    }

    // 浮动标签
    const wrapPos = getWorldOffset(wrap);
    annos.forEach(anno => {
      const orig = anno.querySelector('.issue-anno-label');
      if (!orig) return;
      const annoLeftPx = (parseFloat(anno.style.left) / 100) * wrap.offsetWidth;
      const annoTopPx  = (parseFloat(anno.style.top)  / 100) * wrap.offsetHeight;
      const label = document.createElement('div');
      label.className = 'spotlight-ext-label';
      label.textContent = orig.textContent;
      label.style.cssText = `left:${wrapPos.x + annoLeftPx}px; top:${wrapPos.y + annoTopPx - 22}px;`;
      world.appendChild(label);
    });
  });
}

// ── 划区画框新增问题 ────────────────────────────────────────────
(function() {
  let drawState = null;
  let activePopover = null;

  function removePopover() {
    if (activePopover) { activePopover.remove(); activePopover = null; }
  }

  document.addEventListener('mousedown', function(e) {
    // 点击 popover 外部关闭
    if (activePopover && !activePopover.contains(e.target)) {
      removePopover();
    }

    if (currentAnnoMode !== 'box') return;
    if (currentRole !== 'designer') return; // 仅设计师模式可画框
    const wrap = e.target.closest('.canvas-img-wrap');
    if (!wrap) return;
    // 忽略点击已有标注
    if (e.target.closest('.issue-anno')) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = wrap.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    const preview = document.createElement('div');
    preview.className = 'draw-rect-preview';
    preview.style.left = startX + '%';
    preview.style.top = startY + '%';
    preview.style.width = '0';
    preview.style.height = '0';
    wrap.appendChild(preview);

    drawState = { wrap, startX, startY, preview };
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (!drawState) return;
    const rect = drawState.wrap.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const left = Math.min(drawState.startX, curX);
    const top = Math.min(drawState.startY, curY);
    const w = Math.abs(curX - drawState.startX);
    const h = Math.abs(curY - drawState.startY);

    drawState.preview.style.left = left + '%';
    drawState.preview.style.top = top + '%';
    drawState.preview.style.width = w + '%';
    drawState.preview.style.height = h + '%';
  });

  document.addEventListener('mouseup', function(e) {
    if (!drawState) return;
    const { wrap, preview } = drawState;
    const left = parseFloat(preview.style.left);
    const top = parseFloat(preview.style.top);
    const w = parseFloat(preview.style.width);
    const h = parseFloat(preview.style.height);
    preview.remove();

    const ds = drawState;
    drawState = null;

    // 面积太小则忽略
    if (w < 3 || h < 3) return;

    removePopover();
    showAddIssuePopover(wrap, left, top, w, h);
  });

  function showAddIssuePopover(wrap, left, top, w, h) {
    const popover = document.createElement('div');
    popover.className = 'add-issue-popover';
    // 定位在视口层级（fixed），不被 img-wrap overflow 裁剪
    popover.style.position = 'fixed';
    popover.style.zIndex = '999';
    const wrapRect = wrap.getBoundingClientRect();
    const popLeft = wrapRect.left + (left + w) / 100 * wrapRect.width + 8;
    const popTop = wrapRect.top + (top) / 100 * wrapRect.height;
    // 防止超出右侧或底部
    popover.style.left = Math.min(popLeft, window.innerWidth - 280) + 'px';
    popover.style.top = Math.min(popTop, window.innerHeight - 380) + 'px';

    popover.innerHTML = `
      <div class="field">
        <label>问题内容</label>
        <input id="drawIssueName" type="text" placeholder="例如：颜色偏差" autofocus />
      </div>
      <div class="field">
        <label>预期效果</label>
        <input id="drawIssueExpect" type="text" placeholder="例如：按钮背景应为 #007AFF" />
      </div>
      <div class="field">
        <label>类型</label>
        <select id="drawIssueType">
          <option value="视觉">视觉</option>
          <option value="布局">布局</option>
          <option value="内容一致性">内容一致性</option>
          <option value="交互">交互</option>
        </select>
      </div>
      <div class="field">
        <label>优先级</label>
        <select id="drawIssuePriority">
          <option value="中">中</option>
          <option value="高">高</option>
          <option value="低">低</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="drawIssueCancel" style="flex:1;padding:6px;font-size:12px;border:1px solid #D1D1C9;border-radius:8px;background:#F4F1EA;cursor:pointer;color:#6B6B64;">取消</button>
        <button id="drawIssueConfirm" style="flex:1;padding:6px;font-size:12px;border:none;border-radius:8px;background:#C65D3B;color:#fff;cursor:pointer;font-weight:500;">新增</button>
      </div>
    `;

    document.body.appendChild(popover);
    activePopover = popover;

    // 让输入框自动聚焦
    setTimeout(() => popover.querySelector('#drawIssueName').focus(), 50);

    popover.querySelector('#drawIssueCancel').onclick = function(ev) {
      ev.stopPropagation();
      removePopover();
    };

    popover.querySelector('#drawIssueConfirm').onclick = function(ev) {
      ev.stopPropagation();
      const nameInput = popover.querySelector('#drawIssueName');
      const content = nameInput.value.trim();
      if (!content) {
        nameInput.style.borderColor = '#B91C1C';
        nameInput.setAttribute('placeholder', '请输入问题内容');
        nameInput.focus();
        return;
      }
      const expectEffect = popover.querySelector('#drawIssueExpect').value.trim();
      const type = popover.querySelector('#drawIssueType').value;
      const priority = popover.querySelector('#drawIssuePriority').value;
      // 根据问题内容和预期效果生成卡片标题
      const title = expectEffect ? content + '，预期' + expectEffect : content;
      removePopover();
      createDrawnIssue(wrap, left, top, w, h, title, type, priority, expectEffect);
    };

    // 回车确认 / Escape 关闭
    ['#drawIssueName', '#drawIssueExpect'].forEach(function(sel) {
      popover.querySelector(sel).addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') popover.querySelector('#drawIssueConfirm').click();
        if (ev.key === 'Escape') removePopover();
      });
    });

    // 阻止事件冒泡到画布
    popover.addEventListener('mousedown', function(ev) { ev.stopPropagation(); });
  }

  // 模拟对比数据池，根据问题类型返回不同的 设计稿预期 vs 实际
  const COMPARE_POOL = {
    '视觉': [
      { expect: '#FF6B35', actual: '#FF8C42', label: '色值' },
      { expect: 'opacity: 1', actual: 'opacity: 0.8', label: '透明度' },
      { expect: 'font-size: 16px', actual: 'font-size: 14px', label: '字号' },
      { expect: 'font-weight: 600', actual: 'font-weight: 400', label: '字重' },
    ],
    '布局': [
      { expect: 'gap: 16px', actual: 'gap: 8px', label: '间距' },
      { expect: 'padding: 24px', actual: 'padding: 16px', label: '内边距' },
      { expect: 'margin-top: 12px', actual: 'margin-top: 8px', label: '外边距' },
    ],
    '内容一致性': [
      { expect: '立即购买', actual: '立刻购买', label: '文案' },
      { expect: 'icon-cart-v2', actual: 'icon-cart-v1', label: '图标版本' },
    ],
    '交互': [
      { expect: 'ease-out 300ms', actual: 'linear 200ms', label: '动效' },
      { expect: 'hover: scale(1.05)', actual: '无 hover 效果', label: '悬停' },
    ],
  };

  function createDrawnIssue(wrap, left, top, w, h, title, type, priority, expectEffect) {
    _analyzeCounter++;
    const issueId = 'issue-' + _analyzeCounter;
    const priorityClassMap = { '高': 'priority-high', '中': 'priority-mid', '低': 'priority-low' };
    const pClass = priorityClassMap[priority] || 'priority-mid';

    // 在当前图片添加标注（设计稿仅编号，开发稿显示完整标题）
    const wrapType = wrap.dataset.type;
    const anno = document.createElement('div');
    anno.className = 'issue-anno ' + pClass;
    anno.dataset.issueId = issueId;
    anno.style.cssText = `left:${left}%;top:${top}%;width:${w}%;height:${h}%;`;
    anno.setAttribute('onclick', `highlightIssue('${issueId}')`);
    anno.innerHTML = wrapType === 'dev'
      ? `<div class="issue-anno-label">#${_analyzeCounter} ${escHtml(title)}</div>`
      : `<div class="issue-anno-label">#${_analyzeCounter}</div>`;
    wrap.appendChild(anno);

    // 在配对图片同位置也添加标注
    const pair = wrap.closest('.canvas-pair');
    if (pair) {
      const otherType = wrapType === 'design' ? 'dev' : 'design';
      const otherWrap = pair.querySelector(`[data-type="${otherType}"]`);
      if (otherWrap) {
        const anno2 = document.createElement('div');
        anno2.className = 'issue-anno ' + pClass;
        anno2.dataset.issueId = issueId;
        anno2.style.cssText = `left:${left}%;top:${top}%;width:${w}%;height:${h}%;`;
        anno2.setAttribute('onclick', `highlightIssue('${issueId}')`);
        anno2.innerHTML = otherType === 'dev'
          ? `<div class="issue-anno-label">#${_analyzeCounter} ${escHtml(title)}</div>`
          : `<div class="issue-anno-label">#${_analyzeCounter}</div>`;
        otherWrap.appendChild(anno2);
      }
      staggerOverlappingLabels(pair);
    }

    // 对比数据：优先使用用户输入的预期效果，否则从模拟池取
    const pool = COMPARE_POOL[type] || COMPARE_POOL['视觉'];
    const poolItem = pool[Math.floor(Math.random() * pool.length)];
    const cmp = expectEffect
      ? { expect: expectEffect, actual: poolItem.actual, label: poolItem.label }
      : poolItem;

    // 唯一 dropdown ID
    const adId = 'ad-' + _analyzeCounter;
    const sdId = 'sd-' + _analyzeCounter;
    const tlId = 'tl-' + _analyzeCounter;
    const ciId = 'ci-' + _analyzeCounter;

    // 构建完整卡片（与已有卡片结构一致）
    const card = document.createElement('div');
    card.className = 'issue-card p-3 fade-in';
    card.id = issueId;
    card.dataset.type = type;
    card.dataset.priority = priority;
    card.dataset.status = '待分配';
    card.setAttribute('onclick', `selectIssue('${issueId}')`);
    card.innerHTML = `
      <button class="card-delete-btn designer-only" onclick="deleteIssue('${issueId}', event)" title="删除问题"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
      <div class="flex items-center gap-1.5 mb-1.5">
        <span class="status-badge ${PRIORITY_BADGE[priority]} text-xs flex-shrink-0">${escHtml(priority)}优先级</span>
        <span class="tag-type">${escHtml(type)}</span>
      </div>
      <div class="text-xs font-medium text-gray-900 mb-0.5 leading-snug"><span class="text-[10px] text-gray-400 font-mono mr-1">#${_analyzeCounter}</span>${escHtml(title)}</div>
      <div class="text-[10px] text-gray-400 mb-2">刚刚</div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <div class="compare-left">
          <div class="text-xs text-gray-500 mb-1.5">设计稿预期</div>
          <span class="font-mono text-xs text-gray-900">${escHtml(cmp.expect)}</span>
        </div>
        <div class="compare-right">
          <div class="flex items-center justify-between mb-1.5"><span class="text-xs text-gray-400">实际</span><span class="text-xs text-red-500 font-medium">✕ 不匹配</span></div>
          <span class="font-mono text-xs text-red-500">${escHtml(cmp.actual)}</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 meta-grid">
        <div>
          <div class="meta-label mb-1">修改人员</div>
          <div class="relative">
            <div onclick="event.stopPropagation();toggleDropdown('${adId}')" class="issue-select text-gray-400">
              <span class="flex-1">未分配</span>
              <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="${adId}" class="issue-dd hidden"></div>
          </div>
        </div>
        <div>
          <div class="meta-label mb-1">修改进展</div>
          <div class="relative">
            <div onclick="event.stopPropagation();toggleDropdown('${sdId}')" class="issue-select">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
              <span class="flex-1">待分配</span>
              <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div id="${sdId}" class="issue-dd hidden"></div>
          </div>
        </div>
      </div>
      <div class="timeline-toggle text-xs font-medium text-gray-400" onclick="toggleTimeline(this, event)"><span class="tl-arrow">▸</span> 添加评论</div>
      <div class="card-timeline-section">
        <div class="space-y-2 mt-2" id="${tlId}"></div>
        <div class="flex items-center gap-1.5 mt-2" onclick="event.stopPropagation()">
          <input id="${ciId}" type="text" placeholder="留言..." class="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 bg-white" />
          <button onclick="sendCardComment('${ciId}','${tlId}')" class="comment-send">发送</button>
        </div>
      </div>
    `;
    // 加入全局卡片数组（rebuildList 依赖此数组）
    allIssueCards.unshift(card);

    // 保存手动问题到 Supabase
    if (currentProjectId) {
      sb.from('issues').insert({
        project_id: currentProjectId, issue_number: _analyzeCounter,
        title: title, type: type, priority: priority, status: '待分配',
        expected_val: cmp.expect, actual_val: cmp.actual,
        area_left: left + '%', area_top: top + '%', area_width: w + '%', area_height: h + '%',
        source: 'manual', user_id: currentUserId
      }).then(({ error }) => { if (error) console.error('Issue save failed:', error); });
    }

    // 更新分组标签
    const group = wrap.closest('[id^="canvas-"]');
    if (group) updateGroupLabel(group);
    if (currentAnnoMode === 'spotlight') setAnnoMode('spotlight');

    rebuildList();
    syncIssueCountToCard();
    showFilterSection();
    staggerOverlappingLabels(wrap.closest('.canvas-pair'));
  }
})();
