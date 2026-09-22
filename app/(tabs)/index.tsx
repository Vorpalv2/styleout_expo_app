import { useRouter, type Href } from 'expo-router';
import { useClerk } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AppHeader, palette, RoundAction, samplePieces, SmallCaps } from '@/components/StyleoutUI';
import { LoadingImage } from '@/components/LoadingImage';
import { PicChangeCarousel } from '@/components/PicChangeCarousel';
import { ClosetItem, lookSignature, takePhoto, useCloset } from '@/lib/closet';

const lookImage = require('../../assets/styleout/look.png');
function EmptyPiece({ large = false, label }: { large?: boolean; label?: string }) {
  return <View style={s.emptyWrap}><View style={[s.emptyPiece, large && s.emptyPieceLarge]}><Text style={[s.emptyPieceIcon, large && s.emptyPieceIconLarge]}>＋</Text><Text style={[s.emptyPieceText, large && s.emptyPieceTextLarge]}>NO ITEMS{large ? ' SELECTED' : '\nSELECTED'}</Text></View>{label ? <Text style={s.emptyPieceLabel}>{label}</Text> : null}</View>;
}
function LogoutIcon() {
  return <View style={s.logoutIcon} accessibilityElementsHidden>
    <View style={s.logoutDoor} />
    <View style={s.logoutArrow} />
    <View style={s.logoutArrowTop} />
    <View style={s.logoutArrowBottom} />
  </View>;
}

