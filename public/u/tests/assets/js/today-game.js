// today-game.js - 사교 클럽 운영하기 (Running a Social Club)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        harmony: 50, // 조화
        popularity: 50, // 인기
        tradition: 50, // 전통
        hospitality: 50, // 환대
        reputation: 50, // 평판
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { refreshments: 10, decorations: 10, club_funds: 5, community_trophy: 0 },
        members: [
            { id: "bella", name: "벨라", personality: "친절한", skill: "이벤트 기획", friendship: 70 },
            { id: "oliver", name: "올리버", personality: "사교적인", skill: "분위기 조성", friendship: 60 }
        ],
        maxMembers: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { collectionSuccess: 0 },
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        clubRooms: {
            pantry: { built: false, durability: 100, name: "식료품실", description: "맛있는 다과를 준비하는 공간입니다.", effect_description: "다과 준비 성공률 및 환대 스탯 보너스." },
            hobbyRoom: { built: false, durability: 100, name: "취미실", description: "회원들이 함께 취미를 즐깁니다.", effect_description: "회원들의 친밀도와 클럽의 인기 증가." },
            mainLounge: { built: false, durability: 100, name: "메인 라운지", description: "클럽의 중심이 되는 사교 공간입니다.", effect_description: "신규 회원 영입 및 사교 이벤트 활성화." },
            archiveRoom: { built: false, durability: 100, name: "기록실", description: "클럽의 역사와 전통을 기록합니다.", effect_description: "역사 검토를 통한 스탯 및 자원 획득 기회 제공." },
            partyHall: { built: false, durability: 100, name: "파티룸", description: "성대한 파티를 열 수 있는 공간입니다.", effect_description: "대규모 이벤트를 통한 평판 및 인기 획득." }
        },
        clubLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('esfjClubGame', JSON.stringify(gameState));
}

// ... (The rest of the code will be a combination of the old ESFJ script and the new ENFJ features, adapted for the ESFJ theme)
// This is a placeholder for the full script that will be generated.
