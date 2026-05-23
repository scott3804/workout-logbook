// src/types.ts
import type { Timestamp } from "firebase/firestore"; // Type-only import

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

export interface PersonalRecord {
  maxWeightLbs: number;
  achievedDate: string;
  bestEstimated1RM: number;
}

// Fixed: Swapped out 'any' for the official Firestore Timestamp type
export interface ExerciseMetadata {
  exerciseNames: string[];
  records: Record<string, PersonalRecord>;
  lastUpdated?: Timestamp;
}
