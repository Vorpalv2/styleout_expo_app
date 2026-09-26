import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useClerk } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ActionButton, AppHeader, radii, RoundAction, samplePieces, SmallCaps } from '@/components/StyleoutUI';
import { ThemeColors, useStyleoutTheme } from '@/components/StyleoutTheme';
import { LoadingImage } from '@/components/LoadingImage';
import { PicChangeCarousel } from '@/components/PicChangeCarousel';
import { ClosetRefreshControl } from '@/components/ClosetRefreshControl';
import { useToast } from '@/components/Toast';
import { OnboardingTour } from '@/components/OnboardingTour';
import { ClosetItem, lookSignature, takePhoto, useCloset } from '@/lib/closet';
import { DEFAULT_IMAGE_GENERATION_MODEL, IMAGE_GENERATION_MODELS, maxWardrobeItemsForModel } from '@/lib/imageModels';

const lookImage = require('../../assets/styleout/look.png');
type Styles = ReturnType<typeof makeStyles>;
function EmptyPiece({ large = false, label, styles: s }: { large?: boolean; label?: string; styles: Styles }) {
  return <View style={s.emptyWrap}><View style={[s.emptyPiece, large && s.emptyPieceLarge]}><Text style={[s.emptyPieceIcon, large && s.emptyPieceIconLarge]}>＋</Text><Text style={[s.emptyPieceText, large && s.emptyPieceTextLarge]}>NO ITEMS{large ? ' SELECTED' : '\nSELECTED'}</Text></View>{label ? <Text style={s.emptyPieceLabel}>{label}</Text> : null}</View>;
}
function LogoutIcon({ styles: s }: { styles: Styles }) {
  return <View style={s.logoutIcon} accessibilityElementsHidden>
    <View style={s.logoutDoor} />
    {/*<View style={s.logoutArrow} />*/}
    <View style={s.logoutArrowTop} />
    <View style={s.logoutArrowBottom} />
  </View>;
}

