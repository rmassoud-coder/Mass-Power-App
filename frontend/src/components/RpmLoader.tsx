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
const BMW_DK_BLUE = '#0038A8';
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
  
  // Background arc
  const bgPath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, endAngle).x} ${pt(cx, cy, r, endAngle).y}`;
  
  // Active arc
  const activeAngle = startAngle + progress * (endAngle - startAngle);
  const activePath = `M ${pt(cx, cy, r, startAngle).x} ${pt(cx, cy, r, startAngle).y} A ${r} ${r} 0 0 1 ${pt(cx, cy, r, activeAngle).x} ${pt(cx, cy, r, activeAngle).y}`;

  const fuelColor = value < 20 ? BMW_RED : BMW_ORANGE;

  return (
    <G>
      <Path d={bgPath} stroke="#1A2029" strokeWidth={4} fill="none" />
      <Path d={activePath} stroke={fuelColor} strokeWidth={4} fill="none" strokeLinecap="round" />
      
      {/* E and F labels - white */}
      <SvgText x={pt(cx, cy, r + 16, startAngle).x} y={pt(cx, cy, r + 16, startAngle).y + 4} fill={TEXT_WHITE} fontSize={9} fontWeight="700" textAnchor="middle">
        E
      </
