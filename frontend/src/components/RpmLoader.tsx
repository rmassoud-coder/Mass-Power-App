// src/components/RpmLoader.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, {
  Line,
  Circle,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';

interface Props {
  label?: string;
  /** Optional max width cap (px). Component always shrinks to fit its container first. */
  size?: number;
  onComplete?: () => void;
}

const BG_DARK = '#0A0B0E';
const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A95A8';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';
const MAX_RPM = 8500;
const TOTAL_ANIMATION_MS = 12500;

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function SpeedGauge({
  cx,
  cy,
  r,
  progress,
  value,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: number;
  value: number;
}) {
  const segments = 50;
  const startAngle = -150;
  const endAngle = 120;
  const nodes = [];

  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={8}
      fill="none"
    />
  );

  let tipColor = BMW_LT_BLUE;
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;

    let color = BMW_LT_BLUE;
    if (ratio > 0.6 && ratio < 0.8) color = BMW_ORANGE;
    else if (ratio >= 0.8) color = BMW_RED;
    if (active) tipColor = color;

    nodes.push(
      <Line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={active ? color : '#1A2029'}
        strokeWidth={8}
        strokeLinecap="round"
        opacity={active ? 1 : 0.2}
      />
    );
  }

  // Glowing tip marker at the current value — real clusters light the leading edge.
  const tip = pt(cx, cy, r, startAngle + progress * (endAngle - startAngle));
  nodes.push(<Circle key="tipGlow" cx={tip.x} cy={tip.y} r={7} fill={tipColor} opacity={0.35} />);
  nodes.push(<Circle key="tipDot" cx={tip.x} cy={tip.y} r={3} fill={tipColor} />);

  const tickValues = [0, 40, 80, 120, 160, 200, 240];
  for (let i = 0; i < tickValues.length; i++) {
    const ratio = i / (tickValues.length - 1);
    const angle = startAngle + ratio * (endAngle - startAngle);
    const inner = pt(cx, cy, r - 18, angle);
    const outer = pt(cx, cy, r - 10, angle);
    const label = pt(cx, cy, r - 30, angle);

    nodes.push(
      <Line key={`t${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={TEXT_WHITE} strokeWidth={2.5} strokeLinecap="round" />
    );
    nodes.push(
      <SvgText key={`l${i}`} x={label.x} y={label.y + 4} fill={TEXT_WHITE} fontSize={10} fontWeight="600" textAnchor="middle">
        {tickValues[i]}
      </SvgText>
    );
  }

  nodes.push(
    <SvgText key="value" x={cx} y={cy + 10} fill={TEXT_WHITE} fontSize={32} fontWeight="900" textAnchor="middle">
      {value}
    </SvgText>
  );
  nodes.push(
    <SvgText key="unit" x={cx} y={cy + 30} fill={TEXT_WHITE} fontSize={10} fontWeight="600" textAnchor="middle" letterSpacing="2">
      km/h
    </SvgText>
  );

  return <>{nodes}</>;
}

function RpmGauge({
  cx,
  cy,
  r,
  progress,
  value,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: number;
  value: number;
}) {
  const segments = 50;
  const startAngle = 150;
  const endAngle = -120;
  const nodes = [];

  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 0 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={8}
      fill="none"
    />
  );

  let tipColor = BMW_ORANGE;
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle - ratio * (startAngle - endAngle);
    const a2 = startAngle - ((i + 1) / segments) * (startAngle - endAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;

    let color = BMW_ORANGE;
    if (ratio > 0.7) color = BMW_RED;
    if (active) tipColor = color;

    nodes.push(
      <Line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={active ? color : '#1A2029'}
        strokeWidth={8}
        strokeLinecap="round"
        opacity={active ? 1 : 0.2}
      />
    );
  }

  const tip = pt(cx, cy, r, startAngle - progress * (startAngle - endAngle));
  nodes.push(<Circle key="tipGlow" cx={tip.x} cy={tip.y} r={7} fill={tipColor} opacity={0.35} />);
  nodes.push(<Circle key="tipDot" cx={tip.x} cy={tip.y} r={3} fill={tipColor} />);

  const tickValues = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < tickValues.length; i++) {
    const ratio = i / (tickValues.length - 1);
    const angle = startAngle - ratio * (startAngle - endAngle);
    const inner = pt(cx, cy, r - 18, angle);
    const outer = pt(cx, cy, r - 10, angle);
    const label = pt(cx, cy, r - 30, angle);

    nodes.push(
      <Line key={`t${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={TEXT_WHITE} strokeWidth={2.5} strokeLinecap="round" />
    );
    nodes.push(
      <SvgText key={`l${i}`} x={label.x} y={label.y + 4} fill={TEXT_WHITE} fontSize={10} fontWeight="600" textAnchor="middle">
        {tickValues[i]}
      </SvgText>
    );
  }

  nodes.push(
    <SvgText key="value" x={cx} y={cy + 10} fill={BMW_ORANGE} fontSize={32} fontWeight="900" textAnchor="middle">
      {value}
    </SvgText>
  );
  nodes.push(
    <SvgText key="unit" x={cx} y={cy + 30} fill={TEXT_WHITE} fontSize={10} fontWeight="600" textAnchor="middle" letterSpacing="2">
      RPM
    </SvgText>
  );

  return <>{nodes}</>;
}

function FuelGauge({ cx, cy, r, value }: { cx: number; cy: number; r: number; value: number }) {
  const startAngle = -120;
  const endAngle = 120;
  const progress = value / 100;
  const bgPath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`;
  const activeAngle = startAngle + progress * (endAngle - startAngle);
  const activePath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, activeAngle).x} ${pt(cx, cy, r, activeAngle).y}`;
  const fuelColor = value < 20 ? BMW_RED : BMW_ORANGE;

  return (
    <G>
      <Path d={bgPath} stroke="#1A2029" strokeWidth={4} fill="none" />
      <Path d={activePath} stroke={fuelColor} strokeWidth={4} fill="none" strokeLinecap="round" />
      <SvgText x={pt(cx, cy, r + 16, startAngle).x} y={pt(cx, cy, r + 16, startAngle).y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="700" textAnchor="middle">E</SvgText>
      <SvgText x={pt(cx, cy, r + 16, endAngle).x} y={pt(cx, cy, r + 16, endAngle).y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="700" textAnchor="middle">F</SvgText>
      <SvgText x={cx} y={cy + 5} fill={TEXT_WHITE} fontSize={14} fontWeight="700" textAnchor="middle">{Math.round(value)}%</SvgText>
      <SvgText x={cx} y={cy + 20} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle" letterSpacing="1">FUEL</SvgText>
    </G>
  );
}

function TempGauge({ cx, cy, r, value }: { cx: number; cy: number; r: number; value: number }) {
  const startAngle = -120;
  const endAngle = 120;
  const progress = Math.min(Math.max((value - 40) / 80, 0), 1); // scale now matches the 50°-120° labels
  const bgPath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`;
  const activeAngle = startAngle + progress * (endAngle - startAngle);
  const activePath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, activeAngle).x} ${pt(cx, cy, r, activeAngle).y}`;
  const tempColor = value > 100 ? BMW_RED : value > 90 ? BMW_ORANGE : value < 60 ? BMW_LT_BLUE : GREEN;

  return (
    <G>
      <Path d={bgPath} stroke="#1A2029" strokeWidth={4} fill="none" />
      <Path d={activePath} stroke={tempColor} strokeWidth={4} fill="none" strokeLinecap="round" />
      <SvgText x={pt(cx, cy, r + 16, startAngle).x} y={pt(cx, cy, r + 16, startAngle).y + 4} fill={TEXT_WHITE} fontSize={8} fontWeight="600" textAnchor="middle">50°</SvgText>
      <SvgText x={pt(cx, cy, r + 16, endAngle).x} y={pt(cx, cy, r + 16, endAngle).y + 4} fill={TEXT_WHITE} fontSize={8} fontWeight="600" textAnchor="middle">120°</SvgText>
      <SvgText x={cx} y={cy + 5} fill={TEXT_WHITE} fontSize={14} fontWeight="700" textAnchor="middle">{Math.round(value)}°</SvgText>
      <SvgText x={cx} y={cy + 20} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle" letterSpacing="1">TEMP</SvgText>
    </G>
  );
}

export default function RpmLoader({ label = 'STARTING ENGINE...', size, onComplete }: Props) {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 32);
  const speed = useSharedValue(0);
  const rpm = useSharedValue(0);
  const tempSV = useSharedValue(42);

  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [speedProgress, setSpeedProgress] = useState(0);
  const [rpmProgress, setRpmProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [fuelLevel, setFuelLevel] = useState(65);
  const [tempLevel, setTempLevel] = useState(42); // cold start — climbs to operating temp below

  // Gear is *derived* from the speed phase, not tracked separately — there's
  // no reason for it to be its own timer when it's fully determined by speed.
  const gear = String(animationPhase + 1);

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Premium aluminum frame with precision engineering' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Authentic BMW M sport instrument cluster' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Dynamic color zones for optimal readability' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Real-time performance data at your fingertips' },
    { label: 'M SPORT MODE', desc: 'Track-focused instrumentation with M performance' },
  ];

  useEffect(() => {
    // Speed climbs monotonically — a car does not slow down when it shifts up.
    // (RPM below is the one that's supposed to dip at each shift.)
    speed.value = withSequence(
      withTiming(0.02, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withTiming(0.17, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.34, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.5, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.67, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      withDelay(3000, withTiming(0.67, { duration: 1 }))
    );
  }, [speed]);

  useEffect(() => {
    rpm.value = withSequence(
      withTiming(800, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(4500, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(4800, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(5200, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      withTiming(6200, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(5000, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      withDelay(3000, withTiming(5000, { duration: 1 }))
    );
  }, [rpm]);

  // Cold-start ramp for temp, then a slow smooth idle drift — animated like
  // speed/rpm (via a shared value) instead of discrete random jumps, so it
  // interpolates instead of snapping.
  useEffect(() => {
    tempSV.value = withSequence(
      withTiming(88, { duration: 4000, easing: Easing.out(Easing.quad) }),
      withTiming(93, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      withTiming(89, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      withDelay(1000, withTiming(91, { duration: 2000, easing: Easing.inOut(Easing.sin) }))
    );
  }, [tempSV]);

  useEffect(() => {
    const fuelInterval = setInterval(() => {
      setFuelLevel((prev) => Math.max(10, prev - Math.random() * 0.3));
    }, 2000);
    return () => clearInterval(fuelInterval);
  }, []);

  useEffect(() => {
    const onTimer = setTimeout(() => setEngineOn(true), 400);
    const doneTimer = setTimeout(() => onComplete?.(), TOTAL_ANIMATION_MS);
    return () => {
      clearTimeout(onTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  useDerivedValue(() => {
    const sp = speed.value;
    const rp = rpm.value;
    const speedKmh = Math.round(sp * 240);

    runOnJS(setSpeedProgress)(sp);
    runOnJS(setRpmProgress)(Math.min(rp / MAX_RPM, 1));
    runOnJS(setDisplaySpeed)(speedKmh);
    runOnJS(setDisplayRpm)(Math.round(rp));
    runOnJS(setTempLevel)(tempSV.value);

    let phaseIndex = 0;
    if (speedKmh > 140) phaseIndex = 4;
    else if (speedKmh > 100) phaseIndex = 3;
    else if (speedKmh > 60) phaseIndex = 2;
    else if (speedKmh > 20) phaseIndex = 1;
    runOnJS(setAnimationPhase)(phaseIndex);
  }, [speed, rpm, tempSV]);

  const outerMaxWidth = size ? Math.min(size, 480) : 480;
  const gaugeWidth = Math.min(containerWidth, outerMaxWidth);
  const gaugeHeight = gaugeWidth * 0.52;
  const centerY = gaugeHeight * 0.45;
  const gaugeR = Math.min(gaugeWidth * 0.19, 70);
  const leftX = gaugeWidth * 0.27;
  const rightX = gaugeWidth * 0.73;
  const centerX = gaugeWidth * 0.5;
  const fuelX = gaugeWidth * 0.28;
  const tempX = gaugeWidth * 0.72;
  const fuelTempY = gaugeHeight * 0.82;
  const smallGaugeR = gaugeR * 0.6;

  return (
    <View style={styles.container}>
      {/* Bezel: metal frame -> dark groove -> panel, mimicking a real cluster housing */}
      <View style={[styles.outerFrame, { maxWidth: outerMaxWidth + 8 }]}>
        <View style={styles.innerGroove}>
          <View
            style={styles.dashboard}
            onLayout={(e) => {
              const measured = e.nativeEvent.layout.width - 4;
              // Never trust a measured width larger than the actual device
              // window — some preview/emulator surfaces report their own
              // (wider) canvas rather than the visible phone frame.
              const safe = Math.min(measured, Dimensions.get('window').width - 32);
              setContainerWidth(safe);
            }}
          >
            <View style={styles.topSheen} pointerEvents="none" />

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
                  BMW LIVE COCKPIT PROFESSIONAL
                </Text>
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.mModeText} numberOfLines={1}>M SPORT MODE</Text>
                <View style={styles.mStripes}>
                  <View style={[styles.stripe, { backgroundColor: M_BLUE }]} />
                  <View style={[styles.stripe, { backgroundColor: M_PURPLE }]} />
                  <View style={[styles.stripe, { backgroundColor: M_RED }]} />
                </View>
              </View>
            </View>

            <View style={[styles.gaugeCluster, { width: gaugeWidth, height: gaugeHeight }]}>
              <Svg width={gaugeWidth} height={gaugeHeight}>
                <Defs>
                  <LinearGradient id="clusterBg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#141820" />
                    <Stop offset="100%" stopColor="#0A0B0E" />
                  </LinearGradient>
                </Defs>

                <Rect x={0} y={0} width={gaugeWidth} height={gaugeHeight} rx={12} fill="url(#clusterBg)" />
                <Rect x={1} y={1} width={gaugeWidth - 2} height={gaugeHeight - 2} rx={11} fill="none" stroke="#2A3448" strokeWidth={0.5} />

                <SpeedGauge cx={leftX} cy={centerY} r={gaugeR} progress={speedProgress} value={displaySpeed} />
                <RpmGauge cx={rightX} cy={centerY} r={gaugeR} progress={rpmProgress} value={displayRpm} />

                <G>
                  <Path d={`M ${centerX - 40} ${centerY - 40} L ${centerX} ${centerY - 58} L ${centerX + 40} ${centerY - 40} L ${centerX} ${centerY - 22} Z`} stroke="#2A3448" strokeWidth={0.5} fill="none" opacity={0.5} />
                  <Path d={`M ${centerX - 40} ${centerY + 40} L ${centerX} ${centerY + 58} L ${centerX + 40} ${centerY + 40} L ${centerX} ${centerY + 22} Z`} stroke="#2A3448" strokeWidth={0.5} fill="none" opacity={0.5} />
                  <Path d={`M ${centerX - 58} ${centerY} L ${centerX - 40} ${centerY - 40} L ${centerX - 22} ${centerY} L ${centerX - 40} ${centerY + 40} Z`} stroke="#2A3448" strokeWidth={0.5} fill="none" opacity={0.5} />
                  <Path d={`M ${centerX + 58} ${centerY} L ${centerX + 40} ${centerY - 40} L ${centerX + 22} ${centerY} L ${centerX + 40} ${centerY + 40} Z`} stroke="#2A3448" strokeWidth={0.5} fill="none" opacity={0.5} />
                  <Circle cx={centerX} cy={centerY} r={30} fill="#0A0B0E" stroke="#2A3448" strokeWidth={1.5} />
                  <Circle cx={centerX} cy={centerY} r={26} fill="none" stroke="#3A4A5A" strokeWidth={0.5} opacity={0.5} />
                  <SvgText x={centerX} y={centerY + 6} fill={BMW_RED} fontSize={18} fontWeight="900" textAnchor="middle">{gear}</SvgText>
                </G>

                <FuelGauge cx={fuelX} cy={fuelTempY} r={smallGaugeR} value={fuelLevel} />
                <TempGauge cx={tempX} cy={fuelTempY} r={smallGaugeR} value={tempLevel} />
              </Svg>
            </View>

            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle} numberOfLines={1}>{phases[animationPhase]?.label || ''}</Text>
              <Text style={styles.phaseDesc} numberOfLines={2}>{phases[animationPhase]?.desc || ''}</Text>
            </View>

            <View style={styles.bottomBar}>
              <View style={styles.barSection}>
                <Text style={styles.barLabel}>OIL</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: '85%', backgroundColor: BMW_LT_BLUE }]} /></View>
              </View>
              <View style={styles.barSection}>
                <Text style={styles.barLabel}>BATTERY</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: '92%', backgroundColor: GREEN }]} /></View>
              </View>
              <View style={styles.barSection}>
                <Text style={styles.barLabel}>BRAKE</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: '100%', backgroundColor: BMW_ORANGE }]} /></View>
              </View>
            </View>

            <View style={styles.settingsContainer}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel} numberOfLines={1}>Cockpit Layout Theme</Text>
                <View style={styles.themeIndicators}>
                  <View style={[styles.themeDot, { backgroundColor: BMW_RED }]} />
                  <View style={[styles.themeDot, { backgroundColor: BMW_ORANGE }]} />
                  <View style={[styles.themeDot, { backgroundColor: BMW_LT_BLUE }]} />
                  <View style={[styles.themeDot, { backgroundColor: GREEN }]} />
                </View>
              </View>
            </View>

            <View style={styles.statusBar}>
              <View style={styles.statusLeft}>
                <View style={[styles.bulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
                <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_WHITE }]} numberOfLines={1}>
                  {engineOn ? 'ENGINE ON' : 'IGNITION'}
                </Text>
              </View>
              <Text style={styles.centerText} numberOfLines={1}>
                {displaySpeed > 0 ? `${displaySpeed} km/h` : label}
              </Text>
              <Text style={styles.rightText} numberOfLines={1}>12,847 km</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    overflow: 'hidden',
  },
  // Brushed-metal outer ring
  outerFrame: {
    width: '100%',
    borderRadius: 20,
    padding: 3,
    backgroundColor: '#3C4250',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  // Recessed dark groove between the metal ring and the panel
  innerGroove: {
    borderRadius: 17,
    padding: 2,
    backgroundColor: '#05060A',
  },
  dashboard: {
    width: '100%',
    backgroundColor: '#0A0B0E',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#22262f',
    overflow: 'hidden',
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1D24',
    marginBottom: 4,
  },
  headerLeft: { flexShrink: 1, marginRight: 8 },
  headerTitle: { fontSize: 9, color: TEXT_WHITE, fontWeight: '700', letterSpacing: 1.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  mModeText: { fontSize: 8, color: M_RED, fontWeight: '800', letterSpacing: 1 },
  mStripes: { flexDirection: 'row', gap: 1.5 },
  stripe: { width: 8, height: 2.5, borderRadius: 1.5 },
  gaugeCluster: { alignSelf: 'center', marginVertical: 2 },
  phaseContainer: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(20, 24, 32, 0.4)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#1A1D24',
    alignItems: 'center',
  },
  phaseTitle: { fontSize: 10, color: BMW_ORANGE, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  phaseDesc: { fontSize: 8, color: TEXT_WHITE, fontWeight: '400', letterSpacing: 0.5, textAlign: 'center' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2, gap: 12 },
  barSection: { flex: 1 },
  barLabel: { fontSize: 8, color: TEXT_WHITE, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  barTrack: { height: 3.5, borderRadius: 2, backgroundColor: '#1A2029', overflow: 'hidden', borderWidth: 0.5, borderColor: '#2A3448' },
  barFill: { height: '100%', borderRadius: 2 },
  settingsContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(20, 24, 32, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#1A1D24',
  },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsLabel: { fontSize: 7, color: TEXT_WHITE, fontWeight: '600', letterSpacing: 0.5, flexShrink: 1, marginRight: 6 },
  themeIndicators: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  themeDot: { width: 8, height: 8, borderRadius: 4 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(20, 24, 32, 0.4)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#1A1D24',
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  bulb: { width: 5, height: 5, borderRadius: 2.5 },
  bulbOn: { backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 1, shadowRadius: 4 },
  bulbOff: { backgroundColor: '#4A5568' },
  statusText: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  centerText: { fontSize: 8, color: TEXT_WHITE, fontWeight: '600', letterSpacing: 0.5, flexShrink: 1, textAlign: 'center' },
  rightText: { fontSize: 8, color: TEXT_WHITE, fontWeight: '600', flexShrink: 0 },
});
