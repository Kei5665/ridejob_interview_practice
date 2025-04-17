import React from "react";
import { SessionStatus } from "@/app/types";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (val: boolean) => void;
  handleNextQuestionClick: () => void;
  isAgentWaiting: boolean;
  showDebugControls: boolean;
}

function BottomToolbar({
  sessionStatus,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  handleNextQuestionClick,
  isAgentWaiting,
  showDebugControls,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";

  return (
    <div className="p-4 flex flex-row items-center justify-center gap-x-8">
      <div className="flex flex-row items-center gap-2">
        {!isPTTUserSpeaking ? (
          <button
            onClick={handleTalkButtonDown}
            disabled={!isConnected}
            className={
              "bg-green-600 hover:bg-green-700 text-white text-base p-2 w-36 rounded-full h-full cursor-pointer" +
              (!isConnected ? " bg-gray-400 cursor-not-allowed" : "")
            }
          >
            録音開始
          </button>
        ) : (
          <button
            onClick={handleTalkButtonUp}
            disabled={!isConnected}
            className={
              "bg-red-600 hover:bg-red-700 text-white text-base p-2 w-36 rounded-full h-full cursor-pointer animate-pulse"
            }
          >
            録音停止
          </button>
        )}
      </div>

      <div className="flex flex-row items-center gap-2">
        <button
          onClick={handleNextQuestionClick}
          disabled={!isConnected || !isAgentWaiting || isPTTUserSpeaking}
          className={`text-white text-base p-2 w-36 rounded-full h-full ${
            isConnected && isAgentWaiting && !isPTTUserSpeaking
              ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          次の質問へ
        </button>
      </div>

      {showDebugControls && (
        <>
          <div className="flex flex-row items-center gap-2">
            <input
              id="audio-playback"
              type="checkbox"
              checked={isAudioPlaybackEnabled}
              onChange={e => setIsAudioPlaybackEnabled(e.target.checked)}
              disabled={!isConnected}
              className="w-4 h-4"
            />
            <label htmlFor="audio-playback" className="flex items-center cursor-pointer">
              Audio playback
            </label>
          </div>

          <div className="flex flex-row items-center gap-2">
            <input
              id="logs"
              type="checkbox"
              checked={isEventsPaneExpanded}
              onChange={e => setIsEventsPaneExpanded(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="logs" className="flex items-center cursor-pointer">
              Logs
            </label>
          </div>
        </>
      )}
    </div>
  );
}

export default BottomToolbar;
