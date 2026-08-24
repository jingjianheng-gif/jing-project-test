// ===== 全局状态 =====
let currentYear, currentMonth;
let currentUser = '';      // 当前选中的打卡人
let records = {};          // { "打卡人": { "2026-07-07": { type: "work", note: "..." } } }
let editingDate = null;    // 当前编辑日期
let currentView = 'month'; // 'month' | 'year'

// 默认设置
const DEFAULT_SETTINGS = {
  theme: 'default',
  colorWork: '#3498db',      colorWorkBg: '#ebf5fb',
  colorLeave: '#e67e22',     colorLeaveBg: '#fef5e7',
  colorHoliday: '#e74c3c',   colorHolidayBg: '#fdedec',
  labelWork: '💼 工作',      labelLeave: '🏥 请假',     labelHoliday: '🎉 放假',
  weekStart: 0,
  fontSize: 'normal',
  showNotePreview: true,
  notePreviewLen: 6,
  cellRadius: 8,
  defaultType: '',
  autoSelectDefault: true,
  monthlySalary: 4000,        // 默认月薪（兜底）
  monthlySalaries: {},         // {"2026-07": 5000, "2026-08": 4500} 各月独立月薪
  autoLaunch: true
};
let settings = { ...DEFAULT_SETTINGS };

// ===== DOM 缓存 =====
let $ = (id) => document.getElementById(id);
const els = {};

