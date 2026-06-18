/** Where scorecard "back" should land after admin opens a match from the dashboard. */
let scorecardReturnDestination: 'admin' | null = null;
let adminTournamentsFlowActive = false;

export function setScorecardReturnDestination(destination: 'admin' | null): void {
  scorecardReturnDestination = destination;
}

export function consumeScorecardReturnDestination(): 'admin' | null {
  const destination = scorecardReturnDestination;
  scorecardReturnDestination = null;
  return destination;
}

export function peekScorecardReturnDestination(): 'admin' | null {
  return scorecardReturnDestination;
}

export function setAdminTournamentsFlowActive(active: boolean): void {
  adminTournamentsFlowActive = active;
}

export function isAdminTournamentsFlowActive(): boolean {
  return adminTournamentsFlowActive;
}
