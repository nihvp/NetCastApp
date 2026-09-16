import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Button,
  useColorScheme,
  Switch,
  Pressable,
  ScrollView,
  useWindowDimensions,
  PanResponder
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Settings } from 'lucide-react-native';
import { useThrottle } from './useThrottle';

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = isDark ? darkStyles : lightStyles;

  // Responsive layout calculations
  const maxContentWidth = Math.min(screenWidth - 32, 400);
  const availableHeight = screenHeight - insets.top - insets.bottom - 50;

  // Adaptive component sizing based on available viewport height
  const isCompact = availableHeight < 650;
  const isTall = availableHeight >= 780;

  const dpadSize = Math.round(
    Math.min(maxContentWidth * 0.70, Math.max(190, availableHeight * (isCompact ? 0.30 : 0.33)), isTall ? 260 : 235)
  );
  const dpadRingBtnSize = Math.round(dpadSize * 0.28);
  const dpadOkBtnSize = Math.round(dpadSize * 0.33);

  const btnWidth = Math.min(Math.round(maxContentWidth * 0.23), 88);
  const btnHeight = isCompact ? 46 : (isTall ? 58 : 52);

  const rockerWidth = Math.min(Math.round(maxContentWidth * 0.19), 72);
  const rockerHeight = isCompact ? 112 : (isTall ? 138 : 124);

  const rowMargin = isCompact ? 5 : (isTall ? 10 : 8);
  const dpadMargin = isCompact ? 8 : (isTall ? 14 : 10);

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
    <View
      style={[
        theme.container,
        {
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: Math.max(insets.bottom, 10)
        }
      ]}
    >
      {/* Header */}
      <View style={[theme.headerRow, { width: Math.min(screenWidth, 440), alignSelf: 'center' }]}>
        <Text style={theme.header}>NetCast Remote</Text>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={theme.settingsBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Settings color={isDark ? '#FFF' : '#000'} size={22} />
        </TouchableOpacity>
      </View>

      {/* Main Horizontal Swipe Pages */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* PAGE 1: Original Remote */}
        <View style={[theme.pageWrapper, { width: screenWidth }]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={[
              theme.pageContent,
              {
                width: maxContentWidth,
                alignSelf: 'center',
                flexGrow: 1,
                justifyContent: 'space-evenly',
                paddingVertical: 6
              }
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* POWER & MUTE ROW */}
            <View style={[theme.row, { marginVertical: rowMargin }]}>
              <TouchableOpacity
                style={[theme.btn, { width: btnWidth, height: btnHeight }]}
                onPress={() => handlePress(KEYS.POWER)}
                activeOpacity={0.7}
              >
                <Text style={[theme.text, { color: '#FF3B30', fontWeight: '700' }]}>POWER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.btn, { width: btnWidth, height: btnHeight }]}
                onPress={() => handlePress(KEYS.MUTE)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>MUTE</Text>
              </TouchableOpacity>
            </View>

            {/* D-PAD */}
            <View
              style={[
                theme.dpad,
                {
                  width: dpadSize,
                  height: dpadSize,
                  borderRadius: dpadSize / 2,
                  marginVertical: dpadMargin,
                  backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA'
                }
              ]}
            >
              <TouchableOpacity
                style={[
                  theme.dpadRingBtn,
                  { top: 0, width: dpadRingBtnSize, height: dpadRingBtnSize, borderRadius: dpadRingBtnSize / 2 }
                ]}
                onPress={() => handlePress(KEYS.UP)}
                activeOpacity={0.6}
              >
                <Text style={theme.text}>UP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  theme.dpadRingBtn,
                  { bottom: 0, width: dpadRingBtnSize, height: dpadRingBtnSize, borderRadius: dpadRingBtnSize / 2 }
                ]}
                onPress={() => handlePress(KEYS.DOWN)}
                activeOpacity={0.6}
              >
                <Text style={theme.text}>DOWN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  theme.dpadRingBtn,
                  { left: 0, width: dpadRingBtnSize, height: dpadRingBtnSize, borderRadius: dpadRingBtnSize / 2 }
                ]}
                onPress={() => handlePress(KEYS.LEFT)}
                activeOpacity={0.6}
              >
                <Text style={theme.text}>LEFT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  theme.dpadRingBtn,
                  { right: 0, width: dpadRingBtnSize, height: dpadRingBtnSize, borderRadius: dpadRingBtnSize / 2 }
                ]}
                onPress={() => handlePress(KEYS.RIGHT)}
                activeOpacity={0.6}
              >
                <Text style={theme.text}>RIGHT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  theme.dpadOkBtn,
                  {
                    width: dpadOkBtnSize,
                    height: dpadOkBtnSize,
                    borderRadius: dpadOkBtnSize / 2,
                    backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF'
                  }
                ]}
                onPress={() => handlePress(KEYS.OK)}
                activeOpacity={0.7}
              >
                <Text style={[theme.text, { fontWeight: 'bold' }]}>OK</Text>
              </TouchableOpacity>
            </View>

            {/* ROCKERS & CENTER CONTROLS */}
            <View
              style={[
                theme.row,
                { width: '95%', justifyContent: 'space-between', marginVertical: rowMargin }
              ]}
            >
              {/* VOL ROCKER */}
              <View style={[theme.rocker, { width: rockerWidth, height: rockerHeight, borderRadius: rockerWidth / 2 }]}>
                <TouchableOpacity
                  style={theme.rockerHalf}
                  onPress={() => handlePress(KEYS.VOL_UP)}
                  activeOpacity={0.6}
                >
                  <Text style={theme.text}>VOL +</Text>
                </TouchableOpacity>
                <View style={theme.rockerDivider} />
                <TouchableOpacity
                  style={theme.rockerHalf}
                  onPress={() => handlePress(KEYS.VOL_DOWN)}
                  activeOpacity={0.6}
                >
                  <Text style={theme.text}>VOL -</Text>
                </TouchableOpacity>
              </View>
              
              {/* CENTER BUTTONS */}
              <View style={theme.column}>
                <TouchableOpacity
                  style={[theme.btn, { width: btnWidth, height: btnHeight, marginBottom: isCompact ? 8 : 12 }]}
                  onPress={() => handlePress(KEYS.HOME)}
                  activeOpacity={0.7}
                >
                  <Text style={theme.text}>HOME</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[theme.btn, { width: btnWidth, height: btnHeight }]}
                  onPress={() => handlePress(KEYS.BACK)}
                  activeOpacity={0.7}
                >
                  <Text style={theme.text}>BACK</Text>
                </TouchableOpacity>
              </View>

              {/* CH ROCKER */}
              <View style={[theme.rocker, { width: rockerWidth, height: rockerHeight, borderRadius: rockerWidth / 2 }]}>
                <TouchableOpacity
                  style={theme.rockerHalf}
                  onPress={() => handlePress(KEYS.CH_UP)}
                  activeOpacity={0.6}
                >
                  <Text style={theme.text}>CH +</Text>
                </TouchableOpacity>
                <View style={theme.rockerDivider} />
                <TouchableOpacity
                  style={theme.rockerHalf}
                  onPress={() => handlePress(KEYS.CH_DOWN)}
                  activeOpacity={0.6}
                >
                  <Text style={theme.text}>CH -</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SETTINGS & INPUT ROW */}
            <View style={[theme.row, { marginVertical: rowMargin }]}>
              <TouchableOpacity
                style={[theme.btn, { width: btnWidth, height: btnHeight }]}
                onPress={() => handlePress(KEYS.SETTINGS)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>SETTINGS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.btn, { width: btnWidth, height: btnHeight }]}
                onPress={() => handlePress(KEYS.INPUT)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>INPUT</Text>
              </TouchableOpacity>
            </View>

            {/* OPEN NUMPAD BUTTON */}
            <View style={{ width: '85%', maxWidth: 260, marginVertical: rowMargin }}>
              <TouchableOpacity
                style={[theme.pillBtn, { height: btnHeight }]}
                onPress={() => setShowKeypad(true)}
                activeOpacity={0.7}
              >
                <Text style={theme.pillBtnText}>Open Numpad</Text>
              </TouchableOpacity>
            </View>

            <Text style={theme.swipeHint}>Swipe left for more controls &rarr;</Text>
          </ScrollView>
        </View>

        {/* PAGE 2: Extra Buttons & Trackpad */}
        <View style={[theme.pageWrapper, { width: screenWidth }]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={[
              theme.pageContent,
              {
                width: maxContentWidth,
                alignSelf: 'center',
                flexGrow: 1,
                justifyContent: 'space-evenly',
                paddingVertical: 12
              }
            ]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={theme.extraGrid}>
              <TouchableOpacity
                style={[theme.largeBtn, { height: isCompact ? 60 : 75 }]}
                onPress={() => handlePress(KEYS.APPS)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>APPS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.largeBtn, { height: isCompact ? 60 : 75 }]}
                onPress={() => handlePress(KEYS.EXIT)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>EXIT</Text>
              </TouchableOpacity>
            </View>
            
            <View style={theme.extraGrid}>
              <TouchableOpacity
                style={[theme.largeBtn, { height: isCompact ? 60 : 75 }]}
                onPress={() => handlePress(KEYS.INFO)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>INFO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.largeBtn, { height: isCompact ? 60 : 75 }]}
                onPress={() => handlePress(KEYS.SEARCH)}
                activeOpacity={0.7}
              >
                <Text style={theme.text}>SEARCH</Text>
              </TouchableOpacity>
            </View>

            <View style={[theme.row, { width: '90%', marginVertical: isCompact ? 16 : 28 }]}>
              <TouchableOpacity
                style={[theme.colorBtn, { height: isCompact ? 44 : 50 }]}
                onPress={() => handlePress(KEYS.RED)}
                activeOpacity={0.7}
              >
                {renderDots(1, '#FF3B30')}
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.colorBtn, { height: isCompact ? 44 : 50 }]}
                onPress={() => handlePress(KEYS.GREEN)}
                activeOpacity={0.7}
              >
                {renderDots(2, '#34C759')}
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.colorBtn, { height: isCompact ? 44 : 50 }]}
                onPress={() => handlePress(KEYS.YELLOW)}
                activeOpacity={0.7}
              >
                {renderDots(3, '#FFCC00')}
              </TouchableOpacity>
              <TouchableOpacity
                style={[theme.colorBtn, { height: isCompact ? 44 : 50 }]}
                onPress={() => handlePress(KEYS.BLUE)}
                activeOpacity={0.7}
              >
                {renderDots(4, '#007AFF')}
              </TouchableOpacity>
            </View>

            <View style={{ width: '85%', maxWidth: 260, marginVertical: rowMargin }}>
              <TouchableOpacity
                style={[theme.pillBtn, { height: btnHeight }]}
                onPress={() => setShowTrackpad(true)}
                activeOpacity={0.7}
              >
                <Text style={theme.pillBtnText}>Open Trackpad</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* TRACKPAD MODAL */}
      <Modal visible={showTrackpad} animationType="slide" transparent={true} onRequestClose={() => setShowTrackpad(false)}>
        <View style={[theme.trackpadContainer, { paddingTop: Math.max(insets.top + 10, 30) }]}>
          <View style={theme.trackpadHeader}>
            <Text style={theme.trackpadTitle}>Magic Trackpad</Text>
            <TouchableOpacity onPress={() => setShowTrackpad(false)} style={theme.trackpadCloseBtn} activeOpacity={0.7}>
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
          <Pressable
            style={[
              theme.keypad,
              {
                paddingBottom: Math.max(insets.bottom + 10, 24),
                maxWidth: 440,
                alignSelf: 'center',
                width: '100%'
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                style={theme.numBtn}
                onPress={() => handlePress(NUM_KEYS[num])}
                activeOpacity={0.6}
              >
                <Text style={theme.numText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={theme.emptyBtn} />
            <TouchableOpacity
              style={theme.numBtn}
              onPress={() => handlePress(NUM_KEYS[0])}
              activeOpacity={0.6}
            >
              <Text style={theme.numText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={theme.closeBtn}
              onPress={() => setShowKeypad(false)}
              activeOpacity={0.7}
            >
              <Text style={theme.numText}>X</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>
      
      {/* SETTINGS MODAL */}
      <Modal visible={showSettings} animationType="fade" transparent={true} onRequestClose={() => setShowSettings(false)}>
        <View style={theme.modalContainerCentered}>
          <View style={theme.settingsPanel}>
            <Text style={theme.settingsHeader}>Settings</Text>
            <View style={theme.switchRow}>
              <Text style={theme.infoText}>Haptic Feedback</Text>
              <Switch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
            </View>
            <View style={theme.divider} />
            <Text style={[theme.infoText, { marginBottom: 15 }]}>TV IP: {ipAddress}</Text>
            <View style={{ width: '100%', gap: 10 }}>
              <Button title="Disconnect TV" color="#FF3B30" onPress={() => { setShowSettings(false); onDisconnect(); }} />
              <Button title="Close" onPress={() => setShowSettings(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = {
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginVertical: 6,
    position: 'relative'
  },
  settingsBtn: {
    position: 'absolute',
    right: 20,
    padding: 8
  },
  
  pageWrapper: {
    flex: 1,
    alignItems: 'center'
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: 12
  },
  swipeHint: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 4
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  column: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  
  dpad: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative',
    overflow: 'hidden'
  },
  dpadRingBtn: { 
    position: 'absolute', 
    alignItems: 'center', 
    justifyContent: 'center'
  },
  dpadOkBtn: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  btn: {
    margin: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  pillBtn: {
    width: '100%',
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  pillBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15
  },
  
  rocker: {
    overflow: 'hidden'
  },
  rockerHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rockerDivider: {
    height: 1,
    backgroundColor: '#888',
    width: '60%',
    alignSelf: 'center',
    opacity: 0.3
  },
  
  extraGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 8,
    gap: 12
  },
  largeBtn: {
    padding: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  colorBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    margin: 2
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center'
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  modalContainerCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    justifyContent: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28
  },
  numBtn: {
    width: '30%',
    paddingVertical: 18,
    margin: '1.5%',
    alignItems: 'center',
    borderRadius: 12
  },
  emptyBtn: {
    width: '30%',
    margin: '1.5%'
  },
  closeBtn: {
    width: '30%',
    paddingVertical: 18,
    margin: '1.5%',
    alignItems: 'center',
    borderRadius: 12
  },
  settingsPanel: {
    width: '90%',
    maxWidth: 380,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginVertical: 12
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#555',
    marginVertical: 12,
    opacity: 0.3
  },

  trackpadContainer: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 40
  },
  trackpadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16
  },
  trackpadTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  trackpadCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  trackpadSurface: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  }
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  text: { color: '#000000', fontSize: 13, fontWeight: '500' },
  swipeHint: { ...baseStyles.swipeHint, color: '#000000' },
  btn: { ...baseStyles.btn, backgroundColor: '#E5E5EA' },
  rocker: { ...baseStyles.rocker, backgroundColor: '#E5E5EA' },
  largeBtn: { ...baseStyles.largeBtn, backgroundColor: '#E5E5EA' },
  colorBtn: { ...baseStyles.colorBtn, backgroundColor: '#E5E5EA' },
  okBtn: { backgroundColor: '#D1D1D6' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#FFFFFF' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#F2F2F7' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF3B30' },
  numText: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#FFFFFF' },
  settingsHeader: { fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 10 },
  infoText: { color: '#000000', fontSize: 15 },
  
  trackpadContainer: { ...baseStyles.trackpadContainer, backgroundColor: '#FFFFFF' },
  trackpadTitle: { ...baseStyles.trackpadTitle, color: '#000000' },
  trackpadCloseBtn: { ...baseStyles.trackpadCloseBtn, backgroundColor: '#E5E5EA' },
  trackpadSurface: { ...baseStyles.trackpadSurface, backgroundColor: '#F2F2F7' }
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: { flex: 1, backgroundColor: '#000000' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  swipeHint: { ...baseStyles.swipeHint, color: '#FFFFFF' },
  btn: { ...baseStyles.btn, backgroundColor: '#1C1C1E' },
  rocker: { ...baseStyles.rocker, backgroundColor: '#1C1C1E' },
  largeBtn: { ...baseStyles.largeBtn, backgroundColor: '#1C1C1E' },
  colorBtn: { ...baseStyles.colorBtn, backgroundColor: '#2C2C2E' },
  okBtn: { backgroundColor: '#2C2C2E' },
  keypad: { ...baseStyles.keypad, backgroundColor: '#1C1C1E' },
  numBtn: { ...baseStyles.numBtn, backgroundColor: '#2C2C2E' },
  closeBtn: { ...baseStyles.closeBtn, backgroundColor: '#FF453A' },
  numText: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  settingsPanel: { ...baseStyles.settingsPanel, backgroundColor: '#1C1C1E' },
  settingsHeader: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 10 },
  infoText: { color: '#FFFFFF', fontSize: 15 },

  trackpadContainer: { ...baseStyles.trackpadContainer, backgroundColor: '#1C1C1E' },
  trackpadTitle: { ...baseStyles.trackpadTitle, color: '#FFFFFF' },
  trackpadCloseBtn: { ...baseStyles.trackpadCloseBtn, backgroundColor: '#2C2C2E' },
  trackpadSurface: { ...baseStyles.trackpadSurface, backgroundColor: '#0B0B0C' }
});