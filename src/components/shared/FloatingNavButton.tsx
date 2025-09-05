import React from 'react';
import { Link } from 'react-router-dom';

interface FloatingNavButtonProps {
  to: string;
  icon: string;
  label: string;
  className?: string;
}

export const FloatingNavButton: React.FC<FloatingNavButtonProps> = ({
  to,
  icon,
  label,
  className = ''
}) => {
  return (
    <div className={`fixed bottom-6 right-6 group ${className}`}>
      <Link
        to={to}
        className="w-16 h-16 bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-full shadow-lg flex items-center justify-center"
      >
        <div className="w-8 h-8 flex items-center justify-center">
          <i className={`${icon} text-white text-2xl`}></i>
        </div>
      </Link>
      <div className="absolute bottom-20 right-0 bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {label}
      </div>
    </div>
  );
};
