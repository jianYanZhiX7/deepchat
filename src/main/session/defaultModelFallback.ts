export const DEFAULT_MODEL_FALLBACK: { providerId: string; modelId: string } = {
  providerId: 'aigotoken',
  modelId: ''
}

export const DEFAULT_MODEL_MISSING_ERROR =
  'No default model is available. Sign in to Aigotoken or set a default model in settings first.'

export function setDefaultModelFallback(modelId: string): void {
  DEFAULT_MODEL_FALLBACK.modelId = modelId.trim()
}

export function resetDefaultModelFallback(): void {
  DEFAULT_MODEL_FALLBACK.modelId = ''
}
