const topicQuestions = {
  'Solana Ecosystem': [
    ['What consensus innovation is Solana best known for?', ['Proof of History', 'Proof of Authority', 'Proof of Burn', 'Proof of Space'], 0],
    ['What is the smallest unit of SOL called?', ['Lamport', 'Gwei', 'Satoshi', 'Wei'], 0],
    ['Which Solana feature lets programs sign for deterministic addresses?', ['Program Derived Addresses', 'Vote Credits', 'Memo Accounts', 'Stake Pools'], 0],
    ['Which account usually pays transaction fees?', ['The fee payer', 'The validator', 'The token mint', 'The block leader'], 0],
    ['What does rent exemption help an account avoid?', ['Being reclaimed for low balance', 'Paying swap fees', 'Needing a wallet', 'Changing ownership'], 0],
    ['Which program creates normal wallet-owned accounts?', ['System Program', 'Token Metadata Program', 'Compute Budget Program', 'Address Lookup Program'], 0],
  ],
  'Crypto History': [
    ['Bitcoin launched publicly in which year?', ['2009', '2011', '2014', '2017'], 0],
    ['Who published the Bitcoin whitepaper?', ['Satoshi Nakamoto', 'Vitalik Buterin', 'Hal Finney', 'Nick Szabo'], 0],
    ['Ethereum mainnet launched in which year?', ['2015', '2012', '2018', '2020'], 0],
    ['What event is commonly called Bitcoin Pizza Day?', ['A 10,000 BTC pizza purchase', 'The first Bitcoin block', 'The first ETF filing', 'A mining reward halving'], 0],
    ['The DAO hack is most associated with which chain?', ['Ethereum', 'Solana', 'Litecoin', 'Monero'], 0],
    ['What is a halving?', ['A scheduled block reward reduction', 'A wallet split', 'A bridge upgrade', 'A token burn vote'], 0],
  ],
  'DeFi Fundamentals': [
    ['What does AMM stand for?', ['Automated Market Maker', 'Approved Mint Manager', 'Asset Mining Module', 'Account Market Memo'], 0],
    ['What does TVL measure?', ['Total Value Locked', 'Token Velocity Limit', 'Transaction Validator Load', 'Treasury Vote Ledger'], 0],
    ['What is slippage?', ['Price movement between quote and execution', 'A wallet disconnect', 'A failed signature', 'A staking reward'], 0],
    ['Which action provides liquidity to an AMM pool?', ['Depositing token pairs', 'Burning NFTs', 'Voting on validators', 'Creating a blockhash'], 0],
    ['What is liquidation in lending markets?', ['Selling collateral after risk limits are breached', 'Minting governance tokens', 'Closing a browser tab', 'Refreshing an oracle'], 0],
    ['Why do DeFi apps use oracles?', ['To read external prices', 'To sign wallet messages', 'To draw charts', 'To compress NFTs'], 0],
  ],
  'NFT Markets': [
    ['What does NFT stand for?', ['Non-Fungible Token', 'New Fee Transaction', 'Native Fungible Token', 'Network Finality Tick'], 0],
    ['What is a collection floor price?', ['The lowest listed price in a collection', 'The highest last sale', 'The mint authority fee', 'The validator commission'], 0],
    ['What does rarity usually describe?', ['Trait scarcity within a collection', 'Wallet age', 'Block speed', 'Token decimals'], 0],
    ['What is minting an NFT?', ['Creating the token on-chain', 'Deleting metadata', 'Approving a validator', 'Splitting a pool'], 0],
    ['What does metadata usually include?', ['Name, image, and attributes', 'Only the private key', 'Validator votes', 'Compute unit price'], 0],
    ['Why can royalties be hard to enforce?', ['Marketplaces can implement them differently', 'NFTs cannot have images', 'Wallets cannot hold NFTs', 'Blocks have no timestamps'], 0],
  ],
  'Web3 Development': [
    ['What is a wallet signature used for?', ['Proving control of an address', 'Increasing monitor brightness', 'Changing CSS', 'Creating DNS records'], 0],
    ['What should a dapp never ask users to reveal?', ['Seed phrase', 'Public address', 'Display name', 'Favorite topic'], 0],
    ['What is an RPC endpoint?', ['A server interface for blockchain reads and writes', 'A password manager', 'A frontend color token', 'A browser cookie'], 0],
    ['Why validate backend payloads?', ['Clients and network data are untrusted', 'It changes font weight', 'It removes all fees', 'It creates free SOL'], 0],
    ['What does optimistic UI mean?', ['Updating UI before confirmation while tracking status', 'Ignoring errors forever', 'Signing every transaction automatically', 'Skipping all tests'], 0],
    ['Which transport is useful for live games?', ['WebSocket', 'JPEG', 'CSV', 'Markdown'], 0],
  ],
  'Blockchain Tech': [
    ['What is a block?', ['A batch of ordered transactions', 'A wallet avatar', 'A browser tab', 'A token icon'], 0],
    ['What is finality?', ['Confidence that a transaction will not be reverted', 'A CSS property', 'A username rule', 'An NFT trait'], 0],
    ['What does a validator do?', ['Participates in consensus and block production', 'Stores passwords for users', 'Writes frontend copy', 'Chooses token logos'], 0],
    ['What is a smart contract?', ['Program logic deployed to a blockchain', 'A legal PDF only', 'A browser extension', 'A price chart'], 0],
    ['What is gas or compute used for?', ['Pricing execution resources', 'Naming accounts', 'Selecting avatars', 'Compressing images'], 0],
    ['What is a bridge?', ['A system for moving assets or messages between chains', 'A wallet theme', 'A database migration', 'A profile badge'], 0],
  ],
  'Trading & Markets': [
    ['What is a limit order?', ['An order to trade at a chosen price or better', 'A forced liquidation', 'A wallet connection', 'A staking vote'], 0],
    ['What is market depth?', ['Available liquidity at different prices', 'Number of profile fields', 'NFT image size', 'Validator uptime only'], 0],
    ['What does volatility describe?', ['How much price moves over time', 'How many wallets exist', 'How large an avatar is', 'How many questions remain'], 0],
    ['What is a spread?', ['The gap between bid and ask prices', 'A quiz timer', 'A block reward', 'A token decimal'], 0],
    ['What does DYOR mean?', ['Do Your Own Research', 'Deposit Yield On Reserve', 'Deploy Your Own RPC', 'Decode Your Oracle Result'], 0],
    ['What is leverage?', ['Borrowed exposure to a position', 'A wallet nickname', 'A token logo', 'A quiz category'], 0],
  ],
  Bitcoin: [
    ['What is Bitcoin capped at?', ['21 million BTC', '1 billion BTC', '10 million BTC', 'Unlimited BTC'], 0],
    ['Which algorithm does Bitcoin mining use?', ['SHA-256', 'Keccak-256', 'Ed25519', 'BLAKE3 only'], 0],
    ['About how often is a Bitcoin block mined?', ['10 minutes', '1 second', '30 minutes', '1 day'], 0],
    ['What is the genesis block?', ['The first block in the chain', 'A wallet seed phrase', 'A token bridge', 'A staking account'], 0],
    ['What does UTXO stand for?', ['Unspent Transaction Output', 'Universal Token Exchange Order', 'Unsigned Transfer Object', 'User Tax Output'], 0],
    ['What is a Bitcoin node?', ['Software that validates and relays the chain', 'A marketplace profile', 'A browser wallet only', 'A chart candle'], 0],
  ],
  Ethereum: [
    ['What virtual machine executes Ethereum contracts?', ['EVM', 'LLVM', 'JVM', 'SVM only'], 0],
    ['What token standard is commonly used for fungible tokens?', ['ERC-20', 'ERC-721', 'SPL-404', 'BRC-1'], 0],
    ['What token standard is commonly used for NFTs?', ['ERC-721', 'ERC-20', 'ERC-4626 only', 'ERC-777 only'], 0],
    ['What is gas on Ethereum?', ['The fee unit for computation and storage', 'A validator badge', 'A wallet connector', 'A governance forum'], 0],
    ['Ethereum switched to proof of stake in which event?', ['The Merge', 'The Halving', 'The Pizza Day', 'The Freeze'], 0],
    ['What is a rollup?', ['A scaling network that posts data or proofs to Ethereum', 'A wallet backup', 'An NFT reveal', 'A token burn'], 0],
  ],
};

export const defaultQuestions = Object.entries(topicQuestions).flatMap(([topic, questions]) => (
  questions.map(([text, choices, answerIdx], index) => ({
    topic,
    text,
    choices,
    answerIdx,
    difficulty: index < 2 ? 1 : index < 4 ? 2 : 3,
  }))
));
