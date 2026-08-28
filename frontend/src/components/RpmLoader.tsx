// src/components/RpmLoader.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
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
  size?: number;
  onComplete?: () => void;
}

// BMW Live Cockpit Professional Authentic Colors
const BG_DARK = '#0A0B0E';
const TEXT_WHITE = '#F0F2F5';
const TEXT_GRAY = '#8A95A8';
const TEXT_DIM = '#4A5568';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';

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
  const segments = 40;
  const startAngle = -150;
  const endAngle = 120;
  const nodes = [];

  // Background arc
  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={10}
      fill="none"
    />
  );

  // Active arc
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    const color = ratio > 0.6 ? BMW_LT_BLUE : '#3A4A7A';
    nodes.push(
      <Line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={active ? color : '#1A2029'}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={active ? 1 : 0.3}
      />
    );
  }

  // Ticks
  for (let i = 0; i <= 10; i++) {
    const ratio = i / 10;
    const angle = startAngle + ratio * (endAngle - startAngle);
    const inner = pt(cx, cy, r - 20, angle);
    const outer = pt(cx, cy, r - 12, angle);
    const label = pt(cx, cy, r - 34, angle);
    const isMain = i % 2 === 0;
    const val = Math.round((i / 10) * 240);
    nodes.push(
      <Line
        key={`t${i}`}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke={isMain ? TEXT_WHITE : TEXT_GRAY}
        strokeWidth={isMain ? 2 : 1}
        strokeLinecap="round"
      />
    );
    if (isMain) {
      nodes.push(
        <SvgText
          key={`l${i}`}
          x={label.x}
          y={label.y + 3}
          fill={TEXT_GRAY}
          fontSize={9}
          fontWeight="600"
          textAnchor="middle"
        >
          {val}
        </SvgText>
      );
    }
  }

  // Speed value
  nodes.push(
    <SvgText
      key="value"
      x={cx}
      y={cy + 8}
      fill={TEXT_WHITE}
      fontSize={32}
      fontWeight="900"
      textAnchor="middle"
    >
      {value}
    </SvgText>
  );
  nodes.push(
    <SvgText
      key="unit"
      x={cx}
      y={cy + 28}
      fill={TEXT_GRAY}
      fontSize={10}
      fontWeight="600"
      textAnchor="middle"
      letterSpacing="2"
    >
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
  const segments = 40;
  const startAngle = 150;
  const endAngle = -120;
  const nodes = [];

  // Background arc
  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 0 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={10}
      fill="none"
    />
  );

  // Active arc
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle - ratio * (startAngle - endAngle);
    const a2 = startAngle - ((i + 1) / segments) * (startAngle - endAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    const color = ratio > 0.7 ? BMW_RED : BMW_ORANGE;
    nodes.push(
      <Line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={active ? color : '#1A2029'}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={active ? 1 : 0.3}
      />
    );
  }

  // Ticks
  for (let i = 0; i <= 8; i++) {
    const ratio = i / 8;
    const angle = startAngle - ratio * (startAngle - endAngle);
    const inner = pt(cx, cy, r - 20, angle);
    const outer = pt(cx, cy, r - 12, angle);
    const label = pt(cx, cy, r - 34, angle);
    const isMain = i % 2 === 0;
    const val = Math.round((i / 8) * 8);
    nodes.push(
      <Line
        key={`t${i}`}
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke={isMain ? TEXT_WHITE : TEXT_GRAY}
        strokeWidth={isMain ? 2 : 1}
        strokeLinecap="round"
      />
    );
    if (isMain) {
      nodes.push(
        <SvgText
          key={`l${i}`}
          x={label.x}
          y={label.y + 3}
          fill={TEXT_GRAY}
          fontSize={9}
          fontWeight="600"
          textAnchor="middle"
        >
          {val}
        </SvgText>
      );
    }
  }

  // RPM value
  nodes.push(
    <SvgText
      key="value"
      x={cx}
      y={cy + 8}
      fill={BMW_ORANGE}
      fontSize={32}
      fontWeight="900"
      textAnchor="middle"
    >
      {value}
    </SvgText>
  );
  nodes.push(
    <SvgText
      key="unit"
      x={cx}
      y={cy + 28}
      fill={TEXT_GRAY}
      fontSize={10}
      fontWeight="600"
      textAnchor="middle"
      letterSpacing="2"
    >
      RPM
    </SvgText>
  );

  return <>{nodes}</>;
}

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 600, onComplete }: Props) {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 32);
  const speed = useSharedValue(0);
  const rpm = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [gear, setGear] = useState('N');
  const [animationPhase, setAnimationPhase] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Premium aluminum frame with precision engineering' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Authentic BMW M sport instrument cluster' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Dynamic color zones for optimal readability' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Real-time performance data at your fingertips' },
    { label: 'M SPORT MODE', desc: 'Track-focused instrumentation with M performance' },
  ];

  useEffect(() => {
    // SMOOTH ACCELERATION SEQUENCE - 0 to 160 km/h in 8 seconds with gear shifts
    const accelerationSequence = withSequence(
      // Engine start - 0.5s
      withTiming(0.02, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // 1st gear (0-40 km/h) - 1.5s (smooth pull)
      withTiming(0.17, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Shift to 2nd - quick but smooth drop
      withTiming(0.15, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 2nd gear (40-80 km/h) - 1.5s
      withTiming(0.34, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Shift to 3rd
      withTiming(0.30, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 3rd gear (80-120 km/h) - 1.5s
      withTiming(0.50, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Shift to 4th
      withTiming(0.45, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 4th gear (120-160 km/h) - 1.5s
      withTiming(0.67, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Hold at max - 1s
      withDelay(1000, withTiming(0.67, { duration: 1 })),
      
      // Decelerate smoothly - 2.5s
      withTiming(0.05, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
      
      // Stop - 0.5s
      withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
    );

    speed.value = withSequence(accelerationSequence);
  }, [speed]);

  // RPM follows speed with smooth gear shifts
  useEffect(() => {
    const rpmSequence = withSequence(
      // Start - idle
      withTiming(800, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // 1st gear - smooth climb to 6500
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      // Shift drop to 4500
      withTiming(4500, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 2nd gear - smooth climb to 6500
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      // Shift drop to 4800
      withTiming(4800, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 3rd gear - smooth climb to 6500
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      // Shift drop to 5200
      withTiming(5200, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 4th gear - smooth climb to 6200
      withTiming(6200, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Hold at 6200
      withDelay(1000, withTiming(6200, { duration: 1 })),
      
      // Decelerate smoothly
      withTiming(1200, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
      
      // Return to idle
      withTiming(800, { duration: 500, easing: Easing.in(Easing.quad) })
    );

    rpm.value = withSequence(rpmSequence);
  }, [rpm]);

  // Gear changes - realistic with smooth transitions
  useEffect(() => {
    // Realistic gear sequence: N → 1 → 2 → 3 → 4 → 3 → 2 → 1 → N
    const gearSequence = [
      { time: 0, gear: 'N' },
      { time: 600, gear: '1' },
      { time: 2100, gear: '2' },
      { time: 2500, gear: '2' }, // Hold 2nd
      { time: 4000, gear: '3' },
      { time: 4400, gear: '3' }, // Hold 3rd
      { time: 5900, gear: '4' },
      { time: 6300, gear: '4' }, // Hold 4th
      { time: 7400, gear: '4' }, // Still 4th during decel
      { time: 8400, gear: '3' }, // Downshift
      { time: 9400, gear: '2' }, // Downshift
      { time: 10400, gear: '1' }, // Downshift
      { time: 11100, gear: 'N' }, // Neutral
    ];

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < gearSequence.length - 1) {
        setGear(gearSequence[currentIndex].gear);
        currentIndex++;
      } else {
        clearInterval(interval);
        setAnimationComplete(true);
        // Notify completion
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 500);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 400);
    return () => clearTimeout(timer);
  }, []);

  useDerivedValue(() => {
    const speedProgress = speed.value;
    const rpmValue = rpm.value;
    const speedKmh = Math.round(speedProgress * 240);
    const rpmDisplay = Math.round(rpmValue);
    
    runOnJS(setDisplayProgress)(speedProgress);
    runOnJS(setDisplaySpeed)(speedKmh);
    runOnJS(setDisplayRpm)(rpmDisplay);
    
    // Update phase based on speed - smooth transitions
    let phaseIndex = 0;
    if (speedKmh > 140) phaseIndex = 4;
    else if (speedKmh > 100) phaseIndex = 3;
    else if (speedKmh > 60) phaseIndex = 2;
    else if (speedKmh > 20) phaseIndex = 1;
    else phaseIndex = 0;
    
    runOnJS(setAnimationPhase)(phaseIndex);
  }, [speed, rpm]);

  const maxWidth = Math.min(containerWidth, 600);
  const gaugeWidth = maxWidth;
  const gaugeHeight = gaugeWidth * 0.48;
  const centerY = gaugeHeight * 0.48;
  const gaugeR = Math.min(gaugeWidth * 0.22, 80);
  const leftX = gaugeWidth * 0.28;
  const rightX = gaugeWidth * 0.72;
  const centerX = gaugeWidth * 0.5;

  return (
    <View style={styles.container}>
      <View
        style={[styles.dashboard, { maxWidth: 600 }]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>BMW LIVE COCKPIT PROFESSIONAL</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.mModeText}>M SPORT MODE</Text>
            <View style={styles.mStripes}>
              <View style={[styles.stripe, { backgroundColor: M_BLUE }]} />
              <View style={[styles.stripe, { backgroundColor: M_PURPLE }]} />
              <View style={[styles.stripe, { backgroundColor: M_RED }]} />
            </View>
          </View>
        </View>

        {/* Main Gauge Cluster */}
        <View style={[styles.gaugeCluster, { width: gaugeWidth, height: gaugeHeight }]}>
          <Svg width={gaugeWidth} height={gaugeHeight}>
            <Defs>
              <LinearGradient id="clusterBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#141820" />
                <Stop offset="100%" stopColor="#0A0B0E" />
              </LinearGradient>
            </Defs>

            <Rect
              x={0}
              y={0}
              width={gaugeWidth}
              height={gaugeHeight}
              rx={12}
              fill="url(#clusterBg)"
            />
            <Rect
              x={1}
              y={1}
              width={gaugeWidth - 2}
              height={gaugeHeight - 2}
              rx={11}
              fill="none"
              stroke="#2A3448"
              strokeWidth={0.5}
            />

            <SpeedGauge
              cx={leftX}
              cy={centerY}
              r={gaugeR}
              progress={displayProgress}
              value={displaySpeed}
            />

            <RpmGauge
              cx={rightX}
              cy={centerY}
              r={gaugeR}
              progress={displayProgress}
              value={displayRpm}
            />

            {/* Center - Gear Indicator */}
            <G>
              <Path
                d={`M ${centerX - 45} ${centerY - 45} L ${centerX} ${centerY - 65} L ${centerX + 45} ${centerY - 45} L ${centerX} ${centerY - 25} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX - 45} ${centerY + 45} L ${centerX} ${centerY + 65} L ${centerX + 45} ${centerY + 45} L ${centerX} ${centerY + 25} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX - 65} ${centerY} L ${centerX - 45} ${centerY - 45} L ${centerX - 25} ${centerY} L ${centerX - 45} ${centerY + 45} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX + 65} ${centerY} L ${centerX + 45} ${centerY - 45} L ${centerX + 25} ${centerY} L ${centerX + 45} ${centerY + 45} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />

              <Circle
                cx={centerX}
                cy={centerY}
                r={34}
                fill="#0A0B0E"
                stroke="#2A3448"
                strokeWidth={1.5}
              />
              <Circle
                cx={centerX}
                cy={centerY}
                r={30}
                fill="none"
                stroke="#3A4A5A"
                strokeWidth={0.5}
                opacity={0.5}
              />

              <SvgText
                x={centerX}
                y={centerY + 7}
                fill={TEXT_WHITE}
                fontSize={24}
                fontWeight="900"
                textAnchor="middle"
              >
                {gear}
              </SvgText>
            </G>
          </Svg>
        </View>

        {/* Phase Description */}
        <View style={styles.phaseContainer}>
          <Text style={styles.phaseTitle}>{phases[animationPhase]?.label || ''}</Text>
          <Text style={styles.phaseDesc}>{phases[animationPhase]?.desc || ''}</Text>
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.barSection}>
            <Text style={styles.barLabel}>FUEL</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '65%', backgroundColor: BMW_ORANGE }]} />
            </View>
          </View>

          <View style={styles.barSection}>
            <Text style={styles.barLabel}>TEMP</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '75%', backgroundColor: GREEN }]} />
            </View>
          </View>

          <View style={styles.barSection}>
            <Text style={styles.barLabel}>OIL</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '85%', backgroundColor: BMW_LT_BLUE }]} />
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsContainer}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Cockpit Layout Experience Theme</Text>
            <View style={styles.themeIndicators}>
              <View style={[styles.themeDot, { backgroundColor: BMW_RED }]} />
              <View style={[styles.themeDot, { backgroundColor: BMW_ORANGE }]} />
              <View style={[styles.themeDot, { backgroundColor: BMW_LT_BLUE }]} />
              <View style={[styles.themeDot, { backgroundColor: GREEN }]} />
            </View>
          </View>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>M Performance</Text>
            <View style={styles.performanceIndicators}>
              <Text style={styles.performanceText}>Red</Text>
              <View style={styles.performanceDivider} />
              <Text style={styles.performanceText}>Comfort</Text>
              <View style={styles.performanceDivider} />
              <Text style={styles.performanceText}>Blue</Text>
              <View style={styles.performanceDivider} />
              <Text style={styles.performanceText}>Eco Pro</Text>
              <View style={styles.performanceDivider} />
              <Text style={styles.performanceText}>Green</Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={[styles.bulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
            <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_GRAY }]}>
              {engineOn ? 'ENGINE ON' : 'IGNITION'}
            </Text>
          </View>
          <Text style={styles.centerText}>
            {displaySpeed > 0 ? `${displaySpeed} km/h` : label}
          </Text>
          <Text style={styles.rightText}>12,847 km</Text>
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
  },
  dashboard: {
    width: '100%',
    backgroundColor: '#0A0B0E',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1D24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mModeText: {
    fontSize: 8,
    color: M_RED,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mStripes: {
    flexDirection: 'row',
    gap: 1.5,
  },
  stripe: {
    width: 8,
    height: 2.5,
    borderRadius: 1.5,
  },
  gaugeCluster: {
    alignSelf: 'center',
    marginVertical: 2,
  },
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
  phaseTitle: {
    fontSize: 10,
    color: BMW_ORANGE,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  phaseDesc: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
    gap: 12,
  },
  barSection: {
    flex: 1,
  },
  barLabel: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  barTrack: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#1A2029',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#2A3448',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  settingsContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(20, 24, 32, 0.3)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#1A1D24',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    flexWrap: 'wrap',
  },
  settingsLabel: {
    fontSize: 7,
    color: TEXT_DIM,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  themeIndicators: {
    flexDirection: 'row',
    gap: 4,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  performanceIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  performanceText: {
    fontSize: 7,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  performanceDivider: {
    width: 0.5,
    height: 10,
    backgroundColor: '#2A3448',
  },
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
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulb: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  bulbOn: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  bulbOff: {
    backgroundColor: '#4A5568',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  centerText: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rightText: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
});
