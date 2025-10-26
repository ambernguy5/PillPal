import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import MedicationScanner from "../src/components/MedicationScanner.js";
import { sendMedicationsToBackend } from "../src/services/api.js";

export default function ScanScreen({ navigation }) {
  const [isSendingToBackend, setIsSendingToBackend] = useState(false);

  const handleScanResult = async (data) => {
    console.log("✅ Detected medications:", data.medications.map(m => {
      const result = {
        name: m.name,
        dosage: m.dosage?.formatted || 'Not found',
        confidence: m.confidence
      };
      
      if (m.brandName && m.genericName) {
        result.brand = m.brandName;
        result.generic = m.genericName;
      }
      
      return result;
    }));
    console.log(`📊 Total: ${data.medications.length} medication(s) found`);

    // Send to backend for enrichment
    setIsSendingToBackend(true);
    const response = await sendMedicationsToBackend(data);
    setIsSendingToBackend(false);

    if (response.success) {
      console.log("🎉 Backend processing complete!");
      console.log("📋 Enriched medications:", response.data.medications);
      
      // Navigate to results screen with enriched data
      // navigation.navigate("Results", { data: response.data });
    } else {
      console.error("⚠️ Backend processing failed:", response.error);
      // Still could navigate with original data
      // navigation.navigate("Results", { data, error: response.error });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MedicationScanner
        onResult={handleScanResult}
        onCancel={() => navigation.goBack()}
      />
      
      {isSendingToBackend && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>
              Getting drug information...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#111',
    fontWeight: '600',
  },
});