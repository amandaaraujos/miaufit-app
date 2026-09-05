import { WEEKS, WORKOUTS } from './cartilha.js';
import { saveSessionLog, getHistoryLogs, deleteSessionLog } from './firebase.js';

// --- ESCUDO ANTI-TELA-BRANCA ---
// Se houver falha (ex: CORS, banco de dados off), ele mostra na tela.
window.onerror = function(msg, url, lineNo) {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.innerHTML = `
        <div class="p-6 m-4 bg-red-50 border border-red-200 rounded-xl">
            <h3 class="font-bold text-red-700 mb-2">Erro de Carregamento</h3>
            <p class="text-xs text-red-600 font-mono break-all">${msg}</p>
            <p class="text-xs text-red-500 mt-2">Linha: ${lineNo}</p>
        </div>`;
    }
};

// --- ESTADO DA APLICAÇÃO ---
let currentWorkout = null;
let currentExerciseIndex = 0;
let currentLog = [];
let cycleCounter = 1; 
let restInterval = null;

// --- EXPOSIÇÃO GLOBAL PARA O HTML ---
window.navigate = navigate;
window.startWorkout = startWorkout;
window.nextExercise = nextExercise;
window.deleteLog = deleteLog;

// --- INICIALIZAÇÃO BLINDADA ---
function initApp() {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        navigate('home');
    } else {
        // Se o DOM ainda não existe, tenta de novo em 100ms
        setTimeout(initApp, 100);
    }
}
initApp();

// --- ROTEAMENTO ---
function navigate(view) {
    const appContent = document.getElementById('app-content');
    if (!appContent) return; 
    
    appContent.innerHTML = ''; 
    hideRestTimer(); 

    if (view === 'home') {
        renderHome(appContent);
    } else if (view === 'history') {
        renderHistory(appContent);
    }
}

