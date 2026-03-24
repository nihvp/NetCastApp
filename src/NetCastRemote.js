import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Button, useColorScheme, Switch, Pressable, ScrollView, Dimensions, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useThrottle } from './useThrottle';

const { width: screenWidth } = Dimensions.get('window');
const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const KEYS = {
  POWER: 1, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, OK: 20,
  HOME: 21, SETTINGS: 22, BACK: 23, VOL_UP: 24, VOL_DOWN: 25, 
  MUTE: 26, CH_UP: 27, CH_DOWN: 28, 
  BLUE: 29, GREEN: 30, RED: 31, YELLOW: 32,
  INFO: 45, INPUT: 47,
  APPS: 417, EXIT: 412, SEARCH: 411
};

const NUM_KEYS = { 0: 2, 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11 };

export default function NetCastRemote({ ipAddress, sessionId, onDisconnect }) {
  const [showKeypad, setShowKeypad] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrackpad, setShowTrackpad] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkStyles : lightStyles;

  // Standard Button Command
  const sendCommand = async (keyCode) => {
    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?><command><session>${sessionId}</session><type>HandleKeyInput</type><value>${keyCode}</value></command>`;
    executeFetch(xmlPayload);
  };

  // Pointer/Mouse Command
  const sendTouchCommand = async (type, x = 0, y = 0) => {
    let xmlPayload = `<?xml version="1.0" encoding="utf-8"?><command><session>${sessionId}</session><type>${type}</type>`;
    if (type === 'HandleTouchMove') xmlPayload += `<x>${x}</x><y>${y}</y>`;
    xmlPayload += `</command>`;
    executeFetch(xmlPayload, 1000); // Shorter timeout for rapid trackpad events
  };

  const executeFetch = async (xmlPayload, timeout = 3000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
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
      // Suppress alert for rapid trackpad drops, keep for standard buttons
      if (timeout === 3000) {
        Alert.alert('Connection Lost', 'Could not reach the TV.');
        onDisconnect();
      }
    }
  };

  const throttledSendCommand = useThrottle(sendCommand, 300);

  const handlePress = (keyCode) => {
    if (hapticsEnabled) ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    throttledSendCommand(keyCode);
  };

  // Trackpad Gesture Logic
  const lastTouch = useRef({ x: 0, y: 0 });
  const lastMoveTime = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastTouch.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
      },
      onPanResponderMove: (evt) => {
        const now = Date.now();
        // Custom 80ms throttle to prevent overwhelming the TV processor
        if (now - lastMoveTime.current > 80) {
          const { pageX, pageY } = evt.nativeEvent;
          const deltaX = Math.round(pageX - lastTouch.current.x);
          const deltaY = Math.round(pageY - lastTouch.current.y);
          
          if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
            sendTouchCommand('HandleTouchMove', deltaX, deltaY);
            lastTouch.current = { x: pageX, y: pageY };
            lastMoveTime.current = now;
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If movement was negligible, register it as a click
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          if (hapticsEnabled) ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
          sendTouchCommand('HandleTouchClick');
        }
      }
    })
  ).current;

  const renderDots = (count, color) => {
    const dot = <View style={[theme.colorDot, { backgroundColor: color }]} />;
    if (count === 1) return dot;
    if (count === 2) return <View style={theme.dotRow}>{dot}{dot}</View>;
    if (count === 3) return <View style={{ alignItems: 'center' }}>{dot}<View style={theme.dotRow}>{dot}{dot}</View></View>;
    if (count === 4) return <View><View style={theme.dotRow}>{dot}{dot}</View><View style={theme.dotRow}>{dot}{dot}</View></View>;
  };

  return (
    <View style={theme.container}>
      <View style={theme.headerRow}>
        <Text style={theme.header}>NetCast Remote</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={theme.settingsBtn}>
          <Text style={theme.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1, width: '100%' }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* PAGE 1: Original Remote */}
        <View style={theme.page}>
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

          <View style={[theme.row, { width: '90%', justifyContent: 'space-around', marginVertical: 15 }]}>
            <View style={theme.rocker}>
              <TouchableOpacity style={theme.rockerHalf} onPress={() => handlePress(KEYS.VOL_UP)}><Text style={theme.text}>VOL +</Text></TouchableOpacity>
              <View style={theme.rockerDivider} />
              <TouchableOpacity style={theme.rockerHalf} onPress={() => handlePress(KEYS.VOL_DOWN)}><Text style={theme.text}>VOL -</Text></TouchableOpacity>
            </View>
            
            <View style={theme.column}>
              <TouchableOpacity style={[theme.btn, { marginBottom: 15 }]} onPress={() => handlePress(KEYS.HOME)}><Text style={theme.text}>HOME</Text></TouchableOpacity>
              <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.BACK)}><Text style={theme.text}>BACK</Text></TouchableOpacity>
            </View>

            <View style={theme.rocker}>
              <TouchableOpacity style={theme.rockerHalf} onPress={() => handlePress(KEYS.CH_UP)}><Text style={theme.text}>CH +</Text></TouchableOpacity>
              <View style={theme.rockerDivider} />
              <TouchableOpacity style={theme.rockerHalf} onPress={() => handlePress(KEYS.CH_DOWN)}><Text style={theme.text}>CH -</Text></TouchableOpacity>
            </View>
          </View>

          <View style={theme.row}>
            <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.SETTINGS)}><Text style={theme.text}>SETTINGS</Text></TouchableOpacity>
            <TouchableOpacity style={theme.btn} onPress={() => handlePress(KEYS.INPUT)}><Text style={theme.text}>INPUT</Text></TouchableOpacity>
          </View>

          <View style={{ marginTop: 15 }}>
            <Button title="Open Numpad" color={isDark ? '#4DA8DA' : '#007AFF'} onPress={() => setShowKeypad(true)} />
          </View>

          <Text style={theme.swipeHint}>Swipe left for more controls &rarr;</Text>
        </View>

        {/* PAGE 2: Extra Buttons & Trackpad */}
        <View style={theme.page}>
          
          <View style={theme.extraGrid}>
            <TouchableOpacity style={theme.largeBtn} onPress={() => handlePress(KEYS.APPS)}><Text style={theme.text}>APPS</Text></TouchableOpacity>
            <TouchableOpacity style={theme.largeBtn} onPress={() => handlePress(KEYS.EXIT)}><Text style={theme.text}>EXIT</Text></TouchableOpacity>
          </View>
          
          <View style={theme.extraGrid}>
            <TouchableOpacity style={theme.largeBtn} onPress={() => handlePress(KEYS.INFO)}><Text style={theme.text}>INFO</Text></TouchableOpacity>
            <TouchableOpacity style={theme.largeBtn} onPress={() => handlePress(KEYS.SEARCH)}><Text style={theme.text}>SEARCH</Text></TouchableOpacity>
          </View>

          <View style={[theme.row, { marginTop: 40, marginBottom: 40 }]}>
            <TouchableOpacity style={theme.colorBtn} onPress={() => handlePress(KEYS.RED)}>{renderDots(1, '#FF3B30')}</TouchableOpacity>
            <TouchableOpacity style={theme.colorBtn} onPress={() => handlePress(KEYS.GREEN)}>{renderDots(2, '#34C759')}</TouchableOpacity>
            <TouchableOpacity style={theme.colorBtn} onPress={() => handlePress(KEYS.YELLOW)}>{renderDots(3, '#FFCC00')}</TouchableOpacity>
            <TouchableOpacity style={theme.colorBtn} onPress={() => handlePress(KEYS.BLUE)}>{renderDots(4, '#007AFF')}</TouchableOpacity>
          </View>

          <View style={{ marginTop: 15 }}>
            <Button title="Open Trackpad" color={isDark ? '#4DA8DA' : '#007AFF'} onPress={() => setShowTrackpad(true)} />
          </View>

        </View>
      </ScrollView>

      {/* TRACKPAD MODAL */}
      <Modal visible={showTrackpad} animationType="slide" transparent={true} onRequestClose={() => setShowTrackpad(false)}>
        <View style={theme.trackpadContainer}>
          <View style={theme.trackpadHeader}>
            <Text style={theme.trackpadTitle}>Magic Trackpad</Text>
            <TouchableOpacity onPress={() => setShowTrackpad(false)} style={theme.trackpadCloseBtn}>
              <Text style={theme.text}>Close</Text>
            </TouchableOpacity>
          </View>
          <View {...panResponder.panHandlers} style={theme.trackpadSurface}>
            <Text style={theme.swipeHint}>Drag to move pointer, tap to click</Text>
          </View>
        </View>
      </Modal>

      {/* NUMPAD MODAL */}
      <Modal visible={showKeypad} animationType="slide" transparent={true} onRequestClose={() => setShowKeypad(false)}>
        <TouchableOpacity style={theme.modalContainer} activeOpacity={1} onPressOut={() => setShowKeypad(false)}>
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
      
      {/* SETTINGS MODAL */}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20, marginTop: 10, marginBottom: 10, position: 'relative' },
  settingsBtn: { position: 'absolute', right: 20, padding: 10 },
  settingsIcon: { fontSize: 24 },
  
  page: { width: screenWidth, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  swipeHint: { marginTop: 20, fontSize: 12, opacity: 0.5 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  column: { flexDirection: 'column', alignItems: 'center' },
  dpad: { alignItems: 'center', marginVertical: 20 },
  
  btn: { width: 85, height: 60, margin: 5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  
  rocker: { width: 70, height: 140, borderRadius: 35, overflow: 'hidden' },
  rockerHalf: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rockerDivider: { height: 1, backgroundColor: '#888', width: '60%', alignSelf: 'center', opacity: 0.3 },
  
  extraGrid: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginVertical: 10 },
  largeBtn: { padding: 20, margin: 10, borderRadius: 12, flex: 1, alignItems: 'center' },
  
  colorBtn: { flex: 1, margin: 5, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 8, height: 8, borderRadius: 4, margin: 2 },
  dotRow: { flexDirection: 'row', justifyContent: 'center' },

  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContainerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, justifyContent: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40 },
  numBtn: { width: '30%', padding: 20, margin: '1%', alignItems: 'center', borderRadius: 10 },
  emptyBtn: { width: '30%', margin: '1%' },
  closeBtn: { width: '30%', padding: 20, margin: '1%', alignItems: 'center', borderRadius: 10 },
  settingsPanel: { width: '80%', padding: 20, borderRadius: 15, alignItems: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginVertical: 15 },
  divider: { width: '100%', height: 1, backgroundColor: '#555', marginVertical: 15 },

  // TRACKPAD STYLES
  trackpadContainer: { flex: 1, paddingTop: 60, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 50 },
  trackpadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 20 },
  trackpadTitle: { fontSize: 20, fontWeight: 'bold' },
  trackpadCloseBtn: { padding: 10, borderRadius: 8 },
  trackpadSurface: { flex: 1, margin: 20, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, backgroundColor: '#F2F2F7', paddingTop: 50 },
  header: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  text: { color: '#000', fontSize: 13, fontWeight: '500' },
  swipeHint: { ...baseStyles.swipeHint, color: '#000' },
  btn: { ...baseStyles.btn, backgroundColor: '#E5E5EA' },
  rocker: { ...baseStyles.rocker, backgroundColor: '#E5E5EA' },
  largeBtn: { ...baseStyles.largeBtn, backgroundColor: '#E5E5EA' },
  colorBtn: { ...baseStyles.colorBtn, backgroundColor: '#E5E5EA' },
  okBtn: { backgroundColor: '#D1D1D6' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#FFFFFF' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#F2F2F7' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF3B30' },
  numText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#FFFFFF' },
  settingsHeader: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 10 },
  infoText: { color: '#000', fontSize: 16 },
  
  trackpadContainer: { ...baseStyles.trackpadContainer, backgroundColor: '#FFFFFF' },
  trackpadTitle: { ...baseStyles.trackpadTitle, color: '#000' },
  trackpadCloseBtn: { ...baseStyles.trackpadCloseBtn, backgroundColor: '#E5E5EA' },
  trackpadSurface: { ...baseStyles.trackpadSurface, backgroundColor: '#F2F2F7' },
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, backgroundColor: '#000000', paddingTop: 50 },
  header: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  swipeHint: { ...baseStyles.swipeHint, color: '#FFF' },
  btn: { ...baseStyles.btn, backgroundColor: '#1C1C1E' },
  rocker: { ...baseStyles.rocker, backgroundColor: '#1C1C1E' },
  largeBtn: { ...baseStyles.largeBtn, backgroundColor: '#1C1C1E' },
  colorBtn: { ...baseStyles.colorBtn, backgroundColor: '#333333' },
  okBtn: { backgroundColor: '#2C2C2E' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#1C1C1E' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#2C2C2E' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF453A' },
  numText: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#1C1C1E' },
  settingsHeader: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 10 },
  infoText: { color: '#FFF', fontSize: 16 },

  trackpadContainer: { ...baseStyles.trackpadContainer, backgroundColor: '#1C1C1E' },
  trackpadTitle: { ...baseStyles.trackpadTitle, color: '#FFFFFF' },
  trackpadCloseBtn: { ...baseStyles.trackpadCloseBtn, backgroundColor: '#333333' },
  trackpadSurface: { ...baseStyles.trackpadSurface, backgroundColor: '#000000' },
});