// ===== 初始化 =====
async function init() {
  cacheDOM();
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  // 加载数据（按打卡人分层存储）
  try {
    records = await window.workAPI.loadRecords();
  } catch (e) { records = {}; }

  // 确保至少有一个打卡人，默认选中"井建恒"（或第一个用户）
  if (!records || typeof records !== 'object' || Object.keys(records).length === 0) {
    records = { '井建恒': {} };
  }
  currentUser = Object.keys(records).includes('井建恒') ? '井建恒' : Object.keys(records)[0];
  renderUserSelect();

  // 加载设置
  try {
    const saved = await window.workAPI.loadSettings();
    if (saved && Object.keys(saved).length > 0) {
      settings = { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch (e) {}

  applySettings();
  // 更新月薪卡片为当前月份的月薪
  if (els.salaryMonthly) els.salaryMonthly.value = getCurrentMonthSalary();
  bindEvents();
  renderView();
}

function cacheDOM() {
  const ids = [
    'calendarGrid','currentMonth','currentYearTitle','statsBar',
    'editModal','modalTitle','selectedType','txtNote','importFile',
    'monthNav','yearNav','yearView','weekdaysRow','legendBar',
    'tagButtons','settingsModal',
    'userSelect','btnManageUsers','userModal','btnCloseUserModal','userList','newUserName','btnAddUser',
    'btnViewMonth','btnViewYear',
    'salaryMonthly','salaryArea','salaryWorkDays','salaryAmount','salaryTotalDays','salaryPeriodLabel','calcFormula'
  ];
  ids.forEach(id => els[id] = $(id));
}

// ===== 设置应用 =====
function applySettings() {
  const s = settings;
  const root = document.documentElement;

  // 主题色
  const themes = {
    default: { primary:'#4f6ef7', primaryHover:'#3b5de7', todayRing:'#4f6ef7', bg:'#f0f2f5' },
    ocean:   { primary:'#0ea5e9', primaryHover:'#0284c7', todayRing:'#0ea5e9', bg:'#ecfeff' },
    forest:  { primary:'#10b981', primaryHover:'#059669', todayRing:'#10b981', bg:'#ecfdf5' },
    sunset:  { primary:'#f59e0b', primaryHover:'#d97706', todayRing:'#f59e0b', bg:'#fffbeb' },
    rose:    { primary:'#e11d48', primaryHover:'#be123c', todayRing:'#e11d48', bg:'#fff1f2' },
    violet:  { primary:'#8b5cf6', primaryHover:'#7c3aed', todayRing:'#8b5cf6', bg:'#f5f3ff' },
    slate:   { primary:'#64748b', primaryHover:'#475569', todayRing:'#64748b', bg:'#f8fafc' },
    dark:    { primary:'#38bdf8', primaryHover:'#0ea5e9', todayRing:'#38bdf8', bg:'#0f172a' }
  };
  const t = themes[s.theme] || themes.default;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-hover', t.primaryHover);
  root.style.setProperty('--today-ring', t.todayRing);
  root.style.setProperty('--bg', t.bg);

  if (s.theme === 'dark') {
    root.style.setProperty('--card-bg', '#1e293b');
    root.style.setProperty('--text', '#e2e8f0');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--border', '#334155');
    root.style.setProperty('--shadow', '0 2px 8px rgba(0,0,0,0.3)');
  } else {
    root.style.setProperty('--card-bg', '#ffffff');
    root.style.setProperty('--text', '#2c3e50');
    root.style.setProperty('--text-secondary', '#7f8c8d');
    root.style.setProperty('--border', '#e2e6ea');
    root.style.setProperty('--shadow', '0 2px 8px rgba(0,0,0,0.08)');
  }

  // 自定义颜色
  root.style.setProperty('--work-color', s.colorWork);
  root.style.setProperty('--work-bg', s.colorWorkBg);
  root.style.setProperty('--leave-color', s.colorLeave);
  root.style.setProperty('--leave-bg', s.colorLeaveBg);
  root.style.setProperty('--holiday-color', s.colorHoliday);
  root.style.setProperty('--holiday-bg', s.colorHolidayBg);

  // 字体大小
  const fsMap = { small: '12px', normal: '14px', large: '16px' };
  root.style.setProperty('--fs', fsMap[s.fontSize] || '14px');
  document.body.style.fontSize = `var(--fs)`;

  // 圆角
  root.style.setProperty('--cell-radius', s.cellRadius + 'px');

  // 更新图例颜色
  updateLegend();
}

function updateLegend() {
  const dots = document.querySelectorAll('.legend-item .dot');
  if (dots.length >= 3) {
    dots[0].style.background = settings.colorWork;
    dots[1].style.background = settings.colorLeave;
    dots[2].style.background = settings.colorHoliday;
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  // 视图切换
  els.btnViewMonth.addEventListener('click', () => switchView('month'));
  els.btnViewYear.addEventListener('click', () => switchView('year'));

  // 月导航
  $('btnPrevMonth').addEventListener('click', () => { changeMonth(-1); });
  $('btnNextMonth').addEventListener('click', () => { changeMonth(1); });
  $('btnToday').addEventListener('click', goToday);

  // 年导航
  $('btnPrevYear').addEventListener('click', () => { currentYear--; renderView(); });
  $('btnNextYear').addEventListener('click', () => { currentYear++; renderView(); });

  // 编辑弹窗
  $('btnCloseModal').addEventListener('click', closeModal);
  $('btnCancel').addEventListener('click', closeModal);
  $('btnSave').addEventListener('click', saveRecord);
  $('btnClear').addEventListener('click', clearRecord);
  els.editModal.addEventListener('click', (e) => { if (e.target === els.editModal) closeModal(); });
  els.tagButtons.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });

  // 设置
  $('btnSettings').addEventListener('click', openSettings);
  $('btnCloseSettings').addEventListener('click', closeSettings);
  $('btnSaveSettings').addEventListener('click', saveSettings);
  $('btnResetSettings').addEventListener('click', resetSettings);
  els.settingsModal.addEventListener('click', (e) => { if (e.target === els.settingsModal) closeSettings(); });
  // 主题按钮
  $('themeOptions').querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.theme));
  });

  // 导出/导入
  $('btnExport').addEventListener('click', exportJSON);
  $('btnImport').addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', importJSON);
  $('btnExportExcel').addEventListener('click', exportExcel);

  // 一键清除
  $('btnClearAll').addEventListener('click', clearAllRecords);

  // 打卡人切换与管理
  els.userSelect.addEventListener('change', () => {
    currentUser = els.userSelect.value;
    renderView();
  });
  $('btnManageUsers').addEventListener('click', openUserModal);
  $('btnCloseUserModal').addEventListener('click', closeUserModal);
  els.userModal.addEventListener('click', (e) => { if (e.target === els.userModal) closeUserModal(); });
  $('btnAddUser').addEventListener('click', addUser);
  els.newUserName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addUser(); });

  // 键盘
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeSettings(); closeUserModal(); }
    if (els.editModal.style.display === 'flex' || els.settingsModal.style.display === 'flex' || els.userModal.style.display === 'flex') return;
    if (e.key === 'ArrowLeft') { if (currentView==='month') changeMonth(-1); else { currentYear--; renderView(); } }
    if (e.key === 'ArrowRight') { if (currentView==='month') changeMonth(1); else { currentYear++; renderView(); } }
  });

  // 工资卡片 - 月薪编辑，失焦/回车时保存
  if (els.salaryMonthly) {
    els.salaryMonthly.addEventListener('change', () => {
      const val = parseFloat(els.salaryMonthly.value);
      if (!isNaN(val) && val >= 0) {
        const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        if (!settings.monthlySalaries) settings.monthlySalaries = {};
        settings.monthlySalaries[key] = val;
        try { window.workAPI.saveSettings(settings); } catch (e) {}
        // 直接调用 updateStats 刷新工资数字
        if (currentView === 'month') updateStats();
        else if (currentView === 'year') updateYearStats();
      }
    });
  }

  // 刷新按钮 —— 先保存输入再计算
  const btnRefresh = $('btnRefreshSalary');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (currentView === 'month' && els.salaryMonthly) {
        const val = parseFloat(els.salaryMonthly.value);
        if (!isNaN(val) && val >= 0) {
          const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          if (!settings.monthlySalaries) settings.monthlySalaries = {};
          settings.monthlySalaries[key] = val;
          try { window.workAPI.saveSettings(settings); } catch (e) {}
        }
        updateStats();
      } else if (currentView === 'year') {
        updateYearStats();
      }
    });
  }
}

