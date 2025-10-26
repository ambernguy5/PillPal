// Common medication suffixes to help identify drug names
const DRUG_SUFFIXES = [
  'cillin', 'mycin', 'cycline', 'floxacin', 'azole', 'pine', 'pril', 'sartan',
  'statin', 'olol', 'dipine', 'zepam', 'pam', 'done', 'sone', 'prazole', 'tidine',
  'oxin', 'afil', 'mab', 'tinib', 'lukast', 'gliptin', 'relin', 'sertib'
];

// Words to exclude (not drug names)
const EXCLUDED_WORDS = [
  'supplement', 'vitamin', 'pharmacy', 'prescription', 'medication', 'medicine',
  'drug', 'tablet', 'capsule', 'liquid', 'syrup', 'cream', 'ointment', 'gel',
  'solution', 'suspension', 'injection', 'inhaler', 'patch', 'powder',
  'take', 'doctor', 'patient', 'refill', 'quantity', 'expires', 'directions',
  'warning', 'caution', 'keep', 'store', 'avoid', 'consult', 'contains',
  'daily', 'twice', 'times', 'morning', 'evening', 'night', 'food', 'water',
  'each', 'serving', 'size', 'amount', 'value', 'facts', 'label'
];

// Extract all dosages from text with their line numbers
function extractAllDosages(lines) {
  const dosageRegex = /\b(\d+(?:\.\d+)?)\s?(mg|mcg|g|iu|ml|units?|grams?|milligrams?|micrograms?)\b/gi;
  const dosages = [];
  
  lines.forEach((line, lineIndex) => {
    const matches = [...line.matchAll(dosageRegex)];
    matches.forEach(match => {
      const amount = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const normalizedUnit = unit.replace(/s$/, ''); // Remove plural 's'
      
      dosages.push({
        amount,
        unit: normalizedUnit,
        formatted: `${amount}${normalizedUnit}`,
        lineIndex,
        line
      });
    });
  });
  
  return dosages;
}

// Extract all potential drug names with their line numbers
function extractAllDrugNames(lines) {
  const candidates = [];
  
  lines.forEach((lineText, lineIndex) => {
    // Skip lines that start with common non-drug labels
    if (/^(pharmacy|rx|prescription|take|doctor|dr\.|patient|refill|quantity|expires?|directions?|warning|caution)/i.test(lineText)) {
      return;
    }
    
    // Check for "(as ...)" pattern - e.g., "Vitamin C (as Ascorbic Acid)"
    // Capture the entire phrase including the parentheses
    const asPattern = /([A-Z][A-Za-z\s]+\(as\s+[A-Z][A-Za-z\s]+\))/gi;
    const asMatches = [...lineText.matchAll(asPattern)];
    
    asMatches.forEach(match => {
      const fullDrugName = match[1].trim();
      
      candidates.push({
        name: fullDrugName,
        confidence: 'high',
        lineIndex,
        line: lineText,
        source: 'as-pattern'
      });
    });
    
    // Check for "Generic for BrandName" pattern - e.g., "Lisinopril (Generic for Zestril)"
    const genericForPattern = /([A-Z][A-Za-z]+)\s*\(Generic for\s+([A-Z][A-Za-z]+)\)/gi;
    const genericForMatches = [...lineText.matchAll(genericForPattern)];
    
    genericForMatches.forEach(match => {
      const genericName = match[1].trim();
      const brandName = match[2].trim();
      
      candidates.push({
        name: genericName,
        brandName: brandName,
        genericName: genericName,
        confidence: 'high',
        lineIndex,
        line: lineText,
        source: 'generic-for-pattern'
      });
    });
    
    // Check for "BrandName (GenericName)" pattern - e.g., "Advil (Ibuprofen)"
    // This is tricky - we need to distinguish from "(as ...)" pattern
    const brandGenericPattern = /([A-Z][A-Za-z]+)\s*\(([A-Z][a-z]+(?:[A-Z][a-z]+)*)\)(?!\s*as)/gi;
    const brandGenericMatches = [...lineText.matchAll(brandGenericPattern)];
    
    brandGenericMatches.forEach(match => {
      const firstWord = match[1].trim();
      const secondWord = match[2].trim();
      
      // Check if second word looks like a drug name (has suffix or reasonable length)
      const lowerSecond = secondWord.toLowerCase();
      const matchesSuffix = DRUG_SUFFIXES.some(suffix => lowerSecond.endsWith(suffix));
      const isReasonableLength = secondWord.length >= 4 && secondWord.length <= 25;
      
      if (matchesSuffix || isReasonableLength) {
        // Assume first is brand, second is generic (more common on labels)
        candidates.push({
          name: secondWord, // Use generic as primary name
          brandName: firstWord,
          genericName: secondWord,
          confidence: 'high',
          lineIndex,
          line: lineText,
          source: 'brand-generic-pattern'
        });
      }
    });
    
    // Look for capitalized words (common for drug names)
    const capitalizedWords = lineText.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g);
    
    if (capitalizedWords) {
      capitalizedWords.forEach(word => {
        const lowerWord = word.toLowerCase();
        
        // Skip excluded words
        if (EXCLUDED_WORDS.includes(lowerWord)) {
          return;
        }
        
        // Check if it matches common drug suffixes
        const matchesSuffix = DRUG_SUFFIXES.some(suffix => 
          lowerWord.endsWith(suffix)
        );
        
        // Check if it's a reasonable length for a drug name
        const isReasonableLength = word.length >= 4 && word.length <= 25;
        
        // Calculate confidence score
        let confidence = 'low';
        if (matchesSuffix) {
          confidence = 'high';
        } else if (isReasonableLength) {
          confidence = 'medium';
        }
        
        if (confidence !== 'low') {
          candidates.push({
            name: word,
            confidence,
            lineIndex,
            line: lineText,
            source: 'capitalized'
          });
        }
      });
    }
    
    // Also look for all-caps words (another common format)
    const allCapsWords = lineText.match(/\b[A-Z]{4,}\b/g);
    if (allCapsWords) {
      allCapsWords.forEach(word => {
        const lowerWord = word.toLowerCase();
        
        // Skip excluded words
        if (EXCLUDED_WORDS.includes(lowerWord)) {
          return;
        }
        
        const matchesSuffix = DRUG_SUFFIXES.some(suffix => 
          lowerWord.endsWith(suffix)
        );
        
        const confidence = matchesSuffix ? 'high' : 'medium';
        
        candidates.push({
          name: word,
          confidence,
          lineIndex,
          line: lineText,
          source: 'all-caps'
        });
      });
    }
  });
  
  return candidates;
}

