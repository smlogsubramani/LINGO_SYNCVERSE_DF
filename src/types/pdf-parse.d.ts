// src/types/pdf-parse.d.ts
declare module 'pdf-parse' {
  /** v2+ API – class constructor */
  export class PDFParse {
    constructor(options: { url?: string; buffer?: Buffer | Uint8Array });
    getText(): Promise<{ text: string }>;
  }
}
 