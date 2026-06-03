# GO FUCK YOURSELF (GFY) - Motion System

## Overview
This document defines the motion system for GFY, detailing how movement, animation, and physics contribute to the premium, tactile experience. The motion system focuses on making every state change feel physical, explanatory, and luxurious - never instantaneous or abstract.

## Motion Philosophy

### 1. Physical Metaphor Foundation
All motion should obey recognizable physical laws:
- Cards have weight, inertia, and resistance
- Movements follow trajectories based on forces applied
- Collisions and interactions conserve momentum appropriately
- Settling behavior shows damping and oscillation

### 2. Explanatory Motion
Motion should communicate system state and causality:
- Where did this card come from? (show origin trajectory)
- Why did this happen? (motion reveals cause-effect)
- What changed? (before/after states connected by motion)
- What's next? (anticipatory motion prepares user)

### 3. Luxury Constraints
Motion should feel expensive and refined:
- No cartoonish exaggeration
- Subtle secondary motions (follow-through, settling)
- Appropriate easing (never linear, rarely symmetric)
- Attention to material properties in movement

### 4. Performance Conscious
Motion serves experience without compromising performance:
- Frame budget awareness (16ms per frame @ 60 FPS)
- Selective application (meaningful changes only)
- Efficient implementation (GPU-accelerated where beneficial)
- Degradation paths for lower-end devices

## Core Animation Principles

### 1. Timing & Easing
```
Natural Motion:          Custom curves approximating real physics
Card Movement:           Asymmetric ease-in-out (faster start, softer stop)
Physics-based:           Actual velocity/acceleration calculations
Secondary Motion:        Follow-through with damping (20-30% of primary)
Overlapping Action:      Staggered onset for related elements
Anticipation:            Small reverse motion before major action
```

### 2. Specific Curves (approximate)
```
Card Lift:               [0.25, 0.1, 0.25, 1.0] (quick lift, soft settle)
Card Throw:              [0.1, 0.8, 0.3, 1.0] (quick release, air resistance)
Set Snap:                [0.3, 0.0, 0.7, 1.0] (soft start, firm settle)
UI Panel:                [0.4, 0.0, 0.2, 1.0] (slight hesitation, smooth settle)
Bartender Appear:        [0.2, 0.0, 0.4, 1.0] (quick emergence, weighted settle)
```

### 3. Duration Guidelines
```
Micro-interactions:      80-120ms (tap response, hover)
Card Motions:            150-300ms (lift, throw, settle)
Set Operations:          200-400ms (snap together, explode apart)
UI Transitions:          250-350ms (panel appearance/dismissal)
Celebrations:            500-800ms (victory, major events)
Full Sequences:          1000-2000ms (pre-game shuffle/deal)
```

## Motion Systems Catalog

### 1. Card Physics System (production: arc fan + GSAP)
Production hand uses **arc fan layout** (`buildHandArc` in `frontend/js/cards.js`), tap-to-focus + Ask CTA, optional vertical drag-to-ask on the focused stack. Continuous mass/velocity simulation remains optional for future passes.

Simulates physical properties of premium playing cards.

#### Properties
```
Mass:                    1.8g (standard playing card)
Dimensions:              63mm × 88mm (poker size)
Aspect Ratio:            1.4:1
Flexibility:             0.3 (0 = rigid, 1 = very bendable)
Surface Friction:        0.6 (medium-high for card handling)
Edge Radius:             0.8mm (rounded premium corners)
```

