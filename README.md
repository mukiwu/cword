# 🏝️ Word Adventure Island

*[繁體中文](README.zh-TW.md) | English*

A gamified Chinese learning platform designed for elementary school students, featuring AI-powered dynamic task generation to make learning Chinese fun and engaging through adventure-themed experiences.

## ✨ Features

- 🎮 **Gamified Learning Experience**: Immersive adventure island-themed learning environment
- 🤖 **AI-Powered Dynamic Tasks**: Support for Gemini, OpenAI, and Claude AI models
- 💰 **Virtual Reward System**: Learning coin mechanism to encourage continuous learning
- 📊 **Progress Tracking**: Detailed learning progress and achievement statistics
- 🏆 **Weekly Treasure Settlement**: Weekly reward certificate system
- 📱 **Responsive Design**: Support for mobile, tablet, and desktop devices

## 🚀 Quick Start

### Requirements

- Node.js 20.x or higher
- Modern browser (with IndexedDB support)
- AI API key (choose from Gemini/OpenAI/Claude)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd cword
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm run dev
```

4. Open your browser and visit `http://localhost:5173`

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn/ui
- **Local Database**: IndexedDB (via Dexie.js)
- **Routing**: React Router DOM
- **Testing**: Vitest + React Testing Library
- **Deployment**: GitHub Pages

## 📦 Project Structure

```
src/
├── components/          # React components
│   ├── features/       # Feature-specific components
│   ├── shared/         # Shared components
│   └── ui/            # Base UI components
├── hooks/              # Custom hooks
├── pages/              # Page components
│   ├── ProfileSetup.tsx
│   ├── AdventurerGuild.tsx
│   └── AdventurerCabin.tsx
├── services/           # Business logic services
│   ├── database.ts
│   ├── userProfile.service.ts
│   ├── ai.service.ts
│   ├── taskGeneration.service.ts
│   └── weeklyLedger.service.ts
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 🎯 Usage Guide

### Initial Setup
1. Enter name and age
2. Choose adventurer avatar
3. Select AI model (Gemini/OpenAI/Claude)
4. Enter corresponding API key

### Daily Usage
1. **Adventurer Guild**: View and complete daily learning tasks
2. **Adventurer Cabin**: Check learning progress and rewards
3. **Weekly Treasure Settlement**: Claim reward certificates every Sunday after 8 PM

### Reward System
- **Character Tasks**: 5-10 learning coins (based on stroke count and repetitions)
- **Word Application**: Fixed 7 learning coins
- **Word Writing**: 6 learning coins + repetition bonus

## 🔧 Development Commands

```bash
# Development mode
npm run dev

# Build project
npm run build

# Run tests
npm run test

# Code linting
npm run lint

# Preview build results
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## 🔒 Privacy & Security

- API keys are only stored in browser Session Storage
- All learning data is stored locally in IndexedDB
- No account registration required, fully local operation
- No personal data is uploaded to servers

## 📄 License

This project is licensed under the MIT License.
