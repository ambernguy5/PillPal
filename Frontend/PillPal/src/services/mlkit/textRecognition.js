import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import TextRecognition from "@react-native-ml-kit/text-recognition";

/**
 * Runs on-device text recognition using Google ML Kit.
 * Returns a normalized result with flat fullText and line list.
 */
export async function recognizeTextFromImage(imageUri) {
  if (!imageUri) {
    throw new Error("Image URI is required for text recognition");
  }

  // The library accepts a file URI (e.g. file:///...) and returns blocks/lines.
  const recognition = await TextRecognition.recognize(imageUri);

  // Normalize into a flat list of lines and a concatenated fullText for ease of parsing.
  const blocks = recognition?.blocks ?? [];
  const lines = [];
  for (const block of blocks) {
    if (Array.isArray(block?.lines)) {
      for (const line of block.lines) {
        if (line?.text && typeof line.text === "string") {
          lines.push(line.text);
        }
      }
    }
  }
  const fullText = lines.join("\n");
  return { fullText, lines };
}

/**
 * Heuristic parser for medication labels from OCR text.
 * Extracts likely name and strength (e.g., "AMOXICILLIN 500 mg").
 */
export function parseMedicationFromText(fullText) {
  if (!fullText) return { candidates: [], fullText: "" };

  const text = fullText.replace(/[\t\r]+/g, "\n");
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const strengthRegex = /\b(\d+[\.,]?\d*)\s?(mg|mcg|g|iu|ml|units)\b/i;
  const nameRegex = /\b([A-Z][A-Z\-]{2,}(?:\s+[A-Z][A-Z\-]{2,})*)\b/; // uppercase words 3+ chars

  const candidates = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const strengthMatch = line.match(strengthRegex);
    const nameMatch = line.match(nameRegex);

    const strength = strengthMatch ? strengthMatch[0] : null;
    const name = nameMatch ? nameMatch[1] : null;

    if (name || strength) {
      candidates.push({ line, name, strength });
      continue;
    }

    // Lookahead: combine with next line to improve recall
    if (i + 1 < lines.length) {
      const combined = `${line} ${lines[i + 1]}`;
      const s2 = combined.match(strengthRegex)?.[0] ?? null;
      const n2 = combined.match(nameRegex)?.[1] ?? null;
      if (n2 || s2) {
        candidates.push({ line: combined, name: n2, strength: s2 });
        i += 1;
      }
    }
  }

  // De-duplicate by (name,strength) keys
  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    const key = `${c.name ?? ""}|${c.strength ?? ""}`.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return { candidates: unique, fullText: text };
}

/**
 * A camera-based medication label scanner using on-device ML Kit text recognition.
 *
 * Props:
 * - onResult: ({ candidates, fullText }) => void
 * - onRawText?: (rawText: string) => void
 * - onCancel?: () => void
 * - autoCloseOnResult?: boolean (default true)
 */
export default function MedicationScanner({
  onResult,
  onRawText,
  onCancel,
  autoCloseOnResult = true,
}) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [flash, setFlash] = useState("off");

  const hasPermission = useMemo(() => {
    return Boolean(permission?.granted);
  }, [permission]);

  const askPermission = useCallback(async () => {
    if (!permission || !permission.granted) {
      await requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;
    setIsProcessing(true);
    try {
      // Capture a single frame for OCR
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });

      const imageUri = photo?.uri;
      const { fullText } = await recognizeTextFromImage(imageUri);
      if (onRawText) onRawText(fullText);

      const parsed = parseMedicationFromText(fullText);
      if (onResult) onResult(parsed);
      if (autoCloseOnResult && onCancel) onCancel();
    } catch (error) {
      // Surface errors minimally to the UI; avoid throwing unhandled exceptions
      console.warn("MedicationScanner scan failed", error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onRawText, onResult, onCancel, autoCloseOnResult]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasPermission) {
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={flash === "on"}
      />

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
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setFlash((f) => (f === "on" ? "off" : "on"))}
        >
          <Text style={styles.secondaryButtonText}>
            {flash === "on" ? "Flash On" : "Flash Off"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={isProcessing}
          style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleScan}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Scan</Text>
          )}
        </TouchableOpacity>

        {onCancel ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.secondaryButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  overlayMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  overlayFocusRow: {
    height: 220,
    flexDirection: "row",
  },
  focusBox: {
    width: 300,
    height: 220,
    borderWidth: 2,
    borderColor: "#4dabf7",
    backgroundColor: "transparent",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    minWidth: 90,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  ghostButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  ghostButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
});

