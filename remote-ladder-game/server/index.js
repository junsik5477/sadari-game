const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// 루트 경로에서 index.html 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 인메모리 스토어 (Redis 대신 사용)
const memoryStore = new Map();

const redis = {
  setex: async (key, seconds, value) => {
    memoryStore.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return 'OK';
  },
  get: async (key) => {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },
  del: async (key) => {
    memoryStore.delete(key);
    return 1;
  },
  keys: async (pattern) => {
    return Array.from(memoryStore.keys()).filter(k => k.includes(pattern.replace('*', '')));
  }
};

const ROOM_EXPIRY_SECONDS = 600; // 10 minutes

// 방 생성 API
app.post('/api/create-room', async (req, res) => {
  const roomId = uuidv4();
  const roomData = {
    id: roomId,
    participants: [],
    destinations: [],
    ladder: null,
    status: 'waiting', // waiting, playing, finished
    createdAt: Date.now(),
    hostId: null
  };
  
  await redis.setex(`room:${roomId}`, ROOM_EXPIRY_SECONDS, JSON.stringify(roomData));
  
  res.json({ roomId });
});

// 방 정보 조회 API
app.get('/api/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const roomData = await redis.get(`room:${roomId}`);
  
  if (!roomData) {
    return res.status(404).json({ error: 'Room not found or expired' });
  }
  
  res.json(JSON.parse(roomData));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 방 참가
  socket.on('join-room', async ({ roomId, playerName }) => {
    const roomKey = `room:${roomId}`;
    const roomDataStr = await redis.get(roomKey);
    
    if (!roomDataStr) {
      socket.emit('error', 'Room not found or expired');
      return;
    }

    const room = JSON.parse(roomDataStr);
    
    // 참여자 추가
    const participant = { id: socket.id, name: playerName };
    room.participants.push(participant);
    
    // 첫 참여자가 호스트가 됨
    if (!room.hostId) {
      room.hostId = socket.id;
    }

    await redis.setex(roomKey, ROOM_EXPIRY_SECONDS, JSON.stringify(room));
    socket.join(roomId);
    
    // 호스트에게 알림
    if (room.hostId === socket.id) {
      socket.emit('you-are-host', { roomId });
    }
    
    // 모든 참여자에게 업데이트된 방 정보 전송
    io.to(roomId).emit('room-updated', room);
  });

  // 목적지 (벌칙/선물) 추가
  socket.on('add-destination', async ({ roomId, destination }) => {
    const roomKey = `room:${roomId}`;
    const roomDataStr = await redis.get(roomKey);
    
    if (!roomDataStr) return;

    const room = JSON.parse(roomDataStr);
    
    // 호스트만 추가 가능
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only host can add destinations');
      return;
    }

    room.destinations.push(destination);
    await redis.setex(roomKey, ROOM_EXPIRY_SECONDS, JSON.stringify(room));
    io.to(roomId).emit('room-updated', room);
  });

  // 사다리 게임 시작
  socket.on('start-game', async ({ roomId }) => {
    const roomKey = `room:${roomId}`;
    const roomDataStr = await redis.get(roomKey);
    
    if (!roomDataStr) return;

    const room = JSON.parse(roomDataStr);
    
    // 호스트만 시작 가능
    if (room.hostId !== socket.id) {
      socket.emit('error', 'Only host can start the game');
      return;
    }

    if (room.participants.length < 2) {
      socket.emit('error', 'Need at least 2 participants');
      return;
    }

    if (room.destinations.length !== room.participants.length) {
      socket.emit('error', 'Number of destinations must match number of participants');
      return;
    }

    // 사다리 생성
    const ladder = generateLadder(room.participants.length, room.destinations.length);
    room.ladder = ladder;
    room.status = 'playing';
    
    await redis.setex(roomKey, ROOM_EXPIRY_SECONDS, JSON.stringify(room));
    io.to(roomId).emit('game-started', { ladder, participants: room.participants, destinations: room.destinations });
  });

  // 게임 결과 확인
  socket.on('get-results', async ({ roomId }) => {
    const roomKey = `room:${roomId}`;
    const roomDataStr = await redis.get(roomKey);
    
    if (!roomDataStr) return;

    const room = JSON.parse(roomDataStr);
    
    if (room.status !== 'playing') {
      socket.emit('error', 'Game is not in progress');
      return;
    }

    // 사다리 결과 계산
    const results = calculateLadderResults(room.ladder, room.participants.length);
    const matchedResults = results.map((destIndex, participantIndex) => ({
      participant: room.participants[participantIndex],
      destination: room.destinations[destIndex]
    }));

    room.status = 'finished';
    room.results = matchedResults;
    
    await redis.setex(roomKey, ROOM_EXPIRY_SECONDS, JSON.stringify(room));
    io.to(roomId).emit('game-finished', { results: matchedResults });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // TODO: Handle participant leaving
  });
});

// 사다리 생성 알고리즘
function generateLadder(numParticipants, numDestinations) {
  const lines = [];
  const numLines = Math.max(5, Math.floor(Math.random() * 5) + 5); // 5-10 lines
  
  for (let i = 0; i < numLines; i++) {
    const line = [];
    for (let j = 0; j < numParticipants - 1; j++) {
      // 30% 확률로 사다리 추가, 연속되지 않도록
      if (Math.random() < 0.3 && (j === 0 || line[j-1] === 0)) {
        line.push(1);
      } else {
        line.push(0);
      }
    }
    lines.push(line);
  }
  
  return lines;
}

// 사다리 결과 계산
function calculateLadderResults(ladder, numParticipants) {
  const positions = Array.from({ length: numParticipants }, (_, i) => i);
  
  ladder.forEach(line => {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === 1) {
        // 위치 교환
        [positions[i], positions[i + 1]] = [positions[i + 1], positions[i]];
      }
    }
  });
  
  return positions;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
