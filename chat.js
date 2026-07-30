let currentJp = '';
let currentKo = '';
let currentCustomerKo = '';

// 답변 생성
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

  box.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
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

    const jpMatch = full.match(/---JP---([\s\S]*?)---KO---/);
    const koMatch = full.match(/---KO---([\s\S]*?)---CUSTOMER_KO---/);
    const customerKoMatch = full.match(/---CUSTOMER_KO---([\s\S]*?)---END---/);

    currentJp = jpMatch ? jpMatch[1].trim() : full;
    currentKo = koMatch ? koMatch[1].trim() : '';
    currentCustomerKo = customerKoMatch ? customerKoMatch[1].trim() : '';

    box.classList.remove('loading');
    box.innerHTML = `
      <div class="jp-response" id="jpEditBox" contenteditable="true" style="outline:none;cursor:text;" spellcheck="false">${escapeHtml(currentJp)}</div>
      <div class="divider"></div>
      <div class="ko-label">🇰🇷 답변 한국어 번역</div>
      <div class="ko-response" id="koEditBox" contenteditable="true" style="outline:none;cursor:text;" spellcheck="false">${escapeHtml(currentKo)}</div>
      <button onclick="retranslate()" style="margin-top:10px;padding:8px 16px;background:#1a1410;color:#c9a96e;border:none;border-radius:8px;cursor:pointer;font-size:12px;">🔄 한국어→일본어 재번역</button>
    `;

    document.getElementById('customerKoBox').innerHTML = escapeHtml(currentCustomerKo) || '—';
    document.getElementById('copyJpBtn').disabled = false;
    document.getElementById('copyKoBtn').disabled = false;

  } catch (e) {
    box.classList.remove('loading');
    box.innerHTML = `<div style="color:#e55;font-size:13px;">오류가 발생했습니다.</div>`;
  }

  btn.disabled = false;
  btn.textContent = '✦ 답변 생성';
}

async function copyText(type) {
  let text;
  if (type === 'jp') {
    const el = document.getElementById('jpEditBox');
    text = el ? el.innerText : currentJp;
  } else {
    text = currentKo;
  }
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(type === 'jp' ? '일본어 복사 완료! 인스타에 붙여넣으세요 📋' : '한국어 번역 복사 완료! 📋');
  });
}

async function retranslate() {
  const koText = document.getElementById('koEditBox').innerText.trim();
  if (!koText) return;
  const jpDiv = document.getElementById('jpEditBox');
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
  currentJp = data.content?.[0]?.text || '';
  jpDiv.innerHTML = escapeHtml(currentJp);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}
