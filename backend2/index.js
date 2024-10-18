// Import required modules
import Fastify from "fastify"; // Web framework for Node.js
import WebSocket from "ws"; // WebSocket library for real-time communication
import fs from "fs"; // Filesystem module for reading/writing files
import dotenv from "dotenv"; // Module to load environment variables from a .env file
import fastifyFormBody from "@fastify/formbody"; // Fastify plugin for parsing form data
import fastifyWs from "@fastify/websocket"; // Fastify plugin for WebSocket support
import fetch from "node-fetch"; // Module to make HTTP requests
import sqlite3 from "sqlite3";

import axios from "axios";


// Load environment variables from .env file
dotenv.config(); // Reads .env file and makes its variables available

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env; // Get the OpenAI API key from the environment

// Initialize the database connection
const db = new sqlite3.Database("./sqlite3.db");

// Define global user
var globalUser = null;
var globalCallerNumber = null;

// Check if the API key is missing
if (!OPENAI_API_KEY) {
    console.error("Missing OpenAI API key. Please set it in the .env file.");
    process.exit(1); // Exit the application if the API key is not found
}

// Initialize Fastify server
const fastify = Fastify(); // Create a new Fastify instance
fastify.register(fastifyFormBody); // Register the form-body parsing plugin
fastify.register(fastifyWs); // Register WebSocket support for real-time communication

// System message template for the AI assistant's behavior and persona
const SYSTEM_MESSAGE = `
### Role
You are an AI medical assistant named Evie, working at Sharp Healthcare. Your role is to assist patients with their medical queries, schedule appointments, and relay messages to doctors.

### Authentication Flow
1. Greet the caller and ask for their date of birth
2. Wait for verification before proceeding with any medical assistance
3. If authentication fails, politely inform the caller and end the conversation

### Persona
- Professional and caring tone
- Maintain patient confidentiality
- Direct emergencies to 911 or nearest emergency room
- Keep conversations focused on medical matters

### Medical Advice Limitations
- Provide general health information only
- Cannot diagnose conditions or change prescribed treatments
- Always recommend consulting a doctor for specific medical concerns
`;

// Some default constants used throughout the application
const VOICE = "shimmer"; // The voice for AI responses
const PORT = process.env.PORT || 5050; // Set the port for the server (from environment or default to 5050)

// DB helper functions
const dbRun = (sql, params) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

const dbGet = (sql, params) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

const dbAll = (sql, params) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

async function formatDateOfBirth(date_of_birth) {
    const prompt = `Convert the following date of birth to the format YYYY-MM-DD: "${date_of_birth}"`;
    
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/completions',
            {
                model: "gpt-4o-mini",  // OpenAI 4o mini model
                prompt: prompt,
                max_tokens: 10, // We only need a small response with the date
                temperature: 0  // We want a deterministic result
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const formattedDate = response.data.choices[0].text.trim();
        return formattedDate;
    } catch (error) {
        console.error("Error formatting date:", error);
        throw new Error("Could not format date");
    }
}
    

// Database helper functions
async function verifyUser(date_of_birth) {
    try {
        console.log(`Received date of birth: ${date_of_birth}`);
        console.log(globalCallerNumber);

        // First, find the user by phone number
        const user = await dbGet(
            "SELECT * FROM users WHERE phone_number = ?",
            [globalCallerNumber]
        );
        
        if (!user) {
            return { exists: false };
        }

        // If date_of_birth exists, format and verify it
        if (date_of_birth) {
            const formattedDOB = await formatDateOfBirth(date_of_birth);
            console.log(`Formatted date of birth: ${formattedDOB}`);

            // Verify against the database value
            return user.date_of_birth === formattedDOB
                ? { exists: true, verified: true, user }
                : { exists: true, verified: false };
        }

        return { exists: false, verified: false };
    } catch (error) {
        console.error("Error verifying user:", error);
        return { exists: false, error: true };
    }
}

async function authenticateUser(date_of_birth) {
    try {
        const result = await verifyUser(date_of_birth);
        
        if (result.error) {
            return {
                message: "System error during authentication",
                authenticated: false,
                error: true
            };
        }

        if (!result.exists) {
            return {
                message: "Phone number not found in our records",
                authenticated: false
            };
        }

        if (result.verified) {
            globalUser = result.user;
            return {
                message: "Authentication successful",
                authenticated: true,
                user: result.user
            };
        }

        return {
            message: "Failed to authenticate user",
            authenticated: false,
        };
    } catch (error) {
        console.error("Error in authentication:", error);
        return {
            message: "Authentication error",
            authenticated: false,
            error: true
        };
    }
}

