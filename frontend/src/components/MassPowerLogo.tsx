import React from 'react';
import { Svg, Defs, LinearGradient, Stop, Rect, G, Polygon, Text, Circle } from 'react-native-svg';

interface MassPowerLogoProps {
  width?: number;
  height?: number;
}

export default function MassPowerLogo({ width = 60, height = 60 }: MassPowerLogoProps) {
  // Calculate viewBox scaling
  const viewBoxSize = 500;
  const scale = width / viewBoxSize;
  
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
      <Defs>
        <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#151c26"/>
          <Stop offset="100%" stopColor="#0f141c"/>
        </LinearGradient>
        <LinearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#00e5ff"/>
          <Stop offset="50%" stopColor="#ff5722"/>
          <Stop offset="100%" stopColor="#00e676"/>
        </LinearGradient>
      </Defs>
      
      <Rect x="0" y="0" width="500" height="500" rx="250" fill="url(#bgGrad)" stroke="#1e293b" strokeWidth="8"/>

      {/* M-Style Power Slashes (Instrument Cluster Style) */}
      <G transform="translate(140, 110)">
        <Polygon points="0,100 40,0 90,0 50,100" fill="#00e5ff" opacity="0.9"/>
        <Polygon points="70,100 110,0 160,0 120,100" fill="#ff5722" opacity="0.9"/>
        <Polygon points="140,100 180,0 230,0 190,100" fill="#00e676" opacity="0.9"/>
      </G>

      {/* Typography */}
      <Text
        x="250"
        y="310"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="52"
        fill="#ffffff"
        letterSpacing="4"
      >
        MASS
      </Text>
      <Text
        x="250"
        y="375"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="38"
        fill="#94a3b8"
        letterSpacing="8"
      >
        POWER
      </Text>
      
      {/* Sleek Trim Ring */}
      <Circle cx="250" cy="250" r="225" fill="none" stroke="url(#neonGlow)" strokeWidth="4" strokeDasharray="15 10"/>
    </Svg>
  );
}
