import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/components/StyleoutUI';
import { createStyleoutClient, IMAGE_BUCKET } from '@/lib/supabase';

export const CATEGORIES = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Shoes', 'Bags', 'Accessories'] as const;
export type Category = (typeof CATEGORIES)[number];
export type ClosetItem = {
  id: string;
  image: string;
  imagePath: string;
  name: string;
  category: Category;
  color: string;
  brand: string;
  notes: string;
};
export type MainPhoto = { path: string; uri: string; createdAt: string | null };
export type LookSelection = { slotIndex: number; itemId: string };
export type SavedLook = {
  id: string;
  title: string;
  signature: string;
  image: string | null;
  imagePath: string | null;
  generatedImage: string | null;
  generatedImagePath: string | null;
  generationStatus: 'idle' | 'running' | 'complete' | 'failed';
  generationError: string | null;
  generationStartedAt: number | null;
  pieces: string[];
  selections: Array<LookSelection & { item: ClosetItem | null; itemName: string; itemCategory: string; itemImagePath: string; itemImage: string | null }>;
  savedAt: number;
};
export function lookSignature(imagePath: string | null, selections: LookSelection[]) {
  return JSON.stringify([imagePath, [...selections].sort((a, b) => a.slotIndex - b.slotIndex).map(({ slotIndex, itemId }) => [slotIndex, itemId])]);
}
type NewItem = Omit<ClosetItem, 'id' | 'imagePath'>;
type ItemChanges = Omit<NewItem, 'image'> & { image?: string };
export type WardrobeDraft = { image: string; category: Category; slotIndex: number | null };
export type PendingStyleSelection = { slotIndex: number; item: ClosetItem };
const TITLE_PREFIX = '__styleout_title__:';
function titleFromPieces(pieces: string[] | null) { return pieces?.[0]?.startsWith(TITLE_PREFIX) ? pieces[0].slice(TITLE_PREFIX.length) : null; }
function cleanPieces(pieces: string[] | null) { return titleFromPieces(pieces) ? (pieces || []).slice(1) : pieces || []; }
type ClosetState = {
  items: ClosetItem[];
  name: string;
  bio: string;
  bodyPhoto: string | null;
  bodyPhotoPath: string | null;
  mainPhotos: MainPhoto[];
  savedLooks: SavedLook[];
  previousWardrobeAvailable: boolean;
  importPreviousWardrobe: () => Promise<void>;
  addItem: (item: NewItem) => Promise<ClosetItem>;
  updateItem: (id: string, changes: ItemChanges) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateProfile: (name: string, bio: string) => Promise<void>;
  setBodyPhoto: (uri: string) => Promise<void>;
  selectMainPhoto: (path: string) => Promise<void>;
  deleteMainPhoto: (path: string) => Promise<void>;
  refreshCloset: () => Promise<void>;
  wardrobeDraft: WardrobeDraft | null;
  beginWardrobeDraft: (draft: WardrobeDraft) => void;
  clearWardrobeDraft: () => void;
  pendingStyleSelection: PendingStyleSelection | null;
  queueStyleSelection: (selection: PendingStyleSelection) => void;
  clearPendingStyleSelection: () => void;
  saveLook: (title: string, selections: LookSelection[], pieces: string[]) => Promise<string>;
  generateLook: (id: string, instructions?: string) => Promise<void>;
  updateLookTitle: (id: string, title: string) => Promise<void>;
  removeLook: (id: string) => Promise<void>;
};
const ClosetContext = createContext<ClosetState | null>(null);

