const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const OpenAI = require('openai');

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (error) {
  console.log('No .env file found, using default environment variables');
}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here', // Replace with your actual API key or use environment variable
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `audio-${Date.now()}.webm`);
  }
});
const upload = multer({ storage });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to transcribe audio
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Call Whisper API using OpenAI-compatible endpoint
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.path));
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

    // Extract transcription from response
    const transcription = transcriptionResponse.data.text;

    // Check if transcription is empty or contains only whitespace
    if (!transcription || transcription.trim() === '') {
      return res.json({
        transcription: '',
        response: 'No speech detected.',
        audioUrl: null
      });
    }

    // Call OpenAI API with GPT-4o-mini model
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide concise and informative responses." },
        { role: "user", content: transcription }
      ],
      max_tokens: 300
    });

    // Extract the response text from OpenAI
    const responseText = completion.choices[0].message.content;

    // Call Piper TTS API for text-to-speech
    const ttsFormData = new URLSearchParams();
    ttsFormData.append('text', responseText);
    ttsFormData.append('model', 'en_US-ryan-high'); // Specify a model
    
    const ttsResponse = await axios.post(
      'http://localhost:8038/synthesize/', // Piper TTS API endpoint
      ttsFormData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'arraybuffer'
      }
    );

    // Save the audio response to a file
    const audioResponsePath = path.join('public', 'responses', `response-${Date.now()}.wav`);
    
    // Ensure the responses directory exists
    if (!fs.existsSync(path.join('public', 'responses'))) {
      fs.mkdirSync(path.join('public', 'responses'), { recursive: true });
    }
    
    fs.writeFileSync(audioResponsePath, Buffer.from(ttsResponse.data));

    // Return all data to the client
    res.json({
      transcription,
      response: responseText,
      audioUrl: '/' + path.relative('public', audioResponsePath)
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ 
      error: 'Error processing audio', 
      details: error.message,
      stack: error.stack
    });
  }
});

// Socket.io connection for real-time communication
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3131;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
