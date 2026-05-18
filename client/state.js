const avatarList = [
    '/assets/avatars/avatar_1.png', '/assets/avatars/avatar_2.png', '/assets/avatars/avatar_3.png',
    '/assets/avatars/avatar_4.png', '/assets/avatars/avatar_5.png', '/assets/avatars/avatar_6.png',
    '/assets/avatars/avatar_7.png', '/assets/avatars/avatar_8.png', '/assets/avatars/avatar_9.png',
    '/assets/avatars/avatar_10.png', '/assets/avatars/avatar_11.png', '/assets/avatars/avatar_12.png',
    '/assets/avatars/avatar_13.png', '/assets/avatars/avatar_14.png', '/assets/avatars/avatar_15.png'
];

let state = {
    user: null,
    lobbyId: null,
    players: [],
    queue: [],
    currentRound: 0,
    gameActive: false,
    clickCount: 0,
    timer: 150,
    timerInterval: null,
    validatedStart: null,
    validatedStartThumb: null,
    validatedEnd: null,
    validatedEndThumb: null,
    lastActionTime: 0,
    selectedAvatar: avatarList[Math.floor(Math.random() * avatarList.length)],
    currentPickerRole: 'shared',
    mutedUsers: [], // Local mute list
    streamerMode: false,
    isCodeRevealed: false,
    playerFinished: false,
    isAdmin: false,
    timeLimit: 150,
    sortable: null
};
