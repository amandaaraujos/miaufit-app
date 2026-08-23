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

// Função para salvar a execução real no banco
export async function saveSessionLog(workoutId, sessionLogs) {
    try {
        await addDoc(collection(db, 'session_logs'), {
            workoutId: workoutId,
            date: serverTimestamp(),
            exercises: sessionLogs
        });
        alert("Treino salvo com sucesso no Histórico!");
    } catch (e) {
        console.error("Erro ao salvar: ", e);
        alert("Erro ao salvar o treino.");
    }
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

// NOVA FUNÇÃO: Deletar registro do histórico
export async function deleteSessionLog(id) {
    try {
        await deleteDoc(doc(db, 'session_logs', id));
        return true;
    } catch (e) {
        console.error("Erro ao deletar: ", e);
        return false;
    }
}