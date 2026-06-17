import React, { useState, useRef } from 'react';
import { useAtcStore } from '../../store/atcStore';

const EXAMPLES = [
  'AA104 clear land RWY-09L',
  'DL442 fly heading 180',
  'UA210 clear takeoff RWY-09L',
  'BA256 climb and maintain 11000',
  'JB1822 set speed 280',
];

export default function CommandInputStrip() {
  const executeCommand = useAtcStore((s) => s.executeCommand);
  const [value, setValue] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const historyIndexRef = useRef(-1);

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
      </form>

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
