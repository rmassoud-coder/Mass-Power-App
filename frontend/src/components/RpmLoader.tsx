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
import Svg, { Circle, Path, G, Line, Text as SvgText } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ignore = AnimatedG;

interface Props {
  /** Optional label shown under the gauge — defaults to "STARTING ENGINE..." */
  label?: string;
  /** Diameter in dp (default 220) */
  size?: number;
}

/**
 * Tachometer / RPM gauge loader.
 * The needle revs through the gauge in a realistic blip pattern while the app is loading.
 */
export default function RpmLoader({ label = 'STARTING ENGINE...', size = 220 }: Props) {
  // Needle rotation in degrees. 0 = pointing to "0 RPM" position (-130°), 260 = "10 RPM" (+130°).
  const sweep = useSharedValue(0);
  const [displayRpm, setDisplayRpm] = React.useState(0);

  useEffect(() => {
    // Realistic revving pattern: 0 -> 7 -> 2 -> 8 -> 3 -> 9 -> 1 (kRPM)
    const blip = (target: number, up: number, down: number) =>
      withSequence(
        withTiming(target, { duration: up, easing: Easing.out(Easing.cubic) }),
        withTiming(target * 0.25, { duration: down, easing: Easing.in(Easing.cubic) })
      );

    sweep.value = withRepeat(
      withSequence(
        blip(0.7, 350, 500),
        blip(0.85, 280, 450),
        blip(0.95, 220, 600),
        withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }),
        withDelay(150, withTiming(0, { duration: 1 })) // pause beat
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
  const inset = 14;
  const r = radius - inset;
  const cx = radius;
  const cy = radius;

  // Build tick marks every 1000 RPM from -130° to +130° (260° span, 10 segments)
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = -130 + i * 26; // degrees
    const rad = (angle - 90) * (Math.PI / 180); // SVG: 0deg = right; we want 0 at top, so subtract 90
    const inner = r - (i % 2 === 0 ? 16 : 9);
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
    // Numbers on major ticks
    if (i % 1 === 0) {
      const tr = r - 30;
      const tx = cx + Math.cos(rad) * tr;
      const ty = cy + Math.sin(rad) * tr + 4;
      ticks.push(
        <SvgText
          key={`n-${i}`}
          x={tx}
          y={ty}
          fill={isRedline ? '#dc2626' : '#0f172a'}
          fontSize={13}
          fontWeight="800"
          textAnchor="middle"
        >
          {i}
        </SvgText>
      );
    }
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

  return (
    <View style={[styles.container, { width: size + 40 }]}>
      <View style={{ width: size, height: size }}>
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
          {/* Center hub */}
          <Circle cx={cx} cy={cy} r={10} fill="#0f172a" />
          <Circle cx={cx} cy={cy} r={4} fill="#dc2626" />
        </Svg>

        {/* Needle (absolutely positioned, rotates) */}
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
              height: r - 12,
              backgroundColor: '#dc2626',
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              marginBottom: r - 22,
            }}
          />
        </Animated.View>
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
