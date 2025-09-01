import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfileService } from '../services/userProfile.service';
import type { AIModel } from '../types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 添加自定義 CSS 樣式 - 使用 Tailwind 3.4.16 的配置和語法
const styles = `
  :root {
    --primary: #57b5e7;
    --secondary: #8dd3c7;
  }

  .parchment-bg {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .avatar-card {
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .avatar-card:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(87, 181, 231, 0.3);
  }

  .avatar-card.selected {
    transform: scale(1.1);
    box-shadow: 0 0 0 3px #57b5e7;
    animation: bounce 0.5s ease;
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: scale(1.1) translateY(0);
    }
    40% {
      transform: scale(1.1) translateY(-10px);
    }
    60% {
      transform: scale(1.1) translateY(-5px);
    }
  }

  .age-button {
    transition: all 0.3s ease;
  }

  .age-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(87, 181, 231, 0.3);
  }

  .age-button.selected {
    background: #57b5e7 !important;
    color: white !important;
    transform: translateY(-2px);
  }

  .start-button {
    background: linear-gradient(145deg, #8B4513, #A0522D);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(139, 69, 19, 0.4);
  }

  .start-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
  }

  .start-button:hover::before {
    left: 100%;
  }

  .input-field {
    transition: all 0.3s ease;
  }

  .input-field:focus {
    box-shadow: 0 0 0 3px rgba(87, 181, 231, 0.3);
    transform: translateY(-1px);
  }

  .pulse-animation {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Tailwind 3.4.16 Primary Color Definition */
  .text-primary {
    color: #57b5e7;
  }

  .bg-primary {
    background-color: #57b5e7;
  }

  .border-primary {
    border-color: #57b5e7;
  }
`;

