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
  Polygon,
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
}

// BMW Live Cockpit Professional Colors
const BG_DARK = '#0A0D14';
const PANEL = '#151B24';
const PANEL_GLOW = '#1A2530';
const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A9AAD';
const TEXT_DIM = '#4A5A6A';
const SPEED_LOW = '#3A4A7A';
const SPEED_HIGH = '#50B4E6';
const RPM_LOW = '#5A2A2A';
const RPM_HIGH = '#FF3B30';
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';
const SHADOW = 'rgba(0,0,0,0.8)';

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function GaugeArc({
  cx,
  cy,
  r,
  startAngle,
  endAngle,
  progress,
  colorLow,
  colorHigh,
  segments = 36,
}: any) {
  const nodes = [];
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    const color = ratio > 0.65 ? colorHigh : colorLow;
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
        opacity={active ? 1 : 0.3}
      />
    );
  }
  return <>{nodes}</>;
}

function GaugeTicks({ cx, cy, r, startAngle, endAngle, values }: any) {
  return (
    <>
      {values.map((v: number, i: number) => {
        const ratio = i / (values.length - 1);
        const angle = startAngle + ratio * (endAngle - startAngle);
        const inner = pt(cx, cy, r - 20, angle);
        const outer = pt(cx, cy, r - 14, angle);
        const label = pt(cx, cy, r - 32, angle);
        const isMain = i % 2 === 0;
        return (
          <G key={i}>
            <Line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isMain ? TEXT_WHITE : TEXT_GRAY}
              strokeWidth={isMain ? 2 : 1}
              strokeLinecap="round"
            />
            {isMain && (
              <SvgText
                x={label.x}
                y={label.y + 3}
                fill={TEXT_GRAY}
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {v}
              </SvgText>
            )}
          </G>
        );
      })}
    </>
  );
}

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 500 }: Props) {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [engineOn, setEngineOn] = useState(false);
  const [fuel] = useState(65);
  const [temp, setTemp] = useState(90);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(0.65, { duration: 350, easing: Easing.out(Easing.cubic) }),
        withTiming(0.9, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withTiming(0.55, { duration: 450, easing: Easing.in(Easing.cubic) }),
        withDelay(300, withTiming(0.2, { duration: 400 })),
        withTiming(0.75, { duration: 500 }),
        withTiming(0.4, { duration: 400 })
      ),
      -1
    );
  }, [sweep]);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 2000);
    const jitter = setInterval(() => {
      setTemp(88 + Math.round(Math.random() * 6));
    }, 800);
    return () => {
      clearTimeout(timer);
      clearInterval(jitter);
    };
  }, []);

  useDerivedValue(() => {
    runOnJS(setDisplayProgress)(sweep.value);
    runOnJS(setDisplaySpeed)(Math.round(sweep.value * 220));
    runOnJS(setDisplayRpm)(Math.round(sweep.value * 8.5 * 1000));
  }, [sweep]);

  const outerW = Math.min(containerWidth - 24, size * 1.9);
  const outerH = outerW * 0.55;
  const cy = outerH * 0.46;
  const gaugeR = size * 0.4;
  const leftCx = outerW * 0.27;
  const rightCx = outerW * 0.73;
  const centerCx = outerW * 0.5;

  const speedTickValues = [0, 40, 80, 120, 160, 200];
  const rpmTickValues = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <View
      style={styles.dashboard}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Dashboard Background with subtle gradient */}
      <View style={styles.dashboardBg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>BMW LIVE COCKPIT PROFESSIONAL</Text>
        <View style={styles.mMode}>
          <Text style={styles.mModeText}>M SPORT MODE</Text>
          <View style={styles.mStripes}>
            <View style={[styles.stripe, { backgroundColor: M_BLUE }]} />
            <View style={[styles.stripe, { backgroundColor: M_PURPLE }]} />
            <View style={[styles.stripe, { backgroundColor: M_RED }]} />
          </View>
        </View>
      </View>

      <View style={{ width: outerW, height: outerH, alignSelf: 'center', position: 'relative' }}>
        <Svg width={outerW} height={outerH}>
          <Defs>
            <LinearGradient id="gaugeBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#1A2530" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#0D1117" stopOpacity="0.5" />
            </LinearGradient>
            <LinearGradient id="glassReflect" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.05" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Dashboard Panel Background */}
          <Rect
            x={0}
            y={0}
            width={outerW}
            height={outerH}
            rx={12}
            fill={PANEL}
            stroke="#1A2530"
            strokeWidth={1.5}
          />

          {/* Glass Reflection Effect */}
          <Rect
            x={0}
            y={0}
            width={outerW}
            height={outerH}
            rx={12}
            fill="url(#glassReflect)"
          />

          {/* Subtle inner glow */}
          <Rect
            x={10}
            y={10}
            width={outerW - 20}
            height={outerH - 20}
            rx={8}
            fill="none"
            stroke="#2A3440"
            strokeWidth={1}
            opacity={0.3}
          />

          {/* Left gauge: Speedometer */}
          <Circle
            cx={leftCx}
            cy={cy}
            r={gaugeR + 8}
            fill="url(#gaugeBg)"
            stroke="#1A2530"
            strokeWidth={1.5}
          />
          <Circle
            cx={leftCx}
            cy={cy}
            r={gaugeR}
            fill="none"
            stroke="#2A3440"
            strokeWidth={0.5}
          />
          
          <GaugeArc
            cx={leftCx}
            cy={cy}
            r={gaugeR}
            startAngle={-140}
            endAngle={100}
            progress={displayProgress}
            colorLow={SPEED_LOW}
            colorHigh={SPEED_HIGH}
          />
          <GaugeTicks
            cx={leftCx}
            cy={cy}
            r={gaugeR}
            startAngle={-140}
            endAngle={100}
            values={speedTickValues}
          />
          
          {/* Speed value with glow */}
          <SvgText
            x={leftCx}
            y={cy + 6}
            fill={TEXT_WHITE}
            fontSize={32}
            fontWeight="900"
            textAnchor="middle"
            shadowColor="rgba(80,180,230,0.3)"
            shadowRadius={10}
          >
            {displaySpeed}
          </SvgText>
          <SvgText
            x={leftCx}
            y={cy + 28}
            fill={TEXT_GRAY}
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
            letterSpacing="2"
          >
            km/h
          </SvgText>

          {/* Right gauge: Tachometer */}
          <Circle
            cx={rightCx}
            cy={cy}
            r={gaugeR + 8}
            fill="url(#gaugeBg)"
            stroke="#1A2530"
            strokeWidth={1.5}
          />
          <Circle
            cx={rightCx}
            cy={cy}
            r={gaugeR}
            fill="none"
            stroke="#2A3440"
            strokeWidth={0.5}
          />
          
          <GaugeArc
            cx={rightCx}
            cy={cy}
            r={gaugeR}
            startAngle={140}
            endAngle={-100}
            progress={displayProgress}
            colorLow={RPM_LOW}
            colorHigh={RPM_HIGH}
          />
          <GaugeTicks
            cx={rightCx}
            cy={cy}
            r={gaugeR}
            startAngle={140}
            endAngle={-100}
            values={rpmTickValues}
          />
          
          {/* RPM value with glow */}
          <SvgText
            x={rightCx}
            y={cy + 6}
            fill={BMW_ORANGE}
            fontSize={32}
            fontWeight="900"
            textAnchor="middle"
            shadowColor="rgba(255,90,0,0.3)"
            shadowRadius={10}
          >
            {displayRpm}
          </SvgText>
          <SvgText
            x={rightCx}
            y={cy + 28}
            fill={TEXT_GRAY}
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
            letterSpacing="2"
          >
            RPM
          </SvgText>

          {/* Center display - Gear indicator with diamond frame */}
          <G>
            {/* Diamond frame with glow */}
            <Line
              x1={centerCx - 48}
              y1={cy - 48}
              x2={centerCx + 48}
              y2={cy + 48}
              stroke="#2A3440"
              strokeWidth={1.5}
              opacity={0.5}
            />
            <Line
              x1={centerCx + 48}
              y1={cy - 48}
              x2={centerCx - 48}
              y2={cy + 48}
              stroke="#2A3440"
              strokeWidth={1.5}
              opacity={0.5}
            />
            
            {/* Center circle with depth */}
            <Circle
              cx={centerCx}
              cy={cy}
              r={40}
              fill={BG_DARK}
              stroke="#2A3440"
              strokeWidth={2}
            />
            <Circle
              cx={centerCx}
              cy={cy}
              r={36}
              fill="none"
              stroke="#3A4A5A"
              strokeWidth={0.5}
              opacity={0.3}
            />
            
            {/* Gear indicator */}
            <Polygon
              points={`${centerCx},${cy - 20} ${centerCx + 20},${cy} ${centerCx},${cy + 20} ${centerCx - 20},${cy}`}
              fill="#1A2029"
              stroke={SPEED_HIGH}
              strokeWidth={2}
              opacity={0.8}
            />
            <SvgText
              x={centerCx}
              y={cy + 6}
              fill={TEXT_WHITE}
              fontSize={20}
              fontWeight="900"
              textAnchor="middle"
            >
              D
            </SvgText>
          </G>
        </Svg>
      </View>

      {/* Bottom telemetry bars with labels */}
      <View style={styles.barsRow}>
        <View style={styles.barBlock}>
          <Text style={styles.barTitle}>FUEL</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${fuel}%`, backgroundColor: BMW_ORANGE }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabelText}>E</Text>
            <Text style={styles.barLabelText}>F</Text>
          </View>
        </View>
        <View style={styles.barBlock}>
          <Text style={styles.barTitle}>TEMP</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${((temp - 60) / 60) * 100}%`,
                  backgroundColor: temp > 100 ? BMW_RED : GREEN,
                },
              ]}
            />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabelText}>90°C</Text>
            <Text style={styles.barLabelText}>120°C</Text>
          </View>
        </View>
      </View>

      {/* Status Bar with glow effect */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusBulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
          <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_GRAY }]}>
            {engineOn ? 'ENGINE ON' : 'IGNITION'}
          </Text>
        </View>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.mileageText}>12,847 km</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    width: '100%',
    backgroundColor: BG_DARK,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A2530',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  dashboardBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG_DARK,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2530',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 10,
    color: TEXT_GRAY,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mModeText: {
    fontSize: 9,
    color: M_RED,
    fontWeight: '800',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(255,0,0,0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  mStripes: {
    flexDirection: 'row',
    gap: 2,
  },
  stripe: {
    width: 10,
    height: 2.5,
    borderRadius: 1.5,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  barBlock: {
    width: '46%',
  },
  barTitle: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A2029',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#2A3440',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  barLabelText: {
    fontSize: 8,
    color: TEXT_DIM,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(26, 31, 42, 0.4)',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#1A2530',
    zIndex: 1,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBulb: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  bulbOn: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  bulbOff: {
    backgroundColor: '#555',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  statusLabel: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  mileageText: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
