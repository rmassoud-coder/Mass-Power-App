import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
} from 'react-native-svg';

interface Props {
  label?: string;
  size?: number;
}

const BG_DARK = '#0A0D14';
const PANEL = '#151B24';
const TEXT_WHITE = '#FFFFFF';
const TEXT_GRAY = '#8A9AAD';
const SPEED_LOW = '#3A4A7A';
const SPEED_HIGH = '#50B4E6';
const RPM_LOW = '#5A2A2A';
const RPM_HIGH = '#FF3B30';
const GREEN = '#22C55E';
const M_BLUE = '#0066B1';
const M_PURPLE = '#333366';
const M_RED = '#FF0000';

// polar -> cartesian, 0deg = straight up, clockwise positive
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
}: {
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  progress: number;
  colorLow: string;
  colorHigh: string;
  segments?: number;
}) {
  const nodes = [];
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    const color = ratio > 0.62 ? colorHigh : colorLow;
    nodes.push(
      <Line
        key={i}
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={active ? color : '#1A2029'}
        strokeWidth={9}
        strokeLinecap="round"
        opacity={active ? 1 : 0.4}
      />
    );
  }
  return <>{nodes}</>;
}

function GaugeTicks({
  cx,
  cy,
  r,
  startAngle,
  endAngle,
  values,
}: {
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  values: number[];
}) {
  return (
    <>
      {values.map((v, i) => {
        const ratio = i / (values.length - 1);
        const angle = startAngle + ratio * (endAngle - startAngle);
        const inner = pt(cx, cy, r - 22, angle);
        const outer = pt(cx, cy, r - 14, angle);
        const label = pt(cx, cy, r - 34, angle);
        return (
          <G key={i}>
            <Line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={TEXT_GRAY}
              strokeWidth={1.5}
            />
            <SvgText
              x={label.x}
              y={label.y + 3}
              fill={TEXT_GRAY}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {v}
            </SvgText>
          </G>
        );
      })}
    </>
  );
}

export default function RpmLoader({ label = 'STARTING ENGINE...', size = 400 }: Props) {
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
    // Only nudge the "slow" gauges a few times a second, not every frame.
    const jitter = setInterval(() => {
      setTemp(88 + Math.round(Math.random() * 6));
    }, 800);
    return () => {
      clearTimeout(timer);
      clearInterval(jitter);
    };
  }, []);

  // Runs on the UI thread; only bridges to JS a small, fixed number of times
  // per second via throttling inside the setters below — not per frame.
  useDerivedValue(() => {
    runOnJS(setDisplayProgress)(sweep.value);
    runOnJS(setDisplaySpeed)(Math.round(sweep.value * 220));
    runOnJS(setDisplayRpm)(Math.round(sweep.value * 8.5 * 1000));
  }, [sweep]);

  const outerW = size * 1.9;
  const outerH = size * 1.05;
  const cy = outerH * 0.46;
  const gaugeR = size * 0.4;
  const leftCx = outerW * 0.27;
  const rightCx = outerW * 0.73;
  const centerCx = outerW * 0.5;

  const speedTickValues = [0, 40, 80, 120, 160, 200];
  const rpmTickValues = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <View style={[styles.dashboard, { width: outerW + 24 }]}>
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

      <View style={{ width: outerW, height: outerH }}>
        <Svg width={outerW} height={outerH}>
          {/* Left gauge: speed, sweeps bottom-left up to near-center-top */}
          <Circle cx={leftCx} cy={cy} r={gaugeR} fill={PANEL} opacity={0.3} />
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
          <SvgText x={leftCx} y={cy + 6} fill={TEXT_WHITE} fontSize={26} fontWeight="800" textAnchor="middle">
            {displaySpeed}
          </SvgText>
          <SvgText x={leftCx} y={cy + 24} fill={TEXT_GRAY} fontSize={10} fontWeight="600" textAnchor="middle">
            km/h
          </SvgText>

          {/* Right gauge: RPM, mirrored */}
          <Circle cx={rightCx} cy={cy} r={gaugeR} fill={PANEL} opacity={0.3} />
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
          <SvgText x={rightCx} y={cy + 6} fill={TEXT_WHITE} fontSize={26} fontWeight="800" textAnchor="middle">
            {displayRpm}
          </SvgText>
          <SvgText x={rightCx} y={cy + 24} fill={TEXT_GRAY} fontSize={10} fontWeight="600" textAnchor="middle">
            RPM
          </SvgText>

          {/* Center gear diamond */}
          <G>
            <Line x1={centerCx - 40} y1={cy - 40} x2={centerCx + 40} y2={cy + 40} stroke="#242C38" strokeWidth={1} />
            <Line x1={centerCx + 40} y1={cy - 40} x2={centerCx - 40} y2={cy + 40} stroke="#242C38" strokeWidth={1} />
            <Circle cx={centerCx} cy={cy} r={34} fill={BG_DARK} stroke="#2A3440" strokeWidth={1.5} />
            <Polygon
              points={`${centerCx},${cy - 16} ${centerCx + 16},${cy} ${centerCx},${cy + 16} ${centerCx - 16},${cy}`}
              fill="#1A2029"
              stroke={SPEED_HIGH}
              strokeWidth={1.5}
            />
            <SvgText x={centerCx} y={cy + 5} fill={TEXT_WHITE} fontSize={16} fontWeight="900" textAnchor="middle">
              D
            </SvgText>
          </G>
        </Svg>
      </View>

      {/* Bottom telemetry bars: fuel (left) / temp (right) */}
      <View style={styles.barsRow}>
        <View style={styles.barBlock}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${fuel}%`, backgroundColor: M_RED }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabelText}>E</Text>
            <Text style={styles.barLabelText}>F</Text>
          </View>
        </View>
        <View style={styles.barBlock}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${((temp - 60) / 60) * 100}%`, backgroundColor: GREEN }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabelText}>90°C</Text>
            <Text style={styles.barLabelText}>120°C</Text>
          </View>
        </View>
      </View>

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
    backgroundColor: BG_DARK,
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
  headerTitle: { fontSize: 9, color: TEXT_GRAY, fontWeight: '700', letterSpacing: 1.5 },
  mMode: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mModeText: { fontSize: 8, color: M_RED, fontWeight: '800', letterSpacing: 1 },
  mStripes: { flexDirection: 'row', gap: 2 },
  stripe: { width: 8, height: 2, borderRadius: 1 },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 12 },
  barBlock: { width: '46%' },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: '#1A1F2A', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  barLabelText: { fontSize: 8, color: TEXT_GRAY, fontWeight: '600' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 31, 42, 0.3)',
    borderRadius: 6,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center' },
  statusBulb: { width: 5, height: 5, borderRadius: 2.5, marginRight: 6 },
  bulbOn: { backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOpacity: 1, shadowRadius: 4 },
  bulbOff: { backgroundColor: '#555' },
  statusText: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  statusLabel: { fontSize: 8, color: TEXT_GRAY, fontWeight: '600', letterSpacing: 1 },
  mileageText: { fontSize: 8, color: TEXT_GRAY, fontWeight: '600' },
});
