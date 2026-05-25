// src/services/workoutService.ts
import {
  collection,
  doc,
  writeBatch,
  arrayUnion,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type {
  Workout,
  Exercise,
  ExerciseMetadata,
  StoredExerciseType,
} from "../types";

function calculate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
}

/**
 * Scrub any hidden "undefined" fields out of objects before they touch Firestore.
 * Avoids 'any' usage entirely using strict key type indexes.
 */
function scrubUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  });

  return result as Partial<T>;
}

export async function fetchExerciseMetadata(
  userId: string,
): Promise<ExerciseMetadata> {
  const metaRef = doc(db, `users/${userId}/meta/exercises`);
  const metaSnap = await getDoc(metaRef);
  if (metaSnap.exists()) return metaSnap.data() as ExerciseMetadata;
  return { exerciseNames: [], records: {} };
}

export async function saveCompleteWorkout(
  userId: string,
  workout: Workout,
  currentMeta: ExerciseMetadata,
): Promise<void> {
  const batch = writeBatch(db);
  const workoutCollectionRef = collection(db, `users/${userId}/workouts`);

  // Clean the main workout data payload of any hidden undefined sub-properties
  const cleanedExercises = workout.exercises.map((ex) => {
    const baseClean = {
      name: ex.name,
      type: ex.type,
      tempo: ex.tempo || null, // Firebase loves null, hates undefined
      exerciseNotes: ex.exerciseNotes || null,
      sets: ex.sets ? ex.sets.map((s) => ({ ...s })) : null,
      distanceMiles: ex.distanceMiles !== undefined ? ex.distanceMiles : null,
      timeMinutes: ex.timeMinutes !== undefined ? ex.timeMinutes : null,
    };
    return scrubUndefined(baseClean);
  });

  const workoutPayload = {
    workoutId: workout.workoutId,
    date: workout.date,
    routine: workout.routine,
    bodyWeightLbs: workout.bodyWeightLbs,
    notes: workout.notes,
    exercises: cleanedExercises,
    createdAt: Timestamp.now(),
  };

  const workoutRef = doc(workoutCollectionRef, workout.workoutId);
  batch.set(workoutRef, workoutPayload);

  const existingExercisesMap = new Map<string, "strength" | "cardio">(
    currentMeta.exerciseNames?.map((item) => [
      item.name.toLowerCase(),
      item.type,
    ]) || [],
  );

  const updatedRecords = { ...currentMeta.records };

  // Loop through exercises to calculate metrics
  workout.exercises.forEach((ex: Exercise) => {
    existingExercisesMap.set(ex.name.toLowerCase(), ex.type);

    // If it's a cardio entry, do not process strength stats or personal records
    if (ex.type === "cardio") return;

    let topWeight = 0;
    let max1RM = 0;

    ex.sets?.forEach((set) => {
      if (set.weightLbs > topWeight) topWeight = set.weightLbs;
      const current1RM = calculate1RM(set.weightLbs, set.reps);
      if (current1RM > max1RM) max1RM = current1RM;
    });

    const snapshot = {
      date: workout.date,
      topWeightLbs: topWeight,
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
        achievedDate: workout.date,
        bestEstimated1RM: max1RM,
      };
    }
  });

  // Format the metadata names tracking array cleanly
  const finalExerciseNamesArray: StoredExerciseType[] = [];
  existingExercisesMap.forEach((type, name) => {
    const match = currentMeta.exerciseNames?.find(
      (e) => e.name.toLowerCase() === name,
    );
    finalExerciseNamesArray.push({
      name: match ? match.name : name.charAt(0).toUpperCase() + name.slice(1),
      type,
    });
  });

  const metaRef = doc(db, `users/${userId}/meta/exercises`);
  batch.set(
    metaRef,
    {
      exerciseNames: finalExerciseNamesArray,
      records: updatedRecords,
      lastUpdated: Timestamp.now(),
    },
    { merge: true },
  );

  await batch.commit();
}
