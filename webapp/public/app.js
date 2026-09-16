let currentIp = localStorage.getItem('tv_ip') || '';
let currentSession = localStorage.getItem('tv_session') || '';
let currentPin = localStorage.getItem('tv_pin') || '';

const authScreen = document.getElementById('auth-screen');
const remoteScreen = document.getElementById('remote-screen');
const ipInput = document.getElementById('tv-ip');
const pinInput = document.getElementById('tv-pin');
const pinSection = document.getElementById('pin-section');
const statusText = document.getElementById('discovery-status');

// Init
if (currentIp) ipInput.value = currentIp;
if (currentIp && currentSession) {
  showRemote();
} else if (currentIp && currentPin) {
  silentReconnect();
}

// --- API Helpers ---
async function proxyTVRequest(endpoint, xml) {
  const res = await fetch('/api/tv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip: currentIp, endpoint, xml })
  });
  if (!res.ok) throw new Error('Request failed');
  return res.text();
}

// --- Auth Flow ---
document.getElementById('btn-discover').addEventListener('click', async () => {
  statusText.textContent = 'Scanning network... (takes 5s)';
  try {
    const res = await fetch('/api/discover');
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    currentIp = data.ip;
    ipInput.value = currentIp;
    statusText.textContent = `Found TV at ${currentIp}`;
  } catch (err) {
    statusText.textContent = 'TV not found. Enter IP manually.';
  }
});

document.getElementById('btn-request-pin').addEventListener('click', async () => {
  currentIp = ipInput.value;
  if (!currentIp) return alert('Enter IP address');
  
  const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthKeyReq</type></auth>`;
  try {
    await proxyTVRequest('auth', xml);
    pinSection.classList.remove('hidden');
    statusText.textContent = 'PIN requested. Look at your TV.';
  } catch (e) {
    alert('Failed to request PIN. Is the TV on and IP correct?');
  }
});

document.getElementById('btn-pair').addEventListener('click', async () => {
  currentPin = pinInput.value;
  if (!currentPin) return alert('Enter PIN');

  const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthReq</type><value>${currentPin}</value></auth>`;
  try {
    const responseText = await proxyTVRequest('auth', xml);
    const match = responseText.match(/<session>(.*?)<\/session>/);
    if (match && match[1]) {
      currentSession = match[1];
      localStorage.setItem('tv_ip', currentIp);
      localStorage.setItem('tv_pin', currentPin);
      localStorage.setItem('tv_session', currentSession);
      showRemote();
    } else {
      alert('Invalid PIN or rejected.');
    }
  } catch (e) {
    alert('Failed to pair.');
  }
});

async function silentReconnect() {
  const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthReq</type><value>${currentPin}</value></auth>`;
  try {
    const responseText = await proxyTVRequest('auth', xml);
    const match = responseText.match(/<session>(.*?)<\/session>/);
    if (match && match[1]) {
      currentSession = match[1];
      localStorage.setItem('tv_session', currentSession);
      showRemote();
    }
  } catch (e) {
    console.log('Silent reconnect failed, TV might be off');
  }
}

document.getElementById('btn-disconnect').addEventListener('click', () => {
  currentSession = '';
  localStorage.removeItem('tv_session');
  authScreen.classList.remove('hidden');
  remoteScreen.classList.add('hidden');
  appSettingsModal.classList.add('hidden');
});

function showRemote() {
  authScreen.classList.add('hidden');
  remoteScreen.classList.remove('hidden');
}

// --- Remote Control ---
document.querySelectorAll('.remote-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const key = e.target.getAttribute('data-key') || btn.getAttribute('data-key');
    if (!key || !currentSession) return;
    
    // Haptic feedback if supported by browser
    if (typeof hapticsEnabled !== 'undefined' && hapticsEnabled && navigator.vibrate) {
      navigator.vibrate(50);
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?><command><session>${currentSession}</session><type>HandleKeyInput</type><value>${key}</value></command>`;
    try {
      await proxyTVRequest('command', xml);
    } catch (err) {
      console.error('Failed to send command', err);
      // If unauthorized, might need to reconnect
      if (err.message.includes('failed')) silentReconnect();
    }
  });
});

