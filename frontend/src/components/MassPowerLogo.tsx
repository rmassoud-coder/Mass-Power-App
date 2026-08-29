import React from 'react';
import Svg, { Path, Text, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function MassPowerLogo({ size = 55 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 300 300" width={size} height={size}>
      <Defs>
        <LinearGradient id="blueGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#00e5ff" />
          <Stop offset="100%" stopColor="#0066ff" />
        </LinearGradient>
        <LinearGradient id="chromeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#f8fafc" />
          <Stop offset="100%" stopColor="#94a3b8" />
        </LinearGradient>
      </Defs>

      <Path
        d="M 60,110 A 110,110 0 0,1 240,110"
        fill="none"
        stroke="url(#blueGlow)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <Path
        d="M 85,95 A 110,110 0 0,1 215,95"
        fill="none"
        stroke="url(#chromeGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <Path
        d="M 240,190 A 110,110 0 0,1 60,190"
        fill="none"
        stroke="url(#blueGlow)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <Path
        d="M 215,205 A 110,110 0 0,1 85,205"
        fill="none"
        stroke="url(#chromeGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <Text
        x="150"
        y="125"
        textAnchor="middle"
        fontFamily="System"
        fontWeight="bold"
        fontSize="34"
        fill="#00e5ff"
        letterSpacing="2"
      >
        MASS
      </Text>

      <G transform="translate(0, 0)">
        <Text
          x="150"
          y="172"
          textAnchor="middle"
          fontFamily="System"
          fontWeight="bold"
          fontSize="32"
          fill="#f8fafc"
          letterSpacing="1"
        >
          P WER
        </Text>

        <Circle cx="132" cy="162" r="15" fill="#0052cc" />
        <Path
          d="M 132,147 A 15,15 0 0,1 147,162 L 132,162 Z"
          fill="#00e5ff"
          opacity="0.8"
        />
        <Path
          d="M 132,177 A 15,15 0 0,1 117,162 L 132,162 Z"
          fill="#f8fafc"
          opacity="0.9"
        />
      </G>
    </Svg>
  );
}
