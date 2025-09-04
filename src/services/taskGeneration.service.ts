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
        console.log(`今日已有 ${existingTasks.length} 個任務，不重複生成`);
        // 如果任務數量超過3個，只返回前3個
        return existingTasks.slice(0, 3);
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

      // 如果任務數量不足3個，補充備用任務
      if (finalTasks.length < 3) {
        console.warn(`任務數量不足(${finalTasks.length}/3)，補充備用任務`);
        const fallbackTasks = await this.generateFallbackTasks(today, userProfile.age);
        
        // 只添加需要的數量，並避免重複
        const needed = 3 - finalTasks.length;
        const usedContents = new Set(finalTasks.map(t => t.content));
        
        for (const task of fallbackTasks) {
          if (finalTasks.length >= 3) break;
          if (!usedContents.has(task.content)) {
            finalTasks.push(task);
            usedContents.add(task.content);
          }
        }
      }

      // 確保只保留前3個任務
      finalTasks = finalTasks.slice(0, 3);

      console.log(`準備保存 ${finalTasks.length} 個今日任務`);

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
    const tasks = await this.getTasksForDate(today);
    
    // 如果任務數量超過3個，清理多餘的任務
    if (tasks.length > 3) {
      console.warn(`發現 ${tasks.length} 個今日任務，清理多餘任務`);
      const tasksToKeep = tasks.slice(0, 3);
      const tasksToRemove = tasks.slice(3);
      
      // 刪除多餘的任務
      for (const task of tasksToRemove) {
        await DatabaseService.delete('dailyTasks', task.id);
      }
      
      return tasksToKeep;
    }
    
    return tasks;
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
    
    // 基於台灣教育部課綱的超前學習內容庫
    const fallbackContent: Record<number, { 
      characters: string[], 
      words: string[], 
      phrases: string[],
      strokeRange: [number, number],
      difficulty: string
    }> = {
      1: { // age 6, 學習2年級內容
        characters: ['明', '朋', '友', '故', '事', '新', '舊', '左', '右', '方'],
        words: ['朋友', '故事', '新年', '左右', '方向', '時候'],
        phrases: ['朋友', '故事', '新年', '時候'],
        strokeRange: [5, 10],
        difficulty: '二年級程度'
      },
      2: { // age 8, 學習3年級內容
        characters: ['班', '級', '同', '學', '老', '師', '教', '室', '功', '課'],
        words: ['班級', '同學', '老師', '教室', '功課', '學習'],
        phrases: ['同學', '老師', '學習', '功課'],
        strokeRange: [8, 13],
        difficulty: '三年級程度'
      },
      3: { // age 9, 學習4年級內容  
        characters: ['環', '境', '保', '護', '污', '染', '清', '潔', '資', '源'],
        words: ['環境', '保護', '污染', '清潔', '資源', '回收'],
        phrases: ['環境', '保護', '污染', '資源'],
        strokeRange: [10, 16],
        difficulty: '四年級程度'
      },
      4: { // age 10, 學習5年級內容
        characters: ['民', '主', '自', '由', '平', '等', '正', '義', '法', '律'],
        words: ['民主', '自由', '平等', '正義', '法律', '權利'],
        phrases: ['民主', '自由', '正義', '權利'],
        strokeRange: [13, 20],
        difficulty: '五年級程度'
      },
      5: { // age 11, 學習6年級內容
        characters: ['科', '學', '技', '術', '發', '明', '創', '新', '實', '驗'],
        words: ['科學', '技術', '發明', '創新', '實驗', '研究'],
        phrases: ['科學', '技術', '創新', '研究'],
        strokeRange: [16, 25],
        difficulty: '六年級程度'
      },
      6: { // age 12, 學習6年級內容（標準）
        characters: ['哲', '學', '思', '想', '邏', '輯', '推', '理', '分', '析'],
        words: ['哲學', '思想', '邏輯', '推理', '分析', '判斷'],
        phrases: ['哲學', '邏輯', '分析', '判斷'],
        strokeRange: [16, 25],
        difficulty: '六年級程度'
      },
      7: { // age 12+, 學習6年級進階（冷僻字）
        characters: ['璀', '璨', '磅', '礴', '澎', '湃', '蒼', '穹', '翱', '翔'],
        words: ['璀璨', '磅礴', '澎湃', '蒼穹', '翱翔', '浩瀚'],
        phrases: ['璀璨', '磅礴', '蒼穹', '翱翔'],
        strokeRange: [18, 30],
        difficulty: '六年級進階（含冷僻字）'
      }
    };
    
    const content = fallbackContent[grade] || fallbackContent[3];
    const tasks: IDailyTask[] = [];
    
    // 生成 1 個單字任務
    const unusedChars = content.characters.filter(char => !usedSet.has(char));
    const charToUse = unusedChars.length > 0 ? unusedChars[0] : content.characters[0];
    
    const strokes = this.estimateStrokes(charToUse);
    const repetitions = Math.max(5, Math.min(10, Math.ceil(strokes / 2)));
    const [minStroke, maxStroke] = content.strokeRange;
    
    // 基於年級筆畫標準的獎勵計算
    let charReward = 3; // 基礎獎勵
    
    // 筆畫範圍適配獎勵
    if (strokes < minStroke) {
      charReward -= 1; // 低於年級標準：-1
    } else if (strokes > maxStroke) {
      charReward += 2; // 超出年級標準（挑戰性高）：+2
    } else {
      charReward += 1; // 符合年級標準：+1
    }
    
    // 傳統難度加成（保留原有邏輯）
    if (strokes >= 20) charReward += 3;
    else if (strokes >= 17) charReward += 2;
    else if (strokes >= 13) charReward += 1;
    
    // 次數加成
    if (repetitions >= 9) charReward += 3;
    else if (repetitions >= 8) charReward += 2;
    else if (repetitions >= 5) charReward += 1;
    
    // 六年級進階額外獎勵
    if (grade === 7) charReward += 1;
    
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
    
    const wordReward = this.calculateWordReward(wordToUse, grade, content.strokeRange);
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
    
    const phraseReward = this.calculatePhraseReward(phraseToUse, grade, content.strokeRange);
    
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
  // 新增：計算詞語練習獎勵（考慮年級標準）
  private static calculateWordReward(word: string, grade: number, strokeRange: [number, number]): number {
    let reward = 5; // 基礎獎勵（比單字高）
    
    // 計算詞語總筆畫數
    const totalStrokes = Array.from(word).reduce((sum, char) => {
      return sum + this.estimateStrokes(char);
    }, 0);
    
    const [minStroke, maxStroke] = strokeRange;
    const averageStrokePerChar = totalStrokes / word.length;
    
    // 年級適配獎勵
    if (averageStrokePerChar < minStroke) {
      reward -= 1; // 平均筆畫低於年級標準
    } else if (averageStrokePerChar > maxStroke) {
      reward += 1; // 平均筆畫超出年級標準（挑戰性）
    }
    
    // 傳統複雜度加成
    if (totalStrokes >= 30) reward += 2;      // 30+ 筆畫：+2
    else if (totalStrokes >= 25) reward += 1; // 25-29 筆畫：+1
    
    // 六年級進階額外獎勵
    if (grade === 7) reward += 1;
    
    return Math.min(reward, 9); // 詞語練習上限 9
  }

  // 新增：計算造句練習獎勵（考慮年級標準）
  private static calculatePhraseReward(phrase: string, grade: number, strokeRange: [number, number]): number {
    let reward = 6; // 基礎獎勵最高（認知難度最高）
    
    // 評估詞語複雜度（根據長度和筆畫）
    const totalStrokes = Array.from(phrase).reduce((sum, char) => {
      return sum + this.estimateStrokes(char);
    }, 0);
    const wordLength = phrase.length;
    const [minStroke, maxStroke] = strokeRange;
    const averageStrokePerChar = totalStrokes / wordLength;
    
    // 年級適配獎勵
    if (averageStrokePerChar < minStroke) {
      reward -= 1; // 平均筆畫低於年級標準
    } else if (averageStrokePerChar > maxStroke) {
      reward += 1; // 平均筆畫超出年級標準（挑戰性）
    }
    
    // 傳統複雜度加成
    if (totalStrokes >= 25 || wordLength >= 3) reward += 2; // 高複雜度：+2
    else if (totalStrokes >= 18 || wordLength >= 2) reward += 1; // 中複雜度：+1
    
    // 六年級進階額外獎勵
    if (grade === 7) reward += 1;
    
    return Math.min(reward, 10); // 造句練習上限 10
  }

  private static estimateStrokes(char: string): number {
    const strokeMap: Record<string, number> = {
      // 基礎字
      '人': 2, '大': 3, '小': 3, '山': 3, '水': 4, '火': 4,
      '木': 4, '土': 3, '日': 4, '月': 4, '春': 9, '夏': 10,
      '秋': 9, '冬': 5, '花': 7, '草': 9, '樹': 16, '鳥': 11,
      '雲': 12, '雨': 8,
      
      // 二年級程度 (5-10筆畫)
      '明': 8, '朋': 8, '友': 4, '故': 9, '事': 8, '新': 13,
      '舊': 18, '左': 5, '右': 5, '方': 4,
      
      // 三年級程度 (8-13筆畫)
      '班': 10, '級': 9, '同': 6, '學': 16, '老': 6, '師': 10,
      '教': 11, '室': 9, '功': 5, '課': 15,
      
      // 四年級程度 (10-16筆畫)
      '環': 17, '境': 14, '保': 9, '護': 20, '污': 6, '染': 9,
      '清': 11, '潔': 15, '資': 13, '源': 13,
      
      // 五年級程度 (13-20筆畫)
      '民': 5, '主': 5, '自': 6, '由': 5, '平': 5, '等': 12,
      '正': 5, '義': 13, '法': 8, '律': 9,
      
      // 六年級程度 (16-25筆畫)  
      '科': 9, '技': 7, '術': 11, '發': 12, '明': 8, '創': 12,
      '實': 14, '驗': 23, '哲': 10, '思': 9, '想': 13, '邏': 17,
      '輯': 14, '推': 11, '理': 11, '分': 4, '析': 8, '判': 7,
      '斷': 18,
      
      // 六年級進階（冷僻字，18-30筆畫）
      '璀': 15, '璨': 17, '磅': 15, '礴': 14, '澎': 15, '湃': 12,
      '蒼': 13, '穹': 8, '翱': 18, '翔': 12, '浩': 10, '瀚': 19,
      
      // 其他常用字
      '聰': 17, '勇': 9, '敢': 11, '溫': 12, '暖': 13, '楚': 13,
      '美': 9, '麗': 19, '智': 12, '慧': 15, '堅': 11, '強': 12,
      '優': 17, '秀': 7, '認': 14, '真': 10, '負': 9, '責': 11,
      '造': 10, '展': 10, '進': 11, '步': 7, '成': 6, '功': 5,
      '夢': 13, '文': 4, '化': 4, '藝': 13, '歷': 16, '史': 5,
      '維': 14, '探': 11, '索': 10, '研': 9, '究': 7
    };
    
    return strokeMap[char] || 12; // 默認12劃
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