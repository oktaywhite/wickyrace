window.addEventListener('DOMContentLoaded', () => {
    const avatarImg = document.getElementById('shared-current-avatar');
    if (avatarImg) avatarImg.src = state.selectedAvatar;

    const sNode = document.getElementById('start-node');
    const eNode = document.getElementById('end-node');
    if (sNode) {
        sNode.addEventListener('input', e => { 
            state.validatedStart = null; 
            fetchSuggestions(e.target.value, 'start-suggestions'); 
        });
    }
    if (eNode) {
        eNode.addEventListener('input', e => { 
            state.validatedEnd = null; 
            fetchSuggestions(e.target.value, 'end-suggestions'); 
        });
    }

    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (e.keyCode === 70 || e.keyCode === 71 || e.key === 'f' || e.key === 'F' || e.key === 'g' || e.key === 'G')) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            const chatInput = document.getElementById('chat-input');
            if (document.activeElement === chatInput) sendChatMessage();
        }
    }, true);

    window.addEventListener('message', e => { 
        if (e.data.type === 'wiki-nav') handleNavigation(e.data.title); 
    });
});
