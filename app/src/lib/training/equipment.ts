import type { Exercise } from './types';

export type EquipmentType = 'BARBELL' | 'DUMBBELLS' | 'CABLE' | 'KETTLEBELL' | 'MACHINE' | 'BODYWEIGHT' | 'WEIGHTS';

export function equipmentFor(exercise: Pick<Exercise, 'name' | 'requiresWeight'>): EquipmentType {
  const name = exercise.name.toLowerCase();
  if (!exercise.requiresWeight) return 'BODYWEIGHT';
  if (/dumbbell|dumbell|\bdb\b/.test(name)) return 'DUMBBELLS';
  if (/kettlebell|kettle bell|\bkb\b/.test(name)) return 'KETTLEBELL';
  if (/cable|rope|pulldown|push-?down|face pull|lat pull/.test(name)) return 'CABLE';
  if (/machine|pec deck|leg press|hack squat|smith/.test(name)) return 'MACHINE';
  if (/barbell|bench press|incline press|decline press|deadlift|overhead press|bent over row|romanian|\brdl\b|hip thrust|good morning|snatch|clean and|front squat|back squat/.test(name) || (/squat/.test(name) && !/goblet/.test(name))) return 'BARBELL';
  return 'WEIGHTS';
}

export function platesPerSide(totalWeight: number): number[] {
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  let remaining = Math.max(0, (totalWeight - 20) / 2);
  const result: number[] = [];
  for (const plate of plates) {
    while (remaining >= plate - 0.001 && result.length < 6) {
      result.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100;
    }
  }
  return result;
}

export function volumeOf(reps: number | string | null | undefined, weight: number | string | null | undefined) {
  const parsedReps = Number(reps ?? 0);
  const parsedWeight = Number(weight ?? 0);
  return Number.isFinite(parsedReps) && Number.isFinite(parsedWeight) ? parsedReps * parsedWeight : 0;
}
