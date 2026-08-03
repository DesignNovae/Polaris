export type DocSource = "university" | "scholarship" | "case-study";

export type RagDoc = {
  id: string;
  source: DocSource;
  title: string;
  text: string;
  metadata: Record<string, unknown>;
};

export type EmbeddedDoc = RagDoc & { vector: number[] };
