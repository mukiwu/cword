import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { IDailyTask, IUserProfile, AIModel } from '../types';
import { AIServiceError } from '../types';
import { TaskGenerationService } from '../services/taskGeneration.service';
import { UserProfileService } from '../services/userProfile.service';
import { WeeklyLedgerService } from '../services/weeklyLedger.service';
import ApiConfigModal from '../components/ApiConfigModal';

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

  const handleTaskComplete = async (taskId: string) => {
    try {
      await TaskGenerationService.completeTask(taskId);
      await loadData(); // Refresh data
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError('完成任務失敗，請重試');
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
      case 'character': return '📝';
      case 'word': return '📚';
      case 'phrase': return '💭';
      default: return '📖';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500 flex items-center justify-center">
        <div className="text-white text-xl">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-400 to-blue-500 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏛️ 冒險者公會</h1>
          <p className="text-green-100">歡迎回來，{userProfile?.name || '冒險者'}！</p>
        </div>

        {/* Coins Dashboard */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-300">🪙 {todayCoins}</div>
              <div className="text-green-100">今日學習幣</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-300">🏆 {weeklyCoins}</div>
              <div className="text-green-100">本週學習幣</div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-white p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{error}</p>
                {apiError && (
                  <p className="text-sm mt-1 opacity-75">
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
                    className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                  >
                    重新設定 API
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  重試
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-4 mb-6">
          <h2 className="text-2xl font-bold text-white">📋 今日任務</h2>
          
          {tasks.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-center text-white">
              今日暫無任務，請檢查網路連線或稍後再試
            </div>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className={`bg-white/10 backdrop-blur-md rounded-lg p-4 border-l-4 ${
                  task.status === 'completed' 
                    ? 'border-green-400 bg-green-500/20' 
                    : 'border-yellow-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getTaskIcon(task.type)}</span>
                      <div>
                        <h3 className="font-bold text-white">{getTaskTypeText(task.type)}</h3>
                        <p className="text-green-100 text-sm">學習內容：{task.content}</p>
                      </div>
                    </div>
                    
                    <div className="text-green-100 text-sm">
                      {task.details.strokes && `筆劃：${task.details.strokes} `}
                      {task.details.repetitions && `練習：${task.details.repetitions} 次 `}
                      {task.details.sentence && `造句：${task.details.sentence}`}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-yellow-300 font-bold mb-2">
                      +{task.reward} 🪙
                    </div>
                    
                    {task.status === 'completed' ? (
                      <div className="text-green-300 font-bold">✅ 已完成</div>
                    ) : (
                      <button
                        onClick={() => handleTaskComplete(task.id)}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-medium"
                      >
                        開始任務
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Navigation */}
        <div className="text-center">
          <Link
            to="/cabin"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
          >
            🏠 前往冒險者小屋
          </Link>
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
  );
};

export default AdventurerGuild;