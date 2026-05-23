// src/components/ExerciseForm.tsx
import { useState } from "react";
import type { Workout, Exercise, SetEntry } from "../types";

interface ExerciseFormProps {
  workoutHistory: Workout[];
  onAddExercise: (exercise: Exercise) => void;
}

export default function ExerciseForm({
  workoutHistory,
  onAddExercise,
}: ExerciseFormProps) {
  // 1. Scan history and extract unique exercise names
  const historicalExerciseNames = Array.from(
    new Set(
      workoutHistory.flatMap((workout) =>
        workout.exercises.map((ex) => ex.name),
      ),
    ),
  ).sort();

  const [isNewExercise, setIsNewExercise] = useState(
    historicalExerciseNames.length === 0,
  );
  const [exerciseName, setExerciseName] = useState("");
  const [tempo, setTempo] = useState("3110"); // Standard default tempo

  // Set tracking state
  const [sets, setSets] = useState<SetEntry[]>([
    { setNum: 1, weightLbs: 0, reps: 0, rpe: 8 },
  ]);

  const handleAddSet = () => {
    setSets([
      ...sets,
      { setNum: sets.length + 1, weightLbs: 0, reps: 0, rpe: 8 },
    ]);
  };

  const handleSetChange = (
    index: number,
    field: keyof SetEntry,
    value: number,
  ) => {
    const updatedSets = [...sets];
    updatedSets[index] = { ...updatedSets[index], [field]: value };
    setSets(updatedSets);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseName.trim()) return;

    onAddExercise({
      name: exerciseName,
      tempo,
      sets,
    });

    // Reset form state for next exercise
    setExerciseName("");
    setSets([{ setNum: 1, weightLbs: 0, reps: 0, rpe: 8 }]);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 p-4 rounded-xl border border-gray-750 space-y-4 shadow-inner"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
          Add Exercise
        </h3>

        {/* Toggle between Dropdown and Text Input if history exists */}
        {historicalExerciseNames.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsNewExercise(!isNewExercise);
              setExerciseName("");
            }}
            className="text-xs text-blue-400 hover:underline"
          >
            {isNewExercise
              ? "Choose from past exercises"
              : "Create new exercise"}
          </button>
        )}
      </div>

      {/* Exercise Name Selection */}
      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium">
          Exercise Name
        </label>
        {isNewExercise ? (
          <input
            type="text"
            required
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            placeholder="e.g., Incline Dumbbell Press"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
          />
        ) : (
          <select
            required
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="">-- Select an Exercise --</option>
            {historicalExerciseNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tempo Configuration */}
      <div>
        <label className="block text-xs text-gray-400 mb-1 font-medium">
          Tempo (Eccentric-Pause-Concentric-Pause)
        </label>
        <input
          type="text"
          maxLength={4}
          value={tempo}
          onChange={(e) => setTempo(e.target.value)}
          className="w-24 bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm font-mono text-center focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Dynamic Set Input Rows */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 text-center text-[10px] uppercase font-bold text-gray-500">
          <div>Set</div>
          <div>Lbs</div>
          <div>Reps</div>
          <div>RPE</div>
        </div>

        {sets.map((set, index) => (
          <div
            key={set.setNum}
            className="grid grid-cols-4 gap-2 items-center text-center"
          >
            <span className="text-sm font-mono text-gray-400">
              {set.setNum}
            </span>
            <input
              type="number"
              required
              min="0"
              placeholder="0"
              onChange={(e) =>
                handleSetChange(
                  index,
                  "weightLbs",
                  parseFloat(e.target.value) || 0,
                )
              }
              className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm focus:border-emerald-500"
            />
            <input
              type="number"
              required
              min="0"
              placeholder="0"
              onChange={(e) =>
                handleSetChange(index, "reps", parseInt(e.target.value) || 0)
              }
              className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm focus:border-emerald-500"
            />
            <input
              type="number"
              required
              min="1"
              max="10"
              value={set.rpe}
              onChange={(e) =>
                handleSetChange(index, "rpe", parseInt(e.target.value) || 8)
              }
              className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm focus:border-emerald-500 text-amber-400"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleAddSet}
          className="flex-1 bg-gray-700 hover:bg-gray-650 text-xs py-2 rounded-lg font-medium transition"
        >
          + Add Set
        </button>
        <button
          type="submit"
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs text-white py-2 rounded-lg font-medium transition"
        >
          Save Exercise
        </button>
      </div>
    </form>
  );
}
