import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProfileSetup from './pages/ProfileSetup';
import AdventurerGuild from './pages/AdventurerGuild';
import AdventurerCabin from './pages/AdventurerCabin';
import { UserProfileService } from './services/userProfile.service';

// Google Analytics 路由追蹤組件
const GATracker = () => {
  const location = useLocation();

  useEffect(() => {
    // 當路由變更時，發送頁面瀏覽事件到 GA
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'G-CDK16K8JLT', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  return null;
};

function App() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    checkProfileExists();
  }, []);

  const checkProfileExists = async () => {
    try {
      const exists = await UserProfileService.hasExistingProfile();
      setHasProfile(exists);
    } catch (error) {
      console.error('Failed to check profile:', error);
      setHasProfile(false);
    }
  };

  if (hasProfile === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">載入中...</div>
      </div>
    );
  }

  // 根據環境設定 basename
  const basename = import.meta.env.DEV ? '/' : '/cword';

  return (
    <Router basename={basename}>
      <GATracker />
      <Routes>
        <Route 
          path="/" 
          element={hasProfile ? <Navigate to="/guild" replace /> : <Navigate to="/setup" replace />} 
        />
        <Route path="/setup" element={<ProfileSetup />} />
        <Route path="/guild" element={<AdventurerGuild />} />
        <Route path="/cabin" element={<AdventurerCabin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