// ===== 打卡人管理 =====

// 当前打卡人的记录
function getUserRecords() {
  return records[currentUser] || {};
}

// 渲染打卡人下拉框
function renderUserSelect() {
  if (!els.userSelect) return;
  els.userSelect.innerHTML = '';
  for (const user of Object.keys(records)) {
    const opt = document.createElement('option');
    opt.value = user;
    opt.textContent = user;
    if (user === currentUser) opt.selected = true;
    els.userSelect.appendChild(opt);
  }
}

// 打开/关闭打卡人管理弹窗
function openUserModal() {
  renderUserList();
  els.newUserName.value = '';
  els.userModal.style.display = 'flex';
}

function closeUserModal() {
  els.userModal.style.display = 'none';
}

// 渲染用户列表
function renderUserList() {
  els.userList.innerHTML = '';
  const users = Object.keys(records);
  users.forEach(user => {
    const row = document.createElement('div');
    row.className = 'user-item';

    const info = document.createElement('div');
    info.className = 'user-item-info';
    info.innerHTML = `<span class="user-item-name">${escHtml(user)}</span>` +
      `<span class="user-item-count">${Object.keys(records[user] || {}).length} 条记录</span>`;

    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger-text';
    del.textContent = '🗑 删除';
    del.disabled = users.length <= 1;
    del.title = users.length <= 1 ? '至少保留一个打卡人' : '删除该打卡人及其全部记录';
    del.addEventListener('click', () => removeUser(user));

    row.appendChild(info);
    row.appendChild(del);
    els.userList.appendChild(row);
  });
}

// 新增打卡人
async function addUser() {
  const name = els.newUserName.value.trim();
  if (!name) { alert('请输入打卡人姓名'); return; }
  if (records[name]) { alert('该打卡人已存在'); return; }
  try {
    const result = await window.workAPI.addUser(name);
    if (result.success) {
      records[name] = {};
      currentUser = name;
      renderUserSelect();
      renderUserList();
      renderView();
      els.newUserName.value = '';
    } else {
      alert('新增失败: ' + (result.error || '未知错误'));
    }
  } catch (e) { alert('新增失败: ' + e.message); }
}

// 删除打卡人
async function removeUser(user) {
  if (Object.keys(records).length <= 1) { alert('至少需要保留一个打卡人'); return; }
  const count = Object.keys(records[user] || {}).length;
  const msg = count > 0
    ? `确定删除打卡人「${user}」吗？\n该打卡人有 ${count} 条记录，删除后无法恢复！`
    : `确定删除打卡人「${user}」吗？`;
  if (!confirm(msg)) return;
  try {
    const result = await window.workAPI.removeUser(user);
    if (result.success) {
      delete records[user];
      if (currentUser === user) currentUser = Object.keys(records)[0];
      renderUserSelect();
      renderUserList();
      renderView();
    } else {
      alert('删除失败: ' + (result.error || '未知错误'));
    }
  } catch (e) { alert('删除失败: ' + e.message); }
}

