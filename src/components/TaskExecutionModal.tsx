import React, { useState, useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';
import type { IDailyTask } from '../types';

interface TaskExecutionModalProps {
  task: IDailyTask;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// 添加自定義 CSS 樣式
const styles = `
  .grid-cell {
    width: 60px;
    height: 60px;
    border: 1px solid #D2691E;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f9f7f1 0%, #f0ecd9 100%);
    position: relative;
  }

  .grid-cell::before {
    content: '';
    position: absolute;
    width: 1px;
    height: 100%;
    background: #D2691E;
    opacity: 0.3;
    left: 50%;
    transform: translateX(-50%);
  }

  .grid-cell::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 1px;
    background: #D2691E;
    opacity: 0.3;
    top: 50%;
    transform: translateY(-50%);
  }

  .character-display {
    font-size: 48px;
    font-weight: bold;
    color: #8B4513;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
  }

  .stroke-animation {
    animation: strokeGlow 2s ease-in-out infinite;
  }

  @keyframes strokeGlow {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; transform: scale(1.05); }
  }

  .parchment-bg {
    background: linear-gradient(135deg, #f4f1e8 0%, #e8dcc0 100%);
    box-shadow: inset 0 0 20px rgba(139, 69, 19, 0.1);
  }

  .wood-texture {
    background: linear-gradient(45deg, #8B4513 0%, #A0522D 25%, #8B4513 50%, #A0522D 75%, #8B4513 100%);
  }
`;

const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({
  task,
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [writers, setWriters] = useState<any[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loadingError, setLoadingError] = useState<string>('');
  const [totalStrokes, setTotalStrokes] = useState<number[]>([1]);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const writerRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // 確保 refs 陣列有正確的長度
  useEffect(() => {
    const characters = Array.from(task.content);
    if (writerRefs.current.length !== characters.length) {
      writerRefs.current = new Array(characters.length).fill(null);
      console.log(`Initialized refs array with length ${characters.length} for characters:`, characters);
    }
  }, [task.content]);

  // 使用 Hanzi Writer 初始化單字
  useEffect(() => {
    if (isOpen && (task.type === 'character' || task.type === 'word')) {
      // 延遲初始化，確保 DOM 完全渲染
      const timer = setTimeout(() => {
        initializeHanziWriters();
      }, 200);
      
      return () => clearTimeout(timer);
    }
    
    return () => {
      // 清理 writers
      writers.forEach(writer => {
        if (writer) {
          try {
            writer.cancelQuiz();
            writer.hideCharacter();
          } catch (e) {
            console.log('Writer cleanup error:', e);
          }
        }
      });
    };
  }, [isOpen, task.content, task.type]);

  const initializeHanziWriters = async () => {
    try {
      // 獲取所有單字
      const characters = Array.from(task.content);
      console.log('Initializing writers for characters:', characters);
      
      // 重置狀態並開始載入
      setLoadingError('');
      setCurrentStep(0);
      setCurrentCharIndex(0);
      setIsLoadingCharacters(true);
      
      // 等待更長時間確保 DOM 已經渲染和 refs 已經設置
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 檢查所有容器是否已經存在
      const containerStatus = [];
      for (let i = 0; i < characters.length; i++) {
        containerStatus.push({
          index: i,
          character: characters[i],
          container: !!writerRefs.current[i]
        });
      }
      console.log('Checking containers:', containerStatus);
      
      const newWriters: any[] = new Array(characters.length).fill(null);
      const newTotalStrokes: number[] = new Array(characters.length).fill(1);
      
      // 為每個單字創建 writer
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        const container = writerRefs.current[i];
        
        if (!container) {
          console.warn(`Container for character ${char} at index ${i} not found`);
          continue;
        }
        
        // 清空容器
        container.innerHTML = '';
        
        try {
          const writer = HanziWriter.create(container, char, {
            width: 280,  // 稍微縮小以適應多個單字
            height: 280,
            padding: 15,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 300,
            delayBetweenLoops: 2000,
            showOutline: true,
            showCharacter: false,
            strokeColor: '#FF4500',
            outlineColor: '#D0D0D0',
            radicalColor: '#FF6B35',
            strokeFadeDuration: 0,
            charDataLoader: async (character: string) => {
              try {
                const response = await fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.0/${character}.json`);
                if (!response.ok) {
                  throw new Error(`Character data not found for: ${character}`);
                }
                const data = await response.json();
                
                // 設置這個單字的筆劃數並立即更新狀態
                if (data && data.strokes) {
                  newTotalStrokes[i] = data.strokes.length;
                  console.log(`Character ${character} has ${data.strokes.length} strokes`);
                } else {
                  newTotalStrokes[i] = 1;
                }
                
                // 立即更新 totalStrokes 狀態以確保 UI 顯示正確
                setTotalStrokes([...newTotalStrokes]);
                
                return data;
              } catch (error) {
                console.error(`Failed to load character data for ${character}:`, error);
                newTotalStrokes[i] = 1; // 設置默認值
                setTotalStrokes([...newTotalStrokes]);
                throw error;
              }
            }
          });
          
          newWriters[i] = writer;
          console.log(`Successfully created writer for character: ${char}`);
          
        } catch (error) {
          console.error(`Error creating writer for character ${char}:`, error);
          setLoadingError(`初始化單字「${char}」失敗`);
          newWriters[i] = null; // 設置為 null 以保持陣列索引一致
          newTotalStrokes[i] = 1; // 設置默認值
        }
      }
      
      // 等待所有單字數據加載完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 不要過濾陣列，保持索引對應關係
      setWriters(newWriters);
      setTotalStrokes(newTotalStrokes);
      
      console.log('Hanzi Writers initialized:', {
        characters: characters,
        totalWriters: newWriters.filter(w => w !== null).length,
        totalStrokes: newTotalStrokes,
        writersArray: newWriters.map((w, i) => ({ index: i, writer: !!w }))
      });
      
      // 載入完成
      setIsLoadingCharacters(false);
      
    } catch (error) {
      console.error('Error initializing Hanzi Writers:', error);
      setLoadingError(`初始化筆順動畫失敗`);
      setIsLoadingCharacters(false);
    }
  };


  const handleAnimateCharacter = (charIndex?: number) => {
    const targetIndex = charIndex ?? currentCharIndex;
    const writer = writers[targetIndex];
    
    console.log('handleAnimateCharacter called:', {
      targetIndex,
      writer: !!writer,
      isAnimating,
      writersLength: writers.length,
      currentCharIndex
    });
    
    if (writer && !isAnimating) {
      setIsAnimating(true);
      console.log('Starting character animation for index:', targetIndex);
      
      try {
        writer.animateCharacter({
          onComplete: () => {
            console.log('Character animation completed for index:', targetIndex);
            setIsAnimating(false);
          }
        });
      } catch (error) {
        console.error('Error during character animation:', error);
        setIsAnimating(false);
      }
    } else {
      console.log('Cannot animate:', {
        writerExists: !!writer,
        isAnimating,
        targetIndex
      });
    }
  };

  const handleStepNext = () => {
    if (writers.length > 0 && (task.type === 'character' || task.type === 'word')) {
      const currentWriter = writers[currentCharIndex];
      const currentCharStrokes = totalStrokes[currentCharIndex] || 1;
      const nextStep = currentStep + 1;
      
      try {
        // 檢查是否需要切換到下一個字符
        if (nextStep >= currentCharStrokes) {
          // 當前單字的所有筆順都完成了
          if (currentCharIndex < writers.length - 1) {
            // 移到下一個單字
            setCurrentCharIndex(currentCharIndex + 1);
            setCurrentStep(0);
            return;
          } else {
            // 所有單字的筆順都學習完畢，設定為完成狀態
            setCurrentStep(currentCharStrokes);
            currentWriter.showCharacter();
            console.log('所有筆順都學習完畢，請手動完成任務');
            return;
          }
        }
        
        // 播放當前筆的動畫，但保持之前的筆畫顯示
        currentWriter.animateStroke(currentStep, {
          onComplete: () => {
            // 更新到下一筆
            setCurrentStep(nextStep);
          }
        });
        
      } catch (error) {
        console.error('Error animating stroke:', error);
        // 發生錯誤時也更新步數，避免卡住
        if (nextStep < currentCharStrokes) {
          setCurrentStep(nextStep);
        }
      }
    }
  };


  const handleShowCharacter = (charIndex?: number) => {
    const targetIndex = charIndex ?? currentCharIndex;
    const writer = writers[targetIndex];
    if (writer) {
      writer.showCharacter();
    }
  };

  const handleHideCharacter = (charIndex?: number) => {
    const targetIndex = charIndex ?? currentCharIndex;
    const writer = writers[targetIndex];
    if (writer) {
      writer.hideCharacter();
    }
  };

  const handleShowAllCharacters = () => {
    writers.forEach(writer => {
      if (writer) {
        writer.showCharacter();
      }
    });
  };

  const handleHideAllCharacters = () => {
    writers.forEach(writer => {
      if (writer) {
        writer.hideCharacter();
      }
    });
  };

  const handleSelectCharacter = (charIndex: number) => {
    console.log('Selecting character at index:', charIndex);
    setCurrentCharIndex(charIndex);
    setCurrentStep(0); // 重置到第一筆
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
           style={{
             backgroundColor: 'rgba(0, 0, 0, 0.7)',
             backdropFilter: 'blur(5px)'
           }}
           onClick={onClose}>
        <div className="parchment-bg rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
             onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-yellow-800">
              📚 學習任務：{task.content}
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 cursor-pointer"
              title="關閉視窗"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Hanzi Writer Animation for Character and Word Practice */}
          {(task.type === 'character' || task.type === 'word') && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-yellow-800 mb-4 text-center">
                🖌️ 筆順動畫練習
              </h3>
              <div className="flex justify-center mb-4">
                <div className={`flex gap-6 ${task.type === 'word' ? 'flex-wrap justify-center' : ''}`}>
                  {Array.from(task.content).map((char, index) => (
                    <div key={index} className="relative">
                      {/* 單字標題 */}
                      {task.type === 'word' && (
                        <div 
                          className="text-center mb-2 cursor-pointer hover:bg-yellow-100 rounded-lg p-2 transition-colors"
                          onClick={() => handleSelectCharacter(index)}
                        >
                          <span className={`text-2xl font-bold ${
                            index === currentCharIndex ? 'text-orange-600' : 'text-yellow-700'
                          }`}>
                            {char}
                          </span>
                          <div className="text-sm text-yellow-600">
                            {index === currentCharIndex ? '(當前單字)' : '點擊選擇'}
                          </div>
                        </div>
                      )}
                      
                      {/* Hanzi Writer 容器包裝 */}
                      <div className="relative">
                        {/* Hanzi Writer 容器 */}
                        <div 
                          ref={el => {
                            console.log(`Setting ref for character ${char} at index ${index}:`, !!el);
                            writerRefs.current[index] = el;
                          }}
                          className={`relative border-2 rounded-lg ${
                            index === currentCharIndex ? 'border-orange-500' : 'border-yellow-800'
                          }`}
                          style={{ 
                            width: task.type === 'word' ? '280px' : '300px', 
                            height: task.type === 'word' ? '280px' : '300px',
                            backgroundColor: '#FAFAFA'
                          }}
                        />
                        
                        {/* 九宮格輔助線 - 放在容器外層，確保不被 Hanzi Writer 覆蓋 */}
                        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                          <svg 
                            className="w-full h-full" 
                            style={{ position: 'absolute', top: 0, left: 0 }}
                          >
                            {/* 垂直線 */}
                            <line 
                              x1="33.33%" y1="0%" 
                              x2="33.33%" y2="100%" 
                              stroke="#d1d5db" 
                              strokeWidth="1" 
                              opacity="0.5"
                            />
                            <line 
                              x1="66.67%" y1="0%" 
                              x2="66.67%" y2="100%" 
                              stroke="#d1d5db" 
                              strokeWidth="1" 
                              opacity="0.5"
                            />
                            {/* 水平線 */}
                            <line 
                              x1="0%" y1="33.33%" 
                              x2="100%" y2="33.33%" 
                              stroke="#d1d5db" 
                              strokeWidth="1" 
                              opacity="0.5"
                            />
                            <line 
                              x1="0%" y1="66.67%" 
                              x2="100%" y2="66.67%" 
                              stroke="#d1d5db" 
                              strokeWidth="1" 
                              opacity="0.5"
                            />
                          </svg>
                        </div>
                        
                        {/* Loading 動畫 */}
                        {isLoadingCharacters && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 rounded-lg">
                            <div className="text-center p-4">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mb-3"></div>
                              <div className="text-yellow-700 text-sm font-medium mb-1">載入中...</div>
                              <div className="text-yellow-600 text-xs">正在準備筆順動畫</div>
                            </div>
                          </div>
                        )}

                        {/* 錯誤顯示 */}
                        {loadingError && index === 0 && !isLoadingCharacters && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                            <div className="text-center p-4">
                              <div className="text-red-600 text-lg mb-2">⚠️</div>
                              <div className="text-red-700 text-sm font-medium mb-2">{loadingError}</div>
                              <div className="text-gray-600 text-xs">請檢查網路連線或稍後再試</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 動畫控制按鈕 */}
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                {/* 單字學習才顯示完整動畫按鈕，單詞學習移除此按鈕 */}
                {task.type === 'character' && (
                  <button
                    onClick={() => handleAnimateCharacter()}
                    disabled={isAnimating}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isAnimating ? '動畫中...' : '完整動畫'}
                  </button>
                )}
                
                {/* 單詞學習的額外控制 */}
                {task.type === 'word' && (
                  <>
                    <button
                      onClick={() => handleAnimateCharacter()}
                      disabled={isAnimating}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isAnimating ? '動畫中...' : `播放「${Array.from(task.content)[currentCharIndex]}」`}
                    </button>
                    <button
                      onClick={() => handleShowCharacter()}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm cursor-pointer"
                    >
                      顯示「{Array.from(task.content)[currentCharIndex]}」
                    </button>
                    <button
                      onClick={() => handleHideCharacter()}
                      className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm cursor-pointer"
                    >
                      隱藏「{Array.from(task.content)[currentCharIndex]}」
                    </button>
                  </>
                )}
                
                {/* 全局控制 */}
                <button
                  onClick={task.type === 'word' ? handleShowAllCharacters : () => handleShowCharacter()}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm cursor-pointer"
                >
                  顯示{task.type === 'word' ? '全部' : '字'}
                </button>
                <button
                  onClick={task.type === 'word' ? handleHideAllCharacters : () => handleHideCharacter()}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm cursor-pointer"
                >
                  隱藏{task.type === 'word' ? '全部' : '字'}
                </button>
              </div>
              
              <p className="text-center text-yellow-600 text-sm">
                {task.type === 'word' 
                  ? `正在學習「${Array.from(task.content)[currentCharIndex]}」的筆順` 
                  : '觀察筆順動畫，學習正確的書寫順序'
                }
              </p>
            </div>
          )}

          {/* Sentence Practice Guide - For phrase tasks */}
          {task.type === 'phrase' && task.details.sentence && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-yellow-800 mb-4 text-center">
                💭 造句練習
              </h3>
              <div className="bg-yellow-100 rounded-lg p-6">
                <div className="text-2xl font-bold text-yellow-700 mb-4 text-center">
                  {task.content}
                </div>
                <div className="parchment-bg rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 font-medium mb-0">
                    📝 {task.details.sentence}
                  </p>
                </div>
                <div className="text-yellow-600 text-sm space-y-1">
                  <p>💡 造句提示：</p>
                  <p>• 句子要完整，有主語和謂語</p>
                  <p>• 要能正確表達詞語的意思</p>
                  <p>• 盡量使用日常生活中的例子</p>
                </div>
              </div>
            </div>
          )}

          {/* Stroke Order Step Control - For characters and words */}
          {(task.type === 'character' || task.type === 'word') && writers.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-yellow-800 mb-4 text-center">
                📝 逐筆練習
              </h3>
              <div className="bg-yellow-100 rounded-lg p-4">
                {/* 單詞學習的單字快速切換 */}
                {task.type === 'word' && (
                  <div className="flex justify-center mb-4">
                    <div className="inline-flex bg-white rounded-lg p-1 shadow-sm">
                      {Array.from(task.content).map((char, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectCharacter(index)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                            index === currentCharIndex
                              ? 'bg-orange-500 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-4">
                  {task.type === 'word' && (
                    <div className="text-lg font-bold text-orange-600 mb-1">
                      當前單字：{Array.from(task.content)[currentCharIndex]}
                    </div>
                  )}
                  <span className="text-yellow-800 font-medium block mb-3">
                    {currentStep >= (totalStrokes[currentCharIndex] || 1) 
                      ? `筆順完成 / 共 ${totalStrokes[currentCharIndex] || 1} 筆`
                      : `第 ${currentStep} 筆 / 共 ${totalStrokes[currentCharIndex] || 1} 筆`
                    }
                  </span>
                  {task.type === 'word' && (
                    <div className="text-sm text-yellow-600 mb-3">
                      單字進度：{currentCharIndex + 1} / {Array.from(task.content).length}
                    </div>
                  )}
                  <button
                    onClick={handleStepNext}
                    disabled={isAnimating || (currentCharIndex >= Array.from(task.content).length - 1 && currentStep >= (totalStrokes[currentCharIndex] || 1))}
                    className="px-4 py-1 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
                  >
                    {currentCharIndex >= Array.from(task.content).length - 1 && currentStep >= (totalStrokes[currentCharIndex] || 1) ? '筆順完成' : '下一筆'}
                  </button>
                </div>
                
                <div className="text-center">
                  <p className="text-yellow-600 text-sm">
                    點擊「下一筆」學習每一筆的寫法
                  </p>
                  {currentCharIndex >= Array.from(task.content).length - 1 && currentStep >= (totalStrokes[currentCharIndex] || 1) && (
                    <p className="text-green-600 text-sm mt-2 font-medium">
                      🎉 筆順學習完成！要完成任務請點擊下方的「完成練習」按鈕
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Task Details */}
          <div className="mb-6 parchment-bg rounded-lg p-4">
            <h4 className="font-bold text-yellow-800 mb-2">📋 練習要求：</h4>
            <div className="text-yellow-700 space-y-1">
              {task.type === 'phrase' ? (
                <>
                  <p>• 請用「<strong>{task.content}</strong>」造一個完整的句子</p>
                  <p>• 句子要有完整的主語和謂語</p>
                  <p>• 要能正確表達詞語的意思</p>
                </>
              ) : (
                <>
                  <p>• 請練習書寫 <strong>{task.details.repetitions || 5}</strong> 次</p>
                  <p>• 注意筆順和字型結構</p>
                </>
              )}
              <p>• 完成後可獲得 <strong className="text-yellow-600">{task.reward}</strong> 學習幣</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
            >
              暫時離開
            </button>
            <button
              onClick={onComplete}
              className="flex-1 wood-texture text-white font-bold py-3 rounded-lg hover:scale-105 transition-transform cursor-pointer"
            >
              ✅ 完成練習
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskExecutionModal;
