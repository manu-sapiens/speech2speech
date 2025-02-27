document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const recordButton = document.getElementById('recordButton');
  const recordingStatus = document.getElementById('recordingStatus');
  const conversationContainer = document.getElementById('conversation');
  const audioMeter = document.getElementById('audioMeter');
  
  // Socket.io connection
  let socket;
  try {
    if (typeof io === 'undefined') {
      console.error('Socket.io is not loaded. Real-time communication will not be available.');
    } else {
      socket = io();
    }
  } catch (error) {
    console.error('Error initializing Socket.io:', error);
  }
  
  // WaveSurfer instance for audio visualization
  let wavesurfer;
  
  try {
    // Check if WaveSurfer is loaded
    if (typeof WaveSurfer === 'undefined') {
      console.error('WaveSurfer is not loaded. Audio visualization will not be available.');
      document.getElementById('waveform').innerHTML = '<p>Audio visualization not available</p>';
    } else {
      wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4a6bff',
        progressColor: '#2a4bdf',
        cursorColor: 'transparent',
        barWidth: 2,
        barRadius: 3,
        cursorWidth: 0,
        height: 128,
        barGap: 3
      });
    }
  } catch (error) {
    console.error('Error initializing WaveSurfer:', error);
    document.getElementById('waveform').innerHTML = '<p>Audio visualization not available</p>';
  }
  
  // Audio recording variables
  let mediaRecorder;
  let audioChunks = [];
  let isListening = false;
  let isRecording = false;
  let audioContext;
  let analyser;
  let microphone;
  let javascriptNode;
  let isAudioDetected = false;
  let silenceTimer;
  let audioDetectionTimeout;
  let recordingTimeout;
  let audioStream;
  let speechStartTime = null;
  let minSpeechDuration = 500; // Minimum speech duration in ms to be considered valid
  
  // Constants for audio detection
  const SILENCE_THRESHOLD = 0.015; // Slightly higher threshold to avoid background noise
  const SILENCE_DURATION = 2000; // 2 seconds of silence to stop recording
  const MAX_RECORDING_TIME = 30000; // 30 seconds max recording time
  const AUDIO_DETECTION_DELAY = 500; // 500ms delay before considering audio detected
  
  // Initialize audio context
  function initAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // Setup JavaScript processor node for volume analysis
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    javascriptNode.connect(audioContext.destination);
  }
  
  // Start listening for audio
  async function startListening() {
    try {
      // Reset variables
      isListening = true;
      
      // Update UI
      recordButton.classList.add('active');
      recordButton.querySelector('.btn-text').textContent = 'Stop Listening';
      recordingStatus.textContent = 'Listening for speech...';
      
      // Get audio stream
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio context if not already initialized
      if (!audioContext) {
        initAudioContext();
      }
      
      // Connect microphone to analyser
      microphone = audioContext.createMediaStreamSource(audioStream);
      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      
      // Setup audio level detection
      javascriptNode.onaudioprocess = processAudio;
      
    } catch (error) {
      console.error('Error starting audio listening:', error);
      recordingStatus.textContent = 'Error: Could not access microphone';
      stopListening();
    }
  }
  
  // Stop listening for audio
  function stopListening() {
    // If currently recording, stop that first
    if (isRecording) {
      stopRecording();
    }
    
    // Clear all timeouts
    clearTimeout(silenceTimer);
    clearTimeout(audioDetectionTimeout);
    clearTimeout(recordingTimeout);
    
    // Update state and UI
    isListening = false;
    recordButton.classList.remove('active');
    recordButton.querySelector('.btn-text').textContent = 'Start Listening';
    recordingStatus.textContent = 'Ready';
    
    // Disconnect audio processing
    if (microphone) {
      microphone.disconnect();
      analyser.disconnect();
      javascriptNode.disconnect();
    }
    
    // Stop the audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
  }
  
  // Start recording
  function startRecording() {
    // Only start recording if we're in listening mode
    if (!isListening) return;
    
    // Reset recording variables
    audioChunks = [];
    isRecording = true;
    
    // Update UI
    recordingStatus.textContent = 'Recording...';
    
    try {
      // Create media recorder from the existing stream
      mediaRecorder = new MediaRecorder(audioStream);
      
      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Process recorded audio
        processRecordedAudio();
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Set maximum recording time
      recordingTimeout = setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, MAX_RECORDING_TIME);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      recordingStatus.textContent = 'Error: Could not start recording';
      isRecording = false;
    }
  }
  
  // Process audio for volume level detection
  function processAudio(event) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate volume level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / bufferLength / 255;
    
    // Update audio meter
    audioMeter.style.width = `${average * 100}%`;
    
    // Audio detection logic - only if we're listening but not yet recording
    if (isListening) {
      if (average > SILENCE_THRESHOLD) {
        // Audio detected
        if (!isRecording && !isAudioDetected) {
          // Start a short delay before actually starting recording
          clearTimeout(audioDetectionTimeout);
          audioDetectionTimeout = setTimeout(() => {
            isAudioDetected = true;
            speechStartTime = new Date().getTime();
            startRecording();
          }, AUDIO_DETECTION_DELAY);
        } else if (isRecording) {
          // Reset silence timer if we're already recording
          clearTimeout(silenceTimer);
          
          // Set new silence timer
          silenceTimer = setTimeout(() => {
            if (isRecording) {
              stopRecording();
            }
          }, SILENCE_DURATION);
        }
      }
    }
  }
  
  // Stop recording
  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    // Clear timeouts
    clearTimeout(silenceTimer);
    clearTimeout(audioDetectionTimeout);
    clearTimeout(recordingTimeout);
    
    // Check if the speech duration was long enough
    const currentTime = new Date().getTime();
    const speechDuration = currentTime - speechStartTime;
    
    // Update state and UI
    isRecording = false;
    isAudioDetected = false;
    
    if (speechDuration < minSpeechDuration) {
      // Speech was too short, discard it
      mediaRecorder.stop();
      audioChunks = []; // Clear the chunks
      
      recordingStatus.textContent = 'Speech too short';
      
      // Go back to listening mode after a short delay
      if (isListening) {
        setTimeout(() => {
          recordingStatus.textContent = 'Listening for speech...';
        }, 1500);
      }
      return;
    }
    
    recordingStatus.textContent = 'Processing audio...';
    
    // Stop media recorder
    mediaRecorder.stop();
    
    // Go back to listening mode
    if (isListening) {
      recordingStatus.textContent = 'Listening for speech...';
    }
  }
  
  // Process recorded audio
  async function processRecordedAudio() {
    if (audioChunks.length === 0) {
      recordingStatus.textContent = 'No audio detected';
      if (isListening) {
        setTimeout(() => {
          recordingStatus.textContent = 'Listening for speech...';
        }, 2000);
      }
      return;
    }
    
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // Create form data for API request
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      // Add user message to conversation
      addMessageToConversation('You', 'Recording processed...', 'user');
      
      // Send to server for processing
      recordingStatus.textContent = 'Transcribing...';
      
      // Emit event to socket if available
      if (socket) {
        socket.emit('transcribing', { status: 'started' });
      }
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to process audio');
      }
      
      const data = await response.json();
      
      // If no speech was detected, don't add messages to the conversation
      if (data.transcription === '' && data.response === 'No speech detected.') {
        recordingStatus.textContent = 'No speech detected';
        if (isListening) {
          setTimeout(() => {
            recordingStatus.textContent = 'Listening for speech...';
          }, 2000);
        }
        return;
      }
      
      // Update conversation with transcription
      addMessageToConversation('You', data.transcription, 'user');
      
      // Update conversation with assistant response
      addMessageToConversation('Assistant', data.response, 'assistant');
      
      // Emit event to socket if available
      if (socket) {
        socket.emit('transcribing', { status: 'completed', data });
      }
      
      // Play response audio if available
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
      }
      
      // Update status
      if (isListening) {
        recordingStatus.textContent = 'Listening for speech...';
      } else {
        recordingStatus.textContent = 'Ready';
      }
      
      // Visualize the recorded audio
      const audioUrl = URL.createObjectURL(audioBlob);
      if (wavesurfer) {
        wavesurfer.load(audioUrl);
      }
      
    } catch (error) {
      console.error('Error processing audio:', error);
      recordingStatus.textContent = 'Error processing audio';
      
      // Emit error event to socket if available
      if (socket) {
        socket.emit('transcribing', { status: 'error', error: error.message });
      }
      
      // Go back to listening mode after a delay
      if (isListening) {
        setTimeout(() => {
          recordingStatus.textContent = 'Listening for speech...';
        }, 3000);
      }
    }
  }
  
  // Add message to conversation
  function addMessageToConversation(sender, text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-icon">${type === 'user' ? '👤' : '🤖'}</span>
        <span class="message-sender">${sender}</span>
        <span class="message-time">${timeString}</span>
      </div>
      <div class="message-bubble">${text}</div>
    `;
    
    conversationContainer.appendChild(messageDiv);
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
  }
  
  // Event listeners
  recordButton.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
  
  // Initialize
  recordingStatus.textContent = 'Ready';
});
