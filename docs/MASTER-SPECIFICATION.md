# REP RIVALS — MASTER ENGINEERING AND DEVELOPMENT SPECIFICATION

## ROLE AND OPERATING INSTRUCTIONS

You are GPT-6 Astra operating as the principal software architect, senior full-stack developer, computer vision engineer, multiplayer networking engineer, 3D web developer, UI integration engineer, database engineer, security reviewer, and quality assurance engineer.

Your mission is to develop a complete, functional, professionally designed web application called **REP RIVALS**.

This is an actual university CAT-2 mini-project being developed by a team of three computer science students.

**CRITICAL: There is only ONE DAY available for implementation.**

We are using AI-assisted development to accelerate implementation, but the deliverable must contain real functionality—not an attractive interface backed by fake interactions.

You are authorized to inspect the repository, create files, install appropriate dependencies, implement features, run commands, write tests, debug errors, and integrate modules within the available development environment.

Work autonomously through implementation phases. Do not repeatedly ask for permission between ordinary development steps.

Do not overwrite existing Figma Make code or other meaningful project work without inspecting it first.

If credentials or required external assets are unavailable, implement everything possible, isolate the dependency, explain the blocker, and continue with other work.

Never fabricate successful tests, deployment status, real computer vision results, or connected database functionality.

---

# SECTION 1 — COMPLETE PROJECT CONTEXT

## 1.1 Project name

**REP RIVALS**

### Tagline

REAL REPS. REAL RIVALS. REAL POWER.

### Product concept

REP RIVALS is a gamified, camera-powered workout competition platform.

It combines:

1. Real-world physical exercise.
2. Browser-based computer vision.
3. Automated repetition counting.
4. Limited movement-quality feedback.
5. Real-time multiplayer workout competitions.
6. Interactive 3D fitness avatars.
7. RPG-inspired rank progression.
8. Experience points and collectible crystals.
9. Personal achievements and fitness challenges.
10. Persistent player profiles and match histories.

The fundamental experience is:

**The user's body performs the workout, computer vision recognizes the movement, and the game rewards the resulting physical activity.**

This is not a conventional fitness tracking application.

The major innovation is converting real physical exercise into competitive, computer-vision-controlled gameplay.

## 1.2 Target experience

A user should be able to:

1. Visit the REP RIVALS website.
2. Create an account.
3. Select a 3D athlete avatar.
4. Receive the starting Rookie rank.
5. Enter the dashboard.
6. Start a solo push-up challenge or create a multiplayer match.
7. Grant camera permission.
8. Calibrate their camera position.
9. Perform real push-ups.
10. Have the system count accepted repetitions automatically.
11. Watch their 3D avatar react to successful repetitions.
12. Compete against another real player in a private live match.
13. View the final result.
14. Receive XP and crystal rewards.
15. Observe rank progression.
16. Return later and see their saved progress.

All essential data must persist correctly.

---

# SECTION 2 — LOCKED TECHNOLOGY STACK

Use the following technologies unless the existing Figma Make export requires a narrowly justified compatibility adjustment.

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Lucide icons
- Reusable React components

### 3D rendering
- Three.js
- React Three Fiber
- Drei
- GLTF/GLB assets where legally available
- AnimationMixer or Drei animation helpers for character animation

### Computer vision
- MediaPipe Tasks Vision
- Pose Landmarker
- Browser camera using getUserMedia()
- TypeScript-based repetition-counting state machine

### Backend
- Node.js
- TypeScript
- Express.js
- Socket.IO
- REST APIs for persistent data
- WebSocket-based real-time match communication

### Database
- **Neon PostgreSQL ONLY**
- Prisma ORM, using a version-compatible Neon configuration
- Database migrations
- Database transactions for match results and reward updates

DO NOT introduce Supabase, Firebase, or MongoDB.

### Authentication
- Secure email/password registration and login
- Strong password hashing using Argon2id or an established equivalent
- Server-validated sessions
- Secure HttpOnly cookies where practical
- Authentication and authorization for REST and socket operations

### Testing
- Unit testing using Vitest or a suitable equivalent
- Integration testing for APIs and Socket.IO
- Browser-based verification
- Real-device computer vision testing

### Deployment
- Frontend on a compatible static hosting platform such as Vercel
- Backend on a persistent WebSocket-compatible Node.js hosting platform
- Neon as the remote PostgreSQL database

Do not deploy the Socket.IO match server as an ordinary short-lived serverless function.

Keep dependencies minimal. Use versions that are mutually compatible and verified against installed packages.

---

# SECTION 3 — FIGMA MAKE DESIGN INTEGRATION

The UI is being designed separately using Figma Make.

This design is a major project asset.

## Important instructions

Before generating replacement frontend code:

1. Inspect the existing repository.
2. Identify whether Figma Make-generated source code is present.
3. Examine its framework and component structure.
4. Identify existing pages, reusable components, styles, assets, and animations.
5. Preserve the design language.
6. Integrate functional logic into the supplied UI.
7. Avoid replacing polished components with generic templates.

If the Figma Make export has not yet been provided, create a modular frontend structure ready to receive those components.

Do not block backend, CV, or multiplayer development while waiting for the design.

## Locked visual direction

REP RIVALS uses a premium, industrial, heavy-workout gym aesthetic.

Visual identity:

- Near-black backgrounds.
- Gunmetal panels.
- Charcoal surfaces.
- Metallic textures.
- Ember-orange highlights.
- Bold condensed athletic typography.
- Cinematic gym lighting.
- High-quality 3D athletes.
- Strong competitive arena presentation.

Avoid:

- Childish cartoon avatars.
- Generic SaaS dashboards.
- Excessive purple neon.
- Emoji-heavy UI.
- Unnecessary glassmorphism.
- Oversized rounded cards.
- Unprofessional animations.

