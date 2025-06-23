
"use client";
import React, { useState, useRef, useEffect } from "react";

function calculateWPM(charsTyped: number, elapsedSeconds: number) {
  if (elapsedSeconds === 0) return 0;
  // 1 word = 5 chars
  return Math.round((charsTyped / 5) / (elapsedSeconds / 60));
}

function getGlobalResults() {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem("typingTestResults");
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveGlobalResult(result: { wpm: number; time: number; date: string }) {
  if (typeof window === "undefined") return;
  try {
    const prev = getGlobalResults();
    prev.push(result);
    localStorage.setItem("typingTestResults", JSON.stringify(prev));
  } catch {}
}

export default function TypingSpeedCounter() {
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [testText, setTestText] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [timer, setTimer] = useState<number>(0);
  //eslint-disable-next-line
  const [results, setResults] = useState<
    { wpm: number; time: number; date: string }[]
  >([]);
  const [globalResults, setGlobalResults] = useState<
    { wpm: number; time: number; date: string }[]
  >([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Timer effect: updates every 100ms while typing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (startTime && !isFinished) {
      interval = setInterval(() => {
        setTimer((Date.now() - startTime) / 1000);
      }, 100);
    }
    if (isFinished && startTime && endTime) {
      setTimer((endTime - startTime) / 1000);
    }
    if (!startTime) {
      setTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [startTime, isFinished, endTime]);

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
        //eslint-disable-next-line
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
    setTimer(0);
    if (inputRef.current) inputRef.current.value = "";
  }, [testText]);

  // Load global results from localStorage on mount
  useEffect(() => {
    setGlobalResults(getGlobalResults());
  }, []);

  useEffect(() => {
    if (!testText) return;
    if (userInput.length === 1 && !startTime) {
      const now = Date.now();
      setStartTime(now);
      setTimer(0);
    }
    if (userInput === testText) {
      if (!endTime) {
        const finishedTime = Date.now();
        setEndTime(finishedTime);
        setIsFinished(true);

        // Calculate WPM and save result
        const elapsed = (finishedTime - (startTime ?? finishedTime)) / 1000;
        const wpm = calculateWPM(userInput.length, elapsed);
        const result = {
          wpm,
          time: elapsed,
          date: new Date().toISOString(),
        };
        setResults((prev) => [...prev, result]);
        saveGlobalResult(result);
        setGlobalResults(getGlobalResults());
      }
    }
    // eslint-disable-next-line
  }, [userInput, startTime, endTime, testText]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
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
      setTimer(0);
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

  // Calculate global average WPM
  const globalWPMs = globalResults.map((r) => r.wpm);
  const globalAvgWPM =
    globalWPMs.length > 0
      ? Math.round(globalWPMs.reduce((a, b) => a + b, 0) / globalWPMs.length)
      : null;

  // Show up to 5 previous results (most recent first)
  const recentResults = [...globalResults].reverse().slice(0, 5);

  return (
    <div className="max-w-xl mx-auto">

      <div className="w-full mt-10 p-6 border rounded shadow">
        <h2 className="text-xl font-bold mb-4">Typing Test</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-700 font-mono">
            Timer:{" "}
            <span className="font-bold">
              {timer.toFixed(1)}s
            </span>
          </span>
        </div>
        <p className="mb-4 font-mono border bg-gray-100 p-2 rounded min-h-[3rem]">
          {testText || "Loading..."}
        </p>
        {/* Previous Results Box */}

        <textarea
          ref={inputRef}
          className="w-full p-2 border rounded font-mono mb-2 resize-none break-words"
          value={userInput}
          onChange={handleChange}
          disabled={isFinished || !testText || testText === "Failed to load sentence."}
          placeholder="Start typing here..."
          autoFocus
          rows={3}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        />
        {/* Only show WPM at the end */}
        {isFinished && (
          <div className="">
            <div className="font-bold mb-2">
              Finished! Your WPM: {wpm}
            </div>
            <button
              className="px-4 py-2 bg-black  text-white rounded"
              onClick={handleRestart}
            >
              Restart
            </button>
          </div>
        )}
      </div>

      <div className="w-full mt-6 p-6 border rounded shadow">
        <h2 className="text-xl font-bold mb-4">Previous Results</h2>
        {recentResults.length === 0 ? (
          <div className="text-gray-500 text-sm">No previous results yet.</div>
        ) : (
          <ul className="text-sm font-mono space-y-1 mb-2">
            {recentResults.map((r, idx) => (
              <li key={r.date + idx}>
                <span className="font-bold">{r.wpm} WPM</span>
                {" "}
                <span className="text-gray-600">
                  ({r.time.toFixed(1)}s, {new Date(r.date).toLocaleString()})
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 font-mono">
          Global average:{" "}
          {globalAvgWPM !== null ? (
            <span className="font-bold">{globalAvgWPM} WPM</span>
          ) : (
            <span className="text-gray-500">N/A</span>
          )}
        </div>
      </div>
    </div>
  );
}
