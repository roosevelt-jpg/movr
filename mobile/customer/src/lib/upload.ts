const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authToken(): string | null {
  return (
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null)
  );
}

/** Direct multipart upload to POST /uploads — never paste a remote image URL. */
export async function uploadDirectFile(
  file: Blob | File | { uri: string; name?: string; type?: string },
  opts?: { fieldName?: string; token?: string | null }
): Promise<string> {
  const token = opts?.token ?? authToken();
  const field = opts?.fieldName || 'file';
  const body = new FormData();

  if (typeof File !== 'undefined' && file instanceof File) {
    body.append(field, file);
  } else if (typeof Blob !== 'undefined' && file instanceof Blob) {
    body.append(field, file, 'upload.jpg');
  } else {
    const meta = file as { uri: string; name?: string; type?: string };
    body.append(field, {
      uri: meta.uri,
      name: meta.name || 'upload.jpg',
      type: meta.type || 'image/jpeg',
    } as any);
  }

  const res = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Upload failed');
  return json.data.url as string;
}

async function pickViaExpoImagePicker(): Promise<{ uri: string; name?: string; type?: string } | null> {
  try {
    // Optional peer — present in Expo device builds, absent in web screen packs.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ImagePicker = require('expo-image-picker');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== 'granted') return null;
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (shot.canceled || !shot.assets?.[0]) return null;
      const a = shot.assets[0];
      return { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' };
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    return { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.mimeType || 'image/jpeg' };
  } catch {
    return null;
  }
}

/** Open a system/web/native file picker and upload the selected file. */
export async function pickAndUploadImage(opts?: {
  accept?: string;
  token?: string | null;
}): Promise<string> {
  const accept = opts?.accept || 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
  const doc = (globalThis as any).document;
  if (doc?.createElement) {
    return new Promise((resolve, reject) => {
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            reject(new Error('No file selected'));
            return;
          }
          resolve(await uploadDirectFile(file, { token: opts?.token }));
        } catch (e: any) {
          reject(e);
        }
      };
      input.click();
    });
  }

  const picked = await pickViaExpoImagePicker();
  if (!picked) {
    throw new Error('File picker unavailable — grant photo/camera permission or use a web build');
  }
  return uploadDirectFile(picked, { token: opts?.token });
}
