import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { IUserProfile, IWeeklyLedger, ICoinExchange } from '../types';
import { UserProfileService } from '../services/userProfile.service';
import { WeeklyLedgerService } from '../services/weeklyLedger.service';
import { TaskGenerationService } from '../services/taskGeneration.service';
import { DatabaseService } from '../services/database';

// 導入職業頭像圖片
import warriorSvg from '@/assets/avatars/warrior.svg';
import mageSvg from '@/assets/avatars/mage.svg';
import archerSvg from '@/assets/avatars/archer.svg';
import healerSvg from '@/assets/avatars/healer.svg';
import explorerSvg from '@/assets/avatars/explorer.svg';
import scholarSvg from '@/assets/avatars/scholar.svg';

// 頭像映射函數
const getAvatarSrc = (avatarId: string): string => {
  const avatarMap: Record<string, string> = {
    warrior: warriorSvg,
    mage: mageSvg,
    archer: archerSvg,
    healer: healerSvg,
    explorer: explorerSvg,
    scholar: scholarSvg,
  };
  return avatarMap[avatarId] || warriorSvg; // 默認使用戰士圖片
};

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
  const [exchanges, setExchanges] = useState<ICoinExchange[]>([]);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeAmount, setExchangeAmount] = useState(0);
  const [exchangeResult, setExchangeResult] = useState<any>(null);

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
      
      // Get exchange history
      const exchangeHistory = WeeklyLedgerService.getExchangeHistory();
      setExchanges(exchangeHistory.slice(0, 10)); // Show last 10 exchanges

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

  const handleExchangeRequest = async () => {
    try {
      if (exchangeAmount < 10) {
        setExchangeResult({ success: false, message: '兌換金額不足，至少需要10個學習幣' });
        return;
      }

      // 找到最近已結算的週帳本
      const paidOutWeeks = weeklyHistory.filter(w => w.status === 'paid_out');
      if (paidOutWeeks.length === 0) {
        setExchangeResult({ success: false, message: '沒有可兌換的學習幣' });
        return;
      }

      // 選擇最近的已結算週帳本
      const latestPaidWeek = paidOutWeeks[0];
      
      // 檢查是否還有可兌換的學習幣
      const canExchange = await WeeklyLedgerService.canRequestExchange(latestPaidWeek.id);
      if (!canExchange) {
        setExchangeResult({ success: false, message: '沒有足夠的學習幣可兌換' });
        return;
      }

      const exchange = await WeeklyLedgerService.requestCoinExchange(latestPaidWeek.id, exchangeAmount);
      setExchangeResult({ 
        success: true, 
        exchange,
        message: `成功申請兌換 ${exchangeAmount} 個學習幣 = NT$ ${Math.floor(exchangeAmount / 10)}` 
      });
      setShowExchangeModal(false);
      setExchangeAmount(0);
      await loadData(); // Reload to show new exchange
    } catch (err: any) {
      setExchangeResult({ success: false, message: err.message });
    }
  };

  const handleLogout = async () => {
    if (confirm('確定要登出嗎？這將會清除所有學習紀錄和設定。')) {
      try {
        await DatabaseService.clearAllData();
        window.location.href = '/';
      } catch (err) {
        console.error('Logout failed:', err);
        alert('登出失敗，請重試');
      }
    }
  };

  const getAvailableCoinsForExchange = () => {
    const paidOutWeeks = weeklyHistory.filter(w => w.status === 'paid_out');
    if (paidOutWeeks.length === 0) return 0;
    
    const latestWeek = paidOutWeeks[0];
    
    // 計算已兌換的學習幣總數 (不包括被拒絕的)
    const alreadyExchanged = exchanges
      .filter(ex => ex.weekId === latestWeek.id && ex.status !== 'rejected')
      .reduce((total, ex) => total + ex.coinsExchanged, 0);
    
    return Math.max(0, latestWeek.totalEarned - alreadyExchanged);
  };

  const isCurrentWeekSettleable = () => {
    const now = new Date();
    return now.getDay() === 0 && now.getHours() >= 20; // 週日晚上8點後
  };

  const getAvatarDisplay = (avatarId: string) => {
    if (avatarId) {
      return (
        <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex items-center justify-center border-2 border-yellow-600">
          <img 
            src={getAvatarSrc(avatarId)} 
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
            {history.map((week) => {
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
               backgroundImage: `url('${import.meta.env.BASE_URL}bg.jpg')`,
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
             backgroundImage: `url('${import.meta.env.BASE_URL}bg.jpg')`,
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        {/* Header */}
        <header className="p-4 md:p-6">
          {/* Mobile Layout */}
          <div className="block md:hidden">
            {/* Top Row: Title */}
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 guild-badge rounded-full flex items-center justify-center mr-3">
                <span className="font-['Pacifico'] text-yellow-800 text-lg font-bold">🏠</span>
              </div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                冒險者小屋
              </h1>
            </div>
            
            {/* Bottom Row: User Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black bg-opacity-50 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-cake-2-line text-white text-lg"></i>
                  </div>
                  <span className="text-white font-medium ml-1">
                    <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                      {userProfile?.age || '?'}
                    </span>
                  </span>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-lg p-1 flex items-center justify-center border-2 border-yellow-600">
                  {userProfile?.avatarId ? (
                    <img 
                      src={getAvatarSrc(userProfile.avatarId)} 
                      alt={`Avatar ${userProfile.avatarId}`}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-user-fill text-gray-400 text-lg"></i>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/mukiwu/cword"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-800 hover:bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-700 transition-colors"
                  title="GitHub - MukiWu"
                >
                  <i className="ri-github-fill text-white text-lg"></i>
                </a>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center border-2 border-red-700 transition-colors"
                  title="登出"
                >
                  <i className="ri-logout-box-line text-white text-lg"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Tablet and Desktop Layout */}
          <div className="hidden md:flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 guild-badge rounded-full flex items-center justify-center">
                <span className="font-['Pacifico'] text-yellow-800 text-xl font-bold">🏠</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">
                冒險者小屋
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-black bg-opacity-50 rounded-xl px-4 py-2">
                <div className="w-8 h-8 flex items-center justify-center">
                  <i className="ri-cake-2-line text-white text-xl"></i>
                </div>
                <span className="text-white font-medium">
                  <span className="mr-1 text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    {userProfile?.age || '?'}
                  </span>
                </span>
              </div>
              {getAvatarDisplay(userProfile?.avatarId || '')}
              <a
                href="https://github.com/mukiwu/cword"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-gray-800 hover:bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-700 transition-colors"
                title="GitHub - MukiWu"
              >
                <i className="ri-github-fill text-white text-xl"></i>
              </a>
              <button
                onClick={handleLogout}
                className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center border-2 border-red-700 transition-colors"
                title="登出"
              >
                <i className="ri-logout-box-line text-white text-xl"></i>
              </button>
            </div>
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
                  <p><span className="font-semibold">年級：</span>國小{UserProfileService.getDisplayGrade(userProfile?.age || 8)}年級</p>
                  <p><span className="font-semibold">AI 助手：</span>{userProfile?.aiModel?.toUpperCase()}</p>
                  <p><span className="font-semibold">加入時間：</span>{formatDate(userProfile?.createdAt || new Date())}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Stats */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
              <div className="text-xs text-yellow-600 mt-1">
                {isCurrentWeekSettleable() ? '可結算' : '進行中'}
              </div>
            </div>
            
            <div className="parchment-bg rounded-2xl p-6 text-center">
              <div className="w-12 h-12 coin-glow bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-exchange-dollar-line text-white text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-1">{getAvailableCoinsForExchange()}</div>
              <div className="text-yellow-800 font-medium">可兌換學習幣</div>
              <div className="text-xs text-yellow-600 mt-1">已結算週數</div>
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

          {/* Coin Exchange Section */}
          <div className="scroll-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl opacity-90">
            <h3 className="text-xl font-bold text-yellow-800 mb-6">💰 學習幣兌換</h3>
            
            {/* 兌換說明區塊 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <i className="ri-information-line text-white text-sm"></i>
                </div>
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-800 mb-2">兌換說明</h4>
                  <ul className="text-blue-700 space-y-1">
                    <li>• 兌換匯率：<span className="font-semibold">10 學習幣 = NT$ 1</span></li>
                    <li>• 只能兌換已結算的學習幣（需要在週日晚上8點後執行結算）</li>
                    <li>• 本週獲得的學習幣需等到下週結算後才能兌換</li>
                    <li>• 兌換申請需要家長確認後發放</li>
                  </ul>
                  {!isCurrentWeekSettleable() && weeklyTotal > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-yellow-800 text-xs">
                        💡 你本週有 {weeklyTotal} 個學習幣，請在週日晚上8點後進行結算，下週就能兌換了！
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="parchment-bg rounded-lg p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 mb-2">
                    {getAvailableCoinsForExchange()}
                  </div>
                  <div className="text-yellow-800 font-medium mb-1">可兌換學習幣</div>
                  <div className="text-xs text-yellow-600 mb-4">
                    來自已結算的週數
                  </div>
                  {getAvailableCoinsForExchange() >= 10 ? (
                    <button
                      onClick={() => setShowExchangeModal(true)}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      申請兌換
                    </button>
                  ) : (
                    <div className="text-center">
                      <button
                        disabled
                        className="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed mb-2"
                      >
                        申請兌換
                      </button>
                      <p className="text-xs text-yellow-600">
                        {getAvailableCoinsForExchange() === 0 
                          ? '沒有可兌換的學習幣' 
                          : `需要至少10個學習幣（目前：${getAvailableCoinsForExchange()}）`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="parchment-bg rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-3">最近兌換記錄</h4>
                {exchanges.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {exchanges.slice(0, 3).map((exchange) => (
                      <div key={exchange.id} className="flex justify-between items-center text-sm">
                        <span className="text-yellow-700">
                          {exchange.coinsExchanged} 幣 → NT$ {exchange.ntdAmount}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${{
                          'pending': 'bg-yellow-100 text-yellow-800',
                          'approved': 'bg-blue-100 text-blue-800',
                          'paid': 'bg-green-100 text-green-800',
                          'rejected': 'bg-red-100 text-red-800'
                        }[exchange.status]}`}>
                          {exchange.status === 'pending' ? '申請中' : 
                           exchange.status === 'approved' ? '已核准' :
                           exchange.status === 'paid' ? '已發放' : '已拒絕'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <i className="ri-exchange-line text-gray-400 text-2xl mb-2"></i>
                    <p className="text-yellow-600 text-sm">尚無兌換記錄</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="scroll-bg rounded-2xl p-6 mb-8 mx-auto max-w-4xl opacity-90">
            <h3 className="text-xl font-bold text-yellow-800 mb-6">📊 週進度紀錄</h3>
            <WeeklyChart history={weeklyHistory} />
          </div>

          {/* Exchange Modal */}
          {showExchangeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="parchment-bg rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-yellow-800 mb-4">💰 申請學習幣兌換</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-yellow-700 font-medium mb-2">
                      兌換金額 (學習幣)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max={getAvailableCoinsForExchange()}
                      step="10"
                      value={exchangeAmount}
                      onChange={(e) => setExchangeAmount(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="請輸入兌換金額"
                    />
                  </div>
                  <div className="text-sm text-yellow-600">
                    <p>可兌換： {getAvailableCoinsForExchange()} 個學習幣</p>
                    <p>預計獲得： NT$ {Math.floor(exchangeAmount / 10)}</p>
                    <p className="mt-2 text-xs">※ 兌換申請需要家長確認後才會發放</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowExchangeModal(false)}
                      className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleExchangeRequest}
                      disabled={exchangeAmount < 10}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      確認兌換
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Exchange Result Modal */}
          {exchangeResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="parchment-bg rounded-2xl p-6 max-w-md w-full">
                {exchangeResult.success ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-green-600 mb-4">🎉 兌換申請成功</h3>
                    <div className="scroll-bg rounded-lg p-4 mb-4">
                      <p className="text-yellow-800 text-lg font-semibold mb-2">
                        兌換申請已提交
                      </p>
                      <p className="text-yellow-700 mb-2">
                        {exchangeResult.message}
                      </p>
                      <p className="text-sm text-yellow-600">
                        請等待家長確認，通過後將發放至指定帳戶
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-red-600 mb-2">❌ 兌換失敗</h3>
                    <p className="text-yellow-700 mb-4">{exchangeResult.message}</p>
                  </div>
                )}
                <div className="text-center">
                  <button
                    onClick={() => setExchangeResult(null)}
                    className={`${exchangeResult.success ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white px-6 py-2 rounded-lg font-medium transition-colors`}
                  >
                    確認
                  </button>
                </div>
              </div>
            </div>
          )}

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
