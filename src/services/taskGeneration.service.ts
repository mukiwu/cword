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
    
    // 依年級準備更具挑戰性的備用字詞（提升難度）
    const fallbackWords: Record<number, string[]> = {
      1: ['春', '夏', '秋', '冬', '花', '草', '樹', '鳥', '雲', '雨'],
      2: ['聰', '明', '勇', '敢', '溫', '暖', '清', '楚', '美', '麗'], // 8歲更具挑戰性
      3: ['智', '慧', '堅', '強', '優', '秀', '認', '真', '負', '責'],
      4: ['創', '造', '發', '展', '進', '步', '成', '功', '夢', '想'],
      5: ['哲', '學', '科', '技', '文', '化', '藝', '術', '歷', '史'],
      6: ['邏', '輯', '思', '維', '創', '新', '探', '索', '研', '究']
    };
    
    const availableWords = fallbackWords[grade] || fallbackWords[3];
    const unusedWords = availableWords.filter(word => !usedSet.has(word));
    
    // 如果沒有未使用的字，就從所有字中隨機選擇
    const wordsToUse = unusedWords.length > 0 ? unusedWords : availableWords;
    
    const tasks: IDailyTask[] = [];
    const selectedWords = wordsToUse.slice(0, 3); // 選擇最多3個字
    
    selectedWords.forEach((word, index) => {
      const strokes = this.estimateStrokes(word);
      // 更嚴格的練習次數要求（至少5次）
      const repetitions = Math.max(5, Math.min(10, Math.ceil(strokes / 2)));
      
      // 使用新的獎勵計算標準：3 + 難度加成 + 次數加成，上限8
      let reward = 3; // 基礎獎勵
      
      // 難度加成（8-12劃+1, 13-16劃+2, 17+劃+3）
      if (strokes >= 17) reward += 3;
      else if (strokes >= 13) reward += 2;
      else if (strokes >= 8) reward += 1;
      
      // 次數加成（5-7次+1, 8-10次+2）
      if (repetitions >= 8) reward += 2;
      else if (repetitions >= 5) reward += 1;
      
      // 上限8學習幣
      reward = Math.min(reward, 8);
      
      tasks.push({
        id: uuidv4(),
        date,
        content: word,
        type: 'character',
        details: { strokes, repetitions },
        status: 'pending',
        reward,
        completedAt: null,
      });
    });
    
    return tasks;
  }

  // 新增：估算字的筆劃數（擴展更多較難字詞）
  private static estimateStrokes(char: string): number {
    const strokeMap: Record<string, number> = {
      // 基礎字
      '人': 2, '大': 3, '小': 3, '山': 3, '水': 4, '火': 4,
      '木': 4, '土': 3, '日': 4, '月': 4, '春': 9, '夏': 10,
      '秋': 9, '冬': 5, '花': 7, '草': 9, '樹': 16, '鳥': 11,
      '雲': 12, '雨': 8,
      
      // 二年級較難字詞（8歲）
      '聰': 17, '明': 8, '勇': 9, '敢': 11, '溫': 12, '暖': 13,
      '清': 11, '楚': 13, '美': 9, '麗': 19,
      
      // 中年級字詞
      '智': 12, '慧': 15, '堅': 11, '強': 12, '優': 17, '秀': 7,
      '認': 14, '真': 10, '負': 9, '責': 11,
      
      // 高年級字詞
      '創': 12, '造': 10, '發': 12, '展': 10, '進': 11, '步': 7,
      '成': 6, '功': 5, '夢': 13, '想': 13, '哲': 10, '科': 9,
      '技': 7, '文': 4, '化': 4, '藝': 13, '術': 11, '歷': 16,
      '史': 5, '邏': 17, '輯': 14, '思': 9, '維': 14, '新': 13,
      '探': 11, '索': 10, '研': 9, '究': 7
    };
    
    return strokeMap[char] || 10; // 默認提升至10劃
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