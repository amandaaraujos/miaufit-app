export const WEEKS = [
    { week: 1, type: "Adaptação (RIR 3)" },
    { week: 2, type: "Adaptação (RIR 3)" },
    { week: 3, type: "Acúmulo (RIR 2)" },
    { week: 4, type: "Acúmulo (RIR 2)" },
    { week: 5, type: "Acúmulo (RIR 2)" },
    { week: 6, type: "Transição" },
    { week: 7, type: "DELOAD" },
    { week: 8, type: "Progressão 2" },
    { week: 9, type: "Progressão 2" },
    { week: 10, type: "Progressão 2" },
    { week: 11, type: "Progressão 2" },
    { week: 12, type: "DELOAD" },
    { week: 13, type: "Progressão 3" },
    { week: 14, type: "Progressão 3" },
    { week: 15, type: "Progressão 3" },
    { week: 16, type: "Progressão 3" },
    { week: 17, type: "DELOAD" },
    { week: 18, type: "Bloco Final" },
    { week: 19, type: "Bloco Final" },
    { week: 20, type: "Bloco Final" }
];

export const WORKOUTS = [
    {
        id: "treino_inferior_a",
        name: "Inferior A",
        focus: "Cadeia posterior e quadríceps (Barra e Halteres)",
        exercises: [
            { id: "inf_a_1", name: "Hip thrust com barra", sets: 3, reps: "10-15", load: 8, rest: "2-3 min", tip: "Pausa no topo" },
            { id: "inf_a_2", name: "Agachamento com barra", sets: 3, reps: "10-15", load: 8, rest: "2-3 min", tip: "Amplitude e controle" },
            { id: "inf_a_3", name: "Afundo búlgaro", sets: 3, reps: "8-12", load: 0, rest: "2 min", tip: "Estabilidade", isUnilateral: true },
            { id: "inf_a_4", name: "Extensão de joelho", sets: 3, reps: "12-20", load: 5, rest: "60-90 s", tip: "Controle", isUnilateral: true },
            { id: "inf_a_5", name: "Panturrilha", sets: 3, reps: "12-20", load: 8, rest: "60-90 s", tip: "Alongamento embaixo" },
            { id: "inf_a_6", name: "Dead bug", sets: 3, reps: "8-12", load: 0, rest: "60 s", tip: "Lombar estável", isUnilateral: true }
        ]
    },
    {
        id: "treino_superior_a",
        name: "Superior A",
        focus: "Empurrar e Puxar Horizontal (Costas, Peito, Ombros e Braços)",
        exercises: [
            { id: "sup_a_1", name: "Remada cavalinho", sets: 3, reps: "10-15", load: 8, rest: "2-3 min", tip: "Escápulas e tronco" },
            { id: "sup_a_2", name: "Supino com halteres", sets: 3, reps: "10-15", load: 4, rest: "2-3 min", tip: "Escápulas estáveis" },
            { id: "sup_a_3", name: "Remada unilateral", sets: 3, reps: "10-15", load: 6, rest: "2 min", tip: "Amplitude" },
            { id: "sup_a_4", name: "Desenvolvimento", sets: 3, reps: "8-12", load: 4, rest: "2 min", tip: "Sem compensar" },
            { id: "sup_a_5", name: "Elevação lateral", sets: 3, reps: "12-20", load: 2, rest: "60-90 s", tip: "Sem balanço" },
            { id: "sup_a_6", name: "Rosca direta", sets: 3, reps: "10-15", load: 4, rest: "60-90 s", tip: "Cotovelos estáveis" },
            { id: "sup_a_7", name: "Tríceps francês", sets: 3, reps: "10-15", load: 3, rest: "60-90 s", tip: "Amplitude confortável" }
        ]
    },
    {
        id: "treino_inferior_b",
        name: "Inferior B",
        focus: "Foco em Glúteos, Cadeia Posterior e Isquiotibiais",
        exercises: [
            { id: "inf_b_1", name: "Stiff", sets: 3, reps: "8-12", load: 8, rest: "2-3 min", tip: "Quadril para trás" },
            { id: "inf_b_2", name: "Hip thrust com pausa", sets: 3, reps: "10-15", load: 8, rest: "2-3 min", tip: "2 s no topo" },
            { id: "inf_b_3", name: "Agachamento", sets: 3, reps: "10-15", load: 8, rest: "2-3 min", tip: "Técnica rigorosa" },
            { id: "inf_b_4", name: "Flexão de joelho", sets: 3, reps: "12-20", load: 5, rest: "60-90 s", tip: "Controle", isUnilateral: true },
            { id: "inf_b_5", name: "Afundo reverso", sets: 3, reps: "8-12", load: 0, rest: "2 min", tip: "Estabilidade", isUnilateral: true },
            { id: "inf_b_6", name: "Panturrilha", sets: 3, reps: "12-20", load: 8, rest: "60-90 s", tip: "Pausa no alongamento" }
        ]
    },
    {
        id: "treino_superior_b",
        name: "Superior B",
        focus: "Puxar e Empurrar Vertical/Inclinado (Costas, Ombros e Braços)",
        exercises: [
            { id: "sup_b_1", name: "Remada unilateral", sets: 3, reps: "8-12", load: 6, rest: "2 min", tip: "Carga com técnica" },
            { id: "sup_b_2", name: "Supino com halteres", sets: 3, reps: "10-15", load: 4, rest: "2-3 min", tip: "Controle" },
            { id: "sup_b_3", name: "Pullover", sets: 3, reps: "10-15", load: 4, rest: "90 s", tip: "Amplitude sem dor" },
            { id: "sup_b_4", name: "Desenvolvimento", sets: 3, reps: "10-15", load: 4, rest: "2 min", tip: "Controle" },
            { id: "sup_b_5", name: "Elevação lateral", sets: 3, reps: "12-20", load: 2, rest: "60-90 s", tip: "Sem balanço" },
            { id: "sup_b_6", name: "Rosca direta", sets: 3, reps: "10-15", load: 4, rest: "60-90 s", tip: "Sem inclinar tronco" },
            { id: "sup_b_7", name: "Tríceps francês", sets: 3, reps: "10-15", load: 3, rest: "60-90 s", tip: "Cotovelos controlados" }
        ]
    },
    {
        id: "treino_cardio",
        name: "Cardio",
        focus: "Condicionamento físico e resistência cardiovascular",
        exercises: [
            { id: "cardio_1", name: "Esteira", sets: 1, reps: 30, load: 3.5, rest: 0, isCardio: true, tip: "Intensidade moderada" }
        ]
    }
];
