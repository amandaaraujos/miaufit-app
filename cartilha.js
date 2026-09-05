export const WEEKS = [
    { week: 1, type: "Adaptação (RIR 3)" },
    { week: 2, type: "Adaptação (RIR 3)" },
    { week: 3, type: "Acúmulo (RIR 1-2)" },
    { week: 7, type: "Deload (-30% volume)" }
];

export const WORKOUTS = [
    {
        id: 'inferior_a',
        name: 'Inferior A',
        focus: 'Foco: Quadríceps, Glúteos e controle técnico',
        exercises: [
            { id: 'ia1', name: 'Hip thrust com barra', sets: 3, reps: 15, load: 8, rest: 120 },
            { id: 'ia2', name: 'Agachamento com barra', sets: 3, reps: 15, load: 8, rest: 120 },
            { id: 'ia3', name: 'Afundo búlgaro', sets: 3, reps: 12, load: 0, rest: 120 },
            { id: 'ia4', name: 'Extensão de joelho', sets: 3, reps: 20, load: 5, rest: 60 },
            { id: 'ia5', name: 'Panturrilha', sets: 3, reps: 20, load: 8, rest: 60 },
            { id: 'ia6', name: 'Dead bug', sets: 3, reps: 12, load: 0, rest: 60 }
        ]
    },
    {
        id: 'superior_a',
        name: 'Superior A',
        focus: 'Foco: Costas, Peitoral e estabilidade',
        exercises: [
            { id: 'sa1', name: 'Remada cavalinho', sets: 3, reps: 15, load: 8, rest: 120 },
            { id: 'sa2', name: 'Supino com halteres', sets: 3, reps: 15, load: 4, rest: 120 },
            { id: 'sa3', name: 'Remada unilateral', sets: 3, reps: 15, load: 6, rest: 120 },
            { id: 'sa4', name: 'Desenvolvimento', sets: 3, reps: 12, load: 4, rest: 120 },
            { id: 'sa5', name: 'Elevação lateral', sets: 3, reps: 20, load: 2, rest: 60 },
            { id: 'sa6', name: 'Rosca direta', sets: 3, reps: 15, load: 4, rest: 60 },
            { id: 'sa7', name: 'Tríceps francês', sets: 3, reps: 15, load: 3, rest: 60 }
        ]
    },
    {
        id: 'inferior_b',
        name: 'Inferior B',
        focus: 'Foco: Posterior de coxa, Glúteos e estabilidade',
        exercises: [
            { id: 'ib1', name: 'Stiff', sets: 3, reps: 12, load: 8, rest: 120 },
            { id: 'ib2', name: 'Hip thrust com pausa', sets: 3, reps: 15, load: 8, rest: 120 },
            { id: 'ib3', name: 'Agachamento', sets: 3, reps: 15, load: 8, rest: 120 },
            { id: 'ib4', name: 'Flexão de joelho', sets: 3, reps: 20, load: 5, rest: 60 },
            { id: 'ib5', name: 'Afundo reverso', sets: 3, reps: 12, load: 0, rest: 120 },
            { id: 'ib6', name: 'Panturrilha', sets: 3, reps: 20, load: 8, rest: 60 }
        ]
    },
    {
        id: 'superior_b',
        name: 'Superior B',
        focus: 'Foco: Costas, Peitoral e controle articular',
        exercises: [
            { id: 'sb1', name: 'Remada unilateral', sets: 3, reps: 12, load: 6, rest: 120 },
            { id: 'sb2', name: 'Supino com halteres', sets: 3, reps: 15, load: 4, rest: 120 },
            { id: 'sb3', name: 'Pullover', sets: 3, reps: 15, load: 4, rest: 90 },
            { id: 'sb4', name: 'Desenvolvimento', sets: 3, reps: 15, load: 4, rest: 120 },
            { id: 'sb5', name: 'Elevação lateral', sets: 3, reps: 20, load: 2, rest: 60 },
            { id: 'sb6', name: 'Rosca direta', sets: 3, reps: 15, load: 4, rest: 60 },
            { id: 'sb7', name: 'Tríceps francês', sets: 3, reps: 15, load: 3, rest: 60 }
        ]
    }
];
