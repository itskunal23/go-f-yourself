# GO FUCK YOURSELF (GFY) - Interaction Architecture

## Overview
This document defines the interaction architecture for GFY, detailing how users interact with the game through touch, gestures, voice, and other input methods. The interaction architecture focuses on creating a tactile, physical experience that feels premium and responsive while maintaining accessibility and clarity.

## Interaction Principles

### 1. Physical Metaphor
All interactions should feel like manipulating premium physical cards on a luxury tabletop surface. This informs:
- Weight and inertia in movements
- Resistance and feedback
- Spatial relationships and stacking
- Material properties (texture, flexibility, edge feel)

### 2. Direct Manipulation
Users interact directly with game objects rather than through abstract controls:
- Cards are touched, lifted, dragged, and released
- Sets are tapped to explode/implode
- The table surface responds to touch
- Minimal use of traditional UI controls (buttons, menus)

### 3. Progressive Disclosure
Complexity is revealed gradually:
- Initial game state shows only essential elements
- Advanced options appear through interaction
- Personalization depth increases with engagement
- Systems like BAC tracking are visible but not overwhelming

### 4. Feedback Richness
Every interaction provides multi-sensory feedback:
- Visual: deformation, highlighting, motion
- Audio: subtle clicks, swishes, material sounds
- Haptic: taps, pulses, vibrations matching physical properties
- Physics: predictable responses based on force and velocity

## Interaction States & Modes

### 1. System States
```
├── Pre-game (questionnaire, setup)
├── Pre-round (deck shuffle, deal animation)
├── Active gameplay (turn-based)
├── Event processing (set completion, bartender, drink)
├── Post-round (scoring, victory animation)
├── Post-game (stats, sharing, rematch)
└── System (settings, profiles, help)
```

### 2. Player Modes (during active gameplay)
```
├── Waiting for opponent turn (passive observation)
├── Selecting card to request (active decision)
├── Inspecting card (detailed view)
├── Holding card ready to play (preparation)
├── Dragging card to target (execution)
├── Processing transfer/result (feedback)
├── Completing set (celebration)
└── Special event occurring (interruption)
```

## Core Interaction Patterns

### 1. Card Inspection
**Trigger**: Tap on card in hand or completed set
**Process**:
1. Visual lift and slight rotation (physics-based)
2. Enhanced shadow and border highlight
3. Optional: subtle paper texture animation
4. Information reveal: title, flavor text, personalization source
5. Dismissal: tap outside or second tap
**Accessibility**: Long press alternative, VoiceOver hints

