import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { IDailyTask, IUserProfile, AIModel } from '../types';
import { AIServiceError } from '../types';
import { TaskGenerationService } from '../services/taskGeneration.service';
import { UserProfileService } from '../services/userProfile.service';
import { WeeklyLedgerService } from '../services/weeklyLedger.service';
import ApiConfigModal from '../components/ApiConfigModal';

// 添加自定義 CSS 樣式 - 採用 docs/main.html 的設計風格
const styles = `
  .parchment-bg {
    background: linear-gradient(135deg, #f4f1e8 0%, #e8dcc0 100%);
    box-shadow: inset 0 0 20px rgba(139, 69, 19, 0.1);
  }

  .wood-texture {
    background: linear-gradient(45deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #A0522D 75%, #8B4513 100%);
  }

  .coin-glow {
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
  }

  .task-card {
    background: linear-gradient(135deg, #f9f7f1 0%, #f0ecd9 100%);
    border: 3px solid #D2691E;
    position: relative;
    transition: all 0.3s ease;
    opacity: 0.8;
  }

  .task-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(139, 69, 19, 0.2);
  }

  .task-card::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 10px;
    background: #8B4513;
    border-radius: 0 0 50% 50%;
  }

  .guild-badge {
    background: radial-gradient(circle, #FFD700 0%, #FFA500 100%);
    border: 3px solid #8B4513;
  }

  .scroll-bg {
    background: linear-gradient(90deg, #f4f1e8 0%, #fff8dc 50%, #f4f1e8 100%);
    border: 2px solid #D2691E;
    position: relative;
  }

  .scroll-bg::before,
  .scroll-bg::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 80%;
    background: #8B4513;
    border-radius: 10px;
  }

  .scroll-bg::before {
    left: -10px;
  }

  .scroll-bg::after {
    right: -10px;
  }

  .medieval-bg {
    background: linear-gradient(135deg, 
      rgba(139, 69, 19, 0.9) 0%, 
      rgba(160, 82, 45, 0.7) 25%, 
      rgba(139, 69, 19, 0.9) 50%, 
      rgba(160, 82, 45, 0.7) 75%, 
      rgba(139, 69, 19, 0.9) 100%
    ), 
    radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 165, 0, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(210, 105, 30, 0.15) 0%, transparent 50%);
    background-color: #8B4513;
    min-height: 100vh;
  }
`;

