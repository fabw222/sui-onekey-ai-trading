# SUI AI Trading Analysis

A SUI hackathon project that integrates OneKey hardware wallet with SUI transactions and AI-powered trading analysis.

## Features

- AI-powered trading pair analysis to determine investment potential
- OneKey hardware wallet integration using @onekeyfe/hd-web-sdk
- SUI blockchain interactions using @mysten/sui
- Transaction flow with Reject and Confirm buttons
- Frontend-only implementation with mock wallet and AI analysis

## Project Structure

```
sui-onekey-ai-trading/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── TradingAnalysis.tsx    # AI trading analysis component
│   │   │   ├── WalletConnection.tsx   # OneKey wallet connection component
│   │   │   └── ui/                    # UI component library
│   │   ├── lib/
│   │   │   ├── tradingAnalysis.ts     # AI trading analysis logic
│   │   │   └── walletIntegration.ts   # OneKey wallet integration
│   │   ├── App.tsx                    # Main application component
│   │   └── main.tsx                   # Application entry point
│   ├── public/              # Static assets
│   ├── package.json         # Dependencies and scripts
│   └── vite.config.ts       # Vite configuration
└── README.md                # Project documentation
```

## Technologies Used

- React with TypeScript
- Vite for frontend build
- Tailwind CSS for styling
- shadcn/ui for UI components
- Recharts for data visualization
- @mysten/sui for SUI blockchain interactions
- @onekeyfe/hd-web-sdk for OneKey wallet integration

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/sui-onekey-ai-trading.git
cd sui-onekey-ai-trading
```

2. Install frontend dependencies
```bash
cd frontend
npm install
```

3. Start the development server
```bash
npm run dev
```

4. Open your browser and navigate to the local development server

## Usage

1. Connect your OneKey hardware wallet by clicking the "Connect OneKey Wallet" button
2. Select a trading pair from the dropdown menu
3. Click "Analyze" to perform AI-powered analysis on the selected trading pair
4. Review the analysis results, including score, recommendation, and detailed metrics
5. Enter the amount you want to trade
6. Click "Confirm with OneKey" to execute the transaction or "Reject" to cancel

## Testing

The application includes mock implementations for wallet connection and blockchain interactions for testing purposes. In a production environment, these would be replaced with actual OneKey wallet SDK and SUI blockchain interactions.

## Deployment

To deploy the application:

1. Build the frontend
```bash
cd frontend
npm run build
```

2. Deploy the generated `dist` directory to your preferred hosting service

## License

This project is licensed under the MIT License - see the LICENSE file for details.
