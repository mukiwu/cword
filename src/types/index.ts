export interface IUserProfile {
  id?: number;
  name: string;
  age: number;
  avatarId: string;
  aiModel: 'gemini' | 'openai' | 'claude';
  createdAt: Date;
}

export interface IDailyTask {
  id: string;
  date: Date;
  content: string;
  type: 'character' | 'word' | 'phrase';
  details: {
    strokes?: number;
    repetitions?: number;
    sentence?: string;
  };
  status: 'pending' | 'in_progress' | 'completed';
  reward: number;
  completedAt: Date | null;
}

export interface IWeeklyLedger {
  id: string;
  startDate: Date;
  totalEarned: number;
  status: 'active' | 'paid_out';
  completedTaskIds: string[];
}

export type AIModel = 'gemini' | 'openai' | 'claude';

export interface AIAPIConfig {
  apiKey: string;
  model: AIModel;
}

export interface TaskGenerationRequest {
  userAge: number;
  grade: number;
  previousTasks?: string[];
}

export class AIServiceError extends Error {
  public readonly type: 'AUTH_ERROR' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'UNKNOWN';
  public readonly originalError?: any;

  constructor(
    message: string,
    type: 'AUTH_ERROR' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'UNKNOWN',
    originalError?: any
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.type = type;
    this.originalError = originalError;
  }
}