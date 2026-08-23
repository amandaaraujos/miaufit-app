// ==========================================
// ESTADO GLOBAL DO APLICATIVO
// ==========================================
let treinoAtual = null;
let exercicioAtualIndex = 0;
let seriesConcluidas = 0;
let historicoSessaoAtual = []; // Guarda os dados do treino do dia para enviar ao Firebase

// ==========================================
// 1. INICIALIZAÇÃO DA INTERFACE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updatePhaseTracker();
    renderizarMenuTreinos();
});

function renderizarMenuTreinos() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
        <h2 class="text-xl font-bold text-center mb-4">Selecione o Treino de Hoje</h2>
        <div class="grid grid-cols-1 gap-4">
            <button onclick="iniciarTreino('INFERIOR A')" class="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500 font-bold text-lg text-left flex justify-between items-center">
                Inferior A <span>🦵</span>
            </button>
            <button onclick="iniciarTreino('SUPERIOR A')" class="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500 font-bold text-lg text-left flex justify-between items-center">
                Superior A <span>💪</span>
            </button>
            <button onclick="iniciarTreino('INFERIOR B')" class="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500 font-bold text-lg text-left flex justify-between items-center">
                Inferior B <span>🦵</span>
            </button>
            <button onclick="iniciarTreino('SUPERIOR B')" class="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500 font-bold text-lg text-left flex justify-between items-center">
                Superior B <span>💪</span>
            </button>
        </div>
    `;
}

// ==========================================
// 2. LÓGICA DE EXECUÇÃO DO TREINO
// ==========================================
function iniciarTreino(nomeTreino) {
    // Busca o treino na cartilha.js (assumindo que a variável global da cartilha se chama 'cartilhaTreinos')
    treinoAtual = cartilhaTreinos.find(t => t.nome === nomeTreino);
    exercicioAtualIndex = 0;
    seriesConcluidas = 0;
    historicoSessaoAtual = [];
    
    renderizarExercicioAtual();
}

function renderizarExercicioAtual() {
    const container = document.getElementById('app-container');
    const exercicio = treinoAtual.exercicios[exercicioAtualIndex];
    
    // Recupera configurações salvas no localStorage (se você tiver editado a carga antes)
    const customConfig = JSON.parse(localStorage.getItem('customWorkouts')) || {};
    const chaveConfig = `${treinoAtual.nome}-${exercicio.nome}`;
    const cargaAtual = customConfig[chaveConfig]?.carga || exercicio.cargaInicial;

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6 mb-4">
            <div class="flex justify-between items-start mb-4">
                <h2 class="text-2xl font-bold text-gray-800">${exercicio.nome}</h2>
                <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    ${exercicioAtualIndex + 1} / ${treinoAtual.exercicios.length}
                </span>
            </div>
            
            <p class="text-gray-600 mb-2"><strong>Foco:</strong> ${exercicio.pontoChave}</p>
            <p class="text-gray-600 mb-6"><strong>Meta:</strong> ${exercicio.series} séries de ${exercicio.reps}</p>
            
            <div class="flex flex-col gap-4 mb-6">
                <label class="font-bold text-gray-700">Carga Atual:</label>
                <input type="text" id="carga-input" value="${cargaAtual}" class="border-2 border-gray-300 rounded-lg p-3 w-full text-lg font-bold text-center">
            </div>

            <div class="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-6">
                <span class="font-bold text-gray-700">Séries Concluídas:</span>
                <span class="text-2xl font-bold text-blue-600">${seriesConcluidas} / ${exercicio.series}</span>
            </div>

            <button onclick="registrarSerie(${exercicio.series})" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-colors text-lg">
                ✅ Concluir Série
            </button>
        </div>
    `;
}

