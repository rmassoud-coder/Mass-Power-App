// src/components/RpmLoader.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolateColor,
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Line,
  Circle,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient,
  RadialGradient,
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
const INACTIVE_SEGMENT = '#1A2029';
const MAX_RPM = 8500;
// Matches the actual longest gauge sequence (RPM) below, so onComplete
// fires once the animation has genuinely settled instead of mid-motion.
const TOTAL_ANIMATION_MS = 6300;
const REDLINE_THRESHOLD = 0.85; // ratio of RPM sweep considered "redline"

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Angle->point on a circle. Marked worklet so it can run on the UI thread
 * inside useAnimatedProps as well as being called from plain JS for the
 * static tick marks. */
function pt(cx: number, cy: number, r: number, deg: number) {
  'worklet';
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * A single tick segment. Its color/opacity are driven entirely by the
 * shared `progress` value via useAnimatedProps, so lighting up the sweep
 * never triggers a React re-render or crosses the JS bridge.
 */
function GaugeSegment({
  x1,
  y1,
  x2,
  y2,
  ratio,
  progress,
  activeColor,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ratio: number;
  progress: SharedValue<number>;
  activeColor: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const active = progress.value >= ratio;
    return {
      stroke: active ? activeColor : INACTIVE_SEGMENT,
      opacity: active ? 1 : 0.2,
    };
  });
  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      strokeWidth={8}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

/** Needle + tip dot/glow, fully UI-thread driven off the shared progress value. */
function GaugeNeedle({
  cx,
  cy,
  r,
  progress,
  startAngle,
  endAngle,
  colorForRatio,
  redlinePulse,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: SharedValue<number>;
  startAngle: number;
  endAngle: number;
  colorForRatio: (ratio: number) => string;
  redlinePulse?: SharedValue<number>;
}) {
  const needleProps = useAnimatedProps(() => {
    const angle = startAngle + progress.value * (endAngle - startAngle);
    const inner = pt(cx, cy, r * 0.48, angle);
    const outer = pt(cx, cy, r * 0.94, angle);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
  });

  const tipDotProps = useAnimatedProps(() => {
    const angle = startAngle + progress.value * (endAngle - startAngle);
    const tip = pt(cx, cy, r, angle);
    return { cx: tip.x, cy: tip.y, fill: colorForRatio(progress.value) };
  });

  const tipGlowProps = useAnimatedProps(() => {
    const angle = startAngle + progress.value * (endAngle - startAngle);
    const tip = pt(cx, cy, r, angle);
    const pulse = redlinePulse ? redlinePulse.value : 0;
    const inRedline = progress.value >= REDLINE_THRESHOLD;
    const baseOpacity = 0.35;
    const opacity = inRedline ? baseOpacity + pulse * 0.35 : baseOpacity;
    const radius = inRedline ? 7 + pulse * 2.5 : 7;
    return { cx: tip.x, cy: tip.y, fill: colorForRatio(progress.value), opacity, r: radius };
  });

  return (
    <>
      <AnimatedCircle animatedProps={tipGlowProps} r={7} />
      <AnimatedCircle animatedProps={tipDotProps} r={3} />
      <AnimatedLine animatedProps={needleProps} stroke={TEXT_WHITE} strokeWidth={1.5} opacity={0.85} strokeLinecap="round" />
    </>
  );
}

function speedColorForRatio(ratio: number) {
  'worklet';
  if (ratio >= 0.8) return BMW_RED;
  if (ratio > 0.6) return BMW_ORANGE;
  return BMW_LT_BLUE;
}

function rpmColorForRatio(ratio: number) {
  'worklet';
  return ratio > 0.7 ? BMW_RED : BMW_ORANGE;
}

function SpeedGauge({
  cx,
  cy,
  r,
  progress,
  valueText,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: SharedValue<number>;
  valueText: string;
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

  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    nodes.push(
      <GaugeSegment
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        ratio={ratio}
        progress={progress}
        activeColor={speedColorForRatio(ratio)}
      />
    );
  }

  nodes.push(
    <GaugeNeedle
      key="needle"
      cx={cx}
      cy={cy}
      r={r}
      progress={progress}
      startAngle={startAngle}
      endAngle={endAngle}
      colorForRatio={speedColorForRatio}
    />
  );

  const tickValues = [0, 40, 80, 120, 160, 200, 240];
  for (let i = 0; i < tickValues.length; i++) {
    const ratio = i / (tickValues.length - 1);
    const angle = startAngle + ratio * (endAngle - startAngle);
    const inner = pt(cx, cy, r * 0.74, angle);
    const outer = pt(cx, cy, r * 0.86, angle);
    const label = pt(cx, cy, r * 0.58, angle);

    nodes.push(
      <Line key={`t${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={TEXT_WHITE} strokeWidth={2.5} strokeLinecap="round" />
    );
    nodes.push(
      <SvgText key={`l${i}`} x={label.x} y={label.y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle">
        {tickValues[i]}
      </SvgText>
    );
  }

  const valueFontSize = Math.max(18, Math.round(r * 0.34));
  const unitFontSize = Math.max(8, Math.round(r * 0.12));

  nodes.push(<Circle key="glow" cx={cx} cy={cy} r={r * 0.5} fill="url(#speedGlow)" />);
  nodes.push(
    <SvgText key="valueShadow" x={cx + 1} y={cy + r * 0.14 + 1} fill="#000" opacity={0.35} fontSize={valueFontSize} fontWeight="900" textAnchor="middle">
      {valueText}
    </SvgText>
  );
  nodes.push(
    <SvgText key="value" x={cx} y={cy + r * 0.14} fill={TEXT_WHITE} fontSize={valueFontSize} fontWeight="900" textAnchor="middle">
      {valueText}
    </SvgText>
  );
  nodes.push(
    <SvgText key="unit" x={cx} y={cy + r * 0.44} fill={TEXT_GRAY} fontSize={unitFontSize} fontWeight="600" textAnchor="middle" letterSpacing="2">
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
  valueText,
  redlinePulse,
}: {
  cx: number;
  cy: number;
  r: number;
  progress: SharedValue<number>;
  valueText: string;
  redlinePulse: SharedValue<number>;
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

  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle - ratio * (startAngle - endAngle);
    const a2 = startAngle - ((i + 1) / segments) * (startAngle - endAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    nodes.push(
      <GaugeSegment
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        ratio={ratio}
        progress={progress}
        activeColor={rpmColorForRatio(ratio)}
      />
    );
  }

  nodes.push(
    <GaugeNeedle
      key="needle"
      cx={cx}
      cy={cy}
      r={r}
      progress={progress}
      startAngle={startAngle}
      endAngle={endAngle}
      colorForRatio={rpmColorForRatio}
      redlinePulse={redlinePulse}
    />
  );

  const tickValues = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < tickValues.length; i++) {
    const ratio = i / (tickValues.length - 1);
    const angle = startAngle - ratio * (startAngle - endAngle);
    const inner = pt(cx, cy, r * 0.74, angle);
    const outer = pt(cx, cy, r * 0.86, angle);
    const label = pt(cx, cy, r * 0.58, angle);

    nodes.push(
      <Line key={`t${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={TEXT_WHITE} strokeWidth={2.5} strokeLinecap="round" />
    );
    nodes.push(
      <SvgText key={`l${i}`} x={label.x} y={label.y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle">
        {tickValues[i]}
      </SvgText>
    );
  }

  const valueFontSize = Math.max(18, Math.round(r * 0.34));
  const unitFontSize = Math.max(8, Math.round(r * 0.12));

  nodes.push(<Circle key="glow" cx={cx} cy={cy} r={r * 0.5} fill="url(#rpmGlow)" />);
  nodes.push(
    <SvgText key="valueShadow" x={cx + 1} y={cy + r * 0.14 + 1} fill="#000" opacity={0.35} fontSize={valueFontSize} fontWeight="900" textAnchor="middle">
      {valueText}
    </SvgText>
  );
  nodes.push(
    <SvgText key="value" x={cx} y={cy + r * 0.14} fill={BMW_ORANGE} fontSize={valueFontSize} fontWeight="900" textAnchor="middle">
      {valueText}
    </SvgText>
  );
  nodes.push(
    <SvgText key="unit" x={cx} y={cy + r * 0.44} fill={TEXT_GRAY} fontSize={unitFontSize} fontWeight="600" textAnchor="middle" letterSpacing="2">
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
  const progress = Math.min(Math.max((value - 40) / 80, 0), 1);
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

/** Animated fill bar for OIL/BATTERY/BRAKE that grows in on mount instead of
 * snapping to its final width instantly. */
function StatusBar({ label, targetPct, color, delay }: { label: string; targetPct: number; color: string; delay: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(delay, withTiming(targetPct, { duration: 600, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.barSection}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

export default function RpmLoader({ label = 'STARTING ENGINE...', size, onComplete }: Props) {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 32);
  const speed = useSharedValue(0);
  const rpm = useSharedValue(0);
  const tempSV = useSharedValue(42);
  const redlinePulse = useSharedValue(0);
  // Hoisted once, not recreated every render — was previously called inline
  // in JSX (`progress={useDerivedValue(...)}`), which allocated a fresh
  // derived value on every re-render and could desync the needle.
  const rpmProgress = useDerivedValue(() => Math.min(rpm.value / MAX_RPM, 1), [rpm]);

  // Throttled display state — updated a few times a second instead of every
  // animation frame, so text updates stay cheap and never touch gauge geometry.
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [fuelLevel] = useState(65); // static during the boot sequence — draining fuel while starting reads as a bug
  const [tempLevel, setTempLevel] = useState(42);
  const [gear, setGear] = useState(1);

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Loading data and frameworks' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Loading customer database' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Sugar and Spice and everything Nice' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Almost There' },
    { label: 'M SPORT MODE', desc: 'Reached destination SAFELY' },
  ];

  // SPEED sweep, with a small overshoot-and-settle on the final approach so
  // the needle doesn't just glide to a stop like a robot.
  useEffect(() => {
    speed.value = withSequence(
      withTiming(0.02, { duration: 340, easing: Easing.out(Easing.cubic) }),
      withTiming(0.17, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.34, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.5, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.7, { duration: 750, easing: Easing.out(Easing.quad) }), // slight overshoot
      withTiming(0.67, { duration: 180, easing: Easing.inOut(Easing.quad) }), // settle back
      withDelay(1480, withTiming(0.67, { duration: 1 }))
    );
    return () => cancelAnimation(speed);
  }, [speed]);

  // RPM sweep with shift-style drops. Each drop is what the gear counter
  // below listens for, so the gear digit and the tach stay in sync.
  useEffect(() => {
    rpm.value = withSequence(
      withTiming(800, { duration: 340, easing: Easing.out(Easing.cubic) }),
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(4500, { duration: 255, easing: Easing.inOut(Easing.quad) }), // 1->2 shift
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(4800, { duration: 255, easing: Easing.inOut(Easing.quad) }), // 2->3 shift
      withTiming(6500, { duration: 1020, easing: Easing.out(Easing.quad) }),
      withTiming(5200, { duration: 255, easing: Easing.inOut(Easing.quad) }), // 3->4 shift
      withTiming(6200, { duration: 700, easing: Easing.out(Easing.quad) }),
      withTiming(5000, { duration: 255, easing: Easing.inOut(Easing.quad) }), // 4->5 shift, settle
      withDelay(180, withTiming(5000, { duration: 1 }))
    );
    return () => cancelAnimation(rpm);
  }, [rpm]);

  // Redline pulse — always running; only visible once RPM crosses the
  // redline threshold (see GaugeNeedle).
  useEffect(() => {
    redlinePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    return () => cancelAnimation(redlinePulse);
  }, [redlinePulse]);

  // Temp warm-up, trimmed to fit inside TOTAL_ANIMATION_MS.
  useEffect(() => {
    tempSV.value = withSequence(
      withTiming(88, { duration: 2600, easing: Easing.out(Easing.quad) }),
      withTiming(93, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      withTiming(91, { duration: 2100, easing: Easing.inOut(Easing.sin) })
    );
    return () => cancelAnimation(tempSV);
  }, [tempSV]);

  useEffect(() => {
    const onTimer = setTimeout(() => setEngineOn(true), 400);
    const doneTimer = setTimeout(() => onComplete?.(), TOTAL_ANIMATION_MS);
    return () => {
      clearTimeout(onTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  // Throttled bridge crossing: only pushes text/gear/phase state, and only
  // when the rounded value actually changed — geometry above never touches
  // this path at all.
  const lastRpmRef = useSharedValue(0);
  useDerivedValue(() => {
    const sp = speed.value;
    const rp = rpm.value;
    const speedKmh = Math.round(sp * 240);
    const rpmRounded = Math.round(rp);

    runOnJS(setDisplaySpeed)(speedKmh);
    runOnJS(setDisplayRpm)(rpmRounded);
    runOnJS(setTempLevel)(tempSV.value);

    // Detect a shift: a sharp drop in RPM after climbing.
    if (lastRpmRef.value - rp > 1200) {
      runOnJS(setGear)((g: number) => Math.min(g + 1, 6));
    }
    lastRpmRef.value = rp;

    let phaseIndex = 0;
    if (speedKmh > 140) phaseIndex = 4;
    else if (speedKmh > 100) phaseIndex = 3;
    else if (speedKmh > 60) phaseIndex = 2;
    else if (speedKmh > 20) phaseIndex = 1;
    runOnJS(setAnimationPhase)(phaseIndex);
  }, [speed, rpm, tempSV]);

  const outerMaxWidth = size ? Math.min(size, 480) : 480;
  const gaugeWidth = Math.min(containerWidth, outerMaxWidth);
  const gaugeR = Math.min(gaugeWidth * 0.16, 60);
  const smallGaugeR = gaugeR * 0.45;
  const topPad = 38;
  const rowGap = 14;
  const bottomPad = 30;
  const centerY = topPad + gaugeR;
  const fuelTempY = centerY + gaugeR + rowGap + smallGaugeR;
  const gaugeHeight = fuelTempY + smallGaugeR + bottomPad;
  const leftX = gaugeWidth * 0.27;
  const rightX = gaugeWidth * 0.73;
  const centerX = gaugeWidth * 0.5;
  const fuelX = gaugeWidth * 0.28;
  const tempX = gaugeWidth * 0.72;

  return (
    <View style={styles.container}>
      <View style={[styles.outerFrame, { maxWidth: outerMaxWidth + 8 }]}>
        <View style={styles.innerGroove}>
          <View
            style={styles.dashboard}
            onLayout={(e) => {
              const measured = e.nativeEvent.layout.width - 4;
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
                  <RadialGradient id="speedGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={BMW_LT_BLUE} stopOpacity={0.22} />
                    <Stop offset="100%" stopColor={BMW_LT_BLUE} stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="rpmGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={BMW_ORANGE} stopOpacity={0.22} />
                    <Stop offset="100%" stopColor={BMW_ORANGE} stopOpacity={0} />
                  </RadialGradient>
                </Defs>

                <Rect x={0} y={0} width={gaugeWidth} height={gaugeHeight} rx={12} fill="url(#clusterBg)" />
                <Rect x={1} y={1} width={gaugeWidth - 2} height={gaugeHeight - 2} rx={11} fill="none" stroke="#2A3448" strokeWidth={0.5} />

                <SpeedGauge cx={leftX} cy={centerY} r={gaugeR} progress={speed} valueText={String(displaySpeed)} />
                <RpmGauge cx={rightX} cy={centerY} r={gaugeR} progress={rpmProgress} valueText={String(displayRpm)} redlinePulse={redlinePulse} />

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
              <StatusBar label="OIL" targetPct={85} color={BMW_LT_BLUE} delay={200} />
              <StatusBar label="BATTERY" targetPct={92} color={GREEN} delay={350} />
              <StatusBar label="BRAKE" targetPct={100} color={BMW_ORANGE} delay={500} />
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
