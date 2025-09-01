import type { IWeeklyLedger } from '../types';
import { DatabaseService } from './database';

export class WeeklyLedgerService {
  static async addTaskReward(reward: number, taskId: string): Promise<void> {
    const currentWeek = await this.getCurrentWeekLedger();
    
    const updatedLedger: IWeeklyLedger = {
      ...currentWeek,
      totalEarned: currentWeek.totalEarned + reward,
      completedTaskIds: [...currentWeek.completedTaskIds, taskId],
    };

    await DatabaseService.update('weeklyLedger', currentWeek.id, {
      totalEarned: updatedLedger.totalEarned,
      completedTaskIds: updatedLedger.completedTaskIds,
    });
  }

  static async getCurrentWeekTotal(): Promise<number> {
    const currentWeek = await this.getCurrentWeekLedger();
    return currentWeek.totalEarned;
  }

  static async getCurrentWeekLedger(): Promise<IWeeklyLedger> {
    const weekId = this.getCurrentWeekId();
    
    let ledger = await DatabaseService.get<IWeeklyLedger>('weeklyLedger', weekId);
    
    if (!ledger) {
      // Create new weekly ledger
      ledger = {
        id: weekId,
        startDate: this.getWeekStartDate(),
        totalEarned: 0,
        status: 'active',
        completedTaskIds: [],
      };
      
      await DatabaseService.add('weeklyLedger', ledger);
    }
    
    return ledger;
  }

  static async performWeeklyPayout(): Promise<{ success: boolean; totalPaid: number; certificateData: any }> {
    try {
      const currentWeek = await this.getCurrentWeekLedger();
      
      if (currentWeek.status === 'paid_out') {
        throw new Error('This week has already been paid out');
      }

      if (!this.isPayoutTimeValid()) {
        throw new Error('Payout is only available on Sunday after 8:00 PM');
      }

      const certificateData = {
        weekId: currentWeek.id,
        startDate: currentWeek.startDate,
        endDate: new Date(currentWeek.startDate.getTime() + 6 * 24 * 60 * 60 * 1000),
        totalEarned: currentWeek.totalEarned,
        completedTasks: currentWeek.completedTaskIds.length,
        generatedAt: new Date(),
      };

      // Mark as paid out
      await DatabaseService.update('weeklyLedger', currentWeek.id, {
        status: 'paid_out' as const,
      });

      return {
        success: true,
        totalPaid: currentWeek.totalEarned,
        certificateData,
      };
    } catch (error) {
      console.error('Weekly payout failed:', error);
      return {
        success: false,
        totalPaid: 0,
        certificateData: null,
      };
    }
  }

  static async getWeeklyHistory(): Promise<IWeeklyLedger[]> {
    const allLedgers = await DatabaseService.getAll<IWeeklyLedger>('weeklyLedger');
    return allLedgers.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  static getCurrentWeekId(): string {
    const now = new Date();
    const startOfWeek = this.getWeekStartDate(now);
    const year = startOfWeek.getFullYear();
    const weekNumber = this.getWeekNumber(startOfWeek);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  private static getWeekStartDate(date: Date = new Date()): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private static getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  private static isPayoutTimeValid(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    
    return dayOfWeek === 0 && hour >= 20; // Sunday after 8:00 PM
  }

  static async resetWeeklyCoins(): Promise<void> {
    // This should be called automatically if payout is missed
    const currentWeek = await this.getCurrentWeekLedger();
    
    if (currentWeek.status === 'active' && this.isPayoutMissed(currentWeek.startDate)) {
      await DatabaseService.update('weeklyLedger', currentWeek.id, {
        status: 'paid_out' as const,
        totalEarned: 0, // Reset to 0 as penalty for missing payout
      });
    }
  }

  private static isPayoutMissed(weekStartDate: Date): boolean {
    const now = new Date();
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 7); // Next Monday
    
    return now > weekEndDate;
  }

  static async getTotalEarnedAllTime(): Promise<number> {
    const allLedgers = await DatabaseService.getAll<IWeeklyLedger>('weeklyLedger');
    return allLedgers
      .filter(ledger => ledger.status === 'paid_out')
      .reduce((total, ledger) => total + ledger.totalEarned, 0);
  }
}