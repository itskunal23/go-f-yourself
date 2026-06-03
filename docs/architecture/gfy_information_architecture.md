# GO FUCK YOURSELF (GFY) - Information Architecture

## Overview
This document defines the information architecture for GFY, detailing how data is organized, structured, and flowed throughout the application. The IA focuses on creating a clear, intuitive structure that supports the premium experience while managing the complexity of personalized content, multiplayer state, and game mechanics.

## Core Data Models

### 1. Player Profile
Stores persistent information about each player used for personalization and game generation.

```json
{
  "playerId": "string (UUID)",
  "displayName": "string",
  "avatarUrl": "string (optional)",
  "physicalStats": {
    "heightCm": "number",
    "weightKg": "number"
  },
  "preferences": {
    "favoriteDrinks": "string[]",
    "personalityTraits": "string[]",
    "communicationStyle": "enum (sarcastic, wholesome, dark, mixed)"
  },
  "history": {
    "sharedStories": "string[]",
    "insideJokes": "string[]",
    "catchphrases": "string[]",
    "habits": "string[]",
    "relationshipMilestones": "string[] (for couples)"
  },
  "gameStats": {
    "totalGamesPlayed": "number",
    "totalWins": "number",
    "favoriteCollections": "string[]",
    "averageSetsPerGame": "number",
    "bstRecord": "number (best streak)"
  },
  "privacySettings": {
    "dataSharing": "boolean",
    "drinkPhotoStorage": "boolean",
    "profanityLevel": "enum (none, mild, moderate, high)",
    "contentFilters": "string[]"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastActive": "timestamp"
}
```

### 2. Game Session
Represents a single game instance between two players.

```json
{
  "sessionId": "string (UUID)",
  "player1Id": "string (references PlayerProfile.playerId)",
  "player2Id": "string (references PlayerProfile.playerId)",
  "gameState": {
    "phase": "enum (setup, gameplay, completed)",
    "currentTurnPlayerId": "string",
    "deck": "Card[]",
    "player1Hand": "Card[]",
    "player2Hand": "Card[]",
    "player1CompletedSets": "Set[]",
    "player2CompletedSets": "Set[]",
    "discardPile": "Card[]",
    "drawPile": "Card[]"
  },
  "bacTracking": {
    "player1": {
      "drinksConsumed": "number",
      "estimatedBAC": "number",
      "lastDrinkTime": "timestamp",
      "currentState": "enum (sober, buzzed, tipsy, drunk, veryDrunk)"
    },
    "player2": {
      "drinksConsumed": "number",
      "estimatedBAC": "number",
      "lastDrinkTime": "timestamp",
      "currentState": "enum (sober, buzzed, tipsy, drunk, veryDrunk)"
    }
  },
  "events": "GameEvent[]", // Chronological list of significant game events
  "personalizationData": {
    "usedInsideJokes": "string[]",
    "generatedCards": "CardId[]",
    "bartenderContext": "string[]"
  },
  "metadata": {
    "startTime": "timestamp",
    "endTime": "timestamp (null if ongoing)",
    "durationSeconds": "number",
    "version": "string (app version)",
    "platform": "string (device model)"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 3. Card
Represents a single game card with potential personalization.

```json
{
  "cardId": "string (UUID)",
  "collection": "enum (drinking, museum, music, money, relationship, chaos, etc.)",
  "baseContent": {
    "title": "string",
    "description": "string",
    "icon": "string (SF Symbol name or custom)",
    "rarity": "enum (common, uncommon, rare, epic, legendary)"
  },
  "personalization": {
    "isPersonalized": "boolean",
    "personalizedTitle": "string (optional override)",
    "personalizedDescription": "string (optional override)",
    "sourceData": "string[] (references player profile fields used)",
    "generationPrompt": "string (used to create this variant)"
  },
  "visualProperties": {
    "backgroundColor": "string (hex)",
    "textColor": "string (hex)",
    "borderStyle": "string",
    "texture": "string (paper type reference)",
    "cornerRadius": "number"
  },
  "mechanicalProperties": {
    "weight": "number (simulated grams)",
    "flexibility": "number (0-1 scale)",
    "surfaceFriction": "number (0-1 scale)"
  },
  "createdAt": "timestamp",
  "generatedForSessionId": "string (optional, references GameSession.sessionId)"
}
```

### 4. Set
Represents a completed 4-card collection.

```json
{
  "setId": "string (UUID)",
  "collection": "string (references Card.collection)",
  "cards": "CardId[] (exactly 4)",
  "ownerPlayerId": "string (references PlayerProfile.playerId)",
  "completionTime": "timestamp",
  "setTitle": "string (unlocked upon completion)",
  "setDescription": "string (flavor text)",
  "isExploded": "boolean (visual state - whether cards are fanned out)",
  "specialProperties": "string[] (any bonus effects)",
  "createdAt": "timestamp"
}
```

### 5. Game Event
Represents significant occurrences during gameplay that may trigger bartender commentary, drink events, or other effects.

```json
{
  "eventId": "string (UUID)",
  "sessionId": "string (references GameSession.sessionId)",
  "timestamp": "timestamp",
  "type": "enum (
    setComplete,
    successfulBluff,
    failedBluff,
    drawFour,
    opponentDrawFour,
    comebackStart,
    victory,
    drinkTriggered,
    bartenderAppearance,
    specialCardPlayed,
    reconnection,
    questionnaireComplete
  )",
  "playerId": "string (references PlayerProfile.playerId, optional)",
  "relatedCardId": "string (references Card.cardId, optional)",
  "relatedSetId": "string (references Set.setId, optional)",
  "data": "object (type-specific payload)",
  "bartenderCommentary": "string (generated if applicable)",
  "drinkTriggered": "boolean",
  "processed": "boolean"
}
```

## Data Flow Architecture

### 1. Initialization Flow
```
Player Profile Creation/Loading
         ↓
