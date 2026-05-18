function startConfetti() {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min, max) { return Math.random() * (max - min) + min; }

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function showNotification(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '🔔'}</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function copyLobbyId() {
    if (state.lobbyId) {
        navigator.clipboard.writeText(state.lobbyId);
        showNotification('Davet kodu kopyalandı!', 'info');
    }
}

function updateTimeDisplay(val) {
    const el = document.getElementById('range-val');
    if (el) el.innerText = val;
}

function setQuickTime(val) {
    const slider = document.getElementById('modal-round-time');
    if (slider) {
        slider.value = val;
        updateTimeDisplay(val);
    }
}

async function fetchSuggestions(query, targetId) {
    if (query.length < 2) return;
    const res = await fetch(`https://tr.wikipedia.org/w/api.php?action=query&format=json&generator=prefixsearch&gpssearch=${encodeURIComponent(query)}&gpslimit=8&prop=pageimages&piprop=thumbnail&pithumbsize=50&origin=*`);
    const data = await res.json();
    const list = document.getElementById(targetId);
    if (list && data.query?.pages) {
        list.innerHTML = Object.values(data.query.pages)
            .sort((a, b) => a.index - b.index)
            .map(p => `
            <div class="suggestion-item" onclick="selectSuggestion('${p.title.replace(/'/g, "\\'")}', '${targetId.replace('-suggestions', '-node')}', '${targetId}', ${p.thumbnail ? `'${p.thumbnail.source}'` : 'null'})">
                ${p.thumbnail ? `<img src="${p.thumbnail.source}" class="sugg-thumb">` : '<div class="sugg-thumb-empty"></div>'}
                <span>${p.title}</span>
            </div>
        `).join('');
        list.classList.remove('hidden');
    }
}

function selectSuggestion(val, inputId, listId, thumb) {
    const input = document.getElementById(inputId);
    if (input) input.value = val;
    document.getElementById(listId)?.classList.add('hidden');

    if (inputId === 'start-node') {
        state.validatedStart = val;
        state.validatedStartThumb = thumb;
    } else {
        state.validatedEnd = val;
        state.validatedEndThumb = thumb;
    }
}
