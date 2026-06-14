import { Redirect } from 'expo-router';

/** Spec alias: Tournament Hub lives at /tournaments — this route forwards there. */
export default function TournamentHubAlias() {
  return <Redirect href="/tournaments" />;
}
