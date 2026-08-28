import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
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
  RadialGradient,
} from 'react-native-svg';

interface Props {
  label?: string;
  size?: number;
}

// BMW Live Cockpit Professional Authentic Colors
const BG_DARK = '#0A0B0E';
const PANEL_DARK = '#111318';
const PANEL_MID = '#1A1D24';
const TEXT_WHITE = '#F0F2F5';
const TEXT_GRAY = '#8A95A8';
const TEXT_DIM = '#4A5568';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';
const BMW_DK_BLUE = '#0038A8';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';
const GAUGE_BG = '#141820';
const GAUGE_BORDER = '#2A3448';

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

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 600 }: Props) {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 32);
  const speed = useSharedValue(0);
  const rpm = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [gear, setGear] = useState('N');
  const [currentPhase, setCurrentPhase] = useState(0);

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Premium aluminum frame with precision engineering' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Authentic BMW M sport instrument cluster' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Dynamic color zones for optimal readability' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Real-time performance data at your fingertips' },
    { label: 'M SPORT MODE', desc: 'Track-focused instrumentation with M performance' },
  ];

  useEffect(() => {
    // Realistic 0-160 km/h acceleration with gear shifts (5 seconds total)
    const accelerationSequence = withSequence(
      // Start engine - 0.5s
      withTiming(0.01, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // Launch - 1st gear (0-40 km/h) - 1.2s
      withTiming(0.17, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      
      // Shift to 2nd gear (RPM drops, speed continues) - 0.3s
      withTiming(0.15, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 2nd gear (40-80 km/h) - 1.2s
      withTiming(0.34, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      
      // Shift to 3rd gear (RPM drops) - 0.3s
      withTiming(0.30, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 3rd gear (80-120 km/h) - 1.0s
      withTiming(0.50, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      
      // Shift to 4th gear - 0.3s
      withTiming(0.45, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 4th gear (120-160 km/h) - 1.0s
      withTiming(0.67, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      
      // Shift to 5th gear - 0.3s
      withTiming(0.60, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 5th gear - hold at 160 km/h - 2s
      withDelay(2000, withTiming(0.67, { duration: 1 })),
      
      // Decelerate - 3s
      withTiming(0.20, { duration: 3000, easing: Easing.in(Easing.cubic) }),
      
      // Stop - 1s
      withTiming(0, { duration: 1000, easing: Easing.in(Easing.cubic) })
    );

    speed.value = withSequence(accelerationSequence);
  }, [speed]);

  // RPM follows speed but with realistic gear shifts
  useEffect(() => {
    const rpmSequence = withSequence(
      // Start - idle
      withTiming(800, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // 1st gear - RPM climbs to 6500
      withTiming(6500, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      
      // Shift drop
      withTiming(4500, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 2nd gear - RPM climbs to 6500
      withTiming(6500, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      
      // Shift drop
      withTiming(4800, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 3rd gear - RPM climbs to 6500
      withTiming(6500, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      
      // Shift drop
      withTiming(5200, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 4th gear - RPM climbs to 6200
      withTiming(6200, { duration: 1000, easing: Easing.out(Easing.cubic) }),
      
      // Shift drop
      withTiming(5000, { duration: 300, easing: Easing.in(Easing.cubic) }),
      
      // 5th gear - hold at 5000
      withDelay(2000, withTiming(5000, { duration: 1 })),
      
      // Decelerate
      withTiming(2000, { duration: 3000, easing: Easing.in(Easing.cubic) }),
      
      // Stop
      withTiming(800, { duration: 1000, easing: Easing.in(Easing.cubic) })
    );

    rpm.value = withSequence(rpmSequence);
  }, [rpm]);

  // Gear changes
  useEffect(() => {
    const gearSequence = withSequence(
      withTiming(0, { duration: 1 }),
      withDelay(500, withTiming(1, { duration: 1 })),
      withDelay(1200, withTiming(2, { duration: 1 })),
      withDelay(1500, withTiming(2, { duration: 1 })),
      withDelay(2700, withTiming(3, { duration: 1 })),
      withDelay(3000, withTiming(3, { duration: 1 })),
      withDelay(4000, withTiming(4, { duration: 1 })),
      withDelay(4300, withTiming(4, { duration: 1 })),
      withDelay(5300, withTiming(5, { duration: 1 })),
      withDelay(5600, withTiming(5, { duration: 1 })),
      withDelay(7600, withTiming(4, { duration: 1 })),
      withDelay(8600, withTiming(3, { duration: 1 })),
      withDelay(9600, withTiming(2, { duration: 1 })),
      withDelay(10600, withTiming(1, { duration: 1 })),
      withDelay(11600, withTiming(0, { duration: 1 }))
    );
    // Just run it once
    const gearTimer = setTimeout(() => {
      let gearIndex = 0;
      const gearInterval = setInterval(() => {
        const gears = ['N', '1', '2', '3', '4', '5', '4', '3', '2', '1', 'N'];
        if (gearIndex < gears.length) {
          setGear(gears[gearIndex]);
          gearIndex++;
        } else {
          clearInterval(gearInterval);
        }
      }, 1000);
    }, 500);
    return () => clearTimeout(gearTimer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 500);
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
    
    // Update phase based on speed
    let phaseIndex = 0;
    if (speedKmh > 140) phaseIndex = 4;
    else if (speedKmh > 100) phaseIndex = 3;
    else if (speedKmh > 60) phaseIndex = 2;
    else if (speedKmh > 20) phaseIndex = 1;
    else phaseIndex = 0;
    
    runOnJS(setCurrentPhase)(phaseIndex);
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageContainer}>
        <View
          style={[styles.container, { maxWidth: 600 }]}
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

              {/* Background */}
              <Rect
                x={0}
                y={0}
                width={gaugeWidth}
                height={gaugeHeight}
                rx={12}
                fill="url(#clusterBg)"
              />

              {/* Border glow */}
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

              {/* Left Gauge - Speed */}
              <SpeedGauge
                cx={leftX}
                cy={centerY}
                r={gaugeR}
                progress={displayProgress}
                value={displaySpeed}
              />

              {/* Right Gauge - RPM */}
              <RpmGauge
                cx={rightX}
                cy={centerY}
                r={gaugeR}
                progress={displayProgress}
                value={displayRpm}
              />

              {/* Center - Gear Indicator */}
              <G>
                {/* Diamond border */}
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

                {/* Center circle */}
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

                {/* Gear display */}
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
            <Text style={styles.phaseTitle}>
              {displaySpeed > 140 ? 'M SPORT MODE' :
               displaySpeed > 100 ? 'SIGNATURE TELEMETRY' :
               displaySpeed > 60 ? 'MULTI-SEGMENTED DISPLAY' :
               displaySpeed > 20 ? 'REVERSE-SWEEPING TACHOMETER' :
               'CHISELED OUTER SHROUD'}
            </Text>
            <Text style={styles.phaseDesc}>
              {displaySpeed > 140 ? 'Track-focused instrumentation with M performance' :
               displaySpeed > 100 ? 'Real-time performance data at your fingertips' :
               displaySpeed > 60 ? 'Dynamic color zones for optimal readability' :
               displaySpeed > 20 ? 'Authentic BMW M sport instrument cluster' :
               'Premium aluminum frame with precision engineering'}
            </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pageContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
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
