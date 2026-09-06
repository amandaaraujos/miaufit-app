import { WORKOUTS, WEEKS } from './cartilha.js';
import {
    saveSessionLog,
    getHistoryLogs,
    deleteSessionLog,
    getPendingLogs,
    savePendingLocally,
    trySyncPendingLogs
} from './firebase.js';

const app = document.getElementById('app-content');

// --- SISTEMA DE VERSIONAMENTO ---
const APP_VERSION = '2.4';
let currentVersion = localStorage.getItem('appVersion');

let CUSTOM_WORKOUTS;

if (currentVersion !== APP_VERSION || !localStorage.getItem('customWorkouts')) {
    CUSTOM_WORKOUTS = JSON.parse(JSON.stringify(WORKOUTS));

    if (!CUSTOM_WORKOUTS.find(w => w.id === 'treino_cardio')) {
        CUSTOM_WORKOUTS.push({
            id: 'treino_cardio',
            name: '🏃‍♀️ Cardio',
            focus: 'Condicionamento físico e resistência cardiovascular',
            exercises: [
                {
                    id: 'cardio_1',
                    name: 'Esteira',
                    isCardio: true,
                    sets: 1,
                    reps: 30,
                    load: 3.5,
                    rest: 0
                }
            ]
        });
    }

    localStorage.setItem('customWorkouts', JSON.stringify(CUSTOM_WORKOUTS));
    localStorage.setItem('appVersion', APP_VERSION);
} else {
    CUSTOM_WORKOUTS = JSON.parse(localStorage.getItem('customWorkouts'));
}
// ---------------------------------

// --- ESTADO DA SESSÃO ATUAL ---
let currentWorkout = null;
let currentExerciseIndex = 0;
let currentSet = 1;
let currentSide = 'D'; // 'D' ou 'E' — só é usado em exercícios unilaterais
let sessionLog = [];
let exerciseLog = [];

let restInterval = null;       // intervalo de exibição do descanso ENTRE SÉRIES
let transitionInterval = null; // intervalo de exibição do descanso ENTRE EXERCÍCIOS
let restEndTime = null;        // timestamp (ms) de quando o descanso entre séries termina
let transitionEndTime = null;  // timestamp (ms) de quando o descanso entre exercícios termina

const SESSION_KEY = 'activeSession';

// =================================================================
// PERSISTÊNCIA DA SESSÃO — sobrevive a F5 / fechar e reabrir o app
// =================================================================
function persistSession() {
    if (!currentWorkout) {
        localStorage.removeItem(SESSION_KEY);
        return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        workoutId: currentWorkout.id,
        currentExerciseIndex,
        currentSet,
        currentSide,
        sessionLog,
        exerciseLog,
        restEndTime,
        transitionEndTime
    }));
}

function clearPersistedSession() {
    localStorage.removeItem(SESSION_KEY);
}

function loadPersistedSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// =================================================================
// ALARME SONORO + NOTIFICAÇÃO quando o descanso termina
// =================================================================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}
window.requestNotificationPermission = requestNotificationPermission;

function playAlarmSound() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [0, 0.32, 0.64].forEach((t) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.0001, now + t);
            gain.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + t);
            osc.stop(now + t + 0.3);
        });
    } catch (e) {
        console.warn('Não foi possível tocar o alarme sonoro:', e);
    }
}

function notifyRestOver(message) {
    playAlarmSound();
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('MiauFit ⏱️', {
                body: message,
                icon: './miaufit_logo_192x192.png',
                tag: 'miaufit-rest'
            });
        } catch (e) { /* ignora silenciosamente */ }
    }
}

// Recalcula os cronômetros com base no relógio real. Isso é o que garante
// que, mesmo se o navegador "pausar" o setInterval com a aba em segundo
// plano, ao voltar (ou trocar de tela) o tempo mostrado e o alarme
// disparam corretamente — porque contamos por horário absoluto, não por
// "ticks" perdidos.
function reconcileTimers() {
    if (restEndTime) {
        const remaining = Math.round((restEndTime - Date.now()) / 1000);
        const display = document.getElementById('timer-display');
        if (remaining <= 0) finishRestTimer();
        else if (display) display.innerText = formatTime(remaining);
    }
    if (transitionEndTime) {
        const remaining = Math.round((transitionEndTime - Date.now()) / 1000);
        const display = document.getElementById('rest-time-left');
        if (remaining <= 0) finishTransitionTimer();
        else if (display) display.innerText = remaining;
    }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconcileTimers(); });
