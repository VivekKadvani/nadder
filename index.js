const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Add this line to verify env loading
console.log('Environment check:', {
    hasDiscordToken: !!process.env.DISCORD_TOKEN,
    hasPrivateKey: !!process.env.PRIVATE_KEY,
    privateKeyLength: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.length : 0
});

// Uniswap V2 Factory and Pair ABI
const FACTORY_ABI = [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)'
];

const PAIR_ABI = [
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function totalSupply() external view returns (uint256)'
];

const ERC20_ABI = [
    'function name() external view returns (string)',
    'function symbol() external view returns (string)',
    'function decimals() external view returns (uint8)'
];

// Add Router ABI
const ROUTER_ABI = [
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

// Chain configurations
const CHAIN_CONFIG = {
    // ethereum: {
    //     rpc: 'https://eth.drpc.org', // Replace with your Infura key
    //     factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2 Factory
    //     routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
    //     nativeWrappedToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    //     nativeName: 'Ethereum',
    //     nativeSymbol: 'ETH',
    //     explorer: 'https://etherscan.io/address/'
    // },
    monad: {
        rpc: 'https://testnet-rpc.monad.xyz/',  // Updated RPC URL
        factoryAddress: '0x4ab43a725e316275CC124620d0dFB0B58FAecAa2',
        routerAddress: '0x85485564916b8f60889d4c9435f6a7bA711cBd41',
        nativeWrappedToken: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
        nativeName: 'Monad Testnet',
        nativeSymbol: 'MON',
        explorer: 'https://testnet.monadexplorer.com/address/',
        chainId: 10143, // Add chainId for Monad testnet
        txUrl: 'https://testnet.monadexplorer.com/'
    },
    sepolia: {
        rpc: 'https://ethereum-sepolia-rpc.publicnode.com',  // Updated RPC URL
        factoryAddress: '0xF62c03E08ada871A0bEb309762E260a7a6a880E6',
        routerAddress: '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3',
        nativeWrappedToken: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        nativeName: 'Sepolia Testnet',
        nativeSymbol: 'ETH',
        explorer: 'https://sepolia.etherscan.io/address/',
        chainId: 11155111, // Add chainId for Monad testnet
        txUrl: 'https://sepolia.etherscan.io/'
    }

    // Add more chains as needed
};

// Discord bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Command prefix
const PREFIX = '!';

// Initialize bot
client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

// Message handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'analyze') {
        console.log('Analyze command received:', {
            tokenAddress: args[0],
            chain: args[1]?.toLowerCase() || 'ethereum'
        });

        if (!args[0]) {
            return message.reply('Please provide a token contract address!');
        }

        const tokenAddress = args[0];
        const chain = args[1]?.toLowerCase() || 'ethereum';

        console.log('Starting analysis with config:', {
            chain,
            rpc: CHAIN_CONFIG[chain].rpc,
            factory: CHAIN_CONFIG[chain].factoryAddress
        });

        // Reply to let user know we're processing
        const loadingMsg = await message.reply('Analyzing token pair... This may take a moment.');

        try {
            console.log('Calling analyzeTokenPair...');
            const pairInfo = await analyzeTokenPair(tokenAddress, chain);
            console.log('Analysis completed successfully:', pairInfo);
            const { embed, components } = createPairEmbed(pairInfo, chain);
            await loadingMsg.edit({ content: 'Analysis complete:', embeds: [embed], components });
        } catch (error) {
            console.error('Analysis failed with error:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            });
            await loadingMsg.edit(`Error analyzing token: ${error.message}`);
        }
    } else if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Uniswap V2 Analyzer Bot Commands')
            .setDescription('Analyze token pairs on Uniswap/PancakeSwap V2')
            .addFields(
                { name: '!analyze <tokenAddress> [chain]', value: 'Analyze a token pair with the native token\nSupported chains: ethereum, bsc' },
                { name: '!help', value: 'Show this help message' }
            )
            .setFooter({ text: 'Replace <tokenAddress> with the contract address of the token you want to analyze' });

        message.reply({ embeds: [helpEmbed] });
    } else if (command === 'testchain') {
        const chain = args[0]?.toLowerCase() || 'ethereum';
        if (!CHAIN_CONFIG[chain]) {
            return message.reply(`Unsupported chain: ${chain}`);
        }

        try {
            const provider = new ethers.providers.JsonRpcProvider(CHAIN_CONFIG[chain].rpc);
            const network = await provider.getNetwork();
            const factoryCode = await provider.getCode(CHAIN_CONFIG[chain].factoryAddress);

            await message.reply(`Chain test results for ${chain}:
            - Network ChainId: ${network.chainId}
            - Factory deployed: ${factoryCode !== '0x' ? 'Yes' : 'No'}
            - Factory address: ${CHAIN_CONFIG[chain].factoryAddress}`);
        } catch (error) {
            await message.reply(`Error testing ${chain}: ${error.message}`);
        }
    }
});