// --- TELA HOME (Lista de Treinos) ---
function renderHome(container) {
    let html = `<div class="p-4 pb-24 max-w-md mx-auto">
        <h1 class="text-2xl font-black text-brand-900 mb-6">Meus Treinos</h1>
        <div class="space-y-4">`;
    
    WORKOUTS.forEach(workout => {
        html += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
                <div>
                    <h2 class="text-lg font-bold text-gray-800">${workout.name}</h2>
                    <p class="text-sm text-gray-500">${workout.focus}</p>
                </div>
                <button onclick="window.startWorkout('${workout.id}')" class="bg-brand-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform w-full">
                    Iniciar Treino
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.innerHTML = html;
}

// --- LÓGICA DE EXECUÇÃO DO TREINO ---
function startWorkout(workoutId) {
    currentWorkout = WORKOUTS.find(w => w.id === workoutId);
    currentExerciseIndex = 0;
    currentLog = [];
    renderCurrentExercise();
}

function renderCurrentExercise() {
    const container = document.getElementById('app-content');
    const exercise = currentWorkout.exercises[currentExerciseIndex];
    const isLastExercise = currentExerciseIndex === currentWorkout.exercises.length - 1;

    let inputAreaHtml = '';

    if (exercise.isCardio) {
        const targetSpeed = exercise.load + ((cycleCounter - 1) * 0.5);
        
        inputAreaHtml = `
            <div class="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                <p class="text-sm text-blue-800 mb-4 flex items-center gap-2">
                    <i class="ri-information-line"></i> Meta do Ciclo ${cycleCounter}: <strong>${targetSpeed.toFixed(1)} km/h</strong>
                </p>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Tempo (min)</label>
                        <input type="number" id="cardio-time" value="${exercise.reps}" class="w-full p-3 rounded-lg border border-gray-200 text-lg font-bold text-center">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Velocidade (km/h)</label>
                        <input type="number" id="cardio-speed" step="0.1" value="${targetSpeed.toFixed(1)}" class="w-full p-3 rounded-lg border border-gray-200 text-lg font-bold text-center">
                    </div>
                </div>
            </div>
        `;
    } else {
        inputAreaHtml = `
            <div class="space-y-4 mb-6">
                <div class="flex justify-between items-center text-sm font-bold text-gray-500 px-2">
                    <span>Meta: ${exercise.sets}x${exercise.reps}</span>
                    <span>Carga base: ${exercise.load}kg</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">Carga (kg)</label>
                        <input type="number" id="musc-load" value="${exercise.load}" class="w-full p-3 rounded-lg border border-gray-200 text-lg font-bold text-center">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">Repetições</label>
                        <input type="number" id="musc-reps" value="${exercise.reps}" class="w-full p-3 rounded-lg border border-gray-200 text-lg font-bold text-center">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1 text-center">RIR</label>
                        <select id="musc-rir" class="w-full p-3 rounded-lg border border-gray-200 text-lg font-bold text-center appearance-none bg-white">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3" selected>3</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="p-4 pb-24 max-w-md mx-auto">
            <div class="flex justify-between items-center mb-6">
                <button onclick="window.navigate('home')" class="text-gray-400 hover:text-gray-800"><i class="ri-arrow-left-s-line text-3xl"></i></button>
                <span class="text-sm font-bold text-gray-400">Exercício ${currentExerciseIndex + 1} de ${currentWorkout.exercises.length}</span>
                <div class="w-8"></div>
            </div>
            
            <h2 class="text-3xl font-black text-brand-900 mb-2 leading-tight">${exercise.name}</h2>
            
            ${inputAreaHtml}

            <button onclick="window.nextExercise()" class="bg-brand-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform w-full shadow-lg shadow-brand-500/30 text-lg flex items-center justify-center gap-2">
                ${isLastExercise ? 'Concluir Treino <i class="ri-check-double-line"></i>' : 'Próximo Exercício <i class="ri-arrow-right-line"></i>'}
            </button>
        </div>
    `;
}

function nextExercise() {
    const exercise = currentWorkout.exercises[currentExerciseIndex];
    
    if (exercise.isCardio) {
        currentLog.push({
            id: exercise.id,
            name: exercise.name,
            isCardio: true,
            time: document.getElementById('cardio-time').value,
            speed: document.getElementById('cardio-speed').value
        });
    } else {
        currentLog.push({
            id: exercise.id,
            name: exercise.name,
            isCardio: false,
            load: document.getElementById('musc-load').value,
            reps: document.getElementById('musc-reps').value,
            rir: document.getElementById('musc-rir').value
        });
    }

    const isLastExercise = currentExerciseIndex === currentWorkout.exercises.length - 1;

    if (isLastExercise) {
        finishWorkout();
    } else {
        currentExerciseIndex++;
        triggerRestTimer(90); 
        renderCurrentExercise();
    }
}

async function finishWorkout() {
    const container = document.getElementById('app-content');
    container.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center p-4">
            <i class="ri-loader-4-line text-4xl text-brand-500 animate-spin mb-4"></i>
            <p class="font-bold text-gray-500">Salvando treino no Firebase...</p>
        </div>
    `;
    
    const success = await saveSessionLog(currentWorkout.id, currentLog);
    
    if (success !== false) { // Ajuste fino caso a função não retorne true explícito
        navigate('history');
    } else {
        alert("Erro ao salvar o treino. Verifique sua conexão e tente novamente.");
        renderCurrentExercise();
    }
}

// --- TELA DE HISTÓRICO ---
async function renderHistory(container) {
    container.innerHTML = `
        <div class="p-4 pb-24 max-w-md mx-auto">
            <h1 class="text-2xl font-black text-brand-900 mb-6">Histórico</h1>
            <div id="history-list" class="space-y-4">
                <div class="flex justify-center p-8"><i class="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i></div>
            </div>
        </div>
    `;

    const historyData = await getHistoryLogs();
    const historyList = document.getElementById('history-list');
    
    if (!historyData || historyData.length === 0) {
        historyList.innerHTML = '<p class="text-gray-400 text-center py-8 bg-gray-50 rounded-xl">Nenhum treino registrado ainda.</p>';
        return;
    }

    let html = '';
    historyData.forEach(log => {
        const dateObj = log.date?.toDate ? log.date.toDate() : new Date(log.date || Date.now());
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        
        const workoutRef = WORKOUTS.find(w => w.id === log.workoutId);
        const workoutName = workoutRef ? workoutRef.name : 'Treino Removido da Base';

        html += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-gray-800">${workoutName}</h3>
                        <span class="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md mt-1 inline-block">${dateStr}</span>
                    </div>
                    <button onclick="window.deleteLog('${log.id}')" class="text-gray-300 hover:text-red-500 transition-colors p-2 -mr-2 -mt-2">
                        <i class="ri-delete-bin-line text-lg"></i>
                    </button>
                </div>
                <div class="space-y-2 mt-3 pt-3 border-t border-gray-50">
        `;

        if (log.exercises && Array.isArray(log.exercises)) {
            log.exercises.forEach(ex => {
                if (ex.isCardio) {
                    html += `<p class="text-[13px] text-gray-600"><span class="font-bold text-gray-700">${ex.name}:</span> ${ex.time} min a ${ex.speed} km/h</p>`;
                } else {
                    html += `<p class="text-[13px] text-gray-600"><span class="font-bold text-gray-700">${ex.name}:</span> ${ex.load}kg | ${ex.reps} reps | RIR ${ex.rir}</p>`;
                }
            });
        }

        html += `</div></div>`;
    });

    historyList.innerHTML = html;
}

// Função global para deletar do histórico
async function deleteLog(id) {
    if(confirm('Você tem certeza que deseja excluir este treino do histórico?')) {
        await deleteSessionLog(id);
        navigate('history');
    }
}

// --- GERENCIAMENTO DO TIMER DE TRANSIÇÃO ---
function triggerRestTimer(seconds) {
    const banner = document.getElementById('rest-banner');
    const timeDisplay = document.getElementById('rest-time-left');
    
    if (restInterval) clearInterval(restInterval);
    
    let timeLeft = seconds;
    timeDisplay.innerText = timeLeft;
    banner.style.display = 'block';

    restInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft;
        
        if (timeLeft <= 0) {
            hideRestTimer();
        }
    }, 1000);
}

function hideRestTimer() {
    const banner = document.getElementById('rest-banner');
    if (banner) banner.style.display = 'none';
    if (restInterval) clearInterval(restInterval);
}
