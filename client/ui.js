function renderPlayers() {
    const ul = document.getElementById('players-ul');
    const countEl = document.getElementById('player-count');
    if (countEl) countEl.innerText = state.players.length;
    if (!ul) return;

    ul.innerHTML = state.players.map(p => `
        <li class="${p.isAdmin ? 'is-host' : ''} ${p.isConnected === false ? 'is-offline' : ''}">
            <div class="player-info-row" onclick="showPlayerMenu('${p.id}', event)">
                <img src="${p.avatar || avatarList[0]}" class="player-avatar" onerror="this.onerror=null;this.src='/assets/avatars/avatar_1.png';">
                <span class="player-name">${p.name} ${p.id === socket.id ? '<b>(Sen)</b>' : ''}</span>
                <span class="player-points">${p.points} P</span>
            </div>
        </li>
    `).join('');
}

function renderQueue() {
    const ul = document.getElementById('queue-ul');
    if (!ul) return;
    if (state.queue.length === 0) {
        ul.innerHTML = '<p style="text-align:center; opacity:0.3; padding:2rem;">Kuyruk boş. Başlangıç ve hedef ekleyin.</p>';
        return;
    }

    ul.innerHTML = state.queue.map((item, index) => `
        <li data-id="${index}">
            <div class="drag-handle">
                <span></span><span></span><span></span>
                <span></span><span></span><span></span>
            </div>
            <div class="queue-item-content">
                <div class="queue-node">${item.startThumb ? `<img src="${item.startThumb}" class="mini-thumb">` : ''}<span>${item.start}</span></div>
                <div class="queue-arrow">➜</div>
                <div class="queue-node">${item.endThumb ? `<img src="${item.endThumb}" class="mini-thumb">` : ''}<span>${item.end}</span></div>
            </div>
            ${state.isAdmin ? `<button class="remove-queue-item" onclick="removeFromQueue(${index})">×</button>` : ''}
        </li>
    `).join('');

    if (state.isAdmin && !state.sortable && typeof Sortable !== 'undefined') {
        state.sortable = new Sortable(ul, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: function () {
                const newOrder = [];
                ul.querySelectorAll('li').forEach(li => {
                    const originalIdx = parseInt(li.getAttribute('data-id'));
                    newOrder.push(state.queue[originalIdx]);
                });
                state.queue = [...newOrder];
                socket.emit('update-queue', { lobbyId: state.lobbyId, queue: state.queue });
                renderQueue();
            }
        });
    }
}

function renderLiveRanks(ranks) {
    const ul = document.getElementById('live-ranks');
    if (ul) {
        ul.innerHTML = ranks.sort((a, b) => {
            const getPriority = (p) => {
                if (p.isConnected === false) return 4;
                if (p.isWin) return 1;
                if (!p.finished) return 2;
                return 3;
            };
            const pa = getPriority(a);
            const pb = getPriority(b);
            if (pa !== pb) return pa - pb;
            return a.clicks - b.clicks;
        }).map(p => {
            let statusClass = '';
            if (p.isConnected === false) statusClass = 'is-offline';
            else if (p.finished) statusClass = p.isWin ? 'is-winner' : 'is-surrendered';

            return `
            <li class="live-rank-item ${statusClass}">
                <img src="${p.avatar || '/assets/avatars/avatar_1.png'}" class="rank-avatar" onerror="this.onerror=null;this.src='/assets/avatars/avatar_1.png';">
                <div class="rank-info">
                    <span class="rank-name">${p.name}</span>
                    <span class="rank-clicks">${p.clicks} Tıklama</span>
                </div>
            </li>
            `;
        }).join('');
    }
}

