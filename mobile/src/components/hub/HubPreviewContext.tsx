import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type HubPreviewScenario =
  | 'live'
  | 'roundInProgress'
  | 'continueRound'
  | 'turnPaused'
  | 'fnbPrompt'
  | 'teeTimeSoon'
  | 'checkedIn'
  | 'default';

export const HUB_PREVIEW_SCENARIOS: { id: HubPreviewScenario; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'default', label: 'Idle' },
];

/** Geofence-only scenarios — kept in type/overrides for when geofencing is re-enabled */
export const HUB_PREVIEW_GEOFENCE_SCENARIOS: { id: HubPreviewScenario; label: string }[] = [
  { id: 'fnbPrompt', label: 'F&B Prompt' },
  { id: 'teeTimeSoon', label: 'Tee Time Soon' },
  { id: 'checkedIn', label: 'Checked In' },
];

export interface HubContextOverrides {
  isCheckedIn: boolean;
  isTracking: boolean;
  isTurnPaused: boolean;
  hasUnfinishedRound: boolean;
  currentHole: number;
  showFnbPrompt: boolean;
  teeTime: Date | null;
  minutesUntil: number | null;
}

export function getScenarioOverrides(scenario: HubPreviewScenario): HubContextOverrides | null {
  switch (scenario) {
    case 'live':
      return null;
    case 'roundInProgress':
      return {
        isCheckedIn: false,
        isTracking: true,
        isTurnPaused: false,
        hasUnfinishedRound: false,
        currentHole: 7,
        showFnbPrompt: false,
        teeTime: null,
        minutesUntil: null,
      };
    case 'continueRound':
      return {
        isCheckedIn: false,
        isTracking: false,
        isTurnPaused: false,
        hasUnfinishedRound: true,
        currentHole: 12,
        showFnbPrompt: false,
        teeTime: null,
        minutesUntil: null,
      };
    case 'turnPaused':
      return {
        isCheckedIn: false,
        isTracking: false,
        isTurnPaused: true,
        hasUnfinishedRound: false,
        currentHole: 9,
        showFnbPrompt: false,
        teeTime: null,
        minutesUntil: null,
      };
    case 'fnbPrompt':
      return {
        isCheckedIn: false,
        isTracking: false,
        isTurnPaused: false,
        hasUnfinishedRound: false,
        currentHole: 9,
        showFnbPrompt: true,
        teeTime: null,
        minutesUntil: null,
      };
    case 'teeTimeSoon':
      return {
        isCheckedIn: false,
        isTracking: false,
        isTurnPaused: false,
        hasUnfinishedRound: false,
        currentHole: 1,
        showFnbPrompt: false,
        teeTime: new Date(),
        minutesUntil: 20,
      };
    case 'checkedIn':
      return {
        isCheckedIn: true,
        isTracking: false,
        isTurnPaused: false,
        hasUnfinishedRound: false,
        currentHole: 1,
        showFnbPrompt: false,
        teeTime: null,
        minutesUntil: null,
      };
    case 'default':
      return {
        isCheckedIn: false,
        isTracking: false,
        isTurnPaused: false,
        hasUnfinishedRound: false,
        currentHole: 1,
        showFnbPrompt: false,
        teeTime: null,
        minutesUntil: null,
      };
  }
}

interface HubPreviewContextValue {
  previewMode: boolean;
  scenario: HubPreviewScenario;
  setScenario: (scenario: HubPreviewScenario) => void;
}

const HubPreviewContext = createContext<HubPreviewContextValue | null>(null);

export function HubPreviewProvider({
  children,
  initialScenario = 'live',
}: {
  children: ReactNode;
  initialScenario?: HubPreviewScenario;
}) {
  const [scenario, setScenario] = useState<HubPreviewScenario>(initialScenario);

  const value = useMemo(
    () => ({
      previewMode: true,
      scenario,
      setScenario,
    }),
    [scenario]
  );

  return <HubPreviewContext.Provider value={value}>{children}</HubPreviewContext.Provider>;
}

export function useHubPreviewContext(): HubPreviewContextValue | null {
  return useContext(HubPreviewContext);
}
