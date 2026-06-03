# GO FUCK YOURSELF (GFY) - Multiplayer Architecture

## Overview
This document defines the multiplayer architecture for GFY, detailing how two players connect, synchronize game state, and interact in real-time. The architecture focuses on creating a secure, low-latency, and fair experience that maintains the premium feel while preventing cheating and handling network volatility gracefully.

## Multiplayer Philosophy

### 1. Premium Real-Time Experience
Multiplayer should feel immediate and responsive:
- Actions feel instantaneous with appropriate feedback
- Network latency is compensated to maintain tactile feel
- State synchronization is seamless and invisible to users
- The experience prioritizes local responsiveness over perfect consistency

### 2. Security & Fairness
Preventing cheating and ensuring fair play is paramount:
- Authoritative server validation for critical game actions
- Client-side prediction with server reconciliation
- Information hiding: players only see what they should know
- Secure communication preventing tampering or eavesdropping

### 3. Resilience & Graceful Degradation
Network issues should not ruin the experience:
- Clear connection status communication
- Automatic reconnection with state recovery
- Local fallback modes for extended disconnections
- Graceful handling of varying network quality

### 4. Asymmetry Awareness
Recognizing the inherent asymmetry in turn-based multiplayer:
- Clear visual indication of whose turn it is
- Different interaction models for active vs waiting players
- Preventing information leakage during opponent's turn
- Optimizing for the waiting player's experience

## Network Architecture

### 1. Communication Model
```
Client-Server Architecture:
├── Central Game Server: Authoritative source of truth
├── Peer Clients: iOS devices running GFY
├── Communication: Bidirectional, real-time messaging
├── Protocol: Custom binary protocol over WebSocket Secure (WSS)
└── Fallback: HTTP long-polling for restrictive networks
```

### 2. Connection Flow
```
Initial Connection:
├── Client: Establishes WSS connection to game server
├── Client: Sends authentication token + device fingerprint
├── Server: Validates credentials, creates/exists session
├── Server: Sends session state + opponent info (limited)
├── Client: Applies initial state, begins local simulation
└── Both: Enter connected state with heartbeat monitoring

Authentication:
├── Token Source: Apple GameKit / Custom auth service
├── Includes: User ID, app version, device info
├── Validation: Server-side verification against user DB
├── Refresh: Periodic token renewal to prevent hijacking
├── Device Binding: Optional 2FA for new devices
└── Security: TLS 1.3 encryption, certificate pinning

Session Matching:
├── Lobby System: Optional pre-game matching
├── Direct Play: QR code / invite code exchange
├── Quick Match: Skill-based or random pairing
├── Friend System: Initiate game with contacts
├── Cross-Device: Same Apple ID continuation
└── Privacy: Minimal data exchange during matchmaking
```

### 3. Message Protocol
```
Message Format:
├── Binary: Efficient serialization (Protocol Buffers / FlatBuffers)
├── Header: Message type, sequence number, timestamp
├── Payload: Type-specific data structure
├── Footer: Checksum for integrity verification
├── Compression: Optional for larger payloads
└── Encryption: TLS 1.3 at transport layer

Message Types:
├── GameState: Full or delta state updates
├── PlayerAction: Card requests, draws, plays
├── TurnNotification: Whose turn it is
├── EventNotification: Significant game occurrences
├── ChatMessage: Optional text/emoji communication
├── ConnectionStatus: Ping/pong, disconnect warnings
├── ResyncRequest: Client requesting full state
└── Error/Correction: Server-initiated state fixes

Reliability:
├── Sequencing: Monotonically increasing message IDs
├── Ack/Nack: Acknowledgement system for critical messages
├── Retry: Exponential backoff for failed transmissions
├── Duplicate Detection: Ignore already-processed messages
├── Ordering: In-order delivery where critical
└── Timing: Timestamp-based interpolation for smoothness
```

## Game State Management