Questionnaire Session (if new/incomplete)
         ↓
Profile Storage & Personalization Seed Generation
         ↓
Deck Generation Based on Player Profiles
         ↓
Game Session Creation
         ↓
Initial Deal & State Setup
         ↓
Pre-game Animation Sequence
         ↓
Ready for First Turn
```

### 2. Gameplay Turn Flow
```
Player Turn Start Indicator
         ↓
Card Selection (tap to inspect, hold to lift)
         ↓
Request Specific Card from Opponent
         ↓
Validation: Does opponent have requested card?
         ├─ Yes: Transfer card, check for set completion
         └─ No: Draw from pile, turn ends
         ↓
If card transferred:
         ├─ Check if set completed (4 of same collection)
         │  ├─ Yes: Move set to completed area, trigger events
         │  └─ No: Turn continues (can ask again)
         └─ Turn ends after action
         ↓
Event Processing:
         ├─ Set completion → potential bartender commentary, drink check
         ├─ Special card effects → immediate resolution
         └─ Turn timeout → auto-pass
         ↓
State Persistence & Opponent Notification
         ↓
Opponent Turn Begin
```

### 3. Personalization Data Flow
```
Questionnaire Responses
         ↓
Player Profile Storage
         ↓
Pre-game: Personalization Engine Analysis
         ↓
Identify: Shared stories, inside jokes, traits, preferences
         ↓
Generate: Custom card prompts for relevant collections
         ↓
Create: Personalized card variants (cached for session)
         ↓
Integrate: Into shuffled deck
         ↓
During Game: Track usage of personalized content
         ↓
Post-game: Update profile with new shared moments
```

### 4. AI Bartender Interaction Flow
```
Game Event Occurs
         ↓
Event Type Evaluation (setComplete, victory, etc.)
         ↓
Probability Check (5-10% base rate)
         ↓
If Selected for Commentary:
         ↓
Context Assembly:
         ├─ Player profiles (both)
         ├─ Current game state
         ├─ Event specifics
         ├─ Recent game history (last 3-5 events)
         ├─ Personalization data used this session
         └─ Ongoing joke/reference tracking
         ↓
Prompt Generation for NVIDIA NIM
         ↓
LLM Call: Generate bartender commentary
         ↓
Post-processing: Apply profanity filters, length limits
         ↓
Storage: Add to game events with commentary
         ↓
Trigger: Audio cue (glass clink) + visual presentation
         ↓
Display: Bartender UI with commentary
         ↓
Optional: Player reaction tracking (for future tuning)
```

### 5. Drink Tracking Flow
```
Drink-triggering Event Occurs
         ↓
Notification: "Time for a drink!"
         ↓
Player Action: Take photo of drink
         ↓
Computer Vision Processing:
         ├─ Drink type classification (beer, wine, cocktail, etc.)
         ├─ Serving size estimation (based on glass type, fill level)
         ├─ Alcohol content estimation (if determinable)
         └─ Confidence scoring
         ↓
Result Validation:
         ├─ High confidence → Auto-log drink
         ├─ Medium confidence → Confirmation prompt
         └─ Low confidence → Manual entry fallback
         ↓
BAC Update:
         ├─ Calculate alcohol units from drink
         ├─ Apply time decay based on last drink
         ├─ Update BAC estimate using Widmark formula
         ├─ Determine new BAC state (sober→buzzed etc.)
         └─ Trigger state change effects if applicable
         ↓
Persistence: Store drink log in game session
         ↓
