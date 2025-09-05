# 🏝️ 生字冒險島 (Word Adventure Island)

一個專為國小學童設計的中文學習遊戲化平台，透過 AI 動態生成個人化學習任務，讓孩子在冒險中快樂學習中文。

## ✨ 特色功能

- 🎮 **遊戲化學習體驗**：以冒險島為主題的沈浸式學習環境
- 🤖 **AI 動態任務生成**：支援 Gemini、OpenAI、Claude 三種 AI 模型
- 💰 **虛擬獎勵系統**：學習幣機制激勵持續學習
- 📊 **進度追蹤**：詳細的學習進度與成果統計
- 🏆 **週日寶藏結算**：每週獎勵證書系統
- 📱 **響應式設計**：支援手機、平板、桌面裝置

## 🚀 快速開始

### 環境要求

- Node.js 20.x 或更高版本
- 現代瀏覽器（支援 IndexedDB）
- AI API 金鑰（Gemini/OpenAI/Claude 三選一）

### 安裝步驟

1. 複製專案
```bash
git clone <repository-url>
cd cword
```

2. 安裝依賴
```bash
npm install
```

3. 啟動開發服務器
```bash
npm run dev
```

4. 開啟瀏覽器訪問 `http://localhost:5173`

## 🛠️ 技術架構

- **前端框架**：React 18 + TypeScript
- **建置工具**：Vite
- **樣式方案**：Tailwind CSS + Shadcn/ui
- **本地資料庫**：IndexedDB (透過 Dexie.js)
- **路由管理**：React Router DOM
- **測試框架**：Vitest + React Testing Library
- **部署平台**：GitHub Pages

## 📦 專案結構

```
src/
├── components/          # React 元件
│   ├── features/       # 功能特定元件
│   ├── shared/         # 共享元件
│   └── ui/            # UI 基礎元件
├── hooks/              # 自定義 Hooks
├── pages/              # 頁面元件
│   ├── ProfileSetup.tsx
│   ├── AdventurerGuild.tsx
│   └── AdventurerCabin.tsx
├── services/           # 業務邏輯服務
│   ├── database.ts
│   ├── userProfile.service.ts
│   ├── ai.service.ts
│   ├── taskGeneration.service.ts
│   └── weeklyLedger.service.ts
├── types/              # TypeScript 型別定義
└── utils/              # 工具函數
```

## 🎯 使用說明

### 首次設定
1. 輸入姓名、年齡
2. 選擇冒險者頭像
3. 選擇 AI 模型（Gemini/OpenAI/Claude）
4. 輸入對應的 API 金鑰

### 日常使用
1. **冒險者公會**：查看並完成每日學習任務
2. **冒險者小屋**：檢視學習進度與獎勵
3. **週日寶藏結算**：每週日晚上8點後可提領獎勵證書

### 獎勵機制
- **單字任務**：5-10 學習幣（依筆劃數與練習次數）
- **單詞應用**：固定 7 學習幣
- **單詞書寫**：6 學習幣 + 次數加成

## 🔧 開發指令

```bash
# 開發模式
npm run dev

# 建置專案
npm run build

# 運行測試
npm run test

# 程式碼檢查
npm run lint

# 預覽建置結果
npm run preview

# 部署到 GitHub Pages
npm run deploy
```

## 🔒 隱私與安全

- API 金鑰僅儲存在瀏覽器 Session Storage 中
- 所有學習資料僅存於本地 IndexedDB
- 無需註冊帳號，完全本地化運作
- 不會上傳任何個人資料到伺服器

## 📄 授權

本專案採用 MIT 授權條款。