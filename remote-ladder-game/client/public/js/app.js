// 전역 변수
let socket = null;
let currentRoomId = null;
let isHost = false;
let playerName = '';
let ladderData = null;
let participants = [];
let destinations = [];

// DOM 요소
const screens = {
    initial: document.getElementById('initial-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const buttons = {
    createRoom: document.getElementById('create-room-btn'),
    joinRoom: document.getElementById('join-room-btn'),
    copyLink: document.getElementById('copy-link-btn'),
    addDestination: document.getElementById('add-destination-btn'),
    startGame: document.getElementById('start-game-btn'),
    showResult: document.getElementById('show-result-btn'),
    newGame: document.getElementById('new-game-btn')
};

const inputs = {
    roomId: document.getElementById('room-id-input'),
    playerName: document.getElementById('player-name-input'),
    destination: document.getElementById('destination-input')
};

const lists = {
    participants: document.getElementById('participants-list'),
    destinations: document.getElementById('destinations-list'),
    results: document.getElementById('results-list')
};

const displays = {
    roomId: document.getElementById('display-room-id'),
    hostControls: document.getElementById('host-controls'),
    waitingMessage: document.getElementById('waiting-message')
};

// 화면 전환 함수
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Socket.IO 연결
function connectSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('you-are-host', ({ roomId }) => {
        isHost = true;
        displays.hostControls.classList.remove('hidden');
        displays.waitingMessage.classList.add('hidden');
    });

    socket.on('room-updated', (room) => {
        updateParticipantsList(room.participants);
        updateDestinationsList(room.destinations);
        
        if (room.status === 'playing' && !ladderData) {
            // 게임이 시작된 경우
        }
    });

    socket.on('game-started', ({ ladder, participants: roomParticipants, destinations: roomDestinations }) => {
        ladderData = ladder;
        participants = roomParticipants;
        destinations = roomDestinations;
        showScreen('game');
        drawLadder(ladder, roomParticipants, roomDestinations);
    });

    socket.on('game-finished', ({ results }) => {
        showResults(results);
        buttons.showResult.classList.add('hidden');
    });

    socket.on('error', (message) => {
        alert(message);
    });
}

// 방 생성
async function createRoom() {
    playerName = inputs.playerName.value.trim();
    if (!playerName) {
        alert('닉네임을 입력해주세요!');
        return;
    }

    try {
        const response = await fetch('/api/create-room', { method: 'POST' });
        const data = await response.json();
        currentRoomId = data.roomId;
        
        // URL 업데이트 (공유를 위해)
        const newUrl = `${window.location.origin}?room=${currentRoomId}`;
        window.history.pushState({ roomId: currentRoomId }, '', newUrl);
        
        joinRoom(currentRoomId, playerName);
    } catch (error) {
        console.error('Error creating room:', error);
        alert('방 생성에 실패했습니다.');
    }
}

// 방 참가
function joinRoom(roomId, name) {
    currentRoomId = roomId;
    playerName = name || inputs.playerName.value.trim();
    
    if (!playerName) {
        alert('닉네임을 입력해주세요!');
        return;
    }

    socket.emit('join-room', { roomId, playerName });
    showScreen('lobby');
    displays.roomId.textContent = roomId;
}

// 참여자 목록 업데이트
function updateParticipantsList(participants) {
    lists.participants.innerHTML = participants.map(p => `
        <li>
            <span>${p.name}${p.id === socket.id ? ' (나)' : ''}</span>
            ${participants[0]?.id === p.id ? '<span style="color: #667eea; font-size: 0.8rem;">👑 호스트</span>' : ''}
        </li>
    `).join('');
}

// 목적지 목록 업데이트
function updateDestinationsList(destinations) {
    lists.destinations.innerHTML = destinations.map((d, i) => `
        <li>
            <span>${i + 1}. ${d}</span>
        </li>
    `).join('');
}

// 목적지 추가
function addDestination() {
    const destination = inputs.destination.value.trim();
    if (!destination) {
        alert('벌칙 또는 선물을 입력해주세요!');
        return;
    }

    socket.emit('add-destination', { roomId: currentRoomId, destination });
    inputs.destination.value = '';
}

// 게임 시작
function startGame() {
    socket.emit('start-game', { roomId: currentRoomId });
}

