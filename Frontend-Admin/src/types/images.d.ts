// turbopack structured image object
// ref: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack#images
declare module '*.svg' {
  const content: { src: string; width: number; height: number; blurWidth: number; blurHeight: number };
  export default content;
}

declare module '*.png' {
  const content: { src: string; width: number; height: number; blurWidth: number; blurHeight: number };
  export default content;
}

declare module '*.jpg' {
  const content: { src: string; width: number; height: number; blurWidth: number; blurHeight: number };
  export default content;
}

declare module '*.webp' {
  const content: { src: string; width: number; height: number; blurWidth: number; blurHeight: number };
  export default content;
}
