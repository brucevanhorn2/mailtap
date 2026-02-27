import { create } from 'zustand'
import type { AiSettings, AiModelInfo, Subscription } from '@shared/types'

interface AiState {
  enabled: boolean
  settings: AiSettings | null
  models: AiModelInfo[]
  subscriptions: Subscription[]
  modelDownloadProgress: Record<string, number>

  // Setters
  setEnabled: (enabled: boolean) => void
  setSettings: (settings: AiSettings | null) => void
  setModels: (models: AiModelInfo[]) => void
  setSubscriptions: (subs: Subscription[]) => void
  setModelDownloadProgress: (modelId: string, percent: number) => void
}

export const useAiStore = create<AiState>((set) => ({
  enabled: false,
  settings: null,
  models: [],
  subscriptions: [],
  modelDownloadProgress: {},

  setEnabled: (enabled) => set({ enabled }),
  setSettings: (settings) => set({ settings }),
  setModels: (models) => set({ models }),
  setSubscriptions: (subs) => set({ subscriptions: subs }),
  setModelDownloadProgress: (modelId, percent) =>
    set((state) => ({
      modelDownloadProgress: {
        ...state.modelDownloadProgress,
        [modelId]: percent
      }
    }))
}))
