export type StandardGenerateInput = Readonly<{
  prompt: string;
  imageUrl: string;
  ratio: "auto" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  signal?: AbortSignal;
}>;

export type StandardGenerateOutput = Readonly<
  | {
      ok: true;
      assetId: string;
      upstreamJobId?: string;
      costAmount?: number;
    }
  | {
      ok: false;
      errorMessage: string;
      upstreamJobId?: string;
      costAmount?: number;
    }
>;

export interface SourceAdapter {
  readonly sourceId: string;
  isConfigured(): boolean;
  generate(input: StandardGenerateInput): Promise<StandardGenerateOutput>;
}
