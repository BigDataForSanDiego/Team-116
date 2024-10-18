// Import required modules
import Fastify from 'fastify';  // Web framework for Node.js
import WebSocket from 'ws';  // WebSocket library for real-time communication
import fs from 'fs';  // Filesystem module for reading/writing files
import dotenv from 'dotenv';  // Module to load environment variables from a .env file
import fastifyFormBody from '@fastify/formbody';  // Fastify plugin for parsing form data
import fastifyWs from '@fastify/websocket';  // Fastify plugin for WebSocket support
import fetch from 'node-fetch';  // Module to make HTTP requests
import sqlite3 from 'sqlite3';

// Load environment variables from .env file
dotenv.config();  // Reads .env file and makes its variables available

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;  // Get the OpenAI API key from the environment

// Initialize the database connection
const db = new sqlite3.Database('./sqlite3.db');

// Define global user
var globalUser = null;

// Check if the API key is missing
if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);  // Exit the application if the API key is not found
}

// Initialize Fastify server
const fastify = Fastify();  // Create a new Fastify instance
fastify.register(fastifyFormBody);  // Register the form-body parsing plugin
fastify.register(fastifyWs);  // Register WebSocket support for real-time communication

// System message template for the AI assistant's behavior and persona
const SYSTEM_MESSAGE = `
### Role
You are an AI medical assistant named Dr. AI, working at City Medical Center. Your role is to assist patients with their medical queries, schedule appointments, and relay messages to doctors.

### Persona
- You are a knowledgeable medical assistant with access to patient records
- Your tone is professional, caring, and clear
- You maintain patient confidentiality and privacy
- You are careful to note that you cannot provide emergency medical care
- You refer urgent matters to emergency services


### Conversation Guidelines
- Always verify the patient's identity before discussing medical information
- Provide general medical information but avoid definitive diagnoses
- Direct emergencies to call 911 or visit the nearest emergency room
- Keep conversations focused on medical matters
- Maintain professional boundaries

### First Message
The first message you receive from the patient is their name and a summary of their last visit, repeat this exact message to the patient as the greeting.

### Medical Advice Limitations
- You can provide general health information and reminder about medications
- You cannot diagnose conditions or change prescribed treatments
- Always recommend consulting a doctor for specific medical concerns

### Functions
Use these functions to assist patients:
- get_medical_history: Retrieve patient's medical history
- schedule_appointment: Book an appointment with a doctor
- send_doctor_email: Send a message to the patient's doctor
`;

// Some default constants used throughout the application
const VOICE = 'alloy';  // The voice for AI responses
const PORT = process.env.PORT || 5050;  // Set the port for the server (from environment or default to 5050)

// DB helper functions
const dbRun = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});



// Database helper functions
async function verifyUser(userId, password) {
    try {
        const user = await dbGet(
            'SELECT * FROM users WHERE user_id = ? AND password = ?',
            [userId, password]
        );
        return user || null;
    } catch (error) {
        console.error('Error verifying user:', error);
        return null;
    }
}

async function getMedicalHistory() {
    try {
        
        if (!globalUser) {
            return {
                message: "Patient not found in our records.",
                thread: Date.now().toString()
            };
        }

        const history = await dbAll(
            `SELECT * FROM medical_history WHERE user_id = ? ORDER BY date DESC`,
            [globalUser.id]
        );

        return {
            message: JSON.stringify({
                patient: {
                    name: globalUser.name,
                    dob: globalUser.date_of_birth,
                    allergies: globalUser.allergies,
                    conditions: globalUser.conditions,
                    medications: globalUser.medications,
                    lastVisit: globalUser.last_visit
                },
                history: history
            }),
            thread: Date.now().toString()
        };
    } catch (error) {
        console.error('Error getting medical history:', error);
        return {
            message: "Error retrieving medical history.",
            thread: Date.now().toString()
        };
    }
}

