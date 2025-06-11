// src/types/global.d.ts
declare global {
  interface Window {
    Chart: {
      new (ctx: HTMLCanvasElement | CanvasRenderingContext2D, config: any): any;
    };
  }
}

export {};
