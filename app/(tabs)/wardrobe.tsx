import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, palette, RoundAction, SamplePieceImage, samplePieces, SmallCaps } from '@/components/StyleoutUI';
import { LoadingImage } from '@/components/LoadingImage';
import { CATEGORIES, Category, ClosetItem, pickPhoto, useCloset } from '@/lib/closet';

export default function WardrobeScreen() {
  const { items, addItem, updateItem, removeItem } = useCloset();
  const [filter, setFilter] = useState('All');
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [detail, setDetail] = useState<ClosetItem | null>(null);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [replacementImage, setReplacementImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = filter === 'All' ? items : items.filter((item) => item.category === filter);

  async function startAdd() {
    const image = await pickPhoto();
    if (!image) return;
    setEditingItem(null); setReplacementImage(null);
    setName(''); setCategory('Tops'); setColor(''); setBrand(''); setNotes('');
    setDraftImage(image);
  }
  function startEdit(item: ClosetItem) {
    setDetail(null); setEditingItem(item); setReplacementImage(null);
    setDraftImage(item.image); setName(item.name); setCategory(item.category);
    setColor(item.color); setBrand(item.brand); setNotes(item.notes);
  }
  function closeForm() { setDraftImage(null); setEditingItem(null); setReplacementImage(null); }
  async function changeDraftPhoto() {
    const image = await pickPhoto();
    if (image) { setDraftImage(image); setReplacementImage(image); }
  }
  async function save() {
    if (!draftImage || !name.trim() || saving) return;
    setSaving(true);
    try {
      const changes = { name: name.trim(), category, color: color.trim(), brand: brand.trim(), notes: notes.trim() };
      if (editingItem) await updateItem(editingItem.id, { ...changes, ...(replacementImage ? { image: replacementImage } : {}) });
      else await addItem({ ...changes, image: draftImage });
      closeForm();
      setFilter('All');
    } catch (error) { Alert.alert('Save failed', error instanceof Error ? error.message : 'Your piece could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    try { await removeItem(id); setDetail(null); }
    catch (error) { Alert.alert('Remove failed', error instanceof Error ? error.message : 'This piece could not be removed. Please try again.'); }
  }
  function confirmRemove(item: ClosetItem) {
    if (Platform.OS === 'web') { void remove(item.id); return; }
    Alert.alert('Remove this piece?', `${item.name} will be removed from your wardrobe.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void remove(item.id); } },
    ]);
  }

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <AppHeader eyebrow="THE PIECES YOU OWN" title="Wardrobe" right={<RoundAction label="Add clothing item" onPress={startAdd}><Text style={s.plus}>＋</Text></RoundAction>} />
        <View style={s.intro}><Text style={s.introText}>Every good look starts here.</Text><Text style={s.count}>{items.length} {items.length === 1 ? 'PIECE' : 'PIECES'}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {['All', ...CATEGORIES].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterActive]}><Text style={[s.filterText, filter === item && s.filterTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>
        {shown.length ? <View style={s.grid}>{shown.map((item) => (
          <Pressable key={item.id} onPress={() => setDetail(item)} style={s.card}>
            <LoadingImage source={{ uri: item.image }} style={s.cardImage} />
            <View style={s.cardBody}><SmallCaps>{item.category.toUpperCase()}</SmallCaps><Text style={s.cardName} numberOfLines={1}>{item.name}</Text><Text style={s.cardMeta}>{item.color || item.brand || 'My wardrobe'}</Text></View>
          </Pressable>
        ))}</View> : <View style={s.empty}>
          <View style={s.emptyImages}>{samplePieces.slice(0, 3).map((piece, i) => <View key={piece.name} style={[s.sampleTile, { transform: [{ rotate: i === 0 ? '-8deg' : i === 2 ? '8deg' : '0deg' }] }]}><SamplePieceImage col={piece.col} row={piece.row} size={82} /></View>)}</View>
          <SmallCaps>{filter === 'All' ? 'A FRESH START' : `NO ${filter.toUpperCase()} YET`}</SmallCaps>
          <Text style={s.emptyTitle}>{filter === 'All' ? 'Your wardrobe, your way.' : `Make room for ${filter.toLowerCase()}.`}</Text>
          <Text style={s.emptyText}>Add a photo, give the piece a name and category, and it will be ready to style.</Text>
          <Pressable onPress={startAdd} style={s.darkButton}><Text style={s.darkText}>＋  Add your first piece</Text></Pressable>
        </View>}
      </ScrollView>
      <Modal visible={!!draftImage} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.formScreen}>
          <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
            <View style={s.formHead}><View><SmallCaps>{editingItem ? 'EDIT WARDROBE PIECE' : 'NEW WARDROBE PIECE'}</SmallCaps><Text style={s.formTitle}>{editingItem ? 'Edit the details' : 'Add the details'}</Text></View><Pressable onPress={closeForm}><Text style={s.close}>×</Text></Pressable></View>
            {draftImage ? <Pressable onPress={changeDraftPhoto} accessibilityLabel="Change piece photo"><LoadingImage source={{ uri: draftImage }} style={s.preview} resizeMode="contain" /><Text style={s.changeImage}>Change photo ↗</Text></Pressable> : null}
            <Text style={s.label}>PIECE NAME *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. White linen shirt" placeholderTextColor="#A7A7A2" style={s.input} autoCapitalize="words" />
            <Text style={s.label}>CATEGORY *</Text>
            <View style={s.categoryWrap}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.category, category === item && s.categoryActive]}><Text style={[s.categoryText, category === item && s.categoryTextActive]}>{item}</Text></Pressable>)}</View>
            <Text style={s.label}>COLOR</Text><TextInput value={color} onChangeText={setColor} placeholder="e.g. Ivory" placeholderTextColor="#A7A7A2" style={s.input} />
            <Text style={s.label}>BRAND</Text><TextInput value={brand} onChangeText={setBrand} placeholder="Optional" placeholderTextColor="#A7A7A2" style={s.input} />
            <Text style={s.label}>NOTES</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Fit, fabric, or anything to remember" placeholderTextColor="#A7A7A2" style={[s.input, s.notes]} multiline />
            <Pressable onPress={save} disabled={!name.trim() || saving} style={[s.saveButton, (!name.trim() || saving) && s.disabled]}><Text style={s.saveText}>{saving ? 'Saving…' : editingItem ? 'Save changes' : 'Save to wardrobe'}</Text></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={s.backdrop}><View style={s.detailSheet}>
          <View style={s.sheetHead}><SmallCaps>YOUR WARDROBE</SmallCaps><Pressable onPress={() => setDetail(null)}><Text style={s.close}>×</Text></Pressable></View>
          {detail ? <><LoadingImage source={{ uri: detail.image }} style={s.detailImage} resizeMode="contain" /><Text style={s.detailCategory}>{detail.category.toUpperCase()}</Text><Text style={s.detailTitle}>{detail.name}</Text><Text style={s.detailMeta}>{[detail.color, detail.brand].filter(Boolean).join(' · ') || 'Your piece'}</Text>{detail.notes ? <Text style={s.detailNotes}>{detail.notes}</Text> : null}<Pressable onPress={() => startEdit(detail)} style={s.editButton}><Text style={s.editText}>Edit piece and photo</Text></Pressable><Pressable onPress={() => confirmRemove(detail)} style={s.removeButton}><Text style={s.removeText}>Remove from wardrobe</Text></Pressable></> : null}
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' }, plus: { fontSize: 25, color: palette.ink, marginTop: -3 },
  intro: { paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, introText: { fontSize: 13, color: palette.muted }, count: { fontSize: 10, letterSpacing: 1.3, fontWeight: '700', color: palette.muted },
  filters: { paddingHorizontal: 24, paddingBottom: 22, gap: 8 }, filter: { paddingHorizontal: 16, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas }, filterActive: { backgroundColor: palette.ink },
  filterText: { fontSize: 12, fontWeight: '600', color: palette.muted }, filterTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, gap: 12 }, card: { width: '48%', borderWidth: 1, borderColor: palette.line, borderRadius: 19, overflow: 'hidden' },
  cardImage: { width: '100%', height: 174, backgroundColor: palette.canvas }, cardBody: { padding: 13 }, cardName: { fontSize: 15, fontWeight: '600', color: palette.ink, marginTop: 5 }, cardMeta: { color: palette.muted, fontSize: 11, marginTop: 4 },
  empty: { marginHorizontal: 24, marginTop: 50, alignItems: 'center' }, emptyImages: { height: 120, flexDirection: 'row', alignItems: 'center', marginBottom: 25 }, sampleTile: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: palette.line, marginHorizontal: -5, backgroundColor: '#fff' },
  emptyTitle: { fontSize: 24, fontWeight: '600', letterSpacing: -0.7, color: palette.ink, marginTop: 10 }, emptyText: { textAlign: 'center', color: palette.muted, fontSize: 13, lineHeight: 20, maxWidth: 270, marginTop: 10 },
  darkButton: { backgroundColor: palette.ink, paddingHorizontal: 24, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 25 }, darkText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  formScreen: { flex: 1, backgroundColor: '#fff' }, formContent: { padding: 24, paddingBottom: 50 }, formHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, marginBottom: 20 }, formTitle: { fontSize: 29, fontWeight: '600', letterSpacing: -0.8, color: palette.ink, marginTop: 6 }, close: { fontSize: 29, color: palette.ink, lineHeight: 30 },
  preview: { width: '100%', height: 205, backgroundColor: palette.canvas, borderRadius: 19 }, changeImage: { color: palette.olive, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10, marginBottom: 20 }, label: { color: palette.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginBottom: 9, marginTop: 11 },
  input: { height: 48, borderWidth: 1, borderColor: palette.line, borderRadius: 13, paddingHorizontal: 15, fontSize: 14, color: palette.ink, marginBottom: 10 }, notes: { height: 78, paddingTop: 14, textAlignVertical: 'top' },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }, category: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: palette.canvas }, categoryActive: { backgroundColor: palette.ink },
  categoryText: { fontSize: 12, color: palette.muted, fontWeight: '600' }, categoryTextActive: { color: '#fff' }, saveButton: { marginTop: 21, backgroundColor: palette.ink, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 }, saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, detailSheet: { padding: 24, paddingBottom: 40, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#fff' }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  detailImage: { width: '100%', height: 280, backgroundColor: palette.canvas, borderRadius: 20 }, detailCategory: { fontSize: 10, fontWeight: '700', color: palette.muted, letterSpacing: 1.5, marginTop: 20 },
  detailTitle: { fontSize: 25, fontWeight: '600', color: palette.ink, marginTop: 5 }, detailMeta: { color: palette.muted, fontSize: 13, marginTop: 5 }, detailNotes: { color: palette.ink, fontSize: 13, marginTop: 14, lineHeight: 19 }, editButton: { marginTop: 22, height: 46, backgroundColor: palette.ink, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, editText: { color: '#fff', fontWeight: '600', fontSize: 12 }, removeButton: { marginTop: 10, height: 46, borderWidth: 1, borderColor: palette.line, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, removeText: { color: '#9E534A', fontWeight: '600', fontSize: 12 },
});
