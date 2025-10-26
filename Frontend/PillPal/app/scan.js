import React from "react";
import MedicationScanner from "../src/components/MedicationScanner.js";

export default function ScanScreen({ navigation }) {
  return (
    <MedicationScanner
      onResult={(data) => {
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
        // navigation.navigate("Results", { data });
      }}
      onCancel={() => navigation.goBack()}
    />
  );
}