The application should resemble a serious, premium athletic competition platform.

Keep desktop and mobile layouts responsive.

---

# SECTION 4 — COMPLETE SCREEN INVENTORY

Implement these screens and their navigation.

## 4.1 Landing page

Features:

- REP RIVALS branding.
- Cinematic 3D athlete section.
- Bold headline.
- Introduction to camera-powered training.
- Explanation of live battles.
- Rank and rewards preview.
- Enter Arena call-to-action.
- Login and registration access.

Suggested hero headline:

"YOUR BODY IS THE CONTROLLER."

## 4.2 Authentication

Screens:

- Login.
- Register.
- Logout.
- Authenticated-route protection.

Registration fields:

- Username.
- Email.
- Password.
- Confirm password.

Validate inputs and prevent duplicate usernames or emails.

## 4.3 Player onboarding

After registration:

- Select an avatar.
- Choose fitness experience level.
- Choose initial workout interests.
- Save profile.
- Start at Rookie rank with zero XP and zero crystals.

## 4.4 Dashboard

Display:

- Username.
- Interactive 3D avatar.
- Current rank.
- Rank emblem.
- XP progress.
- Crystal balance.
- Total completed workouts.
- Total battles.
- Wins and losses.
- Recent battles.
- Solo Training button.
- Enter Arena button.
- Daily Challenge section.
- Achievements preview.

Statistics must use stored information, not arbitrary static numbers.

For empty accounts, show an appropriate first-time-user state.

## 4.5 Solo Training

The user selects the currently supported exercise:

**PUSH-UPS**

The interface must display:

- Live camera.
- Optional pose landmarks.
- Repetition count.
- Training timer.
- Camera calibration state.
- Movement status.
- Rep validation feedback.
- Start and end controls.
- Session result.

Completed valid sessions should be stored.

## 4.6 Multiplayer lobby

Users can:

- Create a private room.
- Receive a short invitation code.
- Copy and share the code.
- Join an existing room.
- See opponent username and rank.
- View both 3D avatars.
- Choose match duration.
- Complete camera calibration.
- Mark themselves ready.
- Begin after both players are ready.

## 4.7 Live battle screen

This is the most important interface.

Display:

- Player A 3D avatar.
- Player B 3D avatar.
- Usernames.
- Rank badges.
- Accepted rep counts.
- Shared battle timer.
- Score comparison.
- Lead indicator.
- Local camera preview.
- Camera tracking status.
- Rep-counting feedback.
- Current match state.

Both avatars should react visually to accepted repetitions.

The opponent's camera must not be shown or transmitted.

## 4.8 Battle results

Display:

- Victory, defeat, draw, or invalid/incomplete result.
- Final scores.
- Opponent information.
- Match duration.
- XP gained.
- Crystals gained.
- Rank progression.
- Rematch button.
- Return to dashboard.

Persist finalized results.

## 4.9 Rank and rewards

Display:

- All ranks.
- Current XP.
- XP needed for next rank.
- Crystal wallet.
- Achievements.
- Unlockable cosmetic rewards.

## 4.10 Exercise library

Categories:

- Calisthenics.
- Strength training.
- Upper body.
- Lower body.
- Core.

Include planned exercises:

- Push-ups.
- Squats.
- Pull-ups.
- Planks.
- Dumbbell curls.
- Shoulder presses.
- Deadlifts.

**Important: Only push-ups have actual computer vision functionality in this initial release.**

Other exercises may appear as clearly labeled future or coming-soon content.

Do not build incomplete counters for other exercises.

---

# SECTION 5 — 3D AVATAR SYSTEM

## 5.1 Required technology and behavior

Use actual WebGL-rendered 3D characters.

Do not replace them with flat 2D images.

Use React Three Fiber and Three.js.

The 3D athlete should appear in:

- Player profile.
- Dashboard.
- Avatar selection.
- Multiplayer lobby.
- Live battle.
- Result screen.

## 5.2 Animation states

Required:

1. IDLE
2. PREPARING
3. PUSH_UP
4. VICTORY
5. DEFEAT

### Idle

A subtle athletic idle motion.

### Preparing

A transition into a push-up-ready pose, where supported by the model rig.

### Push-up

A controlled push-up animation.

Trigger it when an accepted rep is registered.

The animation must not determine the actual score. Computer vision determines local rep events, and the server determines official scores.

### Victory

A professional athletic celebration.

### Defeat

A restrained and respectful reaction.

## 5.3 Asset handling

First inspect the Figma Make export for usable 3D models or animations.

Prefer suitable rigged GLB/GLTF assets with verified usage rights.

If no external athlete model is available, create a simplified but genuinely three-dimensional procedural athlete using Three.js meshes and articulated body parts.

Such a fallback must remain recognizably 3D, be animated, and fit the industrial athletic style.

Do not substitute a static picture and claim 3D functionality.

Do not attempt complicated real-time motion retargeting from MediaPipe landmarks during this release.

The initial connection is:

CV detects a completed push-up → server accepts the rep → avatar performs a corresponding animation.

## 5.4 Performance requirements

- Lazy-load expensive 3D scenes.
- Reuse models and materials.
- Handle scene cleanup.
- Avoid unnecessary render loops.
- Limit visual effects on mobile devices.
- Provide reduced-motion support.
- Keep camera tracking smooth even when 3D rendering is active.

Computer vision accuracy and responsiveness take priority over visual effects.

---

# SECTION 6 — COMPUTER VISION: DETAILED ENGINEERING SPECIFICATION

THIS SECTION IS CRITICAL.

Computer vision is the central technical innovation of REP RIVALS.

The initial release must support real webcam-based push-up repetition counting.

