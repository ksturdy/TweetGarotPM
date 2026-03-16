import type { ComponentCategory, ComponentType } from './takeoff';

export interface AiAnalysisRequest {
  documentId: string;
  pageNumber: number;
  imageBase64: string;
  imageWidth: number;
  imageHeight: number;
  categories: ComponentCategory[];
  scaleInfo?: string;
}

export interface AiDetectedComponent {
  category: ComponentCategory;
  componentType: ComponentType;
  label: string;
  description: string;
  quantity: number;
  unit: string;
  size?: string;
  capacity?: string;
  material?: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reasoning: string;
}

export interface AiAnalysisResponse {
  pageNumber: number;
  components: AiDetectedComponent[];
  drawingType: string;
  drawingScale?: string;
  notes: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type AiAnalysisStatus =
  | 'idle'
  | 'rendering'
  | 'analyzing'
  | 'parsing'
  | 'complete'
  | 'error';
