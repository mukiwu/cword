import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { IUserProfile, IWeeklyLedger } from '../types';
import { UserProfileService } from '../services/userProfile.service';
import { WeeklyLedgerService } from '../services/weeklyLedger.service';
import { TaskGenerationService } from '../services/taskGeneration.service';

// 添加自定義 CSS 樣式 - 與 Guild 頁面一致的中世紀風格
const styles = `
  .parchment-bg {
    background: linear-gradient(135deg, #f4f1e8 0%, #e8dcc0 100%);
    box-shadow: inset 0 0 20px rgba(139, 69, 19, 0.1);
  }

  .scroll-bg {
    background: linear-gradient(135deg, #f9f7f1 0%, #f0ecd9 100%);
    border: 3px solid #D2691E;
    position: relative;
  }

  .scroll-bg::before {
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

  .wood-texture {
    background: linear-gradient(45deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #A0522D 75%, #8B4513 100%);
  }

  .coin-glow {
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
  }

  .guild-badge {
    background: linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #FFA500 100%);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
`;

const AdventurerCabin: React.FC = () => {
  const [userProfile, setUserProfile] = useState<IUserProfile | null>(null);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [weeklyHistory, setWeeklyHistory] = useState<IWeeklyLedger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payoutResult, setPayoutResult] = useState<any>(null);
  const [showPayout, setShowPayout] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load user profile
      const profile = await UserProfileService.getUserProfile();
      setUserProfile(profile || null);

      // Get weekly total
      const total = await WeeklyLedgerService.getCurrentWeekTotal();
      setWeeklyTotal(total);

      // Get today's completed tasks
      const todayTasks = await TaskGenerationService.getTodaysTasks();
      const completed = todayTasks.filter(task => task.status === 'completed').length;
      setTodayCompleted(completed);

      // Get weekly history
      const history = await WeeklyLedgerService.getWeeklyHistory();
      setWeeklyHistory(history.slice(0, 5)); // Show last 5 weeks

      // Check if it's payout time
      const now = new Date();
      const isPayoutTime = now.getDay() === 0 && now.getHours() >= 20;
      setShowPayout(isPayoutTime && total > 0);

    } catch (err) {
      console.error('Failed to load cabin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayout = async () => {
    try {
      const result = await WeeklyLedgerService.performWeeklyPayout();
      setPayoutResult(result);
      
      if (result.success) {
        setWeeklyTotal(0);
        setShowPayout(false);
        await loadData();
      }
    } catch (err) {
      console.error('Payout failed:', err);
    }
  };

  const getAvatarDisplay = (avatarId: string) => {
    if (avatarId) {
      return (
        <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex items-center justify-center border-2 border-yellow-600">
          <img 
            src={`/cword/src/assets/avatars/${avatarId}.svg`} 
            alt={`Avatar ${avatarId}`}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      );
    }
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex items-center justify-center border-2 border-gray-300">
        <i className="ri-user-fill text-gray-400 text-3xl"></i>
      </div>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 週進度圖表組件
  const WeeklyChart = ({ history }: { history: IWeeklyLedger[] }) => {
    if (history.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-yellow-700 text-lg mb-2">📊 還沒有週進度紀錄</div>
          <p className="text-yellow-600 text-sm">完成任務後就會看到你的學習進度了！</p>
        </div>
      );
    }

    const maxEarned = Math.max(...history.map(w => w.totalEarned));
    const chartHeight = 120;

    return (
      <div className="space-y-4">
        {/* 圖表標題 */}
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-yellow-800">學習幣獲得趨勢</h4>
          <div className="text-sm text-yellow-600">最高: {maxEarned} 🪙</div>
        </div>

        {/* 柱狀圖 */}
        <div className="relative">
          <div className="flex items-end justify-between gap-2 p-4" style={{ height: `${chartHeight + 40}px` }}>
            {history.map((week, index) => {
              const barHeight = maxEarned > 0 ? (week.totalEarned / maxEarned) * chartHeight : 0;
              const isCompleted = week.status === 'paid_out';
              
              return (
                <div key={week.id} className="flex-1 flex flex-col items-center gap-2">
                  {/* 數值標籤 */}
                  <div className="text-xs font-medium text-yellow-700 mb-1">
                    {week.totalEarned}
                  </div>
                  
                  {/* 柱狀條 */}
                  <div 
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isCompleted 
                        ? 'bg-gradient-to-t from-green-400 to-green-500' 
                        : 'bg-gradient-to-t from-orange-400 to-orange-500'
                    }`}
                    style={{ 
                      height: `${barHeight}px`,
                      minHeight: week.totalEarned > 0 ? '8px' : '2px'
                    }}
                  />
                  
                  {/* 週標籤 */}
                  <div className="text-xs text-yellow-700 font-medium text-center">
                    {week.id.split('-W')[1]}週
                  </div>
                  
                  {/* 狀態指示 */}
                  <div className={`w-2 h-2 rounded-full ${
                    isCompleted ? 'bg-green-500' : 'bg-orange-500'
                  }`} />
                </div>
              );
            })}
          </div>

          {/* 背景格線 */}
          <div className="absolute inset-4 pointer-events-none">
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <div
                key={ratio}
                className="absolute w-full border-t border-yellow-300 opacity-30"
                style={{ bottom: `${ratio * chartHeight}px` }}
              />
            ))}
          </div>
        </div>

        {/* 圖例 */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-yellow-700">已結算</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-sm text-yellow-700">進行中</span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <>
        <style>{styles}</style>
        <div className="min-h-screen flex items-center justify-center"
             style={{
               backgroundImage: `url('/cword/bg.jpg')`,
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundAttachment: 'fixed'
             }}>
          <div className="parchment-bg rounded-3xl p-8">
            <div className="text-yellow-800 text-xl font-medium">載入中...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="min-h-screen p-4"
           style={{
             backgroundImage: `url('/cword/bg.jpg')`,
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        {/* Header */}
        <header className="flex justify-between items-center p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 guild-badge rounded-full flex items-center justify-center">
              <span className="font-['Pacifico'] text-yellow-800 text-xl font-bold">🏠</span>
            </div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              冒險者小屋
            </h1>
          </div>

          <div className="flex items-center">
            <div className="flex items-center bg-black bg-opacity-50 rounded-xl px-4 py-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-cake-2-line text-white text-xl"></i>
              </div>
              <span className="text-white font-medium">
                <span className="mr-1 text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  {userProfile?.age || '?'}
                </span>
              </span>
            </div>
            {getAvatarDisplay(userProfile?.avatarId || '')}
          </div>
        </header>

        <div className="px-6 pb-6">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
              歡迎回到你的小屋，{userProfile?.name || '冒險者'}！
            </h2>
            <p className="text-white text-lg opacity-90">
              這裡是你的專屬空間，查看學習成果吧
            </p>
          </div>

          {/* Profile Card */}
          <div className="scroll-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl opacity-90">
            <div className="flex items-center gap-6">
              {getAvatarDisplay(userProfile?.avatarId || '')}
              <div>
                <h2 className="text-2xl font-bold text-yellow-800 mb-2">{userProfile?.name}</h2>
                <div className="grid grid-cols-2 gap-4 text-yellow-700">
                  <p><span className="font-semibold">年齡：</span>{userProfile?.age} 歲</p>
                  <p><span className="font-semibold">年級：</span>國小{UserProfileService.getGradeFromAge(userProfile?.age || 8)}年級</p>
                  <p><span className="font-semibold">AI 助手：</span>{userProfile?.aiModel?.toUpperCase()}</p>
                  <p><span className="font-semibold">加入時間：</span>{formatDate(userProfile?.createdAt || new Date())}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Stats */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="parchment-bg rounded-2xl p-6 text-center">
              <div className="w-12 h-12 coin-glow bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-task-line text-white text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">{todayCompleted}</div>
              <div className="text-yellow-800 font-medium">今日完成任務</div>
            </div>
            
            <div className="parchment-bg rounded-2xl p-6 text-center">
              <div className="w-12 h-12 coin-glow bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-coin-fill text-yellow-800 text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-yellow-600 mb-1">{weeklyTotal}</div>
              <div className="text-yellow-800 font-medium">本週學習幣</div>
            </div>
            
            <div className="parchment-bg rounded-2xl p-6 text-center">
              <div className="w-12 h-12 coin-glow bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-trophy-line text-white text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {weeklyHistory.filter(w => w.status === 'paid_out').length}
              </div>
              <div className="text-yellow-800 font-medium">完成週數</div>
            </div>
          </div>

          {/* Payout Section */}
          {showPayout && (
            <div className="wood-texture rounded-2xl p-6 mb-8 mx-auto max-w-4xl">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-2">🎉 週日寶藏結算</h3>
                <p className="text-yellow-100 mb-4">
                  恭喜！你本週獲得了 {weeklyTotal} 學習幣！
                </p>
                <button
                  onClick={handlePayout}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-3 rounded-lg hover:from-yellow-500 hover:to-orange-600 font-bold text-lg transition-all duration-200"
                >
                  💰 領取獎勵證書
                </button>
              </div>
            </div>
          )}

          {/* Payout Result Modal */}
          {payoutResult && (
            <div className="parchment-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl">
              {payoutResult.success ? (
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-green-600 mb-4">🎊 獎勵證書</h3>
                  <div className="scroll-bg rounded-lg p-6 mb-4">
                    <p className="text-yellow-800 text-lg font-semibold mb-2">
                      {userProfile?.name} 本週表現優秀！
                    </p>
                    <p className="text-yellow-700 mb-2">
                      獲得學習幣：<span className="font-bold text-yellow-600">{payoutResult.totalPaid}</span> 枚
                    </p>
                    <p className="text-yellow-700 mb-4">
                      結算時間：{formatDate(payoutResult.certificateData?.generatedAt)}
                    </p>
                    <p className="text-sm text-yellow-600">
                      請向家長展示此證書以獲得對應獎勵！
                    </p>
                  </div>
                  <button
                    onClick={() => setPayoutResult(null)}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
                  >
                    確認
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-red-600 mb-2">❌ 提領失敗</h3>
                  <p className="text-yellow-700 mb-4">請在週日晚上8點後再試</p>
                  <button
                    onClick={() => setPayoutResult(null)}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium"
                  >
                    確認
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Weekly Progress Chart */}
          <div className="scroll-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl opacity-90">
            <h3 className="text-xl font-bold text-yellow-800 mb-6">📊 週進度紀錄</h3>
            <WeeklyChart history={weeklyHistory} />
          </div>

          {/* Navigation */}
          <div className="text-center">
            <Link
              to="/guild"
              className="inline-block wood-texture text-white px-8 py-4 rounded-xl hover:scale-105 transition-transform font-bold text-lg shadow-lg"
            >
              🏛️ 返回冒險者公會
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdventurerCabin;
