import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { auth, signInWithGoogle, logoutUser } from './services/authService';
import { fetchExerciseMetadata, saveCompleteWorkout } from './services/workoutService';
import type { User } from 'firebase/auth';
import type { Workout, Exercise, ExerciseMetadata, SetEntry } from './types';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exerciseMeta, setExerciseMeta] = useState<ExerciseMetadata>({ exerciseNames: [], records: {} });
  const [loading, setLoading] = useState<boolean>(true);
  const [copyStatus, setCopyStatus] = useState<string>('Copy Last 10 Workouts');

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(display-mode: standalone)').matches;
    }
    return false;
  });

  const [routine, setRoutine] = useState('Workout A');
  const [bodyWeight, setBodyWeight] = useState('227');
  const [notes, setNotes] = useState('');
  
  const [activeExercises, setActiveExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('active_session_exercises');
    return saved ? JSON.parse(saved) : [];
  });

  const [exerciseType, setExerciseType] = useState<'strength' | 'cardio'>('strength');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState('');
  
  const [sets, setSets] = useState<SetEntry[]>([{ setNum: 1, weightLbs: 0, reps: 0, rpe: 8 }]);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    localStorage.setItem('active_session_exercises', JSON.stringify(activeExercises));
  }, [activeExercises]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadMeta() {
      const meta = await fetchExerciseMetadata(user!.uid);
      setExerciseMeta(meta);
    }
    loadMeta();

    const workoutsRef = collection(db, `users/${user.uid}/workouts`);
    const q = query(workoutsRef, orderBy('date', 'desc'), limit(10));
    const unsubscribeHistory = onSnapshot(q, (snapshot) => {
      const historyList: Workout[] = [];
      snapshot.forEach((doc) => historyList.push(doc.data() as Workout));
      setWorkouts(historyList);
      setLoading(false);
    });
    return () => unsubscribeHistory();
  }, [user]);

  const getFilteredDropdownOptions = () => {
    const remoteNames = exerciseMeta.exerciseNames.map(ex => ({ name: ex.name, type: ex.type }));
    activeExercises.forEach(stagedEx => {
      const exists = remoteNames.some(r => r.name.toLowerCase() === stagedEx.name.toLowerCase());
      if (!exists) {
        remoteNames.push({ name: stagedEx.name, type: stagedEx.type });
      }
    });
    return remoteNames
      .filter(ex => ex.type === exerciseType)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleManualTypeToggle = (type: 'strength' | 'cardio') => {
    setExerciseType(type);
    setExerciseName('');
    setExerciseNotes('');
    setDistance('');
    setDuration('');
    setSets([{ setNum: 1, weightLbs: 0, reps: 0, rpe: 8 }]);
  };

  const handleExerciseNameChange = (inputVal: string) => {
    setExerciseName(inputVal);
    const allAvailableOptions = getFilteredDropdownOptions();
    const matchedExercise = allAvailableOptions.find(
      ex => ex.name.toLowerCase() === inputVal.trim().toLowerCase()
    );
    if (matchedExercise) {
      setExerciseType(matchedExercise.type);
    }
  };

  const handleSetChange = (index: number, field: keyof SetEntry, value: number) => {
    const updatedSets = [...sets];
    updatedSets[index] = { ...updatedSets[index], [field]: value };
    setSets(updatedSets);
  };

  const handleRemoveLastSetRow = () => {
    if (sets.length > 1) {
      setSets(sets.slice(0, -1));
    }
  };

  // NEW FEATURE: Quick deletion of a staged exercise before submitting the final workout payload
  const handleRemoveStagedExercise = (indexToRemove: number) => {
    setActiveExercises(activeExercises.filter((_, idx) => idx !== indexToRemove));
  };

  const handleTriggerAppInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleStageExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseName.trim()) return;

    const targetName = exerciseName.trim();
    let updatedExercises = [...activeExercises];

    if (exerciseType === 'strength') {
      const filteredSets = sets.filter(s => s.reps > 0);
      if (filteredSets.length === 0) {
        alert("Please enter at least one valid set row.");
        return;
      }

      const existingIndex = updatedExercises.findIndex(
        ex => ex.name.toLowerCase() === targetName.toLowerCase() && ex.type === 'strength'
      );

      if (existingIndex !== -1) {
        const baseExercise = updatedExercises[existingIndex];
        const startingSetNum = baseExercise.sets ? baseExercise.sets.length : 0;
        const freshSets = filteredSets.map((s, idx) => ({
          ...s,
          setNum: startingSetNum + idx + 1
        }));

        updatedExercises[existingIndex] = {
          ...baseExercise,
          sets: [...(baseExercise.sets || []), ...freshSets],
          exerciseNotes: exerciseNotes.trim() 
            ? `${baseExercise.exerciseNotes || ''}; ${exerciseNotes}`.replace(/^;\s*/, '')
            : baseExercise.exerciseNotes
        };
      } else {
        updatedExercises.push({
          name: targetName,
          type: 'strength',
          tempo: "3110",
          sets: filteredSets,
          ...(exerciseNotes.trim() ? { exerciseNotes } : {})
        });
      }
    } else {
      if (!distance || !duration) {
        alert("Please enter both distance and duration numbers.");
        return;
      }
      updatedExercises.push({
        name: targetName,
        type: 'cardio',
        distanceMiles: parseFloat(distance),
        timeMinutes: parseFloat(duration),
        ...(exerciseNotes.trim() ? { exerciseNotes } : {})
      });
    }

    setActiveExercises(updatedExercises);
    setExerciseName('');
    setExerciseNotes('');
    setDistance('');
    setDuration('');
    setSets([{ setNum: 1, weightLbs: 0, reps: 0, rpe: 8 }]);
  };

  const handleSubmitEntireWorkout = async () => {
    if (!user || activeExercises.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timestampId = now.toISOString().replace(/[:.]/g, '-');

    const finalWorkoutPayload: Workout = {
      workoutId: `${timestampId}-${routine.toLowerCase().replace(/\s+/g, '-')}`,
      date: todayStr,
      routine,
      bodyWeightLbs: parseFloat(bodyWeight) || 0,
      notes,
      exercises: activeExercises
    };

    try {
      await saveCompleteWorkout(user.uid, finalWorkoutPayload, exerciseMeta);
      const metaRefresh = await fetchExerciseMetadata(user.uid);
      setExerciseMeta(metaRefresh);
      setActiveExercises([]);
      setNotes('');
      localStorage.removeItem('active_session_exercises');
      alert("Workout saved securely to the Cloud! 🎉");
    } catch (err) {
      console.error("Batch submission failed: ", err);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(workouts, null, 2));
      setCopyStatus('Copied to Clipboard! ✓');
      setTimeout(() => setCopyStatus('Copy Last 10 Workouts'), 2000);
    } catch (err) {
      setCopyStatus('Copy Failed ✗');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-gray-400 flex items-center justify-center font-sans">Booting FlexLog...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-sm w-full text-center space-y-6 bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
          <h1 className="text-4xl font-black text-emerald-400 tracking-tight">FlexLog</h1>
          <p className="text-sm text-gray-400">Hybrid strength & cardio tracker. Intelligent layout adapting to your selections instantly.</p>
          <button onClick={signInWithGoogle} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3 px-4 rounded-xl transition shadow-md">Sign In With Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans">
      <header className="max-w-md mx-auto mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-emerald-400">FlexLog</h1>
          <p className="text-[10px] text-gray-400">Athlete: {user.displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isInstallable && (
            <button onClick={handleTriggerAppInstall} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition shadow">📲 Install App</button>
          )}
          <button onClick={logoutUser} className="text-xs border border-gray-700 hover:border-red-500 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition">Logout</button>
        </div>
      </header>

      <main className="max-w-md mx-auto space-y-6">
        <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Session Routine</label>
            <input type="text" value={routine} onChange={e => setRoutine(e.target.value)} onFocus={(e) => e.target.select()} className="w-full bg-gray-800 border border-gray-700 rounded-md p-1.5 text-xs text-emerald-400 font-bold focus:outline-none" />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Scale Weight (lbs)</label>
            <input type="number" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} onFocus={(e) => e.target.select()} className="w-full bg-gray-800 border border-gray-700 rounded-md p-1.5 text-xs focus:outline-none" />
          </div>
        </div>

        <form onSubmit={handleStageExercise} className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4 shadow-md">
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-750">
            <button type="button" onClick={() => handleManualTypeToggle('strength')} className={`flex-1 text-center py-1.5 rounded-md text-xs font-bold transition ${exerciseType === 'strength' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Strength</button>
            <button type="button" onClick={() => handleManualTypeToggle('cardio')} className={`flex-1 text-center py-1.5 rounded-md text-xs font-bold transition ${exerciseType === 'cardio' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Cardio</button>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1 font-medium">Exercise Name</label>
            <input type="text" list="past-exercises" value={exerciseName} onChange={e => handleExerciseNameChange(e.target.value)} placeholder={exerciseType === 'strength' ? "e.g., Dumbbell Bench" : "e.g., Treadmill Rucking"} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500" required />
            <datalist id="past-exercises">
              {getFilteredDropdownOptions().map(ex => <option key={ex.name} value={ex.name} />)}
            </datalist>
          </div>

          {exerciseType === 'strength' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-center text-[10px] uppercase font-bold text-gray-500">
                <div>Set</div><div>Lbs</div><div>Reps</div><div>RPE</div>
              </div>
              {sets.map((set, i) => (
                <div key={set.setNum} className="grid grid-cols-4 gap-2 items-center text-center">
                  <span className="text-sm font-mono text-gray-500">{set.setNum}</span>
                  {/* UX FIX: onFocus handler automatically selects the values to easily overwrite */}
                  <input type="number" required placeholder="0 (BW)" value={set.weightLbs === 0 ? '0' : (set.weightLbs || '')} onFocus={(e) => e.target.select()} onChange={e => handleSetChange(i, 'weightLbs', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm focus:border-emerald-500" />
                  <input type="number" required placeholder="reps" value={set.reps || ''} onFocus={(e) => e.target.select()} onChange={e => handleSetChange(i, 'reps', e.target.value === '' ? 0 : parseInt(e.target.value))} className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm focus:border-emerald-500" />
                  <input type="number" required min="1" max="10" value={set.rpe} onFocus={(e) => e.target.select()} onChange={e => handleSetChange(i, 'rpe', e.target.value === '' ? 8 : parseInt(e.target.value))} className="bg-gray-900 border border-gray-700 rounded p-1 text-center font-mono text-sm text-amber-400 focus:border-emerald-500" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setSets([...sets, { setNum: sets.length + 1, weightLbs: 0, reps: 0, rpe: 8 }])} className="flex-1 bg-gray-700 hover:bg-gray-650 text-[11px] py-1.5 rounded-md transition text-gray-300 font-medium">+ Add Set Row</button>
                {sets.length > 1 && (
                  <button type="button" onClick={handleRemoveLastSetRow} className="flex-1 bg-gray-900 border border-gray-700 hover:border-red-900 text-[11px] py-1.5 rounded-md transition text-red-400 font-medium">✕ Remove Last</button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Distance (Miles)</label>
                  <input type="number" step="0.01" value={distance} onFocus={(e) => e.target.select()} onChange={e => setDistance(e.target.value)} placeholder="1.0" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Duration (Minutes)</label>
                  <input type="number" step="0.1" value={duration} onFocus={(e) => e.target.select()} onChange={e => setDuration(e.target.value)} placeholder="23.5" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1">Exercise Specific Notes</label>
            <input type="text" value={exerciseNotes} onChange={e => setExerciseNotes(e.target.value)} placeholder={exerciseType === 'strength' ? "e.g., Using 40lb vest / Wide grip bar" : "e.g., Incline 10%, Speed 2.7mph, 40lb vest"} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500" />
          </div>

          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2 rounded-lg text-xs transition uppercase tracking-wider">Stage Exercise to Session</button>
        </form>

        {activeExercises.length > 0 && (
          <div className="bg-blue-950/30 border border-blue-900/60 p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wide border-b border-blue-900/40 pb-2">Current Active Session ({activeExercises.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeExercises.map((ex, idx) => (
                <div key={idx} className="text-xs bg-gray-900/50 p-2 rounded border border-gray-800 flex justify-between items-center">
                  <div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold mr-2 ${ex.type === 'strength' ? 'bg-amber-600/30 text-amber-400' : 'bg-cyan-600/30 text-cyan-400'}`}>{ex.type}</span>
                    <span className="font-bold text-gray-200">{ex.name}</span>
                    <p className="text-gray-400 font-mono text-[11px] mt-0.5">
                      {ex.type === 'strength' ? ex.sets?.map(s => `${s.weightLbs}x${s.reps}`).join(' | ') : `${ex.distanceMiles} miles in ${ex.timeMinutes} mins`}
                    </p>
                    {ex.exerciseNotes && <p className="text-[10px] text-gray-500 italic mt-0.5">Note: "{ex.exerciseNotes}"</p>}
                  </div>
                  {/* UX UPDATE: Immediate deletion action button for any staged exercise row */}
                  <button type="button" onClick={() => handleRemoveStagedExercise(idx)} className="text-red-400 hover:text-red-300 font-bold px-2 py-1 text-xs tracking-wide">✕ Delete</button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">Overall Session Comments</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Felt warm, adjustments made..." className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs focus:outline-none" />
            </div>
            <button type="button" onClick={handleSubmitEntireWorkout} className="w-full bg-blue-600 hover:bg-blue-500 font-black py-3 rounded-xl text-sm uppercase transition shadow-lg">🚀 Submit & End Workout</button>
          </div>
        )}

        <button onClick={copyToClipboard} className="w-full bg-gray-800 border border-gray-700 hover:bg-gray-750 font-bold py-3.5 px-4 rounded-xl transition text-emerald-400 flex items-center justify-center gap-2 shadow-lg">
          <span>📋</span> {copyStatus}
        </button>

        <div className="space-y-3">
          <h3 className="text-md font-bold text-gray-400 tracking-wide uppercase text-xs">Cloud History Log Feed</h3>
          {workouts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4 italic">No cloud logs verified yet.</p>
          ) : (
            workouts.map((workout) => (
              <div key={workout.workoutId} className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-bold text-lg text-gray-100">{workout.routine}</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">{workout.date}</span>
                </div>
                {workout.notes && <p className="text-xs italic text-gray-400 bg-gray-900/40 p-2 rounded-lg border-l border-emerald-500 mb-2">"{workout.notes}"</p>}
                {workout.exercises.map((ex, i) => (
                  <div key={i} className="bg-gray-900/50 p-2 rounded-lg border border-gray-750 mt-1 text-xs">
                    <span className="font-bold text-gray-200">{ex.name}</span>
                    <span className="text-[10px] text-gray-500 uppercase ml-2">({ex.type})</span>
                    <p className="font-mono text-[11px] text-emerald-400 mt-0.5">
                      {ex.type === 'strength' ? ex.sets?.map(s => `${s.weightLbs} lbs × ${s.reps}`).join(' | ') : `${ex.distanceMiles} miles / ${ex.timeMinutes} mins`}
                    </p>
                    {ex.exerciseNotes && <p className="text-[10px] text-gray-400 italic bg-gray-900/20 p-1 rounded mt-1">↳ "{ex.exerciseNotes}"</p>}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}