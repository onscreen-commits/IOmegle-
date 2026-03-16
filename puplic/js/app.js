// ===== Indian Omegle — Frontend App =====

const socket = io({ transports: ['websocket', 'polling'] });

// ---- State ----
let chatMode = 'text'; // 'text' | 'video'
let isConnected = false;
let isWaiting = false;
let typingTimer = null;
let isTyping = false;
let webrtc = null;

// ---- DOM ----
const $ = id => document.getElementById(id);

const screens = {
  landing: $('screen-landing'),
  chat: $('screen-chat')
};

const els = {
  startBtn: $('startBtn'),
  tosCheck: $('tosCheck'),
  countrySelect: $('countrySelect'),
  interestsInput: $('interestsInput'),
  modeText: $('modeText'),
  modeVideo: $('modeVideo'),
  chatStartBtn: $('chatStartBtn'),
  nextBtn: $('nextBtn'),
  stopBtn: $('stopBtn'),
  sendBtn: $('sendBtn'),
  messageInput: $('messageInput'),
  messagesContainer: $('messagesContainer'),
  statusDot: $('statusDot'),
  statusText: $('statusText'),
  typingIndicator: $('typingIndicator'),
  reportBtn: $('reportBtn'),
  reportModal: $('reportModal'),
  submitReportBtn: $('submitReportBtn'),
  cancelReportBtn: $('cancelReportBtn'),
  themeToggle: $('themeToggle'),
  videoPanel: $('videoPanel'),
  localVideo: $('localVideo'),
  remoteVideo: $('remoteVideo'),
  remoteVideoPlaceholder: $('remoteVideoPlaceholder'),
  muteBtn: $('muteBtn'),
  camBtn: $('camBtn'),
  onlineCount: $('online-count'),
  chattingCount: $('chatting-count'),
  toast: $('toast')
};

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  els.themeToggle.querySelector('.theme-icon').textContent = saved === 'dark' ? '☀' : '☾';
}

els.themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  els.themeToggle.querySelector('.theme-icon').textContent = next === 'dark' ? '☀' : '☾';
});

initTheme();

// ---- Mode selection ----
[els.modeText, els.modeVideo].forEach(btn => {
  btn.addEventListener('click', () => {
    [els.modeText, els.modeVideo].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chatMode = btn.dataset.mode;
  });
});

// ---- TOS check enables start button ----
els.tosCheck.addEventListener('change', () => {
  els.startBtn.disabled = !els.tosCheck.checked;
});

// ---- Navigate to chat screen ----
els.startBtn.addEventListener('click', () => {
  showScreen('chat');
});

// ---- Chat screen: Start button ----
els.chatStartBtn.addEventListener('click', () => {
  startSearch();
});

function startSearch() {
  clearMessages();
  setStatus('waiting');
  els.chatStartBtn.disabled = true;
  els.nextBtn.disabled = false;
  els.stopBtn.disabled = false;
  els.messageInput.disabled = true;
  els.sendBtn.disabled = true;
  els.reportBtn.style.display = 'none';

  const country = els.countrySelect.value;
  const interests = els.interestsInput.value
    .split(',').map(s => s.trim()).filter(Boolean);

  socket.emit('find_match', { country, interests });
  addSystemMessage('🔍 Looking for a stranger to chat with…');
}

// ---- Next ----
els.nextBtn.addEventListener('click', () => {
  if (chatMode === 'video' && webrtc) webrtc.reset();
  socket.emit('next');
  clearMessages();
  setStatus('waiting');
  isConnected = false;
  els.messageInput.disabled = true;
  els.sendBtn.disabled = true;
  els.reportBtn.style.display = 'none';
  hideTypingIndicator();
  addSystemMessage('🔍 Looking for a new stranger…');
  if (chatMode === 'video') els.remoteVideoPlaceholder.style.display = 'flex';
});

// ---- Stop ----
els.stopBtn.addEventListener('click', () => {
  if (chatMode === 'video' && webrtc) webrtc.endCall();
  socket.emit('stop');
  setStatus('idle');
  isConnected = false;
  isWaiting = false;
  els.chatStartBtn.disabled = false;
  els.nextBtn.disabled = true;
  els.stopBtn.disabled = true;
  els.messageInput.disabled = true;
  els.sendBtn.disabled = true;
  els.reportBtn.style.display = 'none';
  hideTypingIndicator();
  addSystemMessage('⛔ You have stopped the chat.');
});

// ---- Send message ----
function sendMessage() {
  const text = els.messageInput.value.trim();
  if (!text || !isConnected) return;
  socket.emit('message', { text });
  addMessage(text, 'self');
  els.messageInput.value = '';
  els.messageInput.style.height = 'auto';
  stopTyping();
}

els.sendBtn.addEventListener('click', sendMessage);
els.messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
els.messageInput.addEventListener('input', () => {
  els.messageInput.style.height = 'auto';
  els.messageInput.style.height = els.messageInput.scrollHeight + 'px';
  handleTyping();
});

// ---- Typing indicators ----
function handleTyping() {
  if (!isConnected) return;
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { isTyping: true });
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500);
}

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    socket.emit('typing', { isTyping: false });
  }
}

// ---- Report ----
els.reportBtn.addEventListener('click', () => {
  els.reportModal.classList.remove('hidden');
});
els.cancelReportBtn.addEventListener('click', () => {
  els.reportModal.classList.add('hidden');
});
els.submitReportBtn.addEventListener('click', () => {
  const reason = document.querySelector('input[name="reportReason"]:checked')?.value;
  if (!reason) { showToast('Please select a reason.'); return; }
  socket.emit('report', { reason });
  els.reportModal.classList.add('hidden');
});

