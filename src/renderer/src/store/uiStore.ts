import { create } from 'zustand'

interface UiState {
  sidebarVisible: boolean
  sidebarWidth: number
  mailListWidth: number
  showExternalImages: boolean
  viewerTab: 'home' | 'message'

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setMailListWidth: (width: number) => void
  setShowExternalImages: (show: boolean) => void
  setViewerTab: (tab: 'home' | 'message') => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarVisible: true,
  sidebarWidth: 240,
  mailListWidth: 340,
  showExternalImages: false,
  viewerTab: 'home',

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setMailListWidth: (width) => set({ mailListWidth: width }),
  setShowExternalImages: (show) => set({ showExternalImages: show }),
  setViewerTab: (tab) => set({ viewerTab: tab })
}))
