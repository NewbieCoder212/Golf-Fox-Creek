import { create } from 'zustand';

import type { AdPlacementInsert } from '@/lib/ad-placement-service';

interface AdDraftPreviewState {
  draft: AdPlacementInsert | null;
  setDraft: (draft: AdPlacementInsert) => void;
  clearDraft: () => void;
}

export const useAdDraftPreviewStore = create<AdDraftPreviewState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));
