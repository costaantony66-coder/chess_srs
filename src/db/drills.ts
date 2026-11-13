import { db, type DrillRun } from './db';
import { bestByDuration, squareStats } from '../lib/drills';

export async function saveDrill(run: Omit<DrillRun, 'id'>): Promise<number> {
  return db.drills.add(run as DrillRun);
}

export const listDrills = () => db.drills.orderBy('ts').toArray();

export async function getBestByDuration() {
  return bestByDuration(await listDrills());
}

export async function getSquareStats() {
  return squareStats(await listDrills());
}
