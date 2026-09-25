export const IMAGE_GENERATION_MODELS = [
  {
    id: 'spacexai/grok-imagine-image',
    name: 'Grok Imagine Image',
    detail: 'Current model · quick edits',
  },
  {
    id: 'spacexai/grok-imagine-image-2.0',
    name: 'Grok Imagine Image 2.0',
    detail: 'Detailed edits · up to five references',
  },
  {
    id: 'bfl/flux-kontext-pro',
    name: 'FLUX.1 Kontext Pro',
    detail: 'Prompt-based edits · up to four references',
  },
  {
    id: 'openai/gpt-image-2.5-flare',
    name: 'GPT Image 2.5 Flare',
    detail: 'Faster reference image edits',
  },
  {
    id: 'openai/gpt-image-2.5-sunburst',
    name: 'GPT Image 2.5 Sunburst',
    detail: 'Higher precision reference image edits',
  },
] as const;

export type ImageGenerationModel = (typeof IMAGE_GENERATION_MODELS)[number]['id'];
export const DEFAULT_IMAGE_GENERATION_MODEL: ImageGenerationModel = IMAGE_GENERATION_MODELS[0].id;

export function isImageGenerationModel(value: string | null | undefined): value is ImageGenerationModel {
  return IMAGE_GENERATION_MODELS.some((model) => model.id === value);
}
