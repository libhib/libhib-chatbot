let currentJp = '';
let currentKo = '';
let currentCustomerKo = '';
let currentCustomer = null;
let allCustomers = [];

// 초기 로드
window.onload = async () => {
  await loadCustomers();
};

// 고객 목록 로드
async function loadCustomers() {
  const res = await fetch('/api/customers');
  allCustomers = await res.json();
  renderCustomers(allCustomers);
}

function renderCustomers(list) {
  const el = document.getElementById('customerList');
  if (!list.length) {
    el.innerHTML = '<div style="font-size:12px;color:#ccc;text-align:center;padding:12px;">고객 없음</div>';
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="customer-item ${currentCustomer?.id === c.id ? 'active' : ''}" onclick="selectCustomer(${c.id})">
      <div class="ig-id">${c.instagram_id}</div>
      <div class="cname">${c.name || ''}</div>
    </div>
  `).join('');
}

function filterCustomers() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderCustomers(allCustomers.filter(c => c.instagram_id.toLowerCase().includes(q)));
}

// 고객 선택
async function selectCustomer(id) {
  currentCustomer = allCustomers.find(c => c.id === id);
  document.getElementById('chatTitle').textContent = currentCustomer.instagram_id;
  document.getElementById('chatSub').textContent = currentCustomer.name || '';
  renderCustomers(allCustomers);
  await loadMessages();
}

// 메시지 로드
async function loadMessages() {
  if (!currentCustomer) return;
  const res = await fetch(`/api/messages?customer_id=${currentCustomer.id}`);
  const messages = await res.json();
  const el = document.getElementById('messageList');
  if (!messages.length) {
    el.innerHTML = '<div class="empty-state">아직 대화 없음</div>';
    return;
  }
  el.innerHTML = messages.map(m => `
    <div class="msg-item ${m.role}">
      <div class="msg-bubble">${escapeHtml(m.content)}</div>
      <div class="msg-time">${new Date(m.created_at).toLocaleString('ko-KR', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

// 고객 추가
function showAddCustomer() {
  document.getElementById('modalBg').classList.add('show');
  document.getElementById('newInstagramId').focus();
}
function hideModal() {
  document.getElementById('modalBg').classList.remove('show');
  document.getElementById('newInstagramId').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newMemo').value = '';
}

async function addCustomer() {
  const instagram_id = document.getElementById('newInstagramId').value.trim();
  if (!instagram_id) return;
  const name = document.getElementById('newName').value.trim();
  const memo = document.getElementById('newMemo').value.trim();

  await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instagram_id, name, memo })
  });

  hideModal();
  await loadCustomers();
  showToast('고객 추가 완료! ✅');
}

// 답변 생성
async function generate() {
  const input = document.getElementById('customerInput');
  const text = input.value.trim();
  if (!text) return;
  if (!currentCustomer) { showToast('고객을 먼저 선택하세요!'); return; }

  // 고객 메시지 저장
  await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: currentCustomer.id, role: 'customer', content: text })
  });

  const btn = document.getElementById('generateBtn');
  const box = document.getElementById('responseBox');
  btn.disabled = true;
  btn.textContent = '생성 중…';
  document.getElementById('copyJpBtn').disabled = true;
  document.getElementById('copyKoBtn').disabled = true;
  document.getElementById('customerKoBox').innerHTML = '번역 중…';

  box.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
  box.classList.add('loading');

  // 이전 대화 히스토리 가져오기
  const histRes = await fetch(`/api/messages?customer_id=${currentCustomer.id}`);
  const history = await histRes.json();

  const messages = history.map(m => ({
    role: m.role === 'customer' ? 'user' : 'assistant',
    content: m.content
  }));

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: CLINIC_CONFIG.systemPrompt,
        messages
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

    input.value = '';
    await loadMessages();

  } catch (e) {
    box.classList.remove('loading');
    box.innerHTML = `<div style="color:#e55;font-size:13px;">오류가 발생했습니다.</div>`;
  }

  btn.disabled = false;
  btn.textContent = '✦ 답변 생성';
}

// 일본어 복사 후 DB 저장
async function copyText(type) {
  let text;
  if (type === 'jp') {
    const el = document.getElementById('jpEditBox');
    text = el ? el.innerText : currentJp;
    // 복사한 답변 DB 저장
    if (currentCustomer && text) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: currentCustomer.id, role: 'assistant', content: text })
      });
      await new Promise(r => setTimeout(r, 300));
      await loadMessages();
    }
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