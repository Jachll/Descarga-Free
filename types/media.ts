export type DownloadMode = "video" | "mp3";

export type QualityOption = "best" | `${number}`;

export interface ContentOption {
  formatId: string;
  ext: string;
  height?: number;
  acodec?: string;
  vcodec?: string;
  filesz?: number;
}

export interface AnalyzeResult {
  title: string;
  thumbnail?: string;
  duration?: number;
  webpageUrl: string;
  source: string;
  availableResolutions: string[];
  availableModes: DownloadMode[];
  options: ContentOption[];
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface DownloadJob {
  id: string;
  status: JobStatus;
  progress: number;
  stage: string;
  message?: string;
  createdAt: number;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}