// ===== 视图切换 =====
function switchView(view) {
  currentView = view;
  els.btnViewMonth.classList.toggle('btn-active', view === 'month');
  els.btnViewYear.classList.toggle('btn-active', view === 'year');
  els.monthNav.style.display = view === 'month' ? '' : 'none';
  els.yearNav.style.display = view === 'year' ? '' : 'none';
  els.weekdaysRow.style.display = view === 'month' ? '' : 'none';
  els.legendBar.style.display = ''; // 始终显示图例
  els.calendarGrid.style.display = view === 'month' ? '' : 'none';
  els.yearView.style.display = view === 'year' ? '' : 'none';

  // 切换计算器显示
  const calcTitle = document.querySelector('.calc-title');
  const calcRow1 = document.querySelector('.calc-row');
  const calcBtn = document.querySelector('.calc-btn');
  const calcFormula = document.querySelector('.calc-formula');
  if (view === 'year') {
    if (calcTitle) calcTitle.textContent = '💰 年度收入';
    if (calcRow1) calcRow1.style.display = 'none';
    if (calcBtn) calcBtn.style.display = 'none';
    if (calcFormula) calcFormula.style.display = 'none';
  } else {
    if (calcTitle) calcTitle.textContent = '💰 工资计算器';
    if (calcRow1) calcRow1.style.display = '';
    if (calcBtn) calcBtn.style.display = '';
    if (calcFormula) calcFormula.style.display = '';
    if (els.salaryMonthly) {
      els.salaryMonthly.value = getCurrentMonthSalary();
    }
  }

  renderView();
}

function renderView() {
  // 更新月薪输入框为当前月份的值
  if (els.salaryMonthly && currentView === 'month') {
    els.salaryMonthly.value = getCurrentMonthSalary();
  }
  if (currentView === 'month') renderCalendar();
  else renderYearView();
}

// ===== 月份导航 =====
function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  else if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  renderView();
}

function goToday() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;
  renderView();
}

// ===== 月视图 - 渲染日历 =====
function renderCalendar() {
  els.currentMonth.textContent = `${currentYear}年 ${currentMonth}月`;

  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const lastDay = new Date(currentYear, currentMonth, 0);
  const daysInMonth = lastDay.getDate();
  let startDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();

  const today = new Date();
  const todayStr = fmtDate(today);

  // 根据周起始调整
  const weekStart = settings.weekStart;
  startDayOfWeek = (startDayOfWeek - weekStart + 7) % 7;

  let html = '';

  // 上周剩余
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const d = new Date(currentYear, currentMonth - 2, day);
    html += renderCell(d, day, true, todayStr);
  }

  // 当月
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth - 1, day);
    html += renderCell(d, day, false, todayStr);
  }

  // 下月填充
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    const d = new Date(currentYear, currentMonth, day);
    html += renderCell(d, day, true, todayStr);
  }

  els.calendarGrid.innerHTML = html;
  els.calendarGrid.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date));
  });
  updateStats();
  updateLegend();
}

