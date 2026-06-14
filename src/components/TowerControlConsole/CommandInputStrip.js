import React, { useState, useRef, useEffect } from 'react';
import { useAtcStore } from '../../store/atcStore';

const EXAMPLES = [
  'AA104 clear land RWY-09L',
  'DL442 fly heading 180',
  'UA210 clear takeoff RWY-09L',
  'BA256 climb and maintain 11000',
  'JB1822 set speed 280',
];

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// Interactive text entry bar optimized for quick controller command entry.
// Displays instant validation flags or rejection alerts if an instruction
// violates safety parameters or syntax rules. Also accepts spoken commands
// via the Web Speech API, transcribed straight into the input and executed
// the same way as a typed instruction.
export default function CommandInputStrip() {
  const executeCommand = useAtcStore((s) => s.executeCommand);
  const [value, setValue] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [listening, setListening] = useState(false);
  const historyIndexRef = useRef(-1);
  const recognitionRef = useRef(null);

  const runCommand = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = executeCommand(trimmed);
    setLastResult(result);
    setHistory((h) => [trimmed, ...h].slice(0, 30));
    historyIndexRef.current = -1;
    setValue('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runCommand(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = next;
      if (history[next] !== undefined) setValue(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIndexRef.current - 1, -1);
      historyIndexRef.current = next;
      setValue(next === -1 ? '' : history[next]);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (!SpeechRecognitionImpl) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      runCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="command-input-strip">
      <form onSubmit={handleSubmit}>
        <span className="prompt-caret">TWR&gt;</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. AA104 clear land RWY-09L"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit">SEND</button>
        {SpeechRecognitionImpl && (
          <button
            type="button"
            className={`voice-button ${listening ? 'listening' : ''}`}
            onClick={toggleVoice}
            title="Speak a controller command"
          >
            {listening ? 'LISTENING...' : 'MIC'}
          </button>
        )}
      </form>

      {listening && <div className="voice-status">LISTENING FOR VOICE COMMAND...</div>}
      {!SpeechRecognitionImpl && (
        <div className="voice-unsupported">VOICE COMMANDS NOT SUPPORTED IN THIS BROWSER</div>
      )}

      {lastResult && (
        <div className={`command-feedback ${lastResult.ok ? 'ok' : 'rejected'}`}>
          {lastResult.ok ? 'ACCEPTED: ' : 'REJECTED: '}
          {lastResult.message}
        </div>
      )}

      <div className="command-examples">
        EXAMPLES:
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex} className="example-chip" onClick={() => setValue(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
