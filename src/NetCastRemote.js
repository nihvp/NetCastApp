import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Button, useColorScheme, Switch, Pressable} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useThrottle } from './useThrottle';
// hey
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const KEYS = {
  POWER: 1, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, OK: 20,
  HOME: 21, SETTINGS: 22, BACK: 23, VOL_UP: 24, VOL_DOWN: 25, 
  MUTE: 26, CH_UP: 27, CH_DOWN: 28, INPUT: 47,
};

const NUM_KEYS = { 0: 2, 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11 };

export default function NetCastRemote({ ipAddress, sessionId, onDisconnect }) {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [inputText, setInputText] = useState('');

  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkStyles : lightStyles;

  const sendCommand = async (keyCode) => {
    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?><command><session>${sessionId}</session><type>HandleKeyInput</type><value>${keyCode}</value></command>`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`http://${ipAddress}:8080/roap/api/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/atom+xml' },
        body: xmlPayload, signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.status === 401 || response.status === 403) {
        Alert.alert('Session Expired', 'Connection invalid.');
        onDisconnect();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      Alert.alert('Connection Lost', 'Could not reach the TV.');
      onDisconnect();
    }
  };

  const throttledSendCommand = useThrottle(sendCommand, 300);

  const handlePress = (keyCode) => {
    if (hapticsEnabled) {
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    }
    throttledSendCommand(keyCode);
  };

  return (
    <View style={theme.container}>
      <View style={theme.headerRow}>
        <Text style={theme.header}>NetCast Remote</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={theme.settingsBtn}>
          <Text style={theme.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={theme.row}>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.POWER)}><Text style={theme.text}>POWER</Text></TouchableOpacity>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.MUTE)}><Text style={theme.text}>MUTE</Text></TouchableOpacity>
      </View>

      <View style={theme.dpad}>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.UP)}><Text style={theme.text}>UP</Text></TouchableOpacity>
        <View style={theme.row}>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.LEFT)}><Text style={theme.text}>LEFT</Text></TouchableOpacity>
          <TouchableOpacity style={[theme.btn, theme.okBtn]} onPress={() => handlePress(KEYS.OK)}><Text style={theme.text}>OK</Text></TouchableOpacity>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.RIGHT)}><Text style={theme.text}>RIGHT</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.DOWN)}><Text style={theme.text}>DOWN</Text></TouchableOpacity>
      </View>

      <View style={theme.row}>
        <View style={theme.column}>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.VOL_UP)}><Text style={theme.text}>VOL +</Text></TouchableOpacity>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.VOL_DOWN)}><Text style={theme.text}>VOL -</Text></TouchableOpacity>
        </View>
        
        <View style={theme.column}>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.BACK)}><Text style={theme.text}>BACK</Text></TouchableOpacity>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.HOME)}><Text style={theme.text}>HOME</Text></TouchableOpacity>
        </View>

        <View style={theme.column}>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.CH_UP)}><Text style={theme.text}>CH +</Text></TouchableOpacity>
          <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.CH_DOWN)}><Text style={theme.text}>CH -</Text></TouchableOpacity>
        </View>
      </View>

      <View style={theme.row}>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.SETTINGS)}>
          <Text style={theme.text}>SETTINGS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.INPUT)}>
          <Text style={theme.text}>INPUT</Text>
        </TouchableOpacity>
      </View>

      <Button title="Open Numpad" color={isDark ? '#4DA8DA' : '#007AFF'} onPress={() => setShowKeypad(true)} />

      <Modal visible={showKeypad} animationType="slide" transparent={true} onRequestClose={() => setShowKeypad(false)}>
        <TouchableOpacity 
          style={theme.modalContainer} 
          activeOpacity={1} 
          onPressOut={() => setShowKeypad(false)}
        >
        <Pressable style={theme.keypad} onPress={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity key={num} style={theme.numBtn} onPress={() => handlePress(NUM_KEYS[num])}>
                <Text style={theme.numText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={theme.emptyBtn} />
            <TouchableOpacity style={theme.numBtn} onPress={() => handlePress(NUM_KEYS[0])}>
              <Text style={theme.numText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={theme.closeBtn} onPress={() => setShowKeypad(false)}>
              <Text style={theme.numText}>X</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>
      
      <Modal visible={showSettings} animationType="fade" transparent={true}>
        <View style={theme.modalContainerCentered}>
          <View style={theme.settingsPanel}>
            <Text style={theme.settingsHeader}>Settings</Text>
            
            <View style={theme.switchRow}>
              <Text style={theme.infoText}>Haptic Feedback</Text>
              <Switch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
            </View>

            <View style={theme.divider} />
            
            <Text style={[theme.infoText, {marginBottom: 15}]}>TV IP: {ipAddress}</Text>
            <Button title="Disconnect TV" color="#FF3B30" onPress={() => { setShowSettings(false); onDisconnect(); }} />
            
            <View style={{ height: 10 }} />
            <Button title="Close" onPress={() => setShowSettings(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = {
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 30, position: 'relative' },
  settingsBtn: { position: 'absolute', right: 0, padding: 10 },
  settingsIcon: { fontSize: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  column: { flexDirection: 'column', alignItems: 'center' },
  dpad: { alignItems: 'center', marginVertical: 30 },
  btn: { padding: 15, margin: 5, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContainerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, justifyContent: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
  numBtn: { width: '30%', padding: 20, margin: '1%', alignItems: 'center', borderRadius: 10 },
  emptyBtn: { width: '30%', margin: '1%' },
  closeBtn: { width: '30%', padding: 20, margin: '1%', alignItems: 'center', borderRadius: 10 },
  settingsPanel: { width: '80%', padding: 20, borderRadius: 15, alignItems: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginVertical: 15 },
  divider: { width: '100%', height: 1, backgroundColor: '#555', marginVertical: 15 },
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F2F2F7' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  text: { color: '#000' },
  btn: { ...baseStyles.btn, backgroundColor: '#E5E5EA' },
  okBtn: { backgroundColor: '#D1D1D6' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#FFFFFF' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#F2F2F7' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF3B30' },
  numText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#FFFFFF' },
  settingsHeader: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 10 },
  infoText: { color: '#000', fontSize: 16 }
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#000000' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  text: { color: '#FFFFFF' },
  btn: { ...baseStyles.btn, backgroundColor: '#1C1C1E' },
  okBtn: { backgroundColor: '#2C2C2E' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#1C1C1E' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#2C2C2E' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF453A' },
  numText: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#1C1C1E' },
  settingsHeader: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 10 },
  infoText: { color: '#FFF', fontSize: 16 }
  });