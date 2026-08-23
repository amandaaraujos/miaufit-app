import { WORKOUTS, WEEKS } from './cartilha.js';
import { saveSessionLog, getHistoryLogs, deleteSessionLog } from './firebase.js';

const app = document.getElementById('app-content');

// --- SISTEMA DE VERSIONAMENTO ---
// Quando você mudar as cargas no cartilha.js no futuro, é só mudar esse número (ex: '2.1')
const APP_VERSION = '2.1'; 
let currentVersion = localStorage.getItem('appVersion');

let CUSTOM_WORKOUTS;

if (currentVersion !== APP_VERSION || !localStorage.getItem('customWorkouts')) {
    // Puxa a cartilha nova e atualiza o localStorage
    CUSTOM_WORKOUTS = JSON.parse(JSON.stringify(WORKOUTS));
    localStorage.setItem('customWorkouts', JSON.stringify(CUSTOM_WORKOUTS));
    localStorage.setItem('appVersion', APP_VERSION);
} else {
    // Mantém as edições que você fez pelo próprio aplicativo
    CUSTOM_WORKOUTS = JSON.parse(localStorage.getItem('customWorkouts'));
}
// ---------------------------------

let currentWorkout = null;
let currentExerciseIndex = 0;
let currentSet = 1;
let sessionLog = [];
let exerciseLog = []; 
let restInterval = null;

// --- NOVO: Variável global para o descanso de transição ---
let transitionTimerInterval = null;

window.navigate = function(page, data = null) {
    clearInterval(restInterval);
    
    // --- NOVO: Limpa o timer de transição e esconde o banner ao sair do treino ---
    clearInterval(transitionTimerInterval);
    const banner = document.getElementById('rest-banner');
    if (banner) banner.style.display = 'none';

    if (page === 'home') renderHome();
    if (page === 'configure') renderConfigure(data);
    if (page === 'history') renderHistory();
    if (page === 'session') startWorkoutSession(data);
};

// --- NOVO: Lógica dinâmica de Semanas e Fases ---
function getCurrentWeekInfo() {
    const startDateString = localStorage.getItem('miaufit_start_date');
    if (!startDateString) {
        return { week: 1, type: "Aguardando primeiro treino..." };
    }
    const startDate = new Date(startDateString);
    const diffTime = new Date().getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentWeek = diffDays < 0 ? 1 : Math.floor(diffDays / 7) + 1;
    
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
    
    return { week: currentWeek, type: phase };
}

function renderHome() {
    // --- ATUALIZADO: Agora busca a semana real em vez de ser estático ---
    const currentWeekInfo = getCurrentWeekInfo(); 
    
    app.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 pb-24 px-2">
            <header class="mt-4">
                <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Olá, Amanda! 👋</h1>
                <p class="text-gray-500 mt-1 text-sm">Pronta para o treino de hoje?</p>
            </header>
            
            <div class="bg-gradient-to-r from-brand-50 to-white p-5 rounded-3xl shadow-sm border border-brand-100 flex justify-between items-center">
                <div>
                    <p class="text-[11px] font-bold text-brand-600 tracking-wider uppercase mb-1">Seu Progresso</p>
                    <p class="text-lg font-bold text-gray-900">Semana ${currentWeekInfo.week}</p>
                    <p class="text-sm text-gray-600">${currentWeekInfo.type}</p>
                </div>
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

        if(nameEl) ex.name = nameEl.value || ex.name;
        if(setsEl) ex.sets = Number(setsEl.value) || ex.sets;
        if(repsEl) ex.reps = Number(repsEl.value) || ex.reps;
        if(loadEl) ex.load = Number(loadEl.value) || 0;
        if(restEl) ex.rest = Number(restEl.value) || ex.rest;
    });
}

window.addExercise = function(workoutId) {
    const workout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);
    saveConfigToMemory(workout);
    
    workout.exercises.push({
        id: 'novo_' + Date.now(),
        name: "Novo exercício",
        sets: 3,
        reps: 12,
        load: 0,
        rest: 60
    });
    renderConfigure(workoutId);
};

