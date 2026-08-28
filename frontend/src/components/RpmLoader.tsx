import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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
import Svg, { Circle, Path, G, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
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
const BG_DARK = '#0B0C10';
const TEXT_WHITE = '#FFFFFF';
const M_BLUE = '#0066B1';
const M_RED = '#FF0000';
const M_PURPLE = '#333366';

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 340 }: Props) {
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = React.useState(0);
  const [displaySpeed, setDisplaySpeed] = React.useState(0);
  const [engineOn, setEngineOn] = React.useState(false);

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

  const needleStyle = useAnimatedStyle(() => {
    const angle = -150 + sweep.value * 300;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  useDerivedValue(() => {
    const rpm = Math.round(sweep.value * 8500);
    const speed = Math.round(sweep.value * 220);
    runOnJS(setDisplayRpm)(rpm);
    runOnJS(setDisplaySpeed)(speed);
  }, [sweep]);

  const radius = size / 2;
  const inset = 12;
  const r = radius - inset;
  const cx = radius;
  const cy = radius;

  const logoSize = Math.round(r * 0.45);
  const logoRadius = logoSize / 2;

  // Reverse sweep tachometer
  const startAngle = -150;
  const endAngle = 150;
  
  // Create tick marks
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
          fontSize={11}
          fontWeight="700"
          textAnchor="middle"
        >
          {rpmValue}
        </SvgText>
      );
    }
  }

  // Multi-segmented arc
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
        strokeWidth={5}
        strokeLinecap="round"
        opacity={active ? 1 : 0.2}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size + 40 }]}>
      <View style={[styles.gaugeContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="shroudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1A1F2A" />
              <Stop offset="50%" stopColor="#252D3A" />
              <Stop offset="100%" stopColor="#151A22" />
            </LinearGradient>
          </Defs>

          {/* Chiseled Outer Shroud */}
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
            fill="url(#shroudGrad)"
            stroke="#3A4A5A"
            strokeWidth={1.5}
          />

          {/* Inner Ring */}
          <Circle cx={cx} cy={cy} r={r} fill={BG_DARK} />
          <Circle cx={cx} cy={cy} r={r} stroke="#2A3440" strokeWidth={2} fill="none" />
          <Circle cx={cx} cy={cy} r={r - 4} stroke="#1A1F2A" strokeWidth={1} fill="none" />

          {/* Multi-segmented Arc */}
          {arcNodes}

          {/* Tick Marks */}
          {ticks}

          {/* BMW M Sport Mode Indicator - Top */}
          <G transform={`translate(${cx - 45}, ${cy - r + 28})`}>
            <Text style={styles.mSportText}>M SPORT</Text>
          </G>

          {/* Centered Logo */}
          <Image
            source={{ uri: MASS_POWER_LOGO_PNG_BASE64 }}
            style={{
              position: 'absolute',
              width: logoSize,
              height: logoSize,
              borderRadius: logoRadius,
              left: (size - logoSize) / 2,
              top: (size - logoSize) / 2,
              backgroundColor: BG_DARK,
            }}
            resizeMode="contain"
          />

          {/* Speed Display - Integrated in Gauge */}
          <G transform={`translate(${cx - 50}, ${cy + 20})`}>
            <SvgText
              x="50"
              y="0"
              fill={TEXT_WHITE}
              fontSize={38}
              fontWeight="900"
              textAnchor="middle"
              fontFamily="System"
            >
              {displaySpeed}
            </SvgText>
            <SvgText
              x="50"
              y="22"
              fill="#8A9AAD"
              fontSize={12}
              fontWeight="600"
              textAnchor="middle"
              letterSpacing="2"
            >
              km/h
            </SvgText>
          </G>

          {/* RPM Display - Integrated in Gauge */}
          <G transform={`translate(${cx + 20}, ${cy + 20})`}>
            <SvgText
              x="30"
              y="0"
              fill={BMW_ORANGE}
              fontSize={30}
              fontWeight="800"
              textAnchor="middle"
              fontFamily="System"
            >
              {displayRpm}
            </SvgText>
            <SvgText
              x="30"
              y="22"
              fill="#8A9AAD"
              fontSize={10}
              fontWeight="600"
              textAnchor="middle"
              letterSpacing="1"
            >
              RPM
            </SvgText>
          </G>
        </Svg>

        {/* Needle */}
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
              height: r - 25,
              backgroundColor: BMW_RED,
              borderTopLeftRadius: 1.5,
              borderTopRightRadius: 1.5,
              marginBottom: r - 35,
              shadowColor: BMW_RED,
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 6,
            }}
          />
          <View
            style={{
              width: 6,
              height: 16,
              backgroundColor: '#2A3440',
              borderRadius: 2,
              marginTop: -8,
            }}
          />
        </Animated.View>

        {/* Center Hub */}
        <View
          pointerEvents="none"
          style={[
            styles.hubOuter,
            { left: cx - 12, top: cy - 12, width: 24, height: 24, borderRadius: 12 },
          ]}
        >
          <View
            style={[
              styles.hubInner,
              { width: 8, height: 8, borderRadius: 4, backgroundColor: BMW_ORANGE },
            ]}
          />
        </View>
      </View>

      {/* Bottom Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusBulb, engineOn ? styles.bulbOn : styles.bulbOff]} />
          <Text style={[styles.statusText, { color: engineOn ? '#22C55E' : '#8A9AAD' }]}>
            {engineOn ? 'ENGINE ON' : 'IGNITION'}
          </Text>
        </View>
        <Text style={styles.statusLabel}>{label}</Text>
        <View style={styles.mStripes}>
          <View style={[styles.stripe, { backgroundColor: M_BLUE }]} />
          <View style={[styles.stripe, { backgroundColor: M_PURPLE }]} />
          <View style={[styles.stripe, { backgroundColor: M_RED }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0D14',
    padding: 16,
    borderRadius: 24,
  },
  gaugeContainer: {
    position: 'relative',
  },
  hubOuter: {
    position: 'absolute',
    backgroundColor: BG_DARK,
    borderWidth: 2,
    borderColor: '#2A3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubInner: {
    backgroundColor: BMW_ORANGE,
  },
  mSportText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8A9AAD',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 31, 42, 0.5)',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#1A1F2A',
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
    color: '#5A6A7A',
    fontWeight: '600',
    letterSpacing: 1,
  },
  mStripes: {
    flexDirection: 'row',
    gap: 2,
  },
  stripe: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
});
