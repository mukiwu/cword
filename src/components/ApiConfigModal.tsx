import React, { useState } from 'react';
import type { AIModel } from '../types';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, model: AIModel) => void;
  currentModel?: AIModel;
  error?: string;
}

const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentModel = 'gemini',
  error = ''
}) => {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModel>(currentModel);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    try {
      await onSave(apiKey, selectedModel);
      setApiKey('');
      onClose();
    } catch (err) {
      console.error('Failed to save API config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getApiKeyHint = (model: AIModel) => {
    switch (model) {
      case 'gemini':
        return '請輸入你的 Google Gemini API Key (AIzaSy...)';
      case 'openai':
        return '請輸入你的 OpenAI API Key (sk-...)';
      case 'claude':
        return '請輸入你的 Anthropic Claude API Key (sk-ant-...)';
      default:
        return '請輸入你的 API Key';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">🔑 重新設定 AI 配置</h2>
          <p className="text-gray-600">請選擇 AI 模型並輸入對應的 API Key</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            <strong>錯誤：</strong>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI 助手選擇
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as AIModel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI GPT</option>
              <option value="claude">Anthropic Claude</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 金鑰
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={getApiKeyHint(selectedModel)}
            />
            <p className="text-xs text-gray-500 mt-1">
              金鑰將安全地儲存在你的瀏覽器中，不會上傳到伺服器
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 font-medium"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-medium"
            >
              {isLoading ? '設定中...' : '確認設定'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiConfigModal;