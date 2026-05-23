import {
  doc,
  collection,
  writeBatch,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { Workout } from "../types"; // Type-only import

/**
 * Saves a workout log and atomically ensures any new exercise names
 * are added to the user's master list using a single database batch.
 */
export async function saveWorkoutWithMeta(
  userId: string,
  workoutData: Workout,
): Promise<void> {
  // 1. Create a batch to execute both operations as a single atomic unit
  const batch = writeBatch(db);

  // 2. Reference for the new workout document
  const workoutRef = doc(collection(db, `users/${userId}/workouts`));
  batch.set(workoutRef, {
    ...workoutData,
    createdAt: Timestamp.now(),
  });

  // 3. Extract exercise names from the incoming workout
  const currentExerciseNames = workoutData.exercises.map((ex) => ex.name);

  // 4. Reference for the single metadata document
  const metaRef = doc(db, `users/${userId}/meta/exercises`);

  // 5. Update the metadata document using arrayUnion (ignores duplicates automatically)
  batch.set(
    metaRef,
    {
      exerciseNames: arrayUnion(...currentExerciseNames),
      lastUpdated: Timestamp.now(),
    },
    { merge: true },
  ); // merge: true creates the document if it doesn't exist yet

  // 6. Commit both operations. Total cost: 1 write for workout, 1 write for meta.
  await batch.commit();
}
