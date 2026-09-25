import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SamplePieceImage } from '@/components/StyleoutUI';
import { ThemeColors, useStyleoutTheme } from '@/components/StyleoutTheme';

const modelImage = require('../assets/styleout/female-dress.png');

const steps = [
  { eyebrow: 'WELCOME TO STYLEOUT', title: 'Your wardrobe, styled on you.', body: 'Start with a full-length photo. Styleout keeps your original beside every generated look, so you can compare without losing your point of view.', action: 'Show me how' },
  { eyebrow: 'YOUR WARDROBE', title: 'Build the rail you actually own.', body: 'Photograph your favorite pieces, add a few useful details, and they become ready to try in any look.', action: 'Next' },
  { eyebrow: 'THE FITTING ROOM', title: 'Compose, direct, generate.', body: 'Choose wardrobe pieces, name the style, and add a note about the fit or mood. Each image model supports a different number of references.', action: 'Next' },
  { eyebrow: 'KEEP WHAT WORKS', title: 'Compare it. Save it. Wear it.', body: 'Drag across the finished image to compare it with your original, then save the combinations worth coming back to.', action: 'Start styling' },
] as const;

type Styles = ReturnType<typeof makeStyles>;

function LookCanvas({ styles: s }: { styles: Styles }) {
  return <View style={s.canvas}>
    <View style={s.canvasHalo} /><Image source={modelImage} resizeMode="contain" style={s.model} />
    <View style={[s.floatingPiece, s.pieceLeft]}><SamplePieceImage col={1} row={0} size={54} /></View>
    <View style={[s.floatingPiece, s.pieceRight]}><SamplePieceImage col={0} row={1} size={54} /></View>
    <View style={s.canvasLabel}><Text style={s.canvasLabelText}>YOUR DIGITAL FITTING ROOM</Text></View>
  </View>;
}

function WardrobeCanvas({ styles: s }: { styles: Styles }) {
  return <View style={s.rail}><View style={s.railLine} />
    {[{ col: 1, row: 0, label: 'LINEN SHIRT' }, { col: 0, row: 1, label: 'TROUSER' }, { col: 1, row: 1, label: 'MARKET TOTE' }].map((piece, index) =>
      <View key={piece.label} style={[s.railCard, index === 1 && s.railCardLift]}><SamplePieceImage col={piece.col} row={piece.row} size={72} /><Text style={s.railCardLabel}>{piece.label}</Text></View>)}
  </View>;
}

function ControlsCanvas({ styles: s }: { styles: Styles }) {
  return <View style={s.controls}>
    <View style={s.controlTitle}><Text style={s.controlEyebrow}>YOUR STYLE NAME</Text><Text style={s.controlName}>Quiet city layers</Text></View>
    <View style={s.controlRow}><View style={s.controlChip}><Text style={s.controlChipIcon}>＋</Text><Text style={s.controlChipText}>2 PIECES</Text></View><View style={s.controlChip}><Text style={s.controlChipIcon}>✎</Text><Text style={s.controlChipText}>DIRECTION</Text></View></View>
    <View style={s.generate}><Text style={s.generateSpark}>✦</Text><Text style={s.generateText}>Generate look</Text><Text style={s.generateArrow}>↗</Text></View>
  </View>;
}

function CompareCanvas({ styles: s }: { styles: Styles }) {
  return <View style={s.compare}>
    <Image source={modelImage} resizeMode="cover" style={s.compareImage} /><View style={s.compareTint} />
    <View style={s.compareDivider}><View style={s.compareHandle}><Text style={s.compareHandleText}>‹ ›</Text></View></View>
    <Text style={[s.compareTag, s.compareBefore]}>ORIGINAL</Text><Text style={[s.compareTag, s.compareAfter]}>STYLED</Text>
    <View style={s.savedBadge}><Text style={s.savedBadgeText}>♡  SAVE LOOK</Text></View>
  </View>;
}

function StepVisual({ index, styles }: { index: number; styles: Styles }) {
  if (index === 0) return <LookCanvas styles={styles} />;
  if (index === 1) return <WardrobeCanvas styles={styles} />;
  if (index === 2) return <ControlsCanvas styles={styles} />;
  return <CompareCanvas styles={styles} />;
}