// Add button interaction handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('buy_')) {
        const [_, tokenAddress, chain] = interaction.customId.split('_');

        // Create modal for ETH amount input
        const modal = new ModalBuilder()
            .setCustomId(`swap_${tokenAddress}_${chain}`)
            .setTitle('Buy Token');

        const ethAmountInput = new TextInputBuilder()
            .setCustomId('ethAmount')
            .setLabel('Enter ETH amount to spend')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0.1')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(ethAmountInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }
});

// Add modal submission handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('swap_')) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const [_, tokenAddress, chain] = interaction.customId.split('_');
            const ethAmount = interaction.fields.getTextInputValue('ethAmount');

            // Validate input
            if (isNaN(ethAmount) || parseFloat(ethAmount) <= 0) {
                throw new Error('Please enter a valid amount greater than 0');
            }

            console.log('Starting swap process:', {
                tokenAddress,
                chain,
                ethAmount
            });

            // Execute the swap
            const result = await executeSwap(tokenAddress, ethAmount, chain);

            const txUrl = `${CHAIN_CONFIG[chain].txUrl}tx/${result.transactionHash}`;
            await interaction.editReply({
                content: `Swap executed successfully!\nTransaction: ${txUrl}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Swap interaction error:', error);
            await interaction.editReply({
                content: `Error executing swap: ${error.message}\nPlease make sure you have enough balance and the correct network is configured.`,
                ephemeral: true
            });
        }
    }
});

// Function to analyze token pair
async function analyzeTokenPair(tokenAddress, chain) {
    console.log('Starting analyzeTokenPair function...');
    const chainConfig = CHAIN_CONFIG[chain];

    console.log('Initializing provider...');
    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);

    // Add network check
    try {
        console.log('Checking network connection...');
        const network = { name: 'monad', chainId: 10143 }
        console.log('Network connection successful:', {
            chainId: network.chainId,
            expectedChainId: chainConfig.chainId
        });
    } catch (error) {
        console.error('Network connection failed:', error);
        throw new Error(`Failed to connect to ${chain} network: ${error.message}`);
    }

    // Verify factory contract first
    console.log('Verifying factory contract...');
    const isFactoryDeployed = await verifyContract(provider, chainConfig.factoryAddress, 'Factory');
    if (!isFactoryDeployed) {
        console.error('Factory contract verification failed');
        throw new Error(`Factory contract not found on ${chain} at ${chainConfig.factoryAddress}`);
    }
    console.log('Factory contract verified successfully');

    // Connect to Factory with more detailed error handling
    console.log('Connecting to factory contract...');
    const factory = new ethers.Contract(chainConfig.factoryAddress, FACTORY_ABI, provider);

    try {
        console.log('Getting pair address...', {
            token: tokenAddress,
            nativeToken: chainConfig.nativeWrappedToken
        });


        const pairAddress = await factory.getPair(
            tokenAddress,
            chainConfig.nativeWrappedToken
        );

        console.log('Pair address retrieved:', pairAddress);

        if (pairAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error(`No liquidity pair exists for this token with ${chainConfig.nativeSymbol}`);
        }

        // Get token details
        console.log('Getting token details...');
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        let tokenName, tokenSymbol, tokenDecimals;

        try {
            console.log('Fetching token information...');
            [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals()
            ]);
            console.log('Token information retrieved:', {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: tokenDecimals
            });
        } catch (error) {
            console.error('Error fetching token information:', error);
            throw new Error(`Invalid token address or not an ERC20 token: ${error.message}`);
        }

        // Connect to pair contract
        console.log('Connecting to pair contract...');
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);

        // Get pair data
        console.log('Fetching pair data...');
        const [token0, token1, reserves, totalSupply] = await Promise.all([
            pairContract.token0(),
            pairContract.token1(),
            pairContract.getReserves(),
            pairContract.totalSupply()
        ]);
        console.log('Pair data retrieved:', {
            token0,
            token1,
            reserves: reserves.toString(),
            totalSupply: totalSupply.toString()
        });

        // Determine which token is which in the pair
        const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
        const tokenReserve = isToken0 ? reserves[0] : reserves[1];
        const nativeReserve = isToken0 ? reserves[1] : reserves[0];

        // Calculate price
        const tokenReserveFormatted = ethers.utils.formatUnits(tokenReserve, tokenDecimals);
        const nativeReserveFormatted = ethers.utils.formatEther(nativeReserve);
        const priceInNative = parseFloat(nativeReserveFormatted) / parseFloat(tokenReserveFormatted);
        const liquidityUSD = parseFloat(nativeReserveFormatted) * 2; // Simple estimation (assumes ETH/BNB = $1000 for easy calc)

        console.log('Analysis completed successfully');
        return {
            tokenAddress,
            tokenName,
            tokenSymbol,
            pairAddress,
            tokenReserve: tokenReserveFormatted,
            nativeReserve: nativeReserveFormatted,
            priceInNative,
            liquidityUSD: liquidityUSD * 1000, // Simple estimation
            totalLPTokens: ethers.utils.formatEther(totalSupply)
        };
    } catch (error) {
        console.error('Detailed error in analyzeTokenPair:', {
            message: error.message,
            code: error.code,
            data: error.data,
            chain: chain,
            factory: chainConfig.factoryAddress
        });

        if (error.code === 'CALL_EXCEPTION') {
            throw new Error(`Failed to interact with the DEX on ${chain}. The factory contract might not be deployed or accessible at ${chainConfig.factoryAddress}`);
        }
        throw error;
    }
}

// Create Discord embed with pair info
function createPairEmbed(pairInfo, chain) {
    const chainConfig = CHAIN_CONFIG[chain];

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${pairInfo.tokenSymbol}/${chainConfig.nativeSymbol} Pair Analysis`)
        .setDescription(`Analysis of ${pairInfo.tokenName} (${pairInfo.tokenSymbol}) paired with ${chainConfig.nativeSymbol} on ${chainConfig.nativeName}`)
        .addFields(
            { name: 'Token Address', value: `[${pairInfo.tokenAddress}](${chainConfig.explorer}${pairInfo.tokenAddress})`, inline: false },
            { name: 'Pair Address', value: `[${pairInfo.pairAddress}](${chainConfig.explorer}${pairInfo.pairAddress})`, inline: false },
            { name: `${pairInfo.tokenSymbol} Reserve`, value: `${parseFloat(pairInfo.tokenReserve).toLocaleString()} ${pairInfo.tokenSymbol}`, inline: true },
            { name: `${chainConfig.nativeSymbol} Reserve`, value: `${parseFloat(pairInfo.nativeReserve).toLocaleString()} ${chainConfig.nativeSymbol}`, inline: true },
            { name: 'Price', value: `1 ${pairInfo.tokenSymbol} = ${pairInfo.priceInNative.toFixed(8)} ${chainConfig.nativeSymbol}`, inline: false },
            { name: 'Estimated Liquidity', value: `$${pairInfo.liquidityUSD.toLocaleString()}`, inline: true },
            { name: 'LP Tokens', value: `${parseFloat(pairInfo.totalLPTokens).toLocaleString()}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false } // Add empty field for spacing
        )
        .setTimestamp()
        .setFooter({ text: `Queried at ${new Date().toUTCString()}` });

    const buyButton = new ButtonBuilder()
        .setCustomId(`buy_${pairInfo.tokenAddress}_${chain}`)
        .setLabel('Buy Token')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(buyButton);

    return { embed, components: [row] };
}

// Add swap execution function
async function executeSwap(tokenAddress, ethAmount, chain) {
    console.log('Starting swap execution...', {
        tokenAddress,
        ethAmount,
        chain
    });

    const chainConfig = CHAIN_CONFIG[chain];
    console.log('Using chain config:', chainConfig);

    try {
        console.log('Initializing provider...');
        const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);

        // Add private key validation
        console.log('Checking private key...');
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }

        // Validate private key format
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
            ? process.env.PRIVATE_KEY
            : `0x${process.env.PRIVATE_KEY}`;

        if (privateKey.length !== 66) { // 0x + 64 characters
            throw new Error('Invalid private key length');
        }

        console.log('Initializing signer...');
        try {
            const signer = new ethers.Wallet(privateKey, provider);
            const address = await signer.getAddress();
            console.log('Signer initialized successfully. Address:', address);

            // Continue with the rest of the swap logic...
            console.log('Connecting to router contract...');
            const router = new ethers.Contract(chainConfig.routerAddress, ROUTER_ABI, signer);

            // Format the ETH amount
            console.log('Formatting ETH amount...');
            const ethAmountWei = ethers.utils.parseEther(ethAmount.toString());
            console.log('ETH amount in wei:', ethAmountWei.toString());

            // Calculate amounts out
            console.log('Calculating amounts out...');
            console.log('Path:', [chainConfig.nativeWrappedToken, tokenAddress]);

            try {
                const amountsOut = await router.getAmountsOut(
                    ethAmountWei,
                    [chainConfig.nativeWrappedToken, tokenAddress]
                );
                console.log('Amounts out received:', amountsOut.map(a => a.toString()));

                const minAmountOut = amountsOut[1].mul(95).div(100); // 5% slippage
                console.log('Min amount out with slippage:', minAmountOut.toString());

                // Prepare transaction parameters
                const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
                console.log('Transaction parameters:', {
                    minAmountOut: minAmountOut.toString(),
                    path: [chainConfig.nativeWrappedToken, tokenAddress],
                    to: await signer.getAddress(),
                    deadline,
                    value: ethAmountWei.toString()
                });

                // Execute swap
                console.log('Executing swap transaction...');
                const tx = await router.swapExactETHForTokens(
                    minAmountOut,
                    [chainConfig.nativeWrappedToken, tokenAddress],
                    await signer.getAddress(),
                    deadline,
                    {
                        value: ethAmountWei,
                        gasLimit: 300000 // Add explicit gas limit
                    }
                );

                console.log('Transaction sent:', tx.hash);
                console.log('Waiting for transaction confirmation...');
                const receipt = await tx.wait();
                console.log('Transaction confirme');

                return receipt;

            } catch (error) {
                console.error('Error in amounts calculation or swap:', {
                    error: error,
                    message: error.message,
                    code: error.code,
                    data: error.data
                });
                throw new Error(`Swap failed: ${error.message}`);
            }

        } catch (error) {
            console.error('Signer initialization error:', {
                message: error.message,
                code: error.code
            });
            throw new Error(`Failed to initialize signer: ${error.message}`);
        }

    } catch (error) {
        console.error('Swap execution error:', {
            error: error,
            message: error.message,
            code: error.code,
            data: error.data
        });
        throw new Error(`Swap execution failed: ${error.message}`);
    }
}

// Update verifyContract function with logging
async function verifyContract(provider, address, name) {
    console.log(`Verifying ${name} contract at ${address}...`);
    try {
        console.log(provider.JsonRpcProvider);

        const code = await provider.getCode(address);
        console.log(`Contract code length for ${name}:`, code.length);
        if (code === '0x') {
            console.error(`No contract code found at ${address}`);
            throw new Error(`${name} contract not deployed at ${address}`);
        }
        console.log(`${name} contract verified successfully`);
        return true;
    } catch (error) {
        console.error(`Error verifying ${name} contract:`, {
            error: error.message,
            address: address
        });
        return false;
    }
}

// Login bot with token
client.login(process.env.DISCORD_TOKEN);