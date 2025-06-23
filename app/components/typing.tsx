

"use client";
import React, { useState, useRef, useEffect } from "react";

const TEST_TEXT = "The quick brown fox jumps over the lazy dog.";

function calculateWPM(charsTyped: number, elapsedSeconds: number) {
  if (elapsedSeconds === 0) return 0;
  // 1 word = 5 chars
  return Math.round((charsTyped / 5) / (elapsedSeconds / 60));
}

export default function TypingSpeedCounter() {
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userInput.length === 1 && !startTime) {
      setStartTime(Date.now());
    }
    if (userInput === TEST_TEXT) {
      if (!endTime) {
        setEndTime(Date.now());
        setIsFinished(true);
      }
    }
  }, [userInput, startTime, endTime]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isFinished) return;
    const value = e.target.value;
    if (value.length > TEST_TEXT.length) return;
    setUserInput(value);
  }

  function handleRestart() {
    setUserInput("");
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    inputRef.current?.focus();
  }

  let elapsedSeconds = 0;
  if (startTime && endTime) {
    elapsedSeconds = (endTime - startTime) / 1000;
  } else if (startTime && !isFinished) {
    elapsedSeconds = (Date.now() - startTime) / 1000;
  }

  const wpm = calculateWPM(userInput.length, elapsedSeconds);

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Typing Test</h2>
      <p className="mb-4 font-mono bg-gray-100 p-2 rounded">{TEST_TEXT}</p>
      <input
        ref={inputRef}
        type="text"
        className="w-full p-2 border rounded font-mono mb-4"
        value={userInput}
        onChange={handleChange}
        disabled={isFinished}
        placeholder="Start typing here..."
        autoFocus
      />
      <div className="mb-2">
        <span className="font-semibold">WPM: </span>
        <span>{wpm}</span>
      </div>
      {isFinished && (
        <div className="mt-4">
          <div className="text-green-600 font-bold mb-2">
            Finished! Your WPM: {wpm}
          </div>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={handleRestart}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