#### Behaviors
```
Lift on Touch:
├── Trigger: Finger contact
├── Motion: Vertical lift (3-5mm) + slight rotation toward finger
├── Physics: Overcoming static friction + adhesion simulation
├── Visual: Shadow deepens and blurs (proximity-based)
├── Audio: Subtle separation sound (paper/air)
├── Haptic: Light pulse proportional to lift height
└── Duration: 100ms lift, 50ms settle

Inertial Drag:
├── Trigger: Sustained touch + movement
├── Motion: Card follows finger with realistic drag
├── Physics: Kinetic friction + air resistance simulation
├── Rotation: Card aligns with movement vector (weathervane effect)
├── Shadow: Depth proportional to lift height + velocity
├── Edge Glow: Subtle highlight on leading edge
├── Audio: Continuous light scraping (pitch varies with speed)
├── Haptic: Continuous texture feedback
└── Constraints: Maximum lift angle (~15°), boundary prevention

Release Physics:
├── Trigger: Finger lift
├── Motion: Continues with release velocity + deceleration
├── Physics: Projectile motion + air resistance + spin decay
├── Rotation: Ongoing with damping (based on flick velocity)
├── Landing: Different behaviors based on target:
│    ├─ To hand: Spring settle with overshoot damping
│    ├─ To set: Magnetic snap with wobble settle
│    ├─ To table: Bounce + slide + settle (material dependent)
│    └─ To opponent: Similar to hand but with transfer validation
├── Audio: Whoosh (travel) + impact (landing) sounds
├── Haptic: Impact pulse + texture during travel
└── Duration: Variable based on distance/velocity (typically 300-800ms)

Card Properties Simulation:
├── Bend: Realistic flex when dragging against resistance
├── Flutter: Light vibration at high speeds (releasing edge first)
├── Stick: Slight resistance when separating aligned cards
└── Wear: Subtle texture changes over many shuffles (cosmetic only)
```

### 2. Hand & Fan System
Manages the player's card collection display.

#### Fan Geometry
```
Base Layout:             Circular arc (radius 80-120px)
Card Spacing:            Dynamic based on hand count
Optimal Range:           3-10 cards (beyond requires scrolling)
Angle Spread:            20-40 degrees (comfortable viewing)
Card Rotation:           Perpendicular to tangent at position
Z-Ordering:              Based on arc position (center back, ends front)
```

#### Fan Behaviors
```
Add Card:
├── Trigger: New card enters hand (draw or transfer)
├── Motion: 
│    ├─ New card appears at insertion point
│    ├─ Existing cards reflow to accommodate
│    └─ Overall fan may expand/contract slightly
├── Physics: Spring-dampened movement for each card
├── Timing: Staggered start (drag wave through hand)
├── Audio: Series of light taps (increasing pitch)
├── Haptic: Distributed pulses through hand
└── Duration: 120ms base + 30ms per card distance

Remove Card:
├── Trigger: Card leaves hand (played or discarded)
├── Motion:
│    ├─ Card lifts slightly before departure
│    ├─ Gap closes as neighbors move together
│    └─ Overall fan may contract
├── Physics: Similar spring system in reverse
├── Timing: Leading cards start first (ripple effect)
├── Audio: Reverse of add sequence (decreasing pitch)
├── Haptic: Closing sensation pulse
└── Duration: Similar to add operation

Reorder/Inspect:
├── Trigger: Swipe to browse or specific card focus
├── Motion:
│    ├─ Target card moves toward viewer (Z + scale)
│    ├─ Neighbors make space (Y movement)
│    ├─ Distant cards may decrease opacity/scale
│    └─ Arc may subtly deform to emphasize target
├── Physics: Attraction/repulsion forces
├── Audio: Soft whoosh + spatialized ticks
├── Haptic: Directional pulse indicating movement
└── Duration: 150-250ms based on distance

Scrolling (for large hands):
├── Trigger: Horizontal swipe beyond threshold
├── Motion:
│    ├─ Fan translates along arc path
│    ├─ Cards maintain individual orientations
│    ├─ Leading/trailing cards fade with motion blur
│    └─ New cards emerge from opposite side
├── Physics: Fluid motion with momentum carryover
├── Audio: Continuous soft whoosh (pitch varies with speed)
├── Haptic: Texture feedback matching card edges
└── Inertia: Continues after lift with natural deceleration
```

### 3. Set Operations
Handles formation and display of completed collections.