### 1. State Authority Model
```
Server Authority:
├── Ultimate Truth: Server state is canonical
├── Validation: All actions validated before application
├── Resolution: Conflicts resolved by server timestamp/order
├── Security: Prevents client-side cheating/modification
└── Latency: Compensated via prediction/interpolation

Client Prediction:
├── Local Simulation: Immediate feedback for player actions
├── Input Queuing: Actions sent to server with timestamps
├── State Interpolation: Smooth blending between known states
├── Error Correction: Visible snap-back when server differs
├── Confidence: High for local actions, lower for remote
└── Perception: Masks latency while maintaining fairness

State Representation:
├── Full State: Complete game snapshot (infrequent)
├── Delta State: Changes since last acknowledgment (common)
├── Entity-Based: Individual objects with IDs and components
├── Component-Based: Modular data aspects (position, ownership)
└── Versioned: Synchronized with logical clocks/timestamps
```

### 2. State Synchronization Strategy
```
Initial Sync:
├── Server: Sends full game state upon connection
├── Client: Builds complete local representation
├── Both: Establish baseline for delta compression
├── Validation: Client verifies received state consistency
└── Handshake: Ready signal when local matches remote

Ongoing Sync:
├── Server: Sends delta updates at fixed intervals (30Hz)
├── Client: Applies deltas to interpolated state
├── Acknowledgement: Client confirms receipt of updates
├── Compression: Only changed entities/properties sent
├── Prediction: Client extrapolates during update gaps
└── Reconciliation: Server corrections applied smoothly

Optimizations:
├── Interest Management: Only send relevant state changes
├── Spatial Relevance: Cards far from interaction less frequent
├── Temporal Relevance: Older states compressed more
├── Entity Prioritization: Active/interacting objects prioritized
├── Bandwidth Adaptation: Update frequency scales with quality
└── Late Join: Handling for spectators or reconnecting players
```

### 3. Specific Game State Elements
```
Card State:
├── Location: Hand, draw pile, discard pile, completed set
├── Owner: Which player currently possesses (if in hand)
├── Orientation: Face-up/face-down, rotation angle
├── Position: Exact coordinates for physics simulation
├── Velocity: Current movement vector (for interpolation)
├── Status: Active, in-transition, completed set member
├── Personalization: Reference to localized content
└── Visibility: Who can see this card (critical for security)

Hand State:
├── Cards: Ordered list of card references
├── Layout: Fan parameters (radius, spread, center)
├── Selection: Currently highlighted/inspected card
├── Interaction: Drag source/target information
├── Count: Total cards for UI layout calculations
└── Readiness: Prepared to play specific cards

Set State:
├── Collection: Which card collection this set belongs to
├── Cards: Exactly 4 card references (ordered)
├── Owner: Player who completed the set
├── Formation: Stack vs exploded visual state
├── Title: Unlocked set title (derived from collection)
├── Completion Time: When set was finalized
└── Status: Active, being viewed, scored

Table State:
├── Draw Pile: Ordered list of remaining cards
├── Discard Pile: Ordered list of played cards
├── Central Area: Active effects/animations location
├── Turn Indicator: Visual state of whose turn it is
├── Event Queue: Pending animations/sound triggers
├── Environment: Ambient state (lighting, etc.)
└── BAC Tracking: Per-player drink counts and estimates

Player State:
├── ID: Unique identifier
├── Profile Reference: Link to persistent player data
├── Avatar: Current visual representation
├── Username: Display name for opponent
├── Status: Connected, disconnected, awaiting, playing
├── Resources: Game-specific currencies/tokens (if any)
└── Preferences: Local settings affecting remote view
```

## Security Measures

