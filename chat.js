let currentCustomerKo = '';
let currentJp = '';
let currentKo = '';
let history = [];

async function generate() {
  const input = document.getElementById('customerInput');
  const text = input.value.trim();
  if (!text) return;

  const btn = document.getElementById('generateBtn');
  const box = document.getElementById('responseBox');

  btn.disabled = true;
  btn.textContent = '생성 중…';
  document.getElementById('copyJpBtn').disabled = true;
  document.getElementById('copyKoBtn').disabled = true;

  // 로딩
  box.innerHTML = `
    <div class="typing">
      <span></span><span></span><span></span>
    </div>
    <div style="font-size:12px;color:#aaa;margin-top:8px;">답변 생성 중…</div>
  `;
  box.classList.add('loading');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: CLINIC_CONFIG.systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    });

    const data = await res.json();
    const full = data.content?.[0]?.text || '';

   // 일본어 / 한국어 분리
const parts = full.split('---KO---');
currentJp = parts[0].replace('---JP---', '').trim();
const rest = parts[1] ? parts[1].split('---CUSTOMER_KO---') : ['', ''];
currentKo = rest[0].replace('---END---', '').trim();
currentCustomerKo = rest[1] ? rest[1].replace('---END---', '').trim() : '';
currentKo = parts[1] ? parts[1].replace('---END---', '').trim() : '';
    box.classList.remove('loading');
    box.innerHTML = `
      <div class="ko-label">📨 고객 메시지 번역</div>
      <div class="ko-response">${escapeHtml(currentCustomerKo)}</div>
      <div class="divider"></div>
      <div class="jp-response">${escapeHtml(currentJp)}</div>
      <div class="divider"></div>
      <div class="ko-label">🇰🇷 답변 한국어 번역</div>
      <div class="ko-response">${escapeHtml(currentKo)}</div>
    `;

    document.getElementById('copyJpBtn').disabled = false;
    document.getElementById('copyKoBtn').disabled = false;

    // 히스토리 추가
    addHistory(text);

  } catch (e) {
    box.classList.remove('loading');
    box.innerHTML = `<div style="color:#e55;font-size:13px;">오류가 발생했습니다. 다시 시도해주세요.</div>`;
  }

  btn.disabled = false;
  btn.textContent = '✦ 답변 생성하기';
}

function copyText(type) {
  const text = type === 'jp' ? currentJp : currentKo;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(type === 'jp' ? '일본어 답변 복사 완료! 📋' : '한국어 번역 복사 완료! 📋');
  });
}

function addHistory(text) {
  history.unshift(text);
  if (history.length > 10) history.pop();

  const list = document.getElementById('historyList');
  list.innerHTML = history.map((h, i) => `
    <div class="history-item" onclick="loadHistory(${i})">
      ${escapeHtml(h.substring(0, 40))}${h.length > 40 ? '…' : ''}
    </div>
  `).join('');
}

function loadHistory(i) {
  document.getElementById('customerInput').value = history[i];
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// Enter 키 (Ctrl+Enter)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('customerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) generate();
  });
});