#### Set Formation
```
Snap Together:
├── Trigger: Fourth card of collection enters hand
├── Motion:
│    ├─ Cards lift slightly and converge to center
│    ├─ Angular momentum causes slight spinning
│    ├─ Final alignment with tiny overshoot
│    └─ Stack settles with damped oscillation
├── Physics: 
│    ├─ Central attraction force (increases with proximity)
│    ├─ Torsional resistance for alignment
│    ├─ Vertical stiffness prevents interpenetration
│    └─ Damping prevents infinite bounce
├── Audio: Series of soft clicks (increasing frequency)
├── Haptic: Pulsing sequence (build intensity then settle)
├── Visual: Subtle glow build on cards during motion
├── Duration: 300-500ms based on initial dispersion
└── Completion: Set title fades in with slight scale pop

Set Explosion:
├── Trigger: Tap on completed set
├── Motion:
│    ├─ Set lifts slightly as unit
│    ├─ Cards explode outward in arc
│    ├─ Each card gains individual rotation
│    ├─ Cards may flip/show back briefly
│    └─ Arrive at spread positions with soft landing
├── Physics:
│    ├─ Radial expulsion force (varies by card position)
│    ├─ Tangential torque for spinning
│    ├─ Air resistance limits maximum velocity
│    └─ Landing uses same physics as card drop
├── Audio: Fan sound (like cards being shuffled)
├── Haptic: Medium pulse at launch + soft landings
├── Visual: Motion blur on fast-moving cards
├── Duration: 250-400ms based on spread distance
└── Dismissal: Similar physics in reverse (implosion)

Set Manipulation:
├── Selected Set: Slight elevation + highlight
├── Hover Preview: Micro-lift + rotation toward finger
├── Stack Toggle: Implode/explode based on current state
└── Multi-Set: Operations affect only targeted set
```

### 4. Table & Environment Simulations
Models the playing surface and environmental interactions.

#### Table Surface
```
Properties:
├── Material:            Virtual felt/luxury tabletop
├── Friction:            0.4 (medium for card sliding)
├── Elasticity:          0.1 (minimal bounce)
├── Texture:             Subtle noise for visual feedback
├── Temperature:         S ambient (affects flex perception audio)

Behaviors:
├── Card Sliding:
│    ├─ Continuous deceleration based on initial velocity
│    ├─ Rotation stabilizes to direction of travel
│    ├─ Edge chips slightly at high speeds (visual only)
│    └─ Gentle stop without oscillation
├── Card Dropping:
│    ├─ Short fall (5-10mm) with acceleration
│    ├─ Possible bounce (0-2 times based on height/angle)
│    ├─ Slide after impact based on residual energy
│    └─ Final settle with microscopic vibration
├── Audio: Continuous variable scraping (pitch/speed based)
├── Haptic: Texture vibration through device
└── Edge Interaction:
     ├─ Cards hanging over edge experience torque
     ├─ Slow drift toward center if imbalanced
     └─ Fall prevented by subtle blocking force
```

#### Environmental Effects
```
Air Resistance:
├── Function of velocity squared and card orientation
├── Affects: Throw distance, flutter, spin decay
├── Visual: Subtle motion blur at high speeds
├── Audio: Whoosh intensity varies with velocity
└── Negligible for slow movements (<100mm/s)

Table Tilt (optional):
├── Device orientation affects perceived gravity
├── Enables: Natural sliding when device tilted
├── Constraints: Limits prevent unfair advantage
├── Calibration: Optional user adjustment
└── Visual: Subtle shadow shifts to match "gravity"
```

### 5. UI & Feedback Motion
Animations for non-gameplay elements and feedback systems.