function renderCell(date, day, isOtherMonth, todayStr) {
  const dateStr = fmtDate(date);
  const record = getUserRecords()[dateStr];
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isToday = dateStr === todayStr;

  let cls = ['calendar-cell'];
  if (isOtherMonth) cls.push('other-month');
  if (isToday) cls.push('today');
  if (isWeekend) cls.push('weekend');
  if (record && record.type) cls.push(record.type);

  let labelHtml = '';
  let noteHtml = '';

  if (record) {
    if (record.type === 'work') labelHtml = `<span class="day-label">${settings.labelWork}</span>`;
    else if (record.type === 'leave') labelHtml = `<span class="day-label">${settings.labelLeave}</span>`;
    else if (record.type === 'holiday') labelHtml = `<span class="day-label">${settings.labelHoliday}</span>`;

    if (record.note && record.note.trim()) {
      if (settings.showNotePreview) {
        const preview = record.note.trim().substring(0, settings.notePreviewLen);
        noteHtml = `<span class="day-note-text">${escHtml(preview)}${record.note.trim().length > settings.notePreviewLen ? '…' : ''}</span>`;
      } else {
        noteHtml = '<span class="day-note-indicator">📝</span>';
      }
    }
  }

  return `<div class="${cls.join(' ')}" data-date="${dateStr}">
    <span class="day-num">${day}</span>
    ${labelHtml}
    ${noteHtml}
  </div>`;
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== 年视图 =====
function renderYearView() {
  els.currentYearTitle.textContent = `${currentYear}年 工作总览`;

  const months = [
    '一月','二月','三月','四月','五月','六月',
    '七月','八月','九月','十月','十一月','十二月'
  ];

  let html = '<div class="year-cards">';
  for (let m = 0; m < 12; m++) {
    const prefix = `${currentYear}-${String(m+1).padStart(2,'0')}`;
    let workCount = 0, leaveCount = 0, holidayCount = 0, noteCount = 0;
    for (const [date, record] of Object.entries(getUserRecords())) {
      if (date.startsWith(prefix)) {
        if (record.type === 'work') workCount++;
        else if (record.type === 'leave') leaveCount++;
        else if (record.type === 'holiday') holidayCount++;
        if (record.note && record.note.trim()) noteCount++;
      }
    }
    const total = workCount + leaveCount + holidayCount;
    const daysInMonth = new Date(currentYear, m+1, 0).getDate();

    // 颜色条
    const totalBars = daysInMonth || 1;
    const wPct = Math.round(workCount / totalBars * 100);
    const lPct = Math.round(leaveCount / totalBars * 100);
    const hPct = Math.round(holidayCount / totalBars * 100);

    html += `
    <div class="year-card" data-month="${m+1}">
      <div class="year-card-header">
        <span class="year-card-month">${months[m]}</span>
        <span class="year-card-days">${daysInMonth}天</span>
      </div>
      <div class="year-card-bar">
        <div class="bar-seg bar-work" style="flex:${wPct || 0.1}" title="工作 ${workCount}天"></div>
        <div class="bar-seg bar-leave" style="flex:${lPct || 0.1}" title="请假 ${leaveCount}天"></div>
        <div class="bar-seg bar-holiday" style="flex:${hPct || 0.1}" title="放假 ${holidayCount}天"></div>
        <div class="bar-seg bar-empty" style="flex:${Math.max(100-wPct-lPct-hPct, 1)}"></div>
      </div>
      <div class="year-card-stats">
        <span style="color:${settings.colorWork}">💼${workCount}</span>
        <span style="color:${settings.colorLeave}">🏥${leaveCount}</span>
        <span style="color:${settings.colorHoliday}">🎉${holidayCount}</span>
        ${noteCount > 0 ? `<span>📝${noteCount}</span>` : ''}
      </div>
    </div>`;
  }
  html += '</div>';

  // 年度汇总
  let yWork=0, yLeave=0, yHoliday=0, yNote=0;
  const yPrefix = `${currentYear}-`;
  for (const [date, record] of Object.entries(getUserRecords())) {
    if (date.startsWith(yPrefix)) {
      if (record.type === 'work') yWork++;
      else if (record.type === 'leave') yLeave++;
      else if (record.type === 'holiday') yHoliday++;
      if (record.note && record.note.trim()) yNote++;
    }
  }
  const yAnnualSalary = calcYearSalary(yWork).annualExpected;

  html += `<div class="year-summary">
    <span>📅 ${currentYear}年 合计：</span>
    <span style="color:${settings.colorWork};font-weight:700">💼 工作 ${yWork}天</span>
    <span style="color:${settings.colorLeave};font-weight:700">🏥 请假 ${yLeave}天</span>
    <span style="color:${settings.colorHoliday};font-weight:700">🎉 放假 ${yHoliday}天</span>
    <span>📝 备注 ${yNote}条</span>
    <span style="color:var(--primary);font-weight:700">💰 年收入 ${yAnnualSalary.toFixed(2)} 元</span>
  </div>`;

  els.yearView.innerHTML = html;

  // 点击月份卡片跳转到该月
  els.yearView.querySelectorAll('.year-card').forEach(card => {
    card.addEventListener('click', () => {
      currentMonth = parseInt(card.dataset.month);
      switchView('month');
    });
  });

  updateYearStats();
  updateLegend();
}

function updateYearStats() {
  let yWork=0, yLeave=0, yHoliday=0;
  const yPrefix = `${currentYear}-`;
  for (const [date, record] of Object.entries(getUserRecords())) {
    if (date.startsWith(yPrefix)) {
      if (record.type === 'work') yWork++;
      else if (record.type === 'leave') yLeave++;
      else if (record.type === 'holiday') yHoliday++;
    }
  }
  const total = yWork + yLeave + yHoliday;
  const ySalary = calcYearSalary(yWork);
  const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
  const yearDays = isLeap ? 366 : 365;

  els.statsBar.innerHTML = `
    <span>📅 ${currentYear}年</span>
    <span>💼 工作 <span class="stat-val" style="color:${settings.colorWork}">${yWork}</span> 天</span>
    <span>🏥 请假 <span class="stat-val" style="color:${settings.colorLeave}">${yLeave}</span> 天</span>
    <span>🎉 放假 <span class="stat-val" style="color:${settings.colorHoliday}">${yHoliday}</span> 天</span>
    <span>📝 已记录 <span class="stat-val">${total}</span> 天</span>
    <span>💰 年收入预期 <span class="stat-val" style="color:var(--primary)">${ySalary.annualExpected.toFixed(2)}</span> 元</span>
  `;

  // 更新计算器（年度数据）
  if (els.salaryWorkDays) els.salaryWorkDays.textContent = yWork;
  if (els.salaryTotalDays) els.salaryTotalDays.textContent = yearDays;
  if (els.salaryPeriodLabel) els.salaryPeriodLabel.textContent = '本年';
  if (els.salaryAmount) els.salaryAmount.textContent = '¥ ' + ySalary.annualExpected.toFixed(2);
}

// ===== 工资计算 =====

// 获取指定年月的月薪（优先取 monthlySalaries，否则取默认 monthlySalary）
function getMonthlySalary(year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  if (settings.monthlySalaries && settings.monthlySalaries[key] !== undefined) {
    return settings.monthlySalaries[key];
  }
  return settings.monthlySalary || 4000;
}

// 获取当前视图月份的月薪
function getCurrentMonthSalary() {
  return getMonthlySalary(currentYear, currentMonth);
}

function calcSalary(workDays, totalDays) {
  const salary = getCurrentMonthSalary();
  if (totalDays <= 0) return { daily: 0, amount: 0 };
  const daily = Math.round(salary / totalDays * 100) / 100;
  const amount = Math.round(daily * workDays * 100) / 100;
  return { daily, amount };
}

function calcYearSalary(workDays) {
  // 年收入 = 累加本年各个有记录月份的实发工资（月薪 × 该月工作天数 ÷ 该月总天数）
  const monthStats = {}; // { "2026-07": { workDays, totalDays, salary } }
  for (const [date, record] of Object.entries(getUserRecords())) {
    if (!date.startsWith(`${currentYear}-`)) continue;
    const m = date.substring(0, 7); // "2026-07"
    if (!monthStats[m]) {
      const monthNum = parseInt(m.split('-')[1]);
      monthStats[m] = {
        workDays: 0,
        totalDays: new Date(currentYear, monthNum, 0).getDate(),
        salary: getMonthlySalary(currentYear, monthNum)
      };
    }
    if (record.type === 'work') monthStats[m].workDays++;
  }
  let annualExpected = 0;
  for (const info of Object.values(monthStats)) {
    if (info.totalDays > 0 && info.workDays > 0) {
      annualExpected += Math.round(info.salary * info.workDays / info.totalDays * 100) / 100;
    }
  }
  const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
  const yearDays = isLeap ? 366 : 365;
  const daily = annualExpected > 0 ? Math.round(annualExpected / yearDays * 100) / 100 : 0;
  const amount = Math.round(daily * workDays * 100) / 100;
  return { daily, amount, annualExpected };
}

// ===== 月统计 =====
function updateStats() {
  let workCount = 0, leaveCount = 0, holidayCount = 0;
  const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  for (const [date, record] of Object.entries(getUserRecords())) {
    if (date.startsWith(prefix)) {
      if (record.type === 'work') workCount++;
      else if (record.type === 'leave') leaveCount++;
      else if (record.type === 'holiday') holidayCount++;
    }
  }
  const total = workCount + leaveCount + holidayCount;
  const allDays = new Date(currentYear, currentMonth, 0).getDate();
  const salaryInfo = calcSalary(workCount, allDays);

  els.statsBar.innerHTML = `
    <span>👤 <span class="stat-val">${escHtml(currentUser)}</span></span>
    <span>📅 本月共 <span class="stat-val">${allDays}</span> 天</span>
    <span>💼 工作 <span class="stat-val" style="color:${settings.colorWork}">${workCount}</span> 天</span>
    <span>🏥 请假 <span class="stat-val" style="color:${settings.colorLeave}">${leaveCount}</span> 天</span>
    <span>🎉 放假 <span class="stat-val" style="color:${settings.colorHoliday}">${holidayCount}</span> 天</span>
    <span>📝 已记录 <span class="stat-val">${total}</span> 天</span>
  `;

  // 更新计算器 —— 直接从输入框取值
  const curSalary = parseFloat(els.salaryMonthly?.value) || getCurrentMonthSalary();
  const amount = Math.round(curSalary * workCount / allDays * 100) / 100;
  if (els.salaryWorkDays) els.salaryWorkDays.textContent = workCount;
  if (els.salaryTotalDays) els.salaryTotalDays.textContent = allDays;
  if (els.salaryAmount) els.salaryAmount.textContent = '¥ ' + amount.toFixed(2);
  if (els.calcFormula) els.calcFormula.textContent =
    `实发 = (${workCount} ÷ ${allDays}) × ${curSalary}`;
  // 恢复"本月"文本
  if (els.salaryPeriodLabel) els.salaryPeriodLabel.textContent = '本月';
}

// ===== 编辑弹窗 =====
function openModal(dateStr) {
  editingDate = dateStr;
  const record = getUserRecords()[dateStr] || { type: '', note: '' };

  els.modalTitle.textContent = `📅 ${dateStr} · ${currentUser}`;
  els.selectedType.value = record.type || '';
  els.txtNote.value = record.note || '';

  // 高亮已选类型
  els.tagButtons.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.remove('selected-work', 'selected-leave', 'selected-holiday');
    if (btn.dataset.type === record.type) {
      btn.classList.add(`selected-${record.type}`);
    }
  });

  // 自动选择默认类型
  if (!record.type && settings.autoSelectDefault && settings.defaultType) {
    selectType(settings.defaultType);
  }

  els.editModal.style.display = 'flex';
  els.txtNote.focus();
}

