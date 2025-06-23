
"use client";
import React, { useState, useRef, useEffect } from "react";

const APOSTROPHE_EQUIVALENTS = [
  "'", "’", "‘", "‛", "ʼ", "`", "ʹ", "＇",
];

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

function saveGlobalResult(result: { wpm: number; date: string }) {
  if (typeof window === "undefined") return;
  try {
    const prev = getGlobalResults();
    prev.push(result);
    localStorage.setItem("typingTestResults", JSON.stringify(prev));
  } catch {}
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (isNaN(seconds) || seconds < 0) return "just now";
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
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
  const [animateWPM, setAnimateWPM] = useState(false);
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
        const randomSentence = data[Math.floor(Math.random() * data.length)];
        setTestText(randomSentence);
        // eslint-disable-next-line
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
    if (
      normalizeApostrophes(userInput) === normalizeApostrophes(testText)
    ) {
      if (!endTime) {
        const finishedTime = Date.now();
        setEndTime(finishedTime);
        setIsFinished(true);

        // Animate WPM on finish
        setAnimateWPM(true);
        setTimeout(() => setAnimateWPM(false), 1200);

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
      setUserInput("");
      setStartTime(null);
      setEndTime(null);
      setIsFinished(false);
      setTimer(0);
    }
    inputRef.current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
  }

  let elapsedSeconds = 0;
  if (startTime && endTime) {
    elapsedSeconds = (endTime - startTime) / 1000;
  } else if (startTime && !isFinished) {
    elapsedSeconds = (Date.now() - startTime) / 1000;
  }

  const wpm = isFinished
    ? calculateWPM(userInput.length, elapsedSeconds)
    : null;

  const globalWPMs = globalResults.map((r) => r.wpm);
  const globalAvgWPM =
    globalWPMs.length > 0
      ? Math.round(globalWPMs.reduce((a, b) => a + b, 0) / globalWPMs.length)
      : null;

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
          let style: React.CSSProperties = {};
          if (idx < inputChars.length) {
            if (charsEquivalent(inputChars[idx], char)) {
              className = "bg-transparent";
              style = {
                transition: "background 0.1s, color 0.1s",
              };
            } else {
              className = "bg-red-300 text-black animate-shake";
              style = {
                transition: "background 0.1s, color 0.1s",
                animation: "shake 0.2s",
              };
            }
          }
          // Animate the next char to type (remove blue color)
          if (idx === inputChars.length && !isFinished) {
            className += " animate-blink";
            style = {
              ...style,
              transition: "color 0.2s",
              animation: "blink 1s step-end infinite",
            };
          }
          return (
            <span
              key={idx}
              className={className }
              style={style}
            >
              {char}
            </span>
          );
        })}
        <style jsx>{`
          @keyframes shake {
            0% { transform: translateX(0); }
            20% { transform: translateX(-2px); }
            40% { transform: translateX(2px); }
            60% { transform: translateX(-2px); }
            80% { transform: translateX(2px); }
            100% { transform: translateX(0); }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
          }
        `}</style>
      </span>
    );
  }

  const showRestartDuringTyping = startTime !== null && !isFinished;

  // Determine if currently typing (timer running)
  const isTyping = startTime !== null && !isFinished;

  return (
    <div className="max-w-xl mx-auto pb-10 font-mono">
      <div className="w-full p-6 border rounded shadow-lg bg-white/80 transition-all duration-300 hover:shadow-2xl">
        <h2 className="text-4xl font-bold mb-8 text-center tracking-tight transition-all duration-300 hover:text-blue-700">
          Typing Test
        </h2>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono font-bold flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                isTyping ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            Timer:{" "}
            <span className="font-bold text-blue-700 transition-all duration-300">
              {timer.toFixed(1)}s
            </span>
          </span>
        </div>
        <p className="mb-4 font-mono border bg-gray-100 p-2 rounded min-h-[3rem] transition-all duration-300 shadow-inner">
          {renderTestTextWithHighlights()}
        </p>
        <textarea
          ref={inputRef}
          className="w-full p-2 border rounded font-mono mb-2 resize-none break-words transition-all duration-200"
          value={userInput}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={isFinished || !testText || testText === "Failed to load sentence."}
          placeholder="Start typing here..."
          autoFocus
          rows={3}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        />
        {showRestartDuringTyping && (
          <div className="mb-2 flex justify-end">
            <button
              className="px-4 py-2 bg-black cursor-pointer text-white rounded shadow transition-all duration-200 hover:bg-blue-700 hover:scale-105 active:scale-95"
              onClick={handleRestart}
            >
              Restart
            </button>
          </div>
        )}
        {isFinished && (
          <div className="flex flex-col items-center animate-fadein">
            <div
              className={
                "font-bold mb-2 text-2xl transition-all duration-500 " +
                (animateWPM ? "animate-pop" : "")
              }
            >
              Finished! Your WPM:{" "}
              <span className="text-blue-700">{wpm}</span>
            </div>
            <button
              className="px-4 py-2 bg-black cursor-pointer text-white rounded shadow transition-all duration-200 hover:bg-blue-700 hover:scale-105 active:scale-95"
              onClick={handleRestart}
            >
              Restart
            </button>
            <style jsx>{`
              @keyframes pop {
                0% { transform: scale(1); }
                60% { transform: scale(1.25); }
                100% { transform: scale(1); }
              }
              .animate-pop {
                animation: pop 0.2s cubic-bezier(.36,1.6,.64,1) 1;
              }
              @keyframes fadein {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .animate-fadein {
                animation: fadein 0.7s;
              }
            `}</style>
          </div>
        )}
      </div>

      <div className="w-full mt-6 p-6 border rounded shadow bg-white/70 transition-all duration-300 hover:shadow-xl">
        <div className="font-mono font-bold text-xl text-center mb-4">
            Global average:{" "}
            {globalAvgWPM !== null ? (
                <span className="font-bold text-blue-700 animate-fadein">{globalAvgWPM} WPM</span>
            ) : (
                <span className="text-gray-500">N/A</span>
            )}
        </div>
        <h2 className=" font-bold mb-2 tracking-tight px-2">Previous Results</h2>
        {recentResults.length === 0 ? (
          <div className="text-gray-500 text-sm px-2">No previous results yet.</div>
        ) : (
          <>
            <ul className="text-sm font-mono space-y-1 ">
              {recentResults.map((r, idx) => (
                <li
                  key={r.date + idx}
                  className="transition-all duration-200 hover:bg-blue-50 px-2 py-1"
                >
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
                className="text-sm underline cursor-pointer px-2 pt-2 text-blue-700 hover:text-blue-900 transition-all duration-200"
                onClick={() => setShowAllResults(true)}
              >
                show more
              </button>
            )}
            {showAllResults && globalResults.length > 5 && (
              <button
                className="text-sm underline cursor-pointer px-2 pt-2 text-blue-700 hover:text-blue-900 transition-all duration-200"
                onClick={() => setShowAllResults(false)}
              >
                show less
              </button>
            )}
          </>
        )}
        
        <style jsx>{`
          @keyframes fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein {
            animation: fadein 0.7s;
          }
        `}</style>
      </div>
    </div>
  );
}
