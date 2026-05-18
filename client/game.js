function initRound(roundIndex) {
    state.currentRound = roundIndex;
    const roundData = state.queue[roundIndex];
    state.clickCount = 0;
    state.currentPath = [];
    state.timer = state.timeLimit || 150;
    state.gameActive = true;
    state.playerFinished = false;
    document.body.classList.remove('results-active');

    closePathModal();
    closeQueueModal();
    closeSurrenderModal();

    renderLiveRanks(state.players.map(p => ({
        name: p.name,
        clicks: 0,
        avatar: p.avatar,
        isConnected: p.isConnected !== false
    })));
    const targetTitle = document.getElementById('target-title');
    if (targetTitle) targetTitle.innerText = roundData.end;
    const counter = document.getElementById('click-count');
    if (counter) counter.innerText = '0';
    const next = document.getElementById('next-round-controls');
    if (next) next.classList.add('hidden');

    const overlay = document.getElementById('round-finish-overlay');
    if (overlay) overlay.classList.add('hidden');

    const wikiContent = document.getElementById('wiki-content');
    if (wikiContent) wikiContent.innerHTML = '';

    showScreen('game');
    loadWikiPage(roundData.start);

    updateTimerDisplay();
    startTimer();
}

function updateTimerDisplay() {
    const mins = Math.floor(state.timer / 60).toString().padStart(2, '0');
    const secs = (state.timer % 60).toString().padStart(2, '0');
    const el = document.getElementById('game-timer');
    if (el) el.innerText = `${mins}:${secs}`;
}

function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timer--;
        updateTimerDisplay();
        if (state.timer <= 0) endRound(false, true);
    }, 1000);
}

