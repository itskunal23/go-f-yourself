/** Game mode definitions — extensible registry. */

const TRUTHS = [
  'What is your most embarrassing hookup story?',
  'Who in this room would you kiss right now?',
  'What is the wildest thing on your bucket list?',
  'Have you ever lied to get someone into bed?',
  'What is your biggest turn-on nobody knows about?',
  'Who was your worst kiss ever?',
  'What is the dumbest thing you have done while drunk?',
  'What secret are you keeping from someone here?',
];

const DARES = [
  'Do your best seductive dance for 15 seconds.',
  'Whisper the filthiest thing you would do to your partner tonight.',
  'Pull the ugliest face you can for 5 seconds — group judges.',
  'Swap an item of clothing with the person to your left.',
  'Serenade the person the bottle landed on.',
  'Speak in an accent for the next 3 rounds.',
  'Let someone draw on your face with marker.',
  'Do 10 pushups or take a drink.',
];

const PARTY = [
  'Everyone drinks except the spinner!',
  'The two people closest to the bottle neck kiss — or both drink.',
  'Create a new rule that lasts until someone breaks it.',
  'Waterfall! Keep drinking until the person to your right stops.',
  'Categories: name types of beer — loser drinks.',
  'Thumb master! Last to put thumb on table drinks.',
  'Never have I ever — point at guilty players, they drink.',
  'The spinner picks two people for a challenge.',
];

const CHALLENGES = [
  'Balance a cup on your head for 30 seconds.',
  'Name 5 countries in 10 seconds or drink.',
  'Beat the spinner at rock-paper-scissors — loser drinks.',
  'Hold a plank for 45 seconds.',
  'Recite the alphabet backwards.',
  'Do your best celebrity impression.',
  'Keep a straight face while everyone tries to make you laugh.',
  'Give your partner a 10-second lap dance — or finish your drink.',
];

export const MODES = {
  party: {
    id: 'party',
    name: 'Party Mode',
    icon: '🎉',
    description: 'Roasts, chaos, punishments — the full experience.',
    getPrompt(spinner, target) {
      const text = PARTY[Math.floor(Math.random() * PARTY.length)];
      return { type: 'party', text: `🎉 ${text}`, highlight: target.name };
    },
  },
  classic: {
    id: 'classic',
    name: 'Classic Spin',
    icon: '🍾',
    description: 'Spin the bottle. Whoever it lands on gets picked.',
    getPrompt(spinner, target) {
      if (spinner.id === target.id) {
        return { type: 'classic', text: `${target.name}, the bottle chose YOU. Awkward. Take a drink.` };
      }
      return {
        type: 'classic',
        text: `${spinner.name} spun — ${target.name} was chosen! Make your move.`,
      };
    },
  },
  truth: {
    id: 'truth',
    name: 'Truth or Dare',
    icon: '🎭',
    description: 'Land on someone — they pick truth or dare.',
    getPrompt(spinner, target) {
      const isTruth = Math.random() > 0.5;
      const pool = isTruth ? TRUTHS : DARES;
      const text = pool[Math.floor(Math.random() * pool.length)];
      return {
        type: isTruth ? 'truth' : 'dare',
        text: `${target.name}: ${isTruth ? 'TRUTH' : 'DARE'} — ${text}`,
        choice: isTruth ? 'truth' : 'dare',
      };
    },
  },
  custom: {
    id: 'custom',
    name: 'Custom Questions',
    icon: '✏️',
    description: 'Use your own question deck.',
    customQuestions: [],
    getPrompt(spinner, target) {
      const qs = MODES.custom.customQuestions;
      const text =
        qs.length > 0
          ? qs[Math.floor(Math.random() * qs.length)]
          : `${target.name}, add custom questions in settings!`;
      return { type: 'custom', text: `${target.name}: ${text}` };
    },
  },
  challenge: {
    id: 'challenge',
    name: 'Random Challenge',
    icon: '⚡',
    description: 'Random mini-challenges for the chosen player.',
    getPrompt(spinner, target) {
      const text = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
      return { type: 'challenge', text: `${target.name}: ${text}` };
    },
  },
};

export function getModeList() {
  return Object.values(MODES);
}

export function setCustomQuestions(questions) {
  MODES.custom.customQuestions = questions.filter(Boolean);
}

export { TRUTHS, DARES, PARTY, CHALLENGES };