const AdventurerGuild: React.FC = () => {
  const [tasks, setTasks] = useState<IDailyTask[]>([]);
  const [userProfile, setUserProfile] = useState<IUserProfile | null>(null);
  const [todayCoins, setTodayCoins] = useState(0);
  const [weeklyCoins, setWeeklyCoins] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiError, setApiError] = useState<AIServiceError | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load user profile
      const profile = await UserProfileService.getUserProfile();
      setUserProfile(profile || null);

      // Get API configuration from session storage
      const apiKey = sessionStorage.getItem('ai_api_key');
      const aiModel = sessionStorage.getItem('ai_model') as 'gemini' | 'openai' | 'claude';

      if (!apiKey || !aiModel) {
        const configError = new AIServiceError('API 設定遺失，請重新設定', 'AUTH_ERROR');
        setApiError(configError);
        setError('API 設定遺失，請重新設定');
        return;
      }

      // Load or generate today's tasks
      let todayTasks = await TaskGenerationService.getTodaysTasks();
      
      if (todayTasks.length === 0) {
        todayTasks = await TaskGenerationService.createDailyTasksForUser({
          apiKey,
          model: aiModel,
        });
      }

      setTasks(todayTasks);

      // Calculate today's coins
      const completedToday = todayTasks.filter(task => task.status === 'completed');
      const todaysEarnings = completedToday.reduce((sum, task) => sum + task.reward, 0);
      setTodayCoins(todaysEarnings);

      // Get weekly total
      const weeklyTotal = await WeeklyLedgerService.getCurrentWeekTotal();
      setWeeklyCoins(weeklyTotal);

      // Clear any previous errors on successful load
      setError('');
      setApiError(null);

    } catch (err) {
      console.error('Failed to load data:', err);
      
      if (err instanceof AIServiceError) {
        setApiError(err);
        if (err.type === 'AUTH_ERROR') {
          setError('API 認證失敗，請重新設定 API Key');
        } else if (err.type === 'RATE_LIMIT') {
          setError('API 請求次數過多，請稍後再試');
        } else if (err.type === 'NETWORK_ERROR') {
          setError('網路連線失敗，請檢查網路連線或重新設定 API');
        } else {
          setError('AI 服務發生錯誤，請重新設定 API 配置');
        }
      } else {
        setError('載入資料失敗，請重新整理頁面');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskInteraction = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.status === 'pending') {
        // 第一次點擊：接受任務 -> 進行中
        await TaskGenerationService.startTask(taskId);
      } else if (task.status === 'in_progress') {
        // 第二次點擊：完成任務 -> 已完成
        await TaskGenerationService.completeTask(taskId);
      }
      
      await loadData(); // Refresh data
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('更新任務失敗，請重試');
    }
  };

  const handleApiConfigSave = async (apiKey: string, model: AIModel) => {
    try {
      // Update session storage
      sessionStorage.setItem('ai_api_key', apiKey);
      sessionStorage.setItem('ai_model', model);

      // Update user profile
      if (userProfile && userProfile.id) {
        await UserProfileService.updateProfile(userProfile.id, {
          aiModel: model,
        });
      }

      // Clear errors and reload data
      setError('');
      setApiError(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save API config:', err);
      throw err;
    }
  };

  const handleRetry = async () => {
    setError('');
    setApiError(null);
    setIsLoading(true);
    await loadData();
  };

  const getTaskIcon = (type: IDailyTask['type']) => {
    switch (type) {
      case 'character': return 'ri-pencil-line';
      case 'word': return 'ri-book-open-line';
      case 'phrase': return 'ri-chat-3-line';
      default: return 'ri-book-line';
    }
  };

  const getTaskTypeText = (type: IDailyTask['type']) => {
    switch (type) {
      case 'character': return '單字練習';
      case 'word': return '單詞學習';
      case 'phrase': return '詞語應用';
      default: return '學習任務';
    }
  };

  const getTaskGradient = (type: IDailyTask['type']) => {
    switch (type) {
      case 'character': return 'from-red-400 to-red-600';
      case 'word': return 'from-blue-400 to-blue-600';
      case 'phrase': return 'from-green-400 to-green-600';
      default: return 'from-purple-400 to-purple-600';
    }
  };

  if (isLoading) {
    return (
      <>
        <style>{styles}</style>
        <div 
          className="min-h-screen flex items-center justify-center"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(0, 0, 0, 0.4),
                rgba(0, 0, 0, 0.4)
              ),
              url('/cword/bg.jpg')
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className="parchment-bg rounded-3xl p-8 text-center">
            <div className="w-16 h-16 guild-badge rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-loader-4-line text-2xl text-yellow-800 animate-spin"></i>
            </div>
            <div className="text-xl font-bold text-yellow-800">載入中...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div 
        className="min-h-screen"
        style={{
          fontFamily: "'PingFang TC', 'Microsoft JhengHei', sans-serif",
          backgroundImage: `
            linear-gradient(
              rgba(0, 0, 0, 0.4),
              rgba(0, 0, 0, 0.4)
            ),
            url('/cword/bg.jpg')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Header */}
        <header className="flex justify-between items-center p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 guild-badge rounded-full flex items-center justify-center">
              <span className="font-['Pacifico'] text-yellow-800 text-xl font-bold">🏛️</span>
            </div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              冒險者公會
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black bg-opacity-50 rounded-xl px-4 py-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-user-line text-white text-xl"></i>
              </div>
              <span className="text-white font-medium">Lv.{userProfile?.age || '?'}</span>
            </div>
            <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-user-fill text-white text-xl"></i>
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 pb-6">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
              嗨，{userProfile?.name || '冒險者'}！
            </h2>
            <p className="text-white text-lg opacity-90">
              準備好迎接今日的挑戰了嗎？
            </p>
          </div>

          {/* Coins Dashboard */}
          <div className="scroll-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl opacity-80">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 coin-glow bg-yellow-400 rounded-full flex items-center justify-center">
                  <i className="ri-coin-fill text-yellow-800 text-xl"></i>
                </div>
                <div>
                  <p className="text-yellow-800 font-bold text-lg">今日獲得</p>
                  <p className="text-2xl font-bold text-yellow-600">{todayCoins} 學習幣</p>
                </div>
              </div>

              <div className="w-px h-16 bg-yellow-600 opacity-30"></div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
                  <i className="ri-treasure-map-fill text-white text-xl"></i>
                </div>
                <div>
                  <p className="text-yellow-800 font-bold text-lg">本週累計</p>
                  <p className="text-2xl font-bold text-yellow-600">{weeklyCoins} 學習幣</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="parchment-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl border-2 border-red-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-red-700 text-lg">{error}</p>
                  {apiError && (
                    <p className="text-sm mt-1 text-red-600">
                      錯誤類型：{apiError.type === 'AUTH_ERROR' ? 'API 認證問題' : 
                                apiError.type === 'RATE_LIMIT' ? 'API 請求限制' : 
                                apiError.type === 'NETWORK_ERROR' ? '網路連線問題' : '未知錯誤'}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {apiError && (apiError.type === 'AUTH_ERROR' || apiError.type === 'NETWORK_ERROR' || apiError.type === 'UNKNOWN') && (
                    <button
                      onClick={() => setShowApiModal(true)}
                      className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      重新設定 API
                    </button>
                  )}
                  <button
                    onClick={handleRetry}
                    className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    重試
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tasks Section */}
          <div className="max-w-6xl mx-auto">
            <div className="wood-texture rounded-2xl p-6 mb-6">
              <h3 className="text-2xl font-bold text-white text-center drop-shadow-lg">
                📋 今日任務布告欄
              </h3>
            </div>

            {tasks.length === 0 ? (
              <div className="task-card rounded-2xl p-6 text-center">
                <div className="text-yellow-800 text-lg font-medium">
                  今日暫無任務，請檢查網路連線或稍後再試
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map(task => (
                  <div key={task.id} className="task-card rounded-2xl p-6">
                    <div className="text-center mb-4">
                      <div className="flex items-center justify-center mb-3">
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getTaskGradient(task.type)} flex items-center justify-center`}>
                          <i className={`${getTaskIcon(task.type)} text-white text-2xl`}></i>
                        </div>
                      </div>
                      <h4 className="text-xl font-bold text-yellow-800 mb-2">
                        {getTaskTypeText(task.type)}
                      </h4>
                      <div className="bg-yellow-600 rounded-lg p-3 mb-4">
                        <p className="text-sm text-white font-medium mb-1">學習內容</p>
                        <p className="font-bold text-lg text-white">
                          {task.content}
                        </p>
                        {task.details.sentence && (
                          <p className="text-sm text-yellow-600 mt-1">
                            造句：{task.details.sentence}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <i className="ri-coin-fill text-yellow-500 text-lg"></i>
                        </div>
                        <span className="text-yellow-800 font-medium">+{task.reward} 學習幣</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-time-line text-yellow-800"></i>
                        </div>
                        <span className="text-sm text-yellow-800">
                          {task.details.repetitions ? `${task.details.repetitions} 次` : '15 分鐘'}
                        </span>
                      </div>
                    </div>
                    
                    {task.status === 'completed' ? (
                      <button className="w-full bg-green-600 text-white font-bold py-3 rounded-lg cursor-default">
                        ✅ 已完成
                      </button>
                    ) : task.status === 'in_progress' ? (
                      <button
                        onClick={() => handleTaskInteraction(task.id)}
                        className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-colors animate-pulse"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <i className="ri-play-circle-line text-xl"></i>
                          <span>進行中...</span>
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTaskInteraction(task.id)}
                        className="w-full bg-yellow-600 text-white font-bold py-3 rounded-lg hover:cursor-pointer hover:bg-yellow-700 transition-colors"
                      >
                        接受任務
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating Navigation Button */}
        <div className="fixed bottom-6 right-6 group">
          <Link
            to="/cabin"
            className="w-16 h-16 bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-full shadow-lg flex items-center justify-center"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-home-4-fill text-white text-2xl"></i>
            </div>
          </Link>
          <div className="absolute bottom-20 right-0 bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            冒險者小屋
          </div>
        </div>

        {/* API Config Modal */}
        <ApiConfigModal
          isOpen={showApiModal}
          onClose={() => setShowApiModal(false)}
          onSave={handleApiConfigSave}
          currentModel={userProfile?.aiModel || 'gemini'}
          error={apiError?.message || ''}
        />
      </div>
    </>
  );
};

export default AdventurerGuild;
