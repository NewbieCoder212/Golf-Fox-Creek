import * as ImagePicker from 'expo-image-picker';

import type { TournamentServiceResult } from './tournament-supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function readUriAsBytes(localUri: string): Promise<Uint8Array> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error(`Failed to read image file (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function guessContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function pickTeamLogoImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to upload a team logo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export async function uploadTeamLogoImage(
  accessToken: string,
  teamId: string,
  localUri: string
): Promise<TournamentServiceResult<string>> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const fileExt = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt) ? fileExt : 'jpg';
  const filePath = `${teamId}/${Date.now()}.${safeExt === 'jpeg' ? 'jpg' : safeExt}`;

  const bytes = await readUriAsBytes(localUri);
  const contentType = guessContentType(localUri);

  const response = await fetch(`${supabaseUrl}/storage/v1/object/team-logos/${filePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Blob([Uint8Array.from(bytes)], { type: contentType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      data: null,
      error: errorText || `Logo upload failed (${response.status})`,
    };
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/team-logos/${filePath}`;
  return { data: publicUrl, error: null };
}
