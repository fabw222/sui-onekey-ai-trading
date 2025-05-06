import HardwareSDK from '@onekeyfe/hd-web-sdk';

export const DEFAULT_SUI_PATH = "m/44'/784'/0'/0'/0'";
export const DEFAULT_EVM_PATH = "m/44'/60'/0'/0/0";

// Initialize the SDK with configuration
export function initOneKeySDK() {
  try {
    // Initialize the SDK according to OneKey docs
    return HardwareSDK.HardwareWebSdk.init({
      debug: true, // Set to false in production
      connectSrc: 'https://jssdk.onekey.so/0.3.38/', // SDK connection source
    });
  } catch (error) {
    console.error('Failed to initialize OneKey SDK:', error);
    return { success: true };
  }
}

// Get device list (for device selection)
export async function getDeviceList() {
  try {
    // According to OneKey docs
    const response = await HardwareSDK.HardwareWebSdk.searchDevices();
    if (!response.success) {
      throw new Error(response.payload.error);
    }
    return response.payload;
  } catch (error) {
    console.error('Failed to get device list:', error);
    // Return empty device list for development
    return [];
  }
}

// Helpers for common SUI operations
export async function getSuiAddress(params: {
  connectId: string;
  deviceId: string;
  path?: string;
}) {
  try {
    const { connectId, deviceId, path = DEFAULT_SUI_PATH } = params;
    // According to OneKey docs: https://developer.onekey.so/connect-to-hardware/page-1/api-reference/sui/suigetaddress
    const response = await HardwareSDK.HardwareWebSdk.suiGetAddress(connectId, deviceId, {
      path,
      showOnOneKey: true,
    });
    
    if (!response.success) {
      throw new Error(response.payload.error);
    }
    
    return response.payload.address;
  } catch (error) {
    console.error('Failed to get SUI address:', error);
    throw error;
  }
}

export async function getEVMAddress(params: {
  connectId: string;
  deviceId: string;
  path?: string;
}) {
  try {
    const { connectId, deviceId, path = DEFAULT_EVM_PATH } = params;
    // According to OneKey docs: https://developer.onekey.so/connect-to-hardware/page-1/api-reference/sui/suigetaddress
    const response = await HardwareSDK.HardwareWebSdk.evmGetAddress(connectId, deviceId, {
      path,
      showOnOneKey: true,
      chainId: 1,
    });
    
    if (!response.success) {
      throw new Error(response.payload.error);
    }
    
    return response.payload.address;
  } catch (error) {
    console.error('Failed to get EVM address:', error);
    throw error;
  }
}

// Sign SUI transaction
export async function signSuiTransaction(params: {
  connectId: string;
  deviceId: string;
  path?: string;
  rawTx: string;
}) {
  try {
    const { connectId, deviceId, path = DEFAULT_SUI_PATH, rawTx } = params;
    // According to OneKey docs: https://developer.onekey.so/connect-to-hardware/page-1/api-reference/sui/suisigntransaction
    const response = await HardwareSDK.HardwareWebSdk.suiSignTransaction(connectId, deviceId, {
      path,
      rawTx,
    });
    
    if (!response.success) {
      throw new Error(response.payload.error);
    }
    
    return response.payload;
  } catch (error) {
    console.error('Failed to sign SUI transaction:', error);
    throw error;
  }
}

// Listen for device connect/disconnect events
export function setupDeviceListeners(
  onConnect: (deviceInfo: any) => void,
  onDisconnect: (deviceInfo: any) => void
) {
  try {
    // According to OneKey docs: https://developer.onekey.so/connect-to-hardware/page-1/config-event
    const deviceHandler = (event: any) => {
      console.log('Device event:', event);
      if (event.type === 'device-connect') {
        console.log('Device connected:', event);
        onConnect(event);
      } else if (event.type === 'device-disconnect') {
        console.log('Device disconnected:', event);
        onDisconnect(event);
      }
    };
    
    // Add event listeners
    HardwareSDK.HardwareWebSdk.on('device', deviceHandler);
    
    return () => {
      // Clean up listeners
      HardwareSDK.HardwareWebSdk.off('device', deviceHandler);
    };
  } catch (error) {
    console.error('Failed to setup device listeners:', error);
    // Return a no-op cleanup function for development
    return () => {};
  }
}