#### Panel Transitions
```
Appearance:
├── Trigger: Menu open, modal display
├── Motion:
│    ├─ Scale from 0.95 to 1.0 (slight undershoot)
│    ├─ Fade in from 0 to 1 opacity
│    ├─ Optional: directional emergence (from trigger)
│    └─ Content may stagger in slightly after panel
├── Physics: Spring-based with light overshoot
├── Audio: Soft whoosh + subtle content ticks
├── Haptic: Confirmation pulse at completion
├── Duration: 250-350ms
└── Dismissal: Reverse with similar timing

Toast/Snackbar:
├── Trigger: Temporary message display
├── Motion:
│    ├─ Slide up from bottom (or down from top)
│    ├─ Slight undershoot/overshoot at end
│    ├─ Pause for minimum read time
│    └─ Slide out opposite direction
├── Physics: Similar spring system both directions
├── Audio: Soft swipe in/out
├── Haptic: Pulse on appearance + dismissal
├── Duration: 300ms in/out + variable display
└── Swipe Away: Accelerates dismissal with gesture velocity

Loading/Progress:
├── Trigger: Asynchronous operation
├── Motion:
│    ├─ Indeterminate: rotating/pulsing element
│    ├─ Determinate: fill bar or circular progress
│    ├─ Optional: contextual transformation (e.g., dealing cards)
│    └─ Success/error state transitions
├── Physics: Smooth constant velocity or easing
├── Audio: Subtle ticks or continuous tone (optional)
├── Haptic: Light pulse per increment (determinate)
└── Duration: Matches actual operation time
```

#### Feedback Systems
```
Validation Feedback:
├── Valid Action: 
│    ├─ Checkmark: draw + slight scale pop
│    ├─ Green tint pulse (subtle, brief)
│    ├─ Soft chime + light haptic pulse
├── Invalid Action:
│    ├─ Elements shake: X-axis oscillation (3-5px)
│    ├─ Red tint flash (very brief, low opacity)
│    ├─ Buzz sound + sharp haptic pulse
│    ├─ Optional: "error" haptic pattern
├── Duration: 150-250ms for all feedback

Attention Direction:
├── Subtle Glow: Pulsing halo around target
├── Directional Particle: Minor elements flow toward focus
├── Scale Breath: Slow pulse (0.98-1.02 scale)
├── Color Shift: Minor hue/saturation variation
├── Motion Blur: Directional blur suggesting movement
├── Duration: Continues until action or timeout

Celebration Effects:
├── Set Completion:
│    ├─ Cards: slight scale pulse + glow
│    ├─ Set: tiny vertical jump + settle
│    ├─ Background: radial burst fade
│    ├─ Audio: satisfying stack sound + pleasant tone
│    ├─ Haptic: series of 3 decreasing pulses
├── Victory:
│    ├─ Major scale pulse + rotation on winning elements
│    ├─ Confetti or similar particle celebration
│    ├─ Audio: multi-tone triumphant sequence
│    ├─ Haptic: extended pattern with variation
│    └─ Duration: 1000-1500ms
├── Bartender:
│    ├─ Emergence: side slide + slight scale pop
│    ├─ Speech bubble: typewriter + scale fade-in
│    ├─ Audio: distinctive glass clink + vocal line
│    ├─ Haptic: unique pattern (liquid pour sensation)
│    └─ Duration: Based on comment + 500ms buffer
```

### 6. Sequenced & Cinematic Motion
Pre-defined animation sequences for major events.

