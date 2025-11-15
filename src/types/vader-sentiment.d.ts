// src/types/vader-sentiment.d.ts
declare module 'vader-sentiment' {
  export const SentimentIntensityAnalyzer: {
    polarity_scores(text: string): {
      compound: number;
      // other fields exist but we only need compound
    };
  };
}