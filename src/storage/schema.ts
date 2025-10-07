export interface HighScoreEntry {
  score: number;
  lines: number;
  level: number;
  recordedAt: string;
}

export interface StoredHighScoresPayload {
  entries: HighScoreEntry[];
}
