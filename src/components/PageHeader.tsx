import React from 'react';
import type { IUserProfile } from '../types';

// 導入職業頭像圖片
import warriorSvg from '@/assets/avatars/warrior.svg';
import mageSvg from '@/assets/avatars/mage.svg';
import archerSvg from '@/assets/avatars/archer.svg';
import healerSvg from '@/assets/avatars/healer.svg';
import explorerSvg from '@/assets/avatars/explorer.svg';
import scholarSvg from '@/assets/avatars/scholar.svg';

interface PageHeaderProps {
  title: string;
  icon: string;
  userProfile: IUserProfile | null;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  icon,
  userProfile
}) => {
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

  const getAvatarDisplay = (avatarId: string, size: 'small' | 'large' = 'large') => {
    const sizeClasses = size === 'small' 
      ? 'w-10 h-10 p-1' 
      : 'w-12 h-12 p-1';
    const iconSize = size === 'small' ? 'text-lg' : 'text-xl';
    
    if (avatarId) {
      return (
        <div className={`${sizeClasses} bg-gray-100 rounded-lg flex items-center justify-center border-2 border-yellow-600`}>
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
      <div className={`${sizeClasses} bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-300`}>
        <i className={`ri-user-fill text-gray-400 ${iconSize}`}></i>
      </div>
    );
  };

  return (
    <header className="p-4 md:p-6">
      {/* Mobile Layout */}
      <div className="block md:hidden">
        {/* Top Row: Title */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 guild-badge rounded-full flex items-center justify-center mr-3">
            <span>{icon}</span>
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">
            {title}
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
            {getAvatarDisplay(userProfile?.avatarId || '', 'small')}
          </div>
          
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/mukiwu/cword"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-gray-800 hover:bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-700 transition-colors"
              title="查看 GitHub 原始碼"
            >
              <i className="ri-github-fill text-white text-lg"></i>
            </a>
          </div>
        </div>
      </div>

      {/* Tablet and Desktop Layout */}
      <div className="hidden md:flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 guild-badge rounded-full flex items-center justify-center">
            <span>{icon}</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">
            {title}
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
          {getAvatarDisplay(userProfile?.avatarId || '', 'large')}
          <a
            href="https://github.com/mukiwu/cword"
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-12 bg-gray-800 hover:bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-700 transition-colors"
            title="查看 GitHub 原始碼"
          >
            <i className="ri-github-fill text-white text-xl"></i>
          </a>
        </div>
      </div>
    </header>
  );
};