window.addEventListener('focus', reconcileTimers);
window.addEventListener('pageshow', reconcileTimers);

// =================================================================
// NAVEGAÇÃO
// =================================================================
window.navigate = async function (page, data = null) {
    // Ir para 'home' ou 'history' NÃO cancela um treino em andamento —
    // ele continua guardado (em memória + localStorage) e pode ser
    // retomado depois, com os cronômetros corretos.
    if (page === 'home') await renderHome();
    if (page === 'configure') renderConfigure(data);
    if (page === 'history') await renderHistory();
    if (page === 'session') await startWorkoutSession(data);
};

window.resumeActiveSession = function () {
    const saved = loadPersistedSession();
    if (!saved) return navigate('home');
    restoreSessionFromSaved(saved);
};

window.abandonSession = function () {
    if (!confirm('Tem certeza que deseja descartar este treino em andamento? O progresso será perdido.')) return;
    clearInterval(restInterval);
    clearInterval(transitionInterval);
    restEndTime = null;
    transitionEndTime = null;
    currentWorkout = null;
    sessionLog = [];
    exerciseLog = [];
    clearPersistedSession();
    const banner = document.getElementById('rest-banner');
    if (banner) banner.style.display = 'none';
    navigate('home');
};

function restoreSessionFromSaved(saved) {
    const workout = CUSTOM_WORKOUTS.find(w => w.id === saved.workoutId);
    if (!workout) { clearPersistedSession(); return navigate('home'); }

    currentWorkout = workout;
    currentExerciseIndex = saved.currentExerciseIndex || 0;
    currentSet = saved.currentSet || 1;
    currentSide = saved.currentSide || 'D';
    sessionLog = saved.sessionLog || [];
    exerciseLog = saved.exerciseLog || [];
    restEndTime = saved.restEndTime || null;
    transitionEndTime = saved.transitionEndTime || null;

    requestNotificationPermission();
    renderExerciseSession();
}

// --- Cálculo da semana com base em Ciclos (Total de treinos no app) ---
function getCurrentWeekInfo(totalWorkouts) {
    const treinosPorCiclo = CUSTOM_WORKOUTS.length;
    const currentWeek = Math.floor(totalWorkouts / treinosPorCiclo) + 1;

    let phase = "";
    if (currentWeek <= 2) phase = "Adaptação (RIR 3)";
    else if (currentWeek <= 5) phase = "Acúmulo";
    else if (currentWeek === 6) phase = "Transição";
    else if (currentWeek === 7) phase = "DELOAD (Reduza 30-40% volume)";
    else if (currentWeek <= 11) phase = "Progressão 2";
    else if (currentWeek === 12) phase = "DELOAD (Reduza 30-40% volume)";
    else if (currentWeek <= 16) phase = "Progressão 3";
    else if (currentWeek === 17) phase = "DELOAD (Reduza 30-40% volume)";
    else if (currentWeek <= 20) phase = "Bloco final";
    else phase = "Avaliação final";

    return { week: currentWeek, type: phase, cycleSize: treinosPorCiclo };
}

// --- Lógica de evolução matemática do Cardio ---
function getCardioTarget(week) {
    let minutes = 30;
    let speed = 3.5 + ((week - 1) * 0.2);
    return { minutes, speed: Number(speed.toFixed(1)) };
}

