import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import MedicationScanner from "../src/components/MedicationScanner.js";
import { sendMedicationsToBackend } from "../src/services/api.js";

export default function ScanScreen({ navigation }) {
  const [isSendingToBackend, setIsSendingToBackend] = useState(false);
  const handleScanResult = async (data) => {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 MEDICATION SCAN RESULTS");
    console.log("=".repeat(60));
    
    // Log detected medications
    console.log(`\n📊 Total medications detected: ${data.medications.length}`);
    
    data.medications.forEach((med, index) => {
      console.log(`\n  [${index + 1}] ${med.name}`);
      console.log(`      Dosage: ${med.dosage?.formatted || '❌ Not found'}`);
      console.log(`      Confidence: ${med.confidence}`);
      if (med.brandName) console.log(`      Brand: ${med.brandName}`);
      if (med.genericName) console.log(`      Generic: ${med.genericName}`);
    });

    // Filter medications with dosage
    console.log("\n" + "-".repeat(60));
    console.log("🔍 FILTERING MEDICATIONS");
    console.log("-".repeat(60));
    
    const medicationsWithDosage = data.medications.filter(med => 
      med.dosage && med.dosage.formatted
    );

    console.log(`\n✅ ${medicationsWithDosage.length} of ${data.medications.length} medications have dosage information`);

    if (medicationsWithDosage.length === 0) {
      console.warn("\n⚠️  NO VALID MEDICATIONS FOUND");
      console.warn("    Medications must have both name and dosage to proceed.");
      console.warn("    Skipping backend API call.\n");
      
      Alert.alert(
        "No Medications Found",
        "Could not find any medications with dosage information. Please try scanning a clearer image of the medication label.",
        [{ text: "OK" }]
      );
      return;
    }

    // Prepare data for backend
    const simplifiedData = {
      medications: medicationsWithDosage.map(med => {
        const name = med.genericName || med.name;
        const dosage = med.dosage.formatted;
        
        // Validate that both name and dosage are valid strings
        if (!name || typeof name !== 'string' || name.trim() === '') {
          console.warn(`⚠️  Skipping medication with invalid name:`, med);
          return null;
        }
        if (!dosage || typeof dosage !== 'string' || dosage.trim() === '') {
          console.warn(`⚠️  Skipping medication with invalid dosage:`, med);
          return null;
        }
        
        return {
          name: name.trim(),
          dosage: dosage.trim()
        };
      }).filter(med => med !== null) // Remove any null entries
    };
    
    // Double-check we have valid data
    if (simplifiedData.medications.length === 0) {
      console.error("❌ No valid medications after validation!");
      Alert.alert(
        "Data Error",
        "Could not process medication data. Please try again.",
        [{ text: "OK" }]
      );
      return;
    }

    console.log("\n" + "-".repeat(60));
    console.log("📤 SENDING TO BACKEND API");
    console.log("-".repeat(60));
    console.log("\nPayload:");
    simplifiedData.medications.forEach((med, index) => {
      console.log(`  [${index + 1}] ${med.name} - ${med.dosage}`);
    });

    // Send to backend for enrichment
    setIsSendingToBackend(true);
    const startTime = Date.now();
    
    console.log("\n⏳ Fetching drug information from OpenFDA...");
    const response = await sendMedicationsToBackend(simplifiedData);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    setIsSendingToBackend(false);

    console.log("\n" + "-".repeat(60));
    console.log("📥 BACKEND RESPONSE");
    console.log("-".repeat(60));
    console.log(`⏱️  Response time: ${duration}s`);

    if (response.success) {
      console.log(`✅ Success! Received data for ${response.data.count} medication(s)\n`);
      
      response.data.medications.forEach((med, index) => {
        console.log(`  [${index + 1}] ${med.input.name} (${med.input.dosage})`);
        console.log(`      Searched for: ${med.drugInfo.searched_for || med.input.name}`);
        console.log(`      FDA Name: ${med.drugInfo.drug_name || 'N/A'}`);
        console.log(`      Brand: ${med.drugInfo.brand_name || 'N/A'}`);
        console.log(`      Summary: ${med.drugInfo.summary || 'N/A'}`);
        console.log(`      Contraindications: ${med.drugInfo.do_not_take_if_raw?.length || 0} items`);
        console.log(`      Interactions: ${med.drugInfo.do_not_take_with_raw?.length || 0} items`);
      });
      
      console.log("\n" + "=".repeat(60));
      console.log("🎉 PROCESSING COMPLETE");
      console.log("=".repeat(60) + "\n");
      
      // Navigate to results screen with enriched data
      // navigation.navigate("Results", { data: response.data });
    } else {
      console.error("\n❌ Backend Error:");
      console.error(`   ${response.error}`);
      console.log("\n" + "=".repeat(60) + "\n");
      
      Alert.alert(
        "Connection Error",
        "Could not fetch medication information. Please check your connection and try again.",
        [{ text: "OK" }]
      );
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