Do not implement a fake counter.

Do not increase the counter through random values, hardcoded intervals, or purely simulated movement during real workout mode.

## 6.1 Core approach

Use MediaPipe Pose Landmarker in browser VIDEO mode.

Processing pipeline:

Camera stream
→ video frame
→ pose landmark inference
→ landmark quality validation
→ geometric feature calculation
→ temporal smoothing
→ push-up movement state machine
→ repetition acceptance
→ local UI update
→ multiplayer rep event
→ server validation
→ synchronized score update.

## 6.2 Camera initialization

Use navigator.mediaDevices.getUserMedia().

Requirements:

- Request permission explicitly.
- Display useful errors if denied.
- Show instructions if no camera exists.
- Request a reasonable video resolution, such as 640×480 initially.
- Start tracking only after successful stream initialization.
- Stop tracks when leaving the workout.
- Dispose of MediaPipe resources and animation loops.
- Do not capture or upload video unless explicitly authorized by a later feature.

Camera access generally requires HTTPS or an allowed local secure context.

## 6.3 Pose landmark detection

Use the MediaPipe Pose Landmarker web API.

Configure:

- runningMode: VIDEO
- numPoses: 1
- sensible detection confidence
- sensible presence confidence
- sensible tracking confidence

Start with approximately 0.5 confidence where supported and tune experimentally.

Use the documented API signature of the installed version rather than assuming an outdated example.

Relevant landmarks:

LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12

LEFT_ELBOW = 13
RIGHT_ELBOW = 14

LEFT_WRIST = 15
RIGHT_WRIST = 16

LEFT_HIP = 23
RIGHT_HIP = 24

LEFT_KNEE = 25
RIGHT_KNEE = 26

LEFT_ANKLE = 27
RIGHT_ANKLE = 28

Use the shoulders, elbows, and wrists for elbow flexion.

Use shoulder, hip, knee, and ankle alignment as supporting posture and calibration signals.

Do not imply that these landmarks alone establish clinically correct exercise technique.

## 6.4 Recommended camera positioning

For the MVP, optimize for a side-view or slightly diagonal side-view camera.

Explain positioning to the user.

Instructions:

- Place the camera on a stable surface.
- Keep the entire body visible.
- Ensure the shoulder, elbow, wrist, hip, and lower-body reference points can be detected.
- Provide sufficient lighting.
- Avoid severe occlusion.
- Avoid extreme camera angles.
- Keep the camera stationary.

Perform calibration before starting.

Display:

"Move back until your full body is visible."

"Turn sideways for improved push-up tracking."

"Hold your starting position."

"Camera ready."

If relevant landmarks have insufficient quality, disable counting and show guidance.

Do not pretend calibration succeeded merely because a video stream exists.

## 6.5 Coordinate handling

MediaPipe returns normalized image landmarks and may also return world landmarks.

For image-space angle calculations, first account for image aspect ratio.

Convert normalized coordinates to pixel-equivalent coordinates:

xPixel = landmark.x × videoWidth

yPixel = landmark.y × videoHeight

Do not measure angles directly from uncorrected normalized x/y values when video dimensions differ.

Use a reusable joint-angle function.

For points A, B, C:

- A = shoulder
- B = elbow
- C = wrist

Compute vectors:

BA = A - B

BC = C - B

Angle = arccos(dot(BA, BC) / (|BA| × |BC|))

Convert radians to degrees.

Clamp the cosine argument to [-1, 1] to avoid floating-point errors.

Handle degenerate vectors.

Use a consistent coordinate system for every landmark.

## 6.6 Selecting the tracking side

The athlete may face either direction.

Support both left-facing and right-facing body orientations.

Evaluate the visibility and tracking quality of the left and right:

- Shoulder
- Elbow
- Wrist
- Hip
- Knee/ankle when available

Select the better-observed side during calibration.

Avoid switching sides every frame.

Use a stable side selection unless sustained tracking loss requires recalibration.

If both sides are visible with acceptable confidence, optionally use their combined information.

If neither side is reliable, pause classification.

## 6.7 Push-up movement classification

Use a state machine, not a single-frame threshold.

Suggested states:

- NOT_READY
- TOP_CONFIRMED
- DESCENDING
- BOTTOM_CONFIRMED
- ASCENDING
- REP_COMPLETED
- TRACKING_LOST

The essential movement is:

TOP → BOTTOM → TOP.

A rep counts only after a complete accepted sequence.

### Candidate initial angle thresholds

These values are starting points for testing, NOT universally validated biomechanics standards.

TOP / EXTENDED:

Elbow angle approximately greater than 155°.

BOTTOM / FLEXED:

Elbow angle approximately less than 95–105°.

Tune thresholds using real camera tests.

Use hysteresis so movements near a threshold do not cause rapid state transitions.

### State transitions

1. Detect a stable extended-arm starting position.
2. Confirm the user is positioned for a push-up.
3. Observe sustained elbow flexion.
4. Reach and stabilize in the bottom-state range.
5. Observe sustained elbow extension.
6. Return to the extended-arm range.
7. Verify overall tracking and movement quality.
8. Increment the repetition count exactly once.
9. Return to TOP_CONFIRMED.

If the user moves only halfway down, do not count a rep.

If the user repeatedly oscillates near one threshold, do not count multiple reps.

If the initial position was never established, do not count.

If the required landmarks disappear, suspend or invalidate the incomplete sequence.

## 6.8 Temporal smoothing

Raw landmark coordinates can fluctuate.

Implement suitable smoothing, such as:

- Exponential moving average for joint angles, or
- A short rolling median.

Avoid excessive smoothing that makes rep counting noticeably delayed.

Use consecutive-frame or time-based confirmation of each posture state.

An example initial approach:

