import { v4 as uuidv4 } from 'uuid';
import type { IDailyTask, AIAPIConfig, TaskGenerationRequest } from '../types';
import { DatabaseService } from './database';
import { UserProfileService } from './userProfile.service';
import { AIService } from './ai.service';

export class TaskGenerationService {
  static async createDailyTasksForUser(apiConfig: AIAPIConfig): Promise<IDailyTask[]> {
    try {
      // Get user profile
      const userProfile = await UserProfileService.getUserProfile();
      if (!userProfile) {
        throw new Error('No user profile found');
      }

      // Check if tasks already exist for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingTasks = await this.getTasksForDate(today);
      if (existingTasks.length > 0) {
        return existingTasks;
      }

      // Build request for AI service with historical data
      const grade = UserProfileService.getGradeFromAge(userProfile.age);
      const historicalContents = await this.getAllHistoricalContents();
      
      const request: TaskGenerationRequest = {
        userAge: userProfile.age,
        grade,
        previousTasks: historicalContents.slice(-50), // 只傳遞最近50個避免提示過長
      };

      // Generate tasks using AI (可能需要重試以避免重複)
      let finalTasks: IDailyTask[] = [];
      let attempts = 0;
      const maxAttempts = 3;

      while (finalTasks.length < 3 && attempts < maxAttempts) {
        attempts++;
        console.log(`嘗試生成任務，第 ${attempts} 次嘗試`);
        
        const aiResponse = await AIService.generateTaskContent(apiConfig, request);
        
        // Create task objects
        const newTasks: IDailyTask[] = aiResponse.tasks.map(taskData => ({
          id: uuidv4(),
          date: today,
          content: taskData.content,
          type: taskData.type,
          details: taskData.details,
          status: 'pending' as const,
          reward: taskData.reward,
          completedAt: null,
        }));

        // Filter out duplicates
        const uniqueTasks = await this.filterDuplicateTasks(newTasks);
        
        // Add unique tasks to final list
        for (const task of uniqueTasks) {
          if (!finalTasks.some(existing => existing.content === task.content)) {
            finalTasks.push(task);
          }
        }

        // 更新請求以告知 AI 哪些內容已經被使用
        request.previousTasks = [
          ...historicalContents.slice(-50),
          ...finalTasks.map(t => t.content)
        ];
      }

      // 如果仍然沒有足夠的任務，生成一些備用任務
      if (finalTasks.length === 0) {
        console.warn('無法生成唯一任務，使用備用任務');
        finalTasks = await this.generateFallbackTasks(today, userProfile.age);
      }

      // Save tasks to database
      for (const task of finalTasks) {
        await DatabaseService.add('dailyTasks', task);
      }

      return finalTasks;
    } catch (error) {
      console.error('Failed to create daily tasks:', error);
      throw error;
    }
  }

  static async getTasksForDate(date: Date): Promise<IDailyTask[]> {
    const dateString = date.toDateString();
    return await DatabaseService.query<IDailyTask>('dailyTasks', (task) => 
      task.date.toDateString() === dateString
    );
  }