export default function StyleScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { signOut } = useClerk();
  const { bodyPhoto, bodyPhotoPath, items, savedLooks, saveLook, generateLook, updateLookTitle,
    beginWardrobeDraft, pendingStyleSelection, clearPendingStyleSelection } = useCloset();
  const [styleName, setStyleName] = useState('');
  const [active, setActive] = useState(1);
  const [swapOpen, setSwapOpen] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [generationInstructions, setGenerationInstructions] = useState('');
  const [instructionDraft, setInstructionDraft] = useState('');
  const [chosen, setChosen] = useState<Record<number, ClosetItem>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const stageHeight = Math.min(510, Math.max(400, height * 0.56));
  const piece = samplePieces[active];
  const matching = items.filter((item) => item.category === piece.category);
  const selectedNames = samplePieces.map((_, i) => items.find((item) => item.id === chosen[i]?.id)?.name).filter((name): name is string => !!name);
  const selections = Object.entries(chosen).map(([slotIndex, item]) => ({ slotIndex: Number(slotIndex), itemId: item.id }));
  const savedLook = savedLooks.find((look) => look.signature === lookSignature(bodyPhotoPath, selections));
  const generating = savedLook?.generationStatus === 'running' && (!savedLook.generationStartedAt || Date.now() - savedLook.generationStartedAt < 150000);
  useEffect(() => { if (savedLook) setStyleName(savedLook.title); }, [savedLook?.id]);
  useEffect(() => {
    if (!pendingStyleSelection) return;
    setChosen((current) => ({ ...current, [pendingStyleSelection.slotIndex]: pendingStyleSelection.item }));
    setActive(pendingStyleSelection.slotIndex);
    clearPendingStyleSelection();
  }, [pendingStyleSelection?.item.id, pendingStyleSelection?.slotIndex]);
  function changePhoto() { setPhotoPickerOpen(true); }
  async function leaveAccount() {
    try { await signOut(); }
    catch { Alert.alert('Sign-out failed', 'Please try again.'); }
  }
  async function captureWardrobePiece() {
    setSwapOpen(false);
    if (Platform.OS !== 'web') await new Promise((resolve) => setTimeout(resolve, 280));
    const image = await takePhoto();
    if (!image) return;
    beginWardrobeDraft({ image, category: piece.category, slotIndex: active });
    router.push('/wardrobe' as Href);
  }
  async function saveStyle() {
    if (saving) return;
    setSaving(true); setSaveMessage(null);
    try {
      if (savedLook) {
        if (styleName.trim() !== savedLook.title) {
          await updateLookTitle(savedLook.id, styleName);
          setSaveMessage('Style name updated.');
        } else router.push('/profile' as Href);
      } else {
        await saveLook(styleName, selections, selectedNames);
        setSaveMessage('Style saved with your selected wardrobe pieces.');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setSaveMessage(detail); Alert.alert('Could not save style', detail);
    } finally { setSaving(false); }
  }
  async function generateStyle() {
    if (saving || generating) return;
    setSaving(true); setSaveMessage(null);
    try {
      const title = styleName.trim();
      if (!title) throw new Error('Name your style before generating it.');
      if (selections.length > 2) throw new Error('Grok Imagine can use your photo and up to two wardrobe pieces. Select one or two pieces to generate this look.');
      let id = savedLook?.id;
      if (id && title !== savedLook?.title) await updateLookTitle(id, title);
      if (!id) id = await saveLook(title, selections, selectedNames);
      await generateLook(id, generationInstructions);
      setSaveMessage('Your AI look is generating. It will appear here and in Saved Looks when ready.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setSaveMessage(detail); Alert.alert('Could not generate AI look', detail);
    } finally { setSaving(false); }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 25 }} showsVerticalScrollIndicator={false}>
        <AppHeader eyebrow="YOUR DIGITAL DRESSING ROOM" title="Styleout" right={<RoundAction label="Sign out" onPress={leaveAccount}><LogoutIcon /></RoundAction>} />
        <View style={s.titleRow}>
          <View style={s.titleInputWrap}><SmallCaps>YOUR STYLE NAME</SmallCaps><TextInput value={styleName} onChangeText={setStyleName} placeholder="Name this style" placeholderTextColor={palette.muted} style={s.lookTitle} maxLength={60} accessibilityLabel="Style name" /></View>
          <Pressable onPress={changePhoto}><Text style={s.link}>Use my photo ↗</Text></Pressable>
        </View>
        <View style={[s.stage, { height: stageHeight }]}>
          <LoadingImage source={savedLook?.generatedImage ? { uri: savedLook.generatedImage } : bodyPhoto ? { uri: bodyPhoto } : lookImage} resizeMode="contain" style={s.model} />
          <View style={s.stageLabel}><Text style={s.stageLabelText}>{savedLook?.generatedImage ? 'YOUR AI LOOK' : bodyPhoto ? 'YOUR PHOTO' : 'THE EDIT'}</Text></View>
          {samplePieces.map((item, i) => {
            const selected = items.find((entry) => entry.id === chosen[i]?.id);
            return (
              <Pressable key={item.name} accessibilityLabel={`Choose ${selected?.name || item.category} from wardrobe`} onPress={() => { setActive(i); setSwapOpen(true); }}
                style={[s.piece, { top: stageHeight * (0.11 + (i % 3) * 0.30), [i < 3 ? 'left' : 'right']: 12 }, active === i && s.pieceActive]}>
                {selected ? <LoadingImage source={{ uri: selected.image }} style={s.pieceImage} /> : <EmptyPiece label={item.category} />}
              </Pressable>
            );
          })}
          <Pressable onPress={changePhoto} style={s.changePhoto}><Text style={s.changePhotoText}>↗  Change photo</Text></Pressable>
        </View>
        <View style={s.details}>
          <Pressable onPress={savedLook?.generatedImage ? () => router.push('/profile' as Href) : generateStyle} disabled={saving || generating} style={[s.generateButton, (saving || generating) && s.generateDisabled]}><Text style={s.generateText}>{savedLook?.generatedImage ? '✦  View AI look in Saved Looks ↗' : generating ? '✦  Generating AI look…' : saving ? '✦  Starting generation…' : savedLook?.generationStatus === 'failed' || savedLook?.generationStatus === 'running' ? '✦  Retry AI look' : '✦  Generate AI look'}</Text></Pressable>
          {!savedLook?.generatedImage ? <Pressable onPress={() => { setInstructionDraft(generationInstructions); setInstructionOpen(true); }} style={[s.instructionButton, generationInstructions.trim() && s.instructionButtonActive]} accessibilityLabel="Add instructions for AI look generation">
            <View style={s.instructionCopy}><Text style={s.instructionIcon}>✎</Text><View><Text style={s.instructionTitle}>Generation instructions</Text><Text style={s.instructionHint}>{generationInstructions.trim() ? 'Custom guidance added' : 'Optional details for this look'}</Text></View></View>
            <Text style={s.instructionArrow}>{generationInstructions.trim() ? 'EDIT' : '↗'}</Text>
          </Pressable> : null}
          <Pressable onPress={saveStyle} disabled={saving} style={s.saveStyleButton}><Text style={s.saveStyleText}>{saving ? 'Saving…' : savedLook && styleName.trim() !== savedLook.title ? 'Update style name' : savedLook ? 'View saved style ↗' : '♡  Save this style'}</Text></Pressable>
          <Text style={s.helpText}>{savedLook?.generationStatus === 'failed' ? savedLook.generationError || 'Image generation failed. You can retry.' : savedLook?.generationStatus === 'running' && !generating ? 'Generation took too long. Tap Retry AI look.' : saveMessage || (!bodyPhotoPath ? 'Add your photo, then choose wardrobe pieces to save a style.' : !selections.length ? 'Swap in at least one piece from your wardrobe to save this style.' : selections.length > 2 ? 'This AI model can use up to two wardrobe pieces with your photo. You can still save this style.' : `${selections.length} ${selections.length === 1 ? 'piece' : 'pieces'} selected from your wardrobe. AI generation uses these photos and saves the result with this style.`)}</Text>
        </View>
      </ScrollView>
      <Modal visible={swapOpen} transparent animationType="slide" onRequestClose={() => setSwapOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setSwapOpen(false)} accessibilityLabel="Close wardrobe picker">
          <Pressable style={s.modal} onPress={(event) => event.stopPropagation()}>
          <View style={s.handle} />
          <View style={s.modalHeader}><View><SmallCaps>SWAP A PIECE</SmallCaps><Text style={s.modalTitle}>Your {piece.category.toLowerCase()}</Text></View><Pressable onPress={() => setSwapOpen(false)}><Text style={s.close}>×</Text></Pressable></View>
          {matching.length ? <ScrollView style={{ maxHeight: 380 }}>{matching.map((item) => (
            <Pressable key={item.id} onPress={() => { setChosen((current) => ({ ...current, [active]: item })); setSwapOpen(false); }} style={s.modalItem}>
              <LoadingImage source={{ uri: item.image }} style={s.modalImage} /><View style={{ flex: 1 }}><Text style={s.modalItemName}>{item.name}</Text><Text style={s.modalItemMeta}>{item.color || item.category}{item.brand ? ` · ${item.brand}` : ''}</Text></View><Text style={s.arrow}>↗</Text>
            </Pressable>
          ))}</ScrollView> : <View style={s.empty}><Text style={s.emptyHeading}>Nothing in this category yet.</Text><Text style={s.emptyCopy}>Add a photo of your {piece.category.toLowerCase()} to style it with this look.</Text></View>}
          <Pressable onPress={captureWardrobePiece} style={s.cameraButton} accessibilityLabel={`Take a photo of new ${piece.category.toLowerCase()}`}><Text style={s.cameraButtonText}>◎  Take a photo</Text></Pressable>
          <Pressable onPress={() => { setSwapOpen(false); router.push('/wardrobe' as Href); }} style={s.addButton}><Text style={s.addButtonText}>＋  Add to wardrobe</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={instructionOpen} transparent animationType="slide" onRequestClose={() => setInstructionOpen(false)}>
        <Pressable style={s.instructionBackdrop} onPress={() => setInstructionOpen(false)} accessibilityLabel="Close generation instructions">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.instructionKeyboard}>
            <Pressable style={s.instructionSheet} onPress={(event) => event.stopPropagation()}>
              <View style={s.handle} />
              <View style={s.modalHeader}><View><SmallCaps>DIRECT THE EDIT</SmallCaps><Text style={s.modalTitle}>Your instructions</Text></View><Pressable onPress={() => setInstructionOpen(false)}><Text style={s.close}>×</Text></Pressable></View>
              <Text style={s.instructionDescription}>Describe how the selected pieces should be styled. Your face, skin and body will remain protected.</Text>
              <TextInput value={instructionDraft} onChangeText={setInstructionDraft} multiline maxLength={800} autoFocus placeholder="For example: tuck in the shirt, roll the sleeves twice, and wear the bag over the right shoulder." placeholderTextColor="#A7A7A2" style={s.instructionInput} textAlignVertical="top" accessibilityLabel="Additional AI generation instructions" />
              <Text style={s.instructionCount}>{instructionDraft.length}/800</Text>
              <View style={s.instructionActions}>
                <Pressable onPress={() => { setInstructionDraft(''); setGenerationInstructions(''); setInstructionOpen(false); }} style={s.clearInstruction}><Text style={s.clearInstructionText}>Clear</Text></Pressable>
                <Pressable onPress={() => { setGenerationInstructions(instructionDraft.trim()); setInstructionOpen(false); }} style={s.saveInstruction}><Text style={s.saveInstructionText}>Save instructions</Text></Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
      <PicChangeCarousel visible={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper }, logoutIcon: { width: 22, height: 22, justifyContent: 'center' }, logoutDoor: { position: 'absolute', right: 2, top: 2, width: 2, height: 18, borderRadius: 1, backgroundColor: palette.ink }, logoutArrow: { position: 'absolute', left: 2, top: 10, width: 14, height: 2, borderRadius: 1, backgroundColor: palette.ink }, logoutArrowTop: { position: 'absolute', left: 10, top: 6, width: 2, height: 10, borderRadius: 1, backgroundColor: palette.ink, transform: [{ rotate: '45deg' }] }, logoutArrowBottom: { position: 'absolute', left: 10, top: 10, width: 2, height: 10, borderRadius: 1, backgroundColor: palette.ink, transform: [{ rotate: '-45deg' }] },
  titleRow: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titleInputWrap: { flex: 1, marginRight: 12 }, lookTitle: { fontSize: 23, fontWeight: '500', color: palette.ink, marginTop: 5, letterSpacing: -0.6, minWidth: 160, paddingVertical: 0 }, link: { fontSize: 12, fontWeight: '600', color: palette.olive, paddingVertical: 8 },
  stage: { marginHorizontal: 13, borderRadius: 28, backgroundColor: '#F7F7F5', overflow: 'hidden' }, model: { width: '100%', height: '100%' },
  stageLabel: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: '#FFFFFFDD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stageLabelText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.7, color: palette.muted },
  piece: { position: 'absolute', width: 64, height: 86, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, borderWidth: 1.5, borderColor: '#fff' },
  pieceActive: { borderColor: palette.ink }, pieceImage: { width: 55, height: 55, borderRadius: 10 },
  emptyWrap: { alignItems: 'center' }, emptyPieceLabel: { color: palette.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, textTransform: 'uppercase' },
  emptyPiece: { width: 55, height: 55, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C9CBC3', backgroundColor: '#F7F8F4', alignItems: 'center', justifyContent: 'center' },
  emptyPieceLarge: { width: 74, height: 74 }, emptyPieceIcon: { fontSize: 18, color: palette.muted, lineHeight: 22 }, emptyPieceIconLarge: { fontSize: 23 },
  emptyPieceText: { fontSize: 7, fontWeight: '700', letterSpacing: 0.3, color: palette.muted, textAlign: 'center' }, emptyPieceTextLarge: { fontSize: 7 },
  changePhoto: { position: 'absolute', bottom: 14, right: 14, backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }, changePhotoText: { fontSize: 11, fontWeight: '600', color: palette.ink },
  details: { marginHorizontal: 24, paddingTop: 20 },
  generateButton: { backgroundColor: palette.olive, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  generateDisabled: { opacity: 0.55 }, generateText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  instructionButton: { borderWidth: 1, borderColor: palette.line, borderRadius: 16, minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#fff' },
  instructionButtonActive: { borderColor: palette.olive, backgroundColor: '#F7F8F4' }, instructionCopy: { flexDirection: 'row', alignItems: 'center', gap: 12 }, instructionIcon: { fontSize: 20, color: palette.ink },
  instructionTitle: { color: palette.ink, fontSize: 13, fontWeight: '700' }, instructionHint: { color: palette.muted, fontSize: 10, marginTop: 3 }, instructionArrow: { color: palette.olive, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  saveStyleButton: { borderColor: palette.ink, borderWidth: 1, borderRadius: 16, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveStyleText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  helpText: { textAlign: 'center', color: palette.muted, fontSize: 11, marginTop: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, modal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38 },
  handle: { alignSelf: 'center', width: 34, height: 4, borderRadius: 3, backgroundColor: '#D9D9D5', marginBottom: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }, modalTitle: { fontSize: 26, fontWeight: '600', color: palette.ink, marginTop: 5 }, close: { fontSize: 27, color: palette.ink },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.line, gap: 14 }, modalImage: { width: 62, height: 62, borderRadius: 12, backgroundColor: palette.canvas },
  modalItemName: { fontSize: 15, fontWeight: '600', color: palette.ink }, modalItemMeta: { fontSize: 12, color: palette.muted, marginTop: 4 }, arrow: { fontSize: 18, color: palette.ink },
  empty: { paddingVertical: 32, alignItems: 'center' }, emptyHeading: { fontSize: 16, fontWeight: '600', color: palette.ink }, emptyCopy: { fontSize: 13, color: palette.muted, textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 250 },
  cameraButton: { backgroundColor: palette.ink, borderRadius: 16, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, cameraButtonText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  addButton: { borderWidth: 1, borderColor: palette.line, borderRadius: 16, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, addButtonText: { fontSize: 13, color: palette.ink, fontWeight: '600' },
  instructionBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, instructionKeyboard: { justifyContent: 'flex-end' }, instructionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38 },
  instructionDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: -5, marginBottom: 16, maxWidth: 330 }, instructionInput: { minHeight: 150, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 15, color: palette.ink, fontSize: 14, lineHeight: 21, backgroundColor: palette.canvas }, instructionCount: { color: palette.muted, fontSize: 10, textAlign: 'right', marginTop: 7 },
  instructionActions: { flexDirection: 'row', gap: 10, marginTop: 18 }, clearInstruction: { width: 86, height: 50, borderRadius: 15, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' }, clearInstructionText: { color: palette.muted, fontSize: 12, fontWeight: '700' }, saveInstruction: { flex: 1, height: 50, borderRadius: 15, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, saveInstructionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
