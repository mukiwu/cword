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

  // 新增：生成備用任務（支持多種任務類型）
  private static async generateFallbackTasks(date: Date, userAge: number): Promise<IDailyTask[]> {
    const grade = UserProfileService.getGradeFromAge(userAge);
    const historicalContents = await this.getAllHistoricalContents();
    const usedSet = new Set(historicalContents);
    
    // 備用內容庫
    const fallbackContent: Record<number, { 
      characters: string[], 
      words: string[], 
      phrases: string[] 
    }> = {
      1: {
        characters: ['春', '夏', '秋', '冬', '花', '草', '樹', '鳥', '雲', '雨'],
        words: ['春天', '夏日', '秋風', '冬雪', '花園', '草地'],
        phrases: ['春天', '花朵', '小鳥', '白雲']
      },
      2: {
        characters: ['聰', '明', '勇', '敢', '溫', '暖', '清', '楚', '美', '麗'],
        words: ['聰明', '勇敢', '溫暖', '清楚', '美麗', '快樂'],
        phrases: ['聰明', '勇敢', '溫暖', '美麗']
      },
      3: {
        characters: ['智', '慧', '堅', '強', '優', '秀', '認', '真', '負', '責'],
        words: ['智慧', '堅強', '優秀', '認真', '負責', '努力'],
        phrases: ['智慧', '堅強', '優秀', '努力']
      },
      4: {
        characters: ['創', '造', '發', '展', '進', '步', '成', '功', '夢', '想'],
        words: ['創造', '發展', '進步', '成功', '夢想', '希望'],
        phrases: ['創造', '發展', '進步', '夢想']
      },
      5: {
        characters: ['哲', '學', '科', '技', '文', '化', '藝', '術', '歷', '史'],
        words: ['哲學', '科技', '文化', '藝術', '歷史', '知識'],
        phrases: ['哲學', '科技', '文化', '知識']
      },
      6: {
        characters: ['邏', '輯', '思', '維', '創', '新', '探', '索', '研', '究'],
        words: ['邏輯', '思維', '創新', '探索', '研究', '學習'],
        phrases: ['邏輯', '思維', '創新', '研究']
      }
    };
    
    const content = fallbackContent[grade] || fallbackContent[3];
    const tasks: IDailyTask[] = [];
    
    // 生成 1 個單字任務
    const unusedChars = content.characters.filter(char => !usedSet.has(char));
    const charToUse = unusedChars.length > 0 ? unusedChars[0] : content.characters[0];
    
    const strokes = this.estimateStrokes(charToUse);
    const repetitions = Math.max(5, Math.min(10, Math.ceil(strokes / 2)));
    let charReward = 3;
    
    if (strokes >= 20) charReward += 4;
    else if (strokes >= 17) charReward += 3;
    else if (strokes >= 13) charReward += 2;
    else if (strokes >= 8) charReward += 1;
    
    if (repetitions >= 9) charReward += 3;
    else if (repetitions >= 8) charReward += 2;
    else if (repetitions >= 5) charReward += 1;
    
    charReward = Math.min(charReward, 10);
    
    tasks.push({
      id: uuidv4(),
      date,
      content: charToUse,
      type: 'character',
      details: { strokes, repetitions },
      status: 'pending',
      reward: charReward,
      completedAt: null,
    });
    
    // 生成 1 個詞語任務
    const unusedWords = content.words.filter(word => !usedSet.has(word));
    const wordToUse = unusedWords.length > 0 ? unusedWords[0] : content.words[0];
    
    const wordReward = this.calculateWordReward(wordToUse);
    const wordRepetitions = Math.max(5, Math.min(8, wordToUse.length * 3));
    
    tasks.push({
      id: uuidv4(),
      date,
      content: wordToUse,
      type: 'word',
      details: { repetitions: wordRepetitions },
      status: 'pending',
      reward: wordReward,
      completedAt: null,
    });
    
    // 生成 1 個造句任務
    const unusedPhrases = content.phrases.filter(phrase => !usedSet.has(phrase));
    const phraseToUse = unusedPhrases.length > 0 ? unusedPhrases[0] : content.phrases[0];
    
    const phraseReward = this.calculatePhraseReward(phraseToUse);
    
    tasks.push({
      id: uuidv4(),
      date,
      content: phraseToUse,
      type: 'phrase',
      details: { sentence: `請用「${phraseToUse}」造一個完整的句子，要能表達出詞語的意思。` },
      status: 'pending',
      reward: phraseReward,
      completedAt: null,
    });
    
    return tasks;
  }

  // 新增：估算字的筆劃數（擴展更多較難字詞）
  // 新增：計算詞語練習獎勵
  private static calculateWordReward(word: string): number {
    let reward = 5; // 基礎獎勵（比單字高）
    
    // 計算詞語總筆畫數
    const totalStrokes = Array.from(word).reduce((sum, char) => {
      return sum + this.estimateStrokes(char);
    }, 0);
    
    // 根據總筆畫數加成
    if (totalStrokes >= 30) reward += 2;      // 30+ 筆畫：+2
    else if (totalStrokes >= 25) reward += 1; // 25-29 筆畫：+1
    
    return Math.min(reward, 9); // 詞語練習上限 9
  }

  // 新增：計算造句練習獎勵
  private static calculatePhraseReward(phrase: string): number {
    let reward = 6; // 基礎獎勵最高（認知難度最高）
    
    // 評估詞語複雜度（根據長度和筆畫）
    const totalStrokes = Array.from(phrase).reduce((sum, char) => {
      return sum + this.estimateStrokes(char);
    }, 0);
    const wordLength = phrase.length;
    
    // 複雜度加成
    if (totalStrokes >= 25 || wordLength >= 3) reward += 2; // 高複雜度：+2
    else if (totalStrokes >= 18 || wordLength >= 2) reward += 1; // 中複雜度：+1
    
    return Math.min(reward, 10); // 造句練習上限 10
  }

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