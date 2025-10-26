import * as FileSystem from 'expo-file-system/legacy';
import { GOOGLE_VISION_API_KEY } from '../constants/config';

export async function recognizeTextFromImage(imageUri) {
  if (!imageUri) throw new Error("Image URI is required");

  console.log("🔍 Processing image with Google Cloud Vision:", imageUri);

  try {
    // Read the image file as base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    console.log("📤 Sending image to Google Cloud Vision API...");

    // Call Google Cloud Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(`Google Vision API Error: ${result.error.message}`);
    }

    if (!result.responses || !result.responses[0]) {
      throw new Error('No response from Google Vision API');
    }

    const textAnnotations = result.responses[0].textAnnotations;
    
    if (!textAnnotations || textAnnotations.length === 0) {
      console.log("⚠️ No text detected in image");
      return { fullText: "", lines: [] };
    }

    // First annotation contains the full text
    const fullText = textAnnotations[0].description || "";
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);

    console.log("✅ Google Cloud Vision extracted text:", fullText);
    
    return { fullText, lines };
  } catch (error) {
    console.error("❌ Google Cloud Vision recognition failed:", error);
    throw error;
  }
}
