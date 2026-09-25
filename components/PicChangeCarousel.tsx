import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MainPhoto, pickPhoto, useCloset } from '@/lib/closet';
import { SmallCaps } from '@/components/StyleoutUI';
import { LoadingImage } from '@/components/LoadingImage';
import { ThemeColors, useStyleoutTheme } from '@/components/StyleoutTheme';
import { useToast } from '@/components/Toast';

type Props = { visible: boolean; onClose: () => void };

export function PicChangeCarousel({ visible, onClose }: Props) {
  const { colors: palette } = useStyleoutTheme();
  const { showToast } = useToast();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const { bodyPhotoPath, mainPhotos, setBodyPhoto, selectMainPhoto, deleteMainPhoto } = useCloset();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const current = mainPhotos[index] || mainPhotos[0];

  async function choose(photo: MainPhoto) {
    setBusy(true);
    try { await selectMainPhoto(photo.path); onClose(); showToast('Main photo updated.'); }
    catch (error) { Alert.alert('Could not use photo', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function addPhoto() {
    const uri = await pickPhoto();
    if (!uri) return;
    setBusy(true);
    try { await setBodyPhoto(uri); onClose(); showToast('Photo added to your Styleout photos.'); }
    catch (error) { Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function removePhoto() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await deleteMainPhoto(current.path);
      setIndex((value) => Math.min(value, Math.max(0, mainPhotos.length - 2)));
      showToast('Photo deleted.', 'info');
    } catch (error) { Alert.alert('Could not delete photo', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  function move(direction: number) {
    if (!mainPhotos.length) return;
    setIndex((value) => (value + direction + mainPhotos.length) % mainPhotos.length);
  }

  function finishSwipe(pageX: number) {
    if (touchStartX.current === null) return;
    const distance = pageX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 42) return;
    move(distance < 0 ? 1 : -1);
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close photo picker">
      <Pressable style={s.sheet} onPress={(event) => event.stopPropagation()}>
        <View style={s.handle} />
        <View style={s.header}><View><SmallCaps>YOUR PHOTOS</SmallCaps><Text style={s.title}>Choose a photo</Text></View><Pressable onPress={onClose} accessibilityLabel="Close photo picker"><Text style={s.close}>×</Text></Pressable></View>
        {current ? <>
          <View style={s.carousel} onTouchStart={(event) => { touchStartX.current = event.nativeEvent.pageX; }} onTouchEnd={(event) => finishSwipe(event.nativeEvent.pageX)} onTouchCancel={() => { touchStartX.current = null; }}>
            <Pressable onPress={() => move(-1)} style={[s.arrowButton, s.arrowLeft]} accessibilityLabel="Previous photo"><Text style={s.arrow}>‹</Text></Pressable>
            <LoadingImage source={{ uri: current.uri }} style={s.photo} resizeMode="contain" />
            <Pressable onPress={() => move(1)} style={[s.arrowButton, s.arrowRight]} accessibilityLabel="Next photo"><Text style={s.arrow}>›</Text></Pressable>
          </View>
          <View style={s.dots}>{mainPhotos.map((photo, dotIndex) => <Pressable key={photo.path} onPress={() => setIndex(dotIndex)} accessibilityLabel={`Show photo ${dotIndex + 1}`} style={[s.dot, dotIndex === index && s.dotActive]} />)}</View>
          <Text style={s.status}>{current.path === bodyPhotoPath ? 'Currently selected' : `${index + 1} of ${mainPhotos.length}`}</Text>
          <View style={s.actions}>
            <Pressable onPress={() => choose(current)} disabled={busy || current.path === bodyPhotoPath} style={[s.primary, (busy || current.path === bodyPhotoPath) && s.disabled]}><Text style={s.primaryText}>{busy ? 'Saving…' : current.path === bodyPhotoPath ? 'Selected photo' : 'Use this photo'}</Text></Pressable>
            <Pressable onPress={removePhoto} disabled={busy} style={[s.delete, busy && s.disabled]}><Text style={s.deleteText}>Delete photo</Text></Pressable>
          </View>
        </> : <View style={s.empty}><Text style={s.emptyTitle}>No saved photos yet</Text><Text style={s.emptyCopy}>Add a full-length photo to start styling yourself.</Text></View>}
        <Pressable onPress={addPhoto} disabled={busy} style={s.add}><Text style={s.addText}>＋  Add new photo</Text></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, sheet: { backgroundColor: palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38 }, handle: { alignSelf: 'center', width: 34, height: 4, borderRadius: 3, backgroundColor: palette.line, marginBottom: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }, title: { fontSize: 27, fontWeight: '600', color: palette.ink, marginTop: 5 }, close: { fontSize: 28, color: palette.ink }, carousel: { height: 330, borderRadius: 20, backgroundColor: palette.canvas, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, photo: { width: '100%', height: '100%' }, arrowButton: { position: 'absolute', zIndex: 1, top: '45%', width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFFDD', alignItems: 'center', justifyContent: 'center' }, arrowLeft: { left: 12 }, arrowRight: { right: 12 }, arrow: { color: palette.ink, fontSize: 30, lineHeight: 32 }, dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 15 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.line }, dotActive: { width: 20, backgroundColor: palette.ink }, status: { textAlign: 'center', color: palette.muted, fontSize: 11, marginTop: 10 }, actions: { flexDirection: 'row', gap: 10, marginTop: 17 }, primary: { flex: 1, height: 50, borderRadius: 15, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, delete: { height: 50, paddingHorizontal: 18, borderRadius: 15, borderWidth: 1, borderColor: '#E5C9C5', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#9E534A', fontSize: 12, fontWeight: '700' }, add: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, addText: { color: palette.ink, fontSize: 13, fontWeight: '600' }, disabled: { opacity: 0.55 }, empty: { height: 150, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '600' }, emptyCopy: { color: palette.muted, fontSize: 12, marginTop: 7 },
});
