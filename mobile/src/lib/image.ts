import * as ImagePicker from 'expo-image-picker';

export interface PickedImagePart {
  uri: string;
  name: string;
  type: string;
}

// Галерейгаас нэг зураг сонгож multipart-д хавсаргах хэлбэрээр буцаана. Цуцалбал null.
export async function pickImage(prefix = 'image'): Promise<PickedImagePart | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Зураг сонгохын тулд зургийн сангийн зөвшөөрөл хэрэгтэй');
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `${prefix}-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  };
}

export function imageFormData(part: PickedImagePart, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  // React Native-ийн FormData { uri, name, type } объектыг файл гэж ойлгодог.
  form.append('image', part as unknown as Blob);
  return form;
}
