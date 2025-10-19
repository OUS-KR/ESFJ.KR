// today-game.js - ESFJ - 사교 클럽 운영하기 (Running a Social Club)

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
        harmony: 50,
        popularity: 50,
        tradition: 50,
        friendliness: 50,
        organization: 50,
        actionPoints: 10, // Represents '행동력'
        maxActionPoints: 10,
        resources: { refreshments: 10, decorations: 10, activity_funds: 5, community_trophies: 0 },
        members: [
            { id: "sunny", name: "써니", personality: "친절한", skill: "이벤트 기획", friendship: 70 },
            { id: "leo", name: "레오", personality: "사교적인", skill: "분위기 조성", friendship: 60 }
        ],
        maxMembers: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { eventSuccess: 0 },
        dailyActions: { lookedAround: false, heldMeeting: false, chattedWith: [], minigamePlayed: false },
        club_facilities: {
            pantry: { built: false, durability: 100, name: "식료품실", description: "회원들을 위한 다과를 준비합니다.", effect_description: "다과 자동 생성 및 친화력 보너스." },
            hobbyRoom: { built: false, durability: 100, name: "취미실", description: "다양한 취미 활동을 즐기는 공간입니다.", effect_description: "장식 생성 및 인기 향상." },
            mainLounge: { built: false, durability: 100, name: "메인 라운지", description: "클럽의 중심 공간으로, 회원들이 교류합니다.", effect_description: "새로운 회원 영입 및 조화 강화." },
            recordRoom: { built: false, durability: 100, name: "기록실", description: "클럽의 역사와 전통을 기록합니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            partyRoom: { built: false, durability: 100, name: "파티룸", description: "성대한 파티와 이벤트를 개최합니다.", effect_description: "공동체 트로피 획득 및 고급 활동 잠금 해제." }
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
        if (!loaded.club_facilities) {
            loaded.club_facilities = {
                pantry: { built: false, durability: 100, name: "식료품실" },
                hobbyRoom: { built: false, durability: 100, name: "취미실" },
                mainLounge: { built: false, durability: 100, name: "메인 라운지" },
                recordRoom: { built: false, durability: 100, name: "기록실" },
                partyRoom: { built: false, durability: 100, name: "파티룸" }
            };
        }
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
    const memberListHtml = gameState.members.map(m => `<li>${m.name} (${m.skill}) - 친밀도: ${m.friendship}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>${gameState.day}일차 운영</b></p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>조화:</b> ${gameState.harmony} | <b>인기:</b> ${gameState.popularity} | <b>전통:</b> ${gameState.tradition} | <b>친화력:</b> ${gameState.friendliness} | <b>조직력:</b> ${gameState.organization}</p>
        <p><b>자원:</b> 다과 ${gameState.resources.refreshments}, 장식 ${gameState.resources.decorations}, 활동비 ${gameState.resources.activity_funds}, 공동체 트로피 ${gameState.resources.community_trophies || 0}</p>
        <p><b>클럽 레벨:</b> ${gameState.clubLevel}</p>
        <p><b>클럽 회원 (${gameState.members.length}/${gameState.maxMembers}):</b></p>
        <ul>${memberListHtml}</ul>
        <p><b>클럽 시설:</b></p>
        <ul>${Object.values(gameState.club_facilities).filter(f => f.built).map(f => `<li>${f.name} (내구성: ${f.durability})</li>`).join('') || '없음'}</ul>
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
        dynamicChoices = [];
        if (!gameState.club_facilities.pantry.built) dynamicChoices.push({ text: "식료품실 마련 (활동비 50, 장식 20)", action: "build_pantry" });
        if (!gameState.club_facilities.hobbyRoom.built) dynamicChoices.push({ text: "취미실 마련 (장식 30, 다과 30)", action: "build_hobbyRoom" });
        if (!gameState.club_facilities.mainLounge.built) dynamicChoices.push({ text: "메인 라운지 확장 (활동비 100, 장식 50)", action: "build_mainLounge" });
        if (!gameState.club_facilities.recordRoom.built) dynamicChoices.push({ text: "기록실 신설 (장식 80, 다과 40)", action: "build_recordRoom" });
        if (gameState.club_facilities.hobbyRoom.built && !gameState.club_facilities.partyRoom.built) {
            dynamicChoices.push({ text: "파티룸 개장 (활동비 150, 공동체 트로피 5)", action: "build_partyRoom" });
        }
        Object.keys(gameState.club_facilities).forEach(key => {
            const facility = gameState.club_facilities[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${facility.name} 보수 (장식 10, 다과 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
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

// --- Game Data (ESFJ Themed) ---
const gameScenarios = {
    "intro": { text: "오늘은 클럽을 위해 무엇을 하시겠습니까?", choices: [
        { text: "클럽 둘러보기", action: "look_around_club" },
        { text: "회원과 대화", action: "chat_with_member" },
        { text: "정기 모임 개최", action: "hold_regular_meeting" },
        { text: "활동 준비", action: "show_resource_gathering_options" },
        { text: "클럽 시설 관리", action: "show_facility_management_options" },
        { text: "친목 다지기", action: "show_socializing_options" },
        { text: "오늘의 활동", action: "play_minigame" }
    ]},
    "action_resource_gathering": {
        text: "어떤 활동을 준비하시겠습니까?",
        choices: [
            { text: "다과 준비", action: "prepare_refreshments" },
            { text: "클럽 장식", action: "decorate_club" },
            { text: "활동비 모금", action: "raise_funds" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "action_facility_management": { text: "어떤 시설을 관리하시겠습니까?", choices: [] },
    "socializing_menu": {
        text: "어떤 친목 활동을 하시겠습니까?",
        choices: [
            { text: "랜덤 다과 준비 (행동력 1 소모)", action: "prepare_random_refreshments" },
            { text: "클럽 역사 탐방 (행동력 1 소모)", action: "explore_club_history" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    // Game Over Scenarios
    "game_over_harmony": { text: "클럽의 조화가 깨졌습니다. 회원들이 하나둘 떠나갑니다.", choices: [], final: true },
    "game_over_popularity": { text: "클럽의 인기가 바닥났습니다. 아무도 찾아오지 않는 유령 클럽이 되었습니다.", choices: [], final: true },
    "game_over_tradition": { text: "전통을 잃은 클럽은 더 이상 존재할 의미를 잃었습니다.", choices: [], final: true },
    "game_over_resources": { text: "클럽을 운영할 자원이 모두 소진되었습니다.", choices: [], final: true },
};

const lookAroundOutcomes = [
    { weight: 30, condition: (gs) => gs.friendliness > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { harmony: gs.harmony + v }, message: `당신의 친화력 덕분에 클럽 분위기가 더욱 화기애애해졌습니다! (+${v} 조화)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { popularity: gs.popularity + v }, message: `클럽을 둘러보며 회원들의 만족도를 높였습니다. (+${v} 인기)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, decorations: gs.resources.decorations - v } }, message: `둘러보던 중 장식 일부가 망가졌습니다. (-${v} 장식)` }; } },
    { weight: 15, condition: (gs) => gs.friendliness < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { organization: gs.organization - v }, message: `친화력이 부족하여 회원들이 당신을 어색해합니다. (-${v} 조직력)` }; } },
];

const chatOutcomes = [
    { weight: 40, condition: (gs, member) => member.friendship < 80, effect: (gs, member) => { const v = getRandomValue(10, 5); const updated = gs.members.map(m => m.id === member.id ? { ...m, friendship: Math.min(100, m.friendship + v) } : m); return { changes: { members: updated }, message: `${member.name}${getWaGwaParticle(member.name)}의 즐거운 대화로 친밀도가 상승했습니다. (+${v} 친밀도)` }; } },
    { weight: 30, condition: () => true, effect: (gs, member) => { const v = getRandomValue(5, 2); return { changes: { popularity: gs.popularity + v }, message: `${member.name}이(가) 당신의 칭찬에 기뻐합니다. (+${v} 인기)` }; } },
    { weight: 20, condition: (gs) => gs.harmony < 40, effect: (gs, member) => { const v = getRandomValue(10, 3); const updated = gs.members.map(m => m.id === member.id ? { ...m, friendship: Math.max(0, m.friendship - v) } : m); return { changes: { members: updated }, message: `클럽의 부조화 때문에 ${member.name}이(가) 불만을 토로합니다. (-${v} 친밀도)` }; } },
];

const meetingOutcomes = [
    { weight: 40, condition: (gs) => gs.organization > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { tradition: gs.tradition + v }, message: `체계적인 회의 진행으로 클럽의 전통이 강화됩니다. (+${v} 전통)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { harmony: gs.harmony + v }, message: `회의를 통해 회원들의 의견을 조율했습니다. (+${v} 조화)` }; } },
    { weight: 20, condition: (gs) => gs.organization < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { popularity: gs.popularity - v }, message: `두서없는 회의 진행으로 클럽의 인기가 떨어집니다. (-${v} 인기)` }; } },
];