### 1. Anti-Cheating Protections
```
Information Hiding:
├── Opponent Hand: Never transmitted (only card count)
├── Draw Order: Server-only knowledge of pile sequence
├── Future Cards: Unknown to both players until drawn
├── Personalization Seed: Not reverse-engineerable from cards
├── Server Actions: Critical logic never exposed to clients
└── Memory Access: Clients cannot read opponent's memory

Action Validation:
├── Turn Validation: Server rejects actions not on player's turn
├── Request Validation: Can only ask for cards theoretically possible
│    ├─ Based on known distributions and game state
│    └─ Statistical improbability triggers investigation
├── Transfer Validation: Server verifies card actually exists
│    ├─ In opponent's hand when claimed
│    └─ Matches requested collection/type
├── Set Validation: Only valid 4-card combinations count
├── Draw Validation: Only from legitimate pile positions
└── Timing Validation: Prevents action flooding/spamming

Secure Communication:
├── Transport: WSS (WebSocket over TLS 1.3)
├── Certificate Pinning: Prevents MITM attacks
├── Message Integrity: HMAC/signatures for critical messages
├── Replay Prevention: Nonces/timestamps prevent old message reuse
├── Obfuscation: Protocol structure hides intent from casual inspection
└── Key Rotation: Periodic session key renewal

Client Integrity:
├── Build Verification: Optional server-side build hash checking
├── Runtime Checks: Detect common cheating tools/modifications
├── Behavior Analysis: Flag statistically impossible plays
├── Reporting System: Player-initiated cheating reports
└── Ban System: Graduated responses from warning to permanent ban
```

### 2. Privacy Protections
```
Data Minimization:
├── Transmit Only Essential: No unnecessary personal data
├── Anonymize Where Possible: Use game IDs not real identities
├── Limit Profile Sharing: Only necessary for personalization
├── Secure Storage: Encrypt any cached server data
└── Retention Policies: Delete session data post-game

Consent & Control:
├── Clear Disclosure: What data is shared and why
├── Opt-In Features: Sharing beyond core gameplay
├ fácil Export: Players can download their data
├── Deletion Request: Right to be forgotten implemented
└── Age Compliance: COPPA/GDPR features for younger users

Secure Personalization:
├── Seed Sharing: Only minimal data needed for card generation
├── Server-Side Generation: Personalization happens securely
├── Result Only Transmission: Clients get cards not seeds
├── Temporary Usage: Session-specific personalization only
└── No Reverse Engineering: Cards don't reveal source data
```

## Connection Management & Resilience

### 1. Connection States
```
DISCONNECTED: No active connection
CONNECTING: Establishing link to server
CONNECTED: Active bidirectional communication
RECONNECTING: Attempting to restore after interruption
LOCAL_FALLBACK: Playing with AI or deferred sync
SUSPENDED: Backgrounded but maintaining connection
TERMINATED: Connection ended, cleaning up resources
```

### 2. Heartbeat & Monitoring
```
Heartbeat Protocol:
├── Interval: 15-20 seconds (configurable based on network)
├── Message: Minimal payload with timestamp
├── Response Expected: Within 3-5 seconds
├── Failure Threshold: 3 missed heartbeats = disconnected
├── Adaptive: Shorter intervals on poor connections
└── Jitter: Randomization to prevent thundering herd

Connection Quality Metrics:
├── Latency: Round-trip time measurement
├── Jitter: Variance in latency measurements
├── Packet Loss: Estimated from missing acknowledgements
├── Bandwidth: Actual throughput observation
├── Error Rate: Corrupted/malformed message frequency
└── Stability: Duration of consistent quality

User Feedback:
├── Status Indicator: Visual connection quality indicator
├── Tooltips: Detailed metrics on long press
├── Warnings: Degrading quality notifications
├── Recovery Notices: Reconnection attempt updates
└── Fallback Alerts: When switching to local modes
```

### 3. Reconnection & Recovery
```
Reconnection Attempt:
├── Trigger: Lost connection detection
├── Immediate: Try to resume existing session (seconds)
├── Short-Term: Aggressive retry for 30 seconds
├── Medium-Term: Backoff strategy up to 5 minutes
├── Long-Term: Periodic attempts with exponential delay
├── User Notification: Clear status throughout process
└── Abort Conditions: App backgrounded/user canceled

State Recovery:
├── Last Known State: Client preserves pre-disconnect state
├── Server State: Server maintains session for grace period
├── Reconciliation: Differences resolved upon reconnect
├── Validation: Full state exchange if divergence too great
├── Event Replay: Re-apply missed events in correct order
└── Continuity Seamless: Minimal disruption to gameplay

Local Fallback Modes:
├── AI Opponent: Play against basic AI when disconnected
├── Deferred Sync: Queue actions for later transmission
├── Practice Mode: Solo play with shuffled deck
├── Statistics Preservation: Local play doesn't affect ranks
└── Explicit Consent: User choice to enter fallback mode

Data Persistence:
├── Client-Side: Save state frequently to survive crashes
├── Server-Side: Maintain sessions for reconnection window
├── Checkpointing: Periodic full state saves
├── Conflict Resolution: Clear rules for merging divergent states
└── Loss Minimization: Design to lose <10s of gameplay max
```