// Match drug names with their dosages
function matchDrugsWithDosages(drugCandidates, dosages) {
  const medications = [];
  const usedDosages = new Set();
  const usedDrugs = new Set();
  
  // Priority 1: Generic/Brand pattern drugs - match with dosage on same line
  drugCandidates
    .filter(d => d.source === 'generic-for-pattern' || d.source === 'brand-generic-pattern')
    .forEach(drug => {
      const dosageOnSameLine = dosages.find(
        s => s.lineIndex === drug.lineIndex && !usedDosages.has(s)
      );
      
      if (dosageOnSameLine) {
        medications.push({
          name: drug.name,
          brandName: drug.brandName,
          genericName: drug.genericName,
          dosage: {
            amount: dosageOnSameLine.amount,
            unit: dosageOnSameLine.unit,
            formatted: dosageOnSameLine.formatted
          },
          confidence: 'high'
        });
        usedDosages.add(dosageOnSameLine);
        usedDrugs.add(drug);
      }
    });
  
  // Priority 2: "(as ...)" pattern drugs - match with dosage on same line
  drugCandidates
    .filter(d => d.source === 'as-pattern' && !usedDrugs.has(d))
    .forEach(drug => {
      const dosageOnSameLine = dosages.find(
        s => s.lineIndex === drug.lineIndex && !usedDosages.has(s)
      );
      
      if (dosageOnSameLine) {
        medications.push({
          name: drug.name,
          dosage: {
            amount: dosageOnSameLine.amount,
            unit: dosageOnSameLine.unit,
            formatted: dosageOnSameLine.formatted
          },
          confidence: 'high'
        });
        usedDosages.add(dosageOnSameLine);
        usedDrugs.add(drug);
      }
    });
  
  // Priority 3: High confidence drugs with dosage on same line
  drugCandidates
    .filter(d => d.confidence === 'high' && !usedDrugs.has(d))
    .forEach(drug => {
      const dosageOnSameLine = dosages.find(
        s => s.lineIndex === drug.lineIndex && !usedDosages.has(s)
      );
      
      if (dosageOnSameLine) {
        medications.push({
          name: drug.name,
          dosage: {
            amount: dosageOnSameLine.amount,
            unit: dosageOnSameLine.unit,
            formatted: dosageOnSameLine.formatted
          },
          confidence: 'high'
        });
        usedDosages.add(dosageOnSameLine);
        usedDrugs.add(drug);
      }
    });
  
  // Priority 4: Medium confidence drugs with dosage on same line
  drugCandidates
    .filter(d => d.confidence === 'medium' && !usedDrugs.has(d))
    .forEach(drug => {
      const dosageOnSameLine = dosages.find(
        s => s.lineIndex === drug.lineIndex && !usedDosages.has(s)
      );
      
      if (dosageOnSameLine) {
        medications.push({
          name: drug.name,
          dosage: {
            amount: dosageOnSameLine.amount,
            unit: dosageOnSameLine.unit,
            formatted: dosageOnSameLine.formatted
          },
          confidence: 'medium'
        });
        usedDosages.add(dosageOnSameLine);
        usedDrugs.add(drug);
      }
    });
  
  // Priority 5: High confidence drugs without matched dosage
  drugCandidates
    .filter(d => d.confidence === 'high' && !usedDrugs.has(d))
    .forEach(drug => {
      medications.push({
        name: drug.name,
        dosage: null,
        confidence: 'medium' // Lower confidence since no dosage found
      });
      usedDrugs.add(drug);
    });
  
  return medications;
}

// Main parser function
export function parseMedicationFromText(fullText) {
  if (!fullText) {
    return { 
      medications: [],
      fullText: "" 
    };
  }

  console.log("🔍 Parsing medication from text...");
  
  const lines = fullText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  
  // Extract all drug names and dosages
  const drugCandidates = extractAllDrugNames(lines);
  const dosages = extractAllDosages(lines);
  
  console.log("🔎 Found drug candidates:", drugCandidates.map(c => ({
    name: c.name,
    confidence: c.confidence,
    source: c.source,
    line: c.lineIndex
  })));
  
  console.log("💊 Found dosages:", dosages.map(s => ({
    dosage: s.formatted,
    line: s.lineIndex
  })));
  
  // Match drugs with their dosages
  const medications = matchDrugsWithDosages(drugCandidates, dosages);
  
  console.log("✅ Matched medications:", medications.map(m => {
    const result = {
      name: m.name,
      dosage: m.dosage?.formatted || 'Not found',
      confidence: m.confidence
    };
    
    if (m.brandName || m.genericName) {
      result.brandName = m.brandName;
      result.genericName = m.genericName;
    }
    
    return result;
  }));
  
  return {
    medications,
    fullText
  };
}