async function renderHome() {
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-32 space-y-4 max-w-md mx-auto">
            <i class="ri-loader-4-line text-4xl text-brand-500 animate-spin"></i>
            <h2 class="text-gray-500 font-medium">Carregando seu progresso...</h2>
        </div>`;

    const history = await getHistoryLogs();
    const totalWorkouts = history.length;
    const savedSession = loadPersistedSession();
    const pending = getPendingLogs();

    let weekDisplayHtml = "";

    if (totalWorkouts === 0) {
        weekDisplayHtml = `
            <p class="text-lg font-bold text-gray-900">Nenhum treino salvo</p>
            <p class="text-sm text-gray-600">Faça o primeiro treino para iniciar a Semana 1!</p>
        `;
    } else {
        const currentWeekInfo = getCurrentWeekInfo(totalWorkouts);
        const treinosNaSemanaAtual = totalWorkouts % currentWeekInfo.cycleSize;

        weekDisplayHtml = `
            <div class="flex justify-between items-end">
                <div>
                    <p class="text-lg font-bold text-gray-900">Semana ${currentWeekInfo.week}</p>
                    <p class="text-sm text-gray-600">${currentWeekInfo.type}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-brand-600 bg-brand-100 px-2 py-1 rounded-lg inline-block mb-1">${treinosNaSemanaAtual}/${currentWeekInfo.cycleSize}</p>
                    <p class="text-[10px] text-gray-400 uppercase tracking-wide">treinos</p>
                </div>
            </div>
        `;
    }

    const resumeBannerHtml = savedSession ? `
        <button onclick="resumeActiveSession()" class="w-full bg-orange-500 text-white p-4 rounded-2xl font-bold text-sm shadow-md flex items-center justify-between active:scale-[0.98] transition-transform">
            <span><i class="ri-time-line mr-2"></i>Você tem um treino em andamento</span>
            <span class="underline">Continuar</span>
        </button>
    ` : '';

    const pendingBannerHtml = pending.length ? `
        <div class="w-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold p-3 rounded-2xl">
            ⏳ ${pending.length} treino(s) salvo(s) neste aparelho aguardando conexão. Veja em Histórico.
        </div>
    ` : '';

    const notifButtonHtml = ('Notification' in window && Notification.permission !== 'granted') ? `
        <button onclick="requestNotificationPermission()" class="w-full text-xs font-semibold text-brand-600 bg-brand-50 py-2.5 rounded-xl">
            🔔 Ativar notificações de descanso
        </button>
    ` : '';

    app.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 pb-24 px-2">
            <header class="mt-4">
                <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Olá, Amanda! 👋</h1>
                <p class="text-gray-500 mt-1 text-sm">Pronta para o treino de hoje?</p>
            </header>

            ${resumeBannerHtml}
            ${pendingBannerHtml}
            ${notifButtonHtml}

            <div class="bg-gradient-to-r from-brand-50 to-white p-5 rounded-3xl shadow-sm border border-brand-100">
                <p class="text-[11px] font-bold text-brand-600 tracking-wider uppercase mb-2">Seu Progresso</p>
                ${weekDisplayHtml}
            </div>

            <h2 class="text-xl font-bold text-gray-900 mt-8 mb-4">Escolha seu treino</h2>
            <div class="grid grid-cols-1 gap-4">
                ${CUSTOM_WORKOUTS.map(w => `
                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="text-lg font-bold text-gray-900">${w.name}</h3>
                            <button onclick="navigate('configure', '${w.id}')" class="text-brand-600 bg-brand-50 p-2 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors flex items-center gap-1" aria-label="Ajustar treino">
                                <i class="ri-settings-4-line text-lg"></i>
                            </button>
                        </div>
                        <p class="text-sm text-gray-500 mb-5 leading-relaxed">${w.focus || ''}</p>

                        <button onclick="navigate('session', '${w.id}')" class="w-full bg-brand-600 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2">
                            Iniciar treino <i class="ri-play-fill text-lg"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function saveConfigToMemory(workout) {
    workout.exercises.forEach(ex => {
        const nameEl = document.getElementById(`cfg-name-${ex.id}`);
        const setsEl = document.getElementById(`cfg-sets-${ex.id}`);
        const repsEl = document.getElementById(`cfg-reps-${ex.id}`);
        const loadEl = document.getElementById(`cfg-load-${ex.id}`);
        const restEl = document.getElementById(`cfg-rest-${ex.id}`);
        const uniEl = document.getElementById(`cfg-uni-${ex.id}`);

        if (nameEl) ex.name = nameEl.value || ex.name;
        if (setsEl) ex.sets = Number(setsEl.value) || ex.sets;
        if (repsEl) ex.reps = Number(repsEl.value) || ex.reps;
        if (loadEl) ex.load = Number(loadEl.value) || 0;
        if (restEl) ex.rest = Number(restEl.value) || ex.rest;
        if (uniEl) ex.isUnilateral = uniEl.checked;
    });
}

window.addExercise = function (workoutId) {
    const workout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);
    saveConfigToMemory(workout);

    const isCardioWorkout = workoutId === 'treino_cardio';

    workout.exercises.push({
        id: 'novo_' + Date.now(),
        name: isCardioWorkout ? "Novo Cardio (ex: Bicicleta)" : "Novo exercício",
        isCardio: isCardioWorkout,
        sets: isCardioWorkout ? 1 : 3,
        reps: isCardioWorkout ? 15 : 12,
        load: isCardioWorkout ? 3.5 : 0,
        rest: isCardioWorkout ? 0 : 60
    });
    renderConfigure(workoutId);
};

window.removeExercise = function (workoutId, exerciseId) {
    if (!confirm("Tem certeza que deseja remover este exercício do treino?")) return;
    const workout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);
    saveConfigToMemory(workout);

    workout.exercises = workout.exercises.filter(ex => ex.id !== exerciseId);
    renderConfigure(workoutId);
};

