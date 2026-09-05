// cartilha.js - Estrutura base dos treinos e semanas

export const WEEKS = [
    { week: 1, type: "Adaptação (RIR 3)" },
    { week: 2, type: "Adaptação (RIR 3)" },
    { week: 3, type: "Acúmulo" },
    { week: 4, type: "Acúmulo" },
    { week: 5, type: "Acúmulo" },
    { week: 6, type: "Transição" },
    { week: 7, type: "DELOAD (Reduza 30-40% volume)" },
    { week: 8, type: "Progressão 2" },
    { week: 9, type: "Progressão 2" },
    { week: 10, type: "Progressão 2" },
    { week: 11, type: "Progressão 2" },
    { week: 12, type: "DELOAD (Reduza 30-40% volume)" },
    { week: 13, type: "Progressão 3" },
    { week: 14, type: "Progressão 3" },
    { week: 15, type: "Progressão 3" },
    { week: 16, type: "Progressão 3" },
    { week: 17, type: "DELOAD (Reduza 30-40% volume)" },
    { week: 18, type: "Bloco final" },
    { week: 19, type: "Bloco final" },
    { week: 20, type: "Bloco final" }
];

export const WORKOUTS = [
    {
        id: 'treino_a',
        name: '🏋️‍♀️ Treino A - Membros Inferiores',
        focus: 'Quadríceps, Glúteos e Panturrilha',
        exercises: [
            { id: 'a_1', name: 'Agachamento Livre / Leg Press', isCardio: false, sets: 3, reps: 10, load: 20, rest: 90 },
            { id: 'a_2', name: 'Cadeira Extensora', isCardio: false, sets: 3, reps: 12, load: 15, rest: 60 },
            { id: 'a_3', name: 'Afundo / Passada', isCardio: false, sets: 3, reps: 10, load: 10, rest: 60 },
            { id: 'a_4', name: 'Gêmeos em Pé (Panturrilha)', isCardio: false, sets: 4, reps: 15, load: 25, rest: 45 }
        ]
    },
    {
        id: 'treino_b',
        name: '💪 Treino B - Membros Superiores',
        focus: 'Costas, Ombros, Peito e Braços',
        exercises: [
            { id: 'b_1', name: 'Puxada Frontal', isCardio: false, sets: 3, reps: 12, load: 20, rest: 60 },
            { id: 'b_2', name: 'Remada Baixa com Triângulo', isCardio: false, sets: 3, reps: 12, load: 20, rest: 60 },
            { id: 'b_3', name: 'Desenvolvimento com Halteres', isCardio: false, sets: 3, reps: 10, load: 6, rest: 60 },
            { id: 'b_4', name: 'Elevação Lateral', isCardio: false, sets: 3, reps: 15, load: 4, rest: 45 },
            { id: 'b_5', name: 'Tríceps Corda', isCardio: false, sets: 3, reps: 12, load: 12, rest: 45 }
        ]
    },
    {
        id: 'treino_c',
        name: '🍑 Treino C - Posterior & Glúteo',
        focus: 'Isquiotibiais, Glúteo Máximo e Core',
        exercises: [
            { id: 'c_1', name: 'Elevação Pélvica', isCardio: false, sets: 4, reps: 10, load: 30, rest: 90 },
            { id: 'c_2', name: 'Stiff com Halteres', isCardio: false, sets: 3, reps: 12, load: 12, rest: 60 },
            { id: 'c_3', name: 'Cadeira Flexora', isCardio: false, sets: 3, reps: 12, load: 20, rest: 60 },
            { id: 'c_4', name: 'Cadeira Abdutora', isCardio: false, sets: 3, reps: 15, load: 30, rest: 45 },
            { id: 'c_5', name: 'Prancha Abdominal', isCardio: false, sets: 3, reps: 45, load: 0, rest: 45 }
        ]
    },
    {
        id: 'treino_cardio',
        name: '🏃‍♀️ Cardio',
        focus: 'Condicionamento físico e resistência cardiovascular',
        exercises: [
            // No cardio, 'load' funciona como a velocidade base inicial e 'reps' como o tempo em minutos
            { id: 'cardio_1', name: 'Esteira', isCardio: true, sets: 1, reps: 30, load: 3.5, rest: 0 }
        ]
    }
];
