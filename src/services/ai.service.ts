import type { AIAPIConfig, TaskGenerationRequest } from '../types';
import { AIServiceError } from '../types';

interface AIResponse {
  tasks: Array<{
    content: string;
    type: 'character' | 'word' | 'phrase';
    details: {
      strokes?: number;
      repetitions?: number;
      sentence?: string;
    };
    reward: number;
  }>;
}

export class AIService {
  static async generateTaskContent(
    config: AIAPIConfig,
    request: TaskGenerationRequest
  ): Promise<AIResponse> {
    const prompt = this.buildPrompt(request);
    
    try {
      switch (config.model) {
        case 'gemini':
          return await this.callGeminiAPI(config.apiKey, prompt);
        case 'openai':
          return await this.callOpenAIAPI(config.apiKey, prompt);
        case 'claude':
          return await this.callClaudeAPI(config.apiKey, prompt);
        default:
          throw new Error(`Unsupported AI model: ${config.model}`);
      }
    } catch (error) {
      console.error('AI Service Error:', error);
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError('Failed to generate tasks from AI service', 'UNKNOWN', error);
    }
  }

  private static buildPrompt(request: TaskGenerationRequest): string {
    const previousTasksList = (request.previousTasks && request.previousTasks.length > 0)
      ? request.previousTasks.join('、') 
      : '無';
    
    return `
請為國小${request.grade}年級學生（${request.userAge}歲）生成今日的中文學習任務。

**重要約束條件：**
🚫 **絕對不可使用以下已學過的字詞：** ${previousTasksList}

**任務生成要求（提升挑戰性）：**
1. 生成3個**高品質且具挑戰性**的任務
2. 任務必須包含：
   - 1個單字任務（筆劃數8劃以上的較複雜字）
   - 1個詞語應用任務（理解詞意並完成造句練習）
   - 1個詞語書寫任務（雙字詞，需重複練習）
3. 每個任務包含：
   - content: 要學習的字或詞（選擇有教育價值且有一定難度的內容）
   - type: "character"(單字) | "word"(單詞書寫) | "phrase"(詞語造句應用)
   - details: 筆劃數、練習次數（至少5次）、或造句要求（不涉及時間）
   - reward: 根據新的嚴格標準計算

**獎勵計算規則（更嚴格的標準）：**
- 單字任務：3 + 難度加成(8-12劃+1, 13-16劃+2, 17+劃+3) + 次數加成(5-7次+1, 8-10次+2)，上限8
- 詞語造句應用：理解詞意並造句，固定5學習幣
- 詞語書寫：4 + 次數加成(需書寫6次以上)

**年級${request.grade}適合的字詞範圍（提升難度）：**
${request.grade <= 2 ? '二年級進階字詞：包含形聲字、會意字、常用複合詞，如「聰明」、「美麗」、「故事」、「朋友」等' : 
  request.grade <= 4 ? '中高年級字詞：包含成語、多音字、同義詞，如「努力」、「勇敢」、「認真」等' : 
  '高年級字詞：包含成語、古詩詞、文學用語、專業詞彙'}

**驗證步驟：**
1. 檢查生成的每個字/詞是否出現在禁用列表中
2. 如果有重複，請立即替換為其他適合的字詞
3. 確保最終結果完全避開已學過的內容

**國小${request.grade}年級範例（提升難度後）：**
- 單字範例：「聰」(17劃，練習7次) → 獎勵：3+3+1=7學習幣
- 詞語造句應用範例：「努力」→「請用『努力』造一個完整的句子，展現努力的意思」→ 固定5學習幣  
- 詞語書寫範例：「美麗」(練習6次) → 獎勵：4+1=5學習幣

請回傳JSON格式：
{
  "tasks": [
    {
      "content": "聰",
      "type": "character", 
      "details": {"strokes": 17, "repetitions": 7},
      "reward": 7
    },
    {
      "content": "努力",
      "type": "phrase",
      "details": {"sentence": "請用『努力』造一個完整的句子，展現努力的意思"},
      "reward": 5
    },
    {
      "content": "美麗", 
      "type": "word",
      "details": {"repetitions": 6},
      "reward": 5
    }
  ]
}
`;
  }

  private static async callGeminiAPI(apiKey: string, prompt: string): Promise<AIResponse> {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AIServiceError(
            'API Key 無效或權限不足，請檢查你的 Gemini API Key',
            'AUTH_ERROR'
          );
        }
        if (response.status === 429) {
          throw new AIServiceError(
            'API 請求次數過多，請稍後再試',
            'RATE_LIMIT'
          );
        }
        throw new AIServiceError(
          `Gemini API 錯誤：${response.status} ${response.statusText}`,
          'NETWORK_ERROR'
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new AIServiceError('Gemini API 沒有回傳內容', 'INVALID_RESPONSE');
      }

      return this.parseAIResponse(text);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError('網路連線失敗，請檢查網路連線', 'NETWORK_ERROR', error);
      }
      throw new AIServiceError('呼叫 Gemini API 時發生未知錯誤', 'UNKNOWN', error);
    }
  }

  private static async callOpenAIAPI(apiKey: string, prompt: string): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AIServiceError(
            'API Key 無效或權限不足，請檢查你的 OpenAI API Key',
            'AUTH_ERROR'
          );
        }
        if (response.status === 429) {
          throw new AIServiceError(
            'API 請求次數過多，請稍後再試',
            'RATE_LIMIT'
          );
        }
        throw new AIServiceError(
          `OpenAI API 錯誤：${response.status} ${response.statusText}`,
          'NETWORK_ERROR'
        );
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (!text) {
        throw new AIServiceError('OpenAI API 沒有回傳內容', 'INVALID_RESPONSE');
      }

      return this.parseAIResponse(text);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError('網路連線失敗，請檢查網路連線', 'NETWORK_ERROR', error);
      }
      throw new AIServiceError('呼叫 OpenAI API 時發生未知錯誤', 'UNKNOWN', error);
    }
  }

  private static async callClaudeAPI(apiKey: string, prompt: string): Promise<AIResponse> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AIServiceError(
            'API Key 無效或權限不足，請檢查你的 Claude API Key',
            'AUTH_ERROR'
          );
        }
        if (response.status === 429) {
          throw new AIServiceError(
            'API 請求次數過多，請稍後再試',
            'RATE_LIMIT'
          );
        }
        throw new AIServiceError(
          `Claude API 錯誤：${response.status} ${response.statusText}`,
          'NETWORK_ERROR'
        );
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      
      if (!text) {
        throw new AIServiceError('Claude API 沒有回傳內容', 'INVALID_RESPONSE');
      }

      return this.parseAIResponse(text);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError('網路連線失敗，請檢查網路連線', 'NETWORK_ERROR', error);
      }
      throw new AIServiceError('呼叫 Claude API 時發生未知錯誤', 'UNKNOWN', error);
    }
  }

  private static parseAIResponse(text: string): AIResponse {
    try {
      // Extract JSON from the response text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AIServiceError('AI 回應中沒有找到 JSON 格式的內容', 'INVALID_RESPONSE');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new AIServiceError('AI 回應格式不正確，缺少任務陣列', 'INVALID_RESPONSE');
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', text);
      
      if (error instanceof AIServiceError) {
        throw error;
      }
      
      // Return fallback tasks if parsing fails
      console.warn('使用預設任務作為備用方案');
      return {
        tasks: [
          {
            content: '學',
            type: 'character',
            details: { strokes: 8, repetitions: 5 },
            reward: 7
          }
        ]
      };
    }
  }
}