function displayResults(results) {
    const wins = [document.getElementById('p1-name'), document.getElementById('p2-name'), document.getElementById('p3-name')];
    const pts = [document.getElementById('p1-points'), document.getElementById('p2-points'), document.getElementById('p3-points')];
    const badges = [document.getElementById('p1-badge'), document.getElementById('p2-badge'), document.getElementById('p3-badge')];
    const podiumAvatars = [document.getElementById('p1-avatar'), document.getElementById('p2-avatar'), document.getElementById('p3-avatar')];
    const rankDivs = [
        document.querySelector('.rank.first'),
        document.querySelector('.rank.second'),
        document.querySelector('.rank.third')
    ];

    rankDivs.forEach(div => div?.classList.add('hidden'));

    results.slice(0, 3).forEach((r, i) => {
        if (rankDivs[i]) {
            rankDivs[i].classList.remove('hidden');
            rankDivs[i].onclick = () => showPathModal(r.name, r.path, r.roundPoints, r.clicks);
            rankDivs[i].style.cursor = 'pointer';
        }

        if (wins[i]) wins[i].innerText = r.name;
        if (pts[i]) pts[i].innerText = `${r.totalPoints} P`;
        if (podiumAvatars[i]) podiumAvatars[i].src = r.avatar || avatarList[0];

        if (badges[i]) {
            const rp = r.roundPoints || 0;
            let badgeClass = 'neutral';
            let badgeText = `0`;

            if (rp > 0) { badgeClass = 'gain'; badgeText = `+${rp}`; }
            else if (rp < 0) { badgeClass = 'loss'; badgeText = `${rp}`; }

            badges[i].innerHTML = `<span>${badgeText}</span>`;
            badges[i].className = `point-badge ${badgeClass}`;
        }
    });

    const othersContainer = document.getElementById('others-list');
    if (othersContainer) {
        const others = results.slice(3);
        if (others.length > 0) {
            othersContainer.innerHTML = others.map(r => {
                const rp = r.roundPoints || 0;
                const badgeClass = rp > 0 ? 'gain' : (rp < 0 ? 'loss' : 'neutral');
                const badgeText = rp > 0 ? `+${rp}` : (rp < 0 ? `${rp}` : `0`);

                return `
                    <div class="other-player-row glass" style="cursor:pointer" onclick="showPathModal('${r.name}', ${JSON.stringify(r.path).replace(/"/g, '&quot;')}, ${rp}, ${r.clicks})">
                        <div class="other-info">
                            <img src="${r.avatar || avatarList[0]}" class="other-avatar">
                            <span class="other-name">${r.name}</span>
                        </div>
                        <span class="other-points">${r.totalPoints} P</span>
                        <div class="other-badge ${badgeClass}">${badgeText}</div>
                    </div>
                `;
            }).join('');
        } else {
            othersContainer.innerHTML = '';
        }
    }

    const roundWinner = [...results].sort((a, b) => (b.roundPoints || 0) - (a.roundPoints || 0))[0];
    if (roundWinner && (roundWinner.roundPoints > 0 || roundWinner.path.length > 0)) {
        setTimeout(() => {
            showPathModal(roundWinner.name, roundWinner.path, roundWinner.roundPoints, roundWinner.clicks);
        }, 600);
    }
    document.body.classList.add('results-active'); 
    const next = document.getElementById('next-round-controls');
    if (next) {
        next.classList.remove('hidden');
        const isLast = state.currentRound >= state.queue.length - 1;
        const nextRoundInfo = !isLast ? state.queue[state.currentRound + 1] : null;
        document.getElementById('countdown-next').innerText = isLast ? 'OYUN BİTTİ!' : `${nextRoundInfo.start} ➔ ${nextRoundInfo.end}`;

        const btn = next.querySelector('button');
        if (btn) {
            if (state.isAdmin) {
                btn.classList.remove('hidden');
                btn.innerHTML = isLast ? '🏁' : '➤';
                btn.title = isLast ? 'Menüye Dön' : 'Sıradaki Turu Başlat';
                btn.onclick = isLast ? () => location.reload() : () => nextRound();
            } else {
                btn.classList.add('hidden');
            }
        }
    }
}

