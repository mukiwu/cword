import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfileService } from '../services/userProfile.service';
import type { AIModel } from '../types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 導入職業頭像圖片
import warriorSvg from '@/assets/avatars/warrior.svg';
import mageSvg from '@/assets/avatars/mage.svg';
import archerSvg from '@/assets/avatars/archer.svg';
import healerSvg from '@/assets/avatars/healer.svg';
import explorerSvg from '@/assets/avatars/explorer.svg';
import scholarSvg from '@/assets/avatars/scholar.svg';

// 添加自定義 CSS 樣式 - 使用 Tailwind 3.4.16 的配置和語法
const styles = `
  :root {
    --primary: #D4AF37;
    --secondary: #8B4513;
  }

  .parchment-bg {
    backdrop-filter: blur(10px);
    border: 2px solid #8B4513;
  }

  .avatar-card {
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .avatar-card {
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #D2691E;
  }

  .avatar-card:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
  }

  .avatar-card.selected {
    transform: scale(1.1);
    box-shadow: 0 0 0 3px #D4AF37;
    background: none;
    animation: bounce 0.5s ease;
  }

  .avatar-card.selected h4 {
    color: #D4AF37;
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
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #D2691E !important;
    transition: all 0.3s ease;
  }

  .age-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
  }

  .age-button.selected {
    background: #D4AF37 !important;
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
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #D2691E;
    transition: all 0.3s ease;
  }

  .input-field:focus {
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.4);
    border-color: #D4AF37;
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
    color: #D4AF37;
  }

  .bg-primary {
    background-color: #D4AF37;
  }

  .border-primary {
    border-color: #D4AF37;
  }

  /* 試用模式選項卡樣式 */
  .mode-tab {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(212, 175, 55, 0.3);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .mode-tab:hover {
    background: rgba(212, 175, 55, 0.2);
    border-color: rgba(212, 175, 55, 0.6);
    transform: translateY(-1px);
  }

  .mode-tab.active {
    background: linear-gradient(135deg, #D4AF37, #FFD700);
    border-color: #D4AF37;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
  }

  .mode-tab.active .tab-icon {
    transform: scale(1.1);
  }

  .trial-info-box {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.2));
    border: 2px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
  }
`;

