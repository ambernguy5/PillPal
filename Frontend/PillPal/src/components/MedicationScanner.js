import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { recognizeTextFromImage } from "../utils/helpers/textRecognition";
import { parseMedicationFromText } from "../utils/helpers/parseMedication";

/**
 * Props:
 * - onResult: ({ candidates, fullText }) => void
 * - onRawText?: (rawText: string) => void
 * - onCancel?: () => void
 * - autoCloseOnResult?: boolean (default true)
 * - testImageUri?: string | null — optional local/test image URI
 */
export default function MedicationScanner({
  onResult,
  onRawText,
  onCancel,
  autoCloseOnResult = true,
  testImageUri = null,
}) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [flash, setFlash] = useState("off");

  const hasPermission = useMemo(() => Boolean(permission?.granted), [permission]);

  const askPermission = useCallback(async () => {
    if (!permission || !permission.granted) {
      await requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = useCallback(async () => {
    console.log("🔴🔴🔴 SCAN BUTTON PRESSED! 🔴🔴🔴");
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      let imageUri = testImageUri;

      // If no test image, capture from camera
      if (!imageUri) {
        if (!cameraRef.current) return;

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: false,
          skipProcessing: true,
        });

        imageUri = photo?.uri;
      }

      if (!imageUri) throw new Error("No image URI provided");

      // OCR processing
      console.log("🔵 Starting OCR processing...");
      const { fullText } = await recognizeTextFromImage(imageUri);
      console.log("📷 Extracted text from camera:", fullText);
      if (onRawText) onRawText(fullText);

      const parsed = parseMedicationFromText(fullText);
      if (onResult) onResult(parsed);

      if (autoCloseOnResult && onCancel) onCancel();
    } catch (error) {
      console.warn("MedicationScanner scan failed", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, testImageUri, onRawText, onResult, onCancel, autoCloseOnResult]);

  const handlePickImage = useCallback(async () => {
    console.log("🟢🟢🟢 CHOOSE PHOTO BUTTON PRESSED! 🟢🟢🟢");
    if (isProcessing) return;

    try {
      // Request media library permissions
      console.log("📱 Requesting photo library permission...");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        console.warn("❌ Media library permission denied");
        return;
      }

      // Launch image picker
      console.log("✅ Permission granted. Opening image picker...");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled) {
        console.log("⏭️  User canceled image selection");
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) return;

      console.log("🖼️  Image selected:", imageUri);
      setIsProcessing(true);

      // OCR processing
      console.log("🔵 Starting OCR processing...");
      const { fullText } = await recognizeTextFromImage(imageUri);
      console.log("📸 Extracted text from photo:", fullText);
      if (onRawText) onRawText(fullText);

      const parsed = parseMedicationFromText(fullText);
      if (onResult) onResult(parsed);

      if (autoCloseOnResult && onCancel) onCancel();
    } catch (error) {
      console.warn("MedicationScanner image picker failed", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onRawText, onResult, onCancel, autoCloseOnResult]);

  // UI for camera permissions
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasPermission && !testImageUri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.subtitle}>
          Enable camera to scan medication labels.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={askPermission}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        {onCancel ? (
          <TouchableOpacity style={styles.ghostButton} onPress={onCancel}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!testImageUri && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={flash === "on"}
        />
      )}

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayMask} />
        <View style={styles.overlayFocusRow}>
          <View style={styles.overlayMask} />
          <View style={styles.focusBox} />
          <View style={styles.overlayMask} />
        </View>
        <View style={styles.overlayMask} />
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.leftButtons}>
          {!testImageUri && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setFlash((f) => (f === "on" ? "off" : "on"))}
            >
              <Text style={styles.secondaryButtonText}>
                {flash === "on" ? "Flash On" : "Flash Off"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.centerButtons}>
          <TouchableOpacity
            disabled={isProcessing}
            style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleScan}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {testImageUri ? "Process Image" : "Scan"}
              </Text>
            )}
          </TouchableOpacity>

          {!testImageUri && (
            <TouchableOpacity
              disabled={isProcessing}
              style={[styles.secondaryButton, isProcessing && styles.buttonDisabled, { marginTop: 8 }]}
              onPress={handlePickImage}
            >
              <Text style={styles.secondaryButtonText}>Choose Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.rightButtons}>
          {onCancel ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.secondaryButton} />
          )}
        </View>
      </View>

      {testImageUri && (
        <Image
          source={{ uri: testImageUri }}
          style={{ width: 150, height: 150, position: "absolute", top: 10, right: 10 }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

// Keep the same styles as your original component
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#333", textAlign: "center", marginBottom: 16 },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
  overlayMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  overlayFocusRow: { height: 220, flexDirection: "row" },
  focusBox: { width: 300, height: 220, borderWidth: 2, borderColor: "#4dabf7", backgroundColor: "transparent" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: "rgba(0,0,0,0.35)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButton: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#2563eb", borderRadius: 12, minWidth: 120, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, minWidth: 90, alignItems: "center" },
  secondaryButtonText: { color: "#fff", fontWeight: "600" },
  ghostButton: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f1f5f9" },
  ghostButtonText: { color: "#111827", fontWeight: "600" },
});
