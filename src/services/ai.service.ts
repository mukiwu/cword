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
    return `
請為國小${request.grade}年級學生（${request.userAge}歲）生成今日的中文學習任務。

要求：
1. 生成2-3個任務，包含單字和單詞練習
2. 根據年級選擇適當難度的字詞
3. 每個任務包含：
   - content: 要學習的字或詞
   - type: "character"(單字) | "word"(單詞) | "phrase"(詞語應用)
   - details: 包含筆劃數、練習次數或造句要求
   - reward: 根據難度計算的學習幣獎勵

獎勵計算規則：
- 單字：5 + 難度加成(6-10劃+1, 11-15劃+2, 16+劃+3) + 次數加成(3-5次+1, 6-10次+2)，上限10
- 單詞應用：固定7學習幣
- 單詞書寫：6 + 次數加成

請回傳JSON格式：
{
  "tasks": [
    {
      "content": "天",
      "type": "character",
      "details": {"strokes": 4, "repetitions": 5},
      "reward": 6
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