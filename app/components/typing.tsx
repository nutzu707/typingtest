
"use client";
import React, { useState, useRef, useEffect } from "react";

const APOSTROPHE_EQUIVALENTS = [
  "'", // ASCII apostrophe
  "’", // U+2019 RIGHT SINGLE QUOTATION MARK
  "‘", // U+2018 LEFT SINGLE QUOTATION MARK
  "‛", // U+201B SINGLE HIGH-REVERSED-9 QUOTATION MARK
  "ʼ", // U+02BC MODIFIER LETTER APOSTROPHE
  "`", // grave accent (sometimes used)
  "ʹ", // U+02B9 MODIFIER LETTER PRIME
  "＇", // U+FF07 FULLWIDTH APOSTROPHE
];

// Helper to check if two chars are equivalent, especially for apostrophes
function charsEquivalent(a: string, b: string) {
  if (a === b) return true;
  if (
    APOSTROPHE_EQUIVALENTS.includes(a) &&
    APOSTROPHE_EQUIVALENTS.includes(b)
  ) {
    return true;
  }
  return false;
}

// Helper to normalize a string by replacing all apostrophe-like chars with ASCII apostrophe
function normalizeApostrophes(str: string) {
  let result = "";
  for (const c of str) {
    if (APOSTROPHE_EQUIVALENTS.includes(c)) {
      result += "'";
    } else {
      result += c;
    }
  }
  return result;
}

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

// Only store wpm and date (not time)
function saveGlobalResult(result: { wpm: number; date: string }) {
  if (typeof window === "undefined") return;
  try {
    const prev = getGlobalResults();
    prev.push(result);
    localStorage.setItem("typingTestResults", JSON.stringify(prev));
  } catch {}
}

// Helper to format "time ago" string
function timeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (isNaN(seconds) || seconds < 0) return "just now";

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
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
    { wpm: number; date: string }[]
  >([]);
  const [globalResults, setGlobalResults] = useState<
    { wpm: number; date: string }[]
  >([]);
  const [showAllResults, setShowAllResults] = useState(false);
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
    // Use normalized strings for completion check
    if (
      normalizeApostrophes(userInput) === normalizeApostrophes(testText)
    ) {
      if (!endTime) {
        const finishedTime = Date.now();
        setEndTime(finishedTime);
        setIsFinished(true);

        // Calculate WPM and save result
        const elapsed = (finishedTime - (startTime ?? finishedTime)) / 1000;
        const wpm = calculateWPM(userInput.length, elapsed);
        const result = {
          wpm,
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

  // Prevent pasting into the textarea
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
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

  // Show up to 5 previous results (most recent first) unless showAllResults is true
  const reversedResults = [...globalResults].reverse();
  const recentResults = showAllResults ? reversedResults : reversedResults.slice(0, 5);

  // --- Highlight logic for testText ---
  function renderTestTextWithHighlights() {
    if (!testText) return "Loading...";
    const chars = testText.split("");
    const inputChars = userInput.split("");
    return (
      <span>
        {chars.map((char, idx) => {
          let className = "";
          if (idx < inputChars.length) {
            if (charsEquivalent(inputChars[idx], char)) {
              className = "bg-transparent";
            } else {
              className = "bg-red-300 text-black";
            }
          }
          return (
            <span
              key={idx}
              className={className + "  "}
              style={
                className
                  ? { transition: "background 0.1s" }
                  : undefined
              }
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <div className="max-w-xl mx-auto pt-10 pb-10">

      <div className="w-full p-6 border rounded">
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
          {renderTestTextWithHighlights()}
        </p>
        {/* Previous Results Box */}

        <textarea
          ref={inputRef}
          className="w-full p-2 border rounded font-mono mb-2 resize-none break-words"
          value={userInput}
          onChange={handleChange}
          onPaste={handlePaste}
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
              className="px-4 py-2 bg-black cursor-pointer text-white rounded"
              onClick={handleRestart}
            >
              Restart
            </button>
          </div>
        )}
      </div>

      <div className="w-full mt-6 p-6 border rounded ">
        <h2 className="text-xl font-bold mb-4">Previous Results</h2>
        {recentResults.length === 0 ? (
          <div className="text-gray-500 text-sm">No previous results yet.</div>
        ) : (
          <>
            <ul className="text-sm font-mono space-y-1 mb-2">
              {recentResults.map((r, idx) => (
                <li key={r.date + idx}>
                  <span className="font-bold">{r.wpm} WPM</span>
                  {" "}
                  <span className="text-gray-600">
                    ({timeAgo(r.date)})
                  </span>
                </li>
              ))}
            </ul>
            {globalResults.length > 5 && !showAllResults && (
              <button
                className="text-sm underline cursor-pointer"
                onClick={() => setShowAllResults(true)}
              >
                show more
              </button>
            )}
            {showAllResults && globalResults.length > 5 && (
              <button
                className="text-sm underline cursor-pointer"
                onClick={() => setShowAllResults(false)}
              >
                show less
              </button>
            )}
          </>
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