#### Pre-game Sequence
```
Deck Assembly:
├── Cards: appear one-by-one from edges
├── Motion: slight drift + rotation to center stack
├── Audio: soft paper sounds as cards land
├── Haptic: light pulses with each card
├── Duration: 800ms-1.2s (based on card count)
└── Purpose: Shows deck creation, builds anticipation

Shuffle:
├── Method: Multiple randomized techniques:
│    ├─ Overhand splits (cards cascade between hands)
│    ├─ Riffle interlock (cards interweave from halves)
│    ├─ Hindu shuffle (packets dropped from thumb)
│    └─ Table cuts (packets rearranged on surface)
├── Physics: Each technique uses appropriate card physics
├── Audio: Characteristic sounds for each method
├── Haptic: Varied patterns matching shuffle type
├── Duration: 1500-2500s (feels thorough but not tedious)
└── Purpose: Demonstrates randomization, builds trust

Deal Animation:
├── Method: Realistic dealing from deck top
├── Motion:
│    ├─ Card lifts from deck with thumb friction
│    ├─ Travels in arc to player position
│    ├─ Skeletal rotation during flight (consistent deal)
│    ├─ Lands with slight bounce and settle
├── Physics: Uses card physics with dealer hand simulation
├── Audio: Distinctive deal sound (different from draw)
├── Haptic: Sensation of card leaving then arriving
├── Duration: 300-500ms per card (staggered)
└── Purpose: Clear card distribution, no hidden information

Hand Fan:
├── Trigger: After deal completes
├── Motion:
│    ├─ Cards fan outward from dealt position
│    ├─ Each card finds optimal arc position
│    ├─ May involve intermediate stacking/rearranging
│    └─ Final natural hand position achieved
├── Physics: Spring system with collision avoidance
├── Audio: Soft spreading sound (cards separating)
├── Haptic: Sensation of cards finding positions
├── Duration: 400-600ms (based on hand size)
└── Purpose: Shows final organization, ready for play
```

#### Event Sequences
```
Set Completion Celebration:
├── Trigger: Fourth card acquired
├── Sequence:
│    ├─ Cards: snap together motion (see Set Formation)
│    ├─ New set: slight lift + glow pulse
│    ├─ Completed area: subtle wave effect
│    ├─ Opponent indicator: brief "uh-oh" flash
│    ├─ Potential: bartender check (5-10% chance)
│    └─ Potential: drink event check
├── Audio: Stack sound + rising tone chord
├── Haptic: Building pulse sequence
└── Duration: 600-900ms total

Victory Sequence:
├── Trigger: Game end conditions met
├── Sequence:
│    ├─ Winning cards/sets: elevate + gentle rotation
│    ├─ Losing hand: slight recession/dimming
│    ├─ Table: confetti/celebration elements emerge
│    ├─ Victory banner: emerges from center/bottom
│    ├─ Bartender: major appearance + extended commentary
│    ├─ Player avatars: celebratory expressions/poses
│    ├─ Optional: trophy/cup appearance
│    └─ Background: subtle color/effect shift
├── Audio: Multi-layer triumphant composition
├── Haptic: Extended victory pattern
├── Duration: 3000-5000s (allows savoring victory)
└── Purpose: Clear win recognition, emotional payoff

Bartender Appearance:
├── Trigger: System decision (event-based probability)
├── Sequence:
│    ├─ Audio cue: distinctive glass clink (table edge)
│    ├─ Visual: figure emerges from table side
│    ├─ Motion: side slide + slight elevation
│    ├─ Speech: typewriter effect + bubble emergence
│    ├─ Pause: for reading/comprehension
│    ├─ Exit: reverse motion + liquid sound
│    └─ Table: subtle vibration from "placement"
├── Audio: Glass clink + optional vocal line
├── Haptic: Unique pour/settlement sensation
├── Duration: 2000-4000s (based on comment length)
└── Purpose: Meaningful interruption, personality injection

Drink Event Sequence:
├── Trigger: Drink-triggering game event
├── Sequence:
│    ├─ Table: drink icon pulses/glows
│    ├─ Notification: "Time for a drink!" appears
│    ├─ Optional: specific drink suggestion
│    ├─ User: initiates CV or manual entry
│    ├─ CV: viewfinder with guides + processing feedback
│    ├─ Result: display + confidence indicators
│    ├─ BAC: meter update + state change effects
│    └─ Resume: gameplay continues with updated state
├── Audio: Pour/clink sounds + UI feedback
├── Haptic: Sequence matching drink type/action
├── Duration: Variable (15-45s typical for user action)
└── Purpose: Bridges game and physical world responsibly
```

## Motion Implementation Guidelines