// 사다리 그리기
function drawLadder(ladder, participants, destinations) {
    const canvas = document.getElementById('ladder-canvas');
    const ctx = canvas.getContext('2d');
    
    const numParticipants = participants.length;
    const numLines = ladder.length;
    const stepX = 80;
    const stepY = 60;
    const padding = 50;
    
    canvas.width = numParticipants * stepX + padding * 2;
    canvas.height = (numLines + 2) * stepY + padding * 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.font = '14px Noto Sans KR';
    ctx.textAlign = 'center';
    
    // 참여자 이름 표시 (상단)
    participants.forEach((p, i) => {
        const x = padding + i * stepX;
        ctx.fillStyle = '#667eea';
        ctx.fillText(p.name, x, padding - 10);
        
        // 세로선 그리기
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + numLines * stepY);
        ctx.stroke();
    });
    
    // 사다리横线 그리기
    ladder.forEach((line, lineIndex) => {
        const y = padding + (lineIndex + 1) * stepY;
        
        line.forEach((hasLine, i) => {
            if (hasLine) {
                const x1 = padding + i * stepX;
                const x2 = padding + (i + 1) * stepX;
                
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
            }
        });
    });
    
    // 목적지 표시 (하단)
    destinations.forEach((d, i) => {
        const x = padding + i * stepX;
        const y = padding + numLines * stepY + 30;
        
        ctx.fillStyle = '#764ba2';
        ctx.fillText(d, x, y);
    });
    
    // 애니메이션으로 사다리 내려가기
    animateLadder(ladder, participants, destinations, canvas, ctx, padding, stepX, stepY);
}

// 사다리 애니메이션
function animateLadder(ladder, participants, destinations, canvas, ctx, padding, stepX, stepY) {
    const numParticipants = participants.length;
    const numLines = ladder.length;
    
    // 각 참여자의 현재 위치
    const positions = Array.from({ length: numParticipants }, (_, i) => ({
        x: padding + i * stepX,
        y: padding,
        targetIndex: i
    }));
    
    let currentLine = 0;
    
    function animate() {
        if (currentLine >= numLines) {
            // 애니메이션 완료
            buttons.showResult.classList.remove('hidden');
            return;
        }
        
        const line = ladder[currentLine];
        
        //横线이 있는 위치 찾기
        for (let i = 0; i < line.length; i++) {
            if (line[i] === 1) {
                // 두 참여자 위치 교환
                const temp = positions[i].targetIndex;
                positions[i].targetIndex = positions[i + 1].targetIndex;
                positions[i + 1].targetIndex = temp;
            }
        }
        
        currentLine++;
        
        // 다음 라인으로 이동
        setTimeout(animate, 800);
    }
    
    animate();
}

// 결과 표시
function showResults(results) {
    lists.results.innerHTML = results.map(r => `
        <div class="result-item">
            <span class="participant">${r.participant.name}</span>
            <span class="destination">${r.destination}</span>
        </div>
    `).join('');
    
    showScreen('result');
}

// 링크 복사
function copyLink() {
    const url = `${window.location.origin}?room=${currentRoomId}`;
    navigator.clipboard.writeText(url).then(() => {
        alert('링크가 복사되었습니다! 친구들에게 공유해보세요.');
    }).catch(err => {
        console.error('Failed to copy:', err);
        prompt('아래 링크를 복사하여 친구들에게 공유하세요:', url);
    });
}

// 이벤트 리스너 등록
buttons.createRoom.addEventListener('click', createRoom);
buttons.joinRoom.addEventListener('click', () => {
    const roomId = inputs.roomId.value.trim();
    if (!roomId) {
        alert('방 ID 를 입력해주세요!');
        return;
    }
    joinRoom(roomId);
});

buttons.copyLink.addEventListener('click', copyLink);
buttons.addDestination.addEventListener('click', addDestination);
buttons.startGame.addEventListener('click', startGame);
buttons.showResult.addEventListener('click', () => {
    socket.emit('get-results', { roomId: currentRoomId });
});
buttons.newGame.addEventListener('click', () => {
    location.reload();
});

// URL 파라미터에서 방 ID 확인
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl) {
        inputs.roomId.value = roomIdFromUrl;
    }
    
    connectSocket();
});

// Enter 키로 입력 처리
inputs.playerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createRoom();
});

inputs.destination.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDestination();
});
