import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingImage } from '@/components/LoadingImage';
import { ClosetRefreshControl } from '@/components/ClosetRefreshControl';
import { palette, SmallCaps } from '@/components/StyleoutUI';
import { SavedLook, useCloset } from '@/lib/closet';
import { downloadImage } from '@/lib/saveImage';

const lookImage = require('../../assets/styleout/look.png');
const SORTS = [
  { key: 'newest', label: 'Date added · newest' },
  { key: 'oldest', label: 'Date added · oldest' },
  { key: 'nameAsc', label: 'Name · A–Z' },
  { key: 'nameDesc', label: 'Name · Z–A' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

export default function LooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedLooks } = useCloset();
  const [sort, setSort] = useState<SortKey>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [preview, setPreview] = useState<SavedLook | null>(null);
  const [downloading, setDownloading] = useState(false);
  const sortedLooks = useMemo(() => [...savedLooks].sort((left, right) => {
    if (sort === 'nameAsc') return left.title.localeCompare(right.title);
    if (sort === 'nameDesc') return right.title.localeCompare(left.title);
    return sort === 'newest' ? right.savedAt - left.savedAt : left.savedAt - right.savedAt;
  }), [savedLooks, sort]);
  const sortLabel = SORTS.find((entry) => entry.key === sort)?.label || SORTS[0].label;
  async function downloadPreview() {
    const url = preview?.generatedImage || preview?.image;
    if (!url || downloading) return;
    setDownloading(true);
    try { await downloadImage(url, preview?.title || 'styleout-look'); Alert.alert('Image saved', 'This look was downloaded successfully.'); }
    catch (error) { Alert.alert('Download unavailable', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setDownloading(false); }
  }

  return <View style={s.screen}>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} alwaysBounceVertical refreshControl={Platform.OS === 'web' ? undefined : <ClosetRefreshControl />}>
      <View style={s.header}><Pressable onPress={() => router.back()} accessibilityLabel="Back to profile" style={s.back}><Text style={s.backText}>‹</Text></Pressable><View style={s.heading}><SmallCaps>YOUR STYLE ARCHIVE</SmallCaps><Text style={s.title}>All saved looks</Text></View><Text style={s.count}>{savedLooks.length.toString().padStart(2, '0')}</Text></View>
      <View style={s.toolbar}><Text style={s.resultText}>{sortedLooks.length} {sortedLooks.length === 1 ? 'look' : 'looks'}</Text><View><Pressable onPress={() => setFilterOpen((open) => !open)} accessibilityRole="button" accessibilityLabel={`Sort saved looks, ${sortLabel}`} style={s.filterButton}><Text style={s.filterButtonText}>{sortLabel}</Text><Text style={s.chevron}>{filterOpen ? '⌃' : '⌄'}</Text></Pressable>{filterOpen ? <View style={s.filterMenu}><Text style={s.menuLabel}>SORT BY</Text>{SORTS.map((entry) => <Pressable key={entry.key} onPress={() => { setSort(entry.key); setFilterOpen(false); }} style={[s.filterOption, sort === entry.key && s.filterOptionActive]}><Text style={[s.filterOptionText, sort === entry.key && s.filterOptionTextActive]}>{entry.label}</Text>{sort === entry.key ? <Text style={s.check}>✓</Text> : null}</Pressable>)}</View> : null}</View></View>
      {sortedLooks.length ? <View style={s.grid}>{sortedLooks.map((look, index) => <Pressable key={look.id} onPress={() => setPreview(look)} style={s.card} accessibilityLabel={`Open ${look.title}`}><View style={s.imageWrap}><LoadingImage source={look.generatedImage ? { uri: look.generatedImage } : look.image ? { uri: look.image } : lookImage} style={s.image} resizeMode="cover" /><View style={s.numberBadge}><Text style={s.numberText}>{String(index + 1).padStart(2, '0')}</Text></View></View><Text style={s.cardTitle} numberOfLines={1}>{look.title}</Text><Text style={s.cardMeta}>{look.generatedImage ? 'AI LOOK' : look.generationStatus === 'running' ? 'GENERATING' : 'SOURCE'} · {new Date(look.savedAt).toLocaleDateString()}</Text></Pressable>)}</View> : <View style={s.empty}><Text style={s.emptyTitle}>No looks in this view</Text><Text style={s.emptyCopy}>Choose a different filter to see the rest of your saved styles.</Text></View>}
    </ScrollView>
    <Modal visible={!!preview} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setPreview(null)}>
      <View style={s.preview}><StatusBar barStyle="light-content" backgroundColor="#111" /><LoadingImage source={preview?.generatedImage ? { uri: preview.generatedImage } : preview?.image ? { uri: preview.image } : lookImage} style={s.previewImage} resizeMode="contain" /><Pressable onPress={() => setPreview(null)} accessibilityLabel="Back to all saved looks" style={[s.previewBack, { top: insets.top + 12 }]}><Text style={s.previewBackArrow}>‹</Text><Text style={s.previewBackText}>Back</Text></Pressable><Pressable onPress={downloadPreview} disabled={downloading || !(preview?.generatedImage || preview?.image)} accessibilityLabel="Download saved look image" style={[s.previewDownload, { top: insets.top + 12 }, downloading && s.previewDownloadDisabled]}><Text style={s.previewDownloadIcon}>↓</Text><Text style={s.previewDownloadText}>{downloading ? 'Saving' : 'Download'}</Text></Pressable><View style={[s.previewCaption, { paddingBottom: Math.max(insets.bottom, 20) }]}><SmallCaps style={{ color: '#C8C8C3' }}>SAVED LOOK</SmallCaps><Text style={s.previewTitle}>{preview?.title}</Text><Text style={s.previewMeta}>{preview?.selections.length || 0} linked {(preview?.selections.length || 0) === 1 ? 'piece' : 'pieces'}</Text></View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, width: '100%', maxWidth: 940, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 64 }, back: { width: 42, height: 42, borderRadius: 16, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, backText: { color: palette.ink, fontSize: 32, lineHeight: 34, marginTop: -3 }, heading: { flex: 1 }, title: { color: palette.ink, fontSize: 28, fontWeight: '600', letterSpacing: -0.9, marginTop: 5 }, count: { color: palette.ink, fontSize: 35, fontWeight: '700', letterSpacing: -1.5 },
  toolbar: { zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 18 }, resultText: { color: palette.muted, fontSize: 12 }, filterButton: { minWidth: 150, height: 42, borderRadius: 13, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#fff' }, filterButtonText: { color: palette.ink, fontSize: 12, fontWeight: '600' }, chevron: { color: palette.muted, fontSize: 15 }, filterMenu: { position: 'absolute', right: 0, top: 48, minWidth: 210, borderRadius: 15, padding: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, menuLabel: { color: palette.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 5 }, menuDivider: { height: 1, backgroundColor: palette.line, marginVertical: 5 }, filterOption: { height: 42, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterOptionActive: { backgroundColor: palette.canvas }, filterOptionText: { color: palette.muted, fontSize: 12 }, filterOptionTextActive: { color: palette.ink, fontWeight: '700' }, check: { color: palette.olive, fontWeight: '700' },
  grid: { zIndex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, card: { width: '48%', flexGrow: 1, maxWidth: 290, marginBottom: 10 }, imageWrap: { aspectRatio: 0.78, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.canvas }, image: { width: '100%', height: '100%' }, numberBadge: { position: 'absolute', top: 10, left: 10, minWidth: 31, height: 25, borderRadius: 13, backgroundColor: '#FFFFFFE8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }, numberText: { color: palette.ink, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, cardTitle: { color: palette.ink, fontSize: 15, fontWeight: '600', marginTop: 10 }, cardMeta: { color: palette.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 80 }, emptyTitle: { color: palette.ink, fontSize: 20, fontWeight: '600' }, emptyCopy: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 280 },
  preview: { flex: 1, backgroundColor: '#111' }, previewImage: { width: '100%', height: '100%' }, previewBack: { position: 'absolute', left: 20, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', paddingLeft: 12, paddingRight: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, previewBackArrow: { color: '#111', fontSize: 28, lineHeight: 31, marginTop: -2 }, previewBackText: { color: '#111', fontSize: 12, fontWeight: '700' }, previewDownload: { position: 'absolute', right: 20, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, previewDownloadDisabled: { opacity: 0.6 }, previewDownloadIcon: { color: '#111', fontSize: 22, lineHeight: 25 }, previewDownloadText: { color: '#111', fontSize: 12, fontWeight: '700' }, previewCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22, paddingTop: 55, backgroundColor: '#111A' }, previewTitle: { color: '#fff', fontSize: 24, fontWeight: '600', letterSpacing: -0.7, marginTop: 6 }, previewMeta: { color: '#C8C8C3', fontSize: 11, marginTop: 5 },
});
