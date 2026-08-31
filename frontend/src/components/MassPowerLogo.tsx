<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="100%" height="100%">
  <defs>
    <!-- Gradient for text and borders -->
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0066b2" />
      <stop offset="100%" stop-color="#002d62" />
    </linearGradient>
  </defs>

  <!-- Outside background is transparent by default. Inside circle is white. -->
  <circle cx="500" cy="500" r="485" fill="#ffffff" stroke="url(#blueGrad)" stroke-width="14" />
  
  <style>
    .logo-text {
      font-family: 'Times New Roman', Times, serif, Georgia;
      font-weight: bold;
      fill: url(#blueGrad);
      text-anchor: middle;
    }
  </style>

  <!-- MASS Text -->
  <text x="500" y="460" font-size="195" class="logo-text" letter-spacing="12">MASS</text>

  <!-- POWER Layout -->
  <!-- P (Adjusted x from 155 to 210) -->
  <text x="210" y="680" font-size="160" class="logo-text" text-anchor="start">P</text>
  
  <!-- O (Circuit Orb) -->
  <g transform="translate(305, 625)">
    <circle cx="0" cy="0" r="75" fill="url(#blueGrad)" />
    <!-- Circuit traces inside O -->
    <path d="M -45,-25 L -20,-25 L -5,-5 M -45,15 L -20,15 L 0,-5 L 0,-45 M -25,45 L -5,25 L -5,5 L 35,5 M 10,45 L 25,30 L 25,-25" 
          stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <!-- Circuit nodes -->
    <circle cx="-45" cy="-25" r="4" fill="#ffffff" />
    <circle cx="-45" cy="15" r="4" fill="#ffffff" />
    <circle cx="0" cy="-45" r="4" fill="#ffffff" />
    <circle cx="-25" cy="45" r="4" fill="#ffffff" />
    <circle cx="10" cy="45" r="4" fill="#ffffff" />
    <circle cx="35" cy="5" r="4" fill="#ffffff" />
    <circle cx="25" cy="-25" r="4" fill="#ffffff" />
  </g>

  <!-- WER (Adjusted x from 400 to 420) -->
  <text x="420" y="680" font-size="160" class="logo-text" text-anchor="start" letter-spacing="8">WER</text>
</svg>
