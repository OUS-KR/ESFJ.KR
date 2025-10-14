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

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerText = message;
        feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    }
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
            pantry: { built: false, durability: 100 },
            hobbyRoom: { built: false, durability: 100 },
            mainLounge: { built: false, durability: 100 },
            archiveRoom: { built: false, durability: 100 },
            partyHall: { built: false, durability: 100 }
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
        if (!loaded.dailyBonus) loaded.dailyBonus = { collectionSuccess: 0 };
        if (!loaded.members || loaded.members.length === 0) {
            loaded.members = [
                { id: "bella", name: "벨라", personality: "친절한", skill: "이벤트 기획", friendship: 70 },
                { id: "oliver", name: "올리버", personality: "사교적인", skill: "분위기 조성", friendship: 60 }
            ];
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
        <p><b>클럽 운영:</b> ${gameState.day}일차</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>조화:</b> ${gameState.harmony} | <b>인기:</b> ${gameState.popularity} | <b>전통:</b> ${gameState.tradition}</p>
        <p><b>자원:</b> 다과 ${gameState.resources.refreshments}, 장식 ${gameState.resources.decorations}, 활동비 ${gameState.resources.club_funds}, 공동체 트로피 ${gameState.resources.community_trophy || 0}</p>
        <p><b>클럽 레벨:</b> ${gameState.clubLevel}</p>
        <p><b>클럽 회원 (${gameState.members.length}/${gameState.maxMembers}):</b></p>
        <ul>${memberListHtml}</ul>
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
        if (!gameState.clubRooms.pantry.built) dynamicChoices.push({ text: "식료품실 준비 (다과 50, 장식 20)", action: "build_pantry" });
        if (!gameState.clubRooms.hobbyRoom.built) dynamicChoices.push({ text: "취미실 만들기 (장식 30, 활동비 30)", action: "build_hobby_room" });
        if (!gameState.clubRooms.mainLounge.built) dynamicChoices.push({ text: "메인 라운지 꾸미기 (다과 100, 장식 50, 활동비 50)", action: "build_main_lounge" });
        if (!gameState.clubRooms.archiveRoom.built) dynamicChoices.push({ text: "기록실 만들기 (장식 80, 활동비 40)", action: "build_archive_room" });
        if (gameState.clubRooms.hobbyRoom.built && gameState.clubRooms.hobbyRoom.durability > 0 && !gameState.clubRooms.partyHall.built) {
            dynamicChoices.push({ text: "파티룸 증축 (장식 50, 활동비 100)", action: "build_party_hall" });
        }
        Object.keys(gameState.clubRooms).forEach(key => {
            const facility = gameState.clubRooms[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 보수 (장식 10, 활동비 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}''>${choice.text}</button>`).join('');
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

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘은 어떤 활동을 해볼까요?", choices: [
        { text: "클럽 둘러보기", action: "explore" },
        { text: "회원과 대화하기", action: "talk_to_members" },
        { text: "정기 모임 개최", action: "hold_meeting" },
        { text: "활동 준비", action: "show_resource_collection_options" },
        { text: "클럽 시설 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_dispute": {
        text: "회원 벨라와 올리버 사이에 사소한 다툼이 생겼습니다. 둘 다 당신의 중재를 기다리는 눈치입니다.",
        choices: [
            { text: "벨라의 편을 들어준다.", action: "handle_dispute", params: { first: "bella", second: "oliver" } },
            { text: "올리버의 편을 들어준다.", action: "handle_dispute", params: { first: "oliver", second: "bella" } },
            { text: "둘을 화해시키고 함께 다과를 즐긴다.", action: "mediate_dispute" },
            { text: "스스로 해결하도록 지켜본다.", action: "ignore_event" }
        ]
    },
    "daily_event_guest": { text: "예상치 못한 손님 방문으로 준비한 다과가 모두 소진되었습니다. (-10 다과)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_shortage": { text: "행사 물품이 부족하여 활동비로 긴급 구매했습니다. (-10 활동비)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_bazaar": {
        text: "이웃 클럽에서 자선 바자회를 제안했습니다. [활동비 50]을 기부하면 [공동체 트로피]를 받을 수 있습니다.",
        choices: [
            { text: "기부한다", action: "accept_donation" },
            { text: "다음에 하겠다", action: "decline_donation" }
        ]
    },
    "daily_event_new_member": {
        choices: [
            { text: "따뜻하게 환영하고 클럽을 소개해준다.", action: "welcome_new_unique_member" },
            { text: "기존 회원들과 잘 어울리는지 지켜본다.", action: "observe_member" },
            { text: "우리 클럽과는 맞지 않는 것 같다.", action: "reject_member" }
        ]
    },
    "game_over_harmony": { text: "클럽의 조화가 깨졌습니다. 회원들이 하나둘 떠나기 시작합니다.", choices: [], final: true },
    "game_over_popularity": { text: "클럽의 인기가 바닥을 쳤습니다. 아무도 클럽에 관심을 갖지 않습니다.", choices: [], final: true },
    "game_over_tradition": { text: "클럽의 전통이 무너졌습니다. 클럽은 정체성을 잃고 사라집니다.", choices: [], final: true },
    "game_over_resources": { text: "클럽의 자원이 고갈되어 더 이상 운영할 수 없습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 활동을 준비하시겠습니까?",
        choices: [
            { text: "다과 준비하기 (다과)", action: "perform_prepare_refreshments" },
            { text: "클럽 꾸미기 (장식)", action: "perform_get_decorations" },
            { text: "회비 걷기 (활동비)", "action": "perform_collect_funds" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 시설을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "dispute_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { harmony: 0, popularity: 0, tradition: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.popularity = 15;
                rewards.harmony = 10;
                rewards.tradition = 5;
                rewards.message = "엄청난 기억력이네요! 회원들의 이름을 모두 기억하는 당신은 최고의 운영자입니다. (+15 인기, +10 조화, +5 전통)";
            } else if (score >= 21) {
                rewards.popularity = 10;
                rewards.harmony = 5;
                rewards.message = "훌륭한 기억력입니다. (+10 인기, +5 조화)";
            } else if (score >= 0) {
                rewards.popularity = 5;
                rewards.message = "회원들의 얼굴을 기억했습니다. (+5 인기)";
            } else {
                rewards.message = "훈련을 완료했지만, 아쉽게도 보상은 없습니다.";
            }
            break;
        case "칭찬 릴레이":
            rewards.harmony = 10;
            rewards.message = "따뜻한 칭찬으로 클럽의 조화가 상승했습니다. (+10 조화)";
            break;
        case "선물 고르기":
            rewards.popularity = 5;
            rewards.harmony = 5;
            rewards.message = "센스있는 선물 덕분에 인기가 상승했습니다. (+5 인기, +5 조화)";
            break;
        case "갈등 중재하기":
            rewards.harmony = 15;
            rewards.message = "성공적인 중재였습니다! (+15 조화)";
            break;
        case "파티 계획하기":
            rewards.popularity = 10;
            rewards.tradition = 5;
            rewards.message = "완벽한 파티 계획입니다! (+10 인기, +5 전통)";
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 회원들의 얼굴 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                harmony: gameState.harmony + rewards.harmony,
                popularity: gameState.popularity + rewards.popularity,
                tradition: gameState.tradition + rewards.tradition,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "칭찬 릴레이", description: "제한 시간 안에 모든 회원에게 돌아가며 칭찬을 한마디씩 해주세요.", start: (ga, cd) => { ga.innerHTML = "<p>칭찬 릴레이 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ harmony: gameState.harmony + r.harmony, popularity: gameState.popularity + r.popularity, tradition: gameState.tradition + r.tradition, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "선물 고르기", description: "각 회원의 취향에 맞는 완벽한 선물을 골라주세요.", start: (ga, cd) => { ga.innerHTML = "<p>선물 고르기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ harmony: gameState.harmony + r.harmony, popularity: gameState.popularity + r.popularity, tradition: gameState.tradition + r.tradition, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "갈등 중재하기", description: "다투는 회원들 사이에서 모두가 만족할 만한 해결책을 제시하세요.", start: (ga, cd) => { ga.innerHTML = "<p>갈등 중재하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ harmony: gameState.harmony + r.harmony, popularity: gameState.popularity + r.popularity, tradition: gameState.tradition + r.tradition, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "파티 계획하기", description: "주어진 예산과 시간 안에 가장 완벽한 파티를 계획하세요.", start: (ga, cd) => { ga.innerHTML = "<p>파티 계획하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ harmony: gameState.harmony + r.harmony, popularity: gameState.popularity + r.popularity, tradition: gameState.tradition + r.tradition, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    explore: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.explored) { updateState({ dailyActions: { ...gameState.dailyActions, explored: true } }, "오늘은 클럽을 모두 둘러보았습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, explored: true } };
        let message = "클럽을 둘러보니 모두가 즐거워 보입니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 회원들이 남겨둔 다과를 발견했습니다. (+2 다과)"; changes.refreshments = gameState.resources.refreshments + 2; }
        else if (rand < 0.6) { message += " 멋진 장식 아이디어가 떠올랐습니다. (+2 장식)"; changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations + 2 }; }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        
        updateState(changes, message);
    },
    talk_to_members: () => {
        if (!spendActionPoint()) return;
        const member = gameState.members[Math.floor(currentRandFn() * gameState.members.length)];
        if (gameState.dailyActions.talkedTo.includes(member.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, member.id] } }, `${member.name}${getWaGwaParticle(member.name)} 이미 즐거운 대화를 나눴습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, member.id] } };
        let message = `${member.name}${getWaGwaParticle(member.name)} 대화했습니다. `;
        if (member.friendship > 80) { message += `그는 당신에게 깊은 친밀감을 느끼며 클럽의 전통에 대한 이야기를 들려주었습니다. (+5 전통)`; changes.tradition = gameState.tradition + 5; }
        else if (member.friendship < 40) { message += `그는 아직 당신을 어색해합니다. 더 많은 관심이 필요합니다. (-5 인기)`; changes.popularity = gameState.popularity - 5; }
        else { message += `즐거운 대화를 통해 클럽의 인기가 올랐습니다. (+2 인기)`; changes.popularity = gameState.popularity + 2; }
        
        updateState(changes, message);
    },
    hold_meeting: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.meetingHeld) {
            const message = "오늘은 이미 정기 모임을 개최했습니다. 잦은 모임은 회원들을 지치게 합니다. (-5 인기)";
            gameState.popularity -= 5;
            updateState({ popularity: gameState.popularity }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, meetingHeld: true } });
        const rand = currentRandFn();
        let message = "정기 모임을 개최했습니다. ";
        if (rand < 0.5) { message += "회원들이 서로의 안부를 물으며 클럽의 조화가 깊어졌습니다. (+10 조화, +5 인기)"; updateState({ harmony: gameState.harmony + 10, popularity: gameState.popularity + 5 }); }
        else { message += "사소한 오해가 있었지만, 당신의 중재로 잘 해결되었습니다. (+5 조화)"; updateState({ harmony: gameState.harmony + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_dispute: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { harmony: 0, popularity: 0, tradition: 0 };
        
        const updatedMembers = gameState.members.map(m => {
            if (m.id === first) {
                m.friendship = Math.min(100, m.friendship + 10);
                message += `${m.name}의 편을 들어주었습니다. 그의 친밀도가 상승했습니다. `;
                reward.harmony += 5;
            } else if (m.id === second) {
                m.friendship = Math.max(0, m.friendship - 5);
                message += `${second}와의 친밀도가 약간 하락했습니다. `;
            }
            return m;
        });
        
        updateState({ ...reward, members: updatedMembers, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    mediate_dispute: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 중재로 두 회원의 오해가 풀렸습니다. 클럽의 조화가 깊어졌습니다! (+10 조화, +5 인기)";
        updateState({ harmony: gameState.harmony + 10, popularity: gameState.popularity + 5, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "다툼을 무시했습니다. 회원들의 불만이 커지고 클럽의 조화가 깨집니다. (-10 조화, -5 인기)";
        const updatedMembers = gameState.members.map(m => {
            m.friendship = Math.max(0, m.friendship - 5);
            return m;
        });
        updateState({ harmony: gameState.harmony - 10, popularity: gameState.popularity - 5, members: updatedMembers, currentScenarioId: 'dispute_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_prepare_refreshments: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.clubLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "다과 준비를 완료했습니다! (+5 다과)";
            changes.resources = { ...gameState.resources, refreshments: gameState.resources.refreshments + 5 };
        } else {
            message = "다과 준비에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_get_decorations: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.clubLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "클럽 장식을 구했습니다! (+5 장식)";
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations + 5 };
        } else {
            message = "장식을 구하지 못했습니다.";
        }
        updateState(changes, message);
    },
    perform_collect_funds: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.clubLevel * 0.1) + (gameState.dailyBonus.collectionSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "회비 걷기에 성공했습니다! (+5 활동비)";
            changes.resources = { ...gameState.resources, club_funds: gameState.resources.club_funds + 5 };
        } else {
            message = "회비 걷기에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_pantry: () => {
        if (!spendActionPoint()) return;
        const cost = { refreshments: 50, decorations: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.refreshments >= cost.refreshments) {
            gameState.clubRooms.pantry.built = true;
            message = "식료품실을 준비했습니다!";
            changes.tradition = gameState.tradition + 10;
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, refreshments: gameState.resources.refreshments - cost.refreshments };
        } else {
            message = "자원이 부족하여 준비할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_hobby_room: () => {
        if (!spendActionPoint()) return;
        const cost = { decorations: 30, club_funds: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.club_funds >= cost.club_funds) {
            gameState.clubRooms.hobbyRoom.built = true;
            message = "취미실을 만들었습니다!";
            changes.popularity = gameState.popularity + 10;
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, club_funds: gameState.resources.club_funds - cost.club_funds };
        } else {
            message = "자원이 부족하여 만들 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_main_lounge: () => {
        if (!spendActionPoint()) return;
        const cost = { refreshments: 100, decorations: 50, club_funds: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.club_funds >= cost.club_funds && gameState.resources.refreshments >= cost.refreshments) {
            gameState.clubRooms.mainLounge.built = true;
            message = "메인 라운지를 꾸몄습니다!";
            changes.tradition = gameState.tradition + 20;
            changes.popularity = gameState.popularity + 20;
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, club_funds: gameState.resources.club_funds - cost.club_funds, refreshments: gameState.resources.refreshments - cost.refreshments };
        } else {
            message = "자원이 부족하여 꾸밀 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_archive_room: () => {
        if (!spendActionPoint()) return;
        const cost = { decorations: 80, club_funds: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.club_funds >= cost.club_funds) {
            gameState.clubRooms.archiveRoom.built = true;
            message = "기록실을 만들었습니다!";
            changes.harmony = gameState.harmony + 15;
            changes.tradition = gameState.tradition + 10;
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, club_funds: gameState.resources.club_funds - cost.club_funds };
        } else {
            message = "자원이 부족하여 만들 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_party_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { decorations: 50, club_funds: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.club_funds >= cost.club_funds) {
            gameState.clubRooms.partyHall.built = true;
            message = "파티룸을 증축했습니다!";
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, club_funds: gameState.resources.club_funds - cost.club_funds };
        } else {
            message = "자원이 부족하여 증축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { decorations: 10, club_funds: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.decorations >= cost.decorations && gameState.resources.club_funds >= cost.club_funds) {
            gameState.clubRooms[facilityKey].durability = 100;
            message = `${facilityKey} 시설의 보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, decorations: gameState.resources.decorations - cost.decorations, club_funds: gameState.resources.club_funds - cost.club_funds };
        } else {
            message = "보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_club: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.clubLevel + 1);
        if (gameState.resources.decorations >= cost && gameState.resources.club_funds >= cost) {
            gameState.clubLevel++;
            updateState({ resources: { ...gameState.resources, decorations: gameState.resources.decorations - cost, club_funds: gameState.resources.club_funds - cost }, clubLevel: gameState.clubLevel });
            updateGameDisplay(`클럽을 업그레이드했습니다! 모든 활동 준비 성공률이 10% 증가합니다. (현재 레벨: ${gameState.clubLevel})`);
        } else { updateGameDisplay(`업그레이드에 필요한 자원이 부족합니다. (장식 ${cost}, 활동비 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    review_history: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, decorations: gameState.resources.decorations + 20, club_funds: gameState.resources.club_funds + 20 } }); updateGameDisplay("클럽의 역사를 되짚어보던 중 잊혀진 후원금을 발견했습니다! (+20 장식, +20 활동비)"); }
        else if (rand < 0.5) { updateState({ harmony: gameState.harmony + 10, tradition: gameState.tradition + 10 }); updateGameDisplay("과거의 기록에서 클럽의 조화를 다지는 지혜를 발견했습니다. (+10 조화, +10 전통)"); }
        else { updateGameDisplay("클럽의 역사를 되짚어보았지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_donation: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.club_funds >= 50) {
            updateState({ resources: { ...gameState.resources, club_funds: gameState.resources.club_funds - 50, community_trophy: (gameState.resources.community_trophy || 0) + 1 } });
            updateGameDisplay("자선 바자회에 기부하여 공동체 트로피를 받았습니다! 클럽의 명성이 높아집니다.");
        } else { updateGameDisplay("기부에 필요한 활동비가 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_donation: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("자선 바자회 제안을 거절했습니다. 다음 기회를 노려봐야겠습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.harmony >= 70) {
        gameState.dailyBonus.collectionSuccess += 0.1;
        message += "높은 조화로움 덕분에 활동 준비 성공률이 증가합니다. ";
    }
    if (gameState.harmony < 30) {
        gameState.members.forEach(m => m.friendship = Math.max(0, m.friendship - 5));
        message += "낮은 조화로움으로 인해 회원들의 친밀도가 하락합니다. ";
    }

    if (gameState.popularity >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "높은 인기로 인해 클럽에 활기가 넘쳐 행동력이 증가합니다. ";
    }
    if (gameState.popularity < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "인기가 식어 클럽에 침체기가 찾아와 행동력이 감소합니다. ";
    }

    if (gameState.tradition >= 70) {
        Object.keys(gameState.clubRooms).forEach(key => {
            if (gameState.clubRooms[key].built) gameState.clubRooms[key].durability = Math.min(100, gameState.clubRooms[key].durability + 1);
        });
        message += "클럽의 전통이 깊어져 시설 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.tradition < 30) {
        Object.keys(gameState.clubRooms).forEach(key => {
            if (gameState.clubRooms[key].built) gameState.clubRooms[key].durability = Math.max(0, gameState.clubRooms[key].durability - 2);
        });
        message += "전통이 약화되어 시설들이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomMember() {
    const names = ["소피아", "리암", "클로이", "노아"];
    const personalities = ["따뜻한", "활동적인", "꼼꼼한", "명랑한"];
    const skills = ["요리", "음악", "미술", "정리정돈"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        friendship: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { collectionSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.members.forEach(m => {
        if (m.skill === '요리') { gameState.resources.refreshments++; skillBonusMessage += `${m.name}의 솜씨 덕분에 다과를 추가로 얻었습니다. `; }
        else if (m.skill === '미술') { gameState.resources.decorations++; skillBonusMessage += `${m.name}의 도움으로 장식품을 추가로 얻었습니다. `; }
        else if (m.skill === '정리정돈') { gameState.tradition++; skillBonusMessage += `${m.name} 덕분에 클럽의 전통이 +1 상승했습니다. `; }
    });

    Object.keys(gameState.clubRooms).forEach(key => {
        const facility = gameState.clubRooms[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 시설이 파손되었습니다! 수리가 필요합니다. `;
            }
        }
    });

    gameState.resources.refreshments -= gameState.members.length * 2;
    let dailyMessage = "새로운 하루가 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.refreshments < 0) {
        gameState.popularity -= 10;
        dailyMessage += "다과가 부족하여 회원들의 인기가 떨어집니다! (-10 인기)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_guest"; updateState({resources: {...gameState.resources, refreshments: Math.max(0, gameState.resources.refreshments - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_shortage"; updateState({resources: {...gameState.resources, club_funds: Math.max(0, gameState.resources.club_funds - 10)}}); }
    else if (rand < 0.5 && gameState.members.length >= 2) { eventId = "daily_event_dispute"; }
    else if (rand < 0.7 && gameState.clubRooms.mainLounge.built && gameState.members.length < gameState.maxMembers) {
        eventId = "daily_event_new_member";
        const newMember = generateRandomMember();
        gameState.pendingNewMember = newMember;
        gameScenarios["daily_event_new_member"].text = `새로운 회원 ${newMember.name}(${newMember.personality}, ${newMember.skill})이(가) 가입하고 싶어 합니다. (현재 회원 수: ${gameState.members.length} / ${gameState.maxMembers})`;
    }
    else if (rand < 0.85 && gameState.clubRooms.mainLounge.built) { eventId = "daily_event_bazaar"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 클럽을 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
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