### 2. Card Selection & Request
**Trigger**: Hold on card in hand (initiates lift)
**Process**:
1. Card lifts with finger, following touch point
2. Shadow deepens and blurs realistically
3. Suggested targets highlight (opponent's hidden zone)
4. Audio: light paper lift sound
5. Haptic: soft pulse matching lift height
6. Release options:
   - Drag to opponent zone → request specific card
   - Drag back to hand → cancel with spring-back
   - Flick upward → "bluff" attempt (advanced)
**Constraints**: Only one card can be held at a time

### 3. Card Transfer
**Trigger**: Release dragged card over valid target
**Process**:
1. Validation: Is this a legal request?
2. If valid and opponent has card:
   - Card flies to opponent's hand with trajectory
   - Both hands adjust (fan update)
   - Audio: subtle card slide/slap
   - Haptic: light impact pulse
   - Turn continues (can ask again)
3. If invalid or opponent lacks card:
   - Card returns to owner with "reject" animation
   - Audio: light buzz or paper flutter
   - Haptic: short sharp pulse
   - Trigger draw from pile
   - Turn ends
**Physics**: Release velocity affects card flight

### 4. Drawing from Pile
**Trigger**: Turn ends without successful request OR explicit draw action
**Process**:
1. Top card of draw pile lifts and flies to player's hand
2. Hand fan updates to accommodate new card
3. Audio: distinct draw sound (different from transfer)
4. Haptic: medium pulse
5. Auto-check for immediate set completion
6. Turn passes to opponent
**Special**: Drawing last card triggers deck-empty preparation

### 5. Set Completion
**Trigger**: Player acquires 4th card of a collection
**Process**:
1. Cards snap together into stack formation
2. Subtle wobble settle (physics-based settling)
3. Set title appears with flourish animation
4. Stack moves to completed sets area above hand
5. Audio: satisfying "clunk" of stacking
6. Haptic: series of decreasing pulses (settling)
7. Visual: slight glow/emphasis on new set
8. Potential trigger: bartender commentary, drink event
**Interaction**: Tap set to "explode" into fanned cards

### 6. Set Explosion/Implosion
**Trigger**: Tap on completed set
**Process**:
1. Set lifts slightly
2. Cards fan out in arc (physics-based dispersion)
3. Each card retains individualized appearance
4. Audio: soft fan sound
5. Haptic: medium pulse
6. Dismissal: tap anywhere or drag cards back
7. Implosion: cards animate back to stack with inertia
**Purpose**: Review collected cards, see personalization sources

### 7. Turn Management
**Visual Indicators**:
- Active player: hand slightly elevated, subtle glow
- Waiting player: hand at normal opacity, slight dim
- Clear "Your Turn" / "Opponent's Turn" banner (minimal)
- Turn timer: optional sand circle around avatar

**Interaction**:
- Automatic turn passing after draw or failed request
- Manual pass option (advanced/expert mode)
- Turn timeout: visual warning then auto-pass
- Reconnection: clear indication of state sync

### 8. Bartender Interaction
**Appearance Trigger**: System-determined (5-10% of events)
**Process**:
1. Audio cue: distinctive glass clink (from table edge)
2. Visual: bartender figure emerges from table side
3. Bartender "leans in" with commentary bubble
4. Commentary appears with typewriter effect
5. Audio: vocal line (if voice enabled) or subtle text sound
6. Haptic: unique pattern (glass clink feel)
7. Duration: based on comment length + read time
8. Dismissal: tap to hurry, auto-fade after set time
9. Post-commentary: bartender retreats with liquid sound
**Interaction**: 
- Tap commentary to repeat or share
- Long cough/sound effect to "shush" bartender (humorous)

### 9. Drink System Interaction
**Trigger**: Drink-enabled event occurs
**Process**:
1. Visual: drink icon pulses on table
2. Audio: liquid pour or ice clink sound
3. Haptic: medium-long pulse sequence
4. Notification: "Time for a drink!" with optional specifics
5. User Action:
   - Option A: Point camera at drink (auto CV)
   - Option B: Manual entry (type/select)
   - Option C: Skip/non-alcoholic toggle
6. CV Processing:
   - Viewfinder with guides for drink centering
   - Real-time feedback on detection confidence
   - Automatic capture when optimal
   - Manual override for problem cases
7. Result Display:
   - Detected drink type + confidence
   - Estimated volume/alcohol units
   - Confirmation/correction options
8. BAC Update:
   - Visual BAC meter animates to new level
   - State change triggers appropriate effects
   - Optional: celebratory or cautionary haptic/audio

### 10. BAC Meter Interaction
**Display**: Elegant vertical or circular meter
**States**: Sober → Buzzed → Tipsy → Drunk → Very Drunk
**Interaction**:
- Passive: shows current state and trend
- Tap: detailed breakdown (drinks, time, estimate)
- Long press: historical BAC graph for session
- Settings: toggle visibility, adjust sensitivity
- Accessibility: audio announcements at state changes

### 11. Questionnaire & Personalization Setup
**Flow**:
1. Welcome screen explaining personalization benefits
2. Sequential fields with engaging microcopy
3. Progressive disclosure: basic → detailed → fun
4. Input methods optimized per field type:
   - Text: standard with validation
   - Lists: tag-based entry with suggestions
   - Scale: visual sliders (height/weight)
   - Photos: optional avatar creation
5. Progress indication: clear step counting
6. Preview: "See how this affects your cards"
7. Completion: "Your personalized deck is ready!"
**Special Features**:
- Couple mode: shared fields + individual fields
- Import from contacts/social media (opt-in)
- Randomize for anonymized play
- Save and continue later

## Navigation & Screen Flow

### 1. Launch Sequence
```
Cold Start:
├── Splash (brand + version)
├── Login/Profile Select (if multiple)
├── Questionnaire Check (complete/incomplete)
├── If incomplete → Questionnaire Flow
├── If complete → Main Menu
└── Main Menu → New Game / Continue / Settings / Stats
```

### 2. Main Menu
```
Primary Actions (large, spaced):
├── NEW GAME (prominent)
├── CONTINUE GAME (if active session)
├── VIEW STATS
├── SETTINGS
└── HELP/TUTORIAL

Secondary (accessible but subtle):
├── INVITE FRIEND
├── CARD COLLECTIONS
├── ABOUT
└── LEGAL/PRIVACY
```

### 3. Game Screen Layout
```
Top Area:
├── Player 1 Avatar/Name (left)
├── Player 2 Avatar/Name (right) 
├── Turn indicator (center/top)
└── Menu button (top-right, minimal)

Middle Area (Table Surface):
├── Draw Pile (left-center)
├── Discard Pile (right-center) 
├── Central action area (for events)
└── Optional: shared elements (pot, drinks tracker)

Bottom Area:
├── Player 1 Hand (fan, left)
├── Player 2 Hand (fan, right) - face down
└── Action hints (contextual, appear/disappear)

Completed Sets Area:
├── Above each player's hand
├── Horizontal stack display
├── Tap to explode/implode
```

### 4. Modal & Temporary UI
```
Event Overlays:
├── Bartender appearance (side emergence)
├── Drink prompt (bottom-up sheet)
├── CV viewfinder (fullscreen with guides)
├── Set completion celebration (center burst)
├── Victory animation (fullscreen)
├── Connection status (top banner)
└── Tutorial tips (contextual, non-blocking)

Settings Screens:
├── Gameplay (difficulty, rules variants)
├── Personalization (depth, sharing, filters)
├── Audio (volume, music, effects)
├── Visual (themes, accessibility, motion)
├── Notifications (frequency, types)
└── Privacy (data handling, deletion)
```

## Gesture Catalog

### 1. Standard Gestures
```
Tap:           Select/inspect, confirm, dismiss
Double Tap:    Zoom/investigate (advanced)
Long Press:    Enter drag mode, contextual menu
Swipe Left/Right: Browse hand, navigate history
Swipe Up:      Advanced actions (bluff, special)
Swipe Down:    Cancel, minimize, pull-to-refresh
Two Finger:    Rotate (inspect), scale (zoom)
Three Finger:  Undo/redo (advanced), share
```

### 2. Game-Specific Gestures
```
Hold Card:     Lift for inspection/request
Drag Card:     Play card, transfer request
Flick Card:    Bluff attempt, aggressive play
Shake Device:  Undo last action (with confirmation)
Tilt Device:   Alternative inspection (accessibility)
Cover Screen:  Quick mute/hide (privacy)
```

### 3. Accessibility Gestures
```
VoiceOver:     Standard navigation + custom actions
Switch Control: Sequential item selection with timing
AssistiveTouch: Customizable gesture menu
Keyboard:      Full navigation for iPad/keyboard use
```

## Feedback Systems

### 1. Visual Feedback
```
State Changes:         Color, elevation, scale, rotation
Interaction Proof:     Ripple, highlight, deformation
Progress Indicators:   Spinners, bars, pulsed elements
Attention Direction:   Subtle motion, glow, pointer
Error States:          Shake, flash, inertial rejection
Success States:        Pop, bounce, particle burst
```

### 2. Audio Feedback
```
UI Interaction:        Click, tap, swipe (material-appropriate)
Game Events:           Shuffle, deal, transfer, stack, explode
Special Moments:       Bartender clink, drink pour, victory
Ambient:               Table texture, distant chatter (optional)
Voice:                 Bartender commentary (toggleable)
Adaptive:              Volume/intensity based on game state
```

### 3. Haptic Feedback
```
Light:                 Tap, selection, confirmation
Medium:                Card lift/drop, set completion
Heavy:                 Victory, special events, errors
Patterns:              Sequences for bartender, drinking
Adaptive:              Intensity based on action force
Custom:                Waveforms matching audio events
```

## Accessibility Architecture

### 1. Visual Accessibility
```
Dynamic Type:          All text respects user font sizes
Contrast:              WCAG 2.1 AA minimum, AAA where possible
Color Blind:           Information conveyed through multiple channels
Reduce Motion:         Option to minimize/eliminate animations
Increase Contrast:     Enhanced borders and separation
Differentiate Without Color: Shapes, symbols, motion
```

### 2. Auditory Accessibility
```
Captioning:            All audio cues have visual equivalents
Volume Control:        Independent sliders for SFX, music, voice
Visual Alternatives:   Flash/pulse for audio alerts
Mono Audio:            Option for single-channel output
```

### 3. Motor Accessibility
```
Large Targets:         Minimum 44x44pt interactive areas
Adjustable Timing:     Extendable time limits
Alternative Input:     Full VoiceOver/Switch Control support
Customizable Gestures: Remappable complex gestures
Pointer Assistance:    Hover hints, dwell control
```

### 4. Cognitive Accessibility
```
Clear Language:        Simple, consistent terminology
Predictable Layout:    Consistent navigation patterns
Error Prevention:      Confirmation for destructive actions
Error Recovery:        Easy undo, clear status indicators
Focus Assistance:      Minimal distractions, clear hierarchy
Reading Level:         Grade 8 or lower for core instructions
```

## Performance Considerations

### 1. Interaction Latency Targets
```
Touch Response:        <50ms visual feedback
Animation Start:       <16ms (1 frame)
Physics Settlement:    <200ms for natural feel
Audio Playback:        <10ms trigger to sound
Haptic Response:       <20ms trigger to pulse
```

### 2. Frame Rate Goals
```
Idle/Static:           60 FPS
Animations:            60 FPS target, 30 FPS minimum
Physics Simulation:    60 FPS for smooth interaction
 mixed load:           45 FPS acceptable during peaks
```

### 3. Optimization Strategies
```
Interaction Coalescing: Group rapid touches
Predictive Rendering:   Pre-load likely next states
Asset Streaming:        Load/unload based on view
GPU Utilization:        Offload effects to Metal
Memory Budgeting:       Texture atlases, object pools
```

## Error Handling & Recovery

### 1. User Errors
```
Invalid Request:       Clear explanation + suggested alternative
Failed Action:         Animated reversal + hints
Unclear State:         Contextual help overlay
Timeout:               Graceful auto-pass with explanation
```

### 2. System Errors
```
Connection Loss:       Clear status + retry options
State Corruption:      Detected + recovery from last save
Resource Exhaustion:   Graceful degradation + quality reduction
Crash Recovery:        Last-known-good state restoration
```

### 3. Edge Cases
```
Drunk Play State:      Extra confirmation for actions
Distracted User:       Persistent state indicators
Sharing Violations:    Clear boundaries + reporting
Inappropriate Content: User reporting + adjustable filters
```

## Cross-Platform Considerations

### 1. iPad Adaptations
```
Larger Canvas:         More table space, detailed cards
Multiplayer Modes:     Side-by-side or opposite seating
Enhanced Visuals:      Higher resolution textures
Input Options:         Apple Pencil precision, keyboard
Split View:            Compatible with other apps
```

### 2. Future Platforms
```
Apple TV:              Shared viewing, remote iPhone controllers
Vision Pro:            Spatial card table, immersive bartender
CarPlay:               Limited glance view (stats only)
Mac:                   Catalyst version with desktop optimizations
```

---
*This Interaction Architecture document completes Phase 3 of the GFY Master Orchestrator Prompt. It defines how users will interact with the game through touch, gestures, and other inputs, focusing on creating a premium, tactile experience that feels like manipulating physical cards on a luxury tabletop.*