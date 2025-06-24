
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCwIcon } from "lucide-react";

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

// --- Store accuracy in results ---
function saveGlobalResult(result: { wpm: number; date: string; accuracy: number }) {
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

function formatDateTime(dateString: string): string {
  // Returns e.g. "2024-06-10 14:23"
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- Accuracy calculation helpers ---
// This version tracks mistakes as a cumulative count that never decreases, even if the user corrects their input.
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
    { wpm: number; date: string; accuracy: number }[]
  >([]);
  const [globalResults, setGlobalResults] = useState<
    { wpm: number; date: string; accuracy: number }[]
  >([]);
  const [showAllResults, setShowAllResults] = useState(false);
  const [animateWPM, setAnimateWPM] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "wpm">("latest");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Accuracy state ---
  // mistakeCount is cumulative and never decreases during a test
  const [mistakeCount, setMistakeCount] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState<number | null>(null);

  // For tracking previous input to detect new mistakes
  const prevInputRef = useRef<string>("");

  // --- Modal state for delete all ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- Focus textarea and start test on any writing key ---
  useEffect(() => {
    function isWritingKey(e: KeyboardEvent) {
      // Ignore if modifier is pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      // Accept all printable characters except for navigation, function, etc.
      // e.key.length === 1 covers most printable keys
      if (e.key.length === 1 && !isFinished && testText && testText !== "Failed to load sentence.") {
        return true;
      }
      return false;
    }

    function handleGlobalKeydown(e: KeyboardEvent) {
      // If textarea is already focused, do nothing
      if (document.activeElement === inputRef.current) return;
      if (isWritingKey(e)) {
        e.preventDefault();
        // Focus the textarea
        inputRef.current?.focus();
        // Optionally, start the test if not started (handled by input logic)
      }
    }

    window.addEventListener("keydown", handleGlobalKeydown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown, { capture: true });
    };
    // eslint-disable-next-line
  }, [isFinished, testText]);

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
    setMistakeCount(0);
    setFinalAccuracy(null);
    prevInputRef.current = "";
    if (inputRef.current) inputRef.current.value = "";
  }, [testText]);

  // Focus textarea after testText changes (i.e., after reset)
  useEffect(() => {
    // Use a timeout to ensure focus after DOM update
    const timeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [testText]);

  // Load global results from localStorage on mount
  useEffect(() => {
    setGlobalResults(getGlobalResults());
  }, []);

  // --- Track mistakes as user types ---
  useEffect(() => {
    if (!testText) return;

    // Only count mistakes before finished
    if (!isFinished) {
      const prevInput = prevInputRef.current;
      const currInput = userInput;

      // Only check for new characters added (not deletions)
      if (currInput.length > prevInput.length) {
        // For each new character typed, check if it matches the testText at that position
        for (let i = prevInput.length; i < currInput.length; i++) {
          if (i < testText.length && !charsEquivalent(currInput[i], testText[i])) {
            setMistakeCount((prev) => prev + 1);
          }
        }
      }
      // If user deletes, do not decrease mistakeCount
      // If user pastes, this will not allow more than testText.length chars anyway

      prevInputRef.current = currInput;
    }

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

        // Calculate accuracy
        const totalChars = testText.length;
        const mistakes = mistakeCount;
        const accuracy = totalChars > 0 ? Math.max(0, Math.round(100 * (1 - mistakes / totalChars))) : 100;
        setFinalAccuracy(accuracy);

        const result = {
          wpm,
          date: new Date().toISOString(),
          accuracy,
        };
        setResults((prev) => [...prev, result]);
        saveGlobalResult(result);
        setGlobalResults(getGlobalResults());
      }
    }
    // eslint-disable-next-line
  }, [userInput, startTime, endTime, testText, isFinished, mistakeCount]);

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
      setMistakeCount(0);
      setFinalAccuracy(null);
      prevInputRef.current = "";
      if (inputRef.current) inputRef.current.value = "";
      // Fallback focus if no sentences loaded
      if (inputRef.current) inputRef.current.focus();
    }
    // Do not focus here, let the useEffect on [testText] handle it
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
  }

  // --- Delete all results handler ---
  function handleDeleteAllResults() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("typingTestResults");
      setGlobalResults([]);
      setShowAllResults(false);
    }
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

  // --- Averages calculation ---
  const globalWPMs = globalResults.map((r) => r.wpm);
  const globalAccs = globalResults.map((r) => r.accuracy);

  const globalAvgWPM =
    globalWPMs.length > 0
      ? Math.round(globalWPMs.reduce((a, b) => a + b, 0) / globalWPMs.length)
      : null;

  const globalAvgAcc =
    globalAccs.length > 0
      ? Math.round(globalAccs.reduce((a, b) => a + b, 0) / globalAccs.length)
      : null;

  // Last 10 averages
  const last10 = globalResults.slice(-10);
  const last10WPMs = last10.map((r) => r.wpm);
  const last10Accs = last10.map((r) => r.accuracy);

  const last10AvgWPM =
    last10WPMs.length > 0
      ? Math.round(last10WPMs.reduce((a, b) => a + b, 0) / last10WPMs.length)
      : null;

  const last10AvgAcc =
    last10Accs.length > 0
      ? Math.round(last10Accs.reduce((a, b) => a + b, 0) / last10Accs.length)
      : null;

  // Sorting logic for results
  let sortedResults = [...globalResults];
  if (sortBy === "latest") {
    sortedResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } else if (sortBy === "wpm") {
    sortedResults.sort((a, b) => b.wpm - a.wpm || new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  const recentResults = showAllResults ? sortedResults : sortedResults.slice(0, 5);

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
              className = "bg-transparent animate-char-correct";
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
            className += " animate-blink animate-char-cursor";
            style = {
              ...style,
              transition: "color 0.2s",
              animation: "blink 1s step-end infinite, cursorPop 0.3s",
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
          @keyframes charCorrect {
            0% { background: #BD3AD0; }
            100% { background: transparent; }
          }
          .animate-char-correct {
            animation: charCorrect 0.3s;
          }
          @keyframes cursorPop {
            0% { transform: scale(1); }
            60% { transform: scale(1.3); }
            100% { transform: scale(1); }
          }
          .animate-char-cursor {
            animation: cursorPop 0.3s;
          }
        `}</style>
      </span>
    );
  }

  // Remove conditional for restart button: always show it
  // const showRestartDuringTyping = startTime !== null && !isFinished;

  // Determine if currently typing (timer running)
  const isTyping = startTime !== null && !isFinished;

  // --- Find latest and fastest result in all globalResults (not just recentResults) ---
  // Find the latest (most recent date)
  let latestGlobalDate = -Infinity;
  let latestGlobalResult: { wpm: number; date: string; accuracy: number } | null = null;
  if (globalResults.length > 0) {
    globalResults.forEach((r) => {
      const t = new Date(r.date).getTime();
      if (t > latestGlobalDate) {
        latestGlobalDate = t;
        latestGlobalResult = r;
      }
    });
  }

  // Find the fastest (highest wpm, break ties by most recent date)
  let fastestGlobalWpm = -Infinity;
  let fastestGlobalDate = -Infinity;
  let fastestGlobalResult: { wpm: number; date: string; accuracy: number } | null = null;
  if (globalResults.length > 0) {
    globalResults.forEach((r) => {
      const t = new Date(r.date).getTime();
      if (
        r.wpm > fastestGlobalWpm ||
        (r.wpm === fastestGlobalWpm && t > fastestGlobalDate)
      ) {
        fastestGlobalWpm = r.wpm;
        fastestGlobalDate = t;
        fastestGlobalResult = r;
      }
    });
  }

  // --- Accuracy calculation for current test ---
  const totalChars = testText.length;
  const currentMistakes = mistakeCount;
  const currentAccuracy = totalChars > 0 ? Math.max(0, Math.round(100 * (1 - currentMistakes / totalChars))) : 100;

  return (
    <div className="max-w-xl min-w-xl mx-auto pb-10 font-mono">
      <div className="min-w-full px-4 py-6 sm:px-8 sm:py-8 border rounded-lg shadow-lg bg-white/40 transition-all duration-300 hover:shadow-xl animate-fadein-card">
        <h2 className="uppercase text-4xl font-bold mb-8 mt-4 text-center w-full bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text animate-float tracking-wide drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]">
          Speed Typing Test
        </h2>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono font-bold flex items-center">
            <span
              className={`inline-block w-2 h-2 mr-3 rounded-full animate-pulse ${
                isTyping ? "bg-green-500" : "bg-red-500"
              }`}
              style={{
                boxShadow: isTyping
                  ? "0 0 8px 2px #22c55e"
                  : "0 0 8px 2px #ef4444",
                transition: "box-shadow 0.1s"
              }}
            ></span>
            Timer:{" "}
            <span className="font-bold ml-1 text-blue-700 transition-all duration-300 animate-timer-pop">
              {timer.toFixed(1)}s
            </span>
          </span>
        </div>
        <p className="mb-4 font-mono border px-3 py-2 rounded min-h-[3rem] transition-all duration-300 shadow-inner animate-fadein-slow">
          {renderTestTextWithHighlights()}
        </p>
        <textarea
          ref={inputRef}
          className="w-full px-3 py-2 border rounded font-mono mb-4 resize-none break-words transition-all duration-200 animate-fadein-slow"
          value={userInput}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={isFinished || !testText || testText === "Failed to load sentence."}
          placeholder="Start typing here..."
          autoFocus
          rows={3}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
          id="typing-textarea"
        />
        {/* Always show the restart button */}
        <div className="flex h-10 flex-row items-center animate-fadein">
        {isFinished && (
          <div className="animate-fadein">
            <div
              className={
                "font-bold text-lg border rounded-lg px-3 py-2 border-blue-200 transition-all duration-500 " +
                (animateWPM ? "animate-pop" : "")
              }
            >
              WPM:{" "}
              <span className="text-blue-700 animate-wpm-pop">{wpm}</span>
              {"  "}
              <span className="ml-4">
                ACC:{" "}
                <span className="text-green-700 animate-acc-pop">
                  {finalAccuracy !== null ? `${finalAccuracy}%` : "100%"}
                </span>
              </span>
            </div>
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
              @keyframes wpmPop {
                0% { color: #1e40af; transform: scale(1); }
                60% { color: #2563eb; transform: scale(1.4); }
                100% { color: #1d4ed8; transform: scale(1); }
              }
              .animate-wpm-pop {
                animation: wpmPop 0.5s;
              }
              @keyframes accPop {
                0% { color: #15803d; transform: scale(1); }
                60% { color: #22c55e; transform: scale(1.3); }
                100% { color: #16a34a; transform: scale(1); }
              }
              .animate-acc-pop {
                animation: accPop 0.5s;
              }
              @keyframes bounceIn {
                0% { opacity: 0; transform: scale(0.7) translateY(20px);}
                60% { opacity: 1; transform: scale(1.1) translateY(-5px);}
                100% { opacity: 1; transform: scale(1) translateY(0);}
              }
              .animate-bounce-in {
                animation: bounceIn 0.5s;
              }
            `}</style>
          </div>
        )}
          <button
            className="px-4 py-2 ml-auto h-10 cursor-pointer rounded-lg shadow font-semibold bg-blue-700 text-white transition-all duration-200 hover:bg-blue-800 hover:scale-105 active:scale-95 animate-bounce-in focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={handleRestart}
            type="button"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <RefreshCwIcon className="w-4 h-4" />
              </svg>
              Reset
            </span>
          </button>
        </div>
        
      </div>

      <div className="w-full mt-6 px-4 py-6 sm:px-8 sm:py-8 border rounded-lg shadow-lg bg-white/40 transition-all duration-300 hover:shadow-xl animate-fadein-card">
        {/* Stats Card */}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
          <div className="flex w-full border border-blue-200 rounded-lg px-3 py-4 items-center justify-between animate-fadein-slow">
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-blue-700 font-medium mb-2">All Time Avg</div>
              <div className="text-blue-700 text-sm font-medium">WPM <span className="text-gray-400">/</span> <span className="text-green-700">ACC</span></div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-blue-700 text-2xl font-bold leading-tight animate-avg-pop">
                <span className="text-blue-700">{globalAvgWPM !== null ? globalAvgWPM : "--"}</span>
                <span className="text-gray-400">/</span>
                <span className="text-green-700">
                  {globalAvgAcc !== null ? `${globalAvgAcc}%` : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full border border-yellow-200 rounded-lg px-3 py-4 flex items-center justify-between animate-fadein-slow">
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-yellow-700 font-medium mb-2">Last 10 Avg</div>
              <div className="text-blue-700 text-sm font-medium">WPM <span className="text-gray-400">/</span> <span className="text-green-700">ACC</span></div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-blue-700 text-2xl font-bold leading-tight animate-avg-pop">
                <span className="text-blue-700">{last10AvgWPM !== null ? last10AvgWPM : "--"}</span>
                <span className="text-gray-400">/</span>
                <span className="text-green-700">
                  {last10AvgAcc !== null ? `${last10AvgAcc}%` : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* End Stats Card */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold tracking-tight text-lg animate-fadein">Previous Results</h2>
          <div className="flex gap-1">
            <button
              className={`px-2 py-0.5 rounded text-xs font-bold border transition-all duration-150 ${
                sortBy === "latest"
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-transparent text-blue-700 border-blue-700 hover:bg-blue-50"
              } animate-bounce-in`}
              style={{ minWidth: 36 }}
              onClick={() => setSortBy("latest")}
              aria-label="Sort by Time"
            >
              Time
            </button>
            <button
              className={`px-2 py-0.5 rounded text-xs font-bold border transition-all duration-150 ${
                sortBy === "wpm"
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-transparent text-blue-700 border-blue-700 hover:bg-blue-50"
              } animate-bounce-in`}
              style={{ minWidth: 36 }}
              onClick={() => setSortBy("wpm")}
              aria-label="Sort by WPM"
            >
              WPM
            </button>
          </div>
        </div>
        {recentResults.length === 0 ? (
          <div className="text-gray-500 text-sm animate-fadein">No previous results yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto animate-fadein-slow overflow-hidden">
              <table className="min-w-full text-sm font-mono border-collapse">
                <thead>
                  <tr className="">
                    <th className="w-10 min-w-10 text-left font-bold">#</th>
                    <th className="w-16 min-w-16 text-left font-bold">WPM</th>
                    <th className="w-16 min-w-16 text-left font-bold">ACC</th>
                    <th className="w-40 min-w-40 text-left font-bold">When</th>
                    <th className="w-30 text-left font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((r, idx) => {
                    const d = new Date(r.date);
                    // Combine date and time in one string
                    const dateTimeStr = isNaN(d.getTime())
                      ? ""
                      : `${d.getFullYear()}-${(d.getMonth() + 1)
                          .toString()
                          .padStart(2, "0")}-${d
                          .getDate()
                          .toString()
                          .padStart(2, "0")} ${d
                          .getHours()
                          .toString()
                          .padStart(2, "0")}:${d
                          .getMinutes()
                          .toString()
                          .padStart(2, "0")}`;
                    // Determine if this is the latest in all globalResults
                    const isLatest =
                      latestGlobalResult &&
                      r.wpm === latestGlobalResult.wpm &&
                      r.date === latestGlobalResult.date;
                    // Determine if this is the fastest in all globalResults
                    const isFastest =
                      fastestGlobalResult &&
                      r.wpm === fastestGlobalResult.wpm &&
                      r.date === fastestGlobalResult.date;
                    // If both, show both dots (green for fastest, blue for latest)
                    return (
                      <tr
                        key={r.date + idx}
                        className="transition-all duration-200 hover:bg-blue-50 animate-row-fadein"
                        style={{
                          animationDelay: `${idx * 0.05}s`,
                          animationFillMode: "backwards"
                        }}
                      >
                        <td className="py-1">{idx + 1}</td>
                        <td className="py-1 font-bold text-blue-700">
                          <span className="inline-flex items-center">
                            {isFastest && (
                              <span
                                title="Fastest"
                                className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-dot-pop"
                                style={{ verticalAlign: "middle" }}
                              ></span>
                            )}
                            {isLatest && (
                              <span
                                title="Latest"
                                className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 animate-dot-pop"
                                style={{ verticalAlign: "middle" }}
                              ></span>
                            )}
                            {r.wpm}
                          </span>
                        </td>
                        <td className="font-bold text-green-700">
                          {typeof r.accuracy === "number" ? `${r.accuracy}%` : "N/A"}
                        </td>
                        <td className="text-gray-600">{timeAgo(r.date)}</td>
                        <td>{dateTimeStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-2 animate-fadein">
              {globalResults.length > 5 && !showAllResults && (
                <button
                  className="text-sm underline cursor-pointer pt-2 text-blue-700 hover:text-blue-900 transition-all duration-200 animate-bounce-in"
                  onClick={() => setShowAllResults(true)}
                >
                  show more
                </button>
              )}
              {showAllResults && globalResults.length > 5 && (
                <button
                  className="text-sm underline cursor-pointer px-2 pt-2 text-blue-700 hover:text-blue-900 transition-all duration-200 animate-bounce-in"
                  onClick={() => setShowAllResults(false)}
                >
                  show less
                </button>
              )}
              {globalResults.length > 0 && (
                <button
                  className="text-sm underline cursor-pointer pt-2 text-red-700 hover:text-red-900 transition-all duration-200 animate-bounce-in"
                  onClick={() => setShowDeleteModal(true)}
                  style={{ marginLeft: "auto" }}
                >
                  delete all
                </button>
              )}
            </div>
            {/* Modal for delete all confirmation */}
            {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-modal-fadein">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-xs w-full border animate-modal-pop">
                  <div className="font-bold text-lg mb-2 text-center text-red-700">Delete All Results?</div>
                  <div className="text-gray-700 mb-4 text-center">
                    Are you sure you want to delete <b>all</b> typing results? This cannot be undone.
                  </div>
                  <div className="flex justify-center gap-4">
                    <button
                      className="px-4 py-1 rounded bg-red-700 text-white font-bold shadow hover:bg-red-800 transition-all duration-150 animate-bounce-in"
                      onClick={() => {
                        handleDeleteAllResults();
                        setShowDeleteModal(false);
                      }}
                    >
                      Delete All
                    </button>
                    <button
                      className="px-4 py-1 rounded bg-gray-200 text-gray-800 font-bold shadow hover:bg-gray-300 transition-all duration-150 animate-bounce-in"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
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
          @keyframes fadeinCard {
            from { opacity: 0; transform: translateY(30px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fadein-card {
            animation: fadeinCard 0.7s;
          }
          @keyframes fadeinSlow {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein-slow {
            animation: fadeinSlow 1.2s;
          }
          @keyframes titlePop {
            0% { letter-spacing: 0.1em; transform: scale(1);}
            60% { letter-spacing: 0.2em; transform: scale(1.08);}
            100% { letter-spacing: 0.1em; transform: scale(1);}
          }
          .animate-title-pop {
            animation: titlePop 0.7s;
          }
          @keyframes timerPop {
            0% { color: #1e40af; transform: scale(1);}
            60% { color: #2563eb; transform: scale(1.15);}
            100% { color: #1d4ed8; transform: scale(1);}
          }
          .animate-timer-pop {
            animation: timerPop 0.7s;
          }
          @keyframes avgPop {
            0% { color: #0ea5e9; transform: scale(1);}
            60% { color: #2563eb; transform: scale(1.12);}
            100% { color: #1e40af; transform: scale(1);}
          }
          .animate-avg-pop {
            animation: avgPop 0.7s;
          }
          @keyframes rowFadein {
            from { opacity: 0; transform: translateY(10px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-row-fadein {
            animation: rowFadein 0.5s;
          }
          @keyframes dotPop {
            0% { transform: scale(0.7);}
            60% { transform: scale(1.3);}
            100% { transform: scale(1);}
          }
          .animate-dot-pop {
            animation: dotPop 0.3s;
          }
          @keyframes modalFadein {
            from { opacity: 0;}
            to { opacity: 1;}
          }
          .animate-modal-fadein {
            animation: modalFadein 0.3s;
          }
          @keyframes modalPop {
            0% { transform: scale(0.8);}
            60% { transform: scale(1.05);}
            100% { transform: scale(1);}
          }
          .animate-modal-pop {
            animation: modalPop 0.4s;
          }
        `}</style>
      </div>
    </div>
  );
}