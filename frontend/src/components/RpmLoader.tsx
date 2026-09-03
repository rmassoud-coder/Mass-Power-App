// src/components/RpmLoaderFrame.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

const TEXT_WHITE = '#FFFFFF';
const BMW_ORANGE = '#FF5A00';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';

export default function RpmLoaderFrame({ label, engineOn, phaseText, phaseDesc, drlOpacity, beamOpacity, children }: any) {
  const [winWidth, setWinWidth] = useState(Dimensions.get('window').width - 32);
  const w = Math.min(winWidth, 480);
  const leftX = w * 0.27;
  const rightX = w * 0.73;
  const centerY = 38 + Math.min(w * 0.16, 60);

  return (
    <View style={styles.container}>
      <View style={[styles.outerFrame, { maxWidth: 488 }]}>
        <View style={styles.innerGroove}>
          <View style={styles.dashboard} onLayout={(e) => setWinWidth(e.nativeEvent.layout.width - 4)}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>BMW LIVE COCKPIT PROFESSIONAL</Text>
              <View style={styles.headerRight}>
                <Text style={styles.mModeText}>M SPORT MODE</Text>
                <View style={styles.mStripes}>
                  <View style={[styles.stripe, { backgroundColor: M_BLUE }]} />
                  <View style={[styles.stripe, { backgroundColor: M_PURPLE }]} />
                  <View style={[styles.stripe, { backgroundColor: M_RED }]} />
                </View>
              </View>
            </View>
            <View style={[styles.gaugeCluster, { width: w, height: 180 }]}>
              <View style={styles.absoluteCarContainer}>
                <Animated.Image source={require('../assets/m4_shadow_body.jpg')} style={styles.carPhotoBase} resizeMode="contain" />
                <Animated.Image source={require('../assets/vector_drl_glow.png')} style={[styles.carPhotoBase, { opacity: drlOpacity }]} resizeMode="contain" />
                <Animated.Image source={require('../assets/vector_projector_lens_flare.png')} style={[styles.carPhotoBase, { opacity: beamOpacity }]} resizeMode="contain" />
              </View>
              <Svg width={w} height={180} style={styles.svgOverlay}>
                <Defs>
                  <LinearGradient id="clusterBg" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="transparent" /><Stop offset="100%" stopColor="transparent" /></LinearGradient>
                  <RadialGradient id="speedGlow" cx="50%" cy="50%" r="50%"><Stop offset="0%" stopColor="#50B4E6" stopOpacity={0.15} /><Stop offset="100%" stopColor="#50B4E6" stopOpacity={0} /></RadialGradient>
                  <RadialGradient id="rpmGlow" cx="50%" cy="50%" r="50%"><Stop offset="0%" stopColor={BMW_ORANGE} stopOpacity={0.15} /><Stop offset="100%" stopColor={BMW_ORANGE} stopOpacity={0} /></RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={w} height={180} rx={12} fill="url(#clusterBg)" />
                {children(leftX, rightX, centerY, Math.min(w * 0.16, 60))}
              </Svg>
            </View>
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>{phaseText}</Text>
              <Text style={styles.phaseDesc}>{phaseDesc}</Text>
            </View>
            <View style={styles.statusBar}>
              <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_WHITE }]}>{engineOn ? 'ENGINE ON' : 'IGNITION'}</Text>
              <Text style={styles.centerText}>{label}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 16 },
  outerFrame: { width: '100%', borderRadius: 20, padding: 3, backgroundColor: '#3C4250' },
  innerGroove: { borderRadius: 17, padding: 2, backgroundColor: '#05060A' },
  dashboard: { width: '100%', backgroundColor: '#0A0B0E', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: '#22262f', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#1A1D24' },
  headerTitle: { fontSize: 9, color: TEXT_WHITE, fontWeight: '700', letterSpacing: 1.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mModeText: { fontSize: 8, color: '#FF0000', fontWeight: '800', letterSpacing: 1 },
  mStripes: { flexDirection: 'row', gap: 1.5 },
  stripe: { width: 8, height: 2.5, borderRadius: 1.5 },
  gaugeCluster: { alignSelf: 'center', position: 'relative' },
  absoluteCarContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1, justifyContent: 'center', alignItems: 'center' },
  carPhotoBase: { position: 'absolute', width: '62%', height: '100%', top: 0 },
  svgOverlay: { zIndex: 2, backgroundColor: 'transparent' },
  phaseContainer: { marginTop: 12, padding: 8, backgroundColor: 'rgba(20, 24, 32, 0.4)', borderRadius: 6, alignItems: 'center' },
  phaseTitle: { fontSize: 10, color: BMW_ORANGE, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  phaseDesc: { fontSize: 8, color: TEXT_WHITE, textAlign: 'center' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 8, backgroundColor: 'rgba(20, 24, 32, 0.4)', borderRadius: 6 },
  statusText: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  centerText: { fontSize: 8, color: TEXT_WHITE, fontWeight: '600' },
});
// src/components/RpmLoader.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Animated } from 'react-native';
import { useSharedValue, useDerivedValue, withTiming, withSequence, withDelay, Easing, runOnJS } from 'react-native-reanimated';
import RpmLoaderFrame from './RpmLoaderFrame';
import SpeedGauge from './SpeedGauge';
import RpmGauge from './RpmGauge';

