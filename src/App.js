import React, { useEffect, useRef } from 'react';
import { useAtcStore } from './store/atcStore';
import TowerControlConsole from './components/TowerControlConsole/TowerControlConsole';
import RadarCanvasStage from './components/RadarCanvasStage/RadarCanvasStage';
import TowerTelemetryHUD from './components/TowerTelemetryHUD/TowerTelemetryHUD';
import './App.css';

const LIVE_TRAFFIC_POLL_MS = 15000;

function App() {
  const tick = useAtcStore((s) => s.tick);
  const liveTrafficEnabled = useAtcStore((s) => s.liveTrafficEnabled);
  const fetchLiveTraffic = useAtcStore((s) => s.fetchLiveTraffic);
  const airportName = useAtcStore((s) => s.airportName);
  const frameRef = useRef();
  const lastTimeRef = useRef(performance.now());

  // High-velocity spatio-temporal update loop driven by requestAnimationFrame.
  useEffect(() => {
    const loop = (time) => {
      const dtSeconds = Math.min((time - lastTimeRef.current) / 1000, 0.25);
      lastTimeRef.current = time;
      tick(dtSeconds);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [tick]);

  // Poll OpenSky Network for live aircraft state vectors while enabled.
  useEffect(() => {
    if (!liveTrafficEnabled) return undefined;
    fetchLiveTraffic();
    const id = setInterval(fetchLiveTraffic, LIVE_TRAFFIC_POLL_MS);
    return () => clearInterval(id);
  }, [liveTrafficEnabled, fetchLiveTraffic]);

  return (
    <div className="atc-app">
      <header className="atc-header">
        <span className="atc-title">{airportName} - AIR TRAFFIC CONTROL TOWER SIMULATOR</span>
        <span className="atc-clock"><Clock /></span>
      </header>
      <div className="atc-main">
        <div className="atc-left">
          <TowerControlConsole />
        </div>
        <div className="atc-center">
          <RadarCanvasStage />
        </div>
      </div>
      <div className="atc-bottom">
        <TowerTelemetryHUD />
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = React.useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{now.toUTCString().slice(17, 25)} UTC</span>;
}

export default App;
