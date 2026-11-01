import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  Crosshair,
  Play,
  Square,
} from "lucide-react"
import { usePushUpCamera } from "../computer-vision/usePushUpCamera"
import "./training.css"

export default function TrainingPage() {
  const cv = usePushUpCamera()
  const [overlay, setOverlay] = useState(true)
  const [mirror, setMirror] = useState(false)
  const seconds = Math.floor(cv.elapsedMs / 1000)
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
  const ready =
    cv.active && cv.snapshot.calibrated && cv.snapshot.state !== "TRACKING_LOST"
  return (
    <main className="training-page">
      <header className="training-header">
        <Link to="/" className="training-brand" onClick={() => cv.stop()}>
          REP <b>RIVALS</b>
        </Link>
        <Link to="/" className="training-back" onClick={() => cv.stop()}>
          <ArrowLeft size={16} /> Back to home
        </Link>
      </header>
      <div className="training-title">
        <div>
          <p className="kicker">SOLO TRAINING / CAMERA VERIFICATION</p>
          <h1>
            REAL <em>REPS.</em>
          </h1>
          <p>Push-ups. Your movement drives the count.</p>
        </div>
        <span className="training-label">LOCAL SESSION · NO REWARDS</span>
      </div>
      <div className="training-grid">
        <section className="camera-panel" aria-label="Camera and tracking">
          <div className="camera-heading">
            <span>
              <i
                className={
                  cv.active ? "camera-indicator active" : "camera-indicator"
                }
              />
              {cv.status}
            </span>
            <span>VIDEO STAYS ON DEVICE</span>
          </div>
          <div className={`training-video ${mirror ? "mirrored" : ""}`}>
            <video
              ref={cv.videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Local camera preview"
            />
            <canvas ref={cv.canvasRef} aria-hidden="true" />
            {!cv.active && (
              <div className="camera-placeholder">
                <CameraOff size={40} />
                <h2>
                  {cv.finished
                    ? "SESSION COMPLETE"
                    : "YOUR BODY IS THE CONTROLLER"}
                </h2>
                <p>
                  {cv.finished
                    ? "Your local result is below. Start a new camera session to train again."
                    : "Enable your camera, then hold your starting plank position."}
                </p>
              </div>
            )}
          </div>
          <div className="camera-options">
            <label>
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => {
                  setOverlay(e.target.checked)
                  cv.setOverlay(e.target.checked)
                }}
              />{" "}
              Show landmarks
            </label>
            <label>
              <input
                type="checkbox"
                checked={mirror}
                onChange={(e) => setMirror(e.target.checked)}
              />{" "}
              Mirror preview
            </label>
          </div>
          {cv.error && (
            <p className="training-error" role="alert">
              {cv.error}
            </p>
          )}
          <div className="training-feedback" role="status" aria-live="polite">
            <Crosshair size={22} />
            <span>{cv.active ? cv.snapshot.feedback : cv.status}</span>
          </div>
          <div className="training-controls">
            {!cv.active ? (
              <button className="training-primary" onClick={cv.enable}>
                <Camera size={18} />
                {cv.finished ? "New camera session" : "Enable camera"}
              </button>
            ) : (
              <>
                <button
                  className="training-primary"
                  onClick={cv.start}
                  disabled={!ready || cv.running}
                >
                  <Play size={18} />
                  {cv.running ? "Training in progress" : "Start training"}
                </button>
                <button onClick={cv.recalibrate}>
                  <Crosshair size={18} />
                  Recalibrate
                </button>
                <button onClick={() => cv.stop()}>
                  <Square size={18} />
                  {cv.running ? "End session" : "Stop camera"}
                </button>
              </>
            )}
          </div>
        </section>
        <aside className="training-sidebar">
          <section className="training-score" aria-label="Session stats">
            <p className="kicker">
              {cv.finished ? "LOCAL RESULT" : "ACCEPTED REPS"}
            </p>
            <strong data-testid="rep-count">
              {cv.snapshot.totalAcceptedReps}
            </strong>
            <div>
              <span>SESSION TIME</span>
              <b>{timer}</b>
            </div>
            <p>
              {cv.finished
                ? "Not saved. Accounts and persistent workouts will be connected in a later phase."
                : "Only complete, tracked top → bottom → top cycles count."}
            </p>
          </section>
          <section className="training-calibration">
            <h2>
              {ready ? <Check size={18} /> : <Crosshair size={18} />} CAMERA
              CALIBRATION
            </h2>
            <progress
              value={cv.active ? cv.snapshot.calibrationProgress : 0}
              max={1}
              aria-label="Calibration progress"
            />
            <p>
              {ready
                ? "Camera ready."
                : "Place the camera on a stable surface. Move back until your full body is visible."}
            </p>
            <ol>
              <li>Turn sideways or slightly diagonal to the camera.</li>
              <li>
                Keep shoulder, elbow, wrist, hips, knees and ankles visible in
                good lighting.
              </li>
              <li>
                Hold a straight-body plank with extended arms until calibration
                completes.
              </li>
              <li>
                Start training, lower under control, then return to the top.
              </li>
            </ol>
          </section>
          <section className="training-diagnostics">
            <h2>TRACKING STATUS</h2>
            <dl>
              <div>
                <dt>Movement</dt>
                <dd>
                  {cv.active
                    ? cv.snapshot.state.split("_").join(" ")
                    : "STOPPED"}
                </dd>
              </div>
              <div>
                <dt>Tracking side</dt>
                <dd>{cv.snapshot.selectedTrackingSide ?? "Not selected"}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>
                  {cv.active
                    ? `${Math.round(cv.snapshot.landmarkQuality * 100)}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Elbow angle</dt>
                <dd>
                  {cv.active && cv.snapshot.angle !== null
                    ? `${Math.round(cv.snapshot.angle)}°`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Inference</dt>
                <dd>{cv.active ? `${Math.round(cv.inferenceMs)} ms` : "—"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
      <p className="training-note">
        This counter uses visibility and movement heuristics, not a clinical
        form assessment. Camera accuracy still needs physical testing. Stop if
        you feel pain. Leaving or hiding this page stops the camera. Nothing is
        recorded or uploaded.
      </p>
    </main>
  )
}
