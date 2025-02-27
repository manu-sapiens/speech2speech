const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const OpenAI = require('openai');

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (error) {
  console.log('No .env file found, using default environment variables');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test text to convert to speech and then transcribe
const testText = "This is a test of the audio transcription system. We're generating speech with Piper and transcribing with Whisper.";

// Directory to store test files
const testDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

async function runTest() {
  try {
    console.log('Starting API test...');
    console.log(`Original text: "${testText}"`);
    
    // Step 1: Generate audio using Piper TTS
    console.log('\n1. Generating audio with Piper TTS...');
    
    const ttsFormData = new URLSearchParams();
    ttsFormData.append('text', testText);
    ttsFormData.append('model', 'en_US-ryan-high');
    
    const ttsResponse = await axios.post(
      'http://localhost:8038/synthesize/',
      ttsFormData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'arraybuffer'
      }
    );
    
    console.log('Audio generated successfully');
    
    // Step 2: Save the audio file
    const audioFilePath = path.join(testDir, 'test-audio.wav');
    fs.writeFileSync(audioFilePath, Buffer.from(ttsResponse.data));
    console.log(`Audio saved to ${audioFilePath}`);
    
    // Step 3: Send to Whisper for transcription using OpenAI-compatible API
    console.log('\n2. Sending audio to Whisper for transcription using OpenAI-compatible API...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'Systran/faster-whisper-tiny.en');
    
    const transcriptionResponse = await axios.post(
      'http://localhost:8111/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'Bearer cant-be-empty'  // API requires a non-empty key
        }
      }
    );
    
    // Extract and display the transcription
    const transcription = transcriptionResponse.data.text || 'No transcription available';
    console.log(`Transcription: "${transcription}"`);
    
    // Step 4: Test OpenAI GPT-4o-mini integration
    console.log('\n4. Testing OpenAI GPT-4o-mini integration...');
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant. Provide concise and informative responses." },
          { role: "user", content: transcription }
        ],
        max_tokens: 300
      });
      
      const responseText = completion.choices[0].message.content;
      console.log(`OpenAI Response: "${responseText}"`);
    } catch (openaiError) {
      console.error('Error with OpenAI API:', openaiError);
      console.log('Make sure you have set your OpenAI API key correctly.');
    }
    
    // Compare original text with transcription
    console.log('\n5. Comparison:');
    console.log(`Original: "${testText}"`);
    console.log(`Transcribed: "${transcription}"`);
    
    // Calculate simple similarity (case-insensitive word match percentage)
    const originalWords = testText.toLowerCase().split(/\s+/);
    const transcribedWords = transcription.toLowerCase().split(/\s+/);
    
    const matchingWords = originalWords.filter(word => 
      transcribedWords.includes(word)
    ).length;
    
    const similarity = (matchingWords / originalWords.length) * 100;
    console.log(`Similarity: ${similarity.toFixed(2)}%`);
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
runTest();
