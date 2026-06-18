import { useEffect, useMemo, useState } from 'react';

import {
  getScorecardClosedHint,
  isScorecardTimeGateOpen,
  type ScorecardTimeGateParams,
} from '@/lib/tournament-scorecard-routing';

/** Re-checks every minute while the gate is closed so buttons enable on time. */
export function useScorecardTimeGate(params: ScorecardTimeGateParams) {
  const [now, setNow] = useState(() => new Date());

  const open = useMemo(
    () => isScorecardTimeGateOpen({ ...params, now }),
    [
      params.bypassTimeGate,
      params.matchGroup?.tee_time,
      params.tournament.end_date,
      params.tournament.start_date,
      now,
    ]
  );

  const hint = useMemo(
    () => (open ? null : getScorecardClosedHint({ ...params, now })),
    [
      open,
      params.bypassTimeGate,
      params.matchGroup?.tee_time,
      params.tournament.end_date,
      params.tournament.start_date,
      now,
    ]
  );

  useEffect(() => {
    if (open) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [open]);

  return { open, hint };
}
