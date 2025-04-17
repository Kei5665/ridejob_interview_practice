"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";
import Modal from './components/Modal';

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "./lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

// Define available voices (Simplified, labels corrected, images added, removed specific names)
const availableVoices = [
  { id: 'ash', name: '男性', image: '/man.jpg' },    // Assuming Ash is male
  { id: 'sage', name: '女性', image: '/woman.jpg' },   // Assuming Sage is female
];

function App() {
  const searchParams = useSearchParams();

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb } =
    useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(availableVoices[0].id); // Default to the first voice (Ash)

  // Determine if debug controls should be shown based on URL query param
  const showDebugControls = searchParams.get('debug') === 'true';

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(
        `Agent: ${selectedAgentName}`,
        currentAgent
      );
      updateSession(true);
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  // useEffect to detect interview completion and open modal
  useEffect(() => {
    if (transcriptItems.length === 0) return;

    const lastMessage = transcriptItems[transcriptItems.length - 1];

    // Log the last message for debugging
    // console.log("Checking last message for modal:", JSON.stringify(lastMessage, null, 2));

    // Modify the condition: Check role, status, and content (title)
    if (
      lastMessage.role === 'assistant' &&
      // Remove agentName check as it might not be present
      // lastMessage.agentName === 'closing' &&
      lastMessage.status === 'DONE' // Use the status from the log
    ) {
      // Check the message content (using the 'title' field from the log)
      const finalClosingText = "以上で本日の模擬面接を終了とさせていただきます";
      if (lastMessage.title && typeof lastMessage.title === 'string' && lastMessage.title.includes(finalClosingText)) {
         console.log("Closing message detected and completed, opening modal.");
         setIsModalOpen(true);
      } else {
        console.log("Assistant message completed, but not the final closing text.");
      }
    }
  }, [transcriptItems]); // Run when transcriptItems changes

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      // Send selected voice information to the server when connecting
      // Note: Server-side implementation is required to handle this event
      logClientEvent({ voice: selectedVoice }, "set_voice_preference");
      // Example: sendClientEvent({ type: "session.update", parameters: { voice: selectedVoice } });
      // The actual event format depends on the server implementation.
      // For now, we just log it. A real implementation would send this via dataChannel after connection.

      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current(JSON.parse(e.data));
      });

      setDataChannel(dc);
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    sendClientEvent(
      { type: "response.create" },
      "(trigger response after simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update"
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    const turnDetection = null;

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions,
        voice: selectedVoice,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: turnDetection,
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage("hi");
    }
  };

  const cancelAssistantSpeech = async () => {
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");

    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "DONE") {
      console.log("No truncation needed, message is DONE");
      return;
    }

    sendClientEvent({
      type: "conversation.item.truncate",
      item_id: mostRecentAssistantMessage?.itemId,
      content_index: 0,
      audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
    });
    sendClientEvent(
      { type: "response.cancel" },
      "(cancel due to user interruption)"
    );
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    cancelAssistantSpeech();

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: userText.trim() }],
        },
      },
      "(send user text message)"
    );
    setUserText("");

    sendClientEvent({ type: "response.create" }, "trigger response");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED" || dataChannel?.readyState !== "open")
      return;
    cancelAssistantSpeech();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
  };

  const handleTalkButtonUp = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      dataChannel?.readyState !== "open" ||
      !isPTTUserSpeaking
    )
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  useEffect(() => {
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  // Calculate if the agent is waiting for a response
  const isAgentWaiting = useMemo(() => {
    if (sessionStatus !== "CONNECTED") return false;
    if (transcriptItems.length === 0) return false; // No messages yet
    const lastMessage = transcriptItems[transcriptItems.length - 1];
    // Agent is waiting if the last message was from the assistant
    return lastMessage.role === "assistant";
  }, [transcriptItems, sessionStatus]);

  // Calculate if the assistant is actively speaking for animation
  const isAssistantSpeaking = useMemo(() => {
    if (!transcriptItems || transcriptItems.length === 0 || sessionStatus !== 'CONNECTED') {
      return false;
    }
    const lastItem = transcriptItems[transcriptItems.length - 1];
    // Check if the last item is from the assistant and its status indicates it's ongoing
    return (
      lastItem.role === 'assistant' &&
      lastItem.status !== 'DONE' // Simplify comparison to potentially avoid TS error
      // lastItem.status !== 'completed' 
    );
  }, [transcriptItems, sessionStatus]);

  // Get the current assistant avatar URL based on selected voice
  const assistantAvatarUrl = useMemo(() => {
    const selectedVoiceData = availableVoices.find(v => v.id === selectedVoice);
    return selectedVoiceData ? selectedVoiceData.image : '/default-avatar.png'; // Fallback
  }, [selectedVoice]); // Recompute only when selectedVoice changes

  const handleNextQuestionClick = () => {
    console.log("Next Question button clicked");
    // Send a simulated user message with the special text
    const id = uuidv4().slice(0, 32);
    // Note: This message won't appear in the main transcript unless explicitly added
    // addTranscriptMessage(id, "user", "(Proceeding via button)", true);

    sendClientEvent(
      {
        type: "conversation.item.create", // Use standard event type
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "__NEXT_QUESTION__" }], // Special text content
        },
      },
      "next_question_button_click"
    );
    // After creating the item, trigger a response from the agent
    sendClientEvent({ type: "response.create" }, "trigger_response_next_question");
  };

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div className="flex items-center">
          <div onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Switches based on sessionStatus */}
      <div className="flex flex-col flex-1 overflow-hidden"> {/* Vertical layout, takes remaining space, handles overflow */}
        {sessionStatus === "DISCONNECTED" && selectedAgentConfigSet ? (
          // --- Voice Selection View ---
          <div className="flex flex-1 items-center justify-center p-4"> {/* Centers the selection box */}
            <div className="p-6 border rounded-lg bg-white shadow-lg w-full max-w-lg">
              <h3 className="text-xl font-semibold mb-6 text-gray-700 text-center">音声を選択してください</h3>
              <div className="grid grid-cols-2 gap-8">
                {availableVoices.map((voice) => (
                  <label
                    key={voice.id}
                    className="flex flex-col items-center space-y-4 cursor-pointer p-4 rounded-lg hover:bg-gray-100 border border-gray-300 transition-colors"
                  >
                    <Image
                      src={voice.image}
                      alt={voice.name}
                      width={160}
                      height={160}
                      className="rounded-full mb-4"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="voiceSelection"
                        value={voice.id}
                        checked={selectedVoice === voice.id}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="form-radio h-5 w-5 text-blue-600 transition duration-150 ease-in-out opacity-0 absolute"
                        id={`voice-${voice.id}`}
                      />
                      <span className={`inline-block w-5 h-5 border-2 rounded-full flex items-center justify-center ${selectedVoice === voice.id ? 'border-blue-600 bg-blue-100' : 'border-gray-400'}`}>
                        {selectedVoice === voice.id && (
                          <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                        )}
                      </span>
                      <span className="text-gray-800 text-lg font-medium">{voice.name}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={connectToRealtime}
                disabled={sessionStatus !== 'DISCONNECTED'}
                className={`mt-8 w-full px-4 py-3 rounded-md text-white font-semibold text-lg transition-colors duration-200 ${
                  sessionStatus === 'DISCONNECTED'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                接続して開始
              </button>
            </div>
          </div>
        ) : (
          // --- Connected/Connecting View ---
          // Use a Fragment <> or just list children directly if no wrapper div needed here
          <>
            {/* 1. Central Avatar Area */}
            <div className="flex justify-center items-center pt-8 pb-4 flex-shrink-0 px-2">
              <Image
                src={assistantAvatarUrl}
                alt="Assistant Avatar"
                width={200}
                height={200}
                className={`rounded-full transition-transform duration-300 ease-in-out ${
                  isAssistantSpeaking ? 'animate-pulse scale-105' : 'scale-100'
                }`}
                priority
              />
            </div>

            {/* 2. Transcript Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-white rounded-t-xl shadow-md mx-2 mb-1">
              <Transcript transcriptItems={transcriptItems} />
            </div>

            {/* 3. Debug Panels (conditional) */}
            {showDebugControls && (
              <div className="flex-shrink-0 px-2 pb-1">
                <Events isExpanded={isEventsPaneExpanded} />
              </div>
            )}
            {showDebugControls && (
              <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-gray-200 bg-white rounded-b-xl mx-2">
                <input
                  type="text"
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  onKeyDown={(e) => {
                    const canSend = sessionStatus === "CONNECTED" && dcRef.current?.readyState === "open";
                    if (e.key === "Enter" && canSend && userText.trim()) {
                      handleSendTextMessage();
                    }
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type a message..."
                  disabled={!(sessionStatus === "CONNECTED" && dcRef.current?.readyState === "open")}
                />
                <button
                  onClick={handleSendTextMessage}
                  disabled={!(sessionStatus === "CONNECTED" && dcRef.current?.readyState === "open" && userText.trim())}
                  className="bg-gray-900 text-white rounded-full p-2 disabled:opacity-50 flex items-center justify-center hover:bg-gray-700 transition-colors"
                >
                  <Image src="/arrow.svg" alt="Send" width={20} height={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div> {/* End of Main Content Area */}

      {/* Bottom Toolbar */} 
      {sessionStatus !== "DISCONNECTED" && (
        <BottomToolbar
          sessionStatus={sessionStatus}
          isPTTUserSpeaking={isPTTUserSpeaking}
          handleTalkButtonDown={handleTalkButtonDown}
          handleTalkButtonUp={handleTalkButtonUp}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
          handleNextQuestionClick={handleNextQuestionClick}
          isAgentWaiting={isAgentWaiting}
          showDebugControls={showDebugControls}
        />
      )}

      {/* Modal */} 
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2 className="text-xl font-semibold mb-4">模擬面接終了</h2>
        <p>お疲れ様でした。模擬面接はこれで終了です。</p>
        <button
          onClick={() => setIsModalOpen(false)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          閉じる
        </button>
      </Modal>
    </div>
  );
}

export default App;