function closeModal() {
  els.editModal.style.display = 'none';
  editingDate = null;
}

function selectType(type) {
  els.selectedType.value = type;
  els.tagButtons.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.remove('selected-work', 'selected-leave', 'selected-holiday');
    if (btn.dataset.type === type) {
      btn.classList.add(`selected-${type}`);
    }
  });
}

async function saveRecord() {
  if (!editingDate) return;
  const type = els.selectedType.value;
  const note = els.txtNote.value.trim();
  if (!type && !note) { await clearRecord(); return; }
  const record = { type: type || '', note };
  try {
    const result = await window.workAPI.saveRecord(currentUser, editingDate, record);
    if (result.success) { records = result.records; renderView(); closeModal(); }
  } catch (e) { alert('保存失败: ' + e.message); }
}

async function clearRecord() {
  if (!editingDate) return;
  try {
    const result = await window.workAPI.saveRecord(currentUser, editingDate, null);
    if (result.success) { records = result.records; renderView(); closeModal(); }
  } catch (e) { alert('清除失败: ' + e.message); }
}

// ===== 设置面板 =====
function openSettings() {
  // 填充设置值
  $('colorWork').value = settings.colorWork;
  $('colorWorkBg').value = settings.colorWorkBg;
  $('colorLeave').value = settings.colorLeave;
  $('colorLeaveBg').value = settings.colorLeaveBg;
  $('colorHoliday').value = settings.colorHoliday;
  $('colorHolidayBg').value = settings.colorHolidayBg;
  $('labelWork').value = settings.labelWork;
  $('labelLeave').value = settings.labelLeave;
  $('labelHoliday').value = settings.labelHoliday;
  $('weekStart').value = settings.weekStart;
  $('fontSize').value = settings.fontSize;
  $('showNotePreview').checked = settings.showNotePreview;
  $('notePreviewLen').value = settings.notePreviewLen;
  $('cellRadius').value = settings.cellRadius;
  $('defaultType').value = settings.defaultType;
  $('autoSelectDefault').checked = settings.autoSelectDefault;
  $('monthlySalary').value = settings.monthlySalary || 4000;
  $('autoLaunch').checked = settings.autoLaunch !== false;

  // 高亮当前主题
  $('themeOptions').querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('theme-active', btn.dataset.theme === settings.theme);
  });

  els.settingsModal.style.display = 'flex';
}

