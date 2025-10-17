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
        popularity: 50,  // 인기
        tradition: 50,  // 전통
        affability: 50,     // 친화력
        organization: 50,    // 조직력
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { snacks: 10, decorations: 10, activity_funds: 5, trophies: 0 },
        members: [
            { id: "sophia", name: "소피아", personality: "친절한", skill: "이벤트 기획", camaraderie: 70 },
            { id: "marco", name: "마르코", personality: "매력적인", skill: "분위기 조성", camaraderie: 60 }
        ],
        maxMembers: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { eventSuccess: 0 },
        dailyActions: { browsed: false, meetingHeld: false, chattedWith: [], minigamePlayed: false },
        clubFacilities: {
            pantry: { built: false, durability: 100, name: "식료품실", description: "다과를 보관하고 준비합니다.", effect_description: "다과 자원 보너스 및 회원 만족도 증가." },
            hobbyRoom: { built: false, durability: 100, name: "취미실", description: "회원들이 취미 활동을 즐기는 공간입니다.", effect_description: "친화력 향상 및 장식 생성." },
            mainLounge: { built: false, durability: 100, name: "메인 라운지", description: "회원들이 모여 교류하는 클럽의 중심 공간입니다.", effect_description: "신규 회원 영입 및 인기 상승." },
            archiveRoom: { built: false, durability: 100, name: "기록실", description: "클럽의 역사와 전통을 기록하고 보관합니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            partyRoom: { built: false, durability: 100, name: "파티룸", description: "다양한 이벤트를 개최하고 회원들이 즐기는 공간입니다.", effect_description: "고급 이벤트 및 공동체 트로피 활용 잠금 해제." }
        },
        clubLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('esfjClubGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('esfjClubGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { eventSuccess: 0 };
        if (!loaded.members || loaded.members.length === 0) {
            loaded.members = [
                { id: "sophia", name: "소피아", personality: "친절한", skill: "이벤트 기획", camaraderie: 70 },
                { id: "marco", name: "마르코", personality: "매력적인", skill: "분위기 조성", camaraderie: 60 }
            ];
        }
        if (!loaded.affability) loaded.affability = 50;
        if (!loaded.organization) loaded.organization = 50;

        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const memberListHtml = gameState.members.map(m => `<li>${m.name} (${m.skill}) - 친목: ${m.camaraderie}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>클럽 운영:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>조화:</b> ${gameState.harmony} | <b>인기:</b> ${gameState.popularity} | <b>전통:</b> ${gameState.tradition} | <b>친화력:</b> ${gameState.affability} | <b>조직력:</b> ${gameState.organization}</p>
        <p><b>자원:</b> 다과 ${gameState.resources.snacks}, 장식 ${gameState.resources.decorations}, 활동비 ${gameState.resources.activity_funds}, 트로피 ${gameState.resources.trophies || 0}</p>
        <p><b>클럽 레벨:</b> ${gameState.clubLevel}</p>
        <p><b>회원 (${gameState.members.length}/${gameState.maxMembers}):</b></p>
        <ul>${memberListHtml}</ul>
        <p><b>클럽 시설:</b></p>
        <ul>${Object.values(gameState.clubFacilities).filter(f => f.built).map(f => `<li>${f.name} (내구성: ${f.durability}) - ${f.effect_description}</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.clubFacilities.pantry.built) dynamicChoices.push({ text: "식료품실 설치 (다과 50, 장식 20)", action: "build_pantry" });
        if (!gameState.clubFacilities.hobbyRoom.built) dynamicChoices.push({ text: "취미실 설치 (장식 30, 활동비 30)", action: "build_hobbyRoom" });
        if (!gameState.clubFacilities.mainLounge.built) dynamicChoices.push({ text: "메인 라운지 확장 (다과 100, 장식 50, 활동비 50)", action: "build_mainLounge" });
        if (!gameState.clubFacilities.archiveRoom.built) dynamicChoices.push({ text: "기록실 설치 (장식 80, 활동비 40)", action: "build_archiveRoom" });
        if (gameState.clubFacilities.hobbyRoom.built && gameState.clubFacilities.hobbyRoom.durability > 0 && !gameState.clubFacilities.partyRoom.built) {
            dynamicChoices.push({ text: "파티룸 증축 (장식 50, 활동비 100)", action: "build_partyRoom" });
        }
        Object.keys(gameState.clubFacilities).forEach(key => {
            const facility = gameState.clubFacilities[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${facility.name} 보수 (장식 10, 활동비 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data (to be themed for ESFJ) ---
const gameScenarios = {
    "intro": { text: "오늘은 클럽을 위해 무엇을 할까요?", choices: [
        { text: "클럽 둘러보기", action: "browse_club" },
        { text: "회원과 대화하기", action: "chat_with_members" },
        { text: "정기 모임 개최", action: "hold_regular_meeting" },
        { text: "자원 수집", action: "show_resource_gathering_options" },
        { text: "클럽 시설 관리", action: "show_facility_options" },
        { text: "친목 다지기", action: "show_camaraderie_options" },
        { text: "오늘의 활동", action: "play_minigame" }
    ]},
    // ... more ESFJ-themed scenarios
};

// ... (Full game logic will be implemented here)

// --- Initialization ---
window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', () => {
            if (gameState.manualDayAdvances >= 5) {
                updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요.");
                return;
            }
            updateState({
                manualDayAdvances: gameState.manualDayAdvances + 1,
                day: gameState.day + 1,
                lastPlayedDate: new Date().toISOString().slice(0, 10),
                dailyEventTriggered: false
            });
            processDailyEvents();
        });
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
