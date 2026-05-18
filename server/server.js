const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '..')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Lobby storage
const lobbies = {};

// Global Stats
const APP_VERSION = 'v0.1.0 (Early Access)';

function broadcastStats() {
    const onlineCount = io.engine.clientsCount;
    const lobbyCount = Object.keys(lobbies).length;
    io.emit('server-stats', {
        version: APP_VERSION,
        onlineCount,
        lobbyCount
    });
}

// Ban storage: { lobbyId: { ip: banUntilTimestamp } }
const bannedUsers = {};

io.on('connection', (socket) => {
    const userIp = socket.handshake.address;
    console.log('User connected:', socket.id, '| IP:', userIp);
    broadcastStats();

    socket.on('create-lobby', ({ name, lobbyId, avatar, streamerMode }) => {
        socket.join(lobbyId);
        lobbies[lobbyId] = {
            id: lobbyId,
            adminId: socket.id, // Yetki mührü
            streamerMode: !!streamerMode, // Lobi bazlı streamer modu
            players: [{ id: socket.id, name, points: 0, isAdmin: true, currentClicks: 0, finished: false, avatar, ip: userIp, lastRemainingTime: 0, isWin: false, wasFailed: false }],
            queue: [],
            timeLimit: 150, // Varsayılan süre
            gameStarted: false,
            currentRound: 0,
            roundResults: [],
            suggestionsCount: 0
        };
        io.to(lobbyId).emit('players-update', lobbies[lobbyId].players);
        socket.emit('join-success', {
            lobbyId,
            streamerMode: lobbies[lobbyId].streamerMode,
            timeLimit: lobbies[lobbyId].timeLimit
        }); // Confirm success to creator
        console.log(`Lobby ${lobbyId} created by ${name}`);
        broadcastStats();
    });

    socket.on('join-lobby', ({ name, lobbyId, avatar }) => {
        console.log(`Join request from ${name} for lobby ${lobbyId}`);
        if (!lobbies[lobbyId]) {
            return socket.emit('error', 'Lobi bulunamadı!');
        }

        if (lobbies[lobbyId].gameStarted) {
            return socket.emit('error', 'Oyun çoktan başladı, bu lobiye şu an katılamazsınız!');
        }

        // Ban Check
        if (bannedUsers[lobbyId] && bannedUsers[lobbyId][userIp]) {
            const banUntil = bannedUsers[lobbyId][userIp];
            if (Date.now() < banUntil) {
                const remaining = Math.ceil((banUntil - Date.now()) / 1000 / 60);
                return socket.emit('error', `Bu lobiden atıldınız. Kalan ban süresi: ${remaining} dakika.`);
            } else {
                delete bannedUsers[lobbyId][userIp]; // Ban expired
            }
        }

        socket.join(lobbyId);
        lobbies[lobbyId].players.push({
            id: socket.id,
            name,
            points: 0,
            isAdmin: false,
            currentClicks: 0,
            finished: false,
            avatar,
            ip: userIp,
            lastRemainingTime: 0,
            isWin: false,
            wasFailed: false
        });

        console.log(`User ${name} (${socket.id}) joined ${lobbyId}. Total: ${lobbies[lobbyId].players.length}`);

        socket.emit('join-success', {
            lobbyId,
            streamerMode: lobbies[lobbyId].streamerMode,
            timeLimit: lobbies[lobbyId].timeLimit // Güncel süreyi de gönder
        });
        io.to(lobbyId).emit('players-update', lobbies[lobbyId].players);
        socket.emit('queue-update', lobbies[lobbyId].queue);

        // Eğer oyun başladıysa yeni katılanı oyuna sok
        if (lobbies[lobbyId].gameStarted) {
            socket.emit('game-started', lobbies[lobbyId].currentRound);
        }
        io.to(lobbyId).emit('system-message', { message: `${name} lobiye katıldı.`, type: 'positive' });
    });

    socket.on('update-lobby-settings', ({ lobbyId, settings }) => {
        if (lobbies[lobbyId] && lobbies[lobbyId].adminId === socket.id) {
            if (settings.timeLimit) lobbies[lobbyId].timeLimit = parseInt(settings.timeLimit);
            io.to(lobbyId).emit('lobby-settings-update', lobbies[lobbyId]);
            console.log(`Lobby ${lobbyId} settings updated:`, settings);
        }
    });

    socket.on('update-queue', ({ lobbyId, queue }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].queue = queue;
            io.to(lobbyId).emit('queue-update', queue);
        }
    });

    socket.on('suggest-question', ({ lobbyId, suggestion }) => {
        if (lobbies[lobbyId]) {
            if (lobbies[lobbyId].suggestionsCount === undefined) {
                lobbies[lobbyId].suggestionsCount = 0;
            }

            if (lobbies[lobbyId].suggestionsCount >= 5) {
                return socket.emit('error', 'Hosta çok fazla istek birikti! Lütfen biraz bekleyin.');
            }

            const admin = lobbies[lobbyId].players.find(p => p.isAdmin);
            if (admin) {
                lobbies[lobbyId].suggestionsCount++;
                io.to(admin.id).emit('new-suggestion', suggestion);
                socket.emit('suggestion-sent');
            }
        }
    });

    socket.on('resolve-suggestion', ({ lobbyId }) => {
        if (lobbies[lobbyId] && lobbies[lobbyId].suggestionsCount > 0) {
            lobbies[lobbyId].suggestionsCount--;
        }
    });

    socket.on('start-game', ({ lobbyId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].gameStarted = true;
            lobbies[lobbyId].currentRound = 0;
            lobbies[lobbyId].players.forEach(p => {
                p.currentClicks = 0;
                p.finished = false;
            });
            io.to(lobbyId).emit('game-started', 0);
        }
    });

    socket.on('update-clicks', ({ lobbyId, userId, clicks }) => {
        const lobby = lobbies[lobbyId];
        if (lobby) {
            const player = lobby.players.find(p => p.id === socket.id);
            if (player) {
                player.currentClicks = clicks;
                const liveRanks = lobby.players.map(p => ({
                    name: p.name,
                    clicks: p.currentClicks,
                    avatar: p.avatar,
                    isConnected: p.isConnected !== false,
                    finished: p.finished || false,
                    isWin: p.isWin || false
                }));
                io.to(lobbyId).emit('live-update', liveRanks);
            }
        }
    });

    socket.on('round-finished', ({ lobbyId, userId, clicks, isWin, remainingTime, path }) => {
        const lobby = lobbies[lobbyId];
        if (lobby) {
            const player = lobby.players.find(p => p.id === socket.id);
            if (player) {
                player.finished = true;
                player.isWin = isWin;
                player.lastClicks = isWin ? clicks : 9999;
                player.lastRemainingTime = remainingTime || 0;
                player.lastPath = path || [];
                // Hemen bir live-update fırlat ki border'lar anında güncellensin
                const liveRanks = lobby.players.map(p => ({
                    name: p.name,
                    clicks: p.currentClicks,
                    avatar: p.avatar,
                    isConnected: p.isConnected !== false,
                    finished: p.finished || false,
                    isWin: p.isWin || false
                }));
                io.to(lobbyId).emit('live-update', liveRanks);

                // Check if all finished
                const allFinished = lobby.players.every(p => p.finished || p.isConnected === false);
                if (allFinished) {
                    processResults(lobbyId);
                }
            }
        }
    });

    socket.on('start-next-round', ({ lobbyId, roundIndex }) => {
        const lobby = lobbies[lobbyId];
        if (lobby) {
            lobby.currentRound = roundIndex;
            lobby.players.forEach(p => {
                p.currentClicks = 0;
                p.finished = false;
                p.wasFailed = !p.isWin; // Bir sonraki tur için hatırla
                p.isWin = false; // Yeni tur, yeni heyecan!
                p.lastClicks = 0;
            });
            io.to(lobbyId).emit('game-started', roundIndex);
        }
    });

    socket.on('send-chat-message', ({ lobbyId, sender, message }) => {
        const lobby = lobbies[lobbyId];
        let avatar = null;
        if (lobby) {
            const p = lobby.players.find(plr => plr.id === socket.id);
            if (p) avatar = p.avatar;
        }
        io.in(lobbyId).emit('chat-message', { sender, message, senderId: socket.id, avatar });
    });

    socket.on('kick-player', ({ lobbyId, targetId }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;

        const host = lobby.players.find(p => p.id === socket.id);
        if (!host || !host.isAdmin) return socket.emit('error', 'Bu işlem için yetkiniz yok!');

        const targetPlayerIndex = lobby.players.findIndex(p => p.id === targetId);
        if (targetPlayerIndex === -1) return;

        const targetPlayer = lobby.players[targetPlayerIndex];

        // Add to ban list (30 mins)
        if (!bannedUsers[lobbyId]) bannedUsers[lobbyId] = {};
        bannedUsers[lobbyId][targetPlayer.ip] = Date.now() + (30 * 60 * 1000);

        // Notify target and disconnect them
        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
            targetSocket.emit('kicked', 'Host tarafından lobiden atıldınız.');
            targetSocket.leave(lobbyId);
        }

        // Remove from lobby storage
        lobby.players.splice(targetPlayerIndex, 1);
        io.to(lobbyId).emit('players-update', lobby.players);
        io.to(lobbyId).emit('system-message', { message: `${targetPlayer.name} lobiden atıldı.`, type: 'negative' });
        broadcastStats();
    });

    socket.on('suggest-queue-item', ({ lobbyId, suggestion }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;

        // Count existing suggestions (stored in host's UI, so server can't easily count without state)
        // But we can store them in the lobby object on the server for tracking
        if (!lobby.suggestions) lobby.suggestions = [];

        if (lobby.suggestions.length >= 5) {
            return socket.emit('notification', { message: 'Öneri sırası dolu! (Max 5)', type: 'warning' });
        }

        const host = lobby.players.find(p => p.isAdmin);
        if (host) {
            lobby.suggestions.push(suggestion);
            io.to(host.id).emit('new-suggestion', { ...suggestion, suggestionIndex: lobby.suggestions.length - 1 });
        }
    });

    socket.on('approve-suggestion', ({ lobbyId, index }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby || !lobby.suggestions[index]) return;
        lobby.queue.push(lobby.suggestions[index]);
        lobby.suggestions.splice(index, 1);
        io.to(lobbyId).emit('queue-update', lobby.queue);
    });

    socket.on('reject-suggestion', ({ lobbyId, index }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;
        lobby.suggestions.splice(index, 1);
    });

    socket.on('leave-lobby', ({ lobbyId }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;
        const player = lobby.players.find(p => p.id === socket.id);
        if (player) {
            io.to(lobbyId).emit('system-message', {
                message: `${player.name} lobiden ayrıldı, görüşmek üzere!`,
                type: 'default'
            });
        }
        if (lobby.gameStarted) {
            if (player) player.isConnected = false;
            // Check if this allows round to finish
            const allFinished = lobby.players.every(p => p.finished || p.isConnected === false);
            if (allFinished) processResults(lobbyId);
        } else {
            lobby.players = lobby.players.filter(p => p.id !== socket.id);
        }

        socket.leave(lobbyId);

        if (lobby.players.every(p => p.isConnected === false || p.id === 'deleted' || !p.id)) {
            delete lobbies[lobbyId];
        } else {
            io.to(lobbyId).emit('players-update', lobby.players);
        }
        broadcastStats();
    });

    socket.on('disconnect', () => {
        // Handle player leaving
        for (const lobbyId in lobbies) {
            const lobby = lobbies[lobbyId];
            const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const player = lobby.players[playerIndex];
                const msg = lobby.gameStarted ? `${player.name} oyundan ayrıldı.` : `${player.name} lobiden ayrıldı.`;
                io.to(lobbyId).emit('system-message', { message: msg, type: lobby.gameStarted ? 'negative' : 'default' });
                io.to(lobbyId).emit('notification', { message: msg, type: 'warning' });

                if (lobby.gameStarted) {
                    player.isConnected = false;
                } else {
                    lobby.players.splice(playerIndex, 1);
                }

                io.to(lobbyId).emit('players-update', lobby.players);

                // Check if this disconnection allows the round to finish
                if (lobby.gameStarted) {
                    const allFinished = lobby.players.every(p => p.finished || p.isConnected === false);
                    if (allFinished) processResults(lobbyId);
                }

                if (lobby.players.every(p => p.isConnected === false || p.id === 'deleted')) {
                    delete lobbies[lobbyId];
                    broadcastStats();
                }
                break;
            }
        }
        broadcastStats();
    });
});


