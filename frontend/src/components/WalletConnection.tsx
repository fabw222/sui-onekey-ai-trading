import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Wallet, CheckCircle2, AlertCircle, Usb } from 'lucide-react';
import { wallet } from '../lib/walletIntegration';
import { initOneKeySDK, setupDeviceListeners } from '../lib/onekeySdkUtils';
import { toast } from '@/hooks/use-toast';

interface WalletConnectionProps {
  onWalletConnected: (address: string) => void;
  onWalletDisconnected: () => void;
}

export function WalletConnection({ onWalletConnected, onWalletDisconnected }: WalletConnectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<'disconnected' | 'connected'>('disconnected');

  useEffect(() => {
    initOneKeySDK();
    
    if (wallet.isConnected && wallet.address) {
      setWalletAddress(wallet.address);
      onWalletConnected(wallet.address);
    }
  }, [onWalletConnected]);
  
  useEffect(() => {
    const cleanup = setupDeviceListeners(
      (deviceInfo) => {
        console.log('OneKey device connected:', deviceInfo);
        setDeviceStatus('connected');
      },
      (deviceInfo) => {
        console.log('OneKey device disconnected:', deviceInfo);
        setDeviceStatus('disconnected');
      }
    );
    
    return cleanup;
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const address = await wallet.connect();
      if (address) {
        setWalletAddress(address);
        onWalletConnected(address);
        toast({
          title: "Connected Successfully",
          description: "OneKey hardware wallet has been successfully connected"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Wallet connection failed: ${errorMessage}`);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: errorMessage
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    wallet.disconnect();
    setWalletAddress(null);
    onWalletDisconnected();
  };

  return (
    <Card>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {walletAddress ? (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              <span className="font-medium">Wallet Connected</span>
            </div>
            <div className="text-sm text-gray-500 break-all">
              Address: {walletAddress}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">
              Connect your OneKey hardware wallet to start trading
            </p>
            <div className={`text-sm ${deviceStatus === 'connected' ? 'text-green-600' : 'text-yellow-600'}`}>
              <div className="flex items-center justify-center">
                <Usb className="h-4 w-4 mr-1" />
                <span>
                  Hardware wallet: {deviceStatus === 'connected' ? 
                    'Detected (ready to connect)' : 
                    'Not detected (please connect your device)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        {walletAddress ? (
          <Button variant="outline" onClick={handleDisconnect}>
            Disconnect Wallet
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect OneKey Wallet'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
