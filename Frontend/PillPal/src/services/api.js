// API service for communicating with backend

const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Send scanned medication data to backend for processing
 * @param {Object} scanData - The medication scan data
 * @param {Array} scanData.medications - Array of medication objects
 * @param {string} scanData.fullText - Full OCR text
 * @returns {Promise} Response from backend with enriched drug info
 */
export async function sendMedicationsToBackend(scanData) {
  try {
    console.log('📤 Sending medications to backend:', JSON.stringify(scanData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/medications/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scanData),
    });

    if (!response.ok) {
      // Try to get detailed error message from backend
      let errorDetails = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('❌ Backend error details:', errorData);
        errorDetails = errorData.detail || JSON.stringify(errorData);
      } catch (e) {
        console.error('❌ Could not parse error response');
      }
      throw new Error(errorDetails);
    }

    const data = await response.json();
    console.log('✅ Received enriched data from backend:', data);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('❌ Error sending medications to backend:', error);
    console.error('❌ Error details:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get info for a single drug
 * @param {string} name - Drug name
 * @param {string} dosage - Dosage (optional)
 * @returns {Promise} Drug information
 */
export async function getDrugInfo(name, dosage = '') {
  try {
    const params = new URLSearchParams({ name });
    if (dosage) params.append('dosage', dosage);
    
    const response = await fetch(`${API_BASE_URL}/drug_info?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error fetching drug info:', error);
    throw error;
  }
}