function processResults(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    const sorted = [...lobby.players].sort((a, b) => {
        if (a.isWin && !b.isWin) return -1;
        if (!a.isWin && b.isWin) return 1;
        if (a.isWin && b.isWin) {
            if (b.lastRemainingTime !== a.lastRemainingTime) return b.lastRemainingTime - a.lastRemainingTime;
            return a.lastClicks - b.lastClicks;
        }
        return b.lastClicks - a.lastClicks;
    });

    const winners = sorted.filter(p => p.isWin);

    sorted.forEach((player) => {
        let points = 0;
        if (player.isWin) {
            const timeLimit = lobby.timeLimit || 150;
            points += 100;

            const timeRatio = player.lastRemainingTime / timeLimit;
            points += Math.floor(timeRatio * 300);

            const efficiencyBonus = Math.max(0, 100 - (player.lastClicks * 5));
            points += efficiencyBonus;

            const winRank = winners.findIndex(p => p.id === player.id);
            if (winRank === 0) points += 100;
            else if (winRank === 1) points += 50;
            else if (winRank === 2) points += 25;

            if (player.wasFailed && winRank === 0) points += 100;
        } else {
            points = player.lastClicks > 0 ? -25 : 0;
        }

        const originalPlayer = lobby.players.find(p => p.id === player.id);
        originalPlayer.points += Math.floor(points);
        if (originalPlayer.points < 0) originalPlayer.points = 0;

        player.totalPoints = originalPlayer.points;
        player.roundPoints = Math.floor(points);
    });

    const finalResults = sorted.sort((a, b) => b.totalPoints - a.totalPoints);


    io.to(lobbyId).emit('round-results', finalResults.map(p => ({
        id: p.id,
        name: p.name,
        clicks: p.lastClicks,
        totalPoints: p.totalPoints,
        roundPoints: p.roundPoints,
        avatar: p.avatar,
        path: p.lastPath || []
    })));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
