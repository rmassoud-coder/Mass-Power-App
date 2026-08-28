import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { MASS_POWER_LOGO_PNG_BASE64 } from '../utils/logoBase64';

interface Props {
  label?: string;
  size?: number;
}

// BMW Live Cockpit Professional Colors
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';
const BMW_DK_BLUE = '#0038A8';
const BG_DARK = '#0A0D14';
const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A9AAD';
const M_BLUE = '#0066B1';
const M_RED = '#FF0000';
const M_PURPLE = '#333366';

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 400 }: Props) {
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = React.useState(0);
  const [displaySpeed, setDisplaySpeed] = React.useState(0);
  const [engineOn, setEngineOn] = React.useState(false);
  const [displayFuel, setDisplayFuel] = React.useState(65);
  const [displayTemp, setDisplayTemp] = React.useState(90);

  useEffect(() => {
    // BMW-style startup animation
    const startupSequence = withSequence(
      withTiming(0.2, { duration: 400, easing: Easing.out(Easing.cubic) }),
      withTiming(0.4, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(0.6, { duration: 250, easing: Easing.out(Easing.cubic) }),
      withTiming(0.8, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(0.95, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(0.7, { duration: 400, easing: Easing.in(Easing.cubic) }),
      withTiming(0.3, { duration: 500, easing: Easing.in(Easing.cubic) }),
      withTiming(0.5, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withDelay(500, withTiming(0, { duration: 100 }))
    );

    sweep.value = withRepeat(
      withSequence(
        startupSequence,
        withTiming(0.1, { duration: 800 }),
        withTiming(0.3, { duration: 600 }),
        withTiming(0.5, { duration: 400 }),
        withTiming(0.7, { duration: 300 }),
        withTiming(0.85, { duration: 200 }),
        withTiming(0.95, { duration: 150 }),
        withTiming(0.8, { duration: 400 }),
        withTiming(0.5, { duration: 600 })
      ),
      -1
    );
  }, [sweep]);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useDerivedValue(() => {
    const rpm = Math.round(sweep.value * 8500);
    const speed = Math.round(sweep.value * 220);
    runOnJS(setDisplayRpm)(rpm);
    runOnJS(setDisplaySpeed)(speed);
    runOnJS(setDisplayFuel)(65 + Math.random() * 10);
    runOnJS(setDisplayTemp)(85 + Math.random() * 15);
  }, [sweep]);

  const radius = size / 2;
  const inset = 12;
  const r = radius - inset;
  const cx = radius;
  const cy = radius;

  const logoSize = Math.round(r * 0.3);

  // Reverse sweep tachometer
  const startAngle = -150;
  const endAngle = 150;
  
  // Create tick marks for tachometer
  const ticks: React.ReactNode[] = [];
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (i / segments) * (endAngle - startAngle);
    const rad = (angle - 90) * (Math.PI / 180);
    const inner = r - (i % 3 === 0 ? 18 : 10);
    const outer = r - 3;
    const x1 = cx + Math.cos(rad) * inner;
    const y1 = cy + Math.sin(rad) * inner;
    const x2 = cx + Math.cos(rad) * outer;
    const y2 = cy + Math.sin(rad) * outer;
    
    let color = TEXT_WHITE;
    const ratio = i / segments;
    if (ratio < 0.35) color = BMW_LT_BLUE;
    else if (ratio < 0.65) color = BMW_ORANGE;
    else color = BMW_RED;
    
    ticks.push(
      <Line
        key={`t-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={i % 3 === 0 ? 3 : 1.5}
        strokeLinecap="round"
      />
    );
    
    if (i % 2 === 0) {
      const labelR = r - 32;
      const lx = cx + Math.cos(rad) * labelR;
      const ly = cy + Math.sin(rad) * labelR + 4;
      const rpmValue = Math.round((i / segments) * 7);
      ticks.push(
        <SvgText
          key={`n-${i}`}
          x={lx}
          y={ly}
          fill={color}
          fontSize={10}
          fontWeight="700"
          textAnchor="middle"
        >
          {rpmValue}
        </SvgText>
      );
    }
  }

  // Multi-segmented arc for tachometer
  const arcSegments = 30;
  const arcNodes: React.ReactNode[] = [];
  for (let i = 0; i < arcSegments; i++) {
    const angle1 = startAngle + (i / arcSegments) * (endAngle - startAngle);
    const angle2 = startAngle + ((i + 1) / arcSegments) * (endAngle - startAngle);
    const rad1 = (angle1 - 90) * (Math.PI / 180);
    const rad2 = (angle2 - 90) * (Math.PI / 180);
    
    const ratio = i / arcSegments;
    let color = BMW_LT_BLUE;
    if (ratio > 0.35 && ratio < 0.65) color = BMW_ORANGE;
    else if (ratio >= 0.65) color = BMW_RED;
    
    const arcR = r - 8;
    const x1 = cx + Math.cos(rad1) * arcR;
    const y1 = cy + Math.sin(rad1) * arcR;
    const x2 = cx + Math.cos(rad2) * arcR;
    const y2 = cy + Math.sin(rad2) * arcR;
    
    const active = (i / arcSegments) <= sweep.value;
    
    arcNodes.push(
      <Line
        key={`arc-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={active ? color : '#1A1A2A'}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={active ? 1 : 0.2}
      />
    );
  }

  const needleStyle = useAnimatedStyle(() => {
    const angle = -150 + sweep.value * 300;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  // Speedometer ticks (left gauge)
  const speedTicks: React.ReactNode[] = [];
  for (let i = 0; i <= 8; i++) {
    const angle = -140 + i * 35;
    const rad = (angle - 90) * (Math.PI / 180);
    const inner = r * 0.4 - 12;
    const outer = r * 0.4;
    const x1 = cx - r * 0.55 + Math.cos(rad) * inner;
    const y1 = cy + Math.sin(rad) * inner;
    const x2 = cx - r * 0.55 + Math.cos(rad) * outer;
    const y2 = cy + Math.sin(rad) * outer;
    
    speedTicks.push(
      <Line
        key={`st-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={TEXT_GRAY}
        strokeWidth={i % 2 === 0 ? 2 : 1}
        strokeLinecap="round"
      />
    );
    
    if (i % 2 === 0) {
      const labelR = r * 0.4 - 20;
      const lx = cx - r * 0.55 + Math.cos(rad) * labelR;
      const ly = cy + Math.sin(rad) * labelR + 4;
      speedTicks.push(
        <SvgText
          key={`sn-${i}`}
          x={lx}
          y={ly}
          fill={TEXT_GRAY}
          fontSize={9}
          fontWeight="600"
          textAnchor="middle"
        >
          {i * 30}
        </SvgText>
      );
    }
  }

  // Fuel gauge ticks (right)
  const fuelTicks: React.ReactNode[] = [];
  for (let i = 0; i <= 4; i++) {
    const angle = -140 + i * 70;
    const rad = (angle - 90) * (Math.PI / 180);
    const inner = r * 0.4 - 10;
    const outer = r * 0.4;
    const x1 = cx + r * 0.55 + Math.cos(rad) * inner;
    const y1 = cy + Math.sin(rad) * inner;
    const x2 = cx + r * 0.55 + Math.cos(rad) * outer;
    const y2 = cy + Math.sin(rad) * outer;
    
    fuelTicks.push(
      <Line
        key={`ft-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={TEXT_GRAY}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  return (
    <View style={[styles.dashboard, { width: size + 40 }]}>
      {/* BMW Live Cockpit Professional Header */}
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

      {/* Main Gauge Cluster */}
      <View style={[styles.gaugeCluster, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0A0D14" />
              <Stop offset="100%" stopColor="#151B24" />
            </LinearGradient>
            <LinearGradient id="shroudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1A1F2A" />
              <Stop offset="50%" stopColor="#252D3A" />
              <Stop offset="100%" stopColor="#151A22" />
            </LinearGradient>
          </Defs>

          <Rect width={size} height={size} fill="url(#bgGrad)" rx={12} />

          {/* Chiseled Outer Shroud - Main RPM */}
          <Path
            d={`
              M ${cx} ${cy - r - 15}
              L ${cx + r * 0.65} ${cy - r * 0.85}
              L ${cx + r * 0.92} ${cy - r * 0.5}
              L ${cx + r * 0.97} ${cy}
              L ${cx + r * 0.92} ${cy + r * 0.5}
              L ${cx + r * 0.65} ${cy + r * 0.85}
              L ${cx} ${cy + r + 15}
              L ${cx - r * 0.65} ${cy + r * 0.85}
              L ${cx - r * 0.92} ${cy + r * 0.5}
              L ${cx - r * 0.97} ${cy}
              L ${cx - r * 0.92} ${cy - r * 0.5}
              L ${cx - r * 0.65} ${cy - r * 0.85}
              Z
            `}
            fill="none"
            stroke="#2A3440"
            strokeWidth={2}
          />

          {/* RPM Gauge Circle */}
          <Circle cx={cx} cy={cy} r={r - 10} fill="none" stroke="#1A1F2A" strokeWidth={2} />

          {/* Multi-segmented Arc */}
          {arcNodes}

          {/* Tick Marks */}
          {ticks}

          {/* Speedometer - Left Mini Gauge */}
          <G transform={`translate(${cx - r * 0.55}, ${cy})`}>
            <Circle cx={0} cy={0} r={r * 0.4} fill="none" stroke="#1A1F2A" strokeWidth={1.5} />
            {speedTicks}
            <SvgText x="0" y="15" fill={TEXT_WHITE} fontSize={16} fontWeight="900" textAnchor="middle">
              {displaySpeed}
            </SvgText>
            <SvgText x="0" y="28" fill={TEXT_GRAY} fontSize={8} fontWeight="600" textAnchor="middle">
              km/h
            </SvgText>
          </G>

          {/* Fuel/Temperature - Right Mini Gauge */}
          <G transform={`translate(${cx + r * 0.55}, ${cy})`}>
            <Circle cx={0} cy={0} r={r * 0.4} fill="none" stroke="#1A1F2A" strokeWidth={1.5} />
            {fuelTicks}
            <SvgText x="0" y="-10" fill={TEXT_GRAY} fontSize={7} fontWeight="600" textAnchor="middle">
              FUEL
            </SvgText>
            <SvgText x="0" y="15" fill="#50B4E6" fontSize={14} fontWeight="800" textAnchor="middle">
              {Math.round(displayFuel)}%
            </SvgText>
            <SvgText x="0" y="28" fill={TEXT_GRAY} fontSize={7} fontWeight="600" textAnchor="middle">
              TEMP {Math.round(displayTemp)}°C
            </SvgText>
          </G>

          {/* Logo */}
          <Image
            source={{ uri: MASS_POWER_LOGO_PNG_BASE64 }}
            style={{
              position: 'absolute',
              width: logoSize,
              height: logoSize,
              borderRadius: logoSize / 2,
              left: (size - logoSize) / 2,
              top: (size - logoSize) / 2 + 10,
              backgroundColor: 'transparent',
            }}
            resizeMode="contain"
          />

          {/* Digital RPM Display */}
          <G transform={`translate(${cx}, ${cy + r * 0.3})`}>
            <SvgText x="0" y="0" fill={BMW_ORANGE} fontSize={20} fontWeight="800" textAnchor="middle">
              {displayRpm}
            </SvgText>
            <SvgText x="0" y="14" fill={TEXT_GRAY} fontSize={8} fontWeight="600" textAnchor="middle" letterSpacing="1">
              RPM 1/min
            </SvgText>
          </G>
        </Svg>

        {/* RPM Needle */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
            },
            needleStyle,
          ]}
        >
          <View
            style={{
              width: 2.5,
              height: r - 30,
              backgroundColor: BMW_RED,
              borderTopLeftRadius: 1.5,
              borderTopRightRadius: 1.5,
              marginBottom: r - 40,
              shadowColor: BMW_RED,
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 6,
            }}
          />
        </Animated.View>

        {/* Center Hub */}
        <View
          pointerEvents="none"
          style={[
            styles.hubOuter,
            { left: cx - 10, top: cy - 10, width: 20, height: 20, borderRadius: 10 },
          ]}
        />
      </View>

      {/* Bottom Telemetry */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>GEAR</Text>
          <Text style={[styles.telemetryValue, { color: BMW_LT_BLUE }]}>D</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>OIL TEMP</Text>
          <Text style={styles.telemetryValue}>{Math.round(85 + Math.random() * 5)}°C</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>BATTERY</Text>
          <Text style={styles.telemetryValue}>14.2V</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <Text style={styles.telemetryLabel}>CONSUMPTION</Text>
          <Text style={styles.telemetryValue}>8.2L/100km</Text>
        </View>
      </View>

      {/* Engine Status */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusBulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
          <Text style={[styles.statusText, { color: engineOn ? '#22C55E' : TEXT_GRAY }]}>
            {engineOn ? 'ENGINE ON' : 'IGNITION'}
          </Text>
        </View>
        <Text style={styles.statusLabel}>{label}</Text>
        <View style={styles.statusRight}>
          <Text style={styles.mileageText}>12,847 km</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    backgroundColor: '#0A0D14',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1F2A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1F2A',
  },
  headerTitle: {
    fontSize: 9,
    color: TEXT_GRAY,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  mMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mModeText: {
    fontSize: 8,
    color: BMW_RED,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mStripes: {
    flexDirection: 'row',
    gap: 2,
  },
  stripe: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  gaugeCluster: {
    position: 'relative',
    marginVertical: 4,
  },
  hubOuter: {
    position: 'absolute',
    backgroundColor: BG_DARK,
    borderWidth: 1.5,
    borderColor: '#2A3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: 'rgba(26, 31, 42, 0.5)',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#1A1F2A',
    marginTop: 4,
  },
  telemetryItem: {
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 7,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  telemetryValue: {
    fontSize: 11,
    color: TEXT_WHITE,
    fontWeight: '700',
    marginTop: 2,
  },
  telemetryDivider: {
    width: 0.5,
    backgroundColor: '#1A1F2A',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 31, 42, 0.3)',
    borderRadius: 6,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBulb: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 6,
  },
  bulbOn: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  bulbOff: {
    backgroundColor: '#555',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusLabel: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  mileageText: {
    fontSize: 8,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
});