Feedback: Visual BAC meter update + optional haptic cue
```

## Information Organization Principles

### 1. Separation of Concerns
- **Player Data**: Persistent across games, stored in player profiles
- **Session Data**: Temporary, exists only for game duration
- **Game Mechanics**: Rules-driven, minimally stored (deriveable from state)
- **Personalization**: Generated on-demand, cached per session
- **Events & History**: Chronological audit trail for gameplay and personalization

### 2. Data Minimization & Privacy
- Only store essential personalization data
- Drink photos processed immediately, not retained unless explicitly permitted
- Personal data used solely for in-experience personalization
- Clear opt-in/out for data sharing and analytics
- GDPR/CCPA compliant data deletion mechanisms

### 3. Performance Optimization
- Player profiles: Small, frequently accessed → memory-mapped or cached
- Game sessions: Medium size, active only during play → efficient serialization
- Card definitions: Large but static → bundled resources with dynamic overrides
- Events: Append-only log → efficient storage with pagination for history
- Personalization: Generated lazily, cached per session → reduces upfront cost

### 4. Scalability Considerations
- Horizontal scaling possible for multiplayer matchmaking
- Personalization generation can be offloaded to background queues
- Event storage can be archived post-game for analytics
- Player profiles designed for minimal footprint even with extensive history
- Card collections can be expanded without breaking existing saves

## Cross-Reference Systems

### 1. Questionnaire → Personalization Mapping
```
Height/Weight → BAC calculation foundation
Favorite Drinks → Drink event probability modifiers
Personality Traits → AI bartender tone adjustments
Shared Stories → Inside-joke card generation seeds
Catchphrases → Personalized card text variations
Habits → Predictive bartender commentary triggers
Relationship Milestones → Special collection unlock conditions
```

### 2. Card Collections → Game Mechanics
```
Drinking Collection → Higher drink trigger probability
Museum Collection → Intellectual humor, lower profanity baseline
Music Collection → Rhythm-based audio effects, tempo influences
Money Collection → Stakes modifiers, victory celebration intensity
Relationship Collection → Personalization density, emotional resonance
Chaos Collection → Unpredictable effects, rule modifiers, wild cards
```

### 3. Event Types → System Triggers
```
Set Complete → Potential bartender commentary, visual celebration
Successful Bluff → Drink trigger probability increase, taunt opportunity
Failed Bluff → Self-drink penalty, opponent advantage
Draw Four → Significant game shift, high bartender appearance chance
Comeback Start → Encouraging bartender commentary, momentum shift
Victory → Major bartender appearance, trophy animation, stats update
Drink Triggered → Camera activation, CV processing, BAC update
Special Card Played → Immediate effect resolution, potential chain reactions
```

## Security & Integrity Measures

### 1. Anti-Cheating Protections
- Card possession verified server-authoritative in multiplayer
- Turn timing prevents information leakage through delays
- Random number generation seeded securely for shuffles
- Session validation prevents replay attacks
- Client-side prediction reconciled with server state

### 2. Data Integrity
- Session state checksums for corruption detection
- Personalization derivation traceable to source profile data
- Game event chain ensures causality preservation
- Backup saves for recovery from interruptions
- Versioning for forward/backward compatibility

### 3. Privacy Protections
- End-to-end encryption for multiplayer communications
- Local processing of sensitive data (drink photos, personal stats)
- Clear data lineage tracing for audit purposes
- Automatic expiration of temporary data (session logs after period)
- User-accessible data export and deletion controls

## Implementation Guidelines

### 1. Storage Strategies
- **Player Profiles**: Encrypted Core Data / SQLite with CloudKit sync option
- **Game Sessions**: Temporary storage in Documents folder, auto-cleanup
- **Card Definitions**: Bundle resources + dynamic overrides in Documents
- **Event Logs**: Append-only file per session with periodic compaction
- **Personalization Cache**: In-memory with disk overflow for large sessions

### 2. Data Synchronization
- Multiplayer: Real-time state delta propagation with reconciliation
- Cross-device: Optional iCloud sync for profiles and preferred settings
- Backup: Encrypted local backups with user-controlled frequency
- Analytics: Opt-in, anonymized, batch-transmitted

### 3. Versioning & Migration
- Schema versioning for all persistent data models
- Automatic lightweight migration between compatible versions
- Explicit user action required for breaking changes
- Data preservation priority over schema purity during migration
- Clear documentation of data evolution paths

## Accessibility Considerations

### 1. Data Representation
- All critical game state available through accessibility properties
- Personalization content respects Dynamic Type settings
- Color-independent communication of game state (shapes, symbols, motion)
- Audio cues complemented by haptic and visual feedback
- Reduced motion options for animation-heavy states

### 2. Interaction Adaptation
- Alternative input methods for card selection (switch control, voice)
- Adjustable timing for time-sensitive elements
- Simplified personalization options for cognitive load reduction
- Consistent navigation patterns throughout IA-defined screens
- Clear error states with actionable recovery paths

### 3. Content Accessibility
- Profanity filters configurable for accessibility needs
- Content warnings for potentially sensitive personalization
- Alternative text descriptions for all visual personalization
- Adjustable complexity settings for card collections
- Language localization hooks built into personalization system

---
*This Information Architecture document completes Phase 2 of the GFY Master Orchestrator Prompt. It provides the structural foundation for all subsequent phases including interaction design, motion systems, and technical implementation.*