const minigames = [
    {
        name: "칭찬 릴레이",
        description: "회원들의 장점을 찾아 릴레이로 칭찬을 이어가세요!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 0, praised: [], members: ["써니", "레오", "클로이"].sort(() => currentRandFn() - 0.5) };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            const nextMember = state.members.find(m => !state.praised.includes(m));
            if (!nextMember) { minigames[0].end(); return; }
            gameArea.innerHTML = `<p><b>${nextMember}</b>에게 어떤 칭찬을 해줄까요?</p>`;
            choicesDiv.innerHTML = ["패션 감각이 뛰어나!", "항상 긍정적이어서 좋아!", "정리를 정말 잘해!"].map(praise => `<button class="choice-btn">${praise}</button>`).join('');
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => button.addEventListener('click', () => minigames[0].processAction('praise_member', nextMember)));
        },
        processAction: (actionType, member) => {
            if (actionType === 'praise_member') {
                const state = gameState.minigameState;
                state.praised.push(member);
                state.score += 50;
                updateGameDisplay(`${member}에게 칭찬을 건넸습니다!`);
                setTimeout(() => minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices')), 1500);
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ friendliness: gameState.friendliness + rewards.friendliness, harmony: gameState.harmony + rewards.harmony, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { friendliness: 0, harmony: 0, message: "" };
    if (score >= 150) { rewards.friendliness = 15; rewards.harmony = 10; rewards.message = "완벽한 칭찬 릴레이였습니다! (+15 친화력, +10 조화)"; } 
    else if (score >= 50) { rewards.friendliness = 10; rewards.harmony = 5; rewards.message = "따뜻한 칭찬이 오갔습니다. (+10 친화력, +5 조화)"; } 
    else { rewards.friendliness = 5; rewards.message = "칭찬 릴레이를 완료했습니다. (+5 친화력)"; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("행동력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    look_around_club: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = lookAroundOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    chat_with_member: () => {
        if (!spendActionPoint()) return;
        const member = gameState.members[Math.floor(currentRandFn() * gameState.members.length)];
        const possibleOutcomes = chatOutcomes.filter(o => !o.condition || o.condition(gameState, member));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, member);
        updateState(result.changes, result.message);
    },
    hold_regular_meeting: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = meetingOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_facility_management_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    show_socializing_options: () => updateState({ currentScenarioId: 'socializing_menu' }),
    prepare_refreshments: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, refreshments: gameState.resources.refreshments + gain } }, `다과를 준비했습니다. (+${gain} 다과)`);
    },
    decorate_club: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, decorations: gameState.resources.decorations + gain } }, `클럽을 장식했습니다. (+${gain} 장식)`);
    },
    raise_funds: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, activity_funds: gameState.resources.activity_funds + gain } }, `활동비를 모금했습니다. (+${gain} 활동비)`);
    },
    build_pantry: () => {
        if (!spendActionPoint()) return;
        const cost = { activity_funds: 50, decorations: 20 };
        if (gameState.resources.activity_funds >= cost.activity_funds && gameState.resources.decorations >= cost.decorations) {
            gameState.club_facilities.pantry.built = true;
            const v = getRandomValue(10, 3);
            updateState({ friendliness: gameState.friendliness + v, resources: { ...gameState.resources, activity_funds: gameState.resources.activity_funds - cost.activity_funds, decorations: gameState.resources.decorations - cost.decorations } }, `식료품실을 마련했습니다! (+${v} 친화력)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_hobbyRoom: () => {
        if (!spendActionPoint()) return;
        const cost = { decorations: 30, refreshments: 30 };
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.refreshments >= cost.refreshments) {
            gameState.club_facilities.hobbyRoom.built = true;
            const v = getRandomValue(10, 3);
            updateState({ popularity: gameState.popularity + v, resources: { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, refreshments: gameState.resources.refreshments - cost.refreshments } }, `취미실을 마련했습니다! (+${v} 인기)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_mainLounge: () => {
        if (!spendActionPoint()) return;
        const cost = { activity_funds: 100, decorations: 50 };
        if (gameState.resources.activity_funds >= cost.activity_funds && gameState.resources.decorations >= cost.decorations) {
            gameState.club_facilities.mainLounge.built = true;
            const v = getRandomValue(15, 5);
            updateState({ harmony: gameState.harmony + v, resources: { ...gameState.resources, activity_funds: gameState.resources.activity_funds - cost.activity_funds, decorations: gameState.resources.decorations - cost.decorations } }, `메인 라운지를 확장했습니다! (+${v} 조화)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_recordRoom: () => {
        if (!spendActionPoint()) return;
        const cost = { decorations: 80, refreshments: 40 };
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.refreshments >= cost.refreshments) {
            gameState.club_facilities.recordRoom.built = true;
            const v = getRandomValue(15, 5);
            updateState({ tradition: gameState.tradition + v, resources: { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, refreshments: gameState.resources.refreshments - cost.refreshments } }, `기록실을 신설했습니다! (+${v} 전통)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_partyRoom: () => {
        if (!spendActionPoint()) return;
        const cost = { activity_funds: 150, community_trophies: 5 };
        if (gameState.resources.activity_funds >= cost.activity_funds && gameState.resources.community_trophies >= cost.community_trophies) {
            gameState.club_facilities.partyRoom.built = true;
            const v = getRandomValue(20, 5);
            updateState({ popularity: gameState.popularity + v, resources: { ...gameState.resources, activity_funds: gameState.resources.activity_funds - cost.activity_funds, community_trophies: gameState.resources.community_trophies - cost.community_trophies } }, `파티룸을 개장했습니다! (+${v} 인기)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { decorations: 10, refreshments: 10 };
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.refreshments >= cost.refreshments) {
            gameState.club_facilities[facilityKey].durability = 100;
            updateState({ resources: { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, refreshments: gameState.resources.refreshments - cost.refreshments } }, `${gameState.club_facilities[facilityKey].name}을(를) 보수했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    prepare_random_refreshments: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) {
            const v = getRandomValue(1, 1);
            updateState({ resources: { ...gameState.resources, community_trophies: (gameState.resources.community_trophies || 0) + v } }, `랜덤 다과에서 전설의 레시피를 발견했습니다! (+${v} 공동체 트로피)`);
        } else {
            const v = getRandomValue(10, 5);
            updateState({ friendliness: gameState.friendliness + v }, `성공적인 다과 준비로 친화력이 상승했습니다. (+${v} 친화력)`);
        }
    },
    explore_club_history: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.6) {
            const v = getRandomValue(10, 5);
            updateState({ resources: { ...gameState.resources, activity_funds: gameState.resources.activity_funds + v } }, `클럽의 역사를 탐방하다 비상금을 발견했습니다. (+${v} 활동비)`);
        } else {
            updateState({}, `아무것도 발견하지 못했습니다.`);
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 다음 날로 넘어갈 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.harmony >= 70) { message += "클럽의 조화로운 분위기에 모두가 만족합니다. "; }
    if (gameState.popularity >= 70) { const v = getRandomValue(5, 2); gameState.resources.activity_funds += v; message += `클럽의 인기가 높아져 활동비가 들어옵니다. (+${v} 활동비) `; }
    if (gameState.tradition >= 70) { const v = getRandomValue(2, 1); gameState.members.forEach(m => m.friendship = Math.min(100, m.friendship + v)); message += `클럽의 전통이 회원들의 친밀도를 높입니다. (+${v} 친밀도) `; }
    if (gameState.friendliness < 30) { gameState.actionPoints -= 1; message += "친화력이 부족하여 행동력이 1 감소합니다. "; }
    if (gameState.organization < 30) { Object.keys(gameState.club_facilities).forEach(key => { if(gameState.club_facilities[key].built) gameState.club_facilities[key].durability -= 1; }); message += "조직력이 부족하여 시설들이 노후화됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "unexpected_guest", weight: 10, condition: () => gameState.popularity > 40, onTrigger: () => { const v = getRandomValue(10, 3); updateState({ popularity: gameState.popularity + v, harmony: gameState.harmony + v }, `예상치 못한 손님의 방문으로 클럽의 인기가 상승했습니다. (+${v} 인기, +${v} 조화)`); } },
    { id: "member_dispute", weight: 5, condition: () => true, onTrigger: () => { const v = getRandomValue(15, 5); updateState({ resources: { ...gameState.resources, refreshments: Math.max(0, gameState.resources.refreshments - v) }, harmony: gameState.harmony - 5 }, `회원 간의 다툼으로 다과가 엉망이 되었습니다. (-${v} 다과, -5 조화)`); } },
    { id: "new_tradition", weight: 15, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ tradition: gameState.tradition + v }, `새로운 전통이 생겨났습니다! (+${v} 전통)`); } },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "사교 클럽에 새로운 아침이 밝았습니다. " + statEffectMessage;

    if (gameState.harmony <= 0) { gameState.currentScenarioId = "game_over_harmony"; }
    else if (gameState.popularity <= 0) { gameState.currentScenarioId = "game_over_popularity"; }
    else if (gameState.tradition <= 0) { gameState.currentScenarioId = "game_over_tradition"; }
    else if (gameState.resources.refreshments <= 0 && gameState.day > 1) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 클럽을 해체하시겠습니까? 모든 기록과 추억이 사라집니다.")) {
        localStorage.removeItem('esfjClubGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
