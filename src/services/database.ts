import Dexie, { type Table } from 'dexie';
import type { IUserProfile, IDailyTask, IWeeklyLedger } from '../types';

export class WordAdventureDatabase extends Dexie {
  public userProfile!: Table<IUserProfile, number>;
  public dailyTasks!: Table<IDailyTask, string>;
  public weeklyLedger!: Table<IWeeklyLedger, string>;

  public constructor() {
    super('WordAdventureIslandDB');
    
    this.version(1).stores({
      userProfile: '++id, name, age, avatarId, aiModel, createdAt',
      dailyTasks: '&id, date, content, type, status, completedAt',
      weeklyLedger: '&id, startDate, status',
    });
  }
}

export const db = new WordAdventureDatabase();

export class DatabaseService {
  static async get<T>(tableName: string, key: string | number): Promise<T | undefined> {
    try {
      return await (db as any)[tableName].get(key);
    } catch (error) {
      console.error(`Error getting ${tableName} with key ${key}:`, error);
      throw error;
    }
  }

  static async getAll<T>(tableName: string): Promise<T[]> {
    try {
      return await (db as any)[tableName].toArray();
    } catch (error) {
      console.error(`Error getting all ${tableName}:`, error);
      throw error;
    }
  }

  static async add<T>(tableName: string, item: T): Promise<string | number> {
    try {
      return await (db as any)[tableName].add(item);
    } catch (error) {
      console.error(`Error adding to ${tableName}:`, error);
      throw error;
    }
  }

  static async update<T>(tableName: string, key: string | number, changes: Partial<T>): Promise<number> {
    try {
      return await (db as any)[tableName].update(key, changes);
    } catch (error) {
      console.error(`Error updating ${tableName} with key ${key}:`, error);
      throw error;
    }
  }

  static async delete(tableName: string, key: string | number): Promise<void> {
    try {
      await (db as any)[tableName].delete(key);
    } catch (error) {
      console.error(`Error deleting ${tableName} with key ${key}:`, error);
      throw error;
    }
  }

  static async query<T>(tableName: string, filter?: (item: T) => boolean): Promise<T[]> {
    try {
      const table = (db as any)[tableName];
      if (filter) {
        return await table.filter(filter).toArray();
      }
      return await table.toArray();
    } catch (error) {
      console.error(`Error querying ${tableName}:`, error);
      throw error;
    }
  }
}