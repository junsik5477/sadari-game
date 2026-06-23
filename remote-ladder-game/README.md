# 리모트 사다리 타기 게임

웹 기반으로 친구들과 함께 즐길 수 있는 실시간 사다리 타기 게임입니다.

## 주요 기능

- **실시간 멀티플레이어**: Socket.IO 를 사용하여 여러 사용자가 실시간으로 게임에 참여
- **방 생성 및 공유**: 고유한 방 ID 가 포함된 링크를 생성하여 친구들에게 공유 가능
- **10 분 자동 소멸**: 방 생성 후 10 분이 지나면 자동으로 방이 삭제됨
- **벌칙/선물 등록**: 호스트가 각 참여자에 대한 벌칙이나 선물을 등록 가능
- **시각적 애니메이션**: Canvas 를 사용한 사다리 내려가는 애니메이션 표현
- **반응형 디자인**: PC 와 모바일 모두에서 원활하게 작동

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Canvas API
- **Backend**: Node.js, Express, Socket.IO
- **Storage**: 인메모리 스토어 (개발용), Redis (프로덕션용)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 모드로 실행

```bash
npm run dev
```

### 3. 프로덕션 모드로 실행

```bash
npm start
```

서버는 http://localhost:3001 에서 실행됩니다.

## 사용 방법

### 호스트 (방장)

1. "방 만들기" 버튼을 클릭하여 새로운 방을 생성합니다.
2. 닉네임을 입력합니다.
3. 생성된 링크를 복사하여 친구들에게 공유합니다.
4. 참여자들이 모두 입장하면 "벌칙 또는 선물" 입력창에 각 항목을 추가합니다.
5. 모든 목적지를 추가한 후 "게임 시작" 버튼을 클릭합니다.
6. 사다리 애니메이션이 완료된 후 "결과 보기"를 클릭하여 결과를 확인합니다.

### 참여자

1. 호스트로부터 받은 링크를 클릭하거나, 방 ID 를 입력하여 참가합니다.
2. 닉네임을 입력하고 "참가하기" 버튼을 클릭합니다.
3. 호스트가 게임을 시작할 때까지 대기합니다.
4. 사다리 애니메이션을 감상합니다.
5. 결과가 표시됩니다.

## 프로젝트 구조

```
remote-ladder-game/
├── server/
│   └── index.js          # 서버 메인 파일 (Express + Socket.IO)
├── client/
│   └── public/
│       ├── index.html    # 메인 HTML 파일
│       ├── styles/
│       │   └── main.css  # 스타일시트
│       └── js/
│           └── app.js    # 클라이언트 JavaScript
├── package.json
└── README.md
```

## API 엔드포인트

### POST /api/create-room
새로운 게임 방을 생성합니다.

**응답 예시:**
```json
{
  "roomId": "uuid-string"
}
```

### GET /api/room/:roomId
방 정보를 조회합니다.

**응답 예시:**
```json
{
  "id": "uuid-string",
  "participants": [...],
  "destinations": [...],
  "status": "waiting|playing|finished",
  "hostId": "socket-id"
}
```

## Socket.IO 이벤트

### 클라이언트 → 서버

- `join-room`: 방에 참가
- `add-destination`: 목적지 (벌칙/선물) 추가
- `start-game`: 게임 시작
- `get-results`: 결과 요청

### 서버 → 클라이언트

- `you-are-host`: 호스트 권한 부여
- `room-updated`: 방 정보 업데이트
- `game-started`: 게임 시작 알림
- `game-finished`: 게임 종료 및 결과
- `error`: 에러 메시지

## 사다리 알고리즘

공정한 사다리 생성을 위해 다음 규칙을 따릅니다:

1. 참여자 수에 맞는 세로선을 생성합니다.
2. 각 가로선은 연속되지 않도록 무작위로 배치됩니다.
3. 상단에서 하단으로 내려가며 위치 교환을 시뮬레이션합니다.

## 확장 가능성

- **Redis 연동**: `REDIS_HOST`, `REDIS_PORT` 환경 변수를 설정하면 Redis 를 사용할 수 있습니다.
- **커스터마이징**: 사다리 스타일, 애니메이션 속도 등을 수정할 수 있습니다.
- **추가 기능**: 채팅 기능, 관전 모드, 기록 저장 등을 추가할 수 있습니다.

## 라이선스

MIT
