# GO FUCK YOURSELF (GFY) - Product Requirements Document

## Executive Summary
GFY is a premium two-player iOS mobile card game that combines Go Fish mechanics with relationship roast simulator elements, drinking game mechanics, AI bartender narration, and personalized content generation. The game focuses on delivering a luxurious, tactile experience that feels like sitting at a high-end card table with an observant, sarcastic AI bartender.

## Core Game Concept
A luxury two-player card game where players:
- Play a variant of Go Fish with personalized card decks
- Complete 4-card sets to earn titles and trigger events
- Interact with an AI bartender who provides commentary based on game events and player history
- Participate in drinking game mechanics triggered by specific game events
- Generate personalized cards based on shared experiences, inside jokes, and relationship lore

## Target Audience
- Adults 21+ (due to drinking game elements)
- Couples, close friends, or siblings with shared history
- Players who enjoy dark humor, inside jokes, and playful ribbing
- Fans of premium mobile experiences and physical card games
- Users interested in AI-powered personalized experiences

## Core Gameplay Loop

### Setup Phase
1. Players complete a personalized questionnaire (names, height, weight, favorite drinks, personality traits, recurring jokes, shared stories, habits, catchphrases)
2. System generates personalized card decks based on questionnaire responses
3. Deck is shuffled and cards are dealt to both players
4. Initial game state is displayed with luxurious animations

### Gameplay Phase
1. Players take turns asking opponent for specific cards to complete sets
2. Cards are transferred between hands when requested
3. When a player completes a 4-card set:
   - Set is moved to their completed sets area
   - AI bartender may provide commentary (5-10% of set completions)
   - Drink events may be triggered
   - Visual/audio feedback celebrates the completion
4. Game continues until draw pile is exhausted
5. Player with most completed sets wins

### Win Conditions
- Primary: Player with most completed 4-card sets wins
- Tiebreaker: Most valuable sets (based on rarity or special properties)
- Special victory conditions may exist for certain card combinations

## Key Systems

### 1. Card System
- Cards organized into collections (Drinking, Museum, Music, Money, Relationship, Chaos, etc.)
- Each set requires 4 matching cards from the same collection
- Cards feature personalized content based on player questionnaire responses
- Physical card feel with textures, weight simulation, and premium materials
- Completed sets displayed as physical stacks that can be "exploded" to view constituent cards

### 2. AI Bartender System
- Powered by NVIDIA NIM hosted LLM
- Personality: Drunk casino bartender - sarcastic, observant, remembers history, uses profanity frequently
- Appears only during meaningful moments (set completion, huge draws, bluffs, comebacks, victories, drink events)
- Target appearance rate: 5-10% of game events
- Uses player profile data to generate personalized commentary
- Features glass clink audio cue when arriving
- Maintains conversation memory across game sessions

### 3. Drinking System & BAC Tracking
- Certain game events trigger drink requirements (successful bluff, losing challenges, bartender challenges, special cards)
- Players submit photos of their drinks for verification
- Computer vision system (NVIDIA vision model) identifies drink type and estimates serving size
- BAC system tracks drinks consumed, estimates BAC based on height/weight from questionnaire, and factors in time elapsed
- BAC displayed as elegant visualization with states: Sober, Buzzed, Tipsy, Drunk, Very Drunk
- Drink logging happens automatically via computer vision

### 4. Multiplayer Architecture
- Real-time two-player synchronous gameplay
- Turn-based with clear visual indicators of whose turn it is
- Secure connection preventing cheating or information leakage
- Reconnection handling for dropped connections
- Session persistence for games that span multiple play sessions

### 5. Personalization Engine
- Pre-game questionnaire collects detailed player information
- Generates unique card content for each player pairing
- Creates inside-joke cards based on shared stories and recurring themes
- Adapts AI bartender commentary to player personalities and history
- remembers past games and references ongoing jokes or patterns

## User Experience Requirements

### Visual Design
- Premium materials aesthetic (like Apple Card meets luxury poker chips)
- Generous whitespace and minimal chrome
- Large, readable typography following Dynamic Type principles
- Depth through motion and subtle shadows
- Physical card simulation with textures, rounded corners, and inertial drag
- Natural hand fanning for card inspection
- Stack-based display for completed sets
- Elegant BAC meter visualization
- Avatar system for player representation

