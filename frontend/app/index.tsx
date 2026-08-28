import React from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to home - the splash screen is handled in _layout
  return <Redirect href="/home" />;
}
