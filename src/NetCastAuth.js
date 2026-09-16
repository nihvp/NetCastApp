import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  StyleSheet,
  Alert,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NetCastAuth({ onAuthSuccess }) {
  const [ipAddress, setIpAddress] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const theme = isDark ? darkStyles : lightStyles;

  const requestPin = async () => {
    const cleanIp = ipAddress.trim();
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (!ipRegex.test(cleanIp)) {
      Alert.alert("Invalid IP", "Please enter a valid format (e.g., 192.168.1.5)");
      return;
    }

    setIpAddress(cleanIp);
    setLoading(true);

    const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthKeyReq</type></auth>`;
    try {
      await fetch(`http://${cleanIp}:8080/roap/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/atom+xml' },
        body: xml
      });
      setStep(2);
    } catch (e) { 
      Alert.alert('Error', 'Could not reach TV. Ensure both devices are on the same Wi-Fi.'); 
    }
    setLoading(false);
  };

  const submitPin = async () => {
    setLoading(true);
    const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthReq</type><value>${pin}</value></auth>`;
    try {
      const response = await fetch(`http://${ipAddress}:8080/roap/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/atom+xml' },
        body: xml
      });
      const match = (await response.text()).match(/<session>(.*?)<\/session>/);
      
      if (match && match[1]) {
        onAuthSuccess(ipAddress, match[1], pin);
      } else {
        Alert.alert('Error', 'Invalid PIN.');
      }
    } catch (e) { 
      Alert.alert('Error', 'Connection failed.'); 
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[theme.container, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={theme.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={theme.card}>
          <Text style={theme.header}>Pair TV</Text>
          <Text style={theme.subHeader}>
            {step === 1 ? "Enter your LG NetCast TV's IP address" : "Enter the pairing PIN displayed on your TV"}
          </Text>
          
          {step === 1 ? (
            <>
              <TextInput 
                style={theme.input} 
                placeholder="TV IP Address (e.g. 192.168.1.5)" 
                placeholderTextColor={isDark ? '#888' : '#999'} 
                value={ipAddress} 
                onChangeText={setIpAddress} 
                keyboardType="numeric" 
                autoCorrect={false}
                autoCapitalize="none"
              />
              {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 12 }} />
              ) : (
                <TouchableOpacity style={theme.actionBtn} onPress={requestPin} activeOpacity={0.8}>
                  <Text style={theme.actionBtnText}>Get PIN</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TextInput 
                style={theme.input} 
                placeholder="Enter PIN from TV" 
                placeholderTextColor={isDark ? '#888' : '#999'} 
                value={pin} 
                onChangeText={setPin} 
                keyboardType="numeric" 
                autoFocus={true}
              />
              {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 12 }} />
              ) : (
                <>
                  <TouchableOpacity style={theme.actionBtn} onPress={submitPin} activeOpacity={0.8}>
                    <Text style={theme.actionBtnText}>Pair TV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={theme.backBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
                    <Text style={theme.backBtnText}>Change IP</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = {
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center'
  },
  subHeader: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
    textAlign: 'center'
  },
  input: {
    width: '100%',
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    fontSize: 17,
    textAlign: 'center'
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600'
  },
  backBtn: {
    marginTop: 16,
    padding: 8
  },
  backBtnText: {
    color: '#007AFF',
    fontSize: 15
  }
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: { ...baseStyles.container, backgroundColor: '#F2F2F7' },
  header: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', color: '#000000' },
  input: { ...baseStyles.input, borderColor: '#D1D1D6', color: '#000000', backgroundColor: '#FFFFFF' }
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: { ...baseStyles.container, backgroundColor: '#000000' },
  header: { fontSize: 26, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', color: '#FFFFFF' },
  input: { ...baseStyles.input, borderColor: '#3A3A3C', color: '#FFFFFF', backgroundColor: '#1C1C1E' }
});