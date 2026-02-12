declare module '@/wasm/jieba_rs_wasm.js' {
  export default function init(input?: any): Promise<any>;
  export function cut(text: string, hmm?: boolean): string[];
}