const ProfileSetup: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: 8,
    avatarId: '',
    aiModel: 'gemini' as AIModel,
    apiKey: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 頭像選項定義 - 像素風格職業頭像
  const avatars = [
    { 
      id: 'warrior', 
      name: '勇敢戰士', 
      description: '勇敢無畏',
      svgPath: '/cword/src/assets/avatars/warrior.svg'
    },
    { 
      id: 'mage', 
      name: '聰明魔法師', 
      description: '智慧過人',
      svgPath: '/cword/src/assets/avatars/mage.svg'
    },
    { 
      id: 'archer', 
      name: '神射手', 
      description: '百發百中',
      svgPath: '/cword/src/assets/avatars/archer.svg'
    },
    { 
      id: 'healer', 
      name: '治療師', 
      description: '溫柔善良',
      svgPath: '/cword/src/assets/avatars/healer.svg'
    },
    { 
      id: 'explorer', 
      name: '探險家', 
      description: '好奇心強',
      svgPath: '/cword/src/assets/avatars/explorer.svg'
    },
    { 
      id: 'scholar', 
      name: '學者', 
      description: '博學多聞',
      svgPath: '/cword/src/assets/avatars/scholar.svg'
    },
  ];

  // 年齡選項
  const ageOptions = [6, 7, 8, 9, 10, 11, 12];

  const handleSubmit = async () => {
    if (!formData.name || !formData.avatarId || !formData.apiKey) return;
    
    setIsLoading(true);
    setError('');

    try {
      // Store API key in session storage
      sessionStorage.setItem('ai_api_key', formData.apiKey);
      sessionStorage.setItem('ai_model', formData.aiModel);

      // Create user profile (without API key)
      await UserProfileService.createUser({
        name: formData.name,
        age: formData.age,
        avatarId: formData.avatarId,
        aiModel: formData.aiModel,
      });

      navigate('/guild');
    } catch (err) {
      setError('設定失敗，請重試');
      console.error('Profile setup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.avatarId && formData.apiKey.trim();

  return (
    <>
      <style>{styles}</style>
      <div className="flex items-center justify-center min-h-screen p-4" 
           style={{
             background: 'linear-gradient(135deg, #fef7e0 0%, #f9f1e6 100%)',
             backgroundImage: `
               radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(135, 206, 235, 0.1) 0%, transparent 50%),
               radial-gradient(circle at 40% 80%, rgba(255, 182, 193, 0.1) 0%, transparent 50%)
             `,
             fontFamily: "'PingFang TC', 'Microsoft JhengHei', sans-serif"
           }}>
        <div className="w-full max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl text-primary mb-4" style={{ fontFamily: 'Pacifico, cursive' }}>🏝️ 生字冒險島</h1>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">準備開始你的冒險旅程！</h2>
            <p className="text-lg text-gray-600">和我們說說你是誰吧！</p>
          </div>

          {/* Main Card */}
          <div className="parchment-bg rounded-3xl p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">創建你的冒險檔案</h3>
              <p className="text-gray-600">讓我們一起開始這段精彩的學習冒險！</p>
            </div>
            
            <div className="space-y-6">
              {/* 姓名輸入 */}
              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-pencil-line text-primary"></i>
                  </div>
                  你的冒險者暱稱
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="輸入你的暱稱..."
                  className="input-field w-full px-4 py-2.5 text-base border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none bg-white"
                  maxLength={20}
                />
              </div>

              {/* 年齡選擇 */}
              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-cake-2-line text-primary"></i>
                  </div>
                  你幾歲了呢？
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ageOptions.map(age => (
                    <button
                      key={age}
                      type="button"
                      className={`age-button px-3 py-2 text-base font-semibold border-2 border-gray-200 rounded-lg bg-white whitespace-nowrap ${
                        formData.age === age ? 'selected' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, age }))}
                    >
                      {age} 歲
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`age-button px-3 py-2 text-base font-semibold border-2 border-gray-200 rounded-lg bg-white whitespace-nowrap ${
                      formData.age > 12 ? 'selected' : ''
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, age: 13 }))}
                  >
                    其他
                  </button>
                </div>
              </div>

              {/* 頭像選擇 */}
              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-user-smile-line text-primary"></i>
                  </div>
                  選擇你的冒險者頭像
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {avatars.map(avatar => (
                    <div
                      key={avatar.id}
                      className={`avatar-card p-3 border-2 border-gray-200 rounded-xl bg-white text-center ${
                        formData.avatarId === avatar.id ? 'selected' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, avatarId: avatar.id }))}
                    >
                      <div className="w-16 h-16 mx-auto mb-2 rounded-lg bg-gray-100 p-1 flex items-center justify-center">
                        <img 
                          src={avatar.svgPath} 
                          alt={avatar.name}
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <h4 className="font-semibold text-gray-800 text-sm">{avatar.name}</h4>
                      <p className="text-xs text-gray-600">{avatar.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI 助手選擇 */}
              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-robot-line text-primary"></i>
                  </div>
                  AI 助手選擇
                </label>
                <Select 
                  value={formData.aiModel} 
                  onValueChange={(value: AIModel) => setFormData(prev => ({ ...prev, aiModel: value }))}
                >
                  <SelectTrigger className="text-base px-4 py-2.5 rounded-lg border-2">
                    <SelectValue placeholder="選擇 AI 助手" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI GPT</SelectItem>
                    <SelectItem value="claude">Anthropic Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key 輸入 */}
              <div className="space-y-3">
                <label className="block text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-key-line text-primary"></i>
                  </div>
                  API 金鑰 (用於生成任務)
                </label>
                <Input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="請輸入你的 AI API 金鑰"
                  className="input-field w-full px-4 py-2.5 text-base border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none bg-white"
                />
                <p className="text-xs text-gray-500">
                  金鑰將安全地儲存在你的瀏覽器中，不會上傳到伺服器
                </p>
              </div>

              {/* 錯誤訊息 */}
              {error && (
                <div className="text-red-600 text-center p-3 bg-red-50 rounded-xl border border-red-200">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="text-center">
            <p className="text-gray-600 mb-4">準備好了嗎？點擊開始你的學習冒險！</p>
            <button
              type="button"
              disabled={!isFormValid || isLoading}
              onClick={handleSubmit}
              className={`start-button px-6 py-3 text-lg font-bold text-white rounded-xl whitespace-nowrap ${
                !isFormValid || isLoading ? 'opacity-50 cursor-not-allowed' : 'pulse-animation'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 flex items-center justify-center">
                  {isLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-rocket-line"></i>}
                </div>
                {isLoading ? '正在設定...' : '完成設定，開始冒險！'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSetup;