const MAX_RPM = 8500;
const TOTAL_ANIMATION_MS = 7200;

export default function RpmLoader({ label = 'STARTING ENGINE...', onComplete }: any) {
  const speed = useSharedValue(0);
  const rpm = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [speedProgress, setSpeedProgress] = useState(0);
  const [rpmProgress, setRpmProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);

  const headlightDrlOpacity = useRef(new Animated.Value(0)).current;
  const headlightBeamOpacity = useRef(new Animated.Value(0)).current;

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Loading data and frameworks' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Loading customer database' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Sugar and Spice and everything Nice' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Almost There' },
    { label: 'M SPORT MODE', desc: 'Reached destination SAFELY' },
  ];

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(headlightDrlOpacity, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(headlightBeamOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(headlightDrlOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
      ])
    ]).start();

    speed.value = withSequence(
      withTiming(0.02, { duration: 340, easing: Easing.out(Easing.cubic) }),
      withTiming(0.17, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.34, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.5, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.67, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withDelay(850, withTiming(0.67, { duration: 1 }))
    );

    rpm.value = withSequence(
      withTiming(800, { duration: 340, easing: Easing.out(Easing.cubic) }),
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(4500, { duration: 255, easing: Easing.inOut(Easing.quad) }),
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(4800, { duration: 255, easing: Easing.inOut(Easing.quad) }),
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(5200, { duration: 255, easing: Easing.inOut(Easing.quad) }),
      withTiming(6200, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(5000, { duration: 255, easing: Easing.inOut(Easing.quad) }),
      withDelay(850, withTiming(5000, { duration: 1 }))
    );

    const onTimer = setTimeout(() => setEngineOn(true), 400);
    const doneTimer = setTimeout(() => onComplete?.(), TOTAL_ANIMATION_MS);
    return () => { clearTimeout(onTimer); clearTimeout(doneTimer); };
  }, []);

  useDerivedValue(() => {
    const sp = speed.value;
    const rp = rpm.value;
    const speedKmh = Math.round(sp * 240);

    runOnJS(setSpeedProgress)(sp);
    runOnJS(setRpmProgress)(Math.min(rp / MAX_RPM, 1));
    runOnJS(setDisplaySpeed)(speedKmh);
    runOnJS(setDisplayRpm)(Math.round(rp));

    let pIdx = 0;
    if (speedKmh > 140) pIdx = 4;
    else if (speedKmh > 100) pIdx = 3;
    else if (speedKmh > 60) pIdx = 2;
    else if (speedKmh > 20) pIdx = 1;
    runOnJS(setPhaseIdx)(pIdx);
  }, [speed, rpm]);

  return (
    <RpmLoaderFrame label={label} engineOn={engineOn} phaseText={phases[phaseIdx]?.label} phaseDesc={phases[phaseIdx]?.desc} drlOpacity={headlightDrlOpacity} beamOpacity={headlightBeamOpacity}>
      {(leftX: number, rightX: number, centerY: number, gaugeR: number) => (
        <>
          <SpeedGauge cx={leftX} cy={centerY} r={gaugeR} progress={speedProgress} value={displaySpeed} />
          <RpmGauge cx={rightX} cy={centerY} r={gaugeR} progress={rpmProgress} value={displayRpm} />
        </>
      )}
    </RpmLoaderFrame>
  );
}

