/**
 * 파이오니아 멘토링팀 · 패스포트/리뷰 알림 스크립트
 * - 시트의 가입날짜로 30/90/150/210일 리뷰일과 패스포트 마감일(가입+90일)을 계산
 * - 팀 캘린더에 일정 생성 (완료 체크 O 또는 진도율 100%면 일정 삭제)
 * - 다가오는 일정을 수파베이스 board_due 테이블에 써서 분담표 페이지에 표시
 *
 * 처음 한 번: setup() 실행 (권한 승인 → 완료 칸·팀원 시트·캘린더·매일 07:00 트리거 생성)
 * 이후: daily() 가 매일 자동 실행
 */
const CFG = {
  SHEET: '시트1',
  TEAM_SHEET: '팀원',
  CAL_NAME: '파이오니아 멘토링팀',
  SUPA_URL: 'https://bqlxhaqohwlktsrltvjn.supabase.co',
  SUPA_KEY: 'sb_publishable_hyjWHXoOrCJn89YxwMKzkA_xTKfz9aS',
  REVIEWS: [ // [일수, 제목, 알림(며칠 전) 목록]
    [30,  '30일 리뷰',  [7, 1]],
    [90,  '90일 리뷰',  [14, 1]],
    [150, '150일 리뷰', [14, 1]],
    [210, '210일 리뷰', [14, 1]],
  ],
  PASSPORT_DAYS: 90,
  PASSPORT_REMIND: [30, 14, 7, 1],
  HORIZON_DAYS: 60,     // 오늘부터 60일 안의 일정만 캘린더에 생성
  DUE_WINDOW_DAYS: 21,  // 페이지에 보여줄 범위 (지난 것 + 21일 이내)
  TAG: '[멘토링팀]',    // 스크립트가 만든 일정 식별용
};

// ---------- 유틸 ----------
const ss = () => SpreadsheetApp.getActiveSpreadsheet();
const sheet = () => ss().getSheetByName(CFG.SHEET);
const dayMs = 86400000;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getTime() + n * dayMs);
const fmt = d => Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
const norm = s => String(s || '').replace(/\s+/g, '');

function headerMap() {
  const sh = sheet();
  const values = sh.getRange(1, 1, Math.min(5, sh.getLastRow()), sh.getLastColumn()).getValues();
  let hr = -1;
  for (let i = 0; i < values.length; i++) if (values[i].some(v => norm(v).includes('가입날짜'))) { hr = i; break; }
  if (hr < 0) throw new Error('헤더 행(가입날짜)을 찾지 못함');
  const map = {};
  values[hr].forEach((v, c) => { const k = norm(v); if (k && map[k] === undefined) map[k] = c; });
  return { row: hr + 1, map, lastCol: sh.getLastColumn() };
}
function col(map, keys) { for (const k of keys) { for (const h in map) if (h.includes(k)) return map[h]; } return -1; }

// ---------- 최초 설정 ----------
function setup() {
  ensureColumns();
  ensureTeamSheet();
  ensureCalendar();
  ensureTrigger();
  daily();
}

function ensureColumns() {
  const sh = sheet(); const h = headerMap();
  const need = ['30일완료', '90일완료', '150일완료', '210일완료'];
  let last = h.lastCol;
  need.forEach(n => {
    if (col(h.map, [n]) < 0) {
      last++; sh.getRange(h.row, last).setValue(n.replace('완료', '일 완료').replace('일일', '일'))
        .setFontWeight('bold').setBackground('#FFF1E4').setHorizontalAlignment('center');
      sh.getRange(h.row, last).setNote('리뷰가 끝나면 O 입력 → 캘린더 일정·알림 자동 삭제');
    }
  });
}

function ensureTeamSheet() {
  let t = ss().getSheetByName(CFG.TEAM_SHEET);
  if (!t) {
    t = ss().insertSheet(CFG.TEAM_SHEET);
    t.getRange(1, 1, 1, 3).setValues([['역할', '이름', '이메일(구글 계정)']]).setFontWeight('bold').setBackground('#E4E9F4');
    t.getRange(2, 1, 4, 2).setValues([['팀장', '박선영'], ['팀원 1', '박미성'], ['팀원 2', '이도현'], ['121마스터', '송승훈']]);
    t.getRange(7, 1).setValue('※ 이메일을 채우면 다음 실행 때 팀 캘린더가 자동 공유됩니다.').setFontColor('#5F6880');
    t.setColumnWidth(3, 260);
  }
}

function teamEmails() {
  const t = ss().getSheetByName(CFG.TEAM_SHEET); if (!t) return [];
  return t.getRange(2, 3, Math.max(1, t.getLastRow() - 1), 1).getValues().flat()
    .map(v => String(v).trim()).filter(v => /@/.test(v));
}

function ensureCalendar() {
  let cal = CalendarApp.getCalendarsByName(CFG.CAL_NAME)[0];
  if (!cal) {
    cal = CalendarApp.createCalendar(CFG.CAL_NAME, { summary: '패스포트 마감 · 30/90/150/210일 리뷰 자동 일정', color: CalendarApp.Color.ORANGE, timeZone: 'Asia/Seoul' });
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CAL_ID', cal.getId());
  // 팀원 이메일에 공유 (Calendar 고급 서비스 없이 가능한 범위: 초대는 일정 게스트로 처리)
  return cal;
}

function ensureTrigger() {
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'daily');
  if (!has) ScriptApp.newTrigger('daily').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Seoul').create();
}

