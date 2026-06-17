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
  /** Optional label shown under the gauge — defaults to "STARTING ENGINE..." */
  label?: string;
  /** Diameter in dp (default 260) */
  size?: number;
}

/**
 * Tachometer / RPM gauge loader with the Mass Power logo as the dominant centerpiece.
 * The needle revs through the gauge in a realistic blip pattern over the logo while the
 * app is loading.
 */
export default function RpmLoader({ label = 'STARTING ENGINE...', size = 260 }: Props) {
  // Needle rotation in degrees. 0 = pointing to "0 RPM" position (-130°), 260 = "10 RPM" (+130°).
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = React.useState(0);

  useEffect(() => {
    // Realistic revving pattern: 0 -> 7 -> 2 -> 8 -> 3 -> 9 -> 1 (kRPM)
    // Durations slowed by ~10% compared to previous version (multiplier 1.1)
    const blip = (target: number, up: number, down: number) =>
      withSequence(
        withTiming(target, { duration: up, easing: Easing.out(Easing.cubic) }),
        withTiming(target * 0.25, { duration: down, easing: Easing.in(Easing.cubic) })
      );

    sweep.value = withRepeat(
      withSequence(
        blip(0.7, 385, 550),   // was 350 / 500
        blip(0.85, 308, 495),  // was 280 / 450
        blip(0.95, 242, 660),  // was 220 / 600
        withTiming(0, { duration: 440, easing: Easing.in(Easing.cubic) }), // was 400
        withDelay(165, withTiming(0, { duration: 1 })) // pause beat (was 150)
      ),
      -1
    );
  }, [sweep]);

  // Convert sweep [0..1] to a rotation angle [-130..+130]
  const needleStyle = useAnimatedStyle(() => {
    const angle = -130 + sweep.value * 260;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  // Update the RPM digit display ~30fps based on sweep value
  useDerivedValue(() => {
    const rpm = Math.round(sweep.value * 9.5 * 1000);
    runOnJS(setDisplayRpm)(rpm);
  }, [sweep]);

  const radius = size / 2;
  const inset = 8;
  const r = radius - inset;          // outer gauge radius
  const cx = radius;
  const cy = radius;

  // Logo dominates the center — ~72% of gauge diameter
  const logoSize = Math.round(r * 1.42);
  const logoRadius = logoSize / 2;

  // Build tick marks every 1000 RPM from -130° to +130° (260° span, 10 segments)
  // Ticks live in the thin outer ring (outside the logo).
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= 10; i++) {
    const angle = -130 + i * 26; // degrees
    const rad = (angle - 90) * (Math.PI / 180); // SVG: 0deg = right; we want 0 at top, so subtract 90
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
        stroke={isRedline ? '#dc2626' : '#0f172a'}
        strokeWidth={i % 2 === 0 ? 3 : 1.5}
        strokeLinecap="round"
      />
    );
    // Numbers on major ticks — placed just inside the tick band
    const tr = r - 26;
    const tx = cx + Math.cos(rad) * tr;
    const ty = cy + Math.sin(rad) * tr + 4;
    ticks.push(
      <SvgText
        key={`n-${i}`}
        x={tx}
        y={ty}
        fill={isRedline ? '#dc2626' : '#0f172a'}
        fontSize={12}
        fontWeight="800"
        textAnchor="middle"
      >
        {i}
      </SvgText>
    );
  }

  // Redline arc (last 30% of the dial) - simple path arc
  const startAngle = (-130 + 7 * 26 - 90) * (Math.PI / 180);
  const endAngle = (-130 + 10 * 26 - 90) * (Math.PI / 180);
  const arcR = r - 1;
  const startX = cx + Math.cos(startAngle) * arcR;
  const startY = cy + Math.sin(startAngle) * arcR;
  const endX = cx + Math.cos(endAngle) * arcR;
  const endY = cy + Math.sin(endAngle) * arcR;
  const redlinePath = `M ${startX} ${startY} A ${arcR} ${arcR} 0 0 1 ${endX} ${endY}`;

  // Needle reaches just inside the tick band, sweeping ACROSS the logo
  const needleLength = r - 6;

  return (
    <View style={[styles.container, { width: size + 40 }]}>
      <View style={{ width: size, height: size }}>
        {/* Outer gauge ring (white face, tick band) */}
        <Svg width={size} height={size}>
          {/* Outer black ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="#fff"
            stroke="#0f172a"
            strokeWidth={4}
          />
          {/* Inner subtle ring */}
          <Circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#e2e8f0" strokeWidth={1} />
          {/* Redline arc */}
          <Path d={redlinePath} stroke="#dc2626" strokeWidth={5} fill="none" strokeLinecap="round" />
          {ticks}
        </Svg>

        {/* Dominant centered logo — circular mask via borderRadius */}
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

        {/* Needle (absolutely positioned, rotates over the logo) */}
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
              backgroundColor: '#dc2626',
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              marginBottom: needleLength - 12,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 4,
            }}
          />
        </Animated.View>

        {/* Center hub — drawn on top of the needle */}
        <View
          pointerEvents="none"
          style={[
            styles.hubOuter,
            { left: cx - 11, top: cy - 11 },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.hubInner,
            { left: cx - 4, top: cy - 4 },
          ]}
        />
      </View>

      <View style={styles.rpmDisplay}>
        <Text style={styles.rpmValue}>{displayRpm.toLocaleString()}</Text>
        <Text style={styles.rpmUnit}>RPM</Text>
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubOuter: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0f172a',
  },
  hubInner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  rpmDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
    gap: 6,
  },
  rpmValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  rpmUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 2,
  },
  label: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#64748b',
  },
});
