declare module 'hanzi-writer' {
  interface HanziWriterOptions {
    width?: number;
    height?: number;
    padding?: number;
    strokeAnimationSpeed?: number;
    delayBetweenStrokes?: number;
    delayBetweenLoops?: number;
    showOutline?: boolean;
    showCharacter?: boolean;
    strokeColor?: string;
    outlineColor?: string;
    radicalColor?: string;
    strokeFadeDuration?: number;
    charDataLoader?: (char: string) => Promise<any>;
  }

  interface AnimationOptions {
    onComplete?: () => void;
  }

  interface HanziWriterInstance {
    character: {
      strokes: any[];
    };
    animateCharacter(options?: AnimationOptions): void;
    animateStroke(strokeIndex: number, options?: AnimationOptions): void;
    showCharacter(): void;
    hideCharacter(): void;
    showStroke(strokeIndex: number): void;
    cancelQuiz(): void;
  }

  const HanziWriter: {
    create(
      element: HTMLElement,
      character: string,
      options?: HanziWriterOptions
    ): HanziWriterInstance;
  };

  export default HanziWriter;
}