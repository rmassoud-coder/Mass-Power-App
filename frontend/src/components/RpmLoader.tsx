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
import Svg, { Circle, Path, G, Line, Text as SvgText, Defs, ClipPath } from 'react-native-svg';
import { MASS_POWER_LOGO_PNG_BASE64 } from '../utils/logoBase64';

const AnimatedG = Animated.createAnimatedComponent(G);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ignore = AnimatedG;

interface Props {
  label?: string;
  size?: number;
}

// BMW Signature Colors
const BMW_ORANGE = '#FF5A00';
const BMW_RED = '#CE1316';
const BMW_LT_BLUE = '#50B4E6';
const BMW_DK_BLUE = '#0038A8';
const BG_DARK = '#0B0C10';
const TEXT_WHITE = '#FFFFFF';

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 260 }: Props) {
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = React.useState(0);
  const [displaySpeed, setDisplaySpeed] = React.useState(0);
  const [engineOn, setEngineOn] = React.useState(false);

  useEffect(() => {
    const blip = (target: number, up: number, down: number) =>
      withSequence(
        withTiming(target, { duration: up, easing: Easing.out(Easing.cubic) }),
        withTiming(target * 0.25, { duration: down, easing: Easing.in(Easing.cubic) })
      );

    sweep.value = withRepeat(
      withSequence(
        blip(0.7, 385, 550),
        blip(0.85, 308, 495),
        blip(0.95, 242, 660),
        withTiming(0, { duration: 440, easing: Easing.in(Easing.cubic) }),
        withDelay(165, withTiming(0, { duration: 1 })),
        withTiming(0.5, { duration: 900, easing: Easing.out(Easing.cubic) })
      ),
      -1
    );
  }, [sweep]);

  useEffect(() => {
    const timer = setTimeout(() => setEngineOn(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const needleStyle = useAnimatedStyle(() => {
    const angle = -130 + sweep.value * 260;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  const shakeStyle = useAnimatedStyle(() => {
    const shake = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 40 }),
        withTiming(-0.5, { duration: 40 }),
        withTiming(0, { duration: 40 })
      ),
      4
    );
    return { transform: [{ translateX: shake }] };
  });

  useDerivedValue(() => {
    const rpm = Math.round(sweep.value * 8000);
    const speed = Math.round(sweep.value * 180);
    runOnJS(setDisplayRpm)(rpm);
    runOnJS(setDisplaySpeed)(speed);
  }, [sweep]);

  const radius = size / 2;
  const inset = 8;
  const r = radius - inset;
  const cx = radius;
  const cy = radius;

  const logoSize = Math.round(r * 1.42);
  const logoRadius = logoSize / 2;

  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    const angle = -130 + i * 26;
    const rad = (angle - 90) * (Math.PI / 180);
    const inner = r - (i % 2 === 0 ? 14 : 8);
    const outer = r - 2;
    const x1 = cx + Math.cos(rad) * inner;
    const y1 = cy + Math.sin(rad) * inner;
    const x2 = cx + Math.cos(rad) * outer;
    const y2 = cy + Math.sin(rad) * outer;
    const isRedline = i >= 7;
    ticks.push(
      <Line
        key={`t-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isRedline ? BMW_RED : TEXT_WHITE}
        strokeWidth={i % 2 === 0 ? 3 : 1.5}
        strokeLinecap="round"
      />
    );
    const tr = r - 26;
    const tx = cx + Math.cos(rad) * tr;
    const ty = cy + Math.sin(rad) * tr + 4;
    ticks.push(
      <SvgText
        key={`n-${i}`}
        x={tx}
        y={ty}
        fill={isRedline ? BMW_RED : TEXT_WHITE}
        fontSize={12}
        fontWeight="800"
        textAnchor="middle"
      >
        {i}
      </SvgText>
    );
  }

  const startAngle = (-130 + 7 * 26 - 90) * (Math.PI / 180);
  const endAngle = (-130 + 10 * 26 - 90) * (Math.PI / 180);
  const arcR = r - 1;
  const startX = cx + Math.cos(startAngle) * arcR;
  const startY = cy + Math.sin(startAngle) * arcR;
  const endX = cx + Math.cos(endAngle) * arcR;
  const endY = cy + Math.sin(endAngle) * arcR;
  const redlinePath = `M ${startX} ${startY} A ${arcR} ${arcR} 0 0 1 ${endX} ${endY}`;

  const needleLength = r - 6;

  return (
    <View style={[styles.container, { width: size + 40 }]}>
      {/* Engine Shake */}
      <Animated.View style={[{ width: size, height: size }, shakeStyle]}>
        <Svg width={size} height={size}>
          {/* Hexagonal Outer Shroud */}
          <Path
            d={`M ${cx - 120} ${cy + 120} L ${cx - 160} ${cy} L ${cx - 80} ${cy - 120} L ${cx + 80} ${cy - 120} L ${cx + 160} ${cy} L ${cx + 120} ${cy + 120} Z`}
            fill="none"
            stroke="#1F2833"
            strokeWidth={6}
          />

          {/* Outer Ring */}
          <Circle cx={cx} cy={cy} r={r} fill={BG_DARK} stroke="#1F2833" strokeWidth={4} />
          <Circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#232A34" strokeWidth={1} />

          {/* Redline Arc */}
          <Path d={redlinePath} stroke={BMW_RED} strokeWidth={5} fill="none" strokeLinecap="round" />

          {/* RPM Active Track (Orange/Red) */}
          <Path
            d={`M ${cx - 100} ${cy + 50} A ${r - 10} ${r - 10} 0 0 1 ${cx + 100} ${cy + 50}`}
            stroke={sweep.value > 0.7 ? BMW_RED : BMW_ORANGE}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            opacity={0.6 + sweep.value * 0.4}
          />

          {ticks}

          {/* Centered Logo */}
          <View
            pointerEvents="none"
            style={[
              styles.logoWrap,
              {
                width: logoSize,
                height: logoSize,
                borderRadius: logoRadius,
                left: (size - logoSize) / 2,
                top: (size - logoSize) / 2,
              },
            ]}
          >
            <Image
              source={{ uri: MASS_POWER_LOGO_PNG_BASE64 }}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>
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
              width: 4,
              height: needleLength,
              backgroundColor: BMW_RED,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              marginBottom: needleLength - 12,
              shadowColor: BMW_RED,
              shadowOpacity: 0.8,
              shadowRadius: 4,
              elevation: 8,
            }}
          />
        </Animated.View>

        {/* Center Hub */}
        <View pointerEvents="none" style={[styles.hubOuter, { left: cx - 11, top: cy - 11 }]} />
        <View pointerEvents="none" style={[styles.hubInner, { left: cx - 4, top: cy - 4 }]} />
      </Animated.View>

      {/* BMW Style Digital Center Telemetry */}
      <View style={styles.telemetryBox}>
        <Text style={styles.speedText}>{displaySpeed}</Text>
        <Text style={styles.unitText}>km/h</Text>
        <Text style={styles.rpmText}>{displayRpm}</Text>
        <Text style={styles.rpmLabel}>RPM 1/min</Text>
      </View>

      {/* M Performance Stripes */}
      <View style={styles.mStripe}>
        <View style={[styles.stripeSegment, { backgroundColor: BMW_LT_BLUE }]} />
        <View style={[styles.stripeSegment, { backgroundColor: BMW_DK_BLUE }]} />
        <View style={[styles.stripeSegment, { backgroundColor: BMW_RED }]} />
      </View>

      <Text style={styles.label}>{label}</Text>

      {/* Engine Light */}
      <View style={[styles.engineLight, engineOn ? styles.engineLightOn : styles.engineLightOff]}>
        <View style={[styles.engineBulb, engineOn ? styles.engineBulbOn : styles.engineBulbOff]} />
        <Text style={styles.engineText}>{engineOn ? 'ENGINE ON' : 'IGNITION'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  logoWrap: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: BG_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubOuter: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0B0C10',
  },
  hubInner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BMW_RED,
  },
  telemetryBox: {
    alignItems: 'center',
    marginTop: 8,
  },
  speedText: {
    fontSize: 48,
    fontWeight: '900',
    color: TEXT_WHITE,
    fontVariant: ['tabular-nums'],
  },
  unitText: {
    fontSize: 16,
    color: '#8A9AAD',
    fontWeight: '700',
    letterSpacing: 2,
  },
  rpmText: {
    fontSize: 24,
    fontWeight: '800',
    color: BMW_ORANGE,
    marginTop: 4,
  },
  rpmLabel: {
    fontSize: 12,
    color: '#8A9AAD',
    letterSpacing: 1,
  },
  mStripe: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 4,
  },
  stripeSegment: {
    width: 40,
    height: 6,
    borderRadius: 3,
  },
  label: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#8A9AAD',
  },
  engineLight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  engineLightOn: {
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderColor: '#22C55E',
  },
  engineLightOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: '#333',
  },
  engineBulb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  engineBulbOn: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  engineBulbOff: {
    backgroundColor: '#555',
  },
  engineText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