async function getMedicalHistory() {
    try {
        if (!globalUser) {
            return {
                message: "Patient not found in our records.",
                thread: Date.now().toString(),
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
                    date_of_birth: globalUser.date_of_birth,
                    allergies: globalUser.allergies,
                    conditions: globalUser.conditions,
                    medications: globalUser.medications,
                    lastVisit: globalUser.last_visit,
                },
                history: history,
            }),
            thread: Date.now().toString(),
        };
    } catch (error) {
        console.error("Error getting medical history:", error);
        return {
            message: "Error retrieving medical history.",
            thread: Date.now().toString(),
        };
    }
}

async function scheduleAppointment(doctor, date, reason) {
    try {
        if (!globalUser) {
            return {
                message: "Patient not found in our records.",
            };
        }

        await dbRun(
            `INSERT INTO appointments (user_id, doctor, date, reason, status)
             VALUES (?, ?, ?, ?, ?)`,
            [globalUser.id, doctor, date, reason, "scheduled"]
        );

        return {
            message: `Appointment scheduled with ${doctor} on ${date} for ${reason}.`,
        };
    } catch (error) {
        console.error("Error scheduling appointment:", error);
        return {
            message: "Unable to schedule appointment at this time.",
        };
    }
}

async function sendDoctorEmail(doctor, subject, content) {
    try {
        if (!globalUser) {
            return {
                message: "Patient not found in our records.",
            };
        }

        await dbRun(
            `INSERT INTO emails (user_id, doctor, subject, content, status)
             VALUES (?, ?, ?, ?, ?)`,
            [globalUser.id, doctor, subject, content, "pending"]
        );

        return {
            message: `Message sent to Dr. ${doctor}. They will respond to your inquiry soon.`,
        };
    } catch (error) {
        console.error("Error sending email:", error);
        return {
            message: "Unable to send message at this time.",
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
        console.error("Error saving transcript:", error);
        return { success: false };
    }
}

// Session management: Store session data for ongoing calls
const sessions = new Map(); // A Map to hold session data for each call

// Event types to log to the console for debugging purposes
const LOG_EVENT_TYPES = [
    "response.content.done",
    "rate_limits.updated",
    "response.done",
    "input_audio_buffer.committed",
    "input_audio_buffer.speech_stopped",
    "input_audio_buffer.speech_started",
    "session.created",
    "response.text.done",
    "conversation.item.input_audio_transcription.completed",
];

// Root route - just for checking if the server is running
fastify.get("/", async (request, reply) => {
    reply.send({ message: "Twilio Media Stream Server is running!" }); // Send a simple message when accessing the root
});

// Handle incoming calls from Twilio
fastify.all("/incoming-call", async (request, reply) => {
    globalCallerNumber = request.body.From;

    // Store callerNumber in session
    const sessionId = `session_${Date.now()}`;
    sessions.set(sessionId, { transcript: "", streamSid: null });

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Connect>
                <Stream url="wss://${request.headers.host}/media-stream?sessionId=${sessionId}">
                </Stream>
            </Connect>
        </Response>`;
    
    reply.type("text/xml").send(twimlResponse);
});


// WebSocket route to handle the media stream for real-time interaction
fastify.register(async (fastify) => {
    fastify.get("/media-stream", { websocket: true }, (connection, req) => {
        console.log("Client connected to media-stream"); // Log when a client connects

        let firstMessage = ""; // Placeholder for the first message
        let streamSid = ""; // Placeholder for the stream ID
        let openAiWsReady = false; // Flag to check if the OpenAI WebSocket is ready
        let queuedFirstMessage = null; // Queue the first message until OpenAI WebSocket is ready
        let threadId = ""; // Initialize threadId for tracking conversation threads

        // Use Twilio's CallSid as the session ID or create a new one based on the timestamp
        const sessionId =
            req.headers["x-twilio-call-sid"] || `session_${Date.now()}`;
        let session = sessions.get(sessionId) || {
            transcript: "",
            streamSid: null,
        }; // Get the session data or create a new session
        sessions.set(sessionId, session); // Update the session Map

        // Open a WebSocket connection to the OpenAI Realtime API
        const openAiWs = new WebSocket(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`, // Authorization header with the OpenAI API key
                    "OpenAI-Beta": "realtime=v1", // Use the beta realtime version
                },
            }
        );

        // Function to send the session configuration to OpenAI
        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: "session.update",
                session: {
                    turn_detection: {
                        "type": "server_vad",
                        "threshold": .9,  // Lower threshold for more lenient VAD
                        "prefix_padding_ms": 500,  // Increase padding to account for initial silence
                        "silence_duration_ms": 1000  // Increase silence duration before cutting off
                    }, // Enable voice activity detection
                    input_audio_format: "g711_ulaw", // Audio format for input
                    output_audio_format: "g711_ulaw", // Audio format for output
                    voice: VOICE, // Use the defined voice for AI responses
                    instructions: SYSTEM_MESSAGE, // Provide the AI assistant's instructions
                    modalities: ["text", "audio"], // Use both text and audio for interaction
                    temperature: 0.8, // Temperature for controlling the creativity of AI responses
                    input_audio_transcription: {
                        "model": "whisper-1", // Use the Whisper model for transcribing audio
                    },
                    speech: {
                        voice: "shimmer", // Select a natural-sounding, casual yet professional voice
                        rate: 1.2, // Increase the speaking rate to sound faster
                        pitch: 1.0, // Adjust pitch to make it sound more natural
                        prosody: {
                            volume: "medium", // Adjust prosody settings for more naturalness
                            rate: "medium-fast", // Makes speech faster
                            contour: "(0%,+0)(10%,+10)(40%,+0)", // Adjust the speech contour for a more engaging tone
                        },},
                    tools: [
                        {
                            type: "function",
                            name: "authenticate_user",
                            description: "Authenticate user based on date of birth",
                            parameters: {
                                type: "object",
                                properties: {
                                    phoneNumber: { type: "string" },
                                    date_of_birth: { type: "string", description: "Date of birth (Month, Day and Year)" }
                                },
                                required: ["date_of_birth"]
                            }
                        },
                        {
                            type: "function",
                            name: "get_medical_history",
                            description:
                                "Retrieve patient's medical history and information",
                            parameters: {
                                type: "object",
                                properties: {},
                                required: [],
                            },
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
                                    "reason": { "type": "string" },
                                },
                                required: ["doctor", "date", "reason"],
                            },
                        },
                        {
                            type: "function",
                            name: "send_doctor_email",
                            description:
                                "Send an email to the patient's doctor",
                            parameters: {
                                type: "object",
                                properties: {
                                    "doctor": { "type": "string" },
                                    "subject": { "type": "string" },
                                    "content": { "type": "string" },
                                },
                                required: ["doctor", "subject", "content"],
                            },
                        },
                    ],
                    tool_choice: "auto", // Automatically choose the tool
                },
            };

            console.log(
                "Sending session update:",
                JSON.stringify(sessionUpdate)
            );
            openAiWs.send(JSON.stringify(sessionUpdate)); // Send the session update to OpenAI
        };

        // Function to send the first message once OpenAI WebSocket is ready
        const sendFirstMessage = () => {
            if (queuedFirstMessage && openAiWsReady) {
                // Check if we have a queued message and the connection is ready
                console.log(
                    "Sending queued first message:",
                    queuedFirstMessage
                );
                openAiWs.send(JSON.stringify(queuedFirstMessage)); // Send the first message
                openAiWs.send(JSON.stringify({ type: "response.create" })); // Trigger AI to generate a response
                queuedFirstMessage = null; // Clear the queue
            }
        };

        // Open event for when the OpenAI WebSocket connection is established
        openAiWs.on("open", () => {
            console.log("Connected to the OpenAI Realtime API"); // Log successful connection
            openAiWsReady = true; // Set the flag to true
            sendSessionUpdate(); // Send session configuration
            sendFirstMessage(); // Send the first message if queued
        });

        // Handle messages from Twilio (media stream) and send them to OpenAI
        connection.on("message", (message) => {
            try {
                const data = JSON.parse(message);

                if (data.event === "start") {
                    streamSid = data.start.streamSid;
                    const customParameters = data.start.customParameters;

                    // Automatically trigger authentication with phone number
                    queuedFirstMessage = {
                        type: "conversation.item.create",
                        item: {
                            type: "function_call",
                            function: {
                                name: "authenticate_user",
                                arguments: JSON.stringify({})
                            }
                        }
                    };

                    if (openAiWsReady) {
                        sendFirstMessage();
                    }
                } else if (data.event === "media") {
                    // When media (audio) is received
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        // Check if the OpenAI WebSocket is open
                        const audioAppend = {
                            type: "input_audio_buffer.append", // Append audio data
                            audio: data.media.payload, // Audio data from Twilio
                        };
                        openAiWs.send(JSON.stringify(audioAppend)); // Send the audio data to OpenAI
                    }
                }
            } catch (error) {
                console.error("Error parsing message:", error, "Message:", message);
            }
        });

        // Handle incoming messages from OpenAI
        openAiWs.on("message", async (data) => {
            try {
                const response = JSON.parse(data); // Parse the message from OpenAI

                // Handle audio responses from OpenAI
                if (
                    response.type === "response.audio.delta" &&
                    response.delta
                ) {
                    connection.send(
                        JSON.stringify({
                            event: "media",
                            streamSid: streamSid,
                            media: { payload: response.delta }, // Send audio back to Twilio
                        })
                    );
                }

                // Handle function calls
                if (response.type === "response.function_call_arguments.done") {
                    console.log("Function called:", response);
                    const functionName = response.name;
                    const args = JSON.parse(response.arguments); // Get the arguments passed to the function

                    if (
                        response.type ===
                        "response.function_call_arguments.done"
                    ) {
                        console.log("Function called:", response);
                        const functionName = response.name;
                        const args = JSON.parse(response.arguments);

                        let result;
                        switch (functionName) {
                            case "get_medical_history":
                                result = await getMedicalHistory();
                                break;
                            case "schedule_appointment":
                                result = await scheduleAppointment(
                                    args.doctor,
                                    args.date,
                                    args.reason
                                );
                                break;
                            case "send_doctor_email":
                                result = await sendDoctorEmail(
                                    args.doctor,
                                    args.subject,
                                    args.content
                                );
                                break;
                            case "authenticate_user":
                                result = await authenticateUser(
                                    args.date_of_birth
                                )
                        }

                        // Send function output back to OpenAI
                        const functionOutputEvent = {
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                role: "system",
                                output: result.message,
                            },
                        };
                        openAiWs.send(JSON.stringify(functionOutputEvent));

                        // Trigger AI response
                        openAiWs.send(
                            JSON.stringify({
                                type: "response.create",
                                response: {
                                    modalities: ["text", "audio"],
                                    instructions: `Respond to the user based on this information: ${result.message}. Be professional and clear.`,
                                },
                            })
                        );
                    }
                }

                // Log agent response
                if (response.type === "response.done") {
                    const agentMessage =
                        response.response.output[0]?.content?.find(
                            (content) => content.transcript
                        )?.transcript || "Agent message not found";
                    session.transcript += `Agent: ${agentMessage}\n`; // Add agent's message to the transcript
                    console.log(`Agent (${sessionId}): ${agentMessage}`);
                }

                // Log other relevant events
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }
            } catch (error) {
                console.error(
                    "Error processing OpenAI message:",
                    error,
                    "Raw message:",
                    data
                );
            }
        });

        // Handle when the connection is closed
        connection.on("close", async () => {
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            console.log(`Client disconnected (${sessionId}).`);
            console.log("Full Transcript:");
            console.log(session.transcript);

            await saveTranscript(globalUser.id, session.transcript); // Ensure transcript is saved

            sessions.delete(sessionId);
        });

        // Handle WebSocket errors
        openAiWs.on("error", (error) => {
            console.error("Error in the OpenAI WebSocket:", error); // Log any errors in the OpenAI WebSocket
        });

        // Helper function for sending error responses
        function sendErrorResponse() {
            openAiWs.send(
                JSON.stringify({
                    type: "response.create",
                    response: {
                        modalities: ["text", "audio"],
                        instructions:
                            "I apologize, but I'm having trouble processing your request right now. Is there anything else I can help you with?",
                    },
                })
            );
        }
    });
});

// Start the Fastify server
fastify.listen({ port: PORT }, async (err) => {
    if (err) {
        console.error(err);
        process.exit(1); // Exit if the server fails to start
    }
    console.log(`Server is listening on port ${PORT}`); // Log the port the server is running on
});
