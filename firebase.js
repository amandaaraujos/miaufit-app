// Importa o Firebase direto da nuvem
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// COLOQUE SUAS CHAVES AQUI (Apenas o objeto JavaScript)
const firebaseConfig = {
    apiKey: "AIzaSyCGJUABctX_pESoketgsULWzn3nkj_wouE",
    authDomain: "miaufit-web.firebaseapp.com",
    projectId: "miaufit-web",
    storageBucket: "miaufit-web.firebasestorage.app",
    messagingSenderId: "223864063611",
    appId: "1:223864063611:web:cc354033f14de928b1c4de"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ---------------------------------------------------------------
// FILA LOCAL DE PENDÊNCIAS
// Se o salvamento no Firestore falhar (sem internet, regras de
// segurança bloqueando, projeto com problema, etc.) o treino NÃO
// é perdido: fica guardado no localStorage e o app tenta
// sincronizar de novo automaticamente mais tarde.
// ---------------------------------------------------------------
const PENDING_KEY = 'pendingSessionLogs';

export function getPendingLogs() {
    try {
        return JSON.parse(localStorage.getItem(PENDING_KEY)) || [];
    } catch (e) {
        return [];
    }
}

export function savePendingLocally(workoutId, sessionLogs) {
    const pending = getPendingLogs();
    pending.push({
        id: 'local_' + Date.now(),
        workoutId,
        sessionLogs,
        savedAt: Date.now()
    });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function removePendingLog(localId) {
    const pending = getPendingLogs().filter(p => p.id !== localId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

// Função para salvar a execução real no banco.
// Retorna { ok: true } ou { ok: false, error: '<motivo real>' } —
// quem chama decide o que mostrar/fazer, sem alert() escondido aqui.
export async function saveSessionLog(workoutId, sessionLogs) {
    try {
        await addDoc(collection(db, 'session_logs'), {
            workoutId: workoutId,
            date: serverTimestamp(),
            exercises: sessionLogs
        });
        return { ok: true };
    } catch (e) {
        console.error("Erro ao salvar: ", e);
        return { ok: false, error: (e && (e.code || e.message)) || String(e) };
    }
}

// Tenta reenviar tudo que ficou pendente. Chamado automaticamente ao
// abrir o app e também pode ser disparado manualmente pelo usuário.
export async function trySyncPendingLogs() {
    const pending = getPendingLogs();
    if (!pending.length) return { synced: 0, remaining: 0, lastError: null };

    let synced = 0;
    let lastError = null;
    for (const item of pending) {
        const result = await saveSessionLog(item.workoutId, item.sessionLogs);
        if (result.ok) {
            removePendingLog(item.id);
            synced++;
        } else {
            lastError = result.error;
        }
    }
    return { synced, remaining: getPendingLogs().length, lastError };
}

// Função para buscar o histórico
export async function getHistoryLogs() {
    try {
        const q = query(collection(db, 'session_logs'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        const history = [];
        snapshot.forEach((doc) => {
            // AJUSTE: Agora incluímos o id do documento para poder deletar depois
            history.push({ id: doc.id, ...doc.data() });
        });
        return history;
    } catch (e) {
        console.error("Erro ao buscar histórico: ", e);
        return [];
    }
}

// Deletar registro do histórico
export async function deleteSessionLog(id) {
    try {
        await deleteDoc(doc(db, 'session_logs', id));
        return true;
    } catch (e) {
        console.error("Erro ao deletar: ", e);
        return false;
    }
}