function renderConfigure(workoutId) {
    const workout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);

    app.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 pb-32 px-2">
            <header class="mt-4 flex items-center gap-3">
                <button onclick="navigate('home')" class="text-gray-400 bg-gray-50 p-2 rounded-xl hover:text-gray-800 transition-colors">
                    <i class="ri-arrow-left-s-line text-2xl"></i>
                </button>
                <div>
                    <h2 class="text-xl font-extrabold text-gray-900">${workout.name}</h2>
                    <p class="text-gray-500 text-xs mt-0.5">Adapte cargas e repetições</p>
                </div>
            </header>

            <div class="space-y-4" id="config-exercises-list">
                ${workout.exercises.map((ex, idx) => `
                    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative">
                        <div class="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                            <input type="text" id="cfg-name-${ex.id}" value="${ex.name}" class="font-bold text-gray-900 w-[85%] bg-transparent outline-none focus:border-b-2 focus:border-brand-500 transition-all text-base placeholder-gray-400" placeholder="Nome do exercício">
                            <button onclick="removeExercise('${workout.id}', '${ex.id}')" class="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-xl transition-colors" aria-label="Excluir exercício">
                                <i class="ri-delete-bin-line text-lg"></i>
                            </button>
                        </div>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Séries</label>
                                <input type="number" id="cfg-sets-${ex.id}" value="${ex.sets}" class="w-full bg-transparent font-black text-gray-900 text-lg outline-none text-center">
                            </div>
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">${ex.isCardio ? 'Minutos' : 'Reps Meta'}</label>
                                <input type="number" id="cfg-reps-${ex.id}" value="${ex.reps}" class="w-full bg-transparent font-black text-gray-900 text-lg outline-none text-center">
                            </div>
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">${ex.isCardio ? 'km/h' : 'Carga (kg)'}</label>
                                <input type="number" step="0.1" id="cfg-load-${ex.id}" value="${ex.load || 0}" class="w-full bg-transparent font-black text-brand-600 text-lg outline-none text-center">
                            </div>
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Pausa (s)</label>
                                <input type="number" id="cfg-rest-${ex.id}" value="${ex.rest}" class="w-full bg-transparent font-black text-gray-900 text-lg outline-none text-center">
                            </div>
                        </div>
                        ${!ex.isCardio ? `
                        <label class="flex items-center gap-2 mt-4 text-xs font-semibold text-gray-500">
                            <input type="checkbox" id="cfg-uni-${ex.id}" ${ex.isUnilateral ? 'checked' : ''} class="w-4 h-4 accent-brand-600">
                            Exercício unilateral (faz lado direito e esquerdo separadamente)
                        </label>` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="flex flex-col gap-3 mt-6">
                <button onclick="addExercise('${workout.id}')" class="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <i class="ri-add-line text-xl"></i> Adicionar exercício
                </button>

                <button id="btn-save-cfg" class="w-full py-4 rounded-2xl font-bold text-brand-700 bg-brand-100 border border-brand-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <i class="ri-save-line text-xl"></i> Salvar alterações
                </button>
            </div>

            <div class="fixed bottom-[70px] left-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-100 p-4 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex justify-center">
                <div class="max-w-md w-full">
                    <button onclick="navigate('session', '${workout.id}')" class="w-full py-4 rounded-2xl font-extrabold text-white bg-brand-600 shadow-lg shadow-brand-300 hover:bg-brand-700 active:scale-[0.98] transition-transform text-base flex items-center justify-center gap-2">
                        Iniciar treino <i class="ri-play-fill text-xl"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-cfg').addEventListener('click', () => {
        saveConfigToMemory(workout);
        localStorage.setItem('customWorkouts', JSON.stringify(CUSTOM_WORKOUTS));

        const btn = document.getElementById('btn-save-cfg');
        btn.innerHTML = '<i class="ri-check-line text-xl"></i> Alterações salvas!';
        btn.classList.replace('bg-brand-100', 'bg-green-100');
        btn.classList.replace('text-brand-700', 'text-green-700');
        btn.classList.replace('border-brand-200', 'border-green-200');

        setTimeout(() => {
            btn.innerHTML = '<i class="ri-save-line text-xl"></i> Salvar alterações';
            btn.classList.replace('bg-green-100', 'bg-brand-100');
            btn.classList.replace('text-green-700', 'text-brand-700');
            btn.classList.replace('border-green-200', 'border-brand-200');
        }, 2500);
    });
}

// --- Inicia (ou retoma) uma sessão de treino ---
async function startWorkoutSession(workoutId) {
    requestNotificationPermission();

    const saved = loadPersistedSession();
    if (saved && saved.workoutId === workoutId) {
        // é o mesmo treino que já estava em andamento: apenas retoma
        return restoreSessionFromSaved(saved);
    }
    if (saved && saved.workoutId !== workoutId) {
        if (!confirm('Você tem outro treino em andamento. Iniciar este vai descartar o progresso do treino anterior. Deseja continuar?')) {
            return navigate('home');
        }
        clearPersistedSession();
    }

    currentWorkout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);

    const history = await getHistoryLogs();
    const currentWeekInfo = getCurrentWeekInfo(history.length);

    currentWorkout.exercises.forEach(ex => {
        if (ex.isCardio) {
            const target = getCardioTarget(currentWeekInfo.week);
            ex.reps = target.minutes;
            ex.load = target.speed;
        }
    });

    currentExerciseIndex = 0;
    currentSet = 1;
    currentSide = 'D';
    sessionLog = [];
    exerciseLog = [];
    restEndTime = null;
    transitionEndTime = null;

    persistSession();
    renderExerciseSession();
}

function renderExerciseSession() {
    if (currentExerciseIndex >= currentWorkout.exercises.length) {
        finishWorkout();
        return;
    }

    const ex = currentWorkout.exercises[currentExerciseIndex];
    const sideLabel = currentSide === 'D' ? 'Direito' : 'Esquerdo';

    app.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 pb-24 pt-4 px-2">
            <div class="flex justify-between items-start">
                <div class="w-3/4">
                    <h2 class="text-2xl font-extrabold text-gray-900 leading-tight">${ex.name}</h2>
                    <div class="inline-flex items-center gap-2 mt-2 bg-brand-50 px-3 py-1.5 rounded-xl flex-wrap">
                        <span class="text-brand-700 font-bold text-sm" id="serie-info">Série ${currentSet} de ${ex.sets}</span>
                        <span class="w-1 h-1 bg-brand-300 rounded-full"></span>
                        <span class="text-brand-600 text-sm font-medium">Meta: ${ex.reps} ${ex.isCardio ? 'min' : 'reps'}</span>
                        ${ex.isUnilateral ? `<span class="w-1 h-1 bg-brand-300 rounded-full"></span><span class="text-brand-700 text-sm font-bold" id="side-badge"><i class="ri-arrow-left-right-line"></i> Lado ${sideLabel}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                    <button id="skip-btn" class="text-gray-500 text-sm font-semibold hover:text-gray-800 bg-gray-100 px-4 py-2 rounded-xl transition-colors active:scale-95">Pular</button>
                    <button onclick="abandonSession()" class="text-red-400 text-[11px] font-semibold hover:text-red-600">Encerrar treino</button>
                </div>
            </div>

            <div id="rest-timer" class="hidden bg-gradient-to-b from-brand-50 to-white p-8 rounded-3xl text-center border border-brand-100 shadow-sm">
                <p class="text-xs text-brand-600 font-bold tracking-widest mb-2 uppercase">Descanso</p>
                <div class="text-6xl font-black text-gray-900 mb-6 font-mono" id="timer-display">00:00</div>
                <button id="skip-rest-btn" class="w-full py-4 bg-white text-gray-900 rounded-2xl text-base font-bold border border-gray-200 shadow-sm active:scale-[0.98] transition-transform">Pular descanso</button>
            </div>

            <div id="inputs-area" class="space-y-4 mt-8">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
                        <label class="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">${ex.isCardio ? 'km/h' : 'Carga (kg)'}</label>
                        <input type="number" step="0.1" id="input-load" value="${ex.load || 0}" class="w-full bg-transparent text-4xl font-black text-brand-600 outline-none text-center" placeholder="0">
                    </div>
                    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
                        <label class="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">${ex.isCardio ? 'Minutos' : 'Repetições'}</label>
                        <input type="number" id="input-reps" value="${ex.reps}" class="w-full bg-transparent text-4xl font-black text-gray-900 outline-none text-center" placeholder="0">
                    </div>
                </div>

                <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <label class="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Esforço (RIR)</label>
                        <span class="text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded-md">0 = Máximo, 5 = Leve</span>
                    </div>
                    <div class="flex gap-2 justify-between">
                        ${[0, 1, 2, 3, 4, 5].map(val => `
                            <button class="rir-btn flex-1 py-3.5 rounded-2xl font-bold text-lg bg-gray-50 border border-gray-100 text-gray-400 hover:bg-gray-100 focus:bg-brand-600 focus:text-white focus:border-brand-600 transition-colors" data-val="${val}">${val}</button>
                        `).join('')}
                    </div>
                </div>

                <button id="save-set-btn" class="w-full py-4.5 mt-6 rounded-2xl font-extrabold text-lg text-white bg-brand-600 shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-transform flex justify-center items-center gap-2">
                    Registrar ${ex.isCardio ? 'cardio' : (ex.isUnilateral ? `lado ${sideLabel}` : 'série')} <i class="ri-check-line text-2xl"></i>
                </button>
            </div>
        </div>
    `;

    let selectedRir = 2;
    const defaultRir = document.querySelector(`.rir-btn[data-val="2"]`);
    if (defaultRir) {
        defaultRir.classList.replace('bg-gray-50', 'bg-brand-600');
        defaultRir.classList.replace('text-gray-400', 'text-white');
    }

    document.querySelectorAll('.rir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.rir-btn').forEach(b => {
                b.classList.remove('bg-brand-600', 'text-white');
                b.classList.add('bg-gray-50', 'text-gray-400');
            });
            e.target.classList.remove('bg-gray-50', 'text-gray-400');
            e.target.classList.add('bg-brand-600', 'text-white');
            selectedRir = e.target.getAttribute('data-val');
        });
    });

    document.getElementById('save-set-btn').addEventListener('click', () => {
        const load = document.getElementById('input-load').value;
        const reps = document.getElementById('input-reps').value;

        if (!load || !reps) {
            return alert(`Por favor, preencha ${ex.isCardio ? 'a velocidade e os minutos' : 'a carga e as repetições'}. 💪`);
        }

        // Importante: o Firestore rejeita gravações com campos "undefined"
        // (erro invalid-argument), então só incluímos "side" quando o
        // exercício é unilateral, e sempre gravamos isCardio como booleano.
        const setEntry = {
            set: currentSet,
            load: Number(load),
            reps: Number(reps),
            rir: Number(selectedRir),
            isCardio: !!ex.isCardio
        };
        if (ex.isUnilateral) setEntry.side = sideLabel;
        exerciseLog.push(setEntry);

        // Exercício unilateral: faz o lado Esquerdo logo em seguida,
        // SEM descanso entre os lados — o descanso conta uma vez por série,
        // cobrindo os dois lados.
        if (ex.isUnilateral && currentSide === 'D') {
            currentSide = 'E';
            persistSession();
            renderExerciseSession();
            return;
        }
        currentSide = 'D'; // reset para a próxima série

        if (currentSet < ex.sets) {
            currentSet++;
            persistSession();
            startRest(ex.rest);
        } else {
            sessionLog.push({ exerciseId: ex.id, name: ex.name, log: exerciseLog, isCardio: !!ex.isCardio, isUnilateral: !!ex.isUnilateral });

            const exIndex = currentWorkout.exercises.findIndex(e => e.id === ex.id);
            if (exIndex !== -1) {
                currentWorkout.exercises[exIndex].load = Number(load);
            }

            exerciseLog = [];
            currentExerciseIndex++;
            currentSet = 1;
            currentSide = 'D';
            persistSession();

            if (currentExerciseIndex < currentWorkout.exercises.length) {
                iniciarDescansoEntreExercicios(90);
            }

            renderExerciseSession();
        }
    });

    document.getElementById('skip-btn').addEventListener('click', () => {
        sessionLog.push({ exerciseId: ex.id, name: ex.name, skipped: true });
        exerciseLog = [];
        currentExerciseIndex++;
        currentSet = 1;
        currentSide = 'D';
        persistSession();
        renderExerciseSession();
    });

    // Retoma cronômetros que já estavam correndo (após F5, troca de tela
    // ou reabertura do app) — calculados pelo horário real, não perdidos.
    if (restEndTime) {
        const remaining = Math.round((restEndTime - Date.now()) / 1000);
        if (remaining > 0) startRest(null, true);
        else finishRestTimer();
    }
    if (transitionEndTime) {
        const remaining = Math.round((transitionEndTime - Date.now()) / 1000);
        if (remaining > 0) iniciarDescansoEntreExercicios(null, true);
        else finishTransitionTimer();
    }
}

// --- Descanso ENTRE SÉRIES (dentro do mesmo exercício) ---
function startRest(seconds, resume = false) {
    const inputsArea = document.getElementById('inputs-area');
    const restDiv = document.getElementById('rest-timer');
    const display = document.getElementById('timer-display');
    if (inputsArea) inputsArea.classList.add('hidden');
    if (restDiv) restDiv.classList.remove('hidden');

    if (!resume) {
        restEndTime = Date.now() + seconds * 1000;
        persistSession();
    }

    const tick = () => {
        if (restEndTime == null) { clearInterval(restInterval); return; }
        const remaining = Math.max(0, Math.round((restEndTime - Date.now()) / 1000));
        const d = document.getElementById('timer-display');
        if (d) d.innerText = formatTime(remaining);
        if (remaining <= 0) finishRestTimer();
    };
    tick();

    clearInterval(restInterval);
    restInterval = setInterval(tick, 1000);

    const skipBtn = document.getElementById('skip-rest-btn');
    if (skipBtn) skipBtn.onclick = () => finishRestTimer();
}

function finishRestTimer() {
    clearInterval(restInterval);
    const wasActive = restEndTime !== null;
    restEndTime = null;
    persistSession();

    const inputsArea = document.getElementById('inputs-area');
    const restDiv = document.getElementById('rest-timer');
    if (inputsArea) inputsArea.classList.remove('hidden');
    if (restDiv) restDiv.classList.add('hidden');

    if (currentWorkout) {
        const ex = currentWorkout.exercises[currentExerciseIndex];
        const serieInfo = document.getElementById('serie-info');
        if (ex && serieInfo) serieInfo.innerText = `Série ${currentSet} de ${ex.sets}`;
        const sideBadge = document.getElementById('side-badge');
        if (ex && ex.isUnilateral && sideBadge) sideBadge.innerHTML = `<i class="ri-arrow-left-right-line"></i> Lado Direito`;
    }

    if (wasActive) notifyRestOver('Descanso terminado — hora da próxima série! 💪');
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Descanso ENTRE EXERCÍCIOS (banner no topo) ---
function iniciarDescansoEntreExercicios(seconds, resume = false) {
    clearInterval(transitionInterval);

    const banner = document.getElementById('rest-banner');
    const displayTempo = document.getElementById('rest-time-left');

    if (!resume) {
        transitionEndTime = Date.now() + seconds * 1000;
        persistSession();
        if ('vibrate' in navigator) navigator.vibrate(50);
    }

    if (banner) banner.style.display = 'block';

    const tick = () => {
        if (transitionEndTime == null) { clearInterval(transitionInterval); return; }
        const remaining = Math.max(0, Math.round((transitionEndTime - Date.now()) / 1000));
        const d = document.getElementById('rest-time-left');
        if (d) d.innerText = remaining;
        if (remaining <= 0) finishTransitionTimer();
    };
    tick();

    transitionInterval = setInterval(tick, 1000);
}

function finishTransitionTimer() {
    clearInterval(transitionInterval);
    const wasActive = transitionEndTime !== null;
    transitionEndTime = null;
    persistSession();

    const banner = document.getElementById('rest-banner');
    if (banner) banner.style.display = 'none';

    if (wasActive) notifyRestOver('Descanso entre exercícios terminado!');
}

async function finishWorkout() {
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-40 px-4 text-center space-y-4 max-w-md mx-auto">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <i class="ri-check-line text-4xl text-green-600 animate-pulse"></i>
            </div>
            <h2 class="text-3xl font-black text-gray-900">Treino concluído!</h2>
            <p id="finish-status" class="text-gray-500">Estamos salvando seu progresso...</p>
        </div>`;

    localStorage.setItem('customWorkouts', JSON.stringify(CUSTOM_WORKOUTS));

    const finishedWorkoutId = currentWorkout.id;
    const finishedLog = sessionLog;

    const result = await saveSessionLog(finishedWorkoutId, finishedLog);
    const statusEl = document.getElementById('finish-status');

    if (result.ok) {
        clearPersistedSession();
        currentWorkout = null;
        navigate('home');
    } else {
        // Não perde o treino: guarda no aparelho e tenta sincronizar depois.
        savePendingLocally(finishedWorkoutId, finishedLog);
        clearPersistedSession();
        currentWorkout = null;
        if (statusEl) {
            statusEl.innerHTML = `Não foi possível salvar no histórico online agora (${result.error || 'erro desconhecido'}).<br>Seu treino foi guardado neste aparelho e o app vai tentar sincronizar automaticamente.`;
            statusEl.classList.add('text-red-500', 'font-medium');
        }
        setTimeout(() => navigate('home'), 5000);
    }
}

async function renderHistory() {
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-32 space-y-4 max-w-md mx-auto">
            <i class="ri-loader-4-line text-4xl text-brand-500 animate-spin"></i>
            <h2 class="text-gray-500 font-medium">Carregando seu histórico...</h2>
        </div>`;
    const history = await getHistoryLogs();
    const pending = getPendingLogs();

    app.innerHTML = `
        <div class="max-w-md mx-auto pb-24 px-2 pt-4">
            <h2 class="text-2xl font-extrabold text-gray-900 mb-6 px-1">Seu Histórico</h2>

            ${pending.length ? `
            <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold p-3 rounded-2xl mb-4 flex items-center justify-between gap-2">
                <span>⏳ ${pending.length} treino(s) aguardando sincronização.</span>
                <button id="sync-now-btn" class="bg-yellow-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">Sincronizar</button>
            </div>` : ''}

            <div class="space-y-4">
                ${history.length === 0 && pending.length === 0 ? `
                    <div class="bg-gray-50 p-10 rounded-3xl border border-gray-100 text-center">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="ri-file-list-3-line text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-gray-600 font-medium text-lg">Nenhum treino salvo</p>
                        <p class="text-sm text-gray-400 mt-2">Os treinos que você concluir aparecerão aqui.</p>
                    </div>
                ` : ''}

                ${pending.map(p => `
                    <div class="bg-yellow-50/60 p-6 rounded-3xl border border-yellow-100 shadow-sm relative">
                        <span class="absolute top-5 right-5 text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-lg">Pendente</span>
                        <h3 class="font-extrabold text-gray-900 pr-20 text-lg">${CUSTOM_WORKOUTS.find(w => w.id === p.workoutId)?.name || 'Treino'}</h3>
                        <p class="text-xs text-gray-400 mt-1">${new Date(p.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} • salvo apenas neste aparelho</p>
                    </div>
                `).join('')}

                ${history.map(h => `
                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <button onclick="deleteLogHandler('${h.id}')" class="absolute top-5 right-5 text-gray-400 bg-gray-50 p-2.5 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors" aria-label="Excluir treino">
                            <i class="ri-delete-bin-line text-lg"></i>
                        </button>

                        <h3 class="font-extrabold text-gray-900 pr-16 text-lg">${CUSTOM_WORKOUTS.find(w => w.id === h.workoutId)?.name || 'Treino'}</h3>
                        <div class="flex items-center gap-2 mt-1.5 mb-5 text-xs font-semibold text-brand-600 bg-brand-50 inline-flex px-2.5 py-1 rounded-lg">
                            <i class="ri-calendar-line"></i>
                            ${h.date ? new Date(h.date?.toDate()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem data'}
                        </div>

                        <div class="space-y-3">
                            ${h.exercises.map(ex => `
                                <div class="bg-gray-50/50 p-3.5 rounded-2xl border border-gray-50">
                                    <span class="font-bold text-gray-800 text-sm block mb-2">${ex.name}</span>
                                    ${ex.skipped ? '<span class="text-gray-400 text-xs font-medium bg-gray-100 px-2 py-1 rounded-md">Pulado</span>' :
                    '<div class="flex flex-wrap gap-2">' + ex.log.map((s, i) => `<span class="bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 shadow-sm"><span class="text-gray-400 font-normal mr-1">${i + 1}ª</span>${s.side ? `<span class="text-brand-500 mr-1">${s.side === 'Direito' ? 'D' : 'E'}</span>` : ''}${s.reps} ${s.isCardio || ex.isCardio ? 'min' : 'reps'} • ${s.load} ${s.isCardio || ex.isCardio ? 'km/h' : 'kg'} <span class="text-brand-500 ml-1">RIR ${s.rir}</span></span>`).join('') + '</div>'}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const syncBtn = document.getElementById('sync-now-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            syncBtn.innerText = 'Sincronizando...';
            await trySyncPendingLogs();
            renderHistory();
        });
    }
}

window.deleteLogHandler = async function (id) {
    if (confirm("Quer mesmo apagar este treino do histórico? A contagem de semanas será reajustada.")) {
        const success = await deleteSessionLog(id);
        if (success) {
            renderHistory();
        } else {
            alert("Não foi possível excluir. Tente novamente.");
        }
    }
};

// =================================================================
// BOOT
// =================================================================
(async function boot() {
    requestNotificationPermission();

    // Tenta reenviar qualquer treino que ficou pendente da última vez.
    trySyncPendingLogs();

    const saved = loadPersistedSession();
    if (saved) {
        restoreSessionFromSaved(saved);
    } else {
        navigate('home');
    }
})();