export default function StyleScreen() {
  const router = useRouter();
  const { colors: palette } = useStyleoutTheme();
  const { showToast } = useToast();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const { height } = useWindowDimensions();
  const { signOut } = useClerk();
  const { bodyPhoto, bodyPhotoPath, items, savedLooks, saveLook, generateLook, updateLookTitle,
    updateLookBackgroundBlur, beginWardrobeDraft, pendingStyleSelection, clearPendingStyleSelection,
    imageGenerationModel, setImageGenerationModel, hasAiGatewayKey, saveAiGatewayKey, onboardingLoaded, onboardingComplete, onboardingReplayRequested, completeOnboarding } = useCloset();
  const [styleName, setStyleName] = useState('');
  const [active, setActive] = useState(1);
  const [swapOpen, setSwapOpen] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [gatewayKeyModalOpen, setGatewayKeyModalOpen] = useState(false);
  const [gatewayKeyDraft, setGatewayKeyDraft] = useState('');
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [savingGatewayKey, setSavingGatewayKey] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [generationInstructions, setGenerationInstructions] = useState('');
  const [instructionDraft, setInstructionDraft] = useState('');
  const [backgroundBlur, setBackgroundBlur] = useState(false);
  const [chosen, setChosen] = useState<Record<number, ClosetItem>>({});
  const [saving, setSaving] = useState(false);
  const [generationRequestStartedAt, setGenerationRequestStartedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [reveal, setReveal] = useState(50);
  const revealRef = useRef(reveal);
  const dragStartRef = useRef(reveal);
  const widthRef = useRef(stageWidth);
  const hasGeneratedRef = useRef(false);
  revealRef.current = reveal;
  widthRef.current = stageWidth;
  const stageHeight = Math.min(510, Math.max(400, height * 0.56));
  const piece = samplePieces[active];
  const matching = items.filter((item) => item.category === piece.category);
  const selectedNames = samplePieces.map((_, i) => items.find((item) => item.id === chosen[i]?.id)?.name).filter((name): name is string => !!name);
  const selections = Object.entries(chosen).map(([slotIndex, item]) => ({ slotIndex: Number(slotIndex), itemId: item.id }));
  const selectedCategories = selections.map(({ itemId }) => items.find((item) => item.id === itemId)?.category).filter((category): category is ClosetItem['category'] => !!category);
  const savedLook = savedLooks.find((look) => look.signature === lookSignature(bodyPhotoPath, selections));
  const generatedImage = savedLook?.generatedImage || null;
  const selectedImageModel = IMAGE_GENERATION_MODELS.find((model) => model.id === imageGenerationModel) || IMAGE_GENERATION_MODELS[0];
  hasGeneratedRef.current = !!generatedImage;
  const generating = savedLook?.generationStatus === 'running' && (!savedLook.generationStartedAt || Date.now() - savedLook.generationStartedAt < 150000);
  const generationClockStartedAt = generationRequestStartedAt ?? savedLook?.generationStartedAt ?? clockNow;
  const generationElapsedSeconds = Math.max(0, Math.floor((clockNow - generationClockStartedAt) / 1000));
  const generateLabel = generatedImage ? 'Regenerate' : generating ? 'Generating' : saving ? 'Starting' : savedLook?.generationStatus === 'failed' || savedLook?.generationStatus === 'running' ? 'Retry' : 'Generate';
  const saveLabel = saving ? 'Saving' : savedLook && styleName.trim() !== savedLook.title ? 'Update' : savedLook ? 'Saved looks' : 'Save look';
  useEffect(() => { if (savedLook) { setStyleName(savedLook.title); setBackgroundBlur(savedLook.backgroundBlur); } }, [savedLook?.id]);
  useEffect(() => {
    if (!generating) return;
    setClockNow(Date.now());
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [generating]);
  useEffect(() => {
    if (!generating && !saving && generationRequestStartedAt !== null) setGenerationRequestStartedAt(null);
  }, [generating, saving, generationRequestStartedAt]);
  useEffect(() => { setReveal(50); }, [generatedImage]);
  useFocusEffect(useCallback(() => {
    if (!onboardingLoaded || onboardingComplete) return;
    setTourVisible(true);
  }, [onboardingLoaded, onboardingComplete, onboardingReplayRequested]));
  const dividerPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => hasGeneratedRef.current,
    onMoveShouldSetPanResponder: (_, gesture) => hasGeneratedRef.current && Math.abs(gesture.dx) > 2,
    onPanResponderGrant: () => { dragStartRef.current = revealRef.current; },
    onPanResponderMove: (_, gesture) => {
      const width = widthRef.current;
      if (width > 0) setReveal(Math.max(0, Math.min(100, dragStartRef.current + gesture.dx / width * 100)));
    },
  }), []);
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
          showToast('Style name updated.');
        } else router.push('/profile' as Href);
      } else {
        await saveLook(styleName, selections, selectedNames, backgroundBlur);
        showToast('Style saved with your selected wardrobe pieces.');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setSaveMessage(detail); Alert.alert('Could not save style', detail);
    } finally { setSaving(false); }
  }
  async function generateStyle() {
    if (saving || generating) return;
    const title = styleName.trim();
    if (!title) { const detail = 'Name your style before generating it.'; setSaveMessage(detail); showToast(detail, 'error'); return; }
    const maxWardrobeItems = maxWardrobeItemsForModel(imageGenerationModel);
    if (selections.length > maxWardrobeItems) {
      const detail = `${selectedImageModel.name} accepts your photo plus up to ${maxWardrobeItems} wardrobe pieces. Remove ${selections.length - maxWardrobeItems} selected ${selections.length - maxWardrobeItems === 1 ? 'piece' : 'pieces'} and try again.`;
      setSaveMessage(detail); showToast(detail, 'error'); return;
    }
    setSaving(true); setSaveMessage(null); setGenerationRequestStartedAt(Date.now()); setClockNow(Date.now());
    try {
      let id = savedLook?.id;
      if (id && title !== savedLook?.title) await updateLookTitle(id, title);
      if (!id) id = await saveLook(title, selections, selectedNames, backgroundBlur);
      await generateLook(id, generationInstructions, backgroundBlur, !!savedLook?.generatedImage);
      setSaveMessage(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setSaveMessage(detail); showToast(detail, 'error');
    } finally { setSaving(false); }
  }
  async function changeBackgroundBlur(value: boolean) {
    const previous = backgroundBlur;
    setBackgroundBlur(value);
    if (!savedLook) return;
    try { await updateLookBackgroundBlur(savedLook.id, value); }
    catch (error) {
      setBackgroundBlur(previous);
      Alert.alert('Could not save setting', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 25 }} showsVerticalScrollIndicator={false} alwaysBounceVertical refreshControl={Platform.OS === 'web' ? undefined : <ClosetRefreshControl />}>
        <AppHeader eyebrow="YOUR DIGITAL DRESSING ROOM" title="Styleout" right={<RoundAction label="Sign out" onPress={leaveAccount}><LogoutIcon styles={s} /></RoundAction>} />
        <View style={s.titleRow}>
          <View style={s.titleInputWrap}><SmallCaps>YOUR STYLE NAME</SmallCaps><TextInput value={styleName} onChangeText={setStyleName} placeholder="Name this style" placeholderTextColor={palette.muted} style={s.lookTitle} maxLength={60} accessibilityLabel="Style name" /></View>
          <Pressable onPress={changePhoto}><Text style={s.link}>Use my photo ↗</Text></Pressable>
        </View>
        <View style={[s.stage, { height: stageHeight }]} onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}>
          <LoadingImage source={bodyPhoto ? { uri: bodyPhoto } : lookImage} resizeMode="contain" style={s.model} />
          {generatedImage && stageWidth > 0 ? <>
            <View pointerEvents="none" style={[s.comparisonClip, { left: stageWidth * reveal / 100, width: stageWidth * (1 - reveal / 100), height: stageHeight }]}>
              <LoadingImage source={{ uri: generatedImage }} resizeMode="contain" style={{ width: stageWidth, height: stageHeight, position: 'absolute', left: -stageWidth * reveal / 100, top: 0 }} />
            </View>
            <View pointerEvents="none" style={[s.comparisonLabels, { width: stageWidth }]}><Text style={s.comparisonLabel}>ORIGINAL</Text><Text style={s.comparisonLabel}>AI LOOK</Text></View>
            <View {...dividerPan.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Drag to compare original and AI generated image" style={[s.comparisonHandle, { left: stageWidth * reveal / 100 - 22, height: stageHeight }]}>
              <View style={s.comparisonRule} /><View style={s.comparisonKnob}><Text style={s.comparisonArrows}>↔</Text></View>
            </View>
          </> : null}
          {samplePieces.map((item, i) => {
            const selected = items.find((entry) => entry.id === chosen[i]?.id);
            return (
              <View key={item.name} style={[s.piecePosition, { top: stageHeight * (0.11 + (i % 3) * 0.30), [i < 3 ? 'left' : 'right']: 12 }]}>
                <Pressable accessibilityLabel={`Choose ${selected?.name || item.category} from wardrobe`} onPress={() => { setActive(i); setSwapOpen(true); }}
                  style={[s.piece, active === i && s.pieceActive]}>
                  {selected ? <LoadingImage source={{ uri: selected.image }} style={s.pieceImage} /> : <EmptyPiece styles={s} label={item.category} />}
                </Pressable>
                {selected ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${selected.name} from style`} hitSlop={8} onPress={() => {
                  setChosen((current) => {
                    const next = { ...current };
                    delete next[i];
                    return next;
                  });
                }} style={s.removePiece}>
                  <Text style={s.removePieceText}>×</Text>
                </Pressable> : null}
              </View>
            );
          })}
          <Pressable onPress={changePhoto} style={s.changePhoto}><Text style={s.changePhotoText}>↗  Change photo</Text></Pressable>
        </View>
      <View style={s.details}>
          <View style={s.modelPickerBlock}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Image model: ${selectedImageModel.name}. Choose a model.`} onPress={() => setModelPickerOpen(true)} style={({ pressed }) => [s.modelPicker, pressed && s.actionPressed]}>
              <SmallCaps style={s.modelPickerLabel}>AI MODEL</SmallCaps><Text numberOfLines={1} style={s.modelPickerName}>{selectedImageModel.name}</Text><Text style={s.modelPickerChevron}>⌄</Text>
            </Pressable>
          </View>
          <View style={s.actionDock}>
            <Pressable accessibilityLabel="Add instructions for AI look generation" onPress={() => { setInstructionDraft(generationInstructions); setInstructionOpen(true); }} style={({ pressed }) => [s.actionItem, pressed && s.actionPressed]}>
              <View><Text style={[s.actionIcon, generationInstructions.trim() && s.actionActive]}>✎</Text>{generationInstructions.trim() ? <View style={s.actionDot} /> : null}</View>
              <Text style={[s.actionLabel, generationInstructions.trim() && s.actionActive]}>Instructions</Text>
            </Pressable>
            <View style={s.actionDivider} />
            <Pressable accessibilityLabel={`${generateLabel} AI look`} onPress={generateStyle} disabled={saving || generating} style={({ pressed }) => [s.actionItem, s.actionPrimary, pressed && s.actionPressed, (saving || generating) && s.actionDisabled]}>
              <Text style={[s.actionIcon, s.actionPrimaryIcon]}>✦</Text>
              <Text style={[s.actionLabel, s.actionPrimaryLabel]}>{generateLabel}</Text>
            </Pressable>
            <View style={s.actionDivider} />
            <Pressable accessibilityLabel={savedLook ? saveLabel : 'Save this style'} onPress={saveStyle} disabled={saving} style={({ pressed }) => [s.actionItem, pressed && s.actionPressed, saving && s.actionDisabled]}>
              <Text style={s.actionIcon}>{savedLook ? '✓' : '♡'}</Text>
              <Text style={s.actionLabel}>{saveLabel}</Text>
            </Pressable>
            <View style={s.actionDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Background blur ${backgroundBlur ? 'on' : 'off'}`} accessibilityState={{ selected: backgroundBlur }} onPress={() => { void changeBackgroundBlur(!backgroundBlur); }} style={({ pressed }) => [s.actionItem, pressed && s.actionPressed]}>
              <Text style={[s.actionIcon, backgroundBlur && s.actionActive]}>{backgroundBlur ? '◉' : '◎'}</Text>
              <Text style={[s.actionLabel, backgroundBlur && s.actionActive]}>Blur</Text>
            </Pressable>
          </View>
          <Text style={s.helpText}>{savedLook?.generationStatus === 'failed' ? savedLook.generationError || 'Image generation failed. You can retry.' : savedLook?.generationStatus === 'running' && !generating ? 'Generation took too long. Tap Retry AI look.' : saveMessage || (!bodyPhotoPath ? 'Add your photo, then choose wardrobe pieces to save a style.' : !selections.length ? 'Swap in at least one piece from your wardrobe to save a style.' : selections.length > maxWardrobeItemsForModel(imageGenerationModel) ? `You can save all selected pieces, but ${selectedImageModel.name} accepts your photo plus up to ${maxWardrobeItemsForModel(imageGenerationModel)} wardrobe pieces.` : selectedCategories.includes('Tops') && selectedCategories.includes('Outerwear') ? 'Your AI try-on will layer the selected top under your outerwear.' : `${selections.length} ${selections.length === 1 ? 'piece' : 'pieces'} selected. ${selectedImageModel.name} supports up to ${maxWardrobeItemsForModel(imageGenerationModel)} wardrobe pieces with your photo.`)}</Text>
        </View>
      </ScrollView>
      <OnboardingTour visible={tourVisible} onFinish={() => { setTourVisible(false); void completeOnboarding(); }} />
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
          <ActionButton onPress={captureWardrobePiece} label="◎  Take a photo" style={s.cameraButton} />
          <ActionButton onPress={() => { setSwapOpen(false); router.push('/wardrobe' as Href); }} label="＋  Add to wardrobe" tone="outline" style={s.addButton} />
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
                <ActionButton onPress={() => { setInstructionDraft(''); setGenerationInstructions(''); setInstructionOpen(false); }} label="Clear" tone="outline" style={s.clearInstruction} labelStyle={{ color: palette.muted }} />
                <ActionButton onPress={() => { setGenerationInstructions(instructionDraft.trim()); setInstructionOpen(false); }} label="Save instructions" style={s.saveInstruction} />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
      <Modal visible={modelPickerOpen} transparent animationType="slide" onRequestClose={() => setModelPickerOpen(false)}>
        <Pressable style={s.modelBackdrop} onPress={() => setModelPickerOpen(false)} accessibilityLabel="Close image model picker">
          <Pressable style={s.modelSheet} onPress={(event) => event.stopPropagation()}>
            <View style={s.handle} />
            <View style={s.modalHeader}><View><SmallCaps>AI GATEWAY</SmallCaps><Text style={s.modalTitle}>Choose a model</Text></View><Pressable onPress={() => setModelPickerOpen(false)} accessibilityLabel="Close model picker"><Text style={s.close}>×</Text></Pressable></View>
            <Text style={s.modelPickerDescription}>Each generation uses your Vercel AI Gateway credits. Rates and image limits vary by model.</Text>
            <ScrollView style={s.modelList} showsVerticalScrollIndicator={false}>
              {IMAGE_GENERATION_MODELS.map((model) => {
                const selected = imageGenerationModel === model.id;
                const locked = model.id !== DEFAULT_IMAGE_GENERATION_MODEL && !hasAiGatewayKey;
                return <Pressable key={model.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: locked }} onPress={() => {
                  if (locked) { setPendingModel(model.id); setGatewayKeyDraft(''); setModelPickerOpen(false); setGatewayKeyModalOpen(true); return; }
                  setImageGenerationModel(model.id); setModelPickerOpen(false);
                }} style={[s.modelOption, selected && s.modelOptionSelected, locked && s.modelOptionLocked]}>
                  <View style={{ flex: 1 }}><Text style={[s.modelOptionName, locked && s.modelOptionNameLocked]}>{model.name}</Text><Text style={s.modelOptionDetail}>{model.detail}</Text>{locked ? <Text style={s.modelKeyRequired}>Your AI Gateway key is required to use this model.</Text> : null}</View>
                  <Text style={[s.modelOptionCheck, selected && s.modelOptionCheckSelected]}>{selected ? '✓' : ''}</Text>
                </Pressable>;
              })}
            </ScrollView>
            <Text style={s.modelCostNote}>Model access and current rates are managed in your AI Gateway account.</Text>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={gatewayKeyModalOpen} transparent animationType="fade" onRequestClose={() => setGatewayKeyModalOpen(false)}>
        <Pressable style={s.modelBackdrop} onPress={() => { if (!savingGatewayKey) setGatewayKeyModalOpen(false); }} accessibilityLabel="Close AI Gateway key dialog">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.keyDialogWrap}>
            <Pressable style={s.keyDialog} onPress={(event) => event.stopPropagation()}>
              <View style={s.modalHeader}><View><SmallCaps>UNLOCK A MODEL</SmallCaps><Text style={s.modalTitle}>Add your Gateway key</Text></View><Pressable disabled={savingGatewayKey} onPress={() => setGatewayKeyModalOpen(false)} accessibilityLabel="Close key dialog"><Text style={s.close}>×</Text></Pressable></View>
              <Text style={s.keyDialogCopy}>Your key is stored encrypted in Supabase and used only when generating with {IMAGE_GENERATION_MODELS.find((model) => model.id === pendingModel)?.name || 'this model'}. The default model continues to use Styleout’s built-in key.</Text>
              <TextInput value={gatewayKeyDraft} onChangeText={setGatewayKeyDraft} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry placeholder="Vercel AI Gateway API key" placeholderTextColor="#A7A7A2" style={s.keyInput} accessibilityLabel="Your Vercel AI Gateway API key" />
              <ActionButton disabled={savingGatewayKey || gatewayKeyDraft.trim().length < 20} onPress={async () => {
                setSavingGatewayKey(true);
                try {
                  await saveAiGatewayKey(gatewayKeyDraft);
                  if (pendingModel) setImageGenerationModel(pendingModel as typeof imageGenerationModel);
                  setGatewayKeyModalOpen(false);
                  setGatewayKeyDraft('');
                  showToast('Your AI Gateway key is saved securely.');
                } catch (error) { showToast(error instanceof Error ? error.message : 'Could not save your key.', 'error'); }
                finally { setSavingGatewayKey(false); }
      }} label={savingGatewayKey ? 'Saving securely…' : 'Save key & unlock model'} style={s.keySaveButton} />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
      <Modal visible={generating} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
        <View style={s.generationBackdrop} accessibilityViewIsModal accessibilityLabel="Image generating">
          <View style={s.generationCard}>
            <View style={s.generationSpinner}><ActivityIndicator size="large" color={palette.olive} /></View>
            <SmallCaps>STYLEOUT AI STUDIO</SmallCaps>
            <Text style={s.generationTitle}>Image generating</Text>
            <Text style={s.generationCopy}>Please wait while we create your look.</Text>
            <Text accessibilityLiveRegion="polite" style={s.generationTimer}>{generationElapsedSeconds}<Text style={s.generationTimerUnit}> sec</Text></Text>
            <Text style={s.generationElapsedLabel}>ELAPSED</Text>
          </View>
        </View>
      </Modal>
      <PicChangeCarousel visible={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)} />
    </View>
  );
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper }, logoutIcon: { width: 22, height: 22, justifyContent: 'center' }, logoutDoor: { position: 'absolute', right: 2, top: 2, width: 2, height: 18, borderRadius: 1, backgroundColor: palette.ink }, logoutArrow: { position: 'absolute', left: 2, top: 10, width: 14, height: 2, borderRadius: 1, backgroundColor: palette.ink }, logoutArrowTop: { position: 'absolute', left: 10, top: 6, width: 2, height: 10, borderRadius: 1, backgroundColor: palette.ink, transform: [{ rotate: '45deg' }] }, logoutArrowBottom: { position: 'absolute', left: 10, top: 10, width: 2, height: 10, borderRadius: 1, backgroundColor: palette.ink, transform: [{ rotate: '-45deg' }] },
  titleRow: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titleInputWrap: { flex: 1, marginRight: 12 }, lookTitle: { fontSize: 23, fontWeight: '500', color: palette.ink, marginTop: 5, letterSpacing: -0.6, minWidth: 160, paddingVertical: 0 }, link: { fontSize: 12, fontWeight: '600', color: palette.olive, paddingVertical: 8 },
  stage: { marginHorizontal: 13, borderRadius: radii.stage, backgroundColor: palette.canvas, overflow: 'hidden' }, model: { width: '100%', height: '100%' },
  comparisonClip: { position: 'absolute', top: 0, overflow: 'hidden' }, comparisonLabels: { position: 'absolute', top: 12, left: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 9 }, comparisonLabel: { color: '#fff', backgroundColor: '#111A', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, comparisonHandle: { position: 'absolute', top: 0, width: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 10 }, comparisonRule: { position: 'absolute', width: 2, height: '100%', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4 }, comparisonKnob: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.olive, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 }, comparisonArrows: { color: palette.ink, fontSize: 19, fontWeight: '700' },
  piecePosition: { position: 'absolute', width: 64, height: 86 },
  piece: { width: '100%', height: '100%', borderRadius: 15, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, borderWidth: 1.5, borderColor: palette.surface },
  pieceActive: { borderColor: palette.ink }, pieceImage: { width: 55, height: 55, borderRadius: 10 },
  removePiece: { position: 'absolute', top: -7, right: -7, width: 23, height: 23, borderRadius: 12, backgroundColor: palette.ink, borderWidth: 2, borderColor: palette.paper, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  removePieceText: { color: palette.paper, fontSize: 17, fontWeight: '600', lineHeight: 19, marginTop: -1 },
  emptyWrap: { alignItems: 'center' }, emptyPieceLabel: { color: palette.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, textTransform: 'uppercase' },
  emptyPiece: { width: 55, height: 55, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.line, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  emptyPieceLarge: { width: 74, height: 74 }, emptyPieceIcon: { fontSize: 18, color: palette.muted, lineHeight: 22 }, emptyPieceIconLarge: { fontSize: 23 },
  emptyPieceText: { fontSize: 7, fontWeight: '700', letterSpacing: 0.3, color: palette.muted, textAlign: 'center' }, emptyPieceTextLarge: { fontSize: 7 },
  changePhoto: { position: 'absolute', bottom: 14, right: 14, backgroundColor: palette.surface, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }, changePhotoText: { fontSize: 11, fontWeight: '600', color: palette.ink },
  details: { marginHorizontal: 24, paddingTop: 8 },
  modelPickerBlock: { marginBottom: 8 }, modelPicker: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: palette.line, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.surface }, modelPickerLabel: { fontSize: 9, letterSpacing: 1.3 }, modelPickerName: { flex: 1, color: palette.ink, fontSize: 12, fontWeight: '700' }, modelPickerChevron: { color: palette.ink, fontSize: 20, paddingHorizontal: 4, lineHeight: 23 },
  modelBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, modelSheet: { maxHeight: '82%', backgroundColor: palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 30 }, modelPickerDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 12 }, modelList: { flexGrow: 0 }, modelOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.line, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8, backgroundColor: palette.surface }, modelOptionSelected: { borderColor: palette.olive, backgroundColor: palette.oliveWash }, modelOptionLocked: { opacity: 0.55 }, modelOptionName: { color: palette.ink, fontSize: 13, fontWeight: '700' }, modelOptionNameLocked: { color: palette.muted }, modelOptionDetail: { color: palette.muted, fontSize: 11, marginTop: 4 }, modelKeyRequired: { color: palette.olive, fontSize: 10, fontWeight: '600', marginTop: 5 }, modelOptionCheck: { width: 22, height: 22, textAlign: 'center', overflow: 'hidden', color: palette.paper, backgroundColor: palette.line, borderRadius: 11, fontSize: 14, lineHeight: 22, fontWeight: '800' }, modelOptionCheckSelected: { backgroundColor: palette.olive }, modelCostNote: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  generationBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 16, 14, 0.56)' }, generationCard: { width: '100%', maxWidth: 360, alignItems: 'center', paddingHorizontal: 28, paddingVertical: 32, borderRadius: 26, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 14 }, generationSpinner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.oliveWash, marginBottom: 21 }, generationTitle: { color: palette.ink, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 8 }, generationCopy: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 }, generationTimer: { color: palette.ink, fontSize: 46, lineHeight: 54, fontWeight: '800', letterSpacing: -1.8, marginTop: 22, fontVariant: ['tabular-nums'] }, generationTimerUnit: { color: palette.olive, fontSize: 22, letterSpacing: -0.4 }, generationElapsedLabel: { color: palette.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.7, marginTop: 0 },
  keyDialogWrap: { flex: 1, justifyContent: 'center', padding: 22 }, keyDialog: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 22, borderRadius: 24, backgroundColor: palette.paper }, keyDialogCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 18 }, keyInput: { height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.line, borderRadius: 13, color: palette.ink, backgroundColor: palette.surface, marginBottom: 14 }, keySaveButton: { marginTop: 4 },
  actionDock: { minHeight: 78, flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: palette.line, borderRadius: 19, overflow: 'hidden', backgroundColor: palette.surface },
  actionItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 3, paddingVertical: 10 },
  actionPrimary: { backgroundColor: palette.oliveWash }, actionPressed: { opacity: 0.68 }, actionDisabled: { opacity: 0.45 },
  actionDivider: { width: 1, height: 42, alignSelf: 'center', backgroundColor: palette.line },
  actionIcon: { color: palette.ink, fontSize: 21, lineHeight: 23, fontWeight: '500' }, actionPrimaryIcon: { color: palette.olive },
  actionLabel: { color: palette.ink, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.15, textAlign: 'center' }, actionPrimaryLabel: { color: palette.olive }, actionActive: { color: palette.olive },
  actionDot: { position: 'absolute', right: -5, top: -1, width: 5, height: 5, borderRadius: 3, backgroundColor: palette.olive },
  helpText: { textAlign: 'center', color: palette.muted, fontSize: 11, marginTop: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, modal: { backgroundColor: palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38 },
  handle: { alignSelf: 'center', width: 34, height: 4, borderRadius: 3, backgroundColor: '#D9D9D5', marginBottom: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }, modalTitle: { fontSize: 26, fontWeight: '600', color: palette.ink, marginTop: 5 }, close: { fontSize: 27, color: palette.ink },
  modalItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.line, gap: 14 }, modalImage: { width: 62, height: 62, borderRadius: 12, backgroundColor: palette.canvas },
  modalItemName: { fontSize: 15, fontWeight: '600', color: palette.ink }, modalItemMeta: { fontSize: 12, color: palette.muted, marginTop: 4 }, arrow: { fontSize: 18, color: palette.ink },
  empty: { paddingVertical: 32, alignItems: 'center' }, emptyHeading: { fontSize: 16, fontWeight: '600', color: palette.ink }, emptyCopy: { fontSize: 13, color: palette.muted, textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 250 },
  cameraButton: { marginTop: 18 },
  addButton: { marginTop: 10 },
  instructionBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, instructionKeyboard: { justifyContent: 'flex-end' }, instructionSheet: { backgroundColor: palette.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 38 },
  instructionDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: -5, marginBottom: 16, maxWidth: 330 }, instructionInput: { minHeight: 150, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 15, color: palette.ink, fontSize: 14, lineHeight: 21, backgroundColor: palette.canvas }, instructionCount: { color: palette.muted, fontSize: 10, textAlign: 'right', marginTop: 7 },
  instructionActions: { flexDirection: 'row', gap: 10, marginTop: 18 }, clearInstruction: { width: 86 }, clearInstructionText: { color: palette.muted, fontSize: 12, fontWeight: '700' }, saveInstruction: { flex: 1 }, saveInstructionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