async function loadWikiPage(title) {
    const container = document.getElementById('wiki-content');
    const loader = document.getElementById('wiki-loader');
    if (!container) return;

    if (loader) loader.classList.remove('hidden');

    try {
        const normalizedTitle = title.replace(/ /g, '_');
        const response = await fetch(`https://tr.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(normalizedTitle)}`);
        const html = await response.text();

        const targetTitle = state.queue[state.currentRound].end.replace(/ /g, '_').toLowerCase();
        if (normalizedTitle.toLowerCase() === targetTitle) {
            endRound(true);
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style = "width:100%; height:100%; border:none; background:white;";

        iframe.onload = () => {
            if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
        };

        if (state.currentPath) state.currentPath.push(title);

        container.innerHTML = '';
        container.appendChild(iframe);

        iframe.srcdoc = `
            <!DOCTYPE html>
            <html>
                <head>
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
                    <style>
                        * { box-sizing: border-box; }
                        html, body { margin: 0; padding: 0; min-height: 100vh; overflow-x: hidden; background: #ffffff; }
                        body { font-family: 'Outfit', sans-serif; padding: 30px; line-height: 1.7; color: #1e293b; -webkit-font-smoothing: antialiased; width: 100%; }
                        a { color: #8b5cf6; text-decoration: none; font-weight: 600; border-bottom: 1px solid transparent; transition: all 0.2s; }
                        a:hover { border-bottom-color: #8b5cf6; }
                        img { max-width: 100%; height: auto; border-radius: 12px; margin: 15px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); pointer-events: none; user-select: none; }
                        .mw-body-content { font-size: 1.1rem; width: 100%; }
                        h1, h2, h3 { color: #0f172a; margin-top: 1.5em; }
                    </style>
                </head>
                <body>
                    <div class="mw-body-content">${html}</div>
                    <script>
                        document.addEventListener('keydown', e => {
                            if ((e.ctrlKey || e.metaKey) && (e.keyCode === 70 || e.keyCode === 71 || e.key === 'f' || e.key === 'F' || e.key === 'g' || e.key === 'G')) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }, true);

                        document.addEventListener('click', e => {
                            const a = e.target.closest('a');
                            if (!a) return;
                            e.preventDefault();
                            const href = a.getAttribute('href');
                            if (href && href.startsWith('./') && !a.classList.contains('new')) {
                                const nextTitle = decodeURIComponent(href.replace('./','').split('#')[0]);
                                window.parent.postMessage({type:'wiki-nav', title: nextTitle}, '*');
                            }
                        });
                    </script>
                </body>
            </html>`;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="text-align:center; padding:2rem;">Sayfa yüklenirken bir hata oluştu.</div>';
    }
}

function handleNavigation(title) {
    if (!state.gameActive || state.playerFinished) return;
    state.clickCount++;
    document.getElementById('click-count').innerText = state.clickCount;
    socket.emit('update-clicks', { lobbyId: state.lobbyId, userId: state.user.id, clicks: state.clickCount });

    const normalizedNav = title.replace(/ /g, '_').toLowerCase();
    const targetTitle = state.queue[state.currentRound].end.replace(/ /g, '_').toLowerCase();

    if (normalizedNav === targetTitle) {
        state.currentPath.push(title);
        endRound(true);
    } else {
        loadWikiPage(title);
    }
}

function endRound(isWin = false, isTimeUp = false) {
    if (state.playerFinished) return;
    state.playerFinished = true;

    socket.emit('round-finished', {
        lobbyId: state.lobbyId,
        userId: state.user.id,
        clicks: state.clickCount,
        remainingTime: state.timer,
        isWin,
        path: state.currentPath || [],
        isTimeout: isTimeUp
    });

    const overlay = document.getElementById('round-finish-overlay');
    const statusTitle = document.getElementById('finish-status-title');
    const statusMsg = document.getElementById('finish-status-msg');

    if (overlay) {
        overlay.classList.remove('hidden');
        if (isWin) {
            statusTitle.innerText = "Hedefe Ulaştın! 🏆";
            statusMsg.innerText = "Harika bir yarıştı! Diğer yarışçılar bekleniyor...";
        } else if (isTimeUp) {
            statusTitle.innerText = "Süre Doldu! ⌛";
            statusMsg.innerText = "Zaman tükendi. Diğer oyuncular bekleniyor...";
        } else {
            statusTitle.innerText = "Pes Edildi! 🏳️";
            statusMsg.innerText = "Bu turdan çekildin. Diğer yarışçılar bekleniyor...";
        }
    }

    if (isWin) showNotification('Tebrikler! Hedefe ulaştın. Diğerlerini bekliyoruz...', 'success');
    else if (isTimeUp) showNotification('Süre doldu! Maalesef hedefe ulaşamadın.', 'warning');
    else showNotification('Pes ettin. Sonuçlar bekleniyor...', 'info');
}

function confirmSurrender() { closeSurrenderModal(); endRound(false); }

function nextRound() { if (state.currentRound + 1 < state.queue.length) socket.emit('start-next-round', { lobbyId: state.lobbyId, roundIndex: state.currentRound + 1 }); }

function startGame() {
    if (state.queue.length > 0) socket.emit('start-game', { lobbyId: state.lobbyId });
    else showNotification('Lütfen oyunu başlatmadan önce en az bir soru ekleyin!', 'warning');
}

function createLobby() {
    const name = document.getElementById('admin-name').value.trim();
    const streamerMode = document.getElementById('streamer-mode').checked;
    if (!name) return showNotification('Lütfen ismini gir!', 'error');

    state.user = { name };
    state.streamerMode = streamerMode; 
    const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
    socket.emit('create-lobby', { name, lobbyId, avatar: state.selectedAvatar, streamerMode });
}

function confirmLobbySettings() {
    if (!state.isAdmin) return;
    const timeLimit = document.getElementById('modal-round-time').value;
    socket.emit('update-lobby-settings', { lobbyId: state.lobbyId, settings: { timeLimit } });
    closeSettingsModal();
}

function joinLobby() {
    const name = document.getElementById('username')?.value.trim();
    const lobbyId = document.getElementById('lobby-id')?.value.trim().toUpperCase();
    if (!name || !lobbyId) return showNotification('Eksik bilgi!', 'error');
    socket.emit('join-lobby', { name, lobbyId, avatar: state.selectedAvatar });
}

function leaveLobby() {
    if (!state.lobbyId) return;

    let title = 'Lobiden Ayrıl 🚪';
    let text = 'Lobiden ayrılmak istediğine emin misin?';
    let btnText = 'Evet, Ayrıl';

    if (state.isAdmin) {
        title = 'Lobiyi Kapat ⚠️';
        text = 'Lobi sahibi sensin. Ayrılırsan lobi dağılacak ve tüm oyuncular çıkarılacak. Emin misin?';
        btnText = 'Lobiyi Dağıt';
    }

    showConfirmModal(title, text, () => {
        socket.emit('leave-lobby', { lobbyId: state.lobbyId });
        location.reload();
    }, btnText);
}

function removeFromQueue(index) {
    if (!state.isAdmin) return;
    state.queue.splice(index, 1);
    socket.emit('update-queue', { lobbyId: state.lobbyId, queue: state.queue });
    renderQueue();
}

function approveSuggestion(start, end, startThumb, endThumb, btn) {
    const li = btn.closest('li');
    const index = Array.from(li.parentNode.children).indexOf(li);
    socket.emit('approve-suggestion', { lobbyId: state.lobbyId, index });
    li.remove();
}

function rejectSuggestion(btn) {
    const li = btn.closest('li');
    const index = Array.from(li.parentNode.children).indexOf(li);
    socket.emit('reject-suggestion', { lobbyId: state.lobbyId, index });
    li.remove();
}

function addToQueue() {
    const sIn = document.getElementById('start-node');
    const eIn = document.getElementById('end-node');
    const start = sIn?.value.trim();
    const end = eIn?.value.trim();
    if (!start || !end) return showNotification('Alanları doldurun!', 'error');
    if (start === end) return showNotification('Başlangıç ve hedef aynı olamaz!', 'error');

    if (start !== state.validatedStart || end !== state.validatedEnd) {
        return showNotification('Lütfen her iki sayfayı da öneriler listesinden seçin!', 'warning');
    }

    const item = { start, end, startThumb: state.validatedStartThumb, endThumb: state.validatedEndThumb };

    if (state.isAdmin) {
        state.queue.push(item);
        socket.emit('update-queue', { lobbyId: state.lobbyId, queue: state.queue });
        renderQueue();
    } else {
        socket.emit('suggest-queue-item', { lobbyId: state.lobbyId, suggestion: item });
        showNotification('Öneriniz hosta gönderildi!', 'info');
    }

    if (sIn) sIn.value = '';
    if (eIn) eIn.value = '';
    state.validatedStart = null;
    state.validatedEnd = null;
    state.validatedStartThumb = null;
    state.validatedEndThumb = null;
}
