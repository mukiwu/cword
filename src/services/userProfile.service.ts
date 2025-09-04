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

  static getDisplayGrade(age: number): number {
    // 顯示實際年級：6歲=1年級, 7歲=1年級, 8歲=2年級, 9歲=3年級...
    return Math.max(1, Math.min(6, age - 6));
  }

  static getLearningGrade(age: number): number {
    // 超前學習：每個年齡學習高一年級的內容
    // 6歲學習2年級內容，8歲學習3年級內容，依此類推
    const actualGrade = Math.max(1, Math.min(6, age - 6));
    return Math.min(7, actualGrade + 1); // 超前一年級，最高到7(6年級進階)
  }

  static getGradeFromAge(age: number): number {
    // 保留舊函式以維持向後相容性，預設使用顯示年級
    return this.getDisplayGrade(age);
  }
}