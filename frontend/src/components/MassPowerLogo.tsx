import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText, G, Path } from 'react-native-svg';

const MassPowerLogo = ({ width = 75, height = 75 }) => {
  return (
    <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width={width} height={height}>
      <Defs>
        <LinearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#0066b2" />
          <Stop offset="100%" stopColor="#002d62" />
        </LinearGradient>
      </Defs>

      <Circle cx="500" cy="500" r="485" fill="#ffffff" stroke="url(#blueGrad)" strokeWidth="14" />
      
      <SvgText
        x="500"
        y="460"
        fontSize="185"
        fontWeight="bold"
        fill="url(#blueGrad)"
        textAnchor="middle"
        letterSpacing="12"
        fontFamily="Times New Roman, Times, serif"
      >
        MASS
      </SvgText>

      <SvgText
        x="210"
        y="680"
        fontSize="180"
        fontWeight="bold"
        fill="url(#blueGrad)"
        textAnchor="start"
        letterSpacing="10"
        fontFamily="Times New Roman, Times, serif"
      >
        Po
      </SvgText>
      
      {/* >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */}
      {/* >>>>>>>>>>>>>>>>>>>>>>>>>>  EDIT THIS PART  <<<<<<<<<<<<<<<<<<<<<<<<<<<<< */}
      {/* >>>>>>>>>> Change '355' to '305' (center), or '255' (shift left)  <<<<<<< */}
      {/* >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */}
      <G transform="translate(355, 625)">
        <Circle cx="0" cy="0" r="75" fill="url(#blueGrad)" />
        <Path 
          d="M -45,-25 L -20,-25 L -5,-5 M -45,15 L -20,15 L 0,-5 L 0,-45 M -25,45 L -5,25 L -5,5 L 35,5 M 10,45 L 25,30 L 25,-25" 
          stroke="#ffffff" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          fill="none" 
        />
        <Circle cx="-45" cy="-25" r="4" fill="#ffffff" />
        <Circle cx="-45" cy="15" r="4" fill="#ffffff" />
        <Circle cx="0" cy="-45" r="4" fill="#ffffff" />
        <Circle cx="-25" cy="45" r="4" fill="#ffffff" />
        <Circle cx="10" cy="45" r="4" fill="#ffffff" />
        <Circle cx="35" cy="5" r="4" fill="#ffffff" />
        <Circle cx="25" cy="-25" r="4" fill="#ffffff" />
      </G>

      <SvgText
        x="420"
        y="680"
        fontSize="180"
        fontWeight="bold"
        fill="url(#blueGrad)"
        textAnchor="start"
        letterSpacing="10"
        fontFamily="Times New Roman, Times, serif"
      >
        WER
      </SvgText>

    </Svg>
  );
};

export default MassPowerLogo;
