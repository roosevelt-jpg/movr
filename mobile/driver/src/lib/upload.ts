const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authToken(): string | null {
  return (
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null)
  );
}

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

export function pickAndUploadImage(opts?: {
  accept?: string;
  token?: string | null;
}): Promise<string> {
  const accept = opts?.accept || 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
  return new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc?.createElement) {
      reject(new Error('File picker unavailable on this build — use a device build with camera support'));
      return;
    }
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
