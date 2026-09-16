import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Button, Text, StyleSheet, AppState, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetCastAuth from './src/NetCastAuth';
import NetCastRemote from './src/NetCastRemote';

export default function App() {
  const [ipAddress, setIpAddress] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [savedPin, setSavedPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    const loadSession = async () => {
      const ip = await AsyncStorage.getItem('@tv_ip');
      const session = await AsyncStorage.getItem('@tv_session');
      const pin = await AsyncStorage.getItem('@tv_pin');
      
      if (ip) setIpAddress(ip);
      if (pin) setSavedPin(pin);
      if (ip && session) setSessionId(session);
      setLoading(false);
    };
    loadSession();
  }, []);

  //Reconnects silently if you background the app and come back
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && ipAddress && savedPin && !sessionId) {
        silentReconnect();
      }
    });

    return () => subscription.remove();
  }, [ipAddress, savedPin, sessionId]);

  const handleAuthSuccess = async (ip, session, pin) => {
    await AsyncStorage.setItem('@tv_ip', ip);
    await AsyncStorage.setItem('@tv_session', session);
    if (pin) await AsyncStorage.setItem('@tv_pin', pin);
    setIpAddress(ip);
    setSessionId(session);
    setSavedPin(pin);
  };

  const handleDisconnect = async () => {
    // ONLY remove the dead session, keep the IP & PIN saved
    await AsyncStorage.removeItem('@tv_session'); 
    setSessionId(null);
  };

  const forgetTv = async () => {
    await AsyncStorage.clear();
    setIpAddress(null);
    setSessionId(null);
    setSavedPin(null);
  };

  const silentReconnect = async () => {
    setLoading(true);
    const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthReq</type><value>${savedPin}</value></auth>`;
    try {
      const response = await fetch(`http://${ipAddress}:8080/roap/api/auth`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/atom+xml' }, 
        body: xml,
      });
      const match = (await response.text()).match(/<session>(.*?)<\/session>/);
      
      if (match && match[1]) {
        await AsyncStorage.setItem('@tv_session', match[1]);
        setSessionId(match[1]);
      } else {
        alert('TV rejected the connection. Is it on?');
      }
    } catch (e) { 
      alert('Could not reach TV. Make sure it is turned on.'); 
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#000000' : '#F2F2F7'} />
        <View style={[styles.center, { backgroundColor: isDark ? '#000000' : '#F2F2F7' }]}>
          <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#007AFF'} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#000000' : '#F2F2F7'} />
      <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F2F2F7' }]}>
        {sessionId && ipAddress ? (
          <NetCastRemote ipAddress={ipAddress} sessionId={sessionId} onDisconnect={handleDisconnect} />
        ) : ipAddress && savedPin ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 18, marginBottom: 20, color: isDark ? '#FFFFFF' : '#000000' }}>TV Offline</Text>
            <Button title="Tap to Reconnect" onPress={silentReconnect} />
            <View style={{ height: 20 }} />
            <Button title="Forget TV" color="#FF3B30" onPress={forgetTv} />
          </View>
        ) : (
          <NetCastAuth onAuthSuccess={handleAuthSuccess} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});