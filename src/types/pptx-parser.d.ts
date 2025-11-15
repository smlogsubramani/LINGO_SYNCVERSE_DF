declare module 'pptx-parser' {
  function parsePptx(file: File): Promise<any>;
  export = parsePptx;
}
 