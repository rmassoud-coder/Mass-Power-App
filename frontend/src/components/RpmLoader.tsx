// RpmLoader.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';

// Types
interface RpmLoaderProps {
  rpmValue?: number;
  maxRpm?: number;
  size?: number;
  showNumeric?: boolean;
  segmentCount?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  colorScheme?: 'default' | 'sport' | 'eco' | 'custom';
  customColors?: {
    low?: string;
    mid?: string;
    high?: string;
    critical?: string;
  };
  animated?: boolean;
  glowIntensity?: number;
  showGlow?: boolean;
}

const RpmLoader: React.FC<RpmLoaderProps> = ({
  rpmValue = 0,
  maxRpm = 8000,
  size = 200,
  showNumeric = true,
  segmentCount = 20,
  warningThreshold = 6000,
  criticalThreshold = 7000,
  colorScheme = 'default',
  customColors = {},
  animated = true,
  glowIntensity = 1,
  showGlow = true,
}) => {
  const [currentRpm, setCurrentRpm] = useState(rpmValue);
  const [progressAnim] = useState(new Animated.Value(0));
  const [glowAnim] = useState(new Animated.Value(0));

  // Color schemes
  const getColors = () => {
    const schemes = {
      default: {
        low: '#00E5FF',
        mid: '#FFD700',
        high: '#FF6B00',
        critical: '#FF0040'
      },
      sport: {
        low: '#FF0040',
        mid: '#FF6B00',
        high: '#FFD700',
        critical: '#00E5FF'
      },
      eco: {
        low: '#00FF88',
        mid: '#FFD700',
        high: '#FF6B00',
        critical: '#FF0040'
      }
    };
    return { ...schemes[colorScheme as keyof typeof schemes], ...customColors };
  };

  const colors = getColors();

  // Get color based on RPM
  const getRpmColor = (rpm: number) => {
    const percentage = rpm / maxRpm;
    if (percentage >= 0.875) return colors.critical;
    if (percentage >= 0.75) return colors.high;
    if (percentage >= 0.5) return colors.mid;
    return colors.low;
  };

  // Animate RPM
  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.timing(progressAnim, {
          toValue: rpmValue / maxRpm,
          duration: 800,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: rpmValue / maxRpm > 0.8 ? 1 : 0.3,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
      setCurrentRpm(rpmValue);
    } else {
      setCurrentRpm(rpmValue);
      progressAnim.setValue(rpmValue / maxRpm);
    }
  }, [rpmValue, animated, maxRpm]);

  // Calculate segment colors
  const getSegmentColor = (index: number) => {
    const segmentRpm = (index / segmentCount) * maxRpm;
    return getRpmColor(segmentRpm);
  };

  // Render RPM segments
  const renderSegments = () => {
    const segments = [];
    const radius = size * 0.38;
    const center = size / 2;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;
    const angleRange = endAngle - startAngle;

    for (let i = 0; i < segmentCount; i++) {
      const angle = startAngle + (i / segmentCount) * angleRange;
      const nextAngle = startAngle + ((i + 1) / segmentCount) * angleRange;
      
      const x1 = center + radius * Math.cos(angle);
      const y1 = center + radius * Math.sin(angle);
      const x2 = center + radius * Math.cos(nextAngle);
      const y2 = center + radius * Math.sin(nextAngle);

      const progress = i / segmentCount;
      const isActive = progress <= progressAnim._value || 
                       (i === Math.floor(segmentCount * progressAnim._value));

      segments.push(
        <Path
          key={i}
          d={`M ${x1} ${y1} L ${x2} ${y2}`}
          stroke={isActive ? getSegmentColor(i * (maxRpm / segmentCount)) : '#333333'}
          strokeWidth={size * 0.035}
          strokeLinecap="round"
          opacity={isActive ? 1 : 0.3}
        />
      );
    }
    return segments;
  };

  // Render numeric display
  const renderNumeric = () => {
    if (!showNumeric) return null;
    const displayRpm = Math.round(currentRpm);
    const rpmColor = getRpmColor(currentRpm);
    const scale = 1 + (currentRpm / maxRpm) * 0.2;

    return (
      <Animated.View style={[styles.numericContainer, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.rpmValue, { color: rpmColor }]}>
          {displayRpm}
        </Animated.Text>
        <Text style={styles.rpmLabel}>RPM</Text>
      </Animated.View>
    );
  };

  // Render glow effect
  const renderGlow = () => {
    if (!showGlow) return null;
    const glowColor = getRpmColor(currentRpm);
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 0.3, 0.8, 1],
      outputRange: [0.1, 0.2, 0.6, 0.8]
    });

    return (
      <Animated.View
        style={[
          styles.glowContainer,
          {
            opacity: glowOpacity,
            transform: [{ scale: 1 + (currentRpm / maxRpm) * 0.3 }],
          },
        ]}
      >
        <BlurView intensity={20} tint="dark" style={styles.glowBlur}>
          <View style={[styles.glow, { backgroundColor: glowColor }]} />
        </BlurView>
      </Animated.View>
    );
  };

  // Render warning indicators
  const renderWarnings = () => {
    if (currentRpm < warningThreshold) return null;
    const warningLevel = currentRpm >= criticalThreshold ? 'critical' : 'warning';
    const pulseAnim = new Animated.Value(1);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return (
      <Animated.View style={[styles.warningContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[
          styles.warningDot,
          { backgroundColor: warningLevel === 'critical' ? '#FF0040' : '#FFD700' }
        ]} />
        <Text style={[
          styles.warningText,
          { color: warningLevel === 'critical' ? '#FF0040' : '#FFD700' }
        ]}>
          {warningLevel === 'critical' ? '⚠ CRITICAL' : '⚠ WARNING'}
        </Text>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {renderGlow()}
      
      <View style={styles.svgContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G rotation="-90" origin={`${size/2}, ${size/2}`}>
            {renderSegments()}
          </G>
        </Svg>
      </View>

      {renderNumeric()}
      {renderWarnings()}

      {/* RPM Gauge Markers */}
      <View style={styles.markersContainer}>
        {[0, 25, 50, 75, 100].map((percent) => {
          const angle = -135 + (percent / 100) * 270;
          const radius = size * 0.45;
          const x = size / 2 + radius * Math.cos((angle * Math.PI) / 180);
          const y = size / 2 + radius * Math.sin((angle * Math.PI) / 180);
          const value = Math.round((percent / 100) * maxRpm / 1000);
          
          return (
            <Text
              key={percent}
              style={[
                styles.markerLabel,
                {
                  left: x - size * 0.04,
                  top: y - size * 0.04,
                  fontSize: size * 0.035,
                  color: percent >= 87.5 ? colors.critical : 
                         percent >= 75 ? colors.high : '#888'
                }
              ]}
            >
              {value}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  numericContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpmValue: {
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    includeFontPadding: false,
  },
  rpmLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 2,
  },
  glowContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBlur: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 100,
  },
  glow: {
    width: '100%',
    height: '100%',
    opacity: 0.1,
    borderRadius: 100,
  },
  warningContainer: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  warningText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  markersContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  markerLabel: {
    position: 'absolute',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default RpmLoader;