window.removeExercise = function(workoutId, exerciseId) {
    if(!confirm("Tem certeza que deseja remover este exercício do treino?")) return;
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
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Reps Meta</label>
                                <input type="number" id="cfg-reps-${ex.id}" value="${ex.reps}" class="w-full bg-transparent font-black text-gray-900 text-lg outline-none text-center">
                            </div>
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Carga (kg)</label>
                                <input type="number" id="cfg-load-${ex.id}" value="${ex.load || 0}" class="w-full bg-transparent font-black text-brand-600 text-lg outline-none text-center">
                            </div>
                            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
                                <label class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Pausa (s)</label>
                                <input type="number" id="cfg-rest-${ex.id}" value="${ex.rest}" class="w-full bg-transparent font-black text-gray-900 text-lg outline-none text-center">
                            </div>
                        </div>
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

function startWorkoutSession(workoutId) {
    currentWorkout = CUSTOM_WORKOUTS.find(w => w.id === workoutId);
    currentExerciseIndex = 0;
    currentSet = 1;
    sessionLog = [];
    exerciseLog = [];
    renderExerciseSession();
}

function renderExerciseSession() {
    if (currentExerciseIndex >= currentWorkout.exercises.length) {
        finishWorkout();
        return;
    }

    const ex = currentWorkout.exercises[currentExerciseIndex];

    app.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 pb-24 pt-4 px-2">
            <div class="flex justify-between items-start">
                <div class="w-3/4">
                    <h2 class="text-2xl font-extrabold text-gray-900 leading-tight">${ex.name}</h2>
                    <div class="inline-flex items-center gap-2 mt-2 bg-brand-50 px-3 py-1.5 rounded-xl">
                        <span class="text-brand-700 font-bold text-sm">Série ${currentSet} de ${ex.sets}</span>
                        <span class="w-1 h-1 bg-brand-300 rounded-full"></span>
                        <span class="text-brand-600 text-sm font-medium">Meta: ${ex.reps} reps</span>
                    </div>
                </div>
                <button id="skip-btn" class="text-gray-500 text-sm font-semibold hover:text-gray-800 bg-gray-100 px-4 py-2 rounded-xl transition-colors active:scale-95">Pular</button>
            </div>

            <div id="rest-timer" class="hidden bg-gradient-to-b from-brand-50 to-white p-8 rounded-3xl text-center border border-brand-100 shadow-sm">
                <p class="text-xs text-brand-600 font-bold tracking-widest mb-2 uppercase">Descanso</p>
                <div class="text-6xl font-black text-gray-900 mb-6 font-mono" id="timer-display">00:00</div>
                <button id="skip-rest-btn" class="w-full py-4 bg-white text-gray-900 rounded-2xl text-base font-bold border border-gray-200 shadow-sm active:scale-[0.98] transition-transform">Pular descanso</button>
            </div>

            <div id="inputs-area" class="space-y-4 mt-8">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
                        <label class="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">Carga (kg)</label>
                        <input type="number" id="input-load" value="${ex.load || 0}" class="w-full bg-transparent text-4xl font-black text-brand-600 outline-none text-center" placeholder="0">
                    </div>
                    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
                        <label class="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-2">Repetições</label>
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
                    Registrar série <i class="ri-check-line text-2xl"></i>
                </button>
            </div>
        </div>
    `;

    let selectedRir = 2;
    const defaultRir = document.querySelector(`.rir-btn[data-val="2"]`);
    if(defaultRir) {
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
        if (!load || !reps) return alert("Por favor, preencha a carga e as repetições. 💪");
        
        exerciseLog.push({ set: currentSet, load: Number(load), reps: Number(reps), rir: Number(selectedRir) });
        
        if (currentSet < ex.sets) {
            currentSet++;
            startRest(ex.rest);
        } else {
            sessionLog.push({ exerciseId: ex.id, name: ex.name, log: exerciseLog });
            
            const exIndex = currentWorkout.exercises.findIndex(e => e.id === ex.id);
            if(exIndex !== -1) {
                currentWorkout.exercises[exIndex].load = Number(load);
            }

            exerciseLog = [];
            currentExerciseIndex++;
            currentSet = 1;

            // --- NOVO: Aciona o descanso de 90s apenas se houver mais exercícios pela frente ---
            if (currentExerciseIndex < currentWorkout.exercises.length) {
                iniciarDescansoEntreExercicios();
            }

            renderExerciseSession();
        }
    });

    document.getElementById('skip-btn').addEventListener('click', () => {
        sessionLog.push({ exerciseId: ex.id, name: ex.name, skipped: true });
        exerciseLog = [];
        currentExerciseIndex++;
        currentSet = 1;
        renderExerciseSession();
    });
}

function startRest(seconds) {
    document.getElementById('inputs-area').classList.add('hidden');
    const restDiv = document.getElementById('rest-timer');
    const display = document.getElementById('timer-display');
    const headerDisplay = document.querySelector('.inline-flex'); 
    
    if (headerDisplay) headerDisplay.classList.add('hidden');
    restDiv.classList.remove('hidden');

    let time = seconds;
    display.innerText = formatTime(time);

    restInterval = setInterval(() => {
        time--;
        display.innerText = formatTime(time);
        if (time <= 0) endRest();
    }, 1000);

    document.getElementById('skip-rest-btn').onclick = endRest;

    function endRest() {
        clearInterval(restInterval);
        document.getElementById('inputs-area').classList.remove('hidden');
        restDiv.classList.add('hidden');
        if (headerDisplay) headerDisplay.classList.remove('hidden');
        
        const ex = currentWorkout.exercises[currentExerciseIndex];
        const serieInfo = document.querySelector('.inline-flex span:first-child');
        if (serieInfo) serieInfo.innerText = `Série ${currentSet} de ${ex.sets}`;
    }
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

async function finishWorkout() {
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-40 px-4 text-center space-y-4 max-w-md mx-auto">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <i class="ri-check-line text-4xl text-green-600 animate-pulse"></i>
            </div>
            <h2 class="text-3xl font-black text-gray-900">Treino concluído!</h2>
            <p class="text-gray-500">Estamos salvando seu progresso...</p>
        </div>`;
    
    localStorage.setItem('customWorkouts', JSON.stringify(CUSTOM_WORKOUTS));
    
    // --- NOVO: Grava a data do primeiro dia de treino se ainda não existir ---
    if (!localStorage.getItem('miaufit_start_date')) {
        localStorage.setItem('miaufit_start_date', new Date().toISOString());
    }

    await saveSessionLog(currentWorkout.id, sessionLog);
    navigate('home');
}

async function renderHistory() {
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-32 space-y-4 max-w-md mx-auto">
            <i class="ri-loader-4-line text-4xl text-brand-500 animate-spin"></i>
            <h2 class="text-gray-500 font-medium">Carregando seu histórico...</h2>
        </div>`;
    const history = await getHistoryLogs();
    
    app.innerHTML = `
        <div class="max-w-md mx-auto pb-24 px-2 pt-4">
            <h2 class="text-2xl font-extrabold text-gray-900 mb-6 px-1">Seu Histórico</h2>
            <div class="space-y-4">
                ${history.length === 0 ? `
                    <div class="bg-gray-50 p-10 rounded-3xl border border-gray-100 text-center">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="ri-file-list-3-line text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-gray-600 font-medium text-lg">Nenhum treino salvo</p>
                        <p class="text-sm text-gray-400 mt-2">Os treinos que você concluir aparecerão aqui.</p>
                    </div>
                ` : history.map(h => `
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
                                      '<div class="flex flex-wrap gap-2">' + ex.log.map((s, i) => `<span class="bg-white px-2.5 py-1.5 rounded-xl border border-gray-100 text-xs font-bold text-gray-700 shadow-sm"><span class="text-gray-400 font-normal mr-1">${i+1}ª</span>${s.reps} reps • ${s.load}kg <span class="text-brand-500 ml-1">RIR ${s.rir}</span></span>`).join('') + '</div>'}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.deleteLogHandler = async function(id) {
    if (confirm("Quer mesmo apagar este treino do histórico?")) {
        const success = await deleteSessionLog(id);
        if (success) {
            renderHistory();
        } else {
            alert("Não foi possível excluir. Tente novamente.");
        }
    }
};

// --- NOVO: Função Global do Timer de Descanso de Transição ---
function iniciarDescansoEntreExercicios() {
    clearInterval(transitionTimerInterval);
    
    let tempoRestante = 90;
    const banner = document.getElementById('rest-banner');
    const displayTempo = document.getElementById('rest-time-left');
    
    if (banner) banner.style.display = 'block';
    if (displayTempo) displayTempo.innerText = tempoRestante;
    
    // Vibração suave (se suportado pelo aparelho)
    if ('vibrate' in navigator) navigator.vibrate(50);

    transitionTimerInterval = setInterval(() => {
        tempoRestante--;
        if (displayTempo) displayTempo.innerText = tempoRestante;
        
        if (tempoRestante <= 0) {
            clearInterval(transitionTimerInterval);
            if (banner) banner.style.display = 'none';
            // Alerta tátil ao finalizar
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]); 
        }
    }, 1000);
}

navigate('home');