### 1. Animation Frameworks
```
Primary:                 Core Animation / UIKit Dynamics
Physics:                 Custom Chipmunk/Box2D wrapper or Swift Physics
Particle:                SpriteKit or custom Metal particle system
Audio:                   AVAudioEngine with positional audio
Haptic:                  CoreHapticEngine with custom patterns
Performance:             CADisplayLink synchronization
Fallback:                Layer-backed animations for simplicity
```

### 2. Performance Optimization
```
Frame Budgeting:         16ms target, 32ms hard limit
Culling:                 Off-screen animations paused/minimized
Interpolation:           Positional/rotational lerp for network
Batching:                Similar animations combined where possible
Resolution:              Match device capabilities (avoid overdraw)
Memory:                  Texture atlases, object pools for particles
Adaptive:                Reduce complexity on lower-end devices
Priority:                User interaction > system events > background
```

### 3. Consistency & Standards
```
Easing Curves:           Defined in shared constants file
Duration Tables:         Referenced for all animation types
Physics Parameters:      Centralized for consistent behavior
Asset Naming:            Clear conventions for motion assets
Debugging:               Visualization tools for physics/animation
Testing:                 Frame timing validation on target devices
Documentation:           Motion specs included with UI specs
```

### 4. Accessibility in Motion
```
Reduce Motion:           Honor UIAccessibility.isReduceMotionEnabled
                         Replace with: cross-fades, instant transforms
                         Keep: essential feedback, reduce decoration
Alternative Indicators:  Provide non-motion equivalents
                         (color, sound, haptic for critical info)
Seizure Safety:          Avoid flashing >3Hz, limit stroke patterns
                         Provide content warnings where needed
Vestibular:              Limit intense rotation, provide stability options
                         Allow reduction of parallax/depth effects
```

### 5. Testing & Validation
```
Physical Plausibility:   Does motion resemble real-world equivalents?
Temporal Judgment:       Do durations feel appropriate for context?
Consistency Check:       Are similar actions animated similarly?
Performance Audit:       Frame timing, memory impact, battery use
Accessibility Review:    Does motion hinder or help accessibility?
Emotional Impact:        Does motion enhance intended feeling?
Player Feedback:         Observable response to motion characteristics
```

## Motion Specifications by Component

### 1. Card-Specific Motions
```
Card Lift:               3-5mm vertical, 2-5° rotation toward finger
                         Lift: 80ms, Settle: 40ms, Total: 120ms
Card Throw:              Follows finger with realistic drag physics
                         Release velocity preserved, decelerates naturally
                         Rotation: aligns with movement vector
Card Snap:               Converge to center with slight overshoot
                         Overshoot: 10-15%, Settling: 2-3 oscillations
                         Total: 300-500ms based on initial spread
Card Explode:            Radial expulsion with individual spin
                         Launch velocity: 100-300px/s
                         Spread: based on desired final distance
                         Total: 250-400ms
Card Settle:             Natural resting with micro-vibration
                         Amplitude: <0.5px, Frequency: 20-30Hz
                         Duration: infinite (ambient only)
```

### 2. Hand & Table Motions
```
Hand Fan:                Circular arc layout, radius 80-120px
                         Card spacing: dynamic (min 10px gap)
                         Reflow: spring-dampened, 150ms base
Hand Scroll:             Translate along arc path with inertia
                         Deceleration: natural feeling (~500px/s²)
                         Snap-back: if outside bounds, 200-300ms
Table Slide:             Continuous deceleration from initial v
                         Deceleration: μ·g (realistic friction)
                         Stop: no oscillation, immediate rest
Table Drop:              5-10mm fall, 0-2 bounces possible
                         Restitution: 0.1-0.3 per bounce
                         Final slide: based on residual energy
```

### 3. UI & Feedback Motions
```
Panel Appear:            Scale 0.95→1.0 + fade 0→1
                         Overshoot: 0.02-0.05, Settle: 150-200ms
Panel Dismiss:           Reverse of appearance, similar timing
Toast Slide:             300ms in/out + 2000-4000s display
                         Ease: slight overshoot at ends
Validation Pulse:        Scale 1.0→1.05→1.0 (100ms)
                         or position shake: ±3px X-axis (150ms)
Attention Glow:          Opacity 0.3→0.6→0.3 (1500ms cycle)
                         or slow scale pulse 0.98-1.02
Celebration Pop:         Scale 1.0→1.15→1.0 (200-300ms)
                         with optional rotation 5-15°
```

