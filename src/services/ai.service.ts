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
  /**
   * 驗證 API Key 是否有效 - 只檢查 HTTP 200 狀態碼
   * @param config API 配置
   * @returns Promise<boolean> 驗證結果
   */
  static async validateApiKey(config: AIAPIConfig): Promise<boolean> {
    try {
      let response: Response;

      switch (config.model) {
        case 'gemini':
          response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: '測試' }] }],
              }),
            }
          );
          break;

        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: '測試' }],
              max_tokens: 5,
            }),
          });
          break;

        case 'claude':
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': config.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 5,
              messages: [{ role: 'user', content: '測試' }],
            }),
          });
          break;

        default:
          throw new AIServiceError(`不支援的 AI 模型: ${config.model}`, 'AUTH_ERROR');
      }

      // 只檢查是否回傳 200 狀態碼，不解析回應內容
      if (response.status === 200) {
        return true;
      } else {
        // 根據狀態碼提供更具體的錯誤訊息
        if (response.status === 400) {
          throw new AIServiceError('API Key 格式錯誤或請求參數有誤', 'AUTH_ERROR');
        } else if (response.status === 401 || response.status === 403) {
          throw new AIServiceError('API Key 無效或權限不足', 'AUTH_ERROR');
        } else if (response.status === 429) {
          throw new AIServiceError('API 請求次數過多，請稍後再試', 'RATE_LIMIT');
        } else {
          throw new AIServiceError(`API 錯誤：${response.status} ${response.statusText}`, 'NETWORK_ERROR');
        }
      }

    } catch (error) {
      console.error('API Key validation failed:', error);

      if (error instanceof AIServiceError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIServiceError('網路連線失敗，請檢查網路連線', 'NETWORK_ERROR', error);
      }

      throw new AIServiceError('API Key 驗證時發生未知錯誤', 'UNKNOWN', error);
    }
  }

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

    // 計算學習年級和筆畫範圍
    const learningGrade = request.grade;
    const strokeRanges = {
      1: '5-10', 2: '8-13', 3: '10-16', 4: '13-20',
      5: '16-25', 6: '16-25', 7: '18-30'
    };
    const difficultyLevels = {
      1: '二年級程度', 2: '三年級程度', 3: '四年級程度',
      4: '五年級程度', 5: '六年級程度', 6: '六年級程度',
      7: '六年級進階（含冷僻字）'
    };

    return `
你是台灣國小國語文教學專家，熟悉教育部課程綱要。請為${request.userAge}歲學生生成3個超前學習任務。

**超前學習概念：**
- 學生年齡：${request.userAge}歲
- 學習內容：${difficultyLevels[learningGrade as keyof typeof difficultyLevels]}
- 目標筆畫：${strokeRanges[learningGrade as keyof typeof strokeRanges]}筆畫
- 台灣教材：參考教育部常用字頻表、部編國語課本

**嚴格避重規則：**
🚫 **絕對不可使用已學字詞：** ${previousTasksList}

**生成3個任務：**
1. 單字書寫任務（含筆劃數、練習次數）
2. 詞語書寫任務（雙字詞，重複練習）  
3. 詞語造句應用（提供造句指導）

**台灣教育部標準要求：**
${learningGrade <= 2 ? `
- 學習重點：形聲字、會意字、生活常用詞
- 詞彙特色：校園生活、人際關係、基礎情感表達
- 注音考量：注意多音字（如：重、長、好）
- 範例詞彙：朋友、故事、老師、同學、班級
` : learningGrade <= 4 ? `
- 學習重點：抽象概念詞、社會議題、環境認知
- 詞彙特色：品格教育、環境保護、公民意識  
- 注音考量：破音字、語音變化
- 範例詞彙：環境、保護、民主、自由、正義
` : learningGrade === 7 ? `
- 學習重點：文學詞彙、古典用語、高階抽象概念
- 詞彙特色：30%冷僻字比例、成語典故、詩詞用語
- 注音考量：古音讀法、文白異讀
- 範例詞彙：璀璨、磅礴、蒼穹、翱翔、浩瀚
` : `
- 學習重點：科學概念、邏輯思維、學術詞彙
- 詞彙特色：抽象思考、科技發展、哲學概念
- 注音考量：專業術語、外來語音譯
- 範例詞彙：科學、技術、邏輯、分析、創新
`}

**獎勵計算（符合台灣教學標準）：**
- 單字任務：基礎5 + 筆畫符合度加成 + 傳統難度加成 + 次數加成，上限8
  - 符合年級筆畫範圍：+1
  - 超出年級範圍（挑戰性）：+2  
  - 低於年級範圍：-1
- 詞語書寫：基礎7 + 複雜度加成(25-29筆畫+1, 30+筆畫+2)，範圍7-11學習幣
- 詞語造句：基礎3 + 複雜度加成(18-24筆畫或2字+1, 25+筆畫或3字+2)，範圍3-6學習幣
${learningGrade === 7 ? '- 六年級進階額外獎勵：+1學習幣' : ''}

**品質檢核：**
1. 所有詞彙符合台灣用語習慣
2. 避開簡體字、異體字  
3. 符合該年級認知發展程度
4. 具備教育意義和文化內涵

**範例格式：**
{
  "tasks": [
    {
      "content": "朋",
      "type": "character", 
      "details": {"strokes": 8, "repetitions": 5},
      "reward": 6
    },
    {
      "content": "朋友",
      "type": "word",
      "details": {"repetitions": 6},
      "reward": 6
    },
    {
      "content": "故事",
      "type": "phrase",
      "details": {"sentence": "請用『故事』造一個完整的句子，描述你聽過的故事"},
      "reward": 7
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
        if (response.status === 400) {
          throw new AIServiceError(
            'Gemini API Key 格式錯誤或請求參數有誤',
            'AUTH_ERROR'
          );
        }
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
        if (response.status === 400) {
          throw new AIServiceError(
            'OpenAI API Key 格式錯誤或請求參數有誤',
            'AUTH_ERROR'
          );
        }
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
        if (response.status === 400) {
          throw new AIServiceError(
            'Claude API Key 格式錯誤或請求參數有誤',
            'AUTH_ERROR'
          );
        }
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
            reward: 5
          },
          {
            content: '美好',
            type: 'word',
            details: { repetitions: 6 },
            reward: 6
          },
          {
            content: '學習',
            type: 'phrase',
            details: { sentence: '請用『學習』造一個完整的句子，表達學習的重要性。' },
            reward: 7
          }
        ]
      };
    }
  }
}
