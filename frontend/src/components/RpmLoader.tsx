import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
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
      strokeWidth={12}
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
        strokeWidth={12}
        strokeLinecap="round"
        opacity={active ? 1 : 0.3}
      />
    );
  }

  // Ticks
  for (let i = 0; i <= 10; i++) {
    const ratio = i / 10;
    const angle = startAngle + ratio * (endAngle - startAngle);
    const inner = pt(cx, cy, r - 22, angle);
    const outer = pt(cx, cy, r - 14, angle);
    const label = pt(cx, cy, r - 38, angle);
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
          fontSize={10}
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
      fontSize={36}
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
      y={cy + 30}
      fill={TEXT_GRAY}
      fontSize={11}
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
      strokeWidth={12}
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
        strokeWidth={12}
        strokeLinecap="round"
        opacity={active ? 1 : 0.3}
      />
    );
  }

  // Ticks
  for (let i = 0; i <= 8; i++) {
    const ratio = i / 8;
    const angle = startAngle - ratio * (startAngle - endAngle);
    const inner = pt(cx, cy, r - 22, angle);
    const outer = pt(cx, cy, r - 14, angle);
    const label = pt(cx, cy, r - 38, angle);
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
          fontSize={10}
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
      fontSize={36}
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
      y={cy + 30}
      fill={TEXT_GRAY}
      fontSize={11}
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
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0.4, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(0.85, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withTiming(0.5, { duration: 500, easing: Easing.in(Easing.cubic) }),
        withDelay(400, withTiming(0.3, { duration: 300 })),
        withTiming(0.7, { duration: 400 })
      ),
      -1
    );
  }, [sweep]);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useDerivedValue(() => {
    runOnJS(setDisplayProgress)(sweep.value);
    runOnJS(setDisplaySpeed)(Math.round(sweep.value * 240));
    runOnJS(setDisplayRpm)(Math.round(sweep.value * 8 * 1000));
  }, [sweep]);

  // Responsive sizing
  const maxWidth = Math.min(containerWidth - 24, 800);
  const gaugeWidth = maxWidth;
  const gaugeHeight = gaugeWidth * 0.5;
  const centerY = gaugeHeight * 0.48;
  const gaugeR = gaugeWidth * 0.22;
  const leftX = gaugeWidth * 0.28;
  const rightX = gaugeWidth * 0.72;
  const centerX = gaugeWidth * 0.5;

  return (
    <View
      style={styles.container}
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
            <RadialGradient id="glowEffect" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#2A3448" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#0A0B0E" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={gaugeWidth}
            height={gaugeHeight}
            rx={16}
            fill="url(#clusterBg)"
          />

          {/* Border glow */}
          <Rect
            x={1}
            y={1}
            width={gaugeWidth - 2}
            height={gaugeHeight - 2}
            rx={15}
            fill="none"
            stroke="#2A3448"
            strokeWidth={1}
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
              d={`M ${centerX - 50} ${centerY - 50} L ${centerX} ${centerY - 70} L ${centerX + 50} ${centerY - 50} L ${centerX} ${centerY - 30} Z`}
              stroke="#2A3448"
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />
            <Path
              d={`M ${centerX - 50} ${centerY + 50} L ${centerX} ${centerY + 70} L ${centerX + 50} ${centerY + 50} L ${centerX} ${centerY + 30} Z`}
              stroke="#2A3448"
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />
            <Path
              d={`M ${centerX - 70} ${centerY} L ${centerX - 50} ${centerY - 50} L ${centerX - 30} ${centerY} L ${centerX - 50} ${centerY + 50} Z`}
              stroke="#2A3448"
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />
            <Path
              d={`M ${centerX + 70} ${centerY} L ${centerX + 50} ${centerY - 50} L ${centerX + 30} ${centerY} L ${centerX + 50} ${centerY + 50} Z`}
              stroke="#2A3448"
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />

            {/* Center circle */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={38}
              fill="#0A0B0E"
              stroke="#2A3448"
              strokeWidth={2}
            />
            <Circle
              cx={centerX}
              cy={centerY}
              r={34}
              fill="none"
              stroke="#3A4A5A"
              strokeWidth={0.5}
              opacity={0.5}
            />

            {/* Gear display */}
            <SvgText
              x={centerX}
              y={centerY + 8}
              fill={TEXT_WHITE}
              fontSize={28}
              fontWeight="900"
              textAnchor="middle"
            >
              D
            </SvgText>
          </G>
        </Svg>
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

      {/* Status */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.bulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
          <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_GRAY }]}>
            {engineOn ? 'ENGINE ON' : 'IGNITION'}
          </Text>
        </View>
        <Text style={styles.centerText}>{label}</Text>
        <Text style={styles.rightText}>12,847 km</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0B0E',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1D24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D24',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 11,
    color: TEXT_GRAY,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mModeText: {
    fontSize: 9,
    color: M_RED,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mStripes: {
    flexDirection: 'row',
    gap: 2,
  },
  stripe: {
    width: 10,
    height: 3,
    borderRadius: 1.5,
  },
  gaugeCluster: {
    alignSelf: 'center',
    marginVertical: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
    gap: 16,
  },
  barSection: {
    flex: 1,
  },
  barLabel: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 3,
  },
  barTrack: {
    height: 4,
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
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(20, 24, 32, 0.6)',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#1A1D24',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulb: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bulbOn: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  bulbOff: {
    backgroundColor: '#4A5568',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  centerText: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 1,
  },
  rightText: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
});