### Interaction Design
- Primary actions clearly visible and accessible
- Touch targets minimum 44x44pt following Apple HIG
- Gestures: tap to inspect, hold to lift, drag to play
- Horizontal swipe to browse hand
- Physics-based card movements with lift on touch, shadow deepening, rotation following finger
- Spring animations for settling states
- Haptic feedback for meaningful interactions
- Accessibility support including VoiceOver, dynamic type, and color blindness considerations

### Audio Design
- Luxury tabletop experience - no arcade sounds
- Distinctive sounds for: shuffle, deal, draw, transfer, set complete, victory, bartender arrival
- Bartender arrival: recognizable glass clink
- Ambient table sounds subtle and not distracting
- Spatial audio positioning for multiplayer feel
- Adaptive volume based on game state

### Motion Design
- Pre-game sequence: deck assembly, full shuffle, dealing animation, hand fan animation
- Never instant renders - every state change has explanatory motion
- Motion explains system state and provides feedback
- Physics-based card behavior matching real-world properties
- Fluid transitions between game states
- Subtle parallax effects for depth perception

## Technical Requirements

### Platform & Performance
- Native iOS application (iPhone optimized)
- Minimum iOS version: iOS 16
- Target devices: iPhone 12 and newer
- 60 FPS target for animations
- Efficient memory usage (<150MB typical)
- Quick launch time (<2 seconds)
- Offline capability for single-player practice mode

### Data & Storage
- Local storage of player profiles and game history
- Secure handling of personal information from questionnaires
- Optional cloud sync for cross-device play (future)
- Game session persistence for interrupted plays
- Analytics collection (opt-in) for improvement

### Security & Privacy
- End-to-end encryption for multiplayer communications
- Secure handling of drink photos (temporary processing, not stored unless opted-in)
- Clear privacy policy explaining data usage
- GDPR/CCPA compliance for data handling
- No collection of sensitive personal information beyond game-relevant data

### Integration Points
- NVIDIA NIM API for AI bartender LLM
- NVIDIA vision API for drink detection
- Apple GameKit for multiplayer networking (optional)
- Apple HealthKit for optional health data integration (future)
- Accessibility frameworks for inclusive design

## Success Metrics

### Engagement Metrics
- Average session length > 15 minutes
- Retention: 40% day 7, 20% day 30
- Social sharing rate > 15% of completed games
- Average games per user per week > 3

### Quality Metrics
- App Store rating > 4.5 stars
- Crash rate < 0.5%
- Apple HIG compliance score > 90%
- Accessibility audit pass rate > 95%

### Business Metrics
- Conversion rate (free to paid) > 8% (if freemium model)
- Average revenue per user > $2/month (if subscription)
- Referral rate > 10% of active users

## Assumptions & Dependencies

### Technical Assumptions
- NVIDIA NIM and vision APIs will be available and reliable
- Device cameras sufficient for drink detection
- Multiplayer networking can maintain low latency
- Sufficient on-device processing for AI features locally if needed

### Content Assumptions
- Players will engage honestly with questionnaire for personalization
- Shared history content will be appropriate for game context
- Drink submission system will be used responsibly

### Risks & Mitigations
- Risk: AI bartender generates inappropriate content
  Mitigation: Content filtering, user reporting, adjustable profanity levels
  
- Risk: Drinking mechanics promote unsafe behavior
  Mitigation: Clear disclaimers, BAC tracking for awareness, non-alcoholic drink options
  
- Risk: Personalization feels invasive
  Mitigation: Transparent data usage, easy opt-out, data deletion controls
  
- Risk: Technical complexity impacts performance
  Mitigation: Progressive enhancement, performance budgets, optimization phases

## Future Enhancements
- Tournament modes with leaderboards
- Additional card collections and expansion packs
- Cross-platform play (iPad, Apple TV)
- Spectator modes for shared viewing
- Achievement systems and badges
- Seasonal content and limited-time events
- Voice chat integration for remote play
- Physical card deck companion product

## Compliance Requirements
- Apple App Store guidelines compliance
- Apple Human Interface Guidelines adherence
- Accessibility compliance (WCAG 2.1 AA)
- Data protection regulations (GDPR, CCPA)
- Responsible gambling/drinking guidelines where applicable
- Age gating for alcohol-related content (21+)

---
*This document represents the complete product requirements for Phase 1 of the GFY Master Orchestrator Prompt. All subsequent phases will build upon this foundation.*