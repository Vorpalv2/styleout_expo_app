import { useClerk, useUser } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, palette, RoundAction, SmallCaps } from '@/components/StyleoutUI';
import { PicChangeCarousel } from '@/components/PicChangeCarousel';
import { LoadingImage } from '@/components/LoadingImage';
import { InstagramImport } from '@/components/InstagramImport';
import { ClosetRefreshControl } from '@/components/ClosetRefreshControl';
import { CATEGORIES, SavedLook, useCloset } from '@/lib/closet';
import { downloadImage } from '@/lib/saveImage';

const lookImage = require('../../assets/styleout/look.png');

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { signOut } = useClerk();
  const { items, name, bio, bodyPhoto, savedLooks, generateLook, removeLook, previousWardrobeAvailable, importPreviousWardrobe, updateProfile } = useCloset();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio);
  const [signingOut, setSigningOut] = useState(false);
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [startingGeneration, setStartingGeneration] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [wardrobeExpanded, setWardrobeExpanded] = useState(false);
  const openLook = selectedLook ? savedLooks.find((look) => look.id === selectedLook.id) || selectedLook : null;
  const fullscreenImage = openLook?.generatedImage || openLook?.image || null;
  const displayName = name === 'Your profile' ? (user?.fullName || user?.firstName || 'Your profile') : name;

  function beginEdit() { setDraftName(name); setDraftBio(bio); setEditing(true); }
  function changePhoto() { setPhotoPickerOpen(true); }
  async function saveProfile() {
    try { await updateProfile(draftName.trim() || 'Your profile', draftBio.trim() || 'A wardrobe that feels like you.'); setEditing(false); }
    catch { Alert.alert('Save failed', 'Your profile could not be updated. Please try again.'); }
  }
  async function leaveAccount() {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); }
    catch { Alert.alert('Sign-out failed', 'Please try again.'); setSigningOut(false); }
  }
  async function bringPreviousWardrobe() {
    try { await importPreviousWardrobe(); }
    catch { Alert.alert('Import failed', 'Your previous wardrobe could not be read on this device.'); }
  }
  async function deleteSavedLook() {
    if (!selectedLook) return;
    try { await removeLook(selectedLook.id); setSelectedLook(null); }
    catch { Alert.alert('Remove failed', 'This saved style could not be removed. Please try again.'); }
  }
  async function retrySavedLook() {
    if (!openLook || startingGeneration) return;
    setStartingGeneration(true);
    try { await generateLook(openLook.id, '', openLook.backgroundBlur); }
    catch (error) { Alert.alert('Generation failed', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setStartingGeneration(false); }
  }
  async function downloadLookImage() {
    if (!fullscreenImage) return;
    try {
      await downloadImage(fullscreenImage, openLook?.title || 'styleout-look');
      Alert.alert('Image saved', 'The AI look was downloaded to your photo library.');
    } catch { Alert.alert('Download unavailable', 'Please try again or save the image from the full-screen viewer.'); }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} alwaysBounceVertical refreshControl={Platform.OS === 'web' ? undefined : <ClosetRefreshControl />}>
        <AppHeader eyebrow="YOUR SPACE" title="Profile" right={<RoundAction label="Edit profile" onPress={beginEdit}><Text style={s.editIcon}>✎</Text></RoundAction>} />
        <View style={s.identity}>
          <View style={s.avatar}>{bodyPhoto ? <LoadingImage source={{ uri: bodyPhoto }} style={s.avatarImage} /> : user?.imageUrl ? <LoadingImage source={{ uri: user.imageUrl }} style={s.avatarImage} /> : <Text style={s.avatarLetter}>{displayName === 'Your profile' ? 'S' : displayName.charAt(0).toUpperCase()}</Text>}</View>
          <Text style={s.name}>{displayName}</Text>
          <Text style={s.bio}>{bio}</Text>
          <Pressable onPress={beginEdit} style={s.editButton}><Text style={s.editText}>Edit profile  ↗</Text></Pressable>
        </View>
        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statValue}>{items.length}</Text><Text style={s.statLabel}>WARDROBE PIECES</Text></View>
          <View style={s.statDivider} />
          <View style={s.stat}><Text style={s.statValue}>{savedLooks.length}</Text><Text style={s.statLabel}>SAVED LOOKS</Text></View>
        </View>
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
        <View style={s.account}><SmallCaps>ACCOUNT</SmallCaps><Text style={s.accountEmail}>{user?.primaryEmailAddress?.emailAddress || 'Signed in with Clerk'}</Text><Pressable onPress={leaveAccount} disabled={signingOut} style={s.signOut}><Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text><Text style={s.signOutText}>↗</Text></Pressable></View>
      </ScrollView>
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.formScreen}><ScrollView contentContainerStyle={s.formContent}>
          <View style={s.formHead}><View><SmallCaps>ABOUT YOU</SmallCaps><Text style={s.formTitle}>Edit profile</Text></View><Pressable onPress={() => setEditing(false)}><Text style={s.close}>×</Text></Pressable></View>
          <Text style={s.label}>NAME</Text><TextInput value={draftName} onChangeText={setDraftName} placeholder="Your name" style={s.input} maxLength={50} />
          <Text style={s.label}>STYLE NOTE</Text><TextInput value={draftBio} onChangeText={setDraftBio} placeholder="How would you describe your style?" style={[s.input, s.bioInput]} multiline maxLength={140} />
          <Pressable onPress={saveProfile} style={s.saveButton}><Text style={s.saveText}>Save profile</Text></Pressable>
        </ScrollView></KeyboardAvoidingView>
      </Modal>
      <Modal visible={!!selectedLook} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => imageFullscreen ? setImageFullscreen(false) : setSelectedLook(null)}>
        <View style={s.lookScreen}><StatusBar hidden={imageFullscreen} barStyle={imageFullscreen ? 'light-content' : 'dark-content'} backgroundColor={imageFullscreen ? '#111' : '#fff'} /><ScrollView contentContainerStyle={s.lookContent}>
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
            {!openLook.generatedImage && openLook.selections.length > 2 ? <Text style={s.lookFuture}>Grok Imagine can use your photo with up to two wardrobe pieces. Choose one or two pieces on the Style tab to generate an AI look.</Text> : null}
            {!openLook.generatedImage && openLook.selections.length > 0 && openLook.selections.length <= 2 && (openLook.generationStatus !== 'running' || !!openLook.generationStartedAt && Date.now() - openLook.generationStartedAt >= 150000) ? <Pressable onPress={retrySavedLook} disabled={startingGeneration} style={s.saveButton}><Text style={s.saveText}>{startingGeneration ? 'Starting generation…' : '✦  Generate AI look'}</Text></Pressable> : null}
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
      <PicChangeCarousel visible={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' }, editIcon: { fontSize: 23, color: palette.ink },
  identity: { alignItems: 'center', paddingTop: 15, paddingHorizontal: 24 }, avatar: { width: 90, height: 90, borderRadius: 32, backgroundColor: '#E7E8E0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarLetter: { fontSize: 39, fontWeight: '500', color: palette.olive },
  name: { fontSize: 25, fontWeight: '600', color: palette.ink, marginTop: 16, letterSpacing: -0.7 }, bio: { color: palette.muted, fontSize: 13, marginTop: 7, textAlign: 'center' },
  editButton: { backgroundColor: palette.canvas, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 17 }, editText: { fontSize: 12, color: palette.ink, fontWeight: '600' },
  stats: { flexDirection: 'row', marginHorizontal: 24, marginTop: 30, borderWidth: 1, borderColor: palette.line, borderRadius: 19, paddingVertical: 20 }, stat: { flex: 1, alignItems: 'center' }, statDivider: { width: 1, backgroundColor: palette.line },
  statValue: { fontSize: 23, fontWeight: '600', color: palette.ink }, statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: palette.muted, marginTop: 5 },
  section: { paddingHorizontal: 24, paddingTop: 34 }, sectionTitle: { fontSize: 22, fontWeight: '600', color: palette.ink, marginTop: 5, marginBottom: 16, letterSpacing: -0.6 },
  styleCard: { flexDirection: 'row', backgroundColor: palette.canvas, borderRadius: 20, overflow: 'hidden', minHeight: 172 }, styleImage: { width: '39%', height: 172 }, styleCopy: { flex: 1, padding: 17, justifyContent: 'center' },
  styleHeading: { fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 7 }, styleBody: { fontSize: 11, color: palette.muted, lineHeight: 16, marginTop: 6 }, styleLink: { fontSize: 11, color: palette.olive, fontWeight: '700', marginTop: 14 },
  importCard: { marginHorizontal: 24, marginTop: 24, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: palette.line }, importTitle: { fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 7 }, importCopy: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, importButton: { alignSelf: 'flex-start', marginTop: 15 }, importButtonText: { color: palette.olive, fontSize: 12, fontWeight: '700' },
  savedSection: { paddingHorizontal: 24, paddingTop: 30 }, savedSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }, viewAll: { color: palette.olive, fontSize: 11, fontWeight: '700' }, savedRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 12 }, savedImage: { width: 58, height: 67, borderRadius: 10, backgroundColor: palette.canvas }, savedTitle: { fontSize: 15, fontWeight: '600', color: palette.ink }, savedMeta: { fontSize: 11, color: palette.muted, marginTop: 5 }, savedHeart: { color: palette.ink, fontSize: 17 },
  lookScreen: { flex: 1, backgroundColor: '#fff' }, lookContent: { padding: 24, paddingTop: 42, paddingBottom: 48 }, lookHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }, lookHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, downloadButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, downloadDisabled: { opacity: 0.4 }, downloadText: { fontSize: 22, color: palette.ink, lineHeight: 24 },
  lookHeading: { fontSize: 27, fontWeight: '600', letterSpacing: -0.7, color: palette.ink, marginTop: 6 }, lookPhoto: { width: '100%', height: 350, borderRadius: 20, backgroundColor: palette.canvas, marginBottom: 20 },
  fullscreenViewer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, elevation: 10, backgroundColor: '#111' }, fullscreenImage: { width: '100%', height: '100%' }, fullscreenDownload: { position: 'absolute', right: 20, minWidth: 118, height: 44, paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: '#E5E5E0', backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, fullscreenDownloadText: { color: palette.ink, fontSize: 22, lineHeight: 26 }, fullscreenDownloadLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' }, fullscreenBack: { position: 'absolute', left: 20, minWidth: 88, height: 44, paddingHorizontal: 11, borderRadius: 22, borderWidth: 1, borderColor: '#E5E5E0', backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, fullscreenBackText: { color: palette.ink, fontSize: 34, lineHeight: 38, marginTop: -3 }, fullscreenBackLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  lookDate: { fontSize: 12, color: palette.muted, marginTop: 8 }, lookDivider: { height: 1, backgroundColor: palette.line, marginVertical: 24 },
  lookPiece: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }, lookPieceImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: palette.canvas },
  lookPieceName: { fontSize: 15, fontWeight: '600', color: palette.ink }, lookPieceMeta: { fontSize: 11, color: palette.muted, marginTop: 5 }, lookLegacy: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 16 },
  lookFuture: { fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 22 }, lookRemove: { marginTop: 26, borderWidth: 1, borderColor: palette.line, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' }, lookRemoveText: { color: '#9E534A', fontSize: 12, fontWeight: '600' },
  categories: { paddingHorizontal: 24, paddingTop: 32 }, categoriesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 }, categoriesArrow: { color: palette.ink, fontSize: 22, lineHeight: 24, transform: [{ rotate: '0deg' }], paddingHorizontal: 8 }, categoriesArrowOpen: { transform: [{ rotate: '180deg' }] }, categoryHint: { color: palette.muted, fontSize: 12, marginTop: 12 }, categoryBlock: { borderBottomWidth: 1, borderBottomColor: palette.line }, categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 }, categoryName: { fontSize: 14, color: palette.ink, fontWeight: '600' }, categoryCount: { fontSize: 12, color: palette.muted }, categoryItems: { paddingBottom: 12, gap: 7 }, categoryItem: { color: palette.muted, fontSize: 12, paddingLeft: 2 }, categoryEmpty: { fontSize: 12, color: palette.muted, paddingBottom: 14 },
  account: { paddingHorizontal: 24, paddingTop: 34 }, accountEmail: { fontSize: 13, color: palette.muted, marginTop: 10 }, signOut: { height: 52, marginTop: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, signOutText: { fontSize: 13, color: palette.ink, fontWeight: '600' },
  formScreen: { flex: 1, backgroundColor: '#fff' }, formContent: { padding: 24, paddingTop: 42 }, formHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }, formTitle: { fontSize: 29, color: palette.ink, fontWeight: '600', marginTop: 5 }, close: { fontSize: 29, color: palette.ink },
  label: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700', color: palette.muted, marginBottom: 10 }, input: { borderWidth: 1, borderColor: palette.line, borderRadius: 13, height: 50, paddingHorizontal: 15, fontSize: 14, color: palette.ink, marginBottom: 25 }, bioInput: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  saveButton: { height: 53, borderRadius: 16, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
