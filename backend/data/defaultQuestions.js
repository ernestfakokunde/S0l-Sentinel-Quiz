export const defaultQuestions = [
  {
    topic: 'Solana Basics',
    text: 'What is a PDA in Solana?',
    choices: [
      'Program Derived Address',
      'Private Deterministic Account',
      'Public Derived Account',
      'Program Data Address',
    ],
    answerIdx: 0,
    difficulty: 1,
  },
  {
    topic: 'Solana Basics',
    text: 'What unit is used to measure the smallest amount of SOL?',
    choices: ['Lamport', 'Gwei', 'Satoshi', 'Wei'],
    answerIdx: 0,
    difficulty: 1,
  },
  {
    topic: 'Solana Basics',
    text: 'Which program verifies Ed25519 signatures on Solana?',
    choices: ['Ed25519 Program', 'System Program', 'Memo Program', 'Stake Program'],
    answerIdx: 0,
    difficulty: 2,
  },
  {
    topic: 'Solana Basics',
    text: 'What does an escrow account hold during a paid match?',
    choices: ['Player deposits', 'Frontend source code', 'Question images', 'WebSocket sessions'],
    answerIdx: 0,
    difficulty: 1,
  },
  {
    topic: 'Solana Basics',
    text: 'Why should quiz answers stay off-chain during live gameplay?',
    choices: ['To keep gameplay fast and cheap', 'Because Solana cannot store data', 'Because wallets cannot sign', 'To avoid using WebSockets'],
    answerIdx: 0,
    difficulty: 1,
  },
  {
    topic: 'Solana Basics',
    text: 'Which service should be authoritative for live quiz scoring?',
    choices: ['Backend server', 'Frontend client', 'Wallet adapter', 'Block explorer'],
    answerIdx: 0,
    difficulty: 1,
  },
  {
    topic: 'Solana Basics',
    text: 'What should the Solana program verify before paying a winner?',
    choices: ['A valid backend result signature', 'The browser URL', 'The player nickname', 'The CSS theme'],
    answerIdx: 0,
    difficulty: 2,
  },
  {
    topic: 'Solana Basics',
    text: 'What prevents a result blob from being reused for another match?',
    choices: ['Including the match ID in the signed payload', 'Changing the frontend color', 'Using a longer timer', 'Sending answers twice'],
    answerIdx: 0,
    difficulty: 2,
  },
];