async function scheduleAppointment(doctor, date, reason) {
    try {
        if (!globalUser) {
            return {
                message: "Patient not found in our records."
            };
        }

        await dbRun(
            `INSERT INTO appointments (user_id, doctor, date, reason, status)
             VALUES (?, ?, ?, ?, ?)`,
            [globalUser.id, doctor, date, reason, 'scheduled']
        );

        return {
            message: `Appointment scheduled with ${doctor} on ${date} for ${reason}.`
        };
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        return {
            message: "Unable to schedule appointment at this time."
        };
    }
}

async function sendDoctorEmail(doctor, subject, content) {
    try {        
        if (!globalUser) {
            return {
                message: "Patient not found in our records."
            };
        }

        await dbRun(
            `INSERT INTO emails (user_id, doctor, subject, content, status)
             VALUES (?, ?, ?, ?, ?)`,
            [globalUser.id, doctor, subject, content, 'pending']
        );

        return {
            message: `Message sent to Dr. ${doctor}. They will respond to your inquiry soon.`
        };
    } catch (error) {
        console.error('Error sending email:', error);
        return {
            message: "Unable to send message at this time."
        };
    }
}

async function saveTranscript(userId, transcript) {
    try {
        await dbRun(
            'INSERT INTO calls (user_id, transcript, date) VALUES (?, ?, datetime("now"))',
            [userId, transcript]
        );
        return { success: true };
    } catch (error) {
        console.error('Error saving transcript:', error);
        return { success: false };
    }
}

async function getLastCallInfo() {
    try {
        if (!globalUser) {
            return {
                firstMessage: "Welcome to City Medical Center. I don't seem to have your records. How can I assist you today?"
            };
        }

        // Fetch the most recent call transcript
        const lastCall = await dbGet(
            'SELECT transcript FROM calls WHERE user_id = ? ORDER BY date DESC LIMIT 1',
            [globalUser.id]
        );

        const lastVisitSummary = lastCall
            ? `I see your last call summary: "${lastCall.transcript}". How can I assist you today?`
            : `I see your last visit was on ${globalUser.last_visit}. How can I assist you today?`;

        return {
            firstMessage: `Welcome back ${globalUser.name}. ${lastVisitSummary}`
        };
    } catch (error) {
        console.error('Error getting last call info:', error);
        return {
            firstMessage: "Welcome to City Medical Center. How can I assist you today?"
        };
    }
}


// Session management: Store session data for ongoing calls
const sessions = new Map();  // A Map to hold session data for each call

// Event types to log to the console for debugging purposes
const LOG_EVENT_TYPES = [
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created',
    'response.text.done',
    'conversation.item.input_audio_transcription.completed'
];

// Root route - just for checking if the server is running
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });  // Send a simple message when accessing the root
});