- Require a state condition to hold for roughly 100–200 ms.
- Require a complete top-bottom-top cycle.
- Apply a short post-rep cooldown, perhaps around 250 ms.
- Reject physiologically implausibly rapid cycles.

These values must be configurable and tested, not assumed to be accurate.

Prefer elapsed-time conditions over relying exclusively on a fixed frame count.

## 6.9 Validity checks

The system should consider:

- Landmark visibility.
- Selected tracking-side confidence.
- Arm movement.
- Basic body alignment.
- Stable camera framing.
- Movement duration.
- Complete range-of-motion proxy.
- Continuous movement sequence.

Basic posture indicators may detect obvious torso misalignment, but do not call the result definitive biomechanical form assessment.

Use a torso-alignment heuristic based on available shoulder, hip, and lower-body landmarks.

Make thresholds configurable and conservative.

The application should identify only observable issues with reasonable confidence.

## 6.10 Feedback states

Provide short messages:

- "Ready."
- "Lower your body."
- "Push up."
- "Rep accepted."
- "Incomplete repetition."
- "Keep your full body visible."
- "Tracking lost."
- "Adjust camera position."
- "Unable to verify form."

Do not produce medical diagnoses.

Do not claim the user's form is safe merely because the rep was counted.

If severe pain is reported, provide an option to stop immediately rather than encouraging continued repetitions.

## 6.11 Counter integrity

A single valid completed cycle increments the counter once.

Maintain:

- sessionId
- exerciseType
- totalAcceptedReps
- currentMovementState
- landmarkQuality
- selectedTrackingSide
- lastAcceptedRepTime
- sequenceNumber
- calibrationStatus

No duplicate rep counting.

If tracking disappears temporarily:

- Keep the previous accepted count.
- Do not invent additional repetitions.
- Mark the incomplete motion as uncertain or invalid.
- Resume only after tracking is restored.

## 6.12 Frame processing

Use requestAnimationFrame or another appropriate video processing mechanism.

Do not run multiple duplicate inference loops.

Avoid processing the same video frame repeatedly.

Control inference frequency to balance performance and responsiveness.

MediaPipe's browser video inference can be synchronous. Profile its effect on UI responsiveness and move inference into a compatible worker architecture if appropriate and feasible.

Do not introduce a worker implementation that breaks video inference merely for theoretical optimization.

## 6.13 Camera UI

Display the camera preview with:

- Optional landmark overlay.
- Visual tracking quality indicator.
- Current rep count.
- Current exercise state.
- Calibration instructions.
- Timer.

Mirror the display only when appropriate for user experience; ensure the algorithm receives a consistent coordinate system.

## 6.14 Required computer vision tests

Test:

1. No person visible.
2. Partial body visible.
3. Correct camera calibration.
4. One complete push-up.
5. Repeated full push-ups.
6. Half push-up.
7. Holding at the top position.
8. Holding at the bottom position.
9. Minor body movement without a push-up.
10. Tracking temporarily lost.
11. Poor lighting.
12. Camera permission denied.
13. Rapid movement.
14. Different body orientations.
15. Two different physical users.

Provide unit tests using synthetic sequences of angles and tracking-quality observations.

Separate algorithm tests from webcam hardware tests.

For practical evaluation, record:

- Manually observed reps.
- Automatically accepted reps.
- Missed reps.
- False-positive reps.
- Calibration success.
- Conditions of the test.

Never report unperformed physical tests as successful.

---

# SECTION 7 — MULTIPLAYER BATTLE ENGINE

## 7.1 Technology

Use Socket.IO with Node.js.

Use server-side match rooms.

Do not transmit full video streams between players.

Each player performs local pose detection.

Only essential scoring and game-state events travel over the network.

## 7.2 Room creation

Player A creates a private room.

Server:

1. Authenticates the player.
2. Generates a unique unpredictable room code.
3. Creates room metadata.
4. Sets the room to WAITING.
5. Associates Player A with the room.
6. Returns the invitation code.

## 7.3 Room joining

Player B enters the code.

Server validates:

- Room exists.
- Room is not full.
- Room is not completed.
- Player is authenticated.
- Player is not duplicating a slot.
- Match is joinable.

Only two player slots are allowed.

## 7.4 Battle states

Use a formal state machine:

WAITING
→ CALIBRATING
→ READY
→ COUNTDOWN
→ ACTIVE
→ FINALIZING
→ COMPLETED.

Support CANCELLED and INTERRUPTED states where necessary.

Only allow valid state transitions.

Never allow a completed room to restart by accidentally changing its status.

A rematch should create a fresh match identity.

## 7.5 Match configuration

Initial supported exercise:

PUSH-UPS.

Durations:

- 30 seconds: Quick Clash
- 60 seconds: Standard Duel
- 90 seconds: Endurance Match

Default:

60 seconds.

Countdown:

5 seconds.

Winner:

The player with the higher server-accepted repetition count.

Equal valid scores result in a draw.

An interrupted or invalid match must not be silently treated as a normal victory.

## 7.6 Pre-battle readiness

Both players must:

- Be connected.
- Have camera access.
- Complete calibration.
- Report ready status.

Once both are ready, the server chooses a future start timestamp and broadcasts it.

Both clients display a countdown against that shared start time.

Do not rely on starting separate client-side timers when each user receives an event.

## 7.7 Authoritative timer

The server determines:

- startAt
- endAt
- current match status

Clients derive the displayed remaining time from the server schedule, using clock-offset estimation if necessary.

The server decides when the match ends.

A user modifying their local timer must not extend the match.

## 7.8 Rep-event process

When computer vision recognizes a complete repetition:

1. Local detector emits a candidate rep event.
2. Client sends the candidate event with a unique sequence number.
3. Server authenticates the socket.
4. Server verifies match membership.
5. Server checks that the match is ACTIVE.
6. Server checks that the event was received within the allowed server-defined match window.
7. Server rejects duplicates.
8. Server applies bounded timing and plausibility checks.
9. Server increments the accepted score if valid.
10. Server broadcasts the updated authoritative match state.
11. Both clients update their scoreboard.
12. The corresponding 3D avatar plays an exercise animation.

The sender does NOT provide a replacement total score.

The server must never accept a payload such as "my score is now 100" as authoritative.

## 7.9 Example rep event

Use a typed structure conceptually similar to:

{
  "matchId": "uuid",
  "sequenceNumber": 12,
  "exercise": "PUSH_UP",
  "clientDetectedAt": "ISO timestamp",
  "trackingQuality": 0.91,
  "detectorVersion": "pushup-v1"
}

The user ID must be derived from the authenticated connection, not blindly trusted from the event body.

The server must not treat client-provided quality metrics or timestamps as cryptographic proof of physical movement.

Official scoring is based on bounded, accepted events from authenticated participants. This is prototype validation, not cheating-proof physical verification.

## 7.10 Socket.IO event contracts

Define typed request, acknowledgement, and broadcast payloads for:

Client → Server:

- room:create
- room:join
- room:leave
- player:ready
- player:unready
- rep:detected
- battle:state-request
- battle:rematch-request

Server → Client:

- room:created
- room:joined
- room:updated
- room:error
- battle:countdown
- battle:started
- battle:state
- rep:accepted
- rep:rejected
- player:disconnected
- player:reconnected
- battle:finished
- rewards:granted

Use event acknowledgements for important requests.

Define a consistent error envelope.

Avoid registering duplicate socket listeners on React re-renders.

## 7.11 Disconnect handling

If a player disconnects:

- Preserve the match's official timestamps.
- Inform the opponent.
- Allow a short bounded reconnect grace period when practical.
- Authenticate the reconnecting player.
- Restore their current match state.
- Do not replay already-accepted rep events.
- Do not extend the match timer.

If the match cannot fairly complete, mark it interrupted according to clear rules.

## 7.12 Anti-abuse rules

At minimum:

- Authenticated sockets.
- Room membership validation.
- One active participant slot per user per match.
- Unique rep sequence numbers.
- Rate limits.
- Plausible timing checks.
- Duplicate event prevention.
- No scoring before start.
- No scoring after end.
- No unauthenticated reward claims.
- No client-authoritative winner declarations.

Client-side CV is not resistant to a maliciously modified browser.

Do not advertise this initial implementation as cheating-proof.

---

# SECTION 8 — XP, CRYSTALS, RANKS, AND REWARDS

## 8.1 Rank hierarchy

Use:

ROOKIE — 0 XP

CHALLENGER — 500 XP

WARRIOR — 1,500 XP

ELITE — 3,500 XP

TITAN — 7,000 XP

LEGEND — 12,000 XP

Rank is derived from cumulative XP.

A user must not be able to edit their own XP through client requests.

## 8.2 Currency

Use two separate progression mechanisms.

### XP

Permanent player progression.

Determines rank.

### Crystals

Collectible in-game reward currency.

Can be spent on cosmetic rewards.

Purchasing cosmetics must not reduce earned XP or competitive rank.

## 8.3 Reward rules

Initial values:

Solo challenge completed:

+30 XP
+5 crystals

1v1 winner:

+100 XP
+25 crystals

1v1 non-winning finisher:

+40 XP
+10 crystals

Completed daily quest:

+50 XP
+10 crystals

Abandoned or invalid attempt:

0 rewards.

For a draw, use the non-winning finisher reward for both unless the final game design explicitly specifies another rule.

These are initial game-balance values and should be configurable.

## 8.4 Important safety and fairness controls

Do not reward excessively rapid or suspiciously repeated automated match submissions.

Set appropriate reward limits.

Do not encourage users to exercise through pain or severe fatigue.

Make training stoppable at any time.

## 8.5 Reward transactions

When a match ends:

1. Finalize the result on the server.
2. Determine rewards.
3. Begin a database transaction.
4. Ensure this match has not already awarded the player.
5. Insert reward transaction records.
6. Update XP and crystal balances.
7. Commit.
8. Broadcast the confirmed rewards.

If the transaction fails, do not display rewards as successfully granted.

A refreshed results page must not trigger duplicate awards.

## 8.6 Cosmetic store

Support the existing concept of:

- Avatar appearances.
- Profile borders.
- Victory effects.
- Rank-themed cosmetics.

A minimal functional cosmetic unlock is sufficient for the first release.

More elaborate cosmetic collections may be shown as future unlocks.

Never create pay-to-win advantages.

---

# SECTION 9 — DATABASE DESIGN: NEON POSTGRESQL

Use Neon as the sole database.

Create a typed, normalized schema.

Required core entities:

## users

- id
- username
- email
- passwordHash
- createdAt
- updatedAt

Store normalized unique usernames/emails as appropriate.

Never store plaintext passwords.

## player_profiles

- userId
- avatarId
- experienceLevel
- preferredWorkoutType
- totalXp
- crystalBalance
- createdAt
- updatedAt

Rank can be calculated from totalXp.

## avatar_catalog

- id
- name
- modelPath
- enabled
- cosmeticMetadata

## exercises

- id
- name
- category
- equipment
- difficulty
- cvSupported
- active

Only PUSH_UP has cvSupported=true initially.

## solo_sessions

- id
- userId
- exerciseId
- startedAt
- endedAt
- acceptedReps
- status
- rewardGranted

## matches

- id
- roomCode
- exerciseId
- durationSeconds
- status
- createdAt
- startAt
- endAt
- winnerUserId
- finalizedAt

