# DeFi Analyzer Discord Bot

A Discord bot that analyzes DeFi token pairs across multiple blockchains including Monad Testnet, with support for executing swaps directly through Discord.

## Features

- Token pair analysis across multiple blockchains (Monad Testnet, Sepolia)
- Real-time liquidity and price information
- Direct token swap functionality through Discord interface
- Interactive buttons and modals for improved user experience

## Technologies Used

- **Discord.js**: For bot interface and interactions
- **Ethers.js**: For blockchain interaction
- **Monad Testnet**: Primary blockchain integration showcasing Monad's accelerated EVM
- **Uniswap V2 Compatible Interfaces**: For DeFi protocol interactions

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- NPM or Yarn
- Discord Developer Account
- Wallet with private key for transaction signing

### Installation

1. Clone the repository:

```
git clone https://github.com/yourusername/defi-analyzer-bot.git
cd defi-analyzer-bot
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file in the project root with the following variables:

```
DISCORD_TOKEN=your_discord_bot_token
PRIVATE_KEY=your_wallet_private_key
```

4. Start the bot:

```
node index.js
```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Add a bot to your application
4. Enable required privileged intents (Message Content, Server Members, Presence)
5. Generate an invite link with proper permissions and add the bot to your server

## Usage

The bot responds to the following commands:

- `!analyze <tokenAddress> [chain]` - Analyze a token pair
- `!help` - Display help information
- `!testchain <chain>` - Test connection to a specific blockchain

Example:

```
!analyze 0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701 monad
```

## Configuration

The bot supports multiple chains which can be configured in the `CHAIN_CONFIG` object:

```javascript
const CHAIN_CONFIG = {
  monad: {
    rpc: 'https://testnet-rpc.monad.xyz/',
    factoryAddress: '0x4ab43a725e316275CC124620d0dFB0B58FAecAa2',
    routerAddress: '0x85485564916b8f60889d4c9435f6a7bA711cBd41',
    nativeWrappedToken: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
    nativeName: 'Monad Testnet',
    nativeSymbol: 'MON',
    explorer: 'https://testnet.monadexplorer.com/address/',
    chainId: 10143,
    txUrl: 'https://testnet.monadexplorer.com/',
  },
  // Add more chains as needed
};
```

License

```
MIT

```
