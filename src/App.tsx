import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProfileSetup from './pages/ProfileSetup';
import AdventurerGuild from './pages/AdventurerGuild';
import AdventurerCabin from './pages/AdventurerCabin';
import { UserProfileService } from './services/userProfile.service';

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

  return (
    <Router>
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
