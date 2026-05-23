// src/services/workoutService.ts
import {
  doc,
  getDoc,
  writeBatch,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import type { Workout, Exercise, ExerciseMetadata } from "../types"; // Type-only imports

function calculate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
}

export async function fetchExerciseMetadata(
  userId: string,
): Promise<ExerciseMetadata> {
  const metaRef = doc(db, `users/${userId}/meta/exercises`);
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists()) {
    return metaSnap.data() as ExerciseMetadata;
  }
  return { exerciseNames: [], records: {} };
}

export async function saveWorkoutSession(
  userId: string,
  workoutData: Workout,
  currentMeta: ExerciseMetadata, // Swapped 'any' for strict ExerciseMetadata type
): Promise<void> {
  const batch = writeBatch(db);
  const dateId = workoutData.date;

  const workoutRef = doc(
    db,
    `users/${userId}/workouts/${dateId}-${workoutData.routine.toLowerCase().replace(/\s+/g, "-")}`,
  );
  batch.set(workoutRef, { ...workoutData, createdAt: Timestamp.now() });

  const uniqueNames: string[] = [];
  const updatedRecords = { ...currentMeta.records };

  workoutData.exercises.forEach((ex: Exercise) => {
    uniqueNames.push(ex.name);

    let topWeight = 0;
    let max1RM = 0;
    let totalVolume = 0;

    ex.sets.forEach((set) => {
      totalVolume += set.weightLbs * set.reps;
      if (set.weightLbs > topWeight) topWeight = set.weightLbs;

      const current1RM = calculate1RM(set.weightLbs, set.reps);
      if (current1RM > max1RM) max1RM = current1RM;
    });

    const snapshot = {
      date: dateId,
      topWeightLbs: topWeight,
      totalVolumeLbs: totalVolume,
      bestEstimated1RM: max1RM,
    };

    const exerciseSlug = ex.name.toLowerCase().replace(/\s+/g, "-");
    const chartRef = doc(db, `users/${userId}/exercises/${exerciseSlug}`);
    batch.set(
      chartRef,
      {
        exerciseName: ex.name,
        history: arrayUnion(snapshot),
      },
      { merge: true },
    );

    const pastBest = updatedRecords[ex.name]?.bestEstimated1RM || 0;
    if (max1RM > pastBest) {
      updatedRecords[ex.name] = {
        maxWeightLbs: topWeight,
        achievedDate: dateId,
        bestEstimated1RM: max1RM,
      };
    }
  });

  const metaRef = doc(db, `users/${userId}/meta/exercises`);
  batch.set(
    metaRef,
    {
      exerciseNames: arrayUnion(...uniqueNames),
      records: updatedRecords,
      lastUpdated: Timestamp.now(),
    },
    { merge: true },
  );

  await batch.commit();
}