## Turn Management & Asymmetry Handling

### 1. Turn Architecture
```
Turn Definition:
├── Start: When player gains right to act
├── End: When action completed or time expires
├── Transition: Clear handoff to opponent
├── Overlap Protection: Prevents double-action scenarios
└── Timing: May include reflection/planning periods

Turn Notification:
├── Server Initiated: Authoritative turn assignment
├── Client Applied: Local state update with interpolation
├── Visual Feedback: Clear indicator of active player
├── Audio Cue: Subtle transition sound
├── Haptic Feedback: Distinct pattern for turn change
└── Timeout Warning: Visual/audio countdown if applicable

Active Player Experience:
├── Full Interaction: All game actions available
├── Priority Processing: Local actions minimized latency
├── Prediction Confidence: High for self-initiated actions
├── Immediate Feedback: Tactile response to touches/gestures
├── Turn Timer: Optional visibility of remaining time
└── Strategic Planning: Time to consider next move

Waiting Player Experience:
├── Limited Interaction: Observe only, no primary actions
├── Secondary Interactions: Inspect own hand, view stats
├── Information Hiding: Cannot see opponent's hand details
├── State Interpolation: Smooth observation of opponent actions
├── Engagement Elements: Animated waiting, mini-games
├── Preparation: Mental readiness for upcoming turn
└── Social Features: Chat/reactions during opponent's turn
```

### 2. Turn Transition Mechanics
```
Action Completion:
├── Local: Client processes action fully
├── Transmission: Action sent to server with timestamp
├── Server: Validates, applies, generates new state
├── Notification: Server broadcasts turn change + state
├── Clients: Apply new state, update turn indicators
├── Cleanup: Action-specific state cleared/reset
└── Preparation: New active player readies for input

Timeout Handling:
├── Warning: Visual/audio cue at 20%, 10%, 5% remaining
├── Auto-Pass: Automatic turn end if no action
├── Confirmation: Optional confirmation before timeout pass
├── Strategic Use: Players may intentionally timeout
├── Anti-Abuse: Limits on consecutive timeouts
└── Grace Period: Brief window to cancel auto-pass

Disconnection During Turn:
├── Detection: Server notices missing heartbeat/ack
├── State Preservation: Current turn/player remembered
├── Reconciliation: Upon reconnect, validate turn status
├── Fairness: Neither player penalized for network issues
├── Continuation: Resume with same player to act
├── Compensation: Possible time extension for reconnection
```

## Special Multiplayer Features

### 1. Communication Systems
```
Text Chat:
├── Optional: Player-controlled enable/disable
├── Filtering: Profanity and spam prevention
├── Rate Limiting: Prevent flooding/spam
├── Persistence: Chat log saved with game session
├── Moderation: Reporting system for abuse
├── Localization: Automatic translation if enabled
└── Safety: Age-appropriate restrictions where needed

Emoji/Reactions:
├── Quick Tap: Pre-selected emoji set for fast response
├── Contextual: Suggestions based on game state
├── Non-Disruptive: Small unobtrusive display
├── Timing: Available during any game phase
├── Analytics: Track popular reactions for tuning
├── Bundle: Regular updates with seasonal/new emojis
└── Accessibility: Alternative text for screen readers

Voice Chat:
├── Optional: Separate enable from game audio
├── Push-to-Talk: Prevents background noise
├── Voice Activation: Sensitivity-adjusted alternative
├── Echo Cancellation: Full duplex when appropriate
├── Latency Optimization: Prioritized audio stream
├── Muting: Individual and global controls
├── Safety: Reporting and moderation tools
└── Quality: Adaptive bitrate based on connection
```

