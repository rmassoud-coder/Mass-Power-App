// App.tsx
import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, Text } from 'react-native';
import M4HeadlightLoader from './src/components/M4HeadlightLoader';

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {!isLoaded ? (
        <M4HeadlightLoader 
          label="BMW M PERFORMANCE" 
          onComplete={() => setIsLoaded(true)} 
        />
      ) : (
        <View style={styles.mainAppContainer}>
          <Text style={styles.welcomeText}>App Successfully Loaded</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  mainAppContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  welcomeText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});
// src/components/M4HeadlightLoader.tsx
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import HeadlightBackground from './HeadlightBackground';
import HeadlightOverlays from './HeadlightOverlays';
import HeadlightProgressBar from './HeadlightProgressBar';

const { width, height } = Dimensions.get('window');

export default function M4HeadlightLoader({ label, onComplete }: any) {
  const drlOpacity = useRef(new Animated.Value(0)).current;
  const beamOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Coordinated sequence matching the real car unlock sequence
    Animated.sequence([
      Animated.delay(400), // Start in total darkness

      // Step 1: DRL fiber-optic halos fade in smoothly
      Animated.timing(drlOpacity, {
        toValue: 0.7,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.delay(500),

      // Step 2: Main projector beams snap open instantly while progress bar finishes
      Animated.parallel([
        Animated.timing(beamOpacity, {
          toValue: 1,
          duration: 150, // Instant crisp pop
          useNativeDriver: true,
        }),
        Animated.timing(drlOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false, // Layout widths can't use native driver
        }),
      ]),
      Animated.delay(600), // Hold the fully lit beast for a split second
    ]).start(() => {
      if (onComplete) onComplete();
    });
  }, []);

  return (
    <View style={styles.container}>
      <HeadlightBackground width={width} height={height}>
        
        {/* Layered translucent drawing masks over the photo */}
        <HeadlightOverlays 
          drlOpacity={drlOpacity} 
          beamOpacity={beamOpacity} 
          width={width} 
          height={height} 
        />

        {/* Lower interface layout bar */}
        <HeadlightProgressBar 
          label={label} 
          progress={progressWidth} 
          width={width} 
        />

      </HeadlightBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
});
// src/components/HeadlightBackground.tsx
import React from 'react';
import { StyleSheet, ImageBackground } from 'react-native';

export default function HeadlightBackground({ width, height, children }: any) {
  return (
    <ImageBackground
      source={require('../assets/m4_shadow_body.jpg')}
      style={[styles.bgImage, { width, height }]}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
// src/components/HeadlightOverlays.tsx
import React from 'react';
import { StyleSheet, Animated } from 'react-native';

export default function HeadlightOverlays({ drlOpacity, beamOpacity, width, height }: any) {
  return (
    <>
      {/* Glow Layer A: Sharp Daytime Running Light paths */}
      <Animated.Image
        source={require('../assets/vector_drl_glow.png')}
        style={[styles.overlay, { width, height, opacity: drlOpacity }]}
        resizeMode="cover"
      />

      {/* Glow Layer B: High intensity central lens flares */}
      <Animated.Image
        source={require('../assets/vector_projector_lens_flare.png')}
        style={[styles.overlay, { width, height, opacity: beamOpacity }]}
        resizeMode="cover"
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
