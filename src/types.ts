// src/types.ts
import type { Timestamp } from "firebase/firestore";

export interface SetEntry {
  setNum: number;
  weightLbs: number;
  reps: number;
  rpe: number;
}

export interface Exercise {
  name: string;
  type: "strength" | "cardio";
  tempo?: string;
  sets?: SetEntry[];
  distanceMiles?: number;
  timeMinutes?: number;
  exerciseNotes?: string;
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

// Fixed: Track objects with type info instead of a plain string array
export interface StoredExerciseType {
  name: string;
  type: "strength" | "cardio";
}

export interface ExerciseMetadata {
  exerciseNames: StoredExerciseType[]; // Transformed from string[]
  records: Record<string, PersonalRecord>;
  lastUpdated?: Timestamp;
}