// ---------- 데이터 읽기 ----------
function readMembers() {
  const sh = sheet(); const h = headerMap();
  const cName = col(h.map, ['이름']), cJoin = col(h.map, ['가입날짜']), cRate = col(h.map, ['진도율']);
  const cDone = { 30: col(h.map, ['30일완료']), 90: col(h.map, ['90일완료']), 150: col(h.map, ['150일완료']), 210: col(h.map, ['210일완료']) };
  const n = sh.getLastRow() - h.row; if (n <= 0) return [];
  const rows = sh.getRange(h.row + 1, 1, n, sh.getLastColumn()).getValues();
  const out = [];
  rows.forEach(r => {
    const name = String(r[cName] || '').trim(); const join = r[cJoin];
    if (!name || !(join instanceof Date)) return;
    let rate = r[cRate]; if (typeof rate === 'string') rate = parseFloat(rate.replace('%', '')) / 100; if (rate > 1) rate = rate / 100;
    const done = {}; for (const k in cDone) done[k] = cDone[k] >= 0 && String(r[cDone[k]] || '').trim() !== '';
    out.push({ name, join: startOfDay(join), rate: isNaN(rate) ? 0 : rate, done });
  });
  return out;
}

// ---------- 매일 실행 ----------
function daily() {
  const today = startOfDay(new Date());
  const members = readMembers();
  const cal = CalendarApp.getCalendarById(PropertiesService.getScriptProperties().getProperty('CAL_ID')) || ensureCalendar();
  const guests = teamEmails();

  // 필요한 일정 목록 만들기
  const wanted = []; // {key,title,date,reminds,kind,name,done}
  members.forEach(m => {
    CFG.REVIEWS.forEach(([days, label, reminds]) => {
      wanted.push({ key: `${m.name}|${label}`, title: `${CFG.TAG} ${m.name} ${label}`, date: addDays(m.join, days), reminds, kind: label, name: m.name, done: m.done[days] });
    });
    wanted.push({ key: `${m.name}|패스포트 마감`, title: `${CFG.TAG} ${m.name} 패스포트 마감`, date: addDays(m.join, CFG.PASSPORT_DAYS), reminds: CFG.PASSPORT_REMIND, kind: '패스포트 마감', name: m.name, done: m.rate >= 1 });
  });

  // 캘린더 동기화 (지난 365일 ~ 앞 400일 범위의 태그 일정만 관리)
  const existing = cal.getEvents(addDays(today, -365), addDays(today, 400)).filter(e => e.getTitle().startsWith(CFG.TAG));
  const byTitle = {}; existing.forEach(e => { (byTitle[e.getTitle()] = byTitle[e.getTitle()] || []).push(e); });
  const horizon = addDays(today, CFG.HORIZON_DAYS);
  wanted.forEach(w => {
    const evs = byTitle[w.title] || [];
    if (w.done) { evs.forEach(e => e.deleteEvent()); return; }
    if (w.date > horizon) return; // 아직 멀면 생성하지 않음
    const ok = evs.find(e => fmt(e.getAllDayStartDate()) === fmt(w.date));
    evs.forEach(e => { if (e !== ok) e.deleteEvent(); }); // 날짜 바뀐 옛 일정 정리
    if (!ok) {
      const e = cal.createAllDayEvent(w.title, w.date, { description: `${w.name} · ${w.kind}\n시트에서 완료 처리하면 자동 삭제됩니다.` });
      e.removeAllReminders();
      w.reminds.forEach(d => e.addPopupReminder(Math.max(0, d * 1440 - 540))); // 해당일 09:00
      guests.forEach(g => { try { e.addGuest(g); } catch (err) {} });
    }
  });

  // 페이지용 목록 → 수파베이스
  const rows = wanted.filter(w => !w.done).map(w => ({ id: w.key, name: w.name, kind: w.kind, due: fmt(w.date), days_left: Math.round((w.date - today) / dayMs) }))
    .filter(r => r.days_left <= CFG.DUE_WINDOW_DAYS && r.days_left >= -120)
    .sort((a, b) => a.days_left - b.days_left);
  pushToSupabase(rows);
  Logger.log(`멤버 ${members.length}명 · 페이지 표시 ${rows.length}건 · 게스트 ${guests.length}명`);
}

function pushToSupabase(rows) {
  const headers = { apikey: CFG.SUPA_KEY, Authorization: 'Bearer ' + CFG.SUPA_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  UrlFetchApp.fetch(CFG.SUPA_URL + '/rest/v1/board_due?id=neq.__none__', { method: 'delete', headers, muteHttpExceptions: true });
  if (rows.length) UrlFetchApp.fetch(CFG.SUPA_URL + '/rest/v1/board_due', { method: 'post', headers, payload: JSON.stringify(rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))), muteHttpExceptions: true });
}

// 시트 상단 메뉴
function onOpen() {
  SpreadsheetApp.getUi().createMenu('멘토링팀')
    .addItem('지금 동기화 (캘린더·페이지)', 'daily')
    .addItem('최초 설정 다시 실행', 'setup')
    .addToUi();
}