// src/components/SpeedGauge.tsx
import React from 'react';
import { Line, Circle, Text as SvgText, Path } from 'react-native-svg';

const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A95A8';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function SpeedGauge({ cx, cy, r, progress, value }: any) {
  const segments = 50;
  const startAngle = -150;
  const endAngle = 120;
  const nodes = [];

  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029" strokeWidth={8} fill="none"
    />
  );

  let tipColor = BMW_LT_BLUE;
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const active = ratio <= progress;

    let color = BMW_LT_BLUE;
    if (ratio > 0.6 && ratio < 0.8) color = BMW_ORANGE;
    else if (ratio >= 0.8) color = BMW_RED;
    if (active) tipColor = color;

    nodes.push(
      <Circle key={i} cx={p1.x} cy={p1.y} r={3.5} fill={active ? color : '#1A2029'} opacity={active ? 1 : 0.2} />
    );
  }

  const tipAngle = startAngle + progress * (endAngle - startAngle);
  const needleInner = pt(cx, cy, r * 0.48, tipAngle);
  const needleOuter = pt(cx, cy, r * 0.94, tipAngle);
  
  nodes.push(<Line key="needle" x1={needleInner.x} y1={needleInner.y} x2={needleOuter.x} y2={needleOuter.y} stroke={TEXT_WHITE} strokeWidth={1.5} opacity={0.85} />);
  nodes.push(<Circle key="glow" cx={cx} cy={cy} r={r * 0.5} fill="url(#speedGlow)" />);
  nodes.push(<SvgText key="value" x={cx} y={cy + r * 0.14} fill={TEXT_WHITE} fontSize={20} fontWeight="900" textAnchor="middle">{value}</SvgText>);
  nodes.push(<SvgText key="unit" x={cx} y={cy + r * 0.44} fill={TEXT_GRAY} fontSize={8} fontWeight="600" textAnchor="middle">km/h</SvgText>);

  return <>{nodes}</>;
}
// src/components/RpmGauge.tsx
import React from 'react';
import { Line, Circle, Text as SvgText, Path } from 'react-native-svg';

const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A95A8';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function RpmGauge({ cx, cy, r, progress, value }: any) {
  const segments = 50;
  const startAngle = 150;
  const endAngle = -120;
  const nodes = [];

  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 0 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029" strokeWidth={8} fill="none"
    />
  );

  let tipColor = BMW_ORANGE;
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle - ratio * (startAngle - endAngle);
    const p1 = pt(cx, cy, r, a1);
    const active = ratio <= progress;

    let color = BMW_ORANGE;
    if (ratio > 0.7) color = BMW_RED;
    if (active) tipColor = color;

    nodes.push(
      <Circle key={i} cx={p1.x} cy={p1.y} r={3.5} fill={active ? color : '#1A2029'} opacity={active ? 1 : 0.2} />
    );
  }

  const tipAngle = startAngle - progress * (startAngle - endAngle);
  const needleInner = pt(cx, cy, r * 0.48, tipAngle);
  const needleOuter = pt(cx, cy, r * 0.94, tipAngle);
  
  nodes.push(<Line key="needle" x1={needleInner.x} y1={needleInner.y} x2={needleOuter.x} y2={needleOuter.y} stroke={TEXT_WHITE} strokeWidth={1.5} opacity={0.85} />);
  nodes.push(<Circle key="glow" cx={cx} cy={cy} r={r * 0.5} fill="url(#rpmGlow)" />);
  nodes.push(<SvgText key="value" x={cx} y={cy + r * 0.14} fill={BMW_ORANGE} fontSize={20} fontWeight="900" textAnchor="middle">{value}</SvgText>);
  nodes.push(<SvgText key="unit" x={cx} y={cy + r * 0.44} fill={TEXT_GRAY} fontSize={8} fontWeight="600" textAnchor="middle">RPM</SvgText>);

  return <>{nodes}</>;
}
