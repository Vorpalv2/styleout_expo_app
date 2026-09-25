import { useAuth } from '@clerk/expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingImage } from '@/components/LoadingImage';
import { SmallCaps } from '@/components/StyleoutUI';
import { ThemeColors, useStyleoutTheme } from '@/components/StyleoutTheme';
import { useToast } from '@/components/Toast';
import { useCloset } from '@/lib/closet';
import { createStyleoutClient } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type InstagramMedia = {
  id: string;
  mediaType: string;
  imageUrl: string;
  caption: string;
  permalink: string;
  timestamp: string | null;
};

async function functionMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    const payload = await error.context.json().catch(() => null);
    if (payload?.error) return String(payload.error);
  }
  return error instanceof Error ? error.message : fallback;
}

export function InstagramImport() {
  const { colors: palette } = useStyleoutTheme();
  const { showToast } = useToast();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const client = useMemo(() => createStyleoutClient(() => getTokenRef.current()), []);
  const { refreshCloset } = useCloset();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invoke(body: Record<string, unknown>) {
    if (!client) throw new Error('Supabase setup is missing.');
    const token = await getTokenRef.current();
    if (!token) throw new Error('Sign in before connecting Instagram.');
    const result = await client.functions.invoke('instagram-media', { body, headers: { Authorization: `Bearer ${token}` } });
    if (result.error) throw new Error(await functionMessage(result.error, 'Instagram could not complete this request.'));
    return result.data;
  }

  async function refreshStatus(showError = false) {
    try {
      const data = await invoke({ action: 'status' });
      setConnected(!!data?.connected);
      setUsername(data?.username || null);
    } catch (statusError) {
      if (showError) Alert.alert('Instagram unavailable', statusError instanceof Error ? statusError.message : 'Please try again.');
    } finally {
      setChecked(true);
    }
  }

  useEffect(() => { refreshStatus(); }, []);

  async function connectInstagram() {
    if (!client || connecting) return;
    setConnecting(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Sign in before connecting Instagram.');
      const returnUrl = Platform.OS === 'web'
        ? `${window.location.origin}/profile`
        : Linking.createURL('/profile');
      const { data, error: startError } = await client.functions.invoke('instagram-oauth-start', {
        body: { returnUrl },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (startError) throw new Error(await functionMessage(startError, 'Could not start Instagram connection.'));
      if (!data?.url) throw new Error('Instagram authorization is not configured.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
      if (result.type === 'success') await refreshStatus(true);
    } catch (connectError) {
      Alert.alert('Could not connect Instagram', connectError instanceof Error ? connectError.message : 'Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  async function loadMedia(cursor?: string, append = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke({ action: 'list', cursor });
      const incoming = Array.isArray(data?.media) ? data.media as InstagramMedia[] : [];
      setMedia((current) => append
        ? [...current, ...incoming.filter((entry) => !current.some((existing) => existing.id === entry.id))]
        : incoming);
      setNextCursor(data?.nextCursor || null);
      setHasMore(!!data?.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Instagram photos could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  function openPicker() {
    setPickerOpen(true);
    setSelected([]);
    if (!media.length) loadMedia();
  }

  function toggleMedia(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= 2) {
        Alert.alert('Two photos maximum', 'Import these two first, then return for more.');
        return current;
      }
      return [...current, id];
    });
  }

  async function importSelected() {
    if (!selected.length || importing) return;
    setImporting(true);
    setError(null);
    try {
      const data = await invoke({ action: 'import', mediaIds: selected });
      await refreshCloset();
      setPickerOpen(false);
      setSelected([]);
      showToast(`${data?.imported || selected.length} Instagram ${selected.length === 1 ? 'photo added' : 'photos added'} to your Styleout photos.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'These photos could not be imported.');
    } finally {
      setImporting(false);
    }
  }

  return <>
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.crown}><Text style={s.crownText}>♛</Text></View>
        <View style={s.premiumPill}><Text style={s.premiumText}>PREMIUM</Text></View>
      </View>
      <SmallCaps style={s.eyebrow}>INSTAGRAM ARCHIVE</SmallCaps>
      <Text style={s.title}>{connected ? `@${username || 'instagram'} is connected` : 'Bring your feed into the fitting room.'}</Text>
      <Text style={s.copy}>{connected ? 'Choose up to two photos at a time and add them to your Styleout photo carousel.' : 'Connect an Instagram Creator or Business account, then choose the photos you want to style.'}</Text>
      <Pressable
        onPress={connected ? openPicker : connectInstagram}
        disabled={!checked || connecting}
        accessibilityRole="button"
        accessibilityLabel={connected ? 'Choose photos from Instagram' : 'Connect Instagram, premium feature'}
        style={({ pressed }) => [s.connectButton, pressed && s.pressed, (!checked || connecting) && s.disabled]}
      >
        <Text style={s.connectText}>{connecting ? 'Opening Instagram…' : connected ? 'Choose Instagram photos' : 'Connect Instagram'}</Text>
        <Text style={s.connectArrow}>↗</Text>
      </Pressable>
    </View>

    <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
      <View style={[s.modal, { paddingTop: Math.max(insets.top, 18) }]}>
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}><SmallCaps>INSTAGRAM ARCHIVE</SmallCaps><Text style={s.modalTitle}>Choose up to two</Text><Text style={s.modalSubtitle}>{selected.length}/2 selected</Text></View>
          <Pressable onPress={() => setPickerOpen(false)} accessibilityLabel="Close Instagram photos" style={s.closeButton}><Text style={s.closeText}>×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.mediaGrid} showsVerticalScrollIndicator={false}>
          {media.map((item) => {
            const selectedIndex = selected.indexOf(item.id);
            return <Pressable key={item.id} onPress={() => toggleMedia(item.id)} accessibilityRole="button" accessibilityLabel={`${selectedIndex >= 0 ? 'Remove' : 'Select'} Instagram photo`} style={[s.mediaTile, selectedIndex >= 0 && s.mediaTileSelected]}>
              <LoadingImage source={{ uri: item.imageUrl }} style={s.mediaImage} resizeMode="cover" />
              {selectedIndex >= 0 ? <View style={s.selectionBadge}><Text style={s.selectionBadgeText}>{selectedIndex + 1}</Text></View> : null}
              {item.timestamp ? <Text style={s.mediaDate}>{new Date(item.timestamp).toLocaleDateString()}</Text> : null}
            </Pressable>;
          })}
          {!loading && !media.length && !error ? <View style={s.empty}><Text style={s.emptyTitle}>No photos found</Text><Text style={s.emptyCopy}>Only image posts and image slides from carousels appear here.</Text></View> : null}
          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text><Pressable onPress={() => loadMedia()}><Text style={s.retryText}>Try again</Text></Pressable></View> : null}
          {loading ? <Text style={s.loadingText}>Loading Instagram photos…</Text> : null}
          {hasMore && !loading ? <Pressable onPress={() => loadMedia(nextCursor || undefined, true)} style={s.moreButton}><Text style={s.moreText}>Load more photos</Text></Pressable> : null}
        </ScrollView>
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={s.footerNote}>{selected.length ? 'The first selected photo becomes your active styling photo.' : 'Select one or two photos to import.'}</Text>
          <Pressable onPress={importSelected} disabled={!selected.length || importing} style={[s.importButton, (!selected.length || importing) && s.disabled]}>
            <Text style={s.importText}>{importing ? 'Importing…' : `Import ${selected.length || ''} ${selected.length === 1 ? 'photo' : 'photos'}`.trim()}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  card: { marginHorizontal: 24, marginTop: 24, borderRadius: 22, backgroundColor: '#171714', padding: 20, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  crown: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7D39B' },
  crownText: { color: '#171714', fontSize: 23, lineHeight: 26 },
  premiumPill: { borderWidth: 1, borderColor: '#5A533F', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  premiumText: { color: '#E7D39B', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  eyebrow: { color: '#A9A79E' },
  title: { color: '#fff', fontSize: 22, lineHeight: 27, fontWeight: '600', letterSpacing: -0.5, marginTop: 8, maxWidth: 330 },
  copy: { color: '#A9A79E', fontSize: 12, lineHeight: 18, marginTop: 9, maxWidth: 360 },
  connectButton: { height: 52, borderRadius: 16, backgroundColor: '#F5F4EF', marginTop: 20, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectText: { color: '#171714', fontSize: 13, fontWeight: '700' }, connectArrow: { color: '#171714', fontSize: 18 }, pressed: { opacity: 0.84 }, disabled: { opacity: 0.48 },
  modal: { flex: 1, backgroundColor: palette.paper }, modalHeader: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: palette.line },
  modalTitle: { color: palette.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.8, marginTop: 6 }, modalSubtitle: { color: palette.muted, fontSize: 11, marginTop: 5 },
  closeButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, closeText: { color: palette.ink, fontSize: 29, lineHeight: 31 },
  mediaGrid: { padding: 14, paddingBottom: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaTile: { width: '48%', flexGrow: 1, maxWidth: 330, aspectRatio: 0.82, borderRadius: 16, overflow: 'hidden', backgroundColor: palette.canvas, borderWidth: 2, borderColor: 'transparent' },
  mediaTileSelected: { borderColor: '#171714' }, mediaImage: { width: '100%', height: '100%' },
  selectionBadge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#171714', alignItems: 'center', justifyContent: 'center' }, selectionBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  mediaDate: { position: 'absolute', left: 9, bottom: 9, color: '#fff', backgroundColor: '#111A', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '700' },
  empty: { width: '100%', minHeight: 260, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }, emptyTitle: { color: palette.ink, fontSize: 19, fontWeight: '600' }, emptyCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  errorBox: { width: '100%', minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }, errorText: { color: '#9E534A', fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryText: { color: palette.olive, fontSize: 12, fontWeight: '700', marginTop: 12 },
  loadingText: { width: '100%', textAlign: 'center', color: palette.muted, fontSize: 12, paddingVertical: 35 }, moreButton: { width: '100%', height: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, moreText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: palette.line, paddingHorizontal: 20, paddingTop: 14, backgroundColor: palette.paper }, footerNote: { color: palette.muted, fontSize: 10, textAlign: 'center', marginBottom: 10 }, importButton: { height: 52, borderRadius: 16, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, importText: { color: palette.paper, fontSize: 13, fontWeight: '700' },
});