export function OnboardingTour({ visible, onFinish }: { visible: boolean; onFinish: () => void }) {
  const { colors } = useStyleoutTheme();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const compact = height < 700;
  const s = useMemo(() => makeStyles(colors, compact), [colors, compact]);
  const current = steps[index];

  useEffect(() => { if (visible) setIndex(0); }, [visible]);
  function finish() { setIndex(0); onFinish(); }
  function advance() { if (index === steps.length - 1) finish(); else setIndex((value) => value + 1); }

  return <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={finish}>
    <SafeAreaView style={s.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={s.topBar}><View style={s.wordmarkRow}><Text style={s.spark}>✦</Text><Text style={s.wordmark}>STYLEOUT</Text></View><Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip app tour" hitSlop={10} style={s.skip}><Text style={s.skipText}>Skip</Text></Pressable></View>
      <View style={s.visualWrap}><StepVisual index={index} styles={s} /></View>
      <View style={s.copy} accessibilityLiveRegion="polite"><Text style={s.eyebrow}>{current.eyebrow}</Text><Text style={s.title}>{current.title}</Text><Text style={s.body}>{current.body}</Text></View>
      <View style={s.footer}>
        <View style={s.progress} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>{steps.map((step, stepIndex) => <Pressable key={step.eyebrow} onPress={() => setIndex(stepIndex)} accessibilityRole="button" accessibilityLabel={`Go to step ${stepIndex + 1}`} style={[s.dot, stepIndex === index && s.dotOn]} />)}</View>
        <View style={s.actions}>{index > 0 ? <Pressable onPress={() => setIndex((value) => value - 1)} accessibilityRole="button" style={s.back}><Text style={s.backText}>Back</Text></Pressable> : <View />}<Pressable onPress={advance} accessibilityRole="button" style={s.next}><Text style={s.nextText}>{current.action}</Text><Text style={s.nextArrow}>→</Text></Pressable></View>
      </View>
    </SafeAreaView>
  </Modal>;
}

const makeStyles = (c: ThemeColors, compact: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper, paddingHorizontal: 22 },
  topBar: { height: compact ? 56 : 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, spark: { color: c.olive, fontSize: 17 }, wordmark: { color: c.ink, fontSize: 12, fontWeight: '800', letterSpacing: 2.1 }, skip: { paddingHorizontal: 6, paddingVertical: 8 }, skipText: { color: c.muted, fontSize: 13, fontWeight: '600' },
  visualWrap: { height: compact ? 244 : 310, justifyContent: 'center' }, canvas: { flex: 1, borderRadius: 30, backgroundColor: c.canvas, overflow: 'hidden', borderWidth: 1, borderColor: c.line }, canvasHalo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, alignSelf: 'center', top: compact ? 18 : 38, backgroundColor: c.oliveWash }, model: { position: 'absolute', alignSelf: 'center', width: '64%', height: '103%', bottom: -8 }, floatingPiece: { position: 'absolute', width: 62, height: 62, padding: 4, borderRadius: 18, backgroundColor: c.surface, overflow: 'hidden', borderWidth: 1, borderColor: c.line }, pieceLeft: { left: 16, top: '25%', transform: [{ rotate: '-7deg' }] }, pieceRight: { right: 16, top: '52%', transform: [{ rotate: '7deg' }] }, canvasLabel: { position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: c.paper }, canvasLabelText: { color: c.olive, fontSize: 8, fontWeight: '800', letterSpacing: 1.3 },
  rail: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 30, backgroundColor: c.oliveWash, paddingHorizontal: 12 }, railLine: { position: 'absolute', left: 22, right: 22, top: compact ? 43 : 56, height: 2, backgroundColor: c.olive }, railCard: { width: '30%', maxWidth: 104, minHeight: compact ? 136 : 154, borderRadius: 18, paddingTop: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, railCardLift: { transform: [{ translateY: -10 }] }, railCardLabel: { color: c.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.9, marginTop: 8 },
  controls: { flex: 1, borderRadius: 30, backgroundColor: c.canvas, padding: compact ? 18 : 24, justifyContent: 'center' }, controlTitle: { borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: compact ? 14 : 20 }, controlEyebrow: { color: c.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }, controlName: { color: c.ink, fontSize: compact ? 22 : 27, fontWeight: '600', letterSpacing: -0.7, marginTop: 7 }, controlRow: { flexDirection: 'row', gap: 9, marginTop: 14 }, controlChip: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, controlChipIcon: { color: c.olive, fontSize: 16 }, controlChipText: { color: c.ink, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }, generate: { height: 52, borderRadius: 16, marginTop: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: c.ink }, generateSpark: { color: c.paper, fontSize: 17 }, generateText: { flex: 1, color: c.paper, fontSize: 13, fontWeight: '700', marginLeft: 10 }, generateArrow: { color: c.paper, fontSize: 18 },
  compare: { flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: c.canvas }, compareImage: { width: '100%', height: '100%' }, compareTint: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', backgroundColor: 'rgba(109,116,95,0.20)' }, compareDivider: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF' }, compareHandle: { position: 'absolute', width: 42, height: 42, borderRadius: 21, left: -20, top: '43%', alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, borderWidth: 1, borderColor: c.line }, compareHandleText: { color: c.ink, fontSize: 13, fontWeight: '700' }, compareTag: { position: 'absolute', top: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.90)', color: '#31322E', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, compareBefore: { left: 14 }, compareAfter: { right: 14 }, savedBadge: { position: 'absolute', right: 14, bottom: 14, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.ink }, savedBadgeText: { color: c.paper, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  copy: { paddingTop: compact ? 20 : 28, paddingHorizontal: 3 }, eyebrow: { color: c.olive, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }, title: { color: c.ink, fontSize: compact ? 26 : 31, lineHeight: compact ? 31 : 37, fontWeight: '600', letterSpacing: -1, marginTop: 8 }, body: { color: c.muted, fontSize: compact ? 13 : 14, lineHeight: compact ? 19 : 21, marginTop: 9, maxWidth: 490 },
  footer: { flex: 1, minHeight: compact ? 96 : 120, justifyContent: 'flex-end', paddingBottom: compact ? 8 : 14 }, progress: { flexDirection: 'row', gap: 6, marginBottom: compact ? 15 : 20 }, dot: { width: 22, height: 4, borderRadius: 3, backgroundColor: c.line }, dotOn: { width: 40, backgroundColor: c.olive }, actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { minWidth: 64, height: 50, justifyContent: 'center' }, backText: { color: c.muted, fontSize: 13, fontWeight: '700' }, next: { minWidth: 154, height: 52, paddingHorizontal: 19, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, backgroundColor: c.ink }, nextText: { color: c.paper, fontSize: 13, fontWeight: '700' }, nextArrow: { color: c.paper, fontSize: 18 },
});