function closeSettings() {
  els.settingsModal.style.display = 'none';
}

function selectTheme(theme) {
  $('themeOptions').querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('theme-active', btn.dataset.theme === theme);
  });
}

async function saveSettings() {
  settings.theme = $('themeOptions').querySelector('.theme-active')?.dataset?.theme || 'default';
  settings.colorWork = $('colorWork').value;
  settings.colorWorkBg = $('colorWorkBg').value;
  settings.colorLeave = $('colorLeave').value;
  settings.colorLeaveBg = $('colorLeaveBg').value;
  settings.colorHoliday = $('colorHoliday').value;
  settings.colorHolidayBg = $('colorHolidayBg').value;
  settings.labelWork = $('labelWork').value || '工作';
  settings.labelLeave = $('labelLeave').value || '请假';
  settings.labelHoliday = $('labelHoliday').value || '放假';
  settings.weekStart = parseInt($('weekStart').value);
  settings.fontSize = $('fontSize').value;
  settings.showNotePreview = $('showNotePreview').checked;
  settings.notePreviewLen = parseInt($('notePreviewLen').value) || 6;
  settings.cellRadius = parseInt($('cellRadius').value) || 8;
  settings.defaultType = $('defaultType').value;
  settings.autoSelectDefault = $('autoSelectDefault').checked;
  settings.monthlySalary = parseFloat($('monthlySalary').value) || 4000;
  settings.autoLaunch = $('autoLaunch').checked;

  // 开机自启
  try {
    await window.workAPI.setLoginSettings(settings.autoLaunch);
  } catch (e) {}

  // 更新月薪卡片
  if (els.salaryMonthly) els.salaryMonthly.value = getCurrentMonthSalary();

  applySettings();
  renderView();
  closeSettings();

  try {
    await window.workAPI.saveSettings(settings);
  } catch (e) {}
}

