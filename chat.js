let currentJp = '';
let currentKo = '';
let currentCustomerKo = '';
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
  document.getElementById('customerKoBox').innerHTML = '번역 중…';

  box.innerHTML = `
    <div class="jp-response" id="jpEditBox" contenteditable="true" style="outline:none;cursor:text;" spellcheck="false">${escapeHtml(currentJp)}</div>
    <div class="divider"></div>
    <div class="ko-label">🇰🇷 답변 한국어 번역</div>
    <div class="ko-response">${escapeHtml(currentKo)}</div>
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

    // 파싱
    const jpMatch = full.match(/---JP---([\s\S]*?)---KO---/);
    const koMatch = full.match(/---KO---([\s\S]*?)---CUSTOMER_KO---/);
    const customerKoMatch = full.match(/---CUSTOMER_KO---([\s\S]*?)---END---/);

    currentJp = jpMatch ? jpMatch[1].trim() : full;
    currentKo = koMatch ? koMatch[1].trim() : '';
    currentCustomerKo = customerKoMatch ? customerKoMatch[1].trim() : '';

    box.classList.remove('loading');
    box.innerHTML = `
      <div class="jp-response">${escapeHtml(currentJp)}</div>
      <div class="divider"></div>
      <div class="ko-label">🇰🇷 답변 한국어 번역 (수정 가능)</div>
      <div class="ko-response" id="koEditBox" contenteditable="true" style="outline:none;cursor:text;" spellcheck="false">${escapeHtml(currentKo)}</div>
      <button onclick="retranslate()" style="margin-top:10px;padding:8px 16px;background:#1a1410;color:#c9a96e;border:none;border-radius:8px;cursor:pointer;font-size:12px;">🔄 한국어→일본어 재번역</button>
    `;

    document.getElementById('customerKoBox').innerHTML = escapeHtml(currentCustomerKo) || '—';
    document.getElementById('copyJpBtn').disabled = false;
    document.getElementById('copyKoBtn').disabled = false;
    addHistory(text);

  } catch (e) {
    box.classList.remove('loading');
    box.innerHTML = `<div style="color:#e55;font-size:13px;">오류가 발생했습니다. 다시 시도해주세요.</div>`;
    document.getElementById('customerKoBox').innerHTML = '—';
  }

  btn.disabled = false;
  btn.textContent = '✦ 답변 생성하기';
}

function copyText(type) {
  let text;
  if (type === 'jp') {
    const el = document.getElementById('jpEditBox');
    text = el ? el.innerText : currentJp;
  } else {
    text = currentKo;
  }
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
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}
async function retranslate() {
  const koText = document.getElementById('koEditBox').innerText.trim();
  if (!koText) return;

  const box = document.getElementById('responseBox');
  const jpDiv = box.querySelector('.jp-response');
  jpDiv.innerHTML = '번역 중…';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: '당신은 한국어를 자연스러운 일본어로 번역하는 전문 번역가입니다. 클리닉 상담 답변을 번역합니다. 번역문만 출력하세요.',
      messages: [{ role: 'user', content: koText }]
    })
  });

  const data = await res.json();
  const newJp = data.content?.[0]?.text || '';
  currentJp = newJp;
  jpDiv.innerHTML = escapeHtml(newJp);
}



document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('customerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) generate();
  });
});