## match_participants

- id
- matchId
- userId
- acceptedReps
- readyStatus
- result
- rewardStatus
- joinedAt

Enforce uniqueness for matchId + userId.

## rep_events

- id
- matchId
- userId
- sequenceNumber
- serverAcceptedAt
- detectorVersion
- status

Enforce uniqueness for matchId + userId + sequenceNumber.

Avoid persisting unnecessary per-frame pose data.

## reward_transactions

- id
- userId
- sourceType
- sourceId
- xpDelta
- crystalDelta
- createdAt

Enforce an idempotency rule so one reward-bearing source cannot award the same user repeatedly.

## daily_challenges

- id
- title
- description
- exerciseId
- target
- xpReward
- crystalReward
- active

## challenge_completions

- id
- userId
- challengeId
- completedAt
- rewardTransactionId

Ensure challenge rewards are not duplicated.

## cosmetic_unlocks

- id
- userId
- cosmeticId
- unlockedAt

Add appropriate indexes and foreign keys.

Use migrations, not manual undocumented changes.

### Neon connection requirements

Use environment variables:

DATABASE_URL

DIRECT_URL or the version-appropriate migration URL.

Use a compatible pooled Neon connection for application runtime where appropriate.

Use the correct direct connection configuration for schema migrations.

Do not expose the database URL to the browser.

Do not commit credentials.

---

# SECTION 10 — REST API DESIGN

Implement organized and validated API endpoints.

Suggested endpoints:

Authentication:

POST /api/auth/register

POST /api/auth/login

POST /api/auth/logout

GET /api/auth/me

Player:

GET /api/profile

PATCH /api/profile

GET /api/profile/stats

GET /api/ranks

GET /api/rewards

GET /api/avatars

Exercises:

GET /api/exercises

GET /api/exercises/:id

Solo sessions:

POST /api/solo/start

POST /api/solo/finish

GET /api/solo/history

Matches:

GET /api/matches

GET /api/matches/:id

GET /api/matches/:id/results

Daily challenges:

GET /api/challenges/daily

GET /api/challenges/progress

Use Socket.IO for live match operations rather than duplicating live scoring across unrelated HTTP endpoints.

Use request validation with Zod or equivalent.

Provide consistent response shapes, errors, and authentication handling.

---

# SECTION 11 — FRONTEND APPLICATION ARCHITECTURE

Use reusable features rather than one monolithic React component.

Suggested organization:

src/
  app/
  components/
  features/
    auth/
    onboarding/
    dashboard/
    avatars/
    computer-vision/
    solo-training/
    battle/
    rankings/
    rewards/
    exercises/
  hooks/
  lib/
  services/
  types/
  styles/

Separate:

- Camera acquisition.
- MediaPipe initialization.
- Landmark processing.
- Joint angle calculations.
- Push-up state machine.
- Socket connection.
- Match state synchronization.
- 3D avatar rendering.
- Reward UI.

Do not put camera processing, Socket.IO event handlers, and 3D scene implementation inside one giant battle-page component.

Share event types between frontend and backend where practical.

---

# SECTION 12 — UI AND GAMEPLAY POLISH

Create a professional user experience with these details:

### Landing page
- Cinematic presentation.
- Interactive 3D athlete.
- Bold headings.
- Responsive navigation.

### Dashboard
- 3D avatar.
- XP progression.
- Crystal balance.
- Battle call-to-action.
- Athletic statistics.

### Battle lobby
- Join code.
- Player cards.
- 3D avatar preview.
- Ready indicators.
- Calibration status.

### Live battle
- Two 3D avatars.
- Large score counters.
- Central VS element.
- Shared timer.
- Clear tracking feedback.
- Animated rep confirmations.

### Results
- Distinct victory/defeat/draw states.
- Reward counts.
- Rank progression.
- Rematch.

Include:

- Loading indicators.
- Empty states.
- Error handling.
- Toast messages.
- Connection indicators.
- Responsive layout.
- Keyboard accessibility for controls.
- Reduced-motion accessibility.

Do not allow decorative animations to obstruct exercise tracking.

---

# SECTION 13 — SECURITY AND PRIVACY

Security is mandatory even for a university prototype.

Implement:

1. Password hashing.
2. Authentication checks.
3. User-specific authorization.
4. Input validation.
5. Secure session management.
6. Proper CORS and origin validation.
7. Rate limiting.
8. Room membership verification.
9. Server-side reward calculations.
10. Protection against duplicate transactions.
11. Environment variable handling.
12. Parameterized database queries.
13. No hardcoded credentials.
14. No public raw database access.
15. No unnecessary camera recording.

When using cookies across deployed origins, configure Secure and SameSite behavior correctly, and apply CSRF defenses where applicable.

Socket authentication must not rely on a user ID provided by an untrusted client.

Camera data should remain on the user's device.

Do not upload raw video or pose histories by default.

The opponent should only receive necessary game-state information.

Clearly indicate camera activity.

---

# SECTION 14 — ONE-DAY DEVELOPMENT EXECUTION PLAN

The goal is to produce a complete usable vertical slice before refining secondary features.

Do not spend most of the day generating decorative pages while the core product remains non-functional.

## PHASE 1 — Repository reconnaissance and architecture

Immediately:

1. Inspect all existing files.
2. Identify the Figma Make frontend.
3. Identify working and missing features.
4. Confirm available runtime versions.
5. Establish the directory structure.
6. Create environment templates.
7. Create the database schema.
8. Write a short implementation checklist.

Do not write a lengthy architecture document and then stop.

Continue directly into implementation.

## PHASE 2 — Computer vision prototype

Highest technical priority.

Implement:

- Webcam connection.
- Pose Landmarker initialization.
- Landmark overlay.
- Calibration.
- Push-up state machine.
- Real accepted-rep counter.
- Tracking loss handling.

Test with synthetic landmark/angle sequences.

Expose a standalone browser page for real-camera verification.

Do not proceed as if CV is working merely because the MediaPipe model loads.

## PHASE 3 — Backend and database

Implement:

- Neon connection.
- Database migrations.
- Authentication.
- Player profiles.
- XP and crystals.
- Exercises.
- Match and participant tables.
- Match lifecycle services.

Verify database writes and reads.

## PHASE 4 — Real-time multiplayer

Implement:

- Private room creation.
- Room joining.
- Player ready status.
- Server-authoritative countdown.
- Match start and end.
- Rep event acceptance.
- Score broadcasting.
- Winner calculation.
- Disconnect handling.
- Persistent results.

Test with two independent authenticated browser sessions.

## PHASE 5 — 3D avatars and frontend integration

Integrate:

- Existing Figma Make interface.
- Real 3D avatar rendering.
- Basic avatar selection.
- Idle animation.
- Push-up animation.
- Victory/defeat presentation.
- Live scoreboard.
- Camera preview.

Prioritize working 3D interactions over complex visual effects.

## PHASE 6 — Economy and secondary screens

Implement:

- XP calculations.
- Crystal rewards.
- Rank progression.
- Results history.
- Dashboard stats.
- Basic cosmetic unlock.
- Basic daily challenge flow if the core is stable.

Ensure reward accounting is correct.

## PHASE 7 — Integration and testing

Test:

- New user signup.
- Login persistence.
- Profile creation.
- Avatar selection.
- Solo push-ups.
- Private room creation.
- Opponent joining.
- Both players calibrating.
- Shared countdown.
- Live score updates.
- Match conclusion.
- Winner calculation.
- XP/crystal persistence.
- Rank updates.
- Page refresh.
- Invalid events.
- Duplicate rewards.
- Camera permission denial.
- Network disconnect.
- Mobile responsiveness.

## PHASE 8 — Deployment and documentation

If deployment credentials are available:

- Build frontend.
- Build backend.
- Run migrations.
- Deploy compatible services.
- Configure environment variables.
- Test WebSocket and camera permissions over HTTPS.
- Test actual production flow.

Produce a README with:

- Project overview.
- Tech stack.
- Setup instructions.
- Environment variables.
- Database migration commands.
- Local development commands.
- Test commands.
- Deployment guidance.
- Known limitations.
- CV calibration instructions.

---

# SECTION 15 — PRIORITY AND FAILURE POLICY

Every originally discussed game feature remains part of the product specification.

However, with only one day available, implement in this priority order.

## P0 — Essential, genuinely functional

1. Authentication and saved profiles.
2. Neon database integration.
3. Real camera-based push-up counting.
4. Basic camera calibration.
5. Private two-player rooms.
6. Server-controlled battle timer.
7. Live score synchronization.
8. Match results.
9. XP and crystal rewards.
10. Basic real 3D avatars with working animations.
11. Integration with the supplied Figma design.

## P1 — Complete if P0 is stable

1. Six-rank progression interface.
2. Detailed player dashboard.
3. Match history.
4. Daily quest.
5. Avatar selection enhancements.
6. Cosmetic unlock.
7. Additional visual polish.

## P2 — Explicitly planned for later

1. Squat detection.
2. Pull-up detection.
3. Weight-training CV.
4. Advanced biomechanics.
5. Live skeletal avatar retargeting.
6. Public ranked matchmaking.
7. Tournaments.
8. Full seasonal leaderboards.
9. Complex avatar customizations.
10. Wearable integrations.

These features should not be falsely presented as completed.

Do not spend time implementing P2 while P0 remains broken.

### When a feature fails

Investigate and attempt a focused fix.

Do not silently replace real functionality with fake data.

If real CV is blocked by hardware or environment limitations, retain a separately labeled DEVELOPMENT SIMULATION MODE for testing the rest of the game.

Simulation mode must:

- Be visually labeled.
- Never be mistaken for actual camera tracking.
- Never grant official rewards.
- Never silently participate in real scored matches.

In production, official matches require the configured CV-based pipeline.

---

# SECTION 16 — REQUIRED AUTOMATED TESTS

## Computer vision state machine

Test:

- TOP → BOTTOM → TOP = one rep.
- TOP → partial descent → TOP = zero reps.
- TOP → BOTTOM → BOTTOM = zero new reps.
- No valid initial top position = zero reps.
- Landmark loss mid-cycle = no fabricated rep.
- Duplicate frame input = no duplicate rep.
- Angle jitter = no false repetition.
- Repeated complete cycles = correct count.

## Multiplayer

Test:

- Only two players can join.
- Third player is rejected.
- Unauthorized player cannot submit reps.
- Duplicate rep sequence is rejected.
- Reps before start are rejected.
- Reps after end are rejected.
- Opponent sees updated score.
- Both clients see the same final result.
- Reconnect does not reset official scores.
- Rematch does not reuse the completed match identity.

## Rewards

Test:

- Winner receives expected rewards.
- Other valid finisher receives expected rewards.
- Draw follows defined rules.
- Interrupted match follows defined rules.
- XP promotion threshold works.
- Crystal balance persists.
- Repeated result-finalization requests do not award twice.
- Failed transactions do not partially update balances.

## Authentication

Test:

- Unauthenticated endpoint access.
- Invalid credentials.
- Duplicate email.
- Invalid username.
- Unauthorized profile access.
- Unauthorized match access.

---

# SECTION 17 — DEFINITION OF DONE

The project is only considered functionally complete when the following demonstration works:

