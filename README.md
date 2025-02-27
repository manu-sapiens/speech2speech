# Audio Conversation Assistant

A beautiful Node.js application that detects audio, visualizes waveforms, transcribes speech, and speaks responses using text-to-speech.

## Features

- **Audio Detection**: Automatically detects when speech starts and ends
- **Audio Visualization**: Displays real-time waveform visualization
- **Speech Transcription**: Transcribes speech using Whisper API
- **AI-Powered Responses**: Generates intelligent responses using OpenAI's GPT-4o-mini model
- **Text-to-Speech**: Converts responses to speech using Piper TTS
- **Beautiful UI**: Modern, responsive interface with real-time feedback

## Prerequisites

- Node.js and npm installed
- Services running:
  - Whisper service for transcription (port 8111)
  - Piper TTS service for text-to-speech (port 8038)
- OpenAI API key for GPT-4o-mini access

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set your OpenAI API key:
   ```
   export OPENAI_API_KEY=your-api-key-here
   ```
   Or update the key directly in `index.js`
4. Start the server:
   ```
   npm start
   ```
5. Open your browser and navigate to `http://localhost:3131`

## Configuration

The application is configured to use the following services:

- Whisper API (OpenAI-compatible): `http://localhost:8111/v1/audio/transcriptions`
- OpenAI API: Using GPT-4o-mini model for generating responses
- Piper TTS API: `http://localhost:8038/synthesize/` with model `en_US-ryan-high`

If your services are running on different ports or have different endpoints, you can update these in the `index.js` file.

## How It Works

1. The application uses the browser's Web Audio API to detect when speech starts and ends
2. Audio is visualized in real-time using WaveSurfer.js
3. When speech ends (detected by silence), the audio is sent to the Whisper service for transcription
4. The transcribed text is sent to OpenAI's GPT-4o-mini model to generate an intelligent response
5. The response is sent to Piper TTS for text-to-speech conversion
6. The response is played back to the user and the conversation is displayed in the UI

## License

MIT
