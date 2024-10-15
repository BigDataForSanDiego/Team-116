import Fastify from 'fastify';
import WebSocket from 'ws';
import fs from 'fs';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables. You must have OpenAI Realtime API access.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `
Here’s a more concise version of your system message:

---

### Role  
You are Sophie, an AI medical assistant. You assist users with healthcare-related tasks, provide factual information from their medical data, and help manage appointments and communication with healthcare providers. You offer limited medical advice but always remind users to contact their doctor for serious concerns (you can send emails to the doctor too).

### Persona  
- **Professional & Compassionate:** You maintain a warm, empathetic, and supportive tone.
- **Healthcare Knowledge:** You can explain health data and give basic medical advice but avoid making diagnoses or treatment recommendations.  
- **Efficient:** You provide quick, clear responses and keep interactions health-focused.

### Capabilities  
1. **Access Patient Health Data:** Retrieve and explain health information like test results and medication history.
2. **Limited Medical Advice:** Provide general tips for minor issues, but refer serious concerns to doctors.
3. **Communication:** Send emails to the user's doctor regarding health updates or concerns.
4. **Appointment Management:** Book medical appointments based on the user's needs and schedule.
  
### Conversation Guidelines  
- Stay polite, empathetic, and concise.
- Focus solely on healthcare-related topics.
- Remind users to seek professional care for serious or complex issues.
  
### Workflow  
1. **Retrieve Health Data:** Access patient info and provide clear explanations.
2. **Offer Basic Advice:** Suggest minor symptom management and escalate serious concerns to doctors.
3. **Send Emails to Doctors:** Confirm the message and deliver it.
4. **Book Appointments:** Confirm details and schedule.
`;
const VOICE = 'alloy';
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment
const HEALTH_API_URL = 'http://localhost:3000'; // URL for the health API

// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
const LOG_EVENT_TYPES = [
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming and outgoing calls
// <Say> punctuation to improve text-to-speech translation

let attempts = 0;
const patientInfo = {
    1234: { patient_name: 'Glen', password: '1234' },
    5678: { patient_name: 'Remington', password: '5678' }
};


fastify.all('/incoming-call', async (request, reply) => {
    attempts = 0; // Reset attempts on a new call
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Please enter your patient ID followed by the pound key.</Say>
                              <Gather input="dtmf" finishOnKey="#" action="/process-patient-id" method="POST">
                                  <Pause length="3"/>
                              </Gather>
                              <Say>You did not enter any input. Please try again.</Say>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// Route to handle patient ID input
fastify.post('/process-patient-id', async (request, reply) => {
    const patientId = request.body.Digits;

    if (patientInfo[patientId]) {
        // If patient ID is correct, ask for password
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                              <Response>
                                  <Say>Thank you. Now, please enter your password followed by the pound key.</Say>
                                  <Gather input="dtmf" finishOnKey="#" action="/process-password?patientId=${patientId}" method="POST">
                                      <Pause length="3"/>
                                  </Gather>
                                  <Say>You did not enter any input. Please try again.</Say>
                              </Response>`;
        reply.type('text/xml').send(twimlResponse);
    } else {
        // Retry or hang up if attempts exceed 3
        attempts++;
        if (attempts >= 3) {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Sorry, you have exceeded the maximum number of attempts. Goodbye.</Say>
                                      <Hangup/>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        } else {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Invalid patient ID. Please try again.</Say>
                                      <Gather input="dtmf" finishOnKey="#" action="/process-patient-id" method="POST">
                                          <Pause length="3"/>
                                      </Gather>
                                      <Say>You did not enter any input. Please try again.</Say>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        }
    }
});

// Route to handle password input
fastify.post('/process-password', async (request, reply) => {
    const { patientId } = request.query; // Get the patientId from the query parameters
    const password = request.body.Digits;

    if (patientInfo[patientId] && patientInfo[patientId].password === password) {
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                              <Response>
                                  <Say>Thank you. ${patientInfo[patientId].patient_name}Please wait while we connect your call to the AI voice assistant.</Say>
                                  <Pause length="1"/>
                                  <Connect>
                                      <Stream url="wss://${request.headers.host}/media-stream" />
                                  </Connect>
                              </Response>`;
        reply.type('text/xml').send(twimlResponse);
    } else {
        attempts++;
        if (attempts >= 3) {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Sorry, you have exceeded the maximum number of attempts. Goodbye.</Say>
                                      <Hangup/>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        } else {
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                                  <Response>
                                      <Say>Invalid password. Please try again.</Say>
                                      <Gather input="dtmf" finishOnKey="#" action="/process-password?patientId=${patientId}" method="POST">
                                          <Pause length="3"/>
                                      </Gather>
                                      <Say>You did not enter any input. Please try again.</Say>
                                  </Response>`;
            reply.type('text/xml').send(twimlResponse);
        }
    }
});





// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');

        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });

        let streamSid = null;

        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                    tools: [
                        {
                            type: "function",
                            name: "getPatientData",
                            description: "Get patient data including health information",
                            parameters: {
                                type: "object",
                                properties: {
                                    "patientId": { "type": "string" }
                                },
                                required: ["patientId"]
                            }
                        },
                        {
                            type: "function",
                            name: "bookAppointment",
                            description: "Book a medical appointment",
                            parameters: {
                                type: "object",
                                properties: {
                                    "patientId": { "type": "string" },
                                    "doctorId": { "type": "string" },
                                    "date": { "type": "string" }
                                },
                                required: ["patientId", "doctorId", "date"]
                            }
                        },
                        {
                            type: "function",
                            name: "sendEmailToDoctor",
                            description: "Send an email to the patient's doctor",
                            parameters: {
                                type: "object",
                                properties: {
                                    "doctorId": { "type": "string" },
                                    "message": { "type": "string" }
                                },
                                required: ["doctorId", "message"]
                            }
                        }
                    ],
                    tool_choice: "auto"
                }
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(sendSessionUpdate, 250); // Ensure connection stability, send after .25 seconds
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', async (data) => {
            try {
                const response = JSON.parse(data);
                
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                if (response.type === 'session.updated') {
                    console.log('Session updated successfully:', response);
                }

                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
                if (response.type === 'response.function_call_arguments.done') {
                    console.log("Function called:", response);
                    const functionName = response.name;
                    const args = JSON.parse(response.arguments);

                    try {
                        const apiResponse = await fetch(`${HEALTH_API_URL}/function-call`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: functionName, arguments: args })
                        });

                        if (apiResponse.ok) {
                            const result = await apiResponse.json();
                            const functionOutputEvent = {
                                type: "conversation.item.create",
                                item: {
                                    type: "function_call_output",
                                    role: "system",
                                    output: JSON.stringify(result),
                                }
                            };
                            openAiWs.send(JSON.stringify(functionOutputEvent));

                            // Trigger AI to generate a response based on the function output
                            openAiWs.send(JSON.stringify({
                                type: "response.create",
                                response: {
                                    modalities: ["text", "audio"],
                                    instructions: `Respond to the user based on this function output: ${JSON.stringify(result)}. Be concise and friendly.`,
                                }
                            }));
                        } else {
                            throw new Error('API request failed');
                        }
                    } catch (error) {
                        console.error('Error processing function call:', error);
                        sendErrorResponse(openAiWs);
                    }
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };

                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });


    });
});

fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});

function sendErrorResponse(ws) {
    ws.send(JSON.stringify({
        type: "response.create",
        response: {
            modalities: ["text", "audio"],
            instructions: "I apologize, but I'm having trouble processing your request right now. Is there anything else I can help you with?",
        }
    }));
}