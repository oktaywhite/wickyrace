// Socket initialization with fallback mock
let socket = {
    on: (event, cb) => console.log(`[Mock] Listening for ${event}`),
    emit: (event, data) => console.log(`[Mock] Emitting ${event}`, data)
};

if (typeof io !== 'undefined') {
    const socketUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
    socket = io(socketUrl, { transports: ['websocket', 'polling'] });
}

socket.on('server-stats', (stats) => {
    const versionEl = document.getElementById('stat-version');
    const onlineEl = document.getElementById('stat-online');
    const lobbiesEl = document.getElementById('stat-lobbies');
    if (versionEl) versionEl.innerText = stats.version;
    if (onlineEl) onlineEl.innerText = `${stats.onlineCount} Online`;
    if (lobbiesEl) lobbiesEl.innerText = `${stats.lobbyCount} Lobi`;
});

socket.on('connect', () => {
    const status = document.getElementById('connection-status');
    if (status) status.className = 'status-online';
});

socket.on('disconnect', () => {
    const status = document.getElementById('connection-status');
    if (status) status.className = 'status-offline';
});

socket.on('join-success', (data) => {
    state.lobbyId = data.lobbyId;
    state.streamerMode = !!data.streamerMode;
    state.timeLimit = data.timeLimit || 150;

    const displayId = document.getElementById('display-lobby-id');
    const eyeBtn = document.getElementById('streamer-eye-btn');
    const timeBadge = document.getElementById('lobby-time-badge');
    const modalRange = document.getElementById('modal-round-time');
    const rangeVal = document.getElementById('range-val');

    if (displayId) {
        if (state.streamerMode) {
            displayId.innerText = "••••••";
            if (eyeBtn) eyeBtn.classList.remove('hidden');
        } else {
            displayId.innerText = `#${state.lobbyId}`;
            if (eyeBtn) eyeBtn.classList.add('hidden');
        }
    }

    if (timeBadge) timeBadge.innerText = `${state.timeLimit}sn`;
    if (modalRange) modalRange.value = state.timeLimit;
    if (rangeVal) rangeVal.innerText = state.timeLimit;

    showScreen('lobby');
    switchTab('create');
    renderQueue();
});

socket.on('lobby-settings-update', (lobby) => {
    state.timeLimit = lobby.timeLimit;
    const timeBadge = document.getElementById('lobby-time-badge');
    const modalRange = document.getElementById('modal-round-time');
    const rangeVal = document.getElementById('range-val');

    if (timeBadge) timeBadge.innerText = `${state.timeLimit}sn`;
    if (modalRange) modalRange.value = state.timeLimit;
    if (rangeVal) rangeVal.innerText = state.timeLimit;

    showNotification(`Süre ${state.timeLimit}sn olarak güncellendi!`, 'info');
});

socket.on('players-update', (players) => {
    state.players = players;
    state.user = players.find(p => p.id === socket.id);
    state.isAdmin = state.user ? state.user.isAdmin : false;

    const adminCtrls = document.getElementById('admin-controls');
    const settingsBtn = document.getElementById('lobby-settings-btn');
    const suggestHint = document.getElementById('suggest-hint');

    if (adminCtrls) {
        if (state.isAdmin) {
            adminCtrls.classList.remove('hidden');
            if (settingsBtn) settingsBtn.classList.remove('hidden');
        } else {
            adminCtrls.classList.add('hidden');
            if (settingsBtn) settingsBtn.classList.add('hidden');
        }
    }
    if (suggestHint) {
        if (state.isAdmin) suggestHint.classList.add('hidden');
        else suggestHint.classList.remove('hidden');
    }

    renderPlayers();
    renderLiveRanks(state.players.map(p => ({
        name: p.name,
        clicks: p.currentClicks || 0,
        avatar: p.avatar,
        isConnected: p.isConnected !== false,
        finished: p.finished || false,
        isWin: p.isWin || false
    })));
});

socket.on('queue-update', (queue) => {
    state.queue = queue;
    renderQueue();
});

socket.on('chat-message', ({ sender, message, senderId, avatar }) => {
    if (state.mutedUsers.includes(senderId)) return;
    appendMessage(sender, message, senderId === socket.id, senderId, avatar);
});

socket.on('system-message', ({ message, type }) => appendSystemMessage(message, type));

socket.on('error', (msg) => showNotification(msg, 'error'));
socket.on('notification', ({ message, type }) => showNotification(message, type || 'info'));

socket.on('kicked', (msg) => {
    showNotification(msg, 'error');
    setTimeout(() => location.reload(), 2000);
});

socket.on('new-suggestion', (suggestion) => {
    const ul = document.getElementById('suggestions-ul'); 
    const container = document.getElementById('suggestions-container');
    if (!ul) return;
    if (container) container.classList.remove('hidden');

    const li = document.createElement('li');
    li.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:8px; margin-bottom:0.5rem; font-size:0.8rem;";
    li.innerHTML = `
        <span>${suggestion.start} ➜ ${suggestion.end}</span>
        <div style="display:flex; gap:5px;">
            <button onclick="approveSuggestion('${suggestion.start.replace(/'/g, "\\'")}', '${suggestion.end.replace(/'/g, "\\'")}', ${suggestion.startThumb ? `'${suggestion.startThumb}'` : 'null'}, ${suggestion.endThumb ? `'${suggestion.endThumb}'` : 'null'}, this)" style="background:var(--primary); border:none; color:white; padding:2px 8px; border-radius:4px; cursor:pointer;">✓</button>
            <button onclick="rejectSuggestion(this)" style="background:rgba(255,255,255,0.1); border:none; color:white; padding:2px 8px; border-radius:4px; cursor:pointer;">✕</button>
        </div>
    `;
    ul.appendChild(li);
});

socket.on('game-started', (roundIndex) => initRound(roundIndex || 0));

socket.on('live-update', (liveRanks) => renderLiveRanks(liveRanks));

socket.on('round-results', (results) => {
    state.gameActive = false;
    state.playerFinished = true;
    clearInterval(state.timerInterval);
    displayResults(results);

    const myResult = results.find(r => r.id === socket.id);
    if (myResult && myResult.isWin === true) startConfetti();

    showScreen('result');
});