### 2. Spectator & Social Features
```
Spectator Mode:
├── View Only: Observe ongoing games without participating
├── Limited Info: See what players can see (no hidden data)
├── Delay Option: Configurable delay to prevent streaming advantage
├── Chat: Separate spectator chat channel
├── Reactions: Applause/emoji without interrupting players
├── Recording: Optional saving for later review/share
├── Invitations: Shareable links to watch specific games
└── Monetization: Potential for non-intrusive sponsorship

Social Features:
├── Friend System: Add/remove gaming friends
├── Recent Players: Easy rematch with last opponents
├── Leaderboards: Competitive rankings (optional)
├── Achievements: Cross-game accomplishments
├── Gifting: Send card collections or cosmetic items
├── Clubs/Groups: Private multiplayer communities
└── Events: Scheduled tournaments or game nights

Asynchronous Play:
├── Turn-Based: Extended time limits for casual play
├── Notification: Alert when opponent has taken turn
├── Persistence: Games can span days/weeks
├── Convenience: Play when time allows
├── Hybrids: Blend of sync/async for different phases
└── Limitations: Some real-time features disabled
```

## Performance & Scalability

### 1. Latency Optimization
```
Prediction Techniques:
├── Client-Side: Immediate local feedback for actions
├── Server Reconciliation: Corrections applied smoothly
├── Lerp Interpolation: Smooth movement during network gaps
├── Extrapolation: Reasonable guessing during delays
├── Compensation: Artificial delay to match opponent perception
└── Confidence Visuals: Indicate prediction reliability

Latency Compensation:
├── Action Delay: Artificial wait to synchronize perception
├── Visual Cues: Subtle indicators of compensation active
├── Selective Application: Only for timing-sensitive actions
├── User Calibration: Optional manual adjustment
└── Perception Testing: Validate with actual player feedback

Optimization Targets:
├── Action Response: <100ms perceived latency for local actions
├── State Update: <200ms for remote actions to appear
├── Turn Transition: <300ms to feel instantaneous
├── Event Synchronization: <150ms for sound/vfx to match
└── Overall Feel: <166ms (6fps equivalent) for premium feel
```

### 2. Bandwidth Efficiency
```
Message Minimization:
├── Binary Protocols: 50-80% smaller than JSON/XML
├── Delta Updates: Only send changed state
├── Entity Profiling: Prioritize frequently changed objects
├── Compression: LZ4 or similar for larger payloads
├── Interest-based: Don't send irrelevant state changes
└── Adaptive Frequency: Update rate scales with importance

Bandwidth Tiers:
├── High Quality: 60Hz updates, full fidelity
├── Medium Quality: 30Hz updates, reduced fidelity
├── Low Quality: 15Hz updates, essential only
├── Audio-Only: Minimal game state, voice/chat focus
└── Emergency: Connection survival with basic sync

Adaptive Streaming:
├── Monitor: Continuous bandwidth measurement
├── Adjust: Automatic quality tier adjustment
├── Hysteresis: Prevent rapid oscillation between tiers
├── User Override: Manual quality selection available
└── Predictive: Pre-emptive adjustment based on trends
```

### 3. Server Scalability
```
Horizontal Scaling:
├── Stateless Servers: Easy addition/removal of capacity
├── Load Balancing: Distribute connections evenly
├── Session Affinity: Optional sticky connections for state
├── Sharding: Separate game instances by region/scale
├── Auto-Scaling: Automatically adjust based on load
└── Geographic Distribution: Regional servers for latency

Efficient Resource Use:
├── Connection Multiplexing: Multiple games per connection
├── Message Batching: Combine small messages
├── Memory Pooling: Reuse objects to reduce GC pressure
├── CPU Optimization: Efficient validation algorithms
├── Storage: Efficient session persistence
└── Monitoring: Real-time metrics for performance tuning

Fault Tolerance:
├── Redundancy: Multiple instances for high availability
├── Failover: Automatic transfer during instance failure
├── State Backup: Regular snapshots for recovery
├── Graceful Degradation: Reduced features during stress
├── Circuit Breakers: Prevent cascade failures
└── Chaos Engineering: Regular resilience testing
```

