# Shared game rules (boundary)

Authoritative rules live in `frontend/js/game.js`, `frontend/js/bac.js`, `frontend/js/card-categories.js`, `frontend/js/questionnaire.js`.

The Node server imports these modules directly (`game/lib/rooms.js`). A future step is to move copies here and publish a single package — until then, **do not fork rule logic**.