// --- Pagination Logic ---
const scrollContainer = document.querySelector('.scroll-container');
const dots = document.querySelectorAll('.dot');

if (scrollContainer && dots.length > 0) {
  scrollContainer.addEventListener('scroll', () => {
    const scrollLeft = scrollContainer.scrollLeft;
    const width = scrollContainer.clientWidth;
    const pageIndex = Math.min(Math.round(scrollLeft / width), dots.length - 1);
    
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === pageIndex);
    });
  }, { passive: true });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const pageIndex = parseInt(dot.getAttribute('data-page') || '0', 10);
      const width = scrollContainer.clientWidth;
      scrollContainer.scrollTo({
        left: pageIndex * width,
        behavior: 'smooth'
      });
    });
  });
}

// --- Modals ---
const numpadModal = document.getElementById('numpad-modal');
const trackpadModal = document.getElementById('trackpad-modal');
const appSettingsModal = document.getElementById('app-settings-modal');

document.getElementById('btn-show-app-settings').addEventListener('click', () => {
  document.getElementById('settings-tv-ip').textContent = currentIp || 'Not connected';
  appSettingsModal.classList.remove('hidden');
});
document.getElementById('btn-close-app-settings').addEventListener('click', () => {
  appSettingsModal.classList.add('hidden');
});

document.getElementById('btn-show-numpad').addEventListener('click', () => {
  numpadModal.classList.remove('hidden');
});
document.getElementById('btn-close-numpad').addEventListener('click', () => {
  numpadModal.classList.add('hidden');
});

document.getElementById('btn-show-trackpad').addEventListener('click', () => {
  trackpadModal.classList.remove('hidden');
});
document.getElementById('btn-close-trackpad').addEventListener('click', () => {
  trackpadModal.classList.add('hidden');
});

// Close modals when clicking backdrop
[numpadModal, trackpadModal, appSettingsModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

let hapticsEnabled = true;
document.getElementById('toggle-haptics').addEventListener('change', (e) => {
  hapticsEnabled = e.target.checked;
});

// --- Trackpad Logic ---
const trackpad = document.getElementById('trackpad-surface');
let lastTouchX = 0;
let lastTouchY = 0;
let lastMoveTime = 0;

let isPointerDown = false;

trackpad.addEventListener('pointerdown', (e) => {
  isPointerDown = true;
  trackpad.setPointerCapture(e.pointerId);
  lastTouchX = e.clientX;
  lastTouchY = e.clientY;
  lastMoveTime = Date.now();
});

trackpad.addEventListener('pointermove', (e) => {
  if (!isPointerDown) return;
  e.preventDefault(); // Prevent scrolling
  const now = Date.now();
  if (now - lastMoveTime < 80) return; // throttle

  let dx = Math.round(e.clientX - lastTouchX);
  let dy = Math.round(e.clientY - lastTouchY);
  
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    lastMoveTime = now;
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
    
    // Send HandleTouchMove
    const xml = `<?xml version="1.0" encoding="utf-8"?><command><session>${currentSession}</session><type>HandleTouchMove</type><x>${dx}</x><y>${dy}</y></command>`;
    proxyTVRequest('command', xml).catch(() => {});
  }
});

trackpad.addEventListener('pointerup', (e) => {
  if (!isPointerDown) return;
  isPointerDown = false;
  trackpad.releasePointerCapture(e.pointerId);
  
  // If no movement, treat as click
  if (Date.now() - lastMoveTime > 150) {
    if (navigator.vibrate) navigator.vibrate(20);
    const xml = `<?xml version="1.0" encoding="utf-8"?><command><session>${currentSession}</session><type>HandleTouchClick</type></command>`;
    proxyTVRequest('command', xml).catch(() => {});
  }
});

