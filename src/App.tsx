import { useState, useEffect } from "react";
import type { Workout, Exercise, SetEntry } from "./types";

// Seed initial data if localStorage is empty to test the clipboard immediately
const MOCK_DATA: Workout[] = [
  {
    workoutId: "2026-05-24-workout-a",
    date: "2026-05-24",
    routine: "Workout A",
    bodyWeightLbs: 227.0,
    notes: "Stabilizers felt warm during bench; adjusted slant board angle.",
    exercises: [
      {
        name: "Flat Dumbbell Bench Press",
        tempo: "3110",
        sets: [
          { setNum: 1, weightLbs: 45, reps: 22, rpe: 8 },
          { setNum: 2, weightLbs: 45, reps: 16, rpe: 9 },
          { setNum: 3, weightLbs: 45, reps: 10, rpe: 10 },
        ],
      },
    ],
  },
];

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    const saved = localStorage.getItem("workouts");
    return saved ? JSON.parse(saved) : MOCK_DATA;
  });
  const [copyStatus, setCopyStatus] = useState<string>("Copy Last 10 Workouts");

  useEffect(() => {
    localStorage.setItem("workouts", JSON.stringify(workouts));
  }, [workouts]);

  const copyToClipboard = async () => {
    // Sort descending by date and slice the top 10 rows
    const targetedWorkouts = [...workouts]
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
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans">
      <header className="max-w-md mx-auto mb-6 flex flex-col items-center justify-between border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
          FlexLog
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Prototype V1.0 (Local Storage)
        </p>
      </header>

      <main className="max-w-md mx-auto space-y-4">
        {/* Action Controls */}
        <button
          onClick={copyToClipboard}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-xl transition duration-200 shadow-lg active:scale-[0.98]"
        >
          {copyStatus}
        </button>

        {/* Workout Feed */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">
            Workout History
          </h2>
          {workouts.map((workout) => (
            <div
              key={workout.workoutId}
              className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-md"
            >
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="font-bold text-gray-200 text-lg">
                  {workout.routine}
                </h3>
                <span className="text-sm text-emerald-400 font-mono">
                  {workout.date}
                </span>
              </div>
              <div className="text-xs text-gray-400 mb-3 font-medium">
                Bodyweight:{" "}
                <span className="text-gray-200">
                  {workout.bodyWeightLbs} lbs
                </span>
              </div>

              {workout.notes && (
                <div className="text-sm italic text-gray-400 bg-gray-850 p-2 rounded-lg border-l-2 border-emerald-500 mb-3 bg-gray-900/50">
                  "{workout.notes}"
                </div>
              )}

              <div className="space-y-2">
                {workout.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="bg-gray-900/40 p-3 rounded-lg border border-gray-750"
                  >
                    <div className="flex justify-between text-sm font-semibold mb-1">
                      <span className="text-gray-200">{ex.name}</span>
                      <span className="text-xs font-mono text-gray-400">
                        Tempo: {ex.tempo}
                      </span>
                    </div>

                    {/* Set Headers */}
                    <div className="grid grid-cols-4 text-center text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-800 pb-1 mb-1">
                      <div>Set</div>
                      <div>Lbs</div>
                      <div>Reps</div>
                      <div>RPE</div>
                    </div>

                    {/* Set Rows */}
                    {ex.sets.map((set) => (
                      <div
                        key={set.setNum}
                        className="grid grid-cols-4 text-center text-sm py-0.5 font-mono text-gray-300"
                      >
                        <div>{set.setNum}</div>
                        <div className="text-emerald-400 font-bold">
                          {set.weightLbs}
                        </div>
                        <div>{set.reps}</div>
                        <div className="text-amber-400">{set.rpe}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
