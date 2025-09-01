import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { IUserProfile, IWeeklyLedger } from '../types';
import { UserProfileService } from '../services/userProfile.service';
import { WeeklyLedgerService } from '../services/weeklyLedger.service';
import { TaskGenerationService } from '../services/taskGeneration.service';

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
    const avatars: { [key: string]: string } = {
      'avatar-1': '🧙‍♀️',
      'avatar-2': '🤖',
      'avatar-3': '🐱',
      'avatar-4': '🦸‍♂️',
    };
    return avatars[avatarId] || '🧙‍♀️';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-500 flex items-center justify-center">
        <div className="text-white text-xl">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🏠 冒險者小屋</h1>
          <p className="text-purple-100">你的專屬空間</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-6xl">{getAvatarDisplay(userProfile?.avatarId || 'avatar-1')}</div>
            <div>
              <h2 className="text-2xl font-bold text-white">{userProfile?.name}</h2>
              <p className="text-purple-100">年齡：{userProfile?.age} 歲</p>
              <p className="text-purple-100">
                年級：國小{UserProfileService.getGradeFromAge(userProfile?.age || 8)}年級
              </p>
              <p className="text-purple-100">AI 助手：{userProfile?.aiModel?.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-300">{todayCompleted}</div>
            <div className="text-purple-100">今日完成任務</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-300">{weeklyTotal}</div>
            <div className="text-purple-100">本週學習幣</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-300">
              {weeklyHistory.filter(w => w.status === 'paid_out').length}
            </div>
            <div className="text-purple-100">完成週數</div>
          </div>
        </div>

        {/* Payout Section */}
        {showPayout && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 mb-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">🎉 週日寶藏結算</h3>
              <p className="text-yellow-100 mb-4">
                恭喜！你本週獲得了 {weeklyTotal} 學習幣！
              </p>
              <button
                onClick={handlePayout}
                className="bg-white text-orange-600 px-6 py-3 rounded-lg hover:bg-gray-100 font-bold text-lg"
              >
                💰 領取獎勵證書
              </button>
            </div>
          </div>
        )}

        {/* Payout Result Modal */}
        {payoutResult && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            {payoutResult.success ? (
              <div className="text-center">
                <h3 className="text-2xl font-bold text-green-300 mb-4">🎊 獎勵證書</h3>
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-white text-lg">
                    {userProfile?.name} 本週表現優秀！
                  </p>
                  <p className="text-purple-100 mt-2">
                    獲得學習幣：{payoutResult.totalPaid} 枚
                  </p>
                  <p className="text-purple-100">
                    結算時間：{formatDate(payoutResult.certificateData?.generatedAt)}
                  </p>
                  <p className="text-sm text-purple-200 mt-4">
                    請向家長展示此證書以獲得對應獎勵！
                  </p>
                </div>
                <button
                  onClick={() => setPayoutResult(null)}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  確認
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-2xl font-bold text-red-300 mb-2">❌ 提領失敗</h3>
                <p className="text-purple-100">請在週日晚上8點後再試</p>
                <button
                  onClick={() => setPayoutResult(null)}
                  className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  確認
                </button>
              </div>
            )}
          </div>
        )}

        {/* Weekly History */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">📊 週進度紀錄</h3>
          
          {weeklyHistory.length === 0 ? (
            <p className="text-purple-100 text-center">還沒有完成的週數</p>
          ) : (
            <div className="space-y-3">
              {weeklyHistory.map(week => (
                <div key={week.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-white font-medium">{week.id}</div>
                    <div className="text-purple-200 text-sm">
                      {formatDate(week.startDate)} - {formatDate(new Date(week.startDate.getTime() + 6 * 24 * 60 * 60 * 1000))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-300 font-bold">{week.totalEarned} 🪙</div>
                    <div className={`text-sm ${week.status === 'paid_out' ? 'text-green-300' : 'text-orange-300'}`}>
                      {week.status === 'paid_out' ? '已結算' : '進行中'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="text-center">
          <Link
            to="/guild"
            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
          >
            🏛️ 返回冒險者公會
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdventurerCabin;