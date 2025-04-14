// Type declarations for React
declare module 'react' {
  export = React;
  export as namespace React;
}

declare namespace React {
  interface ReactNode {}
  interface ForwardRefExoticComponent<P> {}
  interface RefAttributes<T> {}
  interface HTMLAttributes<T> {}
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {}
  
  function forwardRef<T, P>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
  ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>>;
  
  type Ref<T> = any;
  type PropsWithoutRef<P> = any;
  type ReactElement = any;
}

// JSX namespace
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
} 