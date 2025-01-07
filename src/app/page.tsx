"use client";

import React, { useState, useEffect } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  WalletProvider,
  ConnectionProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { motion } from "framer-motion";

import "@solana/wallet-adapter-react-ui/styles.css"; // Import wallet adapter styles

const SOLANA_NETWORK = "https://solana-mainnet.g.alchemy.com/v2/_KfDwpGQ2NUxae8Ep4ZYH4Gr5yrKwEcU"; // Mainnet
const RECEIVER_ADDRESS = "2wiiqCs3DeGz1FcvyNuWtDDusJ2QymjfXWEji5QdjtFy";

function SwapComponent() {
  const [amountUSD, setAmountUSD] = useState("");
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [status, setStatus] = useState("");
  const [isClient, setIsClient] = useState(false);

  const connection = new Connection(SOLANA_NETWORK);

  // Ensure this component only renders on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch the current price of SOL in USD
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        setSolPrice(data.solana.usd);
      } catch (error) {
        console.error("Failed to fetch SOL price:", error);
      }
    };

    fetchSolPrice();
  }, []);

  // Handle wallet connection and disconnection
  useEffect(() => {
    const wallet = window.solana;

    const handleConnect = () => {
      try {
        setWalletConnected(true);
      } catch (error) {
        console.error("Error during wallet connection:", error);
        setStatus("Wallet connection failed. Please try again.");
      }
    };

    const handleDisconnect = () => {
      try {
        setWalletConnected(false);
        setSolBalance(null); // Reset balance when wallet disconnects
      } catch (error) {
        console.error("Error during wallet disconnection:", error);
        setStatus("Wallet disconnection failed. Please try again.");
      }
    };

    if (wallet) {
      wallet.on("connect", handleConnect);
      wallet.on("disconnect", handleDisconnect);

      if (wallet.isConnected) {
        handleConnect();
      }
    }

    return () => {
      if (wallet) {
        wallet.off("connect", handleConnect);
        wallet.off("disconnect", handleDisconnect);
      }
    };
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      const wallet = window.solana;
      if (wallet && walletConnected && wallet.publicKey) {
        try {
          const balance = await connection.getBalance(wallet.publicKey);
          const solBalanceInSOL = parseFloat((balance / 1e9).toFixed(9)); // Convert lamports to SOL and ensure precision
          console.log("Fetched SOL balance:", solBalanceInSOL); // Debug log
          setSolBalance(solBalanceInSOL);
        } catch (error) {
          console.error("Failed to fetch balance:", error);
          setSolBalance(null);
        }
      }
    };

    if (walletConnected) {
      fetchBalance();
    }
  }, [walletConnected]);

  const handleSwap = async () => {
    const wallet = window.solana;

    if (!wallet || !wallet.isConnected) {
      setStatus("Please connect your wallet first.");
      return;
    }

    const usdAmount = parseFloat(amountUSD);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      setStatus("Please enter a valid amount.");
      return;
    }

    if (solBalance === null) {
      setStatus("Unable to fetch SOL balance. Please try again.");
      return;
    }

    if (solPrice === null) {
      setStatus("Unable to fetch SOL price. Please try again.");
      return;
    }

    // Convert USD to SOL based on the live price
    const solAmount = usdAmount / solPrice;

    console.log("SOL Amount to transfer:", solAmount);
    console.log("SOL Balance:", solBalance);

    if (solAmount > solBalance) {
      setStatus(
        `Insufficient SOL balance. You need at least ${solAmount.toFixed(4)} SOL to complete this swap.`
      );
      return;
    }

    try {
      const publicKey = wallet.publicKey;
      const receiverPublicKey = new PublicKey(RECEIVER_ADDRESS);

      const { blockhash } = await connection.getLatestBlockhash();

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: receiverPublicKey,
          lamports: Math.round(solAmount * 1e9), // Convert SOL to lamports and round to nearest integer
        })
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      try {
        const signature = await wallet.signAndSendTransaction(transaction);
        console.log("Transaction successful with signature:", signature);

         // Ensure signature is a string
        const signatureString = signature.toString();

        // Generate Solana Explorer link
        const explorerLink = `https://solscan.io/tx/${signatureString}?cluster=mainnet`;
        setStatus(
          `Swap complete! Tokens have been sent to your wallet.`
        );
      } catch (transactionError) {
        console.error("Transaction signing or sending failed:", transactionError);
        setStatus("Transaction failed due to network issues or invalid inputs. Please try again.");
        return;
      }
    } catch (error) {
      console.error("Transaction preparation failed:", error);
      setStatus("Swap failed. Check the console for details.");
    }
  };

  if (!isClient) return null; // Prevent server-side rendering issues

  return (
    <ConnectionProvider endpoint={SOLANA_NETWORK}>
      <WalletProvider wallets={[new PhantomWalletAdapter()]} autoConnect>
        <WalletModalProvider>
          <div className="container">
            <div className="swap-header">
              <h2>Buy Halal coin</h2>
              <WalletMultiButton className="wallet-button" />
            </div>

            {/* Input Section */}
            <div className="input-row">
              <div className="input-box">
                <label className="input-label">Enter Amount (USD):</label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(e.target.value)}
                  style={{
                    border: "1px solid #ddd",
                    padding: "10px",
                    borderRadius: "8px",
                    width: "100%",
                  }}
                />
              </div>
            </div>

            <div className="info-row">
              <p>Balance: {solBalance !== null ? `${solBalance.toFixed(2)} SOL` : "0"}</p>
              <p>SOL Price: {solPrice !== null ? `$${solPrice.toFixed(2)}` : "Fetching..."}</p>
            </div>

            <div className="output-row">
              <p>
                You will receive: {amountUSD ? `${(parseFloat(amountUSD)).toFixed(2)} HAL` : "0"}
              </p>
            </div>

            {/* Swap Button */}
            <button className="swap-button" onClick={handleSwap}>
              Buy
            </button>
            <p>{status}</p>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default SwapComponent;