// ---- Video controls ----
els.muteBtn.addEventListener('click', () => {
  if (!webrtc) return;
  const enabled = webrtc.toggleMute();
  els.muteBtn.textContent = enabled ? '🎙 Mute' : '🔇 Unmute';
});

els.camBtn.addEventListener('click', () => {
  if (!webrtc) return;
  const enabled = webrtc.toggleCamera();
  els.camBtn.textContent = enabled ? '📷 Cam Off' : '📷 Cam On';
});

// ===== SOCKET EVENTS =====

socket.on('waiting', () => {
  isWaiting = true;
  isConnected = false;
  setStatus('waiting');
});

socket.on('matched', async ({ role }) => {
  isWaiting = false;
  isConnected = true;
  setStatus('connected');

  els.messageInput.disabled = false;
  els.sendBtn.disabled = false;
  els.reportBtn.style.display = 'flex';
  els.chatStartBtn.disabled = true;

  addSystemMessage('✅ Connected! You are now chatting with a random stranger.');

  if (chatMode === 'video') {
    await startVideoChat(role);
  }
});

socket.on('message', ({ text }) => {
  addMessage(text, 'stranger');
});

socket.on('typing', ({ isTyping }) => {
  isTyping ? showTypingIndicator() : hideTypingIndicator();
});

socket.on('partner_disconnected', ({ reason }) => {
  isConnected = false;
  setStatus('idle');
  hideTypingIndicator();
  els.messageInput.disabled = true;
  els.sendBtn.disabled = true;
  els.reportBtn.style.display = 'none';

  if (chatMode === 'video' && webrtc) {
    webrtc.stopRemote();
    els.remoteVideoPlaceholder.style.display = 'flex';
  }

  const msgs = {
    next: '👋 Stranger has disconnected. Click Next to find a new one.',
    stopped: '👋 Stranger has stopped the chat.',
    banned: '🚫 The stranger was removed for violating guidelines.',
    default: '👋 Stranger has disconnected.'
  };
  addSystemMessage(msgs[reason] || msgs.default);
});

socket.on('stopped', () => {
  addSystemMessage('⛔ Chat stopped.');
  setStatus('idle');
});

socket.on('banned', ({ reason }) => {
  showToast(`🚫 ${reason}`, 5000);
  setStatus('idle');
  clearMessages();
  addSystemMessage(`🚫 ${reason}`);
  els.chatStartBtn.disabled = true;
  els.nextBtn.disabled = true;
});

socket.on('report_ack', ({ message }) => {
  showToast(`✅ ${message}`);
});

socket.on('stats', ({ online, chatting, waiting }) => {
  els.onlineCount.textContent = online;
  els.chattingCount.textContent = chatting;
});

socket.on('disconnect', () => {
  setStatus('idle');
  isConnected = false;
  addSystemMessage('⚠️ Connection lost. Please refresh the page.');
});

// ===== VIDEO CHAT =====

async function startVideoChat(role) {
  els.videoPanel.classList.remove('hidden');
  webrtc = webrtc || new WebRTCManager(socket);

  webrtc.onRemoteStream = (stream) => {
    els.remoteVideo.srcObject = stream;
    els.remoteVideoPlaceholder.style.display = 'none';
  };

  webrtc.onCallEnded = () => {
    els.remoteVideoPlaceholder.style.display = 'flex';
  };

  try {
    const stream = await webrtc.startLocalStream();
    els.localVideo.srcObject = stream;
    if (role === 'initiator') {
      await webrtc.initiateCall();
    }
  } catch (e) {
    addSystemMessage('⚠️ Could not access camera/microphone. Switching to text-only mode.');
    els.videoPanel.classList.add('hidden');
    chatMode = 'text';
  }
}

// ===== HELPERS =====

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  if (name === 'chat') {
    if (chatMode === 'video') {
      webrtc = new WebRTCManager(socket);
    }
  }
}

function setStatus(state) {
  const states = {
    idle: { dot: '', text: 'Press Start to begin' },
    waiting: { dot: 'waiting', text: '🔍 Finding a stranger…' },
    connected: { dot: 'connected', text: '🇮🇳 You are chatting with a random stranger' }
  };
  const s = states[state] || states.idle;
  els.statusDot.className = 'status-dot ' + s.dot;
  els.statusText.textContent = s.text;
}

function addMessage(text, from) {
  const el = document.createElement('div');
  el.className = `message ${from}`;
  el.innerHTML = `<div class="msg-label">${from === 'self' ? 'You' : 'Stranger'}</div>${escapeHtml(text)}`;
  els.messagesContainer.appendChild(el);
  scrollToBottom();
}

function addSystemMessage(text) {
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = text;
  els.messagesContainer.appendChild(el);
  scrollToBottom();
}

function clearMessages() {
  els.messagesContainer.innerHTML = '';
}

function scrollToBottom() {
  els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  els.typingIndicator.classList.remove('hidden');
}

function hideTypingIndicator() {
  els.typingIndicator.classList.add('hidden');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

let toastTimeout;
function showToast(msg, duration = 3000) {
  clearTimeout(toastTimeout);
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  toastTimeout = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

// ---- Init ----
setStatus('idle');
