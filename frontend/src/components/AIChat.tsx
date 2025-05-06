import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ArrowUp, Bot, User, ChevronRight, BarChart2, ExternalLink, Wallet, DollarSign } from 'lucide-react'
import { getSuiAccountBalance, getSuiAccountDefiPortfolio } from '../lib/suivisionAPIs'
import { wallet } from '../lib/walletIntegration'
import { sui_tx_agent } from '@/lib/apis'
import { DEFAULT_PROMPT } from '@/lib/constants'


type Message = {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  showTransactionButton?: boolean
}

type QuickPrompt = {
  id: string
  text: string
}

interface TransactionState {
  messageId: string | null
  status: 'idle' | 'confirming' | 'processing' | 'completed' | 'failed'
  details?: string
}

// Define Coin type
interface Coin {
  symbol?: string;
  balance?: string;
  decimals?: number;
  usdValue?: string;
  type?: string;
  iconUrl?: string;
  description?: string;
  name?: string;
  isVerified?: boolean;
}

export function AIChat({ onConfirmActions }: { onConfirmActions: (actions: []) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I am the OneKey AI+ Assistant, happy to be of service. You can ask me questions about the crypto market, trading analysis, or asset management.',
      sender: 'ai',
      timestamp: new Date()
    }
  ])
  
  const [inputMessage, setInputMessage] = useState('')
  const [transaction, setTransaction] = useState<TransactionState>({
    messageId: null,
    status: 'idle'
  })
  const [actions, setActions] = useState<[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const quickPrompts: QuickPrompt[] = [
    { id: 'q1', text: 'Check holdings and returns' },
    { id: 'q2', text: 'Transfer 0.1 SUI to address 0x0b65b9fb936301a10d2061160c858314cea49c42c17e35b25ffbc2d8d2804e9c' },
    { id: 'q3', text: 'What are the recent trading opportunities?' }
  ]
  
  const sendMessage = async (content: string) => {
    if (!content.trim()) return
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    
    // Process request for checking holdings and returns
    if (content.includes('holdings') || content.includes('returns')) {
      try {
        // Check if wallet is connected
        if (!wallet.isConnected || !wallet.address) {
          throw new Error('Wallet not connected, please connect your OneKey hardware wallet first');
        }
        
        // Use hardware wallet address to call API
        const walletData = await getSuiAccountBalance(wallet.address);
        console.dir(walletData)
        // Parse returned data
        let response = ''
        
        if (walletData.code === 200 && walletData.result.coins.length > 0) {
          let totalUSDValue = 0
          response = 'Your Sui wallet holdings are as follows:\n\n'
          
          // Loop through token information and format
          walletData.result.coins.forEach((coin: Coin) => {
            const symbol = coin.symbol || 'Unknown'
            const balance = coin.balance ? parseFloat(coin.balance) / Math.pow(10, coin.decimals || 9) : 0
            const usdValue = coin.usdValue ? parseFloat(coin.usdValue) : 0
            if (usdValue < 0.1) {
              return
            }

            totalUSDValue += usdValue
            
            response += `• ${symbol}: ${balance.toFixed(4)} (approx. value $${usdValue.toFixed(2)})\n`
          })
          
          response += `\nTotal asset value: $${totalUSDValue.toFixed(2)}\n`
          // response += `\nWallet address: ${wallet.address}\n`
        } else {
          response = 'Unable to retrieve your wallet data. Please verify your wallet address is correct or try again later.'
        }
        
        // Add AI reply
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'ai',
          timestamp: new Date(),
          showTransactionButton: false
        }
        
        setMessages(prev => [...prev, aiMessage])
      } catch (error: unknown) {
        // Handle error cases
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `Sorry, an error occurred while retrieving your wallet data: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later.`,
          sender: 'ai',
          timestamp: new Date(),
          showTransactionButton: false
        }
        
        setMessages(prev => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    } else {
      // Handle other types of messages (original logic)
      setTimeout(async () => {
        let response = ''
        let showTransactionButton = false
        
        if (content.toLowerCase().includes('transfer') || content.toLowerCase().includes('bank card')) {
          const test_text = "Transfer 0.1 SUI to address 0x0b65b9fb936301a10d2061160c858314cea49c42c17e35b25ffbc2d8d2804e9c. Note: The recipient address is also on sui.";
          const sui_tx_prompt = `${DEFAULT_PROMPT}\nNow, please convert the user's input: ${content}`;
          const agent_response = await sui_tx_agent(sui_tx_prompt);
          console.dir(agent_response)
          if (agent_response) {
            const response_text = JSON.parse(agent_response.artifacts[0].parts[0].text);
            console.dir(response_text)
            let real_response = {}
            const match = response_text.response.substring(8, response_text.response.length - 3);
            console.log(match)
            if (match) {
              real_response = JSON.parse(match);
            }
            console.dir(real_response)
            response = real_response.summary
            setActions(real_response.actions)
          }
          showTransactionButton = true
        } else if (content.toLowerCase().includes('trading opportunities') || content.toLowerCase().includes('opportunities')) {
          response = 'Based on recent market analysis, the following specific projects may present trading opportunities:\n\n1. Sui (SUI) - High-performance public chain\n   • Current price: $3.38\n   • Potential return: 50-70% (high risk)\n   • Suggested action: Test with small position, long-term project value needs further observation\n\nRisk notice: The above analysis is for reference only. Crypto markets are highly volatile, please allocate assets according to your risk tolerance and do not invest more than you can afford to lose.'
          showTransactionButton = false
        } else {
          response = 'Thank you for your question! As OneKey AI+ Assistant, I can help you analyze market trends, check your assets, provide trading suggestions, and answer questions about wallet usage. You can also inquire about fund transfers, secure storage, and investment strategies.'
          showTransactionButton = false
        }
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: 'ai',
          timestamp: new Date(),
          showTransactionButton
        }
        
        setMessages(prev => [...prev, aiMessage])
        setIsLoading(false)
      }, 1000)
    }
  }
  
  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  const handleExecuteTransaction = (messageId: string) => {
    setTransaction({
      messageId,
      status: 'confirming',
      details: 'Please confirm this transaction on your OneKey hardware wallet'
    })

    // Simulate transaction processing
    setTimeout(() => {
      setTransaction({
        messageId,
        status: 'processing',
        details: 'Transaction is being processed...'
      })

      setTimeout(() => {
        // 80% success probability
        const isSuccess = Math.random() > 0.2
        setTransaction({
          messageId,
          status: isSuccess ? 'completed' : 'failed',
          details: isSuccess 
            ? 'Transaction successfully executed! Transaction hash: 0x3a8d...7e2f' 
            : 'Transaction failed: Network congestion, please try again later'
        })
      }, 2000)
    }, 3000)
  }

  const getTransactionStatusColor = (status: TransactionState['status']) => {
    switch(status) {
      case 'confirming': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'completed': return 'bg-green-50 text-green-700 border-green-200'
      case 'failed': return 'bg-red-50 text-red-700 border-red-200'
      default: return ''
    }
  }
  
  return (
    <Card className="flex flex-col h-[80vh]">
      <CardHeader>
        <CardTitle>OneKey AI+ Assistant</CardTitle>
        <CardDescription>Intelligent market analysis to optimize your crypto investment decisions</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-y-auto mb-4">
        <div className="space-y-4">
          {messages.map(message => (
            <div key={message.id} className="mb-3">
              <div 
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`flex max-w-[85%] ${
                    message.sender === 'user' 
                      ? 'bg-blue-500 text-white rounded-tl-lg rounded-tr-lg rounded-bl-lg' 
                      : message.content.includes('Your Sui wallet holdings are as follows')
                        ? 'bg-white border border-gray-200 shadow-sm text-gray-800 rounded-tl-lg rounded-tr-lg rounded-br-lg'
                        : 'bg-gray-100 text-gray-800 rounded-tl-lg rounded-tr-lg rounded-br-lg'
                  } p-3`}
                >
                  <div className={`flex-shrink-0 mr-2 ${message.content.includes('Your Sui wallet holdings are as follows') ? 'mt-0.5' : 'mt-1'}`}>
                    {message.sender === 'user' ? (
                      <User size={16} />
                    ) : (
                      <Bot size={16} className={message.content.includes('Your Sui wallet holdings are as follows') ? 'text-blue-500' : ''} />
                    )}
                  </div>
                  <div className="w-full">
                    {message.content.includes('Your Sui wallet holdings are as follows') ? (
                      <div className="portfolio-card">
                        <div className="flex items-center mb-3">
                          <Wallet size={18} className="text-blue-500 mr-2" />
                          <p className="font-medium text-blue-600">Your Sui Wallet Holdings</p>
                        </div>
                        <div className="space-y-2">
                          {message.content.split('\n\n').map((section, i) => {
                            if (i === 0) return null; // Skip title
                            if (section.startsWith('•')) {
                              // Token list section
                              return (
                                <div key={i} className="space-y-1.5 bg-gray-50 p-2 rounded-md">
                                  {section.split('\n').map((line, j) => {
                                    if (!line.startsWith('•')) return null;
                                    const [symbol, valueText] = line.substring(2).split(':');
                                    if (!symbol || !valueText) return null;
                                    
                                    const [amount, usdValue] = valueText.split('(approx.');
                                    return (
                                      <div key={j} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                                        <div className="font-medium">{symbol.trim()}</div>
                                        <div className="flex flex-col items-end">
                                          <div>{amount.trim()}</div>
                                          <div className="text-xs text-gray-500">{usdValue ? `≈ ${usdValue.trim()}` : ''}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } else if (section.startsWith('Total asset value')) {
                              // Total asset value section
                              return (
                                <div key={i} className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                      <DollarSign size={16} className="text-green-500 mr-1" />
                                      <span className="font-semibold">Total Asset Value</span>
                                    </div>
                                    <span className="font-bold text-green-600">{section.split(':')[1].trim()}</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line">{message.content}</p>
                    )}
                    <p className="text-xs opacity-70 mt-2 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
              
              {message.sender === 'ai' && message.showTransactionButton && (
                <div className="ml-8 mt-2">
                  {transaction.messageId === message.id ? (
                    <div className={`p-3 rounded-md border ${getTransactionStatusColor(transaction.status)}`}>
                      <div className="flex items-center">
                        {transaction.status === 'confirming' && (
                          <div className="animate-pulse mr-2 h-2 w-2 rounded-full bg-yellow-500"></div>
                        )}
                        {transaction.status === 'processing' && (
                          <div className="animate-spin mr-2">
                            <BarChart2 size={16} />
                          </div>
                        )}
                        <span className="text-sm">{transaction.details}</span>
                      </div>
                      {(transaction.status === 'completed' || transaction.status === 'failed') && (
                        <div className="flex justify-end mt-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setTransaction({ messageId: null, status: 'idle' })}
                          >
                            Close
                          </Button>
                          {transaction.status === 'completed' && (
                            <Button variant="outline" size="sm" className="ml-2">
                              <ExternalLink size={14} className="mr-1" />
                              View Transaction
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => {
                        handleExecuteTransaction(message.id)
                        onConfirmActions(actions)
                      }}
                      className="flex items-center bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <BarChart2 size={14} className="mr-1" />
                      Execute Transaction
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex bg-gray-100 text-gray-800 rounded-tl-lg rounded-tr-lg rounded-br-lg p-3">
                <div className="flex-shrink-0 mr-2 mt-1">
                  <Bot size={16} />
                </div>
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      {messages.length === 1 && (
        <div className="px-6 mb-4">
          <p className="text-sm text-gray-500 mb-2">Quick conversation starters:</p>
          <div className="space-y-2">
            {quickPrompts.map(prompt => (
              <Button 
                key={prompt.id} 
                variant="outline" 
                className="w-full justify-start text-left"
                onClick={() => handleQuickPrompt(prompt.text)}
              >
                <span>{prompt.text}</span>
                <ChevronRight size={16} className="ml-auto" />
              </Button>
            ))}
          </div>
        </div>
      )}
      
      <CardFooter className="pt-2">
        <div className="flex w-full items-center space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Enter your question..."
            className="flex-1"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage(inputMessage)
              }
            }}
          />
          <Button 
            type="submit" 
            size="icon"
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
          >
            <ArrowUp size={18} />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
} 
