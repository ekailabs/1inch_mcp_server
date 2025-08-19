# Cross-Chain Swap MCP Server

A Model Context Protocol (MCP) server that enables cross-chain token swaps using the 1inch Fusion+ protocol. This server provides tools for executing swaps between different blockchain networks and monitoring their status.

## Features

- **Cross-Chain Token Swaps**: Execute swaps between Base and Arbitrum networks using 1inch Fusion+
- **Portfolio Management**: Query portfolio values, token details, and protocol information
- **Order Monitoring**: Automatic background monitoring of swap orders with daemon service
- **Status Tracking**: Real-time status updates for all swap orders
- **MCP Integration**: Full Model Context Protocol support for AI assistant integration

## Prerequisites

- Node.js (v16 or higher)
- yarn
- 1inch API key (Dev Portal)
- Private key for wallet operations

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ekailabs/1inch_mcp_server.git
cd 1inch_mcp_server
```

2. Install dependencies:
```bash
yarn install
```

## Usage

### Starting the MCP Server

```js
{
    "mcpServers": {
        "one-inch-mcp-server": {
            "command": "node",
            "args": [
                "Path/mcpServer.js"
            ]
        }
    }
}
```

This will:
1. Start the monitoring daemon in the background
2. Launch the MCP server for tool interactions

### Available Scripts

- `npm start` - Start the MCP server with monitoring daemon
- `npm run status` - Check status of all swap orders
- `npm run monitor` - View monitoring service status
- `npm run monitor:start` - Start the monitoring daemon
- `npm run monitor:stop` - Stop the monitoring daemon

### MCP Tools

The server provides several tools accessible through MCP:

#### `swap`
Execute a cross-chain token swap.

Parameters:
- `srcChainId` (optional): Source chain ID (default: 8453 for Base)
- `dstChainId` (optional): Destination chain ID (default: 42161 for Arbitrum)
- `srcTokenAddress` (optional): Source token contract address
- `dstTokenAddress` (optional): Destination token contract address
- `amount` (optional): Amount to swap in base units (default: 1000000 = 1 USDC)
- `invert` (optional): Reverse the swap direction

#### `swap-status`
Check the status of swap orders.

Parameters:
- `orderHash` (optional): Specific order hash to check (omit for all orders)

#### Portfolio Tools
- `portfolio-protocols-value` - Get current protocol values
- `portfolio-tokens-details` - Get detailed token information
- `portfolio-general-value` - Get general portfolio value
- `portfolio-value-chart` - Get portfolio value chart data

### Resources

#### `swap-status`
Access swap order status via URI: `swaps://{orderHash}`

## Architecture

### Core Components

- **`index.js`** - Main swap execution logic using 1inch Cross-Chain SDK
- **`mcpServer.js`** - MCP server implementation with tools and resources
- **`monitor-service.js`** - Daemon service for background order monitoring
- **`monitor-worker.js`** - Worker processes for individual order monitoring
- **`status.js`** - Utility for checking order status

### Monitoring System

The project includes a sophisticated monitoring system:

1. **Daemon Process**: Runs in the background, automatically detecting new orders
2. **Worker Processes**: Individual processes monitor each swap order
3. **Status Persistence**: Order status saved to `order-status.json`
4. **Automatic Cleanup**: Processes terminate when orders complete

### Supported Networks

- **Base** (Chain ID: 8453)
- **Arbitrum** (Chain ID: 42161)

Default tokens:
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC on Arbitrum: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

### Network Configuration

The project supports custom network configurations in `index.js`:

```javascript
const networkConfigs = {
    8453: "https://rpc.ankr.com/base",
    42161: "https://arb1.arbitrum.io/rpc"
};
```

## Order Status Tracking

Orders are tracked through several states:
- `pending` - Order submitted, waiting for execution
- `executed` - Order successfully completed
- Custom states based on 1inch protocol responses

Status information includes:
- Order hash
- Secrets and secret hashes for order execution
- Start time and last update timestamps
- Monitoring process status