## Implementation Guidelines

### 1. Technology Stack Selection
```
Transport:                 WebSocket Secure (WSS) over TLS 1.3
Serialization:             Protocol Buffers (binary, efficient)
Authentication:            Apple GameKit + custom JWT fallback
State Management:          Entity Component System (ECS) inspired
Networking Layer:          Custom wrapper with reliability features
Security:                  Certificate pinning, HMAC for integrity
Monitoring:                Custom metrics + standard APM tools
Fallback:                  HTTP long-polling for restrictive networks
```

### 2. Development Best Practices
```
Security First:          Validate all inputs, assume malicious clients
Defensive Coding:        Handle unexpected/malformed messages gracefully
Performance Awareness:   Measure impact of networking code
Testability:             Design for mockable network layers
Observability:           Comprehensive logging and metrics
Documentation:           Clear API contracts and message specs
Versioning:              Backward-compatible protocol evolution
```

### 3. Testing Strategy
```
Unit Testing:            Individual message handlers and validation
Integration Testing:     Full client-server interaction scenarios
Network Simulation:      Latency, jitter, packet loss injection
Load Testing:            Concurrent connections and message rates
Security Testing:        Penetration testing and vulnerability scans
Chaos Testing:           Random failures and network partitions
Accessibility Testing:   Validate with assistive technologies
Localization Testing:    Verify across languages and regions
User Testing:            Actual players on various network conditions
```

### 4. Deployment Considerations
```
Environment Separation:  Dev, staging, production isolated
Database Design:         Efficient session storage and retrieval
Caching Strategy:        Redis or similar for hot session data
CDN Usage:               Static assets served efficiently
Monitoring Stack:        Metrics, logging, tracing, alerting
Backup Procedures:       Regular automated backups
Rollback Capability:     Fast rollback for problematic deployments
Compliance:              Ensure adherence to data protection laws
```

## Multiplayer Design Principles

### 1. Core Tenets
```
Security Paramount:      Never sacrifice security for convenience
Fairness First:          Design prevents cheating and exploitation
Experience Over Consistency: Local responsiveness valued over perfect sync
Resilience Built-In:     Network issues handled gracefully
Asymmetry Respected:     Different experiences for active/waiting players
Privacy by Design:       Minimal data sharing, user control
```

### 2. User Experience Priorities
```
Immediate Feedback:      Local actions feel instant
Clear Turn Indication:   Never unsure whose turn it is
Seamless Reconciliation:  Network corrections feel natural
Informative Connection:  Always know network status
Safe Environment:        Protection from harassment and cheating
Engaging Waiting:        Opponent's turn not boring
Transparent Fairness:    Players trust the system is fair
```

### 3. Technical Excellence
```
Efficient Protocols:     Minimize bandwidth and latency
Reliable Delivery:       Messages arrive correctly and in order
Scalable Architecture:   Handle growth without major rewrites
Maintainable Code:       Clear separation of networking concerns
Observable System:       Easy to monitor, debug, and optimize
Testable Components:     Isolate networking for validation
Future-Proofing:         Designed for evolution and expansion
```

### 4. Anti-Fragility Principles
```
Learn from Failures:     Network issues improve future handling
Adaptive Quality:        Automatically find optimal settings
Graceful Degradation:    Lose features, not core experience
User Empowerment:        Controls to manage own experience
Community Feedback:      Player data informs improvements
Transparency:            Clear when issues are network vs device
```

---
*This Multiplayer Architecture document completes Phase 6 of the GFY Master Orchestrator Prompt. It defines how two players connect, synchronize state, and interact securely while maintaining a premium, responsive feel that masks network latency and ensures fair play.*