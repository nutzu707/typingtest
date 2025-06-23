
"use client";
import React, { useState, useRef, useEffect } from "react";

function calculateWPM(charsTyped: number, elapsedSeconds: number) {
  if (elapsedSeconds === 0) return 0;
  // 1 word = 5 chars
  return Math.round((charsTyped / 5) / (elapsedSeconds / 60));
}

export default function TypingSpeedCounter() {
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [testText, setTestText] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch sentences.json and pick a random sentence
  useEffect(() => {
    async function fetchSentences() {
      try {
        const res = await fetch("/sentences.json");
        const data = await res.json();
        setSentences(data);
        // Pick a random sentence
        const randomSentence = data[Math.floor(Math.random() * data.length)];
        setTestText(randomSentence);
      } catch (e) {
        setTestText("Failed to load sentence.");
      }
    }
    fetchSentences();
  }, []);

  // Reset input and timers when testText changes (i.e., on restart)
  useEffect(() => {
    setUserInput("");
    setStartTime(null);
    setEndTime(null);
    setIsFinished(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [testText]);

  useEffect(() => {
    if (!testText) return;
    if (userInput.length === 1 && !startTime) {
      setStartTime(Date.now());
    }
    if (userInput === testText) {
      if (!endTime) {
        setEndTime(Date.now());
        setIsFinished(true);
      }
    }
  }, [userInput, startTime, endTime, testText]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isFinished) return;
    const value = e.target.value;
    if (testText && value.length > testText.length) return;
    setUserInput(value);
  }

  function handleRestart() {
    if (sentences && sentences.length > 0) {
      const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
      setTestText(randomSentence);
    } else {
      // fallback: just reset input
      setUserInput("");
      setStartTime(null);
      setEndTime(null);
      setIsFinished(false);
    }
    inputRef.current?.focus();
  }

  let elapsedSeconds = 0;
  if (startTime && endTime) {
    elapsedSeconds = (endTime - startTime) / 1000;
  } else if (startTime && !isFinished) {
    elapsedSeconds = (Date.now() - startTime) / 1000;
  }

  // Only calculate WPM at the end
  const wpm = isFinished
    ? calculateWPM(userInput.length, elapsedSeconds)
    : null;

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Typing Test</h2>
      <p className="mb-4 font-mono bg-gray-100 p-2 rounded min-h-[3rem]">
        {testText || "Loading..."}
      </p>
      <input
        ref={inputRef}
        type="text"
        className="w-full p-2 border rounded font-mono mb-4"
        value={userInput}
        onChange={handleChange}
        disabled={isFinished || !testText || testText === "Failed to load sentence."}
        placeholder="Start typing here..."
        autoFocus
      />
      {/* Only show WPM at the end */}
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
