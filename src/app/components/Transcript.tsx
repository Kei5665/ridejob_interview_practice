"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";

export interface TranscriptProps {
  transcriptItems: TranscriptItem[];
}

function Transcript({ transcriptItems }: TranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  return (
    <div
      ref={transcriptRef}
      className="overflow-auto p-4 flex flex-col gap-y-4 h-full flex-1 bg-white rounded-t-xl"
    >
      {transcriptItems.map((item) => {
        const { itemId, type, role, timestamp, title = "", isHidden } = item;

        if (isHidden) {
          return null;
        }

        if (type === "MESSAGE") {
          const isUser = role === "user";
          const containerClasses = `flex ${isUser ? "justify-end" : "justify-start"}`;
          const bubbleBase = `max-w-lg p-3 rounded-xl ${isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"}`;
          const isBracketedMessage = title.startsWith("[") && title.endsWith("]");
          const messageStyle = isBracketedMessage ? "italic text-gray-400" : "";
          const displayTitle = isBracketedMessage ? title.slice(1, -1) : title;

          return (
            <div key={itemId} className={containerClasses}>
              <div className={bubbleBase}>
                <div className={`text-xs ${isUser ? "text-gray-400" : "text-gray-500"} font-mono`}>
                  {timestamp}
                </div>
                <div className={`whitespace-pre-wrap ${messageStyle}`}>
                  <ReactMarkdown>{displayTitle}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        } else if (type === "BREADCRUMB") {
          return null;
        } else {
          return (
            <div
              key={itemId}
              className="flex justify-center text-gray-500 text-sm italic font-mono"
            >
              Unknown item type: {type}{" "}
              <span className="ml-2 text-xs">{timestamp}</span>
            </div>
          );
        }
      })}
    </div>
  );
}

export default Transcript;
