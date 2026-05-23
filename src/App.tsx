// src/App.tsx
import { useState, useEffect } from "react";
import {
  fetchExerciseMetadata,
  saveWorkoutSession,
} from "./services/workoutService";
import type { Workout, Exercise, ExerciseMetadata, SetEntry } from "./types";

export default function App() {
  // Core tracking states
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exerciseMeta, setExerciseMeta] = useState<ExerciseMetadata>({
    exerciseNames: [],
    records: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [copyStatus, setCopyStatus] = useState<string>("Copy Last 10 Workouts");

  // Active form state variables
  const [routine, setRoutine] = useState("Workout A");
  const [bodyWeight, setBodyWeight] = useState("227");
  const [notes, setNotes] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const userId = "scott_milholland_dev";

  useEffect(() => {
    async function loadInitialData() {
      try {
        const meta = await fetchExerciseMetadata(userId);
        setExerciseMeta(meta);
      } catch (error) {
        console.error("Error communicating with Cloud Firestore: ", error);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseName.trim() || !weight || !reps) return;

    const todayStr = new Date().toISOString().split("T")[0];

    const sets: SetEntry[] = [
      {
        setNum: 1,
        weightLbs: parseFloat(weight),
        reps: parseInt(reps),
        rpe: 9,
      },
    ];

    const targetExercise: Exercise = {
      name: exerciseName,
      tempo: "3110",
      sets,
    };

    const newWorkout: Workout = {
      workoutId: `${todayStr}-${routine.toLowerCase().replace(/\s+/g, "-")}`,
      date: todayStr,
      routine,
      bodyWeightLbs: parseFloat(bodyWeight) || 0,
      notes,
      exercises: [targetExercise],
    };

    try {
      // Actively uses our save service layer and updates state arrays
      await saveWorkoutSession(userId, newWorkout, exerciseMeta);
      setWorkouts([newWorkout, ...workouts]);

      // Refresh local dropdown metadata cache automatically
      if (!exerciseMeta.exerciseNames.includes(exerciseName)) {
        setExerciseMeta((prev) => ({
          ...prev,
          exerciseNames: [...prev.exerciseNames, exerciseName].sort(),
        }));
      }

      // Reset entry inputs
      setExerciseName("");
      setWeight("");
      setReps("");
      setNotes("");
    } catch (err) {
      console.error("Failed to persist log entry: ", err);
    }
  };

  const copyToClipboard = async () => {
    const dataPool = workouts.length > 0 ? workouts : SEED_FALLBACK;
    const targetedWorkouts = [...dataPool]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(targetedWorkouts, null, 2),
      );
      setCopyStatus("Copied to Clipboard! ✓");
      setTimeout(() => setCopyStatus("Copy Last 10 Workouts"), 2000);
    } catch (err) {
      setCopyStatus("Copy Failed ✗");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-400 flex items-center justify-center font-sans">
        Loading database...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans">
      <header className="max-w-md mx-auto mb-6 flex flex-col items-center border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-emerald-400">FlexLog</h1>
        <p className="text-xs text-gray-400 mt-1">
          Prototype V1.2 (Strict TS Verified)
        </p>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* Dynamic Log Entry Box */}
        <form
          onSubmit={handleLogWorkout}
          className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-3 shadow-md"
        >
          <h2 className="text-sm font-bold uppercase text-emerald-400 tracking-wider">
            Log Current Session
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">
                Routine
              </label>
              <input
                type="text"
                value={routine}
                onChange={(e) => setRoutine(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">
                Bodyweight (lbs)
              </label>
              <input
                type="number"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1">
              Exercise Name
            </label>
            <input
              type="text"
              list="past-exercises"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="e.g., Dumbbell Bench Press"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
              required
            />
            <datalist id="past-exercises">
              {exerciseMeta.exerciseNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">
                Weight (lbs)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">
                Reps
              </label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1">
              Session Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the stabilizers feel?"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 font-medium py-2 rounded-lg text-sm mt-2 transition"
          >
            Save Entry to Cloud
          </button>
        </form>

        <button
          onClick={copyToClipboard}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-xl transition shadow-lg"
        >
          {copyStatus}
        </button>

        {/* Local Feed Rendering Display */}
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-gray-300">
            Session History feed
          </h3>
          {(workouts.length > 0 ? workouts : SEED_FALLBACK).map((workout) => (
            <div
              key={workout.workoutId}
              className="bg-gray-800/60 p-4 rounded-xl border border-gray-750"
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-gray-200">
                  {workout.routine}
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  {workout.date}
                </span>
              </div>
              {workout.exercises.map((ex, i) => (
                <div
                  key={i}
                  className="text-sm text-gray-300 mt-1 pl-2 border-l border-emerald-500"
                >
                  {ex.name} — {ex.sets[0].weightLbs} lbs × {ex.sets[0].reps}{" "}
                  reps
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const SEED_FALLBACK: Workout[] = [
  {
    workoutId: "demo-id",
    date: "2026-05-24",
    routine: "Workout A",
    bodyWeightLbs: 227.0,
    notes: "Initial backup trace preset",
    exercises: [
      {
        name: "Flat Dumbbell Bench Press",
        tempo: "3110",
        sets: [{ setNum: 1, weightLbs: 45, reps: 22, rpe: 9 }],
      },
    ],
  },
];
