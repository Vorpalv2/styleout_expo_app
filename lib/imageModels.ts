export const IMAGE_GENERATION_MODELS = [
  {
    id: 'spacexai/grok-imagine-image',
    name: 'Grok Imagine Image',
    detail: 'Fast edits · up to 2 wardrobe pieces',
    maxReferenceImages: 3,
  },
  {
    id: 'spacexai/grok-imagine-image-2.0',
    name: 'Grok Imagine Image 2.0',
    detail: 'Detailed edits · up to 4 wardrobe pieces',
    maxReferenceImages: 5,
  },
  {
    id: 'bfl/flux-kontext-pro',
    name: 'FLUX.1 Kontext Pro',
    detail: 'Prompt-based edits · up to 3 wardrobe pieces',
    maxReferenceImages: 4,
  },
  {
    id: 'openai/gpt-image-2.5-flare',
    name: 'GPT Image 2.5 Flare',
    detail: 'Faster edits · up to 3 wardrobe pieces',
    maxReferenceImages: 4,
  },
  {
    id: 'openai/gpt-image-2.5-sunburst',
    name: 'GPT Image 2.5 Sunburst',
    detail: 'Precise edits · up to 3 wardrobe pieces',
    maxReferenceImages: 4,
  },
] as const;

export type ImageGenerationModel = (typeof IMAGE_GENERATION_MODELS)[number]['id'];
export const DEFAULT_IMAGE_GENERATION_MODEL: ImageGenerationModel = IMAGE_GENERATION_MODELS[0].id;

export function maxWardrobeItemsForModel(modelId: ImageGenerationModel): number {
  return IMAGE_GENERATION_MODELS.find((model) => model.id === modelId)!.maxReferenceImages - 1;
}

export function isImageGenerationModel(value: string | null | undefined): value is ImageGenerationModel {
  return IMAGE_GENERATION_MODELS.some((model) => model.id === value);
}