### 4. Sequenced Motions
```
Shuffle:                 Multiple passes of different techniques
                         Overhand: 1-2 packets per hand movement
                         Riffle: approximately 50% interweave
                         Hindu: packets of 5-15 cards
                         Table cuts: 2-4 packets rearranged
Deal:                    Card release similar to throw
                         Flight arc: 20-40° peak height
                         Landing: slight bounce (10-20% rebound)
Pre-game Total:          2000-3500ms (assembly+shuffle+deal+fan)
Victory Total:           3000-5000s (allowing full celebration)
Bartender:               Emergence: 300ms, Speech: variable
                         Exit: 300ms, Total: 1500-3500ms + speech
```

## Technical Implementation Notes

### 1. Coordinated Systems
```
Physics ↔ Rendering:     Fixed timestep physics (60Hz) → interpolation
                         Render loop interpolates for smooth visuals
Audio ↔ Physics:         Events trigger based on physics state
                         (collision, velocity thresholds, etc.)
Haptic ↔ Audio:          Patterns designed to complement audio events
                         Shared intensity/duration parameters
Network ↔ Local:         Client-side prediction with server reconciliation
                         Lerp for smooth remote object movement
```

### 2. Asset Management
```
Animation Curves:        Defined as reusable CAAnimationGroup presets
Physics Materials:       Shared definitions for card/table/hand particles
Audio Samples:           Categorized by type (UI, game, event, ambient)
Haptic Patterns:         Custom CHHapticEvent sequences in asset catalog
Particle Systems:        Reusable emitters with parameter overrides
```

### 3. Debugging & Instrumentation
```
Physics Visualization:   Optional overlay showing bounds/velocities
Animation Profiling:     Frame timing breakdown by system
Network Simulation:      Artificial latency/jitter for testing
Device Variation:        Test across performance spectrum
Accessibility Tools:     Validate with reduced motion, VoiceOver, etc.
```

### 4. Fallback Strategies
```
Reduce Motion:           Cross-fade instead of slide/scale
                         Instant transform instead of spring
                         Haptic/audio feedback preserved
Low Power:               Simplify physics (fewer iterations)
                         Reduce particle counts
                         Lower animation frame rate (30fps target)
                         Disable secondary motions
Legacy Support:          Abstract animation system allows easy substitution
                         Core Graphics fallback for simple transitions
                         UIView.animate for basic motions
```

## Motion Design Principles Summary

### 1. Core Tenets
```
Physics-Based:          Motion follows recognizable physical laws
Explanatory:            Movement reveals causality and state changes
Luxurious:              Refined, subtle, never cartoonish or excessive
Purposeful:             Every motion serves communication or feedback
Consistent:             Similar actions use similar motion patterns
Accessible:             Honors user preferences and provides alternatives
Performant:             Respects frame budgets and device limitations
```

### 2. Motion as Communication
```
Origin:                 Show where things came from
Cause:                  Reveal why something happened
Effect:                 Display what changed as a result
State:                  Indicate current condition clearly
Readiness:              Prepare user for what's possible next
```

### 3. Quality Indicators
```
Natural:                Resembles real-world physical equivalents
Clear:                  Intent understandable without explanation
Pleasant:               Enjoyable to experience, not annoying
Informative:            Communicates useful system information
Responsive:             Matches user input with appropriate feedback
Memorable:              Distinctive characteristics aid recall
```

---
*This Motion System document completes Phase 4 of the GFY Master Orchestrator Prompt. It defines how movement, animation, and physics create a premium, tactile experience that feels like manipulating physical cards on a luxury tabletop surface, with every motion serving to explain system state and provide rich feedback.*