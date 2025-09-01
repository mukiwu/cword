import type { IUserProfile } from '../types';
import { DatabaseService } from './database';

export class UserProfileService {
  static async createUser(profileData: Omit<IUserProfile, 'id' | 'createdAt'>): Promise<number> {
    const userProfile: Omit<IUserProfile, 'id'> = {
      ...profileData,
      createdAt: new Date(),
    };
    
    return await DatabaseService.add('userProfile', userProfile) as number;
  }

  static async getUserProfile(): Promise<IUserProfile | undefined> {
    const profiles = await DatabaseService.getAll<IUserProfile>('userProfile');
    return profiles[0]; // Assuming single user for now
  }

  static async updateProfile(id: number, updates: Partial<IUserProfile>): Promise<number> {
    return await DatabaseService.update('userProfile', id, updates);
  }

  static async deleteProfile(id: number): Promise<void> {
    await DatabaseService.delete('userProfile', id);
  }

  static async hasExistingProfile(): Promise<boolean> {
    const profile = await this.getUserProfile();
    return !!profile;
  }

  static getGradeFromAge(age: number): number {
    // 8歲對應國小二年級，以此類推
    return Math.max(1, Math.min(6, age - 6));
  }
}