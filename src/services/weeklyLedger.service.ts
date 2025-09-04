import type { IWeeklyLedger, ICoinExchange } from '../types';
import { DatabaseService } from './database';

const EXCHANGE_STORAGE_KEY = 'cword-coin-exchanges';

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

  // 兌換相關功能
  static async requestCoinExchange(weekId: string, coinsToExchange: number): Promise<ICoinExchange> {
    const EXCHANGE_RATE = 10; // 10 學習幣 = 1 NTD
    const ntdAmount = Math.floor(coinsToExchange / EXCHANGE_RATE);
    
    if (coinsToExchange < EXCHANGE_RATE) {
      throw new Error('兌換金額不足，至少需要10個學習幣');
    }

    // 移除每週只能兌換一次的限制

    // 檢查週帳本是否存在且已完成
    const weeklyLedger = await DatabaseService.get<IWeeklyLedger>('weeklyLedger', weekId);
    if (!weeklyLedger || weeklyLedger.status !== 'paid_out') {
      throw new Error('該週帳本尚未完成或不存在');
    }

    // 計算已兌換的學習幣總數
    const existingExchanges = this.getExchangeHistory();
    const alreadyExchanged = existingExchanges
      .filter(ex => ex.weekId === weekId && ex.status !== 'rejected')
      .reduce((total, ex) => total + ex.coinsExchanged, 0);
    
    if (weeklyLedger.totalEarned < (alreadyExchanged + coinsToExchange)) {
      throw new Error(`學習幣數量不足，可兌換: ${weeklyLedger.totalEarned - alreadyExchanged} 個`);
    }

    const exchange: ICoinExchange = {
      id: `exchange-${Date.now()}`,
      weekId,
      coinsExchanged: coinsToExchange,
      ntdAmount,
      exchangeRate: EXCHANGE_RATE,
      status: 'pending',
      requestedAt: new Date(),
    };

    // 儲存到 localStorage
    const updatedExchanges = this.getExchangeHistory();
    updatedExchanges.push(exchange);
    localStorage.setItem(EXCHANGE_STORAGE_KEY, JSON.stringify(updatedExchanges));

    return exchange;
  }

  static getExchangeHistory(): ICoinExchange[] {
    try {
      const exchanges = localStorage.getItem(EXCHANGE_STORAGE_KEY);
      if (!exchanges) return [];
      
      return JSON.parse(exchanges).map((exchange: any) => ({
        ...exchange,
        requestedAt: new Date(exchange.requestedAt),
        processedAt: exchange.processedAt ? new Date(exchange.processedAt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load exchange history:', error);
      return [];
    }
  }

  static async getExchangeByWeekId(weekId: string): Promise<ICoinExchange | null> {
    const exchanges = this.getExchangeHistory();
    return exchanges.find(ex => ex.weekId === weekId) || null;
  }

  static async updateExchangeStatus(exchangeId: string, status: ICoinExchange['status'], notes?: string): Promise<void> {
    const exchanges = this.getExchangeHistory();
    const exchangeIndex = exchanges.findIndex(ex => ex.id === exchangeId);
    
    if (exchangeIndex === -1) {
      throw new Error('兌換記錄不存在');
    }

    exchanges[exchangeIndex] = {
      ...exchanges[exchangeIndex],
      status,
      processedAt: new Date(),
      notes,
    };

    localStorage.setItem(EXCHANGE_STORAGE_KEY, JSON.stringify(exchanges));
  }

  static async canRequestExchange(weekId: string): Promise<boolean> {
    // 移除每週只能兌換一次的限制，只要有足夠學習幣就可以兌換
    const weeklyLedger = await DatabaseService.get<IWeeklyLedger>('weeklyLedger', weekId);
    if (!weeklyLedger || weeklyLedger.status !== 'paid_out') {
      return false;
    }
    
    const exchanges = this.getExchangeHistory();
    const alreadyExchanged = exchanges
      .filter(ex => ex.weekId === weekId && ex.status !== 'rejected')
      .reduce((total, ex) => total + ex.coinsExchanged, 0);
    
    return weeklyLedger.totalEarned > alreadyExchanged;
  }

  static async getAvailableCoinsForExchange(weekId: string): Promise<number> {
    const weeklyLedger = await DatabaseService.get<IWeeklyLedger>('weeklyLedger', weekId);
    if (!weeklyLedger || weeklyLedger.status !== 'paid_out') {
      return 0;
    }
    
    const exchanges = this.getExchangeHistory();
    const alreadyExchanged = exchanges
      .filter(ex => ex.weekId === weekId && ex.status !== 'rejected')
      .reduce((total, ex) => total + ex.coinsExchanged, 0);
    
    return Math.max(0, weeklyLedger.totalEarned - alreadyExchanged);
  }
}