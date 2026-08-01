export type StandardGenerateInput = Readonly<{
  prompt: string;
  imageUrl: string;
}>;

export type StandardGenerateOutput = Readonly<
  | {
      ok: true;
      assetId: string;
    }
  | {
      ok: false;
      errorMessage: string;
    }
>;

export interface SourceAdapter {
  readonly sourceId: string;
  isConfigured(): boolean;
  generate(input: StandardGenerateInput): Promise<StandardGenerateOutput>;
}
