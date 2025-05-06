import { Transaction } from "@mysten/sui/transactions";
import { OrderBook, suiClient } from "./deepbookClient";
import {
  initOneKeySDK,
  getDeviceList,
  getSuiAddress,
  getEVMAddress,
  signSuiTransaction,
  DEFAULT_SUI_PATH,
  DEFAULT_EVM_PATH,
} from "./onekeySdkUtils";
import { TransactionData } from "./tradingAnalysis";
import { bcs } from "@mysten/sui/bcs";

export interface OneKeyWallet {
  isConnected: boolean;
  address: string | null;
  evm_address: string | null;
  connect: () => Promise<string>;
  disconnect: () => void;
  signAndExecuteTransaction: (transaction: TransactionData) => Promise<any>;
  signAndExecuteSuiTransaction: (transaction: []) => Promise<any>;
}

export class OneKeyHardwareWallet implements OneKeyWallet {
  isConnected: boolean = false;
  address: string | null = null;
  evm_address: string | null = null;
  private connectId: string | null = null;
  private deviceId: string | null = null;
  private orderBook: OrderBook | null = null;

  constructor() {
    initOneKeySDK();
  }

  async connect(): Promise<string> {
    try {
      const devices = await getDeviceList();

      if (devices.length === 0) {
        throw new Error(
          "No OneKey devices found. Please connect your hardware wallet and try again."
        );
      }

      const device = devices[0];
      this.connectId = device.connectId;
      this.deviceId = device.deviceId;
      if (!this.connectId || !this.deviceId) {
        throw new Error("Device connection information is missing");
      }

      const address = await getSuiAddress({
        connectId: this.connectId,
        deviceId: this.deviceId,
        path: DEFAULT_SUI_PATH,
      });
      if (!address) {
        throw new Error("Failed to retrieve SUI address from OneKey device");
      }

      const evm_address = await getEVMAddress({
        connectId: this.connectId,
        deviceId: this.deviceId,
        path: DEFAULT_EVM_PATH,
      });
      if (!evm_address) {
        throw new Error("Failed to retrieve EVM address from OneKey device");
      }

      this.address = address;
      this.evm_address = evm_address;
      this.isConnected = true;

      this.orderBook = new OrderBook(this.address);

      console.log(
        "Connected to OneKey hardware wallet with SUI address:",
        this.address,
        "EVM address:",
        this.evm_address
      );
      return this.address;
    } catch (error) {
      console.error("Error connecting to OneKey hardware wallet:", error);
      throw error;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.address = null;
    this.evm_address = null;
    this.connectId = null;
    this.deviceId = null;
    console.log("Disconnected from OneKey hardware wallet");
  }

  async signAndExecuteTransaction(transactionData: TransactionData): Promise<any> {
    if (!this.isConnected || !this.address) {
      throw new Error("Wallet not connected");
    }

    try {
      const isBuy = transactionData.transactionType === "buy";
      console.log(
        `Creating ${isBuy ? "buy" : "sell"} transaction for ${
          transactionData.pair
        } using DeepBook`
      );

      if (!transactionData.poolId) {
        throw new Error("Pool ID is required for DeepBook transactions");
      }

      console.log("Creating DeepBook transaction...", transactionData);

      const tx = new Transaction();
      tx.setSender(this.address);
      await this.orderBook!.placeOrder(
        tx,
        transactionData.baseCoinId,
        transactionData.quoteCoinId,
        isBuy,
        transactionData.amount
      );

      tx.setGasBudget(10000);
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: false });
      console.log(
        `Transaction serialization successful, length: ${txBytes.byteLength} bytes`
      );

      const serializedTx = Buffer.from(txBytes).toString("hex");
      console.log(
        "Transaction serialization successful, length: ",
        serializedTx.length
      );
      console.log(
        "Sending transaction to OneKey hardware wallet for signing..."
      );

      if (!this.connectId || !this.deviceId) {
        throw new Error("Device connection information is missing");
      }

      const signedTx = await signSuiTransaction({
        connectId: this.connectId,
        deviceId: this.deviceId,
        path: DEFAULT_SUI_PATH,
        rawTx: serializedTx,
      });

      console.log("Transaction signed successfully by OneKey hardware wallet");

      return {
        digest:
          signedTx.signature ||
          "deepbook-transaction-" + Math.random().toString(36).substring(2, 15),
        status: "success",
        timestamp: new Date().toISOString(),
        transaction: transactionData,
        deepbookTx: tx,
      };
    } catch (error) {
      console.error(
        "Error executing transaction with OneKey hardware wallet:",
        error
      );
      throw error;
    }
  }

  async signAndExecuteSuiTransaction(transactionData: []): Promise<any> {
    if (!this.isConnected || !this.address) {
      throw new Error("Wallet not connected");
    }

    if (transactionData.length === 0) {
      throw new Error("Transaction data is empty");
    }

    try {
      const tx = new Transaction();
      tx.setSender(this.address);
      
      for (const action of transactionData) {
        if (action.action == "transfer") {
          const split_coin = tx.splitCoins(tx.gas, [tx.pure(bcs.U64.serialize(parseFloat(action.amount)*1000000000))]);
          tx.transferObjects([split_coin], action.recipient);
        }
      }

      tx.setGasBudget(10000);
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: false });
      console.log(
        `Transaction serialization successful, length: ${txBytes.byteLength} bytes`
      );

      const serializedTx = Buffer.from(txBytes).toString("hex");
      console.log(
        "Transaction serialization successful, length: ",
        serializedTx.length
      );
      console.log(
        "Sending transaction to OneKey hardware wallet for signing..."
      );

      if (!this.connectId || !this.deviceId) {
        throw new Error("Device connection information is missing");
      }

      const signedTx = await signSuiTransaction({
        connectId: this.connectId,
        deviceId: this.deviceId,
        path: DEFAULT_SUI_PATH,
        rawTx: serializedTx,
      });

      console.log("================")
      console.dir(signedTx)
      console.log("================")

      console.dir({
        digest:
          signedTx.signature ||
          "deepbook-transaction-" + Math.random().toString(36).substring(2, 15),
        status: "success",
        timestamp: new Date().toISOString(),
        transaction: transactionData,
        deepbookTx: tx,
      })
      console.log("Transaction signed successfully by OneKey hardware wallet");

      return {
        digest:
          signedTx.signature ||
          "deepbook-transaction-" + Math.random().toString(36).substring(2, 15),
        status: "success",
        timestamp: new Date().toISOString(),
        transaction: transactionData,
        deepbookTx: tx,
      };
    } catch (error) {
      console.error(
        "Error executing transaction with OneKey hardware wallet:",
        error
      );
      throw error;
    }
  }
}

export const wallet = new OneKeyHardwareWallet();
