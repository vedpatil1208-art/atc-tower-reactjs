# ATC Tower Simulator

A high-performance frontend-only Air Traffic Control (ATC) Tower Simulator built with ReactJS and Zustand. The application simulates airport tower operations, including aircraft tracking, runway management, flight command processing, conflict detection, telemetry monitoring, and emergency scenario handling, all running entirely in the browser without requiring a backend server.

## Live Demo

**Deployment:** https://atc-tower-reactjs.vercel.app/

## Project Overview

The ATC Tower Simulator replicates the workflow of an airport control tower by allowing users to monitor aircraft movement on a radar display, issue commands through a controller console, manage runway operations, and maintain safe aircraft separation.

The simulation operates entirely in-memory using a custom flight kinematics engine and real-time update loop powered by `requestAnimationFrame`. Aircraft positions, telemetry data, runway occupancy states, and controller commands are processed directly within the browser for a responsive and low-latency experience.

## Features

### Terminal Radar Display

* Real-time aircraft tracking
* Radar sweep visualization
* Runway occupancy monitoring
* Flight vector display
* Aircraft telemetry labels
* Active track counter

### Air Traffic Control Console

* Command-based controller interface
* Flight progress strips
* Aircraft status management
* Runway clearance commands
* Heading and altitude assignment
* Speed control commands

### Flight Kinematics Engine

* Real-time aircraft movement simulation
* Heading-based navigation
* Altitude tracking
* Speed calculations
* Continuous position updates
* Smooth radar animation

### Conflict Detection System

* Aircraft separation monitoring
* Conflict alert generation
* Visual warning indicators
* Airspace safety validation

### Telemetry Dashboard

* Total handled traffic metrics
* Airspace density index
* Average runway occupancy time
* Parser execution latency
* Active track monitoring
* Conflict tracking

### Data Management

* LocalStorage persistence
* Session restoration
* Airport configuration saving
* JSON session export
* CSV operational report export

### Emergency Operations

* Emergency aircraft injection
* Priority traffic handling
* Emergency status indicators

## Tech Stack

### Frontend

* React.js
* JavaScript (ES6+)
* CSS3

### State Management

* Zustand

### Build Tools

* Create React App
* React Scripts

### Deployment

* Vercel

## Project Structure

```text
src/
│
├── components/
│   ├── RadarCanvasStage/
│   │   ├── RadarCanvasStage.js
│   │   ├── AircraftSpriteBlip.js
│   │   ├── RunwayNodeElement.js
│   │   └── RadarCanvasStage.css
│   │
│   ├── TowerControlConsole/
│   │   ├── TowerControlConsole.js
│   │   ├── CommandInputStrip.js
│   │   ├── FlightProgressStripStack.js
│   │   ├── FlightStrip.js
│   │   └── TowerControlConsole.css
│   │
│   └── TowerTelemetryHUD/
│       ├── TowerTelemetryHUD.js
│       └── TowerTelemetryHUD.css
│
├── data/
├── engine/
│   ├── kinematics.js
│   ├── separation.js
│   └── commandParser.js
│
├── services/
├── store/
│   └── atcStore.js
│
└── utils/
    └── exportUtils.js
```

## Simulation Architecture

### Aircraft Kinematics

Aircraft movement is calculated using vector-based navigation equations:

ΔX = Speed × cos(θ) × Δt

ΔY = Speed × sin(θ) × Δt

ΔAltitude = Descent Rate × Δt

This enables realistic aircraft movement and approach tracking on the radar display.

### Separation Monitoring

The simulator continuously evaluates aircraft proximity and generates conflict alerts when aircraft violate minimum separation requirements.

### Command Processing

Controller commands are parsed through a custom command parser that validates instructions and updates aircraft states in real time.

Example Commands:

```text
AA104 clear land RWY-09L
DL442 fly heading 180
UA210 clear takeoff RWY-09L
BA256 climb and maintain 11000
JB1822 set speed 280
```

## Installation

### Clone Repository

```bash
git clone https://github.com/vedpatil1208-art/atc-tower-reactjs.git
```

### Navigate to Project

```bash
cd atc-tower-reactjs
```

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm start
```

The application will be available at:

```text
http://localhost:3000
```

## Build for Production

```bash
npm run build
```

## Screenshots

### Main Radar Interface

Add screenshot here:

```text
docs/radar-dashboard.png
```

### Tower Control Console

Add screenshot here:

```text
docs/control-console.png
```

### Telemetry Dashboard

Add screenshot here:

```text
docs/telemetry-panel.png
```

## Future Enhancements

* Multiple airport layouts
* Weather simulation
* Voice command support
* Aircraft performance profiles
* Advanced approach procedures
* Multiplayer controller mode
* Real-world flight data integration

## Author

Ved Patil

## License

This project was developed for educational and academic purposes as part of a ReactJS case study project.
