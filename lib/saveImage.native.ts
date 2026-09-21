import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';

export async function downloadImage(url: string, title: string) {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) throw new Error('Photo library permission is required to save this image.');
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'styleout-look';
  const file = await File.downloadFileAsync(url, new File(Paths.cache, `${name}-${Date.now()}.jpg`));
  await MediaLibrary.Asset.create(file.uri);
}
