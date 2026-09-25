import { useClerk, useUser } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, AppHeader, radii, RoundAction, SmallCaps } from '@/components/StyleoutUI';
import { ThemeColors, ThemePreference, useStyleoutTheme } from '@/components/StyleoutTheme';
import { PicChangeCarousel } from '@/components/PicChangeCarousel';
import { LoadingImage } from '@/components/LoadingImage';
import { InstagramImport } from '@/components/InstagramImport';
import { ClosetRefreshControl } from '@/components/ClosetRefreshControl';
import { useToast } from '@/components/Toast';
import { CATEGORIES, SavedLook, useCloset } from '@/lib/closet';
import { IMAGE_GENERATION_MODELS, maxWardrobeItemsForModel } from '@/lib/imageModels';
import { downloadImage } from '@/lib/saveImage';

const lookImage = require('../../assets/styleout/look.png');

export default function ProfileScreen() {
  const router = useRouter();
  const { colors: palette, isDark, preference, setPreference } = useStyleoutTheme();
  const { showToast } = useToast();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { signOut } = useClerk();
  const { items, name, bio, bodyPhoto, savedLooks, generateLook, imageGenerationModel, removeLook, previousWardrobeAvailable, importPreviousWardrobe, updateProfile, replayOnboarding, deleteAccount, hasAiGatewayKey, saveAiGatewayKey, removeAiGatewayKey } = useCloset();
  const [profileTab, setProfileTab] = useState<'profile' | 'ai-key'>('profile');
  const [gatewayKeyDraft, setGatewayKeyDraft] = useState('');
  const [savingGatewayKey, setSavingGatewayKey] = useState(false);
  const [removingGatewayKey, setRemovingGatewayKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio);
  const [signingOut, setSigningOut] = useState(false);
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [startingGeneration, setStartingGeneration] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [wardrobeExpanded, setWardrobeExpanded] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const openLook = selectedLook ? savedLooks.find((look) => look.id === selectedLook.id) || selectedLook : null;
  const fullscreenImage = openLook?.generatedImage || openLook?.image || null;
  const selectedImageModel = IMAGE_GENERATION_MODELS.find((model) => model.id === imageGenerationModel) || IMAGE_GENERATION_MODELS[0];
  const displayName = name === 'Your profile' ? (user?.fullName || user?.firstName || 'Your profile') : name;

  function beginEdit() { setDraftName(name); setDraftBio(bio); setEditing(true); }
  function changePhoto() { setPhotoPickerOpen(true); }
  async function replayTour() {
    await replayOnboarding();
    router.navigate('/' as Href);
  }
  async function saveProfile() {
    try { await updateProfile(draftName.trim() || 'Your profile', draftBio.trim() || 'A wardrobe that feels like you.'); setEditing(false); showToast('Profile updated.'); }
    catch { Alert.alert('Save failed', 'Your profile could not be updated. Please try again.'); }
  }
  async function leaveAccount() {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); }
    catch { Alert.alert('Sign-out failed', 'Please try again.'); setSigningOut(false); }
  }
  async function permanentlyDeleteAccount() {
    if (deleteConfirmation !== 'DELETE' || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      setDeleteAccountOpen(false);
      await signOut().catch(() => {});
      router.replace('/sign-in' as Href);
    } catch (error) {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  }
  async function bringPreviousWardrobe() {
    try { await importPreviousWardrobe(); }
    catch { Alert.alert('Import failed', 'Your previous wardrobe could not be read on this device.'); }
  }
  async function saveGatewayKey() {
    if (gatewayKeyDraft.trim().length < 20 || savingGatewayKey) return;
    setSavingGatewayKey(true);
    try { await saveAiGatewayKey(gatewayKeyDraft); setGatewayKeyDraft(''); showToast('Your AI Gateway key is saved securely.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not save your key.', 'error'); }
    finally { setSavingGatewayKey(false); }
  }
  async function removeGatewayKey() {
    if (removingGatewayKey) return;
    setRemovingGatewayKey(true);
    try { await removeAiGatewayKey(); setGatewayKeyDraft(''); showToast('Your personal AI Gateway key was removed.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Could not remove your key.', 'error'); }
    finally { setRemovingGatewayKey(false); }
  }
  async function deleteSavedLook() {
    if (!selectedLook) return;
    try { await removeLook(selectedLook.id); setSelectedLook(null); showToast('Saved style removed.', 'info'); }
    catch { Alert.alert('Remove failed', 'This saved style could not be removed. Please try again.'); }
  }
  async function retrySavedLook() {
    if (!openLook || startingGeneration) return;
    setStartingGeneration(true);
    try { await generateLook(openLook.id, '', openLook.backgroundBlur); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Generation failed. Please try again.', 'error'); }
    finally { setStartingGeneration(false); }
  }
  async function downloadLookImage() {
    if (!fullscreenImage) return;
    try {
      await downloadImage(fullscreenImage, openLook?.title || 'styleout-look');
      showToast('AI look downloaded to your device.');
    } catch { showToast('Download unavailable. Please try again.', 'error'); }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} alwaysBounceVertical refreshControl={Platform.OS === 'web' ? undefined : <ClosetRefreshControl />}>
        <AppHeader eyebrow="YOUR SPACE" title="Profile" right={profileTab === 'profile' ? <RoundAction label="Edit profile" onPress={beginEdit}><Text style={s.editIcon}>✎</Text></RoundAction> : null} />
        <View style={s.profileTabs} accessibilityRole="tablist">
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: profileTab === 'profile' }} onPress={() => setProfileTab('profile')} style={[s.profileTab, profileTab === 'profile' && s.profileTabActive]}><Text style={[s.profileTabText, profileTab === 'profile' && s.profileTabTextActive]}>Profile</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: profileTab === 'ai-key' }} onPress={() => setProfileTab('ai-key')} style={[s.profileTab, profileTab === 'ai-key' && s.profileTabActive]}><Text style={[s.profileTabText, profileTab === 'ai-key' && s.profileTabTextActive]}>AI model key</Text></Pressable>
        </View>
        {profileTab === 'profile' ? <>
        <View style={s.identity}>
          <View style={s.avatar}>{bodyPhoto ? <LoadingImage source={{ uri: bodyPhoto }} style={s.avatarImage} /> : user?.imageUrl ? <LoadingImage source={{ uri: user.imageUrl }} style={s.avatarImage} /> : <Text style={s.avatarLetter}>{displayName === 'Your profile' ? 'S' : displayName.charAt(0).toUpperCase()}</Text>}</View>
          <Text style={s.name}>{displayName}</Text>
          <Text style={s.bio}>{bio}</Text>
          <ActionButton onPress={beginEdit} label="Edit profile  ↗" tone="soft" style={s.editButton} />
        </View>
        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statValue}>{items.length}</Text><Text style={s.statLabel}>WARDROBE PIECES</Text></View>
          <View style={s.statDivider} />
          <View style={s.stat}><Text style={s.statValue}>{savedLooks.length}</Text><Text style={s.statLabel}>SAVED LOOKS</Text></View>
        </View>
        <Pressable onPress={replayTour} accessibilityRole="button" style={s.tourLink}><Text style={s.tourLinkIcon}>✦</Text><View style={{ flex: 1 }}><Text style={s.tourLinkTitle}>Take a quick tour</Text><Text style={s.tourLinkCopy}>See what you can do in Styleout</Text></View><Text style={s.tourLinkArrow}>↗</Text></Pressable>
        <View style={s.section}><SmallCaps>YOUR STYLE PROFILE</SmallCaps><Text style={s.sectionTitle}>A look that's yours.</Text>
          <View style={s.styleCard}>
            <LoadingImage source={bodyPhoto ? { uri: bodyPhoto } : lookImage} style={s.styleImage} />
            <View style={s.styleCopy}><SmallCaps>THE FITTING ROOM</SmallCaps><Text style={s.styleHeading}>{bodyPhoto ? 'Your photo is ready' : 'Make it personal'}</Text><Text style={s.styleBody}>{bodyPhoto ? 'Explore the edit with your own full-length photo.' : 'Add a full-length photo to see yourself in the styling space.'}</Text><Pressable onPress={changePhoto}><Text style={s.styleLink}>{bodyPhoto ? 'Change photo ↗' : 'Add my photo ↗'}</Text></Pressable></View>
          </View>
        </View>
        <InstagramImport />
        {previousWardrobeAvailable ? <View style={s.importCard}><SmallCaps>FROM BEFORE SIGN-IN</SmallCaps><Text style={s.importTitle}>Bring in your previous wardrobe</Text><Text style={s.importCopy}>Your earlier pieces are still on this device. Add them to this account when you’re ready.</Text><Pressable onPress={bringPreviousWardrobe} style={s.importButton}><Text style={s.importButtonText}>Import my pieces  ↗</Text></Pressable></View> : null}
        {savedLooks.length ? <View style={s.savedSection}><View style={s.savedSectionHead}><SmallCaps>SAVED LOOKS</SmallCaps><Pressable onPress={() => router.push('/looks' as Href)} accessibilityRole="button" accessibilityLabel="View all saved looks"><Text style={s.viewAll}>View all looks  ↗</Text></Pressable></View>{savedLooks.slice(0, 3).map((look) => <Pressable key={look.id} onPress={() => setSelectedLook(look)} style={s.savedRow}><LoadingImage source={look.generatedImage ? { uri: look.generatedImage } : look.image ? { uri: look.image } : lookImage} style={s.savedImage} /><View style={{ flex: 1 }}><Text style={s.savedTitle}>{look.title}</Text><Text style={s.savedMeta}>{look.generationStatus === 'running' ? look.generationStartedAt && Date.now() - look.generationStartedAt >= 150000 ? 'AI image delayed · ' : 'Generating AI image… · ' : look.generatedImage ? 'AI image ready · ' : ''}{look.selections.length} linked {look.selections.length === 1 ? 'piece' : 'pieces'} · {new Date(look.savedAt).toLocaleDateString()}</Text></View><Text style={s.savedHeart}>↗</Text></Pressable>)}</View> : null}
        <View style={s.categories}><Pressable onPress={() => setWardrobeExpanded((expanded) => !expanded)} accessibilityRole="button" accessibilityLabel={`${wardrobeExpanded ? 'Collapse' : 'Expand'} wardrobe categories`} style={s.categoriesHeader}><SmallCaps>IN YOUR WARDROBE</SmallCaps><Text style={[s.categoriesArrow, wardrobeExpanded && s.categoriesArrowOpen]}>⌄</Text></Pressable>
          {wardrobeExpanded ? CATEGORIES.map((category) => { const categoryItems = items.filter((item) => item.category === category); return <View key={category} style={s.categoryBlock}><View style={s.categoryRow}><Text style={s.categoryName}>{category}</Text><Text style={s.categoryCount}>{categoryItems.length} {categoryItems.length === 1 ? 'piece' : 'pieces'}</Text></View>{categoryItems.length ? <View style={s.categoryItems}>{categoryItems.map((item) => <Text key={item.id} style={s.categoryItem}>{item.name}</Text>)}</View> : <Text style={s.categoryEmpty}>No pieces added yet.</Text>}</View>; }) : <Text style={s.categoryHint}>{items.length ? `${items.length} pieces across ${new Set(items.map((item) => item.category)).size} categories` : 'Tap to see your wardrobe categories.'}</Text>}
        </View>
        <View style={s.appearance}><SmallCaps>APPEARANCE</SmallCaps><Text style={s.appearanceTitle}>Choose your theme</Text><Text style={s.appearanceHint}>Use your device setting or pick a look for Styleout.</Text><View style={s.themeChoices}>{(['system', 'light', 'dark'] as ThemePreference[]).map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: preference === option }} onPress={() => { void setPreference(option); }} style={[s.themeChoice, preference === option && s.themeChoiceActive]}><Text style={[s.themeChoiceText, preference === option && s.themeChoiceTextActive]}>{option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}</Text></Pressable>)}</View><Text style={s.themeState}>{isDark ? 'Dark appearance is on' : 'Light appearance is on'}</Text></View>
        <View style={s.account}><SmallCaps>ACCOUNT</SmallCaps><Text style={s.accountEmail}>{user?.primaryEmailAddress?.emailAddress || 'Signed in with Clerk'}</Text><Pressable onPress={leaveAccount} disabled={signingOut} style={s.signOut}><Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text><Text style={s.signOutText}>↗</Text></Pressable><Pressable onPress={() => { setDeleteConfirmation(''); setDeleteAccountOpen(true); }} accessibilityRole="button" style={s.deleteAccountButton}><Text style={s.deleteAccountText}>Delete account</Text></Pressable></View>
        </> : <View style={s.gatewayKeyPanel}>
          <SmallCaps>MODEL ACCESS</SmallCaps>
          <Text style={s.gatewayKeyTitle}>Your AI Gateway key</Text>
          <Text style={s.gatewayKeyCopy}>The default model uses Styleout’s built-in key, so you can keep generating without adding one. Add your own Vercel AI Gateway API key to unlock every other model. Your key is stored encrypted in Supabase and is used only for image generation.</Text>
          <View style={s.gatewayStatus}><View style={[s.gatewayStatusDot, hasAiGatewayKey && s.gatewayStatusDotOn]} /><Text style={s.gatewayStatusText}>{hasAiGatewayKey ? 'Personal key saved securely' : 'No personal key added'}</Text></View>
          <Text style={s.label}>{hasAiGatewayKey ? 'REPLACE PERSONAL KEY' : 'VERCEL AI GATEWAY API KEY'}</Text>
          <TextInput value={gatewayKeyDraft} onChangeText={setGatewayKeyDraft} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry placeholder={hasAiGatewayKey ? 'Enter a new key to replace it' : 'Paste your AI Gateway API key'} placeholderTextColor={palette.muted} style={s.input} accessibilityLabel="Vercel AI Gateway API key" />
          <ActionButton onPress={saveGatewayKey} disabled={savingGatewayKey || gatewayKeyDraft.trim().length < 20} label={savingGatewayKey ? 'Saving securely…' : hasAiGatewayKey ? 'Update my key' : 'Save my key'} style={s.gatewaySaveButton} />
          {hasAiGatewayKey ? <Pressable onPress={removeGatewayKey} disabled={removingGatewayKey} style={s.gatewayRemove}><Text style={s.gatewayRemoveText}>{removingGatewayKey ? 'Removing key…' : 'Remove personal key'}</Text></Pressable> : null}
          <View style={s.gatewayNotice}><Text style={s.gatewayNoticeTitle}>Default model stays available</Text><Text style={s.gatewayNoticeCopy}>Your key does not replace Styleout’s built-in key for the default model. Removing your personal key locks the other models again and switches the app back to the default.</Text></View>
        </View>}
      </ScrollView>
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.formScreen}><ScrollView contentContainerStyle={s.formContent}>
          <View style={s.formHead}><View><SmallCaps>ABOUT YOU</SmallCaps><Text style={s.formTitle}>Edit profile</Text></View><Pressable onPress={() => setEditing(false)}><Text style={s.close}>×</Text></Pressable></View>
          <Text style={s.label}>NAME</Text><TextInput value={draftName} onChangeText={setDraftName} placeholder="Your name" style={s.input} maxLength={50} />
          <Text style={s.label}>STYLE NOTE</Text><TextInput value={draftBio} onChangeText={setDraftBio} placeholder="How would you describe your style?" style={[s.input, s.bioInput]} multiline maxLength={140} />
          <ActionButton onPress={saveProfile} label="Save profile" style={s.saveButton} />
        </ScrollView></KeyboardAvoidingView>
      </Modal>
      <Modal visible={!!selectedLook} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => imageFullscreen ? setImageFullscreen(false) : setSelectedLook(null)}>
        <View style={s.lookScreen}><StatusBar hidden={imageFullscreen} barStyle={imageFullscreen || isDark ? 'light-content' : 'dark-content'} backgroundColor={imageFullscreen ? '#111' : palette.paper} /><ScrollView contentContainerStyle={s.lookContent}>
          <View style={s.lookHead}><View style={{ flex: 1 }}><SmallCaps>SAVED STYLE</SmallCaps><Text style={s.lookHeading}>{openLook?.title || 'Saved style'}</Text></View><View style={s.lookHeadActions}><Pressable onPress={downloadLookImage} disabled={!fullscreenImage} style={[s.downloadButton, !fullscreenImage && s.downloadDisabled]} accessibilityRole="button" accessibilityLabel="Download saved style image"><Text style={s.downloadText}>↓</Text></Pressable><Pressable onPress={() => setSelectedLook(null)} accessibilityLabel="Close saved style"><Text style={s.close}>×</Text></Pressable></View></View>
          {openLook ? <>
            {fullscreenImage ? <Pressable onPress={() => setImageFullscreen(true)} accessibilityRole="button" accessibilityLabel="View saved style image full screen"><LoadingImage source={{ uri: fullscreenImage }} style={s.lookPhoto} resizeMode="contain" /></Pressable> : <LoadingImage source={lookImage} style={s.lookPhoto} resizeMode="contain" />}
            <SmallCaps>{openLook.generatedImage ? 'AI STYLED IMAGE' : 'SOURCE PHOTO'}</SmallCaps>
            <Text style={s.lookDate}>Saved {new Date(openLook.savedAt).toLocaleDateString()}</Text>
            <View style={s.lookDivider} />
            <SmallCaps>WARDROBE PIECES</SmallCaps>
            {openLook.selections.length ? openLook.selections.map(({ slotIndex, itemId, itemName, itemCategory, itemImage }) => <View key={`${slotIndex}-${itemId}`} style={s.lookPiece}>
              {itemImage ? <LoadingImage source={{ uri: itemImage }} style={s.lookPieceImage} /> : <View style={s.lookPieceImage} />}
              <View style={{ flex: 1 }}><Text style={s.lookPieceName}>{itemName || 'Unavailable piece'}</Text><Text style={s.lookPieceMeta}>{itemCategory || 'Wardrobe item'} · Position {slotIndex + 1}</Text></View>
            </View>) : <Text style={s.lookLegacy}>This style was saved before garment links were added. Its original notes: {openLook.pieces.join(', ') || 'No pieces recorded'}.</Text>}
            {openLook.generationStatus === 'running' ? <Text style={s.lookFuture}>{openLook.generationStartedAt && Date.now() - openLook.generationStartedAt >= 150000 ? 'Generation is delayed. You can retry below.' : 'Your AI look is generating. This view will update when it is ready.'}</Text> : openLook.generationStatus === 'failed' ? <Text style={s.lookFuture}>{openLook.generationError || 'Generation failed. You can retry below.'}</Text> : null}
            {!openLook.generatedImage && openLook.selections.length > maxWardrobeItemsForModel(imageGenerationModel) ? <Text style={s.lookFuture}>{selectedImageModel.name} accepts your photo plus up to {maxWardrobeItemsForModel(imageGenerationModel)} wardrobe pieces. Choose a model that supports more references or remove pieces on the Style tab.</Text> : null}
            {!openLook.generatedImage && openLook.selections.length > 0 && openLook.selections.length <= 2 && (openLook.generationStatus !== 'running' || !!openLook.generationStartedAt && Date.now() - openLook.generationStartedAt >= 150000) ? <ActionButton onPress={retrySavedLook} disabled={startingGeneration} label={startingGeneration ? 'Starting generation…' : '✦  Generate AI look'} style={s.saveButton} /> : null}
            <Pressable onPress={deleteSavedLook} style={s.lookRemove}><Text style={s.lookRemoveText}>Remove saved style</Text></Pressable>
          </> : null}
        </ScrollView>
        {imageFullscreen && fullscreenImage ? <View style={s.fullscreenViewer}>
          <LoadingImage source={{ uri: fullscreenImage }} style={s.fullscreenImage} resizeMode="contain" />
          <Pressable onPress={downloadLookImage} accessibilityRole="button" accessibilityLabel="Download saved style image" style={[s.fullscreenDownload, { top: insets.top + 12 }]}><Text style={s.fullscreenDownloadText}>↓</Text><Text style={s.fullscreenDownloadLabel}>Download</Text></Pressable>
          <Pressable onPress={() => setImageFullscreen(false)} accessibilityRole="button" accessibilityLabel="Back to saved style" style={[s.fullscreenBack, { top: insets.top + 12 }]}><Text style={s.fullscreenBackText}>‹</Text><Text style={s.fullscreenBackLabel}>Back</Text></Pressable>
        </View> : null}
        </View>
      </Modal>
      <Modal visible={deleteAccountOpen} transparent animationType="fade" onRequestClose={() => { if (!deletingAccount) setDeleteAccountOpen(false); }}>
        <Pressable style={s.deleteBackdrop} onPress={() => { if (!deletingAccount) setDeleteAccountOpen(false); }} accessibilityLabel="Close delete account confirmation">
          <Pressable style={s.deleteCard} onPress={(event) => event.stopPropagation()}>
            <SmallCaps>PERMANENT ACTION</SmallCaps>
            <Text style={s.deleteTitle}>Delete your account?</Text>
            <Text style={s.deleteCopy}>This permanently removes your Styleout profile, wardrobe, saved looks, uploaded images, Instagram connection, and Clerk login. This cannot be undone.</Text>
            <Text style={s.deletePrompt}>Type DELETE to confirm</Text>
            <TextInput value={deleteConfirmation} onChangeText={setDeleteConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!deletingAccount} placeholder="DELETE" placeholderTextColor={palette.muted} style={s.deleteInput} accessibilityLabel="Type DELETE to confirm account deletion" />
            <View style={s.deleteActions}>
              <Pressable onPress={() => setDeleteAccountOpen(false)} disabled={deletingAccount} style={s.cancelDelete}><Text style={s.cancelDeleteText}>Cancel</Text></Pressable>
              <Pressable onPress={permanentlyDeleteAccount} disabled={deleteConfirmation !== 'DELETE' || deletingAccount} accessibilityRole="button" style={[s.confirmDelete, (deleteConfirmation !== 'DELETE' || deletingAccount) && s.confirmDeleteDisabled]}>
                {deletingAccount ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmDeleteText}>Delete permanently</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <PicChangeCarousel visible={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)} />
    </View>
  );
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper }, editIcon: { fontSize: 23, color: palette.ink },
  profileTabs: { marginHorizontal: 24, marginBottom: 5, padding: 4, borderRadius: 15, backgroundColor: palette.canvas, flexDirection: 'row', gap: 4 }, profileTab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, profileTabActive: { backgroundColor: palette.ink }, profileTabText: { color: palette.muted, fontSize: 12, fontWeight: '600' }, profileTabTextActive: { color: palette.paper },
  gatewayKeyPanel: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28 }, gatewayKeyTitle: { color: palette.ink, fontSize: 23, fontWeight: '600', letterSpacing: -0.5, marginTop: 8 }, gatewayKeyCopy: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 9, marginBottom: 21 }, gatewayStatus: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: palette.line, borderRadius: 13, paddingHorizontal: 13, marginBottom: 22, backgroundColor: palette.surface }, gatewayStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.muted }, gatewayStatusDotOn: { backgroundColor: palette.olive }, gatewayStatusText: { color: palette.ink, fontSize: 12, fontWeight: '600' }, gatewaySaveButton: { marginTop: -9 }, gatewayRemove: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 14 }, gatewayRemoveText: { color: palette.danger, fontSize: 12, fontWeight: '600' }, gatewayNotice: { marginTop: 20, padding: 15, borderRadius: 14, backgroundColor: palette.oliveWash }, gatewayNoticeTitle: { color: palette.ink, fontSize: 12, fontWeight: '700' }, gatewayNoticeCopy: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  tourLink: { marginHorizontal: 24, marginTop: 17, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 15, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, tourLinkIcon: { color: palette.olive, fontSize: 20 }, tourLinkTitle: { color: palette.ink, fontSize: 13, fontWeight: '600' }, tourLinkCopy: { color: palette.muted, fontSize: 11, marginTop: 3 }, tourLinkArrow: { color: palette.olive, fontSize: 16 },
  deleteAccountButton: { minHeight: 48, justifyContent: 'center', marginTop: 9 }, deleteAccountText: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  deleteBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 22 }, deleteCard: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: palette.paper, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 23 }, deleteTitle: { fontSize: 23, fontWeight: '600', color: palette.ink, letterSpacing: -0.6, marginTop: 10 }, deleteCopy: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 9 }, deletePrompt: { color: palette.ink, fontSize: 12, fontWeight: '700', marginTop: 22, marginBottom: 8 }, deleteInput: { height: 48, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: palette.line, color: palette.ink, backgroundColor: palette.surface, fontSize: 14, letterSpacing: 1 }, deleteActions: { flexDirection: 'row', gap: 10, marginTop: 18 }, cancelDelete: { flex: 1, height: 46, borderRadius: 12, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, cancelDeleteText: { color: palette.ink, fontSize: 13, fontWeight: '600' }, confirmDelete: { flex: 1.5, height: 46, borderRadius: 12, backgroundColor: palette.danger, alignItems: 'center', justifyContent: 'center' }, confirmDeleteDisabled: { opacity: 0.45 }, confirmDeleteText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  identity: { alignItems: 'center', paddingTop: 15, paddingHorizontal: 24 }, avatar: { width: 90, height: 90, borderRadius: 32, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarLetter: { fontSize: 39, fontWeight: '500', color: palette.olive },
  name: { fontSize: 25, fontWeight: '600', color: palette.ink, marginTop: 16, letterSpacing: -0.7 }, bio: { color: palette.muted, fontSize: 13, marginTop: 7, textAlign: 'center' },
  editButton: { backgroundColor: palette.canvas, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 17 }, editText: { fontSize: 12, color: palette.ink, fontWeight: '600' },
  stats: { flexDirection: 'row', marginHorizontal: 24, marginTop: 30, borderWidth: 1, borderColor: palette.line, borderRadius: radii.card, paddingVertical: 20, backgroundColor: palette.surface }, stat: { flex: 1, alignItems: 'center' }, statDivider: { width: 1, backgroundColor: palette.line },
  statValue: { fontSize: 23, fontWeight: '600', color: palette.ink }, statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: palette.muted, marginTop: 5 },
  section: { paddingHorizontal: 24, paddingTop: 34 }, sectionTitle: { fontSize: 22, fontWeight: '600', color: palette.ink, marginTop: 5, marginBottom: 16, letterSpacing: -0.6 },
  styleCard: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: radii.card, overflow: 'hidden', minHeight: 172, borderWidth: 1, borderColor: palette.line }, styleImage: { width: '39%', height: 172 }, styleCopy: { flex: 1, padding: 17, justifyContent: 'center' },
  styleHeading: { fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 7 }, styleBody: { fontSize: 11, color: palette.muted, lineHeight: 16, marginTop: 6 }, styleLink: { fontSize: 11, color: palette.olive, fontWeight: '700', marginTop: 14 },
  importCard: { marginHorizontal: 24, marginTop: 24, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: palette.line }, importTitle: { fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 7 }, importCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, importButton: { alignSelf: 'flex-start', marginTop: 15 }, importButtonText: { color: palette.olive, fontSize: 12, fontWeight: '700' },
  savedSection: { paddingHorizontal: 24, paddingTop: 30 }, savedSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }, viewAll: { color: palette.olive, fontSize: 11, fontWeight: '700' }, savedRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 12 }, savedImage: { width: 58, height: 67, borderRadius: 10, backgroundColor: palette.canvas }, savedTitle: { fontSize: 15, fontWeight: '600', color: palette.ink }, savedMeta: { fontSize: 11, color: palette.muted, marginTop: 5 }, savedHeart: { color: palette.ink, fontSize: 17 },
  lookScreen: { flex: 1, backgroundColor: palette.paper }, lookContent: { padding: 24, paddingTop: 42, paddingBottom: 48 }, lookHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }, lookHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, downloadButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, downloadDisabled: { opacity: 0.4 }, downloadText: { fontSize: 22, color: palette.ink, lineHeight: 24 },
  lookHeading: { fontSize: 27, fontWeight: '600', letterSpacing: -0.7, color: palette.ink, marginTop: 6 }, lookPhoto: { width: '100%', height: 350, borderRadius: 20, backgroundColor: palette.canvas, marginBottom: 20 },
  fullscreenViewer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, elevation: 10, backgroundColor: '#111' }, fullscreenImage: { width: '100%', height: '100%' }, fullscreenDownload: { position: 'absolute', right: 20, minWidth: 118, height: 44, paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: '#E5E5E0', backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, fullscreenDownloadText: { color: '#111', fontSize: 22, lineHeight: 26 }, fullscreenDownloadLabel: { color: '#111', fontSize: 13, fontWeight: '600' }, fullscreenBack: { position: 'absolute', left: 20, minWidth: 88, height: 44, paddingHorizontal: 11, borderRadius: 22, borderWidth: 1, borderColor: '#E5E5E0', backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, fullscreenBackText: { color: '#111', fontSize: 34, lineHeight: 38, marginTop: -3 }, fullscreenBackLabel: { color: '#111', fontSize: 13, fontWeight: '600' },
  lookDate: { fontSize: 12, color: palette.muted, marginTop: 8 }, lookDivider: { height: 1, backgroundColor: palette.line, marginVertical: 24 },
  lookPiece: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }, lookPieceImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: palette.canvas },
  lookPieceName: { fontSize: 15, fontWeight: '600', color: palette.ink }, lookPieceMeta: { fontSize: 11, color: palette.muted, marginTop: 5 }, lookLegacy: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 16 },
  lookFuture: { fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 22 }, lookRemove: { marginTop: 26, borderWidth: 1, borderColor: palette.line, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' }, lookRemoveText: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  categories: { paddingHorizontal: 24, paddingTop: 32 }, categoriesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }, categoriesArrow: { color: palette.ink, fontSize: 22, lineHeight: 24, transform: [{ rotate: '0deg' }], paddingHorizontal: 8 }, categoriesArrowOpen: { transform: [{ rotate: '180deg' }] }, categoryHint: { color: palette.muted, fontSize: 12, marginTop: 12 }, categoryBlock: { borderBottomWidth: 1, borderBottomColor: palette.line }, categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 }, categoryName: { fontSize: 14, color: palette.ink, fontWeight: '600' }, categoryCount: { fontSize: 12, color: palette.muted }, categoryItems: { paddingBottom: 12, gap: 7 }, categoryItem: { color: palette.muted, fontSize: 12, paddingLeft: 2 }, categoryEmpty: { fontSize: 12, color: palette.muted, paddingBottom: 14 },
  appearance: { paddingHorizontal: 24, paddingTop: 34 }, appearanceTitle: { color: palette.ink, fontSize: 19, fontWeight: '600', marginTop: 8 }, appearanceHint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, themeChoices: { flexDirection: 'row', gap: 5, padding: 4, borderRadius: 15, backgroundColor: palette.canvas, marginTop: 14 }, themeChoice: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, themeChoiceActive: { backgroundColor: palette.ink }, themeChoiceText: { color: palette.muted, fontSize: 12, fontWeight: '600' }, themeChoiceTextActive: { color: palette.paper }, themeState: { color: palette.muted, fontSize: 10, marginTop: 8 },
  account: { paddingHorizontal: 24, paddingTop: 34 }, accountEmail: { fontSize: 13, color: palette.muted, marginTop: 10 }, signOut: { height: 52, marginTop: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, signOutText: { fontSize: 13, color: palette.ink, fontWeight: '600' },
  formScreen: { flex: 1, backgroundColor: palette.paper }, formContent: { padding: 24, paddingTop: 42 }, formHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }, formTitle: { fontSize: 29, color: palette.ink, fontWeight: '600', marginTop: 5 }, close: { fontSize: 29, color: palette.ink },
  label: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700', color: palette.muted, marginBottom: 10 }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: radii.control, height: 50, paddingHorizontal: 15, fontSize: 14, color: palette.ink, marginBottom: 25, backgroundColor: palette.surface }, bioInput: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  saveButton: { marginTop: 8 }, saveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
