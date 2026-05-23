export interface SetEntry {
  setNum: number;
  weightLbs: number;
  reps: number;
  rpe: number;
}

export interface Exercise {
  name: string;
  tempo: string;
  sets: SetEntry[];
}

export interface Workout {
  workoutId: string;
  date: string;
  routine: string;
  bodyWeightLbs: number;
  notes: string;
  exercises: Exercise[];
}
