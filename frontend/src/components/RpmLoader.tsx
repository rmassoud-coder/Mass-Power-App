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
const TEXT_WHITE = '#FFFFFF';
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
  const segments = 50;
  const startAngle = -150;
  const endAngle = 120;
  const nodes = [];

  // Background arc
  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={8}
      fill="none"
    />
  );

  // Active arc with BMW color zones
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle + ratio * (endAngle - startAngle);
    const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    
    let color = BMW_LT_BLUE;
    if (ratio > 0.6 && ratio < 0.8) color = BMW_ORANGE;
    else if (ratio >= 0.8) color = BMW_RED;
    
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
        opacity={active ? 1 : 0.2}
      />
    );
  }

  // Ticks with white labels
  for (let i = 0; i <= 10; i++) {
    const ratio = i / 10;
    const angle = startAngle + ratio * (endAngle - startAngle);
    const inner = pt(cx, cy, r - 18, angle);
    const outer = pt(cx, cy, r - 10, angle);
    const label = pt(cx, cy, r - 30, angle);
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
        strokeWidth={isMain ? 2.5 : 1}
        strokeLinecap="round"
      />
    );
    if (isMain) {
      nodes.push(
        <SvgText
          key={`l${i}`}
          x={label.x}
          y={label.y + 4}
          fill={TEXT_WHITE}
          fontSize={10}
          fontWeight="600"
          textAnchor="middle"
        >
          {val}
        </SvgText>
      );
    }
  }

  // Speed value - large white
  nodes.push(
    <SvgText
      key="value"
      x={cx}
      y={cy + 10}
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
      y={cy + 30}
      fill={TEXT_WHITE}
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
  const segments = 50;
  const startAngle = 150;
  const endAngle = -120;
  const nodes = [];

  // Background arc
  nodes.push(
    <Path
      key="bg"
      d={`M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 0 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`}
      stroke="#1A2029"
      strokeWidth={8}
      fill="none"
    />
  );

  // Active arc with BMW color zones
  for (let i = 0; i < segments; i++) {
    const ratio = i / segments;
    const a1 = startAngle - ratio * (startAngle - endAngle);
    const a2 = startAngle - ((i + 1) / segments) * (startAngle - endAngle);
    const p1 = pt(cx, cy, r, a1);
    const p2 = pt(cx, cy, r, a2);
    const active = ratio <= progress;
    
    let color = BMW_ORANGE;
    if (ratio > 0.7) color = BMW_RED;
    
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
        opacity={active ? 1 : 0.2}
      />
    );
  }

  // Ticks with white labels
  for (let i = 0; i <= 8; i++) {
    const ratio = i / 8;
    const angle = startAngle - ratio * (startAngle - endAngle);
    const inner = pt(cx, cy, r - 18, angle);
    const outer = pt(cx, cy, r - 10, angle);
    const label = pt(cx, cy, r - 30, angle);
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
        strokeWidth={isMain ? 2.5 : 1}
        strokeLinecap="round"
      />
    );
    if (isMain) {
      nodes.push(
        <SvgText
          key={`l${i}`}
          x={label.x}
          y={label.y + 4}
          fill={TEXT_WHITE}
          fontSize={10}
          fontWeight="600"
          textAnchor="middle"
        >
          {val}
        </SvgText>
      );
    }
  }

  // RPM value - orange
  nodes.push(
    <SvgText
      key="value"
      x={cx}
      y={cy + 10}
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
      y={cy + 30}
      fill={TEXT_WHITE}
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

// BMW G-Series Style Fuel Gauge
function FuelGauge({
  cx,
  cy,
  r,
  value,
}: {
  cx: number;
  cy: number;
  r: number;
  value: number;
}) {
  const startAngle = -120;
  const endAngle = 120;
  const progress = value / 100;
  
  const bgPath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`;
  const activeAngle = startAngle + progress * (endAngle - startAngle);
  const activePath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, activeAngle).x} ${pt(cx, cy, r, activeAngle).y}`;

  const fuelColor = value < 20 ? BMW_RED : BMW_ORANGE;

  return (
    <G>
      <Path d={bgPath} stroke="#1A2029" strokeWidth={4} fill="none" />
      <Path d={activePath} stroke={fuelColor} strokeWidth={4} fill="none" strokeLinecap="round" />
      
      <SvgText x={pt(cx, cy, r + 16, startAngle).x} y={pt(cx, cy, r + 16, startAngle).y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="700" textAnchor="middle">
        E
      </SvgText>
      <SvgText x={pt(cx, cy, r + 16, endAngle).x} y={pt(cx, cy, r + 16, endAngle).y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="700" textAnchor="middle">
        F
      </SvgText>
      
      <SvgText x={cx} y={cy + 5} fill={TEXT_WHITE} fontSize={14} fontWeight="700" textAnchor="middle">
        {Math.round(value)}%
      </SvgText>
      <SvgText x={cx} y={cy + 20} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle" letterSpacing="1">
        FUEL
      </SvgText>
    </G>
  );
}

// BMW G-Series Style Temperature Gauge
function TempGauge({
  cx,
  cy,
  r,
  value,
}: {
  cx: number;
  cy: number;
  r: number;
  value: number;
}) {
  const startAngle = -120;
  const endAngle = 120;
  const progress = Math.min(value / 120, 1);
  
  const bgPath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`;
  const activeAngle = startAngle + progress * (endAngle - startAngle);
  const activePath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, activeAngle).x} ${pt(cx, cy, r, activeAngle).y}`;

  const tempColor = value > 100 ? BMW_RED : value > 90 ? BMW_ORANGE : GREEN;

  return (
    <G>
      <Path d={bgPath} stroke="#1A2029" strokeWidth={4} fill="none" />
      <Path d={activePath} stroke={tempColor} strokeWidth={4} fill="none" strokeLinecap="round" />
      
      <SvgText x={pt(cx, cy, r + 16, startAngle).x} y={pt(cx, cy, r + 16, startAngle).y + 4} fill={TEXT_WHITE} fontSize={8} fontWeight="600" textAnchor="middle">
        50°
      </SvgText>
      <SvgText x={pt(cx, cy, r + 16, endAngle).x} y={pt(cx, cy, r + 16, endAngle).y + 4} fill={TEXT_WHITE} fontSize={8} fontWeight="600" textAnchor="middle">
        120°
      </SvgText>
      
      <SvgText x={cx} y={cy + 5} fill={TEXT_WHITE} fontSize={14} fontWeight="700" textAnchor="middle">
        {Math.round(value)}°
      </SvgText>
      <SvgText x={cx} y={cy + 20} fill={TEXT_WHITE} fontSize={9} fontWeight="600" textAnchor="middle" letterSpacing="1">
        TEMP
      </SvgText>
    </G>
  );
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
  const [fuelLevel, setFuelLevel] = useState(65);
  const [tempLevel, setTempLevel] = useState(90);

  const phases = [
    { label: 'CHISELED OUTER SHROUD', desc: 'Premium aluminum frame with precision engineering' },
    { label: 'REVERSE-SWEEPING TACHOMETER', desc: 'Authentic BMW M sport instrument cluster' },
    { label: 'MULTI-SEGMENTED DISPLAY', desc: 'Dynamic color zones for optimal readability' },
    { label: 'SIGNATURE TELEMETRY', desc: 'Real-time performance data at your fingertips' },
    { label: 'M SPORT MODE', desc: 'Track-focused instrumentation with M performance' },
  ];

  useEffect(() => {
    // ACCELERATION ONLY - NO DECELERATION
    const accelerationSequence = withSequence(
      // Engine start - 0.5s
      withTiming(0.02, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // 1st gear (0-40 km/h) - 1.5s
      withTiming(0.17, { duration: 1500, easing: Easing.out(Easing.quad) }),
      
      // Shift to 2nd
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
      
      // Shift to 5th
      withTiming(0.60, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 5th gear - hold at 160 km/h
      withDelay(3000, withTiming(0.67, { duration: 1 }))
    );

    speed.value = withSequence(accelerationSequence);
  }, [speed]);

  // RPM follows speed with gear shifts
  useEffect(() => {
    const rpmSequence = withSequence(
      // Start - idle
      withTiming(800, { duration: 500, easing: Easing.out(Easing.cubic) }),
      
      // 1st gear
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(4500, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 2nd gear
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(4800, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 3rd gear
      withTiming(6500, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(5200, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 4th gear
      withTiming(6200, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withTiming(5000, { duration: 400, easing: Easing.inOut(Easing.quad) }),
      
      // 5th gear - hold at 5000 RPM
      withDelay(3000, withTiming(5000, { duration: 1 }))
    );

    rpm.value = withSequence(rpmSequence);
  }, [rpm]);

  // Gear sequence - NO DOWNSHIFT
  useEffect(() => {
    const gearSequence = [
      { time: 0, gear: 'N' },
      { time: 600, gear: '1' },
      { time: 2100, gear: '2' },
      { time: 2500, gear: '2' },
      { time: 4000, gear: '3' },
      { time: 4400, gear: '3' },
      { time: 5900, gear: '4' },
      { time: 6300, gear: '4' },
      { time: 7900, gear: '5' },
      { time: 8300, gear: '5' },
    ];

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < gearSequence.length) {
        setGear(gearSequence[currentIndex].gear);
        currentIndex++;
      } else {
        clearInterval(interval);
        // Hold at 5th gear then complete
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [onComplete]);

  // Simulate temperature rising during acceleration
  useEffect(() => {
    const tempInterval = setInterval(() => {
      setTempLevel(prev => {
        const newTemp = prev + (Math.random() * 1.5 - 0.3);
        return Math.min(105, Math.max(80, newTemp));
      });
    }, 1000);
    return () => clearInterval(tempInterval);
  }, []);

  // Simulate fuel decreasing slightly
  useEffect(() => {
    const fuelInterval = setInterval(() => {
      setFuelLevel(prev => {
        const newFuel = prev - (Math.random() * 0.3);
        return Math.max(10, newFuel);
      });
    }, 2000);
    return () => clearInterval(fuelInterval);
  }, []);

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
    
    let phaseIndex = 0;
    if (speedKmh > 140) phaseIndex = 4;
    else if (speedKmh > 100) phaseIndex = 3;
    else if (speedKmh > 60) phaseIndex = 2;
    else if (speedKmh > 20) phaseIndex = 1;
    else phaseIndex = 0;
    
    runOnJS(setAnimationPhase)(phaseIndex);
  }, [speed, rpm]);

  const maxWidth = Math.min(containerWidth, 480);
  const gaugeWidth = maxWidth;
  const gaugeHeight = gaugeWidth * 0.52;
  const centerY = gaugeHeight * 0.45;
  const gaugeR = Math.min(gaugeWidth * 0.19, 70);
  const leftX = gaugeWidth * 0.27;
  const rightX = gaugeWidth * 0.73;
  const centerX = gaugeWidth * 0.5;
  
  const fuelX = gaugeWidth * 0.28;
  const tempX = gaugeWidth * 0.72;
  const fuelTempY = gaugeHeight * 0.82;
  const smallGaugeR = gaugeR * 0.6;

  return (
    <View style={styles.container}>
      <View
        style={[styles.dashboard, { maxWidth: 480 }]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Header - Fixed with full text */}
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

            {/* Speed Gauge */}
            <SpeedGauge
              cx={leftX}
              cy={centerY}
              r={gaugeR}
              progress={displayProgress}
              value={displaySpeed}
            />

            {/* RPM Gauge */}
            <RpmGauge
              cx={rightX}
              cy={centerY}
              r={gaugeR}
              progress={displayProgress}
              value={displayRpm}
            />

            {/* Center - Gear Indicator with D */}
            <G>
              <Path
                d={`M ${centerX - 40} ${centerY - 40} L ${centerX} ${centerY - 58} L ${centerX + 40} ${centerY - 40} L ${centerX} ${centerY - 22} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX - 40} ${centerY + 40} L ${centerX} ${centerY + 58} L ${centerX + 40} ${centerY + 40} L ${centerX} ${centerY + 22} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX - 58} ${centerY} L ${centerX - 40} ${centerY - 40} L ${centerX - 22} ${centerY} L ${centerX - 40} ${centerY + 40} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />
              <Path
                d={`M ${centerX + 58} ${centerY} L ${centerX + 40} ${centerY - 40} L ${centerX + 22} ${centerY} L ${centerX + 40} ${centerY + 40} Z`}
                stroke="#2A3448"
                strokeWidth={0.5}
                fill="none"
                opacity={0.5}
              />

              <Circle
                cx={centerX}
                cy={centerY}
                r={30}
                fill="#0A0B0E"
                stroke="#2A3448"
                strokeWidth={1.5}
              />
              <Circle
                cx={centerX}
                cy={centerY}
                r={26}
                fill="none"
                stroke="#3A4A5A"
                strokeWidth={0.5}
                opacity={0.5}
              />

              <SvgText
                x={centerX}
                y={centerY + 6}
                fill={TEXT_WHITE}
                fontSize={20}
                fontWeight="900"
                textAnchor="middle"
              >
                {gear === 'N' ? 'D' : gear}
              </SvgText>
            </G>

            {/* Fuel Gauge */}
            <FuelGauge
              cx={fuelX}
              cy={fuelTempY}
              r={smallGaugeR}
              value={fuelLevel}
            />

            {/* Temperature Gauge */}
            <TempGauge
              cx={tempX}
              cy={fuelTempY}
              r={smallGaugeR}
              value={tempLevel}
            />
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
            <Text style={styles.barLabel}>OIL</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '85%', backgroundColor: BMW_LT_BLUE }]} />
            </View>
          </View>
          <View style={styles.barSection}>
            <Text style={styles.barLabel}>BATTERY</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '92%', backgroundColor: GREEN }]} />
            </View>
          </View>
          <View style={styles.barSection}>
            <Text style={styles.barLabel}>BRAKE</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: '100%', backgroundColor: BMW_ORANGE }]} />
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
            <Text style={[styles.statusText, { color: engineOn ? GREEN : TEXT_WHITE }]}>
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
    color: TEXT_WHITE,
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
    color: TEXT_WHITE,
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
    color: TEXT_WHITE,
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
    color: TEXT_WHITE,
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
    color: TEXT_WHITE,
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
    color: TEXT_WHITE,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rightText: {
    fontSize: 8,
    color: TEXT_WHITE,
    fontWeight: '600',
  },
});