const ProfileSetup: React.FC = () => {
  const [isTrialMode, setIsTrialMode] = useState(false); // 預設為非試用模式
  const [isTrialAvailable, setIsTrialAvailable] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
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

  // 試用模式的 API Key (從環境變數讀取)
  const TRIAL_API_KEY = import.meta.env.VITE_TRIAL_API_KEY;
  const TRIAL_STORAGE_KEY = 'trial_first_used_date';

  // 檢查試用是否可用 (7天試用期)
  const checkTrialAvailability = () => {
    const firstUsedDate = localStorage.getItem(TRIAL_STORAGE_KEY);
    
    if (!firstUsedDate) {
      // 從未使用過試用，可以使用
      return true;
    }
    
    const firstUsed = new Date(firstUsedDate);
    const today = new Date();
    
    // 計算天數差異
    const diffTime = today.getTime() - firstUsed.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 7天試用期內可以使用
    return diffDays < 7;
  };

  // 取得剩餘試用天數
  const getRemainingTrialDays = () => {
    const firstUsedDate = localStorage.getItem(TRIAL_STORAGE_KEY);
    if (!firstUsedDate) return 7;
    
    const firstUsed = new Date(firstUsedDate);
    const today = new Date();
    const diffTime = today.getTime() - firstUsed.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, 7 - diffDays);
  };

  useEffect(() => {
    document.title = '開始冒險 | 生字冒險島';
    
    // 檢查試用可用性
    const trialAvailable = checkTrialAvailability();
    setIsTrialAvailable(trialAvailable);
    setTrialExpired(!trialAvailable && !!localStorage.getItem(TRIAL_STORAGE_KEY));
    
    // 如果試用可用，預設選擇試用模式
    if (trialAvailable) {
      setIsTrialMode(true);
    }
  }, []);

  // 當切換到試用模式時，自動設定為 Gemini
  useEffect(() => {
    if (isTrialMode) {
      setFormData(prev => ({ ...prev, aiModel: 'gemini' }));
    }
  }, [isTrialMode]);

  // 頭像選項定義 - 像素風格職業頭像
  const avatars = [
    { 
      id: 'warrior', 
      name: '勇敢戰士', 
      description: '勇敢無畏',
      svgPath: warriorSvg
    },
    { 
      id: 'mage', 
      name: '聰明魔法師', 
      description: '智慧過人',
      svgPath: mageSvg
    },
    { 
      id: 'archer', 
      name: '神射手', 
      description: '百發百中',
      svgPath: archerSvg
    },
    { 
      id: 'healer', 
      name: '治療師', 
      description: '溫柔善良',
      svgPath: healerSvg
    },
    { 
      id: 'explorer', 
      name: '探險家', 
      description: '好奇心強',
      svgPath: explorerSvg
    },
    { 
      id: 'scholar', 
      name: '學者', 
      description: '博學多聞',
      svgPath: scholarSvg
    },
  ];

  // 年齡選項
  const ageOptions = [6, 7, 8, 9, 10, 11, 12];

  const handleSubmit = async () => {
    const apiKey = isTrialMode ? TRIAL_API_KEY : formData.apiKey;
    
    if (!formData.name || !formData.avatarId || (!isTrialMode && !formData.apiKey)) return;
    
    setIsLoading(true);
    setError('');

    try {
      if (isTrialMode) {
        // 試用模式：不儲存 API Key，直接使用環境變數，只記錄試用狀態
        localStorage.setItem('ai_model', formData.aiModel);
        localStorage.setItem('is_trial_mode', 'true');
        
        // 記錄試用開始日期
        if (!localStorage.getItem(TRIAL_STORAGE_KEY)) {
          localStorage.setItem(TRIAL_STORAGE_KEY, new Date().toISOString());
        }
      } else {
        // 正式模式：API Key 存在 localStorage
        localStorage.setItem('ai_api_key', apiKey);
        localStorage.setItem('ai_model', formData.aiModel);
        localStorage.removeItem('is_trial_mode');
      }

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

  const isFormValid = formData.name.trim() && formData.avatarId && (isTrialMode || formData.apiKey.trim());

  return (
    <>
      <style>{styles}</style>
      <div className="flex items-center justify-center min-h-screen p-4" 
           style={{
             backgroundImage: `
               linear-gradient(
                 rgba(0, 0, 0, 0.3),
                 rgba(0, 0, 0, 0.3)
               ),
               url('${import.meta.env.BASE_URL}setup.jpg')
             `,
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed',
             fontFamily: "'PingFang TC', 'Microsoft JhengHei', sans-serif"
           }}>
        <div className="w-full max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl text-primary mb-4 drop-shadow-lg font-bold">🏝️ 生字冒險島</h1>
            <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">準備開始你的冒險旅程！</h2>
          </div>

          {/* Main Card */}
          <div className="parchment-bg rounded-3xl p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-amber-400 mb-2">創建你的冒險檔案</h3>
              <p className="text-neutral-50">讓我們一起開始這段精彩的學習冒險！</p>
            </div>
            
            <div className="space-y-6">
              {/* 姓名輸入 */}
              <div className="space-y-3">
                <label className="flex text-lg font-semibold text-neutral-50 items-center gap-2">
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
                  className="input-field w-full px-4 py-2.5 text-base rounded-lg focus:outline-none"
                  maxLength={20}
                />
              </div>

              {/* 年齡選擇 */}
              <div className="space-y-3">
                <label className="text-lg font-semibold text-neutral-50 flex items-center gap-2">
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
                      className={`age-button px-3 py-2 text-base font-semibold rounded-lg whitespace-nowrap ${
                        formData.age === age ? 'selected' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, age }))}
                    >
                      {age} 歲
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`age-button px-3 py-2 text-base font-semibold rounded-lg whitespace-nowrap ${
                      formData.age > 12 ? 'selected' : ''
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, age: 13 }))}
                  >
                    超過 12 歲
                  </button>
                </div>
              </div>

              {/* 頭像選擇 */}
              <div className="space-y-3">
                <label className="text-lg font-semibold text-neutral-50 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-user-smile-line text-primary"></i>
                  </div>
                  選擇你的冒險者頭像
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {avatars.map(avatar => (
                    <div
                      key={avatar.id}
                      className={`avatar-card p-3 rounded-xl text-center ${
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
                      <h4 className="font-semibold text-black text-sm">{avatar.name}</h4>
                      <p className="text-amber-500">{avatar.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 模式選擇選項卡 */}
              <div className="space-y-4">
                <label className="text-lg font-semibold text-neutral-50 flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-settings-line text-primary"></i>
                  </div>
                  選擇使用方式
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* 試用模式 */}
                  <div 
                    className={`mode-tab p-4 rounded-xl text-center ${
                      isTrialMode ? 'active' : ''
                    } ${!isTrialAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => isTrialAvailable && setIsTrialMode(true)}
                  >
                    <div className="tab-icon text-2xl mb-2">
                      {isTrialAvailable ? '🚀' : '⏰'}
                    </div>
                    <h4 className="text-sm text-white mb-1">
                      {isTrialAvailable ? '立即試用' : '試用已結束'}
                    </h4>
                    <p className="text-white">
                      {isTrialAvailable ? '推薦新手' : '7天試用已結束'}
                    </p>
                    <div className={`mt-2 px-2 py-1 rounded text-sm ${
                      isTrialAvailable 
                        ? 'bg-orange-500 bg-opacity-20 text-black'
                        : 'bg-gray-500 bg-opacity-20 text-gray-400'
                    }`}>
                      {isTrialAvailable ? '免費體驗' : '已過期'}
                    </div>
                  </div>
                  
                  {/* 自己的 API Key */}
                  <div 
                    className={`mode-tab p-4 rounded-xl text-center ${!isTrialMode ? 'active' : ''}`}
                    onClick={() => setIsTrialMode(false)}
                  >
                    <div className="tab-icon text-2xl mb-2">🔑</div>
                    <h4 className="text-sm text-white mb-1">使用自己的 API</h4>
                    <p className="text-white">無使用限制</p>
                    <div className="mt-2 px-2 py-1 bg-blue-500 bg-opacity-20 rounded text-sm text-blue-300">
                      免費申請
                    </div>
                  </div>
                </div>
              </div>

              {/* 試用過期提示 */}
              {trialExpired && !isTrialMode && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-400/50 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="ri-time-line text-white text-lg"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-300 mb-2">⏰ 試用期已結束</h4>
                      <p className="text-orange-200 text-sm mb-3">
                        你的7天試用期已結束！要繼續使用所有功能，請申請你專屬的免費 API Key。
                      </p>
                      <div className="bg-blue-50 bg-opacity-10 rounded-lg p-3 border border-blue-300 border-opacity-30">
                        <div className="flex items-center gap-2 mb-2">
                          <i className="ri-gift-line text-blue-300"></i>
                          <span className="text-sm font-medium text-blue-300">好消息！申請完全免費</span>
                        </div>
                        <p className="text-xs text-blue-200 mb-2">
                          我們準備了詳細教學，只需要幾分鐘就能申請到你的專屬 API Key
                        </p>
                        <a
                          href="https://muki.tw/free-google-gemini-api-key/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
                        >
                          <i className="ri-external-link-line"></i>
                          立即查看申請教學
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isTrialMode && isTrialAvailable && (
                /* 試用模式說明 */
                <div className="trial-info-box p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="ri-check-line text-white text-lg"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-300 mb-2">🎉 試用模式已啟用</h4>
                      <ul className="text-sm text-green-200 space-y-1">
                        <li>• 使用 Google Gemini AI 助手</li>
                        <li>• 無需申請 API Key，立即開始學習</li>
                        <li>• 適合初次體驗的使用者</li>
                        <li>⚠️ <span className="text-yellow-300">試用期限：7 天免費使用（剩餘 {getRemainingTrialDays()} 天）</span></li>
                        <li>⚠️ <span className="text-yellow-300">使用人數過多時可能會超過額度限制而無法使用</span></li>
                        <li>💡 <span className="text-blue-300">建議申請個人 API Key 以獲得最佳體驗</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {!isTrialMode && (
                /* 自己 API Key 模式 */
                <>
                  {/* AI 助手選擇 */}
                  <div className="space-y-3">
                    <label className="text-lg font-semibold text-neutral-50 flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className="ri-robot-line text-primary"></i>
                      </div>
                      AI 助手選擇
                    </label>
                    <Select 
                      value={formData.aiModel} 
                      onValueChange={(value: AIModel) => setFormData(prev => ({ ...prev, aiModel: value }))}
                    >
                      <SelectTrigger className="text-base px-4 py-2.5 rounded-lg border-2 border-yellow-600 text-white">
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
                    <label className="text-lg font-semibold text-neutral-50 flex items-center gap-2">
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
                      className="input-field w-full px-4 py-2.5 text-base rounded-lg focus:outline-none"
                    />
                    <div className="space-y-2">
                      <p className="text-xs text-neutral-50">
                        金鑰將安全地儲存在你的瀏覽器中，不會上傳到伺服器
                      </p>
                      <div className="bg-blue-50 bg-opacity-10 rounded-lg p-3 border border-blue-300 border-opacity-30">
                        <div className="flex items-center gap-2 mb-2">
                          <i className="ri-book-open-line text-blue-600"></i>
                          <span className="text-sm font-medium text-blue-600">需要申請免費 API Key？</span>
                        </div>
                        <p className="text-blue-600 mb-2">
                          我們為你準備了詳細的申請教學，完全免費且簡單易懂！
                        </p>
                        <a
                          href="https://muki.tw/free-google-gemini-api-key/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-amber-600 underline transition-colors"
                        >
                          <i className="ri-external-link-line"></i>
                          查看免費申請教學
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              )}

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
            <p className="text-white mb-4 drop-shadow-md">準備好了嗎？點擊開始你的學習冒險！</p>
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

          {/* GitHub 連結 */}
          <div className="text-center mt-8">
            <a
              href="https://github.com/mukiwu/cword"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white hover:text-yellow-300 transition-colors opacity-80 hover:opacity-100"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-github-fill text-lg"></i>
              </div>
              <span className="text-sm">GitHub - MukiWu</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSetup;