// Handle incoming calls from Twilio
fastify.all('/incoming-call', async (request, reply) => {
    let attempts = 0; // Reset attempts on a new call
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please enter your user ID followed by the pound key.</Say>
                              <Gather input="dtmf" finishOnKey="#" action="/process-user-id" method="POST">
                                  <Pause length="3"/>
                              </Gather>
                              <Say>Please try again.</Say>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// Route to handle user ID input
let userIdAttempts = {};  // Use an object to track attempts for each user

fastify.post('/process-user-id', async (request, reply) => {
    const userId = request.body.Digits;

    // Initialize or increment the user's user ID attempt count
    if (!userIdAttempts[userId]) {
        userIdAttempts[userId] = 0;
    }
    userIdAttempts[userId] += 1;

    // Check if user exists
    const user = await dbGet('SELECT * FROM users WHERE user_id = ?', [userId]);

    if (user) {
        // Reset attempt count
        userIdAttempts[userId] = 0;
        
        // If user ID is correct, ask for password
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                              <Response>
                                  <Say>Thank you. Now, please enter your 6 digit password followed by the pound key.</Say>
                                  <Gather input="dtmf" finishOnKey="#" action="/process-password?userId=${userId}" method="POST">
                                      <Pause length="3"/>
                                  </Gather>
                                  <Say>You did not enter any input. Please try again.</Say>
                              </Response>`;
        reply.type('text/xml').send(twimlResponse);

    } else {
        // Handle invalid user ID
        if (userIdAttempts[userId] >= 3) {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Sorry, you have exceeded the maximum number of attempts. Goodbye.</Say>
                                      <Pause length="1"/>
                                      <Hangup/>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
            userIdAttempts[userId] = 0;  // Reset attempts after exceeding max retries
        } else {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Please try again.</Say>
                                      <Gather input="dtmf" finishOnKey="#" action="/process-user-id" method="POST">
                                          <Pause length="3"/>
                                      </Gather>
                                      <Say>You did not enter any input. Please try again.</Say>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        }
    }
});



// Route to handle password input
let loginAttempts = {};  // Use an object to store the login attempts for each user

fastify.post('/process-password', async (request, reply) => {
    const { userId } = request.query;
    const password = request.body.Digits;

    // Initialize or increment the user's login attempt count
    if (!loginAttempts[userId]) {
        loginAttempts[userId] = 0;
    }
    loginAttempts[userId] += 1;

    const user = await verifyUser(userId, password);

    if (user) {
        // Reset the attempt count if login is successful
        loginAttempts[userId] = 0;
        globalUser = user;

        // Get last call information (including last call summary)
        const lastCallInfo = await getLastCallInfo();

        // If authentication is successful, connect to the AI assistant
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                              <Response>
                                  <Say>Login successful. ${lastCallInfo.firstMessage}</Say>
                                  <Pause length="1"/>
                                  <Connect>
                                      <Stream url="wss://${request.headers.host}/media-stream">
                                          <Parameter name="firstMessage" value="${lastCallInfo.firstMessage}" />
                                          <Parameter name="callerNumber" value="${user.phone_number}" />
                                      </Stream>
                                  </Connect>
                              </Response>`;
        reply.type('text/xml').send(twimlResponse);

    } else {
        // Handle invalid password
        if (loginAttempts[userId] >= 3) {
            // If exceeded max attempts
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Sorry, you have exceeded the maximum number of attempts. Goodbye.</Say>
                                          <Pause length="1"/>
                                      <Hangup/>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
            loginAttempts[userId] = 0;  // Reset attempts after exceeding max retries
        } else {
            // Allow the user to retry with an invalid password message
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Please try again.</Say>
                                      <Gather input="dtmf" finishOnKey="#" action="/process-password?userId=${userId}" method="POST">
                                          <Pause length="3"/>
                                      </Gather>
                                      <Say>Please try again.</Say>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        }
    }
});

// WebSocket route to handle the media stream for real-time interaction
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected to media-stream');  // Log when a client connects

        let firstMessage = '';  // Placeholder for the first message
        let streamSid = '';  // Placeholder for the stream ID
        let openAiWsReady = false;  // Flag to check if the OpenAI WebSocket is ready
        let queuedFirstMessage = null;  // Queue the first message until OpenAI WebSocket is ready
        let threadId = "";  // Initialize threadId for tracking conversation threads

        // Use Twilio's CallSid as the session ID or create a new one based on the timestamp
        const sessionId = req.headers['x-twilio-call-sid'] || `session_${Date.now()}`;
        let session = sessions.get(sessionId) || { transcript: '', streamSid: null };  // Get the session data or create a new session
        sessions.set(sessionId, session);  // Update the session Map

        // Retrieve the caller number from the session
        const callerNumber = session.callerNumber;
        console.log('Caller Number:', callerNumber);

        // Open a WebSocket connection to the OpenAI Realtime API
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,  // Authorization header with the OpenAI API key
                "OpenAI-Beta": "realtime=v1"  // Use the beta realtime version
            }
        });

        // Function to send the session configuration to OpenAI
        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' },  // Enable voice activity detection
                    input_audio_format: 'g711_ulaw',  // Audio format for input
                    output_audio_format: 'g711_ulaw',  // Audio format for output
                    voice: VOICE,  // Use the defined voice for AI responses
                    instructions: SYSTEM_MESSAGE,  // Provide the AI assistant's instructions
                    modalities: ["text", "audio"],  // Use both text and audio for interaction
                    temperature: 0.8,  // Temperature for controlling the creativity of AI responses
                    input_audio_transcription: {
                        "model": "whisper-1"  // Use the Whisper model for transcribing audio
                    },
                    tools: [
                        {
                            type: "function",
                            name: "get_medical_history",
                            description: "Retrieve patient's medical history and information",
                            parameters: {
                                type: "object",
                                properties: {},
                                required: []
                            }
                        },
                        {
                            type: "function",
                            name: "schedule_appointment",
                            description: "Schedule a doctor's appointment",
                            parameters: {
                                type: "object",
                                properties: {
                                    "doctor": { "type": "string" },
                                    "date": { "type": "string" },
                                    "reason": { "type": "string" }
                                },
                                required: ["doctor", "date", "reason"]
                            }
                        },
                        {
                            type: "function",
                            name: "send_doctor_email",
                            description: "Send an email to the patient's doctor",
                            parameters: {
                                type: "object",
                                properties: {
                                    "doctor": { "type": "string" },
                                    "subject": { "type": "string" },
                                    "content": { "type": "string" }
                                },
                                required: ["doctor", "subject", "content"]
                            }
                        }
                    ],
                    tool_choice: "auto"  // Automatically choose the tool
                }
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));  // Send the session update to OpenAI
        };

        // Function to send the first message once OpenAI WebSocket is ready
        const sendFirstMessage = () => {
            if (queuedFirstMessage && openAiWsReady) {  // Check if we have a queued message and the connection is ready
                console.log('Sending queued first message:', queuedFirstMessage);
                openAiWs.send(JSON.stringify(queuedFirstMessage));  // Send the first message
                openAiWs.send(JSON.stringify({ type: 'response.create' }));  // Trigger AI to generate a response
                queuedFirstMessage = null;  // Clear the queue
            }
        };

        // Open event for when the OpenAI WebSocket connection is established
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');  // Log successful connection
            openAiWsReady = true;  // Set the flag to true
            sendSessionUpdate();  // Send session configuration
            sendFirstMessage();  // Send the first message if queued
        });

        // Handle messages from Twilio (media stream) and send them to OpenAI
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);  // Parse the incoming message from Twilio

                if (data.event === 'start') {  // When the call starts
                    streamSid = data.start.streamSid;  // Get the stream ID
                    const callSid = data.start.callSid;  // Get the call SID
                    const customParameters = data.start.customParameters;  // Get custom parameters (firstMessage, callerNumber)

                    console.log('CallSid:', callSid);
                    console.log('StreamSid:', streamSid);
                    console.log('Custom Parameters:', customParameters);

                    // Capture callerNumber and firstMessage from custom parameters
                    const callerNumber = customParameters?.callerNumber || 'Unknown';
                    session.callerNumber = callerNumber;  // Store the caller number in the session
                    firstMessage = customParameters?.firstMessage || "Hello, how can I assist you?";  // Set the first message
                    console.log('First Message:', firstMessage);
                    console.log('Caller Number:', callerNumber);

                    // Prepare the first message, but don't send it until the OpenAI connection is ready
                    queuedFirstMessage = {
                        type: 'conversation.item.create',
                        item: {
                            type: 'message',
                            role: 'user',
                            content: [{ type: 'input_text', text: firstMessage }]
                        }
                    };

                    if (openAiWsReady) {
                        sendFirstMessage();  // Send the first message if OpenAI is ready
                    }

                } else if (data.event === 'media') {  // When media (audio) is received
                    if (openAiWs.readyState === WebSocket.OPEN) {  // Check if the OpenAI WebSocket is open
                        const audioAppend = {
                            type: 'input_audio_buffer.append',  // Append audio data
                            audio: data.media.payload  // Audio data from Twilio
                        };
                        openAiWs.send(JSON.stringify(audioAppend));  // Send the audio data to OpenAI
                    }
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);  // Log any errors during message parsing
            }
        });

        // Handle incoming messages from OpenAI
        openAiWs.on('message', async (data) => {
            try {
                const response = JSON.parse(data);  // Parse the message from OpenAI

                // Handle audio responses from OpenAI
                if (response.type === 'response.audio.delta' && response.delta) {
                    connection.send(JSON.stringify({
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }  // Send audio back to Twilio
                    }));
                }

                // Handle function calls
                if (response.type === 'response.function_call_arguments.done') {
                    console.log("Function called:", response);
                    const functionName = response.name;
                    const args = JSON.parse(response.arguments);  // Get the arguments passed to the function

                    if (response.type === 'response.function_call_arguments.done') {
                        console.log("Function called:", response);
                        const functionName = response.name;
                        const args = JSON.parse(response.arguments);
                    
                        let result;
                        switch (functionName) {
                            case 'get_medical_history':
                                result = await getMedicalHistory();
                                break;
                            case 'schedule_appointment':
                                result = await scheduleAppointment(
                                    args.doctor,
                                    args.date,
                                    args.reason
                                );
                                break;
                            case 'send_doctor_email':
                                result = await sendDoctorEmail(
                                    args.doctor,
                                    args.subject,
                                    args.content
                                );
                                break;
                        }
                    
                        // Send function output back to OpenAI
                        const functionOutputEvent = {
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                role: "system",
                                output: result.message
                            }
                        };
                        openAiWs.send(JSON.stringify(functionOutputEvent));
                    
                        // Trigger AI response
                        openAiWs.send(JSON.stringify({
                            type: "response.create",
                            response: {
                                modalities: ["text", "audio"],
                                instructions: `Respond to the user based on this information: ${result.message}. Be professional and clear.`
                            }
                        }));
                    }
                    
                }

                // Log agent response
                if (response.type === 'response.done') {
                    const agentMessage = response.response.output[0]?.content?.find(content => content.transcript)?.transcript || 'Agent message not found';
                    session.transcript += `Agent: ${agentMessage}\n`;  // Add agent's message to the transcript
                    console.log(`Agent (${sessionId}): ${agentMessage}`);
                }

                // Log user transcription (input_audio_transcription.completed)
                if (response.type === 'conversation.item.input_audio_transcription.completed' && response.transcript) {
                    const userMessage = response.transcript.trim();  // Get the user's transcribed message
                    session.transcript += `User: ${userMessage}\n`;  // Add the user's message to the transcript
                    console.log(`User (${sessionId}): ${userMessage}`);
                }

                // Log other relevant events
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle when the connection is closed
        connection.on('close', async () => {
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            console.log(`Client disconnected (${sessionId}).`);
            console.log('Full Transcript:');
            console.log(session.transcript);
        
            await saveTranscript(globalUser.id, session.transcript);  // Ensure transcript is saved
        
            sessions.delete(sessionId);
        });
        

        // Handle WebSocket errors
        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);  // Log any errors in the OpenAI WebSocket
        });

        // Helper function for sending error responses
        function sendErrorResponse() {
            openAiWs.send(JSON.stringify({
                type: "response.create",
                response: {
                    modalities: ["text", "audio"],
                    instructions: "I apologize, but I'm having trouble processing your request right now. Is there anything else I can help you with?",
                }
            }));
        }
    });
});

// Start the Fastify server
fastify.listen({ port: PORT }, async (err) => {
    if (err) {
        console.error(err);
        process.exit(1);  // Exit if the server fails to start
    }
    console.log(`Server is listening on port ${PORT}`);  // Log the port the server is running on
});