async function keepImage(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const folder = new Directory(Paths.document, 'styleout');
  if (!folder.exists) folder.create();
  const extension = uri.split('?')[0].match(/\.(png|jpe?g|webp|heic|heif)$/i)?.[1]?.toLowerCase() || 'jpg';
  const destination = new File(folder, `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  new File(uri).copy(destination);
  return destination.uri;
}

export async function pickPhoto(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, base64: Platform.OS === 'web',
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    if (Platform.OS === 'web' && asset.base64) return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
    return await keepImage(asset.uri);
  } catch {
    Alert.alert('Photo unavailable', 'Please try selecting the photo again.');
    return null;
  }
}

export async function takePhoto(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph an item for your wardrobe.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
        ]);
        return null;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8,
      base64: Platform.OS === 'web',
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    if (Platform.OS === 'web' && asset.base64) return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
    return await keepImage(asset.uri);
  } catch {
    Alert.alert('Camera unavailable', 'The camera could not open. Please try again.');
    return null;
  }
}

function photoType(uri: string) {
  const dataType = uri.match(/^data:(image\/[a-z+]+);/i)?.[1];
  if (dataType) return dataType;
  const extension = uri.split('?')[0].match(/\.([a-z]+)$/i)?.[1]?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
}
function extensionFor(type: string) {
  return ({ 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[type] || 'jpg';
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Please try again.'; }

type Client = NonNullable<ReturnType<typeof createStyleoutClient>>;
function WardrobeLoadingScreen() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setProgress((value) => Math.min(96, value + (value < 65 ? 2 : 1))), 42);
    return () => clearInterval(timer);
  }, []);
  return <View style={styles.loadingScreen} accessibilityLabel={`Loading your wardrobe ${progress} percent`}><Text style={styles.loadingEyebrow}>STYLEOUT</Text><Text style={styles.loadingCopy}>Preparing your wardrobe</Text><Text style={styles.loadingProgress}>{progress}</Text></View>;
}

async function signedImage(client: Client, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}
async function uploadImage(client: Client, userId: string, uri: string, area: 'main' | 'wardrobe') {
  const type = photoType(uri);
  const path = `${userId}/${area}/${Crypto.randomUUID()}.${extensionFor(type)}`;
  const bytes = Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}

export function ClosetProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const client = useMemo(() => createStyleoutClient(() => getTokenRef.current()), [userId]);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [name, setName] = useState('Your profile');
  const [bio, setBio] = useState('A wardrobe that feels like you.');
  const [bodyPhoto, setBodyPhotoState] = useState<string | null>(null);
  const [bodyPhotoPath, setBodyPhotoPath] = useState<string | null>(null);
  const [mainPhotos, setMainPhotos] = useState<MainPhoto[]>([]);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [snapshotsAvailable, setSnapshotsAvailable] = useState(false);
  const [titlesAvailable, setTitlesAvailable] = useState(false);
  const [previousWardrobeAvailable, setPreviousWardrobeAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wardrobeDraft, setWardrobeDraft] = useState<WardrobeDraft | null>(null);
  const [pendingStyleSelection, setPendingStyleSelection] = useState<PendingStyleSelection | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const [profileResult, itemResult, lookResult, linkResult, snapshotProbe, titleProbe] = await Promise.all([
      client.from('styleout_profiles').select('display_name,bio,main_image_path').eq('user_id', userId).maybeSingle(),
      client.from('wardrobe_items').select('id,image_path,name,category,color,brand,notes').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('saved_looks').select('*').eq('user_id', userId).order('saved_at', { ascending: false }),
      client.from('saved_look_items').select('*').eq('user_id', userId).order('slot_index', { ascending: true }),
      client.from('saved_look_items').select('item_image_path').limit(0),
      client.from('saved_looks').select('title').limit(0),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (itemResult.error) throw itemResult.error;
    if (lookResult.error) throw lookResult.error;
    if (linkResult.error) throw linkResult.error;
    const profile = profileResult.data;
    const itemRows = itemResult.data || [];
    const lookRows = lookResult.data || [];
    const [mainUrl, loadedItems, rawLooks, mainPhotoRows] = await Promise.all([
      signedImage(client, profile?.main_image_path || null),
      Promise.all(itemRows.map(async (row) => ({
        id: row.id, imagePath: row.image_path, image: (await signedImage(client, row.image_path)) || '',
        name: row.name, category: row.category as Category, color: row.color, brand: row.brand, notes: row.notes,
      }))),
      Promise.all(lookRows.map(async (row) => ({
        id: row.id, title: row.title && row.title !== 'Saved style' ? row.title : titleFromPieces(row.pieces) || row.title || 'Saved style', signature: row.signature, imagePath: row.image_path, image: await signedImage(client, row.image_path),
        generatedImagePath: row.generated_image_path, generatedImage: await signedImage(client, row.generated_image_path),
        generationStatus: row.generation_status || (row.generated_image_path ? 'complete' : 'idle'), generationError: row.generation_error || null,
        generationStartedAt: row.generation_started_at ? new Date(row.generation_started_at).getTime() : null,
        pieces: cleanPieces(row.pieces), savedAt: new Date(row.saved_at).getTime(),
      }))),
      client.storage.from(IMAGE_BUCKET).list(`${userId}/main`, { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 }),
    ]);
    const listedPhotos = mainPhotoRows.error ? [] : await Promise.all((mainPhotoRows.data || []).filter((row) => row.name).map(async (row) => {
      const path = `${userId}/main/${row.name}`;
      const uri = await signedImage(client, path);
      return uri ? { path, uri, createdAt: row.created_at || null } : null;
    }));
    const itemById = new Map(loadedItems.map((item) => [item.id, item]));
    const linksByLook = new Map<string, SavedLook['selections']>();
    for (const link of linkResult.data || []) {
      const group = linksByLook.get(link.look_id) || [];
      const item = itemById.get(link.item_id) || null;
      const itemImagePath = link.item_image_path || item?.imagePath || '';
      group.push({ slotIndex: link.slot_index, itemId: link.item_id, item,
        itemName: link.item_name || item?.name || '', itemCategory: link.item_category || item?.category || '', itemImagePath,
        itemImage: item && item.imagePath === itemImagePath ? item.image : await signedImage(client, itemImagePath) });
      linksByLook.set(link.look_id, group);
    }
    const loadedLooks: SavedLook[] = rawLooks.map((look) => ({ ...look, selections: linksByLook.get(look.id) || [] }));
    setName(profile?.display_name || 'Your profile');
    setBio(profile?.bio || 'A wardrobe that feels like you.');
    setBodyPhotoPath(profile?.main_image_path || null);
    setBodyPhotoState(mainUrl);
    setMainPhotos(listedPhotos.filter((photo): photo is MainPhoto => !!photo));
    setItems(loadedItems);
    setSavedLooks(loadedLooks);
    setSnapshotsAvailable(!snapshotProbe.error);
    setTitlesAvailable(!titleProbe.error);
    setLoadError(null);
  }, [client, userId]);

  useEffect(() => {
    if (!userId || !client) { setReady(true); return; }
    let active = true;
    Promise.all([AsyncStorage.getItem(`styleout.v2.${userId}`), AsyncStorage.getItem('styleout.v1'), AsyncStorage.getItem(`styleout.imported.${userId}`)])
      .then(([ownRaw, oldRaw, imported]) => {
        if (!active || imported) return;
        const own = ownRaw ? JSON.parse(ownRaw) : null;
        const old = oldRaw ? JSON.parse(oldRaw) : null;
        const hasContent = (data: any) => !!data && ((Array.isArray(data.items) && data.items.length > 0) || !!data.bodyPhoto || (Array.isArray(data.savedLooks) && data.savedLooks.length > 0) || (data.name && data.name !== 'Your profile'));
        setPreviousWardrobeAvailable(hasContent(own) || hasContent(old));
      })
      .catch(() => {})
      .finally(() => refresh().catch((error) => { if (active) setLoadError(message(error)); }).finally(() => { if (active) setReady(true); }));
    return () => { active = false; };
  }, [client, refresh, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && ready && !loadError) refresh().catch(() => {}); });
    return () => subscription.remove();
  }, [refresh, ready, loadError]);

  useEffect(() => {
    if (!savedLooks.some((look) => look.generationStatus === 'running' && (!look.generationStartedAt || Date.now() - look.generationStartedAt < 150000))) return;
    const timer = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [savedLooks, refresh]);

  if (!ready) return <WardrobeLoadingScreen />;
  if (loadError || !client) return <View style={styles.center}><Text style={styles.heading}>{client ? 'Could not load your wardrobe' : 'Supabase setup needed'}</Text><Text style={styles.copy}>{loadError || 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env.local.'}</Text>{client && <Pressable onPress={() => { setReady(false); refresh().catch((error) => setLoadError(message(error))).finally(() => setReady(true)); }} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>}</View>;

  const addItem = async (item: NewItem, sourceId?: string) => {
    if (!userId) throw new Error('Sign in to save your wardrobe.');
    const imagePath = await uploadImage(client, userId, item.image, 'wardrobe');
    try {
      const { data, error } = await client.from('wardrobe_items').insert({ user_id: userId, image_path: imagePath, name: item.name, category: item.category, color: item.color, brand: item.brand, notes: item.notes, source_id: sourceId || null }).select('id').single();
      if (error) throw error;
      const savedItem = { ...item, id: data.id, imagePath, image: item.image };
      setItems((current) => [savedItem, ...current]);
      return savedItem;
    } catch (error) {
      await client.storage.from(IMAGE_BUCKET).remove([imagePath]);
      throw error;
    }
  };
  const value: ClosetState = {
    items, name, bio, bodyPhoto, bodyPhotoPath, mainPhotos, savedLooks, previousWardrobeAvailable,
    refreshCloset: refresh,
    wardrobeDraft,
    beginWardrobeDraft: setWardrobeDraft,
    clearWardrobeDraft: () => setWardrobeDraft(null),
    pendingStyleSelection,
    queueStyleSelection: setPendingStyleSelection,
    clearPendingStyleSelection: () => setPendingStyleSelection(null),
    addItem,
    updateItem: async (id, changes) => {
      if (!userId) throw new Error('Sign in to edit your wardrobe.');
      const currentItem = items.find((entry) => entry.id === id);
      if (!currentItem) throw new Error('This piece is no longer in your wardrobe.');
      if (!snapshotsAvailable && savedLooks.some((look) => look.selections.some((selection) => selection.itemId === id))) {
        throw new Error('This piece is in a saved style. Apply the new Supabase migration before editing it, so that style keeps its original details.');
      }
      const newPath = changes.image ? await uploadImage(client, userId, changes.image, 'wardrobe') : null;
      try {
        const { error } = await client.from('wardrobe_items').update({
          image_path: newPath || currentItem.imagePath, name: changes.name, category: changes.category,
          color: changes.color, brand: changes.brand, notes: changes.notes, updated_at: new Date().toISOString(),
        }).eq('id', id).eq('user_id', userId).select('id').single();
        if (error) throw error;
      } catch (error) {
        if (newPath) await client.storage.from(IMAGE_BUCKET).remove([newPath]);
        throw error;
      }
      setItems((existing) => existing.map((item) => item.id === id ? {
        ...item, ...changes, image: changes.image || item.image, imagePath: newPath || item.imagePath,
      } : item));
      if (newPath) {
        const { data, error } = await client.from('saved_look_items').select('look_id')
          .eq('user_id', userId).eq('item_image_path', currentItem.imagePath).limit(1);
        if (!error && !data?.length) await client.storage.from(IMAGE_BUCKET).remove([currentItem.imagePath]);
      }
    },
    removeItem: async (id) => {
      const item = items.find((entry) => entry.id === id);
      const { error } = await client.from('wardrobe_items').delete().eq('id', id).eq('user_id', userId);
      if (error?.code === '23503') throw new Error('This piece is used in a saved style. Remove that style first.');
      if (error) throw error;
      setItems((current) => current.filter((entry) => entry.id !== id));
      if (item) await client.storage.from(IMAGE_BUCKET).remove([item.imagePath]);
    },
    updateProfile: async (nextName, nextBio) => {
      const { error } = await client.from('styleout_profiles').upsert({ user_id: userId, display_name: nextName, bio: nextBio, main_image_path: bodyPhotoPath, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      setName(nextName); setBio(nextBio);
    },
    setBodyPhoto: async (uri) => {
      if (!userId) throw new Error('Sign in to save your photo.');
      const path = await uploadImage(client, userId, uri, 'main');
      try {
        const { error } = await client.from('styleout_profiles').upsert({ user_id: userId, display_name: name, bio, main_image_path: path, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        setBodyPhotoPath(path);
        setBodyPhotoState(uri);
        await refresh();
      } catch (error) {
        await client.storage.from(IMAGE_BUCKET).remove([path]);
        throw error;
      }
    },
    selectMainPhoto: async (path) => {
      if (!userId) throw new Error('Sign in to choose your photo.');
      const uri = await signedImage(client, path);
      if (!uri) throw new Error('This photo is no longer available.');
      const { error } = await client.from('styleout_profiles').upsert({ user_id: userId, display_name: name, bio, main_image_path: path, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      setBodyPhotoPath(path);
      setBodyPhotoState(uri);
    },
    deleteMainPhoto: async (path) => {
      if (!userId) throw new Error('Sign in to manage your photos.');
      const { data: references, error: referenceError } = await client.from('saved_looks').select('id').eq('user_id', userId).eq('image_path', path).limit(1);
      if (referenceError) throw referenceError;
      if (references?.length) throw new Error('This photo is used by a saved style. Remove that style first.');
      const { error: removeError } = await client.storage.from(IMAGE_BUCKET).remove([path]);
      if (removeError) throw removeError;
      const remaining = mainPhotos.filter((photo) => photo.path !== path);
      if (path === bodyPhotoPath) {
        const next = remaining[0] || null;
        const { error } = await client.from('styleout_profiles').upsert({ user_id: userId, display_name: name, bio, main_image_path: next?.path || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        setBodyPhotoPath(next?.path || null);
        setBodyPhotoState(next?.uri || null);
      }
      setMainPhotos(remaining);
    },
    saveLook: async (title, selections, pieces) => {
      if (!bodyPhotoPath) throw new Error('Add your photo before saving this style.');
      if (!title.trim()) throw new Error('Name your style before saving it.');
      if (!selections.length) throw new Error('Choose at least one piece from your wardrobe.');
      const selectedItems = selections.map(({ slotIndex, itemId }) => {
        const item = items.find((entry) => entry.id === itemId) || null;
        return { slotIndex, itemId, item, itemName: item?.name || '', itemCategory: item?.category || '',
          itemImagePath: item?.imagePath || '', itemImage: item?.image || null };
      });
      if (selectedItems.some((selection) => !selection.item)) throw new Error('One of these pieces is no longer in your wardrobe.');
      const signature = lookSignature(bodyPhotoPath, selections);
      const existing = savedLooks.find((look) => look.signature === signature);
      if (existing) return existing.id;
      let { data, error } = await client.rpc('save_styleout_look_v2', {
        p_signature: signature, p_image_path: bodyPhotoPath, p_pieces: pieces, p_selections: selections, p_title: title.trim(),
      });
      if (error?.code === 'PGRST202' || error?.code === '42883') {
        const legacy = await client.rpc('save_styleout_look', {
          p_signature: signature, p_image_path: bodyPhotoPath,
          p_pieces: [`${TITLE_PREFIX}${title.trim()}`, ...pieces], p_selections: selections,
        });
        data = legacy.data; error = legacy.error;
      }
      if (error) throw error;
      const savedAt = Date.now();
      setSavedLooks((current) => [{
        id: String(data), title: title.trim(), signature, imagePath: bodyPhotoPath, image: bodyPhoto,
        generatedImagePath: null, generatedImage: null, generationStatus: 'idle', generationError: null, generationStartedAt: null, pieces, selections: selectedItems, savedAt,
      }, ...current]);
      return String(data);
    },
    generateLook: async (id, instructions = '') => {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Sign in to generate a look.');
      const { data, error } = await client.functions.invoke('generate-styleout-look', {
        body: { lookId: id, instructions: instructions.trim() }, headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const response = 'context' in error ? error.context : null;
        const detail = response instanceof Response ? await response.json().catch(() => null) : null;
        throw new Error(detail?.error || 'Could not start image generation. Please try again.');
      }
      if (data?.status === 'running') setSavedLooks((current) => current.map((look) => look.id === id ? { ...look, generationStatus: 'running', generationError: null, generationStartedAt: Date.now() } : look));
      else await refresh();
    },
    updateLookTitle: async (id, title) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error('Name your style before saving it.');
      const look = savedLooks.find((entry) => entry.id === id);
      if (!look) throw new Error('This style is no longer saved.');
      const update = titlesAvailable ? { title: cleanTitle, pieces: look.pieces } : { pieces: [`${TITLE_PREFIX}${cleanTitle}`, ...look.pieces] };
      const { error } = await client.from('saved_looks').update(update).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      setSavedLooks((current) => current.map((look) => look.id === id ? { ...look, title: cleanTitle } : look));
    },
    removeLook: async (id) => {
      const generatedPath = savedLooks.find((look) => look.id === id)?.generatedImagePath;
      const { error } = await client.from('saved_looks').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      setSavedLooks((current) => current.filter((look) => look.id !== id));
      if (generatedPath) await client.storage.from(IMAGE_BUCKET).remove([generatedPath]);
    },
    importPreviousWardrobe: async () => {
      if (!userId) throw new Error('Sign in to import your wardrobe.');
      const [ownRaw, oldRaw] = await Promise.all([AsyncStorage.getItem(`styleout.v2.${userId}`), AsyncStorage.getItem('styleout.v1')]);
      const sources = [{ key: 'v2', data: ownRaw ? JSON.parse(ownRaw) : null }, { key: 'v1', data: oldRaw ? JSON.parse(oldRaw) : null }];
      const { data: existingSources, error } = await client.from('wardrobe_items').select('source_id').eq('user_id', userId).not('source_id', 'is', null);
      if (error) throw error;
      const known = new Set((existingSources || []).map((row) => row.source_id));
      for (const source of sources) {
        if (!source.data) continue;
        for (const legacy of source.data.items || []) {
          if (!legacy.image || !legacy.name || !CATEGORIES.includes(legacy.category)) continue;
          const sourceId = `${source.key}:${legacy.id}`;
          if (known.has(sourceId)) continue;
          await addItem({ image: legacy.image, name: legacy.name, category: legacy.category, color: legacy.color || '', brand: legacy.brand || '', notes: legacy.notes || '' }, sourceId);
          known.add(sourceId);
        }
      }
      const preferred = sources.find((source) => source.data && (source.data.bodyPhoto || (source.data.name && source.data.name !== 'Your profile')))?.data;
      if (preferred?.bodyPhoto && !bodyPhotoPath) await value.setBodyPhoto(preferred.bodyPhoto);
      if (preferred && name === 'Your profile' && preferred.name) await value.updateProfile(preferred.name, preferred.bio || bio);
      const { data: existingLooks, error: looksError } = await client.from('saved_looks').select('signature').eq('user_id', userId);
      if (looksError) throw looksError;
      const knownLooks = new Set((existingLooks || []).map((look) => look.signature));
      for (const source of sources) {
        for (const legacy of source.data?.savedLooks || []) {
          if (!Array.isArray(legacy.pieces) || typeof legacy.signature !== 'string') continue;
          const signature = `legacy:${source.key}:${legacy.signature}`;
          if (knownLooks.has(signature)) continue;
          const imagePath = typeof legacy.image === 'string' ? await uploadImage(client, userId, legacy.image, 'main') : null;
          const { error: insertError } = await client.from('saved_looks').insert({
            user_id: userId, signature, image_path: imagePath, pieces: legacy.pieces,
            saved_at: new Date(legacy.savedAt || Date.now()).toISOString(),
          });
          if (insertError) {
            if (imagePath) await client.storage.from(IMAGE_BUCKET).remove([imagePath]);
            throw insertError;
          }
          knownLooks.add(signature);
        }
      }
      await AsyncStorage.setItem(`styleout.imported.${userId}`, 'true');
      setPreviousWardrobeAvailable(false);
      await refresh();
    },
  };
  return <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>;
}

export function useCloset() {
  const value = useContext(ClosetContext);
  if (!value) throw new Error('useCloset must be used inside ClosetProvider');
  return value;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#151515', paddingHorizontal: 24, paddingTop: 24 }, loadingEyebrow: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2 }, loadingCopy: { color: '#AAA9A3', fontSize: 13, marginTop: 10 }, loadingProgress: { position: 'absolute', right: 24, bottom: 18, color: '#fff', fontSize: 104, lineHeight: 112, fontWeight: '800', letterSpacing: -5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: palette.paper },
  heading: { fontSize: 23, color: palette.ink, fontWeight: '600', textAlign: 'center' },
  copy: { marginTop: 12, color: palette.muted, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 25, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: palette.ink },
  retryText: { color: '#fff', fontWeight: '600' },
});