function showScreen(screenKey) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${screenKey}-screen`)?.classList.add('active');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    if (tab === 'join') {
        document.querySelector('.tab-btn:nth-child(1)')?.classList.add('active');
        document.getElementById('join-form')?.classList.add('active');
    } else {
        document.querySelector('.tab-btn:nth-child(2)')?.classList.add('active');
        document.getElementById('create-form')?.classList.add('active');
    }
}

function openAvatarPicker() {
    document.getElementById('avatar-modal')?.classList.remove('hidden');
    document.getElementById('avatar-modal-overlay')?.classList.remove('hidden');
    const list = document.getElementById('avatar-list');
    if (list) {
        list.innerHTML = avatarList.map(url => `
            <img src="${url}" class="avatar-option ${state.selectedAvatar === url ? 'selected' : ''}" onclick="selectAvatar('${url}')">
        `).join('');
    }
}

function closeAvatarPicker() {
    document.getElementById('avatar-modal')?.classList.add('hidden');
    document.getElementById('avatar-modal-overlay')?.classList.add('hidden');
}

function selectAvatar(url) {
    state.selectedAvatar = url;
    const sharedAvatar = document.getElementById('shared-current-avatar');
    if (sharedAvatar) sharedAvatar.src = url;
    closeAvatarPicker();
}

function openSettingsModal() {
    if (!state.isAdmin) return;
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal-overlay').classList.remove('hidden');
    document.getElementById('modal-round-time').value = state.timeLimit;
    document.getElementById('range-val').innerText = state.timeLimit;
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('settings-modal-overlay').classList.add('hidden');
}

function showConfirmModal(title, text, onConfirm, btnText = 'Evet') {
    const modal = document.getElementById('confirm-modal');
    const overlay = document.getElementById('confirm-modal-overlay');
    const titleEl = document.getElementById('confirm-title');
    const textEl = document.getElementById('confirm-text');
    const yesBtn = document.getElementById('confirm-yes');
    if (modal && overlay && titleEl && textEl && yesBtn) {
        titleEl.innerText = title;
        textEl.innerText = text;
        yesBtn.innerText = btnText;
        yesBtn.onclick = () => { onConfirm(); closeConfirmModal(); };
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }
}

function closeConfirmModal() {
    document.getElementById('confirm-modal')?.classList.add('hidden');
    document.getElementById('confirm-modal-overlay')?.classList.add('hidden');
}

function surrender() {
    document.getElementById('surrender-modal')?.classList.remove('hidden');
    document.getElementById('surrender-modal-overlay')?.classList.remove('hidden');
}

function closeSurrenderModal() {
    document.getElementById('surrender-modal')?.classList.add('hidden');
    document.getElementById('surrender-modal-overlay')?.classList.add('hidden');
}

function openQueueModal() {
    const modal = document.getElementById('queue-modal');
    const overlay = document.getElementById('queue-modal-overlay');
    const ul = document.getElementById('modal-queue-ul');
    if (!modal || !ul || !state.queue) return;

    ul.innerHTML = '';
    const futureRounds = state.queue.slice(state.currentRound + 1);

    if (futureRounds.length === 0) {
        ul.innerHTML = '<li class="no-rounds">Gelecek tur bulunmuyor!</li>';
    } else {
        futureRounds.forEach((round, index) => {
            const li = document.createElement('li');
            li.className = 'modal-queue-item';
            li.innerHTML = `
                <div class="round-num">Tur ${state.currentRound + index + 2}</div>
                <div class="round-route">
                    <span class="route-node start">${round.start}</span>
                    <span class="route-arrow">➔</span>
                    <span class="route-node end">${round.end}</span>
                </div>
            `;
            ul.appendChild(li);
        });
    }

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closeQueueModal() {
    document.getElementById('queue-modal')?.classList.add('hidden');
    document.getElementById('queue-modal-overlay')?.classList.add('hidden');
}

function showPathModal(playerName, pathArray, roundPoints, clicks) {
    const modal = document.getElementById('path-modal');
    const overlay = document.getElementById('path-modal-overlay');
    const title = document.getElementById('path-modal-title');
    const list = document.getElementById('path-steps-list');
    const stats = document.getElementById('path-stats-info');

    if (!modal || !list || !pathArray) return;

    title.innerText = `${playerName} - Gidiş Yolu`;
    stats.innerText = `Puan: ${roundPoints} | Tıklama: ${clicks}`;
    list.innerHTML = '';

    if (pathArray.length === 0) {
        list.innerHTML = '<p class="no-path">Bu turda henüz bir ilerleme kaydedilmemiş.</p>';
    } else {
        pathArray.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'path-step-card';
            stepDiv.innerHTML = `
                <div class="step-num">${index + 1}</div>
                <div class="step-title">${step}</div>
            `;
            list.appendChild(stepDiv);
        });
    }

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closePathModal() {
    document.getElementById('path-modal')?.classList.add('hidden');
    document.getElementById('path-modal-overlay')?.classList.add('hidden');
}

function showPlayerMenu(targetId, event) {
    if (targetId === socket.id) return;
    const oldMenu = document.getElementById('player-action-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'player-action-menu';
    menu.className = 'glass player-context-menu';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    const isMuted = state.mutedUsers.includes(targetId);
    let menuContent = `<button onclick="toggleMute('${targetId}')">${isMuted ? 'Sesi Aç' : 'Sustur'}</button>`;

    if (state.isAdmin) {
        menuContent += `<button class="kick-btn" onclick="kickPlayer('${targetId}')">At (Ban)</button>`;
    }

    menu.innerHTML = menuContent;
    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', function hideMenu(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', hideMenu); }
        }, { once: true });
    }, 10);
}

function toggleMute(targetId) {
    const index = state.mutedUsers.indexOf(targetId);
    if (index > -1) { state.mutedUsers.splice(index, 1); showNotification('Sesi açıldı.', 'info'); }
    else { state.mutedUsers.push(targetId); showNotification('Susturuldu.', 'warning'); }
    document.getElementById('player-action-menu')?.remove();
}

function kickPlayer(targetId) {
    showConfirmModal('Oyuncuyu Yasakla 🛡️', 'Bu oyuncuyu atmak istediğine emin misin? 30 dakika boyunca bu lobiye tekrar giremeyecek.', () => {
        socket.emit('kick-player', { lobbyId: state.lobbyId, targetId });
    }, 'Evet, Yasakla');
    document.getElementById('player-action-menu')?.remove();
}

function toggleCodeVisibility() {
    state.isCodeRevealed = !state.isCodeRevealed;
    const displayId = document.getElementById('display-lobby-id');
    const eyeBtn = document.getElementById('streamer-eye-btn');

    if (displayId) {
        if (state.isCodeRevealed) {
            displayId.innerText = `#${state.lobbyId}`;
            if (eyeBtn) eyeBtn.innerText = '🔒';
        } else {
            displayId.innerText = "••••••";
            if (eyeBtn) eyeBtn.innerText = '👁️';
        }
    }
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input?.value.trim();
    if (message && state.lobbyId) {
        socket.emit('send-chat-message', { lobbyId: state.lobbyId, sender: state.user.name, message });
        input.value = '';
    }
}

function appendMessage(sender, message, isOwn, senderId, avatar) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = `chat-message-wrapper ${isOwn ? 'mine' : 'others'}`;

    div.innerHTML = `
        ${!isOwn ? `<img src="${avatar || avatarList[0]}" class="chat-avatar" onclick="showPlayerMenu('${senderId}', event)">` : ''}
        <div class="chat-bubble">
            ${!isOwn ? `<span class="sender-name" onclick="showPlayerMenu('${senderId}', event)">${sender}</span>` : ''}
            <div class="message-content">
                <p class="message-text">${message}</p>
                <span class="timestamp">${time}</span>
            </div>
        </div>
        ${isOwn ? `<img src="${avatar || avatarList[0]}" class="chat-avatar">` : ''}
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(message, type = 'default') {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `chat-system-message ${type}`;
    div.innerText = message;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