function registrarSerie(totalSeries) {
    seriesConcluidas++;
    const cargaUsada = document.getElementById('carga-input').value;
    const exercicio = treinoAtual.exercicios[exercicioAtualIndex];

    // Salva a carga atualizada no localStorage para os próximos treinos
    const customConfig = JSON.parse(localStorage.getItem('customWorkouts')) || {};
    const chaveConfig = `${treinoAtual.nome}-${exercicio.nome}`;
    customConfig[chaveConfig] = { carga: cargaUsada };
    localStorage.setItem('customWorkouts', JSON.stringify(customConfig));

    if (seriesConcluidas >= totalSeries) {
        // Salva os dados desse exercício para o log do Firebase
        historicoSessaoAtual.push({
            exercicio: exercicio.nome,
            carga: cargaUsada,
            series: totalSeries,
            data: new Date().toISOString()
        });

        avancarProximoExercicio();
    } else {
        // Atualiza a tela para mostrar que a série subiu
        renderizarExercicioAtual();
    }
}

function avancarProximoExercicio() {
    exercicioAtualIndex++;
    seriesConcluidas = 0; // Zera as séries para o próximo exercício

    if (exercicioAtualIndex < treinoAtual.exercicios.length) {
        // Dispara o alerta de descanso apenas se houver um próximo exercício
        iniciarDescansoEntreExercicios();
        renderizarExercicioAtual();
    } else {
        finalizarTreino();
    }
}

function finalizarTreino() {
    const container = document.getElementById('app-container');
    container.innerHTML = `
        <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-6 rounded-lg shadow-md text-center mt-10">
            <h2 class="text-3xl mb-4">🎉</h2>
            <h2 class="text-2xl font-bold mb-2">Treino Concluído!</h2>
            <p>Excelente trabalho. Seus dados estão sendo salvos.</p>
            <button onclick="renderizarMenuTreinos()" class="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-colors">
                Voltar ao Menu
            </button>
        </div>
    `;

    // -------------------------------------------------------------
    // INTEGRAÇÃO COM FIREBASE
    // Chame a sua função 'saveSessionLog' aqui, passando 'historicoSessaoAtual'
    // Exemplo: saveSessionLog(treinoAtual.nome, historicoSessaoAtual);
    // -------------------------------------------------------------

    // GATILHO DO DIA ZERO PARA A PERIODIZAÇÃO
    // Registra a data de início oficial apenas após completar o primeiro treino
    if (!localStorage.getItem('miaufit_start_date')) {
        localStorage.setItem('miaufit_start_date', new Date().toISOString());
    }
    
    // Atualiza a barrinha azul de fase imediatamente
    updatePhaseTracker();
}

// ==========================================
// 3. SISTEMA DE CRONÔMETRO ENTRE EXERCÍCIOS
// ==========================================
let transitionTimerInterval;

function iniciarDescansoEntreExercicios() {
    clearInterval(transitionTimerInterval);
    
    let tempoRestante = 90;
    const banner = document.getElementById('rest-banner');
    const displayTempo = document.getElementById('rest-time-left');
    
    if (banner) banner.style.display = 'block';
    if (displayTempo) displayTempo.innerText = tempoRestante;
    
    // Vibração leve ao iniciar
    if ('vibrate' in navigator) navigator.vibrate(50);

    transitionTimerInterval = setInterval(() => {
        tempoRestante--;
        if (displayTempo) displayTempo.innerText = tempoRestante;
        
        if (tempoRestante <= 0) {
            clearInterval(transitionTimerInterval);
            if (banner) banner.style.display = 'none';
            // Vibração longa avisando que o descanso acabou
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]); 
        }
    }, 1000);
}

// ==========================================
// 4. RASTREADOR DE FASES DA CARTILHA
// ==========================================
function updatePhaseTracker() {
    const trackerDisplay = document.getElementById('phase-tracker');
    const startDateString = localStorage.getItem('miaufit_start_date');
    
    if (!startDateString) {
        if (trackerDisplay) trackerDisplay.innerText = "Fase atual: Aguardando o primeiro treino...";
        return;
    }

    const startDate = new Date(startDateString);
    const now = new Date();
    
    const diffTime = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Proteção caso a data do sistema mude acidentalmente
    const currentWeek = diffDays < 0 ? 1 : Math.floor(diffDays / 7) + 1;
    
    let phase = "";

    // Estrutura de progressão baseada no PDF
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

    if (trackerDisplay) {
        trackerDisplay.innerText = `Semana ${currentWeek} - Fase atual: ${phase}`;
    }
}
