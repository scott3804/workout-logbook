import {
  doc,
  getDoc,
  writeBatch,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import type { Workout, Exercise } from "../types"; // Strict type-only import

// Helper formula to calculate Estimated 1-Rep Max (Brzycki Equation)
function calculate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
}

/**
 * Fetches the single master metadata document containing the list
 * of unique exercise names and lifetime personal records.
 * Costs exactly 1 document read.
 */
export async function fetchExerciseMetadata(userId: string) {
  const metaRef = doc(db, `users/${userId}/meta/exercises`);
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists()) {
    return metaSnap.data();
  }
  return { exerciseNames: [], records: {} };
}

/**
 * Saves a complete workout session across three optimized targets
 * using a single, atomic database batch operation.
 * Total Cost: 3 Document Writes. 0 Document Reads.
 */
export async function saveWorkoutSession(
  userId: string,
  workoutData: Workout,
  currentMeta: any,
): Promise<void> {
  const batch = writeBatch(db);
  const dateId = workoutData.date;

  // 1. Write the primary workout log for trainer copy/paste actions
  const workoutRef = doc(
    db,
    `users/${userId}/workouts/${dateId}-${workoutData.routine.toLowerCase().replace(/\s+/g, "-")}`,
  );
  batch.set(workoutRef, {
    ...workoutData,
    createdAt: Timestamp.now(),
  });

  const uniqueNames: string[] = [];
  const updatedRecords = { ...currentMeta?.records };

  // 2. Loop through exercises to construct lightweight chart snapshots
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

    // Append history line item directly to the exercise's dedicated chart array doc
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

    // Assess and update personal record metrics
    const pastBest = updatedRecords[ex.name]?.bestEstimated1RM || 0;
    if (max1RM > pastBest) {
      updatedRecords[ex.name] = {
        maxWeightLbs: topWeight,
        achievedDate: dateId,
        bestEstimated1RM: max1RM,
      };
    }
  });

  // 3. Commit unique text names back to the primary dropdown metadata record
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

  // Atomic confirmation execution
  await batch.commit();
}