1. Open the website.
2. Register Player A.
3. Register Player B in another independent browser session.
4. Both users select their 3D avatars.
5. Player A creates a push-up battle.
6. Player B joins using the invitation code.
7. Both users calibrate their cameras.
8. Both users mark ready.
9. A shared countdown starts.
10. Each performs real push-ups.
11. Browser-based CV identifies completed rep cycles.
12. Accepted rep events reach the server.
13. Both screens display synchronized official scores.
14. The 3D avatars visibly respond.
15. The server ends the match at the configured time.
16. The winner or draw is determined.
17. Results are written to Neon PostgreSQL.
18. Rewards are processed exactly once.
19. XP and crystals appear in the dashboard.
20. A refresh preserves profiles, progress, and match history.

Do not claim these criteria pass unless they have been tested.

For hardware-dependent steps, report which tests require physical verification.

---

# SECTION 18 — ENGINEERING QUALITY REQUIREMENTS

Maintain:

- TypeScript types.
- Small reusable functions.
- Clear module boundaries.
- Reliable error handling.
- Clean asynchronous lifecycle management.
- Safe camera cleanup.
- Deterministic match states.
- Server-authoritative rewards.
- Structured event payloads.
- Proper environment configuration.
- Database integrity.
- Useful logs.
- Automated tests.

Do not overengineer.

Do not introduce microservices, Kubernetes, Redis, complex distributed architecture, or external AI APIs unless a demonstrated requirement justifies them.

One Node.js game server and Neon PostgreSQL are sufficient for the initial prototype.

Do not sacrifice correct functionality to create unnecessary abstractions.

---

# SECTION 19 — IMPLEMENTATION REPORTING

After each development phase, report:

1. What was implemented.
2. Which files changed.
3. Which commands were run.
4. Which tests passed.
5. Which tests failed.
6. Which functionality still requires physical verification.
7. Any blockers.

Keep reports concise.

Continue implementation without requesting approval after each normal step.

At completion, provide:

- Final project structure.
- Setup and run commands.
- Database migration commands.
- Environment variable requirements.
- Tests performed and results.
- Deployment status.
- Known limitations.
- Remaining work.
- Exact steps for demonstrating REP RIVALS using two players.

If a required external credential is unavailable, identify the missing variable without inventing its value.

---

# FINAL EXECUTION DIRECTIVE

You are not being asked merely to design a website or prepare a proposal.

**You are being asked to ENGINEER AND IMPLEMENT REP RIVALS.**

The target is a functioning, professionally presented, real-time multiplayer workout game with browser-based computer vision and 3D avatars.

The highest-priority product experience is:

**TWO REAL PLAYERS → PRIVATE BATTLE → CAMERA CALIBRATION → REAL PUSH-UPS → CV REP DETECTION → LIVE SCORE SYNCHRONIZATION → SERVER-DEFINED WINNER → PERSISTENT REWARDS.**

Preserve the supplied Figma Make design.

Use Neon PostgreSQL instead of Supabase.

Use real 3D athletes, not 2D portraits.

Implement push-up recognition first and do not expand to other exercise detectors yet.

Work systematically, test honestly, and prioritize the complete gameplay loop.

Begin by inspecting the repository and existing assets, then execute the implementation plan.

Do not stop after producing an architecture explanation.

Do not claim the game is complete unless its required functionality has been implemented and verified.

## CRITICAL — FIGMA UI REFERENCE AND FUTURE REDESIGN

The existing Figma Make-generated React application is an initial design reference, NOT the final approved UI.

The current visual design does not fully meet the product owner's expectations.

Instructions:

1. Inspect and reuse suitable Figma components, assets, styles, and layouts.
2. Do not treat the current UI as immutable or final.
3. Preserve the established industrial gym aesthetic and dark/ember-orange visual identity.
4. Prioritize functional implementation over pixel-perfect preservation of the current design.
5. Build a modular component-based frontend so the UI can be substantially redesigned later.
6. Keep computer vision, multiplayer logic, authentication, database operations, ranks, and rewards independent of presentation components.
7. Encapsulate 3D avatar rendering behind reusable components and interfaces.
8. Never embed critical game logic directly into decorative UI components.
9. Allow future replacement of pages, visual assets, animation systems, and 3D models without rewriting backend services.
10. Preserve functionality and existing API contracts during future redesigns.

The immediate objective is a complete working REP RIVALS gameplay loop with a functional, professional interface.

Advanced visual refinement and cinematic 3D presentation will follow after core functionality is verified.

The existing Figma Make interface is an initial visual reference, not the final approved design. Preserve useful components, assets, and the industrial gym identity, but keep all application functionality independent of presentation so the UI can be redesigned later.
## EXECUTION STRATEGY — IMPORTANT

The master specification above defines the complete REP RIVALS product scope and is the authoritative reference for development.

The local workspace has already been inspected successfully.

Do not repeat repository reconnaissance unnecessarily.

Use the specification to establish the architecture, API contracts, database models, and shared application types.

Because only one day remains, implement the project incrementally, beginning with the actual MediaPipe push-up counter.

Maintain the full project context throughout development, but focus each implementation phase on a testable vertical slice.

Do not stop after producing a plan.

Begin coding the first phase immediately after identifying any essential integration constraints.

After each phase, report completed functionality, executed tests, failures, and remaining work.

Do not silently omit locked features. If a feature cannot be completed, explicitly record its status and any blockers.

Do not fabricate successful CV tests, multiplayer tests, database connections, or deployment results.

The existing Figma Make frontend is a reference and may be redesigned later. Keep frontend presentation, computer vision, multiplayer state, and database logic modular.

Proceed with Phase 1: implement real browser-based push-up counting, camera calibration, landmark tracking, and automated state-machine tests.
**BUILD REP RIVALS.**