import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n';
import Icon from './ui/Icon';
import { colors, radii, spacing, typography } from '../theme';

// Full-screen barcode scanner. Calls onScanned(code) once per open; the parent
// shows `busy` while it looks the product up, during which scanning is paused.
const BarcodeScannerModal = ({ visible, onClose, onScanned, busy }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHandled(false);
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = ({ data }) => {
    if (handled || busy) return;
    setHandled(true);
    onScanned?.(data);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={handled || busy ? undefined : handleScan}
          />
        ) : (
          <View style={styles.permCenter}>
            <Icon name="camera-outline" size={52} color={colors.surface} />
            <Text style={styles.permText}>{t('scan.permission')}</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.permBtnText}>{t('scan.allow')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.overlay,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topRow}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10} activeOpacity={0.8}>
              <Icon name="close" size={26} color={colors.surface} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('scan.title')}</Text>
            <View style={styles.closeBtn} />
          </View>

          <View style={styles.middle} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>{busy ? t('scan.lookingUp') : t('scan.hint')}</Text>
            {busy ? <ActivityIndicator color={colors.surface} style={{ marginTop: spacing.md }} /> : null}
          </View>

          <View />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 17,
    color: colors.surface,
  },
  middle: {
    alignItems: 'center',
  },
  frame: {
    width: '78%',
    aspectRatio: 1.5,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: radii.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    ...typography.body,
    color: colors.surface,
    marginTop: spacing.lg,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  permCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  permText: {
    ...typography.body,
    color: colors.surface,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  permBtnText: {
    ...typography.button,
    color: colors.surface,
  },
});

export default BarcodeScannerModal;
