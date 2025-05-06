import { useState } from 'react'
import './App.css'
import { TradingAnalysis } from './components/TradingAnalysis'
import { WalletConnection } from './components/WalletConnection'
import { wallet } from './lib/walletIntegration'
import { TransactionData } from './lib/tradingAnalysis'
import Sidebar, { NavItemType } from './components/layout/sidebar'
import { AIChat } from './components/AIChat'

function App() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error'
    message?: string
    txId?: string
  }>({ status: 'idle' })
  const [activeNavItem, setActiveNavItem] = useState<NavItemType>("Home")

  const handleWalletConnected = (address: string) => {
    setIsWalletConnected(true)
    setWalletAddress(address)
  }

  const handleWalletDisconnected = () => {
    setIsWalletConnected(false)
    setWalletAddress(null)
  }

  const handleConfirmTransaction = async (transactionData: TransactionData) => {
    if (!isWalletConnected) {
      setTransactionStatus({
        status: 'error',
        message: 'Wallet not connected. Please connect your wallet first.'
      })
      return
    }

    setTransactionStatus({ status: 'pending' })

    try {
      const result = await wallet.signAndExecuteTransaction(transactionData)
      
      setTransactionStatus({
        status: 'success',
        message: 'Transaction has been signed and successfully executed by OneKey hardware wallet!',
        txId: result.digest
      })
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('device') || errorMessage.includes('Device')) {
        errorMessage = `OneKey hardware wallet error: ${errorMessage}`;
      } else if (errorMessage.includes('sign')) {
        errorMessage = `Transaction signing failed: ${errorMessage}`;
      } else {
        errorMessage = `Transaction failed: ${errorMessage}`;
      }
      
      setTransactionStatus({
        status: 'error',
        message: errorMessage
      })
    }
  }

  const handleConfirmActions = async (actions: []) => {
    if (!isWalletConnected) {
      setTransactionStatus({
        status: 'error',
        message: 'Wallet not connected. Please connect your wallet first.'
      })
      return
    }

    setTransactionStatus({ status: 'pending' })

    try {
      const result = await wallet.signAndExecuteSuiTransaction(actions)
      
      setTransactionStatus({
        status: 'success',
        message: 'Transaction has been signed and successfully executed by OneKey hardware wallet!',
        txId: result.digest
      })
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('device') || errorMessage.includes('Device')) {
        errorMessage = `OneKey hardware wallet error: ${errorMessage}`;
      } else if (errorMessage.includes('sign')) {
        errorMessage = `Transaction signing failed: ${errorMessage}`;
      } else {
        errorMessage = `Transaction failed: ${errorMessage}`;
      }
      
      setTransactionStatus({
        status: 'error',
        message: errorMessage
      })
    }
  }

  const handleRejectTransaction = () => {
    setTransactionStatus({ status: 'idle' })
  }

  const handleNavigate = (item: NavItemType) => {
    setActiveNavItem(item)
  }

  // Render main content
  const renderMainContent = () => {
    switch(activeNavItem) {
      case "Home":
        return (
          <div className="p-6">
            {/* Render different content based on wallet connection status */}
            {!isWalletConnected ? (
              <div>
                <h1 className="text-2xl font-bold mb-4">Welcome to OneKey AI+</h1>
                <p className="text-gray-600 mb-6">
                  Connect your OneKey wallet to get started. Leverage AI to analyze markets and execute secure transactions to support your investment decisions.
                </p>
                <div className="max-w-md mx-auto">
                  <WalletConnection
                    onWalletConnected={handleWalletConnected}
                    onWalletDisconnected={handleWalletDisconnected}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold">Welcome to OneKey AI+</h1>
                  <div className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Wallet Connected
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Your wallet has been successfully connected. Now you can chat with the AI assistant or navigate to the trading page for analysis and transactions.
                </p>
                <AIChat
                  onConfirmActions={handleConfirmActions}
                />
              </div>
            )}
          </div>
        )
      case "Trade":
        return (
          <div className="p-6">
            {!isWalletConnected ? (
              <div className="max-w-md mx-auto my-8">
                <h1 className="text-2xl font-bold mb-4 text-center">Connect Wallet</h1>
                <p className="text-gray-600 mb-6 text-center">
                  Please connect your OneKey wallet before using the trading features.
                </p>
                <WalletConnection
                  onWalletConnected={handleWalletConnected}
                  onWalletDisconnected={handleWalletDisconnected}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* <div className="md:col-span-1">
                  {transactionStatus.status !== 'idle' && (
                    <div className="mb-6">
                      <div className={`p-4 rounded-lg ${
                        transactionStatus.status === 'pending' ? 'bg-blue-50 text-blue-700' :
                        transactionStatus.status === 'success' ? 'bg-green-50 text-green-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        <h3 className="font-medium mb-2">
                          {transactionStatus.status === 'pending' ? 'Transaction Processing' :
                           transactionStatus.status === 'success' ? 'Transaction Successful' :
                           'Transaction Failed'}
                        </h3>
                        <p className="text-sm">{transactionStatus.message}</p>
                        {transactionStatus.txId && (
                          <p className="text-sm mt-2">
                            Transaction ID: <span className="font-mono">{transactionStatus.txId}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="text-sm bg-green-100 text-green-800 p-3 rounded-lg flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Wallet Connected: {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
                  </div>
                </div> */}
                
                <div className="md:col-span-2">
                  <TradingAnalysis
                    onConfirmTransaction={handleConfirmTransaction}
                    onRejectTransaction={handleRejectTransaction}
                  />
                </div>
              </div>
            )}
          </div>
        )
      case "Earn":
        return <div className="p-6"><h1 className="text-2xl font-bold">Earn Rewards</h1><p className="mt-4">This feature is under development...</p></div>
      case "Market":
        return <div className="p-6"><h1 className="text-2xl font-bold">Market Data</h1><p className="mt-4">This feature is under development...</p></div>
      case "Browser":
        return <div className="p-6"><h1 className="text-2xl font-bold">Browser</h1><p className="mt-4">This feature is under development...</p></div>
      case "Settings":
        return <div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p className="mt-4">This feature is under development...</p></div>
      case "Download":
        return <div className="p-6"><h1 className="text-2xl font-bold">Download</h1><p className="mt-4">This feature is under development...</p></div>
      default:
        return <div className="p-6">Unknown Page</div>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex">
        <Sidebar onNavigate={handleNavigate} activeItem={activeNavItem} />
        <div className="flex-1">
          {renderMainContent()}
        </div>
      </main>
    </div>
  )
}

export default App