async function resetSettings() {
  if (!confirm('确定恢复所有设置为默认值吗？')) return;
  settings = { ...DEFAULT_SETTINGS };
  applySettings();
  renderView();
  try { await window.workAPI.saveSettings(settings); } catch (e) {}
}

// ===== 导出/导入 =====
async function exportJSON() {
  try {
    const data = await window.workAPI.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.download = `工作记录备份_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { alert('导出失败: ' + e.message); }
}

async function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('无效格式');
    const keys = Object.keys(imported);
    const isLegacy = keys.length > 0 && keys.every(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    let finalData = imported;
    if (isLegacy) {
      // 旧版单用户备份：归入当前打卡人
      finalData = { ...records, [currentUser]: imported };
      if (!confirm(`检测到旧版备份格式。\n将把记录导入当前打卡人「${currentUser}」，确定继续吗？`)) {
        els.importFile.value = ''; return;
      }
    } else {
      if (!confirm(`确定导入 "${file.name}"？\n会覆盖所有打卡人的数据。`)) {
        els.importFile.value = ''; return;
      }
    }
    const result = await window.workAPI.importData(finalData);
    if (result.success) {
      records = finalData;
      if (!records[currentUser]) currentUser = Object.keys(records)[0] || '';
      renderUserSelect();
      renderView();
      alert('导入成功！');
    }
    else alert('导入失败: ' + result.error);
  } catch (e) { alert('导入失败: ' + e.message); }
  els.importFile.value = '';
}

async function exportExcel() {
  // 使用 SheetJS 生成 Excel
  if (typeof XLSX === 'undefined') { alert('Excel 库未加载，请检查网络连接。'); return; }

  // 一张表：导出当前月份所有打卡人的记录
  const rows = [['姓名', '日期', '类型', '备注']];
  const typeNames = { work: '工作', leave: '请假', holiday: '放假' };
  const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;

  const users = Object.keys(records).sort();
  for (const user of users) {
    const userRecords = records[user] || {};
    const sortedDates = Object.keys(userRecords).sort();
    for (const date of sortedDates) {
      if (!date.startsWith(prefix)) continue;
      const r = userRecords[date];
      rows.push([user, date, typeNames[r.type] || r.type || '', r.note || '']);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 设置列宽
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(wb, ws, `工作记录${currentMonth}月`);

  // 生成 buffer
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const defaultName = `工作记录_${currentYear}年${currentMonth}月.xlsx`;

  try {
    const result = await window.workAPI.saveExcelFile(buf, defaultName);
    if (result.success) alert(`Excel 已导出到:\n${result.filePath}`);
    else if (!result.canceled) alert('导出失败: ' + (result.error || '未知错误'));
  } catch (e) { alert('导出失败: ' + e.message); }
}

// ===== 一键清除 =====
async function clearAllRecords() {
  if (!confirm(`⚠️ 确定要清除打卡人「${currentUser}」的所有记录吗？\n\n此操作不可恢复！\n建议先导出备份。\n\n点击"确定"清除，点击"取消"返回。`)) return;
  // 二次确认
  if (!confirm(`再次确认：将清除「${currentUser}」的全部打卡记录，无法恢复。\n\n确定继续吗？`)) return;
  try {
    const result = await window.workAPI.clearAllRecords(currentUser);
    if (result.success) {
      records[currentUser] = {};
      renderView();
      alert(`「${currentUser}」的所有记录已清除。`);
    } else {
      alert('清除失败，请重试。');
    }
  } catch (e) { alert('清除失败: ' + e.message); }
}

// ===== 启动 =====
init();
