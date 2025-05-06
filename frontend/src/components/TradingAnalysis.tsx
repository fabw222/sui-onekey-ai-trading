import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { analyzeTradingPair, getTradingPairs, AnalysisResult, TransactionData } from '../lib/tradingAnalysis';

interface TradingAnalysisProps {
  onConfirmTransaction: (transactionData: TransactionData) => void;
  onRejectTransaction: () => void;
}

export function TradingAnalysis({ onConfirmTransaction, onRejectTransaction }: TradingAnalysisProps) {
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [amount, setAmount] = useState<string>('0');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingPairs, setTradingPairs] = useState<string[]>([]);
  const [isLoadingPairs, setIsLoadingPairs] = useState<boolean>(true);

  useEffect(() => {
    async function loadTradingPairs() {
      setIsLoadingPairs(true);
      setError(null);
      
      try {
        const pairs = await getTradingPairs();
        setTradingPairs(pairs);
        
        if (pairs.length > 0 && !selectedPair) {
          setSelectedPair(pairs[0]);
        }
      } catch (err) {
        console.error('Failed to load trading pairs:', err);
        setError(`Failed to load trading pairs: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoadingPairs(false);
      }
    }
    
    loadTradingPairs();
  }, [selectedPair]);

  const handleAnalyze = async () => {
    if (!selectedPair) {
      setError('Please select a trading pair');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeTradingPair(selectedPair);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      
      if (analysisResult && analysisResult.transactionData) {
        analysisResult.transactionData.amount = value;
        analysisResult.transactionData.total = (parseFloat(value) * parseFloat(analysisResult.transactionData.price)).toString();
      }
    }
  };

  const handleConfirm = () => {
    if (!analysisResult) return;
    
    const transactionData = {
      ...analysisResult.transactionData,
      amount,
      total: (parseFloat(amount) * parseFloat(analysisResult.transactionData.price)).toString()
    };
    
    onConfirmTransaction(transactionData);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-green-500';
    if (score >= 4) return 'text-yellow-500';
    if (score >= 2) return 'text-orange-500';
    return 'text-red-500';
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'Strong Buy':
        return <Badge className="bg-green-600"><ArrowUpCircle className="mr-1 h-4 w-4" /> {recommendation}</Badge>;
      case 'Buy':
        return <Badge className="bg-green-500"><ArrowUpCircle className="mr-1 h-4 w-4" /> {recommendation}</Badge>;
      case 'Hold':
        return <Badge className="bg-yellow-500"><AlertCircle className="mr-1 h-4 w-4" /> {recommendation}</Badge>;
      case 'Sell':
        return <Badge className="bg-orange-500"><ArrowDownCircle className="mr-1 h-4 w-4" /> {recommendation}</Badge>;
      case 'Strong Sell':
        return <Badge className="bg-red-500"><ArrowDownCircle className="mr-1 h-4 w-4" /> {recommendation}</Badge>;
      default:
        return <Badge>{recommendation}</Badge>;
    }
  };

  const chartData = analysisResult ? [
    { name: 'Volume', value: analysisResult.score >= 3 ? 3 : analysisResult.score },
    { name: 'Change', value: analysisResult.score >= 6 ? 3 : analysisResult.score / 2 },
    { name: 'Volatility', value: analysisResult.score >= 8 ? 2 : analysisResult.score / 4 },
    { name: 'Liquidity', value: analysisResult.score >= 7 ? 2 : analysisResult.score / 5 },
  ] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Trading Pair Analysis</CardTitle>
          <CardDescription>
            Select a trading pair to analyze its investment potential using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Select value={selectedPair} onValueChange={setSelectedPair} disabled={isLoadingPairs}>
                  <SelectTrigger>
                    {isLoadingPairs ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span>Loading pairs...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select trading pair" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPairs ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          <span>Loading trading pairs...</span>
                        </div>
                      </SelectItem>
                    ) : tradingPairs.length > 0 ? (
                      tradingPairs.map((pair) => (
                        <SelectItem key={pair} value={pair}>
                          {pair}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No trading pairs available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAnalyze} disabled={isAnalyzing || isLoadingPairs}>
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {analysisResult && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">{analysisResult.pair}</h3>
                    <div className="flex items-center mt-1">
                      <span className="mr-2">Score: </span>
                      <span className={`text-xl font-bold ${getScoreColor(analysisResult.score)}`}>
                        {analysisResult.score}/10
                      </span>
                    </div>
                    <div className="mt-1">
                      {getRecommendationBadge(analysisResult.recommendation)}
                    </div>
                  </div>
                  <div className="h-24 w-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 3]} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Price Analysis</h4>
                    <p className="text-sm text-gray-600">{analysisResult.analysis.priceAnalysis}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Volume Analysis</h4>
                    <p className="text-sm text-gray-600">{analysisResult.analysis.volumeAnalysis}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Volatility Analysis</h4>
                    <p className="text-sm text-gray-600">{analysisResult.analysis.volatilityAnalysis}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Liquidity Analysis</h4>
                    <p className="text-sm text-gray-600">{analysisResult.analysis.liquidityAnalysis}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-2">Transaction Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                      </label>
                      <input
                        type="text"
                        value={amount}
                        onChange={handleAmountChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total ({analysisResult.transactionData.price} × Amount)
                      </label>
                      <input
                        type="text"
                        value={(parseFloat(amount || '0') * parseFloat(analysisResult.transactionData.price)).toFixed(6)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {analysisResult && (
          <CardFooter className="flex justify-end space-x-4">
            <Button variant="outline" onClick={onRejectTransaction}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm with OneKey
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