  static async getTodaysTasks(): Promise<IDailyTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await this.getTasksForDate(today);
  }

  static async startTask(taskId: string): Promise<IDailyTask> {
    const task = await DatabaseService.get<IDailyTask>('dailyTasks', taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status !== 'pending') {
      return task;
    }

    const updatedTask: IDailyTask = {
      ...task,
      status: 'in_progress',
    };

    await DatabaseService.update('dailyTasks', taskId, {
      status: 'in_progress',
    });

    return updatedTask;
  }

  static async completeTask(taskId: string): Promise<IDailyTask> {
    const task = await DatabaseService.get<IDailyTask>('dailyTasks', taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status === 'completed') {
      return task;
    }

    const updatedTask: IDailyTask = {
      ...task,
      status: 'completed',
      completedAt: new Date(),
    };

    await DatabaseService.update('dailyTasks', taskId, {
      status: 'completed',
      completedAt: new Date(),
    });

    // Only update weekly ledger when task is actually completed (not just started)
    await this.updateWeeklyLedger(task.reward, taskId);

    return updatedTask;
  }

  private static async getRecentTaskContents(): Promise<string[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // 擴展到30天避免重複

    const recentTasks = await DatabaseService.query<IDailyTask>('dailyTasks', (task) => 
      task.date >= thirtyDaysAgo
    );

    return recentTasks.map(task => task.content);
  }

  // 新增：檢查任務內容是否重複
  private static async filterDuplicateTasks(newTasks: IDailyTask[]): Promise<IDailyTask[]> {
    const recentContents = await this.getRecentTaskContents();
    const recentContentsSet = new Set(recentContents);
    
    // 過濾掉重複的內容
    const filteredTasks = newTasks.filter(task => !recentContentsSet.has(task.content));
    
    if (filteredTasks.length < newTasks.length) {
      console.log(`過濾了 ${newTasks.length - filteredTasks.length} 個重複任務`);
    }
    
    return filteredTasks;
  }

  // 新增：獲取所有歷史任務內容用於 AI 提示
  private static async getAllHistoricalContents(): Promise<string[]> {
    const allTasks = await DatabaseService.getAll<IDailyTask>('dailyTasks');
    const contents = allTasks.map(task => task.content);
    
    // 去重並排序
    return [...new Set(contents)].sort();
  }

  // 新增：生成備用任務
  private static async generateFallbackTasks(date: Date, userAge: number): Promise<IDailyTask[]> {
    const grade = UserProfileService.getGradeFromAge(userAge);
    const historicalContents = await this.getAllHistoricalContents();
    const usedSet = new Set(historicalContents);
    
    // 依年級準備不同難度的備用字詞
    const fallbackWords: Record<number, string[]> = {
      1: ['人', '大', '小', '山', '水', '火', '木', '土', '日', '月'],
      2: ['家', '學', '校', '老', '師', '同', '學', '書', '本', '字'],
      3: ['朋', '友', '快', '樂', '學', '習', '努', '力', '進', '步'],
      4: ['知', '識', '智', '慧', '思', '考', '問', '題', '答', '案'],
      5: ['經', '驗', '學', '問', '研', '究', '發', '現', '創', '新'],
      6: ['哲', '學', '科', '學', '文', '學', '歷', '史', '地', '理']
    };
    
    const availableWords = fallbackWords[grade] || fallbackWords[3];
    const unusedWords = availableWords.filter(word => !usedSet.has(word));
    
    // 如果沒有未使用的字，就從所有字中隨機選擇
    const wordsToUse = unusedWords.length > 0 ? unusedWords : availableWords;
    
    const tasks: IDailyTask[] = [];
    const selectedWords = wordsToUse.slice(0, 3); // 選擇最多3個字
    
    selectedWords.forEach((word, index) => {
      const strokes = this.estimateStrokes(word);
      const repetitions = Math.min(Math.max(3, 8 - strokes), 8);
      
      tasks.push({
        id: uuidv4(),
        date,
        content: word,
        type: 'character',
        details: { strokes, repetitions },
        status: 'pending',
        reward: 5 + Math.floor(strokes / 5) + Math.floor(repetitions / 3),
        completedAt: null,
      });
    });
    
    return tasks;
  }

  // 新增：估算字的筆劃數
  private static estimateStrokes(char: string): number {
    // 這裡可以擴展為更精確的筆劃數計算
    const strokeMap: Record<string, number> = {
      '人': 2, '大': 3, '小': 3, '山': 3, '水': 4, '火': 4,
      '木': 4, '土': 3, '日': 4, '月': 4, '家': 10, '學': 8,
      '校': 10, '老': 6, '師': 10, '同': 6, '書': 10, '本': 5,
      '字': 6, '朋': 8, '友': 4, '快': 7, '樂': 15, '習': 11,
      '努': 7, '力': 2, '進': 11, '步': 7
    };
    
    return strokeMap[char] || 8; // 默認8劃
  }

  private static async updateWeeklyLedger(reward: number, taskId: string): Promise<void> {
    // This will be implemented by WeeklyLedgerService
    const { WeeklyLedgerService } = await import('./weeklyLedger.service');
    await WeeklyLedgerService.addTaskReward(reward, taskId);
  }

  static async getTaskById(taskId: string): Promise<IDailyTask | undefined> {
    return await DatabaseService.get<IDailyTask>('dailyTasks', taskId);
  }

  static async getPendingTasks(): Promise<IDailyTask[]> {
    return await DatabaseService.query<IDailyTask>('dailyTasks', (task) => 
      task.status === 'pending'
    );
  }

  static async getCompletedTasksForWeek(startDate: Date): Promise<IDailyTask[]> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return await DatabaseService.query<IDailyTask>('dailyTasks', (task) => 
      task.status === 'completed' && 
      task.date >= startDate && 
      task.date <= endDate
    );
  }
}