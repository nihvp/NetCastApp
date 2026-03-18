import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet, Alert, useColorScheme } from 'react-native';

export default function NetCastAuth({ onAuthSuccess }) {
  const [ipAddress, setIpAddress] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkStyles : lightStyles;

  const requestPin = async () => {
    setLoading(true);
    const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthKeyReq</type></auth>`;
    try {
      await fetch(`http://${ipAddress}:8080/roap/api/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/atom+xml' }, body: xml
      });
      setStep(2);
    } catch (e) { 
      Alert.alert('Error', 'Could not reach TV.'); 
    }
    setLoading(false);
  };

  const submitPin = async () => {
    setLoading(true);
    const xml = `<?xml version="1.0" encoding="utf-8"?><auth><type>AuthReq</type><value>${pin}</value></auth>`;
    try {
      const response = await fetch(`http://${ipAddress}:8080/roap/api/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/atom+xml' }, body: xml
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
    <View style={theme.container}>
      <Text style={theme.header}>Pair TV</Text>
      
      {step === 1 ? (
        <>
          <TextInput 
            style={theme.input} 
            placeholder="TV IP Address" 
            placeholderTextColor={isDark ? '#aaa' : '#666'} 
            value={ipAddress} 
            onChangeText={setIpAddress} 
            keyboardType="numeric" 
          />
          {loading ? <ActivityIndicator /> : <Button title="Get PIN" onPress={requestPin} />}
        </>
      ) : (
        <>
          <TextInput 
            style={theme.input} 
            placeholder="Enter PIN from TV" 
            placeholderTextColor={isDark ? '#aaa' : '#666'} 
            value={pin} 
            onChangeText={setPin} 
            keyboardType="numeric" 
          />
          {loading ? <ActivityIndicator /> : <Button title="Pair TV" onPress={submitPin} />}
        </>
      )}
    </View>
  );
}

const baseStyles = {
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderWidth: 1, padding: 15, marginBottom: 20, borderRadius: 8, fontSize: 18 }
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: { ...baseStyles.container, backgroundColor: '#F2F2F7' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#000' },
  input: { ...baseStyles.input, borderColor: '#ccc', color: '#000', backgroundColor: '#fff' }
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: { ...baseStyles.container, backgroundColor: '#000' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#fff' },
  input: { ...baseStyles.input, borderColor: '#444', color: '#fff', backgroundColor: '#1C1C1E' }
});