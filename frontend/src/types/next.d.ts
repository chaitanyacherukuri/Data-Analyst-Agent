// Type declarations for Next.js modules
declare module 'next' {
  export interface Metadata {
    title?: string;
    description?: string;
    [key: string]: any;
  }
}

declare module 'next/font/google' {
  interface FontOptions {
    subsets?: string[];
    weight?: string | string[];
    display?: string;
    [key: string]: any;
  }
  
  export function Inter(options: FontOptions): {
    className: string;
    style: any;
  };
} 