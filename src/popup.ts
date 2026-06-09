const startControls = document.getElementById('start-controls');
const stopControls = document.getElementById('stop-controls');
const durationSelect = document.getElementById('duration-select') as HTMLSelectElement | null;
const startBtn = document.getElementById('start-audit-btn');
const startContinuousBtn = document.getElementById('start-continuous-btn');
const startPeriodicBtn = document.getElementById('start-periodic-btn');
const intervalSelect = document.getElementById('interval-select') as HTMLSelectElement | null;
const stopBtn = document.getElementById('stop-audit-btn');
const statsEl = document.getElementById('audit-stats');
const listEl = document.getElementById('audit-list');

let sessionEndDate: number | null = null;
let countdownInterval: any = null;
let nextScanDate: number | null = null;
let periodicCountdownInterval: any = null;

const stopAllCountdowns = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (periodicCountdownInterval) {
    clearInterval(periodicCountdownInterval);
    periodicCountdownInterval = null;
  }
};

const updatePeriodicCountdown = () => {
    if (!nextScanDate) return;
    const now = Date.now();
    const timeLeft = nextScanDate - now;

    if (timeLeft <= 0) {
        if (statsEl) statsEl.innerText = `📡 Scanning now...`;
        // La cuenta regresiva se detendrá y se reiniciará la próxima vez que se abra el popup
        stopAllCountdowns();
        return;
    }

    const minutes = Math.floor((timeLeft / 1000) / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    if (statsEl) {
        statsEl.innerText = `📡 Next scan in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
}

const updateCountdown = () => {
  if (sessionEndDate) {
    const now = Date.now();
    const timeLeft = sessionEndDate - now;

    if (timeLeft <= 0) {
      if (statsEl) statsEl.innerText = "Session ended. You can start a new one.";
      stopAllCountdowns();
      return;
    }

    const minutes = Math.floor((timeLeft / 1000) / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    if (statsEl) {
      statsEl.innerText = `🚨 Active audit. Ends in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
  } else if (document.getElementById('stop-controls')?.style.display.includes('block')) {
      if (statsEl) statsEl.innerText = `🛰️ Active audit...`;
  }
};


const updatePopupUI = (data: any) => {
  if (!countdownInterval && !periodicCountdownInterval && !sessionEndDate && statsEl && !document.getElementById('stop-controls')?.style.display?.includes('block')) { 
      statsEl.innerText = `🚨 Detected ${data.extensionsCount} extensions (${data.totalInjections} elements)`;
  }
  
  if (listEl) {
    listEl.textContent = '';
    data.extensions.forEach((ext: any) => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 10px;
        background: #f1f2f6;
        border-radius: 6px;
        border-left: 4px solid #ff4757;
        margin-bottom: 8px;
        font-family: sans-serif;
        font-size: 0.8rem;
      `;

      const title = document.createElement('strong');
      title.style.color = '#2f3542';
      title.textContent = ext.name;
      card.appendChild(title);

      card.appendChild(document.createElement('br'));

      const impact = document.createElement('small');
      impact.style.color = '#57606f';
      impact.textContent = `Impact: ${ext.count} elements`;
      card.appendChild(impact);

      card.appendChild(document.createElement('br'));

      const signatures = document.createElement('small');
      const sigLabel = document.createElement('strong');
      sigLabel.textContent = 'Signatures: ';
      signatures.appendChild(sigLabel);
      signatures.appendChild(document.createTextNode(ext.keywords.join(', ')));
      card.appendChild(signatures);

      card.appendChild(document.createElement('br'));

      const examples = document.createElement('code');
      examples.style.cssText = 'font-size:0.7rem; color:#ff4757; word-break:break-word;';
      ext.examples.forEach((example: string, index: number) => {
        examples.appendChild(document.createTextNode(example));
        if (index < ext.examples.length - 1) {
          examples.appendChild(document.createElement('br'));
        }
      });
      card.appendChild(examples);

      listEl.appendChild(card);
    });
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'UPDATE_STATS') {
    updatePopupUI(message);
  } else if (message.action === 'AUDIT_STOPPED') {
    if (statsEl) statsEl.innerText = "Session ended.";
    if(startControls) startControls.style.display = 'block';
    if(stopControls) stopControls.style.display = 'none';
    stopAllCountdowns();
  }
});

const requestCurrentState = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("The content script could not be accessed. The page may not support it.");
        if (statsEl) statsEl.innerText = "This page cannot be audited.";
        if (startControls) (startControls as HTMLElement).style.display = 'none';
        return;
      }
      
      if (response?.active) {
        if(startControls) startControls.style.display = 'none';
        if(stopControls) stopControls.style.display = 'block';
        if(stopBtn) stopBtn.style.display = 'block';
        
        if (response.mode === 'periodic' && response.nextScanTime) {
            nextScanDate = response.nextScanTime;
            updatePeriodicCountdown();
            periodicCountdownInterval = setInterval(updatePeriodicCountdown, 1000);
        } else {
            sessionEndDate = response.endTime;
            updateCountdown();
            if(sessionEndDate) {
                countdownInterval = setInterval(updateCountdown, 1000);
            }
        }
      } else {
        if(startControls) startControls.style.display = 'flex';
        if(stopControls) stopControls.style.display = 'none';
      }
    });
  }
};

const startAudit = async (params: {durationMinutes?: number, intervalMinutes?: number}) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'START_AUDIT', ...params }, (response) => {
            if (response?.status === 'started') {
                if (startControls) startControls.style.display = 'none';
                if (stopControls) stopControls.style.display = 'block';
                if (stopBtn) stopBtn.style.display = 'block';
                
                if (response.mode === 'periodic' && response.nextScanTime) {
                    nextScanDate = response.nextScanTime;
                    updatePeriodicCountdown();
                    periodicCountdownInterval = setInterval(updatePeriodicCountdown, 1000);
                } else {
                    sessionEndDate = response.endTime;
                    updateCountdown();
                    if (sessionEndDate) {
                        countdownInterval = setInterval(updateCountdown, 1000);
                    }
                }
            }
        });
    }
};

startBtn?.addEventListener('click', () => {
  if (durationSelect) {
    const duration = parseInt(durationSelect.value, 10);
    startAudit({ durationMinutes: duration });
  }
});

startContinuousBtn?.addEventListener('click', () => {
    startAudit({ durationMinutes: -1 });
});

startPeriodicBtn?.addEventListener('click', () => {
    if (intervalSelect) {
        const interval = parseInt(intervalSelect.value, 10);
        startAudit({ intervalMinutes: interval });
    }
});

stopBtn?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'STOP_AUDIT' }, (response) => {
      if (response?.status === 'stopped') {
        if(stopControls) stopControls.style.display = 'none';
        if(startControls) startControls.style.display = 'flex';
        if (statsEl) statsEl.innerText = "Audit stopped. You can start a new session.";
        stopAllCountdowns();
      }
    });
  }
});

requestCurrentState();
